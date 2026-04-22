import type { WorkflowStep, WorkflowStepContext } from "cloudflare:workers";
import type {
  WorkflowRuntimeStep,
  WorkflowStepExecutionContext,
} from "../../../../../plugins/runtime";
import { createId, validateGraph } from "../../../src/lib/workflow/graph";
import type {
  ConnectionDefinition,
  TriggerKind,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowNode,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowTraceEvent,
} from "../../../src/lib/workflow/types";
import type { WorkerEnv } from "../../lib/env";
import {
  getWorkflowNodeExecutionMode,
  getWorkflowStepRunner,
} from "../plugin-runtime";
import type { Repository } from "../repository";
import { getSecret } from "../secrets";
import { evaluateExpression } from "./expression";
import {
  parseList,
  parseMaybeJson,
  renderTemplate,
  toJsonValue,
} from "./template";

interface WorkflowExecutionResult {
  status: "complete" | "errored";
  steps: WorkflowRunStep[];
  output: unknown;
}

async function getConnection(
  userId: string,
  repository: Repository,
  alias: string,
) {
  if (!alias) {
    throw new Error("A connection alias is required for this step.");
  }
  const connection = await repository.getConnectionByAlias(userId, alias);
  if (!connection) {
    throw new Error(`Connection "${alias}" was not found.`);
  }
  return connection;
}

async function getConnectionSecret(
  env: WorkerEnv,
  userId: string,
  connection: ConnectionDefinition,
  keyName: string,
) {
  return getSecret(env, userId, connection.id, keyName);
}

function createStep(step: Omit<WorkflowRunStep, "id">): WorkflowRunStep {
  return {
    id: `${step.runId}:${step.nodeId}`,
    ...step,
  };
}

function createExecutionContext(
  node: WorkflowNode,
  nodes: WorkflowNode[],
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  env: WorkerEnv,
  repository: Repository,
  userId: string,
  runId: string,
  step: WorkflowStep,
  stepName?: string,
  cloudflareStepContext?: WorkflowStepContext,
): WorkflowStepExecutionContext {
  const render = (value: string) =>
    renderTemplate(value, payload, outputs, nodes);
  const traceEvents: WorkflowTraceEvent[] = [];

  return {
    env,
    repository,
    userId,
    runId,
    node,
    payload,
    outputs,
    nodes,
    step: step as unknown as WorkflowRuntimeStep,
    stepName,
    stepContext: cloudflareStepContext,
    render,
    parseList,
    parseMaybeJson,
    evaluateExpression: (expression: string) =>
      evaluateExpression(expression, payload, outputs, nodes),
    getConnection: (alias: string) => getConnection(userId, repository, alias),
    getConnectionSecret: (connection: ConnectionDefinition, keyName: string) =>
      getConnectionSecret(env, userId, connection, keyName),
    runSubworkflow: async (
      workflowId: string,
      input: Record<string, unknown>,
    ) =>
      runSubworkflow(
        repository,
        env,
        userId,
        workflowId,
        input,
        runId,
        node.id,
        step,
        outputs,
        nodes,
      ),
    recordTraceEvent: (event) => {
      const next: WorkflowTraceEvent = {
        ...event,
        createdAt: event.createdAt ?? new Date().toISOString(),
      };
      traceEvents.push(next);
      return next;
    },
    getTraceEvents: () => [...traceEvents],
  };
}

async function executeNode(
  context: WorkflowStepExecutionContext,
): Promise<WorkflowRunStep> {
  const { node, payload, runId } = context;
  const start = new Date().toISOString();
  const finish = () => new Date().toISOString();

  if (node.data.family === "trigger") {
    context.recordTraceEvent({
      type: "trigger.accepted",
      detail: `${node.data.title} accepted the incoming trigger payload.`,
    });
    return createStep({
      runId,
      nodeId: node.id,
      nodeTitle: node.data.title,
      kind: node.data.kind,
      status: "complete",
      detail: `${node.data.title} accepted the incoming trigger payload.`,
      startedAt: start,
      finishedAt: finish(),
      durationMs: 0,
      output: toJsonValue(payload),
      traceEvents: context.getTraceEvents(),
    });
  }

  const runner = getWorkflowStepRunner(node.data.kind);
  if (!runner) {
    throw new Error(`No plugin runner registered for "${node.data.kind}".`);
  }

  context.recordTraceEvent({
    type: "step.started",
    detail: `${node.data.title} started.`,
  });
  if (context.stepContext) {
    context.recordTraceEvent({
      type: "step.metadata",
      detail: context.stepName ?? context.node.id,
      data: {
        attempt: context.stepContext.attempt,
        stepName: context.stepName ?? context.node.id,
        config: context.stepConfig ?? null,
      },
    });
    context.recordTraceEvent({
      type: "cloudflare.metric-hint",
      detail:
        context.stepContext.attempt > 1 ? "ATTEMPT_START" : "STEP_START",
      data: {
        eventType:
          context.stepContext.attempt > 1 ? "ATTEMPT_START" : "STEP_START",
        stepName: context.stepName ?? context.node.id,
        attempt: context.stepContext.attempt,
      },
    });
  }

  const result = await runner(context);
  context.recordTraceEvent({
    type: "step.completed",
    detail: result.detail,
    data: {
      status: result.status ?? "complete",
    },
  });
  if (context.stepContext) {
    context.recordTraceEvent({
      type: "cloudflare.metric-hint",
      detail:
        context.stepContext.attempt > 1 ? "ATTEMPT_SUCCESS" : "STEP_SUCCESS",
      data: {
        eventType:
          context.stepContext.attempt > 1 ? "ATTEMPT_SUCCESS" : "STEP_SUCCESS",
        stepName: context.stepName ?? context.node.id,
        attempt: context.stepContext.attempt,
      },
    });
  }
  return createStep({
    runId,
    nodeId: node.id,
    nodeTitle: node.data.title,
    kind: node.data.kind,
    status: result.status ?? "complete",
    detail: result.detail,
    startedAt: start,
    finishedAt: finish(),
    durationMs: result.durationMs ?? 0,
    output: toJsonValue(result.output),
    traceEvents: context.getTraceEvents(),
  });
}

function buildErroredStep(
  context: WorkflowStepExecutionContext,
  startedAt: string,
  error: unknown,
): WorkflowRunStep {
  const message =
    error instanceof Error ? error.message : "Unknown runtime failure.";
  context.recordTraceEvent({
    type: "step.failed",
    detail: message,
  });
  if (context.stepContext) {
    context.recordTraceEvent({
      type: "cloudflare.metric-hint",
      detail:
        context.stepContext.attempt > 1 ? "ATTEMPT_FAILURE" : "STEP_FAILURE",
      data: {
        eventType:
          context.stepContext.attempt > 1 ? "ATTEMPT_FAILURE" : "STEP_FAILURE",
        stepName: context.stepName ?? context.node.id,
        attempt: context.stepContext.attempt,
      },
    });
  }
  return createStep({
    runId: context.runId,
    nodeId: context.node.id,
    nodeTitle: context.node.data.title,
    kind: context.node.data.kind,
    status: "errored",
    detail: message,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: 0,
    traceEvents: context.getTraceEvents(),
  });
}

async function persistRunStep(
  repository: Repository,
  userId: string,
  runId: string,
  stepRecord: WorkflowRunStep,
) {
  await repository.upsertRunStep(userId, runId, stepRecord);
}

async function runNodeWithPersistence(
  context: WorkflowStepExecutionContext,
  workflowStep: WorkflowStep,
) {
  const startedAt = new Date().toISOString();
  if (getWorkflowNodeExecutionMode(context.node.data.kind) === "inline") {
    try {
      const stepRecord = await executeNode(context);
      await workflowStep.do(`persist:${context.node.id}`, async () => {
        await persistRunStep(
          context.repository as Repository,
          context.userId,
          context.runId,
          stepRecord,
        );
        return null;
      });
      return stepRecord;
    } catch (error) {
      const failedStep = buildErroredStep(context, startedAt, error);
      await workflowStep.do(`persist:${context.node.id}:error`, async () => {
        await persistRunStep(
          context.repository as Repository,
          context.userId,
          context.runId,
          failedStep,
        );
        return null;
      });
      throw error;
    }
  }

  let executedStep: WorkflowRunStep | null = null;
  await workflowStep.do(
    `${context.node.id}:${context.node.data.kind}`,
    async (cloudflareStepContext) => {
      const scopedContext: WorkflowStepExecutionContext = {
        ...context,
        stepContext: cloudflareStepContext,
      };
      try {
        executedStep = await executeNode(scopedContext);
        await persistRunStep(
          scopedContext.repository as Repository,
          scopedContext.userId,
          scopedContext.runId,
          executedStep,
        );
        return null;
      } catch (error) {
        const failedStep = buildErroredStep(scopedContext, startedAt, error);
        await persistRunStep(
          scopedContext.repository as Repository,
          scopedContext.userId,
          scopedContext.runId,
          failedStep,
        );
        throw error;
      }
    },
  );
  if (!executedStep) {
    throw new Error(`Step "${context.node.id}" did not produce an output.`);
  }
  return executedStep;
}

function nextNodes(
  graph: WorkflowGraph,
  node: WorkflowNode,
  stepOutput: unknown,
) {
  if (
    stepOutput &&
    typeof stepOutput === "object" &&
    (stepOutput as { __workflow_end?: unknown }).__workflow_end
  ) {
    return [];
  }
  const outgoing = graph.edges.filter((edge) => edge.source === node.id);
  if (node.data.kind !== "condition") {
    return outgoing.map((edge) => edge.target);
  }
  const branch = (stepOutput as { passed?: boolean } | undefined)?.passed
    ? "true"
    : "false";
  return outgoing
    .filter((edge) => (edge.data?.branch ?? "false") === branch)
    .map((edge) => edge.target);
}

async function runSubworkflow(
  repository: Repository,
  env: WorkerEnv,
  userId: string,
  workflowId: string,
  payload: Record<string, unknown>,
  parentRunId: string,
  parentStepId: string,
  step: WorkflowStep,
  parentOutputs: Record<string, unknown>,
  parentNodes: WorkflowNode[],
) {
  const parentRun = await repository.getRun(userId, parentRunId);
  const parentWorkflowId = parentRun?.workflowId;
  const workflow = await repository.getPublishedSubworkflow(
    userId,
    workflowId,
    parentWorkflowId,
  );
  if (!workflow || !workflow.publishedVersionId) {
    throw new Error(
      "Referenced sub-workflow must be published before it can run.",
    );
  }

  const version = await repository.getVersion(
    userId,
    workflow.publishedVersionId,
  );
  if (!version) {
    throw new Error("Published sub-workflow definition could not be loaded.");
  }
  const childRun: WorkflowRun = {
    id: createId("run"),
    workflowId: workflow.id,
    workflowName: workflow.name,
    versionId: workflow.publishedVersionId,
    triggerKind: "parentContext",
    status: "running",
    startedAt: new Date().toISOString(),
    parentRunId,
    parentStepId,
    rootRunId: parentRun?.rootRunId ?? parentRunId,
    runDepth: (parentRun?.runDepth ?? 0) + 1,
    steps: [],
  };
  await repository.createRun(userId, childRun);

  const started = Date.now();
  const result = await executeWorkflowGraph(
    repository,
    env,
    userId,
    workflow,
    version.definition,
    childRun.id,
    {
      ...payload,
      parent: Object.fromEntries(
        parentNodes.map((node) => [
          node.data.title,
          {
            data: parentOutputs[node.id] ?? null,
            output: parentOutputs[node.id] ?? null,
          },
        ]),
      ),
    },
    step,
  );
  await repository.updateRun(userId, childRun.id, {
    status: result.status,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  });

  if (result.status === "errored") {
    throw new Error(`Sub-workflow "${workflow.name}" failed.`);
  }

  return {
    runId: childRun.id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    output: result.output ?? null,
  };
}

export async function launchWorkflowRun(
  repository: Repository,
  env: WorkerEnv,
  workflow: WorkflowDefinition,
  userId: string,
  triggerKind: TriggerKind,
  payload: Record<string, unknown>,
) {
  const run: WorkflowRun = {
    id: createId("run"),
    workflowId: workflow.id,
    workflowName: workflow.name,
    versionId:
      workflow.status === "published" ? workflow.publishedVersionId : undefined,
    triggerKind,
    status: "queued",
    startedAt: new Date().toISOString(),
    rootRunId: undefined,
    runDepth: 0,
    steps: [],
  };
  run.rootRunId = run.id;
  await repository.createRun(userId, run);

  if (!env.WORKFLOW_RUNNER) {
    throw new Error("WORKFLOW_RUNNER binding is required.");
  }

  const instance = await env.WORKFLOW_RUNNER.create({
    id: run.id,
    params: {
      runId: run.id,
      workflowId: workflow.id,
      versionId: run.versionId,
      triggerKind,
      payload,
      userId,
    },
  });

  return repository.updateRun(userId, run.id, {
    status: "queued",
    workflowInstanceId: instance.id,
  });
}

export async function executeWorkflowGraph(
  repository: Repository,
  env: WorkerEnv,
  userId: string,
  workflow: Pick<WorkflowDefinition, "id" | "name" | "mode">,
  graph: WorkflowGraph,
  runId: string,
  payload: Record<string, unknown>,
  step: WorkflowStep,
): Promise<WorkflowExecutionResult> {
  const validation = validateGraph(graph, workflow.mode);
  const triggerNode = validation.triggerNode;
  if (!triggerNode) {
    throw new Error("A published workflow must have a trigger node.");
  }

  const outputs: Record<string, unknown> = {};
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const queue = [triggerNode.id];
  const visited = new Set<string>();
  const steps: WorkflowRunStep[] = [];
  let finalOutput: unknown = null;

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    visited.add(nodeId);

    try {
      const context = createExecutionContext(
        node,
        graph.nodes,
        payload,
        outputs,
        env,
        repository,
        userId,
        runId,
        step,
        `${node.id}:${node.data.kind}`,
      );
      const nodeStep = await runNodeWithPersistence(context, step);
      steps.push(nodeStep);
      outputs[node.id] = nodeStep.output;
      finalOutput = nodeStep.output ?? finalOutput;
      for (const next of nextNodes(graph, node, nodeStep.output)) {
        queue.push(next);
      }
    } catch (error) {
      const failedStep = await repository
        .getRun(userId, runId)
        .then(
          (run) =>
            run?.steps.find((entry) => entry.nodeId === node.id) ??
            createStep({
              runId,
              nodeId: node.id,
              nodeTitle: node.data.title,
              kind: node.data.kind,
              status: "errored",
              detail:
                error instanceof Error
                  ? error.message
                  : "Unknown runtime failure.",
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              durationMs: 0,
            }),
        );
      steps.push(failedStep);
      return {
        status: "errored",
        steps,
        output: null,
      };
    }
  }

  return {
    status: "complete",
    steps,
    output: finalOutput,
  };
}

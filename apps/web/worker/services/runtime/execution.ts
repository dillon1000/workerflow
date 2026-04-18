import type { WorkflowStep } from "cloudflare:workers";
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
    id: createId("step"),
    ...step,
  };
}

async function executeNode(
  node: WorkflowNode,
  nodes: WorkflowNode[],
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  env: WorkerEnv,
  repository: Repository,
  userId: string,
  runId: string,
  step: WorkflowStep,
): Promise<WorkflowRunStep> {
  const render = (value: string) =>
    renderTemplate(value, payload, outputs, nodes);
  const start = new Date().toISOString();
  const finish = () => new Date().toISOString();

  if (node.data.family === "trigger") {
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
    });
  }

  const runner = getWorkflowStepRunner(node.data.kind);
  if (!runner) {
    throw new Error(`No plugin runner registered for "${node.data.kind}".`);
  }

  const context: WorkflowStepExecutionContext = {
    env,
    repository,
    userId,
    runId,
    node,
    payload,
    outputs,
    nodes,
    step: step as unknown as WorkflowRuntimeStep,
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
  };

  const result = await runner(context);
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
  });
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
    steps: result.steps,
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

  const persistProgress = async (status: "running" | "errored") => {
    try {
      await repository.updateRun(userId, runId, { status, steps });
    } catch {
      // Best-effort progress reporting; real terminal update happens at the end.
    }
  };

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    visited.add(nodeId);

    const pendingStep: WorkflowRunStep = {
      id: createId("step"),
      runId,
      nodeId: node.id,
      nodeTitle: node.data.title,
      kind: node.data.kind,
      status: "running",
      detail: "Executing…",
      startedAt: new Date().toISOString(),
    };
    steps.push(pendingStep);
    await persistProgress("running");

    try {
      const nodeStep =
        getWorkflowNodeExecutionMode(node.data.kind) === "inline"
          ? await executeNode(
              node,
              graph.nodes,
              payload,
              outputs,
              env,
              repository,
              userId,
              runId,
              step,
            )
          : ((await step.do(
              `${node.id}:${node.data.kind}`,
              async () =>
                executeNode(
                  node,
                  graph.nodes,
                  payload,
                  outputs,
                  env,
                  repository,
                  userId,
                  runId,
                  step,
                ) as never,
            )) as WorkflowRunStep);

      steps[steps.length - 1] = nodeStep;
      outputs[node.id] = nodeStep.output;
      finalOutput = nodeStep.output ?? finalOutput;
      await persistProgress("running");
      for (const next of nextNodes(graph, node, nodeStep.output)) {
        queue.push(next);
      }
    } catch (error) {
      steps[steps.length - 1] = {
        id: pendingStep.id,
        runId,
        nodeId: node.id,
        nodeTitle: node.data.title,
        kind: node.data.kind,
        status: "errored",
        detail:
          error instanceof Error ? error.message : "Unknown runtime failure.",
        startedAt: pendingStep.startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: 0,
      };
      await persistProgress("errored");
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

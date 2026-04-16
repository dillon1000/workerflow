import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type {
  WorkflowRuntimeStep,
  WorkflowStepExecutionContext,
} from "../../plugins/runtime";
import { createId } from "../../src/lib/workflow/graph";
import type {
  ConnectionDefinition,
  JsonValue,
  TriggerKind,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowNode,
  WorkflowRun,
  WorkflowRunStep,
} from "../../src/lib/workflow/types";
import type { WorkerEnv } from "../lib/env";
import {
  getWorkflowNodeExecutionMode,
  getWorkflowStepRunner,
} from "./plugin-runtime";
import type { Repository } from "./repository";
import { getSecret } from "./secrets";

function readPath(source: unknown, path: string) {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((value, segment) => {
      if (value && typeof value === "object" && segment in value) {
        return (value as Record<string, unknown>)[segment];
      }
      return undefined;
    }, source);
}

function asString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function templateContext(
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  nodes: WorkflowNode[],
) {
  const byTitle = Object.fromEntries(
    nodes.map((node) => [
      node.data.title,
      { data: outputs[node.id], output: outputs[node.id] },
    ]),
  );
  return {
    trigger: { data: payload, output: payload },
    steps: Object.fromEntries(nodes.map((node) => [node.id, outputs[node.id]])),
    ...byTitle,
  };
}

function renderTemplate(
  template: string,
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  nodes: WorkflowNode[],
) {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression) => {
    const normalized = String(expression).trim();
    const [source, ...rest] = normalized.split(".");
    const path = rest.join(".");
    const context = templateContext(payload, outputs, nodes) as Record<
      string,
      unknown
    >;
    const value = context[source];
    return asString(path ? readPath(value, path) : value);
  });
}

function parseMaybeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
}

function evaluateExpression(
  expression: string,
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  nodes: WorkflowNode[],
) {
  const context = templateContext(payload, outputs, nodes);
  const fn = new Function(
    "context",
    `const { trigger, steps, ...nodes } = context; return Boolean(${expression});`,
  ) as (context: Record<string, unknown>) => boolean;
  return fn(context);
}

function parseList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

interface RunnerPayload {
  runId: string;
  userId: string;
  workflowId: string;
  versionId?: string;
  triggerKind: TriggerKind;
  payload: Record<string, unknown>;
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
    steps: [],
  };
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
    } satisfies RunnerPayload,
  });

  return repository.updateRun(userId, run.id, {
    status: "queued",
    workflowInstanceId: instance.id,
  });
}

async function executeWorkflowGraph(
  repository: Repository,
  env: WorkerEnv,
  userId: string,
  graph: WorkflowGraph,
  runId: string,
  payload: Record<string, unknown>,
  step: WorkflowStep,
) {
  const validation = graph.nodes.filter(
    (node) => node.data.family === "trigger",
  );
  const triggerNode = validation[0];
  if (!triggerNode) {
    throw new Error("A published workflow must have a trigger node.");
  }

  const outputs: Record<string, unknown> = {};
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const queue = [triggerNode.id];
  const visited = new Set<string>();
  const steps: WorkflowRunStep[] = [];

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
        status: "errored" as const,
        steps,
      };
    }
  }

  return {
    status: "complete" as const,
    steps,
  };
}

export class WorkflowRunner extends WorkflowEntrypoint<
  WorkerEnv,
  RunnerPayload
> {
  async run(event: WorkflowEvent<RunnerPayload>, step: WorkflowStep) {
    const { createRepository } = await import("~worker/services/repository");
    const repository = await createRepository(this.env);
    const workflow = await repository.getWorkflow(
      event.payload.userId,
      event.payload.workflowId,
    );
    if (!workflow) {
      throw new Error("Workflow not found.");
    }

    const graph = event.payload.versionId
      ? (
          await repository.getVersion(
            event.payload.userId,
            event.payload.versionId,
          )
        )?.definition
      : workflow.draftGraph;
    if (!graph) {
      throw new Error("Workflow definition could not be resolved.");
    }

    const started = Date.now();
    const result = await executeWorkflowGraph(
      repository,
      this.env,
      event.payload.userId,
      graph,
      event.payload.runId,
      event.payload.payload,
      step,
    );
    await repository.updateRun(event.payload.userId, event.payload.runId, {
      status: result.status,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      steps: result.steps,
    });
  }
}

function cronFieldMatches(field: string, actual: number) {
  if (field === "*") return true;
  if (field.startsWith("*/")) {
    const every = Number(field.slice(2));
    return every > 0 && actual % every === 0;
  }
  return field
    .split(",")
    .map((value) => Number(value))
    .some((value) => value === actual);
}

function cronMatches(cron: string, date: Date) {
  const [minute = "*", hour = "*", day = "*", month = "*", weekDay = "*"] =
    cron.split(/\s+/);
  return (
    cronFieldMatches(minute, date.getUTCMinutes()) &&
    cronFieldMatches(hour, date.getUTCHours()) &&
    cronFieldMatches(day, date.getUTCDate()) &&
    cronFieldMatches(month, date.getUTCMonth() + 1) &&
    cronFieldMatches(weekDay, date.getUTCDay())
  );
}

export async function dispatchScheduledRuns(
  repository: Repository,
  env: WorkerEnv,
  scheduledTime: number,
) {
  const now = new Date(scheduledTime);
  const workflows = await repository.listPublishedWorkflows();

  for (const entry of workflows) {
    const workflow = entry.workflow;
    if (!workflow.publishedVersionId) continue;
    const version = await repository.getVersion(
      entry.userId,
      workflow.publishedVersionId,
    );
    const graph = version?.definition;
    if (!graph) continue;
    const scheduleNode = graph.nodes.find(
      (node) => node.data.kind === "schedule",
    );
    if (!scheduleNode) continue;

    const cron = String(scheduleNode.data.config.cron ?? "0 * * * *");
    if (!cronMatches(cron, now)) continue;
    const minuteKey = now.toISOString().slice(0, 16);

    await launchWorkflowRun(
      repository,
      env,
      workflow,
      entry.userId,
      "schedule",
      {
        source: "schedule",
        scheduledAt: now.toISOString(),
      },
    );
    await repository.markScheduleDispatch(
      workflow.id,
      scheduleNode.id,
      minuteKey,
    );
  }
}

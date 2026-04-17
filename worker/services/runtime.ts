import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type {
  WorkflowRuntimeStep,
  WorkflowStepExecutionContext,
} from "../../plugins/runtime";
import { createId, validateGraph } from "../../src/lib/workflow/graph";
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
    parent:
      payload.parent && typeof payload.parent === "object"
        ? payload.parent
        : {},
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

type ExpressionToken = {
  type: "identifier" | "number" | "string" | "boolean" | "null" | "operator";
  value: string;
};

function tokenizeExpression(expression: string) {
  const tokens: ExpressionToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const threeCharOperator = expression.slice(index, index + 3);
    if (threeCharOperator === "===" || threeCharOperator === "!==") {
      tokens.push({ type: "operator", value: threeCharOperator });
      index += 3;
      continue;
    }

    const twoCharOperator = expression.slice(index, index + 2);
    if (["&&", "||", "==", "!=", ">=", "<=", "?."].includes(twoCharOperator)) {
      tokens.push({ type: "operator", value: twoCharOperator });
      index += 2;
      continue;
    }

    if (["(", ")", "!", ".", ">", "<", ","].includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      let value = "";
      const quote = char;
      index += 1;
      while (index < expression.length) {
        const next = expression[index];
        if (next === "\\") {
          const escaped = expression[index + 1];
          if (escaped == null) {
            throw new Error("Unterminated string in condition expression.");
          }
          value += escaped;
          index += 2;
          continue;
        }
        if (next === quote) {
          index += 1;
          break;
        }
        value += next;
        index += 1;
      }
      tokens.push({ type: "string", value });
      continue;
    }

    if (/\d/.test(char)) {
      const match = expression.slice(index).match(/^\d+(\.\d+)?/);
      if (!match) {
        throw new Error("Invalid numeric literal in condition expression.");
      }
      tokens.push({ type: "number", value: match[0] });
      index += match[0].length;
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      const match = expression.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
      if (!match) {
        throw new Error("Invalid identifier in condition expression.");
      }
      const value = match[0];
      if (value === "true" || value === "false") {
        tokens.push({ type: "boolean", value });
      } else if (value === "null" || value === "undefined") {
        tokens.push({ type: "null", value });
      } else {
        tokens.push({ type: "identifier", value });
      }
      index += value.length;
      continue;
    }

    throw new Error(`Unsupported token "${char}" in condition expression.`);
  }

  return tokens;
}

function coerceBoolean(value: unknown) {
  return Boolean(value);
}

function isEqual(left: unknown, right: unknown, strict: boolean) {
  return strict ? left === right : left == right;
}

function compareValues(left: unknown, right: unknown, operator: string) {
  const comparableLeft = left as string | number | bigint | boolean | Date;
  const comparableRight = right as string | number | bigint | boolean | Date;
  switch (operator) {
    case ">":
      return comparableLeft > comparableRight;
    case "<":
      return comparableLeft < comparableRight;
    case ">=":
      return comparableLeft >= comparableRight;
    case "<=":
      return comparableLeft <= comparableRight;
    default:
      throw new Error(`Unsupported comparison operator "${operator}".`);
  }
}

function parseExpressionValue(
  tokens: ExpressionToken[],
  context: Record<string, unknown>,
) {
  let index = 0;

  const peek = () => tokens[index];
  const consume = (expected?: string) => {
    const token = tokens[index];
    if (!token) {
      throw new Error("Unexpected end of condition expression.");
    }
    if (expected && token.value !== expected) {
      throw new Error(`Expected "${expected}" but found "${token.value}".`);
    }
    index += 1;
    return token;
  };

  const parsePrimary = (): unknown => {
    const token = peek();
    if (!token) {
      throw new Error("Unexpected end of condition expression.");
    }

    if (token.value === "(") {
      consume("(");
      const value = parseOr();
      consume(")");
      return value;
    }

    if (token.value === "!") {
      consume("!");
      return !coerceBoolean(parsePrimary());
    }

    if (token.type === "string") {
      consume();
      return token.value;
    }

    if (token.type === "number") {
      consume();
      return Number(token.value);
    }

    if (token.type === "boolean") {
      consume();
      return token.value === "true";
    }

    if (token.type === "null") {
      consume();
      return null;
    }

    if (token.type === "identifier") {
      if (token.value === "Boolean" && tokens[index + 1]?.value === "(") {
        consume();
        consume("(");
        const value = parseOr();
        consume(")");
        return coerceBoolean(value);
      }

      let value = context[token.value];
      consume();

      while (peek()?.value === "." || peek()?.value === "?.") {
        const optional = consume().value === "?.";
        const property = consume();
        if (property.type !== "identifier") {
          throw new Error("Expected property name in condition expression.");
        }
        if (value == null) {
          if (optional) {
            value = undefined;
            continue;
          }
          throw new Error(
            `Cannot read property "${property.value}" from empty value.`,
          );
        }
        value =
          typeof value === "object" || typeof value === "function"
            ? (value as Record<string, unknown>)[property.value]
            : undefined;
      }

      return value;
    }

    throw new Error(`Unsupported token "${token.value}" in condition.`);
  };

  const parseComparison = (): unknown => {
    let left = parsePrimary();
    while (
      peek() &&
      ["===", "!==", "==", "!=", ">", "<", ">=", "<="].includes(peek()!.value)
    ) {
      const operator = consume().value;
      const right = parsePrimary();
      switch (operator) {
        case "===":
          left = isEqual(left, right, true);
          break;
        case "!==":
          left = !isEqual(left, right, true);
          break;
        case "==":
          left = isEqual(left, right, false);
          break;
        case "!=":
          left = !isEqual(left, right, false);
          break;
        default:
          left = compareValues(left, right, operator);
      }
    }
    return left;
  };

  const parseAnd = (): unknown => {
    let left = parseComparison();
    while (peek()?.value === "&&") {
      consume("&&");
      const right = parseComparison();
      left = coerceBoolean(left) && coerceBoolean(right);
    }
    return left;
  };

  const parseOr = (): unknown => {
    let left = parseAnd();
    while (peek()?.value === "||") {
      consume("||");
      const right = parseAnd();
      left = coerceBoolean(left) || coerceBoolean(right);
    }
    return left;
  };

  const result = parseOr();
  if (index < tokens.length) {
    throw new Error(
      `Unexpected token "${tokens[index]?.value}" in condition expression.`,
    );
  }
  return result;
}

function evaluateExpression(
  expression: string,
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  nodes: WorkflowNode[],
) {
  const context = templateContext(payload, outputs, nodes);
  const tokens = tokenizeExpression(expression);
  return coerceBoolean(parseExpressionValue(tokens, context));
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

interface RunnerPayload {
  runId: string;
  userId: string;
  workflowId: string;
  versionId?: string;
  triggerKind: TriggerKind;
  payload: Record<string, unknown>;
}

interface WorkflowExecutionResult {
  status: "complete" | "errored";
  steps: WorkflowRunStep[];
  output: unknown;
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
        status: "errored" as const,
        steps,
        output: null,
      };
    }
  }

  return {
    status: "complete" as const,
    steps,
    output: finalOutput,
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
      workflow,
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

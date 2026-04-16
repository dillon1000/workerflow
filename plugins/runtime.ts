import type {
  ConnectionDefinition,
  RunStatus,
  WorkflowNode,
} from "../src/lib/workflow/types";

export interface WorkflowRuntimeStep {
  sleep: (...args: unknown[]) => Promise<void>;
}

export interface WorkflowRepositoryLike {
  getConnectionByAlias: (
    userId: string,
    alias: string,
  ) => Promise<ConnectionDefinition | null>;
}

export interface WorkflowStepExecutionResult {
  detail: string;
  output?: unknown;
  status?: RunStatus;
  durationMs?: number;
}

export interface WorkflowStepExecutionContext {
  env: {
    AI?: {
      run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
    };
    DB: {
      prepare: (sql: string) => {
        all: () => Promise<{ results: unknown[] }>;
      };
    };
  };
  repository: WorkflowRepositoryLike;
  userId: string;
  runId: string;
  node: WorkflowNode;
  payload: Record<string, unknown>;
  outputs: Record<string, unknown>;
  nodes: WorkflowNode[];
  step: WorkflowRuntimeStep;
  render: (value: string) => string;
  parseList: (value: string) => string[];
  parseMaybeJson: (value: string) => unknown;
  evaluateExpression: (expression: string) => boolean;
  getConnection: (alias: string) => Promise<ConnectionDefinition>;
  getConnectionSecret: (
    connection: ConnectionDefinition,
    keyName: string,
  ) => Promise<string | null>;
}

export type WorkflowStepRunner = (
  context: WorkflowStepExecutionContext,
) => Promise<WorkflowStepExecutionResult>;

export interface ConnectionTestContext {
  env: unknown;
  userId: string;
  connection: ConnectionDefinition;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export type ConnectionTestRunner = (
  context: ConnectionTestContext,
) => Promise<ConnectionTestResult>;

export interface TriggerPreparePayloadContext {
  rawBody: string;
  payload: Record<string, unknown>;
  headers: Headers;
}

export interface TriggerVerifyContext {
  env: unknown;
  repository: WorkflowRepositoryLike;
  userId: string;
  node: WorkflowNode;
  rawBody: string;
  payload: Record<string, unknown>;
  headers: Headers;
}

export interface WorkflowTriggerHandler {
  kind: string;
  preparePayload?: (
    context: TriggerPreparePayloadContext,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  matches: (node: WorkflowNode, payload: Record<string, unknown>) => boolean;
  verify?: (context: TriggerVerifyContext) => Promise<void>;
}

import type {
  WorkflowStepConfig,
  WorkflowStepContext,
} from "cloudflare:workers";
import type {
  ConnectionDefinition,
  WorkflowEffect,
  RunStatus,
  WorkflowNode,
  WorkflowRunStep,
  WorkflowTraceEvent,
} from "../apps/web/src/lib/workflow/types";

export interface WorkflowRuntimeStep {
  do?: {
    <T>(
      name: string,
      callback: (context: WorkflowStepContext) => Promise<T>,
    ): Promise<T>;
    <T>(
      name: string,
      config: WorkflowStepConfig,
      callback: (context: WorkflowStepContext) => Promise<T>,
    ): Promise<T>;
  };
  sleep: (...args: unknown[]) => Promise<void>;
  sleepUntil?: (name: string, timestamp: Date | number) => Promise<void>;
}

export interface WorkflowRepositoryLike {
  getConnectionByAlias: (
    userId: string,
    alias: string,
  ) => Promise<ConnectionDefinition | null>;
  claimEffect: (input: {
    userId: string;
    runId: string;
    nodeId: string;
    effectKey: string;
    provider: string;
    operation: string;
    requestHash: string;
  }) => Promise<WorkflowEffect>;
  completeEffect: (input: {
    userId: string;
    effectKey: string;
    output?: unknown;
    remoteRef?: string;
  }) => Promise<WorkflowEffect>;
  failEffect: (input: {
    userId: string;
    effectKey: string;
    error: string;
  }) => Promise<WorkflowEffect>;
  upsertRunStep: (
    userId: string,
    runId: string,
    step: WorkflowRunStep,
  ) => Promise<WorkflowRunStep>;
}

export interface SubworkflowResult {
  runId: string;
  workflowId: string;
  workflowName: string;
  output: unknown;
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
    HYPERDRIVE: {
      connectionString: string;
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
  stepName?: string;
  stepConfig?: WorkflowStepConfig;
  stepContext?: WorkflowStepContext;
  render: (value: string) => string;
  parseList: (value: string) => string[];
  parseMaybeJson: (value: string) => unknown;
  evaluateExpression: (expression: string) => boolean;
  getConnection: (alias: string) => Promise<ConnectionDefinition>;
  getConnectionSecret: (
    connection: ConnectionDefinition,
    keyName: string,
  ) => Promise<string | null>;
  runSubworkflow: (
    workflowId: string,
    input: Record<string, unknown>,
  ) => Promise<SubworkflowResult>;
  recordTraceEvent: (
    event: Omit<WorkflowTraceEvent, "createdAt"> & { createdAt?: string },
  ) => WorkflowTraceEvent;
  getTraceEvents: () => WorkflowTraceEvent[];
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

import type {
  BootstrapPayload,
  ConnectionDefinition,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowMode,
  WorkflowRun,
  WorkflowSnippet,
  WorkflowVersion,
} from "../../src/lib/workflow/types";
import type { WorkerEnv } from "../lib/env";
import { createDb } from "./database";
import { PgRepository } from "./repository/pg-repository";

export interface Repository {
  getBootstrap(userId: string): Promise<BootstrapPayload>;
  listWorkflows(userId: string): Promise<WorkflowDefinition[]>;
  getWorkflow(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowDefinition | null>;
  getVersion(
    userId: string,
    versionId: string,
  ): Promise<WorkflowVersion | null>;
  createWorkflow(
    userId: string,
    name: string,
    mode?: WorkflowMode,
    parentWorkflowId?: string,
  ): Promise<WorkflowDefinition>;
  listSubworkflows(userId: string): Promise<WorkflowDefinition[]>;
  getPublishedSubworkflow(
    userId: string,
    workflowId: string,
    parentWorkflowId?: string,
  ): Promise<WorkflowDefinition | null>;
  updateWorkflow(
    userId: string,
    workflowId: string,
    patch: Partial<
      Pick<WorkflowDefinition, "name" | "description" | "draftGraph">
    >,
  ): Promise<WorkflowDefinition>;
  deleteWorkflow(userId: string, workflowId: string): Promise<void>;
  publishWorkflow(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowDefinition>;
  listRuns(userId: string, workflowId?: string): Promise<WorkflowRun[]>;
  getRun(userId: string, runId: string): Promise<WorkflowRun | null>;
  createRun(userId: string, run: WorkflowRun): Promise<void>;
  updateRun(
    userId: string,
    runId: string,
    patch: Partial<WorkflowRun>,
  ): Promise<WorkflowRun>;
  listConnections(userId: string): Promise<ConnectionDefinition[]>;
  getConnectionByAlias(
    userId: string,
    alias: string,
  ): Promise<ConnectionDefinition | null>;
  getConnection(
    userId: string,
    connectionId: string,
  ): Promise<ConnectionDefinition | null>;
  createConnection(
    userId: string,
    input: Omit<
      ConnectionDefinition,
      "id" | "createdAt" | "updatedAt" | "secretKeys" | "hasSecrets"
    >,
  ): Promise<ConnectionDefinition>;
  updateConnection(
    userId: string,
    connectionId: string,
    patch: Partial<
      Omit<
        ConnectionDefinition,
        "id" | "createdAt" | "updatedAt" | "secretKeys" | "hasSecrets"
      >
    >,
  ): Promise<ConnectionDefinition>;
  deleteConnection(userId: string, connectionId: string): Promise<void>;
  upsertSecretMetadata(
    userId: string,
    connectionId: string,
    provider: string,
    keyName: string,
    hasValue: boolean,
  ): Promise<void>;
  replacePublishedTriggerIndex(
    userId: string,
    workflowId: string,
    graph: WorkflowGraph,
    versionId: string,
    publishedAt: string,
  ): Promise<void>;
  listPublishedWorkflows(): Promise<
    Array<{ userId: string; workflow: WorkflowDefinition }>
  >;
  markScheduleDispatch(
    workflowId: string,
    triggerNodeId: string,
    timestamp: string,
  ): Promise<void>;
  claimScheduleDispatch(
    workflowId: string,
    triggerNodeId: string,
    timestamp: string,
  ): Promise<boolean>;
  listSnippets(userId: string): Promise<WorkflowSnippet[]>;
  createSnippet(
    userId: string,
    input: { name: string; description: string; graph: WorkflowGraph },
  ): Promise<WorkflowSnippet>;
  deleteSnippet(userId: string, snippetId: string): Promise<void>;
  close(): Promise<void>;
}

export async function createRepository(env: WorkerEnv): Promise<Repository> {
  const { db, client } = await createDb(env);
  return new PgRepository(db, client);
}

export async function withRepository<T>(
  env: WorkerEnv,
  callback: (repository: Repository) => Promise<T>,
): Promise<T> {
  const repository = await createRepository(env);
  try {
    return await callback(repository);
  } finally {
    await repository.close();
  }
}

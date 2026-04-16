import { fetchJson } from "@/lib/api/client";
import type {
  BootstrapPayload,
  ConnectionDefinition,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowRun,
  WorkflowSnippet,
} from "@/lib/workflow/types";

export function getBootstrap() {
  return fetchJson<BootstrapPayload>("/api/bootstrap");
}

export function createWorkflow(name: string) {
  return fetchJson<WorkflowDefinition>("/api/workflows", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function saveWorkflow(
  workflowId: string,
  patch: Partial<Pick<WorkflowDefinition, "name" | "description">> & {
    draftGraph?: WorkflowGraph;
  },
) {
  return fetchJson<WorkflowDefinition>(`/api/workflows/${workflowId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteWorkflow(workflowId: string) {
  return fetchJson<{ success: boolean }>(`/api/workflows/${workflowId}`, {
    method: "DELETE",
  });
}

export function publishWorkflow(workflowId: string) {
  return fetchJson<WorkflowDefinition>(`/api/workflows/${workflowId}/publish`, {
    method: "POST",
  });
}

export function runWorkflow(
  workflowId: string,
  triggerKind: WorkflowRun["triggerKind"],
  payload: Record<string, unknown>,
) {
  return fetchJson<WorkflowRun>(`/api/workflows/${workflowId}/run`, {
    method: "POST",
    body: JSON.stringify({ triggerKind, payload }),
  });
}

export function getWorkflowRuns(workflowId: string) {
  return fetchJson<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`);
}

export function getRun(runId: string) {
  return fetchJson<WorkflowRun>(`/api/runs/${runId}`);
}

export function createConnection(body: {
  provider: ConnectionDefinition["provider"];
  alias: string;
  label: string;
  notes: string;
  config: Record<string, string>;
  secretValues?: Record<string, string>;
}) {
  return fetchJson<ConnectionDefinition>("/api/connections", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateConnection(
  connectionId: string,
  body: Partial<{
    alias: string;
    label: string;
    notes: string;
    status: ConnectionDefinition["status"];
    config: Record<string, string>;
    secretValues: Record<string, string>;
  }>,
) {
  return fetchJson<ConnectionDefinition>(`/api/connections/${connectionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function testConnection(connectionId: string) {
  return fetchJson<{ success: boolean; message: string }>(
    `/api/connections/${connectionId}/test`,
    {
      method: "POST",
    },
  );
}

export function removeConnection(connectionId: string) {
  return fetchJson<{ success: boolean }>(`/api/connections/${connectionId}`, {
    method: "DELETE",
  });
}

export function listSnippets() {
  return fetchJson<WorkflowSnippet[]>("/api/snippets");
}

export function createSnippet(body: {
  name: string;
  description: string;
  graph: WorkflowGraph;
}) {
  return fetchJson<WorkflowSnippet>("/api/snippets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteSnippet(snippetId: string) {
  return fetchJson<{ success: boolean }>(`/api/snippets/${snippetId}`, {
    method: "DELETE",
  });
}

export function generateWorkflowGraph(body: {
  prompt: string;
  connectionAlias: string;
}) {
  return fetchJson<{ graph: WorkflowGraph; notes: string }>(
    "/api/workflows/generate",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

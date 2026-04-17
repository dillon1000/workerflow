import { validateGraph } from "../../../src/lib/workflow/graph";
import type {
  WorkflowGraph,
  WorkflowMode,
} from "../../../src/lib/workflow/types";

export function dependencyTargets(graph: WorkflowGraph) {
  return graph.nodes
    .filter((node) => node.data.kind === "runSubworkflow")
    .map((node) => String(node.data.config.workflowId ?? "").trim())
    .filter(Boolean);
}

export async function validateWorkflowDefinition(
  listWorkflowRows: () => Promise<
    Array<{
      id: string;
      mode: string | null;
      parentWorkflowId: string | null;
      status: string;
      draftGraphJson: string;
    }>
  >,
  workflowId: string,
  mode: WorkflowMode,
  parentWorkflowId: string | undefined,
  graph: WorkflowGraph,
) {
  const validation = validateGraph(graph, mode);
  if (!validation.valid) {
    throw new Error(validation.issues.join(" "));
  }

  if (mode === "subworkflow" && !parentWorkflowId) {
    throw new Error("Sub-workflows must belong to a parent workflow.");
  }

  const rows = await listWorkflowRows();
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const graphById = new Map<string, WorkflowGraph>(
    rows.map((row) => [
      row.id,
      JSON.parse(row.draftGraphJson) as WorkflowGraph,
    ]),
  );
  graphById.set(workflowId, graph);

  for (const targetId of dependencyTargets(graph)) {
    if (targetId === workflowId) {
      throw new Error("A workflow cannot reference itself as a sub-workflow.");
    }
    const target = rowById.get(targetId);
    if (!target) {
      throw new Error("A referenced sub-workflow no longer exists.");
    }
    if ((target.mode ?? "standard") !== "subworkflow") {
      throw new Error("Only dedicated sub-workflows can be referenced.");
    }
    if ((target.parentWorkflowId ?? undefined) !== workflowId) {
      throw new Error(
        "Sub-workflows are workflow-scoped and can only be used by their parent workflow.",
      );
    }
    if (target.status !== "published") {
      throw new Error(
        "Parent workflows can only reference published sub-workflows.",
      );
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const emptyGraph: WorkflowGraph = { nodes: [], edges: [] };
  const hasCycle = (candidateId: string): boolean => {
    if (visiting.has(candidateId)) return true;
    if (visited.has(candidateId)) return false;
    visiting.add(candidateId);
    for (const nextId of dependencyTargets(
      graphById.get(candidateId) ?? emptyGraph,
    )) {
      if (!graphById.has(nextId)) continue;
      if (hasCycle(nextId)) return true;
    }
    visiting.delete(candidateId);
    visited.add(candidateId);
    return false;
  };

  if (hasCycle(workflowId)) {
    throw new Error("Workflow dependency cycles are not allowed.");
  }
}

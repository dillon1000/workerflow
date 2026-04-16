import { atom } from "jotai";
import { toast } from "sonner";
import { getSession, signOut } from "@/lib/api/auth";
import {
  createConnection,
  createSnippet,
  createWorkflow,
  deleteSnippet,
  deleteWorkflow,
  generateWorkflowGraph,
  getBootstrap,
  getRun,
  getWorkflowRuns,
  publishWorkflow,
  removeConnection,
  runWorkflow,
  saveWorkflow,
  testConnection,
  updateConnection,
} from "@/lib/api/workflows";
import {
  cloneGraphWithNewIds,
  connectGraph,
  createNode,
  createStarterGraph,
  getSelectedNode,
  hasTriggerNode,
  mergeGraph,
  normalizeGraph,
  removeNode,
  updateNodeConfig,
  updateNodeDataField,
  workflowSlug,
  applyGraphEdgeChanges,
  applyGraphNodeChanges,
} from "@/lib/workflow/graph";
import { getWorkflowTemplate } from "@/lib/workflow/templates";
import type {
  AnalyticsOverview,
  AuthSessionPayload,
  BootstrapPayload,
  ConnectionDefinition,
  RunStatus,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowNodeKind,
  WorkflowRun,
  WorkflowSnippet,
} from "@/lib/workflow/types";
import type { Connection, EdgeChange, NodeChange } from "@xyflow/react";

interface AppState {
  bootstrapped: boolean;
  loading: boolean;
  session: AuthSessionPayload | null;
  workflows: WorkflowDefinition[];
  runs: WorkflowRun[];
  connections: ConnectionDefinition[];
  analytics: AnalyticsOverview | null;
  snippets: WorkflowSnippet[];
  selectedWorkflowId: string | null;
  selectedNodeId: string | null;
  activeRunId: string | null;
  rightPanelTab: "inspector" | "run";
}

const initialState: AppState = {
  bootstrapped: false,
  loading: false,
  session: null,
  workflows: [],
  runs: [],
  connections: [],
  analytics: null,
  snippets: [],
  selectedWorkflowId: null,
  selectedNodeId: null,
  activeRunId: null,
  rightPanelTab: "inspector",
};

export const appStateAtom = atom<AppState>(initialState);

const setLoadingAtom = atom(null, (_get, set, loading: boolean) => {
  set(appStateAtom, (current) => ({ ...current, loading }));
});

export const bootstrapAtom = atom(null, async (_get, set) => {
  set(setLoadingAtom, true);

  try {
    const [session, bootstrap] = await Promise.all([
      getSession().catch(() => null),
      getBootstrap().catch(() => null),
    ]);

    const payload =
      bootstrap ??
      ({
        workflows: [],
        runs: [],
        connections: [],
        snippets: [],
        analytics: {
          totalWorkflows: 0,
          publishedWorkflows: 0,
          successRate: 0,
          medianDurationMs: 0,
          totalRuns: 0,
          triggerMix: {},
        },
      } satisfies BootstrapPayload);

    set(appStateAtom, (current) => ({
      ...current,
      bootstrapped: true,
      loading: false,
      session,
      workflows: payload.workflows.map((workflow) => ({
        ...workflow,
        draftGraph: normalizeGraph(workflow.draftGraph),
      })),
      runs: payload.runs,
      connections: payload.connections,
      analytics: payload.analytics,
      snippets: payload.snippets,
      selectedWorkflowId:
        current.selectedWorkflowId ?? payload.workflows[0]?.id ?? null,
      selectedNodeId: current.selectedNodeId,
    }));
  } catch (error) {
    set(setLoadingAtom, false);
    toast.error(
      error instanceof Error ? error.message : "Unable to bootstrap the app.",
    );
  }
});

export const refreshRunsAtom = atom(
  null,
  async (_unused, set, workflowId: string) => {
    const runs = await getWorkflowRuns(workflowId);
    set(appStateAtom, (current) => ({
      ...current,
      runs: [
        ...runs,
        ...current.runs.filter((run) => run.workflowId !== workflowId),
      ].sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    }));
  },
);

export const selectWorkflowAtom = atom(
  null,
  (_get, set, workflowId: string | null) => {
    set(appStateAtom, (current) => ({
      ...current,
      selectedWorkflowId: workflowId,
      selectedNodeId: null,
    }));
  },
);

export const selectNodeAtom = atom(null, (_get, set, nodeId: string | null) => {
  set(appStateAtom, (current) => ({
    ...current,
    selectedNodeId: nodeId,
  }));
});

export const createWorkflowAtom = atom(
  null,
  async (_get, set, name: string) => {
    const workflow = await createWorkflow(name);
    set(appStateAtom, (current) => ({
      ...current,
      workflows: [
        { ...workflow, draftGraph: normalizeGraph(workflow.draftGraph) },
        ...current.workflows,
      ],
      selectedWorkflowId: workflow.id,
      selectedNodeId: workflow.draftGraph.nodes[0]?.id ?? null,
    }));
    toast.success("Workflow created.");
    return workflow;
  },
);

function updateWorkflowInState(
  workflows: WorkflowDefinition[],
  workflowId: string,
  updater: (workflow: WorkflowDefinition) => WorkflowDefinition,
) {
  return workflows.map((workflow) =>
    workflow.id === workflowId ? updater(workflow) : workflow,
  );
}

export const saveWorkflowMetaAtom = atom(
  null,
  (
    _get,
    set,
    payload: { workflowId: string; name?: string; description?: string },
  ) => {
    set(appStateAtom, (current) => ({
      ...current,
      workflows: updateWorkflowInState(
        current.workflows,
        payload.workflowId,
        (workflow) => ({
          ...workflow,
          name: payload.name ?? workflow.name,
          description: payload.description ?? workflow.description,
          slug: payload.name ? workflowSlug(payload.name) : workflow.slug,
        }),
      ),
    }));
  },
);

export const updateWorkflowGraphAtom = atom(
  null,
  (_unused, set, payload: { workflowId: string; graph: WorkflowGraph }) => {
    set(appStateAtom, (current) => ({
      ...current,
      workflows: updateWorkflowInState(
        current.workflows,
        payload.workflowId,
        (workflow) => ({
          ...workflow,
          draftGraph: payload.graph,
        }),
      ),
    }));
  },
);

export const applyNodeChangesAtom = atom(
  null,
  (get, set, payload: { workflowId: string; changes: NodeChange[] }) => {
    const workflow = get(selectedWorkflowAtomValue(payload.workflowId));
    if (!workflow) return;
    const nextGraph = applyGraphNodeChanges(
      workflow.draftGraph,
      payload.changes,
    );
    set(updateWorkflowGraphAtom, {
      workflowId: payload.workflowId,
      graph: nextGraph,
    });
    const removed = payload.changes.some((change) => change.type === "remove");
    if (removed) {
      const stillPresent = nextGraph.nodes.some(
        (node) => node.id === get(appStateAtom).selectedNodeId,
      );
      if (!stillPresent) set(selectNodeAtom, null);
    }
  },
);

export const applyEdgeChangesAtom = atom(
  null,
  (get, set, payload: { workflowId: string; changes: EdgeChange[] }) => {
    const workflow = get(selectedWorkflowAtomValue(payload.workflowId));
    if (!workflow) return;
    set(updateWorkflowGraphAtom, {
      workflowId: payload.workflowId,
      graph: applyGraphEdgeChanges(workflow.draftGraph, payload.changes),
    });
  },
);

export const connectNodesAtom = atom(
  null,
  (get, set, payload: { workflowId: string; connection: Connection }) => {
    const workflow = get(selectedWorkflowAtomValue(payload.workflowId));
    if (!workflow) return;
    set(updateWorkflowGraphAtom, {
      workflowId: payload.workflowId,
      graph: connectGraph(workflow.draftGraph, payload.connection),
    });
  },
);

export const addNodeAtom = atom(
  null,
  (
    get,
    set,
    payload: {
      workflowId: string;
      kind: WorkflowNodeKind;
      x?: number;
      y?: number;
    },
  ) => {
    const workflow = get(selectedWorkflowAtomValue(payload.workflowId));
    if (!workflow) return;
    const template = getWorkflowTemplate(payload.kind);
    if (template?.family === "trigger" && hasTriggerNode(workflow.draftGraph)) {
      toast.error(
        "This workflow already has a trigger. Remove it before adding another.",
      );
      return;
    }
    const next = createNode(payload.kind, {
      x: payload.x ?? 360,
      y: payload.y ?? 240,
    });
    set(updateWorkflowGraphAtom, {
      workflowId: payload.workflowId,
      graph: {
        ...workflow.draftGraph,
        nodes: [...workflow.draftGraph.nodes, next],
      },
    });
    set(selectNodeAtom, next.id);
  },
);

export const removeSelectedNodeAtom = atom(
  null,
  (get, set, workflowId: string) => {
    const workflow = get(selectedWorkflowAtomValue(workflowId));
    const nodeId = get(appStateAtom).selectedNodeId;
    if (!workflow || !nodeId) return;
    set(updateWorkflowGraphAtom, {
      workflowId,
      graph: removeNode(workflow.draftGraph, nodeId),
    });
    set(selectNodeAtom, null);
  },
);

export const updateSelectedNodeTitleAtom = atom(
  null,
  (get, set, title: string) => {
    const { selectedWorkflowId, selectedNodeId } = get(appStateAtom);
    if (!selectedWorkflowId || !selectedNodeId) return;
    const workflow = get(selectedWorkflowAtomValue(selectedWorkflowId));
    if (!workflow) return;
    set(updateWorkflowGraphAtom, {
      workflowId: selectedWorkflowId,
      graph: updateNodeDataField(
        workflow.draftGraph,
        selectedNodeId,
        "title",
        title,
      ),
    });
  },
);

export const updateSelectedNodeSubtitleAtom = atom(
  null,
  (get, set, subtitle: string) => {
    const { selectedWorkflowId, selectedNodeId } = get(appStateAtom);
    if (!selectedWorkflowId || !selectedNodeId) return;
    const workflow = get(selectedWorkflowAtomValue(selectedWorkflowId));
    if (!workflow) return;
    set(updateWorkflowGraphAtom, {
      workflowId: selectedWorkflowId,
      graph: updateNodeDataField(
        workflow.draftGraph,
        selectedNodeId,
        "subtitle",
        subtitle,
      ),
    });
  },
);

export const updateSelectedNodeConfigAtom = atom(
  null,
  (get, set, payload: { key: string; value: unknown }) => {
    const { selectedWorkflowId, selectedNodeId } = get(appStateAtom);
    if (!selectedWorkflowId || !selectedNodeId) return;
    const workflow = get(selectedWorkflowAtomValue(selectedWorkflowId));
    if (!workflow) return;
    set(updateWorkflowGraphAtom, {
      workflowId: selectedWorkflowId,
      graph: updateNodeConfig(
        workflow.draftGraph,
        selectedNodeId,
        payload.key,
        payload.value,
      ),
    });
  },
);

export const saveCurrentWorkflowAtom = atom(null, async (get, set) => {
  const state = get(appStateAtom);
  const workflow = state.workflows.find(
    (item) => item.id === state.selectedWorkflowId,
  );
  if (!workflow) return;
  try {
    const saved = await saveWorkflow(workflow.id, {
      name: workflow.name,
      description: workflow.description,
      draftGraph: workflow.draftGraph,
    });
    set(appStateAtom, (current) => ({
      ...current,
      workflows: updateWorkflowInState(
        current.workflows,
        workflow.id,
        () => saved,
      ),
    }));
    toast.success("Draft saved.");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Unable to save draft.",
    );
  }
});

export const publishCurrentWorkflowAtom = atom(null, async (get, set) => {
  const state = get(appStateAtom);
  const workflowId = state.selectedWorkflowId;
  if (!workflowId) return;
  try {
    const published = await publishWorkflow(workflowId);
    set(appStateAtom, (current) => ({
      ...current,
      workflows: updateWorkflowInState(
        current.workflows,
        workflowId,
        () => published,
      ),
    }));
    toast.success("Workflow published.");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Unable to publish workflow.",
    );
  }
});

function upsertRun(runs: WorkflowRun[], next: WorkflowRun) {
  const existing = runs.findIndex((run) => run.id === next.id);
  if (existing === -1) return [next, ...runs];
  const copy = runs.slice();
  copy[existing] = next;
  return copy;
}

export const setRightPanelTabAtom = atom(
  null,
  (_get, set, tab: AppState["rightPanelTab"]) => {
    set(appStateAtom, (current) => ({ ...current, rightPanelTab: tab }));
  },
);

export const runCurrentWorkflowAtom = atom(
  null,
  async (get, set, payload?: Record<string, unknown>) => {
    const state = get(appStateAtom);
    const workflowId = state.selectedWorkflowId;
    if (!workflowId) return;
    let run: WorkflowRun;
    try {
      run = await runWorkflow(
        workflowId,
        "button",
        payload ?? { source: "manual" },
      );
      set(appStateAtom, (current) => ({
        ...current,
        runs: upsertRun(current.runs, run),
        activeRunId: run.id,
        rightPanelTab: "run",
      }));
      toast.success("Workflow run started.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to start workflow run.",
      );
      return;
    }

    const deadline = Date.now() + 5 * 60_000;
    const terminal = new Set<RunStatus>(["complete", "errored"]);
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (get(appStateAtom).activeRunId !== run.id) return;
      try {
        const latest = await getRun(run.id);
        set(appStateAtom, (current) => ({
          ...current,
          runs: upsertRun(current.runs, latest),
        }));
        if (terminal.has(latest.status)) return;
      } catch {
        // Transient network issues: keep polling until the deadline.
      }
    }
  },
);

export const deleteCurrentWorkflowAtom = atom(null, async (get, set) => {
  const workflowId = get(appStateAtom).selectedWorkflowId;
  if (!workflowId) return;
  await deleteWorkflow(workflowId);
  set(appStateAtom, (current) => {
    const workflows = current.workflows.filter(
      (workflow) => workflow.id !== workflowId,
    );
    return {
      ...current,
      workflows,
      selectedWorkflowId: workflows[0]?.id ?? null,
      selectedNodeId: null,
    };
  });
  toast.success("Workflow deleted.");
});

export const createConnectionAtom = atom(
  null,
  async (_get, set, payload: Parameters<typeof createConnection>[0]) => {
    const connection = await createConnection(payload);
    set(appStateAtom, (current) => ({
      ...current,
      connections: [
        connection,
        ...current.connections.filter((item) => item.id !== connection.id),
      ],
    }));
    toast.success("Connection saved.");
  },
);

export const updateConnectionAtom = atom(
  null,
  async (
    _get,
    set,
    payload: {
      connectionId: string;
      patch: Parameters<typeof updateConnection>[1];
    },
  ) => {
    const connection = await updateConnection(
      payload.connectionId,
      payload.patch,
    );
    set(appStateAtom, (current) => ({
      ...current,
      connections: current.connections.map((item) =>
        item.id === connection.id ? connection : item,
      ),
    }));
    toast.success("Connection updated.");
  },
);

export const testConnectionAtom = atom(
  null,
  async (_get, _set, connectionId: string) => {
    const result = await testConnection(connectionId);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  },
);

export const removeConnectionAtom = atom(
  null,
  async (_get, set, connectionId: string) => {
    await removeConnection(connectionId);
    set(appStateAtom, (current) => ({
      ...current,
      connections: current.connections.filter(
        (connection) => connection.id !== connectionId,
      ),
    }));
    toast.success("Connection removed.");
  },
);

export const signOutAtom = atom(null, async (_get, set) => {
  await signOut();
  set(appStateAtom, initialState);
});

export const selectedWorkflowAtomValue = (workflowId?: string | null) =>
  atom(
    (get) =>
      get(appStateAtom).workflows.find(
        (workflow) => workflow.id === workflowId,
      ) ?? null,
  );

export const currentWorkflowAtom = atom((get) =>
  get(selectedWorkflowAtomValue(get(appStateAtom).selectedWorkflowId)),
);
export const currentWorkflowGraphAtom = atom(
  (get) => get(currentWorkflowAtom)?.draftGraph ?? createStarterGraph(),
);
export const selectedNodeAtomValue = atom((get) => {
  const state = get(appStateAtom);
  const workflow = get(currentWorkflowAtom);
  return getSelectedNode(
    workflow?.draftGraph ?? createStarterGraph(),
    state.selectedNodeId,
  );
});

export const activeRunAtom = atom<WorkflowRun | null>((get) => {
  const { activeRunId, runs } = get(appStateAtom);
  if (!activeRunId) return null;
  return runs.find((run) => run.id === activeRunId) ?? null;
});

export const nodeRunStatusesAtom = atom<Record<string, RunStatus>>((get) => {
  const run = get(activeRunAtom);
  if (!run) return {};
  const map: Record<string, RunStatus> = {};
  for (const step of run.steps) {
    // Later steps (retries / branch re-entries) override earlier placeholders.
    map[step.nodeId] = step.status;
  }
  return map;
});

export const clearActiveRunAtom = atom(null, (_get, set) => {
  set(appStateAtom, (current) => ({
    ...current,
    activeRunId: null,
    rightPanelTab: "inspector",
  }));
});

export const saveSnippetAtom = atom(
  null,
  async (
    _get,
    set,
    payload: { name: string; description: string; graph: WorkflowGraph },
  ) => {
    const snippet = await createSnippet(payload);
    set(appStateAtom, (current) => ({
      ...current,
      snippets: [
        snippet,
        ...current.snippets.filter((item) => item.id !== snippet.id),
      ],
    }));
    toast.success("Snippet saved.");
    return snippet;
  },
);

export const removeSnippetAtom = atom(
  null,
  async (_get, set, snippetId: string) => {
    await deleteSnippet(snippetId);
    set(appStateAtom, (current) => ({
      ...current,
      snippets: current.snippets.filter((item) => item.id !== snippetId),
    }));
    toast.success("Snippet removed.");
  },
);

export const insertSnippetAtom = atom(
  null,
  (
    get,
    set,
    payload: { workflowId: string; snippetId: string; offset?: number },
  ) => {
    const state = get(appStateAtom);
    const snippet = state.snippets.find(
      (item) => item.id === payload.snippetId,
    );
    if (!snippet) return;
    const workflow = get(selectedWorkflowAtomValue(payload.workflowId));
    if (!workflow) return;
    const offset = payload.offset ?? 40;
    const cloned = cloneGraphWithNewIds(snippet.graph, {
      x: offset,
      y: offset,
    });
    if (hasTriggerNode(workflow.draftGraph)) {
      cloned.nodes = cloned.nodes.filter(
        (node) => node.data.family !== "trigger",
      );
      const kept = new Set(cloned.nodes.map((node) => node.id));
      cloned.edges = cloned.edges.filter(
        (edge) => kept.has(edge.source) && kept.has(edge.target),
      );
    }
    set(updateWorkflowGraphAtom, {
      workflowId: payload.workflowId,
      graph: mergeGraph(workflow.draftGraph, cloned),
    });
    toast.success(`Inserted "${snippet.name}".`);
  },
);

export const generateWorkflowFromPromptAtom = atom(
  null,
  async (
    get,
    set,
    payload: { prompt: string; connectionAlias: string },
  ) => {
    const state = get(appStateAtom);
    const workflowId = state.selectedWorkflowId;
    if (!workflowId) {
      toast.error("Select a workflow before generating.");
      return;
    }
    try {
      const result = await generateWorkflowGraph(payload);
      set(updateWorkflowGraphAtom, {
        workflowId,
        graph: normalizeGraph(result.graph),
      });
      await saveWorkflow(workflowId, {
        draftGraph: normalizeGraph(result.graph),
      });
      toast.success(result.notes || "Workflow generated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Generation failed.",
      );
    }
  },
);

import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import {
  ChevronRight,
  Download,
  GitBranch,
  Play,
  Save,
  Settings2,
  TerminalSquare,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { downloadWorkflowAsTs } from "@/lib/workflow/export-ts";
import { EditorLeftPanel } from "@/components/editor/editor-left-panel";
import { WorkflowCanvas } from "@/components/editor/workflow-canvas";
import { InspectorPanel } from "@/components/editor/inspector-panel";
import { RunPanel } from "@/components/editor/run-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  currentWorkflowAtom,
  selectedEdgeAtomValue,
  selectedNodeAtomValue,
  appStateAtom,
  activeRunAtom,
  addNodeAtom,
  applyEdgeChangesAtom,
  applyNodeChangesAtom,
  connectNodesAtom,
  publishCurrentWorkflowAtom,
  refreshRunsAtom,
  runCurrentWorkflowAtom,
  saveCurrentWorkflowAtom,
  saveWorkflowMetaAtom,
  selectEdgeAtom,
  selectNodeAtom,
  selectWorkflowAtom,
  setRightPanelTabAtom,
  updateSelectedEdgeBranchAtom,
  updateSelectedNodeConfigAtom,
  updateSelectedNodeSubtitleAtom,
  updateSelectedNodeTitleAtom,
  removeSelectedNodeAtom,
} from "@/state/app-state";
import { hasTriggerNode } from "@/lib/workflow/graph";
import type { WorkflowGraph } from "@/lib/workflow/types";
import { formatRelativeTime } from "@/lib/utils";

const SELECTED_NODE_HASH_KEY = "selectedNode";

function parseSelectedNodeHash(hash: string): string | null {
  const match = hash.match(/^#selectedNode=(?::)?(.+)$/);
  if (!match) return null;
  const rawNodeId = match[1]?.trim();
  if (!rawNodeId) return null;
  try {
    return decodeURIComponent(rawNodeId);
  } catch {
    return rawNodeId;
  }
}

function hasNode(
  graph: WorkflowGraph,
  nodeId: string | null,
): nodeId is string {
  return Boolean(nodeId && graph.nodes.some((node) => node.id === nodeId));
}

function updateSelectedNodeHash(nodeId: string | null) {
  if (typeof window === "undefined") return;
  const nextHash = nodeId
    ? `#${SELECTED_NODE_HASH_KEY}=:${encodeURIComponent(nodeId)}`
    : "";
  if (window.location.hash === nextHash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function WorkflowNameInput({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (next: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      aria-label="Workflow name"
      className="mono h-7 min-w-[140px] max-w-[320px] rounded-[3px] bg-transparent px-1 text-[13px] font-medium text-[color:var(--color-foreground)] outline-none transition-colors hover:bg-[color:var(--color-surface)] focus:border focus:border-[color:var(--color-primary)] focus:bg-[color:var(--color-card)] focus:px-2"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        const trimmed = value.trim();
        if (!trimmed || trimmed === initial) {
          setValue(initial);
          return;
        }
        onCommit(trimmed);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setValue(initial);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function WorkflowEditorPage() {
  const params = useParams({ strict: false }) as {
    workflowId?: string;
    parentWorkflowId?: string;
    subworkflowId?: string;
  };
  const workflowId = params.subworkflowId ?? params.workflowId ?? "";
  const parentWorkflowId = params.parentWorkflowId;
  const selectWorkflow = useSetAtom(selectWorkflowAtom);
  const selectNode = useSetAtom(selectNodeAtom);
  const selectEdge = useSetAtom(selectEdgeAtom);
  const addNode = useSetAtom(addNodeAtom);
  const onNodesChange = useSetAtom(applyNodeChangesAtom);
  const onEdgesChange = useSetAtom(applyEdgeChangesAtom);
  const onConnect = useSetAtom(connectNodesAtom);
  const saveDraft = useSetAtom(saveCurrentWorkflowAtom);
  const publishWorkflow = useSetAtom(publishCurrentWorkflowAtom);
  const runWorkflow = useSetAtom(runCurrentWorkflowAtom);
  const updateTitle = useSetAtom(updateSelectedNodeTitleAtom);
  const updateSubtitle = useSetAtom(updateSelectedNodeSubtitleAtom);
  const updateConfig = useSetAtom(updateSelectedNodeConfigAtom);
  const updateEdgeBranch = useSetAtom(updateSelectedEdgeBranchAtom);
  const removeSelectedNode = useSetAtom(removeSelectedNodeAtom);
  const refreshRuns = useSetAtom(refreshRunsAtom);
  const saveMeta = useSetAtom(saveWorkflowMetaAtom);
  const workflow = useAtomValue(currentWorkflowAtom);
  const selectedEdge = useAtomValue(selectedEdgeAtomValue);
  const selectedNode = useAtomValue(selectedNodeAtomValue);
  const state = useAtomValue(appStateAtom);
  const activeRun = useAtomValue(activeRunAtom);
  const setRightPanelTab = useSetAtom(setRightPanelTabAtom);
  const parentWorkflow =
    parentWorkflowId == null
      ? null
      : (state.workflows.find((item) => item.id === parentWorkflowId) ?? null);

  useEffect(() => {
    selectWorkflow(workflowId);
    void refreshRuns(workflowId);
  }, [refreshRuns, selectWorkflow, workflowId]);

  useEffect(() => {
    if (!workflow) return;

    const syncSelectionFromHash = (shouldClearWhenMissing: boolean) => {
      const hashedNodeId = parseSelectedNodeHash(window.location.hash);
      if (hasNode(workflow.draftGraph, hashedNodeId)) {
        selectNode(hashedNodeId);
        return;
      }

      if (window.location.hash.startsWith(`#${SELECTED_NODE_HASH_KEY}=`)) {
        updateSelectedNodeHash(null);
        selectNode(null);
        return;
      }

      if (shouldClearWhenMissing) {
        selectNode(null);
      }
    };

    syncSelectionFromHash(false);
    const handleHashChange = () => syncSelectionFromHash(true);
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [selectNode, workflow]);

  useEffect(() => {
    if (!workflow) return;
    if (hasNode(workflow.draftGraph, state.selectedNodeId)) {
      updateSelectedNodeHash(state.selectedNodeId);
      return;
    }
    updateSelectedNodeHash(null);
  }, [state.selectedNodeId, workflow]);

  if (!workflow) {
    return null;
  }

  return (
    <section className="flex h-full flex-col overflow-hidden">
      {/* Editor toolbar */}
      <div className="hairline-b flex h-10 shrink-0 items-center gap-2 bg-[color:var(--color-card)] px-3">
        <Badge variant={workflow.status === "published" ? "success" : "muted"}>
          {workflow.status}
        </Badge>
        <div className="flex min-w-0 items-center">
          {workflow.mode === "subworkflow" && parentWorkflow ? (
            <>
              <Link
                to="/workflows/$workflowId/editor"
                params={{ workflowId: parentWorkflow.id } as never}
                className="mono flex h-7 max-w-[200px] items-center gap-1 truncate rounded-[3px] px-1 text-[13px] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-foreground)]"
                title={`Parent workflow: ${parentWorkflow.name}`}
              >
                <span className="truncate">{parentWorkflow.name}</span>
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0 text-[color:var(--color-muted-foreground)]" />
              <GitBranch className="ml-1 h-3 w-3 shrink-0 text-[color:var(--color-muted-foreground)]" />
            </>
          ) : null}
          <WorkflowNameInput
            key={workflow.id}
            initial={workflow.name}
            onCommit={(next) =>
              saveMeta({ workflowId: workflow.id, name: next })
            }
          />
        </div>
        <span className="hairline-l h-4" />
        <span className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
          {workflow.draftGraph.nodes.length} nodes · updated{" "}
          {formatRelativeTime(workflow.updatedAt)}
        </span>
        <span className="hairline-l h-4" />
        <Link
          to="/workflows/$workflowId/runs"
          params={{ workflowId } as never}
          className="mono flex h-7 items-center gap-1 rounded-[3px] px-2 text-[11px] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-foreground)]"
        >
          <TerminalSquare className="h-3 w-3" />
          runs
        </Link>
        <Link
          to="/workflows/$workflowId/settings"
          params={{ workflowId } as never}
          className="mono flex h-7 items-center gap-1 rounded-[3px] px-2 text-[11px] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-foreground)]"
        >
          <Settings2 className="h-3 w-3" />
          settings
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              downloadWorkflowAsTs(workflow);
              toast.success("Workflow exported as TypeScript.");
            }}
          >
            <Download className="h-3 w-3" />
            Export TS
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void saveDraft()}>
            <Save className="h-3 w-3" />
            Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void publishWorkflow()}
          >
            <UploadCloud className="h-3 w-3" />
            Publish
          </Button>
          {workflow.mode === "standard" ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => void runWorkflow()}
            >
              <Play className="h-3 w-3" />
              Run
            </Button>
          ) : null}
        </div>
      </div>

      {/* 3-column editor */}
      <div className="flex min-h-0 flex-1">
        <div className="hairline-r w-[260px] shrink-0">
          <EditorLeftPanel
            workflow={workflow}
            hasTrigger={hasTriggerNode(workflow.draftGraph)}
            onAddNode={(kind) => addNode({ workflowId, kind })}
          />
        </div>

        <div className="min-w-0 flex-1">
          <WorkflowCanvas
            graph={workflow.draftGraph}
            selectedEdgeId={state.selectedEdgeId}
            selectedNodeId={state.selectedNodeId}
            onConnect={(connection) => onConnect({ workflowId, connection })}
            onEdgesChange={(changes) => onEdgesChange({ workflowId, changes })}
            onEdgeClick={selectEdge}
            onNodeClick={selectNode}
            onNodesChange={(changes) => onNodesChange({ workflowId, changes })}
          />
        </div>

        <div className="hairline-l flex w-[340px] shrink-0 flex-col bg-[color:var(--color-card)]">
          <Tabs
            value={state.rightPanelTab}
            onValueChange={(value) =>
              setRightPanelTab(value as typeof state.rightPanelTab)
            }
            className="flex h-full min-h-0 flex-col"
          >
            <TabsList className="hairline-b h-8 w-full justify-start px-3">
              <TabsTrigger value="inspector">Inspector</TabsTrigger>
              <TabsTrigger value="run" className="gap-1.5">
                Run
                {activeRun &&
                (activeRun.status === "running" ||
                  activeRun.status === "queued") ? (
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--color-primary)]" />
                ) : null}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="inspector" className="min-h-0 flex-1">
              <InspectorPanel
                connections={state.connections}
                onConfigChange={(key, value) => updateConfig({ key, value })}
                onEdgeBranchChange={updateEdgeBranch}
                onDeleteNode={() => removeSelectedNode(workflowId)}
                onSubtitleChange={updateSubtitle}
                onTitleChange={updateTitle}
                parentWorkflow={parentWorkflow}
                selectedEdge={selectedEdge}
                selectedNode={selectedNode}
                workflows={state.workflows}
                workflow={workflow}
              />
            </TabsContent>
            <TabsContent value="run" className="min-h-0 flex-1">
              <RunPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}

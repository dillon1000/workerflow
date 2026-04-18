import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import {
  ChevronLeft,
  ChevronRight,
  Command,
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
import {
  EditorLeftPanel,
  type EditorLeftPanelTab,
} from "@/components/editor/editor-left-panel";
import { AskForInputDialog } from "@/components/editor/ask-for-input-dialog";
import { WorkflowCanvas } from "@/components/editor/workflow-canvas";
import { InspectorPanel } from "@/components/editor/inspector-panel";
import { RunPanel } from "@/components/editor/run-panel";
import { CommandPalette } from "@/components/editor/command-palette";
import { QuickLookWindow } from "@/components/editor/quick-look-window";
import { PanelRail } from "@/components/editor/panel-rail";
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

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState<EditorLeftPanelTab>("library");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [askForInputOpen, setAskForInputOpen] = useState(false);

  const canRun = workflow?.mode === "standard";
  const triggerNode =
    workflow?.draftGraph.nodes.find((node) => node.data.family === "trigger") ??
    null;
  const buttonLabel = String(
    triggerNode?.data.config.buttonLabel ?? "Run workflow",
  );
  const askForInputNodes =
    workflow?.draftGraph.nodes.filter(
      (
        node,
      ): node is typeof node & {
        data: typeof node.data & { kind: "askForInput" };
      } => node.data.kind === "askForInput",
    ) ?? [];

  const handleRunWorkflow = useCallback(() => {
    if (!workflow) return;
    setRightCollapsed(false);
    if (triggerNode?.data.kind === "button" && askForInputNodes.length > 0) {
      setAskForInputOpen(true);
      return;
    }
    void runWorkflow();
  }, [askForInputNodes.length, runWorkflow, triggerNode?.data.kind, workflow]);

  const handleSubmitAskForInput = useCallback(
    async (payload: Record<string, unknown>) => {
      setAskForInputOpen(false);
      setRightCollapsed(false);
      await runWorkflow({
        source: "manual",
        ...payload,
      });
    },
    [runWorkflow],
  );

  const handleOpenQuickLook = useCallback(() => {
    if (!selectedNode) {
      toast.error("Select a node first.");
      return;
    }
    setQuickLookOpen(true);
  }, [selectedNode]);

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

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isCmdK =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "k";
      if (isCmdK) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === "Escape" && quickLookOpen) {
        return;
      }
      if (
        event.key === " " &&
        !isTypingTarget(event.target) &&
        !paletteOpen &&
        state.selectedNodeId
      ) {
        event.preventDefault();
        setQuickLookOpen((open) => !open);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen, quickLookOpen, state.selectedNodeId]);

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
            onClick={() => setPaletteOpen(true)}
            title="Command palette (⌘K)"
          >
            <Command className="h-3 w-3" />
            ⌘K
          </Button>
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
            <Button size="sm" variant="primary" onClick={handleRunWorkflow}>
              <Play className="h-3 w-3" />
              Run
            </Button>
          ) : null}
        </div>
      </div>

      {/* 3-column editor */}
      <div className="flex min-h-0 flex-1">
        <div
          className="panel-shell hairline-r"
          data-side="left"
          data-collapsed={leftCollapsed}
          style={{ width: leftCollapsed ? 28 : 260 }}
          aria-hidden={false}
        >
          <div className="panel-shell-rail" aria-hidden={!leftCollapsed}>
            <PanelRail
              side="left"
              activeTab={leftTab}
              onExpand={(tab) => {
                setLeftTab(tab);
                setLeftCollapsed(false);
              }}
              tabs={[
                { value: "library", label: "Library" },
                { value: "snippets", label: "Snippets" },
                { value: "generate", label: "Generate" },
              ]}
            />
          </div>
          <div className="panel-shell-content" aria-hidden={leftCollapsed}>
            <EditorLeftPanel
              workflow={workflow}
              hasTrigger={hasTriggerNode(workflow.draftGraph)}
              onAddNode={(kind) => addNode({ workflowId, kind })}
              value={leftTab}
              onValueChange={setLeftTab}
            />
            <button
              type="button"
              onClick={() => setLeftCollapsed(true)}
              aria-label="Collapse left panel"
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-[3px] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-foreground)]"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          </div>
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

        <div
          className="panel-shell hairline-l"
          data-side="right"
          data-collapsed={rightCollapsed}
          style={{ width: rightCollapsed ? 28 : 340 }}
        >
          <div className="panel-shell-rail" aria-hidden={!rightCollapsed}>
            <PanelRail
              side="right"
              activeTab={state.rightPanelTab}
              onExpand={(tab) => {
                setRightPanelTab(tab);
                setRightCollapsed(false);
              }}
              tabs={[
                { value: "inspector", label: "Inspector" },
                { value: "run", label: "Run" },
              ]}
            />
          </div>
          <div
            className="panel-shell-content flex flex-col bg-[color:var(--color-card)]"
            aria-hidden={rightCollapsed}
          >
            <Tabs
              value={state.rightPanelTab}
              onValueChange={(value) =>
                setRightPanelTab(value as typeof state.rightPanelTab)
              }
              className="flex h-full min-h-0 flex-col"
            >
              <TabsList className="hairline-b h-8 w-full justify-start px-3 pr-8">
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
                <RunPanel onRunWorkflow={handleRunWorkflow} />
              </TabsContent>
            </Tabs>
            <button
              type="button"
              onClick={() => setRightCollapsed(true)}
              aria-label="Collapse right panel"
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-[3px] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-foreground)]"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAddNode={(kind) => addNode({ workflowId, kind })}
        onRunWorkflow={handleRunWorkflow}
        onOpenQuickLook={handleOpenQuickLook}
        canQuickLook={Boolean(selectedNode)}
        canRun={canRun}
        hasTrigger={hasTriggerNode(workflow.draftGraph)}
        workflowMode={workflow.mode}
      />

      <QuickLookWindow
        open={quickLookOpen && Boolean(selectedNode)}
        onClose={() => setQuickLookOpen(false)}
        workflow={workflow}
        parentWorkflow={parentWorkflow}
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        connections={state.connections}
        workflows={state.workflows}
        onEdgeBranchChange={updateEdgeBranch}
        onTitleChange={updateTitle}
        onSubtitleChange={updateSubtitle}
        onConfigChange={(key, value) => updateConfig({ key, value })}
        onDeleteNode={() => removeSelectedNode(workflowId)}
      />
      <AskForInputDialog
        key={`${workflow.id}:${askForInputOpen ? "open" : "closed"}:${askForInputNodes.map((node) => node.id).join(",")}`}
        open={askForInputOpen}
        nodes={askForInputNodes}
        submitLabel={buttonLabel}
        onClose={() => setAskForInputOpen(false)}
        onSubmit={handleSubmitAskForInput}
      />
    </section>
  );
}

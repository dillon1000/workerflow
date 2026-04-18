import { useEffect } from "react";
import { X } from "lucide-react";
import { InspectorPanel } from "@/components/editor/inspector-panel";
import { useTransitionPresence } from "@/hooks/use-transition-presence";
import type {
  ConnectionDefinition,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/workflow/types";

interface QuickLookWindowProps {
  open: boolean;
  onClose: () => void;
  workflow: WorkflowDefinition;
  parentWorkflow: WorkflowDefinition | null;
  selectedNode: WorkflowNode | null;
  selectedEdge: WorkflowEdge | null;
  connections: ConnectionDefinition[];
  workflows: WorkflowDefinition[];
  onEdgeBranchChange: (value: "true" | "false") => void;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onConfigChange: (key: string, value: unknown) => void;
  onDeleteNode: () => void;
}

export function QuickLookWindow(props: QuickLookWindowProps) {
  const { open, onClose, selectedNode } = props;
  const { mounted, state } = useTransitionPresence(open, 160);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!mounted) return null;

  const label =
    selectedNode?.data.title ?? props.selectedEdge?.id ?? "No selection";

  return (
    <div
      className="floating-overlay fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-[1px]"
      data-state={state}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="quicklook-card hairline flex h-[min(640px,80vh)] w-[min(560px,92vw)] flex-col overflow-hidden rounded-lg bg-[color:var(--color-card)] shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
        data-state={state}
        role="dialog"
        aria-label="Quick look"
      >
        <div className="hairline-b flex h-8 shrink-0 items-center gap-2 bg-[color:var(--color-surface)] px-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick look"
            className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[color:var(--color-destructive,#b4432d)] text-transparent transition-colors hover:text-[rgba(0,0,0,0.5)]"
          >
            <X className="h-2.5 w-2.5" />
          </button>
          <span className="mono flex-1 truncate text-center text-[11px] text-[color:var(--color-muted-foreground)]">
            quick look / {label}
          </span>
          <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
            space · esc
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <InspectorPanel
            workflow={props.workflow}
            parentWorkflow={props.parentWorkflow}
            selectedNode={props.selectedNode}
            selectedEdge={props.selectedEdge}
            connections={props.connections}
            workflows={props.workflows}
            onEdgeBranchChange={props.onEdgeBranchChange}
            onTitleChange={props.onTitleChange}
            onSubtitleChange={props.onSubtitleChange}
            onConfigChange={props.onConfigChange}
            onDeleteNode={props.onDeleteNode}
          />
        </div>
      </div>
    </div>
  );
}

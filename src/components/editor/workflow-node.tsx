import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useAtomValue } from "jotai";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import {
  workflowFamilyIcons,
  workflowNodeIcons,
} from "@/lib/workflow/plugin-icons";
import { nodeRunStatusesAtom } from "@/state/app-state";
import type { WorkflowNodeData } from "@/lib/workflow/types";

const familyColor: Record<WorkflowNodeData["family"], string> = {
  trigger: "var(--color-primary)",
  action: "var(--color-ink)",
  logic: "#7a6c5a",
  data: "#3b6e4d",
};

export function WorkflowNodeCard({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const IconComponent =
    workflowNodeIcons[nodeData.kind] ?? workflowFamilyIcons[nodeData.family];
  const accent = familyColor[nodeData.family];
  const runStatuses = useAtomValue(nodeRunStatusesAtom);
  const runStatus = runStatuses[id];

  const statusBadge = (() => {
    if (runStatus === "running" || runStatus === "queued") {
      return (
        <span className="mono ml-auto flex items-center gap-1 text-[9px] font-medium text-[color:var(--color-primary)]">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          running
        </span>
      );
    }
    if (runStatus === "complete") {
      return (
        <span className="mono ml-auto flex items-center gap-1 text-[9px] font-medium text-[#3b6e4d]">
          <Check className="h-2.5 w-2.5" />
          done
        </span>
      );
    }
    if (runStatus === "errored") {
      return (
        <span className="mono ml-auto flex items-center gap-1 text-[9px] font-medium text-[color:var(--color-destructive,#b4432d)]">
          <AlertTriangle className="h-2.5 w-2.5" />
          errored
        </span>
      );
    }
    return (
      <span className="mono ml-auto text-[9px] text-[color:var(--color-muted-foreground)]">
        {nodeData.enabled === false ? "paused" : "ready"}
      </span>
    );
  })();

  return (
    <div
      className="editor-node"
      data-selected={selected ? "true" : "false"}
      data-run-status={runStatus ?? "idle"}
      style={{ width: 208 }}
    >
      {runStatus === "running" ? <span className="editor-node-runner" /> : null}
      <Handle position={Position.Left} type="target" className="target" />
      {/* header row */}
      <div
        className="flex h-5 items-center gap-1.5 border-b border-[color:var(--color-border)] px-2"
        style={{ background: "var(--color-surface)" }}
      >
        <span
          className="h-1.5 w-1.5 rounded-[1px]"
          style={{ background: accent }}
        />
        <span className="label-xs truncate">{nodeData.family}</span>
        {statusBadge}
      </div>
      {/* body */}
      <div className="flex items-start gap-2 px-2 py-2">
        <div
          className="grid h-7 w-7 shrink-0 place-items-center text-white"
          style={{ background: accent, borderRadius: 2 }}
        >
          <IconComponent className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-tight text-[color:var(--color-foreground)]">
            {nodeData.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[color:var(--color-muted-foreground)]">
            {nodeData.subtitle}
          </p>
        </div>
      </div>
      <Handle position={Position.Right} type="source" className="source" />
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  appStateAtom,
  createWorkflowAtom,
  selectWorkflowAtom,
} from "@/state/app-state";
import { formatRelativeTime } from "@/lib/utils";

export function WorkflowsPage() {
  const state = useAtomValue(appStateAtom);
  const createWorkflow = useSetAtom(createWorkflowAtom);
  const selectWorkflow = useSetAtom(selectWorkflowAtom);

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col">
      <div className="hairline-b flex items-center gap-4 px-6 py-4">
        <span className="label-xs">01 / workflows</span>
        <h1 className="font-display text-[22px] leading-none tracking-tight">
          Registry
        </h1>
        <span className="mono ml-auto text-[11px] text-[color:var(--color-muted-foreground)]">
          {state.workflows.length} total
        </span>
        <Button
          size="sm"
          variant="primary"
          onClick={() => void createWorkflow("Untitled workflow")}
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="hairline-b bg-[color:var(--color-surface)]">
              <th className="label-xs w-8 px-3 py-1.5 text-left">#</th>
              <th className="label-xs px-3 py-1.5 text-left">name</th>
              <th className="label-xs px-3 py-1.5 text-left">status</th>
              <th className="label-xs px-3 py-1.5 text-left">triggers</th>
              <th className="label-xs px-3 py-1.5 text-right">runs</th>
              <th className="label-xs px-3 py-1.5 text-right">success</th>
              <th className="label-xs px-3 py-1.5 text-right">updated</th>
            </tr>
          </thead>
          <tbody className="stagger">
            {state.workflows.map((workflow, i) => (
              <tr
                key={workflow.id}
                className="hairline-b group cursor-pointer hover:bg-[color:var(--color-surface)]"
              >
                <td className="mono px-3 py-2 text-[11px] text-[color:var(--color-muted-foreground)]">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-2">
                  <Link
                    className="block"
                    onClick={() => selectWorkflow(workflow.id)}
                    params={{ workflowId: workflow.id }}
                    to="/workflows/$workflowId/editor"
                  >
                    <div className="text-[13px] font-medium group-hover:text-[color:var(--color-primary)]">
                      {workflow.name}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[color:var(--color-muted-foreground)]">
                      {workflow.description}
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant={
                      workflow.status === "published" ? "success" : "muted"
                    }
                  >
                    {workflow.status}
                  </Badge>
                </td>
                <td className="mono px-3 py-2 text-[11px] text-[color:var(--color-muted-foreground)]">
                  {workflow.metrics.activeTriggers.join(", ") || "manual"}
                </td>
                <td className="mono px-3 py-2 text-right text-[12px] tabular-nums">
                  {workflow.metrics.totalRuns}
                </td>
                <td className="mono px-3 py-2 text-right text-[12px] tabular-nums">
                  {workflow.metrics.successRate}%
                </td>
                <td className="mono px-3 py-2 text-right text-[11px] text-[color:var(--color-muted-foreground)]">
                  {formatRelativeTime(workflow.updatedAt)}
                </td>
              </tr>
            ))}
            {state.workflows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-16 text-center text-[12px] text-[color:var(--color-muted-foreground)]"
                >
                  No workflows yet — create one to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

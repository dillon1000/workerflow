import { useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  appStateAtom,
  refreshRunsAtom,
  selectWorkflowAtom,
} from "@/state/app-state";
import { formatRelativeTime } from "@/lib/utils";

export function WorkflowRunsPage() {
  const { workflowId } = useParams({ strict: false }) as { workflowId: string };
  const selectWorkflow = useSetAtom(selectWorkflowAtom);
  const refreshRuns = useSetAtom(refreshRunsAtom);
  const runs = useAtomValue(appStateAtom).runs.filter(
    (run) => run.workflowId === workflowId,
  );

  useEffect(() => {
    selectWorkflow(workflowId);
    void refreshRuns(workflowId);
  }, [refreshRuns, selectWorkflow, workflowId]);

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col">
      <div className="hairline-b flex items-center gap-3 px-6 py-4">
        <span className="label-xs">runs</span>
        <h1 className="font-display text-[22px] leading-none tracking-tight">
          Execution log
        </h1>
        <span className="mono ml-auto text-[11px] text-[color:var(--color-muted-foreground)]">
          {runs.length} runs
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refreshRuns(workflowId)}
        >
          Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {runs.length === 0 && (
          <div className="flex h-40 items-center justify-center text-[12px] text-[color:var(--color-muted-foreground)]">
            No runs recorded yet
          </div>
        )}
        <ul className="stagger">
          {runs.map((run) => (
            <li key={run.id} className="hairline-b">
              <div className="flex items-center gap-3 bg-[color:var(--color-surface)] px-3 py-1.5">
                <span className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
                  {run.id.slice(0, 8)}
                </span>
                <span className="mono text-[11px]">{run.triggerKind}</span>
                <Badge
                  variant={
                    run.status === "complete"
                      ? "success"
                      : run.status === "errored"
                        ? "destructive"
                        : "muted"
                  }
                >
                  {run.status}
                </Badge>
                <span className="mono ml-auto text-[11px] text-[color:var(--color-muted-foreground)]">
                  {formatRelativeTime(run.startedAt)}
                </span>
              </div>
              <ol>
                {run.steps.map((step, i) => (
                  <li
                    key={step.id}
                    className="hairline-b flex items-start gap-3 px-3 py-1.5 last:border-b-0"
                  >
                    <span className="mono mt-0.5 w-6 shrink-0 text-[11px] text-[color:var(--color-muted-foreground)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-medium">
                          {step.nodeTitle}
                        </p>
                        <Badge
                          variant={
                            step.status === "complete"
                              ? "success"
                              : step.status === "errored"
                                ? "destructive"
                                : "muted"
                          }
                        >
                          {step.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

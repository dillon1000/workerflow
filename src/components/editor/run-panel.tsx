import { useAtomValue, useSetAtom } from "jotai";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  activeRunAtom,
  clearActiveRunAtom,
  runCurrentWorkflowAtom,
} from "@/state/app-state";
import type { RunStatus, WorkflowRunStep } from "@/lib/workflow/types";

function formatDuration(ms?: number) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

function StatusDot({ status }: { status: RunStatus }) {
  if (status === "running" || status === "queued") {
    return (
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[color:var(--color-primary)]" />
    );
  }
  if (status === "complete") {
    return <Check className="h-3 w-3 shrink-0 text-[#3b6e4d]" />;
  }
  if (status === "errored") {
    return (
      <AlertTriangle className="h-3 w-3 shrink-0 text-[color:var(--color-destructive,#b4432d)]" />
    );
  }
  return (
    <Clock className="h-3 w-3 shrink-0 text-[color:var(--color-muted-foreground)]" />
  );
}

function StepCard({ step, index }: { step: WorkflowRunStep; index: number }) {
  const [open, setOpen] = useState(step.status === "errored");
  const hasOutput = step.output !== undefined && step.output !== null;
  const outputText = useMemo(() => {
    if (!hasOutput) return "";
    try {
      return JSON.stringify(step.output, null, 2);
    } catch {
      return String(step.output);
    }
  }, [hasOutput, step.output]);

  return (
    <div
      className="hairline rounded-[3px] bg-[color:var(--color-card)]"
      data-step-status={step.status}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        <span className="mono w-5 shrink-0 text-[10px] text-[color:var(--color-muted-foreground)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <StatusDot status={step.status} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[color:var(--color-foreground)]">
          {step.nodeTitle}
        </span>
        <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
          {step.kind}
        </span>
        <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
          {formatDuration(step.durationMs)}
        </span>
        {open ? (
          <ChevronDown className="h-3 w-3 text-[color:var(--color-muted-foreground)]" />
        ) : (
          <ChevronRight className="h-3 w-3 text-[color:var(--color-muted-foreground)]" />
        )}
      </button>
      {open ? (
        <div className="hairline-t space-y-2 px-2 py-2">
          <p className="text-[11px] leading-snug text-[color:var(--color-muted-foreground)]">
            {step.detail}
          </p>
          {hasOutput ? (
            <pre className="mono hairline max-h-[240px] overflow-auto rounded-[3px] bg-[color:var(--color-surface)] p-2 text-[10.5px] leading-snug text-[color:var(--color-foreground)]">
              {outputText}
            </pre>
          ) : step.status === "running" ? (
            <p className="mono text-[10.5px] text-[color:var(--color-muted-foreground)]">
              waiting for output…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RunPanel() {
  const run = useAtomValue(activeRunAtom);
  const runAgain = useSetAtom(runCurrentWorkflowAtom);
  const clearActiveRun = useSetAtom(clearActiveRunAtom);

  if (!run) {
    return (
      <div className="flex h-full flex-col">
        <div className="hairline-b flex h-8 items-center gap-2 px-3">
          <span className="label-xs">Run</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
              [ no active run ]
            </p>
            <p className="mt-2 text-[12px] text-[color:var(--color-muted-foreground)]">
              Press Run to execute this workflow and stream step outputs here.
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="primary"
              onClick={() => void runAgain()}
            >
              <Play className="h-3 w-3" />
              Run workflow
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const terminal = run.status === "complete" || run.status === "errored";
  const statusVariant = (() => {
    if (run.status === "errored") return "destructive" as const;
    if (run.status === "complete") return "success" as const;
    return "muted" as const;
  })();

  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b flex h-8 items-center gap-2 px-3">
        <span className="label-xs">Run</span>
        <Badge variant={statusVariant}>{run.status}</Badge>
        <span className="mono ml-auto text-[10px] text-[color:var(--color-muted-foreground)]">
          {run.id.slice(0, 8)}
        </span>
      </div>
      <div className="hairline-b flex items-center gap-2 px-3 py-2">
        <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
          trigger
        </span>
        <span className="mono text-[11px] text-[color:var(--color-foreground)]">
          {run.triggerKind}
        </span>
        <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
          ·
        </span>
        <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
          duration
        </span>
        <span className="mono text-[11px] text-[color:var(--color-foreground)]">
          {formatDuration(run.durationMs)}
        </span>
        <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
          ·
        </span>
        <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
          {run.steps.length} step{run.steps.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {run.steps.length === 0 ? (
          <div className="hairline rounded-[3px] bg-[color:var(--color-card)] p-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-[color:var(--color-primary)]" />
              <span className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
                waiting for first step…
              </span>
            </div>
          </div>
        ) : (
          run.steps.map((step, index) => (
            <StepCard key={step.id} index={index} step={step} />
          ))
        )}
      </div>
      <div className="hairline-t flex items-center gap-2 p-2">
        <Button
          size="sm"
          variant="primary"
          disabled={!terminal}
          onClick={() => void runAgain()}
        >
          <RotateCcw className="h-3 w-3" />
          Run again
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => clearActiveRun()}
          className="ml-auto"
        >
          <X className="h-3 w-3" />
          Close
        </Button>
      </div>
    </div>
  );
}

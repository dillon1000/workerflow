import { Link } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { GitBranch, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  appStateAtom,
  createWorkflowAtom,
  selectWorkflowAtom,
} from "@/state/app-state";
import { formatRelativeTime } from "@/lib/utils";
import type { WorkflowDefinition } from "@/lib/workflow/types";

function SubworkflowRow({
  parent,
  workflow,
  index,
  isLast,
  selectWorkflow,
}: {
  parent: WorkflowDefinition;
  workflow: WorkflowDefinition;
  index: number;
  isLast: boolean;
  selectWorkflow: (workflowId: string) => void;
}) {
  return (
    <div
      className="grid items-center gap-3 px-3 py-1.5 hover:bg-[color:var(--color-surface)]"
      style={{ gridTemplateColumns: "80px minmax(0,1fr) 120px 110px 90px" }}
    >
      <div className="mono text-right text-[11px] text-[color:var(--color-muted-foreground)]">
        .{`${index + 1}`.padStart(2, "0")}
      </div>
      <Link
        className="flex min-w-0 items-center gap-2"
        onClick={() => selectWorkflow(workflow.id)}
        params={{
          parentWorkflowId: parent.id,
          subworkflowId: workflow.id,
        }}
        to="/workflows/$parentWorkflowId/subworkflow/$subworkflowId/editor"
      >
        <div
          aria-hidden
          className="relative h-5 w-4 shrink-0 text-[color:var(--color-border)]"
        >
          <span
            className={`absolute left-1.5 top-0 w-px bg-current ${isLast ? "h-[10px]" : "h-5"}`}
          />
          <span className="absolute left-1.5 top-[10px] h-px w-[10px] bg-current" />
        </div>
        <GitBranch className="h-3 w-3 shrink-0 text-[color:var(--color-muted-foreground)]" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-[color:var(--color-foreground)]">
            {workflow.name}
          </div>
          {workflow.description ? (
            <div className="truncate text-[11px] text-[color:var(--color-muted-foreground)]">
              {workflow.description}
            </div>
          ) : null}
        </div>
      </Link>
      <div>
        <Badge variant={workflow.status === "published" ? "success" : "muted"}>
          {workflow.status}
        </Badge>
      </div>
      <div />
      <div className="mono text-right text-[11px] text-[color:var(--color-muted-foreground)]">
        {formatRelativeTime(workflow.updatedAt)}
      </div>
    </div>
  );
}

function WorkflowRow({
  workflow,
  subworkflows,
  index,
  selectWorkflow,
  createWorkflow,
}: {
  workflow: WorkflowDefinition;
  subworkflows: WorkflowDefinition[];
  index: number;
  selectWorkflow: (workflowId: string) => void;
  createWorkflow: (
    payload:
      | string
      | {
          name: string;
          mode?: "standard" | "subworkflow";
          parentWorkflowId?: string;
        },
  ) => Promise<unknown>;
}) {
  return (
    <div className="hairline-b">
      <div
        className="grid items-center gap-3 px-3 py-2 hover:bg-[color:var(--color-surface)]"
        style={{ gridTemplateColumns: "80px minmax(0,1fr) 120px 110px 90px" }}
      >
        <div className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
          {String(index + 1).padStart(2, "0")}
        </div>
        <Link
          className="min-w-0"
          onClick={() => selectWorkflow(workflow.id)}
          params={{ workflowId: workflow.id }}
          to="/workflows/$workflowId/editor"
        >
          <div className="text-[13px] font-medium text-[color:var(--color-foreground)]">
            {workflow.name}
          </div>
          <div className="truncate text-[11px] text-[color:var(--color-muted-foreground)]">
            {workflow.description}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Badge
            variant={workflow.status === "published" ? "success" : "muted"}
          >
            {workflow.status}
          </Badge>
          <Badge variant="muted">{workflow.mode}</Badge>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void createWorkflow({
                name: `${workflow.name} sub-workflow`,
                mode: "subworkflow",
                parentWorkflowId: workflow.id,
              })
            }
          >
            <Plus className="h-3 w-3" />
            Sub-workflow
          </Button>
        </div>
        <div className="mono text-right text-[11px] text-[color:var(--color-muted-foreground)]">
          {formatRelativeTime(workflow.updatedAt)}
        </div>
      </div>
      {subworkflows.map((subworkflow, subIndex) => (
        <SubworkflowRow
          key={subworkflow.id}
          index={subIndex}
          isLast={subIndex === subworkflows.length - 1}
          parent={workflow}
          selectWorkflow={selectWorkflow}
          workflow={subworkflow}
        />
      ))}
    </div>
  );
}

export function WorkflowsPage() {
  const state = useAtomValue(appStateAtom);
  const createWorkflow = useSetAtom(createWorkflowAtom);
  const selectWorkflow = useSetAtom(selectWorkflowAtom);

  const parentWorkflows = state.workflows.filter(
    (workflow) => workflow.mode === "standard",
  );
  const subworkflowsByParent = new Map<string, WorkflowDefinition[]>();
  for (const workflow of state.workflows) {
    if (workflow.mode !== "subworkflow" || !workflow.parentWorkflowId) continue;
    subworkflowsByParent.set(workflow.parentWorkflowId, [
      ...(subworkflowsByParent.get(workflow.parentWorkflowId) ?? []),
      workflow,
    ]);
  }

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col">
      <div className="hairline-b flex items-center gap-4 px-6 py-4">
        <span className="label-xs">01 / workflows</span>
        <h1 className="font-display text-[22px] leading-none tracking-tight">
          Registry
        </h1>
        <span className="mono ml-auto text-[11px] text-[color:var(--color-muted-foreground)]">
          {parentWorkflows.length} workflows
        </span>
        <Button
          size="sm"
          variant="primary"
          onClick={() =>
            void createWorkflow({ name: "Untitled workflow", mode: "standard" })
          }
        >
          <Plus className="h-3 w-3" />
          New workflow
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="sticky top-0 z-10 grid gap-3 bg-[color:var(--color-surface)] px-3 py-1.5"
          style={{ gridTemplateColumns: "80px minmax(0,1fr) 120px 110px 90px" }}
        >
          <div className="label-xs">#</div>
          <div className="label-xs">workflow</div>
          <div className="label-xs">status</div>
          <div className="label-xs text-right">actions</div>
          <div className="label-xs text-right">updated</div>
        </div>

        <div className="stagger">
          {parentWorkflows.map((workflow, index) => (
            <WorkflowRow
              key={workflow.id}
              createWorkflow={createWorkflow}
              index={index}
              selectWorkflow={selectWorkflow}
              subworkflows={subworkflowsByParent.get(workflow.id) ?? []}
              workflow={workflow}
            />
          ))}
          {parentWorkflows.length === 0 ? (
            <div className="px-3 py-16 text-center text-[12px] text-[color:var(--color-muted-foreground)]">
              No workflows yet — create one to begin.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  currentWorkflowAtom,
  deleteCurrentWorkflowAtom,
  saveCurrentWorkflowAtom,
  saveWorkflowMetaAtom,
  selectWorkflowAtom,
} from "@/state/app-state";

function WorkflowSettingsForm({
  name,
  description,
  mode,
  onDelete,
  onSave,
}: {
  name: string;
  description: string;
  mode: "standard" | "subworkflow";
  onDelete: () => void;
  onSave: (draft: { name: string; description: string }) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    name,
    description,
  }));

  return (
    <div className="mx-auto flex h-full max-w-[760px] flex-col">
      <div className="hairline-b flex items-center gap-3 px-6 py-4">
        <span className="label-xs">workflow / settings</span>
        <h1 className="font-display text-[20px] leading-none tracking-tight">
          {name || "Untitled"}
        </h1>
        <Badge variant="muted">{mode}</Badge>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="hairline max-w-[560px] bg-[color:var(--color-card)]">
          <div className="hairline-b flex h-8 items-center px-3">
            <span className="label-xs">General</span>
          </div>
          <div className="space-y-3 p-3">
            <div className="space-y-1">
              <Label htmlFor="workflow-name">Name</Label>
              <Input
                id="workflow-name"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={draft.name}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                className="font-sans"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={draft.description}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="primary" onClick={() => onSave(draft)}>
                Save
              </Button>
              <Button onClick={onDelete} variant="destructive">
                Delete workflow
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkflowSettingsPage() {
  const { workflowId } = useParams({ strict: false }) as { workflowId: string };
  const selectWorkflow = useSetAtom(selectWorkflowAtom);
  const workflow = useAtomValue(currentWorkflowAtom);
  const updateMeta = useSetAtom(saveWorkflowMetaAtom);
  const saveDraft = useSetAtom(saveCurrentWorkflowAtom);
  const deleteWorkflow = useSetAtom(deleteCurrentWorkflowAtom);

  useEffect(() => {
    selectWorkflow(workflowId);
  }, [selectWorkflow, workflowId]);

  if (!workflow) return null;

  return (
    <WorkflowSettingsForm
      key={`${workflow.id}:${workflow.updatedAt}`}
      name={workflow.name}
      description={workflow.description}
      mode={workflow.mode}
      onDelete={() => void deleteWorkflow()}
      onSave={(draft) => {
        updateMeta({
          workflowId,
          name: draft.name,
          description: draft.description,
        });
        void saveDraft();
      }}
    />
  );
}

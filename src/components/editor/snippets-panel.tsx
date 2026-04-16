import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  appStateAtom,
  insertSnippetAtom,
  removeSnippetAtom,
  saveSnippetAtom,
} from "@/state/app-state";
import type { WorkflowDefinition } from "@/lib/workflow/types";
import { formatRelativeTime } from "@/lib/utils";

interface SnippetsPanelProps {
  workflow: WorkflowDefinition;
}

export function SnippetsPanel({ workflow }: SnippetsPanelProps) {
  const snippets = useAtomValue(appStateAtom).snippets;
  const saveSnippet = useSetAtom(saveSnippetAtom);
  const removeSnippet = useSetAtom(removeSnippetAtom);
  const insertSnippet = useSetAtom(insertSnippetAtom);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await saveSnippet({
        name: trimmed,
        description: `Saved from ${workflow.name}`,
        graph: workflow.draftGraph,
      });
      setName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="flex h-full flex-col bg-[color:var(--color-card)]">
      <div className="hairline-b flex h-8 items-center px-3">
        <span className="label-xs">Snippets</span>
      </div>

      <div className="hairline-b flex flex-col gap-1.5 p-3">
        <Label className="label-xs" htmlFor="snippet-name">
          Save current as snippet
        </Label>
        <div className="flex gap-1">
          <Input
            id="snippet-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Snippet name"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSave();
              }
            }}
          />
          <Button
            size="sm"
            variant="primary"
            disabled={!name.trim() || saving}
            onClick={() => void handleSave()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-[10px] text-[color:var(--color-muted-foreground)]">
          Captures all {workflow.draftGraph.nodes.length} nodes and edges.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {snippets.length === 0 ? (
          <p className="p-4 text-[11px] text-[color:var(--color-muted-foreground)]">
            No snippets yet. Save the current workflow above.
          </p>
        ) : (
          <ul>
            {snippets.map((snippet) => (
              <li
                key={snippet.id}
                className="hairline-b flex items-start gap-2 px-3 py-2 hover:bg-[color:var(--color-surface)]"
              >
                <button
                  type="button"
                  onClick={() =>
                    insertSnippet({
                      workflowId: workflow.id,
                      snippetId: snippet.id,
                    })
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-[12px] font-medium text-[color:var(--color-foreground)] hover:text-[color:var(--color-primary)]">
                    {snippet.name}
                  </div>
                  <div className="mono mt-0.5 truncate text-[10px] text-[color:var(--color-muted-foreground)]">
                    {snippet.graph.nodes.length} nodes ·{" "}
                    {formatRelativeTime(snippet.updatedAt)}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${snippet.name}`}
                  onClick={() => void removeSnippet(snippet.id)}
                  className="mono shrink-0 rounded-[3px] p-1 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-card)] hover:text-[color:var(--color-destructive)]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

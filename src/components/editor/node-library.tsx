import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { templatesByFamily } from "@/lib/workflow/templates";
import type { WorkflowNodeKind } from "@/lib/workflow/types";

interface NodeLibraryProps {
  onAddNode: (kind: WorkflowNodeKind) => void;
  hasTrigger?: boolean;
}

export function NodeLibrary({
  onAddNode,
  hasTrigger = false,
}: NodeLibraryProps) {
  const [query, setQuery] = useState("");
  const sections = templatesByFamily();

  return (
    <aside className="flex h-full flex-col bg-[color:var(--color-card)]">
      <div className="hairline-b flex h-8 items-center px-3">
        <span className="label-xs">Node library</span>
      </div>

      <div className="hairline-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[color:var(--color-muted-foreground)]" />
          <Input
            className="pl-7"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            value={query}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {Object.entries(sections).map(([family, templates]) => {
          const visible = templates.filter((template) =>
            `${template.title} ${template.subtitle}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          );

          if (visible.length === 0) return null;

          return (
            <section key={family}>
              <div className="hairline-b bg-[color:var(--color-surface)] px-3 py-1">
                <p className="label-xs">{family}</p>
              </div>
              <ul>
                {visible.map((template) => {
                  const disabled = hasTrigger && template.family === "trigger";
                  return (
                    <li key={template.kind}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onAddNode(template.kind)}
                        className="group hairline-b flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <span className="mono mt-0.5 text-[10px] text-[color:var(--color-muted-foreground)] group-hover:text-[color:var(--color-primary)] group-disabled:group-hover:text-[color:var(--color-muted-foreground)]">
                          {disabled ? "—" : "+"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-[color:var(--color-foreground)]">
                            {template.title}
                          </span>
                          <span className="block truncate text-[11px] text-[color:var(--color-muted-foreground)]">
                            {disabled
                              ? "Only one trigger per workflow."
                              : template.subtitle}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

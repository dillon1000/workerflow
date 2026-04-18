import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Play, Plus, Search } from "lucide-react";
import { workflowTemplates } from "@/lib/workflow/plugin-registry";
import { useTransitionPresence } from "@/hooks/use-transition-presence";
import type { WorkflowNodeKind } from "@/lib/workflow/types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAddNode: (kind: WorkflowNodeKind) => void;
  onRunWorkflow: () => void;
  onOpenQuickLook: () => void;
  canQuickLook: boolean;
  canRun: boolean;
  hasTrigger: boolean;
  workflowMode: "standard" | "subworkflow";
}

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  disabled?: boolean;
  disabledReason?: string;
  keywords: string;
};

export function CommandPalette({
  open,
  onClose,
  onAddNode,
  onRunWorkflow,
  onOpenQuickLook,
  canQuickLook,
  canRun,
  hasTrigger,
  workflowMode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mounted, state } = useTransitionPresence(open, 140);

  const commands = useMemo<Command[]>(() => {
    const nodeCommands: Command[] = workflowTemplates
      .filter((template) => {
        if (template.kind === "parentContext") return false;
        if (workflowMode === "subworkflow" && template.family === "trigger") {
          return false;
        }
        return true;
      })
      .map((template) => {
        const disabled = hasTrigger && template.family === "trigger";
        return {
          id: `add:${template.kind}`,
          label: `Add ${template.title}`,
          hint: template.subtitle,
          icon: Plus,
          run: () => onAddNode(template.kind),
          disabled,
          disabledReason: disabled
            ? "This workflow already has a trigger."
            : undefined,
          keywords:
            `add ${template.title} ${template.subtitle} ${template.family} ${template.kind}`.toLowerCase(),
        };
      });

    const actions: Command[] = [
      {
        id: "run:workflow",
        label: "Run workflow",
        hint: "Execute and open the run panel.",
        icon: Play,
        run: onRunWorkflow,
        disabled: !canRun,
        disabledReason: !canRun
          ? "Sub-workflows run from their parent."
          : undefined,
        keywords: "run execute start workflow",
      },
      {
        id: "node:quick-look",
        label: "Quick look selected node",
        hint: "Open a floating mini-inspector for the selection.",
        icon: Eye,
        run: onOpenQuickLook,
        disabled: !canQuickLook,
        disabledReason: !canQuickLook ? "Select a node first." : undefined,
        keywords: "quick look inspect preview space selected node",
      },
    ];

    return [...actions, ...nodeCommands];
  }, [
    canQuickLook,
    canRun,
    hasTrigger,
    onAddNode,
    onOpenQuickLook,
    onRunWorkflow,
    workflowMode,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (command) =>
        command.keywords.includes(q) || command.label.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!mounted) return null;

  const clampedIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  function handleClose() {
    setQuery("");
    setActiveIndex(0);
    onClose();
  }

  function runCommand(command: Command) {
    if (command.disabled) return;
    command.run();
    handleClose();
  }

  return (
    <div
      className="floating-overlay fixed inset-0 z-50 flex items-start justify-center bg-black/20 backdrop-blur-[1px]"
      data-state={state}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        className="palette-card hairline mt-[14vh] w-[min(520px,92vw)] overflow-hidden rounded-md bg-[color:var(--color-card)] shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
        data-state={state}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="hairline-b flex items-center gap-2 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-[color:var(--color-muted-foreground)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) =>
                  Math.min(index + 1, filtered.length - 1),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const command = filtered[clampedIndex];
                if (command) runCommand(command);
              } else if (event.key === "Escape") {
                event.preventDefault();
                handleClose();
              }
            }}
            placeholder="Type a command or node name…"
            className="mono h-6 flex-1 bg-transparent text-[13px] text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
            aria-label="Command search"
          />
          <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
            esc
          </span>
        </div>
        <ul className="max-h-[320px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-[12px] text-[color:var(--color-muted-foreground)]">
              No matches.
            </li>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon;
              const active = index === clampedIndex;
              return (
                <li key={command.id} className="palette-result">
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                    disabled={command.disabled}
                    className={`flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      active && !command.disabled
                        ? "bg-[color:var(--color-surface)]"
                        : ""
                    }`}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-muted-foreground)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-[color:var(--color-foreground)]">
                        {command.label}
                      </span>
                      <span className="block truncate text-[11px] text-[color:var(--color-muted-foreground)]">
                        {command.disabledReason ?? command.hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

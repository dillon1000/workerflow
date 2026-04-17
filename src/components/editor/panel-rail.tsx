import { ChevronLeft, ChevronRight } from "lucide-react";

interface RailTab<T extends string> {
  value: T;
  label: string;
}

interface PanelRailProps<T extends string> {
  side: "left" | "right";
  tabs: RailTab<T>[];
  activeTab: T;
  onExpand: (tab: T) => void;
}

export function PanelRail<T extends string>({
  side,
  tabs,
  activeTab,
  onExpand,
}: PanelRailProps<T>) {
  const Chevron = side === "left" ? ChevronRight : ChevronLeft;
  return (
    <div
      className={`flex h-full w-7 shrink-0 flex-col items-center bg-[color:var(--color-card)] ${
        side === "left" ? "hairline-r" : "hairline-l"
      }`}
    >
      <button
        type="button"
        onClick={() => onExpand(activeTab)}
        aria-label={
          side === "left" ? "Expand left panel" : "Expand right panel"
        }
        className="flex h-8 w-full items-center justify-center border-b border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-foreground)]"
      >
        <Chevron className="h-3 w-3" />
      </button>
      <div className="flex flex-1 flex-col">
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onExpand(tab.value)}
              aria-label={`Open ${tab.label}`}
              className={`label-xs flex w-full flex-1 items-center justify-center px-0 py-3 text-[10px] uppercase tracking-[0.08em] transition-colors hover:bg-[color:var(--color-surface)] ${
                isActive
                  ? "text-[color:var(--color-foreground)]"
                  : "text-[color:var(--color-muted-foreground)]"
              }`}
              style={{
                writingMode: "vertical-rl",
                transform: side === "left" ? "rotate(180deg)" : undefined,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

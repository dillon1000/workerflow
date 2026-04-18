import { Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Badge } from "@/components/ui/badge";
import { appStateAtom } from "@/state/app-state";
import { formatRelativeTime } from "@/lib/utils";

function SectionHeader({
  index,
  title,
  action,
}: {
  index: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="hairline-b flex h-8 items-center gap-3 bg-[color:var(--color-card)] px-3">
      <span className="label-xs">{index}</span>
      <span className="text-[12px] font-medium">{title}</span>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

export function DashboardPage() {
  const state = useAtomValue(appStateAtom);
  const metrics = state.analytics;

  const stats = [
    { label: "published", value: metrics?.publishedWorkflows ?? 0 },
    { label: "total runs", value: metrics?.totalRuns ?? 0 },
    { label: "connections", value: state.connections.length },
    {
      label: "median ms",
      value: metrics?.medianDurationMs ?? 0,
    },
    { label: "workflows", value: metrics?.totalWorkflows ?? 0 },
    {
      label: "success",
      value: `${metrics?.successRate ?? 0}%`,
    },
  ];

  return (
    <div className="stagger mx-auto flex h-full max-w-[1400px] flex-col">
      {/* Hero strip */}
      <div className="hairline-b flex items-baseline gap-4 px-6 py-5">
        <span className="label-xs">01 / overview</span>
        <h1 className="font-display text-[22px] leading-none tracking-tight">
          Operator console
        </h1>
        <span className="mono ml-auto text-[11px] text-[color:var(--color-muted-foreground)]">
          {new Date().toISOString().split("T")[0]}
        </span>
      </div>

      {/* Stats grid */}
      <div className="hairline-b grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`px-4 py-4 ${i < stats.length - 1 ? "hairline-r" : ""}`}
          >
            <div className="label-xs">{stat.label}</div>
            <div className="mono mt-1 text-[22px] tabular-nums leading-none">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
        <div className="hairline-r flex min-h-0 flex-col">
          <SectionHeader
            index="02"
            title="Recent runs"
            action={
              <Link
                to="/workflows"
                className="mono text-[11px] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
              >
                view all →
              </Link>
            }
          />
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="hairline-b bg-[color:var(--color-surface)]">
                  <th className="label-xs px-3 py-1.5 text-left">workflow</th>
                  <th className="label-xs px-3 py-1.5 text-left">trigger</th>
                  <th className="label-xs px-3 py-1.5 text-left">status</th>
                  <th className="label-xs px-3 py-1.5 text-right">when</th>
                </tr>
              </thead>
              <tbody>
                {state.runs.slice(0, 12).map((run) => (
                  <tr
                    key={run.id}
                    className="hairline-b hover:bg-[color:var(--color-surface)]"
                  >
                    <td className="px-3 py-1.5 text-[12px]">
                      {run.workflowName}
                    </td>
                    <td className="mono px-3 py-1.5 text-[11px] text-[color:var(--color-muted-foreground)]">
                      {run.triggerKind}
                    </td>
                    <td className="px-3 py-1.5">
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
                    </td>
                    <td className="mono px-3 py-1.5 text-right text-[11px] text-[color:var(--color-muted-foreground)]">
                      {formatRelativeTime(run.startedAt)}
                    </td>
                  </tr>
                ))}
                {state.runs.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-[12px] text-[color:var(--color-muted-foreground)]"
                    >
                      No runs yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <SectionHeader index="03" title="Trigger mix" />
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="space-y-2.5">
              {Object.entries(metrics?.triggerMix ?? {}).map(
                ([kind, count]) => {
                  const pct = Math.min(100, count * 12);
                  return (
                    <div key={kind}>
                      <div className="mono mb-1 flex justify-between text-[11px]">
                        <span className="text-[color:var(--color-foreground)]">
                          {kind}
                        </span>
                        <span className="text-[color:var(--color-muted-foreground)]">
                          {count}
                        </span>
                      </div>
                      <div className="relative h-[6px] w-full bg-[color:var(--color-surface-2)]">
                        <div
                          className="absolute inset-y-0 left-0 bg-[color:var(--color-primary)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
              {Object.keys(metrics?.triggerMix ?? {}).length === 0 && (
                <p className="text-[12px] text-[color:var(--color-muted-foreground)]">
                  No triggers configured.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

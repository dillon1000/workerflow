import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  appStateAtom,
  createWorkflowAtom,
  signOutAtom,
} from "@/state/app-state";

const navItems = [
  { to: "/dashboard", label: "Overview" },
  { to: "/workflows", label: "Workflows" },
  { to: "/connections", label: "Connections" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const { location } = useRouterState();
  const state = useAtomValue(appStateAtom);
  const createWorkflow = useSetAtom(createWorkflowAtom);
  const performSignOut = useSetAtom(signOutAtom);

  const isEditor = /^\/workflows\/[^/]+\/editor/.test(location.pathname);

  return (
    <div className="page-reveal flex h-screen flex-col overflow-hidden bg-[color:var(--color-background)]">
      {/* Top bar */}
      <header className="hairline-b flex h-9 shrink-0 items-center bg-[color:var(--color-card)]">
        <Link
          to="/dashboard"
          className="flex h-full items-center gap-2 border-r border-[color:var(--color-border)] px-3"
        >
          <span className="grid h-4 w-4 place-items-center bg-[color:var(--color-primary)] text-[10px] font-bold text-white">
            W
          </span>
          <span className="mono text-[12px] font-medium tracking-tight">
            workerflow
          </span>
        </Link>

        <nav className="flex h-full">
          {navItems.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.to !== "/dashboard" &&
                location.pathname.startsWith(`${item.to}`));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex h-full items-center px-3 text-[12px] transition-colors",
                  active
                    ? "text-[color:var(--color-foreground)]"
                    : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-[2px] bg-[color:var(--color-primary)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex h-full items-center gap-1 px-2">
          <span className="label-xs hidden px-2 md:inline">
            {state.session?.user?.email ?? "signed out"}
          </span>
          <span className="hairline-l mx-1 h-4" />
          <Button
            size="sm"
            variant="primary"
            onClick={() => void createWorkflow("Untitled workflow")}
          >
            <Plus className="h-3 w-3" />
            New
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void performSignOut()}
          >
            Sign out
          </Button>
        </div>
      </header>

      {/* Main region */}
      <main className="min-h-0 flex-1 overflow-hidden">
        {isEditor ? (
          <Outlet />
        ) : (
          <div className="h-full overflow-auto">
            <Outlet />
          </div>
        )}
      </main>

      {/* Status bar */}
      <footer className="hairline-t mono flex h-6 shrink-0 items-center gap-0 bg-[color:var(--color-card)] text-[11px] text-[color:var(--color-muted-foreground)]">
        <span className="hairline-r flex h-full items-center gap-1.5 px-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
          connected
        </span>
        <span className="hairline-r flex h-full items-center px-2">
          wf&nbsp;
          <span className="text-[color:var(--color-foreground)]">
            {state.analytics?.totalWorkflows ?? 0}
          </span>
        </span>
        <span className="hairline-r flex h-full items-center px-2">
          runs&nbsp;
          <span className="text-[color:var(--color-foreground)]">
            {state.analytics?.totalRuns ?? 0}
          </span>
        </span>
        <span className="hairline-r flex h-full items-center px-2">
          conn&nbsp;
          <span className="text-[color:var(--color-foreground)]">
            {state.connections.length}
          </span>
        </span>
        <span className="ml-auto hairline-l flex h-full items-center px-2">
          v0.1.0
        </span>
      </footer>
    </div>
  );
}

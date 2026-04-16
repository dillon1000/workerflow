import { useEffect } from "react";
import { Navigate, Outlet } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { appStateAtom, bootstrapAtom } from "@/state/app-state";

function Splash() {
  return (
    <div className="flex h-screen items-center justify-center bg-[color:var(--color-background)]">
      <div className="text-center">
        <div className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
          workerflow
        </div>
        <div className="mono mt-1 text-[12px]">
          <span className="caret">getting data</span>
        </div>
      </div>
    </div>
  );
}

export function RootGate() {
  const state = useAtomValue(appStateAtom);
  const bootstrap = useSetAtom(bootstrapAtom);

  useEffect(() => {
    if (!state.bootstrapped && !state.loading) {
      void bootstrap();
    }
  }, [bootstrap, state.bootstrapped, state.loading]);

  if (!state.bootstrapped) {
    return <Splash />;
  }

  return <Outlet />;
}

export function ProtectedGate() {
  const session = useAtomValue(appStateAtom).session;
  if (!session?.user) {
    return <Navigate to="/login" />;
  }
  return <Outlet />;
}

export function LoginGate() {
  const session = useAtomValue(appStateAtom).session;
  if (session?.user) {
    return <Navigate to="/dashboard" />;
  }
  return <Outlet />;
}

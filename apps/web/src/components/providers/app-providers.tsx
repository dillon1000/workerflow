import type { PropsWithChildren } from "react";
import { DevTools } from "jotai-devtools";
import "jotai-devtools/styles.css";
import { Toaster } from "sonner";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <>
      {children}
      {import.meta.env.DEV ? (
        <DevTools
          isInitialOpen={false}
          position="bottom-left"
          theme="light"
          options={{ snapshotHistoryLimit: 30 }}
        />
      ) : null}
      <Toaster
        position="bottom-right"
        gap={6}
        offset={16}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "group flex w-[320px] items-start gap-2 rounded-[3px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2 shadow-[0_10px_24px_-12px_rgba(14,14,13,0.22)] font-[IBM_Plex_Sans,sans-serif] text-[12px] text-[color:var(--color-foreground)] data-[type=success]:border-l-[3px] data-[type=success]:border-l-[color:var(--color-success)] data-[type=error]:border-l-[3px] data-[type=error]:border-l-[color:var(--color-destructive)] data-[type=info]:border-l-[3px] data-[type=info]:border-l-[color:var(--color-primary)] data-[type=warning]:border-l-[3px] data-[type=warning]:border-l-amber-500",
            title:
              "text-[12px] font-medium leading-tight text-[color:var(--color-foreground)]",
            description:
              "mt-0.5 text-[11px] leading-snug text-[color:var(--color-muted-foreground)]",
            icon: "hidden",
            actionButton:
              "rounded-[3px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-0.5 text-[11px] text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]",
            cancelButton:
              "rounded-[3px] px-2 py-0.5 text-[11px] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]",
            closeButton: "hidden",
          },
        }}
      />
    </>
  );
}

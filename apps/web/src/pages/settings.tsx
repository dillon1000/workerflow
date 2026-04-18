export function SettingsPage() {
  const rows = [
    { k: "auth", v: "better-auth" },
    { k: "runtime", v: "cloudflare workers" },
    { k: "storage", v: "kv + d1" },
    { k: "executor", v: "reusable workflow runner" },
    { k: "version", v: "0.1.0" },
  ];
  return (
    <div className="mx-auto flex h-full max-w-[760px] flex-col">
      <div className="hairline-b flex items-center gap-3 px-6 py-4">
        <span className="label-xs">01 / settings</span>
        <h1 className="font-display text-[22px] leading-none tracking-tight">
          Workspace
        </h1>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <p className="max-w-[56ch] text-[13px] leading-relaxed text-[color:var(--color-foreground)]">
          Narrow by design. Authentication runs on Better Auth, credentials are
          encrypted in KV, and every workflow runs through a single reusable
          Cloudflare Workflow executor.
        </p>

        <div className="mt-6">
          <div className="label-xs mb-2">Stack</div>
          <dl className="hairline w-fit min-w-[360px] bg-[color:var(--color-card)]">
            {rows.map((r, i) => (
              <div
                key={r.k}
                className={`grid grid-cols-[140px_1fr] ${
                  i < rows.length - 1 ? "hairline-b" : ""
                }`}
              >
                <dt className="hairline-r label-xs px-3 py-1.5">{r.k}</dt>
                <dd className="mono px-3 py-1.5 text-[12px]">{r.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

export function mergeHeaders(...headers: Array<HeadersInit | undefined>) {
  const merged = new Headers();
  for (const init of headers) {
    if (!init) continue;
    for (const [key, value] of new Headers(init).entries()) {
      merged.set(key, value);
    }
  }
  return merged;
}

export function bearerAuthHeaders(token: string, headers?: HeadersInit) {
  return mergeHeaders(headers, {
    Authorization: `Bearer ${token}`,
  });
}

export function basicAuthHeaders(
  username: string,
  password: string,
  headers?: HeadersInit,
) {
  return mergeHeaders(headers, {
    Authorization: `Basic ${btoa(`${username}:${password}`)}`,
  });
}

export function applyIdempotencyHeaders(
  effectKey: string,
  headers?: HeadersInit,
  mode: "idempotency-key" | "workflow-effect-key" = "workflow-effect-key",
) {
  return mergeHeaders(headers, {
    [mode === "idempotency-key" ? "Idempotency-Key" : "X-Workflow-Effect-Key"]:
      effectKey,
  });
}

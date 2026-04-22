const DEFAULT_SENSITIVE_PATTERN =
  /(authorization|api[-_]?key|token|secret|password|signature|cookie|set-cookie)/i;

function redactString(value: string, replacement: string) {
  if (!value) return value;
  return replacement;
}

export function shouldRedactKey(key: string) {
  return DEFAULT_SENSITIVE_PATTERN.test(key);
}

export function redactValue(
  value: unknown,
  replacement = "[redacted]",
): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return redactString(value, replacement);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, replacement));
  }
  if (typeof value === "object") {
    return redactObject(value as Record<string, unknown>, replacement);
  }
  return replacement;
}

export function redactObject(
  input: Record<string, unknown>,
  replacement = "[redacted]",
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      shouldRedactKey(key)
        ? replacement
        : Array.isArray(value)
          ? value.map((entry) =>
              typeof entry === "object" && entry != null
                ? redactValue(entry, replacement)
                : entry,
            )
          : typeof value === "object" && value != null
            ? redactObject(value as Record<string, unknown>, replacement)
            : value,
    ]),
  );
}

export function redactHeaders(headers?: HeadersInit, replacement = "[redacted]") {
  if (!headers) return {};
  return redactObject(
    Object.fromEntries(new Headers(headers).entries()),
    replacement,
  );
}

export function redactForTrace<T>(value: T, replacement = "[redacted]"): T {
  if (typeof value !== "object" || value == null) {
    return value;
  }
  return redactValue(value, replacement) as T;
}

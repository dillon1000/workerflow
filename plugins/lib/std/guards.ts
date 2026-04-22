export function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertNonEmptyString(value: string, message: string) {
  assert(value.trim().length > 0, message);
  return value.trim();
}

export function assertJsonObject(
  value: unknown,
  message: string,
): Record<string, unknown> {
  assert(
    value != null && typeof value === "object" && !Array.isArray(value),
    message,
  );
  return value as Record<string, unknown>;
}

export function assertMaxBytes(value: string, maxBytes: number, message: string) {
  assert(new TextEncoder().encode(value).byteLength <= maxBytes, message);
  return value;
}

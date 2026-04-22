export function matchOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function matchesPattern(value: string, pattern: RegExp) {
  return pattern.test(value);
}

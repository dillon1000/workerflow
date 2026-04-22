export interface NormalizedError {
  message: string;
  cause?: string;
  provider?: string;
  operation?: string;
  status?: number;
}

export function normalizeError(
  error: unknown,
  input: Omit<NormalizedError, "message"> & { fallback?: string } = {},
): NormalizedError {
  if (error instanceof Error) {
    return {
      ...input,
      message: error.message,
      cause: error.name,
    };
  }

  return {
    ...input,
    message: input.fallback ?? "Unknown error.",
  };
}

export function formatProviderError(
  provider: string,
  operation: string,
  error: unknown,
) {
  const normalized = normalizeError(error, { provider, operation });
  return `${provider} ${operation} failed: ${normalized.message}`;
}

export async function throwForHttpError(
  response: Response,
  fallback: string,
  parser?: (response: Response) => Promise<string | undefined>,
) {
  if (response.ok) {
    return;
  }
  const parsed = parser ? await parser(response) : undefined;
  throw new Error(parsed ?? `${fallback} (${response.status}).`);
}

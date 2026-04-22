import { NonRetryableError } from "cloudflare:workflows";

export function failWorkflow(message: string): never {
  throw new NonRetryableError(message);
}

export function failWorkflowIf(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new NonRetryableError(message);
  }
}

export function asNonRetryableError(error: unknown, fallback: string) {
  if (error instanceof NonRetryableError) {
    return error;
  }
  if (error instanceof Error) {
    return new NonRetryableError(error.message);
  }
  return new NonRetryableError(fallback);
}

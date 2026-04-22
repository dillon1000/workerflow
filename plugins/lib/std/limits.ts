import { assert, assertMaxBytes } from "./guards";
import { MAX_SLEEP_SECONDS } from "./time";

export const MAX_STEP_OUTPUT_BYTES = 900_000;
export const MAX_TRACE_EVENT_BYTES = 32_000;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 250;

export function assertWorkflowOutputLimit(value: string) {
  return assertMaxBytes(
    value,
    MAX_STEP_OUTPUT_BYTES,
    `Step output must stay under ${MAX_STEP_OUTPUT_BYTES} bytes.`,
  );
}

export function assertTraceEventLimit(value: string) {
  return assertMaxBytes(
    value,
    MAX_TRACE_EVENT_BYTES,
    `Trace event payload must stay under ${MAX_TRACE_EVENT_BYTES} bytes.`,
  );
}

export function assertWorkflowTimeoutSeconds(seconds: number) {
  assert(
    seconds <= MAX_SLEEP_SECONDS,
    `Timeout cannot exceed ${MAX_SLEEP_SECONDS} seconds.`,
  );
  return seconds;
}

export function normalizePageSize(
  value: unknown,
  fallback = DEFAULT_PAGE_SIZE,
  max = MAX_PAGE_SIZE,
) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

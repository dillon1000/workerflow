import { assert } from "./guards";

export const MAX_SLEEP_SECONDS = 30 * 60;

export function nowIso() {
  return new Date().toISOString();
}

export function readDurationSeconds(value: unknown, fallback = 60) {
  const parsed = Number(value ?? fallback);
  assert(Number.isFinite(parsed), "Duration must be a finite number.");
  return parsed;
}

export function validateWorkflowSleepSeconds(seconds: number) {
  assert(seconds >= 1, "Duration must be at least 1 second.");
  assert(
    seconds <= MAX_SLEEP_SECONDS,
    `Duration cannot exceed ${MAX_SLEEP_SECONDS} seconds.`,
  );
  return seconds;
}

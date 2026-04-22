import type { WorkflowStepConfig } from "cloudflare:workers";
import type { WorkflowStepExecutionContext } from "../../runtime";

type WorkflowRetryDelay = NonNullable<WorkflowStepConfig["retries"]>["delay"];
type WorkflowTimeout = NonNullable<WorkflowStepConfig["timeout"]>;

export type WorkflowRetryBackoff = "constant" | "linear" | "exponential";

export interface RetryOptions {
  limit?: number;
  delay?: WorkflowRetryDelay;
  backoff?: WorkflowRetryBackoff;
  timeout?: WorkflowTimeout;
}

export const DEFAULT_STEP_TIMEOUT = "30 minutes";
export const DEFAULT_STEP_RETRY_DELAY = "10 seconds";

export function createRetryConfig(
  options: RetryOptions = {},
): WorkflowStepConfig {
  return {
    retries: {
      limit: options.limit ?? 5,
      delay: options.delay ?? DEFAULT_STEP_RETRY_DELAY,
      backoff: options.backoff ?? "exponential",
    },
    timeout: options.timeout ?? DEFAULT_STEP_TIMEOUT,
  };
}

export function noRetryConfig(
  options: Omit<RetryOptions, "limit" | "backoff"> = {},
): WorkflowStepConfig {
  return createRetryConfig({
    ...options,
    limit: 0,
    backoff: "constant",
  });
}

export function linearRetryConfig(options: RetryOptions = {}): WorkflowStepConfig {
  return createRetryConfig({
    ...options,
    backoff: "linear",
  });
}

export function exponentialRetryConfig(
  options: RetryOptions = {},
): WorkflowStepConfig {
  return createRetryConfig({
    ...options,
    backoff: "exponential",
  });
}

export function constantRetryConfig(
  options: RetryOptions = {},
): WorkflowStepConfig {
  return createRetryConfig({
    ...options,
    backoff: "constant",
  });
}

export function currentAttempt(context: WorkflowStepExecutionContext) {
  return context.stepContext?.attempt ?? 1;
}

export function currentStepConfig(context: WorkflowStepExecutionContext) {
  return context.stepConfig;
}

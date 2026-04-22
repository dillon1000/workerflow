import type { WorkflowStepExecutionContext } from "../../runtime";
import type { JsonValue } from "../../../apps/web/src/lib/workflow/types";
import { redactHeaders, redactForTrace } from "./redaction";
import { assertTraceEventLimit } from "./limits";

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  const json = JSON.stringify(redactForTrace(value));
  assertTraceEventLimit(json);
  return JSON.parse(json) as JsonValue;
}

export function recordEvent(
  context: WorkflowStepExecutionContext,
  type: string,
  detail?: string,
  data?: Record<string, unknown>,
) {
  return context.recordTraceEvent({ type, detail, data: toJsonValue(data) });
}

export function recordExternalCall(
  context: WorkflowStepExecutionContext,
  input: {
    method: string;
    url: string;
    provider?: string;
    operation?: string;
    headers?: HeadersInit;
  },
) {
  return recordEvent(context, "http.request", `${input.method} ${input.url}`, {
    provider: input.provider,
    operation: input.operation,
    headers:
      input.headers == null ? undefined : redactHeaders(input.headers),
  });
}

export function recordExternalResult(
  context: WorkflowStepExecutionContext,
  input: {
    method: string;
    url: string;
    status: number;
    provider?: string;
    operation?: string;
  },
) {
  return recordEvent(
    context,
    "http.response",
    `${input.method} ${input.url} -> ${input.status}`,
    {
      provider: input.provider,
      operation: input.operation,
      status: input.status,
    },
  );
}

export function logStepMetadataForObservability(
  context: WorkflowStepExecutionContext,
) {
  return recordEvent(context, "step.metadata", context.stepName, {
    attempt: context.stepContext?.attempt ?? 1,
    stepName: context.stepName ?? context.node.id,
    config: context.stepConfig ?? null,
  });
}

export const CLOUDFLARE_WORKFLOW_EVENT_TYPES = [
  "WORKFLOW_QUEUED",
  "WORKFLOW_START",
  "WORKFLOW_SUCCESS",
  "WORKFLOW_FAILURE",
  "WORKFLOW_TERMINATED",
  "STEP_START",
  "STEP_SUCCESS",
  "STEP_FAILURE",
  "SLEEP_START",
  "SLEEP_COMPLETE",
  "ATTEMPT_START",
  "ATTEMPT_SUCCESS",
  "ATTEMPT_FAILURE",
] as const;

export type CloudflareWorkflowEventType =
  (typeof CLOUDFLARE_WORKFLOW_EVENT_TYPES)[number];

export function recordCloudflareMetricHint(
  context: WorkflowStepExecutionContext,
  eventType: CloudflareWorkflowEventType,
  detail?: string,
) {
  return recordEvent(context, "cloudflare.metric-hint", detail ?? eventType, {
    eventType,
    stepName: context.stepName ?? context.node.id,
    attempt: context.stepContext?.attempt ?? 1,
  });
}

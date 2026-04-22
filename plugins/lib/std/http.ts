import type { WorkflowStepExecutionContext } from "../../runtime";
import { stableJsonHash } from "./determinism";
import { recordExternalCall, recordExternalResult } from "./observe";

export interface HttpRequestDefinition {
  method: string;
  url: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  provider?: string;
  operation?: string;
}

export function buildHttpRequest(
  context: WorkflowStepExecutionContext,
  input: HttpRequestDefinition,
) {
  const method = input.method.toUpperCase();
  const headers = new Headers(input.headers);
  context.recordTraceEvent({
    type: "http.request.built",
    detail: `${method} ${input.url}`,
    data: {
      provider: input.provider ?? null,
      operation: input.operation ?? null,
      hasBody: input.body != null,
    } as const,
  });
  return {
    method,
    url: input.url,
    headers,
    body: method === "GET" ? undefined : (input.body ?? undefined),
    provider: input.provider,
    operation: input.operation,
  };
}

export async function requestFingerprint(input: {
  method: string;
  url: string;
  headers?: HeadersInit;
  body?: unknown;
}) {
  const headerEntries = new Headers(input.headers).entries();
  return stableJsonHash({
    method: input.method,
    url: input.url,
    headers: Array.from(headerEntries),
    body: input.body ?? null,
  });
}

export async function fetchJson<T>(
  context: WorkflowStepExecutionContext,
  request: ReturnType<typeof buildHttpRequest>,
) {
  recordExternalCall(context, request);
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  recordExternalResult(context, {
    method: request.method,
    url: request.url,
    status: response.status,
    provider: request.provider,
    operation: request.operation,
  });
  return {
    response,
    body: (await response.json()) as T,
  };
}

export async function fetchText(
  context: WorkflowStepExecutionContext,
  request: ReturnType<typeof buildHttpRequest>,
) {
  recordExternalCall(context, request);
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  recordExternalResult(context, {
    method: request.method,
    url: request.url,
    status: response.status,
    provider: request.provider,
    operation: request.operation,
  });
  return {
    response,
    body: await response.text(),
  };
}

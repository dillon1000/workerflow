import type { WorkflowStepRunner } from "../../runtime";
import { renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchText } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const method = renderedStringConfig(context, "method", "GET");
  const url = renderedStringConfig(context, "url");
  const headersValue = renderedStringConfig(context, "headers", "{}");
  const bodyValue = renderedStringConfig(context, "body");
  const headers = headersValue
    ? (JSON.parse(headersValue) as HeadersInit)
    : undefined;
  const output: { status: number; ok: boolean; body: unknown } =
    await executeIdempotentEffect(context, {
    provider: "webhook",
    operation: "send-webhook",
    request: { method, url, headers, body: bodyValue },
    perform: async (effectKey) => {
      const request = buildHttpRequest(context, {
        method,
        url,
        headers: {
          ...(headers instanceof Headers
            ? Object.fromEntries(headers.entries())
            : ((headers ?? {}) as Record<string, string>)),
          "X-Workflow-Effect-Key": effectKey,
        },
        body: method === "GET" ? undefined : bodyValue,
        provider: "webhook",
        operation: "send-webhook",
      });
      const { response, body } = await fetchText(context, request);
      return {
        status: response.status,
        ok: response.ok,
        body: context.parseMaybeJson(body),
      };
    },
    });
  return ok(
    `${method} ${url} returned ${output.status}.`,
    output.body,
    output.ok ? "complete" : "errored",
  );
};

import type { WorkflowStepRunner } from "../../runtime";
import { renderedStringConfig } from "../../lib/std/config";
import { buildHttpRequest, fetchText } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const method = renderedStringConfig(context, "method", "GET");
  const url = renderedStringConfig(context, "url");
  const headersValue = renderedStringConfig(context, "headers", "{}");
  const bodyValue = renderedStringConfig(context, "body");
  const request = buildHttpRequest(context, {
    method,
    url,
    headers: headersValue
      ? (JSON.parse(headersValue) as HeadersInit)
      : undefined,
    body: method === "GET" ? undefined : bodyValue,
    provider: "http",
    operation: "request",
  });
  const { response, body } = await fetchText(context, request);
  return ok(
    `${method} ${url} returned ${response.status}.`,
    context.parseMaybeJson(body),
    response.ok ? "complete" : "errored",
  );
};

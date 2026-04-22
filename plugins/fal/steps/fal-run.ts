import type { WorkflowStepRunner } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchJson } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const connection = await requireConnection(context);
  const apiKey = await requireSecret(
    context,
    connection,
    "apiKey",
    "fal.ai connection is missing an apiKey secret.",
  );

  const model = String(context.node.data.config.model ?? "").trim();
  if (!model) {
    throw new Error("fal.ai model is required.");
  }

  const rawInput = renderedStringConfig(context, "input", "{}");
  const parsed = context.parseMaybeJson(rawInput);
  const input =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  const output = await executeIdempotentEffect<Record<string, unknown>>(context, {
    provider: "fal",
    operation: "run-model",
    request: { model, input },
    perform: async (effectKey) => {
      const request = buildHttpRequest(context, {
        method: "POST",
        url: `https://fal.run/${model}`,
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
          "X-Workflow-Effect-Key": effectKey,
        },
        body: JSON.stringify(input),
        provider: "fal",
        operation: "run-model",
      });
      const { response, body } = await fetchJson<
        Record<string, unknown> & { detail?: string }
      >(context, request);
      if (!response.ok) {
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `fal.ai returned ${response.status}.`,
        );
      }
      return body;
    },
  });

  return ok(`fal.ai run of ${model} succeeded.`, output);
};

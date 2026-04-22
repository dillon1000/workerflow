import type { WorkflowStepRunner } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchJson } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

interface ImagesResponse {
  data?: { b64_json?: string; url?: string; revised_prompt?: string }[];
  error?: { message?: string };
}

export const run: WorkflowStepRunner = async (context) => {
  const connection = await requireConnection(context);
  const apiKey = await requireSecret(
    context,
    connection,
    "apiKey",
    "OpenAI connection is missing an apiKey secret.",
  );
  const baseUrl =
    String(connection.config.baseUrl ?? "").trim() ||
    "https://api.openai.com/v1";

  const model = String(context.node.data.config.model ?? "gpt-image-1");
  const prompt = renderedStringConfig(context, "prompt");
  const size = String(context.node.data.config.size ?? "1024x1024");

  const output = await executeIdempotentEffect<{
    url: string | null;
    b64: string | null;
    revisedPrompt: string | null;
  }>(context, {
    provider: "openai",
    operation: "image-generation",
    request: { model, prompt, size },
    perform: async (effectKey) => {
      const request = buildHttpRequest(context, {
        method: "POST",
        url: `${baseUrl.replace(/\/$/, "")}/images/generations`,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": effectKey,
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
        }),
        provider: "openai",
        operation: "image-generation",
      });
      const { response, body } = await fetchJson<ImagesResponse>(context, request);
      if (!response.ok) {
        throw new Error(
          body.error?.message ?? `OpenAI images returned ${response.status}.`,
        );
      }

      const first = body.data?.[0];
      return {
        url: first?.url ?? null,
        b64: first?.b64_json ?? null,
        revisedPrompt: first?.revised_prompt ?? null,
      };
    },
  });
  return ok("OpenAI image generated.", output);
};

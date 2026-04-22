import type { WorkflowStepRunner } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { numberConfig, renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchJson } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

interface AnthropicMessageResponse {
  content?: { type: string; text?: string }[];
  usage?: unknown;
  error?: { type?: string; message?: string };
}

export const run: WorkflowStepRunner = async (context) => {
  const connection = await requireConnection(context);
  const apiKey = await requireSecret(
    context,
    connection,
    "apiKey",
    "Anthropic connection is missing an apiKey secret.",
  );

  const model = String(context.node.data.config.model ?? "claude-sonnet-4-6");
  const system = renderedStringConfig(context, "system").trim();
  const prompt = renderedStringConfig(context, "prompt");
  const maxTokens = numberConfig(context, "maxTokens", 1024);

  const output = await executeIdempotentEffect<{
    content: string;
    usage: unknown;
    raw: AnthropicMessageResponse;
  }>(context, {
    provider: "anthropic",
    operation: "messages",
    request: { model, system, prompt, maxTokens },
    perform: async (effectKey) => {
      const request = buildHttpRequest(context, {
        method: "POST",
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Idempotency-Key": effectKey,
        },
        body: JSON.stringify({
          model,
          max_tokens: Number.isFinite(maxTokens) ? maxTokens : 1024,
          system: system || undefined,
          messages: [{ role: "user", content: prompt }],
        }),
        provider: "anthropic",
        operation: "messages",
      });
      const { response, body } = await fetchJson<AnthropicMessageResponse>(
        context,
        request,
      );
      if (!response.ok) {
        throw new Error(
          body.error?.message ?? `Anthropic returned ${response.status}.`,
        );
      }

      return {
        content: (body.content ?? [])
          .filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join("\n"),
        usage: body.usage ?? null,
        raw: body,
      };
    },
  });

  return ok("Anthropic message completed.", output);
};

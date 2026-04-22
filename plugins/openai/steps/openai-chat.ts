import type { WorkflowStepRunner } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { numberConfig, renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchJson } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string; role?: string } }[];
  error?: { message?: string };
  usage?: unknown;
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

  const model = String(context.node.data.config.model ?? "gpt-5.4");
  const system = renderedStringConfig(context, "system").trim();
  const prompt = renderedStringConfig(context, "prompt");
  const temperature = numberConfig(context, "temperature", Number.NaN);

  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const output = await executeIdempotentEffect<{
    content: string;
    usage: unknown;
    raw: ChatCompletionResponse;
  }>(context, {
    provider: "openai",
    operation: "chat-completions",
    request: { model, messages, temperature },
    perform: async (effectKey) => {
      const request = buildHttpRequest(context, {
        method: "POST",
        url: `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": effectKey,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: Number.isFinite(temperature) ? temperature : undefined,
        }),
        provider: "openai",
        operation: "chat-completions",
      });
      const { response, body } = await fetchJson<ChatCompletionResponse>(
        context,
        request,
      );
      if (!response.ok) {
        throw new Error(
          body.error?.message ?? `OpenAI chat returned ${response.status}.`,
        );
      }

      return {
        content: body.choices?.[0]?.message?.content ?? "",
        usage: body.usage ?? null,
        raw: body,
      };
    },
  });
  return ok("OpenAI chat completion succeeded.", output);
};

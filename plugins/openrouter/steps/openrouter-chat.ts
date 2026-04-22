import type { WorkflowStepRunner } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { numberConfig, renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchJson } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
  usage?: unknown;
}

export const run: WorkflowStepRunner = async (context) => {
  const connection = await requireConnection(context);
  const apiKey = await requireSecret(
    context,
    connection,
    "apiKey",
    "OpenRouter connection is missing an apiKey secret.",
  );

  const model = String(context.node.data.config.model ?? "openai/gpt-4o-mini");
  const system = renderedStringConfig(context, "system").trim();
  const prompt = renderedStringConfig(context, "prompt");
  const temperature = numberConfig(context, "temperature", 0.2);

  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = String(connection.config.referer ?? "").trim();
  if (referer) headers["HTTP-Referer"] = referer;
  const title = String(connection.config.title ?? "").trim();
  if (title) headers["X-Title"] = title;

  const output = await executeIdempotentEffect<{
    content: string;
    usage: unknown;
    raw: ChatCompletionResponse;
  }>(context, {
    provider: "openrouter",
    operation: "chat-completions",
    request: { model, messages, temperature },
    perform: async (effectKey) => {
      const request = buildHttpRequest(context, {
        method: "POST",
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          ...headers,
          "X-Workflow-Effect-Key": effectKey,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: Number.isFinite(temperature) ? temperature : undefined,
        }),
        provider: "openrouter",
        operation: "chat-completions",
      });
      const { response, body } = await fetchJson<ChatCompletionResponse>(
        context,
        request,
      );
      if (!response.ok) {
        throw new Error(
          body.error?.message ?? `OpenRouter returned ${response.status}.`,
        );
      }

      return {
        content: body.choices?.[0]?.message?.content ?? "",
        usage: body.usage ?? null,
        raw: body,
      };
    },
  });
  return ok("OpenRouter chat completion succeeded.", output);
};

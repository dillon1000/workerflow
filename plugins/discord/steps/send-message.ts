import type { WorkflowStepRunner } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { booleanConfig, renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchJson } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

interface DiscordWebhookResponse {
  id?: string;
  content?: string;
  error?: { message?: string; code?: number };
}

export const run: WorkflowStepRunner = async (context) => {
  const connection = await requireConnection(context);
  const webhookUrl = await requireSecret(
    context,
    connection,
    "webhookUrl",
    "Discord connection is missing a webhookUrl secret.",
  );

  const content = renderedStringConfig(context, "content");
  const username = String(context.node.data.config.username ?? "").trim();
  const avatarUrl = String(context.node.data.config.avatarUrl ?? "").trim();
  const tts = booleanConfig(context, "tts");

  if (!content) {
    throw new Error("Message content is required.");
  }

  if (content.length > 2000) {
    throw new Error("Message content exceeds Discord's 2000 character limit.");
  }

  const body: Record<string, unknown> = { content, tts };
  if (username) body.username = username;
  if (avatarUrl) body.avatar_url = avatarUrl;

  const output: { messageId: string | null; content: string | null } =
    await executeIdempotentEffect(context, {
    provider: "discord",
    operation: "send-message",
    request: body,
    remoteRef: (result) => result.messageId ?? undefined,
    perform: async (effectKey) => {
      const request = buildHttpRequest(context, {
        method: "POST",
        url: webhookUrl,
        headers: {
          "Content-Type": "application/json",
          "X-Workflow-Effect-Key": effectKey,
        },
        body: JSON.stringify(body),
        provider: "discord",
        operation: "send-message",
      });
      const { response, body: json } = await fetchJson<DiscordWebhookResponse>(
        context,
        request,
      );

      if (!response.ok) {
        throw new Error(
          json.error?.message ?? `Discord webhook returned ${response.status}.`,
        );
      }

      return {
        messageId: json.id ?? null,
        content: json.content ?? null,
      };
    },
    });

  return ok("Discord message sent successfully.", output);
};

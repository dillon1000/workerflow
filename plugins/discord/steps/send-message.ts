import type { WorkflowStepRunner } from "../../runtime";

interface DiscordWebhookResponse {
  id?: string;
  content?: string;
  error?: { message?: string; code?: number };
}

export const run: WorkflowStepRunner = async ({
  getConnection,
  getConnectionSecret,
  node,
  render,
}) => {
  const connection = await getConnection(
    String(node.data.config.connectionAlias ?? ""),
  );
  const webhookUrl = await getConnectionSecret(connection, "webhookUrl");
  if (!webhookUrl) {
    throw new Error("Discord connection is missing a webhookUrl secret.");
  }

  const content = render(String(node.data.config.content ?? ""));
  const username = String(node.data.config.username ?? "").trim();
  const avatarUrl = String(node.data.config.avatarUrl ?? "").trim();
  const tts = node.data.config.tts === "true" || node.data.config.tts === true;

  if (!content) {
    throw new Error("Message content is required.");
  }

  if (content.length > 2000) {
    throw new Error("Message content exceeds Discord's 2000 character limit.");
  }

  const body: Record<string, unknown> = { content, tts };
  if (username) body.username = username;
  if (avatarUrl) body.avatar_url = avatarUrl;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorBody: DiscordWebhookResponse | null = null;
    try {
      errorBody = (await response.json()) as DiscordWebhookResponse;
    } catch {
      // ignore parse errors
    }
    throw new Error(
      errorBody?.error?.message ??
        `Discord webhook returned ${response.status}.`,
    );
  }

  let messageId: string | undefined;
  let responseContent: string | undefined;
  try {
    const json = (await response.json()) as DiscordWebhookResponse;
    messageId = json.id;
    responseContent = json.content;
  } catch {
    // 204 No Content is expected when wait=false
  }

  return {
    detail: "Discord message sent successfully.",
    output: { messageId, content: responseContent },
  };
};

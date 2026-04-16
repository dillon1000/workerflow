import type { WorkflowStepRunner } from "../../runtime";

interface AnthropicMessageResponse {
  content?: { type: string; text?: string }[];
  usage?: unknown;
  error?: { type?: string; message?: string };
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
  const apiKey = await getConnectionSecret(connection, "apiKey");
  if (!apiKey) {
    throw new Error("Anthropic connection is missing an apiKey secret.");
  }

  const model = String(node.data.config.model ?? "claude-sonnet-4-6");
  const system = render(String(node.data.config.system ?? "")).trim();
  const prompt = render(String(node.data.config.prompt ?? ""));
  const maxTokens = Number(node.data.config.maxTokens ?? 1024);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : 1024,
      system: system || undefined,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const body = (await response.json()) as AnthropicMessageResponse;
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `Anthropic returned ${response.status}.`,
    );
  }

  const content = (body.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");

  return {
    detail: "Anthropic message completed.",
    output: { content, usage: body.usage, raw: body },
  };
};

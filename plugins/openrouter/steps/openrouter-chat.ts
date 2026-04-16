import type { WorkflowStepRunner } from "../../runtime";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
  usage?: unknown;
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
    throw new Error("OpenRouter connection is missing an apiKey secret.");
  }

  const model = String(node.data.config.model ?? "openai/gpt-4o-mini");
  const system = render(String(node.data.config.system ?? "")).trim();
  const prompt = render(String(node.data.config.prompt ?? ""));
  const temperature = Number(node.data.config.temperature ?? 0.2);

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

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: Number.isFinite(temperature) ? temperature : undefined,
      }),
    },
  );

  const body = (await response.json()) as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `OpenRouter returned ${response.status}.`,
    );
  }

  const content = body.choices?.[0]?.message?.content ?? "";
  return {
    detail: "OpenRouter chat completion succeeded.",
    output: { content, usage: body.usage, raw: body },
  };
};

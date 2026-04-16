import type { WorkflowStepRunner } from "../../runtime";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string; role?: string } }[];
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
    throw new Error("OpenAI connection is missing an apiKey secret.");
  }
  const baseUrl =
    String(connection.config.baseUrl ?? "").trim() ||
    "https://api.openai.com/v1";

  const model = String(node.data.config.model ?? "gpt-5.4");
  const system = render(String(node.data.config.system ?? "")).trim();
  const prompt = render(String(node.data.config.prompt ?? ""));
  const temperature = Number(node.data.config.temperature);

  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
      body.error?.message ?? `OpenAI chat returned ${response.status}.`,
    );
  }

  const content = body.choices?.[0]?.message?.content ?? "";
  return {
    detail: "OpenAI chat completion succeeded.",
    output: { content, usage: body.usage, raw: body },
  };
};

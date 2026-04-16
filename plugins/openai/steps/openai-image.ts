import type { WorkflowStepRunner } from "../../runtime";

interface ImagesResponse {
  data?: { b64_json?: string; url?: string; revised_prompt?: string }[];
  error?: { message?: string };
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

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/images/generations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: String(node.data.config.model ?? "gpt-image-1"),
        prompt: render(String(node.data.config.prompt ?? "")),
        size: String(node.data.config.size ?? "1024x1024"),
      }),
    },
  );

  const body = (await response.json()) as ImagesResponse;
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `OpenAI images returned ${response.status}.`,
    );
  }

  const first = body.data?.[0];
  return {
    detail: "OpenAI image generated.",
    output: {
      url: first?.url ?? null,
      b64: first?.b64_json ?? null,
      revisedPrompt: first?.revised_prompt ?? null,
    },
  };
};

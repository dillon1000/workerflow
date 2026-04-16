import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({
  getConnection,
  getConnectionSecret,
  node,
  parseMaybeJson,
  render,
}) => {
  const connection = await getConnection(
    String(node.data.config.connectionAlias ?? ""),
  );
  const apiKey = await getConnectionSecret(connection, "apiKey");
  if (!apiKey) {
    throw new Error("fal.ai connection is missing an apiKey secret.");
  }

  const model = String(node.data.config.model ?? "").trim();
  if (!model) {
    throw new Error("fal.ai model is required.");
  }

  const rawInput = render(String(node.data.config.input ?? "{}"));
  const parsed = parseMaybeJson(rawInput);
  const input =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  const response = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as Record<string, unknown> & {
    detail?: string;
  };
  if (!response.ok) {
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : `fal.ai returned ${response.status}.`,
    );
  }

  return {
    detail: `fal.ai run of ${model} succeeded.`,
    output: body,
  };
};

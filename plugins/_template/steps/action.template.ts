import type { WorkflowStepRunner } from "../../runtime";

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
    throw new Error("[Plugin Title] connection is missing an API key secret.");
  }

  const input = render(String(node.data.config.input ?? ""));

  throw new Error(
    `Implement [Plugin Title] [Action Title] in plugins/[plugin-kebab]/steps/[action-kebab].ts. Received input: ${input}`,
  );
};

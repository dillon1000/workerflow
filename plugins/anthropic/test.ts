import type { ConnectionTestRunner } from "../runtime";
import type { WorkerEnv } from "../../worker/lib/env";

export const testConnection: ConnectionTestRunner = async ({
  connection,
  env,
  userId,
}) => {
  const { getSecret } = await import("../../worker/services/secrets");
  const apiKey = await getSecret(
    env as WorkerEnv,
    userId,
    connection.id,
    "apiKey",
  );
  if (!apiKey) {
    return { success: false, message: "Anthropic apiKey secret is missing." };
  }
  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  return response.ok
    ? { success: true, message: "Anthropic connection validated." }
    : {
        success: false,
        message: `Anthropic validation failed with ${response.status}.`,
      };
};

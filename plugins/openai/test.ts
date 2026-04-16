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
    return { success: false, message: "OpenAI apiKey secret is missing." };
  }
  const baseUrl =
    String(connection.config.baseUrl ?? "").trim() ||
    "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return response.ok
    ? { success: true, message: "OpenAI connection validated." }
    : {
        success: false,
        message: `OpenAI validation failed with ${response.status}.`,
      };
};

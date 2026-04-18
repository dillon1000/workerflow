import type { ConnectionTestRunner } from "../runtime";
import type { WorkerEnv } from "../../apps/web/worker/lib/env";

export const testConnection: ConnectionTestRunner = async ({
  connection,
  env,
  userId,
}) => {
  const { getSecret } = await import("../../apps/web/worker/services/secrets");
  const apiKey = await getSecret(
    env as WorkerEnv,
    userId,
    connection.id,
    "apiKey",
  );
  if (!apiKey) {
    return { success: false, message: "OpenRouter apiKey secret is missing." };
  }
  const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return response.ok
    ? { success: true, message: "OpenRouter connection validated." }
    : {
        success: false,
        message: `OpenRouter validation failed with ${response.status}.`,
      };
};

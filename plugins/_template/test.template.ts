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
    return {
      success: false,
      message: "[Plugin Title] connection is missing an API key secret.",
    };
  }

  return {
    success: true,
    message:
      "[Plugin Title] credentials are present. Replace this stub with a real validation request.",
  };
};

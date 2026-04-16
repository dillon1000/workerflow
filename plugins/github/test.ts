import type { ConnectionTestRunner } from "../runtime";
import type { WorkerEnv } from "../../worker/lib/env";

export const testConnection: ConnectionTestRunner = async ({
  connection,
  env,
  userId,
}) => {
  const { getSecret } = await import("../../worker/services/secrets");
  const token = await getSecret(
    env as WorkerEnv,
    userId,
    connection.id,
    "token",
  );
  if (!token) {
    return { success: false, message: "GitHub token secret is missing." };
  }

  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  return response.ok
    ? { success: true, message: "GitHub connection validated." }
    : {
        success: false,
        message: `GitHub validation failed with ${response.status}.`,
      };
};

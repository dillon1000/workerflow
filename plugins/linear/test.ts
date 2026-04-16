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
    return { success: false, message: "Linear apiKey secret is missing." };
  }

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "query Viewer { viewer { id } }" }),
  });

  return response.ok
    ? { success: true, message: "Linear connection validated." }
    : {
        success: false,
        message: `Linear validation failed with ${response.status}.`,
      };
};

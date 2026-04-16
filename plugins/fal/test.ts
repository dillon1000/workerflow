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
    return { success: false, message: "fal.ai apiKey secret is missing." };
  }
  // fal.ai does not expose a lightweight auth-check endpoint. We send a HEAD to
  // the queue root which returns 200 for authenticated requests and 401 otherwise.
  const response = await fetch("https://queue.fal.run/", {
    method: "GET",
    headers: { Authorization: `Key ${apiKey}` },
  });
  return response.status !== 401 && response.status !== 403
    ? { success: true, message: "fal.ai connection validated." }
    : {
        success: false,
        message: `fal.ai validation failed with ${response.status}.`,
      };
};

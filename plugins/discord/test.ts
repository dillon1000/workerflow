import type { ConnectionTestRunner } from "../runtime";
import type { WorkerEnv } from "../../worker/lib/env";

export const testConnection: ConnectionTestRunner = async ({
  connection,
  env,
  userId,
}) => {
  const { getSecret } = await import("../../worker/services/secrets");
  const webhookUrl = await getSecret(
    env as WorkerEnv,
    userId,
    connection.id,
    "webhookUrl",
  );
  if (!webhookUrl) {
    return { success: false, message: "Discord webhook URL is missing." };
  }

  const response = await fetch(webhookUrl, {
    method: "GET",
  });

  if (response.ok) {
    return { success: true, message: "Discord webhook connection validated." };
  }

  if (response.status === 404) {
    return {
      success: false,
      message: "Discord webhook URL not found. Check that the URL is correct.",
    };
  }

  return {
    success: false,
    message: `Discord webhook validation failed with ${response.status}.`,
  };
};

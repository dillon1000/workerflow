import type { ConnectionTestRunner } from "../runtime";
import type { WorkerEnv } from "../../worker/lib/env";
import { executePlanetscaleQuery, parseConnectionString } from "./client";

export const testConnection: ConnectionTestRunner = async ({
  connection,
  env,
  userId,
}) => {
  const { getSecret } = await import("../../worker/services/secrets");
  const connectionString = await getSecret(
    env as WorkerEnv,
    userId,
    connection.id,
    "connectionString",
  );
  if (!connectionString) {
    return {
      success: false,
      message: "PlanetScale connection string is missing.",
    };
  }

  try {
    const parsed = parseConnectionString(connectionString);
    await executePlanetscaleQuery({
      host: parsed.host,
      username: parsed.username,
      password: parsed.password,
      sql: "select 1 as ok",
      params: [],
    });
    return { success: true, message: "PlanetScale connection validated." };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "PlanetScale connection validation failed.",
    };
  }
};

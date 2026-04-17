import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "../lib/schema";

type HyperdriveEnv = {
  HYPERDRIVE: {
    connectionString: string;
  };
};

export async function createDb(env: HyperdriveEnv) {
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
  });
  await client.connect();
  return {
    client,
    db: drizzle(client, { schema }),
  };
}

export async function queryDatabase(env: HyperdriveEnv, sql: string) {
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
  });
  await client.connect();
  try {
    const result = await client.query(sql);
    return result.rows;
  } finally {
    await client.end();
  }
}

import * as schema from "../lib/schema";

type HyperdriveEnv = {
  HYPERDRIVE: {
    connectionString: string;
  };
};

export async function createDb(env: HyperdriveEnv) {
  const [{ drizzle }, { Client }] = await Promise.all([
    import("drizzle-orm/node-postgres"),
    import("pg"),
  ]);
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
  const { Client } = await import("pg");
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

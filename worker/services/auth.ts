import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { WorkerEnv } from "../lib/env";
import {
  accountTable,
  sessionTable,
  userTable,
  verificationTable,
} from "../lib/schema";
import { createDb } from "./database";

export async function createAuth(env: WorkerEnv, request: Request) {
  const origin = new URL(request.url).origin;
  const { client, db } = await createDb(env);
  const auth = betterAuth({
    basePath: "/api/auth",
    baseURL: env.BETTER_AUTH_URL ?? origin,
    trustedOrigins: [origin],
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: userTable,
        session: sessionTable,
        account: accountTable,
        verification: verificationTable,
      },
    }),
  });

  return {
    auth,
    ready: Promise.resolve(),
    close: () => client.end(),
  };
}

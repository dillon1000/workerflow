import { betterAuth } from "better-auth";
import type { WorkerEnv } from "../lib/env";

let schemaReady: Promise<void> | null = null;

export function createAuth(env: WorkerEnv, request: Request) {
  const origin = new URL(request.url).origin;
  const auth = betterAuth({
    basePath: "/api/auth",
    baseURL: env.BETTER_AUTH_URL ?? origin,
    trustedOrigins: [origin],
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    database: env.DB,
  });

  schemaReady ??= auth.$context.then((context) => context.runMigrations());

  return {
    auth,
    ready: schemaReady,
  };
}

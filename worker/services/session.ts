import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { WorkerEnv } from "../lib/env";
import { createAuth } from "./auth";

export async function requireSession(c: Context<{ Bindings: WorkerEnv }>) {
  const { auth, ready } = createAuth(c.env, c.req.raw);
  await ready;
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return session;
}

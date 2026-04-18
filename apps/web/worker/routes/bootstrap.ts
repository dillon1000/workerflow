import type { Hono } from "hono";
import type { WorkerEnv } from "../lib/env";
import { createRepository } from "../services/repository";
import { requireSession } from "../services/session";

export function mountBootstrapRoutes(app: Hono<{ Bindings: WorkerEnv }>) {
  app.get("/api/bootstrap", async (c) => {
    const session = await requireSession(c);
    const repository = await createRepository(c.env);
    return c.json(await repository.getBootstrap(session.user.id));
  });
}

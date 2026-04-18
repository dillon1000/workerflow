import type { Hono } from "hono";
import { z } from "zod";
import type { WorkerEnv } from "../lib/env";
import { withRepository } from "../services/repository";
import { requireSession } from "../services/session";

const graphSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

const createSnippetSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1200).default(""),
  graph: graphSchema,
});

export function mountSnippetRoutes(app: Hono<{ Bindings: WorkerEnv }>) {
  app.get("/api/snippets", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) =>
      c.json(await repository.listSnippets(session.user.id)),
    );
  });

  app.post("/api/snippets", async (c) => {
    const session = await requireSession(c);
    const body = createSnippetSchema.parse(await c.req.json());
    return withRepository(c.env, async (repository) =>
      c.json(
        await repository.createSnippet(session.user.id, {
          name: body.name,
          description: body.description,
          graph: body.graph as never,
        }),
        201,
      ),
    );
  });

  app.delete("/api/snippets/:snippetId", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) => {
      await repository.deleteSnippet(session.user.id, c.req.param("snippetId"));
      return c.json({ success: true });
    });
  });
}

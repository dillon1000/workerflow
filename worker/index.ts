import { Hono } from "hono";
import type { WorkerEnv } from "./lib/env";
import { mountAiGenerateRoutes } from "./routes/ai-generate";
import { mountBootstrapRoutes } from "./routes/bootstrap";
import { mountConnectionRoutes } from "./routes/connections";
import { mountSnippetRoutes } from "./routes/snippets";
import { mountTriggerRoutes } from "./routes/triggers";
import { mountWorkflowRoutes } from "./routes/workflows";
import { createAuth } from "./services/auth";
import { createRepository } from "./services/repository";
import { dispatchScheduledRuns, WorkflowRunner } from "./services/runtime";

const app = new Hono<{ Bindings: WorkerEnv }>();

app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

mountBootstrapRoutes(app);
mountWorkflowRoutes(app);
mountConnectionRoutes(app);
mountTriggerRoutes(app);
mountSnippetRoutes(app);
mountAiGenerateRoutes(app);

app.all("/api/auth/*", async (c) => {
  const { auth, ready, close } = await createAuth(c.env, c.req.raw);
  try {
    await ready;
    return await auth.handler(c.req.raw);
  } finally {
    c.executionCtx.waitUntil(close());
  }
});

app.onError((error, c) => {
  console.error(error);
  return c.json({ message: error.message || "Unexpected error" }, 500);
});

export { WorkflowRunner };

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Static assets binding is not available.", {
      status: 503,
    });
  },
  async scheduled(
    controller: ScheduledController,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ) {
    const repository = await createRepository(env);
    ctx.waitUntil(
      dispatchScheduledRuns(repository, env, controller.scheduledTime),
    );
  },
} satisfies ExportedHandler<WorkerEnv>;

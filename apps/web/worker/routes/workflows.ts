import type { Hono } from "hono";
import { z } from "zod";
import type { WorkerEnv } from "../lib/env";
import { withRepository } from "../services/repository";
import { launchWorkflowRun } from "../services/runtime";
import { requireSession } from "../services/session";

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(120),
  mode: z.enum(["standard", "subworkflow"]).optional(),
  parentWorkflowId: z.string().min(1).optional(),
});

const workflowGraphSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(["trigger", "action", "logic", "data"]),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      data: z.object({
        title: z.string(),
        subtitle: z.string(),
        family: z.enum(["trigger", "action", "logic", "data"]),
        kind: z.string().min(1),
        config: z.record(z.string(), z.unknown()),
        accent: z.string(),
        enabled: z.boolean().optional(),
      }),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string().min(1),
      source: z.string().min(1),
      target: z.string().min(1),
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
      data: z
        .object({
          label: z.string().optional(),
          branch: z.enum(["true", "false", "success"]).optional(),
        })
        .catchall(z.unknown())
        .optional(),
    }),
  ),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(1200).optional(),
  draftGraph: workflowGraphSchema.optional(),
});

const runWorkflowSchema = z.object({
  triggerKind: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export function mountWorkflowRoutes(app: Hono<{ Bindings: WorkerEnv }>) {
  app.get("/api/workflows", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) =>
      c.json(await repository.listWorkflows(session.user.id)),
    );
  });

  app.post("/api/workflows", async (c) => {
    const session = await requireSession(c);
    const body = createWorkflowSchema.parse(await c.req.json());
    return withRepository(c.env, async (repository) =>
      c.json(
        await repository.createWorkflow(
          session.user.id,
          body.name,
          body.mode ?? "standard",
          body.parentWorkflowId,
        ),
        201,
      ),
    );
  });

  app.get("/api/workflows/:workflowId", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) => {
      const workflow = await repository.getWorkflow(
        session.user.id,
        c.req.param("workflowId"),
      );
      if (!workflow) return c.json({ message: "Workflow not found." }, 404);
      return c.json(workflow);
    });
  });

  app.patch("/api/workflows/:workflowId", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) => {
      const workflow = await repository.updateWorkflow(
        session.user.id,
        c.req.param("workflowId"),
        updateWorkflowSchema.parse(await c.req.json()),
      );
      return c.json(workflow);
    });
  });

  app.delete("/api/workflows/:workflowId", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) => {
      await repository.deleteWorkflow(session.user.id, c.req.param("workflowId"));
      return c.json({ success: true });
    });
  });

  app.post("/api/workflows/:workflowId/publish", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) =>
      c.json(
        await repository.publishWorkflow(
          session.user.id,
          c.req.param("workflowId"),
        ),
      ),
    );
  });

  app.post("/api/workflows/:workflowId/run", async (c) => {
    const session = await requireSession(c);
    const body = await c.req
      .json()
      .then((payload) => runWorkflowSchema.parse(payload))
      .catch(() => ({ triggerKind: "button", payload: {} }));
    return withRepository(c.env, async (repository) => {
      const workflow = await repository.getWorkflow(
        session.user.id,
        c.req.param("workflowId"),
      );
      if (!workflow) return c.json({ message: "Workflow not found." }, 404);
      if (workflow.mode === "subworkflow") {
        return c.json(
          { message: "Sub-workflows can only run from a parent workflow." },
          400,
        );
      }
      return c.json(
        await launchWorkflowRun(
          repository,
          c.env,
          workflow,
          session.user.id,
          body.triggerKind ?? "button",
          body.payload ?? {},
        ),
        202,
      );
    });
  });

  app.get("/api/workflows/:workflowId/runs", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) =>
      c.json(
        await repository.listRuns(session.user.id, c.req.param("workflowId")),
      ),
    );
  });

  app.get("/api/runs/:runId", async (c) => {
    const session = await requireSession(c);
    return withRepository(c.env, async (repository) => {
      const run = await repository.getRun(session.user.id, c.req.param("runId"));
      if (!run) return c.json({ message: "Run not found." }, 404);
      return c.json(run);
    });
  });
}

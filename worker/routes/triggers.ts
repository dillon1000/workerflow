import type { Hono } from "hono";
import type { WorkflowGraph, WorkflowNode } from "../../src/lib/workflow/types";
import type { WorkerEnv } from "../lib/env";
import { createRepository } from "../services/repository";
import { getTriggerHandler } from "../services/plugin-runtime";
import { launchWorkflowRun } from "../services/runtime";

function parseBody(body: string) {
  if (!body) return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { rawBody: body };
  }
}

function triggerNode(graph: WorkflowGraph, kind: WorkflowNode["data"]["kind"]) {
  return graph.nodes.find((node) => node.data.kind === kind);
}

export function mountTriggerRoutes(app: Hono<{ Bindings: WorkerEnv }>) {
  app.post("/api/triggers/webhook/:workflowId/:triggerId", async (c) => {
    const repository = await createRepository(c.env);
    const workflows = await repository.listPublishedWorkflows();
    const match = workflows.find(
      (entry) => entry.workflow.id === c.req.param("workflowId"),
    );
    if (!match?.workflow.publishedVersionId) {
      return c.json({ message: "Workflow not found." }, 404);
    }
    const version = await repository.getVersion(
      match.userId,
      match.workflow.publishedVersionId,
    );
    const graph = version?.definition;
    const node = graph?.nodes.find(
      (candidate) =>
        candidate.id === c.req.param("triggerId") &&
        candidate.data.kind === "webhook",
    );
    if (!graph || !node)
      return c.json({ message: "Webhook trigger not found." }, 404);
    const secret = String(node.data.config.secretKey ?? "");
    const provided =
      c.req.header("x-workflow-secret") ??
      c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (secret && secret !== provided)
      return c.json({ message: "Webhook secret verification failed." }, 401);
    const raw = await c.req.text();
    return c.json(
      await launchWorkflowRun(
        repository,
        c.env,
        match.workflow,
        match.userId,
        "webhook",
        parseBody(raw),
      ),
      202,
    );
  });

  app.post("/api/triggers/:kind", async (c) => {
    const kind = c.req.param("kind");
    const handler = getTriggerHandler(kind);
    if (!handler) {
      return c.json({ message: `Trigger "${kind}" is not registered.` }, 404);
    }

    const repository = await createRepository(c.env);
    const raw = await c.req.text();
    const payload = await Promise.resolve(
      handler.preparePayload?.({
        rawBody: raw,
        payload: parseBody(raw),
        headers: new Headers(c.req.raw.headers),
      }) ?? parseBody(raw),
    );
    const workflows = await repository.listPublishedWorkflows();

    for (const entry of workflows) {
      if (!entry.workflow.publishedVersionId) continue;
      const version = await repository.getVersion(
        entry.userId,
        entry.workflow.publishedVersionId,
      );
      const node = version?.definition
        ? triggerNode(version.definition, kind)
        : null;
      if (!node || !handler.matches(node, payload)) continue;

      try {
        await handler.verify?.({
          env: c.env,
          repository,
          userId: entry.userId,
          node,
          rawBody: raw,
          payload,
          headers: new Headers(c.req.raw.headers),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Trigger verification failed.";
        const status = /signature verification failed/i.test(message)
          ? 401
          : 500;
        return c.json({ message }, status);
      }

      return c.json(
        await launchWorkflowRun(
          repository,
          c.env,
          entry.workflow,
          entry.userId,
          kind,
          payload,
        ),
        202,
      );
    }

    return c.json(
      { message: `No published ${kind} workflow matched this event.` },
      404,
    );
  });
}

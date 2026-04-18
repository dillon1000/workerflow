import type { Hono } from "hono";
import { z } from "zod";
import type { WorkerEnv } from "../lib/env";
import { createRepository } from "../services/repository";
import {
  getConnectionTestRunner,
  isKnownConnectionProvider,
} from "../services/plugin-runtime";
import { deleteSecret, storeSecret } from "../services/secrets";
import { requireSession } from "../services/session";

const connectionSchema = z.object({
  provider: z.string().min(1).refine(isKnownConnectionProvider, {
    message: "Unknown connection provider.",
  }),
  alias: z.string().min(1),
  label: z.string().min(1),
  notes: z.string().default(""),
  config: z.record(z.string(), z.string()).default({}),
  secretValues: z.record(z.string(), z.string()).optional(),
});

const connectionPatchSchema = z.object({
  alias: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  notes: z.string().optional(),
  status: z.enum(["connected", "attention", "not-configured"]).optional(),
  config: z.record(z.string(), z.string()).optional(),
  secretValues: z.record(z.string(), z.string()).optional(),
});

async function performConnectionTest(
  env: WorkerEnv,
  userId: string,
  connection: Awaited<
    ReturnType<Awaited<ReturnType<typeof createRepository>>["getConnection"]>
  >,
) {
  if (!connection) {
    return { success: false, message: "Connection not found." };
  }

  const testConnection = getConnectionTestRunner(connection.provider);
  if (testConnection) {
    return testConnection({ env, userId, connection });
  }

  if (connection.provider === "workers-ai") {
    return env.AI
      ? { success: true, message: "Workers AI binding is available." }
      : { success: false, message: "Workers AI binding is missing." };
  }

  return { success: true, message: "Connection stored." };
}

export function mountConnectionRoutes(app: Hono<{ Bindings: WorkerEnv }>) {
  app.get("/api/connections", async (c) => {
    const session = await requireSession(c);
    const repository = await createRepository(c.env);
    return c.json(await repository.listConnections(session.user.id));
  });

  app.post("/api/connections", async (c) => {
    const session = await requireSession(c);
    const repository = await createRepository(c.env);
    const body = connectionSchema.parse(await c.req.json());
    const connection = await repository.createConnection(session.user.id, {
      provider: body.provider,
      alias: body.alias,
      label: body.label,
      notes: body.notes,
      status: "not-configured",
      config: body.config,
    });
    for (const [keyName, value] of Object.entries(body.secretValues ?? {})) {
      await storeSecret(c.env, session.user.id, connection.id, keyName, value);
      await repository.upsertSecretMetadata(
        session.user.id,
        connection.id,
        connection.provider,
        keyName,
        true,
      );
    }
    return c.json(
      await repository.getConnection(session.user.id, connection.id),
      201,
    );
  });

  app.patch("/api/connections/:connectionId", async (c) => {
    const session = await requireSession(c);
    const repository = await createRepository(c.env);
    const body = connectionPatchSchema.parse(await c.req.json());
    const connection = await repository.updateConnection(
      session.user.id,
      c.req.param("connectionId"),
      body,
    );
    for (const [keyName, value] of Object.entries(body.secretValues ?? {})) {
      await storeSecret(c.env, session.user.id, connection.id, keyName, value);
      await repository.upsertSecretMetadata(
        session.user.id,
        connection.id,
        connection.provider,
        keyName,
        true,
      );
    }
    return c.json(
      await repository.getConnection(session.user.id, connection.id),
    );
  });

  app.post("/api/connections/:connectionId/test", async (c) => {
    const session = await requireSession(c);
    const repository = await createRepository(c.env);
    const connection = await repository.getConnection(
      session.user.id,
      c.req.param("connectionId"),
    );
    const result = await performConnectionTest(
      c.env,
      session.user.id,
      connection,
    );
    if (connection) {
      await repository.updateConnection(session.user.id, connection.id, {
        status: result.success ? "connected" : "attention",
      });
    }
    return c.json(result);
  });

  app.delete("/api/connections/:connectionId", async (c) => {
    const session = await requireSession(c);
    const repository = await createRepository(c.env);
    const connection = await repository.getConnection(
      session.user.id,
      c.req.param("connectionId"),
    );
    if (connection) {
      for (const keyName of connection.secretKeys) {
        await deleteSecret(c.env, session.user.id, connection.id, keyName);
      }
      await repository.deleteConnection(session.user.id, connection.id);
    }
    return c.json({ success: true });
  });
}

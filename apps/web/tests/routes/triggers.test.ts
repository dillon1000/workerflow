import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConnectionDefinition,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowNode,
  WorkflowVersion,
} from "../../src/lib/workflow/types";
import { storeSecret } from "../../worker/services/secrets";

const mocks = vi.hoisted(() => {
  const repository = {
    getConnectionByAlias: vi.fn(),
    getVersion: vi.fn(),
    listPublishedWorkflows: vi.fn(),
  };

  return {
    launchWorkflowRun: vi.fn(),
    repository,
  };
});

vi.mock("../../worker/services/repository", () => ({
  createRepository: vi.fn(),
  withRepository: (
    _env: unknown,
    callback: (repository: typeof mocks.repository) => Promise<unknown>,
  ) => callback(mocks.repository),
}));

vi.mock("../../worker/services/runtime", () => ({
  launchWorkflowRun: mocks.launchWorkflowRun,
}));

import { mountTriggerRoutes } from "../../worker/routes/triggers";

function createKvNamespace() {
  const values = new Map<string, string>();

  return {
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    },
  };
}

function createConnection(
  overrides: Partial<ConnectionDefinition> = {},
): ConnectionDefinition {
  return {
    id: "conn-1",
    provider: "github",
    alias: "primary",
    label: "Primary",
    status: "connected",
    config: {},
    notes: "",
    secretKeys: [],
    hasSecrets: true,
    updatedAt: "2026-04-20T00:00:00.000Z",
    createdAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

function createWorkflow(
  overrides: Partial<WorkflowDefinition> = {},
): WorkflowDefinition {
  const graph: WorkflowGraph = {
    nodes: [],
    edges: [],
  };

  return {
    id: "workflow-1",
    name: "Trigger Test",
    slug: "trigger-test",
    description: "",
    mode: "standard",
    status: "published",
    draftGraph: graph,
    publishedVersionId: "ver-1",
    lastPublishedAt: "2026-04-20T00:00:00.000Z",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    metrics: {
      successRate: 0,
      medianDurationMs: 0,
      totalRuns: 0,
      activeTriggers: [],
    },
    ...overrides,
  };
}

function createVersion(node: WorkflowNode): WorkflowVersion {
  return {
    id: "ver-1",
    workflowId: "workflow-1",
    version: 1,
    createdAt: "2026-04-20T00:00:00.000Z",
    definition: {
      nodes: [node],
      edges: [],
    },
  };
}

function createTriggerNode(
  kind: string,
  config: Record<string, unknown>,
): WorkflowNode {
  return {
    id: `${kind}-node`,
    type: "trigger",
    position: { x: 0, y: 0 },
    data: {
      title: `${kind} trigger`,
      subtitle: "",
      family: "trigger",
      kind,
      accent: "from-amber-400 via-orange-400 to-orange-500",
      config,
    },
  };
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signed))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

function createApp() {
  const app = new Hono();
  mountTriggerRoutes(app as never);
  return app;
}

describe("trigger routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.listPublishedWorkflows.mockResolvedValue([
      {
        userId: "user-1",
        workflow: createWorkflow(),
      },
    ]);
    mocks.launchWorkflowRun.mockResolvedValue({
      id: "run-1",
      status: "queued",
    });
  });

  it("accepts a workflow-specific GitHub webhook when the signature and filters match", async () => {
    const githubNode = createTriggerNode("github", {
      event: "issues",
      action: "opened",
      repository: "owner/repo",
      connectionAlias: "primary",
    });
    const rawBody = JSON.stringify({
      action: "opened",
      repository: { full_name: "owner/repo" },
    });
    const secret = "github-secret";
    const env = {
      SECRETS_KV: createKvNamespace(),
      SECRETS_KEY: "",
    };

    mocks.repository.getVersion.mockResolvedValue(createVersion(githubNode));
    mocks.repository.getConnectionByAlias.mockResolvedValue(
      createConnection({ provider: "github" }),
    );
    await storeSecret(env as never, "user-1", "conn-1", "webhookSecret", secret);

    const app = createApp();
    const response = await app.request(
      "/api/triggers/github/workflow-1/github-node",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-github-event": "issues",
          "x-hub-signature-256": `sha256=${await hmac(secret, rawBody)}`,
        },
        body: rawBody,
      },
      env as never,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      id: "run-1",
      status: "queued",
    });
    expect(mocks.launchWorkflowRun).toHaveBeenCalledWith(
      mocks.repository,
      env,
      expect.objectContaining({ id: "workflow-1" }),
      "user-1",
      "github",
      expect.objectContaining({
        action: "opened",
        githubEvent: "issues",
      }),
    );
  });

  it("rejects a GitHub webhook with an invalid signature", async () => {
    const githubNode = createTriggerNode("github", {
      event: "issues",
      action: "opened",
      repository: "owner/repo",
      connectionAlias: "primary",
    });
    const env = {
      SECRETS_KV: createKvNamespace(),
      SECRETS_KEY: "",
    };

    mocks.repository.getVersion.mockResolvedValue(createVersion(githubNode));
    mocks.repository.getConnectionByAlias.mockResolvedValue(
      createConnection({ provider: "github" }),
    );
    await storeSecret(
      env as never,
      "user-1",
      "conn-1",
      "webhookSecret",
      "github-secret",
    );

    const app = createApp();
    const response = await app.request(
      "/api/triggers/github/workflow-1/github-node",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-github-event": "issues",
          "x-hub-signature-256": "sha256=bad",
        },
        body: JSON.stringify({
          action: "opened",
          repository: { full_name: "owner/repo" },
        }),
      },
      env as never,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "GitHub signature verification failed.",
    });
    expect(mocks.launchWorkflowRun).not.toHaveBeenCalled();
  });

  it("returns 404 when a published GitHub trigger does not match the incoming event", async () => {
    const githubNode = createTriggerNode("github", {
      event: "issues",
      action: "opened",
      repository: "owner/repo",
      connectionAlias: "primary",
    });
    mocks.repository.getVersion.mockResolvedValue(createVersion(githubNode));

    const app = createApp();
    const response = await app.request(
      "/api/triggers/github/workflow-1/github-node",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-github-event": "pull_request",
        },
        body: JSON.stringify({
          action: "opened",
          repository: { full_name: "owner/repo" },
        }),
      },
      { SECRETS_KV: createKvNamespace(), SECRETS_KEY: "" } as never,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      message: "Published github trigger did not match this event.",
    });
    expect(mocks.launchWorkflowRun).not.toHaveBeenCalled();
  });

  it("accepts a workflow-specific Linear webhook when signature and team filters match", async () => {
    const linearNode = createTriggerNode("linear", {
      event: "Issue",
      action: "create",
      teamKey: "eng",
      connectionAlias: "primary",
    });
    const rawBody = JSON.stringify({
      type: "Issue",
      action: "create",
      webhookTimestamp: "1713657600",
      data: {
        team: {
          key: "ENG",
        },
      },
    });
    const secret = "linear-secret";
    const env = {
      SECRETS_KV: createKvNamespace(),
      SECRETS_KEY: "",
    };

    mocks.repository.getVersion.mockResolvedValue(createVersion(linearNode));
    mocks.repository.getConnectionByAlias.mockResolvedValue(
      createConnection({ provider: "linear" }),
    );
    await storeSecret(env as never, "user-1", "conn-1", "webhookSecret", secret);

    const app = createApp();
    const response = await app.request(
      "/api/triggers/linear/workflow-1/linear-node",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "linear-signature": await hmac(secret, `1713657600.${rawBody}`),
        },
        body: rawBody,
      },
      env as never,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      id: "run-1",
      status: "queued",
    });
    expect(mocks.launchWorkflowRun).toHaveBeenCalledWith(
      mocks.repository,
      env,
      expect.objectContaining({ id: "workflow-1" }),
      "user-1",
      "linear",
      expect.objectContaining({
        type: "Issue",
        action: "create",
      }),
    );
  });

  it("enforces the shared secret for generic webhook triggers", async () => {
    const webhookNode = createTriggerNode("webhook", {
      pathSuffix: "",
      secretKey: "whsec_123",
    });
    mocks.repository.getVersion.mockResolvedValue(createVersion(webhookNode));

    const app = createApp();
    const rejected = await app.request(
      "/api/triggers/webhook/workflow-1/webhook-node",
      {
        method: "POST",
        body: JSON.stringify({ ok: false }),
      },
      { SECRETS_KV: createKvNamespace(), SECRETS_KEY: "" } as never,
    );

    expect(rejected.status).toBe(401);

    const accepted = await app.request(
      "/api/triggers/webhook/workflow-1/webhook-node",
      {
        method: "POST",
        headers: {
          authorization: "Bearer whsec_123",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ok: true }),
      },
      { SECRETS_KV: createKvNamespace(), SECRETS_KEY: "" } as never,
    );

    expect(accepted.status).toBe(202);
    expect(mocks.launchWorkflowRun).toHaveBeenLastCalledWith(
      mocks.repository,
      expect.anything(),
      expect.objectContaining({ id: "workflow-1" }),
      "user-1",
      "webhook",
      { ok: true },
    );
  });
});

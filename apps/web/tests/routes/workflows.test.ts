import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowDefinition, WorkflowGraph } from "../../src/lib/workflow/types";
import type { Repository } from "../../worker/services/repository";

const mocks = vi.hoisted(() => ({
  launchWorkflowRun: vi.fn(),
  repository: null as Repository | null,
  session: {
    user: {
      id: "user-1",
    },
  },
}));

vi.mock("../../worker/services/session", () => ({
  requireSession: vi.fn(async () => mocks.session),
}));

vi.mock("../../worker/services/runtime", () => ({
  launchWorkflowRun: mocks.launchWorkflowRun,
}));

vi.mock("../../worker/services/repository", () => ({
  withRepository: (_env: unknown, callback: (repository: Repository) => Promise<unknown>) =>
    callback(mocks.repository as Repository),
}));

import { mountWorkflowRoutes } from "../../worker/routes/workflows";

function createWorkflow(
  overrides: Partial<WorkflowDefinition> = {},
): WorkflowDefinition {
  return {
    id: "workflow-1",
    name: "Workflow One",
    slug: "workflow-one",
    description: "",
    mode: "standard",
    status: "draft",
    draftGraph: { nodes: [], edges: [] },
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

function createRepository(): Repository & {
  store: Map<string, WorkflowDefinition>;
} {
  const store = new Map<string, WorkflowDefinition>();
  const workflow = createWorkflow();
  store.set(workflow.id, workflow);

  return {
    store,
    getBootstrap: vi.fn(),
    listWorkflows: vi.fn(async () => Array.from(store.values())),
    getWorkflow: vi.fn(async (_userId: string, workflowId: string) => {
      return store.get(workflowId) ?? null;
    }),
    getVersion: vi.fn(),
    createWorkflow: vi.fn(async (_userId: string, name: string, mode = "standard", parentWorkflowId?: string) => {
      const created = createWorkflow({
        id: `workflow-${store.size + 1}`,
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        mode,
        parentWorkflowId,
      });
      store.set(created.id, created);
      return created;
    }),
    listSubworkflows: vi.fn(),
    getPublishedSubworkflow: vi.fn(),
    updateWorkflow: vi.fn(
      async (_userId: string, workflowId: string, patch: Partial<WorkflowDefinition>) => {
        const current = store.get(workflowId);
        if (!current) {
          throw new Error("Workflow not found.");
        }
        const next = { ...current, ...patch };
        store.set(workflowId, next);
        return next;
      },
    ),
    deleteWorkflow: vi.fn(async (_userId: string, workflowId: string) => {
      store.delete(workflowId);
    }),
    publishWorkflow: vi.fn(async (_userId: string, workflowId: string) => {
      const current = store.get(workflowId);
      if (!current) {
        throw new Error("Workflow not found.");
      }
      const next = {
        ...current,
        status: "published" as const,
        publishedVersionId: `version-${workflowId}`,
        lastPublishedAt: "2026-04-21T00:00:00.000Z",
      };
      store.set(workflowId, next);
      return next;
    }),
    listRuns: vi.fn(),
    getRun: vi.fn(),
    createRun: vi.fn(),
    updateRun: vi.fn(),
    listConnections: vi.fn(),
    getConnectionByAlias: vi.fn(),
    getConnection: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    upsertSecretMetadata: vi.fn(),
    replacePublishedTriggerIndex: vi.fn(),
    listPublishedWorkflows: vi.fn(),
    markScheduleDispatch: vi.fn(),
    claimScheduleDispatch: vi.fn(),
    listSnippets: vi.fn(),
    createSnippet: vi.fn(),
    deleteSnippet: vi.fn(),
    close: vi.fn(async () => {}),
  } as Repository & { store: Map<string, WorkflowDefinition> };
}

function createGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: {
          title: "Button press",
          subtitle: "",
          family: "trigger",
          kind: "button",
          config: { buttonLabel: "Run workflow" },
          accent: "from-amber-400 via-orange-400 to-orange-500",
        },
      },
    ],
    edges: [],
  };
}

function createApp(repository: Repository) {
  mocks.repository = repository;
  const app = new Hono();
  mountWorkflowRoutes(app as never);
  return {
    app,
    env: {},
    repository,
  };
}

describe("workflow routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a draft graph and returns it on subsequent load", async () => {
    const repository = createRepository();
    const app = createApp(repository);
    const graph = createGraph();

    const patchResponse = await app.app.request(
      "/api/workflows/workflow-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Saved Workflow",
          draftGraph: graph,
        }),
      },
      app.env as never,
    );

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      id: "workflow-1",
      name: "Saved Workflow",
      draftGraph: graph,
    });

    const getResponse = await app.app.request(
      "/api/workflows/workflow-1",
      { method: "GET" },
      app.env as never,
    );

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      id: "workflow-1",
      name: "Saved Workflow",
      draftGraph: graph,
    });
  });

  it("publishes a workflow and returns the published version metadata", async () => {
    const repository = createRepository();
    const app = createApp(repository);

    const response = await app.app.request(
      "/api/workflows/workflow-1/publish",
      { method: "POST" },
      app.env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "workflow-1",
      status: "published",
      publishedVersionId: "version-workflow-1",
    });
  });

  it("rejects manual runs for subworkflows", async () => {
    const repository = createRepository();
    repository.store.set(
      "workflow-1",
      createWorkflow({
        id: "workflow-1",
        mode: "subworkflow",
      }),
    );
    const app = createApp(repository);

    const response = await app.app.request(
      "/api/workflows/workflow-1/run",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          triggerKind: "button",
          payload: {},
        }),
      },
      app.env as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Sub-workflows can only run from a parent workflow.",
    });
    expect(mocks.launchWorkflowRun).not.toHaveBeenCalled();
  });

  it("launches standard workflows with the provided trigger payload", async () => {
    const repository = createRepository();
    const app = createApp(repository);
    mocks.launchWorkflowRun.mockResolvedValueOnce({
      id: "run-1",
      status: "queued",
    });

    const response = await app.app.request(
      "/api/workflows/workflow-1/run",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          triggerKind: "github",
          payload: { action: "opened" },
        }),
      },
      app.env as never,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      id: "run-1",
      status: "queued",
    });
    expect(mocks.launchWorkflowRun).toHaveBeenCalledWith(
      repository,
      app.env,
      expect.objectContaining({ id: "workflow-1" }),
      "user-1",
      "github",
      { action: "opened" },
    );
  });
});

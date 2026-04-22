import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowDefinition, WorkflowGraph } from "../../src/lib/workflow/types";

const mocks = vi.hoisted(() => {
  const repository = {
    createRun: vi.fn(),
    getVersion: vi.fn(),
    getWorkflow: vi.fn(),
    updateRun: vi.fn(),
  };

  return {
    execution: {
      executeWorkflowGraph: vi.fn(),
      launchWorkflowRun: vi.fn(),
    },
    repository,
  };
});

vi.mock("../../worker/services/repository", () => ({
  withRepository: (_env: unknown, callback: (repository: typeof mocks.repository) => Promise<unknown>) =>
    callback(mocks.repository),
}));

vi.mock("../../worker/services/runtime/execution", () => ({
  executeWorkflowGraph: mocks.execution.executeWorkflowGraph,
  launchWorkflowRun: mocks.execution.launchWorkflowRun,
}));

import { WorkflowRunner, launchWorkflowRun } from "../../worker/services/runtime";

function createWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const graph: WorkflowGraph = {
    nodes: [],
    edges: [],
  };

  return {
    id: "workflow-1",
    name: "Runner Test",
    slug: "runner-test",
    description: "",
    mode: "standard",
    status: "draft",
    draftGraph: graph,
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

describe("workflow runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates launchWorkflowRun to the execution service", async () => {
    const repository = { createRun: vi.fn(), updateRun: vi.fn() };
    const workflow = createWorkflow({ status: "published", publishedVersionId: "ver-1" });
    const payload = { action: "opened" };

    mocks.execution.launchWorkflowRun.mockResolvedValueOnce({ id: "run-1" });

    await expect(
      launchWorkflowRun(
        repository as never,
        {
          WORKFLOW_RUNNER: {
            create: vi.fn(),
          },
        } as never,
        workflow,
        "user-1",
        "github",
        payload,
      ),
    ).resolves.toEqual({ id: "run-1" });

    expect(mocks.execution.launchWorkflowRun).toHaveBeenCalledWith(
      repository,
      expect.objectContaining({
        WORKFLOW_RUNNER: expect.objectContaining({
          create: expect.any(Function),
        }),
      }),
      workflow,
      "user-1",
      "github",
      payload,
    );
  });

  it("runs WorkflowRunner and persists the final result", async () => {
    mocks.repository.getWorkflow.mockResolvedValueOnce(createWorkflow());
    mocks.execution.executeWorkflowGraph.mockResolvedValueOnce({
      status: "complete",
      steps: [
        {
          id: "step-1",
          runId: "run-integration",
          nodeId: "node-1",
          nodeTitle: "Receive webhook",
          kind: "webhook",
          status: "complete",
          detail: "accepted",
          startedAt: "2026-04-20T00:00:00.000Z",
          finishedAt: "2026-04-20T00:00:00.000Z",
          durationMs: 0,
          output: { ok: true },
        },
      ],
      output: { ok: true },
    });

    const runner = new WorkflowRunner(
      {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
        exports: {},
        props: {},
      } as never,
      {
        HYPERDRIVE: {
          connectionString: "",
        },
      } as never,
    );

    await runner.run(
      {
        payload: {
          runId: "run-integration",
          userId: "user-1",
          workflowId: "workflow-1",
          triggerKind: "github",
          payload: { issue: 123 },
        },
      } as never,
      {
        do: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
        sleep: vi.fn(async () => {}),
      } as never,
    );

    expect(mocks.repository.getWorkflow).toHaveBeenCalledWith(
      "user-1",
      "workflow-1",
    );
    expect(mocks.execution.executeWorkflowGraph).toHaveBeenCalled();
    expect(mocks.repository.updateRun).toHaveBeenCalledWith(
      "user-1",
      "run-integration",
      expect.objectContaining({
        status: "complete",
      }),
    );
  });
});

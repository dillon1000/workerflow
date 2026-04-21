import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowDefinition, WorkflowNode, WorkflowVersion } from "../../src/lib/workflow/types";
import type { Repository } from "../../worker/services/repository";
import { dispatchScheduledRuns } from "../../worker/services/runtime/scheduling";

const mocks = vi.hoisted(() => ({
  launchWorkflowRun: vi.fn(),
}));

vi.mock("../../worker/services/runtime/execution", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../worker/services/runtime/execution")>();
  return {
    ...actual,
    launchWorkflowRun: mocks.launchWorkflowRun,
  };
});

function createScheduleNode(cron: string): WorkflowNode {
  return {
    id: "schedule-node",
    type: "trigger",
    position: { x: 0, y: 0 },
    data: {
      title: "Schedule",
      subtitle: "",
      family: "trigger",
      kind: "schedule",
      accent: "from-amber-400 via-orange-400 to-orange-500",
      config: { cron, timezone: "UTC" },
    },
  };
}

function createWorkflow(
  id: string,
  publishedVersionId = `${id}-version`,
): WorkflowDefinition {
  return {
    id,
    name: `Workflow ${id}`,
    slug: id,
    description: "",
    mode: "standard",
    status: "published",
    draftGraph: { nodes: [], edges: [] },
    publishedVersionId,
    lastPublishedAt: "2026-04-20T00:00:00.000Z",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    metrics: {
      successRate: 0,
      medianDurationMs: 0,
      totalRuns: 0,
      activeTriggers: [],
    },
  };
}

function createVersion(
  workflowId: string,
  node?: WorkflowNode,
): WorkflowVersion {
  return {
    id: `${workflowId}-version`,
    workflowId,
    version: 1,
    createdAt: "2026-04-20T00:00:00.000Z",
    definition: {
      nodes: node ? [node] : [],
      edges: [],
    },
  };
}

function createRepositoryMock(
  overrides: Partial<Repository> = {},
): Repository {
  return {
    getBootstrap: vi.fn(),
    listWorkflows: vi.fn(),
    getWorkflow: vi.fn(),
    getVersion: vi.fn(),
    createWorkflow: vi.fn(),
    listSubworkflows: vi.fn(),
    getPublishedSubworkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    publishWorkflow: vi.fn(),
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
    ...overrides,
  } as Repository;
}

describe("scheduled workflow dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("launches matching schedules once per claimed minute", async () => {
    const matchingWorkflow = createWorkflow("matching");
    const skippedWorkflow = createWorkflow("skipped");
    const repository = createRepositoryMock({
      listPublishedWorkflows: vi.fn(async () => [
        { userId: "user-1", workflow: matchingWorkflow },
        { userId: "user-2", workflow: skippedWorkflow },
      ]),
      getVersion: vi.fn(async (_userId: string, versionId: string) => {
        if (versionId === "matching-version") {
          return createVersion("matching", createScheduleNode("15 9 * * *"));
        }
        if (versionId === "skipped-version") {
          return createVersion("skipped", createScheduleNode("0 0 * * *"));
        }
        return null;
      }),
      claimScheduleDispatch: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    });

    const now = Date.UTC(2026, 3, 21, 9, 15, 0);
    await dispatchScheduledRuns(
      repository,
      {
        WORKFLOW_RUNNER: {
          create: vi.fn(),
        },
      } as never,
      now,
    );

    expect(repository.claimScheduleDispatch).toHaveBeenCalledWith(
      "matching",
      "schedule-node",
      "2026-04-21T09:15",
    );
    expect(mocks.launchWorkflowRun).toHaveBeenCalledTimes(1);
    expect(mocks.launchWorkflowRun).toHaveBeenCalledWith(
      repository,
      expect.anything(),
      matchingWorkflow,
      "user-1",
      "schedule",
      {
        source: "schedule",
        scheduledAt: "2026-04-21T09:15:00.000Z",
      },
    );
  });

  it("skips invalid or non-matching cron expressions", async () => {
    const repository = createRepositoryMock({
      listPublishedWorkflows: vi.fn(async () => [
        { userId: "user-1", workflow: createWorkflow("invalid") },
        { userId: "user-2", workflow: createWorkflow("missing-node") },
      ]),
      getVersion: vi.fn(async (_userId: string, versionId: string) => {
        if (versionId === "invalid-version") {
          return createVersion("invalid", createScheduleNode("not a cron"));
        }
        if (versionId === "missing-node-version") {
          return createVersion("missing-node");
        }
        return null;
      }),
      claimScheduleDispatch: vi.fn(),
    });

    await dispatchScheduledRuns(
      repository,
      {
        WORKFLOW_RUNNER: {
          create: vi.fn(),
        },
      } as never,
      Date.UTC(2026, 3, 21, 9, 15, 0),
    );

    expect(repository.claimScheduleDispatch).not.toHaveBeenCalled();
    expect(mocks.launchWorkflowRun).not.toHaveBeenCalled();
  });
});

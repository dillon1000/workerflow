import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowNode,
  WorkflowRun,
} from "../../src/lib/workflow/types";
import type { Repository } from "../../worker/services/repository";
import { executeWorkflowGraph } from "../../worker/services/runtime/execution";

function createNode(
  id: string,
  kind: string,
  family: WorkflowNode["data"]["family"],
  config: Record<string, unknown> = {},
  title = kind,
): WorkflowNode {
  return {
    id,
    type: family,
    position: { x: 0, y: 0 },
    data: {
      title,
      subtitle: "",
      family,
      kind,
      config,
      accent: "from-stone-900 via-stone-800 to-stone-700",
    },
  };
}

function createGraph(nodes: WorkflowNode[], edges: WorkflowGraph["edges"]) {
  return { nodes, edges };
}

function createWorkflow(
  overrides: Partial<Pick<WorkflowDefinition, "id" | "name" | "mode">> = {},
): Pick<WorkflowDefinition, "id" | "name" | "mode"> {
  return {
    id: "workflow-1",
    name: "Execution Test",
    mode: "standard",
    ...overrides,
  };
}

function createRepositoryMock(
  overrides: Partial<Repository> = {},
): Repository & {
  runs: Map<string, WorkflowRun>;
} {
  const runs = new Map<string, WorkflowRun>();

  return {
    runs,
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
    getRun: vi.fn(async (_userId: string, runId: string) => runs.get(runId) ?? null),
    createRun: vi.fn(async (_userId: string, run: WorkflowRun) => {
      runs.set(run.id, run);
    }),
    updateRun: vi.fn(async (_userId: string, runId: string, patch: Partial<WorkflowRun>) => {
      const current = runs.get(runId) ?? ({
        id: runId,
        workflowId: "workflow-1",
        workflowName: "Execution Test",
        triggerKind: "button",
        status: "running",
        startedAt: new Date().toISOString(),
        steps: [],
      } as WorkflowRun);
      const next = { ...current, ...patch } as WorkflowRun;
      runs.set(runId, next);
      return next;
    }),
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
  } as Repository & { runs: Map<string, WorkflowRun> };
}

function createStepHarness() {
  return {
    do: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn(async () => {}),
  };
}

describe("workflow graph execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes condition nodes through the true branch only", async () => {
    const trigger = createNode("trigger", "button", "trigger", {}, "Trigger");
    const condition = createNode(
      "condition",
      "condition",
      "logic",
      { expression: 'trigger.data.priority === "high"' },
      "Condition",
    );
    const trueNode = createNode(
      "true-node",
      "staticText",
      "data",
      { value: "true branch" },
      "True path",
    );
    const falseNode = createNode(
      "false-node",
      "staticText",
      "data",
      { value: "false branch" },
      "False path",
    );
    const graph = createGraph(
      [trigger, condition, trueNode, falseNode],
      [
        { id: "e1", source: "trigger", target: "condition" },
        {
          id: "e2",
          source: "condition",
          target: "true-node",
          data: { branch: "true" },
        },
        {
          id: "e3",
          source: "condition",
          target: "false-node",
          data: { branch: "false" },
        },
      ],
    );

    const repository = createRepositoryMock();
    const step = createStepHarness();

    const result = await executeWorkflowGraph(
      repository,
      {
        HYPERDRIVE: {
          connectionString: "",
        },
      } as never,
      "user-1",
      createWorkflow(),
      graph,
      "run-1",
      { priority: "high" },
      step as never,
    );

    expect(result.status).toBe("complete");
    expect(result.steps.map((entry) => entry.nodeId)).toEqual([
      "trigger",
      "condition",
      "true-node",
    ]);
    expect(result.output).toEqual({ value: "true branch" });
    expect(step.do).toHaveBeenCalledTimes(3);
  });

  it("halts execution when an End run block is reached", async () => {
    const trigger = createNode("trigger", "button", "trigger", {}, "Trigger");
    const end = createNode(
      "end",
      "endRun",
      "action",
      { reason: "Finished early" },
      "End",
    );
    const downstream = createNode(
      "downstream",
      "staticText",
      "data",
      { value: "should not run" },
      "Downstream",
    );
    const graph = createGraph(
      [trigger, end, downstream],
      [
        { id: "e1", source: "trigger", target: "end" },
        { id: "e2", source: "end", target: "downstream" },
      ],
    );

    const result = await executeWorkflowGraph(
      createRepositoryMock(),
      {
        HYPERDRIVE: {
          connectionString: "",
        },
      } as never,
      "user-1",
      createWorkflow(),
      graph,
      "run-2",
      {},
      createStepHarness() as never,
    );

    expect(result.status).toBe("complete");
    expect(result.steps.map((entry) => entry.nodeId)).toEqual(["trigger", "end"]);
    expect(result.output).toEqual({
      __workflow_end: true,
      reason: "Finished early",
    });
  });

  it("executes all outgoing branches from a node in queue order", async () => {
    const trigger = createNode("trigger", "button", "trigger", {}, "Trigger");
    const left = createNode(
      "left",
      "staticText",
      "data",
      { value: "left" },
      "Left",
    );
    const right = createNode(
      "right",
      "staticText",
      "data",
      { value: "right" },
      "Right",
    );
    const graph = createGraph(
      [trigger, left, right],
      [
        { id: "e1", source: "trigger", target: "left" },
        { id: "e2", source: "trigger", target: "right" },
      ],
    );

    const result = await executeWorkflowGraph(
      createRepositoryMock(),
      {
        HYPERDRIVE: {
          connectionString: "",
        },
      } as never,
      "user-1",
      createWorkflow(),
      graph,
      "run-3",
      {},
      createStepHarness() as never,
    );

    expect(result.status).toBe("complete");
    expect(result.steps.map((entry) => entry.nodeId)).toEqual([
      "trigger",
      "left",
      "right",
    ]);
    expect(result.output).toEqual({ value: "right" });
  });

  it("runs published subworkflows with parent context and records the child run", async () => {
    const trigger = createNode("trigger", "button", "trigger", {}, "Trigger");
    const parentText = createNode(
      "parent-text",
      "staticText",
      "data",
      { value: "hello world" },
      "Parent text",
    );
    const subworkflow = createNode(
      "sub",
      "runSubworkflow",
      "action",
      {
        workflowId: "child-workflow",
        input: '{"message":"{{ Parent text.output.value }}"}',
      },
      "Run child",
    );

    const childTrigger = createNode(
      "child-trigger",
      "parentContext",
      "trigger",
      {},
      "Context from parent workflow",
    );
    const childTransform = createNode(
      "child-transform",
      "transformJson",
      "data",
      { template: '{"childMessage":"{{ trigger.data.message }}","parentEcho":"{{ parent.Parent text.output.value }}"}' },
      "Shape child payload",
    );
    const childEnd = createNode(
      "child-end",
      "endRun",
      "action",
      { reason: "Child complete" },
      "End child",
    );

    const repository = createRepositoryMock({
      getPublishedSubworkflow: vi.fn(async () => ({
        id: "child-workflow",
        name: "Child workflow",
        mode: "subworkflow" as const,
        status: "published" as const,
        slug: "child-workflow",
        description: "",
        draftGraph: { nodes: [], edges: [] },
        publishedVersionId: "child-version",
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
        metrics: {
          successRate: 0,
          medianDurationMs: 0,
          totalRuns: 0,
          activeTriggers: [],
        },
      })),
      getVersion: vi.fn(async (_userId: string, versionId: string) => {
        if (versionId === "child-version") {
          return {
            id: "child-version",
            workflowId: "child-workflow",
            version: 1,
            createdAt: "2026-04-20T00:00:00.000Z",
            definition: createGraph(
              [childTrigger, childTransform, childEnd],
              [
                {
                  id: "ce1",
                  source: "child-trigger",
                  target: "child-transform",
                },
                { id: "ce2", source: "child-transform", target: "child-end" },
              ],
            ),
          };
        }
        return null;
      }),
      getRun: vi.fn(async () => ({
        id: "run-parent",
        workflowId: "workflow-1",
        workflowName: "Execution Test",
        triggerKind: "button",
        status: "running" as const,
        startedAt: "2026-04-20T00:00:00.000Z",
        rootRunId: "run-parent",
        runDepth: 0,
        steps: [],
      })),
    });

    const result = await executeWorkflowGraph(
      repository,
      {
        HYPERDRIVE: {
          connectionString: "",
        },
      } as never,
      "user-1",
      createWorkflow(),
      createGraph(
        [trigger, parentText, subworkflow],
        [
          { id: "e1", source: "trigger", target: "parent-text" },
          { id: "e2", source: "parent-text", target: "sub" },
        ],
      ),
      "run-parent",
      {},
      createStepHarness() as never,
    );

    expect(result.status).toBe("complete");
    expect(result.steps.map((entry) => entry.nodeId)).toEqual([
      "trigger",
      "parent-text",
      "sub",
    ]);
    expect(result.output).toEqual({
      __workflow_end: true,
      reason: "Child complete",
    });
    expect(repository.createRun).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        workflowId: "child-workflow",
        parentRunId: "run-parent",
        parentStepId: "sub",
        rootRunId: "run-parent",
        runDepth: 1,
      }),
    );
    const childRunUpdate = vi
      .mocked(repository.updateRun)
      .mock.calls.find(
        (call) =>
          call[1] !== "run-parent" &&
          (call[2] as Partial<WorkflowRun>).status === "complete",
      );

    expect(childRunUpdate).toBeDefined();
    expect(childRunUpdate?.[0]).toBe("user-1");
    expect(childRunUpdate?.[2]).toEqual(
      expect.objectContaining({
        status: "complete",
        steps: expect.arrayContaining([
          expect.objectContaining({
            nodeId: "child-transform",
            output: {
              childMessage: "hello world",
              parentEcho: "hello world",
            },
          }),
        ]),
      }),
    );
  });
});

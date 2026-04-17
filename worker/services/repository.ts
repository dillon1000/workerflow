import { and, desc, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  createId,
  createSubworkflowStarterGraph,
  createStarterGraph,
  validateGraph,
  workflowSlug,
} from "../../src/lib/workflow/graph";
import type {
  AnalyticsOverview,
  BootstrapPayload,
  ConnectionDefinition,
  ConnectionProvider,
  TriggerKind,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowMode,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowSnippet,
  WorkflowVersion,
} from "../../src/lib/workflow/types";
import type { WorkerEnv } from "../lib/env";
import {
  connectionSecretMetadataTable,
  connectionsTable,
  workflowPublishStateTable,
  workflowRunStepsTable,
  workflowRunsTable,
  workflowScheduleStateTable,
  workflowSnippetsTable,
  workflowsTable,
  workflowTriggersTable,
  workflowVersionsTable,
  workflowWebhookEndpointsTable,
} from "../lib/schema";
import { createDb } from "./database";

type WorkflowRow = InferSelectModel<typeof workflowsTable>;
type VersionRow = InferSelectModel<typeof workflowVersionsTable>;
type RunRow = InferSelectModel<typeof workflowRunsTable>;
type StepRow = InferSelectModel<typeof workflowRunStepsTable>;
type ConnectionRow = InferSelectModel<typeof connectionsTable>;
type SecretMetadataRow = InferSelectModel<typeof connectionSecretMetadataTable>;

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function summarizeRuns(
  workflows: WorkflowDefinition[],
  runs: WorkflowRun[],
): AnalyticsOverview {
  const successfulRuns = runs.filter((run) => run.status === "complete");
  const durations = successfulRuns
    .map((run) => run.durationMs ?? 0)
    .filter(Boolean);
  const triggerMix = runs.reduce<Record<string, number>>((result, run) => {
    result[run.triggerKind] = (result[run.triggerKind] ?? 0) + 1;
    return result;
  }, {});

  return {
    totalWorkflows: workflows.length,
    publishedWorkflows: workflows.filter(
      (workflow) => workflow.status === "published",
    ).length,
    successRate: runs.length
      ? Math.round((successfulRuns.length / runs.length) * 100)
      : 0,
    medianDurationMs: median(durations),
    totalRuns: runs.length,
    triggerMix,
  };
}

function parseConnection(
  row: ConnectionRow,
  metadata: SecretMetadataRow[],
): ConnectionDefinition {
  return {
    id: row.id,
    provider: row.provider as ConnectionProvider,
    alias: row.alias,
    label: row.label,
    status: row.status as ConnectionDefinition["status"],
    config: JSON.parse(row.configJson) as Record<string, string>,
    notes: row.notes,
    secretKeys: metadata
      .filter((item) => item.connectionId === row.id && item.hasValue)
      .map((item) => item.keyName),
    hasSecrets: metadata.some(
      (item) => item.connectionId === row.id && item.hasValue,
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseRun(row: RunRow, steps: StepRow[]): WorkflowRun {
  return {
    id: row.id,
    workflowId: row.workflowId,
    workflowName: row.workflowName,
    versionId: row.versionId ?? undefined,
    triggerKind: row.triggerKind as TriggerKind,
    status: row.status as WorkflowRun["status"],
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? undefined,
    durationMs: row.durationMs ?? undefined,
    workflowInstanceId: row.workflowInstanceId ?? undefined,
    parentRunId: row.parentRunId ?? undefined,
    parentStepId: row.parentStepId ?? undefined,
    rootRunId: row.rootRunId ?? undefined,
    runDepth: row.runDepth ?? undefined,
    steps: steps
      .filter((step) => step.runId === row.id)
      .map<WorkflowRunStep>((step) => ({
        id: step.id,
        runId: step.runId,
        nodeId: step.nodeId,
        nodeTitle: step.nodeTitle,
        kind: step.kind as WorkflowRunStep["kind"],
        status: step.status as WorkflowRunStep["status"],
        detail: step.detail,
        startedAt: step.startedAt,
        finishedAt: step.finishedAt ?? undefined,
        durationMs: step.durationMs ?? undefined,
        output: step.outputJson ? JSON.parse(step.outputJson) : undefined,
      })),
  };
}

function metricsForWorkflow(workflow: WorkflowDefinition, runs: WorkflowRun[]) {
  const related = runs.filter((run) => run.workflowId === workflow.id);
  const successCount = related.filter(
    (run) => run.status === "complete",
  ).length;
  const durations = related.map((run) => run.durationMs ?? 0).filter(Boolean);
  const triggerMix = Array.from(new Set(related.map((run) => run.triggerKind)));
  return {
    successRate: related.length
      ? Math.round((successCount / related.length) * 100)
      : 0,
    medianDurationMs: median(durations),
    totalRuns: related.length,
    activeTriggers: triggerMix,
    lastRunAt: related[0]?.startedAt,
  };
}

function parseWorkflow(
  row: WorkflowRow,
  runs: WorkflowRun[],
): WorkflowDefinition {
  const workflow: WorkflowDefinition = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    mode: (row.mode ?? "standard") as WorkflowMode,
    parentWorkflowId: row.parentWorkflowId ?? undefined,
    status: row.status as WorkflowDefinition["status"],
    draftGraph: JSON.parse(row.draftGraphJson) as WorkflowGraph,
    publishedVersionId: row.publishedVersionId ?? undefined,
    lastPublishedAt: row.lastPublishedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    metrics: {
      successRate: 0,
      medianDurationMs: 0,
      totalRuns: 0,
      activeTriggers: [],
    },
  };

  return {
    ...workflow,
    metrics: metricsForWorkflow(workflow, runs),
  };
}

function parseVersion(row: VersionRow): WorkflowVersion {
  return {
    id: row.id,
    workflowId: row.workflowId,
    version: row.version,
    createdAt: row.createdAt,
    definition: JSON.parse(row.definitionJson) as WorkflowGraph,
  };
}

export interface Repository {
  getBootstrap(userId: string): Promise<BootstrapPayload>;
  listWorkflows(userId: string): Promise<WorkflowDefinition[]>;
  getWorkflow(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowDefinition | null>;
  getVersion(
    userId: string,
    versionId: string,
  ): Promise<WorkflowVersion | null>;
  createWorkflow(
    userId: string,
    name: string,
    mode?: WorkflowMode,
    parentWorkflowId?: string,
  ): Promise<WorkflowDefinition>;
  listSubworkflows(userId: string): Promise<WorkflowDefinition[]>;
  getPublishedSubworkflow(
    userId: string,
    workflowId: string,
    parentWorkflowId?: string,
  ): Promise<WorkflowDefinition | null>;
  updateWorkflow(
    userId: string,
    workflowId: string,
    patch: Partial<
      Pick<WorkflowDefinition, "name" | "description" | "draftGraph">
    >,
  ): Promise<WorkflowDefinition>;
  deleteWorkflow(userId: string, workflowId: string): Promise<void>;
  publishWorkflow(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowDefinition>;
  listRuns(userId: string, workflowId?: string): Promise<WorkflowRun[]>;
  getRun(userId: string, runId: string): Promise<WorkflowRun | null>;
  createRun(userId: string, run: WorkflowRun): Promise<void>;
  updateRun(
    userId: string,
    runId: string,
    patch: Partial<WorkflowRun>,
  ): Promise<WorkflowRun>;
  listConnections(userId: string): Promise<ConnectionDefinition[]>;
  getConnectionByAlias(
    userId: string,
    alias: string,
  ): Promise<ConnectionDefinition | null>;
  getConnection(
    userId: string,
    connectionId: string,
  ): Promise<ConnectionDefinition | null>;
  createConnection(
    userId: string,
    input: Omit<
      ConnectionDefinition,
      "id" | "createdAt" | "updatedAt" | "secretKeys" | "hasSecrets"
    >,
  ): Promise<ConnectionDefinition>;
  updateConnection(
    userId: string,
    connectionId: string,
    patch: Partial<
      Omit<
        ConnectionDefinition,
        "id" | "createdAt" | "updatedAt" | "secretKeys" | "hasSecrets"
      >
    >,
  ): Promise<ConnectionDefinition>;
  deleteConnection(userId: string, connectionId: string): Promise<void>;
  upsertSecretMetadata(
    userId: string,
    connectionId: string,
    provider: string,
    keyName: string,
    hasValue: boolean,
  ): Promise<void>;
  replacePublishedTriggerIndex(
    userId: string,
    workflowId: string,
    graph: WorkflowGraph,
    versionId: string,
    publishedAt: string,
  ): Promise<void>;
  listPublishedWorkflows(): Promise<
    Array<{ userId: string; workflow: WorkflowDefinition }>
  >;
  markScheduleDispatch(
    workflowId: string,
    triggerNodeId: string,
    timestamp: string,
  ): Promise<void>;
  listSnippets(userId: string): Promise<WorkflowSnippet[]>;
  createSnippet(
    userId: string,
    input: { name: string; description: string; graph: WorkflowGraph },
  ): Promise<WorkflowSnippet>;
  deleteSnippet(userId: string, snippetId: string): Promise<void>;
}

class PgRepository implements Repository {
  private db;
  private client;

  constructor(
    db: Awaited<ReturnType<typeof createDb>>["db"],
    client: Awaited<ReturnType<typeof createDb>>["client"],
  ) {
    this.db = db;
    this.client = client;
  }

  private async listWorkflowRows(userId: string) {
    return this.db
      .select()
      .from(workflowsTable)
      .where(eq(workflowsTable.userId, userId))
      .orderBy(desc(workflowsTable.updatedAt));
  }

  private dependencyTargets(graph: WorkflowGraph) {
    return graph.nodes
      .filter((node) => node.data.kind === "runSubworkflow")
      .map((node) => String(node.data.config.workflowId ?? "").trim())
      .filter(Boolean);
  }

  private async validateWorkflowDefinition(
    userId: string,
    workflowId: string,
    mode: WorkflowMode,
    parentWorkflowId: string | undefined,
    graph: WorkflowGraph,
  ) {
    const validation = validateGraph(graph, mode);
    if (!validation.valid) {
      throw new Error(validation.issues.join(" "));
    }

    if (mode === "subworkflow" && !parentWorkflowId) {
      throw new Error("Sub-workflows must belong to a parent workflow.");
    }

    const rows = await this.listWorkflowRows(userId);
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const graphById = new Map<string, WorkflowGraph>(
      rows.map((row) => [
        row.id,
        JSON.parse(row.draftGraphJson) as WorkflowGraph,
      ]),
    );
    graphById.set(workflowId, graph);

    for (const targetId of this.dependencyTargets(graph)) {
      if (targetId === workflowId) {
        throw new Error(
          "A workflow cannot reference itself as a sub-workflow.",
        );
      }
      const target = rowById.get(targetId);
      if (!target) {
        throw new Error("A referenced sub-workflow no longer exists.");
      }
      if ((target.mode ?? "standard") !== "subworkflow") {
        throw new Error("Only dedicated sub-workflows can be referenced.");
      }
      if ((target.parentWorkflowId ?? undefined) !== workflowId) {
        throw new Error(
          "Sub-workflows are workflow-scoped and can only be used by their parent workflow.",
        );
      }
      if (target.status !== "published") {
        throw new Error(
          "Parent workflows can only reference published sub-workflows.",
        );
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const emptyGraph: WorkflowGraph = { nodes: [], edges: [] };
    const hasCycle = (candidateId: string): boolean => {
      if (visiting.has(candidateId)) return true;
      if (visited.has(candidateId)) return false;
      visiting.add(candidateId);
      for (const nextId of this.dependencyTargets(
        graphById.get(candidateId) ?? emptyGraph,
      )) {
        if (!graphById.has(nextId)) continue;
        if (hasCycle(nextId)) return true;
      }
      visiting.delete(candidateId);
      visited.add(candidateId);
      return false;
    };

    if (hasCycle(workflowId)) {
      throw new Error("Workflow dependency cycles are not allowed.");
    }
  }

  private async loadRuns(userId: string, workflowId?: string) {
    const runs = workflowId
      ? await this.db
          .select()
          .from(workflowRunsTable)
          .where(
            and(
              eq(workflowRunsTable.userId, userId),
              eq(workflowRunsTable.workflowId, workflowId),
            ),
          )
          .orderBy(desc(workflowRunsTable.startedAt))
      : await this.db
          .select()
          .from(workflowRunsTable)
          .where(eq(workflowRunsTable.userId, userId))
          .orderBy(desc(workflowRunsTable.startedAt));
    const runIds = runs.map((run) => run.id);
    const steps = runIds.length
      ? await this.db
          .select()
          .from(workflowRunStepsTable)
          .where(inArray(workflowRunStepsTable.runId, runIds))
      : [];
    return runs.map((run) => parseRun(run, steps));
  }

  async getBootstrap(userId: string): Promise<BootstrapPayload> {
    const [workflows, runs, connections, snippets] = await Promise.all([
      this.listWorkflows(userId),
      this.listRuns(userId),
      this.listConnections(userId),
      this.listSnippets(userId),
    ]);
    return {
      workflows,
      runs,
      connections,
      snippets,
      analytics: summarizeRuns(workflows, runs),
    };
  }

  async listWorkflows(userId: string) {
    const [rows, runs] = await Promise.all([
      this.listWorkflowRows(userId),
      this.listRuns(userId),
    ]);
    return rows.map((row) => parseWorkflow(row, runs));
  }

  async getWorkflow(userId: string, workflowId: string) {
    const [row] = await this.db
      .select()
      .from(workflowsTable)
      .where(
        and(
          eq(workflowsTable.userId, userId),
          eq(workflowsTable.id, workflowId),
        ),
      )
      .limit(1);
    if (!row) return null;
    const runs = await this.listRuns(userId, workflowId);
    return parseWorkflow(row, runs);
  }

  async getVersion(userId: string, versionId: string) {
    const [row] = await this.db
      .select()
      .from(workflowVersionsTable)
      .where(
        and(
          eq(workflowVersionsTable.userId, userId),
          eq(workflowVersionsTable.id, versionId),
        ),
      )
      .limit(1);
    return row ? parseVersion(row) : null;
  }

  async createWorkflow(
    userId: string,
    name: string,
    mode: WorkflowMode = "standard",
    parentWorkflowId?: string,
  ) {
    const now = new Date().toISOString();
    const id = createId("workflow");
    if (mode === "subworkflow") {
      if (!parentWorkflowId) {
        throw new Error("A sub-workflow must belong to a parent workflow.");
      }
      const parent = await this.getWorkflow(userId, parentWorkflowId);
      if (!parent || parent.mode !== "standard") {
        throw new Error(
          "Sub-workflows can only be created under a standard workflow.",
        );
      }
    }
    await this.db.insert(workflowsTable).values({
      id,
      userId,
      name,
      slug: workflowSlug(name),
      description:
        "Describe what this workflow orchestrates, the systems it listens to, and how it should respond.",
      mode,
      parentWorkflowId: parentWorkflowId ?? null,
      status: "draft",
      draftGraphJson: JSON.stringify(
        mode === "subworkflow"
          ? createSubworkflowStarterGraph()
          : createStarterGraph(),
      ),
      publishedVersionId: null,
      lastPublishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const workflow = await this.getWorkflow(userId, id);
    if (!workflow) throw new Error("Workflow could not be created.");
    return workflow;
  }

  async updateWorkflow(
    userId: string,
    workflowId: string,
    patch: Partial<
      Pick<WorkflowDefinition, "name" | "description" | "draftGraph">
    >,
  ) {
    const workflow = await this.getWorkflow(userId, workflowId);
    if (!workflow) throw new Error("Workflow not found.");
    const name = patch.name ?? workflow.name;
    const description = patch.description ?? workflow.description;
    const graph = patch.draftGraph ?? workflow.draftGraph;
    await this.validateWorkflowDefinition(
      userId,
      workflowId,
      workflow.mode,
      workflow.parentWorkflowId,
      graph,
    );
    await this.db
      .update(workflowsTable)
      .set({
        name,
        slug: workflowSlug(name),
        description,
        parentWorkflowId: workflow.parentWorkflowId ?? null,
        draftGraphJson: JSON.stringify(graph),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(workflowsTable.userId, userId),
          eq(workflowsTable.id, workflowId),
        ),
      );
    const updated = await this.getWorkflow(userId, workflowId);
    if (!updated) throw new Error("Updated workflow could not be loaded.");
    return updated;
  }

  async deleteWorkflow(userId: string, workflowId: string) {
    const runRows = await this.db
      .select()
      .from(workflowRunsTable)
      .where(
        and(
          eq(workflowRunsTable.userId, userId),
          eq(workflowRunsTable.workflowId, workflowId),
        ),
      );
    const runIds = runRows.map((run) => run.id);
    if (runIds.length) {
      await this.db
        .delete(workflowRunStepsTable)
        .where(inArray(workflowRunStepsTable.runId, runIds));
    }
    await this.db
      .delete(workflowRunsTable)
      .where(
        and(
          eq(workflowRunsTable.userId, userId),
          eq(workflowRunsTable.workflowId, workflowId),
        ),
      );
    await this.db
      .delete(workflowVersionsTable)
      .where(
        and(
          eq(workflowVersionsTable.userId, userId),
          eq(workflowVersionsTable.workflowId, workflowId),
        ),
      );
    await this.db
      .delete(workflowTriggersTable)
      .where(
        and(
          eq(workflowTriggersTable.userId, userId),
          eq(workflowTriggersTable.workflowId, workflowId),
        ),
      );
    await this.db
      .delete(workflowWebhookEndpointsTable)
      .where(
        and(
          eq(workflowWebhookEndpointsTable.userId, userId),
          eq(workflowWebhookEndpointsTable.workflowId, workflowId),
        ),
      );
    await this.db
      .delete(workflowScheduleStateTable)
      .where(
        and(
          eq(workflowScheduleStateTable.userId, userId),
          eq(workflowScheduleStateTable.workflowId, workflowId),
        ),
      );
    await this.db
      .delete(workflowPublishStateTable)
      .where(
        and(
          eq(workflowPublishStateTable.userId, userId),
          eq(workflowPublishStateTable.workflowId, workflowId),
        ),
      );
    await this.db
      .delete(workflowsTable)
      .where(
        and(
          eq(workflowsTable.userId, userId),
          eq(workflowsTable.id, workflowId),
        ),
      );
  }

  async publishWorkflow(userId: string, workflowId: string) {
    const workflow = await this.getWorkflow(userId, workflowId);
    if (!workflow) throw new Error("Workflow not found.");
    await this.validateWorkflowDefinition(
      userId,
      workflowId,
      workflow.mode,
      workflow.parentWorkflowId,
      workflow.draftGraph,
    );
    const [lastVersion] = await this.db
      .select()
      .from(workflowVersionsTable)
      .where(
        and(
          eq(workflowVersionsTable.userId, userId),
          eq(workflowVersionsTable.workflowId, workflowId),
        ),
      )
      .orderBy(desc(workflowVersionsTable.version))
      .limit(1);
    const versionId = createId("version");
    const version = (lastVersion?.version ?? 0) + 1;
    const publishedAt = new Date().toISOString();
    await this.db.insert(workflowVersionsTable).values({
      id: versionId,
      workflowId,
      userId,
      version,
      definitionJson: JSON.stringify(workflow.draftGraph),
      createdAt: publishedAt,
    });
    await this.db
      .update(workflowsTable)
      .set({
        status: "published",
        publishedVersionId: versionId,
        lastPublishedAt: publishedAt,
        updatedAt: publishedAt,
      })
      .where(
        and(
          eq(workflowsTable.userId, userId),
          eq(workflowsTable.id, workflowId),
        ),
      );
    await this.replacePublishedTriggerIndex(
      userId,
      workflowId,
      workflow.draftGraph,
      versionId,
      publishedAt,
    );
    const updated = await this.getWorkflow(userId, workflowId);
    if (!updated) throw new Error("Published workflow could not be loaded.");
    return updated;
  }

  async listRuns(userId: string, workflowId?: string) {
    return this.loadRuns(userId, workflowId);
  }

  async getRun(userId: string, runId: string) {
    const [run] = await this.db
      .select()
      .from(workflowRunsTable)
      .where(
        and(
          eq(workflowRunsTable.userId, userId),
          eq(workflowRunsTable.id, runId),
        ),
      )
      .limit(1);
    if (!run) return null;
    const steps = await this.db
      .select()
      .from(workflowRunStepsTable)
      .where(eq(workflowRunStepsTable.runId, runId));
    return parseRun(run, steps);
  }

  async createRun(_userId: string, run: WorkflowRun) {
    await this.db.insert(workflowRunsTable).values({
      id: run.id,
      workflowId: run.workflowId,
      userId: _userId,
      workflowName: run.workflowName,
      versionId: run.versionId ?? null,
      triggerKind: run.triggerKind,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt ?? null,
      durationMs: run.durationMs ?? null,
      workflowInstanceId: run.workflowInstanceId ?? null,
      parentRunId: run.parentRunId ?? null,
      parentStepId: run.parentStepId ?? null,
      rootRunId: run.rootRunId ?? null,
      runDepth: run.runDepth ?? 0,
    });
  }

  async updateRun(userId: string, runId: string, patch: Partial<WorkflowRun>) {
    const run = await this.getRun(userId, runId);
    if (!run) throw new Error("Run not found.");
    const next = { ...run, ...patch };
    await this.db
      .update(workflowRunsTable)
      .set({
        workflowName: next.workflowName,
        versionId: next.versionId ?? null,
        triggerKind: next.triggerKind,
        status: next.status,
        startedAt: next.startedAt,
        finishedAt: next.finishedAt ?? null,
        durationMs: next.durationMs ?? null,
        workflowInstanceId: next.workflowInstanceId ?? null,
        parentRunId: next.parentRunId ?? null,
        parentStepId: next.parentStepId ?? null,
        rootRunId: next.rootRunId ?? null,
        runDepth: next.runDepth ?? 0,
      })
      .where(
        and(
          eq(workflowRunsTable.userId, userId),
          eq(workflowRunsTable.id, runId),
        ),
      );

    await this.db
      .delete(workflowRunStepsTable)
      .where(eq(workflowRunStepsTable.runId, runId));
    if (next.steps.length) {
      await this.db.insert(workflowRunStepsTable).values(
        next.steps.map((step) => ({
          id: step.id,
          runId,
          nodeId: step.nodeId,
          nodeTitle: step.nodeTitle,
          kind: step.kind,
          status: step.status,
          detail: step.detail,
          outputJson: step.output == null ? null : JSON.stringify(step.output),
          startedAt: step.startedAt,
          finishedAt: step.finishedAt ?? null,
          durationMs: step.durationMs ?? null,
        })),
      );
    }

    const updated = await this.getRun(userId, runId);
    if (!updated) throw new Error("Updated run not found.");
    return updated;
  }

  async listConnections(userId: string) {
    const [rows, metadata] = await Promise.all([
      this.db
        .select()
        .from(connectionsTable)
        .where(eq(connectionsTable.userId, userId))
        .orderBy(desc(connectionsTable.updatedAt)),
      this.db
        .select()
        .from(connectionSecretMetadataTable)
        .where(eq(connectionSecretMetadataTable.userId, userId)),
    ]);
    return rows.map((row) => parseConnection(row, metadata));
  }

  async getConnectionByAlias(userId: string, alias: string) {
    const [row] = await this.db
      .select()
      .from(connectionsTable)
      .where(
        and(
          eq(connectionsTable.userId, userId),
          eq(connectionsTable.alias, alias),
        ),
      )
      .limit(1);
    if (!row) return null;
    const metadata = await this.db
      .select()
      .from(connectionSecretMetadataTable)
      .where(
        and(
          eq(connectionSecretMetadataTable.userId, userId),
          eq(connectionSecretMetadataTable.connectionId, row.id),
        ),
      );
    return parseConnection(row, metadata);
  }

  async getConnection(userId: string, connectionId: string) {
    const [row] = await this.db
      .select()
      .from(connectionsTable)
      .where(
        and(
          eq(connectionsTable.userId, userId),
          eq(connectionsTable.id, connectionId),
        ),
      )
      .limit(1);
    if (!row) return null;
    const metadata = await this.db
      .select()
      .from(connectionSecretMetadataTable)
      .where(
        and(
          eq(connectionSecretMetadataTable.userId, userId),
          eq(connectionSecretMetadataTable.connectionId, row.id),
        ),
      );
    return parseConnection(row, metadata);
  }

  async createConnection(
    userId: string,
    input: Omit<
      ConnectionDefinition,
      "id" | "createdAt" | "updatedAt" | "secretKeys" | "hasSecrets"
    >,
  ) {
    const now = new Date().toISOString();
    const row = {
      id: createId("connection"),
      userId,
      provider: input.provider,
      alias: input.alias,
      label: input.label,
      status: input.status,
      configJson: JSON.stringify(input.config),
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(connectionsTable).values(row);
    return parseConnection(row, []);
  }

  async updateConnection(
    userId: string,
    connectionId: string,
    patch: Partial<
      Omit<
        ConnectionDefinition,
        "id" | "createdAt" | "updatedAt" | "secretKeys" | "hasSecrets"
      >
    >,
  ) {
    const existing = await this.getConnection(userId, connectionId);
    if (!existing) throw new Error("Connection not found.");
    await this.db
      .update(connectionsTable)
      .set({
        alias: patch.alias ?? existing.alias,
        label: patch.label ?? existing.label,
        status: patch.status ?? existing.status,
        configJson: JSON.stringify(patch.config ?? existing.config),
        notes: patch.notes ?? existing.notes,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(connectionsTable.userId, userId),
          eq(connectionsTable.id, connectionId),
        ),
      );
    const updated = await this.getConnection(userId, connectionId);
    if (!updated) throw new Error("Connection not found after update.");
    return updated;
  }

  async deleteConnection(userId: string, connectionId: string) {
    await this.db
      .delete(connectionSecretMetadataTable)
      .where(
        and(
          eq(connectionSecretMetadataTable.userId, userId),
          eq(connectionSecretMetadataTable.connectionId, connectionId),
        ),
      );
    await this.db
      .delete(connectionsTable)
      .where(
        and(
          eq(connectionsTable.userId, userId),
          eq(connectionsTable.id, connectionId),
        ),
      );
  }

  async upsertSecretMetadata(
    userId: string,
    connectionId: string,
    provider: string,
    keyName: string,
    hasValue: boolean,
  ) {
    const [existing] = await this.db
      .select()
      .from(connectionSecretMetadataTable)
      .where(
        and(
          eq(connectionSecretMetadataTable.userId, userId),
          eq(connectionSecretMetadataTable.connectionId, connectionId),
          eq(connectionSecretMetadataTable.keyName, keyName),
        ),
      )
      .limit(1);
    if (existing) {
      await this.db
        .update(connectionSecretMetadataTable)
        .set({ hasValue, updatedAt: new Date().toISOString() })
        .where(eq(connectionSecretMetadataTable.id, existing.id));
      return;
    }
    await this.db.insert(connectionSecretMetadataTable).values({
      id: createId("secretmeta"),
      connectionId,
      userId,
      provider,
      keyName,
      hasValue,
      updatedAt: new Date().toISOString(),
    });
  }

  async replacePublishedTriggerIndex(
    userId: string,
    workflowId: string,
    graph: WorkflowGraph,
    versionId: string,
    publishedAt: string,
  ) {
    await this.db
      .delete(workflowTriggersTable)
      .where(
        and(
          eq(workflowTriggersTable.userId, userId),
          eq(workflowTriggersTable.workflowId, workflowId),
        ),
      );
    await this.db
      .delete(workflowWebhookEndpointsTable)
      .where(
        and(
          eq(workflowWebhookEndpointsTable.userId, userId),
          eq(workflowWebhookEndpointsTable.workflowId, workflowId),
        ),
      );
    await this.db
      .delete(workflowScheduleStateTable)
      .where(
        and(
          eq(workflowScheduleStateTable.userId, userId),
          eq(workflowScheduleStateTable.workflowId, workflowId),
        ),
      );

    const triggerNodes = graph.nodes.filter(
      (node) => node.data.family === "trigger",
    );
    if (triggerNodes.length) {
      await this.db.insert(workflowTriggersTable).values(
        triggerNodes.map((node) => ({
          id: createId("trigger"),
          workflowId,
          userId,
          nodeId: node.id,
          kind: node.data.kind,
          configJson: JSON.stringify(node.data.config),
        })),
      );
    }

    for (const node of triggerNodes) {
      if (node.data.kind === "webhook") {
        await this.db.insert(workflowWebhookEndpointsTable).values({
          id: createId("webhook"),
          workflowId,
          userId,
          triggerNodeId: node.id,
          path: `/api/triggers/webhook/${workflowId}/${node.id}`,
          updatedAt: publishedAt,
        });
      }

      if (node.data.kind === "schedule") {
        await this.db.insert(workflowScheduleStateTable).values({
          id: createId("schedule"),
          workflowId,
          userId,
          triggerNodeId: node.id,
          cron: String(node.data.config.cron ?? "0 * * * *"),
          lastDispatchedAt: null,
          updatedAt: publishedAt,
        });
      }
    }

    await this.db
      .insert(workflowPublishStateTable)
      .values({
        workflowId,
        userId,
        currentVersionId: versionId,
        publishedAt,
        checksum: await checksum(JSON.stringify(graph)),
      })
      .onConflictDoUpdate({
        target: workflowPublishStateTable.workflowId,
        set: {
          currentVersionId: versionId,
          publishedAt,
          checksum: await checksum(JSON.stringify(graph)),
        },
      });
  }

  async listPublishedWorkflows() {
    const rows = await this.db
      .select()
      .from(workflowsTable)
      .where(eq(workflowsTable.status, "published"))
      .orderBy(desc(workflowsTable.updatedAt));

    const byUser = new Map<string, WorkflowRun[]>();
    for (const row of rows) {
      if (!byUser.has(row.userId)) {
        byUser.set(row.userId, await this.listRuns(row.userId));
      }
    }

    return rows.map((row) => ({
      userId: row.userId,
      workflow: parseWorkflow(row, byUser.get(row.userId) ?? []),
    }));
  }

  async listSubworkflows(userId: string) {
    const [rows, runs] = await Promise.all([
      this.db
        .select()
        .from(workflowsTable)
        .where(
          and(
            eq(workflowsTable.userId, userId),
            eq(workflowsTable.mode, "subworkflow"),
          ),
        )
        .orderBy(desc(workflowsTable.updatedAt)),
      this.listRuns(userId),
    ]);
    return rows.map((row) => parseWorkflow(row, runs));
  }

  async getPublishedSubworkflow(
    userId: string,
    workflowId: string,
    parentWorkflowId?: string,
  ) {
    const [row] = await this.db
      .select()
      .from(workflowsTable)
      .where(
        parentWorkflowId == null
          ? and(
              eq(workflowsTable.userId, userId),
              eq(workflowsTable.id, workflowId),
              eq(workflowsTable.mode, "subworkflow"),
              eq(workflowsTable.status, "published"),
            )
          : and(
              eq(workflowsTable.userId, userId),
              eq(workflowsTable.id, workflowId),
              eq(workflowsTable.mode, "subworkflow"),
              eq(workflowsTable.status, "published"),
              eq(workflowsTable.parentWorkflowId, parentWorkflowId),
            ),
      )
      .limit(1);
    if (!row) return null;
    const runs = await this.listRuns(userId, workflowId);
    return parseWorkflow(row, runs);
  }

  async markScheduleDispatch(
    workflowId: string,
    triggerNodeId: string,
    timestamp: string,
  ) {
    await this.db
      .update(workflowScheduleStateTable)
      .set({ lastDispatchedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          eq(workflowScheduleStateTable.workflowId, workflowId),
          eq(workflowScheduleStateTable.triggerNodeId, triggerNodeId),
        ),
      );
  }

  async listSnippets(userId: string): Promise<WorkflowSnippet[]> {
    const rows = await this.db
      .select()
      .from(workflowSnippetsTable)
      .where(eq(workflowSnippetsTable.userId, userId))
      .orderBy(desc(workflowSnippetsTable.updatedAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      graph: JSON.parse(row.graphJson) as WorkflowGraph,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createSnippet(
    userId: string,
    input: { name: string; description: string; graph: WorkflowGraph },
  ): Promise<WorkflowSnippet> {
    const now = new Date().toISOString();
    const id = createId("snippet");
    await this.db.insert(workflowSnippetsTable).values({
      id,
      userId,
      name: input.name,
      description: input.description,
      graphJson: JSON.stringify(input.graph),
      createdAt: now,
      updatedAt: now,
    });
    return {
      id,
      name: input.name,
      description: input.description,
      graph: input.graph,
      createdAt: now,
      updatedAt: now,
    };
  }

  async deleteSnippet(userId: string, snippetId: string): Promise<void> {
    await this.db
      .delete(workflowSnippetsTable)
      .where(
        and(
          eq(workflowSnippetsTable.userId, userId),
          eq(workflowSnippetsTable.id, snippetId),
        ),
      );
  }

  async close() {
    await this.client.end();
  }
}

async function checksum(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createRepository(env: WorkerEnv): Promise<Repository> {
  const { db, client } = await createDb(env);
  return new PgRepository(db, client);
}

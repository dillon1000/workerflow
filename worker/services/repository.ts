import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { InferSelectModel } from "drizzle-orm";
import {
  createId,
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

type WorkflowRow = InferSelectModel<typeof workflowsTable>;
type VersionRow = InferSelectModel<typeof workflowVersionsTable>;
type RunRow = InferSelectModel<typeof workflowRunsTable>;
type StepRow = InferSelectModel<typeof workflowRunStepsTable>;
type ConnectionRow = InferSelectModel<typeof connectionsTable>;
type SecretMetadataRow = InferSelectModel<typeof connectionSecretMetadataTable>;

let schemaReady: Promise<void> | null = null;

async function ensureSchema(env: WorkerEnv) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`
        create table if not exists workflows (
          id text primary key,
          user_id text not null,
          name text not null,
          slug text not null,
          description text not null,
          status text not null,
          draft_graph_json text not null,
          published_version_id text,
          last_published_at text,
          created_at text not null,
          updated_at text not null
        );
      `),
      env.DB.prepare(`
        create table if not exists workflow_versions (
          id text primary key,
          workflow_id text not null,
          user_id text not null,
          version integer not null,
          definition_json text not null,
          created_at text not null
        );
      `),
      env.DB.prepare(`
        create table if not exists workflow_runs (
          id text primary key,
          workflow_id text not null,
          user_id text not null,
          workflow_name text not null,
          version_id text,
          trigger_kind text not null,
          status text not null,
          started_at text not null,
          finished_at text,
          duration_ms integer,
          workflow_instance_id text
        );
      `),
      env.DB.prepare(`
        create table if not exists workflow_run_steps (
          id text primary key,
          run_id text not null,
          node_id text not null,
          node_title text not null,
          kind text not null,
          status text not null,
          detail text not null,
          output_json text,
          started_at text not null,
          finished_at text,
          duration_ms integer
        );
      `),
      env.DB.prepare(`
        create table if not exists connections (
          id text primary key,
          user_id text not null,
          provider text not null,
          alias text not null,
          label text not null,
          status text not null,
          config_json text not null,
          notes text not null,
          created_at text not null,
          updated_at text not null
        );
      `),
      env.DB.prepare(`
        create table if not exists connection_secret_metadata (
          id text primary key,
          connection_id text not null,
          user_id text not null,
          provider text not null,
          key_name text not null,
          has_value integer not null default 0,
          updated_at text not null
        );
      `),
      env.DB.prepare(`
        create table if not exists workflow_triggers (
          id text primary key,
          workflow_id text not null,
          user_id text not null,
          node_id text not null,
          kind text not null,
          config_json text not null
        );
      `),
      env.DB.prepare(`
        create table if not exists workflow_webhook_endpoints (
          id text primary key,
          workflow_id text not null,
          user_id text not null,
          trigger_node_id text not null,
          path text not null,
          updated_at text not null
        );
      `),
      env.DB.prepare(`
        create table if not exists workflow_schedule_state (
          id text primary key,
          workflow_id text not null,
          user_id text not null,
          trigger_node_id text not null,
          cron text not null,
          last_dispatched_at text,
          updated_at text not null
        );
      `),
      env.DB.prepare(`
        create table if not exists workflow_snippets (
          id text primary key,
          user_id text not null,
          name text not null,
          description text not null,
          graph_json text not null,
          created_at text not null,
          updated_at text not null
        );
      `),
      env.DB.prepare(`
        create table if not exists workflow_publish_state (
          workflow_id text primary key,
          user_id text not null,
          current_version_id text not null,
          published_at text not null,
          checksum text not null
        );
      `),
      env.DB.prepare(
        `create index if not exists workflows_user_id_idx on workflows(user_id);`,
      ),
      env.DB.prepare(
        `create unique index if not exists connection_alias_idx on connections(user_id, alias);`,
      ),
    ]).then(() => undefined);
  }
  await schemaReady;
}

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
  createWorkflow(userId: string, name: string): Promise<WorkflowDefinition>;
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

class D1Repository implements Repository {
  private db;

  constructor(env: WorkerEnv) {
    this.db = drizzle(env.DB);
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
      this.db
        .select()
        .from(workflowsTable)
        .where(eq(workflowsTable.userId, userId))
        .orderBy(desc(workflowsTable.updatedAt)),
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

  async createWorkflow(userId: string, name: string) {
    const now = new Date().toISOString();
    const id = createId("workflow");
    await this.db.insert(workflowsTable).values({
      id,
      userId,
      name,
      slug: workflowSlug(name),
      description:
        "Describe what this workflow orchestrates, the systems it listens to, and how it should respond.",
      status: "draft",
      draftGraphJson: JSON.stringify(createStarterGraph()),
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
    await this.db
      .update(workflowsTable)
      .set({
        name,
        slug: workflowSlug(name),
        description,
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
    const validation = validateGraph(workflow.draftGraph);
    if (!validation.valid) {
      throw new Error(validation.issues.join(" "));
    }
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
}

async function checksum(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createRepository(env: WorkerEnv): Promise<Repository> {
  await ensureSchema(env);
  return new D1Repository(env);
}

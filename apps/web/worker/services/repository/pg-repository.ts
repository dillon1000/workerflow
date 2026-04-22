import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import {
  createId,
  createStarterGraph,
  createSubworkflowStarterGraph,
  workflowSlug,
} from "../../../src/lib/workflow/graph";
import type {
  BootstrapPayload,
  ConnectionDefinition,
  WorkflowEffect,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowMode,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowSnippet,
} from "../../../src/lib/workflow/types";
import {
  connectionSecretMetadataTable,
  connectionsTable,
  workflowEffectsTable,
  workflowPublishStateTable,
  workflowRunStepsTable,
  workflowRunsTable,
  workflowScheduleStateTable,
  workflowSnippetsTable,
  workflowsTable,
  workflowTriggersTable,
  workflowVersionsTable,
  workflowWebhookEndpointsTable,
} from "../../lib/schema";
import type { Repository } from "../repository";
import { checksum } from "./checksum";
import {
  parseConnection,
  parseEffect,
  parseRun,
  parseVersion,
  parseWorkflow,
  summarizeRuns,
} from "./parsers";
import { validateWorkflowDefinition } from "./validation";

export class PgRepository implements Repository {
  private db;
  private client;

  constructor(db: unknown, client: { end(): Promise<void> }) {
    this.db = db as Awaited<
      ReturnType<typeof import("../database").createDb>
    >["db"];
    this.client = client;
  }

  private async listWorkflowRows(userId: string) {
    return this.db
      .select()
      .from(workflowsTable)
      .where(eq(workflowsTable.userId, userId))
      .orderBy(desc(workflowsTable.updatedAt));
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
    await validateWorkflowDefinition(
      () => this.listWorkflowRows(userId),
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
      await this.db
        .delete(workflowEffectsTable)
        .where(inArray(workflowEffectsTable.runId, runIds));
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
    await validateWorkflowDefinition(
      () => this.listWorkflowRows(userId),
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

  async createRun(userId: string, run: WorkflowRun) {
    await this.db.insert(workflowRunsTable).values({
      id: run.id,
      workflowId: run.workflowId,
      userId,
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

    const updated = await this.getRun(userId, runId);
    if (!updated) throw new Error("Updated run not found.");
    return updated;
  }

  async upsertRunStep(_userId: string, runId: string, step: WorkflowRunStep) {
    await this.db
      .insert(workflowRunStepsTable)
      .values({
        id: step.id,
        runId,
        nodeId: step.nodeId,
        nodeTitle: step.nodeTitle,
        kind: step.kind,
        status: step.status,
        detail: step.detail,
        outputJson: step.output == null ? null : JSON.stringify(step.output),
        traceJson:
          step.traceEvents == null ? null : JSON.stringify(step.traceEvents),
        startedAt: step.startedAt,
        finishedAt: step.finishedAt ?? null,
        durationMs: step.durationMs ?? null,
      })
      .onConflictDoUpdate({
        target: [workflowRunStepsTable.runId, workflowRunStepsTable.nodeId],
        set: {
          id: step.id,
          nodeTitle: step.nodeTitle,
          kind: step.kind,
          status: step.status,
          detail: step.detail,
          outputJson: step.output == null ? null : JSON.stringify(step.output),
          traceJson:
            step.traceEvents == null ? null : JSON.stringify(step.traceEvents),
          startedAt: step.startedAt,
          finishedAt: step.finishedAt ?? null,
          durationMs: step.durationMs ?? null,
        },
      });
    return step;
  }

  async claimEffect(input: {
    userId: string;
    runId: string;
    nodeId: string;
    effectKey: string;
    provider: string;
    operation: string;
    requestHash: string;
  }) {
    const [existing] = await this.db
      .select()
      .from(workflowEffectsTable)
      .where(
        and(
          eq(workflowEffectsTable.userId, input.userId),
          eq(workflowEffectsTable.effectKey, input.effectKey),
        ),
      )
      .limit(1);
    if (existing) {
      return parseEffect(existing);
    }

    const now = new Date().toISOString();
    await this.db
      .insert(workflowEffectsTable)
      .values({
        id: createId("effect"),
        userId: input.userId,
        runId: input.runId,
        nodeId: input.nodeId,
        effectKey: input.effectKey,
        provider: input.provider,
        operation: input.operation,
        status: "pending",
        requestHash: input.requestHash,
        outputJson: null,
        remoteRef: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    const [claimed] = await this.db
      .select()
      .from(workflowEffectsTable)
      .where(
        and(
          eq(workflowEffectsTable.userId, input.userId),
          eq(workflowEffectsTable.effectKey, input.effectKey),
        ),
      )
      .limit(1);
    if (!claimed) {
      throw new Error("Workflow effect could not be claimed.");
    }
    return parseEffect(claimed);
  }

  async completeEffect(input: {
    userId: string;
    effectKey: string;
    output?: WorkflowEffect["output"];
    remoteRef?: string;
  }) {
    const [existing] = await this.db
      .select()
      .from(workflowEffectsTable)
      .where(
        and(
          eq(workflowEffectsTable.userId, input.userId),
          eq(workflowEffectsTable.effectKey, input.effectKey),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new Error("Workflow effect not found.");
    }

    await this.db
      .update(workflowEffectsTable)
      .set({
        status: "complete",
        outputJson: input.output == null ? null : JSON.stringify(input.output),
        remoteRef: input.remoteRef ?? existing.remoteRef ?? null,
        error: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(workflowEffectsTable.id, existing.id));

    const [updated] = await this.db
      .select()
      .from(workflowEffectsTable)
      .where(eq(workflowEffectsTable.id, existing.id))
      .limit(1);
    if (!updated) {
      throw new Error("Workflow effect not found after update.");
    }
    return parseEffect(updated);
  }

  async failEffect(input: { userId: string; effectKey: string; error: string }) {
    const [existing] = await this.db
      .select()
      .from(workflowEffectsTable)
      .where(
        and(
          eq(workflowEffectsTable.userId, input.userId),
          eq(workflowEffectsTable.effectKey, input.effectKey),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new Error("Workflow effect not found.");
    }

    await this.db
      .update(workflowEffectsTable)
      .set({
        status: "failed",
        error: input.error,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(workflowEffectsTable.id, existing.id));

    const [updated] = await this.db
      .select()
      .from(workflowEffectsTable)
      .where(eq(workflowEffectsTable.id, existing.id))
      .limit(1);
    if (!updated) {
      throw new Error("Workflow effect not found after failure update.");
    }
    return parseEffect(updated);
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

    const graphJson = JSON.stringify(graph);
    const graphChecksum = await checksum(graphJson);
    await this.db
      .insert(workflowPublishStateTable)
      .values({
        workflowId,
        userId,
        currentVersionId: versionId,
        publishedAt,
        checksum: graphChecksum,
      })
      .onConflictDoUpdate({
        target: workflowPublishStateTable.workflowId,
        set: {
          currentVersionId: versionId,
          publishedAt,
          checksum: graphChecksum,
        },
      });
  }

  async listPublishedWorkflows() {
    const rows = await this.db
      .select()
      .from(workflowsTable)
      .where(eq(workflowsTable.status, "published"))
      .orderBy(desc(workflowsTable.updatedAt));

    const userIds = [...new Set(rows.map((row) => row.userId))];
    const runsByUser = await Promise.all(
      userIds.map(
        async (userId): Promise<readonly [string, WorkflowRun[]]> => [
          userId,
          await this.listRuns(userId),
        ],
      ),
    );
    const byUser = new Map<string, WorkflowRun[]>(runsByUser);

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

  async claimScheduleDispatch(
    workflowId: string,
    triggerNodeId: string,
    timestamp: string,
  ) {
    const claimed = await this.db
      .update(workflowScheduleStateTable)
      .set({ lastDispatchedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          eq(workflowScheduleStateTable.workflowId, workflowId),
          eq(workflowScheduleStateTable.triggerNodeId, triggerNodeId),
          or(
            isNull(workflowScheduleStateTable.lastDispatchedAt),
            ne(workflowScheduleStateTable.lastDispatchedAt, timestamp),
          ),
        ),
      )
      .returning({ id: workflowScheduleStateTable.id });

    return claimed.length > 0;
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

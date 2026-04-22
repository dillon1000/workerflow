import type { InferSelectModel } from "drizzle-orm";
import type {
  AnalyticsOverview,
  ConnectionDefinition,
  ConnectionProvider,
  TriggerKind,
  WorkflowEffect,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowMode,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowTraceEvent,
  WorkflowVersion,
} from "../../../src/lib/workflow/types";
import {
  connectionSecretMetadataTable,
  connectionsTable,
  workflowEffectsTable,
  workflowRunStepsTable,
  workflowRunsTable,
  workflowsTable,
  workflowVersionsTable,
} from "../../lib/schema";

type WorkflowRow = InferSelectModel<typeof workflowsTable>;
type VersionRow = InferSelectModel<typeof workflowVersionsTable>;
type RunRow = InferSelectModel<typeof workflowRunsTable>;
type StepRow = InferSelectModel<typeof workflowRunStepsTable>;
type EffectRow = InferSelectModel<typeof workflowEffectsTable>;
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

export function summarizeRuns(
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

export function parseConnection(
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

export function parseRun(row: RunRow, steps: StepRow[]): WorkflowRun {
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
        traceEvents: step.traceJson
          ? (JSON.parse(step.traceJson) as WorkflowTraceEvent[])
          : undefined,
      })),
  };
}

export function parseEffect(row: EffectRow): WorkflowEffect {
  return {
    id: row.id,
    userId: row.userId,
    runId: row.runId,
    nodeId: row.nodeId,
    effectKey: row.effectKey,
    provider: row.provider,
    operation: row.operation,
    status: row.status as WorkflowEffect["status"],
    requestHash: row.requestHash,
    output: row.outputJson ? JSON.parse(row.outputJson) : undefined,
    remoteRef: row.remoteRef ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function parseWorkflow(
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

export function parseVersion(row: VersionRow): WorkflowVersion {
  return {
    id: row.id,
    workflowId: row.workflowId,
    version: row.version,
    createdAt: row.createdAt,
    definition: JSON.parse(row.definitionJson) as WorkflowGraph,
  };
}

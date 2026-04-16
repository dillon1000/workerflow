import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workflowsTable = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  draftGraphJson: text("draft_graph_json").notNull(),
  publishedVersionId: text("published_version_id"),
  lastPublishedAt: text("last_published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const workflowVersionsTable = sqliteTable("workflow_versions", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  userId: text("user_id").notNull(),
  version: integer("version").notNull(),
  definitionJson: text("definition_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const workflowRunsTable = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  userId: text("user_id").notNull(),
  workflowName: text("workflow_name").notNull(),
  versionId: text("version_id"),
  triggerKind: text("trigger_kind").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  durationMs: integer("duration_ms"),
  workflowInstanceId: text("workflow_instance_id"),
});

export const workflowRunStepsTable = sqliteTable("workflow_run_steps", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  nodeId: text("node_id").notNull(),
  nodeTitle: text("node_title").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  outputJson: text("output_json"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  durationMs: integer("duration_ms"),
});

export const connectionsTable = sqliteTable("connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  alias: text("alias").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull(),
  configJson: text("config_json").notNull(),
  notes: text("notes").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const connectionSecretMetadataTable = sqliteTable(
  "connection_secret_metadata",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id").notNull(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    keyName: text("key_name").notNull(),
    hasValue: integer("has_value", { mode: "boolean" }).notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const workflowTriggersTable = sqliteTable("workflow_triggers", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  userId: text("user_id").notNull(),
  nodeId: text("node_id").notNull(),
  kind: text("kind").notNull(),
  configJson: text("config_json").notNull(),
});

export const workflowWebhookEndpointsTable = sqliteTable(
  "workflow_webhook_endpoints",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").notNull(),
    userId: text("user_id").notNull(),
    triggerNodeId: text("trigger_node_id").notNull(),
    path: text("path").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const workflowScheduleStateTable = sqliteTable(
  "workflow_schedule_state",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").notNull(),
    userId: text("user_id").notNull(),
    triggerNodeId: text("trigger_node_id").notNull(),
    cron: text("cron").notNull(),
    lastDispatchedAt: text("last_dispatched_at"),
    updatedAt: text("updated_at").notNull(),
  },
);

export const workflowSnippetsTable = sqliteTable("workflow_snippets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  graphJson: text("graph_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const workflowPublishStateTable = sqliteTable("workflow_publish_state", {
  workflowId: text("workflow_id").primaryKey(),
  userId: text("user_id").notNull(),
  currentVersionId: text("current_version_id").notNull(),
  publishedAt: text("published_at").notNull(),
  checksum: text("checksum").notNull(),
});

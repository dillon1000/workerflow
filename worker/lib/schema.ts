import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const workflowsTable = pgTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    mode: text("mode").notNull().default("standard"),
    parentWorkflowId: text("parent_workflow_id"),
    status: text("status").notNull(),
    draftGraphJson: text("draft_graph_json").notNull(),
    publishedVersionId: text("published_version_id"),
    lastPublishedAt: text("last_published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("workflows_user_id_idx").on(table.userId)],
);

export const workflowVersionsTable = pgTable("workflow_versions", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  userId: text("user_id").notNull(),
  version: integer("version").notNull(),
  definitionJson: text("definition_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const workflowRunsTable = pgTable("workflow_runs", {
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
  parentRunId: text("parent_run_id"),
  parentStepId: text("parent_step_id"),
  rootRunId: text("root_run_id"),
  runDepth: integer("run_depth"),
});

export const workflowRunStepsTable = pgTable("workflow_run_steps", {
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

export const connectionsTable = pgTable(
  "connections",
  {
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
  },
  (table) => [
    uniqueIndex("connection_alias_idx").on(table.userId, table.alias),
  ],
);

export const connectionSecretMetadataTable = pgTable(
  "connection_secret_metadata",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id").notNull(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    keyName: text("key_name").notNull(),
    hasValue: boolean("has_value").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const workflowTriggersTable = pgTable("workflow_triggers", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  userId: text("user_id").notNull(),
  nodeId: text("node_id").notNull(),
  kind: text("kind").notNull(),
  configJson: text("config_json").notNull(),
});

export const workflowWebhookEndpointsTable = pgTable(
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

export const workflowScheduleStateTable = pgTable("workflow_schedule_state", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  userId: text("user_id").notNull(),
  triggerNodeId: text("trigger_node_id").notNull(),
  cron: text("cron").notNull(),
  lastDispatchedAt: text("last_dispatched_at"),
  updatedAt: text("updated_at").notNull(),
});

export const workflowSnippetsTable = pgTable("workflow_snippets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  graphJson: text("graph_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const workflowPublishStateTable = pgTable("workflow_publish_state", {
  workflowId: text("workflow_id").primaryKey(),
  userId: text("user_id").notNull(),
  currentVersionId: text("current_version_id").notNull(),
  publishedAt: text("published_at").notNull(),
  checksum: text("checksum").notNull(),
});

export const userTable = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [uniqueIndex("user_email_idx").on(table.email)],
);

export const sessionTable = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [uniqueIndex("session_token_idx").on(table.token)],
);

export const accountTable = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    unique("account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verificationTable = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const userRelations = relations(userTable, ({ many }) => ({
  accounts: many(accountTable),
  sessions: many(sessionTable),
}));

export const sessionRelations = relations(sessionTable, ({ one }) => ({
  user: one(userTable, {
    fields: [sessionTable.userId],
    references: [userTable.id],
  }),
}));

export const accountRelations = relations(accountTable, ({ one }) => ({
  user: one(userTable, {
    fields: [accountTable.userId],
    references: [userTable.id],
  }),
}));

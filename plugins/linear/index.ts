import type { WorkflowPluginManifest } from "../types";

const accent = "from-stone-900 via-stone-800 to-stone-700";
const triggerAccent = "from-amber-400 via-orange-400 to-orange-500";

export const plugin: WorkflowPluginManifest = {
  id: "linear",
  title: "Linear",
  description: "Issue workflows for Linear.",
  connections: [
    {
      provider: "linear",
      title: "Linear",
      description: "API key used to create, move, and comment on issues.",
      monogram: "LN",
      docsUrl: "https://linear.app/settings/api",
      fields: [
        {
          key: "apiKey",
          label: "API key",
          kind: "password",
          placeholder: "lin_api_…",
          required: true,
          secret: true,
        },
        {
          key: "defaultTeamId",
          label: "Default team ID",
          kind: "text",
          placeholder: "TEAM",
        },
        {
          key: "webhookSecret",
          label: "Webhook secret",
          kind: "password",
          placeholder: "whsec_…",
          secret: true,
        },
      ],
    },
  ],
  nodes: [
    {
      kind: "linear",
      family: "trigger",
      title: "Linear event",
      subtitle: "Issue lifecycle events from Linear webhooks.",
      accent: triggerAccent,
      defaultConfig: {
        event: "Issue",
        action: "create",
        teamKey: "",
        connectionAlias: "",
      },
      fields: [
        {
          key: "event",
          label: "Event",
          kind: "text",
          required: true,
          placeholder: "Issue",
        },
        {
          key: "action",
          label: "Action",
          kind: "text",
          required: true,
          placeholder: "create",
        },
        {
          key: "teamKey",
          label: "Team key",
          kind: "text",
          placeholder: "ENG",
        },
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "linear",
        },
      ],
    },
    {
      kind: "linearAction",
      family: "action",
      title: "Linear create ticket",
      subtitle: "Create a Linear issue via GraphQL.",
      accent,
      defaultConfig: {
        connectionAlias: "",
        teamId: "",
        title: "Workflow follow-up",
        description: "Created from workflow output: {{ trigger.data }}",
      },
      stepId: "create-ticket",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "linear",
        },
        {
          key: "teamId",
          label: "Team ID",
          kind: "text",
          placeholder: "TEAM",
        },
        {
          key: "title",
          label: "Issue title",
          kind: "text",
          required: true,
          allowTemplates: true,
        },
        {
          key: "description",
          label: "Description",
          kind: "textarea",
          allowTemplates: true,
        },
      ],
    },
  ],
};

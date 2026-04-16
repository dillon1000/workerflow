import type { WorkflowPluginManifest } from "../types";

const accent = "from-stone-900 via-stone-800 to-stone-700";
const triggerAccent = "from-amber-400 via-orange-400 to-orange-500";

export const plugin: WorkflowPluginManifest = {
  id: "github",
  title: "GitHub",
  description: "Issues and pull request automations.",
  connections: [
    {
      provider: "github",
      title: "GitHub",
      description:
        "Personal access or fine-grained token used for issues, PRs, and actions.",
      monogram: "GH",
      docsUrl: "https://github.com/settings/tokens",
      fields: [
        {
          key: "token",
          label: "Access token",
          kind: "password",
          placeholder: "ghp_…",
          required: true,
          secret: true,
        },
        {
          key: "defaultOwner",
          label: "Default owner",
          kind: "text",
          placeholder: "octocat",
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
      kind: "github",
      family: "trigger",
      title: "GitHub event",
      subtitle: "Issues and pull requests routed from webhooks.",
      accent: triggerAccent,
      defaultConfig: {
        event: "issues",
        action: "opened",
        repository: "",
        connectionAlias: "",
      },
      fields: [
        {
          key: "event",
          label: "Event",
          kind: "text",
          required: true,
          placeholder: "issues",
        },
        {
          key: "action",
          label: "Action",
          kind: "text",
          required: true,
          placeholder: "opened",
        },
        {
          key: "repository",
          label: "Repository",
          kind: "text",
          placeholder: "owner/repo",
        },
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "github",
        },
      ],
    },
    {
      kind: "githubAction",
      family: "action",
      title: "GitHub create issue",
      subtitle: "Create a GitHub issue with real API calls.",
      accent,
      defaultConfig: {
        connectionAlias: "",
        owner: "",
        repo: "",
        title: "Workflow-generated issue",
        body: "Created from workflow output: {{ trigger.data }}",
        labels: "automation",
        assignees: "",
      },
      stepId: "create-issue",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "github",
        },
        {
          key: "owner",
          label: "Owner",
          kind: "text",
          required: true,
          placeholder: "octocat",
        },
        {
          key: "repo",
          label: "Repository",
          kind: "text",
          required: true,
          placeholder: "hello-world",
        },
        {
          key: "title",
          label: "Issue title",
          kind: "text",
          required: true,
          allowTemplates: true,
        },
        {
          key: "body",
          label: "Issue body",
          kind: "textarea",
          allowTemplates: true,
        },
        {
          key: "labels",
          label: "Labels",
          kind: "text",
          placeholder: "bug,automation",
        },
        {
          key: "assignees",
          label: "Assignees",
          kind: "text",
          placeholder: "octocat",
        },
      ],
    },
  ],
};

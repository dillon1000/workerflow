import type { WorkflowPluginManifest } from "../types";

const accent = "from-stone-900 via-stone-800 to-stone-700";

export const plugin: WorkflowPluginManifest = {
  id: "[plugin-kebab]",
  title: "[Plugin Title]",
  description: "[Plugin Description]",
  connections: [
    {
      provider: "[plugin-kebab]",
      title: "[Plugin Title]",
      description: "[Plugin Description]",
      monogram: "[PLUGIN_MONOGRAM]",
      fields: [
        {
          key: "apiKey",
          label: "API key",
          kind: "password",
          placeholder: "sk_...",
          required: true,
          secret: true,
        },
        {
          key: "baseUrl",
          label: "Base URL",
          kind: "url",
          placeholder: "https://api.example.com",
        },
      ],
    },
  ],
  nodes: [
    {
      kind: "[plugin-camel]Action",
      family: "action",
      title: "[Plugin Title] [Action Title]",
      subtitle: "[Action Description]",
      accent,
      defaultConfig: {
        connectionAlias: "",
        input: "{{ trigger.data }}",
      },
      stepId: "[action-kebab]",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "[plugin-kebab]",
        },
        {
          key: "input",
          label: "Input",
          kind: "textarea",
          required: true,
          allowTemplates: true,
          placeholder: "{{ trigger.data }}",
        },
      ],
    },
  ],
};

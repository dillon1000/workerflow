import type { WorkflowPluginManifest } from "../types";

const actionAccent = "from-stone-900 via-stone-800 to-stone-700";

export const plugin: WorkflowPluginManifest = {
  id: "anthropic",
  title: "Anthropic",
  description: "Claude chat completions via the Anthropic Messages API.",
  connections: [
    {
      provider: "anthropic",
      title: "Anthropic",
      description: "API key used for Claude messages.",
      monogram: "AN",
      docsUrl: "https://console.anthropic.com/settings/keys",
      fields: [
        {
          key: "apiKey",
          label: "API key",
          kind: "password",
          placeholder: "sk-ant-…",
          required: true,
          secret: true,
        },
      ],
    },
  ],
  nodes: [
    {
      kind: "anthropicChat",
      family: "action",
      title: "Claude chat",
      subtitle: "Call the Anthropic Messages API.",
      accent: actionAccent,
      defaultConfig: {
        connectionAlias: "",
        model: "claude-sonnet-4-5",
        system: "You are a helpful workflow assistant.",
        prompt: "Summarize {{ trigger.data }} into crisp action items.",
        maxTokens: 1024,
      },
      stepId: "anthropic-chat",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "anthropic",
        },
        { key: "model", label: "Model", kind: "text", required: true },
        {
          key: "system",
          label: "System prompt",
          kind: "textarea",
          allowTemplates: true,
        },
        {
          key: "prompt",
          label: "User prompt",
          kind: "textarea",
          required: true,
          allowTemplates: true,
        },
        {
          key: "maxTokens",
          label: "Max tokens",
          kind: "number",
          min: 1,
          max: 200000,
        },
      ],
    },
  ],
};

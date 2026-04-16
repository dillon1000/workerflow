import type { WorkflowPluginManifest } from "../types";

const actionAccent = "from-stone-900 via-stone-800 to-stone-700";

export const plugin: WorkflowPluginManifest = {
  id: "openrouter",
  title: "OpenRouter",
  description:
    "Multi-provider chat completions through the OpenRouter gateway.",
  connections: [
    {
      provider: "openrouter",
      title: "OpenRouter",
      description: "API key used for OpenRouter chat completions.",
      monogram: "OR",
      docsUrl: "https://openrouter.ai/keys",
      fields: [
        {
          key: "apiKey",
          label: "API key",
          kind: "password",
          placeholder: "sk-or-…",
          required: true,
          secret: true,
        },
        {
          key: "referer",
          label: "HTTP referer",
          kind: "url",
          placeholder: "https://workerflow.app",
          description:
            "Optional HTTP-Referer header sent with requests for attribution.",
        },
        {
          key: "title",
          label: "X-Title",
          kind: "text",
          placeholder: "Workerflow",
        },
      ],
    },
  ],
  nodes: [
    {
      kind: "openrouterChat",
      family: "action",
      title: "OpenRouter chat",
      subtitle: "Call any OpenRouter-hosted model.",
      accent: actionAccent,
      defaultConfig: {
        connectionAlias: "",
        model: "openai/gpt-4o-mini",
        system: "You are a helpful workflow assistant.",
        prompt: "Summarize {{ trigger.data }} into crisp action items.",
        temperature: 0.2,
      },
      stepId: "openrouter-chat",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "openrouter",
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
          key: "temperature",
          label: "Temperature",
          kind: "number",
          min: 0,
          max: 2,
        },
      ],
    },
  ],
};

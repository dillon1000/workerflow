import type { WorkflowPluginManifest } from "../types";

const actionAccent = "from-stone-900 via-stone-800 to-stone-700";

export const plugin: WorkflowPluginManifest = {
  id: "openai",
  title: "OpenAI",
  description: "Chat completions and image generation via the OpenAI API.",
  connections: [
    {
      provider: "openai",
      title: "OpenAI",
      description: "API key used for chat completions, embeddings, and images.",
      monogram: "OA",
      docsUrl: "https://platform.openai.com/api-keys",
      fields: [
        {
          key: "apiKey",
          label: "API key",
          kind: "password",
          placeholder: "sk-…",
          required: true,
          secret: true,
        },
        {
          key: "baseUrl",
          label: "Base URL",
          kind: "url",
          placeholder: "https://api.openai.com/v1",
          description:
            "Override for OpenAI-compatible gateways. Defaults to https://api.openai.com/v1.",
        },
      ],
    },
  ],
  nodes: [
    {
      kind: "openaiChat",
      family: "action",
      title: "OpenAI chat",
      subtitle: "Call the OpenAI chat completions endpoint.",
      accent: actionAccent,
      defaultConfig: {
        connectionAlias: "",
        model: "gpt-4o-mini",
        system: "You are a helpful workflow assistant.",
        prompt: "Summarize {{ trigger.data }} into crisp action items.",
        temperature: 0.2,
      },
      stepId: "openai-chat",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "openai",
        },
        {
          key: "model",
          label: "Model",
          kind: "text",
          required: true,
          placeholder: "gpt-4o-mini",
        },
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
    {
      kind: "openaiImage",
      family: "action",
      title: "OpenAI image",
      subtitle: "Generate an image with the OpenAI images endpoint.",
      accent: actionAccent,
      defaultConfig: {
        connectionAlias: "",
        model: "gpt-image-1",
        prompt: "An editorial illustration of {{ trigger.data }}.",
        size: "1024x1024",
      },
      stepId: "openai-image",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "openai",
        },
        {
          key: "model",
          label: "Model",
          kind: "text",
          required: true,
        },
        {
          key: "prompt",
          label: "Prompt",
          kind: "textarea",
          required: true,
          allowTemplates: true,
        },
        {
          key: "size",
          label: "Size",
          kind: "select",
          options: [
            { label: "1024x1024", value: "1024x1024" },
            { label: "1024x1536", value: "1024x1536" },
            { label: "1536x1024", value: "1536x1024" },
            { label: "512x512", value: "512x512" },
          ],
        },
      ],
    },
  ],
};

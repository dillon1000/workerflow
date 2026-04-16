import type { WorkflowPluginManifest } from "../types";

const actionAccent = "from-stone-900 via-stone-800 to-stone-700";

export const plugin: WorkflowPluginManifest = {
  id: "fal",
  title: "fal.ai",
  description:
    "Run fal.ai hosted models (image, video, audio) via the synchronous run API.",
  connections: [
    {
      provider: "fal",
      title: "fal.ai",
      description: "API key used for fal.ai hosted models.",
      monogram: "FA",
      docsUrl: "https://fal.ai/dashboard/keys",
      fields: [
        {
          key: "apiKey",
          label: "API key",
          kind: "password",
          placeholder: "fal-…",
          required: true,
          secret: true,
        },
      ],
    },
  ],
  nodes: [
    {
      kind: "falRun",
      family: "action",
      title: "fal.ai run model",
      subtitle: "Invoke any fal.ai model synchronously.",
      accent: actionAccent,
      defaultConfig: {
        connectionAlias: "",
        model: "fal-ai/flux/schnell",
        input: JSON.stringify(
          {
            prompt: "An editorial illustration of {{ trigger.data }}",
            image_size: "landscape_4_3",
          },
          null,
          2,
        ),
      },
      stepId: "fal-run",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "fal",
        },
        {
          key: "model",
          label: "Model",
          kind: "text",
          required: true,
          placeholder: "fal-ai/flux/schnell",
        },
        {
          key: "input",
          label: "Input JSON",
          kind: "json",
          required: true,
          allowTemplates: true,
        },
      ],
    },
  ],
};

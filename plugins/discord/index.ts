import type { WorkflowPluginManifest } from "../types";

const actionAccent = "from-indigo-500 via-purple-500 to-pink-500";

export const plugin: WorkflowPluginManifest = {
  id: "discord",
  title: "Discord",
  description: "Send messages to Discord channels via incoming webhook URLs.",
  connections: [
    {
      provider: "discord",
      title: "Discord Webhook",
      description: "Webhook URL for posting messages to a Discord channel.",
      monogram: "DC",
      docsUrl:
        "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks",
      fields: [
        {
          key: "webhookUrl",
          label: "Webhook URL",
          kind: "url",
          placeholder: "https://discord.com/api/webhooks/...",
          required: true,
          secret: true,
        },
      ],
    },
  ],
  nodes: [
    {
      kind: "discordSendMessage",
      family: "action",
      title: "Discord message",
      subtitle: "Send a message to a Discord channel via webhook.",
      accent: actionAccent,
      defaultConfig: {
        connectionAlias: "",
        content: "",
        username: "",
        avatarUrl: "",
        tts: false,
      },
      stepId: "send-message",
      fields: [
        {
          key: "connectionAlias",
          label: "Connection",
          kind: "connection",
          required: true,
          connectionProvider: "discord",
        },
        {
          key: "content",
          label: "Message content",
          kind: "textarea",
          required: true,
          allowTemplates: true,
          placeholder: "Hello from the workflow!",
          description:
            "Message text (up to 2000 characters). Supports markdown.",
        },
        {
          key: "username",
          label: "Username",
          kind: "text",
          allowTemplates: true,
          placeholder: "Webhook Bot",
          description: "Override the default webhook username.",
        },
        {
          key: "avatarUrl",
          label: "Avatar URL",
          kind: "text",
          allowTemplates: true,
          placeholder: "https://example.com/avatar.png",
          description: "Override the default webhook avatar.",
        },
        {
          key: "tts",
          label: "Text-to-speech",
          kind: "select",
          description:
            "Whether this message should be spoken aloud by Discord.",
          options: [
            { label: "Off", value: "false" },
            { label: "On", value: "true" },
          ],
        },
      ],
    },
  ],
};

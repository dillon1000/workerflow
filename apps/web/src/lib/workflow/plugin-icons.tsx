import {
  Bot,
  Database,
  GitBranch,
  Image,
  Link2,
  Orbit,
  Timer,
  Webhook,
} from "lucide-react";
import type { ComponentType } from "react";
import { workflowNodeDefinitions } from "@/lib/workflow/plugin-registry";
import type { WorkflowFamily } from "@/lib/workflow/types";

export type WorkflowNodeIconComponent = ComponentType<{ className?: string }>;

const pluginIconModules = import.meta.glob("../../../../../plugins/*/icon.tsx", {
  eager: true,
  import: "PluginIcon",
}) as Record<string, WorkflowNodeIconComponent>;

const pluginIcons = Object.fromEntries(
  Object.entries(pluginIconModules).map(([path, icon]) => {
    const match = path.match(/\/plugins\/([^/]+)\/icon\.tsx$/);
    return [match?.[1] ?? path, icon];
  }),
) as Record<string, WorkflowNodeIconComponent>;

export const workflowFamilyIcons: Record<
  WorkflowFamily,
  WorkflowNodeIconComponent
> = {
  trigger: Webhook,
  action: Bot,
  logic: GitBranch,
  data: Database,
};

const builtInIcons: Record<string, WorkflowNodeIconComponent> = {
  aiImage: Image,
  button: Bot,
  github: GitBranch,
  githubAction: GitBranch,
  httpRequest: Link2,
  linear: Orbit,
  linearAction: Orbit,
  schedule: Timer,
  sendWebhook: Webhook,
  wait: Timer,
  webhook: Webhook,
};

export const workflowNodeIcons = Object.fromEntries(
  Object.keys(builtInIcons).map((kind) => [kind, builtInIcons[kind]]),
) as Record<string, WorkflowNodeIconComponent>;

for (const definition of workflowNodeDefinitions) {
  workflowNodeIcons[definition.kind] =
    builtInIcons[definition.kind] ??
    pluginIcons[definition.pluginId] ??
    workflowFamilyIcons[definition.family];
}

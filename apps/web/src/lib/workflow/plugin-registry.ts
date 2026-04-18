import type {
  ConnectionSchema,
  WorkflowNodeFieldDefinition,
  WorkflowPluginManifest,
} from "../../../../../plugins/types";
import type { WorkflowTemplate } from "./types";

export interface RegisteredWorkflowNodeDefinition extends WorkflowTemplate {
  pluginId: string;
  stepId?: string;
  executionMode?: "inline" | "step";
  fields?: WorkflowNodeFieldDefinition[];
}

type PluginModule = {
  plugin: WorkflowPluginManifest;
};

function pluginIdFromPath(path: string) {
  const match = path.match(/\/plugins\/([^/]+)\/index\.ts$/);
  if (!match) {
    throw new Error(`Unable to resolve plugin id from "${path}".`);
  }
  return match[1];
}

const pluginModules = import.meta.glob("../../../../../plugins/*/index.ts", {
  eager: true,
}) as Record<string, PluginModule>;

export const workflowPlugins = Object.entries(pluginModules)
  .map(([path, module]) => {
    const derivedId = pluginIdFromPath(path);
    if (module.plugin.id !== derivedId) {
      throw new Error(
        `Plugin id mismatch for "${path}". Expected "${derivedId}", received "${module.plugin.id}".`,
      );
    }
    return module.plugin;
  })
  .sort((left, right) => left.title.localeCompare(right.title));

export const workflowNodeDefinitions: RegisteredWorkflowNodeDefinition[] =
  workflowPlugins.flatMap((plugin) =>
    plugin.nodes.map((node) => ({
      pluginId: plugin.id,
      ...node,
    })),
  );

const seenNodeKinds = new Set<string>();
for (const node of workflowNodeDefinitions) {
  if (seenNodeKinds.has(node.kind)) {
    throw new Error(`Duplicate workflow node kind "${node.kind}" detected.`);
  }
  seenNodeKinds.add(node.kind);
}

export const workflowTemplates: WorkflowTemplate[] =
  workflowNodeDefinitions.map((definition) => ({
    kind: definition.kind,
    family: definition.family,
    title: definition.title,
    subtitle: definition.subtitle,
    accent: definition.accent,
    defaultConfig: definition.defaultConfig,
  }));

export const connectionSchemas: ConnectionSchema[] = workflowPlugins.flatMap(
  (plugin) => plugin.connections ?? [],
);

const seenProviders = new Set<string>();
for (const schema of connectionSchemas) {
  if (seenProviders.has(schema.provider)) {
    throw new Error(
      `Duplicate connection provider "${schema.provider}" detected.`,
    );
  }
  seenProviders.add(schema.provider);
}

export function getWorkflowTemplate(kind: string) {
  return workflowTemplates.find((template) => template.kind === kind);
}

export function getWorkflowNodeDefinition(kind: string) {
  return workflowNodeDefinitions.find((template) => template.kind === kind);
}

export function getConnectionSchema(provider: string) {
  return connectionSchemas.find((schema) => schema.provider === provider);
}

export function templatesByFamily() {
  return {
    trigger: workflowTemplates.filter(
      (template) => template.family === "trigger",
    ),
    action: workflowTemplates.filter(
      (template) => template.family === "action",
    ),
    logic: workflowTemplates.filter((template) => template.family === "logic"),
    data: workflowTemplates.filter((template) => template.family === "data"),
  };
}

export function validateNodeConfigField(
  field: WorkflowNodeFieldDefinition,
  value: unknown,
) {
  const text = typeof value === "string" ? value : String(value ?? "");
  const trimmed = text.trim();

  if (field.required && !trimmed) {
    return `${field.label} is required.`;
  }

  if (!trimmed) {
    return null;
  }

  if (field.kind === "number") {
    const parsed = Number(text);
    if (Number.isNaN(parsed)) {
      return `${field.label} must be a number.`;
    }
    if (field.min != null && parsed < field.min) {
      return `${field.label} must be at least ${field.min}.`;
    }
    if (field.max != null && parsed > field.max) {
      return `${field.label} must be at most ${field.max}.`;
    }
  }

  if (field.kind === "json") {
    if (field.allowTemplates && text.includes("{{")) {
      return null;
    }
    try {
      JSON.parse(text);
    } catch {
      return `${field.label} must be valid JSON.`;
    }
  }

  if (
    field.kind === "select" &&
    field.options?.length &&
    !field.options.some((option) => option.value === text)
  ) {
    return `${field.label} must be one of the allowed options.`;
  }

  return null;
}

import type {
  ConnectionTestRunner,
  WorkflowStepRunner,
  WorkflowTriggerHandler,
} from "../../plugins/runtime";
import {
  connectionSchemas,
  getWorkflowNodeDefinition,
} from "../../src/lib/workflow/plugin-registry";

type StepModule = {
  run: WorkflowStepRunner;
};

type TestModule = {
  testConnection: ConnectionTestRunner;
};

type TriggerModule = {
  triggerHandlers: WorkflowTriggerHandler[];
};

const stepModules = import.meta.glob("/plugins/*/steps/*.ts", {
  eager: true,
}) as Record<string, StepModule>;

const testModules = import.meta.glob("/plugins/*/test.ts", {
  eager: true,
}) as Record<string, TestModule>;

const triggerModules = import.meta.glob("/plugins/*/trigger.ts", {
  eager: true,
}) as Record<string, TriggerModule>;

function pluginPathParts(path: string, pattern: RegExp) {
  const match = path.match(pattern);
  if (!match) {
    throw new Error(`Unrecognized plugin runtime path "${path}".`);
  }
  return match.slice(1);
}

const stepRunners = new Map<string, WorkflowStepRunner>();
for (const [path, module] of Object.entries(stepModules)) {
  const [pluginId, stepId] = pluginPathParts(
    path,
    /\/plugins\/([^/]+)\/steps\/([^/]+)\.ts$/,
  );
  stepRunners.set(`${pluginId}:${stepId}`, module.run);
}

const connectionTests = new Map<string, ConnectionTestRunner>();
for (const [path, module] of Object.entries(testModules)) {
  const [pluginId] = pluginPathParts(path, /\/plugins\/([^/]+)\/test\.ts$/);
  connectionTests.set(pluginId, module.testConnection);
}

const triggerHandlers = new Map<string, WorkflowTriggerHandler>();
for (const module of Object.values(triggerModules)) {
  for (const handler of module.triggerHandlers) {
    triggerHandlers.set(handler.kind, handler);
  }
}

export function getWorkflowStepRunner(kind: string) {
  const definition = getWorkflowNodeDefinition(kind);
  if (!definition?.stepId) {
    return null;
  }
  return stepRunners.get(`${definition.pluginId}:${definition.stepId}`) ?? null;
}

export function getWorkflowNodeExecutionMode(kind: string) {
  return getWorkflowNodeDefinition(kind)?.executionMode ?? "step";
}

export function getTriggerHandler(kind: string) {
  return triggerHandlers.get(kind) ?? null;
}

export function isKnownConnectionProvider(provider: string) {
  return connectionSchemas.some((schema) => schema.provider === provider);
}

export function getConnectionTestRunner(provider: string) {
  return connectionTests.get(provider) ?? null;
}

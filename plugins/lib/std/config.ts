import type { WorkflowStepExecutionContext } from "../../runtime";
import { assertJsonObject } from "./guards";

export function stringConfig(
  context: WorkflowStepExecutionContext,
  key: string,
  fallback = "",
) {
  return String(context.node.data.config[key] ?? fallback);
}

export function renderedStringConfig(
  context: WorkflowStepExecutionContext,
  key: string,
  fallback = "",
) {
  return context.render(stringConfig(context, key, fallback));
}

export function numberConfig(
  context: WorkflowStepExecutionContext,
  key: string,
  fallback = 0,
) {
  return Number(context.node.data.config[key] ?? fallback);
}

export function booleanConfig(
  context: WorkflowStepExecutionContext,
  key: string,
  fallback = false,
) {
  const value = context.node.data.config[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true";
  }
  return fallback;
}

export function jsonConfig(
  context: WorkflowStepExecutionContext,
  key: string,
  fallback: string,
) {
  return context.parseMaybeJson(renderedStringConfig(context, key, fallback));
}

export function objectJsonConfig(
  context: WorkflowStepExecutionContext,
  key: string,
  fallback = "{}",
) {
  return assertJsonObject(
    jsonConfig(context, key, fallback),
    `Expected "${key}" to resolve to a JSON object.`,
  );
}

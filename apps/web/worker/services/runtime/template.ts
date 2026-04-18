import type { JsonValue, WorkflowNode } from "../../../src/lib/workflow/types";

const blockedPathSegments = new Set(["__proto__", "constructor", "prototype"]);

export function readProperty(source: unknown, segment: string) {
  if (blockedPathSegments.has(segment)) {
    return undefined;
  }
  if (
    source &&
    (typeof source === "object" || typeof source === "function") &&
    Object.prototype.hasOwnProperty.call(source, segment)
  ) {
    return (source as Record<string, unknown>)[segment];
  }
  return undefined;
}

function readPath(source: unknown, path: string) {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((value, segment) => readProperty(value, segment), source);
}

function asString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function templateContext(
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  nodes: WorkflowNode[],
) {
  const byTitle = Object.fromEntries(
    nodes.map((node) => [
      node.data.title,
      { data: outputs[node.id], output: outputs[node.id] },
    ]),
  );
  return {
    trigger: { data: payload, output: payload },
    parent:
      payload.parent && typeof payload.parent === "object"
        ? payload.parent
        : {},
    steps: Object.fromEntries(nodes.map((node) => [node.id, outputs[node.id]])),
    ...byTitle,
  };
}

export function renderTemplate(
  template: string,
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
  nodes: WorkflowNode[],
) {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression) => {
    const normalized = String(expression).trim();
    const [source, ...rest] = normalized.split(".");
    const path = rest.join(".");
    const context = templateContext(payload, outputs, nodes) as Record<
      string,
      unknown
    >;
    const value = context[source];
    return asString(path ? readPath(value, path) : value);
  });
}

export function parseMaybeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
}

export function parseList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

import type { WorkflowStepExecutionContext } from "../../runtime";

const encoder = new TextEncoder();

function toBytes(value: string) {
  return encoder.encode(value);
}

export async function stableHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", toBytes(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function stableJsonHash(value: unknown) {
  return stableHash(JSON.stringify(value));
}

export async function buildScopedHash(
  context: WorkflowStepExecutionContext,
  operation: string,
  value: unknown,
) {
  return stableJsonHash({
    workflowId: context.node.id,
    runId: context.runId,
    operation,
    value,
  });
}

export function createSeededRandom(seed: string) {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

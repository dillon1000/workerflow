import type {
  JsonValue,
  RunStatus,
} from "../../../apps/web/src/lib/workflow/types";
import type { WorkflowStepExecutionResult } from "../../runtime";
import { assert } from "./guards";

const DEFAULT_OUTPUT_LIMIT_BYTES = 900_000;

function truncateString(value: string, maxBytes: number) {
  const encoder = new TextEncoder();
  if (encoder.encode(value).byteLength <= maxBytes) {
    return value;
  }
  let end = value.length;
  while (end > 0 && encoder.encode(`${value.slice(0, end)}...`).byteLength > maxBytes) {
    end -= 1;
  }
  return `${value.slice(0, end)}...`;
}

export function capOutputSize(
  value: unknown,
  maxBytes = DEFAULT_OUTPUT_LIMIT_BYTES,
): JsonValue {
  const json = JSON.stringify(value ?? null);
  if (new TextEncoder().encode(json).byteLength <= maxBytes) {
    return (value ?? null) as JsonValue;
  }

  return {
    truncated: true,
    preview: truncateString(json, Math.max(256, maxBytes - 64)),
    originalBytes: new TextEncoder().encode(json).byteLength,
  };
}

export function ok(
  detail: string,
  output?: unknown,
  status: RunStatus = "complete",
): WorkflowStepExecutionResult {
  assert(detail.trim().length > 0, "A step result detail is required.");
  return {
    detail,
    status,
    output: output == null ? undefined : capOutputSize(output),
  };
}

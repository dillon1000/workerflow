import type { WorkflowStepRunner } from "../../runtime";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async ({ node, payload }) => {
  const answers =
    payload.askForInput &&
    typeof payload.askForInput === "object" &&
    !Array.isArray(payload.askForInput)
      ? (payload.askForInput as Record<string, unknown>)
      : {};

  const label = String(node.data.config.label ?? "Your input");
  const placeholder = String(node.data.config.placeholder ?? "");
  const defaultValue = String(node.data.config.defaultValue ?? "");
  const required = String(node.data.config.required ?? "true") !== "false";
  const rawValue = answers[node.id];
  const value =
    typeof rawValue === "string"
      ? rawValue
      : rawValue == null
        ? defaultValue
        : String(rawValue);

  if (required && !value.trim()) {
    throw new Error(`"${label}" is required before this workflow can run.`);
  }

  return ok(
    value.trim()
      ? `Collected input for "${label}".`
      : `No input provided for "${label}".`,
    {
      value,
      label,
      placeholder,
      required,
    },
  );
};

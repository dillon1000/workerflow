import type { WorkflowStepRunner } from "../../runtime";
import { renderedStringConfig } from "../../lib/std/config";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const workflowId = String(context.node.data.config.workflowId ?? "").trim();
  if (!workflowId) {
    throw new Error("A published sub-workflow must be selected.");
  }

  const renderedInput = renderedStringConfig(context, "input", "{}");
  const parsed = context.parseMaybeJson(renderedInput);
  const input =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };

  const result = await context.runSubworkflow(workflowId, input);
  return ok(`Sub-workflow "${result.workflowName}" completed.`, result.output);
};

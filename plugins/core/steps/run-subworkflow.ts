import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({
  node,
  parseMaybeJson,
  render,
  runSubworkflow,
}) => {
  const workflowId = String(node.data.config.workflowId ?? "").trim();
  if (!workflowId) {
    throw new Error("A published sub-workflow must be selected.");
  }

  const renderedInput = render(String(node.data.config.input ?? "{}"));
  const parsed = parseMaybeJson(renderedInput);
  const input =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };

  const result = await runSubworkflow(workflowId, input);
  return {
    detail: `Sub-workflow "${result.workflowName}" completed.`,
    output: result.output,
  };
};

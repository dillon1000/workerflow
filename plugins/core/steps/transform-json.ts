import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({
  node,
  parseMaybeJson,
  render,
}) => ({
  detail: "Payload transformed successfully.",
  output: parseMaybeJson(render(String(node.data.config.template ?? "{}"))),
});

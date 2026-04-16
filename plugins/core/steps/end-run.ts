import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({ node, render }) => {
  const reason = render(String(node.data.config.reason ?? "")).trim();
  return {
    detail: reason
      ? `Run halted by End run: ${reason}`
      : "Run halted by End run.",
    output: {
      __workflow_end: true,
      reason,
    },
  };
};

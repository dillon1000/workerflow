import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({ node, render }) => {
  const value = render(String(node.data.config.value ?? ""));
  return {
    detail: "Static text evaluated.",
    output: { value },
  };
};

import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({ evaluateExpression, node }) => {
  const expression = String(node.data.config.expression ?? "false");
  const passed = evaluateExpression(expression);
  return {
    detail: `Condition evaluated to ${String(passed)}.`,
    output: { passed },
  };
};

import type { WorkflowStepRunner } from "../../runtime";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const expression = String(context.node.data.config.expression ?? "false");
  const passed = context.evaluateExpression(expression);
  return ok(`Condition evaluated to ${String(passed)}.`, { passed });
};

import type { WorkflowStepRunner } from "../../runtime";
import { renderedStringConfig } from "../../lib/std/config";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const value = renderedStringConfig(context, "value");
  return ok("Static text evaluated.", { value });
};

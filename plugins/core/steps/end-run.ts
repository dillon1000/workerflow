import type { WorkflowStepRunner } from "../../runtime";
import { renderedStringConfig } from "../../lib/std/config";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const reason = renderedStringConfig(context, "reason").trim();
  return ok(
    reason ? `Run halted by End run: ${reason}` : "Run halted by End run.",
    {
      __workflow_end: true,
      reason,
    },
  );
};

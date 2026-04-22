import type { WorkflowStepRunner } from "../../runtime";
import { readDurationSeconds, validateWorkflowSleepSeconds } from "../../lib/std/time";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const seconds = validateWorkflowSleepSeconds(
    readDurationSeconds(context.node.data.config.durationSeconds, 60),
  );
  await context.step.sleep(`${context.node.id}:sleep`, `${seconds} seconds`);
  return {
    ...ok(`Paused for ${seconds} second(s).`, { sleptFor: seconds }),
    durationMs: seconds * 1000,
  };
};

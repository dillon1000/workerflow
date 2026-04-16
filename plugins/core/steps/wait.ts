import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({ node, step }) => {
  const seconds = Number(node.data.config.durationSeconds ?? 60);
  await step.sleep(`${node.id}:sleep`, `${seconds} seconds`);
  return {
    detail: `Paused for ${seconds} second(s).`,
    durationMs: seconds * 1000,
    output: { sleptFor: seconds },
  };
};

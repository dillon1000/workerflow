import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({ env, node, render }) => {
  if (!env.AI) {
    throw new Error("Workers AI binding is missing.");
  }
  const output = await env.AI.run(String(node.data.config.model), {
    prompt: render(String(node.data.config.prompt ?? "")),
  });
  return {
    detail: "Workers AI image generation complete.",
    output,
  };
};

import type { WorkflowStepRunner } from "../../runtime";
import { renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  if (!context.env.AI) {
    throw new Error("Workers AI binding is missing.");
  }
  const model = String(context.node.data.config.model);
  const prompt = renderedStringConfig(context, "prompt");
  const output = await executeIdempotentEffect<Record<string, unknown>>(
    context,
    {
    provider: "workers-ai",
    operation: "ai-text",
    request: { model, prompt },
    perform: async () =>
      (await context.env.AI!.run(model, {
        prompt,
      })) as Record<string, unknown>,
    },
  );
  return ok("Workers AI text generation complete.", output);
};

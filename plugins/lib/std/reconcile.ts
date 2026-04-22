import type { WorkflowStepExecutionContext } from "../../runtime";
import { executeIdempotentEffect } from "./effects";
import { recordEvent } from "./observe";

export async function executeReconciledEffect<TOutput>(
  context: WorkflowStepExecutionContext,
  input: {
    provider: string;
    operation: string;
    request: unknown;
    reconcile: () => Promise<TOutput | null>;
    perform: (effectKey: string) => Promise<TOutput>;
    remoteRef?: (output: TOutput) => string | undefined;
  },
) {
  const existing = await input.reconcile();
  if (existing != null) {
    recordEvent(context, "effect.reconciled", input.operation, {
      provider: input.provider,
    });
    return existing;
  }

  return executeIdempotentEffect(context, input);
}

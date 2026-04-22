import type { WorkflowEffect } from "../../../apps/web/src/lib/workflow/types";
import type { WorkflowStepExecutionContext } from "../../runtime";
import { stableJsonHash } from "./determinism";
import { recordEvent } from "./observe";

interface ExecuteIdempotentEffectInput<TOutput> {
  provider: string;
  operation: string;
  request: unknown;
  remoteRef?: (output: TOutput) => string | undefined;
  perform: (effectKey: string) => Promise<TOutput>;
}

function buildEffectKey(
  context: WorkflowStepExecutionContext,
  provider: string,
  operation: string,
  requestHash: string,
) {
  return `${context.runId}:${context.node.id}:${provider}:${operation}:${requestHash}`;
}

function completedOutput<TOutput>(effect: WorkflowEffect) {
  return (effect.output ?? null) as TOutput;
}

export async function executeIdempotentEffect<TOutput>(
  context: WorkflowStepExecutionContext,
  input: ExecuteIdempotentEffectInput<TOutput>,
) {
  const requestHash = await stableJsonHash(input.request);
  const effectKey = buildEffectKey(
    context,
    input.provider,
    input.operation,
    requestHash,
  );
  const claimed = await context.repository.claimEffect({
    userId: context.userId,
    runId: context.runId,
    nodeId: context.node.id,
    effectKey,
    provider: input.provider,
    operation: input.operation,
    requestHash,
  });

  recordEvent(context, "effect.claimed", input.operation, {
    effectKey,
    provider: input.provider,
    status: claimed.status,
  });

  if (claimed.status === "complete") {
    recordEvent(context, "effect.replayed", input.operation, {
      effectKey,
      provider: input.provider,
    });
    return completedOutput<TOutput>(claimed);
  }

  try {
    const output = await input.perform(effectKey);
    await context.repository.completeEffect({
      userId: context.userId,
      effectKey,
      output,
      remoteRef: input.remoteRef?.(output),
    });
    recordEvent(context, "effect.completed", input.operation, {
      effectKey,
      provider: input.provider,
    });
    return output;
  } catch (error) {
    await context.repository.failEffect({
      userId: context.userId,
      effectKey,
      error: error instanceof Error ? error.message : "Unknown effect failure.",
    });
    recordEvent(context, "effect.failed", input.operation, {
      effectKey,
      provider: input.provider,
      error: error instanceof Error ? error.message : "Unknown effect failure.",
    });
    throw error;
  }
}

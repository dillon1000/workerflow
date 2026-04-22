import type { WorkflowStepRunner } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { renderedStringConfig } from "../../lib/std/config";
import { logStepMetadataForObservability } from "../../lib/std/observe";

export const run: WorkflowStepRunner = async (context) => {
  logStepMetadataForObservability(context);
  const connection = await requireConnection(context);
  const apiKey = await requireSecret(
    context,
    connection,
    "apiKey",
    "[Plugin Title] connection is missing an API key secret.",
  );
  const input = renderedStringConfig(context, "input");

  throw new Error(
    `Implement [Plugin Title] [Action Title] in plugins/[plugin-kebab]/steps/[action-kebab].ts. Received input: ${input}. Token loaded: ${String(Boolean(apiKey))}`,
  );
};

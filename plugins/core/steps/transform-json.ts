import type { WorkflowStepRunner } from "../../runtime";
import { renderedStringConfig } from "../../lib/std/config";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) =>
  ok(
    "Payload transformed successfully.",
    context.parseMaybeJson(renderedStringConfig(context, "template", "{}")),
  );

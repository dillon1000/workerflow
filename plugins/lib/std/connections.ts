import type { ConnectionDefinition } from "../../../apps/web/src/lib/workflow/types";
import type { WorkflowStepExecutionContext } from "../../runtime";
import { assertNonEmptyString } from "./guards";

export async function requireConnection(
  context: WorkflowStepExecutionContext,
  aliasKey = "connectionAlias",
): Promise<ConnectionDefinition> {
  return context.getConnection(
    assertNonEmptyString(
      String(context.node.data.config[aliasKey] ?? ""),
      "A connection alias is required for this step.",
    ),
  );
}

export async function requireSecret(
  context: WorkflowStepExecutionContext,
  connection: ConnectionDefinition,
  keyName: string,
  message: string,
) {
  const value = await context.getConnectionSecret(connection, keyName);
  if (!value) {
    throw new Error(message);
  }
  return value;
}

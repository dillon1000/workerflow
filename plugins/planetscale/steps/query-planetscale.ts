import type { WorkflowStepRunner } from "../../runtime";
import { executePlanetscaleQuery, parseConnectionString } from "../client";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { renderedStringConfig } from "../../lib/std/config";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const connection = await requireConnection(context);
  const connectionString = await requireSecret(
    context,
    connection,
    "connectionString",
    "PlanetScale connection string is missing.",
  );

  const parsed = parseConnectionString(connectionString);
  const sql = renderedStringConfig(context, "sql");

  const rawParams = renderedStringConfig(context, "params", "[]");
  const paramsValue = context.parseMaybeJson(rawParams);
  const params = Array.isArray(paramsValue) ? (paramsValue as unknown[]) : [];

  const rows = await executePlanetscaleQuery({
    host: parsed.host,
    username: parsed.username,
    password: parsed.password,
    sql,
    params,
  });

  return ok(
    `PlanetScale query returned ${rows.length} row${rows.length === 1 ? "" : "s"}.`,
    { rows, rowCount: rows.length },
  );
};

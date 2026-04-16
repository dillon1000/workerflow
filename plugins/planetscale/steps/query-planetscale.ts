import type { WorkflowStepRunner } from "../../runtime";
import { executePlanetscaleQuery, parseConnectionString } from "../client";

export const run: WorkflowStepRunner = async ({
  getConnection,
  getConnectionSecret,
  node,
  parseMaybeJson,
  render,
}) => {
  const connection = await getConnection(
    String(node.data.config.connectionAlias ?? ""),
  );
  const connectionString = await getConnectionSecret(
    connection,
    "connectionString",
  );
  if (!connectionString) {
    throw new Error("PlanetScale connection string is missing.");
  }

  const parsed = parseConnectionString(connectionString);
  const sql = render(String(node.data.config.sql ?? ""));

  const rawParams = render(String(node.data.config.params ?? "[]"));
  const paramsValue = parseMaybeJson(rawParams);
  const params = Array.isArray(paramsValue) ? (paramsValue as unknown[]) : [];

  const rows = await executePlanetscaleQuery({
    host: parsed.host,
    username: parsed.username,
    password: parsed.password,
    sql,
    params,
  });

  return {
    detail: `PlanetScale query returned ${rows.length} row${rows.length === 1 ? "" : "s"}.`,
    output: { rows, rowCount: rows.length },
  };
};

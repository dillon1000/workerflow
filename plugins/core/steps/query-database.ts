import type { WorkflowStepRunner } from "../../runtime";
import { queryDatabase } from "../../../worker/services/database";

export const run: WorkflowStepRunner = async ({ env, node, render }) => {
  const sql = render(String(node.data.config.sql ?? "select 1 as ok"));
  const rows = await queryDatabase(env, sql);
  return {
    detail: "Query completed against PostgreSQL.",
    output: rows,
  };
};

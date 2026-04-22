import type { WorkflowStepRunner } from "../../runtime";
import { queryDatabase } from "../../../apps/web/worker/services/database";
import { renderedStringConfig } from "../../lib/std/config";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const sql = renderedStringConfig(context, "sql", "select 1 as ok");
  const rows = await queryDatabase(context.env, sql);
  return ok("Query completed against PostgreSQL.", rows);
};

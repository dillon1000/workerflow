import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({ env, node, render }) => {
  const sql = render(String(node.data.config.sql ?? "select 1 as ok"));
  const result = await env.DB.prepare(sql).all();
  return {
    detail: "Query completed against D1.",
    output: result.results,
  };
};

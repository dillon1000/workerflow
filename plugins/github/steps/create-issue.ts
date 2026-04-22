import type { WorkflowStepRunner } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchJson } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

export const run: WorkflowStepRunner = async (context) => {
  const connection = await requireConnection(context);
  const token = await requireSecret(
    context,
    connection,
    "token",
    "GitHub connection is missing a token secret.",
  );

  const owner = renderedStringConfig(context, "owner");
  const repo = renderedStringConfig(context, "repo");
  const title = renderedStringConfig(context, "title");
  const issueBody = renderedStringConfig(context, "body");
  const labels = context.parseList(renderedStringConfig(context, "labels"));
  const assignees = context.parseList(
    renderedStringConfig(context, "assignees"),
  );
  const output: {
    id: number;
    number: number;
    title: string;
    state: string;
    url: string;
  } = await executeIdempotentEffect(context, {
    provider: "github",
    operation: "create-issue",
    request: {
      owner,
      repo,
      title,
      issueBody,
      labels,
      assignees,
    },
    remoteRef: (result) => result.url,
    perform: async (effectKey) => {
      const request = buildHttpRequest(context, {
        method: "POST",
        url: `https://api.github.com/repos/${owner}/${repo}/issues`,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "workerflow",
          "X-GitHub-Api-Version": "2022-11-28",
          "X-Workflow-Effect-Key": effectKey,
        },
        body: JSON.stringify({
          title,
          body: `${issueBody}\n\n<!-- workerflow:${effectKey} -->`,
          labels,
          assignees,
        }),
        provider: "github",
        operation: "create-issue",
      });
      const { response, body } = await fetchJson<{
        html_url: string;
        id: number;
        message?: string;
        number: number;
        state: string;
        title: string;
      }>(context, request);
      if (!response.ok) {
        throw new Error(body.message ?? `GitHub returned ${response.status}.`);
      }

      return {
        id: body.id,
        number: body.number,
        title: body.title,
        state: body.state,
        url: body.html_url,
      };
    },
  });
  return ok(`Created GitHub issue #${output.number}.`, output);
};

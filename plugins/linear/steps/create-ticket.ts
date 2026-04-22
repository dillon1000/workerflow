import type { WorkflowStepRunner } from "../../runtime";
import type { WorkflowStepExecutionContext } from "../../runtime";
import { requireConnection, requireSecret } from "../../lib/std/connections";
import { renderedStringConfig } from "../../lib/std/config";
import { executeIdempotentEffect } from "../../lib/std/effects";
import { buildHttpRequest, fetchJson } from "../../lib/std/http";
import { ok } from "../../lib/std/result";

async function linearRequest<T>(
  context: WorkflowStepExecutionContext,
  token: string,
  query: string,
  variables: Record<string, unknown>,
  effectKey?: string,
) {
  const request = buildHttpRequest(context, {
    method: "POST",
    url: "https://api.linear.app/graphql",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(effectKey ? { "X-Workflow-Effect-Key": effectKey } : {}),
    },
    body: JSON.stringify({ query, variables }),
    provider: "linear",
    operation: "graphql",
  });
  const { response, body } = await fetchJson<{
    data?: T;
    errors?: Array<{ message?: string }>;
  }>(context, request);

  if (!response.ok || body.errors?.length) {
    throw new Error(
      body.errors
        ?.map((error: { message?: string }) => error.message)
        .filter(Boolean)
        .join(" ") || `Linear returned ${response.status}.`,
    );
  }
  if (!body.data) {
    throw new Error("Linear did not return data.");
  }
  return body.data;
}

export const run: WorkflowStepRunner = async (context) => {
  const connection = await requireConnection(context);
  const apiKey = await requireSecret(
    context,
    connection,
    "apiKey",
    "Linear connection is missing an apiKey secret.",
  );

  let teamId =
    renderedStringConfig(context, "teamId") ||
    connection.config.teamId ||
    connection.config.defaultTeamId ||
    "";

  if (!teamId) {
    const teams = await linearRequest<{
      teams: { nodes: Array<{ id: string }> };
    }>(context, apiKey, "query Teams { teams { nodes { id } } }", {});
    teamId = teams.teams.nodes[0]?.id ?? "";
  }

  if (!teamId) {
    throw new Error("Linear teamId could not be resolved.");
  }

  const title = renderedStringConfig(context, "title");
  const description = renderedStringConfig(context, "description");

  const output: { id: string | null; title: string | null; url: string | null } =
    await executeIdempotentEffect(context, {
    provider: "linear",
    operation: "create-ticket",
    request: {
      teamId,
      title,
      description,
    },
    remoteRef: (result) => result.url ?? undefined,
    perform: async (effectKey) => {
      const result = await linearRequest<{
        issueCreate: {
          issue?: { id: string; title: string; url: string };
          success: boolean;
        };
      }>(
        context,
        apiKey,
        `
      mutation CreateIssue($teamId: String!, $title: String!, $description: String!) {
        issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
          success
          issue {
            id
            title
            url
          }
        }
      }
    `,
        {
          teamId,
          title,
          description: `${description}\n\nworkerflow:${effectKey}`,
        },
        effectKey,
      );

      return {
        id: result.issueCreate.issue?.id ?? null,
        title: result.issueCreate.issue?.title ?? null,
        url: result.issueCreate.issue?.url ?? null,
      };
    },
    });

  return ok("Created Linear ticket.", output);
};

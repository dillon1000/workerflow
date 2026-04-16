import type { WorkflowStepRunner } from "../../runtime";

async function linearRequest<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
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

export const run: WorkflowStepRunner = async ({
  getConnection,
  getConnectionSecret,
  node,
  render,
}) => {
  const connection = await getConnection(
    String(node.data.config.connectionAlias ?? ""),
  );
  const apiKey = await getConnectionSecret(connection, "apiKey");
  if (!apiKey) {
    throw new Error("Linear connection is missing an apiKey secret.");
  }

  let teamId =
    render(String(node.data.config.teamId ?? "")) ||
    connection.config.teamId ||
    connection.config.defaultTeamId ||
    "";

  if (!teamId) {
    const teams = await linearRequest<{
      teams: { nodes: Array<{ id: string }> };
    }>(apiKey, "query Teams { teams { nodes { id } } }", {});
    teamId = teams.teams.nodes[0]?.id ?? "";
  }

  if (!teamId) {
    throw new Error("Linear teamId could not be resolved.");
  }

  const result = await linearRequest<{
    issueCreate: {
      issue?: { id: string; title: string; url: string };
      success: boolean;
    };
  }>(
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
      title: render(String(node.data.config.title ?? "")),
      description: render(String(node.data.config.description ?? "")),
    },
  );

  return {
    detail: "Created Linear ticket.",
    output: {
      id: result.issueCreate.issue?.id,
      title: result.issueCreate.issue?.title,
      url: result.issueCreate.issue?.url,
    },
  };
};

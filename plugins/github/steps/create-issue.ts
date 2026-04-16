import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({
  getConnection,
  getConnectionSecret,
  node,
  parseList,
  render,
}) => {
  const connection = await getConnection(
    String(node.data.config.connectionAlias ?? ""),
  );
  const token = await getConnectionSecret(connection, "token");
  if (!token) {
    throw new Error("GitHub connection is missing a token secret.");
  }

  const owner = render(String(node.data.config.owner ?? ""));
  const repo = render(String(node.data.config.repo ?? ""));
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "workerflow",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: render(String(node.data.config.title ?? "")),
        body: render(String(node.data.config.body ?? "")),
        labels: parseList(render(String(node.data.config.labels ?? ""))),
        assignees: parseList(render(String(node.data.config.assignees ?? ""))),
      }),
    },
  );

  const body = (await response.json()) as {
    html_url: string;
    id: number;
    message?: string;
    number: number;
    state: string;
    title: string;
  };
  if (!response.ok) {
    throw new Error(body.message ?? `GitHub returned ${response.status}.`);
  }

  return {
    detail: `Created GitHub issue #${body.number}.`,
    output: {
      id: body.id,
      number: body.number,
      title: body.title,
      state: body.state,
      url: body.html_url,
    },
  };
};

import type { WorkflowStepRunner } from "../../runtime";

export const run: WorkflowStepRunner = async ({
  node,
  parseMaybeJson,
  render,
}) => {
  const method = render(String(node.data.config.method ?? "GET"));
  const url = render(String(node.data.config.url ?? ""));
  const headersValue = render(String(node.data.config.headers ?? "{}"));
  const bodyValue = render(String(node.data.config.body ?? ""));
  const response = await fetch(url, {
    method,
    headers: headersValue
      ? (JSON.parse(headersValue) as HeadersInit)
      : undefined,
    body: method === "GET" ? undefined : bodyValue,
  });
  const text = await response.text();
  return {
    detail: `${method} ${url} returned ${response.status}.`,
    output: parseMaybeJson(text),
    status: response.ok ? "complete" : "errored",
  };
};

import type { Hono } from "hono";
import { z } from "zod";
import type { WorkerEnv } from "../lib/env";
import { createRepository } from "../services/repository";
import { getSecret } from "../services/secrets";
import { requireSession } from "../services/session";
import { workflowNodeDefinitions } from "../../src/lib/workflow/plugin-registry";
import type { WorkflowGraph } from "../../src/lib/workflow/types";

const generateSchema = z.object({
  prompt: z.string().min(1).max(4000),
  connectionAlias: z.string().min(1),
});

function buildSystemPrompt() {
  const nodeCatalog = workflowNodeDefinitions
    .map((node) => {
      const fields = (node.fields ?? [])
        .map(
          (field) =>
            `    - ${field.key}${field.required ? "*" : ""} (${field.kind})${field.description ? `: ${field.description}` : ""}`,
        )
        .join("\n");
      const defaults = JSON.stringify(node.defaultConfig);
      return `- kind="${node.kind}" family=${node.family} title="${node.title}" subtitle="${node.subtitle}"\n  defaults: ${defaults}${fields ? `\n  fields:\n${fields}` : ""}`;
    })
    .join("\n");

  return `You are a workflow graph generator for the Workerflow platform. You output ONLY a JSON object matching this TypeScript type:

type WorkflowGraph = {
  nodes: Array<{
    id: string; // "node_" + 8 hex chars
    type: "trigger" | "action" | "logic" | "data";
    position: { x: number; y: number };
    data: {
      title: string;
      subtitle: string;
      family: "trigger" | "action" | "logic" | "data";
      kind: string;        // MUST be one of the available kinds below
      config: Record<string, unknown>;
      accent: string;      // copy from the catalog entry
      enabled?: boolean;
    };
  }>;
  edges: Array<{
    id: string; // "edge_" + 8 hex chars
    source: string; // node id
    target: string; // node id
    data?: { label?: string; branch?: "true" | "false" | "success" };
  }>;
};

Rules:
- Exactly one trigger node.
- Every non-trigger node must have at least one incoming edge.
- Lay out nodes left-to-right: trigger at x=80, and each next column at x += 280. y values around 160 with +/-140 offsets for branches.
- For "condition" nodes, emit two outgoing edges with data.branch = "true" and "false".
- Use only kinds from the catalog. Prefer sensible defaults from each catalog entry when filling config.
- ids should be globally unique short strings (e.g. "node_a1b2c3d4").

Available node kinds:
${nodeCatalog}

Respond with ONLY the JSON object, no prose, no code fences.`;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model response did not contain a JSON object.");
  }
  return JSON.parse(source.slice(start, end + 1));
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  system: string,
  prompt: string,
  model: string,
) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Provider error ${response.status}.`);
  }
  return body.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  apiKey: string,
  system: string,
  prompt: string,
  model: string,
) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const body = (await response.json()) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Anthropic error ${response.status}.`);
  }
  return (
    body.content?.find((part) => part.type === "text")?.text ?? ""
  );
}

export function mountAiGenerateRoutes(app: Hono<{ Bindings: WorkerEnv }>) {
  app.post("/api/workflows/generate", async (c) => {
    const session = await requireSession(c);
    const repository = await createRepository(c.env);
    const body = generateSchema.parse(await c.req.json());
    const connection = await repository.getConnectionByAlias(
      session.user.id,
      body.connectionAlias,
    );
    if (!connection) {
      return c.json({ message: "Connection not found." }, 404);
    }
    const apiKey = await getSecret(
      c.env,
      session.user.id,
      connection.id,
      "apiKey",
    );
    if (!apiKey) {
      return c.json({ message: "Connection is missing an apiKey secret." }, 400);
    }

    const system = buildSystemPrompt();
    let raw = "";
    try {
      if (connection.provider === "openai") {
        const baseUrl =
          String(connection.config.baseUrl ?? "").trim() ||
          "https://api.openai.com/v1";
        raw = await callOpenAICompatible(
          baseUrl,
          apiKey,
          system,
          body.prompt,
          "gpt-4o-mini",
        );
      } else if (connection.provider === "openrouter") {
        raw = await callOpenAICompatible(
          "https://openrouter.ai/api/v1",
          apiKey,
          system,
          body.prompt,
          String(connection.config.model ?? "openai/gpt-4o-mini"),
        );
      } else if (connection.provider === "anthropic") {
        raw = await callAnthropic(
          apiKey,
          system,
          body.prompt,
          "claude-sonnet-4-5",
        );
      } else {
        return c.json(
          {
            message: `Provider "${connection.provider}" is not supported for generation.`,
          },
          400,
        );
      }
    } catch (error) {
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "AI provider request failed.",
        },
        502,
      );
    }

    let graph: WorkflowGraph;
    try {
      graph = extractJson(raw) as WorkflowGraph;
    } catch (error) {
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Could not parse model response.",
        },
        502,
      );
    }

    return c.json({
      graph,
      notes: `Generated via ${connection.provider}/${connection.alias}.`,
    });
  });
}

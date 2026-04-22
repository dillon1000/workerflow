import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConnectionDefinition,
  WorkflowEffect,
  WorkflowNode,
} from "../../src/lib/workflow/types";
import type { WorkflowStepExecutionContext } from "../../../../plugins/runtime";
import { storeSecret } from "../../worker/services/secrets";
import { run as runAiImage } from "../../../../plugins/core/steps/ai-image";
import { run as runAiText } from "../../../../plugins/core/steps/ai-text";
import { run as runHttpRequest } from "../../../../plugins/core/steps/http-request";
import { run as runDiscordMessage } from "../../../../plugins/discord/steps/send-message";
import { run as runFal } from "../../../../plugins/fal/steps/fal-run";
import { run as runGithubIssue } from "../../../../plugins/github/steps/create-issue";
import { run as runLinearTicket } from "../../../../plugins/linear/steps/create-ticket";
import { run as runAnthropicChat } from "../../../../plugins/anthropic/steps/anthropic-chat";
import { run as runOpenaiChat } from "../../../../plugins/openai/steps/openai-chat";
import { run as runOpenaiImage } from "../../../../plugins/openai/steps/openai-image";
import { run as runOpenrouterChat } from "../../../../plugins/openrouter/steps/openrouter-chat";
import { run as runPlanetscaleQuery } from "../../../../plugins/planetscale/steps/query-planetscale";
import { testConnection as testAnthropicConnection } from "../../../../plugins/anthropic/test";
import { testConnection as testDiscordConnection } from "../../../../plugins/discord/test";
import { testConnection as testFalConnection } from "../../../../plugins/fal/test";
import { testConnection as testGithubConnection } from "../../../../plugins/github/test";
import { testConnection as testLinearConnection } from "../../../../plugins/linear/test";
import { testConnection as testOpenaiConnection } from "../../../../plugins/openai/test";
import { testConnection as testOpenrouterConnection } from "../../../../plugins/openrouter/test";
import { testConnection as testPlanetscaleConnection } from "../../../../plugins/planetscale/test";

const planetscaleMocks = vi.hoisted(() => ({
  executePlanetscaleQuery: vi.fn(),
  parseConnectionString: vi.fn(),
}));

vi.mock("../../../../plugins/planetscale/client", () => ({
  executePlanetscaleQuery: planetscaleMocks.executePlanetscaleQuery,
  parseConnectionString: planetscaleMocks.parseConnectionString,
}));

function createKvNamespace() {
  const values = new Map<string, string>();

  return {
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    },
  };
}

function createConnection(
  overrides: Partial<ConnectionDefinition> = {},
): ConnectionDefinition {
  return {
    id: "conn-1",
    provider: "custom",
    alias: "primary",
    label: "Primary",
    status: "connected",
    config: {},
    notes: "",
    secretKeys: [],
    hasSecrets: true,
    updatedAt: "2026-04-20T00:00:00.000Z",
    createdAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

function createNode(
  kind: string,
  config: Record<string, unknown>,
): WorkflowNode {
  return {
    id: `${kind}-node`,
    type: "action",
    position: { x: 0, y: 0 },
    data: {
      title: kind,
      subtitle: "",
      family: "action",
      kind,
      accent: "from-stone-900 via-stone-800 to-stone-700",
      config,
    },
  };
}

function createStepContext(
  node: WorkflowNode,
  options: {
    connection?: ConnectionDefinition;
    secrets?: Record<string, string | null>;
    env?: WorkflowStepExecutionContext["env"];
  } = {},
) {
  const connection = options.connection ?? createConnection();
  const secrets = options.secrets ?? {};
  const effects = new Map<string, WorkflowEffect>();
  const traceEvents = [] as NonNullable<
    WorkflowStepExecutionContext["getTraceEvents"]
  > extends () => infer T
    ? T
    : never;

  const context: WorkflowStepExecutionContext = {
    env:
      options.env ??
      ({
        HYPERDRIVE: {
          connectionString: "",
        },
      } as WorkflowStepExecutionContext["env"]),
    repository: {
      getConnectionByAlias: vi.fn(),
      claimEffect: vi.fn(async (input) => {
        const existing = effects.get(input.effectKey);
        if (existing) return existing;
        const claimed: WorkflowEffect = {
          id: `effect:${input.effectKey}`,
          userId: input.userId,
          runId: input.runId,
          nodeId: input.nodeId,
          effectKey: input.effectKey,
          provider: input.provider,
          operation: input.operation,
          status: "pending",
          requestHash: input.requestHash,
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z",
        };
        effects.set(input.effectKey, claimed);
        return claimed;
      }),
      completeEffect: vi.fn(async (input) => {
        const current = effects.get(input.effectKey);
        if (!current) throw new Error("Effect not found.");
        const next: WorkflowEffect = {
          ...current,
          status: "complete",
          output: input.output,
          remoteRef: input.remoteRef,
          updatedAt: "2026-04-20T00:00:01.000Z",
        };
        effects.set(input.effectKey, next);
        return next;
      }),
      failEffect: vi.fn(async (input) => {
        const current = effects.get(input.effectKey);
        if (!current) throw new Error("Effect not found.");
        const next: WorkflowEffect = {
          ...current,
          status: "failed",
          error: input.error,
          updatedAt: "2026-04-20T00:00:01.000Z",
        };
        effects.set(input.effectKey, next);
        return next;
      }),
      upsertRunStep: vi.fn(),
    },
    userId: "user-1",
    runId: "run-1",
    node,
    payload: {},
    outputs: {},
    nodes: [node],
    step: {
      sleep: vi.fn(async () => {}),
    },
    render: (value: string) => value,
    parseList: (value: string) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    parseMaybeJson: (value: string) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    },
    evaluateExpression: () => false,
    getConnection: vi.fn(async () => connection),
    getConnectionSecret: vi.fn(async (_connection, keyName: string) =>
      Object.prototype.hasOwnProperty.call(secrets, keyName)
        ? secrets[keyName] ?? null
        : null,
    ),
    runSubworkflow: vi.fn(),
    recordTraceEvent: vi.fn((event) => {
      const next = {
        ...event,
        createdAt: event.createdAt ?? "2026-04-20T00:00:00.000Z",
      };
      traceEvents.push(next);
      return next;
    }),
    getTraceEvents: vi.fn(() => [...traceEvents]),
  };

  return { connection, context };
}

function requestHeaders(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
  return new Headers(fetchMock.mock.calls[callIndex]?.[1]?.headers);
}

describe("external service blocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planetscaleMocks.parseConnectionString.mockReturnValue({
      host: "aws.connect.psdb.cloud",
      username: "user",
      password: "pass",
    });
  });

  it("creates GitHub issues with the configured token and parsed lists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 99,
        number: 12,
        title: "Created by workflow",
        state: "open",
        html_url: "https://github.com/owner/repo/issues/12",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { context } = createStepContext(
      createNode("githubAction", {
        connectionAlias: "primary",
        owner: "owner",
        repo: "repo",
        title: "Created by workflow",
        body: "Body",
        labels: "bug,automation",
        assignees: "alice,bob",
      }),
      {
        connection: createConnection({ provider: "github" }),
        secrets: { token: "gh-token" },
      },
    );

    await expect(runGithubIssue(context)).resolves.toMatchObject({
      detail: "Created GitHub issue #12.",
      output: expect.objectContaining({
        number: 12,
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/issues",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requestHeaders(fetchMock, 0).get("Authorization")).toBe(
      "Bearer gh-token",
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      "\"title\":\"Created by workflow\"",
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      "<!-- workerflow:",
    );
  });

  it("creates Linear tickets with GraphQL and the configured API key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            issueCreate: {
              success: true,
              issue: {
                id: "lin-1",
                title: "Workflow follow-up",
                url: "https://linear.app/issue/LIN-1",
              },
            },
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { context } = createStepContext(
      createNode("linearAction", {
        connectionAlias: "primary",
        teamId: "TEAM",
        title: "Workflow follow-up",
        description: "Created from workflow output",
      }),
      {
        connection: createConnection({ provider: "linear" }),
        secrets: { apiKey: "lin-api-key" },
      },
    );

    await expect(runLinearTicket(context)).resolves.toMatchObject({
      detail: "Created Linear ticket.",
      output: expect.objectContaining({
        id: "lin-1",
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.app/graphql",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requestHeaders(fetchMock, 0).get("Authorization")).toBe(
      "lin-api-key",
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      "workerflow:",
    );
  });

  it("sends Discord webhook payloads and validates content length", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg-1",
        content: "hello from workerflow",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { context } = createStepContext(
      createNode("discordSendMessage", {
        connectionAlias: "primary",
        content: "hello from workerflow",
        username: "Workerflow",
        avatarUrl: "https://example.com/avatar.png",
        tts: "false",
      }),
      {
        connection: createConnection({ provider: "discord" }),
        secrets: { webhookUrl: "https://discord.com/api/webhooks/test" },
      },
    );

    await expect(runDiscordMessage(context)).resolves.toMatchObject({
      detail: "Discord message sent successfully.",
    });

    const tooLongContext = createStepContext(
      createNode("discordSendMessage", {
        connectionAlias: "primary",
        content: "x".repeat(2001),
      }),
      {
        connection: createConnection({ provider: "discord" }),
        secrets: { webhookUrl: "https://discord.com/api/webhooks/test" },
      },
    ).context;

    await expect(runDiscordMessage(tooLongContext)).rejects.toThrow(
      "Message content exceeds Discord's 2000 character limit.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/test",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("calls OpenAI chat and image endpoints with the configured base URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "hello" } }],
          usage: { total_tokens: 10 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ url: "https://example.com/image.png" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const connection = createConnection({
      provider: "openai",
      config: { baseUrl: "https://openai.example/v1/" },
    });

    await expect(
      runOpenaiChat(
        createStepContext(
          createNode("openaiChat", {
            connectionAlias: "primary",
            model: "gpt-5.4",
            prompt: "Hi",
          }),
          {
            connection,
            secrets: { apiKey: "oa-key" },
          },
        ).context,
      ),
    ).resolves.toMatchObject({
      detail: "OpenAI chat completion succeeded.",
    });

    await expect(
      runOpenaiImage(
        createStepContext(
          createNode("openaiImage", {
            connectionAlias: "primary",
            model: "gpt-image-1",
            prompt: "Draw a cat",
            size: "1024x1024",
          }),
          {
            connection,
            secrets: { apiKey: "oa-key" },
          },
        ).context,
      ),
    ).resolves.toMatchObject({
      detail: "OpenAI image generated.",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://openai.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requestHeaders(fetchMock, 0).get("Authorization")).toBe(
      "Bearer oa-key",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://openai.example/v1/images/generations",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requestHeaders(fetchMock, 1).get("Authorization")).toBe(
      "Bearer oa-key",
    );
  });

  it("calls OpenRouter, Anthropic, and fal with provider-specific auth headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "openrouter-ok" } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "anthropic-ok" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          image: "https://example.com/fal.png",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await runOpenrouterChat(
      createStepContext(
        createNode("openrouterChat", {
          connectionAlias: "primary",
          model: "openai/gpt-4o-mini",
          prompt: "Hi",
        }),
        {
          connection: createConnection({
            provider: "openrouter",
            config: {
              referer: "https://workerflow.app",
              title: "Workerflow",
            },
          }),
          secrets: { apiKey: "or-key" },
        },
      ).context,
    );

    await runAnthropicChat(
      createStepContext(
        createNode("anthropicChat", {
          connectionAlias: "primary",
          model: "claude-sonnet-4-6",
          prompt: "Hi",
          maxTokens: 128,
        }),
        {
          connection: createConnection({ provider: "anthropic" }),
          secrets: { apiKey: "anth-key" },
        },
      ).context,
    );

    await runFal(
      createStepContext(
        createNode("falRun", {
          connectionAlias: "primary",
          model: "fal-ai/flux/schnell",
          input: '{"prompt":"make art"}',
        }),
        {
          connection: createConnection({ provider: "fal" }),
          secrets: { apiKey: "fal-key" },
        },
      ).context,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requestHeaders(fetchMock, 0).get("Authorization")).toBe(
      "Bearer or-key",
    );
    expect(requestHeaders(fetchMock, 0).get("HTTP-Referer")).toBe(
      "https://workerflow.app",
    );
    expect(requestHeaders(fetchMock, 0).get("X-Title")).toBe("Workerflow");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requestHeaders(fetchMock, 1).get("x-api-key")).toBe("anth-key");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://fal.run/fal-ai/flux/schnell",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requestHeaders(fetchMock, 2).get("Authorization")).toBe("Key fal-key");
  });

  it("uses Workers AI bindings and generic HTTP blocks correctly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });
    const aiRun = vi.fn().mockResolvedValue({ result: "ok" });
    vi.stubGlobal("fetch", fetchMock);

    const aiEnv = {
      AI: {
        run: aiRun,
      },
      HYPERDRIVE: {
        connectionString: "",
      },
    };

    await runAiText(
      createStepContext(
        createNode("aiText", {
          model: "@cf/meta/llama-3.1-8b-instruct",
          prompt: "hello",
        }),
        {
          env: aiEnv,
        },
      ).context,
    );
    await runAiImage(
      createStepContext(
        createNode("aiImage", {
          model: "@cf/black-forest-labs/flux-1-schnell",
          prompt: "draw something",
        }),
        {
          env: aiEnv,
        },
      ).context,
    );
    await runHttpRequest(
      createStepContext(
        createNode("httpRequest", {
          method: "POST",
          url: "https://example.com/webhook",
          headers: '{"x-test":"1"}',
          body: '{"ok":true}',
        }),
      ).context,
    );

    expect(aiRun).toHaveBeenNthCalledWith(1, "@cf/meta/llama-3.1-8b-instruct", {
      prompt: "hello",
    });
    expect(aiRun).toHaveBeenNthCalledWith(
      2,
      "@cf/black-forest-labs/flux-1-schnell",
      {
        prompt: "draw something",
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        body: '{"ok":true}',
      }),
    );
    expect(requestHeaders(fetchMock, 0).get("x-test")).toBe("1");
  });

  it("runs PlanetScale queries through the client helper", async () => {
    planetscaleMocks.executePlanetscaleQuery.mockResolvedValueOnce([
      { id: 1, name: "Ada" },
    ]);

    const result = await runPlanetscaleQuery(
      createStepContext(
        createNode("queryPlanetscale", {
          connectionAlias: "primary",
          sql: "select * from users where id = ?",
          params: "[1]",
        }),
        {
          connection: createConnection({ provider: "planetscale" }),
          secrets: { connectionString: "mysql://user:pass@host/db" },
        },
      ).context,
    );

    expect(result).toMatchObject({
      detail: "PlanetScale query returned 1 row.",
      output: {
        rowCount: 1,
      },
    });
    expect(planetscaleMocks.parseConnectionString).toHaveBeenCalledWith(
      "mysql://user:pass@host/db",
    );
    expect(planetscaleMocks.executePlanetscaleQuery).toHaveBeenCalledWith({
      host: "aws.connect.psdb.cloud",
      username: "user",
      password: "pass",
      sql: "select * from users where id = ?",
      params: [1],
    });
  });
});

describe("connection test modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planetscaleMocks.parseConnectionString.mockReturnValue({
      host: "aws.connect.psdb.cloud",
      username: "user",
      password: "pass",
    });
  });

  it("returns clear missing-secret messages for provider connection checks", async () => {
    const env = {
      SECRETS_KV: createKvNamespace(),
      SECRETS_KEY: "",
    };
    const connection = createConnection();

    await expect(
      testGithubConnection({
        connection: createConnection({ ...connection, provider: "github" }),
        env,
        userId: "user-1",
      }),
    ).resolves.toEqual({
      success: false,
      message: "GitHub token secret is missing.",
    });

    await expect(
      testLinearConnection({
        connection: createConnection({ ...connection, provider: "linear" }),
        env,
        userId: "user-1",
      }),
    ).resolves.toEqual({
      success: false,
      message: "Linear apiKey secret is missing.",
    });

    await expect(
      testDiscordConnection({
        connection: createConnection({ ...connection, provider: "discord" }),
        env,
        userId: "user-1",
      }),
    ).resolves.toEqual({
      success: false,
      message: "Discord webhook URL is missing.",
    });
  });

  it("checks provider endpoints with the expected auth scheme", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const env = {
      SECRETS_KV: createKvNamespace(),
      SECRETS_KEY: "",
    };

    const github = createConnection({ id: "github-conn", provider: "github" });
    const linear = createConnection({ id: "linear-conn", provider: "linear" });
    const openai = createConnection({
      id: "openai-conn",
      provider: "openai",
      config: { baseUrl: "https://openai.example/v1/" },
    });
    const openrouter = createConnection({
      id: "openrouter-conn",
      provider: "openrouter",
    });
    const anthropic = createConnection({
      id: "anthropic-conn",
      provider: "anthropic",
    });
    const fal = createConnection({ id: "fal-conn", provider: "fal" });
    const discord = createConnection({
      id: "discord-conn",
      provider: "discord",
    });
    const planetscale = createConnection({
      id: "planetscale-conn",
      provider: "planetscale",
    });

    await storeSecret(env as never, "user-1", github.id, "token", "gh-token");
    await storeSecret(env as never, "user-1", linear.id, "apiKey", "lin-key");
    await storeSecret(env as never, "user-1", openai.id, "apiKey", "oa-key");
    await storeSecret(
      env as never,
      "user-1",
      openrouter.id,
      "apiKey",
      "or-key",
    );
    await storeSecret(
      env as never,
      "user-1",
      anthropic.id,
      "apiKey",
      "anth-key",
    );
    await storeSecret(env as never, "user-1", fal.id, "apiKey", "fal-key");
    await storeSecret(
      env as never,
      "user-1",
      discord.id,
      "webhookUrl",
      "https://discord.com/api/webhooks/test",
    );
    await storeSecret(
      env as never,
      "user-1",
      planetscale.id,
      "connectionString",
      "mysql://user:pass@host/db",
    );
    planetscaleMocks.executePlanetscaleQuery.mockResolvedValueOnce([{ ok: 1 }]);

    await expect(
      testGithubConnection({ connection: github, env, userId: "user-1" }),
    ).resolves.toEqual({
      success: true,
      message: "GitHub connection validated.",
    });
    await expect(
      testLinearConnection({ connection: linear, env, userId: "user-1" }),
    ).resolves.toEqual({
      success: true,
      message: "Linear connection validated.",
    });
    await expect(
      testOpenaiConnection({ connection: openai, env, userId: "user-1" }),
    ).resolves.toEqual({
      success: true,
      message: "OpenAI connection validated.",
    });
    await expect(
      testOpenrouterConnection({
        connection: openrouter,
        env,
        userId: "user-1",
      }),
    ).resolves.toEqual({
      success: true,
      message: "OpenRouter connection validated.",
    });
    await expect(
      testAnthropicConnection({
        connection: anthropic,
        env,
        userId: "user-1",
      }),
    ).resolves.toEqual({
      success: true,
      message: "Anthropic connection validated.",
    });
    await expect(
      testFalConnection({ connection: fal, env, userId: "user-1" }),
    ).resolves.toEqual({
      success: true,
      message: "fal.ai connection validated.",
    });
    await expect(
      testDiscordConnection({ connection: discord, env, userId: "user-1" }),
    ).resolves.toEqual({
      success: true,
      message: "Discord webhook connection validated.",
    });
    await expect(
      testPlanetscaleConnection({
        connection: planetscale,
        env,
        userId: "user-1",
      }),
    ).resolves.toEqual({
      success: true,
      message: "PlanetScale connection validated.",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer gh-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.linear.app/graphql",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "lin-key",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://openai.example/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer oa-key",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://openrouter.ai/api/v1/auth/key",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer or-key",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "anth-key",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://queue.fal.run/",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Key fal-key",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "https://discord.com/api/webhooks/test",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(planetscaleMocks.executePlanetscaleQuery).toHaveBeenCalledWith({
      host: "aws.connect.psdb.cloud",
      username: "user",
      password: "pass",
      sql: "select 1 as ok",
      params: [],
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  applyIdempotencyHeaders,
  basicAuthHeaders,
  bearerAuthHeaders,
} from "../../../../plugins/lib/std/auth";
import { mergeHeaders } from "../../../../plugins/lib/std/auth";
import {
  constantRetryConfig,
  createRetryConfig,
  currentAttempt,
  currentStepConfig,
  noRetryConfig,
} from "../../../../plugins/lib/std/retry";
import { collectPaginated, cursorPage } from "../../../../plugins/lib/std/pagination";
import { executeReconciledEffect } from "../../../../plugins/lib/std/reconcile";
import {
  CLOUDFLARE_WORKFLOW_EVENT_TYPES,
  logStepMetadataForObservability,
  recordCloudflareMetricHint,
} from "../../../../plugins/lib/std/observe";
import {
  redactForTrace,
  redactHeaders,
  shouldRedactKey,
} from "../../../../plugins/lib/std/redaction";
import {
  decodeObject,
  numberField,
  optional,
  stringField,
} from "../../../../plugins/lib/std/schema";
import {
  signWebhookPayload,
  verifyWebhookSignature,
} from "../../../../plugins/lib/std/webhooks";
import { normalizePageSize } from "../../../../plugins/lib/std/limits";
import type { WorkflowEffect, WorkflowNode } from "../../src/lib/workflow/types";
import type { WorkflowStepExecutionContext } from "../../../../plugins/runtime";

function createContext(): WorkflowStepExecutionContext {
  const effects = new Map<string, WorkflowEffect>();
  const traceEvents: ReturnType<WorkflowStepExecutionContext["getTraceEvents"]> =
    [];
  const node: WorkflowNode = {
    id: "node-1",
    type: "action",
    position: { x: 0, y: 0 },
    data: {
      title: "Node 1",
      subtitle: "",
      family: "action",
      kind: "custom",
      config: {},
      accent: "",
    },
  };

  return {
    env: {
      HYPERDRIVE: {
        connectionString: "",
      },
    },
    repository: {
      getConnectionByAlias: vi.fn(),
      upsertRunStep: vi.fn(),
      claimEffect: vi.fn(async (input) => {
        const existing = effects.get(input.effectKey);
        if (existing) {
          return existing;
        }
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
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        };
        effects.set(input.effectKey, claimed);
        return claimed;
      }),
      completeEffect: vi.fn(async (input) => {
        const current = [...effects.values()].find(
          (effect) => effect.effectKey === input.effectKey,
        );
        if (!current) throw new Error("Effect not found.");
        const next: WorkflowEffect = {
          ...current,
          status: "complete",
          output: input.output,
          remoteRef: input.remoteRef,
        };
        effects.set(input.effectKey, next);
        return next;
      }),
      failEffect: vi.fn(async (input) => {
        const current = [...effects.values()].find(
          (effect) => effect.effectKey === input.effectKey,
        );
        if (!current) throw new Error("Effect not found.");
        const next: WorkflowEffect = {
          ...current,
          status: "failed",
          error: input.error,
        };
        effects.set(input.effectKey, next);
        return next;
      }),
    },
    userId: "user-1",
    runId: "run-1",
    node,
    payload: {},
    outputs: {},
    nodes: [node],
    step: {
      do: async <T>(
        name: string,
        callbackOrConfig:
          | ((context: { attempt: number }) => Promise<T>)
          | Record<string, unknown>,
        maybeCallback?: (context: { attempt: number }) => Promise<T>,
      ) => {
        void name;
        const callback =
          typeof callbackOrConfig === "function"
            ? callbackOrConfig
            : maybeCallback!;
        return callback({
          attempt: 1,
        });
      },
      sleep: vi.fn(async () => {}),
    },
    stepName: "node-1:custom",
    stepConfig: createRetryConfig(),
    stepContext: {
      attempt: 1,
    },
    render: (value) => value,
    parseList: (value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    parseMaybeJson: (value) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    },
    evaluateExpression: vi.fn(() => true),
    getConnection: vi.fn(),
    getConnectionSecret: vi.fn(),
    runSubworkflow: vi.fn(),
    recordTraceEvent: vi.fn((event) => {
      const next = {
        ...event,
        createdAt: event.createdAt ?? "2026-04-21T00:00:00.000Z",
      };
      traceEvents.push(next);
      return next;
    }),
    getTraceEvents: vi.fn(() => [...traceEvents]),
  };
}

describe("plugin stdlib", () => {
  it("builds auth headers and idempotency headers", () => {
    const bearer = bearerAuthHeaders("token", { "x-test": "1" });
    expect(bearer.get("Authorization")).toBe("Bearer token");
    expect(bearer.get("x-test")).toBe("1");

    const basic = basicAuthHeaders("user", "pass");
    expect(basic.get("Authorization")).toMatch(/^Basic /);

    const effect = applyIdempotencyHeaders("effect-1", mergeHeaders(bearer));
    expect(effect.get("X-Workflow-Effect-Key")).toBe("effect-1");
  });

  it("redacts sensitive keys for trace safety", () => {
    expect(shouldRedactKey("authorization")).toBe(true);
    expect(
      redactHeaders({
        Authorization: "Bearer token",
        "x-test": "1",
      }),
    ).toEqual({
      authorization: "[redacted]",
      "x-test": "1",
    });

    expect(
      redactForTrace({
        apiKey: "secret",
        nested: { token: "abc", visible: "ok" },
      }),
    ).toEqual({
      apiKey: "[redacted]",
      nested: { token: "[redacted]", visible: "ok" },
    });
  });

  it("decodes lightweight schemas", () => {
    const decoded = decodeObject(
      {
        title: " Hello ",
        count: "3",
        notes: "",
      },
      {
        title: stringField("title", { minLength: 1 }),
        count: numberField("count", { min: 1 }),
        notes: optional(stringField("notes")),
      },
    );

    expect(decoded).toEqual({
      title: "Hello",
      count: 3,
      notes: undefined,
    });
  });

  it("collects paginated responses with bounded pages", async () => {
    const result = await collectPaginated({
      getPage: async (cursor?: string | null) => {
        if (!cursor) return cursorPage([1, 2], "next");
        return cursorPage([3], null);
      },
    });

    expect(result).toEqual([1, 2, 3]);
    expect(normalizePageSize(999)).toBe(250);
  });

  it("verifies webhook signatures", async () => {
    const payload = JSON.stringify({ ok: true });
    const signature = await signWebhookPayload("secret", payload);
    await expect(
      verifyWebhookSignature({
        secret: "secret",
        payload,
        signature,
      }),
    ).resolves.toBeUndefined();
  });

  it("builds retry configuration and exposes step metadata", () => {
    const context = createContext();
    expect(createRetryConfig()).toMatchObject({
      retries: {
        delay: "10 seconds",
        backoff: "exponential",
      },
      timeout: "30 minutes",
    });
    expect(noRetryConfig()).toMatchObject({
      retries: {
        limit: 0,
        backoff: "constant",
      },
    });
    expect(constantRetryConfig({ limit: 2 })).toMatchObject({
      retries: {
        limit: 2,
        backoff: "constant",
      },
    });
    expect(currentAttempt(context)).toBe(1);
    expect(currentStepConfig(context)).toMatchObject({
      retries: {
        backoff: "exponential",
      },
    });
  });

  it("logs Cloudflare step metadata and metric hints", () => {
    const context = createContext();
    logStepMetadataForObservability(context);
    recordCloudflareMetricHint(context, "STEP_START");
    expect(CLOUDFLARE_WORKFLOW_EVENT_TYPES).toContain("WORKFLOW_SUCCESS");
    expect(context.recordTraceEvent).toHaveBeenCalled();
  });

  it("reconciles before performing a new effect", async () => {
    const context = createContext();
    const perform = vi.fn(async () => ({ id: "created" }));

    const existing = await executeReconciledEffect(context, {
      provider: "github",
      operation: "create-issue",
      request: { title: "Test" },
      reconcile: async () => ({ id: "existing" }),
      perform,
    });
    expect(existing).toEqual({ id: "existing" });
    expect(perform).not.toHaveBeenCalled();

    const created = await executeReconciledEffect(context, {
      provider: "github",
      operation: "create-issue",
      request: { title: "Create" },
      reconcile: async () => null,
      perform,
    });
    expect(created).toEqual({ id: "created" });
    expect(perform).toHaveBeenCalledTimes(1);
  });
});

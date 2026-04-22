import { describe, expect, it } from "vitest";
import type { WorkerEnv } from "../../worker/lib/env";
import {
  deleteSecret,
  getSecret,
  storeSecret,
} from "../../worker/services/secrets";

function createKvNamespace() {
  const values = new Map<string, string>();

  return {
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async getWithMetadata(key: string) {
      return {
        value: values.get(key) ?? null,
        metadata: null,
      };
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    },
    async list() {
      return {
        keys: [],
        list_complete: true,
        cursor: "",
      };
    },
    snapshot() {
      return new Map(values);
    },
  };
}

function createEnv(secretKey: string) {
  const kv = createKvNamespace();

  const env: WorkerEnv = {
    SECRETS_KV: kv as unknown as KVNamespace,
    SECRETS_KEY: secretKey,
    HYPERDRIVE: {
      connectionString: "",
    } as Hyperdrive,
    AI: {} as Ai,
    WORKFLOW_RUNNER: {} as Workflow<unknown>,
    BETTER_AUTH_SECRET: "",
    BETTER_AUTH_URL: "",
  };

  return { env, kv };
}

describe("secrets service", () => {
  it("round-trips encrypted secrets when SECRETS_KEY is configured", async () => {
    const { env, kv } = createEnv(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    await storeSecret(env, "user-1", "conn-1", "token", "top-secret");

    const stored = kv.snapshot().get("secret:user-1:conn-1:token");
    expect(stored).toBeTypeOf("string");
    expect(stored?.startsWith("enc:")).toBe(true);
    expect(stored).not.toContain("top-secret");

    await expect(getSecret(env, "user-1", "conn-1", "token")).resolves.toBe(
      "top-secret",
    );
  });

  it("falls back to plain storage when SECRETS_KEY is absent", async () => {
    const { env, kv } = createEnv("");

    await storeSecret(env, "user-1", "conn-1", "webhookSecret", "whsec_123");

    expect(kv.snapshot().get("secret:user-1:conn-1:webhookSecret")).toBe(
      "plain:whsec_123",
    );
    await expect(
      getSecret(env, "user-1", "conn-1", "webhookSecret"),
    ).resolves.toBe("whsec_123");
  });

  it("deletes stored secrets", async () => {
    const { env } = createEnv("");

    await storeSecret(env, "user-1", "conn-1", "token", "value");
    await deleteSecret(env, "user-1", "conn-1", "token");

    await expect(getSecret(env, "user-1", "conn-1", "token")).resolves.toBe(
      null,
    );
  });
});

import type { WorkflowTriggerHandler } from "../runtime";
import type { WorkerEnv } from "../../worker/lib/env";

export const triggerHandlers: WorkflowTriggerHandler[] = [
  {
    kind: "github",
    preparePayload({ headers, payload }) {
      return {
        ...payload,
        githubEvent: headers.get("x-github-event") ?? "",
      };
    },
    matches(node, payload) {
      const repository = payload.repository as
        | { full_name?: string }
        | undefined;
      const action = String(payload.action ?? "").toLowerCase();
      const event = String(payload.githubEvent ?? "").toLowerCase();
      const expectedEvent = String(node.data.config.event ?? "").toLowerCase();
      const expectedAction = String(
        node.data.config.action ?? "",
      ).toLowerCase();
      const expectedRepo = String(
        node.data.config.repository ?? "",
      ).toLowerCase();
      const actualRepo = String(repository?.full_name ?? "").toLowerCase();
      return (
        (!expectedEvent || expectedEvent === event) &&
        (!expectedAction || expectedAction === action) &&
        (!expectedRepo || expectedRepo === actualRepo)
      );
    },
    async verify({ env, headers, node, rawBody, repository, userId }) {
      const alias = String(node.data.config.connectionAlias ?? "");
      if (!alias) {
        throw new Error(
          "GitHub triggers must reference an in-app connection alias.",
        );
      }

      const connection = await repository.getConnectionByAlias(userId, alias);
      if (!connection) {
        throw new Error(`GitHub connection "${alias}" was not found.`);
      }

      const { getSecret } = await import("../../worker/services/secrets");
      const secret = await getSecret(
        env as WorkerEnv,
        userId,
        connection.id,
        "webhookSecret",
      );
      if (!secret) {
        throw new Error(
          `GitHub connection "${alias}" is missing webhookSecret.`,
        );
      }

      const { verifyGithubSignature } =
        await import("../../worker/services/security");
      const valid = await verifyGithubSignature(
        secret,
        rawBody,
        headers.get("x-hub-signature-256"),
      );
      if (!valid) {
        throw new Error("GitHub signature verification failed.");
      }
    },
  },
];

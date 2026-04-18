import type { WorkflowTriggerHandler } from "../runtime";
import type { WorkerEnv } from "../../apps/web/worker/lib/env";

export const triggerHandlers: WorkflowTriggerHandler[] = [
  {
    kind: "linear",
    matches(node, payload) {
      const data = payload.data as { team?: { key?: string } } | undefined;
      const event = String(payload.type ?? "").toLowerCase();
      const action = String(payload.action ?? "").toLowerCase();
      const teamKey = String(data?.team?.key ?? "").toLowerCase();
      return (
        (!String(node.data.config.event ?? "").toLowerCase() ||
          String(node.data.config.event ?? "").toLowerCase() === event) &&
        (!String(node.data.config.action ?? "").toLowerCase() ||
          String(node.data.config.action ?? "").toLowerCase() === action) &&
        (!String(node.data.config.teamKey ?? "").toLowerCase() ||
          String(node.data.config.teamKey ?? "").toLowerCase() === teamKey)
      );
    },
    async verify({ env, headers, node, payload, rawBody, repository, userId }) {
      const alias = String(node.data.config.connectionAlias ?? "");
      if (!alias) {
        throw new Error(
          "Linear triggers must reference an in-app connection alias.",
        );
      }

      const connection = await repository.getConnectionByAlias(userId, alias);
      if (!connection) {
        throw new Error(`Linear connection "${alias}" was not found.`);
      }

      const { getSecret } = await import("../../apps/web/worker/services/secrets");
      const secret = await getSecret(
        env as WorkerEnv,
        userId,
        connection.id,
        "webhookSecret",
      );
      if (!secret) {
        throw new Error(
          `Linear connection "${alias}" is missing webhookSecret.`,
        );
      }

      const { verifyLinearSignature } =
        await import("../../apps/web/worker/services/security");
      const valid = await verifyLinearSignature(
        secret,
        rawBody,
        headers.get("linear-signature"),
        payload.webhookTimestamp as string | number | undefined,
      );
      if (!valid) {
        throw new Error("Linear signature verification failed.");
      }
    },
  },
];

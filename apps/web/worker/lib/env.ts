export interface WorkerEnv extends Env {
  ASSETS?: {
    fetch: typeof fetch;
  };
  HYPERDRIVE: Hyperdrive;
  AI: Ai;
  ANALYTICS?: AnalyticsEngineDataset;
  WORKFLOW_RUNNER: Workflow<unknown>;
  SECRETS_KV: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  SECRETS_KEY: string;
}

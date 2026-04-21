export class WorkflowEntrypoint<TEnv, _TPayload> {
  env: TEnv;
  declare readonly __payload?: _TPayload;

  constructor(_ctx: unknown, env: TEnv) {
    this.env = env;
  }
}

export interface WorkflowEvent<TPayload> {
  payload: TPayload;
}

export interface WorkflowStep {
  sleep: (...args: unknown[]) => Promise<void>;
}

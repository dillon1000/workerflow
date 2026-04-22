import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type {
  TriggerKind,
  WorkflowDefinition,
} from "../../src/lib/workflow/types";
import type { WorkerEnv } from "../lib/env";
import type { Repository } from "./repository";
import { withRepository } from "./repository";
import {
  executeWorkflowGraph,
  launchWorkflowRun as launchWorkflowRunImpl,
} from "./runtime/execution";
import { dispatchScheduledRuns as dispatchScheduledRunsImpl } from "./runtime/scheduling";

interface RunnerPayload {
  runId: string;
  userId: string;
  workflowId: string;
  versionId?: string;
  triggerKind: TriggerKind;
  payload: Record<string, unknown>;
}

export async function launchWorkflowRun(
  repository: Repository,
  env: WorkerEnv,
  workflow: WorkflowDefinition,
  userId: string,
  triggerKind: TriggerKind,
  payload: Record<string, unknown>,
) {
  return launchWorkflowRunImpl(
    repository,
    env,
    workflow,
    userId,
    triggerKind,
    payload,
  );
}

export class WorkflowRunner extends WorkflowEntrypoint<
  WorkerEnv,
  RunnerPayload
> {
  async run(event: WorkflowEvent<RunnerPayload>, step: WorkflowStep) {
    return withRepository(this.env, async (repository) => {
      const workflow = await repository.getWorkflow(
        event.payload.userId,
        event.payload.workflowId,
      );
      if (!workflow) {
        throw new Error("Workflow not found.");
      }

      const graph = event.payload.versionId
        ? (
            await repository.getVersion(
              event.payload.userId,
              event.payload.versionId,
            )
          )?.definition
        : workflow.draftGraph;
      if (!graph) {
        throw new Error("Workflow definition could not be resolved.");
      }

      const started = Date.now();
      const result = await executeWorkflowGraph(
        repository,
        this.env,
        event.payload.userId,
        workflow,
        graph,
        event.payload.runId,
        event.payload.payload,
        step,
      );
      await step.do("run:finalize", async () => {
        await repository.updateRun(event.payload.userId, event.payload.runId, {
          status: result.status,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - started,
        });
        return result.status;
      });
    });
  }
}

export async function dispatchScheduledRuns(
  repository: Repository,
  env: WorkerEnv,
  scheduledTime: number,
) {
  return dispatchScheduledRunsImpl(repository, env, scheduledTime);
}

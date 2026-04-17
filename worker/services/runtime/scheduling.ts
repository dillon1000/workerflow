import type { WorkerEnv } from "../../lib/env";
import type { Repository } from "../repository";
import { launchWorkflowRun } from "./execution";

function cronFieldMatches(field: string, actual: number) {
  if (field === "*") return true;
  if (field.startsWith("*/")) {
    const every = Number(field.slice(2));
    return every > 0 && actual % every === 0;
  }
  return field
    .split(",")
    .map((value) => Number(value))
    .some((value) => value === actual);
}

function cronMatches(cron: string, date: Date) {
  const [minute = "*", hour = "*", day = "*", month = "*", weekDay = "*"] =
    cron.split(/\s+/);
  return (
    cronFieldMatches(minute, date.getUTCMinutes()) &&
    cronFieldMatches(hour, date.getUTCHours()) &&
    cronFieldMatches(day, date.getUTCDate()) &&
    cronFieldMatches(month, date.getUTCMonth() + 1) &&
    cronFieldMatches(weekDay, date.getUTCDay())
  );
}

export async function dispatchScheduledRuns(
  repository: Repository,
  env: WorkerEnv,
  scheduledTime: number,
) {
  const now = new Date(scheduledTime);
  const workflows = await repository.listPublishedWorkflows();

  for (const entry of workflows) {
    const workflow = entry.workflow;
    if (!workflow.publishedVersionId) continue;
    const version = await repository.getVersion(
      entry.userId,
      workflow.publishedVersionId,
    );
    const graph = version?.definition;
    if (!graph) continue;
    const scheduleNode = graph.nodes.find(
      (node) => node.data.kind === "schedule",
    );
    if (!scheduleNode) continue;

    const cron = String(scheduleNode.data.config.cron ?? "0 * * * *");
    if (!cronMatches(cron, now)) continue;
    const minuteKey = now.toISOString().slice(0, 16);

    await launchWorkflowRun(
      repository,
      env,
      workflow,
      entry.userId,
      "schedule",
      {
        source: "schedule",
        scheduledAt: now.toISOString(),
      },
    );
    await repository.markScheduleDispatch(
      workflow.id,
      scheduleNode.id,
      minuteKey,
    );
  }
}

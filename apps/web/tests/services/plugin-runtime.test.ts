import { describe, expect, it } from "vitest";
import {
  getConnectionTestRunner,
  getTriggerHandler,
  getWorkflowNodeExecutionMode,
  getWorkflowStepRunner,
  isKnownConnectionProvider,
} from "../../worker/services/plugin-runtime";

describe("plugin runtime registry", () => {
  it("resolves step runners for important blocks", () => {
    expect(getWorkflowStepRunner("githubAction")).toBeTypeOf("function");
    expect(getWorkflowStepRunner("linearAction")).toBeTypeOf("function");
    expect(getWorkflowStepRunner("openaiChat")).toBeTypeOf("function");
    expect(getWorkflowStepRunner("discordSendMessage")).toBeTypeOf("function");
    expect(getWorkflowStepRunner("sendWebhook")).toBeTypeOf("function");
  });

  it("resolves trigger handlers for external webhook sources", () => {
    expect(getTriggerHandler("github")).toMatchObject({ kind: "github" });
    expect(getTriggerHandler("linear")).toMatchObject({ kind: "linear" });
    expect(getTriggerHandler("webhook")).toBeNull();
    expect(getTriggerHandler("missing-provider")).toBeNull();
  });

  it("resolves connection test runners for providers with external dependencies", () => {
    expect(getConnectionTestRunner("github")).toBeTypeOf("function");
    expect(getConnectionTestRunner("linear")).toBeTypeOf("function");
    expect(getConnectionTestRunner("openai")).toBeTypeOf("function");
    expect(getConnectionTestRunner("planetscale")).toBeTypeOf("function");
    expect(getConnectionTestRunner("missing-provider")).toBeNull();
  });

  it("surfaces execution modes and provider registration", () => {
    expect(getWorkflowNodeExecutionMode("wait")).toBe("inline");
    expect(getWorkflowNodeExecutionMode("githubAction")).toBe("step");
    expect(isKnownConnectionProvider("github")).toBe(true);
    expect(isKnownConnectionProvider("workers-ai")).toBe(true);
    expect(isKnownConnectionProvider("not-real")).toBe(false);
  });
});

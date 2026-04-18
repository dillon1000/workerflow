export type WorkflowFamily = "trigger" | "action" | "logic" | "data";

export type TriggerKind = string;

export type WorkflowNodeKind = string;

export type WorkflowMode = "standard" | "subworkflow";
export type WorkflowStatus = "draft" | "published";
export type RunStatus = "queued" | "running" | "complete" | "errored";
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ConnectionProvider = string;

export interface WorkflowPosition {
  x: number;
  y: number;
}

export interface WorkflowNodeData {
  [key: string]: unknown;
  title: string;
  subtitle: string;
  family: WorkflowFamily;
  kind: WorkflowNodeKind;
  config: Record<string, unknown>;
  accent: string;
  enabled?: boolean;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowFamily;
  position: WorkflowPosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdgeData {
  [key: string]: unknown;
  label?: string;
  branch?: "true" | "false" | "success";
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: WorkflowEdgeData;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowMetrics {
  successRate: number;
  medianDurationMs: number;
  totalRuns: number;
  activeTriggers: string[];
  lastRunAt?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  mode: WorkflowMode;
  parentWorkflowId?: string;
  status: WorkflowStatus;
  draftGraph: WorkflowGraph;
  publishedVersionId?: string;
  lastPublishedAt?: string;
  createdAt: string;
  updatedAt: string;
  metrics: WorkflowMetrics;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  createdAt: string;
  definition: WorkflowGraph;
}

export interface WorkflowRunStep {
  id: string;
  runId: string;
  nodeId: string;
  nodeTitle: string;
  kind: WorkflowNodeKind;
  status: RunStatus;
  detail: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  output?: JsonValue;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  versionId?: string;
  triggerKind: TriggerKind;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  workflowInstanceId?: string;
  parentRunId?: string;
  parentStepId?: string;
  rootRunId?: string;
  runDepth?: number;
  steps: WorkflowRunStep[];
}

export interface ConnectionDefinition {
  id: string;
  provider: ConnectionProvider;
  alias: string;
  label: string;
  status: "connected" | "attention" | "not-configured";
  config: Record<string, string>;
  notes: string;
  secretKeys: string[];
  hasSecrets: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface AnalyticsOverview {
  totalWorkflows: number;
  publishedWorkflows: number;
  successRate: number;
  medianDurationMs: number;
  totalRuns: number;
  triggerMix: Record<string, number>;
}

export interface BootstrapPayload {
  workflows: WorkflowDefinition[];
  runs: WorkflowRun[];
  connections: ConnectionDefinition[];
  analytics: AnalyticsOverview;
  snippets: WorkflowSnippet[];
}

export interface WorkflowSnippet {
  id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionPayload {
  session?: {
    id: string;
    userId: string;
  } | null;
  user?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
}

export interface WorkflowTemplate {
  kind: WorkflowNodeKind;
  family: WorkflowFamily;
  title: string;
  subtitle: string;
  accent: string;
  defaultConfig: Record<string, unknown>;
}

export interface NodeConfigValidationIssue {
  key: string;
  message: string;
}

export interface GraphValidationResult {
  valid: boolean;
  issues: string[];
  nodeIssues?: Record<string, NodeConfigValidationIssue[]>;
  triggerNode?: WorkflowNode;
}

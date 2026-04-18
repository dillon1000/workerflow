import type {
  WorkflowFamily,
  WorkflowNodeKind,
} from "../apps/web/src/lib/workflow/types";

export type ConnectionFieldKind = "text" | "password" | "textarea" | "url";

export interface ConnectionField {
  key: string;
  label: string;
  kind: ConnectionFieldKind;
  placeholder?: string;
  required?: boolean;
  description?: string;
  secret?: boolean;
}

export interface ConnectionSchema {
  provider: string;
  title: string;
  description: string;
  docsUrl?: string;
  monogram: string;
  fields: ConnectionField[];
}

export type WorkflowNodeFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "json"
  | "select"
  | "connection"
  | "workflow";

export interface WorkflowNodeFieldOption {
  label: string;
  value: string;
}

export interface WorkflowNodeFieldDefinition {
  key: string;
  label: string;
  kind: WorkflowNodeFieldKind;
  description?: string;
  placeholder?: string;
  required?: boolean;
  allowTemplates?: boolean;
  min?: number;
  max?: number;
  options?: WorkflowNodeFieldOption[];
  connectionProvider?: string;
}

export interface WorkflowPluginNodeDefinition {
  kind: WorkflowNodeKind;
  family: WorkflowFamily;
  title: string;
  subtitle: string;
  accent: string;
  defaultConfig: Record<string, unknown>;
  stepId?: string;
  executionMode?: "inline" | "step";
  fields?: WorkflowNodeFieldDefinition[];
}

export interface WorkflowPluginManifest {
  id: string;
  title: string;
  description: string;
  connections?: ConnectionSchema[];
  nodes: WorkflowPluginNodeDefinition[];
}

import { Link } from "@tanstack/react-router";
import { Copy, Search, SquarePen, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ReferenceField } from "@/components/editor/reference-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getAncestorNodes } from "@/lib/workflow/graph";
import {
  getWorkflowNodeDefinition,
  validateNodeConfigField,
} from "@/lib/workflow/plugin-registry";
import type {
  ConnectionDefinition,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/workflow/types";

interface InspectorPanelProps {
  workflow: WorkflowDefinition;
  parentWorkflow: WorkflowDefinition | null;
  selectedEdge: WorkflowEdge | null;
  selectedNode: WorkflowNode | null;
  connections: ConnectionDefinition[];
  workflows: WorkflowDefinition[];
  onEdgeBranchChange: (value: "true" | "false") => void;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onConfigChange: (key: string, value: unknown) => void;
  onDeleteNode: () => void;
}

export function InspectorPanel({
  workflow,
  parentWorkflow,
  selectedEdge,
  selectedNode,
  connections,
  workflows,
  onEdgeBranchChange,
  onTitleChange,
  onSubtitleChange,
  onConfigChange,
  onDeleteNode,
}: InspectorPanelProps) {
  // Only nodes that are guaranteed to execute before the selected node
  // (strict ancestors) can supply data to it.
  const availableReferences = useMemo(() => {
    if (!selectedNode) return [] as string[];
    const upstreamReferences = getAncestorNodes(
      workflow.draftGraph,
      selectedNode.id,
    ).map((node) => `{{ ${node.data.title}.data }}`);
    const parentReferences =
      workflow.mode === "subworkflow" && parentWorkflow
        ? parentWorkflow.draftGraph.nodes.map(
            (node) => `{{ parent.${node.data.title}.data }}`,
          )
        : [];
    return [...parentReferences, ...upstreamReferences];
  }, [parentWorkflow, selectedNode, workflow.draftGraph, workflow.mode]);

  const [referenceQuery, setReferenceQuery] = useState("");
  const filteredReferences = useMemo(() => {
    const q = referenceQuery.trim().toLowerCase();
    if (!q) return availableReferences;
    return availableReferences.filter((reference) =>
      reference.toLowerCase().includes(q),
    );
  }, [availableReferences, referenceQuery]);

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="flex h-full flex-col bg-[color:var(--color-card)]">
        <div className="hairline-b flex h-8 items-center px-3">
          <span className="label-xs">Inspector</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
              [ no selection ]
            </p>
            <p className="mt-2 text-[12px] text-[color:var(--color-muted-foreground)]">
              Select a node on the canvas to edit its configuration.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  if (selectedEdge) {
    const sourceNode =
      workflow.draftGraph.nodes.find(
        (node) => node.id === selectedEdge.source,
      ) ?? null;
    const targetNode =
      workflow.draftGraph.nodes.find(
        (node) => node.id === selectedEdge.target,
      ) ?? null;
    const isConditionEdge = sourceNode?.data.kind === "condition";

    return (
      <aside className="flex h-full flex-col overflow-hidden bg-[color:var(--color-card)]">
        <div className="hairline-b flex h-8 items-center gap-2 px-3">
          <span className="label-xs">Inspector</span>
          <span className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
            / connection
          </span>
          <span className="mono ml-auto text-[10px] text-[color:var(--color-muted-foreground)]">
            {selectedEdge.id.slice(0, 8)}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="hairline-b space-y-2.5 p-3">
            <div>
              <span className="label-xs">Path</span>
              <p className="mt-1 text-[12px] text-[color:var(--color-foreground)]">
                {sourceNode?.data.title ?? "Unknown node"} to{" "}
                {targetNode?.data.title ?? "Unknown node"}
              </p>
            </div>
            <p className="text-[11px] text-[color:var(--color-muted-foreground)]">
              Conditional logic is stored on the connection leaving the block.
            </p>
          </div>

          <div className="hairline-b p-3">
            <div className="space-y-1">
              <Label htmlFor="edge-branch">Branch</Label>
              {isConditionEdge ? (
                <Select
                  onValueChange={(next) =>
                    onEdgeBranchChange(next as "true" | "false")
                  }
                  value={String(selectedEdge.data?.branch ?? "")}
                >
                  <SelectTrigger id="edge-branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mono hairline rounded-[3px] bg-[color:var(--color-surface)] p-2 text-[11px] text-[color:var(--color-muted-foreground)]">
                  This connection runs on success.
                </div>
              )}
              <p className="text-[11px] text-[color:var(--color-muted-foreground)]">
                {isConditionEdge
                  ? "Pick which result from the condition block should follow this path."
                  : "Only condition blocks use true/false branching today."}
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (!selectedNode) {
    return null;
  }

  const node = selectedNode;
  const definition = getWorkflowNodeDefinition(node.data.kind);
  const configFields = definition?.fields ?? [];

  const webhookUrl =
    node.data.kind === "webhook"
      ? `${globalThis.location?.origin ?? ""}/api/triggers/webhook/${workflow.id}/${node.id}`
      : node.data.kind === "github" || node.data.kind === "linear"
        ? `${globalThis.location?.origin ?? ""}/api/triggers/${node.data.kind}/${workflow.id}/${node.id}`
        : null;

  const configIssues = Object.fromEntries(
    configFields
      .map((field) => [
        field.key,
        validateNodeConfigField(field, node.data.config[field.key]),
      ])
      .filter(([, message]) => Boolean(message)),
  ) as Record<string, string>;

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-[color:var(--color-card)]">
      <div className="hairline-b flex h-8 items-center gap-2 px-3">
        <span className="label-xs">Inspector</span>
        <span className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
          / {node.data.family}
        </span>
        <span className="mono ml-auto text-[10px] text-[color:var(--color-muted-foreground)]">
          {node.id.slice(0, 8)}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="hairline-b space-y-2.5 p-3">
          <div className="space-y-1">
            <Label htmlFor="node-title">Title</Label>
            <Input
              id="node-title"
              onChange={(event) => onTitleChange(event.target.value)}
              value={node.data.title}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="node-subtitle">Subtitle</Label>
            <Textarea
              id="node-subtitle"
              className="min-h-[52px]"
              onChange={(event) => onSubtitleChange(event.target.value)}
              value={node.data.subtitle}
            />
          </div>
        </div>

        {configFields.length > 0 && (
          <div className="hairline-b p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="label-xs">Config</span>
              <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
                type {"{"}
                {"{"} to reference
              </span>
            </div>
            <div className="space-y-2">
              {configFields.map((field) => {
                const value = node.data.config[field.key];
                const error = configIssues[field.key];
                const matchingConnections = connections.filter(
                  (connection) =>
                    !field.connectionProvider ||
                    connection.provider === field.connectionProvider,
                );
                const availableWorkflows = workflows.filter(
                  (item) =>
                    item.id !== workflow.id &&
                    item.mode === "subworkflow" &&
                    item.parentWorkflowId === workflow.id &&
                    item.status === "published",
                );

                return (
                  <div className="space-y-1" key={field.key}>
                    <Label htmlFor={field.key}>{field.label}</Label>
                    {field.kind === "select" ? (
                      <Select
                        onValueChange={(next) =>
                          onConfigChange(field.key, next)
                        }
                        value={String(value ?? "")}
                      >
                        <SelectTrigger id={field.key}>
                          <SelectValue
                            placeholder={
                              field.placeholder ?? `Select ${field.label}`
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options ?? []).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.kind === "connection" ? (
                      <Select
                        onValueChange={(next) =>
                          onConfigChange(field.key, next)
                        }
                        value={String(value ?? "")}
                      >
                        <SelectTrigger id={field.key}>
                          <SelectValue
                            placeholder={
                              field.placeholder ??
                              `Select ${field.connectionProvider ?? "connection"}`
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {matchingConnections.map((connection) => (
                            <SelectItem
                              key={connection.id}
                              value={connection.alias}
                            >
                              {connection.alias}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.kind === "workflow" ? (
                      <div className="flex items-center gap-2">
                        <Select
                          onValueChange={(next) =>
                            onConfigChange(field.key, next)
                          }
                          value={String(value ?? "")}
                        >
                          <SelectTrigger id={field.key}>
                            <SelectValue placeholder="Select sub-workflow" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableWorkflows.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {String(value ?? "").trim() &&
                        workflow.mode === "standard" ? (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              params={{
                                parentWorkflowId: workflow.id,
                                subworkflowId: String(value),
                              }}
                              to="/workflows/$parentWorkflowId/subworkflow/$subworkflowId/editor"
                            >
                              <SquarePen className="h-3 w-3" />
                              Edit
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    ) : field.kind === "number" ? (
                      <Input
                        id={field.key}
                        min={field.min}
                        max={field.max}
                        onChange={(event) =>
                          onConfigChange(
                            field.key,
                            event.target.value === ""
                              ? ""
                              : Number(event.target.value),
                          )
                        }
                        placeholder={field.placeholder}
                        type="number"
                        value={String(value ?? "")}
                      />
                    ) : field.kind === "json" ? (
                      <ReferenceField
                        id={field.key}
                        multiline
                        onChange={(next) => onConfigChange(field.key, next)}
                        references={
                          field.allowTemplates ? availableReferences : []
                        }
                        value={String(value ?? "")}
                      />
                    ) : field.kind === "textarea" ? (
                      <ReferenceField
                        id={field.key}
                        multiline
                        onChange={(next) => onConfigChange(field.key, next)}
                        references={
                          field.allowTemplates ? availableReferences : []
                        }
                        value={String(value ?? "")}
                      />
                    ) : (
                      <ReferenceField
                        id={field.key}
                        multiline={false}
                        onChange={(next) => onConfigChange(field.key, next)}
                        references={
                          field.allowTemplates ? availableReferences : []
                        }
                        value={String(value ?? "")}
                      />
                    )}
                    {field.description ? (
                      <p className="text-[11px] text-[color:var(--color-muted-foreground)]">
                        {field.description}
                      </p>
                    ) : null}
                    {error ? (
                      <p className="text-[11px] text-[color:var(--color-destructive,#b4432d)]">
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {connections.length > 0 &&
        configFields.some((field) => field.kind !== "connection") ? (
          <div className="hairline-b p-3">
            <div className="mb-2">
              <span className="label-xs">Connections</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {connections.map((connection) => (
                <Button
                  key={connection.id}
                  onClick={() =>
                    onConfigChange("connectionAlias", connection.alias)
                  }
                  size="sm"
                  variant="outline"
                >
                  {connection.alias}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="hairline-b p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="label-xs">References</span>
            <span className="mono text-[10px] text-[color:var(--color-muted-foreground)]">
              {availableReferences.length} upstream
            </span>
          </div>
          {availableReferences.length === 0 ? (
            <p className="text-[11px] text-[color:var(--color-muted-foreground)]">
              No upstream nodes. Connect a node before this one to surface its
              output here.
            </p>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[color:var(--color-muted-foreground)]" />
                <Input
                  className="pl-7"
                  placeholder="Search upstream…"
                  value={referenceQuery}
                  onChange={(event) => setReferenceQuery(event.target.value)}
                />
              </div>
              <div className="flex max-h-[180px] flex-col gap-1 overflow-y-auto pr-1">
                {filteredReferences.map((reference) => (
                  <button
                    key={reference}
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(reference);
                      toast.success("Reference copied.");
                    }}
                    className="mono hairline flex items-center gap-1.5 rounded-[3px] bg-[color:var(--color-surface)] px-2 py-1 text-left text-[11px] hover:border-[color:var(--color-primary)]"
                  >
                    <Copy className="h-3 w-3 shrink-0 text-[color:var(--color-muted-foreground)]" />
                    <span className="truncate">{reference}</span>
                  </button>
                ))}
                {filteredReferences.length === 0 && (
                  <p className="py-1 text-[11px] text-[color:var(--color-muted-foreground)]">
                    No matches
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {webhookUrl && (
          <div className="hairline-b p-3">
            <div className="mb-2">
              <span className="label-xs">Webhook URL</span>
            </div>
            <div className="mono hairline rounded-[3px] bg-[color:var(--color-surface)] p-2 text-[11px] break-all text-[color:var(--color-muted-foreground)]">
              {webhookUrl}
            </div>
            <Button
              className="mt-2"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(webhookUrl);
                toast.success("Webhook URL copied.");
              }}
              variant="outline"
            >
              <Copy className="h-3 w-3" />
              Copy URL
            </Button>
          </div>
        )}
      </div>

      {node.data.family !== "trigger" && (
        <div className="hairline-t p-2">
          <Button
            className="w-full"
            onClick={onDeleteNode}
            size="sm"
            variant="destructive"
          >
            <Trash2 className="h-3 w-3" />
            Remove node
          </Button>
        </div>
      )}
    </aside>
  );
}

import { Copy, Search, Trash2 } from "lucide-react";
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
  WorkflowNode,
} from "@/lib/workflow/types";

interface InspectorPanelProps {
  workflow: WorkflowDefinition;
  selectedNode: WorkflowNode | null;
  connections: ConnectionDefinition[];
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onConfigChange: (key: string, value: unknown) => void;
  onDeleteNode: () => void;
}

export function InspectorPanel({
  workflow,
  selectedNode,
  connections,
  onTitleChange,
  onSubtitleChange,
  onConfigChange,
  onDeleteNode,
}: InspectorPanelProps) {
  // Only nodes that are guaranteed to execute before the selected node
  // (strict ancestors) can supply data to it.
  const availableReferences = useMemo(() => {
    if (!selectedNode) return [] as string[];
    return getAncestorNodes(workflow.draftGraph, selectedNode.id).map(
      (node) => `{{ ${node.data.title}.data }}`,
    );
  }, [selectedNode, workflow.draftGraph]);

  const [referenceQuery, setReferenceQuery] = useState("");
  const filteredReferences = useMemo(() => {
    const q = referenceQuery.trim().toLowerCase();
    if (!q) return availableReferences;
    return availableReferences.filter((reference) =>
      reference.toLowerCase().includes(q),
    );
  }, [availableReferences, referenceQuery]);

  if (!selectedNode) {
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

  const definition = getWorkflowNodeDefinition(selectedNode.data.kind);
  const configFields = definition?.fields ?? [];

  const webhookUrl =
    selectedNode.data.kind === "webhook"
      ? `${globalThis.location?.origin ?? ""}/api/triggers/webhook/${workflow.id}/${selectedNode.id}`
      : null;

  const configIssues = Object.fromEntries(
    configFields
      .map((field) => [
        field.key,
        validateNodeConfigField(field, selectedNode.data.config[field.key]),
      ])
      .filter(([, message]) => Boolean(message)),
  ) as Record<string, string>;

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-[color:var(--color-card)]">
      <div className="hairline-b flex h-8 items-center gap-2 px-3">
        <span className="label-xs">Inspector</span>
        <span className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
          / {selectedNode.data.family}
        </span>
        <span className="mono ml-auto text-[10px] text-[color:var(--color-muted-foreground)]">
          {selectedNode.id.slice(0, 8)}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="hairline-b space-y-2.5 p-3">
          <div className="space-y-1">
            <Label htmlFor="node-title">Title</Label>
            <Input
              id="node-title"
              onChange={(event) => onTitleChange(event.target.value)}
              value={selectedNode.data.title}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="node-subtitle">Subtitle</Label>
            <Textarea
              id="node-subtitle"
              className="min-h-[52px]"
              onChange={(event) => onSubtitleChange(event.target.value)}
              value={selectedNode.data.subtitle}
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
                const value = selectedNode.data.config[field.key];
                const error = configIssues[field.key];
                const matchingConnections = connections.filter(
                  (connection) =>
                    !field.connectionProvider ||
                    connection.provider === field.connectionProvider,
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

      {selectedNode.data.family !== "trigger" && (
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

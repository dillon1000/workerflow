import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  connectionSchemas,
  getConnectionSchema,
} from "@/lib/workflow/connection-schemas";
import type { ConnectionProvider } from "@/lib/workflow/types";
import {
  appStateAtom,
  createConnectionAtom,
  removeConnectionAtom,
  testConnectionAtom,
} from "@/state/app-state";

export function ConnectionsPage() {
  const state = useAtomValue(appStateAtom);
  const createConnection = useSetAtom(createConnectionAtom);
  const testConnection = useSetAtom(testConnectionAtom);
  const removeConnection = useSetAtom(removeConnectionAtom);
  const [provider, setProvider] = useState<ConnectionProvider>("github");
  const [alias, setAlias] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const schema = useMemo(() => getConnectionSchema(provider), [provider]);

  function resetFormForProvider(next: ConnectionProvider) {
    setProvider(next);
    setFieldValues({});
  }

  async function handleSubmit() {
    if (!schema) return;
    const config: Record<string, string> = {};
    const secretValues: Record<string, string> = {};
    for (const field of schema.fields) {
      const value = fieldValues[field.key]?.trim() ?? "";
      if (!value) continue;
      if (field.secret) secretValues[field.key] = value;
      else config[field.key] = value;
    }
    await createConnection({
      provider,
      alias: alias.trim(),
      label: label.trim() || schema.title,
      notes: notes.trim(),
      config,
      secretValues,
    });
    setAlias("");
    setLabel("");
    setNotes("");
    setFieldValues({});
  }

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col">
      <div className="hairline-b flex items-center gap-4 px-6 py-4">
        <span className="label-xs">01 / connections</span>
        <h1 className="font-display text-[22px] leading-none tracking-tight">
          Credentials vault
        </h1>
        <span className="mono ml-auto text-[11px] text-[color:var(--color-muted-foreground)]">
          {state.connections.length} stored
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr]">
        {/* form */}
        <div className="hairline-r min-h-0 overflow-auto">
          <div className="hairline-b flex h-8 items-center px-3">
            <span className="label-xs">New connection</span>
          </div>
          <div className="space-y-3 p-3">
            <div className="space-y-1">
              <Label htmlFor="provider">Service</Label>
              <Select
                value={provider}
                onValueChange={(next) =>
                  resetFormForProvider(next as ConnectionProvider)
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connectionSchemas.map((item) => (
                    <SelectItem key={item.provider} value={item.provider}>
                      <span className="mono text-[11px] text-[color:var(--color-muted-foreground)]">
                        {item.monogram}
                      </span>
                      <span className="ml-2">{item.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {schema && (
                <p className="pt-0.5 text-[11px] leading-snug text-[color:var(--color-muted-foreground)]">
                  {schema.description}
                  {schema.docsUrl && (
                    <>
                      {" "}
                      <a
                        href={schema.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[color:var(--color-primary)] hover:underline"
                      >
                        Docs →
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="alias">Alias</Label>
                <Input
                  id="alias"
                  className="mono"
                  placeholder="primary-github"
                  onChange={(event) => setAlias(event.target.value)}
                  value={alias}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="label">Display name</Label>
                <Input
                  id="label"
                  placeholder={schema?.title}
                  onChange={(event) => setLabel(event.target.value)}
                  value={label}
                />
              </div>
            </div>

            {schema && schema.fields.length > 0 && (
              <div className="hairline rounded-[3px] bg-[color:var(--color-surface)] p-2">
                <div className="label-xs mb-2 flex items-center gap-2">
                  <span>Credentials</span>
                  <span className="mono text-[10px] normal-case text-[color:var(--color-muted-foreground)]">
                    encrypted at rest
                  </span>
                </div>
                <div className="space-y-2">
                  {schema.fields.map((field) => (
                    <div className="space-y-1" key={field.key}>
                      <Label htmlFor={field.key}>
                        {field.label}
                        {field.secret && (
                          <span className="mono ml-1 normal-case text-[color:var(--color-primary)]">
                            • secret
                          </span>
                        )}
                      </Label>
                      {field.kind === "textarea" ? (
                        <Textarea
                          id={field.key}
                          placeholder={field.placeholder}
                          value={fieldValues[field.key] ?? ""}
                          onChange={(event) =>
                            setFieldValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        <Input
                          id={field.key}
                          className="mono"
                          type={
                            field.kind === "password"
                              ? "password"
                              : field.kind === "url"
                                ? "url"
                                : "text"
                          }
                          placeholder={field.placeholder}
                          value={fieldValues[field.key] ?? ""}
                          onChange={(event) =>
                            setFieldValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      )}
                      {field.description && (
                        <p className="text-[10px] text-[color:var(--color-muted-foreground)]">
                          {field.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                className="min-h-[40px] font-sans"
                placeholder="Optional context for your team"
                onChange={(event) => setNotes(event.target.value)}
                value={notes}
              />
            </div>

            <Button
              className="w-full"
              variant="primary"
              disabled={!alias.trim() || !schema}
              onClick={() => void handleSubmit()}
            >
              Save connection
            </Button>
          </div>
        </div>

        {/* list */}
        <div className="min-h-0 overflow-auto">
          <div className="hairline-b flex h-8 items-center px-3">
            <span className="label-xs">Stored connections</span>
          </div>
          {state.connections.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-[12px] text-[color:var(--color-muted-foreground)]">
              No connections saved
            </div>
          ) : (
            <ul className="stagger">
              {state.connections.map((connection) => (
                <li
                  key={connection.id}
                  className="hairline-b flex items-start gap-3 px-3 py-3"
                >
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[2px] bg-[color:var(--color-surface-2)] font-mono text-[11px] font-medium uppercase">
                    {connection.provider.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="mono text-[13px] font-medium">
                        {connection.alias}
                      </p>
                      <Badge
                        variant={
                          connection.status === "connected"
                            ? "success"
                            : connection.status === "attention"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {connection.status}
                      </Badge>
                      <Badge variant="outline">{connection.provider}</Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[color:var(--color-foreground)]">
                      {connection.label}
                    </p>
                    {connection.notes && (
                      <p className="mt-1 text-[11px] text-[color:var(--color-muted-foreground)]">
                        {connection.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => void testConnection(connection.id)}
                      size="sm"
                      variant="outline"
                    >
                      Test
                    </Button>
                    <Button
                      onClick={() => void removeConnection(connection.id)}
                      size="sm"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

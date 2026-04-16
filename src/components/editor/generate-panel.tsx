import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  appStateAtom,
  generateWorkflowFromPromptAtom,
} from "@/state/app-state";

const AI_PROVIDERS = new Set(["openai", "anthropic", "openrouter"]);

export function GeneratePanel() {
  const connections = useAtomValue(appStateAtom).connections;
  const generate = useSetAtom(generateWorkflowFromPromptAtom);
  const [prompt, setPrompt] = useState("");
  const [alias, setAlias] = useState("");
  const [pending, setPending] = useState(false);

  const providerConnections = useMemo(
    () =>
      connections.filter(
        (connection) =>
          AI_PROVIDERS.has(connection.provider) &&
          connection.status === "connected",
      ),
    [connections],
  );

  const canSubmit = prompt.trim().length > 0 && alias && !pending;

  async function handleGenerate() {
    if (!canSubmit) return;
    setPending(true);
    try {
      await generate({ prompt: prompt.trim(), connectionAlias: alias });
    } finally {
      setPending(false);
    }
  }

  return (
    <aside className="flex h-full flex-col bg-[color:var(--color-card)]">
      <div className="hairline-b flex h-8 items-center px-3">
        <span className="label-xs">AI generate</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <p className="text-[11px] leading-relaxed text-[color:var(--color-muted-foreground)]">
          Describe the workflow and an AI provider will lay out a draft graph.
          Replaces the current draft — save or publish afterwards.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label className="label-xs" htmlFor="gen-connection">
            Connection
          </Label>
          {providerConnections.length === 0 ? (
            <p className="text-[11px] text-[color:var(--color-destructive)]">
              Add an OpenAI, Anthropic, or OpenRouter connection first.
            </p>
          ) : (
            <Select value={alias} onValueChange={setAlias}>
              <SelectTrigger id="gen-connection">
                <SelectValue placeholder="Select a connection…" />
              </SelectTrigger>
              <SelectContent>
                {providerConnections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.alias}>
                    {connection.label}{" "}
                    <span className="mono text-[10px] opacity-60">
                      {connection.provider}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="label-xs" htmlFor="gen-prompt">
            Prompt
          </Label>
          <Textarea
            id="gen-prompt"
            rows={8}
            placeholder="When a GitHub issue is labeled urgent, summarize it with Claude, then create a Linear ticket in the Triage project."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <Button
          size="sm"
          variant="primary"
          disabled={!canSubmit}
          onClick={() => void handleGenerate()}
        >
          <Sparkles className="h-3 w-3" />
          {pending ? "Generating…" : "Generate workflow"}
        </Button>
      </div>
    </aside>
  );
}

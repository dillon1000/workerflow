import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NodeLibrary } from "@/components/editor/node-library";
import { SnippetsPanel } from "@/components/editor/snippets-panel";
import { GeneratePanel } from "@/components/editor/generate-panel";
import type {
  WorkflowDefinition,
  WorkflowNodeKind,
} from "@/lib/workflow/types";

export type EditorLeftPanelTab = "library" | "snippets" | "generate";

interface EditorLeftPanelProps {
  workflow: WorkflowDefinition;
  hasTrigger: boolean;
  onAddNode: (kind: WorkflowNodeKind) => void;
  value?: EditorLeftPanelTab;
  onValueChange?: (value: EditorLeftPanelTab) => void;
}

export function EditorLeftPanel({
  workflow,
  hasTrigger,
  onAddNode,
  value,
  onValueChange,
}: EditorLeftPanelProps) {
  return (
    <Tabs
      value={value}
      defaultValue={value ? undefined : "library"}
      onValueChange={(next) => onValueChange?.(next as EditorLeftPanelTab)}
      className="flex h-full min-h-0 flex-col"
    >
      <TabsList className="hairline-b h-8 w-full justify-start px-3">
        <TabsTrigger value="library">Library</TabsTrigger>
        <TabsTrigger value="snippets">Snippets</TabsTrigger>
        <TabsTrigger value="generate">Generate</TabsTrigger>
      </TabsList>
      <TabsContent value="library" className="min-h-0 flex-1">
        <NodeLibrary
          hasTrigger={hasTrigger}
          onAddNode={onAddNode}
          workflowMode={workflow.mode}
        />
      </TabsContent>
      <TabsContent value="snippets" className="min-h-0 flex-1">
        <SnippetsPanel workflow={workflow} />
      </TabsContent>
      <TabsContent value="generate" className="min-h-0 flex-1">
        <GeneratePanel />
      </TabsContent>
    </Tabs>
  );
}

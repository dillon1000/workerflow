import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NodeLibrary } from "@/components/editor/node-library";
import { SnippetsPanel } from "@/components/editor/snippets-panel";
import { GeneratePanel } from "@/components/editor/generate-panel";
import type { WorkflowDefinition, WorkflowNodeKind } from "@/lib/workflow/types";

interface EditorLeftPanelProps {
  workflow: WorkflowDefinition;
  hasTrigger: boolean;
  onAddNode: (kind: WorkflowNodeKind) => void;
}

export function EditorLeftPanel({
  workflow,
  hasTrigger,
  onAddNode,
}: EditorLeftPanelProps) {
  return (
    <Tabs defaultValue="library" className="flex h-full min-h-0 flex-col">
      <TabsList className="hairline-b h-8 w-full justify-start px-3">
        <TabsTrigger value="library">Library</TabsTrigger>
        <TabsTrigger value="snippets">Snippets</TabsTrigger>
        <TabsTrigger value="generate">Generate</TabsTrigger>
      </TabsList>
      <TabsContent value="library" className="min-h-0 flex-1">
        <NodeLibrary hasTrigger={hasTrigger} onAddNode={onAddNode} />
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

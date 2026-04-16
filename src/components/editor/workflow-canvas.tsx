import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { memo, useEffect, useMemo, useRef } from "react";
import { WorkflowNodeCard } from "@/components/editor/workflow-node";
import { WorkflowEdge } from "@/components/editor/workflow-edge";
import type { WorkflowGraph } from "@/lib/workflow/types";

const nodeTypes = {
  trigger: WorkflowNodeCard,
  action: WorkflowNodeCard,
  logic: WorkflowNodeCard,
  data: WorkflowNodeCard,
};

const edgeTypes = {
  smoothstep: WorkflowEdge,
  default: WorkflowEdge,
};

const deleteKeys = ["Backspace", "Delete"];

function decorateEdge(edge: Edge): Edge {
  return {
    ...edge,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#cfccc3" },
    style: { stroke: "#cfccc3", strokeWidth: 1.25 },
  };
}

interface WorkflowCanvasProps {
  graph: WorkflowGraph;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string | null) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
}

function InnerCanvas({
  graph,
  selectedNodeId,
  onNodeClick,
  onNodesChange,
  onEdgesChange,
  onConnect,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState<Node>(
    graph.nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    })),
  );
  const [edges, setEdges, handleEdgesChange] = useEdgesState<Edge>(
    graph.edges.map((edge) => decorateEdge(edge as Edge)),
  );

  // Signature that excludes positions so local drags don't retrigger sync.
  const nodeStructureSignature = useMemo(
    () =>
      JSON.stringify(
        graph.nodes.map((node) => ({ id: node.id, data: node.data })),
      ),
    [graph.nodes],
  );
  const lastNodeSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastNodeSignatureRef.current === nodeStructureSignature) return;
    lastNodeSignatureRef.current = nodeStructureSignature;
    setNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]));
      return graph.nodes.map((incoming) => {
        const existing = byId.get(incoming.id);
        return {
          ...incoming,
          // Preserve locally-driven position during interactions; fall back
          // to server position when node is new.
          position: existing?.position ?? incoming.position,
          selected: incoming.id === selectedNodeId,
        };
      });
    });
  }, [nodeStructureSignature, graph.nodes, selectedNodeId, setNodes]);

  // Keep selection in sync without rebuilding the entire node list.
  useEffect(() => {
    setNodes((current) =>
      current.map((node) =>
        node.selected === (node.id === selectedNodeId)
          ? node
          : { ...node, selected: node.id === selectedNodeId },
      ),
    );
  }, [selectedNodeId, setNodes]);

  const edgeSignature = useMemo(
    () =>
      JSON.stringify(
        graph.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: edge.data,
        })),
      ),
    [graph.edges],
  );
  const lastEdgeSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastEdgeSignatureRef.current === edgeSignature) return;
    lastEdgeSignatureRef.current = edgeSignature;
    setEdges(graph.edges.map((edge) => decorateEdge(edge as Edge)));
  }, [edgeSignature, graph.edges, setEdges]);

  function handleCanvasNodesChange(changes: NodeChange[]) {
    handleNodesChange(changes);

    // Only commit position changes upstream on drag end (dragging: false)
    // to avoid the state/graph thrash that produced canvas flashing.
    const commit: NodeChange[] = [];
    for (const change of changes) {
      if (change.type === "remove") {
        commit.push(change);
      } else if (
        change.type === "position" &&
        change.position &&
        change.dragging === false
      ) {
        commit.push(change);
      }
    }
    if (commit.length > 0) onNodesChange(commit);
  }

  function handleCanvasEdgesChange(changes: EdgeChange[]) {
    handleEdgesChange(changes);
    // Only persist meaningful edge changes. Selection changes live only in
    // canvas memory; remove/add are what need to flow to the store.
    const commit = changes.filter(
      (change) => change.type === "remove" || change.type === "add",
    );
    if (commit.length > 0) onEdgesChange(commit);
  }

  return (
    <div className="canvas-surface relative h-full overflow-hidden">
      <ReactFlow
        fitView
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleCanvasNodesChange}
        onEdgesChange={handleCanvasEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => onNodeClick(null)}
        onNodeClick={(_event, node) => onNodeClick(node.id)}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={deleteKeys}
        edgesReconnectable={false}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#cfccc3" },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(14,14,13,0.18)"
          gap={18}
          size={1}
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      {/* coordinate ticker */}
      <div className="mono pointer-events-none absolute left-2 top-2 flex gap-2 text-[10px] text-[color:var(--color-muted-foreground)]">
        <span>canvas/</span>
        <span>{nodes.length} nodes</span>
        <span>·</span>
        <span>{edges.length} edges</span>
        <span className="opacity-60">· select + ⌫ to remove</span>
      </div>
    </div>
  );
}

export const WorkflowCanvas = memo(function WorkflowCanvas(
  props: WorkflowCanvasProps,
) {
  return (
    <ReactFlowProvider>
      <InnerCanvas {...props} />
    </ReactFlowProvider>
  );
});

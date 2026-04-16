import {
  type Connection,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  getWorkflowNodeDefinition,
  getWorkflowTemplate,
  validateNodeConfigField,
} from "@/lib/workflow/plugin-registry";
import type {
  GraphValidationResult,
  NodeConfigValidationIssue,
  WorkflowEdge,
  WorkflowEdgeData,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowPosition,
} from "@/lib/workflow/types";
import { slugify } from "@/lib/utils";

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function createNode(
  kind: WorkflowNodeKind,
  position: WorkflowPosition,
): WorkflowNode {
  const template = getWorkflowTemplate(kind);
  if (!template) {
    throw new Error(`Unknown node kind: ${kind}`);
  }

  return {
    id: createId("node"),
    type: template.family,
    position,
    data: {
      title: template.title,
      subtitle: template.subtitle,
      family: template.family,
      kind,
      config: structuredClone(template.defaultConfig),
      accent: template.accent,
      enabled: true,
    },
  };
}

export function createEdge(
  source: string,
  target: string,
  data?: WorkflowEdgeData,
): WorkflowEdge {
  return {
    id: createId("edge"),
    source,
    target,
    data,
  };
}

export function createStarterGraph(): WorkflowGraph {
  const trigger = createNode("button", { x: 80, y: 180 });
  const summarize = createNode("aiText", { x: 360, y: 160 });
  const branch = createNode("condition", { x: 670, y: 160 });
  const linear = createNode("linearAction", { x: 980, y: 70 });
  const github = createNode("githubAction", { x: 980, y: 280 });

  linear.data.title = "Linear ticket";
  github.data.title = "GitHub issue";
  branch.data.config.expression = 'trigger.data?.priority === "high"';

  return {
    nodes: [trigger, summarize, branch, linear, github],
    edges: [
      createEdge(trigger.id, summarize.id),
      createEdge(summarize.id, branch.id),
      createEdge(branch.id, linear.id, { label: "true", branch: "true" }),
      createEdge(branch.id, github.id, { label: "false", branch: "false" }),
    ],
  };
}

export function normalizeGraph(graph?: WorkflowGraph): WorkflowGraph {
  const fallback = createStarterGraph();
  if (!graph) return fallback;

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : fallback.nodes;
  const edges = Array.isArray(graph.edges) ? graph.edges : fallback.edges;
  return { nodes, edges };
}

export function validateGraph(graph: WorkflowGraph): GraphValidationResult {
  const issues: string[] = [];
  const nodeIssues: Record<string, NodeConfigValidationIssue[]> = {};
  const triggerNodes = graph.nodes.filter(
    (node) => node.data.family === "trigger",
  );

  if (triggerNodes.length !== 1) {
    issues.push("A workflow must have exactly one trigger node.");
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push("Graph contains an edge with a missing node.");
      break;
    }
  }

  const webhookPathSuffixes = new Set<string>();
  for (const node of graph.nodes) {
    const definition = getWorkflowNodeDefinition(node.data.kind);
    if (!definition) {
      issues.push(`Unknown node kind "${node.data.kind}".`);
      continue;
    }

    const configIssues = (definition.fields ?? [])
      .map((field) => ({
        key: field.key,
        message: validateNodeConfigField(field, node.data.config[field.key]),
      }))
      .filter(
        (
          issue,
        ): issue is {
          key: string;
          message: string;
        } => Boolean(issue.message),
      );

    if (configIssues.length > 0) {
      nodeIssues[node.id] = configIssues;
      issues.push(`${node.data.title} has invalid configuration.`);
    }

    if (node.data.kind === "webhook") {
      const suffix = String(node.data.config.pathSuffix ?? "").trim();
      if (suffix) {
        const normalized = suffix.toLowerCase();
        if (webhookPathSuffixes.has(normalized)) {
          issues.push(`Webhook path suffix "${suffix}" is duplicated.`);
        }
        webhookPathSuffixes.add(normalized);
      }
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const hasCycle = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (hasCycle(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  if (graph.nodes.some((node) => hasCycle(node.id))) {
    issues.push("Cycles are disabled in v1.");
  }

  for (const node of graph.nodes) {
    if (node.data.family !== "trigger") {
      const hasIncoming = graph.edges.some((edge) => edge.target === node.id);
      if (!hasIncoming) {
        issues.push(`Node "${node.data.title}" must have an incoming edge.`);
      }
    }
  }

  for (const node of graph.nodes) {
    if (node.data.kind !== "condition") {
      continue;
    }
    const outgoing = graph.edges.filter((edge) => edge.source === node.id);
    const branches = new Set(outgoing.map((edge) => edge.data?.branch));
    if (!branches.has("true") || !branches.has("false")) {
      issues.push(
        `Condition "${node.data.title}" must have both true and false branches.`,
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues: Array.from(new Set(issues)),
    nodeIssues,
    triggerNode: triggerNodes[0],
  };
}

export function workflowSlug(name: string) {
  return slugify(name) || "workflow";
}

export function nodeReferenceName(node: WorkflowNode) {
  return node.data.title.trim() || node.id;
}

export function hasTriggerNode(graph: WorkflowGraph) {
  return graph.nodes.some((node) => node.data.family === "trigger");
}

/**
 * Returns nodes upstream of `nodeId` (strict ancestors) following edge
 * direction source -> target. These are nodes that will have executed
 * before `nodeId` runs.
 */
export function getAncestorNodes(
  graph: WorkflowGraph,
  nodeId: string,
): WorkflowNode[] {
  const incoming = new Map<string, string[]>();
  for (const node of graph.nodes) incoming.set(node.id, []);
  for (const edge of graph.edges) {
    incoming.get(edge.target)?.push(edge.source);
  }

  const visited = new Set<string>();
  const stack = [...(incoming.get(nodeId) ?? [])];
  while (stack.length) {
    const next = stack.pop();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    for (const parent of incoming.get(next) ?? []) {
      if (!visited.has(parent)) stack.push(parent);
    }
  }

  return graph.nodes.filter((node) => visited.has(node.id));
}

export function applyGraphNodeChanges(
  graph: WorkflowGraph,
  changes: NodeChange[],
) {
  const nextNodes = applyNodeChanges(changes, graph.nodes as Node[]);
  return {
    ...graph,
    nodes: nextNodes.map((node: Node) => ({
      id: node.id,
      type: (node.type ?? "action") as WorkflowNode["type"],
      position: node.position,
      data: node.data as WorkflowNodeData,
    })),
  };
}

export function applyGraphNodePositionChanges(
  graph: WorkflowGraph,
  changes: NodeChange[],
) {
  const positions = new Map(
    changes
      .filter(
        (
          change,
        ): change is Extract<
          NodeChange,
          { type: "position"; position?: { x: number; y: number } }
        > => change.type === "position" && Boolean(change.position),
      )
      .map((change) => [change.id, change.position]),
  );

  if (positions.size === 0) {
    return graph;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const position = positions.get(node.id);
      return position ? { ...node, position } : node;
    }),
  };
}

export function applyGraphEdgeChanges(
  graph: WorkflowGraph,
  changes: EdgeChange[],
) {
  const nextEdges = applyEdgeChanges(changes, graph.edges as Edge[]);
  return {
    ...graph,
    edges: nextEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      data: edge.data as WorkflowEdgeData | undefined,
    })),
  };
}

export function connectGraph(graph: WorkflowGraph, connection: Connection) {
  const nextEdges = addEdge(
    {
      ...connection,
      id: createId("edge"),
      type: "smoothstep",
    },
    graph.edges as Edge[],
  );
  return {
    ...graph,
    edges: nextEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      data: edge.data as WorkflowEdgeData | undefined,
    })),
  };
}

export function getSelectedNode(graph: WorkflowGraph, nodeId?: string | null) {
  return graph.nodes.find((node) => node.id === nodeId) ?? null;
}

export function updateNode(
  graph: WorkflowGraph,
  nodeId: string,
  updater: (node: WorkflowNode) => WorkflowNode,
) {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId ? updater(node) : node,
    ),
  };
}

export function removeNode(graph: WorkflowGraph, nodeId: string) {
  return {
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
    edges: graph.edges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId,
    ),
  };
}

export function updateNodeDataField<T extends keyof WorkflowNodeData>(
  graph: WorkflowGraph,
  nodeId: string,
  field: T,
  value: WorkflowNodeData[T],
) {
  return updateNode(graph, nodeId, (node) => ({
    ...node,
    data: {
      ...node.data,
      [field]: value,
    },
  }));
}

export function cloneGraphWithNewIds(
  graph: WorkflowGraph,
  offset: WorkflowPosition = { x: 0, y: 0 },
): WorkflowGraph {
  const idMap = new Map<string, string>();
  const nodes = graph.nodes.map((node) => {
    const nextId = createId("node");
    idMap.set(node.id, nextId);
    return {
      ...node,
      id: nextId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      data: {
        ...node.data,
        config: structuredClone(node.data.config),
      },
    };
  });
  const edges = graph.edges
    .map((edge) => {
      const source = idMap.get(edge.source);
      const target = idMap.get(edge.target);
      if (!source || !target) return null;
      return {
        ...edge,
        id: createId("edge"),
        source,
        target,
      };
    })
    .filter((edge): edge is WorkflowEdge => edge !== null);
  return { nodes, edges };
}

export function mergeGraph(
  base: WorkflowGraph,
  addition: WorkflowGraph,
): WorkflowGraph {
  return {
    nodes: [...base.nodes, ...addition.nodes],
    edges: [...base.edges, ...addition.edges],
  };
}

export function updateNodeConfig(
  graph: WorkflowGraph,
  nodeId: string,
  key: string,
  value: unknown,
) {
  return updateNode(graph, nodeId, (node) => ({
    ...node,
    data: {
      ...node.data,
      config: {
        ...node.data.config,
        [key]: value,
      },
    },
  }));
}

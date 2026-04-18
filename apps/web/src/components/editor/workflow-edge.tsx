import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
  useReactFlow,
} from "@xyflow/react";
import { X } from "lucide-react";

export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const label = (data as { label?: string } | undefined)?.label;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="flex items-center gap-1"
        >
          {label && (
            <span className="mono rounded-[2px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1 py-[1px] text-[9px] uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
              {label}
            </span>
          )}
          {selected && (
            <button
              type="button"
              aria-label="Delete connection"
              onClick={(event) => {
                event.stopPropagation();
                void deleteElements({ edges: [{ id }] });
              }}
              className="grid h-4 w-4 place-items-center rounded-[2px] border border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white shadow-sm transition-colors hover:brightness-95"
            >
              <X className="h-2.5 w-2.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

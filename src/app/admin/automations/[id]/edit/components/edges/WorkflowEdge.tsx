'use client';

import * as React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from 'reactflow';
import { Plus } from 'lucide-react';

/**
 * Premium workflow edge that acts as a splice connector/drop-zone.
 *
 * - **Default State**: thin, slate-400
 * - **Hover/Selected/DragOver**: thick primary-colored stroke with pulse glow
 * - **Add Button (+)**: float icon at the midpoint with a WCAG-compliant 44x44px touch target
 */
export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  animated,
  style,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isDragOver = !!data?.isDragOver;
  const showControls = selected || isHovered || isDragOver;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
    offset: 20,
  });

  // ─── Styling definitions ───────────────────────────────────────────
  const stroke = isDragOver || selected
    ? 'hsl(var(--primary))'
    : (style?.stroke || (isHovered ? '#475569' : '#94a3b8')); // slate-600 vs slate-400

  const strokeWidth = isDragOver ? 4 : selected ? 3 : isHovered ? 2.5 : (style?.strokeWidth || 1.5);
  const opacity = style?.opacity ?? 1;
  
  // Animate if selected, explicitly traversed, or currently dragging over
  const isAnimated = selected || animated || isDragOver;

  const markerEnd = isDragOver || selected
    ? 'url(#arrowhead-selected)'
    : 'url(#arrowhead-default)';

  return (
    <>
      <defs>
        <marker
          id="arrowhead-selected"
          markerWidth="20"
          markerHeight="20"
          refX="10"
          refY="10"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 20 10 L 0 20 z" fill="hsl(var(--primary))" />
        </marker>
        <marker
          id="arrowhead-default"
          markerWidth="14"
          markerHeight="14"
          refX="7"
          refY="7"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 14 7 L 0 14 z" fill="#94a3b8" />
        </marker>
      </defs>

      {/* Invisible wider hit-area for touch & mouse hover targeting (44px) */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={44}
        stroke="transparent"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Pulsed glowing aura during dragOver */}
      {isDragOver && (
        <path
          d={edgePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={12}
          strokeOpacity={0.2}
          className="animate-pulse"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Selected glow effect */}
      {selected && !isDragOver && (
        <path
          d={edgePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={8}
          strokeOpacity={0.12}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Main visible connection line */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: isAnimated ? '5,5' : undefined,
          animation: isAnimated ? 'flowDash 0.5s linear infinite' : undefined,
          transition: 'stroke 0.25s cubic-bezier(0.23, 1, 0.32, 1), stroke-width 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
          opacity,
          ...style,
        }}
        interactionWidth={44}
      />

      <style>{`
        @keyframes flowDash {
          from {
            stroke-dashoffset: 10;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      {/* Plus splice button centered at midpoint with 44x44px touch wrapping */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan flex items-center justify-center"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            width: 44,
            height: 44,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            type="button"
            onClick={(evt) => {
              evt.stopPropagation();
              data?.onAddNode?.();
            }}
            className="group/btn flex items-center justify-center rounded-full border bg-background shadow-lg transition-all duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
            style={{
              width: 28,
              height: 28,
              opacity: showControls ? 1 : 0,
              transform: showControls ? 'scale(1)' : 'scale(0.4)',
              transition: 'opacity 0.25s cubic-bezier(0.23, 1, 0.32, 1), transform 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
              borderColor: isDragOver || selected ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              pointerEvents: showControls ? 'auto' : 'none',
            }}
            aria-label="Insert step"
          >
            <Plus className="h-4 w-4 text-muted-foreground group-hover/btn:text-primary-foreground transition-colors" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default WorkflowEdge;

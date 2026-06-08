'use client';

import * as React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from 'reactflow';
import { X } from 'lucide-react';

/**
 * Custom edge with visual selection state and a floating delete (×) button.
 *
 * - **Non-selected**: thin (1.5px), muted gray, no animation
 * - **Selected**: thick (3px), primary color, animated pulse
 * - **× button**: visible on hover OR when selected
 */
export function DeletableEdge({
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
  const showControls = !!selected;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,   // smaller border radius for cleaner curves
    offset: 20,         // smaller offset prevents wide looping/zig-zagging
  });

  const onDelete = React.useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation();
      data?.onDelete?.(id);
    },
    [id, data],
  );

  // ─── Visual state ───────────────────────────────────────────────────
  const stroke = selected
    ? 'hsl(var(--primary))'
    : (style?.stroke || (isHovered
      ? '#64748b'   // slate-500 on hover
      : '#94a3b8'));  // slate-400 default

  const strokeWidth = selected ? 3 : isHovered ? 2.5 : (style?.strokeWidth || 1.5);
  const opacity = style?.opacity ?? 1;
  const isAnimated = selected || animated;

  const markerEnd = selected
    ? 'url(#arrowhead-selected)'
    : 'url(#arrowhead-default)';

  return (
    <>
      {/* SVG defs for arrowhead markers */}
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
          <path
            d="M 0 0 L 20 10 L 0 20 z"
            fill="hsl(var(--primary))"
          />
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
          <path
            d="M 0 0 L 14 7 L 0 14 z"
            fill="#94a3b8"
          />
        </marker>
      </defs>

      {/* Invisible wider hit-area for hover targeting */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={24}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Main visible edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: isAnimated ? '5,5' : undefined,
          animation: isAnimated ? 'flowDash 0.5s linear infinite' : undefined,
          transition: 'stroke 0.2s ease, stroke-width 0.15s ease',
          opacity,
          ...style,
        }}
        interactionWidth={24}
      />

      {/* Embedded style tag for custom self-contained keyframe animation */}
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

      {/* Selected glow effect */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={8}
          strokeOpacity={0.12}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Delete button at edge midpoint */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            type="button"
            onClick={onDelete}
            className="group/btn flex items-center justify-center rounded-full border bg-background shadow-lg transition-all duration-200 hover:bg-destructive hover:shadow-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            style={{
              width: 24,
              height: 24,
              opacity: showControls ? 1 : 0,
              transform: showControls ? 'scale(1)' : 'scale(0.4)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              borderColor: selected ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              pointerEvents: showControls ? 'auto' : 'none',
            }}
            aria-label="Remove connection"
          >
            <X className="h-3 w-3 text-muted-foreground group-hover/btn:text-destructive-foreground transition-colors" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default DeletableEdge;

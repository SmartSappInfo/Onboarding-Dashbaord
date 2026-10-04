'use client';

/**
 * @fileOverview Workflow DAG Topology Visualizer (Phase 7 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 55: Hard DAG complexity bounds (<= 50 nodes).
 * - SVG vector rendering of directed acyclic graph topology with dependency arrows.
 * - Dynamic status coloring and pulse indicators for in-flight steps.
 * - Interactive step selection for inspection.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  CircleDashed,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import type { WorkflowStep, WorkflowStepStatus } from '@/platform/workflows/workflow-types';

export interface WorkflowDagVisualizerProps {
  steps: WorkflowStep[];
  selectedStepId?: string;
  onSelectStep?: (step: WorkflowStep) => void;
  className?: string;
}

interface NodeLayout {
  step: WorkflowStep;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
}

export function WorkflowDagVisualizer({
  steps,
  selectedStepId,
  onSelectStep,
  className = '',
}: WorkflowDagVisualizerProps) {
  // Rule 55: Enforce complexity bounds <= 50 nodes
  const boundedSteps = React.useMemo(() => {
    return steps.slice(0, 50);
  }, [steps]);

  // Compute topological layers using dependency depths
  const layoutNodes = React.useMemo<NodeLayout[]>(() => {
    if (boundedSteps.length === 0) return [];

    const depthMap = new Map<string, number>();

    // Helper to calculate depth
    const getDepth = (id: string, visited = new Set<string>()): number => {
      if (depthMap.has(id)) return depthMap.get(id)!;
      if (visited.has(id)) return 0; // Guard against cycles
      visited.add(id);

      const step = boundedSteps.find((s) => s.id === id);
      if (!step || !step.dependsOn || step.dependsOn.length === 0) {
        depthMap.set(id, 0);
        return 0;
      }

      let maxParentDepth = 0;
      for (const parentId of step.dependsOn) {
        maxParentDepth = Math.max(maxParentDepth, getDepth(parentId, new Set(visited)) + 1);
      }
      depthMap.set(id, maxParentDepth);
      return maxParentDepth;
    };

    boundedSteps.forEach((s) => getDepth(s.id));

    // Group nodes by layer
    const layers: WorkflowStep[][] = [];
    boundedSteps.forEach((s) => {
      const layer = depthMap.get(s.id) || 0;
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(s);
    });

    const nodeWidth = 220;
    const nodeHeight = 84;
    const layerSpacing = 280;
    const nodeSpacingY = 110;

    const result: NodeLayout[] = [];

    layers.forEach((layerSteps, layerIdx) => {
      const totalLayerHeight = layerSteps.length * nodeHeight + (layerSteps.length - 1) * (nodeSpacingY - nodeHeight);
      const startY = 40 + Math.max(0, (300 - totalLayerHeight) / 2);

      layerSteps.forEach((step, stepIdxInLayer) => {
        result.push({
          step,
          x: 40 + layerIdx * layerSpacing,
          y: startY + stepIdxInLayer * nodeSpacingY,
          width: nodeWidth,
          height: nodeHeight,
          layer: layerIdx,
        });
      });
    });

    return result;
  }, [boundedSteps]);

  // Compute SVG viewport dimensions
  const svgDimensions = React.useMemo(() => {
    if (layoutNodes.length === 0) return { width: 600, height: 300 };
    const maxX = Math.max(...layoutNodes.map((n) => n.x + n.width)) + 60;
    const maxY = Math.max(...layoutNodes.map((n) => n.y + n.height)) + 60;
    return {
      width: Math.max(maxX, 640),
      height: Math.max(maxY, 320),
    };
  }, [layoutNodes]);

  // Build edge paths connecting dependencies
  const edges = React.useMemo(() => {
    const list: Array<{ from: NodeLayout; to: NodeLayout; path: string; key: string }> = [];
    const nodeMap = new Map<string, NodeLayout>();
    layoutNodes.forEach((n) => nodeMap.set(n.step.id, n));

    layoutNodes.forEach((toNode) => {
      toNode.step.dependsOn?.forEach((parentId) => {
        const fromNode = nodeMap.get(parentId);
        if (fromNode) {
          const startX = fromNode.x + fromNode.width;
          const startY = fromNode.y + fromNode.height / 2;
          const endX = toNode.x;
          const endY = toNode.y + toNode.height / 2;
          const midX = (startX + endX) / 2;

          const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
          list.push({
            from: fromNode,
            to: toNode,
            path,
            key: `${fromNode.step.id}->${toNode.step.id}`,
          });
        }
      });
    });

    return list;
  }, [layoutNodes]);

  const getNodeColors = (status: WorkflowStepStatus, isSelected: boolean) => {
    const baseBorder = isSelected ? 'stroke-primary stroke-2' : 'stroke-border/80';
    switch (status) {
      case 'COMPLETED':
        return {
          bg: 'fill-emerald-500/10 dark:fill-emerald-950/20',
          stroke: isSelected ? 'stroke-emerald-500' : 'stroke-emerald-500/40',
          badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        };
      case 'RUNNING':
        return {
          bg: 'fill-blue-500/10 dark:fill-blue-950/20',
          stroke: isSelected ? 'stroke-blue-500' : 'stroke-blue-500/50',
          badgeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        };
      case 'WAITING':
        return {
          bg: 'fill-amber-500/10 dark:fill-amber-950/20',
          stroke: isSelected ? 'stroke-amber-500' : 'stroke-amber-500/50',
          badgeBg: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
        };
      case 'FAILED':
        return {
          bg: 'fill-destructive/10 dark:fill-destructive/20',
          stroke: isSelected ? 'stroke-destructive' : 'stroke-destructive/50',
          badgeBg: 'bg-destructive/15 text-destructive border-destructive/30',
        };
      case 'QUEUED':
        return {
          bg: 'fill-sky-500/10 dark:fill-sky-950/20',
          stroke: isSelected ? 'stroke-sky-500' : 'stroke-sky-500/40',
          badgeBg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
        };
      default:
        return {
          bg: 'fill-card',
          stroke: baseBorder,
          badgeBg: 'bg-muted text-muted-foreground border-border/80',
        };
    }
  };

  const getStatusIcon = (status: WorkflowStepStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />;
      case 'RUNNING':
        return <Play className="h-3 w-3 text-blue-600 dark:text-blue-400 animate-pulse" />;
      case 'WAITING':
        return <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
      case 'FAILED':
        return <AlertTriangle className="h-3 w-3 text-destructive" />;
      default:
        return <CircleDashed className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (steps.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border/80 rounded-2xl p-6 text-center text-muted-foreground text-sm">
        <Layers className="h-8 w-8 mb-2 opacity-50" />
        <p>No steps registered for this workflow instance.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-x-auto border border-border/80 rounded-2xl bg-muted/10 p-4 ${className}`}>
      {steps.length > 50 && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Rule 55: Workflow graph exceeds 50 steps. Visualizer clamped to the first 50 nodes.</span>
        </div>
      )}

      <svg
        width={svgDimensions.width}
        height={svgDimensions.height}
        className="w-full select-none"
        style={{ minWidth: `${svgDimensions.width}px`, minHeight: `${svgDimensions.height}px` }}
      >
        <defs>
          <marker
            id="dag-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-muted-foreground/50" />
          </marker>
        </defs>

        {/* Directed Dependency Edges */}
        {edges.map((edge) => (
          <path
            key={edge.key}
            d={edge.path}
            fill="none"
            className="stroke-muted-foreground/40 dark:stroke-muted-foreground/30 stroke-2"
            markerEnd="url(#dag-arrow)"
          />
        ))}

        {/* Nodes */}
        {layoutNodes.map((node) => {
          const isSelected = selectedStepId === node.step.id;
          const colors = getNodeColors(node.step.status, isSelected);

          return (
            <g
              key={node.step.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer transition-transform group"
              onClick={() => onSelectStep?.(node.step)}
            >
              {/* Node Card Rectangle */}
              <rect
                width={node.width}
                height={node.height}
                rx={12}
                className={`${colors.bg} ${colors.stroke} stroke-[1.5] transition-all group-hover:stroke-primary`}
                filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.05))"
              />

              {/* Node Content (HTML foreignObject for rich typography) */}
              <foreignObject width={node.width} height={node.height} className="p-2.5">
                <div className="h-full flex flex-col justify-between text-xs pointer-events-none">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold truncate text-foreground text-xs" title={node.step.name}>
                        {node.step.name}
                      </span>
                      <div className="shrink-0">{getStatusIcon(node.step.status)}</div>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground truncate" title={node.step.capabilityId}>
                      {node.step.capabilityId}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                    <span className="font-medium capitalize">{node.step.status.toLowerCase()}</span>
                    {node.step.durationMs ? (
                      <span>{Math.round(node.step.durationMs)}ms</span>
                    ) : (
                      <span>Att: {node.step.attempt + 1}/{node.step.maxAttempts}</span>
                    )}
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

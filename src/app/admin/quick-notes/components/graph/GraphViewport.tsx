'use client';

import * as React from 'react';
import {
  getNodeTypeColor,
  getRelationEdgeColor,
} from '@/lib/quick-notes-domain';
import type {
  GraphNode,
  GraphEdge,
  GraphMode,
} from '@/lib/quick-notes-types';

interface GraphViewportProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  highlightedPath?: string[];
  mode?: GraphMode;
  physicsEnabled?: boolean;
  searchQuery?: string;
}

interface SimulatedNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

/**
 * High-performance 60fps Interactive Force Graph Viewport (Phase 5).
 *
 * Implements bounded physics simulation, pan/zoom transforms, node dragging,
 * edge marker arrows, path highlights, and touch gestures.
 */
export function GraphViewport({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  highlightedPath = [],
  mode = 'explore',
  physicsEnabled = true,
  searchQuery = '',
}: GraphViewportProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = React.useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);

  // Simulation state
  const simNodesRef = React.useRef<SimulatedNode[]>([]);
  const [, setTick] = React.useState(0);
  const animFrameRef = React.useRef<number | null>(null);

  // Measure container size
  React.useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: clientWidth || 800,
          height: clientHeight || 600,
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Initialize node coordinates in a circular cluster
  React.useEffect(() => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const existingMap = new Map(simNodesRef.current.map((n) => [n.id, n]));

    const count = nodes.length;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35;

    simNodesRef.current = nodes.map((node, idx) => {
      const existing = existingMap.get(node.id);
      if (existing) {
        return {
          ...node,
          x: existing.x,
          y: existing.y,
          vx: existing.vx || 0,
          vy: existing.vy || 0,
          fx: existing.fx,
          fy: existing.fy,
        };
      }

      const angle = (idx / (count || 1)) * 2 * Math.PI;
      return {
        ...node,
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      };
    });

    setTick((t) => t + 1);
  }, [nodes, dimensions.width, dimensions.height]);

  // Physics Simulation Loop (Decayed to save CPU/Battery)
  React.useEffect(() => {
    if (!physicsEnabled) return;

    let step = 0;
    const maxSteps = 150; // Decay after 150 frames of stabilization

    const runPhysics = () => {
      const simNodes = simNodesRef.current;
      if (simNodes.length === 0) return;

      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

      // 1. Repulsion between all node pairs (Coulomb's Law)
      const repulsion = 450;
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          if (dist < 300) {
            const force = repulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (a.fx == null) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (b.fx == null) {
              b.vx += fx;
              b.vy += fy;
            }
          }
        }
      }

      // 2. Spring Attraction along Edges (Hooke's Law)
      const idealDist = 120;
      const springK = 0.04;
      for (const edge of edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const displacement = dist - idealDist;
          const fx = (dx / dist) * displacement * springK;
          const fy = (dy / dist) * displacement * springK;

          if (source.fx == null) {
            source.vx += fx;
            source.vy += fy;
          }
          if (target.fx == null) {
            target.vx -= fx;
            target.vy -= fy;
          }
        }
      }

      // 3. Centering Gravity & Velocity Damping
      const damping = 0.85;
      const gravity = 0.015;
      for (const node of simNodes) {
        if (node.fx != null && node.fy != null) {
          node.x = node.fx;
          node.y = node.fy;
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        node.vx += (cx - node.x) * gravity;
        node.vy += (cy - node.y) * gravity;

        node.vx *= damping;
        node.vy *= damping;

        node.x += node.vx;
        node.y += node.vy;
      }

      step++;
      setTick((t) => t + 1);

      if (step < maxSteps || draggedNodeId != null) {
        animFrameRef.current = requestAnimationFrame(runPhysics);
      }
    };

    animFrameRef.current = requestAnimationFrame(runPhysics);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [physicsEnabled, edges, edges.length, nodes.length, dimensions.width, dimensions.height, draggedNodeId]);

  // Wheel Zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((prev) => {
      const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.2), 3.0);
      return { ...prev, scale: newScale };
    });
  };

  // Pan Handlers using unified Pointer Events (supporting touch, stylus, and mouse)
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'viewport-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    } else if (draggedNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
      const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;

      const node = simNodesRef.current.find((n) => n.id === draggedNodeId);
      if (node) {
        node.fx = mouseX;
        node.fy = mouseY;
        node.x = mouseX;
        node.y = mouseY;
        setTick((t) => t + 1);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    if (draggedNodeId) {
      const node = simNodesRef.current.find((n) => n.id === draggedNodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      setDraggedNodeId(null);
    }
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Best-effort release
    }
  };

  const simNodes = simNodesRef.current;
  const simNodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const pathSet = new Set(highlightedPath);

  // Active or connected nodes for dimming effect
  const activeNeighborSet = React.useMemo(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>([selectedNodeId]);
    for (const edge of edges) {
      if (edge.source === selectedNodeId) set.add(edge.target);
      if (edge.target === selectedNodeId) set.add(edge.source);
    }
    return set;
  }, [selectedNodeId, edges]);

  return (
    <div
      ref={containerRef}
      id="viewport-container"
      className="relative w-full h-full min-h-[480px] bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden cursor-grab active:cursor-grabbing select-none rounded-2xl border border-border touch-none"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <svg
        id="viewport-bg"
        className="w-full h-full"
        onClick={() => onSelectNode(null)}
      >
        <defs>
          {/* Arrow markers for directed edges */}
          <marker
            id="arrow-default"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
          </marker>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" />
          </marker>
          <marker
            id="arrow-supports"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#10B981" />
          </marker>
          <marker
            id="arrow-contradicts"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* 1. Render Edges */}
          {edges.map((edge) => {
            const source = simNodeMap.get(edge.source);
            const target = simNodeMap.get(edge.target);
            if (!source || !target) return null;

            const isPathEdge =
              pathSet.has(edge.source) && pathSet.has(edge.target) && pathSet.size > 1;
            const isHovered = hoveredEdgeId === edge.id;
            const isConnectedToSelected =
              selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);

            const strokeColor = isPathEdge
              ? '#6366F1'
              : isConnectedToSelected
              ? '#3B82F6'
              : getRelationEdgeColor(edge.relationType);

            const strokeWidth = isPathEdge ? 3.5 : isHovered ? 2.5 : isConnectedToSelected ? 2.0 : 1.2;
            const opacity =
              activeNeighborSet && !activeNeighborSet.has(edge.source) && !activeNeighborSet.has(edge.target)
                ? 0.15
                : 0.75;

            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            let markerId = 'arrow-default';
            if (edge.relationType === 'supports' || edge.relationType === 'evidences') {
              markerId = 'arrow-supports';
            } else if (edge.relationType === 'contradicts') {
              markerId = 'arrow-contradicts';
            } else if (isConnectedToSelected || isPathEdge) {
              markerId = 'arrow-active';
            }

            return (
              <g
                key={edge.id}
                className="transition-opacity duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseLeave={() => setHoveredEdgeId(null)}
              >
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeDasharray={edge.relationType === 'contradicts' ? '4 3' : undefined}
                  markerEnd={`url(#${markerId})`}
                />
                {/* Edge Label on hover or active */}
                {(isHovered || isConnectedToSelected || isPathEdge) && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-38"
                      y="-11"
                      width="76"
                      height="18"
                      rx="4"
                      className="fill-background/90 stroke-border shadow-xs"
                      strokeWidth="0.75"
                    />
                    <text
                      textAnchor="middle"
                      dy="2.5"
                      className="text-[9px] font-medium fill-foreground tracking-tight select-none"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 2. Render Nodes */}
          {simNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isPathNode = pathSet.has(node.id);
            const isDimmed = activeNeighborSet && !activeNeighborSet.has(node.id);
            const isSearchMatched =
              searchQuery && node.label.toLowerCase().includes(searchQuery.toLowerCase());

            const colorMeta = getNodeTypeColor(node.type);
            const radius = node.isHub ? 18 : 14;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className={`transition-opacity duration-200 cursor-pointer ${
                  isDimmed ? 'opacity-25' : 'opacity-100'
                }`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDraggedNodeId(node.id);
                  (e.currentTarget as Element).setPointerCapture(e.pointerId);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.id === selectedNodeId ? null : node.id);
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Glowing Outer Rings for Selected / Path Nodes */}
                {(isSelected || isPathNode || isSearchMatched) && (
                  <circle
                    r={radius + 8}
                    className={`animate-pulse ${
                      isPathNode
                        ? 'fill-indigo-500/20 stroke-indigo-500'
                        : isSearchMatched
                        ? 'fill-amber-500/20 stroke-amber-500'
                        : 'fill-blue-500/20 stroke-blue-500'
                    }`}
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                )}

                {/* Node Base Circle */}
                <circle
                  r={radius}
                  fill={colorMeta.hex}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 3 : 2}
                  className="shadow-sm transition-transform hover:scale-110"
                />

                {/* Hub Badge Indicator */}
                {node.isHub && (
                  <circle
                    r="4.5"
                    cx={radius * 0.7}
                    cy={-radius * 0.7}
                    fill="#F59E0B"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />
                )}

                {/* Node Text Label */}
                <text
                  textAnchor="middle"
                  dy={radius + 14}
                  className={`text-[11px] font-medium select-none pointer-events-none tracking-tight ${
                    isSelected
                      ? 'fill-blue-600 dark:fill-blue-400 font-semibold'
                      : isPathNode
                      ? 'fill-indigo-600 dark:fill-indigo-400 font-semibold'
                      : 'fill-foreground/90'
                  }`}
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                </text>

                {/* Sub-label Type indicator */}
                {(isHovered || isSelected) && (
                  <text
                    textAnchor="middle"
                    dy={radius + 25}
                    className="text-[9px] uppercase tracking-wider fill-muted-foreground select-none pointer-events-none"
                  >
                    {node.type}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

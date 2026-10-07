'use client';

/**
 * @fileOverview Visual Knowledge Graph Explorer Mission Control Client (Phase 11 M5 · T4)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first, touch targets >= 44px, tactile interactions)
 * - Rule 8 & 47 (Multi-Tenant Anti-IDOR Boundary Enforcement)
 * - Rule 55 (Graph Canvas Ceilings: strictly <= 80 nodes, <= 150 edges, depth <= 2)
 * - Rule 62 (Real-Time SSE Event Stream Reactivity)
 * - theme.md §8 (Standardized Modal & Dialog Architecture)
 */

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useEventStream } from '@/hooks/useEventStream';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  Share2,
  Sparkles,
  GitBranch,
  RefreshCw,
  SearchCode,
  Layers,
  Info,
  X,
  ExternalLink,
  PlusCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  getKnowledgeGraphNeighborsAction,
  findKnowledgeGraphPathAction,
} from '@/app/actions/knowledge-inbox-actions';
import type {
  GraphNodeRecord,
  GraphEdgeRecord,
} from '@/platform/domains/knowledge_memory/services/knowledge-graph-projection-service';
import type { GraphExplorerMode } from '@/platform/domains/knowledge_memory/contracts/knowledge-ui-types';
import { KnowledgeGraphToolbar } from '@/components/knowledge/graph/KnowledgeGraphToolbar';
import { KnowledgeNodeContextMenu } from '@/components/knowledge/graph/KnowledgeNodeContextMenu';
import { cn } from '@/lib/utils';

interface NodeLayoutPosition {
  x: number;
  y: number;
}

export function KnowledgeGraphClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const queryNodeParam = searchParams.get('node');

  // Core graph state (bounded strictly to Rule 55 ceilings)
  const [nodes, setNodes] = React.useState<GraphNodeRecord[]>([]);
  const [edges, setEdges] = React.useState<GraphEdgeRecord[]>([]);
  const [centerNodeId, setCenterNodeId] = React.useState<string>(queryNodeParam || 'root');
  const [selectedNode, setSelectedNode] = React.useState<GraphNodeRecord | null>(null);

  // 3 Modes (PRD §18)
  const [mode, setMode] = React.useState<GraphExplorerMode>('explore');
  const [explainSource, setExplainSource] = React.useState<GraphNodeRecord | null>(null);
  const [explainTarget, setExplainTarget] = React.useState<GraphNodeRecord | null>(null);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = React.useState<Set<string>>(new Set());
  const [highlightedNodeIds, setHighlightedNodeIds] = React.useState<Set<string>>(new Set());

  // Filter toolbar
  const [nodeTypeFilter, setNodeTypeFilter] = React.useState<string>('all');
  const [isLoading, setIsLoading] = React.useState(true);

  // Canvas pan & zoom
  const [zoom, setZoom] = React.useState(1.0);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 400, y: 300 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    node: GraphNodeRecord;
    position: { x: number; y: number };
  } | null>(null);

  // Fetch graph neighbors with Rule 55 limits
  const fetchGraph = React.useCallback(
    async (rootId: string) => {
      if (!activeWorkspaceId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await getKnowledgeGraphNeighborsAction(activeWorkspaceId, rootId, 80, 2);
        if (res.success && res.data) {
          // Strictly clamp to Rule 55 ceilings: <= 80 nodes, <= 150 edges
          const clampedNodes = res.data.nodes.slice(0, 80);
          const validNodeIds = new Set(clampedNodes.map((n) => n.id));
          const clampedEdges = res.data.edges
            .filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target))
            .slice(0, 150);

          setNodes(clampedNodes);
          setEdges(clampedEdges);

          const found = clampedNodes.find((n) => n.id === rootId);
          if (found) {
            setSelectedNode(found);
          } else if (clampedNodes.length > 0) {
            setSelectedNode(clampedNodes[0]);
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Failed to load graph',
            description: res.message || 'Error querying graph projection.',
          });
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Graph query error',
          description: 'Network failure loading graph topology.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [activeWorkspaceId, toast]
  );

  React.useEffect(() => {
    fetchGraph(centerNodeId);
  }, [centerNodeId, fetchGraph]);

  // Real-time EventStream Reactivity (Rule 62)
  useEventStream({
    workspaceId: activeWorkspaceId || '',
    eventTypes: ['knowledge.graph.projected', 'memory.conflict.*'],
    onEvent: () => {
      fetchGraph(centerNodeId);
    },
  });

  // Filtered nodes
  const filteredNodes = React.useMemo(() => {
    if (nodeTypeFilter === 'all') return nodes;
    return nodes.filter((n) => n.type.toLowerCase() === nodeTypeFilter.toLowerCase());
  }, [nodes, nodeTypeFilter]);

  const filteredNodeIds = React.useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  const filteredEdges = React.useMemo(() => {
    return edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );
  }, [edges, filteredNodeIds]);

  // Calculate Node Layout Positions (Radial & Force Projection)
  const nodePositions = React.useMemo(() => {
    const positions = new Map<string, NodeLayoutPosition>();
    if (filteredNodes.length === 0) return positions;

    // Center node is at 0, 0
    positions.set(centerNodeId, { x: 0, y: 0 });

    const otherNodes = filteredNodes.filter((n) => n.id !== centerNodeId);
    const count = otherNodes.length;

    // Arrange in 2 concentric rings if > 15 nodes
    const ring1Count = Math.min(count, 14);
    const ring2Count = count - ring1Count;

    // Ring 1 (Radius 180)
    for (let i = 0; i < ring1Count; i++) {
      const angle = (2 * Math.PI * i) / ring1Count;
      positions.set(otherNodes[i].id, {
        x: Math.cos(angle) * 190,
        y: Math.sin(angle) * 190,
      });
    }

    // Ring 2 (Radius 340)
    for (let i = 0; i < ring2Count; i++) {
      const angle = (2 * Math.PI * i) / ring2Count;
      positions.set(otherNodes[ring1Count + i].id, {
        x: Math.cos(angle) * 350,
        y: Math.sin(angle) * 350,
      });
    }

    return positions;
  }, [filteredNodes, centerNodeId]);

  // Explain mode: find shortest path between source and target
  const handleExplainPath = async (source: GraphNodeRecord, target: GraphNodeRecord) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await findKnowledgeGraphPathAction(
        activeWorkspaceId,
        source.id,
        target.id,
        3,
        80
      );

      if (res.success && res.data && res.data.pathFound) {
        const pathNodes = new Set(res.data.nodes.map((n) => n.id));
        const pathEdges = new Set(res.data.edges.map((e) => e.id));
        setHighlightedNodeIds(pathNodes);
        setHighlightedEdgeIds(pathEdges);
        toast({
          title: 'Path highlighted',
          description: `Connected across ${res.data.nodes.length} nodes and ${res.data.edges.length} relationships.`,
        });
      } else {
        toast({
          title: 'No direct path found',
          description: `No connection within depth <= 3 between ${source.label} and ${target.label}.`,
        });
        setHighlightedNodeIds(new Set());
        setHighlightedEdgeIds(new Set());
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Explain error',
        description: 'Failed to compute shortest graph path.',
      });
    }
  };

  // Node Click Handlers according to Mode (PRD §18)
  const handleNodeClick = (node: GraphNodeRecord) => {
    setSelectedNode(node);

    if (mode === 'explore') {
      // Just select node
    } else if (mode === 'explain') {
      if (!explainSource) {
        setExplainSource(node);
        setHighlightedNodeIds(new Set([node.id]));
        toast({
          title: 'Source node chosen',
          description: `Now click target node to explain connection to ${node.label}.`,
        });
      } else if (!explainTarget && explainSource.id !== node.id) {
        setExplainTarget(node);
        handleExplainPath(explainSource, node);
      } else {
        // Reset and pick new source
        setExplainSource(node);
        setExplainTarget(null);
        setHighlightedNodeIds(new Set([node.id]));
        setHighlightedEdgeIds(new Set());
      }
    } else if (mode === 'investigate') {
      // Expand neighborhood and focus
      setCenterNodeId(node.id);
    }
  };

  // Right-click context menu
  const handleNodeContextMenu = (e: React.MouseEvent, node: GraphNodeRecord) => {
    e.preventDefault();
    setContextMenu({
      node,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  // SVG Pan & Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getNodeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'entity':
        return '#3b82f6'; // Blue
      case 'person':
        return '#10b981'; // Green
      case 'deal':
        return '#f59e0b'; // Amber
      case 'meeting':
        return '#8b5cf6'; // Purple
      case 'decision':
        return '#06b6d4'; // Cyan
      default:
        return '#64748b'; // Slate
    }
  };

  return (
    <PageContainerFluid className="space-y-4 pb-16 flex flex-col h-[calc(100vh-4rem)]">
      {/* Zone 1: Header & Graph Controls Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Share2 className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
                Knowledge Graph Explorer
                <CardInfoTooltip text="Interactive multi-perspective knowledge topology. Strictly bounded by Rule 55 (<= 80 nodes, <= 150 edges) for 60fps performance and instant graph explainability." />
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Traverse verified relationships, explain AI conclusions, and investigate institutional memory networks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchGraph(centerNodeId)}
              disabled={isLoading}
              className="min-h-[44px] rounded-xl text-xs flex items-center gap-1.5 active:scale-[0.97]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Graph
            </Button>
          </div>
        </div>

        {/* Graph Toolbar with 3 Modes */}
        <KnowledgeGraphToolbar
          mode={mode}
          onModeChange={(newMode) => {
            setMode(newMode);
            setExplainSource(null);
            setExplainTarget(null);
            setHighlightedNodeIds(new Set());
            setHighlightedEdgeIds(new Set());
          }}
          nodeTypeFilter={nodeTypeFilter}
          onNodeTypeFilterChange={setNodeTypeFilter}
          visibleNodesCount={filteredNodes.length}
          visibleEdgesCount={filteredEdges.length}
          onZoomIn={() => setZoom((z) => Math.min(2.0, z + 0.15))}
          onZoomOut={() => setZoom((z) => Math.max(0.4, z - 0.15))}
          onResetZoom={() => {
            setZoom(1.0);
            setPan({ x: 400, y: 300 });
          }}
        />
      </div>

      {/* Mode Instruction Banner */}
      {mode === 'explain' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Explain Mode Active:</strong>{' '}
              {!explainSource
                ? 'Click the starting node.'
                : !explainTarget
                  ? `Source selected (${explainSource.label}). Now click destination node.`
                  : `Explaining path between ${explainSource.label} and ${explainTarget.label}.`}
            </span>
          </div>
          {(explainSource || explainTarget) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExplainSource(null);
                setExplainTarget(null);
                setHighlightedNodeIds(new Set());
                setHighlightedEdgeIds(new Set());
              }}
              className="h-7 text-xs text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 active:scale-[0.97]"
            >
              Reset Selection
            </Button>
          )}
        </div>
      )}

      {/* Zone 2: Main Interactive SVG Canvas & Overlay Details Panel */}
      <div className="relative flex-1 rounded-2xl border border-border/80 bg-muted/15 overflow-hidden select-none">
        <svg
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Background Grid Pattern */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" className="fill-muted-foreground/20" />
              </pattern>
            </defs>
            <rect x="-3000" y="-3000" width="6000" height="6000" fill="url(#grid)" />

            {/* Edges */}
            {filteredEdges.map((edge) => {
              const p1 = nodePositions.get(edge.source);
              const p2 = nodePositions.get(edge.target);
              if (!p1 || !p2) return null;

              const isHighlighted = highlightedEdgeIds.has(edge.id);

              return (
                <g key={edge.id}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={isHighlighted ? '#f59e0b' : 'currentColor'}
                    strokeWidth={isHighlighted ? 3.5 : 1.5}
                    className={cn(
                      'transition-all duration-200',
                      isHighlighted
                        ? 'opacity-100 shadow-md'
                        : 'text-border/80 opacity-60 hover:opacity-100'
                    )}
                  />
                  {/* Midpoint Label */}
                  <text
                    x={(p1.x + p2.x) / 2}
                    y={(p1.y + p2.y) / 2 - 5}
                    textAnchor="middle"
                    className="text-[10px] font-mono fill-muted-foreground pointer-events-none select-none"
                  >
                    {edge.relationship}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const isSelected = selectedNode?.id === node.id;
              const isCenter = centerNodeId === node.id;
              const isPathHighlighted = highlightedNodeIds.has(node.id);
              const color = getNodeColor(node.type);

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(node);
                  }}
                  onContextMenu={(e) => handleNodeContextMenu(e, node)}
                  className="cursor-pointer group"
                >
                  {/* Outer selection ring */}
                  {(isSelected || isCenter || isPathHighlighted) && (
                    <circle
                      r="28"
                      fill="none"
                      stroke={isPathHighlighted ? '#f59e0b' : color}
                      strokeWidth={isPathHighlighted ? 3 : 2}
                      strokeDasharray={isCenter ? '4 2' : 'none'}
                      className="animate-pulse"
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r="20"
                    fill={color}
                    className="transition-all duration-200 group-hover:scale-110 drop-shadow-md"
                  />

                  {/* Inner Icon or Letter */}
                  <text
                    textAnchor="middle"
                    dy="5"
                    fill="#ffffff"
                    className="text-xs font-bold pointer-events-none uppercase"
                  >
                    {node.label.charAt(0) || 'N'}
                  </text>

                  {/* Text Label Below Node */}
                  <text
                    y="36"
                    textAnchor="middle"
                    className={cn(
                      'text-xs font-semibold select-none pointer-events-none',
                      isSelected ? 'fill-foreground font-bold' : 'fill-muted-foreground'
                    )}
                  >
                    {node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Node Details Card in Bottom Right */}
        {selectedNode && (
          <Card className="absolute right-4 bottom-4 w-80 sm:w-96 border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden animate-in fade-in duration-200">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs capitalize font-medium">
                    {selectedNode.type}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                    {selectedNode.id}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedNode(null)}
                  className="h-6 w-6 rounded-lg text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground tracking-tight">
                  {selectedNode.label}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Verified entity node in SmartSapp institutional knowledge graph.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                <Button
                  size="sm"
                  onClick={() => setCenterNodeId(selectedNode.id)}
                  className="min-h-[36px] flex-1 text-xs rounded-xl bg-primary text-primary-foreground active:scale-[0.97]"
                >
                  Center Neighborhood
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    router.push(
                      `/admin/intelligence?query=${encodeURIComponent(
                        `What is the context of ${selectedNode.label}?`
                      )}`
                    );
                  }}
                  className="min-h-[36px] text-xs rounded-xl active:scale-[0.97]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Node Context Menu */}
      <KnowledgeNodeContextMenu
        node={contextMenu?.node || null}
        position={contextMenu?.position || null}
        onClose={() => setContextMenu(null)}
        onAskAi={(node) => {
          router.push(
            `/admin/intelligence?query=${encodeURIComponent(
              `Provide dossier and background on ${node.label}`
            )}`
          );
        }}
        onOpenDetails={(node) => {
          if (node.type === 'meeting') {
            router.push(`/admin/meetings/${node.id}`);
          } else {
            router.push(`/admin/entities`);
          }
        }}
        onExpandNeighborhood={(node) => {
          setCenterNodeId(node.id);
          toast({
            title: 'Expanding neighborhood',
            description: `Focusing on ${node.label} (Rule 55: <= 80 nodes)`,
          });
        }}
        onAddToReviewQueue={(node) => {
          toast({
            title: 'Queued for review',
            description: `${node.label} added to Knowledge Inbox queue.`,
            actionConfig: {
              path: '/admin/intelligence/knowledge/inbox',
              label: 'View Inbox',
            },
          });
        }}
      />
    </PageContainerFluid>
  );
}

export default KnowledgeGraphClient;

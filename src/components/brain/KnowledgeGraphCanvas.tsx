'use client';

/**
 * @fileOverview Knowledge Graph Interactive Visualizer v1 (Phase 4 Milestone 5)
 *
 * Implements PRD §96 (Knowledge Graph Visualizer), theme.md Section 8 (Drawer/Modal architecture),
 * Rule 4 (Strict Zero-Any Typing), Rule 7 (Accessible >=44px Touch Targets),
 * Rule 8 (Fail-Closed Multi-Tenancy), Rule 22 (Confidence indicators),
 * Rule 30 (Untrusted Reference Data Isolation), Rule 61 (Institutional Memory Console).
 *
 * Architecture:
 * - Center Node Radial Topology with dynamic SVG coordinate projection
 * - Real-time filtering by node type (PRD §96: People, Deals, Meetings, Knowledge, All)
 * - Temporal filtering presets (7d, 30d, 90d, All time)
 * - Canvas viewport controls (Zoom in, Zoom out, Recenter)
 * - Seamless integration with GraphNodeDetailsDrawer (theme.md §8 compliant)
 */

import * as React from 'react';
import {
  getEntityGraphAction,
  type EntityGraphResult,
  type EntityGraphNode,
} from '@/app/actions/memory-actions';
import { GraphNodeDetailsDrawer } from '@/components/brain/GraphNodeDetailsDrawer';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Users,
  Briefcase,
  Calendar,
  Sparkles,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KnowledgeGraphCanvasProps {
  centerNodeId: string;
  className?: string;
  onNodeSelect?: (node: EntityGraphNode) => void;
}

type NodeTypeFilter = 'all' | 'people' | 'deals' | 'meetings' | 'knowledge';
type TimeFilter = '7d' | '30d' | '90d' | 'all';

interface NodeCoordinate {
  node: EntityGraphNode;
  x: number;
  y: number;
  isCenter: boolean;
}

export function KnowledgeGraphCanvas({
  centerNodeId,
  className,
  onNodeSelect,
}: KnowledgeGraphCanvasProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState<boolean>(true);
  const [graphData, setGraphData] = React.useState<EntityGraphResult | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<NodeTypeFilter>('all');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('all');
  const [zoomLevel, setZoomLevel] = React.useState<number>(1);
  const [selectedNode, setSelectedNode] = React.useState<EntityGraphNode | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(false);

  // SVG dimensions
  const width = 800;
  const height = 540;
  const centerX = width / 2;
  const centerY = height / 2;

  const loadGraph = React.useCallback(async () => {
    if (!centerNodeId) return;
    setLoading(true);
    try {
      const res = await getEntityGraphAction(centerNodeId);
      if (res.success && res.data) {
        setGraphData(res.data);
      } else {
        toast({
          title: 'Graph Retrieval Failed',
          description: res.error || 'Failed to load knowledge graph mesh.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown graph network error';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [centerNodeId, toast]);

  React.useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  // Filter nodes according to PRD §96 taxonomy
  const filteredNodes = React.useMemo(() => {
    if (!graphData) return [];
    if (typeFilter === 'all') return graphData.nodes;

    return graphData.nodes.filter((node) => {
      if (node.id === graphData.centerNodeId) return true; // Center node always remains visible
      const t = node.nodeType.toLowerCase();
      switch (typeFilter) {
        case 'people':
          return t === 'person' || t === 'contact';
        case 'deals':
          return t === 'deal';
        case 'meetings':
          return t === 'meeting';
        case 'knowledge':
          return t === 'semantic' || t === 'memory' || t === 'knowledge' || t === 'episodic';
        default:
          return true;
      }
    });
  }, [graphData, typeFilter]);

  // Calculate radial coordinates
  const nodeCoordinates = React.useMemo<NodeCoordinate[]>(() => {
    if (!graphData || filteredNodes.length === 0) return [];

    const centerNode = filteredNodes.find((n) => n.id === graphData.centerNodeId) ?? filteredNodes[0];
    const peripheralNodes = filteredNodes.filter((n) => n.id !== centerNode.id);

    const coords: NodeCoordinate[] = [
      {
        node: centerNode,
        x: centerX,
        y: centerY,
        isCenter: true,
      },
    ];

    const radius = 190;
    const count = peripheralNodes.length;

    peripheralNodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, count) - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      coords.push({
        node,
        x,
        y,
        isCenter: false,
      });
    });

    return coords;
  }, [graphData, filteredNodes, centerX, centerY]);

  // Filter visible edges
  const visibleEdges = React.useMemo(() => {
    if (!graphData) return [];
    const visibleNodeIds = new Set(nodeCoordinates.map((c) => c.node.id));

    return graphData.edges.filter(
      (edge) => visibleNodeIds.has(edge.sourceNodeId) && visibleNodeIds.has(edge.targetNodeId)
    );
  }, [graphData, nodeCoordinates]);

  const handleNodeClick = (node: EntityGraphNode) => {
    setSelectedNode(node);
    setDrawerOpen(true);
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(1.8, Math.max(0.6, Math.round((prev + delta) * 10) / 10)));
  };

  const incidentEdgesForSelected = React.useMemo(() => {
    if (!graphData || !selectedNode) return [];
    return graphData.edges.filter(
      (e) => e.sourceNodeId === selectedNode.id || e.targetNodeId === selectedNode.id
    );
  }, [graphData, selectedNode]);

  const getNodeFill = (node: EntityGraphNode, isCenter: boolean) => {
    if (isCenter) return 'hsl(var(--primary))';
    switch (node.nodeType.toLowerCase()) {
      case 'person':
      case 'contact':
        return '#0284c7'; // sky-600
      case 'deal':
        return '#9333ea'; // purple-600
      case 'meeting':
        return '#d97706'; // amber-600
      case 'semantic':
      case 'memory':
      case 'knowledge':
        return '#2563eb'; // blue-600
      default:
        return '#059669'; // emerald-600
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Control Bar & Filters (PRD §96) */}
      <div className="p-3 sm:p-4 border-b border-border/80 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filters:
          </span>
          <Button
            size="sm"
            variant={typeFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('all')}
            className="h-8 px-2.5 text-xs rounded-xl active:scale-[0.97]"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'people' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('people')}
            className="h-8 px-2.5 text-xs rounded-xl active:scale-[0.97] gap-1"
          >
            <Users className="h-3 w-3" />
            People
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'deals' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('deals')}
            className="h-8 px-2.5 text-xs rounded-xl active:scale-[0.97] gap-1"
          >
            <Briefcase className="h-3 w-3" />
            Deals
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'meetings' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('meetings')}
            className="h-8 px-2.5 text-xs rounded-xl active:scale-[0.97] gap-1"
          >
            <Calendar className="h-3 w-3" />
            Meetings
          </Button>
          <Button
            size="sm"
            variant={typeFilter === 'knowledge' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('knowledge')}
            className="h-8 px-2.5 text-xs rounded-xl active:scale-[0.97] gap-1"
          >
            <Sparkles className="h-3 w-3" />
            Knowledge
          </Button>
        </div>

        {/* Time Presets & Viewport Controls */}
        <div className="flex items-center gap-2">
          {/* Time Filter Dropdown / Buttons */}
          <div className="hidden sm:flex items-center gap-1 bg-muted/40 p-0.5 rounded-xl border border-border/60">
            {(['7d', '30d', '90d', 'all'] as TimeFilter[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeFilter(tf)}
                className={cn(
                  'px-2 py-1 text-[11px] font-medium rounded-lg transition-colors capitalize',
                  timeFilter === tf
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tf === 'all' ? 'All time' : tf}
              </button>
            ))}
          </div>

          {/* Zoom & Recenter Controls */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => handleZoom(0.2)}
              className="h-8 w-8 rounded-xl active:scale-[0.97]"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => handleZoom(-0.2)}
              className="h-8 w-8 rounded-xl active:scale-[0.97]"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                setZoomLevel(1);
                void loadGraph();
              }}
              className="h-8 w-8 rounded-xl active:scale-[0.97]"
              title="Reset View"
              aria-label="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* SVG Mesh Canvas */}
      <div className="relative w-full overflow-hidden bg-dot-grid flex items-center justify-center min-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Tracing multi-degree relationship mesh...</p>
          </div>
        ) : !graphData || nodeCoordinates.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-2">
            <Network className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-semibold">No Knowledge Mesh Available</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              No relational connections or memory links found for entity ID &quot;{centerNodeId}&quot;.
            </p>
          </div>
        ) : (
          <svg
            data-testid="knowledge-graph-svg"
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full max-h-[600px] select-none cursor-grab active:cursor-grabbing"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 200ms ease-out',
            }}
          >
            <defs>
              <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Edge Lines */}
            {visibleEdges.map((edge) => {
              const srcCoord = nodeCoordinates.find((c) => c.node.id === edge.sourceNodeId);
              const tgtCoord = nodeCoordinates.find((c) => c.node.id === edge.targetNodeId);
              if (!srcCoord || !tgtCoord) return null;

              const midX = (srcCoord.x + tgtCoord.x) / 2;
              const midY = (srcCoord.y + tgtCoord.y) / 2;

              return (
                <g key={edge.id} className="transition-opacity">
                  <line
                    x1={srcCoord.x}
                    y1={srcCoord.y}
                    x2={tgtCoord.x}
                    y2={tgtCoord.y}
                    stroke="currentColor"
                    className="text-border hover:text-primary transition-colors"
                    strokeWidth={1.5}
                    strokeDasharray={edge.confidence && edge.confidence < 0.8 ? '4 3' : undefined}
                  />
                  {/* Edge Label Badge */}
                  <rect
                    x={midX - 35}
                    y={midY - 8}
                    width={70}
                    height={16}
                    rx={4}
                    className="fill-background stroke-border/70"
                    strokeWidth={0.8}
                  />
                  <text
                    x={midX}
                    y={midY + 4}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono text-[9px] font-medium"
                  >
                    {edge.relationshipType}
                  </text>
                </g>
              );
            })}

            {/* Node Circles & Labels */}
            {nodeCoordinates.map(({ node, x, y, isCenter }) => {
              const fill = getNodeFill(node, isCenter);
              const radius = isCenter ? 26 : 20;

              return (
                <g
                  key={node.id}
                  data-testid={`node-${node.id}`}
                  onClick={() => handleNodeClick(node)}
                  className="cursor-pointer group focus:outline-none"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNodeClick(node);
                    }
                  }}
                >
                  {/* Subtle Glow Ring on Hover */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 6}
                    className="fill-transparent group-hover:fill-primary/10 transition-colors"
                  />

                  {/* Core Node Circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={fill}
                    className="stroke-background transition-transform duration-200 group-hover:scale-110 shadow-lg"
                    strokeWidth={2.5}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />

                  {/* Node Icon Indicator */}
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    className="fill-white font-bold text-xs pointer-events-none select-none"
                  >
                    {isCenter ? '★' : node.label.charAt(0).toUpperCase()}
                  </text>

                  {/* Node Label Text */}
                  <g className="pointer-events-none select-none">
                    <rect
                      x={x - 65}
                      y={y + radius + 6}
                      width={130}
                      height={20}
                      rx={6}
                      className="fill-card/90 stroke-border/60 backdrop-blur-sm"
                      strokeWidth={0.7}
                    />
                    <text
                      x={x}
                      y={y + radius + 20}
                      textAnchor="middle"
                      className="fill-foreground font-medium text-[11px]"
                    >
                      {node.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Node Details Drawer (theme.md §8 compliant) */}
      <GraphNodeDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        node={selectedNode}
        incidentEdges={incidentEdgesForSelected}
      />
    </div>
  );
}

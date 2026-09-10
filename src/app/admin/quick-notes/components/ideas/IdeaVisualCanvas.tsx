'use client';

import * as React from 'react';
import {
  type Idea,
  type IdeaCanvasNode,
  type IdeaCanvasEdge,
  type IdeaCanvasLayout,
  type IdeaCanvasNodeType,
} from '@/lib/quick-notes-types';
import { projectIdeaToCanvas } from '@/lib/quick-notes-domain';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Save,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { saveIdeaCanvasLayoutAction, decomposeIdeaCanvasAiAction } from '@/lib/quick-notes-idea-actions';

interface IdeaVisualCanvasProps {
  idea: Idea;
  workspaceId: string;
  userId: string;
  onUpdateIdea: (updated: Idea) => void;
  onSelectNode?: (node: IdeaCanvasNode) => void;
}

export function IdeaVisualCanvas({
  idea,
  workspaceId,
  userId,
  onUpdateIdea,
  onSelectNode,
}: IdeaVisualCanvasProps) {
  const { toast } = useToast();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Initialize canvas layout from saved layout or project dynamically
  const initialLayout = React.useMemo(() => {
    if (idea.canvasLayout && idea.canvasLayout.nodes.length > 0) {
      return idea.canvasLayout;
    }
    return projectIdeaToCanvas(idea);
  }, [idea]);

  const [nodes, setNodes] = React.useState<IdeaCanvasNode[]>(initialLayout.nodes);
  const [edges, setEdges] = React.useState<IdeaCanvasEdge[]>(initialLayout.edges);
  const [zoom, setZoom] = React.useState<number>(initialLayout.zoomLevel || 1.0);
  const [pan, setPan] = React.useState<{ x: number; y: number }>(initialLayout.panOffset || { x: 0, y: 0 });

  const [isDraggingCanvas, setIsDraggingCanvas] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [draggedNodeId, setDraggedNodeId] = React.useState<string | null>(null);
  const [nodeOffset, setNodeOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [selectedNode, setSelectedNode] = React.useState<IdeaCanvasNode | null>(null);
  const [isExpandingAi, setIsExpandingAi] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Update layout when idea prop changes
  React.useEffect(() => {
    if (idea.canvasLayout && idea.canvasLayout.nodes.length > 0) {
      setNodes(idea.canvasLayout.nodes);
      setEdges(idea.canvasLayout.edges);
      setZoom(idea.canvasLayout.zoomLevel || 1.0);
      setPan(idea.canvasLayout.panOffset || { x: 0, y: 0 });
    } else {
      const proj = projectIdeaToCanvas(idea);
      setNodes(proj.nodes);
      setEdges(proj.edges);
    }
  }, [idea.id]);

  // Pointer Handlers for Canvas Panning
  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.canvas-node')) return;
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (draggedNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const rawX = (e.clientX - rect.left - pan.x) / zoom - nodeOffset.x;
      const rawY = (e.clientY - rect.top - pan.y) / zoom - nodeOffset.y;

      setNodes((prev) =>
        prev.map((n) => (n.id === draggedNodeId ? { ...n, x: rawX, y: rawY } : n))
      );
    }
  };

  const handlePointerUpCanvas = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingCanvas) {
      setIsDraggingCanvas(false);
    }
    if (draggedNodeId) {
      setDraggedNodeId(null);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Support smooth trackpad pinch-to-zoom and mouse wheel scrolling
    const zoomDelta = e.deltaY * -0.0015;
    setZoom((prev) => Math.min(Math.max(Number((prev + zoomDelta).toFixed(2)), 0.3), 2.5));
  };

  // Node Drag Handlers
  const handleNodePointerDown = (e: React.PointerEvent, node: IdeaCanvasNode) => {
    e.stopPropagation();
    setDraggedNodeId(node.id);
    setSelectedNode(node);
    if (onSelectNode) onSelectNode(node);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;

    setNodeOffset({
      x: mouseCanvasX - node.x,
      y: mouseCanvasY - node.y,
    });
  };

  // Zoom Controls
  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(2.5, Math.max(0.4, prev + delta)));
  };

  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Auto Layout (Radial Fan)
  const handleAutoLayout = () => {
    const proj = projectIdeaToCanvas(idea);
    setNodes(proj.nodes);
    setEdges(proj.edges);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    toast({ title: 'Canvas layout reset to balanced radial tree' });
  };

  // Save Canvas Layout
  const handleSaveLayout = async () => {
    setIsSaving(true);
    try {
      const layout: IdeaCanvasLayout = {
        nodes,
        edges,
        zoomLevel: zoom,
        panOffset: pan,
        lastSavedAt: new Date().toISOString(),
      };

      const res = await saveIdeaCanvasLayoutAction(workspaceId, idea.id, layout, userId);
      if (res.success) {
        toast({ title: 'Idea Canvas layout saved' });
        onUpdateIdea({ ...idea, canvasLayout: layout });
      } else {
        toast({ title: 'Failed to save layout', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error saving layout', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // AI Expand Node
  const handleAiExpandNode = async (node: IdeaCanvasNode) => {
    setIsExpandingAi(true);
    try {
      const res = await decomposeIdeaCanvasAiAction(
        workspaceId,
        idea.id,
        {
          nodeType: node.type,
          nodeTitle: node.title,
          nodeDescription: node.description,
          connectedTitles: nodes.map((n) => n.title),
        },
        userId
      );

      if (res.success && res.data && res.data.suggestedNodes.length > 0) {
        const newNodes: IdeaCanvasNode[] = [...nodes];
        const newEdges: IdeaCanvasEdge[] = [...edges];

        res.data.suggestedNodes.forEach((sug, idx) => {
          const newId = `node-ai-${Date.now()}-${idx}`;
          const angle = (idx / res.data!.suggestedNodes.length) * Math.PI * 2;
          const dist = 180;

          const newNode: IdeaCanvasNode = {
            id: newId,
            type: sug.type as IdeaCanvasNodeType,
            title: sug.title,
            description: sug.description,
            x: node.x + Math.cos(angle) * dist,
            y: node.y + Math.sin(angle) * dist,
            width: 180,
            height: 75,
            color: sug.color || '#a855f7',
          };

          newNodes.push(newNode);
          newEdges.push({
            id: `edge-${node.id}-${newId}`,
            fromNodeId: node.id,
            toNodeId: newId,
            label: sug.relationLabel,
            type: 'dashed',
            color: sug.color || '#a855f7',
          });
        });

        setNodes(newNodes);
        setEdges(newEdges);
        toast({
          title: 'AI Branching Complete',
          description: `Added ${res.data.suggestedNodes.length} suggested nodes to the canvas.`,
        });
      } else {
        toast({
          title: 'AI Expansion Notice',
          description: res.error || 'No additional sub-nodes were suggested.',
        });
      }
    } catch {
      toast({ title: 'Error running AI node expansion', variant: 'destructive' });
    } finally {
      setIsExpandingAi(false);
    }
  };

  const getNodeColor = (type: IdeaCanvasNodeType, customColor?: string) => {
    if (customColor) return customColor;
    switch (type) {
      case 'core_idea':
        return '#3b82f6';
      case 'problem':
        return '#ef4444';
      case 'solution':
        return '#10b981';
      case 'assumption':
        return '#f59e0b';
      case 'hypothesis':
        return '#8b5cf6';
      case 'evidence':
        return '#06b6d4';
      case 'experiment':
        return '#ec4899';
      case 'crm_entity':
        return '#14b8a6';
      default:
        return '#64748b';
    }
  };

  return (
    <div className="relative w-full h-[620px] rounded-2xl border border-border/60 bg-muted/10 overflow-hidden select-none">
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-background/90 backdrop-blur-md p-1.5 rounded-xl border border-border/60 shadow-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleZoom(0.15)}
          className="h-8 w-8 p-0 rounded-lg"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleZoom(-0.15)}
          className="h-8 w-8 p-0 rounded-lg"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetView}
          className="h-8 w-8 p-0 rounded-lg"
          title="Reset Zoom & Pan"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <div className="h-4 w-[1px] bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAutoLayout}
          className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1"
          title="Auto-organize radial layout"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Auto Layout
        </Button>
        <Button
          size="sm"
          onClick={handleSaveLayout}
          disabled={isSaving}
          className="h-8 px-3 text-xs font-bold rounded-lg bg-primary text-primary-foreground gap-1 active:scale-[0.98]"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Canvas
        </Button>
      </div>

      {/* Selected Node Action Bar (Top Right) */}
      {selectedNode && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-background/95 backdrop-blur-md p-2 rounded-xl border border-border/60 shadow-md max-w-sm">
          <div className="min-w-0 pr-2">
            <Badge
              style={{ backgroundColor: `${getNodeColor(selectedNode.type, selectedNode.color)}20`, color: getNodeColor(selectedNode.type, selectedNode.color) }}
              className="text-[10px] font-bold border-none capitalize"
            >
              {selectedNode.type.replace('_', ' ')}
            </Badge>
            <p className="text-xs font-bold text-foreground truncate mt-0.5">{selectedNode.title}</p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAiExpandNode(selectedNode)}
            disabled={isExpandingAi}
            className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1 border-primary/30 hover:bg-primary/10 text-primary flex-shrink-0"
          >
            {isExpandingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI Expand
          </Button>
        </div>
      )}

      {/* Main Canvas Viewport with Pan & Zoom Transform */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDownCanvas}
        onPointerMove={handlePointerMoveCanvas}
        onPointerUp={handlePointerUpCanvas}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <svg
          className="w-full h-full pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Edges */}
          {edges.map((edge) => {
            const from = nodes.find((n) => n.id === edge.fromNodeId);
            const to = nodes.find((n) => n.id === edge.toNodeId);
            if (!from || !to) return null;

            const fromCenterX = from.x + (from.width || 180) / 2;
            const fromCenterY = from.y + (from.height || 75) / 2;
            const toCenterX = to.x + (to.width || 180) / 2;
            const toCenterY = to.y + (to.height || 75) / 2;

            const midX = (fromCenterX + toCenterX) / 2;
            const midY = (fromCenterY + toCenterY) / 2;

            return (
              <g key={edge.id}>
                <line
                  x1={fromCenterX}
                  y1={fromCenterY}
                  x2={toCenterX}
                  y2={toCenterY}
                  stroke={edge.color || '#94a3b8'}
                  strokeWidth="2"
                  strokeDasharray={edge.type === 'dashed' ? '5,5' : undefined}
                  opacity="0.65"
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 5}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="middle"
                    className="font-medium bg-background"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* DOM HTML Nodes Layer for crisp text and click interaction */}
        <div
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const color = getNodeColor(node.type, node.color);

            return (
              <div
                key={node.id}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                className={`canvas-node absolute pointer-events-auto flex flex-col justify-between rounded-xl border bg-card/95 backdrop-blur-md p-2.5 shadow-sm transition-shadow cursor-grab active:cursor-grabbing hover:shadow-lg ${
                  isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                }`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width || 180}px`,
                  minHeight: `${node.height || 75}px`,
                  borderColor: isSelected ? color : `${color}60`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {node.type.replace('_', ' ')}
                    </span>
                    {node.riskLevel && (
                      <span className="text-[9px] font-semibold text-muted-foreground">
                        {node.riskLevel}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2">
                    {node.title}
                  </h4>
                </div>

                {node.description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">
                    {node.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

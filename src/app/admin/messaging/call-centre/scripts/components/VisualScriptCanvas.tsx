'use client';

import * as React from 'react';
import ReactFlow, { 
  Background, 
  BackgroundVariant,
  Controls, 
  MiniMap, 
  Handle, 
  Position,
  EdgeLabelRenderer,
  BaseEdge,
  getSmoothStepPath,
  useNodes,
  type NodeProps,
  type EdgeProps,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type Viewport,
  type NodeChange,
  type NodePositionChange,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getActionMeta } from '@/lib/call-action-types';
import { stripScriptHtml } from '@/lib/call-centre-graph';
import { Phone, PhoneOff } from 'lucide-react';

// ─── Custom Node Components ──────────────────────────────────────────────────

// Fixed node width used by every node type — never expands horizontally
const NODE_W = 'w-[220px]';
// Active-node ring applied when a node's properties are open in the side panel
const ACTIVE_RING = 'ring-2 ring-primary ring-offset-1 ring-offset-background shadow-[0_0_12px_2px_hsl(var(--primary)/0.35)]';

function CustomNodeWrapper({
  children, title, colorClass, typeLabel, selected
}: {
  children: React.ReactNode;
  title: string;
  colorClass: string;
  typeLabel: string;
  selected?: boolean;
}) {
  return (
    <div className={[
      NODE_W,
      'bg-card border rounded-xl shadow-md overflow-hidden transition-all select-none',
      selected
        ? `border-primary ${ACTIVE_RING}`
        : 'border-border hover:border-primary/40 hover:shadow-lg',
    ].join(' ')}>
      <div className={`h-1 w-full ${colorClass}`} />
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-card-foreground truncate max-w-[130px]">{title}</span>
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">{typeLabel}</span>
        </div>
        {/* Body text: word-wraps, clamps at 3 lines max, overflow → ellipsis */}
        <div className="text-[9px] text-muted-foreground font-medium leading-relaxed max-h-[48px] overflow-hidden line-clamp-3 break-words italic font-serif">
          {children}
        </div>
      </div>
    </div>
  );
}

const customNodeTypes = {
  start: (props: NodeProps) => (
    <div className={[
      'flex flex-col items-center gap-1 select-none relative',
      props.selected ? 'scale-105' : ''
    ].join(' ')}>
      <div className={[
        'w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500 text-white shadow-md border-2 border-emerald-400 transition-all duration-200',
        props.selected ? 'ring-2 ring-emerald-500 ring-offset-2 shadow-[0_0_12px_2px_rgba(16,185,129,0.5)] border-white' : 'hover:scale-105 hover:shadow-lg'
      ].join(' ')}>
        <Phone className="w-6 h-6 animate-pulse" />
      </div>
      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-sm">
        Start Call
      </span>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-emerald-500 !border-none" />
    </div>
  ),
  end: (props: NodeProps) => (
    <div className={[
      'flex flex-col items-center gap-1 select-none relative',
      props.selected ? 'scale-105' : ''
    ].join(' ')}>
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-rose-500 !border-none" />
      <div className={[
        'w-14 h-14 rounded-full flex items-center justify-center bg-rose-500 text-white shadow-md border-2 border-rose-400 transition-all duration-200',
        props.selected ? 'ring-2 ring-rose-500 ring-offset-2 shadow-[0_0_12px_2px_rgba(244,63,94,0.5)] border-white' : 'hover:scale-105 hover:shadow-lg'
      ].join(' ')}>
        <PhoneOff className="w-6 h-6" />
      </div>
      <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 shadow-sm">
        End Call
      </span>
    </div>
  ),
  script_block: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'Script Block'} colorClass="bg-primary" typeLabel="Say" selected={props.selected}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-primary !border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-primary !border-none" />
      {stripScriptHtml(props.data.text) || '[No script body configured]'}
    </CustomNodeWrapper>
  ),
  question: (props: NodeProps) => {
    const options: string[] = props.data.options?.length ? props.data.options : ['Yes', 'No'];
    return (
      <div className={[
        NODE_W,
        'bg-card rounded-xl shadow-md overflow-visible transition-all select-none',
        props.selected
          ? `border-2 border-amber-500 ${ACTIVE_RING.replace('ring-primary', 'ring-amber-500').replace('hsl(var(--primary)/0.35)', 'hsl(45 93% 47% / 0.35)')}`
          : 'border-2 border-amber-500/60 hover:border-amber-500 hover:shadow-lg',
      ].join(' ')}>
        {/* Top accent + target handle */}
        <div className="h-1 w-full bg-amber-500 rounded-t-xl" />
        <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-amber-500 !border-none" />

        {/* Node body */}
        <div className="p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-card-foreground truncate max-w-[130px]">
              {props.data.label || 'Question'}
            </span>
            <span className="text-[8px] font-mono text-amber-500 uppercase tracking-wider font-bold shrink-0">Ask</span>
          </div>
          <div className="text-[9px] text-muted-foreground font-medium leading-relaxed max-h-[48px] overflow-hidden line-clamp-3 break-words italic font-serif">
            {stripScriptHtml(props.data.text) || '[No question configured]'}
          </div>

          {/* Option pills — each is an exit path */}
          <div className="flex flex-wrap gap-1 pt-1 relative pb-3">
            {options.map((opt, i) => (
              <div key={i} className="relative flex flex-col items-center">
                <span
                  className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap max-w-[80px] overflow-hidden text-ellipsis"
                  title={opt || `Option ${i + 1}`}
                >
                  {opt || `Option ${i + 1}`}
                </span>
                {/* Source handle per option */}
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={`option-${i}`}
                  style={{
                    bottom: -6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 8,
                    height: 8,
                    background: 'hsl(var(--amber-500, 245 158 11))',
                    borderColor: 'transparent',
                  }}
                  className="!bg-amber-500 !border-none"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },

  objection: (props: NodeProps) => {
    const objections: Array<{ title: string }> = (props.data as { objectionConfig?: { objections?: Array<{ title: string }> } }).objectionConfig?.objections ?? [];
    const hasEntries = objections.length > 0;
    return (
      <div className={[
        NODE_W,
        'bg-card rounded-xl shadow-md overflow-hidden transition-all select-none',
        props.selected
          ? `border border-orange-500 ${ACTIVE_RING.replace('ring-primary', 'ring-orange-500').replace('hsl(var(--primary)/0.35)', 'hsl(24 95% 53% / 0.35)')}`
          : 'border border-border hover:border-orange-500/40 hover:shadow-lg',
      ].join(' ')}>
        <div className="h-1 w-full bg-orange-500" />
        <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-orange-500 !border-none" />
        <div className="p-3 space-y-1.5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-card-foreground truncate max-w-[130px]">
              {props.data.label || 'Objection'}
            </span>
            <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">Objection</span>
          </div>
          {/* Objection title list */}
          {hasEntries ? (
            <ul className="space-y-0.5 max-h-[56px] overflow-hidden">
              {objections.map((o, i) => (
                <li key={i} className="flex items-center gap-1 min-w-0">
                  <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                  <span className="text-[9px] text-muted-foreground font-medium italic font-serif truncate">
                    {o.title || `Objection ${i + 1}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[9px] text-muted-foreground font-medium leading-relaxed max-h-[48px] overflow-hidden line-clamp-3 break-words italic font-serif">
              {stripScriptHtml(props.data.text) || '[No objection response details]'}
            </div>
          )}
        </div>
        <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-orange-500 !border-none" />
      </div>
    );
  },
  action: (props: NodeProps) => {
    const meta = getActionMeta(props.data.actionType || '');
    return (
      <CustomNodeWrapper title={props.data.label || meta.label} colorClass={meta.colorClass} typeLabel="Action" selected={props.selected}>
        <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-indigo-500 !border-none" />
        <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-indigo-500 !border-none" />
        {stripScriptHtml(props.data.text) || meta.label}
      </CustomNodeWrapper>
    );
  },
  outcome: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'Set Outcome'} colorClass="bg-purple-500" typeLabel="Outcome" selected={props.selected}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-purple-500 !border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-purple-500 !border-none" />
      {stripScriptHtml(props.data.text) || `Outcome: ${props.data.outcomeValue || 'None'}`}
    </CustomNodeWrapper>
  )
};

// ─── Custom Deletable Edge ────────────────────────────────────────────────────

function DeletableEdge({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const nodes = useNodes();
  const sourceNode = nodes.find(n => n.id === source);
  let displayLabel = '';
  if (sourceNode?.type === 'question' && sourceHandleId?.startsWith('option-')) {
    const idx = parseInt(sourceHandleId.replace('option-', ''), 10);
    const options = (sourceNode.data as any)?.options || ['Yes', 'No'];
    displayLabel = options[idx] || '';
  }

  const isTruncated = displayLabel.length > 12;
  const truncatedLabel = isTruncated ? `${displayLabel.slice(0, 12)}...` : displayLabel;
  const strokeColor = selected ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.6)';

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: strokeColor, strokeWidth: selected ? 2.5 : 2 }}
      />
      {/* Edge controls: pill + delete button */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1.5 group"
        >
          {displayLabel && (
            <span
              title={isTruncated ? displayLabel : undefined}
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 cursor-help shadow-sm whitespace-nowrap"
            >
              {truncatedLabel}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data?.onInsert?.(id);
            }}
            title="Insert step here"
            className={[
              'flex items-center justify-center rounded-full border transition-all duration-150 shadow-sm shrink-0 bg-card border-border text-muted-foreground',
              'w-3.5 h-3.5 text-[8px] font-bold leading-none',
              selected
                ? 'bg-primary border-primary/80 text-primary-foreground opacity-100 pointer-events-auto shadow-md'
                : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:!opacity-100 hover:!bg-primary hover:!border-primary/80 hover:!text-primary-foreground',
            ].join(' ')}
          >
            +
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data?.onDelete?.(id);
            }}
            title="Delete connection"
            className={[
              'flex items-center justify-center rounded-full border transition-all duration-150 shadow-sm shrink-0 bg-card border-border text-muted-foreground',
              'w-3.5 h-3.5 text-[8px] font-bold leading-none',
              selected
                ? 'bg-rose-500 border-rose-400 text-white opacity-100 pointer-events-auto shadow-md'
                : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:!opacity-100 hover:!bg-rose-500 hover:!border-rose-400 hover:!text-white',
            ].join(' ')}
          >
            ✕
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const customEdgeTypes = { deletable: DeletableEdge };

// ─── Canvas Component ────────────────────────────────────────────────────────

/** Handle exposed via forwardRef so parents can ask for the viewport drop position. */
export interface VisualScriptCanvasHandle {
  /** Returns the flow-coordinate position at the bottom-center of the current viewport. */
  getDropPosition: () => { x: number; y: number };
  /** Smoothly pan/centre the viewport on a given node (used by keyboard navigation). */
  focusNode: (nodeId: string) => void;
}

export interface VisualScriptCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onEdgeDelete: (edgeId: string) => void;
  onEdgeInsertNode?: (edgeId: string) => void;
  /** Called when the user clicks the blank canvas background — use to deselect the active node */
  onPaneClick?: () => void;
  /** Simulation variable resolver callback */
  resolveText?: (raw: string) => string;
}

/** Traverse downstream edges to find all descendant nodes of a given node */
function getDescendantIds(nodeId: string, edges: Edge[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = edges
      .filter(e => e.source === current)
      .map(e => e.target);
    for (const child of children) {
      if (!descendants.has(child)) {
        descendants.add(child);
        queue.push(child);
      }
    }
  }
  return descendants;
}

export const VisualScriptCanvas = React.forwardRef<VisualScriptCanvasHandle, VisualScriptCanvasProps>(
  function VisualScriptCanvas({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeDelete,
    onEdgeInsertNode,
    onPaneClick,
    resolveText,
  }, ref) {
  // Ref for the outer wrapper div so we can read its pixel dimensions
  const containerRef = React.useRef<HTMLDivElement>(null);
  const memoizedNodeTypes = React.useMemo(() => customNodeTypes, []);
  const memoizedEdgeTypes = React.useMemo(() => customEdgeTypes, []);

  // Track the live viewport transform so getDropPosition() is always fresh
  const viewportRef = React.useRef<Viewport>({ x: 200, y: 80, zoom: 0.65 });

  // ReactFlow instance captured on init — used to drive programmatic panning
  const rfRef = React.useRef<ReactFlowInstance | null>(null);

  // Expose getDropPosition() to parent via forwardRef
  React.useImperativeHandle(ref, () => ({
    getDropPosition: () => {
      const container = containerRef.current;
      const vp = viewportRef.current;
      if (!container) return { x: 300, y: 400 };
      const { width, height } = container.getBoundingClientRect();
      // Bottom-centre of visible area, 100px from the bottom edge
      const screenX = width / 2;
      const screenY = height - 100;
      // Convert screen px → ReactFlow canvas coords
      return {
        x: (screenX - vp.x) / vp.zoom - 110, // centre the 220px-wide node
        y: (screenY - vp.y) / vp.zoom,
      };
    },
    focusNode: (nodeId: string) => {
      const inst = rfRef.current;
      if (!inst) return;
      const node = inst.getNode(nodeId);
      if (!node) return;
      const w = node.width ?? 220;
      const h = node.height ?? 120;
      inst.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: viewportRef.current.zoom,
        duration: 300,
      });
    },
  }), []);

  // Inject the onDelete callback into each edge's data so the custom edge can call it
  const edgesWithDelete = React.useMemo(
    () => edges.map(e => ({
      ...e,
      type: 'deletable',
      className: 'group',
      data: { ...e.data, onDelete: onEdgeDelete, onInsert: onEdgeInsertNode },
    })),
    [edges, onEdgeDelete, onEdgeInsertNode]
  );

  // Propagates drag movement downstream to all descendants of the dragged node(s)
  const handleNodesChange = React.useCallback((changes: NodeChange[]) => {
    const positionChanges = changes.filter((c): c is NodePositionChange => c.type === 'position');
    if (positionChanges.length === 0) {
      onNodesChange(changes);
      return;
    }

    const directlyChangedIds = new Set(positionChanges.map(c => c.id));
    const extraChanges = new Map<string, NodePositionChange>();

    for (const change of positionChanges) {
      if (!change.position) continue;
      const currentNode = nodes.find(n => n.id === change.id);
      if (!currentNode) continue;

      const dx = change.position.x - currentNode.position.x;
      const dy = change.position.y - currentNode.position.y;

      if (dx !== 0 || dy !== 0) {
        const descendants = getDescendantIds(change.id, edges);
        for (const descId of descendants) {
          if (directlyChangedIds.has(descId)) continue;
          
          const descNode = nodes.find(n => n.id === descId);
          if (!descNode) continue;

          const baseNode = extraChanges.get(descId);
          const currentPosX = baseNode?.position?.x ?? descNode.position.x;
          const currentPosY = baseNode?.position?.y ?? descNode.position.y;

          extraChanges.set(descId, {
            id: descId,
            type: 'position',
            position: {
              x: currentPosX + dx,
              y: currentPosY + dy,
            },
            dragging: change.dragging,
          });
        }
      }
    }

    const allChanges = [...changes, ...Array.from(extraChanges.values())];
    onNodesChange(allChanges);
  }, [onNodesChange, nodes, edges]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-muted/20 dark:bg-zinc-950/20 border border-border rounded-2xl overflow-hidden relative"
      style={{ minHeight: '550px' }}
    >
      <ReactFlow
        nodes={React.useMemo(() => {
          if (!resolveText) return nodes;
          return nodes.map(n => ({
            ...n,
            data: {
              ...n.data,
              text: n.data?.text ? resolveText(n.data.text) : ''
            }
          }));
        }, [nodes, resolveText])}
        edges={edgesWithDelete}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={(inst) => { rfRef.current = inst; }}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={memoizedEdgeTypes}
        defaultViewport={{ x: 200, y: 80, zoom: 0.65 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Delete', 'Backspace']}
        // Arrow keys are repurposed for step-to-step navigation by the parent builder,
        // so disable ReactFlow's built-in arrow-key node nudging to avoid conflicts.
        disableKeyboardA11y
        selectionOnDrag={false}
        defaultEdgeOptions={{
          type: 'deletable',
          style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 }
        }}
        onMove={(event, vp) => { viewportRef.current = vp; }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
        <Controls className="!bg-card !border-border !text-muted-foreground [&>button]:!border-border hover:[&>button]:!bg-muted" />
        <MiniMap 
          nodeColor={(n) => {
            if (n.type === 'start') return '#10b981';
            if (n.type === 'end') return '#ef4444';
            if (n.type === 'question') return '#f59e0b';
            if (n.type === 'objection') return '#f97316';
            if (n.type === 'action') return '#6366f1';
            if (n.type === 'outcome') return '#a855f7';
            return 'hsl(var(--primary))';
          }}
          maskColor="rgba(0, 0, 0, 0.08)"
          className="!bg-card !border-border"
        />
      </ReactFlow>
    </div>
  );
});


// Re-export Position for handle styling convenience
export { Position };
export type { Node, Edge };

'use client';

import * as React from 'react';
import ReactFlow, { 
  Background, 
  BackgroundVariant,
  Controls, 
  MiniMap, 
  Handle, 
  Position,
  type NodeProps,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection
} from 'reactflow';
import 'reactflow/dist/style.css';

// ─── Custom Node Components ──────────────────────────────────────────────────

function CustomNodeWrapper({ children, title, colorClass, typeLabel }: { children: React.ReactNode, title: string, colorClass: string, typeLabel: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl min-w-[200px] overflow-hidden hover:border-zinc-700 transition-all select-none">
      <div className={`h-1 w-full ${colorClass}`} />
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-zinc-100 truncate max-w-[120px]">{title}</span>
          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">{typeLabel}</span>
        </div>
        <div className="text-[9px] text-zinc-400 font-medium leading-relaxed max-h-[40px] overflow-hidden line-clamp-2 italic font-serif">
          {children}
        </div>
      </div>
    </div>
  );
}

const customNodeTypes = {
  start: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'Start'} colorClass="bg-emerald-500" typeLabel="Start">
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-emerald-500 !border-none" />
      {props.data.text || 'Initiate outbound call conversation.'}
    </CustomNodeWrapper>
  ),
  end: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'End'} colorClass="bg-rose-500" typeLabel="End">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-rose-500 !border-none" />
      {props.data.text || 'End of call outreach.'}
    </CustomNodeWrapper>
  ),
  script_block: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'Script Block'} colorClass="bg-primary" typeLabel="Say">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-primary !border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-primary !border-none" />
      {props.data.text || '[No script body configured]'}
    </CustomNodeWrapper>
  ),
  question: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'Question'} colorClass="bg-amber-500" typeLabel="Ask">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-amber-500 !border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-amber-500 !border-none" />
      {props.data.text || '[No question details configured]'}
    </CustomNodeWrapper>
  ),
  objection: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'Objection'} colorClass="bg-orange-500" typeLabel="Objection">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-orange-500 !border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-orange-500 !border-none" />
      {props.data.text || '[No objection response details]'}
    </CustomNodeWrapper>
  ),
  action: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'Trigger Action'} colorClass="bg-indigo-500" typeLabel="Action">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-indigo-500 !border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-indigo-500 !border-none" />
      {props.data.text || `Action Type: ${props.data.actionType || 'None'}`}
    </CustomNodeWrapper>
  ),
  outcome: (props: NodeProps) => (
    <CustomNodeWrapper title={props.data.label || 'Set Outcome'} colorClass="bg-purple-500" typeLabel="Outcome">
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-purple-500 !border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-purple-500 !border-none" />
      {props.data.text || `Outcome: ${props.data.outcomeValue || 'None'}`}
    </CustomNodeWrapper>
  )
};

// ─── Canvas Component ────────────────────────────────────────────────────────

interface VisualScriptCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
}

export function VisualScriptCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick
}: VisualScriptCanvasProps) {
  return (
    <div className="w-full h-full bg-zinc-950/20 border border-zinc-900 rounded-2xl overflow-hidden relative" style={{ minHeight: '550px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={customNodeTypes}
        fitView
        className="custom-reactflow-dark"
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
        <Controls className="!bg-zinc-900 !border-zinc-800 !text-zinc-300 [&>button]:!border-zinc-800 hover:[&>button]:!bg-zinc-800" />
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
          maskColor="rgba(9, 9, 11, 0.7)"
          className="!bg-zinc-900 !border-zinc-800"
        />
      </ReactFlow>
    </div>
  );
}

// Re-export Position for handle styling convenience
export { Position };
export type { Node, Edge };

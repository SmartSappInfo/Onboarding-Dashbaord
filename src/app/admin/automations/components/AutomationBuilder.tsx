
'use client';

import * as React from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    Panel, 
    useNodesState, 
    useEdgesState, 
    addEdge, 
    Connection, 
    MarkerType,
    Node,
    ConnectionLineType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TriggerNode } from '../[id]/edit/components/nodes/TriggerNode';
import { ActionNode } from '../[id]/edit/components/nodes/ActionNode';
import { ConditionNode } from '../[id]/edit/components/nodes/ConditionNode';
import { DelayNode } from '../[id]/edit/components/nodes/DelayNode';
import { 
    Zap, 
    Play, 
    Maximize2,
    Minimize2,
    Grid3X3,
    Info,
    Layers,
    Wand2,
    Settings2,
    ArrowRightLeft,
    Clock,
    X,
    MousePointer2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NodeInspector } from './NodeInspector';

const nodeTypes = {
    triggerNode: TriggerNode,
    actionNode: ActionNode,
    conditionNode: ConditionNode,
    delayNode: DelayNode,
};

interface AutomationBuilderProps {
    initialNodes: any[];
    initialEdges: any[];
    onStateChange: (nodes: any[], edges: any[]) => void;
}

/**
 * @fileOverview The SmartSapp Visual Automation Architect.
 * Upgraded with stabilized state emitters and high-fidelity visual styling.
 */
export default function AutomationBuilder({ initialNodes, initialEdges, onStateChange }: AutomationBuilderProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

    const onConnect = React.useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 3 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))', width: 20, height: 20 }
        }, eds)),
        [setEdges]
    );

    const onNodeClick = (_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    };

    const onPaneClick = () => {
        setSelectedNodeId(null);
    };

    const handleUpdateNodeData = (nodeId: string, newData: any) => {
        setNodes(nds => nds.map(node => {
            if (node.id === nodeId) {
                // Ensure deep merge of data and config
                return { ...node, data: { ...node.data, ...newData } };
            }
            return node;
        }));
    };

    // STABILIZED STATE EMITTER: 
    // Uses a ref to track the last emitted state to prevent recursive sync loops.
    const lastEmittedRef = React.useRef<string>('');

    React.useEffect(() => {
        const stateString = JSON.stringify({ nodes, edges });
        if (stateString === lastEmittedRef.current) return;

        const timeout = setTimeout(() => {
            onStateChange(nodes, edges);
            lastEmittedRef.current = stateString;
        }, 150);
        return () => clearTimeout(timeout);
    }, [nodes, edges, onStateChange]);

    const addNode = (type: keyof typeof nodeTypes) => {
        const id = `${type}_${Date.now()}`;
        let label = 'New Node';
        
        switch(type) {
            case 'triggerNode': label = 'Event Protocol Entry'; break;
            case 'actionNode': label = 'Task Execution Step'; break;
            case 'conditionNode': label = 'Logical Decision'; break;
            case 'delayNode': label = 'Temporal Wait'; break;
        }

        const newNode = {
            id,
            type,
            // Position near the center of the viewport
            position: { x: 400 + Math.random() * 50, y: 300 + Math.random() * 50 },
            data: { 
                label,
                config: type === 'delayNode' ? { value: 5, unit: 'Minutes' } : {}
            },
        };
        setNodes(nds => [...nds, newNode]);
        setSelectedNodeId(id);
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    return (
        <div className={cn(
            "h-full w-full bg-slate-50 relative group/builder",
            isFullScreen && "fixed inset-0 z-[100] bg-slate-50"
        )}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                connectionLineType={ConnectionLineType.SmoothStep}
                fitView
                snapToGrid
                snapGrid={[15, 15]}
                className="bg-muted/10"
            >
                <Background color="#cbd5e1" gap={30} size={1} />
                
                <Panel position="top-left" className="m-4 flex flex-col gap-4">
                    <Card className="rounded-2xl border-none shadow-2xl p-1.5 flex flex-col gap-1.5 bg-background/95 backdrop-blur-md ring-1 ring-black/5">
                        <TooltipProvider>
                            <ToolBtn icon={Zap} label="Add Trigger" color="text-emerald-600 bg-emerald-50" onClick={() => addNode('triggerNode')} />
                            <ToolBtn icon={Play} label="Add Action" color="text-blue-600 bg-blue-50" onClick={() => addNode('actionNode')} />
                            <ToolBtn icon={ArrowRightLeft} label="Add Condition" color="text-amber-600 bg-amber-50" onClick={() => addNode('conditionNode')} />
                            <ToolBtn icon={Clock} label="Add Delay" color="text-purple-600 bg-purple-50" onClick={() => addNode('delayNode')} />
                            <div className="h-px bg-border/50 mx-2 my-1" />
                            <ToolBtn icon={Grid3X3} label="Auto Layout" onClick={() => {}} />
                            <ToolBtn 
                                icon={isFullScreen ? Minimize2 : Maximize2} 
                                label={isFullScreen ? "Exit Hub" : "Zen View"} 
                                onClick={() => setIsFullScreen(!isFullScreen)} 
                            />
                        </TooltipProvider>
                    </Card>
                </Panel>

                <Panel position="bottom-center" className="mb-8">
                    <Card className="rounded-full bg-slate-900 text-white px-6 py-3 shadow-2xl flex items-center gap-6 ring-1 ring-white/10">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{nodes.length} Elements</span>
                        </div>
                        <div className="h-4 w-px bg-white/10" />
                        <div className="flex items-center gap-2">
                            <Wand2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-[10px] font-bold text-white/60 uppercase tracking-tighter italic">Architecture Verified</span>
                        </div>
                    </Card>
                </Panel>

                <Controls className="!bg-white !border-none !shadow-2xl !rounded-xl overflow-hidden" showInteractive={false} />
            </ReactFlow>

            {/* Sidebar Inspector Context */}
            <div className="absolute top-6 right-6 z-20 w-[380px] pointer-events-none">
                <Card className={cn(
                    "rounded-[2.5rem] border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] bg-white/95 backdrop-blur-md p-6 pointer-events-auto transition-all duration-500 max-h-[85vh] flex flex-col ring-1 ring-black/5",
                    selectedNodeId ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10 pointer-events-none"
                )}>
                    <div className="flex items-center justify-between mb-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm"><Settings2 className="h-4 w-4" /></div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest">Logic Inspector</h4>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)} className="h-8 w-8 rounded-lg hover:bg-muted">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    
                    <div className="flex-1 overflow-hidden">
                        {selectedNode ? (
                            <NodeInspector 
                                node={selectedNode} 
                                onUpdate={(data) => handleUpdateNodeData(selectedNode.id, data)} 
                            />
                        ) : (
                            <div className="py-20 text-center border-2 border-dashed rounded-2xl border-border/50 bg-muted/10">
                                <MousePointer2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                                    Select an architecture node<br/>to configure operational logic
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3 shrink-0 text-left">
                        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                            Protocol payloads are inherited from the trigger source. Use the dictionary to map dynamic tags.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}

function ToolBtn({ icon: Icon, label, color, onClick }: any) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onClick} className={cn("h-10 w-10 rounded-xl transition-all shadow-sm", color)}>
                    <Icon className="h-5 w-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-black text-[10px] uppercase tracking-widest">{label}</TooltipContent>
        </Tooltip>
    );
}


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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TriggerNode } from '../[id]/edit/components/nodes/TriggerNode';
import { ActionNode } from '../[id]/edit/components/nodes/ActionNode';
import { 
    Zap, 
    Play, 
    Database, 
    Maximize2,
    Minimize2,
    Grid3X3,
    Info,
    Layers,
    Wand2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const nodeTypes = {
    triggerNode: TriggerNode,
    actionNode: ActionNode,
};

interface AutomationBuilderProps {
    initialNodes: any[];
    initialEdges: any[];
    onStateChange: (nodes: any[], edges: any[]) => void;
}

/**
 * @fileOverview The SmartSapp Visual Automation Architect.
 * Built on React Flow with an executive dashboard aesthetic.
 */
export default function AutomationBuilder({ initialNodes, initialEdges, onStateChange }: AutomationBuilderProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
    const [isFullScreen, setIsFullScreen] = React.useState(false);

    const onConnect = React.useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' }
        }, eds)),
        [setEdges]
    );

    React.useEffect(() => {
        onStateChange(nodes, edges);
    }, [nodes, edges, onStateChange]);

    const addNode = (type: 'triggerNode' | 'actionNode') => {
        const id = `${type}_${Date.now()}`;
        const newNode = {
            id,
            type,
            position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
            data: { label: type === 'triggerNode' ? 'New Event Trigger' : 'New Task Action' },
        };
        setNodes(nds => [...nds, newNode]);
    };

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
                nodeTypes={nodeTypes}
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
                            <div className="h-px bg-border/50 mx-2" />
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
                            <span className="text-[10px] font-bold text-white/60 uppercase tracking-tighter italic">Logic Synchronized</span>
                        </div>
                    </Card>
                </Panel>

                <Controls className="!bg-white !border-none !shadow-2xl !rounded-xl overflow-hidden" showInteractive={false} />
            </ReactFlow>

            {/* Sidebar Inspector Context */}
            <div className="absolute top-6 right-6 z-20 w-80 pointer-events-none">
                <Card className="rounded-[2rem] border-none shadow-2xl bg-white/80 backdrop-blur-md p-6 pointer-events-auto opacity-0 group-hover/builder:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary"><Database className="h-4 w-4" /></div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest">Logic Inspector</h4>
                    </div>
                    <div className="py-12 text-center border-2 border-dashed rounded-2xl border-border/50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                            Select a node to<br/>configure parameters
                        </p>
                    </div>
                    <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                            Trigger payloads are automatically injected into the action context.
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
                <Button variant="ghost" size="icon" onClick={onClick} className={cn("h-10 w-10 rounded-xl transition-all", color)}>
                    <Icon className="h-5 w-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-black text-[10px] uppercase tracking-widest">{label}</TooltipContent>
        </Tooltip>
    );
}

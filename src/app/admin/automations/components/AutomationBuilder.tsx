'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
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
import { TagConditionNode } from '../[id]/edit/components/nodes/TagConditionNode';
import { TagActionNode } from '../[id]/edit/components/nodes/TagActionNode';
import { 
    Zap, 
    Play, 
    Maximize2,
    Minimize2,
    Info,
    Layers,
    Wand2,
    Settings2,
    ArrowRightLeft,
    Clock,
    X,
    MousePointer2,
    Tag,
    TagIcon,
    PlusCircle
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
    tagConditionNode: TagConditionNode,
    tagActionNode: TagActionNode,
};

const ElementLibraryModal = dynamic(() => import('./ElementLibraryModal'), { ssr: false });

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
    const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);

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
            case 'tagConditionNode': label = 'Tag Condition'; break;
            case 'tagActionNode': label = 'Tag Action'; break;
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

    const addLibraryNode = (item: any) => {
        const nodeType = item.nodeType || item.type;
        const id = `${nodeType}_${Date.now()}`;
        const label = item.label || 'New Step';

        let x = 400 + Math.random() * 50;
        let y = 300 + Math.random() * 50;

        const parentNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
        if (parentNode) {
            let targetX = parentNode.position.x;
            let targetY = parentNode.position.y + 140;

            const hasCollision = nodes.some(n => {
                const dx = n.position.x - targetX;
                const dy = n.position.y - targetY;
                return Math.sqrt(dx * dx + dy * dy) < 50;
            });

            if (hasCollision) {
                targetX += 220;
            }
            x = targetX;
            y = targetY;
        }

        const data: any = {
            label,
            config: {}
        };

        if (item.actionType) {
            data.actionType = item.actionType;
        }
        if (item.trigger) {
            data.trigger = item.trigger;
        }
        if (item.actionType === 'SEND_MESSAGE') {
            data.config.channel = item.channel || 'email';
        }
        if (item.config) {
            data.config = {
                ...data.config,
                ...item.config
            };
        }

        const newNode: Node = {
            id,
            type: nodeType,
            position: { x, y },
            data,
        };

        setNodes(nds => [...nds, newNode]);

        if (parentNode && nodeType !== 'triggerNode') {
            const newEdge = {
                id: `edge_${parentNode.id}_to_${id}_${Date.now()}`,
                source: parentNode.id,
                target: id,
                type: 'smoothstep',
                animated: true,
                style: { stroke: 'hsl(var(--primary))', strokeWidth: 3 },
                markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))', width: 20, height: 20 }
            };
            setEdges(eds => [...eds, newEdge]);
        }

        setSelectedNodeId(id);
        setIsLibraryOpen(false);
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    return (
 <div className={cn(
            "h-full w-full bg-background relative group/builder",
            isFullScreen && "fixed inset-0 z-[100] bg-background"
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
 className="bg-background"
            >
                <Background color="#cbd5e1" gap={30} size={1} />
                
        <Panel position="top-left" className="m-4 flex flex-col gap-4">
            <Card className="rounded-2xl border-none shadow-2xl p-1.5 flex flex-col gap-1.5 bg-background/95 backdrop-blur-md ring-1 ring-black/5">
                        <TooltipProvider>
                            <ToolBtn 
                                icon={PlusCircle} 
                                label="Open Elements Library" 
                                color="text-violet-600 bg-violet-50 font-bold border border-violet-100 animate-pulse" 
                                onClick={() => setIsLibraryOpen(true)} 
                            />
                            <ToolBtn icon={Zap} label="Add Trigger" color="text-emerald-600 bg-emerald-50" onClick={() => addNode('triggerNode')} />
                            <ToolBtn icon={Play} label="Add Action" color="text-blue-600 bg-blue-50" onClick={() => addNode('actionNode')} />
                            <ToolBtn icon={ArrowRightLeft} label="Add Condition" color="text-amber-600 bg-amber-50" onClick={() => addNode('conditionNode')} />
                            <ToolBtn icon={Tag} label="Add Tag Condition" color="text-violet-600 bg-violet-50" onClick={() => addNode('tagConditionNode')} />
                            <ToolBtn icon={TagIcon} label="Add Tag Action" color="text-emerald-600 bg-emerald-50" onClick={() => addNode('tagActionNode')} />
                            <ToolBtn icon={Clock} label="Add Delay" color="text-purple-600 bg-purple-50" onClick={() => addNode('delayNode')} />
                            <ToolBtn 
                                icon={isFullScreen ? Minimize2 : Maximize2} 
                                label={isFullScreen ? "Exit Hub" : "Zen View"} 
                                onClick={() => setIsFullScreen(!isFullScreen)} 
                            />
                        </TooltipProvider>
                    </Card>
                </Panel>

                 <Panel position="bottom-center" className="mb-4">
                    <div className="rounded-full bg-background/90 backdrop-blur-sm text-[9px] font-bold text-muted-foreground px-3.5 py-1.5 border border-border/80 shadow-sm flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5">
                            <Layers className="h-3 w-3 text-muted-foreground/60" />
                            <span>{nodes.length} {nodes.length === 1 ? 'Element' : 'Elements'}</span>
                        </div>
                        <span className="text-border/80">•</span>
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Verified</span>
                        </div>
                    </div>
                </Panel>

 <Controls className="!bg-card !border-none !shadow-2xl !rounded-xl overflow-hidden" showInteractive={false} />
            </ReactFlow>

            {/* Sidebar Inspector Context */}
            <div className="absolute top-6 right-6 bottom-6 z-20 w-[380px] pointer-events-none flex flex-col">
                <Card className={cn(
                    "rounded-2xl border border-border shadow-sm bg-card p-6 pointer-events-auto transition-all duration-500 h-full flex flex-col overflow-hidden",
                    selectedNodeId ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10 pointer-events-none"
                )}>
 <div className="flex items-center justify-between mb-6 shrink-0">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm"><Settings2 className="h-4 w-4" /></div>
 <h4 className="text-[10px] font-semibold ">Logic Inspector</h4>
                        </div>
 <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)} className="h-8 w-8 rounded-lg hover:bg-muted">
 <X className="h-4 w-4" />
                        </Button>
                    </div>
                    
 <div className="flex-1 overflow-hidden min-h-0">
                        {selectedNode ? (
                            <NodeInspector 
                                node={selectedNode} 
                                onUpdate={(data) => handleUpdateNodeData(selectedNode.id, data)} 
                            />
                        ) : (
 <div className="py-20 text-center border-2 border-dashed rounded-2xl border-border/50 bg-background">
 <MousePointer2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-20" />
 <p className="text-[10px] font-semibold text-muted-foreground opacity-40">
                                    Select an architecture node<br/>to configure operational logic
                                </p>
                            </div>
                        )}
                    </div>

 <div className="mt-6 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3 shrink-0 text-left">
 <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
 <p className="text-[9px] font-bold text-blue-800 leading-relaxed tracking-tighter">
                            Protocol payloads are inherited from the trigger source. Use the dictionary to map dynamic tags.
                        </p>
                    </div>
                </Card>
            </div>

            <ElementLibraryModal 
                open={isLibraryOpen} 
                onOpenChange={setIsLibraryOpen} 
                onSelect={addLibraryNode} 
                hasParentSelected={!!selectedNodeId} 
            />
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
 <TooltipContent side="right" className="font-semibold text-[10px] ">{label}</TooltipContent>
        </Tooltip>
    );
}

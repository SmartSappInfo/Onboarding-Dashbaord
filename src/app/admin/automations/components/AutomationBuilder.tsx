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
    updateEdge,
    Connection, 
    Edge,
    Node,
    ConnectionLineType
} from 'reactflow';
import { DeletableEdge } from '../[id]/edit/components/edges/DeletableEdge';
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
    Layers,
    Settings2,
    ArrowRightLeft,
    Clock,
    X,
    MousePointer2,
    Tag,
    TagIcon,
    PlusCircle,
    Undo2,
    Redo2
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

const edgeTypes = {
    deletable: DeletableEdge,
};

const ElementLibraryModal = dynamic(() => import('./ElementLibraryModal'), { ssr: false });

const MAX_HISTORY = 60;

interface HistoryEntry {
    nodes: Node[];
    edges: Edge[];
}

interface AutomationBuilderProps {
    initialNodes: any[];
    initialEdges: any[];
    onStateChange: (nodes: any[], edges: any[]) => void;
}

/**
 * @fileOverview The SmartSapp Visual Automation Architect.
 * Features: drag-and-drop canvas, node inspector, element library,
 * custom deletable edges, and undo/redo history.
 */
export default function AutomationBuilder({ initialNodes, initialEdges, onStateChange }: AutomationBuilderProps) {
    const healedEdges = React.useMemo(() => {
        if (!initialEdges) return [];
        return initialEdges.map((edge: any) => {
            if (!edge.sourceHandle) {
                const sourceNode = initialNodes?.find((n: any) => n.id === edge.source);
                if (sourceNode?.type === 'conditionNode' || sourceNode?.type === 'tagConditionNode') {
                    return { ...edge, sourceHandle: 'true' };
                }
            }
            return edge;
        });
    }, [initialEdges, initialNodes]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(healedEdges);
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);
    const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);

    // ─── Undo / Redo ──────────────────────────────────────────────────────
    const historyRef = React.useRef<HistoryEntry[]>([
        { nodes: initialNodes || [], edges: healedEdges }
    ]);
    const historyIndexRef = React.useRef(0);
    const isRestoringRef = React.useRef(false);
    const [canUndo, setCanUndo] = React.useState(false);
    const [canRedo, setCanRedo] = React.useState(false);

    const pushHistory = React.useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
        if (isRestoringRef.current) return;

        const history = historyRef.current;
        const idx = historyIndexRef.current;

        // Truncate any "future" entries (discard redo stack on new action)
        historyRef.current = history.slice(0, idx + 1);

        // Deduplicate: skip if identical to current tip
        const tip = historyRef.current[historyRef.current.length - 1];
        const sameNodes = JSON.stringify(tip?.nodes?.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })))
            === JSON.stringify(nextNodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })));
        const sameEdges = JSON.stringify(tip?.edges?.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle })))
            === JSON.stringify(nextEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle })));
        if (sameNodes && sameEdges) return;

        // Push new snapshot (strip non-serializable data like callbacks)
        const cleanNodes = nextNodes.map(n => ({
            ...n,
            data: { ...n.data },
        }));
        const cleanEdges = nextEdges.map(e => ({
            ...e,
            data: undefined,
        }));

        historyRef.current.push({ nodes: cleanNodes, edges: cleanEdges });

        // Cap history length
        if (historyRef.current.length > MAX_HISTORY) {
            historyRef.current = historyRef.current.slice(-MAX_HISTORY);
        }

        historyIndexRef.current = historyRef.current.length - 1;
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(false);
    }, []);

    const undo = React.useCallback(() => {
        const idx = historyIndexRef.current;
        if (idx <= 0) return;
        isRestoringRef.current = true;

        const newIdx = idx - 1;
        historyIndexRef.current = newIdx;
        const entry = historyRef.current[newIdx];

        setNodes(entry.nodes);
        setEdges(entry.edges);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);

        setCanUndo(newIdx > 0);
        setCanRedo(true);

        // Allow new history entries after the current tick
        requestAnimationFrame(() => { isRestoringRef.current = false; });
    }, [setNodes, setEdges]);

    const redo = React.useCallback(() => {
        const idx = historyIndexRef.current;
        if (idx >= historyRef.current.length - 1) return;
        isRestoringRef.current = true;

        const newIdx = idx + 1;
        historyIndexRef.current = newIdx;
        const entry = historyRef.current[newIdx];

        setNodes(entry.nodes);
        setEdges(entry.edges);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);

        setCanUndo(true);
        setCanRedo(newIdx < historyRef.current.length - 1);

        requestAnimationFrame(() => { isRestoringRef.current = false; });
    }, [setNodes, setEdges]);

    // ─── Edge deletion ────────────────────────────────────────────────────
    const deleteEdge = React.useCallback(
        (edgeId: string) => {
            setEdges(eds => eds.filter(e => e.id !== edgeId));
            setSelectedEdgeId(prev => prev === edgeId ? null : prev);
        },
        [setEdges]
    );

    const onConnect = React.useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            type: 'deletable',
            animated: false,
            data: { onDelete: deleteEdge },
        }, eds)),
        [setEdges, deleteEdge]
    );

    const onEdgeUpdate = React.useCallback(
        (oldEdge: Edge, newConnection: Connection) =>
            setEdges((eds) => updateEdge(oldEdge, newConnection, eds)),
        [setEdges]
    );

    const onEdgeClick = React.useCallback(
        (_: React.MouseEvent, edge: Edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
        },
        []
    );

    const onNodeClick = (_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
    };

    const onPaneClick = () => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
    };

    // Keyboard shortcuts: Delete/Backspace for deletion, Cmd/Ctrl+Z for undo, Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y for redo
    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const isEditable = (e.target as HTMLElement)?.isContentEditable;
            if (isEditable) return;

            const mod = e.metaKey || e.ctrlKey;

            // Undo: Cmd/Ctrl + Z (without Shift)
            if (mod && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Redo: Cmd/Ctrl + Shift + Z  OR  Cmd/Ctrl + Y
            if ((mod && e.key === 'z' && e.shiftKey) || (mod && e.key === 'y')) {
                e.preventDefault();
                redo();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedEdgeId) {
                    e.preventDefault();
                    deleteEdge(selectedEdgeId);
                } else if (selectedNodeId) {
                    e.preventDefault();
                    setEdges(eds => eds.filter(edge => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
                    setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
                    setSelectedNodeId(null);
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedEdgeId, selectedNodeId, deleteEdge, setEdges, setNodes, undo, redo]);

    const handleUpdateNodeData = (nodeId: string, newData: any) => {
        setNodes(nds => nds.map(node => {
            if (node.id === nodeId) {
                return { ...node, data: { ...node.data, ...newData } };
            }
            return node;
        }));
    };

    // STABILIZED STATE EMITTER + HISTORY CAPTURE:
    // Uses a ref to track the last emitted state to prevent recursive sync loops.
    // Also pushes to undo history on meaningful changes (debounced 300ms).
    const lastEmittedRef = React.useRef<string>('');
    const historyTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        const stateString = JSON.stringify({ nodes, edges });
        if (stateString === lastEmittedRef.current) return;

        const timeout = setTimeout(() => {
            onStateChange(nodes, edges);
            lastEmittedRef.current = stateString;
        }, 150);

        // Debounce history pushes so drags don't flood the stack
        if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
        historyTimerRef.current = setTimeout(() => {
            pushHistory(nodes, edges);
        }, 350);

        return () => {
            clearTimeout(timeout);
            if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
        };
    }, [nodes, edges, onStateChange, pushHistory]);

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
        let sourceHandle = undefined;

        if (parentNode) {
            let targetX = parentNode.position.x;
            let targetY = parentNode.position.y + 140;

            if (parentNode.type === 'conditionNode' || parentNode.type === 'tagConditionNode') {
                const hasTrueEdge = edges.some(e => e.source === parentNode.id && e.sourceHandle === 'true');
                if (!hasTrueEdge) {
                    sourceHandle = 'true';
                    targetX -= 120;
                } else {
                    sourceHandle = 'false';
                    targetX += 120;
                }
            }

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
                sourceHandle,
                target: id,
                type: 'deletable',
                animated: false,
                data: { onDelete: deleteEdge },
            };
            setEdges(eds => [...eds, newEdge]);
        }

        setSelectedNodeId(id);
        setIsLibraryOpen(false);
    };

    // Inject onDelete + upgrade legacy edge types for ALL edges
    const edgesWithCallbacks = React.useMemo(
        () => edges.map(e => ({
            ...e,
            type: e.type === 'smoothstep' || !e.type ? 'deletable' : e.type,
            animated: false,
            data: { ...e.data, onDelete: deleteEdge },
        })),
        [edges, deleteEdge]
    );

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    return (
 <div className={cn(
            "h-full w-full bg-background relative group/builder",
            isFullScreen && "fixed inset-0 z-[100] bg-background"
        )}>
            <ReactFlow
                nodes={nodes}
                edges={edgesWithCallbacks}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeUpdate={onEdgeUpdate}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                edgeTypes={edgeTypes}
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
                            <div className="h-px bg-border/50 mx-1" />
                            <ToolBtn icon={Zap} label="Add Trigger" color="text-emerald-600 bg-emerald-50" onClick={() => addNode('triggerNode')} />
                            <ToolBtn icon={Play} label="Add Action" color="text-blue-600 bg-blue-50" onClick={() => addNode('actionNode')} />
                            <ToolBtn icon={ArrowRightLeft} label="Add Condition" color="text-amber-600 bg-amber-50" onClick={() => addNode('conditionNode')} />
                            <ToolBtn icon={Tag} label="Add Tag Condition" color="text-violet-600 bg-violet-50" onClick={() => addNode('tagConditionNode')} />
                            <ToolBtn icon={TagIcon} label="Add Tag Action" color="text-emerald-600 bg-emerald-50" onClick={() => addNode('tagActionNode')} />
                            <ToolBtn icon={Clock} label="Add Delay" color="text-purple-600 bg-purple-50" onClick={() => addNode('delayNode')} />
                            <div className="h-px bg-border/50 mx-1" />
                            <ToolBtn 
                                icon={Undo2} 
                                label={`Undo (${navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Z)`}
                                color={canUndo ? "text-slate-700 bg-slate-50 dark:text-slate-300 dark:bg-slate-800" : "text-slate-300 bg-slate-50/50 dark:text-slate-600 dark:bg-slate-900 pointer-events-none"}
                                onClick={undo} 
                            />
                            <ToolBtn 
                                icon={Redo2} 
                                label={`Redo (${navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+⇧+Z)`}
                                color={canRedo ? "text-slate-700 bg-slate-50 dark:text-slate-300 dark:bg-slate-800" : "text-slate-300 bg-slate-50/50 dark:text-slate-600 dark:bg-slate-900 pointer-events-none"}
                                onClick={redo} 
                            />
                            <div className="h-px bg-border/50 mx-1" />
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
                        <div className="flex items-center gap-1.5">
                            <ArrowRightLeft className="h-3 w-3 text-muted-foreground/60" />
                            <span>{edges.length} {edges.length === 1 ? 'Connection' : 'Connections'}</span>
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

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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    Redo2,
    Activity,
    Search,
    LayoutGrid,
    LayoutList,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NodeInspector } from './NodeInspector';
import type { AutomationTriggerDef, AutomationRun } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useSearchParams } from 'next/navigation';
import { DiagnosticsPanel } from './DiagnosticsPanel';

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

const AutomationStepLibraryModal = dynamic(() => import('./AutomationStepLibraryModal'), { ssr: false });

const MAX_HISTORY = 60;

interface HistoryEntry {
    nodes: Node[];
    edges: Edge[];
}

interface AutomationBuilderProps {
    initialNodes: any[];
    initialEdges: any[];
    triggers: AutomationTriggerDef[];
    onStateChange: (nodes: any[], edges: any[]) => void;
    onTriggersChange: (triggers: AutomationTriggerDef[]) => void;
    automationId: string;
}

/**
 * @fileOverview The SmartSapp Visual Automation Architect.
 * Features: drag-and-drop canvas, node inspector, automation step library,
 * custom deletable edges, and undo/redo history.
 */
export default function AutomationBuilder({ initialNodes, initialEdges, triggers, onStateChange, onTriggersChange, automationId }: AutomationBuilderProps) {
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
    const [librarySourceHandle, setLibrarySourceHandle] = React.useState<string | undefined>(undefined);

    // Diagnostics panel states
    const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
    const [selectedRun, setSelectedRun] = React.useState<AutomationRun | null>(null);
    const [diagnosticsFilterNodeId, setDiagnosticsFilterNodeId] = React.useState<string | null>(null);

    // Dirty/Confirmation states
    const [isInspectorDirty, setIsInspectorDirty] = React.useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = React.useState(false);
    const [skipConfirm, setSkipConfirm] = React.useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('skipInspectorConfirmations') === 'true';
        }
        return false;
    });
    
    // Store target operations when switching nodes or pane click
    const nextActionRef = React.useRef<{
        type: 'select' | 'pane' | 'close';
        nodeId?: string;
    } | null>(null);

    // NodeInspector temporary draft data (used to save on exit confirm)
    const activeDraftRef = React.useRef<{
        nodeId: string;
        nodeData: any;
        nextTriggers?: AutomationTriggerDef[];
    } | null>(null);

    // Test step dialog state
    const [testDialogOpen, setTestDialogOpen] = React.useState(false);
    const [testTargetNode, setTestTargetNode] = React.useState<{ id: string; data: any } | null>(null);
    const [testEntitySearch, setTestEntitySearch] = React.useState('');
    const [testEntities, setTestEntities] = React.useState<any[]>([]);
    const [testingEntityId, setTestingEntityId] = React.useState<string>('');
    const [isTestingStep, setIsTestingStep] = React.useState(false);
    const [testResult, setTestResult] = React.useState<{ success: boolean; message?: string; evaluation?: boolean; error?: string } | null>(null);

    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const queryRunId = searchParams?.get('runId');

    // Fetch test entities from workspace_entities
    React.useEffect(() => {
        if (testDialogOpen && firestore) {
            import('firebase/firestore').then(({ collection, getDocs, limit, query }) => {
                getDocs(query(collection(firestore, 'workspace_entities'), limit(15))).then((snap) => {
                    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setTestEntities(list);
                    if (list.length > 0 && !testingEntityId) {
                        setTestingEntityId((list[0] as any).entityId || list[0].id);
                    }
                });
            });
        }
    }, [testDialogOpen, firestore, testingEntityId]);

    // Auto-open run diagnostics if runId is in search params
    React.useEffect(() => {
        if (queryRunId && firestore) {
            import('firebase/firestore').then(({ doc, getDoc }) => {
                getDoc(doc(firestore, 'automation_runs', queryRunId)).then((snap) => {
                    if (snap.exists()) {
                        setSelectedRun({ id: snap.id, ...snap.data() } as AutomationRun);
                        setDiagnosticsOpen(true);
                    }
                });
            });
        }
    }, [queryRunId, firestore]);

    const toggleDiagnostics = () => {
        setDiagnosticsOpen((prev) => {
            if (!prev) {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
            }
            return !prev;
        });
    };
    // Keep nodes state in sync when triggers prop changes from outside (e.g. from the inspector updates)
    React.useEffect(() => {
        setNodes(nds => nds.map(node => {
            if (node.type !== 'triggerNode') return node;
            if (JSON.stringify(node.data?.triggers) === JSON.stringify(triggers)) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    triggers,
                    trigger: triggers[0]?.type ?? null,
                    config: triggers[0]?.config ?? {}
                }
            };
        }));
    }, [triggers, setNodes]);

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

    // ─── Automatic Layout ──────────────────────────────────────────────────
    const applyAutoLayout = React.useCallback((direction: 'vertical' | 'horizontal') => {
        if (nodes.length === 0) return;

        // 1. Build adjacency list representation of the graph
        const adj: Record<string, { target: string; handle: string | null }[]> = {};
        const inDegree: Record<string, number> = {};

        nodes.forEach(n => {
            adj[n.id] = [];
            inDegree[n.id] = 0;
        });

        edges.forEach(e => {
            if (adj[e.source] && adj[e.target] !== undefined) {
                adj[e.source].push({ target: e.target, handle: e.sourceHandle || null });
                inDegree[e.target] = (inDegree[e.target] || 0) + 1;
            }
        });

        // 2. Identify root nodes (nodes with 0 in-degree or triggers)
        let roots = nodes.filter(n => n.type === 'triggerNode');
        if (roots.length === 0) {
            roots = nodes.filter(n => (inDegree[n.id] || 0) === 0);
        }
        if (roots.length === 0 && nodes.length > 0) {
            roots = [nodes[0]];
        }

        // We will layout each disconnected component/tree
        const visited = new Set<string>();
        const positions: Record<string, { x: number; y: number }> = {};

        // Configuration spacing constants
        const siblingSpacing = 320; // horizontal gap between siblings in vertical layout, or vertical gap in horizontal layout
        const levelSpacing = 180;   // gap between parent and child

        // Layout subtree starting at node
        const layoutSubtree = (nodeId: string, level: number, offset: number): number => {
            visited.add(nodeId);

            const children = adj[nodeId] || [];
            // Sort children so that 'true' or default branches come first consistently
            const unvisitedChildren = children
                .filter(c => !visited.has(c.target))
                .sort((a, b) => {
                    const ha = a.handle || '';
                    const hb = b.handle || '';
                    if (ha === 'true' && hb === 'false') return -1;
                    if (ha === 'false' && hb === 'true') return 1;
                    return ha.localeCompare(hb);
                });

            let width = 0;
            const childOffsets: number[] = [];

            if (unvisitedChildren.length > 0) {
                let currentOffset = offset;
                unvisitedChildren.forEach((c) => {
                    const childWidth = layoutSubtree(c.target, level + 1, currentOffset);
                    childOffsets.push(currentOffset + childWidth / 2);
                    currentOffset += childWidth;
                });
                width = currentOffset - offset;
            } else {
                width = siblingSpacing;
            }

            // Node position coordinate
            const nodeOffset = unvisitedChildren.length > 0
                ? (childOffsets[0] + childOffsets[childOffsets.length - 1]) / 2
                : offset + siblingSpacing / 2;

            if (direction === 'vertical') {
                positions[nodeId] = {
                    x: nodeOffset,
                    y: level * levelSpacing + 80
                };
            } else {
                positions[nodeId] = {
                    x: level * levelSpacing + 100,
                    y: nodeOffset
                };
            }

            return width;
        };

        // Run layout for all root components
        let totalOffset = 0;
        roots.forEach(root => {
            if (!visited.has(root.id)) {
                const componentWidth = layoutSubtree(root.id, 0, totalOffset);
                totalOffset += componentWidth + siblingSpacing * 0.5;
            }
        });

        // Layout any orphan nodes not reachable from roots
        nodes.forEach(n => {
            if (!visited.has(n.id)) {
                const componentWidth = layoutSubtree(n.id, 0, totalOffset);
                totalOffset += componentWidth + siblingSpacing * 0.5;
            }
        });

        // 3. Apply calculated positions to the node state
        const layoutedNodes = nodes.map(n => {
            const pos = positions[n.id] || n.position;
            return {
                ...n,
                position: { ...pos }
            };
        });

        // Update state and record in undo history immediately
        setNodes(layoutedNodes);
        pushHistory(layoutedNodes, edges);
    }, [nodes, edges, setNodes, pushHistory]);

    // ─── Edge deletion ────────────────────────────────────────────────────
    const deleteEdge = React.useCallback(
        (edgeId: string) => {
            setEdges(eds => eds.filter(e => e.id !== edgeId));
            setSelectedEdgeId(prev => prev === edgeId ? null : prev);
        },
        [setEdges]
    );

    const isValidConnection = React.useCallback(
        (connection: Connection) => {
            if (connection.source === connection.target) return false;
            
            // Check if the source handle already has an outgoing connection
            const sourceHasConnection = edges.some(
                (edge) =>
                    edge.source === connection.source &&
                    edge.sourceHandle === connection.sourceHandle
            );
            return !sourceHasConnection;
        },
        [edges]
    );

    const onConnect = React.useCallback(
        (params: Connection) => {
            if (!isValidConnection(params)) return;
            setEdges((eds) => addEdge({
                ...params,
                type: 'deletable',
                animated: false,
                data: { onDelete: deleteEdge },
            }, eds));
        },
        [setEdges, deleteEdge, isValidConnection]
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
        if (node.id === selectedNodeId) return;

        if (isInspectorDirty && !skipConfirm) {
            nextActionRef.current = { type: 'select', nodeId: node.id };
            setConfirmModalOpen(true);
            
            // Programmatically force-keep visual outline selection on active dirty node inside React Flow
            setNodes(nds => nds.map(n => n.id === selectedNodeId ? { ...n, selected: true } : { ...n, selected: false }));
        } else {
            // If skipConfirm is checked, discard changes immediately and select new node
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
            setDiagnosticsOpen(false);
        }
    };

    const onPaneClick = () => {
        if (!selectedNodeId) return;

        if (isInspectorDirty && !skipConfirm) {
            nextActionRef.current = { type: 'pane' };
            setConfirmModalOpen(true);
            
            // Programmatically force-keep visual outline selection on active dirty node inside React Flow
            setNodes(nds => nds.map(n => n.id === selectedNodeId ? { ...n, selected: true } : { ...n, selected: false }));
        } else {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
        }
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
        let sourceHandle = librarySourceHandle;

        if (parentNode) {
            let targetX = parentNode.position.x;
            let targetY = parentNode.position.y + 140;

            if (!sourceHandle && (parentNode.type === 'conditionNode' || parentNode.type === 'tagConditionNode')) {
                const hasTrueEdge = edges.some(e => e.source === parentNode.id && e.sourceHandle === 'true');
                if (!hasTrueEdge) {
                    sourceHandle = 'true';
                } else {
                    sourceHandle = 'false';
                }
            }

            if (sourceHandle === 'true') {
                targetX -= 120;
            } else if (sourceHandle === 'false') {
                targetX += 120;
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
            data.config.recipientTargets = ['triggering'];
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
            const isSourceConnected = edges.some(
                (edge) =>
                    edge.source === parentNode.id &&
                    edge.sourceHandle === sourceHandle
            );
            if (!isSourceConnected) {
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
        }

        setSelectedNodeId(id);
        setLibrarySourceHandle(undefined);
        setIsLibraryOpen(false);
    };

    // Inject onDelete + upgrade legacy edge types for ALL edges
    const edgesWithCallbacks = React.useMemo(() => {
        return edges.map(e => {
            // Determine if this edge was traversed in the selected run
            let edgeExecutionStatus: 'traversed' | 'not-traversed' | null = null;
            if (selectedRun?.steps) {
                const sourceStep = selectedRun.steps[e.source];
                const targetStep = selectedRun.steps[e.target];
                if (sourceStep && targetStep) {
                    // For condition nodes, check if the correct handle was taken
                    if (sourceStep.metadata?.evaluation && e.sourceHandle) {
                        edgeExecutionStatus = sourceStep.metadata.evaluation === e.sourceHandle
                            ? 'traversed' : 'not-traversed';
                    } else {
                        edgeExecutionStatus = 'traversed';
                    }
                } else if (sourceStep && !targetStep) {
                    edgeExecutionStatus = 'not-traversed';
                }
            }

            return {
                ...e,
                type: e.type === 'smoothstep' || !e.type ? 'deletable' : e.type,
                animated: edgeExecutionStatus === 'traversed',
                style: edgeExecutionStatus === 'traversed'
                    ? { stroke: '#10b981', strokeWidth: 2.5 }
                    : edgeExecutionStatus === 'not-traversed'
                    ? { stroke: '#d1d5db', strokeWidth: 1, opacity: 0.3 }
                    : undefined,
                data: { ...e.data, onDelete: deleteEdge },
            };
        });
    }, [edges, deleteEdge, selectedRun]);

    const nodesWithCallbacks = React.useMemo(() => {
        const stepMap = selectedRun?.steps || {};
        return nodes.map(node => {
            const hasTrueConnection = edges.some(e => e.source === node.id && e.sourceHandle === 'true');
            const hasFalseConnection = edges.some(e => e.source === node.id && e.sourceHandle === 'false');
            const hasDefaultConnection = edges.some(e => e.source === node.id && (!e.sourceHandle || e.sourceHandle === 'default' || e.sourceHandle === ''));

            const stepData = stepMap[node.id];

            return {
                ...node,
                data: {
                    ...node.data,
                    isDefaultConnected: hasDefaultConnection,
                    isTrueConnected: hasTrueConnection,
                    isFalseConnected: hasFalseConnection,
                    // Execution overlay data
                    ...(selectedRun ? {
                        executionStatus: stepData?.status || null,
                        executionError: stepData?.error || null,
                        executionMeta: stepData?.metadata || null,
                    } : {}),
                    onAddStep: (nodeId: string, sourceHandle?: string) => {
                        setSelectedNodeId(nodeId);
                        setLibrarySourceHandle(sourceHandle);
                        setIsLibraryOpen(true);
                    },
                    onFilterDiagnostics: (nodeId: string) => {
                        setDiagnosticsFilterNodeId(nodeId);
                        setSelectedNodeId(null);
                        setSelectedEdgeId(null);
                        setDiagnosticsOpen(true);
                    }
                }
            };
        });
    }, [nodes, edges, selectedRun]);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    return (
        <div className={cn(
            "h-full w-full bg-background relative group/builder",
            isFullScreen && "fixed inset-0 z-[100] bg-background"
        )}>
            <ReactFlow
                nodes={nodesWithCallbacks}
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
                isValidConnection={isValidConnection}
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
                                icon={Zap} 
                                label={`Configure Triggers (${triggers.length} active)`} 
                                color="text-emerald-600 bg-emerald-50 font-bold border border-emerald-200" 
                                onClick={() => {
                                    const triggerNode = nodes.find(n => n.type === 'triggerNode');
                                    if (triggerNode) {
                                        setSelectedNodeId(triggerNode.id);
                                    }
                                }} 
                            />
                            <ToolBtn 
                                icon={PlusCircle} 
                                label="Open Automation Step Library" 
                                color="text-violet-600 bg-violet-50 font-bold border border-violet-100 animate-pulse" 
                                onClick={() => setIsLibraryOpen(true)} 
                            />
                            <div className="h-px bg-border/50 mx-1" />
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
                                icon={LayoutGrid} 
                                label="Auto Arrange Vertically" 
                                color="text-teal-600 bg-teal-50 border border-teal-100" 
                                onClick={() => applyAutoLayout('vertical')} 
                            />
                            <ToolBtn 
                                icon={LayoutList} 
                                label="Auto Arrange Horizontally" 
                                color="text-teal-600 bg-teal-50 border border-teal-100" 
                                onClick={() => applyAutoLayout('horizontal')} 
                            />
                            <div className="h-px bg-border/50 mx-1" />
                            <ToolBtn 
                                icon={Activity} 
                                label="Diagnostics Panel" 
                                color={diagnosticsOpen
                                    ? "text-white bg-primary font-bold border border-primary shadow-sm"
                                    : "text-orange-600 bg-orange-50 font-bold border border-orange-100"
                                } 
                                onClick={toggleDiagnostics} 
                            />
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
            <div className="absolute top-6 right-6 bottom-6 z-20 w-[456px] pointer-events-none flex flex-col">
                {diagnosticsOpen ? (
                    <div className="h-full pointer-events-auto">
                        <DiagnosticsPanel
                            automationId={automationId}
                            nodes={nodes}
                            onSelectRun={setSelectedRun}
                            selectedRun={selectedRun}
                            filterNodeId={diagnosticsFilterNodeId}
                            onClearFilterNodeId={() => setDiagnosticsFilterNodeId(null)}
                            onClose={() => {
                                setDiagnosticsOpen(false);
                                setDiagnosticsFilterNodeId(null);
                            }}
                        />
                    </div>
                ) : (
                    <Card className={cn(
                        "rounded-2xl border border-border shadow-sm bg-card p-6 pointer-events-auto transition-all duration-500 h-full flex flex-col overflow-hidden",
                        selectedNodeId ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10 pointer-events-none"
                    )}>
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm"><Settings2 className="h-4 w-4" /></div>
                                <h4 className="text-[10px] font-semibold ">Logic Inspector</h4>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                    if (isInspectorDirty && !skipConfirm) {
                                        nextActionRef.current = { type: 'close' };
                                        setConfirmModalOpen(true);
                                    } else {
                                        setSelectedNodeId(null);
                                    }
                                }} 
                                className="h-8 w-8 rounded-lg hover:bg-muted"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="flex-1 overflow-hidden min-h-0">
                            {selectedNode ? (
                                <NodeInspector 
                                    node={selectedNode} 
                                    onUpdate={(data) => handleUpdateNodeData(selectedNode.id, data)}
                                    triggers={triggers}
                                    onTriggersChange={onTriggersChange}
                                    onDirtyChange={setIsInspectorDirty}
                                    onApply={(nodeId, nodeData, nextTriggers) => {
                                        handleUpdateNodeData(nodeId, nodeData);
                                        if (nextTriggers && selectedNode?.type === 'triggerNode') {
                                            onTriggersChange(nextTriggers);
                                        }
                                        setIsInspectorDirty(false);
                                    }}
                                    onCancel={() => {
                                        if (isInspectorDirty && !skipConfirm) {
                                            nextActionRef.current = { type: 'close' };
                                            setConfirmModalOpen(true);
                                        } else {
                                            setSelectedNodeId(null);
                                        }
                                    }}
                                    onTest={(nodeId, nodeData) => {
                                        setTestTargetNode({ id: nodeId, data: nodeData });
                                        setTestResult(null);
                                        setTestDialogOpen(true);
                                    }}
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
                )}
            </div>

            <AutomationStepLibraryModal 
                open={isLibraryOpen} 
                onOpenChange={setIsLibraryOpen} 
                onSelect={addLibraryNode} 
                hasParentSelected={!!selectedNodeId} 
            />

            {/* Exit Confirmation Dialog */}
            {(() => {
                const handleProceed = (save: boolean) => {
                    if (save && selectedNode) {
                        // Gather what NodeInspector was working on
                        const finalData = activeDraftRef.current?.nodeData || selectedNode.data;
                        handleUpdateNodeData(selectedNode.id, finalData);
                        if (selectedNode.type === 'triggerNode' && activeDraftRef.current?.nextTriggers) {
                            onTriggersChange(activeDraftRef.current.nextTriggers);
                        }
                    }
                    setIsInspectorDirty(false);
                    setConfirmModalOpen(false);

                    // Complete selection or pane transitions
                    const action = nextActionRef.current;
                    if (action) {
                        if (action.type === 'select' && action.nodeId) {
                            setSelectedNodeId(action.nodeId);
                            setSelectedEdgeId(null);
                            setDiagnosticsOpen(false);
                        } else if (action.type === 'pane') {
                            setSelectedNodeId(null);
                            setSelectedEdgeId(null);
                        } else if (action.type === 'close') {
                            setSelectedNodeId(null);
                        }
                    }
                    nextActionRef.current = null;
                };

                return (
                    <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
                        <DialogContent className="rounded-2xl max-w-sm border-none shadow-2xl p-6 bg-background/95 backdrop-blur-md">
                            <DialogHeader className="text-left space-y-2">
                                <DialogTitle className="text-sm font-bold">Unsaved Inspector Changes</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                                    You have unsaved changes in the Logic Inspector. Would you like to save and apply them or discard them before exiting?
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex items-center gap-2 py-3">
                                <input
                                    type="checkbox"
                                    id="skipConfirmCheckbox"
                                    checked={skipConfirm}
                                    onChange={(e) => {
                                        const val = e.target.checked;
                                        setSkipConfirm(val);
                                        localStorage.setItem('skipInspectorConfirmations', String(val));
                                    }}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                                />
                                <label htmlFor="skipConfirmCheckbox" className="text-[10px] font-semibold text-muted-foreground cursor-pointer select-none">
                                    Skip this confirmation next time
                                </label>
                            </div>

                            <DialogFooter className="flex flex-row items-center gap-2 pt-2">
                                <Button
                                    variant="ghost"
                                    className="h-9 rounded-xl text-xs flex-1"
                                    onClick={() => {
                                        setConfirmModalOpen(false);
                                        nextActionRef.current = null;
                                    }}
                                >
                                    Cancel & Keep Editing
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-9 rounded-xl text-xs flex-1 border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10"
                                    onClick={() => handleProceed(false)}
                                >
                                    Discard Changes
                                </Button>
                                <Button
                                    className="h-9 rounded-xl text-xs flex-1 bg-primary text-white hover:bg-primary/95 font-bold"
                                    onClick={() => handleProceed(true)}
                                >
                                    Save & Apply
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                );
            })()}

            {/* Test Step QA Selector Dialog */}
            {(() => {
                const runStepTest = async () => {
                    if (!testingEntityId || !testTargetNode) return;
                    setIsTestingStep(true);
                    setTestResult(null);
                    try {
                        const { testAutomationStepAction } = await import('@/lib/automation-actions');
                        const res = await testAutomationStepAction(
                            automationId,
                            testTargetNode.id,
                            testingEntityId,
                            testTargetNode.data,
                            'admin_user_id' // Mock actor ID or load from user context if available
                        );
                        setTestResult(res);
                    } catch (err: any) {
                        setTestResult({ success: false, error: err.message });
                    } finally {
                        setIsTestingStep(false);
                    }
                };

                const filteredEntities = testEntities.filter(e => 
                    String(e.displayName || e.name || e.id).toLowerCase().includes(testEntitySearch.toLowerCase())
                );

                return (
                    <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                        <DialogContent className="rounded-3xl max-w-md border-none shadow-2xl p-6 bg-background/95 backdrop-blur-md">
                            <DialogHeader className="text-left space-y-2">
                                <DialogTitle className="text-sm font-bold flex items-center gap-2 text-orange-600">
                                    <Activity className="h-4 w-4 animate-pulse" /> Test Automation Step
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                                    Perform an isolated test execution of this step logic. Select a mock or active entity in the workspace to evaluate the step parameters against.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 my-2">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1">Search & Select Entity</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            value={testEntitySearch}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestEntitySearch(e.target.value)}
                                            placeholder="Search active pipeline entities..."
                                            className="pl-9 h-9 text-xs bg-muted/40 rounded-xl"
                                        />
                                    </div>
                                    <Select value={testingEntityId} onValueChange={setTestingEntityId}>
                                        <SelectTrigger className="h-10 rounded-xl bg-card text-xs font-semibold">
                                            <SelectValue placeholder="Select target contact..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                            {filteredEntities.map((e) => (
                                                <SelectItem key={e.id} value={e.entityId || e.id} className="text-xs">
                                                    {e.displayName || e.name || e.id} ({(e as any).entityType || 'Contact'})
                                                </SelectItem>
                                            ))}
                                            {filteredEntities.length === 0 && (
                                                <SelectItem value="none" disabled>No entities found</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {testResult && (
                                    <div className={cn(
                                        "p-4 rounded-2xl border text-xs font-medium space-y-1 animate-in zoom-in-95 duration-200",
                                        testResult.success 
                                            ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/20" 
                                            : "bg-rose-500/5 text-rose-600 border-rose-500/20"
                                    )}>
                                        <p className="font-bold">{testResult.success ? "Test Succeeded" : "Test Failed"}</p>
                                        <p className="opacity-90 leading-relaxed">{testResult.message || testResult.error}</p>
                                        {testResult.evaluation !== undefined && (
                                            <Badge variant="outline" className={cn(
                                                "mt-1 bg-background text-[10px] font-mono",
                                                testResult.evaluation ? "text-emerald-600 border-emerald-500/30" : "text-amber-600 border-amber-500/30"
                                            )}>
                                                Branch Taken: {testResult.evaluation ? "TRUE" : "FALSE"}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="flex flex-row items-center gap-2 pt-2">
                                <Button
                                    variant="ghost"
                                    className="h-9 rounded-xl text-xs flex-1"
                                    onClick={() => setTestDialogOpen(false)}
                                >
                                    Close Dialog
                                </Button>
                                <Button
                                    className="h-9 rounded-xl text-xs flex-1 bg-orange-600 text-white hover:bg-orange-500 font-bold"
                                    disabled={!testingEntityId || isTestingStep}
                                    onClick={runStepTest}
                                >
                                    {isTestingStep ? "Testing..." : "Execute Test"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                );
            })()}
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

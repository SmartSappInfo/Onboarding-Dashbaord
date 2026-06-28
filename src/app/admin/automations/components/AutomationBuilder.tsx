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
    NodeChange,
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
import { ABSplitNode } from '../[id]/edit/components/nodes/ABSplitNode';
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
    Copy,
    Trash2,
    ArrowUp,
    ArrowDown,
    Plus,
    StickyNote,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
    abSplitNode: ABSplitNode,
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

    // Context menu state (right-click on node)
    const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; nodeId: string } | null>(null);

    // Insert-above mode: when set, the next library step gets inserted above this node
    const insertAboveRef = React.useRef<string | null>(null);

    // Step action confirmation dialog (clone / delete)
    const [stepActionDialog, setStepActionDialog] = React.useState<{
        action: 'clone' | 'delete';
        nodeId: string;
    } | null>(null);

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

    // Group drag: snapshot of downstream node positions when drag starts
    const dragStartRef = React.useRef<{
        draggedNodeId: string;
        startPos: { x: number; y: number };
        downstreamPositions: Map<string, { x: number; y: number }>;
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
                // Opening from toolbar — always clear any stale node filter
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setDiagnosticsFilterNodeId(null);
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
                    const node = nodes.find(n => n.id === selectedNodeId);
                    if (node && node.type !== 'triggerNode') {
                        setStepActionDialog({ action: 'delete', nodeId: selectedNodeId });
                    }
                }
            }

            // Cmd/Ctrl + D to duplicate selected node
            if (mod && e.key === 'd') {
                e.preventDefault();
                if (selectedNodeId) {
                    const node = nodes.find(n => n.id === selectedNodeId);
                    if (node && node.type !== 'triggerNode') {
                        setStepActionDialog({ action: 'clone', nodeId: selectedNodeId });
                    }
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

    // Strip ReactFlow internal + runtime-injected properties before emitting
    // so the parent's dirty-check compares clean, persistable data.
    const RUNTIME_DATA_KEYS = new Set([
        'isDefaultConnected', 'isTrueConnected', 'isFalseConnected',
        'executionStatus', 'executionError', 'executionMeta',
        'canMoveUp', 'canMoveDown', 'hasNote',
        'onAddStep', 'onFilterDiagnostics', 'onAddAbove',
        'onMoveUp', 'onMoveDown', 'onDuplicate', 'onDelete', 'onToggleNote',
    ]);

    const stripForPersistence = React.useCallback((rawNodes: Node[], rawEdges: Edge[]) => {
        const cleanNodes = rawNodes.map(({ id, type, position, data }) => {
            const cleanData: Record<string, unknown> = {};
            if (data) {
                for (const [k, v] of Object.entries(data)) {
                    if (!RUNTIME_DATA_KEYS.has(k) && typeof v !== 'function') {
                        cleanData[k] = v;
                    }
                }
            }
            return { id, type, position, data: cleanData };
        });
        const cleanEdges = rawEdges.map(({ id, source, target, sourceHandle, targetHandle, type: edgeType }) => ({
            id, source, target, sourceHandle, targetHandle, type: edgeType,
        }));
        return { cleanNodes, cleanEdges };
    }, []);

    React.useEffect(() => {
        const stateString = JSON.stringify({ nodes, edges });
        if (stateString === lastEmittedRef.current) return;

        const timeout = setTimeout(() => {
            const { cleanNodes, cleanEdges } = stripForPersistence(nodes, edges);
            onStateChange(cleanNodes, cleanEdges);
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
    }, [nodes, edges, onStateChange, pushHistory, stripForPersistence]);

    // --- Downstream helpers ---
    const getDownstreamNodeIds = React.useCallback((startNodeId: string): string[] => {
        const visited = new Set<string>();
        const queue = [startNodeId];
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            edges.forEach(e => {
                if (e.source === current && !visited.has(e.target)) {
                    queue.push(e.target);
                }
            });
        }
        visited.delete(startNodeId); // Don't include the start node itself
        return Array.from(visited);
    }, [edges]);

    // --- Delete functions ---
    const deleteNodeById = React.useCallback((nodeId: string) => {
        setEdges(eds => eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
        setNodes(nds => nds.filter(n => n.id !== nodeId));
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
    }, [selectedNodeId, setEdges, setNodes]);

    const deleteNodeWithDownstream = React.useCallback((nodeId: string) => {
        const downstreamIds = getDownstreamNodeIds(nodeId);
        const allIds = new Set([nodeId, ...downstreamIds]);
        setEdges(eds => eds.filter(edge => !allIds.has(edge.source) && !allIds.has(edge.target)));
        setNodes(nds => nds.filter(n => !allIds.has(n.id)));
        if (allIds.has(selectedNodeId || '')) setSelectedNodeId(null);
    }, [selectedNodeId, setEdges, setNodes, getDownstreamNodeIds]);

    // --- Clone helpers ---
    const makeClonedNode = React.useCallback((sourceNode: Node, offsetX = 30, offsetY = 140): Node => {
        return {
            id: `${sourceNode.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: sourceNode.type!,
            position: {
                x: sourceNode.position.x + offsetX,
                y: sourceNode.position.y + offsetY,
            },
            data: {
                ...JSON.parse(JSON.stringify(sourceNode.data)),
                label: `${sourceNode.data.label || 'Step'} (copy)`,
                onAddStep: undefined,
                onFilterDiagnostics: undefined,
                executionStatus: undefined,
                executionError: undefined,
                executionMeta: undefined,
                isDefaultConnected: undefined,
                isTrueConnected: undefined,
                isFalseConnected: undefined,
            },
        };
    }, []);

    const cloneNode = React.useCallback((nodeId: string) => {
        const sourceNode = nodes.find(n => n.id === nodeId);
        if (!sourceNode || sourceNode.type === 'triggerNode') return;

        const clonedNode = makeClonedNode(sourceNode);
        setNodes(nds => [...nds, clonedNode]);

        const outgoingEdges = edges.filter(e => e.source === nodeId);
        if (outgoingEdges.length === 1 && !outgoingEdges[0].sourceHandle) {
            const downstream = outgoingEdges[0];
            setEdges(eds => [
                ...eds.filter(e => e.id !== downstream.id),
                {
                    id: `edge_${nodeId}_to_${clonedNode.id}_${Date.now()}`,
                    source: nodeId,
                    target: clonedNode.id,
                    type: 'deletable',
                    animated: false,
                    data: { onDelete: deleteEdge },
                },
                {
                    id: `edge_${clonedNode.id}_to_${downstream.target}_${Date.now()}`,
                    source: clonedNode.id,
                    target: downstream.target,
                    type: 'deletable',
                    animated: false,
                    data: { onDelete: deleteEdge },
                },
            ]);
            setNodes(nds => nds.map(n => {
                if (n.id !== nodeId && n.id !== clonedNode.id && n.position.y >= sourceNode.position.y + 100) {
                    return { ...n, position: { ...n.position, y: n.position.y + 140 } };
                }
                return n;
            }));
        } else if (outgoingEdges.length === 0) {
            setEdges(eds => [
                ...eds,
                {
                    id: `edge_${nodeId}_to_${clonedNode.id}_${Date.now()}`,
                    source: nodeId,
                    target: clonedNode.id,
                    type: 'deletable',
                    animated: false,
                    data: { onDelete: deleteEdge },
                },
            ]);
        }
        setSelectedNodeId(clonedNode.id);
    }, [nodes, edges, setNodes, setEdges, deleteEdge, makeClonedNode]);

    // --- Move Up / Down ---
    const moveNodeUp = React.useCallback((nodeId: string) => {
        // Find the incoming edge to this node
        const incomingEdge = edges.find(e => e.target === nodeId && !e.sourceHandle);
        if (!incomingEdge) return; // Already at top or branched

        const parentId = incomingEdge.source;
        const parentNode = nodes.find(n => n.id === parentId);
        const currentNode = nodes.find(n => n.id === nodeId);
        if (!parentNode || !currentNode) return;
        // Don't swap with trigger nodes
        if (parentNode.type === 'triggerNode') return;

        // Find grandparent edge (incoming to parent)
        const grandparentEdge = edges.find(e => e.target === parentId);
        // Find child edge (outgoing from current node, non-branched)
        const childEdge = edges.find(e => e.source === nodeId && !e.sourceHandle);

        // Swap positions
        setNodes(nds => nds.map(n => {
            if (n.id === nodeId) return { ...n, position: { ...parentNode.position } };
            if (n.id === parentId) return { ...n, position: { ...currentNode.position } };
            return n;
        }));

        // Re-wire edges
        setEdges(eds => {
            let updated = eds.filter(e => e.id !== incomingEdge.id); // remove old parent→node

            // grandparent → node (was grandparent → parent)
            if (grandparentEdge) {
                updated = updated.map(e =>
                    e.id === grandparentEdge.id ? { ...e, target: nodeId } : e
                );
            }

            // node → parent (new edge)
            updated.push({
                id: `edge_${nodeId}_to_${parentId}_${Date.now()}`,
                source: nodeId,
                target: parentId,
                type: 'deletable',
                animated: false,
                data: { onDelete: deleteEdge },
            });

            // parent → child (was node → child)
            if (childEdge) {
                updated = updated.map(e =>
                    e.id === childEdge.id ? { ...e, source: parentId } : e
                );
            }

            return updated;
        });
    }, [nodes, edges, setNodes, setEdges, deleteEdge]);

    const moveNodeDown = React.useCallback((nodeId: string) => {
        // Find the outgoing edge from this node (non-branched)
        const outgoingEdge = edges.find(e => e.source === nodeId && !e.sourceHandle);
        if (!outgoingEdge) return; // Already at bottom or branched

        const childId = outgoingEdge.target;
        const childNode = nodes.find(n => n.id === childId);
        const currentNode = nodes.find(n => n.id === nodeId);
        if (!childNode || !currentNode) return;

        // Find incoming edge to current (parent edge)
        const parentEdge = edges.find(e => e.target === nodeId);
        // Find grandchild edge (outgoing from child)
        const grandchildEdge = edges.find(e => e.source === childId && !e.sourceHandle);

        // Swap positions
        setNodes(nds => nds.map(n => {
            if (n.id === nodeId) return { ...n, position: { ...childNode.position } };
            if (n.id === childId) return { ...n, position: { ...currentNode.position } };
            return n;
        }));

        // Re-wire edges
        setEdges(eds => {
            let updated = eds.filter(e => e.id !== outgoingEdge.id); // remove old node→child

            // parent → child (was parent → node)
            if (parentEdge) {
                updated = updated.map(e =>
                    e.id === parentEdge.id ? { ...e, target: childId } : e
                );
            }

            // child → node (new edge)
            updated.push({
                id: `edge_${childId}_to_${nodeId}_${Date.now()}`,
                source: childId,
                target: nodeId,
                type: 'deletable',
                animated: false,
                data: { onDelete: deleteEdge },
            });

            // node → grandchild (was child → grandchild)
            if (grandchildEdge) {
                updated = updated.map(e =>
                    e.id === grandchildEdge.id ? { ...e, source: nodeId } : e
                );
            }

            return updated;
        });
    }, [nodes, edges, setNodes, setEdges, deleteEdge]);

    const cloneNodeWithDownstream = React.useCallback((nodeId: string) => {
        const sourceNode = nodes.find(n => n.id === nodeId);
        if (!sourceNode || sourceNode.type === 'triggerNode') return;

        // Gather all downstream nodes
        const downstreamIds = getDownstreamNodeIds(nodeId);
        const allSourceIds = [nodeId, ...downstreamIds];
        const sourceNodes = allSourceIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as Node[];

        // Create clones with an ID mapping (old -> new)
        const idMap = new Map<string, string>();
        const clonedNodes: Node[] = sourceNodes.map((sn, idx) => {
            const clone = makeClonedNode(sn, 250, idx * 10);
            idMap.set(sn.id, clone.id);
            return clone;
        });

        // Clone internal edges (edges between the source nodes)
        const internalEdges = edges.filter(e => allSourceIds.includes(e.source) && allSourceIds.includes(e.target));
        const clonedEdges: Edge[] = internalEdges.map(e => ({
            id: `edge_${idMap.get(e.source)}_to_${idMap.get(e.target)}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            source: idMap.get(e.source)!,
            sourceHandle: e.sourceHandle,
            target: idMap.get(e.target)!,
            type: 'deletable',
            animated: false,
            data: { onDelete: deleteEdge },
        }));

        setNodes(nds => [...nds, ...clonedNodes]);
        setEdges(eds => [...eds, ...clonedEdges]);
        setSelectedNodeId(idMap.get(nodeId) || null);
    }, [nodes, edges, setNodes, setEdges, deleteEdge, getDownstreamNodeIds, makeClonedNode]);

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
            case 'abSplitNode': label = 'A/B Split'; break;
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

        // Check if we're in "insert above" mode
        const insertAboveId = insertAboveRef.current;
        insertAboveRef.current = null; // clear immediately

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
            } else if (!sourceHandle && parentNode.type === 'abSplitNode') {
                const hasAEdge = edges.some(e => e.source === parentNode.id && e.sourceHandle === 'a');
                if (!hasAEdge) {
                    sourceHandle = 'a';
                } else {
                    sourceHandle = 'b';
                }
            }

            if (sourceHandle === 'true' || sourceHandle === 'a') {
                targetX -= 120;
            } else if (sourceHandle === 'false' || sourceHandle === 'b') {
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

        // If inserting above a specific node, position above it and push it down
        if (insertAboveId) {
            const belowNode = nodes.find(n => n.id === insertAboveId);
            if (belowNode) {
                x = belowNode.position.x;
                y = belowNode.position.y;
                // Push the target node and its downstream nodes down
                const downstreamIds = getDownstreamNodeIds(insertAboveId);
                const pushIds = new Set([insertAboveId, ...downstreamIds]);
                setNodes(nds => nds.map(n =>
                    pushIds.has(n.id) ? { ...n, position: { ...n.position, y: n.position.y + 140 } } : n
                ));
            }
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
        if (item.actionType === 'SEND_MESSAGE' || item.actionType === 'DIRECT_EMAIL' || item.actionType === 'DIRECT_SMS') {
            data.config.channel = item.channel || (item.actionType === 'DIRECT_SMS' ? 'sms' : 'email');
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

        // Handle insert-above wiring: parent→NEW→target (was parent→target)
        if (insertAboveId && nodeType !== 'triggerNode') {
            const incomingEdge = edges.find(e => e.target === insertAboveId);
            setEdges(eds => {
                let updated = [...eds];
                // Re-wire incoming edge to point to new node
                if (incomingEdge) {
                    updated = updated.map(e =>
                        e.id === incomingEdge.id ? { ...e, target: id } : e
                    );
                }
                // Add new edge from new node → target
                updated.push({
                    id: `edge_${id}_to_${insertAboveId}_${Date.now()}`,
                    source: id,
                    target: insertAboveId,
                    type: 'deletable',
                    animated: false,
                    data: { onDelete: deleteEdge },
                });
                return updated;
            });
        } else if (parentNode && nodeType !== 'triggerNode') {
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

    // --- Note editing state ---
    const [noteDialogNodeId, setNoteDialogNodeId] = React.useState<string | null>(null);
    const [noteDialogValue, setNoteDialogValue] = React.useState('');

    const handleUpdateNote = React.useCallback((nodeId: string, noteText: string) => {
        setNodes(nds => nds.map(n =>
            n.id === nodeId ? { ...n, data: { ...n.data, note: noteText } } : n
        ));
    }, [setNodes]);

    const nodesWithCallbacks = React.useMemo(() => {
        const stepMap = selectedRun?.steps || {};

        // Sort non-trigger nodes by Y, then X position
        const sortedNonTriggerNodes = nodes
            .filter(n => n.type !== 'triggerNode')
            .sort((a, b) => {
                const ay = a.position?.y ?? 0;
                const by = b.position?.y ?? 0;
                const ax = a.position?.x ?? 0;
                const bx = b.position?.x ?? 0;
                if (Math.abs(ay - by) < 5) {
                    return ax - bx;
                }
                return ay - by;
            });

        // Create a map from nodeId to 1-based index (step number)
        const stepNumberMap = new Map<string, number>();
        sortedNonTriggerNodes.forEach((node, index) => {
            stepNumberMap.set(node.id, index + 1);
        });

        return nodes.map(node => {
            const stepNumber = stepNumberMap.get(node.id) || null;
            const hasTrueConnection = edges.some(e => e.source === node.id && e.sourceHandle === 'true');
            const hasFalseConnection = edges.some(e => e.source === node.id && e.sourceHandle === 'false');
            const hasAConnection = edges.some(e => e.source === node.id && e.sourceHandle === 'a');
            const hasBConnection = edges.some(e => e.source === node.id && e.sourceHandle === 'b');
            const hasDefaultConnection = edges.some(e => e.source === node.id && (!e.sourceHandle || e.sourceHandle === 'default' || e.sourceHandle === ''));
            const stepData = stepMap[node.id];

            // Toolbar state
            const isTrigger = node.type === 'triggerNode';
            const canMoveUp = !isTrigger && edges.some(e =>
                e.target === node.id && !e.sourceHandle &&
                nodes.find(n => n.id === e.source)?.type !== 'triggerNode'
            );
            const canMoveDown = !isTrigger && edges.some(e =>
                e.source === node.id && !e.sourceHandle
            );

            return {
                ...node,
                data: {
                    ...node.data,
                    stepNumber,
                    isDefaultConnected: hasDefaultConnection,
                    isTrueConnected: node.type === 'abSplitNode' ? hasAConnection : hasTrueConnection,
                    isFalseConnected: node.type === 'abSplitNode' ? hasBConnection : hasFalseConnection,
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
                    },
                    // Toolbar action callbacks
                    canMoveUp,
                    canMoveDown,
                    hasNote: !!node.data?.note,
                    onAddAbove: () => {
                        insertAboveRef.current = node.id;
                        setSelectedNodeId(node.id);
                        setIsLibraryOpen(true);
                    },
                    onMoveUp: () => moveNodeUp(node.id),
                    onMoveDown: () => moveNodeDown(node.id),
                    onDuplicate: () => setStepActionDialog({ action: 'clone', nodeId: node.id }),
                    onDelete: () => setStepActionDialog({ action: 'delete', nodeId: node.id }),
                    onToggleNote: () => {
                        setNoteDialogNodeId(node.id);
                        setNoteDialogValue(node.data?.note || '');
                    },
                }
            };
        });
    }, [nodes, edges, selectedRun, moveNodeUp, moveNodeDown]);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    // --- Group drag handlers ---
    const onNodeDragStart = React.useCallback((_event: React.MouseEvent, node: Node) => {
        const downstreamIds = getDownstreamNodeIds(node.id);
        if (downstreamIds.length === 0) {
            dragStartRef.current = null;
            return;
        }
        const downstreamPositions = new Map<string, { x: number; y: number }>();
        nodes.forEach(n => {
            if (downstreamIds.includes(n.id)) {
                downstreamPositions.set(n.id, { x: n.position.x, y: n.position.y });
            }
        });
        dragStartRef.current = {
            draggedNodeId: node.id,
            startPos: { x: node.position.x, y: node.position.y },
            downstreamPositions,
        };
    }, [nodes, getDownstreamNodeIds]);

    const onNodeDragStop = React.useCallback(() => {
        dragStartRef.current = null;
    }, []);

    // Wrap onNodesChange so downstream nodes move in the exact same batch
    const handleNodesChange = React.useCallback((changes: NodeChange[]) => {
        if (!dragStartRef.current) {
            onNodesChange(changes);
            return;
        }

        const { draggedNodeId, startPos, downstreamPositions } = dragStartRef.current;

        // Find the position change for the dragged node
        const dragChange = changes.find(
            (c): c is NodeChange & { type: 'position'; id: string; position?: { x: number; y: number }; dragging?: boolean } =>
                c.type === 'position' && 'id' in c && (c as any).id === draggedNodeId && !!(c as any).position
        );

        if (!dragChange || !dragChange.position) {
            onNodesChange(changes);
            return;
        }

        // Calculate delta from drag start
        const dx = dragChange.position.x - startPos.x;
        const dy = dragChange.position.y - startPos.y;

        // Build position changes for all downstream nodes
        const downstreamChanges: NodeChange[] = [];
        downstreamPositions.forEach((origPos, nodeId) => {
            downstreamChanges.push({
                type: 'position',
                id: nodeId,
                position: { x: origPos.x + dx, y: origPos.y + dy },
            } as NodeChange);
        });

        // Apply all changes in one batch: original changes + downstream
        onNodesChange([...changes, ...downstreamChanges]);
    }, [onNodesChange]);

    return (
        <div className={cn(
            "h-full w-full bg-background relative group/builder",
            isFullScreen && "fixed inset-0 z-[100] bg-background"
        )}>
            <ReactFlow
                nodes={nodesWithCallbacks}
                edges={edgesWithCallbacks}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeUpdate={onEdgeUpdate}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={(e, node) => { setContextMenu(null); onNodeClick(e, node); }}
                onEdgeClick={(e, edge) => { setContextMenu(null); onEdgeClick(e, edge); }}
                onPaneClick={() => { setContextMenu(null); onPaneClick(); }}
                onNodeContextMenu={(e, node) => {
                    e.preventDefault();
                    if (node.type === 'triggerNode') return;
                    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
                    setSelectedNodeId(node.id);
                }}
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

            {/* Right-click context menu (ActiveCampaign style) */}
            {contextMenu && (() => {
                const cmNodeId = contextMenu.nodeId;
                const canMoveUp = !!edges.find(e => e.target === cmNodeId && !e.sourceHandle && nodes.find(n => n.id === e.source)?.type !== 'triggerNode');
                const canMoveDown = !!edges.find(e => e.source === cmNodeId && !e.sourceHandle);
                return (
                    <div
                        className="fixed z-[200] animate-in fade-in zoom-in-95 duration-150"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <div className="bg-card/98 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl py-1.5 min-w-[200px] ring-1 ring-black/5">
                            {/* Add step section */}
                            <button
                                type="button"
                                onClick={() => {
                                    insertAboveRef.current = cmNodeId;
                                    setSelectedNodeId(cmNodeId);
                                    setIsLibraryOpen(true);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Step Above
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    insertAboveRef.current = null;
                                    setSelectedNodeId(cmNodeId);
                                    setLibrarySourceHandle(undefined);
                                    setIsLibraryOpen(true);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Step Below
                            </button>

                            <div className="h-px bg-border/50 mx-2 my-1" />

                            {/* Move section */}
                            <button
                                type="button"
                                disabled={!canMoveUp}
                                onClick={() => {
                                    moveNodeUp(cmNodeId);
                                    setContextMenu(null);
                                }}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-left transition-colors",
                                    canMoveUp ? "text-foreground hover:bg-muted/60" : "text-muted-foreground/40 cursor-not-allowed"
                                )}
                            >
                                <ArrowUp className="h-3.5 w-3.5" />
                                Move Step Up
                            </button>
                            <button
                                type="button"
                                disabled={!canMoveDown}
                                onClick={() => {
                                    moveNodeDown(cmNodeId);
                                    setContextMenu(null);
                                }}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-left transition-colors",
                                    canMoveDown ? "text-foreground hover:bg-muted/60" : "text-muted-foreground/40 cursor-not-allowed"
                                )}
                            >
                                <ArrowDown className="h-3.5 w-3.5" />
                                Move Step Down
                            </button>

                            <div className="h-px bg-border/50 mx-2 my-1" />

                            {/* Duplicate / Delete section */}
                            <button
                                type="button"
                                onClick={() => {
                                    setStepActionDialog({ action: 'clone', nodeId: cmNodeId });
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Duplicate Step
                                <span className="ml-auto text-[9px] text-muted-foreground font-mono">{navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+D</span>
                            </button>
                            <div className="h-px bg-border/50 mx-2 my-1" />
                            <button
                                type="button"
                                onClick={() => {
                                    setStepActionDialog({ action: 'delete', nodeId: cmNodeId });
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors text-left"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Step
                                <span className="ml-auto text-[9px] text-muted-foreground font-mono">⌫</span>
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Click-away listener for context menu */}
            {contextMenu && (
                <div
                    className="fixed inset-0 z-[199]"
                    onClick={() => setContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                />
            )}

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
                            <div className="flex items-center gap-1">
                                {/* Duplicate button (ActiveCampaign style) */}
                                {selectedNode && selectedNode.type !== 'triggerNode' && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => setStepActionDialog({ action: 'clone', nodeId: selectedNode.id })}
                                                    className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-[10px]">
                                                Duplicate Step ({navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+D)
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                                {/* Delete button */}
                                {selectedNode && selectedNode.type !== 'triggerNode' && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => setStepActionDialog({ action: 'delete', nodeId: selectedNode.id })}
                                                    className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-[10px]">
                                                Delete Step
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
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

            {/* Note Editing Dialog */}
            <Dialog open={!!noteDialogNodeId} onOpenChange={(open) => { if (!open) setNoteDialogNodeId(null); }}>
                <DialogContent className="rounded-3xl max-w-sm border border-border/20 shadow-2xl p-0 bg-background/95 backdrop-blur-md overflow-hidden">
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-400/80 via-amber-500 to-amber-400/80" />
                    <div className="px-6 pt-4 pb-2">
                        <DialogHeader className="text-left space-y-2">
                            <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-amber-500/10">
                                    <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                                </div>
                                Step Note
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                                Add a note or comment to this step for your team.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="px-6 pb-5 space-y-3">
                        <textarea
                            value={noteDialogValue}
                            onChange={(e) => setNoteDialogValue(e.target.value)}
                            placeholder="e.g. This step sends the welcome email after 24h..."
                            className="w-full min-h-[100px] rounded-xl border-2 border-border/40 bg-muted/30 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 focus:outline-none resize-none transition-all"
                            autoFocus
                        />
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => {
                                    if (noteDialogNodeId) {
                                        handleUpdateNote(noteDialogNodeId, noteDialogValue.trim());
                                    }
                                    setNoteDialogNodeId(null);
                                }}
                                className="flex-1 h-9 rounded-xl text-xs bg-amber-500 hover:bg-amber-600 text-white"
                            >
                                Save Note
                            </Button>
                            {noteDialogValue && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (noteDialogNodeId) {
                                            handleUpdateNote(noteDialogNodeId, '');
                                        }
                                        setNoteDialogNodeId(null);
                                    }}
                                    className="h-9 rounded-xl text-xs text-destructive hover:text-destructive"
                                >
                                    Clear
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                onClick={() => setNoteDialogNodeId(null)}
                                className="h-9 rounded-xl text-xs text-muted-foreground"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Step Action Confirmation Dialog (Clone / Delete) */}
            {(() => {
                const actionNode = stepActionDialog ? nodes.find(n => n.id === stepActionDialog.nodeId) : null;
                const downstreamCount = stepActionDialog ? getDownstreamNodeIds(stepActionDialog.nodeId).length : 0;
                const isClone = stepActionDialog?.action === 'clone';
                const actionLabel = isClone ? 'Duplicate' : 'Delete';
                const actionNodeLabel = actionNode?.data?.label || actionNode?.data?.actionType?.replace(/_/g, ' ') || 'Step';

                return (
                    <Dialog open={!!stepActionDialog} onOpenChange={(open) => { if (!open) setStepActionDialog(null); }}>
                        <DialogContent className="rounded-3xl max-w-sm border border-border/20 shadow-2xl p-0 bg-background/95 backdrop-blur-md overflow-hidden">
                            {/* Header accent */}
                            <div className={cn(
                                "h-1.5 w-full",
                                isClone ? "bg-gradient-to-r from-primary/80 via-primary to-primary/80" : "bg-gradient-to-r from-destructive/80 via-destructive to-destructive/80"
                            )} />

                            <div className="px-6 pt-4 pb-2">
                                <DialogHeader className="text-left space-y-2">
                                    <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                        {isClone ? (
                                            <div className="p-1.5 rounded-lg bg-primary/10"><Copy className="h-3.5 w-3.5 text-primary" /></div>
                                        ) : (
                                            <div className="p-1.5 rounded-lg bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></div>
                                        )}
                                        {actionLabel} Step
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                                        How would you like to {isClone ? 'duplicate' : 'delete'} <span className="font-semibold text-foreground">&ldquo;{actionNodeLabel}&rdquo;</span>?
                                        {downstreamCount > 0 && (
                                            <span className="block mt-1.5 text-[10px] text-muted-foreground/80">
                                                This step has <span className="font-bold text-foreground">{downstreamCount}</span> downstream {downstreamCount === 1 ? 'step' : 'steps'} connected below it.
                                            </span>
                                        )}
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <div className="px-6 pb-5 space-y-2">
                                {/* Option 1: This step only */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!stepActionDialog) return;
                                        if (isClone) cloneNode(stepActionDialog.nodeId);
                                        else deleteNodeById(stepActionDialog.nodeId);
                                        setStepActionDialog(null);
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all group/opt",
                                        isClone
                                            ? "border-primary/20 hover:border-primary/50 hover:bg-primary/5"
                                            : "border-destructive/20 hover:border-destructive/50 hover:bg-destructive/5"
                                    )}
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg shrink-0 transition-colors",
                                        isClone ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                                    )}>
                                        {isClone ? <Copy className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-foreground">{actionLabel} this step only</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {isClone ? 'Creates a copy of only this step' : 'Removes only this step, keeps downstream steps'}
                                        </p>
                                    </div>
                                </button>

                                {/* Option 2: This step + downstream (only show when downstream exists) */}
                                {downstreamCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!stepActionDialog) return;
                                            if (isClone) cloneNodeWithDownstream(stepActionDialog.nodeId);
                                            else deleteNodeWithDownstream(stepActionDialog.nodeId);
                                            setStepActionDialog(null);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all group/opt",
                                            isClone
                                                ? "border-primary/20 hover:border-primary/50 hover:bg-primary/5"
                                                : "border-destructive/20 hover:border-destructive/50 hover:bg-destructive/5"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-2 rounded-lg shrink-0 transition-colors",
                                            isClone ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                                        )}>
                                            <Layers className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground">
                                                {actionLabel} this step + {downstreamCount} downstream {downstreamCount === 1 ? 'step' : 'steps'}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {isClone
                                                    ? 'Duplicates this step and all steps connected below it'
                                                    : 'Removes this step and everything connected below it'
                                                }
                                            </p>
                                        </div>
                                    </button>
                                )}

                                {/* Cancel */}
                                <DialogFooter className="pt-2">
                                    <Button
                                        variant="ghost"
                                        className="w-full h-9 rounded-xl text-xs text-muted-foreground"
                                        onClick={() => setStepActionDialog(null)}
                                    >
                                        Cancel
                                    </Button>
                                </DialogFooter>
                            </div>
                        </DialogContent>
                    </Dialog>
                );
            })()}

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
                        <DialogContent className="rounded-3xl max-w-md border border-border/20 shadow-2xl p-6 bg-background/95 backdrop-blur-md">
                            <DialogHeader className="text-left space-y-2">
                                <DialogTitle className="text-sm font-bold text-foreground">Unsaved Inspector Changes</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                                    You have unsaved changes in the Logic Inspector. Would you like to save and apply them or discard them before exiting?
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex items-center gap-2.5 py-3">
                                <Checkbox
                                    id="skipConfirmCheckbox"
                                    checked={skipConfirm}
                                    onCheckedChange={(val) => {
                                        const isChecked = !!val;
                                        setSkipConfirm(isChecked);
                                        localStorage.setItem('skipInspectorConfirmations', String(isChecked));
                                    }}
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

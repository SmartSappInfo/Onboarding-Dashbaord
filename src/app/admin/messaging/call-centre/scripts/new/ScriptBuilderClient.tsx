'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { 
  createCallScriptAction, 
  updateCallScriptAction, 
  getCallScriptAction,
  generateCallScriptAction,
  refineCallScriptAction,
  executeScriptActionAction,
  executeOutcomeAutomationsAction
} from '@/lib/call-centre-actions';
import { isJsonGraph, parseGraph, validateScriptGraph, extractPreviewText, resolveScriptVariables } from '@/lib/call-centre-graph';
import { cloneSingleNode, cloneSubtree, getDescendantNodeIds } from '@/lib/call-centre-cloning';
import { pushHistoryState, type HistoryState } from '@/lib/call-centre-history';
import { getActionMeta } from '@/lib/call-action-types';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Save, 
  Sparkles, 
  RefreshCw,
  FileText,
  X,
  Wand2,
  GitBranch,
  Play,
  List,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Pencil,
  Check,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  XCircle,
  StopCircle,
  MessageSquare,
  HelpCircle,
  Zap,
  Layers,
  Trash2,
  Copy,
  Undo2,
  Redo2
} from 'lucide-react';
import { EntityCombobox } from '@/components/entities/EntityCombobox';
import type { SearchedEntity } from '@/hooks/use-entity-search';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { Node, Edge, NodeChange } from 'reactflow';
import { addEdge, useNodesState, useEdgesState } from 'reactflow';
import { ScriptPlaybookView } from '../components/ScriptPlaybookView';
import { LegacyScriptEditor } from '../components/LegacyScriptEditor';
import type { LegacyScriptEditorHandle, VariableGroup } from '../components/LegacyScriptEditor';
import { ScriptBodyDisplay } from '../components/ScriptBodyDisplay';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { cn, stripHtml } from '@/lib/utils';
import type { ScriptNode, ScriptEdge, ScriptNodeType, EntityContact, Entity, CallActionParams } from '@/lib/types';
import type { VisualScriptCanvasHandle, VisualScriptCanvasProps } from '../components/VisualScriptCanvas';
import { ActionNodeConfigPanel } from '../components/ActionNodeConfigPanel';
import type { ActionConfigDataSources } from '../components/ActionConfigFields';
import { Skeleton } from '@/components/ui/skeleton';
import { MEETING_TYPES } from '@/lib/types';

interface SimulatedContact extends EntityContact {
  role?: string;
}

// Lazy load the heavy outcome automations editor to keep the canvas bundle lean
// vercel-react: bundle-dynamic-imports
const OutcomeAutomationsEditor = dynamic(
  () => import('../components/OutcomeAutomationsEditor').then(mod => mod.OutcomeAutomationsEditor),
  { ssr: false, loading: () => <Skeleton className="h-24 w-full rounded-xl" /> }
);

// Lazy load the ReactFlow canvas to optimize initial bundle sizes
const VisualScriptCanvas = dynamic(
  () => import('../components/VisualScriptCanvas').then(mod => mod.VisualScriptCanvas),
  { ssr: false, loading: () => <div className="h-[550px] bg-muted/20 border border-border rounded-2xl flex items-center justify-center text-muted-foreground">Loading Flow Canvas...</div> }
) as React.ForwardRefExoticComponent<
  VisualScriptCanvasProps & React.RefAttributes<VisualScriptCanvasHandle>
>;

const InteractiveScriptView = dynamic(
  () => import('../components/InteractiveScriptView').then(mod => mod.InteractiveScriptView),
  { ssr: false, loading: () => <div className="h-[550px] bg-muted/20 border border-border rounded-2xl flex items-center justify-center text-muted-foreground">Loading Interactive View...</div> }
);

// ─── Script variable name constants (module scope) ────────────────────────────
const NATIVE_ENTITY_VAR_NAMES = [
  'ENTITY_NAME', 'ENTITY_TYPE',
  'PRIMARY_CONTACT_NAME', 'PRIMARY_CONTACT_PHONE',
  'CURRENT_CONTACT_NAME', 'CURRENT_CONTACT_PHONE', 'CURRENT_CONTACT_EMAIL',
  'AGENT_NAME',
  'STATUS', 'LOCATION', 'CURRENT_NEEDS', 'CURRENT_CHALLENGES',
  'INITIALS', 'SLOGAN', 'CAPACITY', 'CURRENCY', 'SUBSCRIPTION_RATE',
  'WEBSITE', 'DIGITAL_ADDRESS', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM',
  'LINKEDIN', 'X_TWITTER', 'YOUTUBE', 'TIKTOK',
  'LAST_NAME', 'COMPANY', 'JOB_TITLE', 'LEAD_SOURCE',
];

const NATIVE_DEAL_VAR_NAMES = [
  'DEAL_NAME', 'DEAL_VALUE', 'DEAL_STAGE', 'DEAL_STATUS', 'DEAL_EXPECTED_CLOSE',
];

interface ScriptBuilderClientProps {
  scriptId?: string;
  returnCampaignId?: string;
}

// ─── Module-scope node layout constants ──────────────────────────────────────
// Pixel width of every canvas node (must stay in sync with NODE_W in VisualScriptCanvas)
const NODE_PX_W = 220;
// Estimated rendered height per node type — used only for vertical spacing.
// These are conservative upper-bounds so inserted children never overlap.
const NODE_APPROX_H: Record<string, number> = {
  start: 90,
  end: 80,
  script_block: 130,
  question: 150,
  objection: 140,
  action: 120,
};
// Vertical gap (px) between the bottom of the parent and the top of the child
const VERTICAL_GAP = 80;

/**
 * Returns the primary source handle id for a given node type.
 * • question  → option-0  (the first/Yes branch — user can re-wire others manually)
 * • objection → "handled" (the resolved exit)
 * • all others → null     (single default bottom handle)
 */
function getPrimarySourceHandle(
  type: string,
  data: Record<string, unknown>
): string | null {
  if (type === 'question') {
    // Validate options exist; regardless, wire to the first option index
    void (data.options as string[] | undefined);
    return 'option-0';
  }
  if (type === 'objection') return 'handled';
  return null;
}

export function ScriptBuilderClient({ scriptId, returnCampaignId }: ScriptBuilderClientProps) {
  const router = useRouter();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
  const firestore = useFirestore();
  const { toast } = useToast();

  const confirm = useConfirm();
  const [isListViewPreviewMode, setIsListViewPreviewMode] = React.useState(false);

  const [name, setName] = React.useState('Untitled Script');
  const [description, setDescription] = React.useState('Script Description Here');
  useSetBreadcrumb(scriptId ? `Edit Script: ${name}` : 'New Script');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [isEditingDesc, setIsEditingDesc] = React.useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = React.useState(false);
  const [toolbarExpanded, setToolbarExpanded] = React.useState(false);
  
  // Editor tabs: 'flow' (visual), 'list' (split view), 'interactive', 'text' (legacy raw text)
  const [editorTab, setEditorTab] = React.useState<'flow' | 'list' | 'interactive' | 'text'>('flow');
  const [listViewCategory, setListViewCategory] = React.useState<'say' | 'ask' | 'objections' | 'actions' | 'outcomes'>('say');

  // Branching graph state
  const [nodes, setNodes, _onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = React.useState(false);
  const [nodeToClone, setNodeToClone] = React.useState<Node | null>(null);

  // Legacy fallback text state
  const [legacyText, setLegacyText] = React.useState('');
  
  // Ref to track if DB loading/seeding is complete to enable autosaving changes
  const hasLoadedRef = React.useRef(false);

  // History Manager States and Refs
  const historyRef = React.useRef<HistoryState[]>([]);
  const pointerRef = React.useRef<number>(-1);
  const isUndoingRedoingRef = React.useRef<boolean>(false);
  const isTabSwitchingRef = React.useRef<boolean>(false);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const [historyPointer, setHistoryPointer] = React.useState(-1);
  const [isHistoryInitialized, setIsHistoryInitialized] = React.useState(false);

  // Derived selectors for Undo/Redo button states
  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < historyRef.current.length - 1;

  // Step Deletion Choice States
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [nodeToDelete, setNodeToDelete] = React.useState<Node | null>(null);
  const [isInsertNodeDialogOpen, setIsInsertNodeDialogOpen] = React.useState(false);
  const [activeInsertEdgeId, setActiveInsertEdgeId] = React.useState<string | null>(null);

  const pushHistory = React.useCallback((state: HistoryState, immediate = false) => {
    if (isUndoingRedoingRef.current || isTabSwitchingRef.current) return;

    // Verify deep equality with current history pointer state to avoid duplicate writes
    const currentState = historyRef.current[pointerRef.current];
    if (currentState) {
      const nodesMatch = JSON.stringify(currentState.nodes) === JSON.stringify(state.nodes);
      const edgesMatch = JSON.stringify(currentState.edges) === JSON.stringify(state.edges);
      const textMatch = currentState.legacyText === state.legacyText;
      if (nodesMatch && edgesMatch && textMatch) {
        return;
      }
    }

    const executePush = () => {
      const { history, pointer } = pushHistoryState(
        historyRef.current,
        pointerRef.current,
        state
      );
      historyRef.current = history;
      pointerRef.current = pointer;
      setHistoryPointer(pointer);
    };

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (immediate) {
      executePush();
    } else {
      debounceTimerRef.current = setTimeout(() => {
        executePush();
      }, 500);
    }
  }, []);

  const handleUndo = React.useCallback(() => {
    if (pointerRef.current > 0) {
      isUndoingRedoingRef.current = true;
      pointerRef.current -= 1;
      
      const previousState = historyRef.current[pointerRef.current];
      if (previousState) {
        React.startTransition(() => {
          setNodes(previousState.nodes);
          setEdges(previousState.edges);
          setLegacyText(previousState.legacyText);
          setHistoryPointer(pointerRef.current);
        });
      }
      
      toast({ title: 'Undo', description: 'Reverted last change.', duration: 1500 });
    }
  }, [setNodes, setEdges, setLegacyText, toast]);

  const handleRedo = React.useCallback(() => {
    if (pointerRef.current < historyRef.current.length - 1) {
      isUndoingRedoingRef.current = true;
      pointerRef.current += 1;
      
      const nextState = historyRef.current[pointerRef.current];
      if (nextState) {
        React.startTransition(() => {
          setNodes(nextState.nodes);
          setEdges(nextState.edges);
          setLegacyText(nextState.legacyText);
          setHistoryPointer(pointerRef.current);
        });
      }
      
      toast({ title: 'Redo', description: 'Applied next change.', duration: 1500 });
    }
  }, [setNodes, setEdges, setLegacyText, toast]);

  // Initialize history stack with current loaded state once DB load completes
  React.useEffect(() => {
    if (!hasLoadedRef.current || isHistoryInitialized) return;
    
    const initialState: HistoryState = { nodes, edges, legacyText };
    historyRef.current = [JSON.parse(JSON.stringify(initialState))];
    pointerRef.current = 0;
    setHistoryPointer(0);
    setIsHistoryInitialized(true);
  }, [nodes, edges, legacyText, isHistoryInitialized]);

  // Push user-driven graph changes to the history stack
  React.useEffect(() => {
    if (!isHistoryInitialized) return;
    
    if (isUndoingRedoingRef.current) {
      isUndoingRedoingRef.current = false;
      return;
    }
    
    pushHistory({ nodes, edges, legacyText }, false);
  }, [nodes, edges, legacyText, isHistoryInitialized, pushHistory]);

  // Bind global keyboard listeners for Cmd+Z / Cmd+Y
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isMeta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  // Guard: prevent the start node from being removed by any change event (e.g. keyboard delete)
  const onNodesChange = React.useCallback<typeof _onNodesChange>(async (changes: NodeChange[]) => {
    const removeChanges = changes.filter(c => c.type === 'remove');
    const otherChanges = changes.filter(c => c.type !== 'remove');

    if (otherChanges.length > 0) {
      _onNodesChange(otherChanges);
    }

    if (removeChanges.length > 0) {
      const nodeIds = removeChanges.map(c => c.id);
      const targetNodes = (nodes as ScriptNode[]).filter(n => nodeIds.includes(n.id) && n.type !== 'start');
      if (targetNodes.length > 0) {
        if (targetNodes.length === 1) {
          setNodeToDelete(targetNodes[0]);
          setIsDeleteDialogOpen(true);
        } else {
          const label = targetNodes.map(n => n.data?.label || 'Untitled Step').join(', ');
          const ok = await confirm({
            title: 'Delete Steps',
            description: `Are you sure you want to delete the step(s): "${label}"? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
          });
          if (!ok) return;

          isUndoingRedoingRef.current = true;
          const nextNodes = nodes.filter(n => !nodeIds.includes(n.id));
          const nextEdges = edges.filter(e => !nodeIds.includes(e.source) && !nodeIds.includes(e.target));

          setNodes(nextNodes);
          setEdges(nextEdges);
          if (selectedNodeId && nodeIds.includes(selectedNodeId)) {
            setSelectedNodeId(null);
          }
          pushHistory({ nodes: nextNodes, edges: nextEdges, legacyText }, true);
        }
      }
    }
  }, [_onNodesChange, nodes, edges, selectedNodeId, confirm, pushHistory, legacyText]);

  const legacyEditorRef = React.useRef<LegacyScriptEditorHandle>(null);
  // Node dialogue body editor ref (for the visual flow node inspector)
  const nodeEditorRef = React.useRef<LegacyScriptEditorHandle>(null);
  // Canvas Ref to retrieve bottom-center viewport coordinate for dropping new steps
  const canvasRef = React.useRef<VisualScriptCanvasHandle>(null);

  const [isLoading, setIsLoading] = React.useState(false);
  const [simulationActive, setSimulationActive] = React.useState(false);
  const [isSimModalOpen, setIsSimModalOpen] = React.useState(false);
  const [isSimDetailsModalOpen, setIsSimDetailsModalOpen] = React.useState(false);
  const [simulatedEntityId, setSimulatedEntityId] = React.useState<string | null>(null);
  const [simulatedContactId, setSimulatedContactId] = React.useState<string | null>(null);
  const [simulatedEntityData, setSimulatedEntityData] = React.useState<(
    Partial<Entity> & {
      name: string;
      primaryEmail: string;
      primaryPhone: string;
      entityContacts: EntityContact[];
    }
  ) | null>(null);
  const [simulatedTriggeredIds, setSimulatedTriggeredIds] = React.useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = React.useState(false);

  // Memoized Active Entity and Contact for display and simulation resolution
  const { activeEntity, activeContact } = React.useMemo(() => {
    const contacts = simulatedEntityData?.entityContacts;
    const contact = contacts?.find((c: EntityContact) => c.id === simulatedContactId) || contacts?.[0];
    
    const activeEntityVal = simulatedEntityData || {
      name: 'Lincoln Academy',
      entityType: 'institution',
      primaryEmail: 'admissions@lincoln.edu',
      primaryPhone: '+233242000000',
      entityContacts: [
        { name: 'John Doe', email: 'john@lincoln.edu', phone: '+233242111111', isPrimary: true, id: 'c1', typeKey: 'primary', isSignatory: false, order: 0 }
      ]
    };
    const activeContactVal = contact || activeEntityVal.entityContacts[0];
    return {
      activeEntity: activeEntityVal,
      activeContact: activeContactVal as SimulatedContact
    };
  }, [simulatedEntityData, simulatedContactId]);

  // Simulation Variable Resolver
  const resolveSimulatedText = React.useCallback((raw: string): string => {
    return resolveScriptVariables(
      raw, 
      activeEntity, 
      {
        name: 'Lincoln CRM Bundle 2026',
        value: 4500,
        stageName: 'Qualified Lead',
        status: 'open',
        expectedCloseDate: '2026-09-30'
      }, 
      user?.displayName || 'Agent', 
      activeContact
    );
  }, [activeEntity, activeContact, user]);

  const updateSimulatedEntityContact = React.useCallback((actionConfig: CallActionParams | undefined) => {
    if (!actionConfig) return;
    const { contactName, contactEmail, contactPhone, updateMode } = actionConfig;
    
    setSimulatedEntityData(prev => {
      if (!prev) return null;
      
      const resolvedContacts = [...(prev.entityContacts || [])];
      
      if (updateMode === 'new') {
        const newId = 'sim-c-' + Date.now();
        const newContact: EntityContact = {
          id: newId,
          name: contactName || 'New Contact',
          email: contactEmail || '',
          phone: contactPhone || '',
          isPrimary: resolvedContacts.length === 0,
          typeKey: 'signatory',
          isSignatory: true,
          order: resolvedContacts.length,
        };
        resolvedContacts.push(newContact);
        // Switch simulated contact to the new one
        setTimeout(() => setSimulatedContactId(newId), 0);
      } else {
        // Update current contact
        const targetId = simulatedContactId || resolvedContacts[0]?.id;
        const idx = resolvedContacts.findIndex(c => c.id === targetId);
        if (idx !== -1) {
          resolvedContacts[idx] = {
            ...resolvedContacts[idx],
            name: contactName !== undefined && contactName !== '' ? contactName : resolvedContacts[idx].name,
            email: contactEmail !== undefined && contactEmail !== '' ? contactEmail : resolvedContacts[idx].email,
            phone: contactPhone !== undefined && contactPhone !== '' ? contactPhone : resolvedContacts[idx].phone,
          };
        }
      }
      
      return {
        ...prev,
        primaryEmail: resolvedContacts.find(c => c.isPrimary)?.email || prev.primaryEmail,
        primaryPhone: resolvedContacts.find(c => c.isPrimary)?.phone || prev.primaryPhone,
        entityContacts: resolvedContacts,
      };
    });
  }, [simulatedContactId]);

  // AI Assist states
  const [isAiOpen, setIsAiOpen] = React.useState(false);
  const [aiTab, setAiTab] = React.useState<'write' | 'refine'>('write');
  const [aiObjective, setAiObjective] = React.useState('');
  const [aiAudience, setAiAudience] = React.useState('');
  const [aiTone, setAiTone] = React.useState('professional');
  const [aiGuidelines, setAiGuidelines] = React.useState('');
  const [refineInstructions, setRefineInstructions] = React.useState('');
  const [isAiLoading, setIsAiLoading] = React.useState(false);

  // Variable Picker state
  const [variableCategory, setVariableCategory] = React.useState<'entity' | 'deal' | 'used'>('entity');

  // ─── Load app_fields + field_groups for dynamic variable lists ───────────
  const appFieldsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'app_fields'),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', 'active')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: appFields } = useCollection<any>(appFieldsQuery);

  const fieldGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'field_groups'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('order', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: fieldGroups } = useCollection<any>(fieldGroupsQuery);

  // Load tags, stages, meetings for ActionNodeConfigPanel
  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'tags'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: tagsData } = useCollection<{ id: string; name: string }>(tagsQuery);

  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'onboardingStages'),
      orderBy('order', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: stagesData } = useCollection<{ id: string; name: string; pipelineId?: string }>(stagesQuery);

  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'pipelines'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: pipelinesData } = useCollection<{ id: string; name: string }>(pipelinesQuery);

  const meetingsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'meetings'),
      where('workspaceIds', 'array-contains', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: meetingsData } = useCollection<{ id: string; title?: string; meetingTime?: string; publishStatus?: string }>(meetingsQuery);

  const callCampaignsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'call_campaigns'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: callCampaignsData } = useCollection<{ id: string; name: string }>(callCampaignsQuery);

  const { data: workspaceUsersData } = useWorkspaceUsers(activeWorkspaceId);
  const workspaceUsers = workspaceUsersData || [];

  // Active, not-yet-due meetings available as guest-list targets (derived client-side to
  // avoid a composite Firestore index — vercel-react: rerender-derived-state-no-effect).
  const activeMeetings = React.useMemo(() => {
    const now = Date.now();
    return (meetingsData ?? [])
      .filter(m => m.publishStatus !== 'archived' && (!m.meetingTime || new Date(m.meetingTime).getTime() >= now))
      .map(m => ({ id: m.id, title: m.title || 'Untitled meeting' }));
  }, [meetingsData]);

  // Single data bundle shared by both the single action node and outcome automations.
  const actionData = React.useMemo<ActionConfigDataSources>(() => ({
    tags: tagsData ?? [],
    stages: stagesData ?? [],
    pipelines: pipelinesData ?? [],
    meetings: MEETING_TYPES.map(t => ({ id: t.id, title: t.name })),
    activeMeetings,
    callCampaigns: callCampaignsData ?? [],
    workspaceUsers,
  }), [tagsData, stagesData, pipelinesData, activeMeetings, callCampaignsData, workspaceUsers]);

  const wrapHref = React.useCallback((href: string) => {
    if (!activeWorkspaceId) return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}track=${activeWorkspaceId}`;
  }, [activeWorkspaceId]);

  // ─── Fetch Script (Edit Mode) ──────────────────────────────────────────────

  React.useEffect(() => {
    if (!scriptId || !activeWorkspaceId || !user?.uid) return;
    
    const loadScript = async () => {
      setIsLoading(true);
      try {
        const script = await getCallScriptAction(scriptId, activeWorkspaceId, user.uid);
        if (script) {
          setName(script.name || 'Untitled Script');
          setDescription(script.description || 'Script Description Here');
          
          if (isJsonGraph(script.content)) {
            const graph = parseGraph(script.content);
            setNodes(graph.nodes);
            setEdges(graph.edges);
            setLegacyText(extractPreviewText(script.content, '\n\n'));
            setEditorTab('flow');
          } else {
            setLegacyText(script.content);
            setEditorTab('text');
          }
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Script not found' });
          router.push(wrapHref('/admin/messaging/call-centre'));
        }
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    loadScript();
  }, [scriptId, activeWorkspaceId, user?.uid, router, toast, wrapHref, setNodes, setEdges]);

  // ─── Seed a default Start node for brand-new scripts ─────────────────────
  React.useEffect(() => {
    if (scriptId) return; // editing existing — don't seed
    setNodes(nds => {
      if (nds.some(n => n.type === 'start')) return nds; // already has one
      return [{
        id: 'start-default',
        type: 'start',
        position: { x: 300, y: 100 },
        data: {
          label: 'Start Call',
          text: 'Initiate outbound call conversation.',
        },
        deletable: false,
      }];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]);

  // Reset hasLoadedRef when scriptId changes so draft check can run again
  React.useEffect(() => {
    hasLoadedRef.current = false;
  }, [scriptId]);

  // ─── Draft Autosave & Recovery ──────────────────────────────────────────

  // Check and restore draft from localStorage on load completion
  React.useEffect(() => {
    if (isLoading || !activeWorkspaceId) return;

    const draftKey = `script-draft:${activeWorkspaceId}:${scriptId || 'new'}`;
    const rawDraft = localStorage.getItem(draftKey);
    if (!rawDraft) {
      hasLoadedRef.current = true;
      return;
    }

    try {
      const draft = JSON.parse(rawDraft);
      const currentValues = {
        name,
        description,
        nodes,
        edges,
        legacyText,
        editorTab,
      };

      // Helper function to check if local draft differs from active loaded state
      const isDraftDifferent = (d: any, c: any) => {
        if (d.name !== c.name) return true;
        if (d.description !== c.description) return true;
        if (d.editorTab !== c.editorTab) return true;
        if (d.legacyText !== c.legacyText) return true;
        if (d.nodes?.length !== c.nodes?.length) return true;
        if (d.edges?.length !== c.edges?.length) return true;
        try {
          if (JSON.stringify(d.nodes) !== JSON.stringify(c.nodes)) return true;
          if (JSON.stringify(d.edges) !== JSON.stringify(c.edges)) return true;
        } catch {
          return true;
        }
        return false;
      };

      if (isDraftDifferent(draft, currentValues)) {
        toast({
          title: 'Unsaved Draft Found',
          description: (
            <div className="flex flex-col gap-2.5 mt-1.5">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                We found an unsaved local backup from {new Date(draft.timestamp).toLocaleTimeString()}. Would you like to restore it?
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="h-7 rounded-lg text-[9px] font-bold uppercase tracking-wider px-3"
                  onClick={() => {
                    setName(draft.name);
                    setDescription(draft.description);
                    setNodes(draft.nodes || []);
                    setEdges(draft.edges || []);
                    setLegacyText(draft.legacyText || '');
                    setEditorTab(draft.editorTab || 'flow');
                    hasLoadedRef.current = true;
                    toast({ title: 'Draft Restored', description: 'Your unsaved changes have been loaded.' });
                  }}
                >
                  Restore
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 rounded-lg text-[9px] font-bold uppercase tracking-wider px-3 border-border bg-transparent hover:bg-muted text-muted-foreground"
                  onClick={() => {
                    localStorage.removeItem(draftKey);
                    hasLoadedRef.current = true;
                    toast({ title: 'Draft Dismissed', description: 'The local backup draft has been removed.' });
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ),
          duration: 15000,
        });
      } else {
        hasLoadedRef.current = true;
      }
    } catch (e) {
      console.error('Failed to parse script draft', e);
      hasLoadedRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, activeWorkspaceId, scriptId]);

  // Debounced effect to write autosaves to localStorage on change
  React.useEffect(() => {
    if (!hasLoadedRef.current || !activeWorkspaceId) return;

    const draftKey = `script-draft:${activeWorkspaceId}:${scriptId || 'new'}`;
    const timer = setTimeout(() => {
      const draft = {
        version: 2,
        timestamp: Date.now(),
        name,
        description,
        nodes,
        edges,
        legacyText,
        editorTab,
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }, 1000);

    return () => clearTimeout(timer);
  }, [name, description, nodes, edges, legacyText, editorTab, activeWorkspaceId, scriptId]);

  // ─── Active Node Selection & Manipulation ─────────────────────────────────

  const selectedNode = React.useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // ── Sync selectedNodeId → ReactFlow node.selected ─────────────────────────
  // ReactFlow's props.selected inside custom nodes is driven by the internal
  // node.selected field. Without this sync, only canvas-click selection works.
  // This effect mirrors the parent's selectedNodeId so the active ring lights
  // up correctly even when a node is selected via the toolbar or handleAddNode.
  React.useEffect(() => {
    setNodes(nds =>
      nds.map(n => ({
        ...n,
        selected: n.id === selectedNodeId,
      }))
    );
  // Only run when selectedNodeId changes — not on every nodes update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);


  const updateSelectedNode = (dataPatch: Record<string, any>) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(node => {
      if (node.id === selectedNodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            ...dataPatch
          }
        };
      }
      return node;
    }));
  };


  const handleAddNode = (type: string) => {
    const id = `node-${Date.now()}`;
    const defaultData: Record<string, unknown> = {
      label: `New ${type.replace('_', ' ')}`,
      text: type === 'start' ? 'Start of call outreach.' : type === 'end' ? 'End of call.' : 'Script body text.',
    };
    // Question nodes always start with Yes / No options
    if (type === 'question') {
      defaultData.options = ['Yes', 'No'];
      defaultData.text = 'Ask your question here…';
      defaultData.label = 'New question';
    }

    if (type === 'action') {
      defaultData.actionType = 'SEND_SMS';
      defaultData.actionConfig = { templateId: '', triggerDelaySeconds: 0 };
      defaultData.label = 'New action';
    }

    // ── Smart positioning ─────────────────────────────────────────────────────
    // If a node is currently selected (active in the properties panel), place
    // the new node directly below it, perfectly centred on the same X axis.
    // Otherwise fall back to the canvas viewport centre-bottom.
    let position: { x: number; y: number };
    let autoEdge: Edge | null = null;

    if (selectedNode) {
      const parentH = NODE_APPROX_H[selectedNode.type ?? ''] ?? 120;
      const parentCentreX = selectedNode.position.x + NODE_PX_W / 2;

      position = {
        x: parentCentreX - NODE_PX_W / 2,               // horizontally centred
        y: selectedNode.position.y + parentH + VERTICAL_GAP, // directly below
      };

      // Build the automatic connecting edge
      const sourceHandle = getPrimarySourceHandle(
        selectedNode.type ?? '',
        selectedNode.data as Record<string, unknown>
      );
      autoEdge = {
        id: `edge-${selectedNode.id}-${id}`,
        source: selectedNode.id,
        target: id,
        sourceHandle,
        targetHandle: null,
        label: sourceHandle ? sourceHandle.replace('option-', 'Option ') : undefined,
        type: 'deletable',
        className: 'group',
        data: {},
      };
    } else {
      // No selection → viewport centre-bottom fallback
      position = canvasRef.current
        ? canvasRef.current.getDropPosition()
        : { x: 150 + Math.random() * 50, y: 150 + Math.random() * 50 };
    }

    const newNode: Node = {
      id,
      type,
      position,
      data: defaultData,
    };

    setNodes(nds => [...nds, newNode]);
    if (autoEdge) {
      setEdges(eds => [...eds, autoEdge as Edge]);
    }
    // Select the newly inserted node so its properties open immediately
    setSelectedNodeId(id);
  };

  const handleInsertNodeOnEdge = (edgeId: string) => {
    setActiveInsertEdgeId(edgeId);
    setIsInsertNodeDialogOpen(true);
  };

  const handleConfirmInsertNode = (type: string) => {
    if (!activeInsertEdgeId) return;
    const edge = edges.find(e => e.id === activeInsertEdgeId);
    if (!edge) return;

    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const id = `node-${Date.now()}`;
    const defaultData: Record<string, unknown> = {
      label: `New ${type.replace('_', ' ')}`,
      text: type === 'start' ? 'Start of call outreach.' : type === 'end' ? 'End of call.' : 'Script body text.',
    };
    if (type === 'question') {
      defaultData.options = ['Yes', 'No'];
      defaultData.text = 'Ask your question here…';
      defaultData.label = 'New question';
    }
    if (type === 'action') {
      defaultData.actionType = 'SEND_SMS';
      defaultData.actionConfig = { templateId: '', triggerDelaySeconds: 0 };
      defaultData.label = 'New action';
    }

    // Midpoint positioning between source and target
    const position = {
      x: (sourceNode.position.x + targetNode.position.x) / 2,
      y: (sourceNode.position.y + targetNode.position.y) / 2,
    };

    const newNode: Node = {
      id,
      type,
      position,
      data: defaultData,
    };

    // Splice the old edge
    const newEdges = edges.filter(e => e.id !== activeInsertEdgeId);

    const edge1: Edge = {
      id: `edge-${edge.source}-${id}`,
      source: edge.source,
      target: id,
      sourceHandle: edge.sourceHandle,
      targetHandle: null,
      label: edge.label,
      type: 'deletable',
      className: 'group',
      data: {},
    };

    const sourceHandle2 = getPrimarySourceHandle(type, defaultData);
    const edge2: Edge = {
      id: `edge-${id}-${edge.target}`,
      source: id,
      target: edge.target,
      sourceHandle: sourceHandle2,
      targetHandle: null,
      label: sourceHandle2 ? sourceHandle2.replace('option-', 'Option ') : undefined,
      type: 'deletable',
      className: 'group',
      data: {},
    };

    const nextNodes = [...nodes, newNode];
    const nextEdges = [...newEdges, edge1, edge2];

    isUndoingRedoingRef.current = true;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(id);
    setIsInsertNodeDialogOpen(false);
    setActiveInsertEdgeId(null);

    pushHistory({ nodes: nextNodes, edges: nextEdges, legacyText }, true);
    toast({ title: 'Step Inserted', description: `Successfully inserted new ${type} step between nodes.` });
  };

  const handleDeleteSelectedNode = async () => {
    if (!selectedNodeId) return;
    const target = nodes.find(n => n.id === selectedNodeId);
    if (target?.type === 'start') {
      toast({ variant: 'destructive', title: 'Cannot delete Start node', description: 'The Start trigger is required and cannot be removed.' });
      return;
    }
    if (target) {
      setNodeToDelete(target);
      setIsDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = (deleteSubtree: boolean) => {
    if (!nodeToDelete) return;

    isUndoingRedoingRef.current = true;
    let nextNodes = nodes;
    let nextEdges = edges;

    const descendants = getDescendantNodeIds(nodeToDelete.id, edges);
    const targetIds = [nodeToDelete.id, ...Array.from(descendants)];

    if (deleteSubtree) {
      nextNodes = nodes.filter(n => !targetIds.includes(n.id));
      nextEdges = edges.filter(e => !targetIds.includes(e.source) && !targetIds.includes(e.target));
    } else {
      nextNodes = nodes.filter(n => n.id !== nodeToDelete.id);
      nextEdges = edges.filter(e => e.source !== nodeToDelete.id && e.target !== nodeToDelete.id);
    }

    setNodes(nextNodes);
    setEdges(nextEdges);
    if (selectedNodeId && (deleteSubtree ? targetIds.includes(selectedNodeId) : selectedNodeId === nodeToDelete.id)) {
      setSelectedNodeId(null);
    }

    pushHistory({ nodes: nextNodes, edges: nextEdges, legacyText }, true);

    toast({
      title: deleteSubtree ? 'Subtree Deleted' : 'Step Deleted',
      description: `Successfully removed step "${nodeToDelete.data.label}".`
    });

    setIsDeleteDialogOpen(false);
    setNodeToDelete(null);
  };

  const handleCloneStep = React.useCallback((cloneSubtreeOption: boolean) => {
    if (!nodeToClone) return;
    
    const result = cloneSubtreeOption
      ? cloneSubtree(nodes, edges, nodeToClone.id, 300)
      : cloneSingleNode(nodes, edges, nodeToClone.id, NODE_APPROX_H, VERTICAL_GAP);

    const targetId = cloneSubtreeOption ? result.newRootId : result.newId;
    if (targetId) {
      isUndoingRedoingRef.current = true;
      setNodes(result.nodes);
      setEdges(result.edges);
      setSelectedNodeId(targetId);
      
      pushHistory({ nodes: result.nodes, edges: result.edges, legacyText }, true);

      setTimeout(() => {
        canvasRef.current?.focusNode(targetId);
      }, 100);

      toast({
        title: cloneSubtreeOption ? 'Subtree Cloned' : 'Step Cloned',
        description: `Successfully duplicated "${nodeToClone.data.label}".`
      });
    }

    setIsCloneDialogOpen(false);
    setNodeToClone(null);
  }, [nodeToClone, nodes, edges, setNodes, setEdges, toast, pushHistory, legacyText]);

  // Delete an edge by ID (called from the custom edge ✕ button or Delete key)
  const handleEdgeDelete = React.useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
  }, [setEdges]);

  const onConnect = React.useCallback(
    (params: any) => setEdges((eds) => addEdge({ 
      ...params, 
      label: 'Choice label' 
    }, eds)),
    [setEdges]
  );

  const onNodeClick = React.useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // ─── Keyboard step-to-step navigation order ───────────────────────────────
  // Depth-first traversal that fully descends the left-most branch before moving
  // on to sibling branches. Children are ordered by their question option index
  // (option-0 first), then left-to-right by x position. Down arrow moves to the
  // next node in this order, Up arrow to the previous one.
  const orderedNodeIds = React.useMemo(() => {
    const adjacency = new Map<string, { target: string; sort: number; x: number }[]>();
    for (const e of edges) {
      const list = adjacency.get(e.source) || [];
      const optIdx = e.sourceHandle?.startsWith('option-')
        ? parseInt(e.sourceHandle.slice('option-'.length), 10)
        : Number.MAX_SAFE_INTEGER;
      const tgt = nodes.find(n => n.id === e.target);
      list.push({
        target: e.target,
        sort: Number.isFinite(optIdx) ? optIdx : Number.MAX_SAFE_INTEGER,
        x: tgt?.position.x ?? 0,
      });
      adjacency.set(e.source, list);
    }
    // Order each node's children: option index first, then left-to-right
    adjacency.forEach(list => list.sort((a, b) => a.sort - b.sort || a.x - b.x));

    const visited = new Set<string>();
    const order: string[] = [];
    const dfs = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      order.push(id);
      for (const child of adjacency.get(id) || []) dfs(child.target);
    };

    const starts = nodes.filter(n => n.type === 'start').sort((a, b) => a.position.x - b.position.x);
    const byPosition = [...nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    (starts.length ? starts : byPosition.slice(0, 1)).forEach(s => dfs(s.id));
    // Append any disconnected nodes not reached by the traversal (top-to-bottom)
    byPosition.forEach(n => { if (!visited.has(n.id)) { visited.add(n.id); order.push(n.id); } });
    return order;
  }, [nodes, edges]);

  // Arrow-key navigation between nodes (active only on the visual flow tab).
  React.useEffect(() => {
    if (editorTab !== 'flow' || isAiOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      // Ignore while typing in any text field / rich editor
      const ae = document.activeElement as HTMLElement | null;
      if (ae?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
      if (orderedNodeIds.length === 0) return;

      e.preventDefault();
      const curIdx = selectedNodeId ? orderedNodeIds.indexOf(selectedNodeId) : -1;
      let nextIdx: number;
      if (e.key === 'ArrowDown') {
        nextIdx = curIdx < 0 ? 0 : Math.min(curIdx + 1, orderedNodeIds.length - 1);
      } else {
        nextIdx = curIdx < 0 ? orderedNodeIds.length - 1 : Math.max(0, curIdx - 1);
      }
      const nextId = orderedNodeIds[nextIdx];
      if (nextId) {
        setSelectedNodeId(nextId);
        canvasRef.current?.focusNode(nextId);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editorTab, isAiOpen, orderedNodeIds, selectedNodeId]);

  // Convert legacy text script to dynamic branching graph
  const handleConvertToGraph = () => {
    const defaultGraph = parseGraph(legacyText);
    setNodes(defaultGraph.nodes);
    setEdges(defaultGraph.edges);
    setEditorTab('flow');
    toast({ title: 'Converted to Flow', description: 'Plain text script has been wrapped in a starting flowchart node structure.' });
  };

  // Variable selector clicked — delegates to the correct rich editor via ref
  const handleInsertVariable = (variable: string) => {
    if (editorTab === 'text') {
      legacyEditorRef.current?.insertVariable(variable);
    } else if (selectedNode) {
      nodeEditorRef.current?.insertVariable(variable);
    }
  };

  // Compile active variables lists for display
  const detectedVariables = React.useMemo(() => {
    const regex = /\{\{([A-Za-z0-9_]+)\}\}/g;
    const matches = new Set<string>();
    
    if (editorTab === 'text') {
      let match;
      while ((match = regex.exec(legacyText)) !== null) {
        matches.add(match[1].toUpperCase());
      }
    } else {
      nodes.forEach(node => {
        let match;
        const text = node.data.text || '';
        while ((match = regex.exec(text)) !== null) {
          matches.add(match[1].toUpperCase());
        }
      });
    }
    return Array.from(matches);
  }, [nodes, legacyText, editorTab]);

  // ─── Build dynamic variable groups for the script editor panel ────────────
  const scriptVariableGroups = React.useMemo((): VariableGroup[] => {
    // Build custom entity variable names from app_fields (only non-system groups)
    const nonSystemGroupIds = new Set(
      (fieldGroups || []).filter((g: any) => !g.isSystem).map((g: any) => g.id)
    );
    const customEntityVars: string[] = (appFields || [])
      .filter((f: any) => {
        const isActive = f.status === 'active';
        const isNotHidden = f.type !== 'hidden';
        const inNonSystemGroup = f.groupId && nonSystemGroupIds.has(f.groupId);
        return isActive && isNotHidden && inNonSystemGroup;
      })
      .map((f: any) => {
        const key = (f.id || f.name || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        return key;
      })
      .filter(Boolean);

    return [
      { group: 'Entity Fields', items: [...NATIVE_ENTITY_VAR_NAMES, ...customEntityVars] },
      { group: 'Deal Fields', items: NATIVE_DEAL_VAR_NAMES },
    ];
  }, [appFields, fieldGroups]);


  // Clean structure graph matching backend types
  const cleanGraph = React.useMemo(() => {
    const cleanNodes: ScriptNode[] = nodes.map(n => ({
      id: n.id,
      type: (n.type || 'script_block') as ScriptNodeType,
      position: n.position,
      data: {
        label: n.data.label || '',
        text: n.data.text || '',
        outcomeValue: n.data.outcomeValue,
        actionType: n.data.actionType,
        options: n.data.options,
        startConfig: n.data.startConfig,
        sayConfig: n.data.sayConfig,
        questionConfig: n.data.questionConfig,
        objectionConfig: n.data.objectionConfig,
        actionConfig: n.data.actionConfig ? { ...n.data.actionConfig } : undefined,
        outcomeConfig: n.data.outcomeConfig,
        endConfig: n.data.endConfig,
      }
    }));

    const cleanEdges: ScriptEdge[] = edges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      let label = e.label;
      if (sourceNode?.type === 'question' && e.sourceHandle?.startsWith('option-')) {
        const idx = parseInt(e.sourceHandle.replace('option-', ''), 10);
        const options = sourceNode.data?.options || ['Yes', 'No'];
        label = options[idx] || label;
      }
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        label: typeof label === 'string' ? label : undefined
      };
    });

    return { nodes: cleanNodes, edges: cleanEdges };
  }, [nodes, edges]);

  // Graph validation state
  const graphValidation = React.useMemo(() => {
    return validateScriptGraph(cleanGraph);
  }, [cleanGraph]);

  const [isTestingAction, setIsTestingAction] = React.useState(false);
  const [isTestingOutcome, setIsTestingOutcome] = React.useState(false);

  const handleTestAction = React.useCallback(async (node: ScriptNode) => {
    if (!simulatedEntityId) {
      toast({ 
        variant: 'destructive', 
        title: 'No Entity Selected', 
        description: 'Please configure a simulated entity first in the simulation settings modal (click the "Test" button at the top).' 
      });
      return;
    }
    const actionType = node.data.actionType || 'SEND_SMS';
    setIsTestingAction(true);
    try {
      const res = await executeScriptActionAction({
        actionType,
        actionConfig: JSON.parse(JSON.stringify(node.data.actionConfig || {})),
        entityId: simulatedEntityId,
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
        contactId: simulatedContactId || undefined,
      }, user?.uid || '');

      if (res.success) {
        toast({ 
          title: 'Action Simulated Successfully', 
          description: `Action "${getActionMeta(actionType).label}" executed.` 
        });
        if (actionType === 'UPDATE_CONTACT') {
          updateSimulatedEntityContact(node.data.actionConfig);
        }
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Execution Failed', 
          description: res.error 
        });
      }
    } catch (err: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Error testing action', 
        description: err.message 
      });
    } finally {
      setIsTestingAction(false);
    }
  }, [simulatedEntityId, simulatedContactId, activeWorkspaceId, activeOrganizationId, user?.uid, toast, updateSimulatedEntityContact]);

  const handleTestOutcome = React.useCallback(async (node: ScriptNode) => {
    if (!simulatedEntityId) {
      toast({ 
        variant: 'destructive', 
        title: 'No Entity Selected', 
        description: 'Please configure a simulated entity first in the simulation settings modal (click the "Test" button at the top).' 
      });
      return;
    }

    const automations = node.data.outcomeConfig?.automations || [];
    if (automations.length === 0) {
      toast({
        title: 'No Automations Configured',
        description: 'This outcome node has no post-call automations to test.'
      });
      return;
    }

    setIsTestingOutcome(true);
    try {
      const res = await executeOutcomeAutomationsAction({
        automations,
        entityId: simulatedEntityId,
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
        contactId: simulatedContactId || undefined,
      }, user?.uid || '');

      if (res.success && res.results) {
        const successes = res.results.filter(r => r.success);
        const failures = res.results.filter(r => !r.success);

        if (failures.length === 0) {
          toast({ 
            title: 'Outcome Automations Simulated', 
            description: `Successfully executed all ${automations.length} automation(s) in parallel.` 
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Some Automations Failed',
            description: `Succeeded: ${successes.length}, Failed: ${failures.length}. First error: ${failures[0].error || 'Unknown error'}`
          });
        }
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Execution Failed', 
          description: res.error || 'Outcome execution failed.' 
        });
      }
    } catch (err: unknown) {
      toast({ 
        variant: 'destructive', 
        title: 'Error testing outcome', 
        description: err instanceof Error ? err.message : 'An error occurred during testing.' 
      });
    } finally {
      setIsTestingOutcome(false);
    }
  }, [simulatedEntityId, simulatedContactId, activeWorkspaceId, activeOrganizationId, user?.uid, toast]);

  // ─── Save Action Handler ───────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Script name is required' });
      return;
    }

    let finalContent = '';
    let finalVariables = detectedVariables;

    if (editorTab !== 'text') {
      if (nodes.length === 0) {
        toast({ variant: 'destructive', title: 'Validation Error', description: 'Flowchart must contain at least one node to save.' });
        return;
      }
      
      finalContent = JSON.stringify(cleanGraph);
    } else {
      if (!legacyText.trim()) {
        toast({ variant: 'destructive', title: 'Validation Error', description: 'Script body content text is required.' });
        return;
      }
      finalContent = legacyText;
    }

    setIsSaving(true);
    try {
      const draftKey = `script-draft:${activeWorkspaceId}:${scriptId || 'new'}`;
      if (scriptId) {
        // Edit mode
        const result = await updateCallScriptAction(
          scriptId,
          { 
            name, 
            description, 
            content: finalContent, 
            variables: finalVariables, 
            workspaceId: activeWorkspaceId 
          },
          user?.uid || ''
        );
        if (result.success) {
          toast({ title: 'Script Updated', description: 'Modifications saved successfully.' });
          localStorage.removeItem(draftKey);
        } else {
          toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
        }
      } else {
        // Create mode
        const result = await createCallScriptAction(
          {
            organizationId: activeOrganizationId,
            workspaceId: activeWorkspaceId,
            name,
            description,
            content: finalContent,
            variables: finalVariables,
          },
          user?.uid || ''
        );
        if (result.success) {
          toast({ title: 'Script Created', description: 'New call script registered successfully.' });
          localStorage.removeItem(draftKey);
          const newUrl = `/admin/messaging/call-centre/scripts/new?id=${result.id}${returnCampaignId ? `&returnCampaignId=${returnCampaignId}` : ''}`;
          router.replace(wrapHref(newUrl));
        } else {
          toast({ variant: 'destructive', title: 'Creation Failed', description: result.error });
        }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const renderNodeConfigPanel = React.useCallback((node: Node) => {
    const scriptNode = node as ScriptNode;

    const objections: Array<{ title: string; keywordTriggers: string[]; description: string }> =
      scriptNode.data.objectionConfig?.objections ?? [
        {
          title: '',
          keywordTriggers: scriptNode.data.objectionConfig?.keywordTriggers ?? [],
          description: scriptNode.data.text ?? '',
        },
      ];

    const updateObjection = (
      idx: number,
      patch: Partial<{ title: string; keywordTriggers: string[]; description: string }>
    ) => {
      const updated = objections.map((o, i) => (i === idx ? { ...o, ...patch } : o));
      updateSelectedNode({
        objectionConfig: {
          ...scriptNode.data.objectionConfig,
          objections: updated,
        },
      });
    };

    const addObjection = () => {
      const updated = [...objections, { title: '', keywordTriggers: [], description: '' }];
      updateSelectedNode({
        objectionConfig: {
          ...scriptNode.data.objectionConfig,
          objections: updated,
        },
      });
    };

    const removeObjection = (idx: number) => {
      const updated = objections.filter((_, i) => i !== idx);
      updateSelectedNode({
        objectionConfig: {
          ...scriptNode.data.objectionConfig,
          objections: updated,
        },
      });
    };

    return (
      <div className="space-y-4">
        {/* Node Label Title */}
        <div className="space-y-1">
          <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Title label</Label>
          <Input
            value={scriptNode.data.label || ''}
            onChange={(e) => updateSelectedNode({ label: e.target.value })}
            className="h-8 bg-background border-border rounded-lg text-xs"
          />
        </div>

        {/* Start Node Configuration */}
        {scriptNode.type === 'start' && (
          <div className="space-y-3 pt-3 border-t border-border">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Start Configuration</span>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-foreground/80">Check DNC List</Label>
              <input 
                type="checkbox"
                checked={scriptNode.data.startConfig?.checkDnc || false}
                onChange={(e) => updateSelectedNode({ 
                  startConfig: { ...scriptNode.data.startConfig, checkDnc: e.target.checked } 
                })}
                className="h-4 w-4 rounded border-border bg-background accent-primary"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-foreground/80">Check Local Timezone</Label>
              <input 
                type="checkbox"
                checked={scriptNode.data.startConfig?.checkTimezone || false}
                onChange={(e) => updateSelectedNode({ 
                  startConfig: { ...scriptNode.data.startConfig, checkTimezone: e.target.checked } 
                })}
                className="h-4 w-4 rounded border-border bg-background accent-primary"
              />
            </div>
            {scriptNode.data.startConfig?.checkTimezone && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[8px] font-bold text-muted-foreground uppercase">Allowed Hours Start</Label>
                  <Input
                    value={scriptNode.data.startConfig?.allowedHoursStart || '09:00'}
                    onChange={(e) => updateSelectedNode({ 
                      startConfig: { ...scriptNode.data.startConfig, allowedHoursStart: e.target.value } 
                    })}
                    placeholder="09:00"
                    className="h-8 bg-background border-border rounded-lg text-xs px-2"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-bold text-muted-foreground uppercase">Allowed Hours End</Label>
                  <Input
                    value={scriptNode.data.startConfig?.allowedHoursEnd || '20:00'}
                    onChange={(e) => updateSelectedNode({ 
                      startConfig: { ...scriptNode.data.startConfig, allowedHoursEnd: e.target.value } 
                    })}
                    placeholder="20:00"
                    className="h-8 bg-background border-border rounded-lg text-xs px-2"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Script Block Configuration */}
        {scriptNode.type === 'script_block' && (
          <div className="space-y-3 pt-3 border-t border-border">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Say Block Configuration</span>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-foreground/80">Require Compliance Checkmark</Label>
              <input 
                type="checkbox"
                checked={scriptNode.data.sayConfig?.complianceVerify || false}
                onChange={(e) => updateSelectedNode({ 
                  sayConfig: { ...scriptNode.data.sayConfig, complianceVerify: e.target.checked } 
                })}
                className="h-4 w-4 rounded border-border bg-background accent-primary"
              />
            </div>
          </div>
        )}

        {/* Question Node Configuration */}
        {scriptNode.type === 'question' && (
          <div className="space-y-3 pt-3 border-t border-border">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Question Configuration</span>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-foreground/80">Allow Custom Freeform Input</Label>
              <input 
                type="checkbox"
                checked={scriptNode.data.questionConfig?.allowFreeform || false}
                onChange={(e) => updateSelectedNode({ 
                  questionConfig: { ...scriptNode.data.questionConfig, allowFreeform: e.target.checked } 
                })}
                className="h-4 w-4 rounded border-border bg-background accent-primary"
              />
            </div>
            
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-[8px] font-bold text-muted-foreground uppercase">Response Branches / Buttons</Label>
                <button
                  type="button"
                  onClick={() => {
                    const opts = (scriptNode.data.options as string[]) || [];
                    updateSelectedNode({ options: [...opts, `Option ${opts.length + 1}`] });
                  }}
                  className="text-[9px] font-black text-primary hover:underline"
                >
                  + Add Option
                </button>
              </div>
              <div className="space-y-1.5">
                {((scriptNode.data.options as string[]) || []).map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-1.5">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const opts = [...((scriptNode.data.options as string[]) || [])];
                        opts[oIdx] = e.target.value;
                        updateSelectedNode({ options: opts });
                      }}
                      className="h-8 bg-background border-border rounded-lg text-xs flex-grow"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const opts = ((scriptNode.data.options as string[]) || []).filter((_, i) => i !== oIdx);
                        updateSelectedNode({ options: opts });
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Objection Node Configuration */}
        {scriptNode.type === 'objection' && (
          <div className="space-y-3 pt-3 border-t border-border">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Objection Configuration</span>
            
            <div className="space-y-3">
              {((scriptNode.data.objectionConfig?.objections as Array<{ title: string; keywordTriggers: string[]; description: string }>) || []).map((obj, idx) => (
                <div key={idx} className="p-3 bg-muted/20 border border-border/60 rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold text-orange-500 uppercase tracking-wider">Objection #{idx + 1}</span>
                    {((scriptNode.data.objectionConfig?.objections as unknown[]) || []).length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeObjection(idx)}
                        className="h-6 w-6 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg absolute top-2 right-2"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {/* Title / Scenario */}
                  <div className="space-y-1">
                    <Label className="text-[8px] font-bold text-muted-foreground uppercase">Objection Scenario Title</Label>
                    <Input
                      value={obj.title}
                      onChange={(e) => updateObjection(idx, { title: e.target.value })}
                      placeholder='e.g. "Too expensive"'
                      className="h-7 bg-background border-border rounded-lg text-xs px-2"
                    />
                  </div>

                  {/* Keywords */}
                  <div className="space-y-1">
                    <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                      Trigger Keywords <span className="normal-case font-normal">(comma-separated)</span>
                    </Label>
                    <Input
                      value={obj.keywordTriggers.join(', ')}
                      onChange={(e) =>
                        updateObjection(idx, {
                          keywordTriggers: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="too expensive, not now, no budget"
                      className="h-7 bg-background border-border rounded-lg text-xs px-2"
                    />
                    {obj.keywordTriggers.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {obj.keywordTriggers.map((kw, ki) => (
                          <span
                            key={ki}
                            className="px-1.5 py-0.5 rounded-full text-[7px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/25"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Description / response script */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                        Agent Response / Description
                      </Label>
                      <span className="text-[7px] text-muted-foreground/50 font-mono">
                        type <kbd className="bg-muted px-0.5 rounded border border-border/50 text-[7px]">/</kbd> to insert variables
                      </span>
                    </div>
                    <LegacyScriptEditor
                      value={obj.description}
                      onChange={(val) => updateObjection(idx, { description: val })}
                      variableGroups={scriptVariableGroups}
                      placeholder="What should the agent say in response to this objection?"
                      minHeight="120px"
                      richFormatting
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addObjection}
              className="w-full h-7 rounded-lg border border-dashed border-orange-500/40 text-orange-400 text-[9px] font-bold uppercase tracking-wider hover:bg-orange-500/5 hover:border-orange-500/70 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3 w-3" /> Add Objection
            </button>
            <p className="text-[8px] text-muted-foreground/50 leading-relaxed">
              Each objection entry defines a separate trigger scenario. The agent will see the response description when the caller raises that objection.
            </p>
          </div>
        )}

        {/* Outcome Node Configuration */}
        {scriptNode.type === 'outcome' && (
          <div className="space-y-3 pt-3 border-t border-border">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Outcome Configuration</span>
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">Map Call Outcome Tag</Label>
              <Select 
                value={scriptNode.data.outcomeValue || 'Interested'} 
                onValueChange={(val) => updateSelectedNode({ 
                  outcomeValue: val, 
                  label: `Set Outcome: ${val}` 
                })}
              >
                <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="Interested">Interested</SelectItem>
                  <SelectItem value="Not Interested">Not Interested</SelectItem>
                  <SelectItem value="Callback Scheduled">Callback Scheduled</SelectItem>
                  <SelectItem value="Deferred / Retry">Deferred / Retry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">Lead Suppression Period (Days)</Label>
              <Input
                type="number"
                value={scriptNode.data.outcomeConfig?.suppressDays || 0}
                onChange={(e) => updateSelectedNode({ 
                  outcomeConfig: { ...scriptNode.data.outcomeConfig, suppressDays: Number(e.target.value) || 0 } 
                })}
                className="h-8 bg-background border-border rounded-lg text-xs px-2"
              />
            </div>
            <div className="pt-2 border-t border-border/40">
              <OutcomeAutomationsEditor
                automations={scriptNode.data.outcomeConfig?.automations ?? []}
                onChange={(automations) => updateSelectedNode({
                  outcomeConfig: { ...scriptNode.data.outcomeConfig, automations },
                })}
                data={actionData}
              />
            </div>
          </div>
        )}

        {/* Action Node Configuration */}
        {scriptNode.type === 'action' && (
          <ActionNodeConfigPanel
            actionType={scriptNode.data.actionType}
            actionConfig={scriptNode.data.actionConfig}
            onUpdate={updateSelectedNode}
            data={actionData}
          />
        )}

        {/* End Node Configuration */}
        {scriptNode.type === 'end' && (
          <div className="space-y-3 pt-3 border-t border-border">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">End Call Configuration</span>
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">Post-Call Wrap-Up Template ID</Label>
              <Input
                value={scriptNode.data.endConfig?.wrapUpTemplateId || ''}
                onChange={(e) => updateSelectedNode({ 
                  endConfig: { ...scriptNode.data.endConfig, wrapUpTemplateId: e.target.value } 
                })}
                placeholder="default_wrap_up"
                className="h-8 bg-background border-border rounded-lg text-xs px-2"
              />
            </div>
          </div>
        )}

        {/* Dialogue body editor — hidden for objection nodes */}
        {scriptNode.type !== 'objection' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Dialogue script body</Label>
                <span className="text-[8px] text-muted-foreground/50 font-mono">
                  type <kbd className="bg-muted px-1 rounded border border-border/50">/</kbd> to insert variables
                </span>
              </div>
              <LegacyScriptEditor
                ref={nodeEditorRef}
                value={scriptNode.data.text || ''}
                onChange={(val) => updateSelectedNode({ text: val })}
                variableGroups={scriptVariableGroups}
                placeholder="Type dialog block script here…"
                richFormatting
              />
            </div>

            {simulationActive && (
              <div className="space-y-1.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/5 mt-3">
                <div className="text-[8px] font-extrabold text-amber-500 uppercase tracking-widest">Simulation Preview</div>
                <ScriptBodyDisplay
                  text={scriptNode.data.text || ''}
                  resolveText={resolveSimulatedText}
                  highlightVariables={false}
                  className="text-xs leading-relaxed text-foreground font-serif italic"
                  emptyFallback={<span className="text-[10px] text-muted-foreground italic">Dialogue is empty</span>}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [updateSelectedNode, scriptVariableGroups, simulationActive, resolveSimulatedText, actionData]);

  const handleSimulatedTriggerAction = React.useCallback(async (node: ScriptNode) => {
    setSimulatedTriggeredIds(prev => new Set(prev).add(node.id));
    if (simulationActive && simulatedEntityId) {
      const actionType = node.data?.actionType || 'SEND_SMS';
      try {
        const res = await executeScriptActionAction({
          actionType,
          actionConfig: JSON.parse(JSON.stringify(node.data?.actionConfig || {})),
          entityId: simulatedEntityId,
          workspaceId: activeWorkspaceId,
          organizationId: activeOrganizationId,
          contactId: simulatedContactId || undefined,
        }, user?.uid || '');
        
        if (res.success) {
          toast({ 
            title: 'Action Simulated Successfully', 
            description: `Interactive simulator executed "${getActionMeta(actionType).label}" action.` 
          });
          if (actionType === 'UPDATE_CONTACT') {
            updateSimulatedEntityContact(node.data?.actionConfig);
          }
        } else {
          toast({ 
            variant: 'destructive', 
            title: 'Action Execution Failed', 
            description: res.error 
          });
        }
      } catch (err: unknown) {
        toast({
          variant: 'destructive',
          title: 'Error executing action',
          description: err instanceof Error ? err.message : 'An error occurred.'
        });
      }
    }
    return { ok: true };
  }, [simulationActive, simulatedEntityId, activeWorkspaceId, activeOrganizationId, simulatedContactId, user?.uid, toast, updateSimulatedEntityContact]);

  const handleSimulatedTriggerOutcome = React.useCallback(async (node: ScriptNode) => {
    setSimulatedTriggeredIds(prev => new Set(prev).add(node.id));
    if (simulationActive) {
      const automations = node.data?.outcomeConfig?.automations || [];
      if (automations.length > 0 && simulatedEntityId) {
        try {
          const res = await executeOutcomeAutomationsAction({
            automations: JSON.parse(JSON.stringify(automations)),
            entityId: simulatedEntityId,
            workspaceId: activeWorkspaceId,
            organizationId: activeOrganizationId,
            contactId: simulatedContactId || undefined,
          }, user?.uid || '');
          
          if (res.success && res.results) {
            const failures = res.results.filter(r => !r.success);
            if (failures.length === 0) {
              toast({ 
                title: 'Outcome Automations Simulated', 
                description: `Interactive simulator executed ${automations.length} automation(s) for outcome "${node.data?.outcomeValue || 'Outcome'}".` 
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Interactive Automations Failed',
                description: `Executed outcome automations, but ${failures.length} failed. First error: ${failures[0].error || 'Unknown error'}`
              });
            }
          } else {
            toast({
              variant: 'destructive',
              title: 'Outcome Simulation Failed',
              description: res.error || 'Interactive outcome execution failed.'
            });
          }
        } catch (err: unknown) {
          toast({
            variant: 'destructive',
            title: 'Error executing automations',
            description: err instanceof Error ? err.message : 'An error occurred.'
          });
        }
      }
    }
    return { ok: true };
  }, [simulationActive, simulatedEntityId, activeWorkspaceId, activeOrganizationId, simulatedContactId, user?.uid, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-40">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <PageContainer noPadding>
      <Tabs
        defaultValue="flow"
        value={editorTab}
        onValueChange={(v: string) => {
          isTabSwitchingRef.current = true;
          
          if (v !== 'list') {
            setIsListViewPreviewMode(false);
          }
          // Validate and parse legacy text when leaving the text tab
          if (editorTab === 'text' && v !== 'text') {
            try {
              const parsed = parseGraph(legacyText);
              if (!parsed.nodes || parsed.nodes.length === 0) {
                throw new Error("Parsed script contains no valid nodes.");
              }
              setNodes(parsed.nodes);
              setEdges(parsed.edges);
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : 'Syntax Error';
              toast({
                variant: 'destructive',
                title: 'Script Parsing Error',
                description: `Invalid raw script syntax. Please resolve errors before switching: ${errMsg}`
              });
              isTabSwitchingRef.current = false;
              return; // Block the tab switch
            }
          }

          // Serialize graph to raw preview text when entering the text tab
          if (v === 'text') {
            const plainText = extractPreviewText(JSON.stringify(cleanGraph), '\n\n');
            setLegacyText(plainText);
          }
          setEditorTab(v as 'flow' | 'list' | 'interactive' | 'text');
          
          setTimeout(() => {
            isTabSwitchingRef.current = false;
          }, 50);
        }}
        className="w-full space-y-8 p-8"
      >
        {returnCampaignId && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">
                Editing script for campaign setup. Saving will return you to step 2 of the wizard.
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] uppercase font-bold hover:bg-primary/10 text-primary h-7 rounded-lg"
              onClick={() => router.push(wrapHref(`/admin/messaging/call-centre/campaigns/new?id=${returnCampaignId}&step=2`))}
            >
              Cancel & Return
            </Button>
          </div>
        )}
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                if (returnCampaignId) {
                  router.push(wrapHref(`/admin/messaging/call-centre/campaigns/new?id=${returnCampaignId}&step=2`));
                } else {
                  router.push(wrapHref('/admin/messaging/call-centre?tab=scripts'));
                }
              }}
              variant="outline"
              size="icon"
              className="rounded-xl border border-border bg-muted hover:bg-accent text-muted-foreground shrink-0"
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                    className="h-8 bg-muted border-border text-sm font-bold text-foreground rounded-lg w-64 focus:border-primary focus:ring-0 px-2.5"
                    autoFocus
                    placeholder="Script Title"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                    <h1 className="text-xl font-black uppercase text-foreground tracking-wider">
                      {name || 'Untitled Script'}
                    </h1>
                    <Pencil className="h-3.5 w-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-300" />
                  </div>
                  {simulationActive && (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            onClick={() => setIsSimDetailsModalOpen(true)}
                            className="bg-amber-500/10 hover:bg-amber-500/25 hover:border-amber-500/40 text-amber-500 border border-amber-500/25 animate-pulse uppercase tracking-wider font-extrabold text-[9px] py-1 px-2.5 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer transition-all animate-none"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                            Sim Active
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="p-3.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                          <div className="space-y-1.5 text-[10px]">
                            <div className="font-bold text-[9px] text-amber-500 uppercase tracking-widest border-b border-border/50 pb-1 mb-1">Active Sim Contact</div>
                            <div><span className="text-muted-foreground font-bold uppercase tracking-wider text-[8px]">Name:</span> <span className="font-semibold text-foreground">{activeContact?.name || 'N/A'}</span></div>
                            <div><span className="text-muted-foreground font-bold uppercase tracking-wider text-[8px]">Phone:</span> <span className="font-mono text-foreground">{activeContact?.phone || 'N/A'}</span></div>
                            <div><span className="text-muted-foreground font-bold uppercase tracking-wider text-[8px]">Email:</span> <span className="font-mono text-foreground">{activeContact?.email || 'N/A'}</span></div>
                            <div><span className="text-muted-foreground font-bold uppercase tracking-wider text-[8px]">Role:</span> <span className="font-semibold text-foreground">{activeContact?.role || activeContact?.typeLabel || 'Mock Contact'}</span></div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}

              {isEditingDesc ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => setIsEditingDesc(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingDesc(false)}
                    className="h-7 bg-muted border-border text-xs text-foreground rounded-lg w-96 focus:border-primary focus:ring-0 px-2"
                    autoFocus
                    placeholder="Campaign context description"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => setIsEditingDesc(false)}
                    className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5 group cursor-pointer" onClick={() => setIsEditingDesc(true)}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-normal">
                    {description || 'Script Description Here'}
                  </p>
                  <Pencil className="h-3 w-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-300" />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* View Switcher Tabs next to Save Flow button */}
            <TabsList className="bg-muted border border-border h-9 p-0.5 rounded-xl gap-1 shrink-0">
              <TabsTrigger 
                value="flow" 
                className="rounded-lg text-[10px] font-bold px-3 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground transition-colors"
              >
                <GitBranch className="h-3.5 w-3.5 mr-1" />
                Visual Flow
              </TabsTrigger>
              <TabsTrigger 
                value="list" 
                className="rounded-lg text-[10px] font-bold px-3 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground transition-colors"
              >
                <List className="h-3.5 w-3.5 mr-1" />
                List View
              </TabsTrigger>
              <TabsTrigger 
                value="interactive" 
                className="rounded-lg text-[10px] font-bold px-3 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground transition-colors"
              >
                <Layers className="h-3.5 w-3.5 mr-1" />
                Interactive Script
              </TabsTrigger>
              <TabsTrigger 
                value="text" 
                className="rounded-lg text-[10px] font-bold px-3 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Legacy Text
              </TabsTrigger>
            </TabsList>

            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-2">
                {/* Undo / Redo Buttons */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl border-border bg-muted hover:bg-accent text-muted-foreground active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Undo2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Undo</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Revert the last modification to the script graph (Cmd+Z).
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl border-border bg-muted hover:bg-accent text-muted-foreground active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Redo2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Redo</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Re-apply the previously undone modification (Cmd+Y).
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* AI Generator assistant */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={() => setIsAiOpen(true)}
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl text-[10px] uppercase font-bold tracking-wider gap-1.5 border-border bg-muted hover:bg-accent text-muted-foreground active:scale-[0.97] transition-all duration-150"
                    >
                      <Wand2 className="h-3.5 w-3.5" /> AI Gen
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wand2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">AI Generator</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Generate call script layouts or refine dialogue content using AI assistance.
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* Simulation test configuration */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={() => setIsSimModalOpen(true)}
                      variant={simulationActive ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-9 rounded-xl text-[10px] uppercase font-bold tracking-wider gap-1.5 border-border active:scale-[0.97] transition-all duration-150",
                        simulationActive 
                          ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600/30" 
                          : "bg-muted hover:bg-accent text-muted-foreground"
                      )}
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> Test
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlayCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Simulation Test</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      {simulationActive 
                        ? "Simulation mode is active. Click to configure or disable simulated test values." 
                        : "Configure and start simulation mode to preview variables and test interactive scripts."}
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* Save script changes */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSave}
                      className="h-9 px-4 rounded-xl text-[10px] uppercase font-bold tracking-wider gap-1.5 active:scale-[0.97] transition-all duration-150"
                      disabled={isSaving}
                      type="button"
                    >
                      {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Save className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Save Script</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Save all modifications to the branching script layout and raw dialogue content.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>


        {/* Tab 1: Visual flowchart Editor */}
        <TabsContent value="flow" className="pt-3 m-0 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px] h-[calc(100dvh-220px)] overflow-hidden relative">

            {/* Center Canvas Container */}
            <div 
              className={cn(
                "relative border border-border bg-muted/20 rounded-2xl overflow-hidden h-full flex flex-col transition-all duration-300",
                rightPanelCollapsed ? "lg:col-span-12" : "lg:col-span-8"
              )}
            >
              {/* Floating Panel Toggle Button */}
              <Button
                type="button"
                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                variant="outline"
                size="icon"
                className="absolute right-4 top-4 z-20 h-8 w-8 rounded-lg border border-border bg-background/90 text-muted-foreground hover:text-foreground hover:bg-muted shadow-md backdrop-blur-sm transition-colors"
                title={rightPanelCollapsed ? "Expand right panel" : "Collapse right panel"}
              >
                {rightPanelCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              {/* ── Expandable Visual Node Toolbar ── */}
              {(() => {
                const NODE_TYPES = [
                  {
                    type: 'start',
                    label: 'Start Call',
                    description: 'Entry point for the call flow. Sets greeting rules and DNC checks before branching.',
                    icon: <PlayCircle className="h-4 w-4 shrink-0" />,
                    color: 'text-emerald-500',
                    hoverBg: 'hover:bg-emerald-500/10',
                    dot: 'bg-emerald-500',
                  },
                  {
                    type: 'script_block',
                    label: 'Say',
                    description: 'Agent reads a scripted statement to the contact. Supports dynamic variable pills.',
                    icon: <MessageSquare className="h-4 w-4 shrink-0" />,
                    color: 'text-blue-500',
                    hoverBg: 'hover:bg-blue-500/10',
                    dot: 'bg-blue-500',
                  },
                  {
                    type: 'question',
                    label: 'Ask',
                    description: 'Asks the contact a question and captures their answer into a CRM field.',
                    icon: <HelpCircle className="h-4 w-4 shrink-0" />,
                    color: 'text-amber-500',
                    hoverBg: 'hover:bg-amber-500/10',
                    dot: 'bg-amber-500',
                  },
                  {
                    type: 'objection',
                    label: 'Objection',
                    description: 'Handles a resistance or pushback from the contact with a rebuttal script.',
                    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
                    color: 'text-orange-500',
                    hoverBg: 'hover:bg-orange-500/10',
                    dot: 'bg-orange-500',
                  },
                  {
                    type: 'action',
                    label: 'Action',
                    description: 'Fires a background automation: webhook, tag, CRM update, or notification.',
                    icon: <Zap className="h-4 w-4 shrink-0" />,
                    color: 'text-indigo-500',
                    hoverBg: 'hover:bg-indigo-500/10',
                    dot: 'bg-indigo-500',
                  },
                  {
                    type: 'outcome',
                    label: 'Outcome',
                    description: 'Marks the result of the call (e.g. Interested, Not Now, DNC) and ends a branch.',
                    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
                    color: 'text-purple-500',
                    hoverBg: 'hover:bg-purple-500/10',
                    dot: 'bg-purple-500',
                  },
                  {
                    type: 'end',
                    label: 'End Call',
                    description: 'Closes the call script path. Triggers wrap-up sequence for the agent.',
                    icon: <XCircle className="h-4 w-4 shrink-0" />,
                    color: 'text-rose-500',
                    hoverBg: 'hover:bg-rose-500/10',
                    dot: 'bg-rose-500',
                  },
                ];

                return (
                  <div
                    className={cn(
                      'absolute left-4 top-16 z-20 flex flex-col',
                      'bg-background/95 border border-border rounded-2xl shadow-2xl backdrop-blur-sm',
                      'transition-all duration-300 ease-in-out overflow-hidden',
                      toolbarExpanded ? 'w-52' : 'w-12',
                    )}
                  >
                    {/* Toggle strip at top */}
                    <button
                      type="button"
                      onClick={() => setToolbarExpanded(v => !v)}
                      className="flex items-center justify-center gap-1.5 w-full px-2 py-2 border-b border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                      title={toolbarExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
                    >
                      {toolbarExpanded ? (
                        <>
                          <ChevronLeft className="h-3 w-3 shrink-0" />
                          <span className="text-[8px] font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden">Script Blocks</span>
                        </>
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>

                    {/* Node buttons */}
                    <TooltipProvider delayDuration={200}>
                      <div className="flex flex-col p-1.5 gap-0.5">
                        {NODE_TYPES.map(nt => (
                          <Tooltip key={nt.type}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleAddNode(nt.type)}
                                aria-label={`Add ${nt.label} node`}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-xl transition-all duration-150 text-left group',
                                  'px-2 py-1.5',
                                  nt.color,
                                  nt.hoverBg,
                                  'hover:shadow-sm',
                                )}
                              >
                                {/* Icon */}
                                <span className="shrink-0">{nt.icon}</span>

                                {/* Label + description — only in expanded mode */}
                                {toolbarExpanded && (
                                  <span className="flex flex-col min-w-0 overflow-hidden">
                                    <span className="text-[10px] font-bold leading-tight whitespace-nowrap text-foreground group-hover:text-inherit transition-colors">
                                      {nt.label}
                                    </span>
                                    <span className="text-[8px] text-muted-foreground/60 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                                      {nt.description.split('.')[0]}
                                    </span>
                                  </span>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              sideOffset={8}
                              className={cn(
                                'max-w-[200px] p-3 rounded-xl border border-border',
                                'bg-popover text-popover-foreground shadow-xl',
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={cn('shrink-0', nt.color)}>{nt.icon}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">{nt.label}</span>
                                <span className={cn('ml-auto w-1.5 h-1.5 rounded-full shrink-0', nt.dot)} />
                              </div>
                              <p className="text-[9px] text-muted-foreground leading-relaxed">{nt.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  </div>
                );
              })()}

              <div className="flex-grow w-full h-full">
                <VisualScriptCanvas
                  ref={canvasRef}
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                  onEdgeDelete={handleEdgeDelete}
                  onEdgeInsertNode={handleInsertNodeOnEdge}
                  onPaneClick={() => setSelectedNodeId(null)}
                  resolveText={simulationActive ? resolveSimulatedText : undefined}
                />
              </div>
            </div>

            {/* Right Panel: Canvas Warnings + Selected Node Properties Editor */}
            {!rightPanelCollapsed && (
              <div className="lg:col-span-4 h-full overflow-hidden flex flex-col gap-3">
                {/* Canvas Warnings Card */}
                {graphValidation.warnings.length > 0 && (
                  <Card className="border border-amber-500/20 bg-amber-500/5 rounded-2xl shrink-0">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Canvas Warnings ({graphValidation.warnings.length})</span>
                      </div>
                      <ul className="text-[9px] text-muted-foreground space-y-1 list-disc pl-4 leading-normal">
                        {graphValidation.warnings.slice(0, 3).map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                        {graphValidation.warnings.length > 3 && (
                          <li className="italic font-bold text-muted-foreground">And {graphValidation.warnings.length - 3} more...</li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {selectedNode ? (
                  <Card className="border border-border bg-card rounded-2xl flex flex-col justify-between flex-grow overflow-hidden">
                    <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-foreground truncate">Config node: "{selectedNode.data.label}"</h3>
                        <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">ID: {selectedNode.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TooltipProvider delayDuration={200}>
                          {simulationActive && selectedNode.type === 'action' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  disabled={isTestingAction}
                                  onClick={() => handleTestAction(selectedNode as ScriptNode)}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[9px] font-black uppercase tracking-wider border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 active:scale-[0.97] transition-all duration-150 rounded-lg"
                                >
                                  {isTestingAction ? (
                                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Zap className="h-3 w-3 mr-1" />
                                  )}
                                  Test Action
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Zap className="h-3.5 w-3.5 text-indigo-400" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Test Action Node</span>
                                </div>
                                <p className="text-[9px] text-muted-foreground leading-normal">
                                  Triggers this call automation against the simulated contact. <span className="font-bold text-rose-400">CAUTION:</span> Triggers real side effects.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {simulationActive && selectedNode.type === 'outcome' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  disabled={isTestingOutcome}
                                  onClick={() => handleTestOutcome(selectedNode as ScriptNode)}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[9px] font-black uppercase tracking-wider border-purple-500/30 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 active:scale-[0.97] transition-all duration-150 rounded-lg"
                                >
                                  {isTestingOutcome ? (
                                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Zap className="h-3 w-3 mr-1" />
                                  )}
                                  Test Outcome
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Zap className="h-3.5 w-3.5 text-purple-400" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Test Outcome</span>
                                </div>
                                <p className="text-[9px] text-muted-foreground leading-normal">
                                  Triggers the sequence of post-call automations in parallel. <span className="font-bold text-rose-400">CAUTION:</span> Triggers real side effects.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TooltipProvider>
                        {/* Hide delete button for start node — it cannot be removed */}
                        {selectedNode.type !== 'start' && (
                          <>
                            <Button
                              onClick={() => {
                                setNodeToClone(selectedNode);
                                setIsCloneDialogOpen(true);
                              }}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all duration-150 rounded-lg"
                              title="Clone Step"
                              type="button"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button onClick={handleDeleteSelectedNode} variant="ghost" size="icon" className="h-7 w-7 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><X className="h-4 w-4" /></Button>
                          </>
                        )}
                        {selectedNode.type === 'start' && (
                          <span className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest px-1">Protected</span>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-4 flex-grow overflow-y-auto space-y-4">
                      {renderNodeConfigPanel(selectedNode)}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-border bg-card rounded-2xl flex items-center justify-center p-8 text-center text-xs text-muted-foreground italic flex-grow min-h-[300px]">
                    Select a node on the canvas to configure its dialogue script and branching options.
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: List View split screen */}
        <TabsContent value="list" className="pt-3 m-0 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px] h-[calc(100dvh-220px)] overflow-hidden">
            {/* Left Column: Categories and Node List (col-span-4) */}
            <div className="lg:col-span-4 flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {/* Category tabs */}
              <div className="p-4 border-b border-border bg-muted/20 shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-3">Categories</span>
                <div className="grid grid-cols-5 gap-1 bg-muted p-1 rounded-xl border border-border/40">
                  {([
                    { key: 'say', label: 'Say' },
                    { key: 'ask', label: 'Ask' },
                    { key: 'objections', label: 'Objections' },
                    { key: 'actions', label: 'Actions' },
                    { key: 'outcomes', label: 'Outcomes' }
                  ] as const).map(cat => {
                    const isActive = listViewCategory === cat.key;
                    // Count nodes in this category
                    const count = nodes.filter(n => {
                      if (cat.key === 'say') return n.type === 'script_block';
                      if (cat.key === 'ask') return n.type === 'question';
                      if (cat.key === 'objections') return n.type === 'objection';
                      if (cat.key === 'actions') return n.type === 'action';
                      if (cat.key === 'outcomes') return n.type === 'outcome';
                      return false;
                    }).length;

                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setListViewCategory(cat.key)}
                        className={cn(
                          "py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all duration-150 active:scale-[0.97]",
                          isActive 
                            ? "bg-background text-foreground shadow-sm font-black border border-border/20" 
                            : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                        )}
                      >
                        <span className="block">{cat.label}</span>
                        <span className={cn(
                          "inline-block mt-0.5 px-1 rounded-full text-[8px] font-mono",
                          isActive ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground"
                        )}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Node List */}
              <div className="flex-grow overflow-y-auto p-4 space-y-2">
                {(() => {
                  const filteredNodes = nodes.filter(n => {
                    if (listViewCategory === 'say') return n.type === 'script_block';
                    if (listViewCategory === 'ask') return n.type === 'question';
                    if (listViewCategory === 'objections') return n.type === 'objection';
                    if (listViewCategory === 'actions') return n.type === 'action';
                    if (listViewCategory === 'outcomes') return n.type === 'outcome';
                    return false;
                  });

                  if (filteredNodes.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground/60 p-4">
                        <List className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-xs italic">No steps found in this category.</p>
                      </div>
                    );
                  }

                  return filteredNodes.map(node => {
                    const isSelected = selectedNodeId === node.id;
                    let typeLabel = node.type;
                    let typeColor = 'bg-zinc-500/10 text-zinc-500 border-zinc-500/25';
                    if (node.type === 'start') {
                      typeLabel = 'Start';
                      typeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';
                    } else if (node.type === 'script_block') {
                      typeLabel = 'Say';
                      typeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/25';
                    } else if (node.type === 'question') {
                      typeLabel = 'Ask';
                      typeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/25';
                    } else if (node.type === 'objection') {
                      typeLabel = 'Objection';
                      typeColor = 'bg-orange-500/10 text-orange-500 border-orange-500/25';
                    } else if (node.type === 'action') {
                      typeLabel = 'Action';
                      typeColor = 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25';
                    } else if (node.type === 'outcome') {
                      typeLabel = 'Outcome';
                      typeColor = 'bg-purple-500/10 text-purple-500 border-purple-500/25';
                    } else if (node.type === 'end') {
                      typeLabel = 'End';
                      typeColor = 'bg-rose-500/10 text-rose-500 border-rose-500/25';
                    }

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          canvasRef.current?.focusNode(node.id);
                        }}
                        className={cn(
                          "w-full text-left p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.97] flex flex-col gap-2 relative overflow-hidden group",
                          isSelected
                            ? "bg-accent/40 border-primary shadow-sm"
                            : "bg-background border-border/80 hover:bg-muted/40 hover:border-border"
                        )}
                      >
                        {/* Glow effect for selected node */}
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest font-bold">ID: {node.id}</span>
                          <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border", typeColor)}>
                            {typeLabel}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                          {node.data?.label || 'Untitled Step'}
                        </h4>
                        {node.data?.text && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {stripHtml(node.data.text)}
                          </p>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Right Column: Node Details Config Editor (col-span-8) */}
            <div className="lg:col-span-8 h-full flex flex-col overflow-hidden bg-card border border-border rounded-2xl shadow-sm">
              {selectedNode ? (
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-foreground uppercase tracking-wider truncate">
                        Step Properties: "{selectedNode.data?.label || 'Untitled Step'}"
                      </h3>
                      <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">
                        Node ID: {selectedNode.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TooltipProvider delayDuration={200}>
                        {!isListViewPreviewMode && simulationActive && selectedNode.type === 'action' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                disabled={isTestingAction}
                                onClick={() => handleTestAction(selectedNode as ScriptNode)}
                                variant="outline"
                                size="sm"
                                className="h-8 text-[10px] uppercase font-bold tracking-wider border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 active:scale-[0.97] transition-all duration-150 rounded-xl"
                              >
                                {isTestingAction ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                ) : (
                                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Test Action
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Zap className="h-3.5 w-3.5 text-indigo-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Test Action Node</span>
                              </div>
                              <p className="text-[9px] text-muted-foreground leading-normal">
                                Triggers this call automation against the simulated contact. <span className="font-bold text-rose-400">CAUTION:</span> Triggers real side effects.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {!isListViewPreviewMode && simulationActive && selectedNode.type === 'outcome' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                disabled={isTestingOutcome}
                                onClick={() => handleTestOutcome(selectedNode as ScriptNode)}
                                variant="outline"
                                size="sm"
                                className="h-8 text-[10px] uppercase font-bold tracking-wider border-purple-500/30 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 active:scale-[0.97] transition-all duration-150 rounded-xl"
                              >
                                {isTestingOutcome ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                ) : (
                                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Test Outcome
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[200px] p-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Zap className="h-3.5 w-3.5 text-purple-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Test Outcome</span>
                              </div>
                              <p className="text-[9px] text-muted-foreground leading-normal">
                                Triggers the sequence of post-call automations in parallel. <span className="font-bold text-rose-400">CAUTION:</span> Triggers real side effects.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>

                      <Button
                        onClick={() => setIsListViewPreviewMode(!isListViewPreviewMode)}
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] uppercase font-bold tracking-wider border-border hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all duration-150 rounded-xl"
                      >
                        {isListViewPreviewMode ? (
                          <>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Step
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                          </>
                        )}
                      </Button>

                      {selectedNode.type !== 'start' && (
                        <>
                          <Button
                            onClick={() => {
                              setNodeToClone(selectedNode);
                              setIsCloneDialogOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] uppercase font-bold tracking-wider border-border hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all duration-150 rounded-xl"
                            type="button"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Clone Step
                          </Button>
                          <Button
                            onClick={handleDeleteSelectedNode}
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[10px] uppercase font-bold tracking-wider text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Step
                          </Button>
                        </>
                      )}
                      {selectedNode.type === 'start' && (
                        <span className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full font-black">
                          Protected Entry
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden relative">
                    {/* Edit Panel Container */}
                    <div 
                      className={cn(
                        "absolute inset-0 overflow-y-auto p-6 transition-all duration-300 ease-in-out transform",
                        isListViewPreviewMode 
                          ? "opacity-0 translate-y-2 pointer-events-none scale-95" 
                          : "opacity-100 translate-y-0 scale-100"
                      )}
                    >
                      <div className="max-w-xl mx-auto py-2">
                        {renderNodeConfigPanel(selectedNode)}
                      </div>
                    </div>

                    {/* Preview Panel Container */}
                    <div 
                      className={cn(
                        "absolute inset-0 overflow-hidden transition-all duration-300 ease-in-out transform",
                        isListViewPreviewMode 
                          ? "opacity-100 translate-y-0 scale-100" 
                          : "opacity-0 -translate-y-2 pointer-events-none scale-95"
                      )}
                    >
                      <InteractiveScriptView
                        nodes={nodes as unknown as ScriptNode[]}
                        edges={edges as unknown as ScriptEdge[]}
                        hideSidebars={true}
                        activeNodeId={selectedNodeId}
                        onActiveNodeChange={setSelectedNodeId}
                        resolveText={resolveSimulatedText}
                        currentContact={simulatedEntityData?.entityContacts?.find(c => c.id === simulatedContactId) || simulatedEntityData?.entityContacts?.[0] || null}
                        entityData={simulatedEntityData}
                        triggeredIds={simulatedTriggeredIds}
                        onTriggerAction={handleSimulatedTriggerAction}
                        onTriggerOutcome={handleSimulatedTriggerOutcome}
                        triggerActionsAutomatically={false}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground italic min-h-[300px]">
                  <Layers className="h-10 w-10 mb-2 text-muted-foreground/40 animate-pulse" />
                  Select a script block from the list on the left to edit its dialogue text and branching configuration.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Interactive Script Simulator */}
        <TabsContent value="interactive" className="pt-3 m-0 outline-none">
          <InteractiveScriptView 
            nodes={nodes as unknown as ScriptNode[]} 
            edges={edges as unknown as ScriptEdge[]} 
            resolveText={resolveSimulatedText}
            currentContact={simulatedEntityData?.entityContacts?.find(c => c.id === simulatedContactId) || simulatedEntityData?.entityContacts?.[0] || null}
            entityData={simulatedEntityData}
            triggeredIds={simulatedTriggeredIds}
            onTriggerAction={handleSimulatedTriggerAction}
            onTriggerOutcome={handleSimulatedTriggerOutcome}
            triggerActionsAutomatically={false}
            onEndCall={() => {
              setSimulatedEntityId(null);
              setSimulatedEntityData(null);
              setSimulatedContactId(null);
              setSimulatedTriggeredIds(new Set());
            }}
          />
        </TabsContent>

        {/* Tab 3: Legacy plain text fallback editor */}
        <TabsContent value="text" className="pt-3 m-0 outline-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Script Text Editor</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Type <kbd className="font-mono text-[9px] bg-muted px-1 py-0.5 rounded border border-border mx-0.5">/</kbd> to insert variables. Click badges on the right panel to insert at cursor.</p>
            </div>
            <Button
              type="button"
              onClick={handleConvertToGraph}
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-[10px] uppercase font-bold border-border hover:bg-muted text-muted-foreground shrink-0"
            >
              Convert to Visual Flow
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-4 h-[640px]">
            {/* Left: Rich Script Editor */}
            <div className="col-span-9 flex flex-col overflow-hidden">
              <LegacyScriptEditor
                ref={legacyEditorRef}
                value={legacyText}
                onChange={setLegacyText}
                variableGroups={scriptVariableGroups}
                placeholder="Start typing your call script here…"
                richFormatting
                className="flex-grow"
              />
            </div>

            {/* Right: Variables Panel — scrollable list view */}
            <div className="col-span-3 flex flex-col overflow-hidden bg-card border border-border rounded-xl">
              {/* Panel header with tab switcher */}
              <div className="p-3 border-b border-border bg-muted/30 shrink-0">
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Available Variables</span>
                <div className="flex gap-1">
                  {(['entity', 'deal', 'used'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setVariableCategory(tab); }}
                      className={cn(
                        'flex-1 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-colors',
                        variableCategory === tab
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {tab === 'used' ? `Used (${detectedVariables.length})` : tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variable list — scrollable */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {variableCategory === 'entity' && (
                  <>
                    {/* Group header: native */}
                    <div className="px-2 pt-3 pb-1">
                      <span className="text-[7px] font-bold text-muted-foreground/50 uppercase tracking-widest">Native Fields</span>
                    </div>
                    {scriptVariableGroups[0]?.items
                      .slice(0, NATIVE_ENTITY_VAR_NAMES.length)
                      .map(v => (
                        <button
                          key={v}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); legacyEditorRef.current?.insertVariable(v); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2 group"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/30 group-hover:bg-primary shrink-0 transition-colors" />
                          {v}
                        </button>
                      ))
                    }
                    {/* Group header: custom (only if there are any) */}
                    {(scriptVariableGroups[0]?.items.length ?? 0) > NATIVE_ENTITY_VAR_NAMES.length && (
                      <>
                        <div className="px-2 pt-3 pb-1">
                          <span className="text-[7px] font-bold text-muted-foreground/50 uppercase tracking-widest">Custom Fields</span>
                        </div>
                        {scriptVariableGroups[0]?.items
                          .slice(NATIVE_ENTITY_VAR_NAMES.length)
                          .map(v => (
                            <button
                              key={v}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); legacyEditorRef.current?.insertVariable(v); }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2 group"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50 group-hover:bg-amber-400 shrink-0 transition-colors" />
                              {v}
                            </button>
                          ))
                        }
                      </>
                    )}
                    {(scriptVariableGroups[0]?.items.length ?? 0) === 0 && (
                      <p className="text-[9px] text-muted-foreground/60 italic px-2 py-3">No entity fields found.</p>
                    )}
                  </>
                )}

                {variableCategory === 'deal' && (
                  <>
                    <div className="px-2 pt-3 pb-1">
                      <span className="text-[7px] font-bold text-muted-foreground/50 uppercase tracking-widest">Deal Fields</span>
                    </div>
                    {scriptVariableGroups[1]?.items.map(v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); legacyEditorRef.current?.insertVariable(v); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2 group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 group-hover:bg-emerald-400 shrink-0 transition-colors" />
                        {v}
                      </button>
                    ))}
                  </>
                )}

                {variableCategory === 'used' && (
                  <>
                    <div className="px-2 pt-3 pb-1">
                      <span className="text-[7px] font-bold text-muted-foreground/50 uppercase tracking-widest">Used in this script</span>
                    </div>
                    {detectedVariables.length === 0 ? (
                      <p className="text-[9px] text-muted-foreground/60 italic px-2 py-3">No variables inserted yet. Type <kbd className="font-mono bg-muted px-1 rounded border border-border/50">/</kbd> to start.</p>
                    ) : detectedVariables.map(v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); legacyEditorRef.current?.insertVariable(v); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-2 group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary shrink-0 transition-colors" />
                        {v}
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Tip footer */}
              <div className="p-2.5 border-t border-border/50 bg-muted/20 shrink-0">
                <p className="text-[8px] text-muted-foreground/60 leading-relaxed">
                  Click any variable to insert at cursor. Type <kbd className="font-mono bg-muted px-1 rounded border border-border/40">/</kbd> in the editor for inline search.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>


      {/* AI Assist Modal */}
      {isAiOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">AI Script Assistant</h3>
                  <p className="text-[8px] text-muted-foreground font-mono tracking-widest uppercase">Powered by Claude Sonnet 4.6</p>
                </div>
              </div>
              <Button
                onClick={() => setIsAiOpen(false)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 flex-grow max-h-[70vh] overflow-y-auto">
              <div className="flex border border-border rounded-xl p-1 bg-muted">
                <button
                  type="button"
                  onClick={() => setAiTab('write')}
                  className={`flex-grow py-1.5 text-xs font-bold rounded-lg transition-all ${aiTab === 'write' ? 'bg-background text-foreground border border-border shadow' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Write Script
                </button>
                <button
                  type="button"
                  onClick={() => setAiTab('refine')}
                  className={`flex-grow py-1.5 text-xs font-bold rounded-lg transition-all ${aiTab === 'refine' ? 'bg-background text-foreground border border-border shadow' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Refine Existing
                </button>
              </div>

              {aiTab === 'write' ? (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Campaign Objective</Label>
                    <Input
                      value={aiObjective}
                      onChange={(e) => setAiObjective(e.target.value)}
                      placeholder="e.g., Book an admissions demo for next week"
                      className="bg-background border-border text-xs h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Target Audience</Label>
                    <Input
                      value={aiAudience}
                      onChange={(e) => setAiAudience(e.target.value)}
                      placeholder="e.g., Primary school headteachers and owners"
                      className="bg-background border-border text-xs h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Tone</Label>
                    <Select value={aiTone} onValueChange={setAiTone}>
                      <SelectTrigger className="bg-background border-border text-xs h-9 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        <SelectItem value="professional">Professional &amp; Direct</SelectItem>
                        <SelectItem value="warm">Warm &amp; Conversational</SelectItem>
                        <SelectItem value="urgent">Urgent &amp; Direct Value</SelectItem>
                        <SelectItem value="authoritative">Authoritative &amp; Confident</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Custom Guidelines (Optional)</Label>
                    <Textarea
                      value={aiGuidelines}
                      onChange={(e) => setAiGuidelines(e.target.value)}
                      placeholder="e.g., Mention Kwame from admissions, ask about fee collection pain points..."
                      rows={3}
                      className="bg-background border-border text-xs rounded-lg resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Refinement Instructions</Label>
                    <Textarea
                      value={refineInstructions}
                      onChange={(e) => setRefineInstructions(e.target.value)}
                      placeholder="e.g., Make it shorter, add objection handling for pricing, or translate to local slang..."
                      rows={5}
                      className="bg-background border-border text-xs rounded-lg resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAiOpen(false)}
                className="h-9 px-4 rounded-xl text-xs font-bold border-border bg-muted hover:bg-accent text-muted-foreground"
              >
                Cancel
              </Button>
              {aiTab === 'write' ? (
                <Button
                  type="button"
                  onClick={async () => {
                    if (!aiObjective.trim()) {
                      toast({ variant: 'destructive', title: 'Objective Required', description: 'Please define what the call is about.' });
                      return;
                    }
                    setIsAiLoading(true);
                    try {
                      const res = await generateCallScriptAction({
                        campaignName: name || 'AI Campaign',
                        objective: aiObjective,
                        targetAudience: aiAudience || 'Target contacts',
                        tone: aiTone,
                        customGuidelines: aiGuidelines,
                        workspaceId: activeWorkspaceId
                      }, user?.uid || '');
                      
                      if (res.success && res.script) {
                        const fallbackGraph = parseGraph(res.script);
                        setNodes(fallbackGraph.nodes);
                        setEdges(fallbackGraph.edges);
                        setLegacyText(res.script);
                        toast({ title: 'AI Script Generated', description: 'Visual conversation tree created from AI copy.' });
                        setIsAiOpen(false);
                      } else {
                        toast({ variant: 'destructive', title: 'Generation Failed', description: res.error });
                      }
                    } catch (err: any) {
                      toast({ variant: 'destructive', title: 'Error', description: err.message });
                    } finally {
                      setIsAiLoading(false);
                    }
                  }}
                  disabled={isAiLoading}
                  className="h-9 px-5 rounded-xl text-xs font-bold gap-1.5"
                >
                  {isAiLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Generate Flow
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={async () => {
                    if (!refineInstructions.trim()) {
                      toast({ variant: 'destructive', title: 'Instruction Required', description: 'Explain how you want to refine the script.' });
                      return;
                    }
                    setIsAiLoading(true);
                    try {
                      const res = await refineCallScriptAction({
                        original: editorTab === 'text' ? legacyText : JSON.stringify({ nodes, edges }),
                        instruction: refineInstructions,
                        workspaceId: activeWorkspaceId
                      }, user?.uid || '');
                      
                      if (res.success && res.refined) {
                        if (editorTab === 'text') {
                          setLegacyText(res.refined);
                          toast({ title: 'AI Script Refined', description: 'Plain text script updated.' });
                        } else {
                          if (isJsonGraph(res.refined)) {
                            const graph = parseGraph(res.refined);
                            setNodes(graph.nodes);
                            setEdges(graph.edges);
                          } else {
                            const fallbackGraph = parseGraph(res.refined);
                            setNodes(fallbackGraph.nodes);
                            setEdges(fallbackGraph.edges);
                          }
                          toast({ title: 'AI Script Refined', description: 'Visual script layout updated.' });
                        }
                        setIsAiOpen(false);
                      } else {
                        toast({ variant: 'destructive', title: 'Refinement Failed', description: res.error });
                      }
                    } catch (err: any) {
                      toast({ variant: 'destructive', title: 'Error', description: err.message });
                    } finally {
                      setIsAiLoading(false);
                    }
                  }}
                  disabled={isAiLoading}
                  className="h-9 px-5 rounded-xl text-xs font-bold gap-1.5"
                >
                  {isAiLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Apply Refinement
                </Button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Simulation settings modal */}
      {isSimModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSimModalOpen(false);
            }
          }}
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2.5">
                <PlayCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Simulation settings</h3>
                  <p className="text-[8px] text-muted-foreground font-mono tracking-widest uppercase">Preview script variable values</p>
                </div>
              </div>
              <Button
                onClick={() => setIsSimModalOpen(false)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 flex-grow">
              <p className="text-[11px] text-muted-foreground leading-normal">
                Select a simulated entity and contact from the workspace database to preview variable values inside the script.
              </p>
              
              <div className="space-y-4 pt-2">
                {/* Entity Combobox */}
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Simulated Entity</Label>
                  <EntityCombobox
                    value={simulatedEntityId}
                    className="h-10 text-xs font-semibold rounded-xl w-full"
                    placeholder="Search Entity..."
                    onChange={(val: string, entity?: SearchedEntity) => {
                      if (val === 'none' || !entity) {
                        setSimulatedEntityId(null);
                        setSimulatedEntityData(null);
                        setSimulatedContactId(null);
                      } else {
                        setSimulatedEntityId(val);
                        const resolvedContacts = entity.entityContacts && entity.entityContacts.length > 0
                          ? entity.entityContacts
                          : [
                              { id: 'c1', name: entity.displayName || 'Primary Contact', isPrimary: true, phone: entity.primaryPhone || '', email: entity.primaryEmail || '', typeKey: 'primary', order: 0, isSignatory: false }
                            ];
                        const { interests, ...cleanEntity } = entity;
                        setSimulatedEntityData({
                          ...cleanEntity,
                          name: entity.displayName || 'Unknown Entity',
                          primaryEmail: entity.primaryEmail || '',
                          primaryPhone: entity.primaryPhone || '',
                          entityContacts: resolvedContacts
                        });
                        setSimulatedContactId(resolvedContacts[0].id);
                      }
                    }}
                  />
                </div>

                {/* Contact Selector */}
                {simulatedEntityData?.entityContacts && (
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Simulated Contact</Label>
                    <Select
                      value={simulatedContactId || 'c1'}
                      onValueChange={setSimulatedContactId}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl bg-background border text-xs font-semibold">
                        <SelectValue placeholder="Select contact..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border bg-card text-popover-foreground">
                        {simulatedEntityData.entityContacts.map((c: EntityContact) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs font-semibold">
                            {c.name} {c.isPrimary ? '(Primary)' : c.isSignatory ? '(Signatory)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border bg-muted/20 flex justify-between gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSimModalOpen(false)}
                className="h-9 px-4 rounded-xl text-xs font-bold border-border bg-muted hover:bg-accent text-muted-foreground"
              >
                Close
              </Button>
              
              {simulationActive ? (
                <Button
                  type="button"
                  onClick={() => {
                    setSimulationActive(false);
                    setSimulatedTriggeredIds(new Set());
                    setIsSimModalOpen(false);
                    toast({ title: 'Simulation Stopped', description: 'Real-time variable values are now disabled.' });
                  }}
                  variant="destructive"
                  className="h-9 px-5 rounded-xl text-xs font-bold gap-1.5 active:scale-[0.97] transition-all duration-150"
                >
                  <StopCircle className="h-3.5 w-3.5" /> End Simulation
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    if (!simulatedEntityId) {
                      toast({ variant: 'destructive', title: 'No Entity Specified', description: 'Please choose an entity to simulate.' });
                      return;
                    }
                    setSimulationActive(true);
                    setIsSimModalOpen(false);
                    toast({ title: 'Simulation Active', description: 'Variable values in script body are now previewed.' });
                  }}
                  className="h-9 px-5 rounded-xl text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white active:scale-[0.97] transition-all duration-150"
                >
                  <Play className="h-3.5 w-3.5" /> Start Simulation
                </Button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Simulation details modal */}
      {isSimDetailsModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSimDetailsModalOpen(false);
            }
          }}
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2.5">
                <PlayCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Simulation Details</h3>
                  <p className="text-[8px] text-muted-foreground font-mono tracking-widest uppercase">Currently Active Mock Data</p>
                </div>
              </div>
              <Button
                onClick={() => setIsSimDetailsModalOpen(false)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-grow overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Simulated Entity card */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Entity Details</span>
                    <Badge variant="outline" className="text-[8px] uppercase font-extrabold text-muted-foreground px-1.5 py-0.5">
                      {activeEntity?.entityType || 'Institution'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Company / Name</div>
                      <div className="text-xs font-semibold text-foreground mt-0.5">{activeEntity?.name}</div>
                    </div>
                    
                    <div>
                      <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Email Address</div>
                      <div className="text-xs font-medium text-foreground/80 mt-0.5 break-all">{activeEntity?.primaryEmail || '—'}</div>
                    </div>
                    
                    <div>
                      <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Phone Number</div>
                      <div className="text-xs font-medium text-foreground/80 mt-0.5">{activeEntity?.primaryPhone || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Simulated Contact card */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Contact Details</span>
                    <Badge variant="outline" className="text-[8px] uppercase font-extrabold text-amber-500 bg-amber-500/5 border-amber-500/20 px-1.5 py-0.5">
                      {activeContact?.typeLabel || (activeContact?.isPrimary ? 'Primary' : 'Contact')}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Full Name</div>
                      <div className="text-xs font-semibold text-foreground mt-0.5">{activeContact?.name}</div>
                    </div>
                    
                    <div>
                      <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Role / Title</div>
                      <div className="text-xs font-medium text-foreground/80 mt-0.5">{activeContact?.role || activeContact?.typeLabel || 'Mock Contact'}</div>
                    </div>
                    
                    <div>
                      <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Direct Email</div>
                      <div className="text-xs font-medium text-foreground/80 mt-0.5 break-all">{activeContact?.email || '—'}</div>
                    </div>
                    
                    <div>
                      <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Direct Phone</div>
                      <div className="text-xs font-medium text-foreground/80 mt-0.5">{activeContact?.phone || '—'}</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border bg-muted/20 flex justify-between gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsSimDetailsModalOpen(false);
                  setIsSimModalOpen(true);
                }}
                className="h-9 px-4 rounded-xl text-xs font-bold border-border bg-background hover:bg-muted text-foreground gap-1.5"
              >
                <RefreshCw className="h-3 w-3" /> Change Entity
              </Button>
              
              <Button
                type="button"
                onClick={() => setIsSimDetailsModalOpen(false)}
                className="h-9 px-5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white active:scale-[0.97] transition-all duration-150"
              >
                Close
              </Button>
            </div>

          </div>
        </div>
      )}

      {isCloneDialogOpen && nodeToClone && (
        <Dialog open={isCloneDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsCloneDialogOpen(false);
            setNodeToClone(null);
          }
        }}>
          <DialogContent className="max-w-md p-6 bg-card border border-border shadow-2xl rounded-2xl">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Copy className="h-4 w-4 text-primary" />
                Clone Step
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-normal">
                How would you like to clone the step <strong>"{nodeToClone.data.label}"</strong>? You can clone only this step or duplicate the entire downstream conversation branch.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCloneDialogOpen(false);
                  setNodeToClone(null);
                }}
                className="text-[10px] uppercase font-bold tracking-wider border-border h-9 rounded-xl flex-grow sm:flex-grow-0"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCloneStep(false)}
                className="text-[10px] uppercase font-bold tracking-wider border-primary/20 text-primary hover:bg-primary/5 h-9 rounded-xl flex-grow"
              >
                Clone Step Only
              </Button>
              <Button
                onClick={() => handleCloneStep(true)}
                className="text-[10px] uppercase font-bold tracking-wider h-9 rounded-xl flex-grow"
              >
                Clone Step &amp; Subtree
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isDeleteDialogOpen && nodeToDelete && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsDeleteDialogOpen(false);
            setNodeToDelete(null);
          }
        }}>
          <DialogContent className="max-w-md p-6 bg-card border border-border shadow-2xl rounded-2xl">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-500" />
                Delete Step
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-normal">
                How would you like to delete the step <strong>"{nodeToDelete.data.label}"</strong>? Choose whether to delete only this step or to recursively delete this step and all its downstream branches.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setNodeToDelete(null);
                }}
                className="text-[10px] uppercase font-bold tracking-wider border-border h-9 rounded-xl flex-grow sm:flex-grow-0"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfirmDelete(false)}
                className="text-[10px] uppercase font-bold tracking-wider border-rose-500/20 text-rose-400 hover:bg-rose-500/5 h-9 rounded-xl flex-grow"
              >
                Delete Step Only
              </Button>
              <Button
                onClick={() => handleConfirmDelete(true)}
                variant="destructive"
                className="text-[10px] uppercase font-bold tracking-wider h-9 rounded-xl flex-grow"
              >
                Delete Step &amp; Subtree
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isInsertNodeDialogOpen && activeInsertEdgeId && (
        <Dialog open={isInsertNodeDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsInsertNodeDialogOpen(false);
            setActiveInsertEdgeId(null);
          }
        }}>
          <DialogContent className="max-w-md p-6 bg-card border border-border shadow-2xl rounded-2xl">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary animate-pulse" />
                Insert Step
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-normal">
                Choose a step type to insert into the selected connection. The edge will be spliced into incoming and outgoing connections automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-2.5 my-4">
              {[
                { type: 'script_block', label: 'Script Block', desc: 'Readout dialogues, prompts or text-only messages.', color: 'text-zinc-400 bg-zinc-500/5 hover:bg-zinc-500/10 border-zinc-500/20' },
                { type: 'question', label: 'Question / Choices', desc: 'Ask questions and define branching choices.', color: 'text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20' },
                { type: 'objection', label: 'Objection Handle', desc: 'Handle rebuttals and customer pushbacks.', color: 'text-orange-500 bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/20' },
                { type: 'action', label: 'Automation Action', desc: 'Trigger SMS, Tasks, Webhooks dynamically.', color: 'text-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/20' },
                { type: 'outcome', label: 'Outcome Finalizer', desc: 'Complete call and tag workspace contact.', color: 'text-purple-500 bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/20' }
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleConfirmInsertNode(opt.type)}
                  className={[
                    'w-full flex flex-col text-left p-3 rounded-xl border transition-all duration-150 active:scale-[0.98]',
                    opt.color
                  ].join(' ')}
                >
                  <span className="text-xs font-black uppercase tracking-wider">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{opt.desc}</span>
                </button>
              ))}
            </div>

            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsInsertNodeDialogOpen(false);
                  setActiveInsertEdgeId(null);
                }}
                className="text-[10px] uppercase font-bold tracking-wider border-border h-9 rounded-xl w-full"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      </Tabs>
    </PageContainer>
  );
}

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
  refineCallScriptAction
} from '@/lib/call-centre-actions';
import { isJsonGraph, parseGraph, validateScriptGraph, extractPreviewText } from '@/lib/call-centre-graph';
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
  MessageSquare,
  HelpCircle,
  Zap,
  Layers
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { Node, Edge } from 'reactflow';
import { addEdge, useNodesState, useEdgesState } from 'reactflow';
import { ScriptPlaybookView } from '../components/ScriptPlaybookView';
import { LegacyScriptEditor } from '../components/LegacyScriptEditor';
import type { LegacyScriptEditorHandle, VariableGroup } from '../components/LegacyScriptEditor';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { cn } from '@/lib/utils';
import type { ScriptNode, ScriptEdge, ScriptNodeType } from '@/lib/types';
import type { VisualScriptCanvasHandle, VisualScriptCanvasProps } from '../components/VisualScriptCanvas';

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
  'ENTITY_NAME', 'ENTITY_EMAIL', 'ENTITY_PHONE', 'ENTITY_TYPE',
  'PRIMARY_CONTACT_NAME', 'PRIMARY_CONTACT_PHONE', 'AGENT_NAME',
  'STATUS', 'LOCATION', 'CURRENT_NEEDS', 'CURRENT_CHALLENGES',
  'INITIALS', 'SLOGAN', 'CAPACITY', 'CURRENCY', 'SUBSCRIPTION_RATE',
  'WEBSITE', 'DIGITAL_ADDRESS', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM',
  'LINKEDIN', 'X_TWITTER', 'YOUTUBE', 'TIKTOK',
  'FIRST_NAME', 'LAST_NAME', 'COMPANY', 'JOB_TITLE', 'LEAD_SOURCE',
];

const NATIVE_DEAL_VAR_NAMES = [
  'DEAL_NAME', 'DEAL_VALUE', 'DEAL_STAGE', 'DEAL_STATUS', 'DEAL_EXPECTED_CLOSE',
];

interface ScriptBuilderClientProps {
  scriptId?: string;
  returnCampaignId?: string;
}

export function ScriptBuilderClient({ scriptId, returnCampaignId }: ScriptBuilderClientProps) {
  const router = useRouter();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [name, setName] = React.useState('Untitled Script');
  const [description, setDescription] = React.useState('Script Description Here');
  useSetBreadcrumb(scriptId ? `Edit Script: ${name}` : 'New Script');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [isEditingDesc, setIsEditingDesc] = React.useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = React.useState(false);
  const [toolbarExpanded, setToolbarExpanded] = React.useState(false);
  
  // Editor tabs: 'flow' (visual), 'playbook' (outline), 'text' (legacy raw text)
  const [editorTab, setEditorTab] = React.useState<'flow' | 'playbook' | 'text'>('flow');

  // Branching graph state
  const [nodes, setNodes, _onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  // Guard: prevent the start node from being removed by any change event (e.g. keyboard delete)
  const onNodesChange = React.useCallback<typeof _onNodesChange>((changes) => {
    const safe = changes.filter(c => {
      if (c.type === 'remove') {
        const target = nodes.find(n => n.id === c.id);
        if (target?.type === 'start') return false; // block
      }
      return true;
    });
    _onNodesChange(safe);
  }, [_onNodesChange, nodes]);

  // Legacy fallback text state
  const [legacyText, setLegacyText] = React.useState('');
  const legacyEditorRef = React.useRef<LegacyScriptEditorHandle>(null);
  // Node dialogue body editor ref (for the visual flow node inspector)
  const nodeEditorRef = React.useRef<LegacyScriptEditorHandle>(null);
  // Canvas Ref to retrieve bottom-center viewport coordinate for dropping new steps
  const canvasRef = React.useRef<VisualScriptCanvasHandle>(null);
  
  // Ref to track if DB loading/seeding is complete to enable autosaving changes
  const hasLoadedRef = React.useRef(false);

  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

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
        version: 1,
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
    const defaultData: Record<string, any> = {
      label: `New ${type.replace('_', ' ')}`,
      text: type === 'start' ? 'Start of call outreach.' : type === 'end' ? 'End of call.' : 'Script body text.',
    };
    // Question nodes always start with Yes / No options
    if (type === 'question') {
      defaultData.options = ['Yes', 'No'];
      defaultData.text = 'Ask your question here…';
      defaultData.label = 'New question';
    }

    // Position at bottom center of the current canvas viewport if available
    const position = canvasRef.current
      ? canvasRef.current.getDropPosition()
      : { x: 150 + Math.random() * 50, y: 150 + Math.random() * 50 };

    const newNode: Node = {
      id,
      type,
      position,
      data: defaultData,
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(id);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    const target = nodes.find(n => n.id === selectedNodeId);
    if (target?.type === 'start') {
      toast({ variant: 'destructive', title: 'Cannot delete Start node', description: 'The Start trigger is required and cannot be removed.' });
      return;
    }
    setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
    setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

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
        actionConfig: n.data.actionConfig,
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

  // ─── Save Action Handler ───────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Script name is required' });
      return;
    }

    let finalContent = '';
    let finalVariables = detectedVariables;

    if (editorTab === 'flow' || editorTab === 'playbook') {
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
        onValueChange={(v: any) => {
          if (v === 'text') {
            const plainText = extractPreviewText(JSON.stringify(cleanGraph), '\n\n');
            setLegacyText(plainText);
          }
          setEditorTab(v);
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
                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                  <h1 className="text-xl font-black uppercase text-foreground tracking-wider">
                    {name || 'Untitled Script'}
                  </h1>
                  <Pencil className="h-3.5 w-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-300" />
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
                value="playbook" 
                className="rounded-lg text-[10px] font-bold px-3 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground transition-colors"
              >
                <List className="h-3.5 w-3.5 mr-1" />
                Playbook Outline
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

            <Button
              type="button"
              onClick={() => setIsAiOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-[10px] uppercase font-bold tracking-wider gap-1.5 border-border bg-muted hover:bg-accent text-muted-foreground"
            >
              <Wand2 className="h-3.5 w-3.5" /> AI Generator
            </Button>

            <Button
              onClick={handleSave}
              className="h-9 px-5 rounded-xl text-[10px] uppercase font-bold tracking-wider gap-1.5"
              disabled={isSaving}
              type="button"
            >
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Script
            </Button>
          </div>
        </div>

        {/* Tab 1: Visual flowchart Editor */}
        <TabsContent value="flow" className="pt-3 m-0 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[680px] overflow-hidden relative">

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
                      {/* Hide delete button for start node — it cannot be removed */}
                      {selectedNode.type !== 'start' && (
                        <Button onClick={handleDeleteSelectedNode} variant="ghost" size="icon" className="h-7 w-7 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><X className="h-4 w-4" /></Button>
                      )}
                      {selectedNode.type === 'start' && (
                        <span className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest px-1">Protected</span>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-4 overflow-y-auto flex-grow">
                      
                      {/* Node Label Title */}
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Title label</Label>
                        <Input
                          value={selectedNode.data.label || ''}
                          onChange={(e) => updateSelectedNode({ label: e.target.value })}
                          className="h-8 bg-background border-border rounded-lg text-xs"
                        />
                      </div>

                      {/* Start Node Configuration */}
                      {selectedNode.type === 'start' && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Start Configuration</span>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-foreground/80">Check DNC List</Label>
                            <input 
                              type="checkbox"
                              checked={selectedNode.data.startConfig?.checkDnc || false}
                              onChange={(e) => updateSelectedNode({ 
                                startConfig: { ...selectedNode.data.startConfig, checkDnc: e.target.checked } 
                              })}
                              className="rounded border-border bg-background text-primary focus:ring-0"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-foreground/80">Guard Timezones</Label>
                            <input 
                              type="checkbox"
                              checked={selectedNode.data.startConfig?.checkTimezone || false}
                              onChange={(e) => updateSelectedNode({ 
                                startConfig: { ...selectedNode.data.startConfig, checkTimezone: e.target.checked } 
                              })}
                              className="rounded border-border bg-background text-primary focus:ring-0"
                            />
                          </div>
                          {selectedNode.data.startConfig?.checkTimezone && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[8px] font-bold text-muted-foreground uppercase">Start (HH:MM)</Label>
                                <Input
                                  value={selectedNode.data.startConfig?.allowedHoursStart || '08:00'}
                                  onChange={(e) => updateSelectedNode({ 
                                    startConfig: { ...selectedNode.data.startConfig, allowedHoursStart: e.target.value } 
                                  })}
                                  placeholder="08:00"
                                  className="h-8 bg-background border-border rounded-lg text-xs px-2"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[8px] font-bold text-muted-foreground uppercase">End (HH:MM)</Label>
                                <Input
                                  value={selectedNode.data.startConfig?.allowedHoursEnd || '20:00'}
                                  onChange={(e) => updateSelectedNode({ 
                                    startConfig: { ...selectedNode.data.startConfig, allowedHoursEnd: e.target.value } 
                                  })}
                                  placeholder="20:00"
                                  className="h-8 bg-background border-border rounded-lg text-xs px-2"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Say/Script Block Node Configuration */}
                      {selectedNode.type === 'script_block' && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Say Configuration</span>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-foreground/80">Verify compliance read</Label>
                            <input 
                              type="checkbox"
                              checked={selectedNode.data.sayConfig?.complianceVerify || false}
                              onChange={(e) => updateSelectedNode({ 
                                sayConfig: { ...selectedNode.data.sayConfig, complianceVerify: e.target.checked } 
                              })}
                              className="rounded border-border bg-background text-primary focus:ring-0"
                            />
                          </div>
                          {selectedNode.data.sayConfig?.complianceVerify && (
                            <div className="space-y-1">
                              <Label className="text-[8px] font-bold text-muted-foreground uppercase">Compliance Text Required</Label>
                              <Textarea
                                value={selectedNode.data.sayConfig?.complianceText || ''}
                                onChange={(e) => updateSelectedNode({ 
                                  sayConfig: { ...selectedNode.data.sayConfig, complianceText: e.target.value } 
                                })}
                                placeholder="Legal notice or disclosures agents must read verbatim..."
                                rows={3}
                                className="bg-background border-border rounded-xl text-xs p-2.5 resize-none"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Question Node Configuration */}
                      {selectedNode.type === 'question' && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Answer Options</span>
                            <span className="text-[8px] text-muted-foreground/50">Each option = 1 exit path</span>
                          </div>

                          {/* Options list */}
                          <div className="space-y-1.5">
                            {(selectedNode.data.options || ['Yes', 'No']).map((opt: string, i: number) => (
                              <div key={i} className="flex items-center gap-2">
                                {/* Coloured index dot */}
                                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[8px] font-black flex items-center justify-center shrink-0">
                                  {i + 1}
                                </span>
                                <Input
                                  value={opt}
                                  onChange={(e) => {
                                    const updated = [...(selectedNode.data.options || ['Yes', 'No'])];
                                    updated[i] = e.target.value;
                                    updateSelectedNode({ options: updated });
                                  }}
                                  placeholder={`Option ${i + 1}`}
                                  className="h-7 bg-background border-border rounded-lg text-xs px-2 flex-1"
                                />
                                {/* Remove — only if more than 2 options */}
                                {(selectedNode.data.options || ['Yes', 'No']).length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...(selectedNode.data.options || ['Yes', 'No'])];
                                      updated.splice(i, 1);
                                      // also remove edges that used this handle
                                      setEdges(eds => eds.filter(e =>
                                        !(e.source === selectedNode.id && e.sourceHandle === `option-${i}`)
                                      ));
                                      updateSelectedNode({ options: updated });
                                    }}
                                    className="text-rose-400 hover:text-rose-500 p-0.5 rounded hover:bg-rose-500/10 transition-colors shrink-0"
                                    title="Remove option"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add option button */}
                          <button
                            type="button"
                            onClick={() => {
                              const current = selectedNode.data.options || ['Yes', 'No'];
                              updateSelectedNode({ options: [...current, ''] });
                            }}
                            className="w-full h-7 rounded-lg border border-dashed border-amber-500/40 text-amber-400 text-[9px] font-bold uppercase tracking-wider hover:bg-amber-500/5 hover:border-amber-500/70 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Plus className="h-3 w-3" /> Add Option
                          </button>

                          {/* Info tip */}
                          <p className="text-[8px] text-muted-foreground/50 leading-relaxed">
                            Connect each option’s exit dot to the next step in the conversation. Minimum 2 options required.
                          </p>
                        </div>
                      )}

                      {/* Objection Node Configuration */}
                      {selectedNode.type === 'objection' && (() => {
                        // Normalise: always work from the objections[] list
                        const objections: Array<{ title: string; keywordTriggers: string[]; description: string }> =
                          selectedNode.data.objectionConfig?.objections ?? [
                            {
                              title: '',
                              keywordTriggers: selectedNode.data.objectionConfig?.keywordTriggers ?? [],
                              description: selectedNode.data.text ?? '',
                            },
                          ];

                        const updateObjection = (
                          idx: number,
                          patch: Partial<{ title: string; keywordTriggers: string[]; description: string }>
                        ) => {
                          const updated = objections.map((o, i) => (i === idx ? { ...o, ...patch } : o));
                          updateSelectedNode({
                            objectionConfig: {
                              ...selectedNode.data.objectionConfig,
                              objections: updated,
                            },
                          });
                        };

                        const addObjection = () => {
                          const updated = [...objections, { title: '', keywordTriggers: [], description: '' }];
                          updateSelectedNode({
                            objectionConfig: {
                              ...selectedNode.data.objectionConfig,
                              objections: updated,
                            },
                          });
                        };

                        const removeObjection = (idx: number) => {
                          if (objections.length <= 1) return; // keep at least one
                          const updated = objections.filter((_, i) => i !== idx);
                          updateSelectedNode({
                            objectionConfig: {
                              ...selectedNode.data.objectionConfig,
                              objections: updated,
                            },
                          });
                        };

                        return (
                          <div className="space-y-3 pt-3 border-t border-border">
                            {/* Header row */}
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                Objection Handlers
                              </span>
                              <span className="text-[8px] text-muted-foreground/50">{objections.length} entr{objections.length === 1 ? 'y' : 'ies'}</span>
                            </div>

                            {/* Objection entry list */}
                            <div className="space-y-3">
                              {objections.map((obj, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 relative"
                                >
                                  {/* Entry index badge + remove button */}
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">
                                      Objection #{idx + 1}
                                    </span>
                                    {objections.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeObjection(idx)}
                                        className="text-rose-400 hover:text-rose-500 p-0.5 rounded hover:bg-rose-500/10 transition-colors shrink-0"
                                        title="Remove this objection"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>

                                  {/* Title */}
                                  <div className="space-y-1">
                                    <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                                      Title / Name
                                    </Label>
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
                                    {/* Keyword pills preview */}
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

                                  {/* Description / response script — full rich editor with / variable support */}
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
                                      className=""
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Add objection button */}
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
                        );
                      })()}

                      {/* Outcome Node Configuration */}
                      {selectedNode.type === 'outcome' && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Outcome Configuration</span>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Map Call Outcome Tag</Label>
                            <Select 
                              value={selectedNode.data.outcomeValue || 'Interested'} 
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
                              value={selectedNode.data.outcomeConfig?.suppressDays || 0}
                              onChange={(e) => updateSelectedNode({ 
                                outcomeConfig: { ...selectedNode.data.outcomeConfig, suppressDays: Number(e.target.value) || 0 } 
                              })}
                              className="h-8 bg-background border-border rounded-lg text-xs px-2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Transfer to Campaign ID (Optional)</Label>
                            <Input
                              value={selectedNode.data.outcomeConfig?.followUpCampaignId || ''}
                              onChange={(e) => updateSelectedNode({ 
                                outcomeConfig: { ...selectedNode.data.outcomeConfig, followUpCampaignId: e.target.value } 
                              })}
                              placeholder="campaign_id_to_transfer"
                              className="h-8 bg-background border-border rounded-lg text-xs px-2"
                            />
                          </div>
                        </div>
                      )}

                      {/* Action Node Configuration */}
                      {selectedNode.type === 'action' && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Action Configuration</span>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Automation Trigger Type</Label>
                            <Select 
                              value={selectedNode.data.actionType || 'SEND_SMS'} 
                              onValueChange={(val) => updateSelectedNode({ 
                                actionType: val, 
                                label: `Action: ${val.replace('_', ' ')}` 
                              })}
                            >
                              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border-border text-popover-foreground">
                                <SelectItem value="SEND_SMS">Send SMS</SelectItem>
                                <SelectItem value="SEND_EMAIL">Send Email</SelectItem>
                                <SelectItem value="CREATE_TASK">Create Follow-up Task</SelectItem>
                                <SelectItem value="CHANGE_STAGE">Change CRM Pipeline Stage</SelectItem>
                                <SelectItem value="WEBHOOK">Trigger Custom HTTP Webhook</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedNode.data.actionType === 'WEBHOOK' && (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label className="text-[8px] font-bold text-muted-foreground uppercase">Webhook Target URL</Label>
                                <Input
                                  value={selectedNode.data.actionConfig?.webhookUrl || ''}
                                  onChange={(e) => updateSelectedNode({ 
                                    actionConfig: { ...selectedNode.data.actionConfig, webhookUrl: e.target.value } 
                                  })}
                                  placeholder="https://api.thirdparty.com/webhook"
                                  className="h-8 bg-background border-border rounded-lg text-xs px-2"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[8px] font-bold text-muted-foreground uppercase">Custom Headers (JSON format)</Label>
                                <Textarea
                                  value={selectedNode.data.actionConfig?.webhookHeaders || ''}
                                  onChange={(e) => updateSelectedNode({ 
                                    actionConfig: { ...selectedNode.data.actionConfig, webhookHeaders: e.target.value } 
                                  })}
                                  placeholder='{ "Authorization": "Bearer key" }'
                                  rows={2}
                                  className="bg-background border-border rounded-xl text-xs p-2 resize-none"
                                />
                              </div>
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Trigger Delay (Seconds)</Label>
                            <Input
                              type="number"
                              value={selectedNode.data.actionConfig?.triggerDelaySeconds || 0}
                              onChange={(e) => updateSelectedNode({ 
                                actionConfig: { ...selectedNode.data.actionConfig, triggerDelaySeconds: Number(e.target.value) || 0 } 
                              })}
                              className="h-8 bg-background border-border rounded-lg text-xs px-2"
                            />
                          </div>
                        </div>
                      )}

                      {/* End Node Configuration */}
                      {selectedNode.type === 'end' && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">End Call Configuration</span>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Post-Call Wrap-Up Template ID</Label>
                            <Input
                              value={selectedNode.data.endConfig?.wrapUpTemplateId || ''}
                              onChange={(e) => updateSelectedNode({ 
                                endConfig: { ...selectedNode.data.endConfig, wrapUpTemplateId: e.target.value } 
                              })}
                              placeholder="default_wrap_up"
                              className="h-8 bg-background border-border rounded-lg text-xs px-2"
                            />
                          </div>
                        </div>
                      )}

                      {/* Dialogue body editor — hidden for objection nodes (each entry has its own description) */}
                      {selectedNode.type !== 'objection' && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Dialogue script body</Label>
                            <span className="text-[8px] text-muted-foreground/50 font-mono">
                              type <kbd className="bg-muted px-1 rounded border border-border/50">/</kbd> to insert variables
                            </span>
                          </div>
                          <LegacyScriptEditor
                            ref={nodeEditorRef}
                            value={selectedNode.data.text || ''}
                            onChange={(val) => updateSelectedNode({ text: val })}
                            variableGroups={scriptVariableGroups}
                            placeholder="Type dialog block script here…"
                            className=""
                          />
                        </div>
                      )}

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

        {/* Tab 2: Playbook Outline Preview */}
        <TabsContent value="playbook" className="pt-6 m-0 outline-none">
          <Card className="border border-border bg-card rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">Playbook Outline Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ScriptPlaybookView graph={cleanGraph} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Interactive Script Simulator */}
        <TabsContent value="interactive" className="pt-3 m-0 outline-none">
          <InteractiveScriptView nodes={nodes} edges={edges} />
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

      </Tabs>
    </PageContainer>
  );
}

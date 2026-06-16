'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { 
  createCallScriptAction, 
  updateCallScriptAction, 
  getCallScriptAction,
  generateCallScriptAction,
  refineCallScriptAction
} from '@/lib/call-centre-actions';
import { isJsonGraph, parseGraph, validateScriptGraph } from '@/lib/call-centre-graph';
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
  Zap
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { Node, Edge } from 'reactflow';
import { addEdge, useNodesState, useEdgesState } from 'reactflow';
import { ScriptPlaybookView } from '../components/ScriptPlaybookView';
import { cn } from '@/lib/utils';
import type { ScriptNode, ScriptEdge, ScriptNodeType } from '@/lib/types';

// Lazy load the ReactFlow canvas to optimize initial bundle sizes
const VisualScriptCanvas = dynamic(
  () => import('../components/VisualScriptCanvas').then(mod => mod.VisualScriptCanvas),
  { ssr: false, loading: () => <div className="h-[550px] bg-muted/20 border border-border rounded-2xl flex items-center justify-center text-muted-foreground">Loading Flow Canvas...</div> }
);

interface ScriptBuilderClientProps {
  scriptId?: string;
}

export function ScriptBuilderClient({ scriptId }: ScriptBuilderClientProps) {
  const router = useRouter();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
  const { toast } = useToast();

  const [name, setName] = React.useState('Untitled Script');
  const [description, setDescription] = React.useState('Script Description Here');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [isEditingDesc, setIsEditingDesc] = React.useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = React.useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = React.useState(false);
  
  // Editor tabs: 'flow' (visual), 'playbook' (outline), 'text' (legacy raw text)
  const [editorTab, setEditorTab] = React.useState<'flow' | 'playbook' | 'text'>('flow');

  // Branching graph state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  // Legacy fallback text state
  const [legacyText, setLegacyText] = React.useState('');

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
  const [variableCategory, setVariableCategory] = React.useState<'entity' | 'deal'>('entity');

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
    const newNode: Node = {
      id,
      type,
      position: { x: 150 + Math.random() * 50, y: 150 + Math.random() * 50 },
      data: { 
        label: `New ${type.replace('_', ' ')}`, 
        text: type === 'start' ? 'Start of call outreach.' : type === 'end' ? 'End of call.' : 'Script body text.' 
      }
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(id);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
    setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

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

  // Variable selector clicked
  const handleInsertVariable = (variable: string) => {
    if (editorTab === 'text') {
      setLegacyText(prev => prev + ` {{${variable}}}`);
    } else if (selectedNode) {
      const currentText = selectedNode.data.text || '';
      updateSelectedNode({ text: currentText + ` {{${variable}}}` });
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
      }
    }));

    const cleanEdges: ScriptEdge[] = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined
    }));

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
          router.push(wrapHref('/admin/messaging/call-centre?tab=scripts'));
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
          router.push(wrapHref('/admin/messaging/call-centre?tab=scripts'));
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
    <PageContainer>
      <Tabs defaultValue="flow" value={editorTab} onValueChange={(v: any) => setEditorTab(v)} className="w-full space-y-8 max-w-7xl mx-auto">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push(wrapHref('/admin/messaging/call-centre?tab=scripts'))}
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
                value="text" 
                className="rounded-lg text-[10px] font-bold px-3 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Legacy Text
              </TabsTrigger>
            </TabsList>

            {editorTab === 'flow' && (
              <Button
                type="button"
                onClick={() => setIsAiOpen(true)}
                variant="outline"
                size="sm"
                className="h-9 rounded-xl text-[10px] uppercase font-bold tracking-wider gap-1.5 border-border bg-muted hover:bg-accent text-muted-foreground"
              >
                <Wand2 className="h-3.5 w-3.5" /> AI Generator
              </Button>
            )}

            <Button
              onClick={handleSave}
              className="h-9 px-5 rounded-xl text-[10px] uppercase font-bold tracking-wider gap-1.5"
              disabled={isSaving}
              type="button"
            >
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Flow
            </Button>
          </div>
        </div>

        {/* Tab 1: Visual flowchart Editor */}
        <TabsContent value="flow" className="pt-6 m-0 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[650px] overflow-hidden relative">
            
            {/* Left Panel: Warnings & Active Placeholders Detected */}
            {!leftPanelCollapsed && (
              <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-1 h-full select-none">
                {/* Validation Warnings */}
                {graphValidation.warnings.length > 0 && (
                  <Card className="border border-amber-500/20 bg-amber-500/5 rounded-2xl shrink-0">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 uppercase tracking-wider">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Canvas Warnings ({graphValidation.warnings.length})</span>
                      </div>
                      <ul className="text-[10px] text-muted-foreground space-y-1.5 list-disc pl-4 leading-normal">
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

                {/* Active Placeholders Detected */}
                <Card className="border border-border bg-card rounded-2xl flex-grow overflow-y-auto">
                  <CardContent className="p-4 space-y-3">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
                      Active Placeholders Detected ({detectedVariables.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {detectedVariables.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground italic">No curly-brace placeholders detected in nodes.</span>
                      ) : (
                        detectedVariables.map(v => (
                          <Badge key={v} variant="outline" className="text-[8px] font-bold bg-muted border-border text-muted-foreground tracking-wider px-2 py-0.5 rounded">
                            {v}
                          </Badge>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Center Canvas Container */}
            <div 
              className={cn(
                "relative border border-border bg-muted/20 rounded-2xl overflow-hidden h-full flex flex-col transition-all duration-300",
                (leftPanelCollapsed && rightPanelCollapsed) ? "lg:col-span-12" :
                (leftPanelCollapsed && !rightPanelCollapsed) ? "lg:col-span-9" :
                (!leftPanelCollapsed && rightPanelCollapsed) ? "lg:col-span-9" :
                "lg:col-span-6"
              )}
            >
              {/* Floating Panels Toggle Buttons */}
              <Button
                type="button"
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                variant="outline"
                size="icon"
                className="absolute left-4 top-4 z-20 h-8 w-8 rounded-lg border border-border bg-background/90 text-muted-foreground hover:text-foreground hover:bg-muted shadow-md backdrop-blur-sm transition-colors"
                title={leftPanelCollapsed ? "Expand left panel" : "Collapse left panel"}
              >
                {leftPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>

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

              {/* Floating Visual Node Toolbar (Figma-style) */}
              <div className="absolute left-4 top-16 z-20 flex flex-col gap-1.5 p-1.5 bg-background/95 border border-border rounded-xl shadow-2xl backdrop-blur-sm">
                <TooltipProvider delayDuration={150}>
                  {/* Start Node */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => handleAddNode('start')}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
                        aria-label="Add Start Node"
                      >
                        <PlayCircle className="h-4.5 w-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-[9px] font-black uppercase tracking-wider">
                      Add Start Node
                    </TooltipContent>
                  </Tooltip>

                  {/* Say Node */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => handleAddNode('script_block')}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-blue-500 hover:bg-blue-500/10 hover:text-blue-405 transition-colors"
                        aria-label="Add Say Node"
                      >
                        <MessageSquare className="h-4.5 w-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-[9px] font-black uppercase tracking-wider">
                      Add Say Node
                    </TooltipContent>
                  </Tooltip>

                  {/* Ask Node */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => handleAddNode('question')}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                        aria-label="Add Ask Node"
                      >
                        <HelpCircle className="h-4.5 w-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-[9px] font-black uppercase tracking-wider">
                      Add Ask Node
                    </TooltipContent>
                  </Tooltip>

                  {/* Objection Node */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => handleAddNode('objection')}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 transition-colors"
                        aria-label="Add Objection Node"
                      >
                        <AlertTriangle className="h-4.5 w-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-[9px] font-black uppercase tracking-wider">
                      Add Objection Node
                    </TooltipContent>
                  </Tooltip>

                  {/* Action Node */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => handleAddNode('action')}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
                        aria-label="Add Action Node"
                      >
                        <Zap className="h-4.5 w-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-[9px] font-black uppercase tracking-wider">
                      Add Action Node
                    </TooltipContent>
                  </Tooltip>

                  {/* Outcome Node */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => handleAddNode('outcome')}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-purple-500 hover:bg-purple-500/10 hover:text-purple-400 transition-colors"
                        aria-label="Add Outcome Node"
                      >
                        <CheckCircle2 className="h-4.5 w-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-[9px] font-black uppercase tracking-wider">
                      Add Outcome Node
                    </TooltipContent>
                  </Tooltip>

                  {/* End Node */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => handleAddNode('end')}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                        aria-label="Add End Node"
                      >
                        <XCircle className="h-4.5 w-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-[9px] font-black uppercase tracking-wider">
                      Add End Node
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex-grow w-full h-full">
                <VisualScriptCanvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                />
              </div>
            </div>

            {/* Right Panel: Selected Node Properties Editor */}
            {!rightPanelCollapsed && (
              <div className="lg:col-span-3 h-full overflow-hidden">
                {selectedNode ? (
                  <Card className="border border-border bg-card rounded-2xl flex flex-col justify-between h-full">
                    <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-foreground truncate">Config node: "{selectedNode.data.label}"</h3>
                        <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">ID: {selectedNode.id}</p>
                      </div>
                      <Button onClick={handleDeleteSelectedNode} variant="ghost" size="icon" className="h-7 w-7 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"><X className="h-4 w-4" /></Button>
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
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Ask Configuration</span>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Field Mapping Object</Label>
                            <Select 
                              value={selectedNode.data.questionConfig?.fieldBinding || 'contact'} 
                              onValueChange={(val: 'contact' | 'deal') => updateSelectedNode({ 
                                questionConfig: { ...selectedNode.data.questionConfig, fieldBinding: val } 
                              })}
                            >
                              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border-border text-popover-foreground">
                                <SelectItem value="contact">Contact Profile</SelectItem>
                                <SelectItem value="deal">Active Deal Record</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Target CRM Field Name</Label>
                            <Input
                              value={selectedNode.data.questionConfig?.fieldName || ''}
                              onChange={(e) => updateSelectedNode({ 
                                questionConfig: { ...selectedNode.data.questionConfig, fieldName: e.target.value } 
                              })}
                              placeholder="e.g. email, budget, tags"
                              className="h-8 bg-background border-border rounded-lg text-xs px-2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Input Field Type</Label>
                            <Select 
                              value={selectedNode.data.questionConfig?.fieldType || 'text'} 
                              onValueChange={(val: any) => updateSelectedNode({ 
                                questionConfig: { ...selectedNode.data.questionConfig, fieldType: val } 
                              })}
                            >
                              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border-border text-popover-foreground">
                                <SelectItem value="text">Single Line Text</SelectItem>
                                <SelectItem value="number">Numeric Value</SelectItem>
                                <SelectItem value="select">Dropdown Selector</SelectItem>
                                <SelectItem value="datepicker">Calendar Date</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedNode.data.questionConfig?.fieldType === 'select' && (
                            <div className="space-y-1">
                              <Label className="text-[8px] font-bold text-muted-foreground uppercase">Dropdown Options (Comma-separated)</Label>
                              <Input
                                value={selectedNode.data.questionConfig?.selectOptions?.join(', ') || ''}
                                onChange={(e) => updateSelectedNode({ 
                                  questionConfig: { 
                                    ...selectedNode.data.questionConfig, 
                                    selectOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                  } 
                                })}
                                placeholder="Option A, Option B, Option C"
                                className="h-8 bg-background border-border rounded-lg text-xs px-2"
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Regex Validation Pattern (Optional)</Label>
                            <Input
                              value={selectedNode.data.questionConfig?.validationPattern || ''}
                              onChange={(e) => updateSelectedNode({ 
                                questionConfig: { ...selectedNode.data.questionConfig, validationPattern: e.target.value } 
                              })}
                              placeholder="e.g. ^[0-9]{10}$"
                              className="h-8 bg-background border-border rounded-lg text-xs px-2"
                            />
                          </div>
                        </div>
                      )}

                      {/* Objection Node Configuration */}
                      {selectedNode.type === 'objection' && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Objection Trigger Config</span>
                          <div className="space-y-1">
                            <Label className="text-[8px] font-bold text-muted-foreground uppercase">Objection Keyword Triggers (Comma-separated)</Label>
                            <Input
                              value={selectedNode.data.objectionConfig?.keywordTriggers?.join(', ') || ''}
                              onChange={(e) => updateSelectedNode({ 
                                objectionConfig: { 
                                  keywordTriggers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                } 
                              })}
                              placeholder="too expensive, no time, send email"
                              className="h-8 bg-background border-border rounded-lg text-xs px-2"
                            />
                          </div>
                        </div>
                      )}

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

                      {/* Dialogue body editor */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Dialogue script body</Label>
                        </div>
                        <Textarea
                          value={selectedNode.data.text || ''}
                          onChange={(e) => updateSelectedNode({ text: e.target.value })}
                          placeholder="Type dialog block script here..."
                          rows={8}
                          className="bg-background border-border rounded-xl text-xs leading-relaxed p-3 font-serif"
                        />
                      </div>

                      {/* Node variables picker helper */}
                      <div className="space-y-2 pt-2 border-t border-border">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Double-click field below to insert at cursor:</span>
                        <div className="flex bg-muted border border-border rounded-lg p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setVariableCategory('entity')}
                            className={`flex-grow py-1 text-[8px] uppercase tracking-wider font-black rounded-md transition-all ${variableCategory === 'entity' ? 'bg-background text-foreground border border-border shadow' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            Entity Fields
                          </button>
                          <button
                            type="button"
                            onClick={() => setVariableCategory('deal')}
                            className={`flex-grow py-1 text-[8px] uppercase tracking-wider font-black rounded-md transition-all ${variableCategory === 'deal' ? 'bg-background text-foreground border border-border shadow' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            Deal Fields
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto p-1 bg-muted/40 rounded-lg border border-border">
                          {variableCategory === 'entity' ? (
                            ['ENTITY_NAME', 'ENTITY_EMAIL', 'ENTITY_PHONE', 'ENTITY_TYPE', 'PRIMARY_CONTACT_NAME', 'PRIMARY_CONTACT_PHONE', 'AGENT_NAME'].map(v => (
                              <Badge key={v} onClick={() => handleInsertVariable(v)} variant="secondary" className="cursor-pointer font-mono text-[7px] border border-border hover:bg-muted py-0.5 px-1.5 rounded">{v}</Badge>
                            ))
                          ) : (
                            ['DEAL_NAME', 'DEAL_VALUE', 'DEAL_STAGE', 'DEAL_STATUS', 'DEAL_EXPECTED_CLOSE'].map(v => (
                              <Badge key={v} onClick={() => handleInsertVariable(v)} variant="secondary" className="cursor-pointer font-mono text-[7px] border border-border hover:bg-muted py-0.5 px-1.5 rounded">{v}</Badge>
                            ))
                          )}
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-border bg-card rounded-2xl flex items-center justify-center p-8 text-center text-xs text-muted-foreground italic h-full min-h-[450px]">
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

        {/* Tab 3: Legacy plain text fallback editor */}
        <TabsContent value="text" className="pt-6 m-0 outline-none">
          <Card className="border border-border bg-card rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/30 p-4">
              <div>
                <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">Legacy Plain Text Script</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">This campaign uses a linear text script. Convert it to a visual flow to build branching Objections, Questions, and Actions.</p>
              </div>
              <Button
                type="button"
                onClick={handleConvertToGraph}
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-[10px] uppercase font-bold border-border hover:bg-muted text-muted-foreground"
              >
                Convert to Visual Flow
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Script Content Text</Label>
                <Textarea
                  value={legacyText}
                  onChange={(e) => setLegacyText(e.target.value)}
                  placeholder="Paste or write linear text here..."
                  rows={15}
                  className="bg-background border-border rounded-xl text-xs leading-relaxed p-4 font-serif"
                />
              </div>
              <div className="space-y-2 pt-4 border-t border-border">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detected Variables in Legacy Text</Label>
                <div className="flex flex-wrap gap-1.5">
                  {detectedVariables.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground italic">No variables detected. Use double curly braces like {"{{FIRST_NAME}}"} to define them.</span>
                  ) : (
                    detectedVariables.map(v => (
                      <Badge key={v} variant="outline" className="text-[8px] font-bold bg-muted border-border text-muted-foreground tracking-wider px-2 py-0.5 rounded">
                        {v}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <p className="text-[8px] text-muted-foreground font-mono tracking-widest uppercase">Powered by Claude 3.5 Sonnet</p>
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
                        original: JSON.stringify({ nodes, edges }),
                        instruction: refineInstructions,
                        workspaceId: activeWorkspaceId
                      }, user?.uid || '');
                      
                      if (res.success && res.refined) {
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

'use client';

import * as React from 'react';
import { collection, query, where, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { MESSAGING_TRIGGERS } from '@/lib/messaging-triggers';
import { TEMPLATES, type TemplateDef } from '@/lib/messaging-templates-registry';
import type { MessageTemplate, MessagingTrigger, MessageChannel, MessageBlock, RecipientType, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm } from '@/lib/types';
import { TriggerListItem } from './components/TriggerListItem';
import { TriggerDetailPane } from './components/TriggerDetailPane';
import { TemplateWorkshop } from '../templates/components/template-workshop';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Zap, Loader2, ArrowLeft, RefreshCw, Search, SlidersHorizontal, 
  X, CheckCircle, Info, ChevronRight, Inbox
} from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { PageContainerFluid } from '@/components/ui/page-container';
import { useToast } from '@/hooks/use-toast';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/use-terminology';
import { invalidateAllTemplatesCache } from '@/app/admin/components/template-cache-manager';

/**
 * PURPOSE: Converts a canonical TemplateDef from the system registry into a standard
 * MessageTemplate object for seamless fallback and rendering when no custom override exists.
 */
function convertRegistryDefToTemplate(def: TemplateDef, singularTerm?: string): MessageTemplate {
  const isEmail = def.channel === 'email';
  const trigger = MESSAGING_TRIGGERS.find(t => t.id === def.templateType);

  let formattedSubject = def.subject || def.name;
  let formattedBody = def.body;
  if (singularTerm) {
    const termCap = singularTerm.charAt(0).toUpperCase() + singularTerm.slice(1);
    const termLow = singularTerm.toLowerCase();
    const replaceTerms = (str: string): string =>
      str
        .replace(/\bSchools\b/g, `${termCap}s`)
        .replace(/\bschools\b/g, `${termLow}s`)
        .replace(/\bSchool\b/g, termCap)
        .replace(/\bschool\b/g, termLow);

    formattedSubject = replaceTerms(formattedSubject);
    formattedBody = replaceTerms(formattedBody);
  }

  const blocks: MessageBlock[] | undefined = isEmail ? [
    {
      id: `block_head_builtin_${def.templateType}_${def.channel}`,
      type: 'heading',
      title: formattedSubject,
      variant: 'h2',
      style: { textAlign: 'center', fontWeight: 'bold', marginTop: '16px', marginBottom: '16px' }
    },
    {
      id: `block_body_builtin_${def.templateType}_${def.channel}`,
      type: 'text',
      content: formattedBody,
      style: { textAlign: 'left', lineHeight: '1.6', marginTop: '8px', marginBottom: '16px' }
    }
  ] : undefined;

  return {
    id: `global_${def.templateType}_${def.channel}`,
    scope: 'global',
    category: def.category,
    channel: def.channel,
    target: trigger?.target || (def.recipientType === 'internal_alert' ? 'internal_team' : 'external_client'),
    name: def.name,
    contentMode: isEmail ? 'rich_builder' : 'plain_text',
    subject: formattedSubject,
    body: formattedBody,
    blocks,
    styleId: 'default',
    templateType: def.templateType,
    recipientType: (def.recipientType || trigger?.recipientType || 'external_alert') as RecipientType,
    variableContext: def.variableContext || 'common',
    variables: def.declaredVariables || [],
    declaredVariables: def.declaredVariables || [],
    status: 'active',
    version: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function MessagingTriggersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const { singular } = useTerminology();

  // State for customizing a trigger
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
  
  // State for reverting an override
  const [templateToRevert, setTemplateToRevert] = React.useState<string | null>(null);
  const [isReverting, setIsReverting] = React.useState(false);

  // ── 1. Fetch Templates (Workspace Overrides + Global System Blueprints) ───────
  const workspaceTemplatesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'message_templates'),
      where('workspaceIds', 'array-contains', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);

  const globalTemplatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'message_templates'),
      where('scope', '==', 'global')
    );
  }, [firestore]);

  const { data: workspaceTemplates, isLoading: isLoadingW } = useCollection<MessageTemplate>(workspaceTemplatesQuery);
  const { data: globalTemplates, isLoading: isLoadingG } = useCollection<MessageTemplate>(globalTemplatesQuery);
  const isLoadingTemplates = isLoadingW || isLoadingG;

  const allTemplates = React.useMemo(() => {
    const wList = workspaceTemplates || [];
    const gList = globalTemplates || [];
    const map = new Map<string, MessageTemplate>();
    for (const t of [...gList, ...wList]) {
      if (t.id) map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [workspaceTemplates, globalTemplates]);

  // ── 2. O(1) Pre-indexed Template Mapping with Registry Fallback ───────────
  const activeMappings = React.useMemo(() => {
    const map: Record<string, Record<string, MessageTemplate>> = {};

    MESSAGING_TRIGGERS.forEach(trigger => {
      map[trigger.id] = {};
    });

    // 1. Layer 1: Canonical in-code built-in templates from TEMPLATES registry
    TEMPLATES.forEach(def => {
      if (map[def.templateType]) {
        map[def.templateType][def.channel] = convertRegistryDefToTemplate(def, singular);
      }
    });

    // 2. Layer 2: Firestore Global Templates (overrides built-in if updated globally)
    if (allTemplates) {
      allTemplates.forEach(t => {
        if (!t.templateType || !t.channel || t.isActive === false) return;
        if (t.scope === 'global') {
          if (!map[t.templateType]) map[t.templateType] = {};
          map[t.templateType][t.channel] = t;
        }
      });

      // 3. Layer 3: Organization/Workspace Custom Overrides (highest priority)
      allTemplates.forEach(t => {
        if (!t.templateType || !t.channel || t.isActive === false) return;
        if (t.scope === 'organization' && t.workspaceIds?.includes(activeWorkspaceId)) {
          if (!map[t.templateType]) map[t.templateType] = {};
          map[t.templateType][t.channel] = t;
        }
      });
    }

    return map;
  }, [allTemplates, activeWorkspaceId, singular]);

  // ── 3. Filters & Search State (Responsive React Transitions) ────────────
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedRecipient, setSelectedRecipient] = React.useState<string>('all');
  const [selectedTarget, setSelectedTarget] = React.useState<string>('all');
  const [selectedChannel, setSelectedChannel] = React.useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  const filteredTriggers = React.useMemo(() => {
    return MESSAGING_TRIGGERS.filter(trigger => {
      // 1. Search Query
      if (deferredSearchQuery.trim()) {
        const query = deferredSearchQuery.toLowerCase();
        const matchesName = trigger.name.toLowerCase().includes(query);
        const matchesDesc = trigger.description?.toLowerCase().includes(query);
        const matchesId = trigger.id.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesId) return false;
      }

      // 2. Category
      if (selectedCategory !== 'all' && trigger.category !== selectedCategory) return false;

      // 3. Recipient
      if (selectedRecipient !== 'all' && trigger.recipientType !== selectedRecipient) return false;

      // 4. Target
      if (selectedTarget !== 'all' && trigger.target !== selectedTarget) return false;

      // 5. Channel
      if (selectedChannel !== 'all' && !trigger.supportedChannels.includes(selectedChannel as MessageChannel)) return false;

      return true;
    });
  }, [deferredSearchQuery, selectedCategory, selectedRecipient, selectedTarget, selectedChannel]);

  // ── 4. Active Selection State ───────────────────────────────────────────
  const [selectedTriggerId, setSelectedTriggerId] = React.useState<string | null>(null);

  // Mobile drawer state: GPU-accelerated panel transitions
  const [mobilePanel, setMobilePanel] = React.useState<'list' | 'detail'>('list');

  const selectedTrigger = React.useMemo(() => {
    const found = MESSAGING_TRIGGERS.find(t => t.id === selectedTriggerId);
    if (found && filteredTriggers.some(t => t.id === selectedTriggerId)) {
      return found;
    }
    return filteredTriggers[0] || null;
  }, [selectedTriggerId, filteredTriggers]);

  // Sync active trigger selection on category or search filter changes
  React.useEffect(() => {
    if (selectedTrigger && selectedTrigger.id !== selectedTriggerId) {
      setSelectedTriggerId(selectedTrigger.id);
    }
  }, [selectedTrigger, selectedTriggerId]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedRecipient('all');
    setSelectedTarget('all');
    setSelectedChannel('all');
  };

  // Handle mobile back button
  const handleMobileBack = () => {
    setMobilePanel('list');
  };

  const handleSelectTrigger = (id: string) => {
    setSelectedTriggerId(id);
    setMobilePanel('detail');
  };

  // ── 5. Auxiliary Data for Customizer Workshop ───────────────────────────
  const varsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'template_variables'));
  }, [firestore]);

  const stylesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'message_styles'));
  }, [firestore]);

  const meetingsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'meetings'), where('status', '==', 'scheduled'));
  }, [firestore]);

  const surveysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'surveys'), where('status', '==', 'published'));
  }, [firestore]);

  const pdfsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pdfs'), where('status', '==', 'published'));
  }, [firestore]);

  const { data: firestoreVariables } = useCollection<VariableDefinition>(varsQuery);
  const { data: styles } = useCollection<MessageStyle>(stylesQuery);
  const { data: meetings } = useCollection<Meeting>(meetingsQuery);
  const { data: surveys } = useCollection<Survey>(surveysQuery);
  const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);

  const [variables, setVariables] = React.useState<VariableDefinition[]>([]);

  React.useEffect(() => {
    if (!activeWorkspaceId) return;

    let active = true;
    getVariablesAction({
      workspaceId: activeWorkspaceId,
      organizationId: activeOrganizationId,
      terminology: singular ? { singular, plural: `${singular}s` } : undefined
    }).then((res) => {
      if (!active) return;
      const mapped = res.map((v) => ({
        id: v.key,
        key: v.key,
        label: v.label,
        category: v.category,
        source: v.source,
        entity: 'Entity',
        path: v.path || '',
        type: v.dataType,
      }));
      setVariables(mapped);
    }).catch(console.error);

    return () => {
      active = false;
    };
  }, [activeWorkspaceId, activeOrganizationId, firestoreVariables, singular]);

  // ── 6. Actions ──────────────────────────────────────────────────────────

  const handleCustomize = (trigger: MessagingTrigger, channel: MessageChannel, existingOverride?: MessageTemplate) => {
    if (existingOverride) {
      setEditingTemplate(existingOverride);
    } else {
      const globalTemplate = activeMappings[trigger.id]?.[channel];
      
      if (globalTemplate) {
        setEditingTemplate(globalTemplate);
      } else {
        setEditingTemplate({
          name: `Custom ${trigger.name}`,
          category: trigger.category,
          templateType: trigger.id,
          channel: channel,
          target: trigger.target,
          recipientType: trigger.recipientType,
          scope: 'organization',
          contentMode: channel === 'sms' ? 'plain_text' : 'rich_builder',
          body: '',
          status: 'active',
          workspaceIds: [activeWorkspaceId],
          variableContext: 'common',
          declaredVariables: [],
        } as unknown as MessageTemplate);
      }
    }
    setIsAdding(true);
  };

  const handleSave = async (data: Partial<MessageTemplate>) => {
    if (!firestore || !user) return;

    const contentForExtraction = `${data.subject || ''} ${data.body || ''} ${JSON.stringify(data.blocks || [])}`;
    const varMatches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
    const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

    const workspaceIds = data.workspaceIds && data.workspaceIds.length > 0 
        ? data.workspaceIds 
        : [activeWorkspaceId];

    const templateData = {
        ...data,
        workspaceIds,
        organizationId: activeOrganizationId,
        scope: data.scope || 'organization',
        variables: variableList,
        status: data.status || 'active',
        isActive: true,
        updatedAt: new Date().toISOString(),
    };

    const sanitizedData = JSON.parse(JSON.stringify(templateData));

    try {
        if (editingTemplate?.id && editingTemplate.scope !== 'global') {
            await updateDoc(doc(firestore, 'message_templates', editingTemplate.id), sanitizedData);
        } else {
            const { id: _, ...dataToSave } = sanitizedData;
            await addDoc(collection(firestore, 'message_templates'), { 
                ...dataToSave, 
                scope: 'organization',
                globalTemplateId: editingTemplate?.id,
                createdAt: new Date().toISOString() 
            });
        }
        invalidateAllTemplatesCache();
        toast({ title: 'Override Saved Successfully' });
        setIsAdding(false);
        setEditingTemplate(null);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast({ variant: 'destructive', title: 'Save Failed', description: message });
    }
  };

  const handleRevert = async () => {
    if (!firestore || !templateToRevert) return;
    setIsReverting(true);
    try {
      await deleteDoc(doc(firestore, 'message_templates', templateToRevert));
      invalidateAllTemplatesCache();
      toast({ title: 'Reverted to System Default' });
      setTemplateToRevert(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Failed to revert', description: message });
    } finally {
      setIsReverting(false);
    }
  };

  // Categories definition
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'meetings', label: 'Meetings' },
    { value: 'forms', label: 'Forms' },
    { value: 'surveys', label: 'Surveys' },
    { value: 'agreements', label: 'Agreements' },
    { value: 'general', label: 'General' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'automations', label: 'Automations' },
    { value: 'qr_codes', label: 'QR Codes' }
  ];

  return (
    <PageContainerFluid className="h-full flex flex-col">
      <div className="h-[calc(100vh-10rem)] min-h-[600px] flex flex-col overflow-hidden bg-background rounded-3xl border border-border shadow-md">
      <AnimatePresence mode="wait">
        {isAdding ? (
          <TemplateWorkshop 
            key="workshop"
            initialTemplate={editingTemplate}
            initialContext={editingTemplate ? {
              category: editingTemplate.category,
              channel: editingTemplate.channel,
              recipientType: editingTemplate.recipientType,
              templateType: editingTemplate.templateType
            } : undefined}
            variables={variables || []}
            styles={styles || []}
            meetings={meetings || []}
            surveys={surveys || []}
            pdfs={pdfs || []}
            onSave={handleSave}
            onCancel={() => { setIsAdding(false); setEditingTemplate(null); }}
            isSaving={false}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden text-left h-full">
            {/* Header Area */}
            <div className="shrink-0 p-6 border-b flex items-center justify-between gap-4 bg-card">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10 border shadow-sm shrink-0">
                  <Link href="/admin/messaging"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-500/5 text-amber-600 dark:text-amber-500 border-amber-500/20 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5">
                      System Orchestration
                    </Badge>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground mt-0.5 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500 fill-amber-500/20" /> Messaging Triggers
                  </h1>
                </div>
              </div>
            </div>

            {/* Split layout — GPU-accelerated mobile drawer */}
            <div className="flex-1 flex overflow-hidden relative">
              
              {/* Left Column: Master List */}
              <div className={cn(
                "w-full lg:w-[420px] shrink-0 border-r flex flex-col bg-card overflow-hidden",
                "absolute inset-0 lg:relative lg:inset-auto",
                "transition-transform duration-300 ease-out will-change-transform",
                mobilePanel === 'detail' ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
              )}>
                
                {/* Search and Filters panel */}
                <div className="p-4 border-b space-y-3 bg-muted/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search triggers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 rounded-xl text-xs bg-background"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-2.5 hover:text-foreground text-muted-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className={cn(
                        "h-9 w-9 rounded-xl border shrink-0",
                        showAdvancedFilters && "bg-amber-500/5 text-amber-600 border-amber-500/20"
                      )}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Horizontal Scroll category selectors */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all shrink-0",
                          selectedCategory === cat.value
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {cat.label.replace('All Categories', 'All')}
                      </button>
                    ))}
                  </div>

                  {/* Collapsible Advanced Filters */}
                  <AnimatePresence>
                    {showAdvancedFilters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pt-2 space-y-2 border-t border-dashed"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-muted-foreground">Recipient Type</label>
                            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                              <SelectTrigger className="h-8 rounded-lg text-[11px] bg-background">
                                <SelectValue placeholder="Recipient" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Recipients</SelectItem>
                                <SelectItem value="external_alert">External Alert</SelectItem>
                                <SelectItem value="internal_alert">Internal Alert</SelectItem>
                                <SelectItem value="respondent">Respondent</SelectItem>
                                <SelectItem value="entity">Entity</SelectItem>
                                <SelectItem value="assignee">Assignee</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-muted-foreground">Target Scope</label>
                            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                              <SelectTrigger className="h-8 rounded-lg text-[11px] bg-background">
                                <SelectValue placeholder="Target" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Targets</SelectItem>
                                <SelectItem value="external_client">External Client</SelectItem>
                                <SelectItem value="internal_team">Internal Team</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-muted-foreground">Channel Support</label>
                            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                              <SelectTrigger className="h-8 rounded-lg text-[11px] bg-background">
                                <SelectValue placeholder="Channel" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Channels</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="push">Push</SelectItem>
                                <SelectItem value="in_app">In-App</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-end">
                            <Button 
                              variant="ghost" 
                              onClick={handleClearFilters}
                              className="w-full h-8 text-[10px] font-bold uppercase rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                              Reset Filters
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Triggers list core */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoadingTemplates ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
                      <p className="text-xs font-medium text-muted-foreground">Loading triggers...</p>
                    </div>
                  ) : filteredTriggers.length > 0 ? (
                    filteredTriggers.map(trigger => (
                      <TriggerListItem
                        key={trigger.id}
                        trigger={trigger}
                        isActive={selectedTrigger?.id === trigger.id}
                        activeTemplates={activeMappings[trigger.id] || {}}
                        onClick={() => {
                          setSelectedTriggerId(trigger.id);
                          setMobilePanel('detail');
                        }}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 border border-dashed rounded-2xl bg-muted/10 mt-4">
                      <Inbox className="h-10 w-10 text-muted-foreground/30 stroke-[1.5]" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">No triggers match search</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[200px]">Refine your filters or search keywords to locate active templates.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleClearFilters}
                        className="h-8 text-[10px] font-bold uppercase px-3 rounded-lg"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Preview Pane */}
              <div className={cn(
                "flex-1 flex-col overflow-hidden p-6 bg-muted/10",
                "absolute inset-0 lg:relative lg:inset-auto",
                "transition-transform duration-300 ease-out will-change-transform",
                mobilePanel === 'detail' ? "translate-x-0 flex" : "translate-x-full lg:translate-x-0 hidden lg:flex"
              )}>
                {/* Mobile back button */}
                <button
                  onClick={() => setMobilePanel('list')}
                  className="lg:hidden flex items-center gap-2 mb-4 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to triggers
                </button>
                {selectedTrigger ? (
                  <TriggerDetailPane
                    trigger={selectedTrigger}
                    activeTemplates={activeMappings[selectedTrigger.id] || {}}
                    onCustomize={handleCustomize}
                    onRevert={setTemplateToRevert}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <Info className="h-10 w-10 text-muted-foreground/30 mb-2 stroke-[1.5]" />
                    <p className="text-sm font-semibold text-muted-foreground">Select a trigger event from the left list to review detailed previews and statistics.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Revert Override Confirmation Dialog */}
      <AlertDialog open={!!templateToRevert} onOpenChange={(o) => !o && setTemplateToRevert(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-xl tracking-tight flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-500" /> Revert to System Default?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              This will permanently delete your organization's custom override for this trigger. The system will fall back to using the global blueprint provided by the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevert} 
              disabled={isReverting}
              className="rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-xl"
            >
              {isReverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Revert to Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </PageContainerFluid>
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useCallScripts } from '@/lib/call-centre-hooks';
import { 
  createCallCampaignAction, 
  updateCallCampaignAction, 
  getCallCampaignAction,
  generateCampaignQueueAction 
} from '@/lib/call-centre-actions';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Trash2,
  ChevronRight,
  RefreshCw,
  Save,
  Edit3,
  Info,
  Calendar,
  CalendarDays,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudienceSelector } from '@/app/admin/messaging/audiences/components/AudienceSelector';
import { legacyAudienceToFilters } from '@/lib/audience-hooks';
import type { AudienceFilter, AudienceDefinition, CallOutcomeAutomation, AutomationRuleParams, CallActionType, MessageTemplate } from '@/lib/types';
import type { ConditionGroup } from '@/lib/automation-condition';
import { isJsonGraph, parseGraph } from '@/lib/call-centre-graph';
import { ScriptPlaybookView } from '../../scripts/components/ScriptPlaybookView';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { CALL_ACTION_TYPES, getActionMeta } from '@/lib/call-action-types';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const MessagingTemplateSelector = dynamic(
  () => import('@/app/admin/components/MessagingTemplateSelector')
    .then(m => m.MessagingTemplateSelector),
  { ssr: false, loading: () => <Skeleton className="h-9 w-full rounded-xl" /> }
);

function buildAudienceDefinition(state: {
  audienceMode: AudienceDefinition['mode'];
  filters: AudienceFilter[];
  filterLogic: 'AND' | 'OR';
  groups: ConditionGroup[];
  savedAudienceId: string;
  selectedContacts: AudienceDefinition['selectedContacts'];
  contactScope: AudienceDefinition['contactScope'];
}): AudienceDefinition {
  return {
    mode: state.audienceMode,
    filters: state.filters,
    filterLogic: state.filterLogic,
    groups: state.groups,
    savedAudienceId: state.savedAudienceId,
    selectedContacts: state.selectedContacts,
    contactScope: state.contactScope,
  };
}

interface CampaignWizardClientProps {
  campaignId?: string;
  initialStep?: number;
  initialScriptId?: string;
}

export function CampaignWizardClient({ campaignId, initialStep, initialScriptId }: CampaignWizardClientProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
  const { toast } = useToast();

  const { scripts } = useCallScripts(activeWorkspaceId);

  // ─── Step States ───────────────────────────────────────────────────────────
  const [step, setStep] = React.useState<number>(() => {
    if (initialStep && initialStep >= 1 && initialStep <= 6) {
      return initialStep;
    }
    return 1;
  });
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  useSetBreadcrumb(campaignId ? `Edit Campaign: ${name}` : 'New Campaign');
  const [selectedScriptId, setSelectedScriptId] = React.useState(initialScriptId || '');
  
  // Audience
  const [audienceMode, setAudienceMode] = React.useState<'all' | 'advanced' | 'saved' | 'manual'>('all');
  const [filters, setFilters] = React.useState<AudienceFilter[]>([]);
  const [filterLogic, setFilterLogic] = React.useState<'AND' | 'OR'>('AND');
  const [groups, setGroups] = React.useState<ConditionGroup[]>([]);
  const [savedAudienceId, setSavedAudienceId] = React.useState<string>('');
  const [selectedContacts, setSelectedContacts] = React.useState<Array<{
    entityId: string;
    contactId: string;
    name?: string;
    email?: string;
    phone?: string;
    entityName?: string;
  }>>([]);
  const [contactScope, setContactScope] = React.useState<'primary' | 'signatories' | 'all' | (string & {})>('primary');

  // Outcomes
  const [outcomes, setOutcomes] = React.useState<string[]>([
    'Interested',
    'Not Interested',
    'No Answer',
    'Call Back Later',
    'Wrong Number',
    'Deferred'
  ]);
  const [newOutcome, setNewOutcome] = React.useState('');

  // Automations Map (Outcome -> Array of Actions)
  const [automationRules, setAutomationRules] = React.useState<Record<string, CallOutcomeAutomation[]>>({});

  // Loading/Wizard States
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLaunching, setIsLaunching] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [isEditingScript, setIsEditingScript] = React.useState(false);

  const wrapHref = (href: string) => {
    if (!activeWorkspaceId) return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}track=${activeWorkspaceId}`;
  };

  // ─── Query Tags, Stages, Templates, Meetings ──────────────────────────────────────────

  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: tagsData } = useCollection<{ id: string; name: string }>(tagsQuery);
  const tags = tagsData || [];

  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'onboardingStages'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: stagesData } = useCollection<{ id: string; name: string }>(stagesQuery);
  const stages = stagesData || [];

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'message_templates'), where('workspaceIds', 'array-contains', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: templatesData } = useCollection<MessageTemplate>(templatesQuery);
  const templates = templatesData || [];

  const meetingsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'meetings'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: meetingsData } = useCollection<{ id: string; title: string }>(meetingsQuery);
  const meetings = meetingsData || [];

  const { data: workspaceUsersData } = useWorkspaceUsers(activeWorkspaceId);
  const workspaceUsers = workspaceUsersData || [];

  // ─── Fetch Edit Campaign ───────────────────────────────────────────────────

  React.useEffect(() => {
    if (!campaignId || !activeWorkspaceId || !user) return;

    const loadCampaign = async () => {
      setIsLoading(true);
      try {
        const campaign = await getCallCampaignAction(campaignId, activeWorkspaceId, user.uid);
        if (campaign) {
          setName(campaign.name);
          setDescription(campaign.description || '');
          setSelectedScriptId(campaign.scriptId);
          
          const audDef = campaign.audienceDefinition || {};
          let mode = audDef.mode || 'all';
          // Convert legacy 'tags' mode to 'advanced'
          if (mode === 'tags') {
            mode = 'advanced';
          }
          setAudienceMode(mode as any);
          
          let campaignFilters = audDef.filters || [];
          if (campaignFilters.length === 0 && audDef.mode === 'tags') {
            campaignFilters = legacyAudienceToFilters(audDef);
          }
          setFilters(campaignFilters);
          setFilterLogic(audDef.filterLogic || 'AND');
          setGroups(audDef.groups || []);
          setSavedAudienceId(audDef.savedAudienceId || '');
          setSelectedContacts(audDef.selectedContacts || []);
          setContactScope(audDef.contactScope || 'primary');
          
          setOutcomes(campaign.outcomes || []);
          
          // Normalize loaded automation rules for backward compat
          const rawRules: Record<string, any[]> = campaign.automationRules ?? {};
          const normalizedRules: Record<string, CallOutcomeAutomation[]> = {};
          for (const [outcome, rules] of Object.entries(rawRules)) {
            normalizedRules[outcome] = (rules || []).map(rule => ({
              type: (rule.type ?? 'SEND_SMS') as CallActionType,
              params: {
                ...getActionMeta((rule.type ?? 'SEND_SMS') as CallActionType).defaultParams(),
                ...(rule.params ?? {}),
              } as AutomationRuleParams,
            }));
          }
          setAutomationRules(normalizedRules);
        }
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    loadCampaign();
  }, [campaignId, activeWorkspaceId, user, toast]);

  // Selected Script Text Preview
  const selectedScript = React.useMemo(() => {
    return scripts.find(s => s.id === selectedScriptId);
  }, [scripts, selectedScriptId]);

  // ─── Outcomes Handlers ─────────────────────────────────────────────────────

  const handleAddOutcome = () => {
    if (!newOutcome.trim()) return;
    if (outcomes.includes(newOutcome.trim())) {
      toast({ variant: 'destructive', title: 'Error', description: 'Outcome already exists' });
      return;
    }
    setOutcomes([...outcomes, newOutcome.trim()]);
    setNewOutcome('');
  };

  const handleRemoveOutcome = (out: string) => {
    setOutcomes(outcomes.filter(o => o !== out));
    // Also clear automation rules for this outcome
    const newRules = { ...automationRules };
    delete newRules[out];
    setAutomationRules(newRules);
  };

  // ─── Automations Handlers ──────────────────────────────────────────────────

  const handleAddAutomationRule = (outcome: string, type: CallActionType) => {
    const existing = automationRules[outcome] || [];
    const meta = getActionMeta(type);
    const newRule: CallOutcomeAutomation = {
      type,
      params: meta.defaultParams() as AutomationRuleParams
    };
    setAutomationRules({
      ...automationRules,
      [outcome]: [...existing, newRule]
    });
  };

  const handleRemoveAutomationRule = (outcome: string, index: number) => {
    const existing = automationRules[outcome] || [];
    const updated = [...existing];
    updated.splice(index, 1);
    setAutomationRules({
      ...automationRules,
      [outcome]: updated
    });
  };

  const handleUpdateRuleParam = <K extends keyof AutomationRuleParams>(
    outcome: string,
    index: number,
    key: K,
    value: AutomationRuleParams[K]
  ) => {
    const existing = automationRules[outcome] || [];
    const updated = [...existing];
    updated[index] = {
      ...updated[index],
      params: {
        ...updated[index].params,
        [key]: value
      }
    };
    setAutomationRules({
      ...automationRules,
      [outcome]: updated
    });
  };

  // ─── Launch & Draft Persistence Handlers ────────────────────────────────────

  const persistDraft = async (): Promise<string | null> => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Campaign name is required to save.' });
      return null;
    }

    const audienceDefinition = buildAudienceDefinition({
      audienceMode,
      filters,
      filterLogic,
      groups,
      savedAudienceId,
      selectedContacts,
      contactScope,
    });

    try {
      if (campaignId) {
        const result = await updateCallCampaignAction(
          campaignId,
          {
            name,
            description,
            scriptId: selectedScriptId,
            scriptSnapshot: selectedScript?.content || '',
            audienceDefinition,
            outcomes,
            automationRules,
            workspaceId: activeWorkspaceId,
          },
          user?.uid || ''
        );
        if (!result.success) throw new Error(result.error);
        return campaignId;
      } else {
        const result = await createCallCampaignAction(
          {
            organizationId: activeOrganizationId,
            workspaceId: activeWorkspaceId,
            name,
            description,
            scriptId: selectedScriptId,
            scriptSnapshot: selectedScript?.content || '',
            audienceDefinition,
            outcomes,
            automationRules,
            status: 'draft',
          },
          user?.uid || ''
        );
        if (!result.success) throw new Error(result.error);
        return result.id || null;
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
      return null;
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    const resolvedId = await persistDraft();
    setIsSavingDraft(false);
    if (resolvedId) {
      toast({ title: 'Campaign Saved as Draft' });
      router.push(wrapHref('/admin/messaging/call-centre?tab=campaigns'));
    }
  };

  const handleEditScript = async () => {
    if (!selectedScriptId) return;
    setIsEditingScript(true);
    const resolvedId = await persistDraft();
    setIsEditingScript(false);
    if (resolvedId) {
      router.push(wrapHref(`/admin/messaging/call-centre/scripts/new?id=${selectedScriptId}&returnCampaignId=${resolvedId}`));
    }
  };

  const handleLaunchCampaign = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Campaign name is required.' });
      return;
    }
    if (!selectedScriptId) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'A script playbook must be selected before launching.' });
      return;
    }

    setIsLaunching(true);
    try {
      const currentCampaignId = await persistDraft();
      if (!currentCampaignId) {
        setIsLaunching(false);
        return;
      }

      const queueResult = await generateCampaignQueueAction(currentCampaignId, activeWorkspaceId, user?.uid || '');
      if (queueResult.success) {
        toast({ title: 'Campaign Launched', description: `Queue initialized with ${(queueResult as any).count} contacts.` });
        router.push(wrapHref(`/admin/messaging/call-centre/workspace/${currentCampaignId}`));
      } else {
        toast({ variant: 'destructive', title: 'Queue Generation Failed', description: queueResult.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsLaunching(false);
    }
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-40">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8 max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push(wrapHref('/admin/messaging/call-centre'))}
            variant="ghost"
            size="icon"
            className="rounded-xl border border-border/50 bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Back to Campaigns"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {campaignId ? 'Resume Campaign Setup' : 'Start Call Campaign'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Define details, scripts, contact audiences, outcomes, and background automations
            </p>
          </div>
        </div>

        {/* Steps Breadcrumb Progress */}
        <div className="flex items-center gap-2 overflow-x-auto py-2 border-b border-border/30">
          {[
            'Campaign Info',
            'Select Script',
            'Select Audience',
            'Configure Outcomes',
            'Outcome Automations',
            'Review & Start'
          ].map((sName, idx) => (
            <React.Fragment key={sName}>
              {idx > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />}
              <div 
                className="flex items-center gap-2 shrink-0 cursor-pointer group focus-visible:outline-none"
                role="button"
                tabIndex={0}
                aria-current={step === idx + 1 ? 'step' : undefined}
                onClick={() => setStep(idx + 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setStep(idx + 1);
                  }
                }}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border transition-all duration-200 group-hover:scale-105",
                  "group-hover:ring-2 group-hover:ring-primary/20 group-focus-visible:ring-2 group-focus-visible:ring-primary/40",
                  step === idx + 1 
                    ? "bg-primary text-primary-foreground border-primary"
                    : step > idx + 1
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted text-muted-foreground border-border"
                )}>
                  {idx + 1}
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider transition-colors duration-200",
                  step === idx + 1 ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80"
                )}>
                  {sName}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Wizard Panel Content */}
        <Card className="border border-border/50 bg-card rounded-2xl shadow-sm min-h-[400px]">
          
          {/* STEP 1: Campaign Info */}
          {step === 1 && (
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">Campaign Specifications</h2>
                <p className="text-xs text-muted-foreground">Set general campaign attributes</p>
              </div>

              <div className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="cName" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign Name</Label>
                  <Input
                    id="cName"
                    name="campaignName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Admissions Follow-Up Campaign"
                    className="h-11 rounded-xl"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cDesc" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign Description</Label>
                  <Input
                    id="cDesc"
                    name="campaignDescription"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Calling parents with pending applications to secure enrollment."
                    className="h-11 rounded-xl"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            </CardContent>
          )}

          {/* STEP 2: Select Script */}
          {step === 2 && (
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">Outreach Calling Script</h2>
                <p className="text-xs text-muted-foreground">Assign the reference script for callers</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-5 space-y-3">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Choose script</Label>
                  {scripts.length === 0 ? (
                    <div className="p-4 bg-muted/30 border border-dashed rounded-xl text-center space-y-3">
                      <p className="text-xs text-muted-foreground">No scripts available.</p>
                      <Button onClick={() => router.push(wrapHref('/admin/messaging/call-centre/scripts/new'))} size="sm" className="rounded-xl">Create Script</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select call script" />
                        </SelectTrigger>
                        <SelectContent>
                          {scripts.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedScriptId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleEditScript}
                          disabled={isEditingScript}
                          className="text-xs text-primary hover:text-primary/80 font-semibold gap-1.5 px-0 h-auto"
                        >
                          {isEditingScript ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Edit3 className="h-3 w-3" />
                          )}
                          Edit Selected Script
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-7 space-y-3">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Script Preview</Label>
                  {selectedScript ? (
                    isJsonGraph(selectedScript.content) ? (
                      <div className="bg-muted/30 p-4 rounded-xl border border-border/50 min-h-[180px] max-h-[400px] overflow-y-auto">
                        <ScriptPlaybookView graph={parseGraph(selectedScript.content)} />
                      </div>
                    ) : (
                      <div className="bg-muted/30 p-5 rounded-xl border border-border/50 text-sm font-serif min-h-[180px] whitespace-pre-line leading-relaxed select-text">
                        {selectedScript.content}
                      </div>
                    )
                  ) : (
                    <div className="bg-muted/30 p-5 rounded-xl border border-border/50 text-sm font-serif min-h-[180px] text-muted-foreground italic flex items-center justify-center">
                      No script selected.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          )}

          {/* STEP 3: Select Audience */}
          {step === 3 && (
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">Target Audience</h2>
                <p className="text-xs text-muted-foreground">Filter CRM contacts to queue for calling</p>
              </div>

              <AudienceSelector
                workspaceId={activeWorkspaceId}
                organizationId={activeOrganizationId}
                channel="call"
                audienceMode={audienceMode}
                filters={filters}
                filterLogic={filterLogic}
                groups={groups}
                savedAudienceId={savedAudienceId}
                selectedContacts={selectedContacts}
                contactScope={contactScope}
                onChange={(updates) => {
                  if (updates.audienceMode !== undefined) setAudienceMode(updates.audienceMode);
                  if (updates.filters !== undefined) setFilters(updates.filters);
                  if (updates.filterLogic !== undefined) setFilterLogic(updates.filterLogic);
                  if (updates.groups !== undefined) setGroups(updates.groups);
                  if (updates.savedAudienceId !== undefined) setSavedAudienceId(updates.savedAudienceId);
                  if (updates.selectedContacts !== undefined) setSelectedContacts(updates.selectedContacts);
                  if (updates.contactScope !== undefined) setContactScope(updates.contactScope);
                }}
              />
            </CardContent>
          )}

          {/* STEP 4: Configure Outcomes */}
          {step === 4 && (
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">Predefined Call Outcomes</h2>
                <p className="text-xs text-muted-foreground">Selectable outcomes available to callers for queue resolution</p>
              </div>

              <div className="space-y-6 max-w-xl">
                {/* Outcomes list */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign Outcomes List</Label>
                  <div className="space-y-2 border border-border/50 rounded-2xl p-4 bg-muted/20 max-h-[300px] overflow-y-auto">
                    {outcomes.map(out => (
                      <div key={out} className="flex items-center justify-between p-3 bg-background border border-border/50 rounded-xl shadow-sm">
                        <span className="text-xs font-bold text-foreground">{out}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOutcome(out)}
                          className="h-8 w-8 text-muted-foreground hover:text-rose-500 rounded-lg"
                          aria-label={`Remove outcome ${out}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Outcome form */}
                <div className="flex gap-2">
                  <Input
                    value={newOutcome}
                    onChange={(e) => setNewOutcome(e.target.value)}
                    placeholder="Add custom outcome, e.g. Left Voicemail"
                    className="h-11 rounded-xl"
                  />
                  <Button
                    type="button"
                    onClick={handleAddOutcome}
                    className="h-11 rounded-xl font-bold text-xs shrink-0"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          )}

          {/* STEP 5: Configure Automations */}
          {step === 5 && (
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">Post-Call Automations</h2>
                <p className="text-xs text-muted-foreground">Map system triggers to run immediately when an outcome is logged</p>
              </div>

              <div className="space-y-8 max-h-[450px] overflow-y-auto pr-2">
                {outcomes.map(out => {
                  const rules = automationRules[out] || [];
                  return (
                    <div key={out} className="border border-border/50 rounded-2xl p-5 bg-muted/10 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-xs font-black uppercase text-foreground">Outcome: {out}</h3>
                        
                        <div className="flex gap-1.5 flex-wrap">
                          {CALL_ACTION_TYPES.map(type => {
                            const meta = getActionMeta(type);
                            const Icon = meta.icon;
                            return (
                              <Badge
                                key={type}
                                onClick={() => handleAddAutomationRule(out, type)}
                                variant="secondary"
                                className="cursor-pointer hover:bg-secondary/80 font-bold text-[8px] px-2 rounded-md gap-1 flex items-center"
                              >
                                <Icon className="h-2.5 w-2.5" />
                                {meta.badgeLabel}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Configured rules list */}
                      {rules.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-1">No automations mapped to this outcome.</p>
                      ) : (
                        <div className="space-y-3">
                          {rules.map((rule, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-3 p-3 bg-background border border-border/50 rounded-xl shadow-sm">
                              
                              <Badge className="font-bold text-[8px] tracking-wider uppercase bg-primary/10 text-primary hover:bg-primary/15 border-primary/20 shrink-0">
                                {rule.type.replace('_', ' ')}
                              </Badge>

                              {/* Rule Parameters inputs */}
                              <div className="flex-grow">
                                {(rule.type === 'SEND_SMS' || rule.type === 'SEND_EMAIL' || rule.type === 'SEND_WHATSAPP') && (
                                  <div className="space-y-1">
                                    {rule.type === 'SEND_WHATSAPP' && (
                                      <div className="flex items-center gap-1 mb-1">
                                        <span className="text-[9px] text-muted-foreground font-semibold">WHATSAPP CHANNEL</span>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                                              Only approved Meta WhatsApp templates are shown
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    )}
                                    <MessagingTemplateSelector
                                      category="campaigns"
                                      recipientType="entity"
                                      channel={getActionMeta(rule.type).channel!}
                                      value={rule.params.templateId ?? ''}
                                      onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'templateId', val)}
                                      compact
                                    />
                                  </div>
                                )}

                                {rule.type === 'CREATE_TASK' && (
                                  <div className="space-y-2">
                                    {/* Task Title */}
                                    <Input
                                      value={rule.params.taskTitle ?? ''}
                                      onChange={(e) => handleUpdateRuleParam(out, rIdx, 'taskTitle', e.target.value)}
                                      onKeyDown={(e) => { if (e.key === '/') e.stopPropagation(); }}
                                      placeholder="Task title e.g. Follow up with {{CONTACT_NAME}}"
                                      className="h-9 rounded-lg text-xs"
                                    />
                                    {/* Task Description */}
                                    <Textarea
                                      value={rule.params.taskDescription ?? ''}
                                      onChange={(e) => handleUpdateRuleParam(out, rIdx, 'taskDescription', e.target.value)}
                                      onKeyDown={(e) => { if (e.key === '/') e.stopPropagation(); }}
                                      placeholder={`Agreed action from {{CALL_DATE}}:\n• {{OUTCOME}}`}
                                      rows={2}
                                      className="bg-background border border-border/50 rounded-lg text-xs p-2 resize-none"
                                    />
                                    <p className="text-[8px] text-muted-foreground/50">
                                      Use <code className="font-mono bg-muted/40 px-0.5 rounded">{'{{'+'VARIABLE'+'}}'}</code> or <code className="font-mono bg-muted/40 px-0.5 rounded">/field</code> to inject data
                                    </p>
                                    {/* Priority */}
                                    <div className="flex gap-2">
                                      <Select
                                        value={rule.params.taskPriority ?? 'medium'}
                                        onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'taskPriority', val as any)}
                                      >
                                        <SelectTrigger className="h-8 flex-1 rounded-lg text-xs">
                                          <SelectValue placeholder="Priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="low">Low</SelectItem>
                                          <SelectItem value="medium">Medium</SelectItem>
                                          <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {/* Assign To */}
                                    <div className="space-y-1">
                                      <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                                        Assign To
                                      </Label>
                                      <Select
                                        value={rule.params.taskAssigneeMode ?? 'caller'}
                                        onValueChange={(val) => {
                                          const existing = automationRules[out] || [];
                                          const updated = [...existing];
                                          updated[rIdx] = {
                                            ...updated[rIdx],
                                            params: {
                                              ...updated[rIdx].params,
                                              taskAssigneeMode: val as any,
                                              taskAssigneeId: val === 'specific' ? updated[rIdx].params.taskAssigneeId : undefined
                                            }
                                          };
                                          setAutomationRules({ ...automationRules, [out]: updated });
                                        }}
                                      >
                                        <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="caller">Current Caller (Agent)</SelectItem>
                                          <SelectItem value="round_robin">Round Robin</SelectItem>
                                          <SelectItem value="specific">Specific User</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Specific user picker */}
                                    {rule.params.taskAssigneeMode === 'specific' && (
                                      <div className="space-y-1">
                                        <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                                          Select User
                                        </Label>
                                        <Select
                                          value={rule.params.taskAssigneeId || '__none__'}
                                          onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'taskAssigneeId', val === '__none__' ? undefined : val)}
                                        >
                                          <SelectTrigger className="h-8 bg-background border border-border rounded-lg text-xs">
                                            <SelectValue placeholder="Choose a workspace user..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {workspaceUsers.length > 0 ? (
                                              workspaceUsers.map((u) => (
                                                <SelectItem key={u.id} value={u.id}>
                                                  <span className="flex flex-col">
                                                    <span className="font-medium">{u.name || u.email}</span>
                                                    {u.name && (
                                                      <span className="text-[9px] text-muted-foreground">{u.email}</span>
                                                    )}
                                                  </span>
                                                </SelectItem>
                                              ))
                                            ) : (
                                              <SelectItem value="__none__" disabled>
                                                No workspace users found
                                              </SelectItem>
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}

                                    {/* Due date mode toggle */}
                                    <div className="flex gap-1.5">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={(rule.params.taskDueDateMode ?? 'days') === 'days' ? 'default' : 'outline'}
                                        className="h-7 text-[9px] flex-1 gap-1"
                                        onClick={() => handleUpdateRuleParam(out, rIdx, 'taskDueDateMode', 'days')}
                                      >
                                        <CalendarDays className="h-3 w-3" />
                                        Days from call
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={(rule.params.taskDueDateMode ?? 'days') === 'specific' ? 'default' : 'outline'}
                                        className="h-7 text-[9px] flex-1 gap-1"
                                        onClick={() => handleUpdateRuleParam(out, rIdx, 'taskDueDateMode', 'specific')}
                                      >
                                        <Calendar className="h-3 w-3" />
                                        Specific date
                                      </Button>
                                    </div>
                                    {/* Days input */}
                                    {(rule.params.taskDueDateMode ?? 'days') === 'days' && (
                                      <div className="flex gap-2 items-center">
                                        <Label className="text-[9px] text-muted-foreground shrink-0 uppercase font-semibold">Days after call:</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={rule.params.taskDueDays ?? 1}
                                          onChange={(e) => handleUpdateRuleParam(out, rIdx, 'taskDueDays', Number(e.target.value) || 1)}
                                          onKeyDown={(e) => { if (e.key === '/') e.stopPropagation(); }}
                                          className="h-8 w-20 rounded-lg text-xs"
                                        />
                                      </div>
                                    )}
                                    {/* Specific date input */}
                                    {rule.params.taskDueDateMode === 'specific' && (
                                      <Input
                                        type="date"
                                        value={rule.params.taskDueSpecificDate ?? ''}
                                        onChange={(e) => handleUpdateRuleParam(out, rIdx, 'taskDueSpecificDate', e.target.value)}
                                        className="h-8 rounded-lg text-xs"
                                      />
                                    )}
                                    {/* Time of day */}
                                    <div className="flex gap-2 items-center">
                                      <Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                      <Input
                                        type="time"
                                        value={rule.params.taskDueTimeOfDay ?? '15:00'}
                                        onChange={(e) => handleUpdateRuleParam(out, rIdx, 'taskDueTimeOfDay', e.target.value)}
                                        className="h-8 flex-1 rounded-lg text-xs"
                                      />
                                      <span className="text-[8px] text-muted-foreground/50 shrink-0">Agents may update</span>
                                    </div>
                                  </div>
                                )}

                                {rule.type === 'CHANGE_STAGE' && (
                                  <Select
                                    value={rule.params.stageId && rule.params.stageId.length > 0 ? rule.params.stageId : '__none__'}
                                    onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'stageId', val === '__none__' ? undefined : val)}
                                  >
                                    <SelectTrigger className="h-9 rounded-lg text-xs">
                                      <SelectValue placeholder="Select pipeline stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {stages.length > 0 ? (
                                        stages.map((st) => (
                                          <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="__none__" disabled>No stages found</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}

                                {(rule.type === 'ADD_TAG' || rule.type === 'REMOVE_TAG') && (
                                  <Select
                                    value={rule.params.tagId && rule.params.tagId.length > 0 ? rule.params.tagId : '__none__'}
                                    onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'tagId', val === '__none__' ? undefined : val)}
                                  >
                                    <SelectTrigger className="h-9 rounded-lg text-xs">
                                      <SelectValue placeholder={rule.type === 'ADD_TAG' ? 'Select tag to add' : 'Select tag to remove'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {tags.length > 0 ? (
                                        tags.map((tg) => (
                                          <SelectItem key={tg.id} value={tg.id}>{tg.name}</SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="__none__" disabled>No tags found</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}

                                {rule.type === 'WEBHOOK' && (
                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <Input
                                        value={rule.params.webhookUrl ?? ''}
                                        onChange={(e) => handleUpdateRuleParam(out, rIdx, 'webhookUrl', e.target.value)}
                                        placeholder="https://api.thirdparty.com/webhook"
                                        className="h-9 rounded-lg text-xs flex-grow"
                                      />
                                      <Select 
                                        value={rule.params.webhookMethod ?? 'POST'} 
                                        onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'webhookMethod', val as any)}
                                      >
                                        <SelectTrigger className="h-9 w-24 rounded-lg text-xs shrink-0">
                                          <SelectValue placeholder="Method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="POST">POST</SelectItem>
                                          <SelectItem value="GET">GET</SelectItem>
                                          <SelectItem value="PUT">PUT</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Textarea
                                      value={rule.params.webhookHeaders ?? ''}
                                      onChange={(e) => handleUpdateRuleParam(out, rIdx, 'webhookHeaders', e.target.value)}
                                      placeholder='Custom Headers JSON e.g. { "Authorization": "Bearer key" }'
                                      rows={1}
                                      className="bg-background border border-border/50 rounded-lg text-xs p-2 resize-none h-8 min-h-[34px] leading-tight"
                                    />
                                  </div>
                                )}

                                {rule.type === 'LOG_NOTE' && (
                                  <div className="space-y-1">
                                    <Textarea
                                      value={rule.params.noteContent ?? ''}
                                      onChange={(e) => handleUpdateRuleParam(out, rIdx, 'noteContent', e.target.value)}
                                      placeholder="Enter note content. Support {{OUTCOME}} or contact/deal variables..."
                                      rows={2}
                                      className="bg-background border border-border/50 rounded-lg text-xs p-2 resize-none h-14"
                                    />
                                  </div>
                                )}

                                {rule.type === 'SCHEDULE_MEETING' && (
                                  <Select
                                    value={rule.params.meetingTypeId && rule.params.meetingTypeId.length > 0 ? rule.params.meetingTypeId : '__none__'}
                                    onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'meetingTypeId', val === '__none__' ? undefined : val)}
                                  >
                                    <SelectTrigger className="h-9 rounded-lg text-xs">
                                      <SelectValue placeholder="Select meeting type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {meetings.length > 0 ? (
                                        meetings.map((mt) => (
                                          <SelectItem key={mt.id} value={mt.id}>{mt.title}</SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="__none__" disabled>No meeting types found</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}

                                {rule.type === 'TRANSFER_CALL' && (
                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <Select 
                                        value={rule.params.transferMode ?? 'phone'} 
                                        onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'transferMode', val as any)}
                                      >
                                        <SelectTrigger className="h-9 w-40 rounded-lg text-xs shrink-0">
                                          <SelectValue placeholder="Transfer Mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="phone">Direct Phone Number</SelectItem>
                                          <SelectItem value="agent">To Agent / Extension</SelectItem>
                                          <SelectItem value="campaign">To Another Campaign</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        value={rule.params.transferTarget ?? ''}
                                        onChange={(e) => handleUpdateRuleParam(out, rIdx, 'transferTarget', e.target.value)}
                                        placeholder={
                                          rule.params.transferMode === 'phone' 
                                            ? '+1 (555) 000-0000' 
                                            : rule.params.transferMode === 'agent'
                                              ? 'agent_id or ext 200'
                                              : 'campaign_id_to_transfer'
                                        }
                                        className="h-9 rounded-lg text-xs flex-grow"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveAutomationRule(out, rIdx)}
                                className="h-8 w-8 text-muted-foreground hover:text-rose-500 rounded-lg shrink-0"
                                aria-label={`Remove automation rule ${rIdx + 1} for ${out}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>

                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}

          {/* STEP 6: Review & Launch */}
          {step === 6 && (
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">Campaign Summary Audit</h2>
                <p className="text-xs text-muted-foreground">Verify settings before queuing calls</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 max-w-4xl">
                <div className="md:col-span-6 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign Name</p>
                    <p className="text-sm font-bold text-foreground">{name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Script Selected</p>
                    <p className="text-sm font-semibold text-foreground">{selectedScript ? selectedScript.name : 'None'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Target Audience Mode</p>
                    <p className="text-xs text-foreground uppercase tracking-wider font-bold">
                      {audienceMode === 'all' && 'All Contacts'}
                      {audienceMode === 'advanced' && 'By Filters'}
                      {audienceMode === 'saved' && 'Saved Audience'}
                      {audienceMode === 'manual' && 'Manual Selection'}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-6 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Enabled Outcomes</p>
                    <div className="flex flex-wrap gap-1">
                      {outcomes.map(o => (
                        <Badge key={o} variant="outline" className="font-bold text-[9px] rounded bg-muted/30">
                          {o}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Post-Call Automation Triggers</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {Object.keys(automationRules).map(out => {
                        const rules = automationRules[out] || [];
                        if (rules.length === 0) return null;
                        return (
                          <div key={out} className="flex justify-between font-semibold">
                            <span>Outcome: {out}</span>
                            <span className="text-primary">
                              {rules.map(r => getActionMeta(r.type).label).join(', ')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          )}

          {/* Wizard Navigation Footer */}
          <div className="p-6 border-t border-border/30 flex justify-between gap-4 bg-muted/10 rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              className={cn("rounded-xl font-bold text-xs", step === 1 && "invisible")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" /> Previous Step
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSavingDraft || isLaunching || !name.trim()}
                className="rounded-xl font-bold text-xs gap-1.5 border-border bg-card hover:bg-accent text-card-foreground"
              >
                {isSavingDraft ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Save Draft
              </Button>

              {step < 6 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={
                    (step === 1 && !name.trim()) ||
                    (step === 2 && !selectedScriptId) ||
                    (step === 4 && outcomes.length === 0)
                  }
                  className="rounded-xl font-bold text-xs"
                >
                  Next Step <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={isLaunching || isSavingDraft || !name.trim()}
                  className="rounded-xl font-bold text-xs gap-2 px-6 shadow-lg bg-primary hover:bg-primary/95"
                >
                  {isLaunching ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  )}
                  Launch & Start Call Queue
                </Button>
              )}
            </div>
          </div>

        </Card>

      </div>
    </PageContainer>
  );
}

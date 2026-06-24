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
import { Switch } from '@/components/ui/switch';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowRight,
  Play,
  ChevronRight,
  RefreshCw,
  Save,
  Edit3,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudienceSelector } from '@/app/admin/messaging/audiences/components/AudienceSelector';
import { legacyAudienceToFilters } from '@/lib/audience-hooks';
import type { AudienceFilter, AudienceDefinition, MessageTemplate } from '@/lib/types';
import type { ConditionGroup } from '@/lib/automation-condition';
import { isJsonGraph, parseGraph, extractOutcomesFromGraph, getOutcomeAutomations } from '@/lib/call-centre-graph';
import { ScriptPlaybookView } from '../../scripts/components/ScriptPlaybookView';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { getActionMeta } from '@/lib/call-action-types';
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
    if (initialStep && initialStep >= 1 && initialStep <= 4) {
      return initialStep;
    }
    return 1;
  });
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [allowAddContactsAfterLaunch, setAllowAddContactsAfterLaunch] = React.useState(false);
  const [triggerActionsAutomatically, setTriggerActionsAutomatically] = React.useState(true);
  const [campaignProgressCompleted, setCampaignProgressCompleted] = React.useState(0);
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

  // Outcomes + their post-call automations now live on the script's outcome nodes —
  // the campaign derives them from the selected script (see derivedOutcomes below).

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
          
          setAllowAddContactsAfterLaunch(campaign.allowAddContactsAfterLaunch ?? false);
          setTriggerActionsAutomatically(campaign.triggerActionsAutomatically ?? true);
          setCampaignProgressCompleted(campaign.progress?.completed || 0);
          // Outcomes + automations are derived from the script (see derivedOutcomes); the
          // legacy campaign.outcomes / automationRules are no longer edited here.
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

  // Outcomes + their automations are owned by the script's outcome nodes. Parse the
  // selected script once and derive the outcome list from it (single source of truth).
  const scriptGraph = React.useMemo(
    () => parseGraph(selectedScript?.content),
    [selectedScript?.content]
  );
  const derivedOutcomes = React.useMemo(
    () => extractOutcomesFromGraph(scriptGraph),
    [scriptGraph]
  );

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
            outcomes: derivedOutcomes,
            automationRules: {},
            allowAddContactsAfterLaunch,
            triggerActionsAutomatically,
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
            outcomes: derivedOutcomes,
            automationRules: {},
            allowAddContactsAfterLaunch,
            triggerActionsAutomatically,
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
              Define details, the script playbook, and the contact audience. Outcomes and their automations come from the script.
            </p>
          </div>
        </div>

        {/* Steps Breadcrumb Progress */}
        <div className="flex items-center gap-2 overflow-x-auto py-2 border-b border-border/30">
          {[
            'Campaign Info',
            'Select Script',
            'Select Audience',
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
                <div className="pt-2 flex flex-col space-y-3 border-t border-border mt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Audience Management</Label>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {allowAddContactsAfterLaunch ? 'Dynamic Audience (Loose campaign - allows adding contacts after launch)' : 'Fixed Audience (Tight campaign - locked audience after launch)'}
                      </span>
                    </div>
                    <Switch
                      checked={allowAddContactsAfterLaunch}
                      onCheckedChange={setAllowAddContactsAfterLaunch}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Automation Action Behaviour</Label>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {triggerActionsAutomatically ? 'Trigger actions automatically on node transition' : 'Let representative review and confirm actions manually before triggering'}
                      </span>
                    </div>
                    <Switch
                      checked={triggerActionsAutomatically}
                      onCheckedChange={setTriggerActionsAutomatically}
                    />
                  </div>
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
                      <Select disabled={campaignProgressCompleted > 0} value={selectedScriptId} onValueChange={setSelectedScriptId}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select call script" />
                        </SelectTrigger>
                        <SelectContent>
                          {scripts.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {campaignProgressCompleted > 0 && (
                        <p className="text-[10px] font-semibold text-rose-500 flex items-center gap-1.5 mt-1">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          This campaign has active progress. Playbook script swapping is locked to maintain outcome reporting integrity.
                        </p>
                      )}
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

          {/* STEP 4: Review & Launch */}
          {step === 4 && (
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
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Outcomes (from script)</p>
                    {derivedOutcomes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {derivedOutcomes.map(o => (
                          <Badge key={o} variant="outline" className="font-bold text-[9px] rounded bg-muted/30">
                            {o}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/70 italic">
                        This script defines no outcome nodes. Add outcomes in the script builder.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Post-Call Automation Triggers</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {derivedOutcomes.map(out => {
                        const rules = getOutcomeAutomations(scriptGraph, out) ?? [];
                        if (rules.length === 0) return null;
                        return (
                          <div key={out} className="flex justify-between font-semibold gap-2">
                            <span>Outcome: {out}</span>
                            <span className="text-primary text-right">
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

              {step < 4 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={
                    (step === 1 && !name.trim()) ||
                    (step === 2 && !selectedScriptId)
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

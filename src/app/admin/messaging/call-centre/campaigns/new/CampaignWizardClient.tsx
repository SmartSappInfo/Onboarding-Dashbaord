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
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudienceSelector } from '@/app/admin/messaging/audiences/components/AudienceSelector';
import { legacyAudienceToFilters } from '@/lib/audience-hooks';
import type { AudienceFilter } from '@/lib/types';
import type { ConditionGroup } from '@/lib/automation-condition';
import { isJsonGraph, parseGraph } from '@/lib/call-centre-graph';
import { ScriptPlaybookView } from '../../scripts/components/ScriptPlaybookView';

interface CampaignWizardClientProps {
  campaignId?: string;
}

export function CampaignWizardClient({ campaignId }: CampaignWizardClientProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
  const { toast } = useToast();

  const { scripts } = useCallScripts(activeWorkspaceId);

  // ─── Step States ───────────────────────────────────────────────────────────
  const [step, setStep] = React.useState(1);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedScriptId, setSelectedScriptId] = React.useState('');
  
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
  const [automationRules, setAutomationRules] = React.useState<Record<string, any[]>>({});

  // Loading/Wizard States
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLaunching, setIsLaunching] = React.useState(false);

  const wrapHref = (href: string) => {
    if (!activeWorkspaceId) return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}track=${activeWorkspaceId}`;
  };

  // ─── Query Tags, Stages, Templates ──────────────────────────────────────────

  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: tagsData } = useCollection<any>(tagsQuery);
  const tags = tagsData || [];

  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'onboardingStages'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: stagesData } = useCollection<any>(stagesQuery);
  const stages = stagesData || [];

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'message_templates'), where('workspaceIds', 'array-contains', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: templatesData } = useCollection<any>(templatesQuery);
  const templates = templatesData || [];

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
          setAutomationRules(campaign.automationRules || {});
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

  const handleAddAutomationRule = (outcome: string, type: string) => {
    const existing = automationRules[outcome] || [];
    let params: any = {};
    
    if (type === 'CHANGE_STAGE') params = { stageId: stages[0]?.id || '' };
    if (type === 'ADD_TAG') params = { tagId: tags[0]?.id || '' };
    if (type === 'CREATE_TASK') params = { taskTitle: 'Follow Up Call', taskPriority: 'medium' };
    if (type === 'SEND_SMS' || type === 'SEND_EMAIL') params = { templateId: templates[0]?.id || '' };

    const newRule = { type, params };
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

  const handleUpdateRuleParam = (outcome: string, index: number, key: string, value: any) => {
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

  // ─── Launch Campaign ────────────────────────────────────────────────────────

  const handleLaunchCampaign = async () => {
    if (!name.trim()) return;
    if (!selectedScriptId) return;

    setIsLaunching(true);
    try {
      const audienceDefinition = {
        mode: audienceMode,
        filters,
        filterLogic,
        groups,
        savedAudienceId,
        selectedContacts,
        contactScope,
      };

      let currentCampaignId = campaignId;

      if (campaignId) {
        // Update
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
      } else {
        // Create
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
        currentCampaignId = result.id;
      }

      if (!currentCampaignId) throw new Error('Failed to resolve campaign identity');

      // Generate call queue snapshot and launch
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
              <div className="flex items-center gap-2 shrink-0">
                <div className={cn(
                  "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border",
                  step === idx + 1 
                    ? "bg-primary text-primary-foreground border-primary"
                    : step > idx + 1
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted text-muted-foreground border-border"
                )}>
                  {idx + 1}
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  step === idx + 1 ? "text-foreground" : "text-muted-foreground"
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
                          {[
                            { label: '+ Stage Change', type: 'CHANGE_STAGE' },
                            { label: '+ Tag Contact', type: 'ADD_TAG' },
                            { label: '+ Create Task', type: 'CREATE_TASK' },
                            { label: '+ Send SMS', type: 'SEND_SMS' },
                            { label: '+ Send Email', type: 'SEND_EMAIL' }
                          ].map(opt => (
                            <Badge
                              key={opt.type}
                              onClick={() => handleAddAutomationRule(out, opt.type)}
                              variant="secondary"
                              className="cursor-pointer hover:bg-secondary/80 font-bold text-[8px] px-2 rounded-md"
                            >
                              {opt.label}
                            </Badge>
                          ))}
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
                                {rule.type === 'CHANGE_STAGE' && (
                                  <Select 
                                    value={rule.params.stageId} 
                                    onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'stageId', val)}
                                  >
                                    <SelectTrigger className="h-9 rounded-lg text-xs">
                                      <SelectValue placeholder="Select stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {stages.map((st: any) => (
                                        <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}

                                {rule.type === 'ADD_TAG' && (
                                  <Select 
                                    value={rule.params.tagId} 
                                    onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'tagId', val)}
                                  >
                                    <SelectTrigger className="h-9 rounded-lg text-xs">
                                      <SelectValue placeholder="Select tag" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {tags.map((tg: any) => (
                                        <SelectItem key={tg.id} value={tg.id}>{tg.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}

                                {rule.type === 'CREATE_TASK' && (
                                  <div className="flex gap-2">
                                    <Input
                                      value={rule.params.taskTitle}
                                      onChange={(e) => handleUpdateRuleParam(out, rIdx, 'taskTitle', e.target.value)}
                                      placeholder="Task title"
                                      className="h-9 rounded-lg text-xs flex-grow"
                                    />
                                    <Select 
                                      value={rule.params.taskPriority} 
                                      onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'taskPriority', val)}
                                    >
                                      <SelectTrigger className="h-9 w-28 rounded-lg text-xs shrink-0">
                                        <SelectValue placeholder="Priority" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {(rule.type === 'SEND_SMS' || rule.type === 'SEND_EMAIL') && (
                                  <Select 
                                    value={rule.params.templateId} 
                                    onValueChange={(val) => handleUpdateRuleParam(out, rIdx, 'templateId', val)}
                                  >
                                    <SelectTrigger className="h-9 rounded-lg text-xs">
                                      <SelectValue placeholder="Select templates" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {templates.map((tmpl: any) => (
                                        <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
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
                        const count = automationRules[out]?.length || 0;
                        if (count === 0) return null;
                        return (
                          <div key={out} className="flex justify-between font-semibold">
                            <span>Outcome: {out}</span>
                            <span className="text-primary">{count} actions mapped</span>
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
                disabled={isLaunching}
                className="rounded-xl font-bold text-xs gap-2 px-6 shadow-lg bg-primary hover:bg-primary/95"
              >
                {isLaunching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                )}
                Launch & Start Call Queue
              </Button>
            )}
          </div>

        </Card>

      </div>
    </PageContainer>
  );
}

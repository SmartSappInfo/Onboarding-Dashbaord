'use client';

import * as React from 'react';
import { 
    Zap, 
    Play, 
    Database, 
    Mail, 
    CheckSquare, 
    Building, 
    Clock, 
    Target, 
    ArrowRightLeft, 
    Timer, 
    Info, 
    Globe, 
    Copy, 
    Check, 
    Smartphone, 
    PlusCircle,
    Tag,
    X,
    DollarSign,
    ShieldAlert,
    Activity,
    Settings2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { MessageTemplate, UserProfile, OnboardingStage, VariableDefinition, Tag as TagType, Pipeline } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useParams } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';
import { useTerminology } from '@/hooks/use-terminology';
import type { AutomationTrigger } from '@/lib/types';

interface NodeInspectorProps {
    node: any;
    onUpdate: (data: any) => void;
}

const TRIGGER_GROUPS: { label: string; options: { value: AutomationTrigger; label: string; icon: typeof Building; desc: string }[] }[] = [
    {
        label: 'Entities',
        options: [
            { value: 'ENTITY_CREATED', label: 'Entity Created', icon: Building, desc: 'Fires when a new entity is added to the workspace.' },
            { value: 'ENTITY_UPDATED', label: 'Entity Updated', icon: Building, desc: 'Fires when entity identity or profile fields change.' },
            { value: 'ENTITY_ASSIGNED', label: 'Entity Assigned', icon: Building, desc: 'Fires when ownership is assigned.' },
            { value: 'ENTITY_STAGE_CHANGED', label: 'Pipeline Stage Changed', icon: Zap, desc: 'Fires when an entity moves on the Kanban board.' },
            { value: 'ENTITY_LINKED', label: 'Entity Linked', icon: Building, desc: 'Fires when an entity is linked to a workspace.' },
            { value: 'ENTITY_UNLINKED', label: 'Entity Unlinked', icon: Building, desc: 'Fires when an entity is removed from a workspace.' },
            { value: 'WORKSPACE_ENTITY_UPDATED', label: 'Workspace Entity Updated', icon: Building, desc: 'Fires when workspace-scoped fields change.' },
            { value: 'ENTITY_FIELD_CHANGED', label: 'Entity Field Changed', icon: Settings2, desc: 'Fires when a specific standard or custom field changes.' },
            { value: 'DATE_REACHED', label: 'Date Field Reached', icon: Clock, desc: 'Fires on, before, or after a specific date property of an entity.' },
            { value: 'SCORE_CHANGED', label: 'Health Score Changed', icon: Activity, desc: 'Fires when the overall health or lead score changes/crosses a threshold.' },
            { value: 'ENTITY_INACTIVE', label: 'Contact Inactivity', icon: Clock, desc: 'Fires when an entity has no tracked activity for a set duration.' },
        ],
    },
    {
        label: 'Pipeline & Deals',
        options: [
            { value: 'DEAL_CREATED', label: 'Deal Created', icon: Target, desc: 'Fires when a new deal is created.' },
            { value: 'DEAL_STAGE_CHANGED', label: 'Deal Stage Changed', icon: ArrowRightLeft, desc: 'Fires when a deal moves stages.' },
            { value: 'DEAL_STATUS_CHANGED', label: 'Deal Status Changed', icon: Zap, desc: 'Fires when a deal is won, lost, or reopened.' },
            { value: 'DEAL_VALUE_CHANGED', label: 'Deal Value Changed', icon: DollarSign, desc: 'Fires when deal value changes.' },
            { value: 'DEAL_OWNER_CHANGED', label: 'Deal Owner Changed', icon: Target, desc: 'Fires when deal assignee changes.' },
        ],
    },
    {
        label: 'Engagement',
        options: [
            { value: 'FORM_SUBMITTED', label: 'Form Submitted', icon: Database, desc: 'Fires when a workspace form is submitted.' },
            { value: 'SURVEY_SUBMITTED', label: 'Survey Submitted', icon: Database, desc: 'Fires when a survey is completed.' },
            { value: 'PDF_SIGNED', label: 'Document Signed', icon: Target, desc: 'Fires when a PDF agreement is fully signed.' },
            { value: 'CAMPAIGN_PAGE_SUBMITTED', label: 'Campaign Page Conversion', icon: Globe, desc: 'Fires when a landing page form converts.' },
            { value: 'WEBPAGE_VISITED', label: 'Webpage Visited', icon: Globe, desc: 'Fires when a contact visits a tracked landing page URL.' },
            { value: 'EVENT_RECORDED', label: 'Custom Event Recorded', icon: Activity, desc: 'Fires when telemetry or app event logs are received.' },
        ],
    },
    {
        label: 'Meetings',
        options: [
            { value: 'MEETING_CREATED', label: 'Meeting Scheduled', icon: Play, desc: 'Fires when a meeting is created.' },
            { value: 'MEETING_REGISTRANT_ADDED', label: 'Registrant Added', icon: Play, desc: 'Fires when someone registers for a meeting.' },
            { value: 'MEETING_REGISTRANT_ATTENDED', label: 'Registrant Attended', icon: Play, desc: 'Fires when a registrant joins the session.' },
            { value: 'MEETING_REGISTRANT_NO_SHOW', label: 'Registrant No-Show', icon: Play, desc: 'Fires when marked as no-show.' },
        ],
    },
    {
        label: 'Tasks & Tags',
        options: [
            { value: 'TASK_CREATED', label: 'Task Created', icon: CheckSquare, desc: 'Fires when a CRM task is created.' },
            { value: 'TASK_COMPLETED', label: 'Task Completed', icon: CheckSquare, desc: 'Fires when a task is marked done.' },
            { value: 'TASK_OVERDUE', label: 'Task Overdue', icon: ShieldAlert, desc: 'Fires when a CRM task passes its due date.' },
            { value: 'TAG_ADDED', label: 'Tag Added', icon: Tag, desc: 'Fires when a tag is applied to an entity.' },
            { value: 'TAG_REMOVED', label: 'Tag Removed', icon: Tag, desc: 'Fires when a tag is removed.' },
        ],
    },
    {
        label: 'Campaigns',
        options: [
            { value: 'CAMPAIGN_DELIVERED', label: 'Campaign Delivered', icon: Mail, desc: 'Fires per entity when campaign email is delivered.' },
            { value: 'CAMPAIGN_FAILED', label: 'Campaign Failed', icon: Mail, desc: 'Fires when delivery fails.' },
            { value: 'CAMPAIGN_NOT_DELIVERED', label: 'Campaign Not Delivered', icon: Mail, desc: 'Fires when message was not delivered.' },
            { value: 'CAMPAIGN_OPENED', label: 'Campaign Opened', icon: Mail, desc: 'Fires when recipient opens email.' },
            { value: 'CAMPAIGN_CLICKED', label: 'Campaign Clicked', icon: Mail, desc: 'Fires when recipient clicks a link.' },
            { value: 'EMAIL_BOUNCED', label: 'Email Campaign Bounced', icon: ShieldAlert, desc: 'Fires when email delivery fails or bounces.' },
        ],
    },
    {
        label: 'Integrations',
        options: [
            { value: 'WEBHOOK_RECEIVED', label: 'Webhook Received', icon: Globe, desc: 'Fires when data is POSTed to this automation endpoint.' },
        ],
    },
];

const TRIGGER_OPTIONS = TRIGGER_GROUPS.flatMap((g) => g.options);

const ACTION_TYPES = [
    { value: 'SEND_MESSAGE', label: 'Dispatch Message', icon: Mail, desc: 'Send an automated Email or SMS.' },
    { value: 'CREATE_TASK', label: 'Initialize Task', icon: Clock, desc: 'Add a new task to the CRM.' },
    { value: 'UPDATE_ENTITY', label: 'Update Entity', icon: Building, desc: 'Update pipeline stage, assignee, or status.' },
    { value: 'ASSIGN_ENTITY', label: 'Assign Entity', icon: Building, desc: 'Set the workspace assignee.' },
    { value: 'ADD_NOTE', label: 'Add Note', icon: Database, desc: 'Append a note to the entity timeline.' },
    { value: 'CREATE_DEAL', label: 'Create Deal', icon: Target, desc: 'Create a new deal in a pipeline.' },
    { value: 'UPDATE_DEAL_STAGE', label: 'Update Deal Stage', icon: ArrowRightLeft, desc: 'Move a deal to another stage.' },
    { value: 'UPDATE_DEAL_VALUE', label: 'Update Deal Value', icon: DollarSign, desc: 'Change deal value.' },
    { value: 'UPDATE_DEAL_STATUS', label: 'Update Deal Status', icon: Zap, desc: 'Set deal won, lost, or open.' },
    { value: 'UPDATE_TASK', label: 'Update Task', icon: CheckSquare, desc: 'Change task status or assignee.' },
    { value: 'TRIGGER_OUTBOUND_WEBHOOK', label: 'Call Webhook', icon: Globe, desc: 'POST payload to an outbound webhook.' },
    { value: 'RUN_AUTOMATION', label: 'Run Automation', icon: Zap, desc: 'Chain another automation by ID.' },
];

const CONDITION_OPERATORS = [
    { value: 'equals', label: 'Exactly Equals' },
    { value: 'not_equals', label: 'Does Not Equal' },
    { value: 'contains', label: 'Contains Keyword' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
];

export function NodeInspector({ node, onUpdate }: NodeInspectorProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { singular } = useTerminology();
    const params = useParams();
    const automationId = params.id as string;
    const data = node.data || {};
    const config = data.config || {};

    const [hasCopied, setHasCopied] = React.useState(false);

    // Data Loaders
    const usersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true), orderBy('name', 'asc')) : null, 
    [firestore]);

    const stagesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, 
    [firestore]);

    const pipelinesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'pipelines'), orderBy('name', 'asc')) : null, 
    [firestore]);

    const varsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'messaging_variables')) : null, 
    [firestore]);

    const tagsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'tags'), orderBy('name', 'asc')) : null,
    [firestore]);

    const formsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'forms'), orderBy('name', 'asc')) : null,
    [firestore]);

    const surveysQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'surveys'), orderBy('internalName', 'asc')) : null,
    [firestore]);

    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: stages } = useCollection<OnboardingStage>(stagesQuery);
    const { data: pipelines } = useCollection<Pipeline>(pipelinesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);
    const { data: allTags } = useCollection<TagType>(tagsQuery);
    const { data: forms } = useCollection<{ id: string; name?: string; title?: string }>(formsQuery);
    const { data: surveys } = useCollection<{ id: string; internalName?: string; title?: string }>(surveysQuery);

    const updateConfig = (updates: any) => {
        onUpdate({ config: { ...config, ...updates } });
    };

    const updateTagNodeData = (updates: Record<string, unknown>) => {
        onUpdate(updates);
    };

    const webhookUrl = React.useMemo(() => {
        if (typeof window === 'undefined' || !automationId) return '';
        const base = window.location.origin;
        return `${base}/api/automations/webhook/${automationId}`;
    }, [automationId]);

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl);
        setHasCopied(true);
        toast({ title: 'Webhook Endpoint Copied' });
        setTimeout(() => setHasCopied(false), 2000);
    };

    // Helper to determine template category based on trigger
    const inferredCategory = React.useMemo(() => {
        const trigger = data.trigger;
        if (trigger === 'SURVEY_SUBMITTED') return 'surveys';
        if (trigger === 'ENTITY_CREATED' || trigger === 'ENTITY_STAGE_CHANGED') return 'onboarding';
        if (trigger === 'WEBHOOK_RECEIVED') return 'forms'; // Often used for forms
        return 'onboarding'; // Default to onboarding as it's the largest category
    }, [data.trigger]);

    return (
        <div className="flex flex-col h-full text-left min-h-0">
            <div className="flex-1 overflow-y-auto -mx-4 px-4 scrollbar-thin">
                <div className="space-y-10 pb-32 pt-2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-[8px] uppercase h-5">Element Config</Badge>
                            <span className="text-[10px] font-semibold text-muted-foreground opacity-40">ID: {node.id.substring(0, 8)}</span>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Step Label</Label>
                            <Input 
                                value={data.label || ''} 
                                onChange={e => onUpdate({ label: e.target.value })} 
                                placeholder="Give this step a name..."
                                className="h-11 rounded-xl bg-background border-none font-bold shadow-inner"
                            />
                        </div>
                    </div>

                    <Separator className="opacity-50" />

                    {node.type === 'triggerNode' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
                                    <Zap className="h-3 w-3" /> Event Protocol Entry
                                </Label>
                                <div className="space-y-6">
                                    {TRIGGER_GROUPS.map((group) => (
                                        <div key={group.label} className="space-y-2">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground ml-1">{group.label}</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {group.options.map((trigger) => (
                                                    <button
                                                        key={trigger.value}
                                                        type="button"
                                                        onClick={() => onUpdate({
                                                            trigger: trigger.value,
                                                            label: trigger.value === 'ENTITY_CREATED' ? `${singular} Created` : trigger.label
                                                        })}
                                                        className={cn(
                                                            "flex items-start gap-4 p-3 rounded-2xl border-2 transition-all text-left group",
                                                            data.trigger === trigger.value ? "border-emerald-500 bg-emerald-500/10 shadow-md" : "border-transparent bg-background hover:bg-card/50"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "p-2 rounded-xl transition-all shadow-sm shrink-0",
                                                            data.trigger === trigger.value ? "bg-emerald-500 text-white" : "bg-card text-muted-foreground"
                                                        )}>
                                                            <trigger.icon className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-xs tracking-tight leading-none mb-1">{trigger.label}</p>
                                                            <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">{trigger.desc}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {data.trigger === 'WEBHOOK_RECEIVED' && (
                                <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-[10px] font-semibold text-blue-500 flex items-center gap-2">
                                                <Globe className="h-3 w-3" /> Ingress Endpoint
                                            </Label>
                                            <Badge className="bg-blue-500 text-white border-none text-[8px] h-4">POST</Badge>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 p-3 rounded-xl bg-slate-950/50 border border-white/5 shadow-inner overflow-hidden">
                                                <p className="text-[10px] font-mono text-blue-500 break-all select-all">{webhookUrl}</p>
                                            </div>
                                            <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl bg-card shadow-lg" onClick={copyWebhookUrl}>
                                                {hasCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(data.trigger === 'TAG_ADDED' || data.trigger === 'TAG_REMOVED') && (
                                <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                                <Tag className="h-3 w-3" /> Filter by Tags
                                            </Label>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {(config.tagIds || []).map((id: string) => {
                                                    const tag = allTags?.find((t: TagType) => t.id === id);
                                                    return (
                                                        <Badge key={id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-600 border-none group">
                                                            <span className="text-[10px] font-bold tracking-tight">{tag?.name || id}</span>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-4 w-4 rounded-md hover:bg-emerald-500/20"
                                                                onClick={() => updateConfig({ tagIds: config.tagIds.filter((t: string) => t !== id) })}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                            <Select 
                                                value="" 
                                                onValueChange={(v) => {
                                                    const current = config.tagIds || [];
                                                    if (!current.includes(v)) {
                                                        updateConfig({ tagIds: [...current, v] });
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                    <SelectValue placeholder="Add tags to watch..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    {(allTags || []).map((tag: TagType) => (
                                                        <SelectItem key={tag.id} value={tag.id} className="rounded-lg p-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                                                <span className="font-bold text-xs">{tag.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {data.trigger === 'FORM_SUBMITTED' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
                                    <Label className="text-[10px] font-semibold text-blue-600 flex items-center gap-2">
                                        <Database className="h-3 w-3" /> Filter by Form
                                    </Label>
                                    <Select
                                        value={config.formId || 'all_forms'}
                                        onValueChange={(v) => updateConfig({ formId: v === 'all_forms' ? null : v })}
                                    >
                                        <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                            <SelectValue placeholder="All forms" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                            <SelectItem value="all_forms" className="rounded-lg p-2 font-semibold">All Forms</SelectItem>
                                            {(forms || []).map((f) => (
                                                <SelectItem key={f.id} value={f.id} className="rounded-lg p-2 font-semibold">
                                                    {f.name || f.title || f.id}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {data.trigger === 'SURVEY_SUBMITTED' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
                                    <Label className="text-[10px] font-semibold text-blue-600 flex items-center gap-2">
                                        <Database className="h-3 w-3" /> Filter by Survey
                                    </Label>
                                    <Select
                                        value={config.surveyId || 'all_surveys'}
                                        onValueChange={(v) => updateConfig({ surveyId: v === 'all_surveys' ? null : v })}
                                    >
                                        <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                            <SelectValue placeholder="All surveys" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                            <SelectItem value="all_surveys" className="rounded-lg p-2 font-semibold">All Surveys</SelectItem>
                                            {(surveys || []).map((s) => (
                                                <SelectItem key={s.id} value={s.id} className="rounded-lg p-2 font-semibold">
                                                    {s.internalName || s.title || s.id}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {(data.trigger === 'MEETING_CREATED' ||
                                data.trigger === 'MEETING_REGISTRANT_ADDED' ||
                                data.trigger === 'MEETING_REGISTRANT_ATTENDED' ||
                                data.trigger === 'MEETING_REGISTRANT_NO_SHOW') && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/20 shadow-inner">
                                    <Label className="text-[10px] font-semibold text-indigo-600 flex items-center gap-2">
                                        <Play className="h-3 w-3" /> Meeting Type ID
                                    </Label>
                                    <Input
                                        value={config.meetingTypeId || ''}
                                        onChange={(e) => updateConfig({ meetingTypeId: e.target.value || null })}
                                        placeholder="Leave empty for all meeting types"
                                        className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
                                    />
                                </div>
                            )}

                            {(data.trigger === 'ENTITY_STAGE_CHANGED' || data.trigger === 'DEAL_STAGE_CHANGED') && (
                                <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-primary/5 p-6 rounded-[2rem] border border-primary/20 shadow-inner">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-primary flex items-center gap-2">
                                                <Target className="h-3.5 w-3.5" /> Scoped Pipeline
                                            </Label>
                                            <Select 
                                                value={config.pipelineId || 'all_pipelines'} 
                                                onValueChange={(v) => updateConfig({ pipelineId: v === 'all_pipelines' ? null : v, stageId: null })}
                                            >
                                                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                    <SelectValue placeholder="All Pipelines" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    <SelectItem value="all_pipelines" className="rounded-lg p-2 font-semibold">All Pipelines</SelectItem>
                                                    {(pipelines || []).map((p: Pipeline) => (
                                                        <SelectItem key={p.id} value={p.id} className="rounded-lg p-2 font-semibold">{p.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-primary flex items-center gap-2">
                                                <ArrowRightLeft className="h-3.5 w-3.5" /> Targeted Stage
                                            </Label>
                                            <Select 
                                                value={config.stageId || 'all_stages'} 
                                                onValueChange={(v) => updateConfig({ stageId: v === 'all_stages' ? null : v })}
                                                disabled={!config.pipelineId}
                                            >
                                                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                    <SelectValue placeholder={config.pipelineId ? "All Stages" : "Choose pipeline first"} />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    <SelectItem value="all_stages" className="rounded-lg p-2 font-semibold">All Stages</SelectItem>
                                                    {(stages || [])
                                                        .filter((s: OnboardingStage) => s.pipelineId === config.pipelineId)
                                                        .map((s: OnboardingStage) => (
                                                            <SelectItem key={s.id} value={s.id} className="rounded-lg p-2 font-semibold">{s.name}</SelectItem>
                                                        ))
                                                    }
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {data.trigger === 'ENTITY_FIELD_CHANGED' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                                    <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                        <Settings2 className="h-3 w-3" /> Field to Watch
                                    </Label>
                                    <Input
                                        value={config.fieldPath || ''}
                                        onChange={(e) => updateConfig({ fieldPath: e.target.value })}
                                        placeholder="e.g. status, industry, or customFields.key"
                                        className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
                                    />
                                    <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
                                        Specifies the entity or custom field pathway to monitor for mutations.
                                    </p>
                                </div>
                            )}

                            {data.trigger === 'DATE_REACHED' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                            <Clock className="h-3 w-3" /> Date Field
                                        </Label>
                                        <Input
                                            value={config.dateField || ''}
                                            onChange={(e) => updateConfig({ dateField: e.target.value })}
                                            placeholder="e.g. createdAt, trialEnd, customFields.renewalDate"
                                            className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                            Offset Days
                                        </Label>
                                        <Input
                                            type="number"
                                            value={config.offsetDays ?? 0}
                                            onChange={(e) => updateConfig({ offsetDays: parseInt(e.target.value, 10) || 0 })}
                                            placeholder="0"
                                            className="h-10 rounded-xl bg-background border-none text-xs shadow-inner"
                                        />
                                        <p className="text-[8px] text-muted-foreground font-bold pl-1 uppercase">
                                            Use negative values for days before, positive for days after.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {data.trigger === 'SCORE_CHANGED' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                            <Activity className="h-3 w-3" /> Target Score Type
                                        </Label>
                                        <Select
                                            value={config.scoreType || 'overallScore'}
                                            onValueChange={(v) => updateConfig({ scoreType: v })}
                                        >
                                            <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                <SelectValue placeholder="overallScore" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                                                <SelectItem value="overallScore" className="rounded-lg p-2 font-semibold">Overall Health Score</SelectItem>
                                                <SelectItem value="usageScore" className="rounded-lg p-2 font-semibold">Usage Score</SelectItem>
                                                <SelectItem value="supportScore" className="rounded-lg p-2 font-semibold">Support Score</SelectItem>
                                                <SelectItem value="engagementScore" className="rounded-lg p-2 font-semibold">Engagement Score</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                            Operator
                                        </Label>
                                        <Select
                                            value={config.operator || 'any_change'}
                                            onValueChange={(v) => updateConfig({ operator: v, threshold: v === 'any_change' ? null : (config.threshold ?? 50) })}
                                        >
                                            <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                <SelectValue placeholder="Any Change" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                                                <SelectItem value="any_change" className="rounded-lg p-2 font-semibold">Any Change</SelectItem>
                                                <SelectItem value="greater_than" className="rounded-lg p-2 font-semibold">Greater Than (&gt;)</SelectItem>
                                                <SelectItem value="less_than" className="rounded-lg p-2 font-semibold">Less Than (&lt;)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {config.operator && config.operator !== 'any_change' && (
                                        <div className="space-y-2 animate-in slide-in-from-top-1">
                                            <Label className="text-[10px] font-semibold text-emerald-600">Threshold Value</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={config.threshold ?? 50}
                                                onChange={(e) => updateConfig({ threshold: parseInt(e.target.value, 10) || 0 })}
                                                className="h-10 rounded-xl bg-background border-none text-xs shadow-inner"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {data.trigger === 'ENTITY_INACTIVE' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                                    <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                        <Clock className="h-3 w-3" /> Inactivity Threshold (Days)
                                    </Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={config.inactivityDays ?? 30}
                                        onChange={(e) => updateConfig({ inactivityDays: parseInt(e.target.value, 10) || 30 })}
                                        className="h-10 rounded-xl bg-background border-none text-xs shadow-inner"
                                    />
                                    <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
                                        Fires if no activity has been logged on the entity for this number of days.
                                    </p>
                                </div>
                            )}

                            {data.trigger === 'WEBPAGE_VISITED' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
                                    <Label className="text-[10px] font-semibold text-blue-600 flex items-center gap-2">
                                        <Globe className="h-3 w-3" /> Target URL Pattern
                                    </Label>
                                    <Input
                                        value={config.urlPattern || ''}
                                        onChange={(e) => updateConfig({ urlPattern: e.target.value })}
                                        placeholder="e.g. /pricing, /welcome, or *"
                                        className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
                                    />
                                    <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
                                        Fires when a tracked visitor hits a URL matching this pattern.
                                    </p>
                                </div>
                            )}

                            {data.trigger === 'EVENT_RECORDED' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                                    <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                        <Activity className="h-3 w-3" /> Event Name
                                    </Label>
                                    <Input
                                        value={config.eventName || ''}
                                        onChange={(e) => updateConfig({ eventName: e.target.value })}
                                        placeholder="e.g. user_onboarded, plan_upgraded"
                                        className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
                                    />
                                    <p className="text-[9px] text-muted-foreground font-medium pl-1 leading-relaxed">
                                        Fires when a custom telemetry log matches this exact name.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {node.type === 'actionNode' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
                                    <PlusCircle className="h-3 w-3" /> Execution Logic
                                </Label>
                                <Select 
                                    value={data.actionType || ''} 
                                    onValueChange={(val) => onUpdate({ actionType: val, label: ACTION_TYPES.find(a => a.value === val)?.label })}
                                >
                                    <SelectTrigger className="h-14 rounded-[1.25rem] bg-background border-none shadow-inner font-semibold text-lg px-6">
                                        <SelectValue placeholder="Select action type..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl p-2 max-h-[400px] overflow-y-auto">
                                        {ACTION_TYPES.map(action => (
                                            <SelectItem key={action.value} value={action.value} className="rounded-xl p-4 my-1">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><action.icon className="h-5 w-5" /></div>
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-semibold text-xs tracking-tight leading-none mb-1">{action.label}</span>
                                                        <span className="text-[9px] font-medium text-muted-foreground leading-relaxed">{action.desc}</span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Separator className="opacity-50" />

                            <div className="space-y-10">
                                {data.actionType === 'SEND_MESSAGE' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
                                                <Smartphone className="h-3 w-3" /> Channel
                                            </Label>
                                            <Select
                                                value={config.channel || 'email'}
                                                onValueChange={(v) => updateConfig({ channel: v })}
                                            >
                                                <SelectTrigger className="h-10 rounded-xl bg-card border shadow-sm font-bold px-4">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="email">Email</SelectItem>
                                                    <SelectItem value="sms">SMS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Master Template</Label>
                                            <MessagingTemplateSelector 
                                                category={inferredCategory as any}
                                                channel={(config.channel as 'email' | 'sms') || 'email'}
                                                recipientType={config.recipientType || 'manager'}
                                                value={config.templateId}
                                                onValueChange={(v) => updateConfig({ templateId: v })}
                                                placeholder="Choose blueprint..."
                                                className="h-12 rounded-xl bg-card border shadow-sm font-bold px-4 text-xs"
                                            />
                                        </div>
                                        {(variables?.length ?? 0) > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Template variables</Label>
                                                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/30 border">
                                                    {variables!.slice(0, 12).map((v) => (
                                                        <Badge
                                                            key={v.id}
                                                            variant="outline"
                                                            className="text-[9px] font-mono cursor-pointer"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(`{{${v.key}}}`);
                                                                toast({ title: 'Copied', description: v.key });
                                                            }}
                                                        >
                                                            {`{{${v.key}}}`}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Dynamic Recipient</Label>
                                            <Select value={config.recipientType || 'manager'} onValueChange={(v) => updateConfig({ recipientType: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold px-4">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="manager">Assigned Account Manager</SelectItem>
                                                    <SelectItem value="signatory">Campus Signatory</SelectItem>
                                                    <SelectItem value="respondent">Event Respondent</SelectItem>
                                                    <SelectItem value="fixed">Manual Identity Entry</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {config.recipientType === 'fixed' && (
                                            <div className="space-y-2 animate-in zoom-in-95 duration-300">
                                                <Label className="text-[10px] font-semibold text-primary ml-1">Static Target (Tag Supported)</Label>
                                                <Input 
                                                    placeholder="e.g. {{contact_email}}" 
                                                    value={config.recipient || ''} 
                                                    onChange={(e) => updateConfig({ recipient: e.target.value })} 
                                                    className="h-12 rounded-xl bg-card border font-mono text-sm px-4 shadow-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {data.actionType === 'CREATE_TASK' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Task Definition</Label>
                                            <Input 
                                                placeholder={`e.g. Follow up with {{entity_name}}`} 
                                                value={config.title || ''} 
                                                onChange={(e) => updateConfig({ title: e.target.value })} 
                                                className="h-12 rounded-xl bg-card border shadow-sm font-bold"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Priority</Label>
                                                <Select value={config.priority || 'medium'} onValueChange={(v) => updateConfig({ priority: v })}>
                                                    <SelectTrigger className="h-10 rounded-xl bg-card shadow-sm font-semibold text-[10px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                                        <SelectItem value="low" className="text-[10px] font-semibold ">Low</SelectItem>
                                                        <SelectItem value="medium" className="text-[10px] font-semibold ">Medium</SelectItem>
                                                        <SelectItem value="high" className="text-[10px] font-semibold text-orange-500">High</SelectItem>
                                                        <SelectItem value="urgent" className="text-[10px] font-semibold text-rose-500">Urgent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">SLA Target</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        type="number" 
                                                        value={config.dueOffsetDays || 3} 
                                                        onChange={(e) => updateConfig({ dueOffsetDays: parseInt(e.target.value, 10) || 0 })} 
                                                        className="h-10 rounded-xl bg-card text-center font-semibold w-16"
                                                    />
                                                    <span className="text-[9px] font-bold opacity-40">Days</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assigned Identity</Label>
                                            <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="Auto-Resolve from Entity" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Manager)</SelectItem>
                                                    {users?.map(u => (
                                                        <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {data.actionType === 'UPDATE_ENTITY' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Pipeline</Label>
                                            <Select value={config.pipelineId || ''} onValueChange={(val) => updateConfig({ pipelineId: val, stageId: '' })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="Select pipeline..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                                                    {pipelines?.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Stage</Label>
                                            <Select value={config.stageId || ''} onValueChange={(val) => updateConfig({ stageId: val })} disabled={!config.pipelineId}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="Select stage..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                                                    {stages?.filter(s => s.pipelineId === config.pipelineId).map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assignee</Label>
                                            <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="Auto-Resolve" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Manager)</SelectItem>
                                                    {users?.map(u => (
                                                        <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {data.actionType === 'ASSIGN_ENTITY' && (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assign To</Label>
                                        <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                                            <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl p-2 max-h-[300px] overflow-y-auto">
                                                <SelectItem value="auto">Auto-Resolve (Manager)</SelectItem>
                                                {users?.map(u => (
                                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {data.actionType === 'ADD_NOTE' && (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Note Content</Label>
                                        <Input
                                            placeholder="e.g. Automated follow-up for {{entity_name}}"
                                            value={config.content || ''}
                                            onChange={(e) => updateConfig({ content: e.target.value })}
                                            className="h-12 rounded-xl bg-card border shadow-sm font-bold"
                                        />
                                    </div>
                                )}

                                {data.actionType === 'TRIGGER_OUTBOUND_WEBHOOK' && (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Webhook ID</Label>
                                        <Input
                                            placeholder="Firestore webhook document ID"
                                            value={config.webhookId || ''}
                                            onChange={(e) => updateConfig({ webhookId: e.target.value })}
                                            className="h-12 rounded-xl bg-card border font-mono text-sm"
                                        />
                                    </div>
                                )}

                                {data.actionType === 'UPDATE_TASK' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Status</Label>
                                            <Select value={config.status || ''} onValueChange={(v) => updateConfig({ status: v })}>
                                                <SelectTrigger className="h-10 rounded-xl bg-card font-bold"><SelectValue placeholder="Optional" /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="todo">To Do</SelectItem>
                                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                                    <SelectItem value="done">Done</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {data.actionType === 'RUN_AUTOMATION' && (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Automation ID</Label>
                                        <Input
                                            value={config.automationId || ''}
                                            onChange={(e) => updateConfig({ automationId: e.target.value })}
                                            className="h-12 rounded-xl bg-card border font-mono text-sm"
                                        />
                                    </div>
                                )}

                                {data.actionType === 'CREATE_DEAL' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Deal Title (Tag Supported)</Label>
                                            <Input 
                                                placeholder="e.g. {{entityName}} Deal" 
                                                value={config.name || ''} 
                                                onChange={(e) => updateConfig({ name: e.target.value })} 
                                                className="h-12 rounded-xl bg-card border shadow-sm font-bold"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Estimated Value ($)</Label>
                                                <Input 
                                                    type="number"
                                                    placeholder="0.00" 
                                                    value={config.value || ''} 
                                                    onChange={(e) => updateConfig({ value: parseFloat(e.target.value) || 0 })} 
                                                    className="h-12 rounded-xl bg-card border shadow-sm font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assignee</Label>
                                                <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-semibold text-xs"><SelectValue placeholder="Auto-Resolve" /></SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                        <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Entity Owner)</SelectItem>
                                                        {users?.map(u => (
                                                            <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Pipeline</Label>
                                            <Select value={config.pipelineId || ''} onValueChange={(val) => updateConfig({ pipelineId: val, stageId: '' })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="Select Pipeline..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                                                    {pipelines?.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Stage (Optional)</Label>
                                            <Select value={config.stageId || ''} onValueChange={(val) => updateConfig({ stageId: val })} disabled={!config.pipelineId}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="First Pipeline Stage" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                                                    {stages?.filter(s => s.pipelineId === config.pipelineId).map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {data.actionType === 'UPDATE_DEAL_STAGE' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Filter by Pipeline</Label>
                                            <Select value={config.pipelineId || ''} onValueChange={(val) => updateConfig({ pipelineId: val, stageId: '' })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="All Pipelines..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                                                    <SelectItem value="">All Pipelines</SelectItem>
                                                    {pipelines?.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Stage</Label>
                                            <Select value={config.stageId || ''} onValueChange={(val) => updateConfig({ stageId: val })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="Select stage to move to..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                                                    {stages?.filter(s => !config.pipelineId || s.pipelineId === config.pipelineId).map(s => (
                                                        <SelectItem key={s.id} value={s.id}>
                                                            {s.name} ({pipelines?.find(p => p.id === s.pipelineId)?.name || 'Default Pipeline'})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {data.actionType === 'UPDATE_DEAL_VALUE' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">New Value ($)</Label>
                                            <Input 
                                                placeholder="e.g. 5000 or +1000 or -500" 
                                                value={config.value || ''} 
                                                onChange={(e) => updateConfig({ value: e.target.value })} 
                                                className="h-12 rounded-xl bg-card border shadow-sm font-mono text-sm px-4"
                                            />
                                            <span className="text-[9px] font-semibold text-muted-foreground leading-relaxed block ml-1 opacity-70">
                                                Tip: Prefix with + or - to perform a relative adjustment of the deal value.
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {data.actionType === 'UPDATE_DEAL_STATUS' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Status</Label>
                                            <Select value={config.status || 'open'} onValueChange={(v) => updateConfig({ status: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="open">Open (Active)</SelectItem>
                                                    <SelectItem value="won">Won (Closed Won)</SelectItem>
                                                    <SelectItem value="lost">Lost (Closed Lost)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {node.type === 'conditionNode' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-amber-500/5 p-6 rounded-[2rem] border border-amber-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-amber-600 flex items-center gap-2">
                                <ArrowRightLeft className="h-3 w-3" /> Condition Rule
                            </Label>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Payload Field</Label>
                                <Input
                                    value={config.field || ''}
                                    onChange={(e) => updateConfig({ field: e.target.value })}
                                    placeholder="e.g. entityType, tagId, status"
                                    className="h-10 rounded-xl bg-background border-none font-mono text-xs shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Operator</Label>
                                <Select value={config.operator || ''} onValueChange={(v) => updateConfig({ operator: v })}>
                                    <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                        <SelectValue placeholder="Select operator..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {CONDITION_OPERATORS.map((op) => (
                                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Compare Value</Label>
                                <Input
                                    value={config.value ?? ''}
                                    onChange={(e) => updateConfig({ value: e.target.value })}
                                    placeholder="Value to compare against"
                                    className="h-10 rounded-xl bg-background border-none shadow-inner"
                                />
                            </div>
                        </div>
                    )}

                    {node.type === 'delayNode' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-purple-500/5 p-6 rounded-[2rem] border border-purple-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-purple-600 flex items-center gap-2">
                                <Timer className="h-3 w-3" /> Wait Configuration
                            </Label>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Wait Type</Label>
                                <Select
                                    value={config.waitType || 'period'}
                                    onValueChange={(v) => {
                                        let defaultLabel = 'Wait Period';
                                        if (v === 'specific_date') defaultLabel = 'Wait Until Specific Date';
                                        if (v === 'date_field') defaultLabel = 'Wait Until Date Field';
                                        if (v === 'conditions_met') defaultLabel = 'Wait Until Conditions';
                                        onUpdate({
                                            label: defaultLabel,
                                            config: { ...config, waitType: v }
                                        });
                                    }}
                                >
                                    <SelectTrigger className="h-11 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="period">A set period of time</SelectItem>
                                        <SelectItem value="specific_date">Until a specific day and/or time</SelectItem>
                                        <SelectItem value="date_field">Until a custom date field matches</SelectItem>
                                        <SelectItem value="conditions_met">Until specific conditions are met</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 1. Set Period of Time */}
                            {(config.waitType === 'period' || !config.waitType) && (
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Amount</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={config.value ?? 5}
                                            onChange={(e) => updateConfig({ value: Number(e.target.value) || 1 })}
                                            className="h-10 rounded-xl bg-background border-none shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Unit</Label>
                                        <Select
                                            value={config.unit || 'Minutes'}
                                            onValueChange={(v) => updateConfig({ unit: v })}
                                        >
                                            <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="Minutes">Minutes</SelectItem>
                                                <SelectItem value="Hours">Hours</SelectItem>
                                                <SelectItem value="Days">Days</SelectItem>
                                                <SelectItem value="Weeks">Weeks</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {/* 2. Until a Specific Day and/or Time */}
                            {config.waitType === 'specific_date' && (
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Date</Label>
                                        <Input
                                            type="date"
                                            value={config.specificDate || ''}
                                            onChange={(e) => updateConfig({ specificDate: e.target.value })}
                                            className="h-10 rounded-xl bg-background border-none shadow-inner text-xs"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Time</Label>
                                        <Input
                                            type="time"
                                            value={config.specificTime || '09:00'}
                                            onChange={(e) => updateConfig({ specificTime: e.target.value })}
                                            className="h-10 rounded-xl bg-background border-none shadow-inner text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 3. Until a Custom Date Field Matches */}
                            {config.waitType === 'date_field' && (
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Select Date Field</Label>
                                        <Select
                                            value={config.dateField || 'onboarding_date'}
                                            onValueChange={(v) => updateConfig({ dateField: v })}
                                        >
                                            <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="onboarding_date">Onboarding Date</SelectItem>
                                                <SelectItem value="deal_close_date">Deal Close Date</SelectItem>
                                                <SelectItem value="created_at">Entity Created Date</SelectItem>
                                                <SelectItem value="webinar_date">Webinar Date (Custom)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">When to Match</Label>
                                            <Select
                                                value={config.offsetDirection || 'current_date'}
                                                onValueChange={(v) => updateConfig({ offsetDirection: v })}
                                            >
                                                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-3">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="current_date">On the Date</SelectItem>
                                                    <SelectItem value="before">Days Before</SelectItem>
                                                    <SelectItem value="after">Days After</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {config.offsetDirection !== 'current_date' && (
                                            <div className="space-y-2 animate-in zoom-in-95 duration-200">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Offset Days</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={config.offsetDays || 1}
                                                    onChange={(e) => updateConfig({ offsetDays: Number(e.target.value) || 1 })}
                                                    className="h-10 rounded-xl bg-background border-none shadow-inner"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Time of Day</Label>
                                        <Input
                                            type="time"
                                            value={config.matchTime || '09:00'}
                                            onChange={(e) => updateConfig({ matchTime: e.target.value })}
                                            className="h-10 rounded-xl bg-background border-none shadow-inner text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 4. Until Specific Conditions are Met */}
                            {config.waitType === 'conditions_met' && (
                                <div className="space-y-4 pt-2">
                                    <div className="p-3.5 rounded-xl border border-dashed border-purple-500/20 bg-background/50 space-y-3">
                                        <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tight uppercase">Condition Rules</p>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-semibold text-muted-foreground">Field</Label>
                                            <Input
                                                value={config.conditionField || ''}
                                                onChange={(e) => updateConfig({ conditionField: e.target.value })}
                                                placeholder="e.g. tagId, status"
                                                className="h-9 rounded-lg bg-background border-none font-mono text-[10px] shadow-inner"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[9px] font-semibold text-muted-foreground">Operator</Label>
                                                <Select value={config.conditionOperator || ''} onValueChange={(v) => updateConfig({ conditionOperator: v })}>
                                                    <SelectTrigger className="h-9 rounded-lg bg-background border-none text-[10px] px-2 shadow-inner">
                                                        <SelectValue placeholder="Operator" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-lg">
                                                        {CONDITION_OPERATORS.map((op) => (
                                                            <SelectItem key={op.value} value={op.value} className="text-[10px]">{op.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[9px] font-semibold text-muted-foreground">Value</Label>
                                                <Input
                                                    value={config.conditionValue || ''}
                                                    onChange={(e) => updateConfig({ conditionValue: e.target.value })}
                                                    placeholder="Value"
                                                    className="h-9 rounded-lg bg-background border-none text-[10px] shadow-inner"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 px-1">
                                        <input
                                            type="checkbox"
                                            id="hasTimeLimit"
                                            checked={config.hasTimeLimit || false}
                                            onChange={(e) => updateConfig({ hasTimeLimit: e.target.checked })}
                                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                        />
                                        <Label htmlFor="hasTimeLimit" className="text-[10px] font-semibold cursor-pointer">Set a maximum wait limit</Label>
                                    </div>

                                    {config.hasTimeLimit && (
                                        <div className="grid grid-cols-2 gap-3 pt-1 animate-in slide-in-from-top-2 duration-200">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Limit Amount</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={config.timeLimitValue || 30}
                                                    onChange={(e) => updateConfig({ timeLimitValue: Number(e.target.value) || 1 })}
                                                    className="h-9 rounded-lg bg-background border-none shadow-inner text-xs"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Limit Unit</Label>
                                                <Select
                                                    value={config.timeLimitUnit || 'Days'}
                                                    onValueChange={(v) => updateConfig({ timeLimitUnit: v })}
                                                >
                                                    <SelectTrigger className="h-9 rounded-lg bg-background border-none font-bold shadow-inner px-3 text-[10px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-lg">
                                                        <SelectItem value="Minutes">Minutes</SelectItem>
                                                        <SelectItem value="Hours">Hours</SelectItem>
                                                        <SelectItem value="Days">Days</SelectItem>
                                                        <SelectItem value="Weeks">Weeks</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {node.type === 'tagConditionNode' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-violet-500/5 p-6 rounded-[2rem] border border-violet-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-violet-600 flex items-center gap-2">
                                <Tag className="h-3 w-3" /> Tag Logic
                            </Label>
                            <Select value={data.logic || ''} onValueChange={(v) => updateTagNodeData({ logic: v })}>
                                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                    <SelectValue placeholder="Select logic..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="has_tag">Has any of these tags</SelectItem>
                                    <SelectItem value="has_all_tags">Has all of these tags</SelectItem>
                                    <SelectItem value="not_has_tag">Does not have these tags</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Tags</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(data.tagIds || []).map((id: string) => {
                                        const tag = allTags?.find((t: TagType) => t.id === id);
                                        return (
                                            <Badge key={id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-violet-500/10 text-violet-600 border-none">
                                                <span className="text-[10px] font-bold">{tag?.name || id}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 rounded-md"
                                                    onClick={() =>
                                                        updateTagNodeData({
                                                            tagIds: (data.tagIds || []).filter((t: string) => t !== id),
                                                        })
                                                    }
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        );
                                    })}
                                </div>
                                <Select
                                    value=""
                                    onValueChange={(v) => {
                                        const current = data.tagIds || [];
                                        if (!current.includes(v)) updateTagNodeData({ tagIds: [...current, v] });
                                    }}
                                >
                                    <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                        <SelectValue placeholder="Add tags..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                                        {(allTags || []).map((tag: TagType) => (
                                            <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {node.type === 'tagActionNode' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                <Tag className="h-3 w-3" /> Tag Action
                            </Label>
                            <Select value={data.action || 'add_tags'} onValueChange={(v) => updateTagNodeData({ action: v })}>
                                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="add_tags">Add tags</SelectItem>
                                    <SelectItem value="remove_tags">Remove tags</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Tags</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(data.tagIds || []).map((id: string) => {
                                        const tag = allTags?.find((t: TagType) => t.id === id);
                                        return (
                                            <Badge key={id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-600 border-none">
                                                <span className="text-[10px] font-bold">{tag?.name || id}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 rounded-md"
                                                    onClick={() =>
                                                        updateTagNodeData({
                                                            tagIds: (data.tagIds || []).filter((t: string) => t !== id),
                                                        })
                                                    }
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        );
                                    })}
                                </div>
                                <Select
                                    value=""
                                    onValueChange={(v) => {
                                        const current = data.tagIds || [];
                                        if (!current.includes(v)) updateTagNodeData({ tagIds: [...current, v] });
                                    }}
                                >
                                    <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                        <SelectValue placeholder="Add tags..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto">
                                        {(allTags || []).map((tag: TagType) => (
                                            <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

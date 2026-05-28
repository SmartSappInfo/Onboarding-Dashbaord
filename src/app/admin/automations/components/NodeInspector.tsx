'use client';

import * as React from 'react';
import { 
    Zap, 
    Building, 
    ArrowRightLeft, 
    Timer, 
    PlusCircle,
    Tag,
    X
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';
import { ConditionsBuilder } from './ConditionsBuilder';
import { useTerminology } from '@/hooks/use-terminology';
import type { AutomationTrigger, Tag as TagType } from '@/lib/types';
import { useWorkspaceScopedQueries } from '../hooks/useWorkspaceScopedQueries';
import { TriggerConfigPanel } from './TriggerConfigPanel';
import { ActionConfigPanel } from './ActionConfigPanel';
import { SearchInput } from './SearchInput';

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
            { value: 'ENTITY_FIELD_CHANGED', label: 'Entity Field Changed', icon: Settings2IconPlaceholder, desc: 'Fires when a specific standard or custom field changes.' },
            { value: 'DATE_REACHED', label: 'Date Field Reached', icon: ClockIconPlaceholder, desc: 'Fires on, before, or after a specific date property of an entity.' },
            { value: 'SCORE_CHANGED', label: 'Health Score Changed', icon: ActivityIconPlaceholder, desc: 'Fires when the overall health or lead score changes/crosses a threshold.' },
            { value: 'ENTITY_INACTIVE', label: 'Contact Inactivity', icon: ClockIconPlaceholder, desc: 'Fires when an entity has no tracked activity for a set duration.' },
        ],
    },
    {
        label: 'Pipeline & Deals',
        options: [
            { value: 'DEAL_CREATED', label: 'Deal Created', icon: TargetIconPlaceholder, desc: 'Fires when a new deal is created.' },
            { value: 'DEAL_STAGE_CHANGED', label: 'Deal Stage Changed', icon: ArrowRightLeft, desc: 'Fires when a deal moves stages.' },
            { value: 'DEAL_STATUS_CHANGED', label: 'Deal Status Changed', icon: Zap, desc: 'Fires when a deal is won, lost, or reopened.' },
            { value: 'DEAL_VALUE_CHANGED', label: 'Deal Value Changed', icon: DollarSignIconPlaceholder, desc: 'Fires when deal value changes.' },
            { value: 'DEAL_OWNER_CHANGED', label: 'Deal Owner Changed', icon: TargetIconPlaceholder, desc: 'Fires when deal assignee changes.' },
        ],
    },
    {
        label: 'Engagement',
        options: [
            { value: 'FORM_SUBMITTED', label: 'Form Submitted', icon: DatabaseIconPlaceholder, desc: 'Fires when a workspace form is submitted.' },
            { value: 'SURVEY_SUBMITTED', label: 'Survey Submitted', icon: DatabaseIconPlaceholder, desc: 'Fires when a survey is completed.' },
            { value: 'PDF_SIGNED', label: 'Document Signed', icon: TargetIconPlaceholder, desc: 'Fires when a PDF agreement is fully signed.' },
            { value: 'CAMPAIGN_PAGE_SUBMITTED', label: 'Campaign Page Conversion', icon: GlobeIconPlaceholder, desc: 'Fires when a landing page form converts.' },
            { value: 'WEBPAGE_VISITED', label: 'Webpage Visited', icon: GlobeIconPlaceholder, desc: 'Fires when a contact visits a tracked landing page URL.' },
            { value: 'EVENT_RECORDED', label: 'Custom Event Recorded', icon: ActivityIconPlaceholder, desc: 'Fires when telemetry or app event logs are received.' },
        ],
    },
    {
        label: 'Meetings',
        options: [
            { value: 'MEETING_CREATED', label: 'Meeting Scheduled', icon: PlayIconPlaceholder, desc: 'Fires when a meeting is created.' },
            { value: 'MEETING_REGISTRANT_ADDED', label: 'Registrant Added', icon: PlayIconPlaceholder, desc: 'Fires when someone registers for a meeting.' },
            { value: 'MEETING_REGISTRANT_ATTENDED', label: 'Registrant Attended', icon: PlayIconPlaceholder, desc: 'Fires when a registrant joins the session.' },
            { value: 'MEETING_REGISTRANT_NO_SHOW', label: 'Registrant No-Show', icon: PlayIconPlaceholder, desc: 'Fires when marked as no-show.' },
        ],
    },
    {
        label: 'Tasks & Tags',
        options: [
            { value: 'TASK_CREATED', label: 'Task Created', icon: CheckSquareIconPlaceholder, desc: 'Fires when a CRM task is created.' },
            { value: 'TASK_COMPLETED', label: 'Task Completed', icon: CheckSquareIconPlaceholder, desc: 'Fires when a task is marked done.' },
            { value: 'TASK_OVERDUE', label: 'Task Overdue', icon: ShieldAlertIconPlaceholder, desc: 'Fires when a CRM task passes its due date.' },
            { value: 'TAG_ADDED', label: 'Tag Added', icon: Tag, desc: 'Fires when a tag is applied to an entity.' },
            { value: 'TAG_REMOVED', label: 'Tag Removed', icon: Tag, desc: 'Fires when a tag is removed.' },
        ],
    },
    {
        label: 'Campaigns',
        options: [
            { value: 'CAMPAIGN_DELIVERED', label: 'Campaign Delivered', icon: MailIconPlaceholder, desc: 'Fires per entity when campaign email is delivered.' },
            { value: 'CAMPAIGN_FAILED', label: 'Campaign Failed', icon: MailIconPlaceholder, desc: 'Fires when delivery fails.' },
            { value: 'CAMPAIGN_NOT_DELIVERED', label: 'Campaign Not Delivered', icon: MailIconPlaceholder, desc: 'Fires when message was not delivered.' },
            { value: 'CAMPAIGN_OPENED', label: 'Campaign Opened', icon: MailIconPlaceholder, desc: 'Fires when recipient opens email.' },
            { value: 'CAMPAIGN_CLICKED', label: 'Campaign Clicked', icon: MailIconPlaceholder, desc: 'Fires when recipient clicks a link.' },
            { value: 'EMAIL_BOUNCED', label: 'Email Campaign Bounced', icon: ShieldAlertIconPlaceholder, desc: 'Fires when email delivery fails or bounces.' },
        ],
    },
    {
        label: 'Integrations',
        options: [
            { value: 'WEBHOOK_RECEIVED', label: 'Webhook Received', icon: GlobeIconPlaceholder, desc: 'Fires when data is POSTed to this automation endpoint.' },
        ],
    },
];

// Import real icons for the options
import { 
    Clock as ClockIconPlaceholder,
    Activity as ActivityIconPlaceholder,
    Target as TargetIconPlaceholder,
    DollarSign as DollarSignIconPlaceholder,
    Database as DatabaseIconPlaceholder,
    Globe as GlobeIconPlaceholder,
    Play as PlayIconPlaceholder,
    CheckSquare as CheckSquareIconPlaceholder,
    ShieldAlert as ShieldAlertIconPlaceholder,
    Mail as MailIconPlaceholder,
    Settings2 as Settings2IconPlaceholder,
    Bell as BellIconPlaceholder,
    Smartphone as SmartphoneIconPlaceholder
} from 'lucide-react';

const ACTION_TYPES = [
    { value: 'SEND_MESSAGE', label: 'Dispatch Message', icon: MailIconPlaceholder, desc: 'Send an automated Email or SMS.' },
    { value: 'CREATE_TASK', label: 'Initialize Task', icon: ClockIconPlaceholder, desc: 'Add a new task to the CRM.' },
    { value: 'UPDATE_ENTITY', label: 'Update Entity', icon: Building, desc: 'Update pipeline stage, assignee, or status.' },
    { value: 'ASSIGN_ENTITY', label: 'Assign Entity', icon: Building, desc: 'Set the workspace assignee.' },
    { value: 'ADD_NOTE', label: 'Add Note', icon: DatabaseIconPlaceholder, desc: 'Append a note to the entity timeline.' },
    { value: 'CREATE_DEAL', label: 'Create Deal', icon: TargetIconPlaceholder, desc: 'Create a new deal in a pipeline.' },
    { value: 'UPDATE_DEAL_STAGE', label: 'Update Deal Stage', icon: ArrowRightLeft, desc: 'Move a deal to another stage.' },
    { value: 'UPDATE_DEAL_VALUE', label: 'Update Deal Value', icon: DollarSignIconPlaceholder, desc: 'Change deal value.' },
    { value: 'UPDATE_DEAL_STATUS', label: 'Update Deal Status', icon: Zap, desc: 'Set deal won, lost, or open.' },
    { value: 'UPDATE_TASK', label: 'Update Task', icon: CheckSquareIconPlaceholder, desc: 'Change task status or assignee.' },
    { value: 'TRIGGER_OUTBOUND_WEBHOOK', label: 'Call Webhook', icon: GlobeIconPlaceholder, desc: 'POST payload to an outbound webhook.' },
    { value: 'RUN_AUTOMATION', label: 'Run Automation', icon: Zap, desc: 'Chain another automation by ID.' },
    { value: 'SEND_NOTIFICATION_EMAIL', label: 'Send Notification (Email)', icon: MailIconPlaceholder, desc: 'Send an email notification to workspace users, assignees or custom emails.' },
    { value: 'SEND_NOTIFICATION_SMS', label: 'Send Notification (SMS)', icon: SmartphoneIconPlaceholder, desc: 'Send an SMS notification to workspace users, assignees or custom numbers.' },
    { value: 'SEND_NOTIFICATION_IN_APP', label: 'Send Notification (In-App)', icon: BellIconPlaceholder, desc: 'Trigger an in-app workspace notification.' },
    { value: 'SEND_NOTIFICATION_PUSH', label: 'Send Notification (Push)', icon: SmartphoneIconPlaceholder, desc: 'Send a mobile push notification.' },
];

export function NodeInspector({ node, onUpdate }: NodeInspectorProps) {
    const { singular } = useTerminology();
    const params = useParams();
    const automationId = params.id as string;
    const data = node.data || {};
    const config = data.config || {};

    const [triggerSearch, setTriggerSearch] = React.useState('');
    const [actionSearch, setActionSearch] = React.useState('');

    // Reset search when node ID changes
    React.useEffect(() => {
        setTriggerSearch('');
        setActionSearch('');
    }, [node.id]);

    const deferredTriggerSearch = React.useDeferredValue(triggerSearch);
    const deferredActionSearch = React.useDeferredValue(actionSearch);

    const filteredTriggerGroups = React.useMemo(() => {
        if (!deferredTriggerSearch.trim()) return TRIGGER_GROUPS;
        const q = deferredTriggerSearch.toLowerCase();
        return TRIGGER_GROUPS.map(g => ({
            ...g,
            options: g.options.filter(o => 
                o.label.toLowerCase().includes(q) || 
                o.desc.toLowerCase().includes(q)
            )
        })).filter(g => g.options.length > 0);
    }, [deferredTriggerSearch]);

    const filteredActionTypes = React.useMemo(() => {
        if (!deferredActionSearch.trim()) return ACTION_TYPES;
        const q = deferredActionSearch.toLowerCase();
        return ACTION_TYPES.filter(a => 
            a.label.toLowerCase().includes(q) || 
            a.desc.toLowerCase().includes(q)
        );
    }, [deferredActionSearch]);

    const {
        users,
        stages,
        pipelines,
        variables,
        allTags,
        forms,
        surveys,
    } = useWorkspaceScopedQueries();

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

                    {node.type === 'triggerNode' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
                                    <Zap className="h-3 w-3" /> Event Protocol Entry
                                </Label>
                                <SearchInput
                                    value={triggerSearch}
                                    onChange={setTriggerSearch}
                                    placeholder="Search triggers..."
                                    className="mb-4"
                                />
                                <div className="space-y-6">
                                    {filteredTriggerGroups.map((group) => (
                                        <div key={group.label} className="space-y-2">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground ml-1">{group.label}</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {group.options.map((trigger) => (
                                                    <React.Fragment key={trigger.value}>
                                                        <button
                                                            type="button"
                                                            onClick={() => onUpdate({
                                                                trigger: trigger.value,
                                                                label: trigger.value === 'ENTITY_CREATED' ? `${singular} Created` : trigger.label
                                                            })}
                                                            className={cn(
                                                                "flex items-start gap-4 p-3 rounded-2xl border-2 transition-all text-left group w-full",
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
                                                        {data.trigger === trigger.value ? (
                                                            <div 
                                                                ref={(el) => {
                                                                    if (el) {
                                                                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                                    }
                                                                }}
                                                                className="w-full my-2 animate-in slide-in-from-top-2 duration-300"
                                                            >
                                                                <TriggerConfigPanel
                                                                    trigger={data.trigger}
                                                                    config={config}
                                                                    onUpdateConfig={updateConfig}
                                                                    allTags={allTags}
                                                                    forms={forms}
                                                                    surveys={surveys}
                                                                    pipelines={pipelines}
                                                                    stages={stages}
                                                                    webhookUrl={webhookUrl}
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {filteredTriggerGroups.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-center bg-card/30 rounded-2xl border border-dashed border-border">
                                        <p className="text-xs font-bold text-muted-foreground">No triggers match your search</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    {node.type === 'actionNode' ? (
                        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
                                    <PlusCircle className="h-3 w-3" /> Execution Logic
                                </Label>
                                <SearchInput
                                    value={actionSearch}
                                    onChange={setActionSearch}
                                    placeholder="Search actions..."
                                    className="mb-4"
                                />
                                <div className="grid grid-cols-1 gap-2">
                                    {filteredActionTypes.map((action) => (
                                        <button
                                            key={action.value}
                                            type="button"
                                            onClick={() => onUpdate({
                                                actionType: action.value,
                                                label: action.label
                                            })}
                                            className={cn(
                                                "flex items-start gap-4 p-3 rounded-2xl border-2 transition-all text-left group",
                                                data.actionType === action.value ? "border-emerald-500 bg-emerald-500/10 shadow-md" : "border-transparent bg-background hover:bg-card/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2 rounded-xl transition-all shadow-sm shrink-0",
                                                data.actionType === action.value ? "bg-emerald-500 text-white" : "bg-card text-muted-foreground"
                                            )}>
                                                <action.icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-xs tracking-tight leading-none mb-1">{action.label}</p>
                                                <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">{action.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {filteredActionTypes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-center bg-card/30 rounded-2xl border border-dashed border-border">
                                        <p className="text-xs font-bold text-muted-foreground">No actions match your search</p>
                                    </div>
                                ) : null}
                            </div>

                            <Separator className="opacity-50" />

                            {data.actionType ? (
                                <ActionConfigPanel
                                    actionType={data.actionType}
                                    config={config}
                                    onUpdateConfig={updateConfig}
                                    users={users}
                                    stages={stages}
                                    pipelines={pipelines}
                                    variables={variables}
                                    singular={singular}
                                />
                            ) : null}
                        </div>
                    ) : null}

                    {node.type === 'conditionNode' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-amber-500/5 p-6 rounded-[2rem] border border-amber-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-amber-600 flex items-center gap-2">
                                <ArrowRightLeft className="h-3 w-3" /> Condition Branching
                            </Label>
                            <ConditionsBuilder 
                                groups={config.groups || (config.conditions && config.conditions.length > 0 ? [{
                                    id: 'legacy_group',
                                    relation: config.relation || config.matchType || 'and',
                                    conditions: config.conditions.map((c: any, idx: number) => ({
                                        id: c.id || `c_legacy_${idx}`,
                                        field: c.field || 'tags',
                                        operator: c.operator || 'any_of',
                                        value: c.value,
                                        emailTemplateId: c.emailTemplateId,
                                        linkUrl: c.linkUrl
                                    }))
                                }] : [])} 
                                relation={config.relation || config.matchType || 'and'} 
                                onChange={(rel: 'and' | 'or', grps: any[]) => {
                                    onUpdate({
                                        config: {
                                            ...config,
                                            relation: rel,
                                            groups: grps,
                                            // Fallback fields for backwards-compatibility
                                            conditions: grps[0]?.conditions || [],
                                            field: grps[0]?.conditions?.[0]?.field || '',
                                            operator: grps[0]?.conditions?.[0]?.operator || '',
                                            value: grps[0]?.conditions?.[0]?.value || ''
                                        }
                                    });
                                }}
                                accentColor="amber"
                            />
                        </div>
                    ) : null}

                    {node.type === 'delayNode' ? (
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
                            {config.waitType === 'period' || !config.waitType ? (
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
                            ) : null}

                            {/* 2. Until a Specific Day and/or Time */}
                            {config.waitType === 'specific_date' ? (
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
                            ) : null}

                            {/* 3. Until a Custom Date Field Matches */}
                            {config.waitType === 'date_field' ? (
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

                                        {config.offsetDirection !== 'current_date' ? (
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
                                        ) : null}
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
                            ) : null}

                            {/* 4. Until Specific Conditions are Met */}
                            {config.waitType === 'conditions_met' ? (
                                <div className="space-y-4 pt-2">
                                    <ConditionsBuilder 
                                        groups={config.groups || (config.conditions && config.conditions.length > 0 ? [{
                                            id: 'legacy_group',
                                            relation: config.relation || config.matchType || 'and',
                                            conditions: config.conditions.map((c: any, idx: number) => ({
                                                id: c.id || `c_legacy_${idx}`,
                                                field: c.field || 'tags',
                                                operator: c.operator || 'any_of',
                                                value: c.value,
                                                emailTemplateId: c.emailTemplateId,
                                                linkUrl: c.linkUrl
                                            }))
                                        }] : [])} 
                                        relation={config.relation || config.matchType || 'and'} 
                                        onChange={(rel: 'and' | 'or', grps: any[]) => {
                                            onUpdate({
                                                config: {
                                                    ...config,
                                                    relation: rel,
                                                    groups: grps,
                                                    // Fallback fields for backwards-compatibility
                                                    conditions: grps[0]?.conditions || [],
                                                    conditionField: grps[0]?.conditions?.[0]?.field || '',
                                                    conditionOperator: grps[0]?.conditions?.[0]?.operator || '',
                                                    conditionValue: grps[0]?.conditions?.[0]?.value || '',
                                                    emailTemplateId: grps[0]?.conditions?.[0]?.emailTemplateId,
                                                    linkUrl: grps[0]?.conditions?.[0]?.linkUrl
                                                }
                                            });
                                        }}
                                        accentColor="purple"
                                    />

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

                                    {config.hasTimeLimit ? (
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
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {node.type === 'tagConditionNode' ? (
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
                    ) : null}

                    {node.type === 'tagActionNode' ? (
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
                    ) : null}
                </div>
            </div>
        </div>
    );
}

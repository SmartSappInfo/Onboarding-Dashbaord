'use client';

import * as React from 'react';
import { 
    Zap, 
    Building, 
    ArrowRightLeft, 
    Timer, 
    PlusCircle,
    Plus,
    Tag,
    X,
    ChevronLeft,
    Trash2,
    Search,
    SplitSquareVertical,
    CalendarDays,
    StickyNote,
    Milestone,
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
import type { ConditionGroup } from '@/lib/automation-condition';
import type { AutomationTrigger, Tag as TagType } from '@/lib/types';
import { useWorkspaceScopedQueries } from '../hooks/useWorkspaceScopedQueries';
import { TriggerConfigPanel } from './TriggerConfigPanel';
import { ActionConfigPanel } from './ActionConfigPanel';
import { SearchInput } from './SearchInput';
import { MessageNodeStatsPanel } from './message-stats/MessageNodeStatsPanel';
import { MessageStatusAutomationsPanel } from './message-stats/MessageStatusAutomationsPanel';
import { TagSelector } from '@/components/tags/TagSelector';

interface NodeInspectorProps {
    node: import('reactflow').Node;
    onUpdate: (data: Record<string, unknown>) => void;
    triggers?: import('@/lib/types').AutomationTriggerDef[];
    onTriggersChange?: (triggers: import('@/lib/types').AutomationTriggerDef[]) => void;
    onDirtyChange?: (isDirty: boolean) => void;
    onApply?: (nodeId: string, nodeData: Record<string, unknown>, nextTriggers?: import('@/lib/types').AutomationTriggerDef[]) => void;
    onTest?: (nodeId: string, nodeData: Record<string, unknown>) => void;
    onCancel?: () => void;
    nodes?: import('reactflow').Node[];
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
        label: 'Automations',
        options: [
            { value: 'AUTOMATION_ENTERED', label: 'Automation Entered', icon: PlayIconPlaceholder, desc: 'Fires when a contact enters an automation flow.' },
            { value: 'AUTOMATION_COMPLETED', label: 'Automation Completed', icon: CheckSquareIconPlaceholder, desc: 'Fires when a contact completes an automation flow (reaches End Action).' },
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
    Smartphone as SmartphoneIconPlaceholder,
    UserCog
} from 'lucide-react';

const ACTION_TYPES = [
    { value: 'SEND_MESSAGE', label: 'Dispatch Message', icon: MailIconPlaceholder, desc: 'Send an automated Email or SMS.' },
    { value: 'DIRECT_EMAIL', label: 'Direct Email', icon: MailIconPlaceholder, desc: 'Send an email directly without templates, interpolating variables.' },
    { value: 'DIRECT_SMS', label: 'Direct SMS', icon: SmartphoneIconPlaceholder, desc: 'Send an SMS directly without templates, interpolating variables.' },
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
    { value: 'CREATE_ENTITY', label: 'Create Entity', icon: Building, desc: 'Create a new CRM contact or business entity using mapped webhook payload attributes.' },
    { value: 'ADD_CONTACT_TO_ENTITY', label: 'Add Contact to Entity', icon: Tag, desc: 'Locate an existing business entity via Exact Match and append a secondary contact.' },
    { value: 'UPDATE_CONTACT', label: 'Update Contact', icon: UserCog, desc: 'Locate an existing contact inside an entity using filters, and update their details.' },
    { value: 'ADD_TO_CALL_CAMPAIGN', label: 'Add to Call Campaign', icon: Tag, desc: 'Add the target contact or entity to a specific call campaign for automated queueing.' },
    { value: 'END_AUTOMATION', label: 'End Automation', icon: CheckSquareIconPlaceholder, desc: 'Mark this automation as completed for the contact.' },
];

// Pure helpers for trigger icon + label lookup (used in summary view)
const TRIGGER_ICON_MAP_NI: Record<string, React.ElementType> = {
    ENTITY_CREATED: Building, ENTITY_UPDATED: Building, ENTITY_ASSIGNED: Building,
    ENTITY_STAGE_CHANGED: Zap, ENTITY_LINKED: Building, ENTITY_UNLINKED: Building,
    WORKSPACE_ENTITY_UPDATED: Building, ENTITY_FIELD_CHANGED: Settings2IconPlaceholder,
    DATE_REACHED: ClockIconPlaceholder, SCORE_CHANGED: ActivityIconPlaceholder,
    ENTITY_INACTIVE: ClockIconPlaceholder,
    DEAL_CREATED: TargetIconPlaceholder, DEAL_STAGE_CHANGED: ArrowRightLeft,
    DEAL_STATUS_CHANGED: Zap, DEAL_VALUE_CHANGED: DollarSignIconPlaceholder,
    DEAL_OWNER_CHANGED: TargetIconPlaceholder,
    FORM_SUBMITTED: DatabaseIconPlaceholder, SURVEY_SUBMITTED: DatabaseIconPlaceholder,
    PDF_SIGNED: TargetIconPlaceholder, CAMPAIGN_PAGE_SUBMITTED: GlobeIconPlaceholder,
    WEBPAGE_VISITED: GlobeIconPlaceholder, EVENT_RECORDED: ActivityIconPlaceholder,
    MEETING_CREATED: PlayIconPlaceholder, MEETING_REGISTRANT_ADDED: PlayIconPlaceholder,
    MEETING_REGISTRANT_ATTENDED: PlayIconPlaceholder, MEETING_REGISTRANT_NO_SHOW: PlayIconPlaceholder,
    TASK_CREATED: CheckSquareIconPlaceholder, TASK_COMPLETED: CheckSquareIconPlaceholder,
    TASK_OVERDUE: ShieldAlertIconPlaceholder, TAG_ADDED: Tag, TAG_REMOVED: Tag,
    CAMPAIGN_DELIVERED: MailIconPlaceholder, CAMPAIGN_FAILED: MailIconPlaceholder,
    CAMPAIGN_NOT_DELIVERED: MailIconPlaceholder, CAMPAIGN_OPENED: MailIconPlaceholder,
    CAMPAIGN_CLICKED: MailIconPlaceholder, EMAIL_BOUNCED: ShieldAlertIconPlaceholder,
    AUTOMATION_ENTERED: PlayIconPlaceholder, AUTOMATION_COMPLETED: CheckSquareIconPlaceholder,
    WEBHOOK_RECEIVED: GlobeIconPlaceholder,
};

const TRIGGER_LABEL_MAP_NI: Record<string, string> = {
    ENTITY_CREATED: 'Entity Created', ENTITY_UPDATED: 'Entity Updated',
    ENTITY_ASSIGNED: 'Entity Assigned', ENTITY_STAGE_CHANGED: 'Pipeline Stage Changed',
    ENTITY_LINKED: 'Entity Linked', ENTITY_UNLINKED: 'Entity Unlinked',
    WORKSPACE_ENTITY_UPDATED: 'Workspace Entity Updated',
    ENTITY_FIELD_CHANGED: 'Entity Field Changed', DATE_REACHED: 'Date Field Reached',
    SCORE_CHANGED: 'Health Score Changed', ENTITY_INACTIVE: 'Contact Inactivity',
    DEAL_CREATED: 'Deal Created', DEAL_STAGE_CHANGED: 'Deal Stage Changed',
    DEAL_STATUS_CHANGED: 'Deal Status Changed', DEAL_VALUE_CHANGED: 'Deal Value Changed',
    DEAL_OWNER_CHANGED: 'Deal Owner Changed', FORM_SUBMITTED: 'Form Submitted',
    SURVEY_SUBMITTED: 'Survey Submitted', PDF_SIGNED: 'Document Signed',
    CAMPAIGN_PAGE_SUBMITTED: 'Campaign Page Conversion', WEBPAGE_VISITED: 'Webpage Visited',
    EVENT_RECORDED: 'Custom Event Recorded', MEETING_CREATED: 'Meeting Scheduled',
    MEETING_REGISTRANT_ADDED: 'Registrant Added',
    MEETING_REGISTRANT_ATTENDED: 'Registrant Attended',
    MEETING_REGISTRANT_NO_SHOW: 'Registrant No-Show',
    TASK_CREATED: 'Task Created', TASK_COMPLETED: 'Task Completed',
    TASK_OVERDUE: 'Task Overdue', TAG_ADDED: 'Tag Added', TAG_REMOVED: 'Tag Removed',
    CAMPAIGN_DELIVERED: 'Campaign Delivered', CAMPAIGN_FAILED: 'Campaign Failed',
    CAMPAIGN_NOT_DELIVERED: 'Campaign Not Delivered', CAMPAIGN_OPENED: 'Campaign Opened',
    CAMPAIGN_CLICKED: 'Campaign Clicked', EMAIL_BOUNCED: 'Email Bounced',
    AUTOMATION_ENTERED: 'Automation Entered', AUTOMATION_COMPLETED: 'Automation Completed',
    WEBHOOK_RECEIVED: 'Webhook Received',
};

function triggerIcon(type: string): React.ElementType {
    return TRIGGER_ICON_MAP_NI[type] ?? Zap;
}

function triggerLabel(type: string): string {
    return TRIGGER_LABEL_MAP_NI[type] ?? type.replace(/_/g, ' ');
}

function getTriggerDescriptionDetail(
    type: string,
    config: any,
    allTags: any[] | undefined,
    forms: any[] | undefined,
    surveys: any[] | undefined,
    pipelines: any[] | undefined,
    stages: any[] | undefined
): string {
    if (!type) return 'Awaiting event signal';
    switch (type) {
        case 'ENTITY_CREATED':
            return 'Fires when a new entity is created';
        case 'ENTITY_UPDATED':
            return 'Fires when entity fields are updated';
        case 'ENTITY_ASSIGNED':
            return 'Fires when entity is assigned';
        case 'ENTITY_STAGE_CHANGED': {
            const stage = stages?.find((s: any) => s.id === config.stageId);
            const pipeline = pipelines?.find((p: any) => p.id === config.pipelineId);
            if (stage && pipeline) return `Stage changed to "${stage.name}" in "${pipeline.name}"`;
            if (pipeline) return `Stage changed in "${pipeline.name}"`;
            return 'Fires when pipeline stage changes';
        }
        case 'FORM_SUBMITTED': {
            const form = forms?.find((f: any) => f.id === config.formId);
            return form ? `Form: "${form.name || form.title}"` : 'Any form submitted';
        }
        case 'SURVEY_SUBMITTED': {
            const survey = surveys?.find((s: any) => s.id === config.surveyId);
            return survey ? `Survey: "${survey.internalName || survey.title}"` : 'Any survey completed';
        }
        case 'TAG_ADDED': {
            const watchedTags = (config.tagIds || []).map((tid: string) => {
                const tag = allTags?.find((t: any) => t.id === tid);
                return tag ? tag.name : tid;
            });
            return watchedTags.length > 0 
                ? `Tags: ${watchedTags.join(', ')}` 
                : 'Any tag added';
        }
        case 'TAG_REMOVED': {
            const watchedTags = (config.tagIds || []).map((tid: string) => {
                const tag = allTags?.find((t: any) => t.id === tid);
                return tag ? tag.name : tid;
            });
            return watchedTags.length > 0 
                ? `Tags: ${watchedTags.join(', ')}` 
                : 'Any tag removed';
        }
        case 'WEBHOOK_RECEIVED':
            return 'Fires when webhook payload received';
        case 'MEETING_CREATED':
            return config.meetingTypeId ? `Meeting ID: "${config.meetingTypeId}"` : 'Any meeting created';
        case 'MEETING_REGISTRANT_ADDED':
            return config.meetingTypeId ? `Registrant added to "${config.meetingTypeId}"` : 'Registrant added';
        case 'MEETING_REGISTRANT_ATTENDED':
            return config.meetingTypeId ? `Attended meeting: "${config.meetingTypeId}"` : 'Attended meeting';
        case 'MEETING_REGISTRANT_NO_SHOW':
            return config.meetingTypeId ? `No-show for: "${config.meetingTypeId}"` : 'No-show for meeting';
        case 'ENTITY_FIELD_CHANGED':
            return config.fieldPath ? `Field "${config.fieldPath}" changed` : 'Field changed';
        case 'DATE_REACHED':
            if (config.dateField) {
                const offset = (config.offsetDays as number) || 0;
                if (offset === 0) return `When "${config.dateField}" is reached`;
                if (offset < 0) return `${Math.abs(offset)} days before "${config.dateField}"`;
                return `${offset} days after "${config.dateField}"`;
            }
            return 'Date field reached';
        case 'SCORE_CHANGED': {
            const scoreType = (config.scoreType as string) || 'overallScore';
            const scoreLabel = scoreType.replace('Score', '');
            const op = (config.operator as string) || 'any_change';
            if (op === 'any_change') return `${scoreLabel} score changed`;
            const threshold = (config.threshold as number) ?? 50;
            const opSymbol = op === 'greater_than' ? '>' : '<';
            return `${scoreLabel} score ${opSymbol} ${threshold}`;
        }
        case 'ENTITY_INACTIVE':
            return `Inactive for ${config.inactivityDays || 30} days`;
        case 'WEBPAGE_VISITED':
            return config.urlPattern ? `URL matching "${config.urlPattern}"` : 'Page URL visited';
        case 'EVENT_RECORDED':
            return config.eventName ? `Event: "${config.eventName}"` : 'Event recorded';
        case 'DEAL_CREATED':
            return 'Fires when deal is created';
        case 'DEAL_STAGE_CHANGED': {
            const stage = stages?.find((s: any) => s.id === config.stageId);
            const pipeline = pipelines?.find((p: any) => p.id === config.pipelineId);
            if (stage && pipeline) return `Stage: "${stage.name}" in "${pipeline.name}"`;
            if (pipeline) return `Stage changed in "${pipeline.name}"`;
            return 'Fires when deal stage changes';
        }
        case 'DEAL_STATUS_CHANGED':
            return 'Fires when deal status changes';
        case 'DEAL_VALUE_CHANGED':
            return 'Fires when deal value changes';
        case 'DEAL_OWNER_CHANGED':
            return 'Fires when deal owner changes';
        case 'TASK_CREATED':
            return 'Fires when task is created';
        case 'TASK_COMPLETED':
            return 'Fires when task is completed';
        case 'TASK_OVERDUE':
            return 'Fires when task is overdue';
        default:
            return type.replace(/_/g, ' ');
    }
}

const TriggerListItem = React.memo(function TriggerListItem({
    trigger,
    isPrimary,
    index,
    allTags,
    forms,
    surveys,
    pipelines,
    stages,
    canRemove,
    onRemove,
    onClick
}: {
    trigger: any;
    isPrimary: boolean;
    index: number;
    allTags: any[] | undefined;
    forms: any[] | undefined;
    surveys: any[] | undefined;
    pipelines: any[] | undefined;
    stages: any[] | undefined;
    canRemove: boolean;
    onRemove: (id: string, e: React.MouseEvent) => void;
    onClick: () => void;
}) {
    const Icon = triggerIcon(trigger.type);
    const label = triggerLabel(trigger.type);
    const detail = getTriggerDescriptionDetail(trigger.type, trigger.config ?? {}, allTags, forms, surveys, pipelines, stages);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            className={cn(
                'w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all hover:bg-muted/30 group/item cursor-pointer',
                isPrimary ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/60 bg-card/40',
            )}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-sm shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-foreground truncate">{label}</p>
                        {isPrimary && (
                            <Badge className="text-[8px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border font-bold shrink-0">
                                Primary
                            </Badge>
                        )}
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate mt-0.5">{detail}</p>
                </div>
            </div>

            {canRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(trigger.id, e); }}
                    className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/item:opacity-100 transition-all shrink-0"
                    title="Remove trigger"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            )}
        </div>
    );
});


const TriggerPickerItem = React.memo(function TriggerPickerItem({
    opt,
    isDisabled,
    onSelect
}: {
    opt: any;
    isDisabled: boolean;
    onSelect: () => void;
}) {
    const Icon = opt.icon ?? Zap;
    return (
        <button
            type="button"
            disabled={isDisabled}
            onClick={onSelect}
            className={cn(
                'w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all',
                isDisabled
                    ? 'border-transparent opacity-40 cursor-not-allowed'
                    : 'border-transparent hover:border-emerald-500/30 hover:bg-emerald-500/5 cursor-pointer bg-card/50',
            )}
        >
            <div className={cn(
                'p-2 rounded-lg shadow-sm shrink-0',
                isDisabled ? 'bg-muted text-muted-foreground' : 'bg-card text-muted-foreground',
            )}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                    {isDisabled && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">Added</Badge>
                    )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</p>
            </div>
        </button>
    );
});

export function NodeInspector({ 
    node, 
    onUpdate, 
    triggers = [], 
    onTriggersChange,
    onDirtyChange,
    onApply,
    onTest,
    onCancel,
    nodes = []
}: NodeInspectorProps) {
    const { singular } = useTerminology();
    const params = useParams();
    const automationId = params.id as string;
    const [messageInspectorTab, setMessageInspectorTab] = React.useState<'config' | 'stats' | 'automations'>('config');

    const localizedActionTypes = React.useMemo(() => {
        return ACTION_TYPES.map((a) => {
            if (a.value === 'CREATE_ENTITY') {
                return {
                    ...a,
                    label: `Create ${singular}`,
                    desc: `Create a new CRM ${singular.toLowerCase()} entity using mapped webhook payload attributes.`,
                };
            }
            return a;
        });
    }, [singular]);

    // Draft state for normal node data
    const [draftData, setDraftData] = React.useState<Record<string, unknown> | null>(null);
    // Draft state for triggers array (for triggerNode)
    const [draftTriggers, setDraftTriggers] = React.useState<import('@/lib/types').AutomationTriggerDef[]>([]);

    const [triggerSearch, setTriggerSearch] = React.useState('');
    const [actionSearch, setActionSearch] = React.useState('');
    const [viewMode, setViewMode] = React.useState<'list' | 'add' | 'edit'>('list');
    const [activeTriggerId, setActiveTriggerId] = React.useState<string | null>(null);

    // Initialize/sync draft states on node.id change
    React.useEffect(() => {
        setDraftData(node.data ? JSON.parse(JSON.stringify(node.data)) : {});
        setDraftTriggers(triggers ? JSON.parse(JSON.stringify(triggers)) : []);
        setTriggerSearch('');
        setActionSearch('');
        setViewMode('list');
        setActiveTriggerId(null);
    }, [node.id, node.data, triggers]);

    // Track dirty state
    const isDirty = React.useMemo(() => {
        if (!draftData) return false;
        
        // Node data diff
        const originalDataStr = JSON.stringify(node.data || {});
        const draftDataStr = JSON.stringify(draftData);
        if (originalDataStr !== draftDataStr) return true;

        // Triggers diff (if triggerNode)
        if (node.type === 'triggerNode') {
            const originalTriggersStr = JSON.stringify(triggers);
            const draftTriggersStr = JSON.stringify(draftTriggers);
            if (originalTriggersStr !== draftTriggersStr) return true;
        }

        return false;
    }, [node.data, node.type, triggers, draftData, draftTriggers]);

    // Notify parent of dirty status changes
    React.useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    const data = draftData || node.data || {};
    const config = (data.config as Record<string, unknown>) || {};

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
        if (!deferredActionSearch.trim()) return localizedActionTypes;
        const q = deferredActionSearch.toLowerCase();
        return localizedActionTypes.filter(a => 
            a.label.toLowerCase().includes(q) || 
            a.desc.toLowerCase().includes(q)
        );
    }, [deferredActionSearch, localizedActionTypes]);

    const {
        users,
        stages,
        pipelines,
        variables,
        allTags,
        forms,
        surveys,
        automations,
        appFields,
        fieldGroups,
    } = useWorkspaceScopedQueries();

    const updateConfig = (updates: Record<string, unknown>) => {
        setDraftData((prev: Record<string, unknown> | null) => ({
            ...(prev || {}),
            config: {
                ...((prev?.config as Record<string, unknown>) || {}),
                ...updates
            }
        }));
    };

    const updateTagNodeData = (updates: Record<string, unknown>) => {
        setDraftData((prev: Record<string, unknown> | null) => ({
            ...(prev || {}),
            ...updates
        }));
    };

    const webhookUrl = React.useMemo(() => {
        if (typeof window === 'undefined' || !automationId) return '';
        const base = window.location.origin;
        return `${base}/api/automations/webhook/${automationId}`;
    }, [automationId]);

    return (
        <div className="flex flex-col h-full text-left min-h-0">
            {node.type === 'triggerNode' && viewMode === 'add' && (
                <div className="pb-4 mb-4 border-b border-border/50 shrink-0">
                    <SearchInput
                        value={triggerSearch}
                        onChange={setTriggerSearch}
                        placeholder="Search triggers..."
                        autoFocus
                        className="w-full"
                    />
                </div>
            )}
            {node.type === 'actionNode' && !data.actionType && (
                <div className="pb-4 mb-4 border-b border-border/50 shrink-0">
                    <SearchInput
                        value={actionSearch}
                        onChange={setActionSearch}
                        placeholder="Search actions..."
                        className="w-full"
                    />
                </div>
            )}

            <div className="flex-1 overflow-y-auto -mx-4 px-4 scrollbar-thin">
                <div className="space-y-10 pb-32 pt-2">

                    {node.type === 'triggerNode' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            {viewMode === 'list' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
                                            <Zap className="h-3 w-3" /> Entry Triggers
                                            <Badge className="ml-1 text-[8px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20 border font-bold">
                                                {triggers.length}
                                            </Badge>
                                        </Label>
                                    </div>

                                    {draftTriggers.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-8 text-center bg-card/30 rounded-2xl border border-dashed border-border animate-fade-in">
                                            <Zap className="h-8 w-8 text-muted-foreground/20 mb-2" />
                                            <p className="text-xs font-bold text-muted-foreground">No triggers configured</p>
                                            <p className="text-[10px] text-muted-foreground/60 mt-1">Configure entry events to fire this flow.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {draftTriggers.map((t, i) => (
                                                <TriggerListItem
                                                    key={t.id}
                                                    trigger={t}
                                                    isPrimary={i === 0}
                                                    index={i}
                                                    allTags={allTags}
                                                    forms={forms}
                                                    surveys={surveys}
                                                    pipelines={pipelines}
                                                    stages={stages}
                                                    canRemove={draftTriggers.length > 1}
                                                    onRemove={(id, e) => {
                                                        e.stopPropagation();
                                                        if (draftTriggers.length <= 1) return;
                                                        const next = draftTriggers.filter(item => item.id !== id);
                                                        setDraftTriggers(next);
                                                    }}
                                                    onClick={() => {
                                                        setActiveTriggerId(t.id);
                                                        setViewMode('edit');
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setViewMode('add')}
                                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-primary font-semibold text-xs transition-all"
                                    >
                                        <PlusCircle className="h-3.5 w-3.5" />
                                        Add Trigger
                                    </button>
                                </div>
                            )}

                            {viewMode === 'add' && (
                                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors mb-2"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" /> Back to Triggers
                                    </button>
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
                                            <Zap className="h-3 w-3" /> Add entry trigger
                                        </Label>
                                    </div>

                                    <div className="space-y-6">
                                        {filteredTriggerGroups.map(group => {
                                            const usedTypes = new Set(draftTriggers.map(t => t.type));
                                            return (
                                                <div key={group.label} className="space-y-2">
                                                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                                                        {group.label}
                                                    </p>
                                                    <div className="space-y-1.5">
                                                        {group.options.map(opt => (
                                                            <TriggerPickerItem
                                                                key={opt.value}
                                                                opt={opt}
                                                                isDisabled={usedTypes.has(opt.value)}
                                                                onSelect={() => {
                                                                    const newId = `trigger_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                                                                    const next = [...draftTriggers, { id: newId, type: opt.value, config: {} }];
                                                                    setDraftTriggers(next);
                                                                    setActiveTriggerId(newId);
                                                                    setViewMode('edit');
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {filteredTriggerGroups.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-8 text-center bg-card/30 rounded-2xl border border-dashed">
                                                <p className="text-xs font-bold text-muted-foreground">No triggers match search</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {viewMode === 'edit' && activeTriggerId && (() => {
                                const activeTrigger = draftTriggers.find(t => t.id === activeTriggerId);
                                if (!activeTrigger) return null;
                                const Icon = triggerIcon(activeTrigger.type);
                                const label = triggerLabel(activeTrigger.type);
                                return (
                                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('list')}
                                            className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors mb-2"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" /> Back to Triggers
                                        </button>

                                        <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/25">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-sm shrink-0">
                                                    <Icon className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-foreground truncate">{label}</p>
                                                    <p className="text-[9px] font-medium text-muted-foreground truncate font-mono">{activeTrigger.type}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={draftTriggers.length <= 1}
                                                onClick={() => {
                                                    const next = draftTriggers.filter(t => t.id !== activeTriggerId);
                                                    setDraftTriggers(next);
                                                    setViewMode('list');
                                                }}
                                                className={cn(
                                                    "shrink-0 ml-2 h-7 w-7 rounded-xl flex items-center justify-center border transition-all",
                                                    draftTriggers.length <= 1
                                                        ? "border-muted/30 text-muted-foreground/30 cursor-not-allowed bg-transparent"
                                                        : "border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive"
                                                )}
                                                title="Delete this trigger"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>

                                        <Separator className="opacity-40" />

                                        <TriggerConfigPanel
                                            triggerId={activeTrigger.id}
                                            trigger={activeTrigger.type}
                                            config={(activeTrigger.config ?? {}) as Record<string, any>}
                                            onUpdateConfig={(updates) => {
                                                const next = draftTriggers.map(t =>
                                                    t.id === activeTriggerId ? { ...t, config: { ...(t.config ?? {}), ...updates } } : t
                                                );
                                                setDraftTriggers(next);
                                            }}
                                            allTags={allTags}
                                            forms={forms}
                                            surveys={surveys}
                                            pipelines={pipelines}
                                            stages={stages}
                                            webhookUrl={webhookUrl}
                                            automations={automations}
                                        />
                                    </div>
                                );
                            })()}
                        </div>
                    ) : null}

                    {node.type === 'actionNode' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            {!data.actionType ? (
                                /* ── No action chosen yet: show picker list ── */
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
                                        <PlusCircle className="h-3 w-3" /> Choose an Action
                                    </Label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {filteredActionTypes.map((action) => (
                                            <button
                                                key={action.value}
                                                type="button"
                                                onClick={() => setDraftData((prev: any) => ({
                                                    ...prev,
                                                    actionType: action.value,
                                                    label: action.label
                                                }))}
                                                className="flex items-start gap-4 p-3 rounded-2xl border-2 border-transparent bg-background hover:bg-card/50 hover:border-primary/20 transition-all text-left group"
                                            >
                                                <div className="p-2 rounded-xl transition-all shadow-sm shrink-0 bg-card text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
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
                            ) : (
                                /* ── Action already chosen: show config only ── */
                                <div className="space-y-6">
                                    {/* Slim action-type header with swap button */}
                                    <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {(() => {
                                                const actionMeta = localizedActionTypes.find(a => a.value === data.actionType);
                                                const Icon = actionMeta?.icon ?? PlusCircle;
                                                return (
                                                    <>
                                                        <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-sm shrink-0">
                                                            <Icon className="h-3.5 w-3.5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-foreground truncate">{actionMeta?.label ?? data.actionType}</p>
                                                            <p className="text-[9px] font-medium text-muted-foreground truncate">{actionMeta?.desc}</p>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setDraftData((prev: any) => ({
                                                ...prev,
                                                actionType: '',
                                                label: 'New Action',
                                                config: {}
                                            }))}
                                            className="shrink-0 ml-2 h-7 px-2.5 rounded-xl border border-border/60 bg-background hover:bg-muted/40 text-[9px] font-bold text-muted-foreground hover:text-foreground transition-all"
                                            title="Change action type"
                                        >
                                            Change
                                        </button>
                                    </div>

                                    <Separator className="opacity-40" />

                                    {/* Message steps expose a Statistics tab alongside their config */}
                                    {data.actionType === 'SEND_MESSAGE' && (
                                        <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5 text-[10px] font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => setMessageInspectorTab('config')}
                                                className={cn(
                                                    'px-3 py-1 rounded-md transition-colors',
                                                    messageInspectorTab === 'config'
                                                        ? 'bg-background text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                Configuration
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMessageInspectorTab('stats')}
                                                className={cn(
                                                    'px-3 py-1 rounded-md transition-colors',
                                                    messageInspectorTab === 'stats'
                                                        ? 'bg-background text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                Statistics
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMessageInspectorTab('automations')}
                                                className={cn(
                                                    'px-3 py-1 rounded-md transition-colors',
                                                    messageInspectorTab === 'automations'
                                                        ? 'bg-background text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                Event Automations
                                            </button>
                                        </div>
                                    )}

                                    {data.actionType === 'SEND_MESSAGE' && messageInspectorTab === 'stats' ? (
                                        <MessageNodeStatsPanel
                                            automationId={automationId}
                                            nodeId={node.id}
                                            channel={config?.channel as 'email' | 'sms' | 'whatsapp' | undefined}
                                        />
                                    ) : data.actionType === 'SEND_MESSAGE' && messageInspectorTab === 'automations' ? (
                                        <MessageStatusAutomationsPanel
                                            statusRules={(config?.statusRules as import('@/lib/types').MessageStatusRule[]) || []}
                                            onChangeRules={(rules) => updateConfig({ statusRules: rules })}
                                            pipelines={pipelines}
                                            automations={automations}
                                            users={users}
                                            callCampaigns={[]}
                                            meetingTypes={[]}
                                        />
                                    ) : (
                                        /* The actual config form — NO list, just properties */
                                        <ActionConfigPanel
                                            actionType={data.actionType}
                                            config={config}
                                            onUpdateConfig={updateConfig}
                                            users={users}
                                            stages={stages}
                                            pipelines={pipelines}
                                            variables={variables}
                                            singular={singular}
                                            automations={automations}
                                            appFields={appFields}
                                            fieldGroups={fieldGroups}
                                            allTags={allTags}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ) : null}

                    {node.type === 'conditionNode' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-amber-500/5 p-6 rounded-[2rem] border border-amber-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-amber-600 flex items-center gap-2">
                                <ArrowRightLeft className="h-3 w-3" /> Condition Branching
                            </Label>
                            <ConditionsBuilder 
                                groups={(config.groups as ConditionGroup[]) || (Array.isArray(config.conditions) && config.conditions.length > 0 ? [{
                                    id: 'legacy_group',
                                    relation: (config.relation as 'and' | 'or') || (config.matchType as 'and' | 'or') || 'and',
                                    conditions: config.conditions.map((c: any, idx: number) => ({
                                        id: c.id || `c_legacy_${idx}`,
                                        field: c.field || 'tags',
                                        operator: c.operator || 'any_of',
                                        value: c.value,
                                        emailTemplateId: c.emailTemplateId,
                                        linkUrl: c.linkUrl
                                    }))
                                }] : [])} 
                                relation={(config.relation as 'and' | 'or') || (config.matchType as 'and' | 'or') || 'and'}
                                onChange={(rel: 'and' | 'or', grps: any[]) => {
                                    setDraftData((prev: any) => ({
                                        ...prev,
                                        config: {
                                            ...(prev?.config || {}),
                                            relation: rel,
                                            groups: grps,
                                            // Fallback fields for backwards-compatibility
                                            conditions: grps[0]?.conditions || [],
                                            field: grps[0]?.conditions?.[0]?.field || '',
                                            operator: grps[0]?.conditions?.[0]?.operator || '',
                                            value: grps[0]?.conditions?.[0]?.value || ''
                                        }
                                    }));
                                }}
                                accentColor="amber"
                                nodes={nodes}
                            />
                        </div>
                    ) : null}

                    {node.type === 'jumpToNode' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-fuchsia-500/5 p-6 rounded-[2rem] border border-fuchsia-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-fuchsia-600 flex items-center gap-2">
                                <Milestone className="h-3 w-3" /> Goal Milestone Settings
                            </Label>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Goal / Milestone Name</Label>
                                <Input
                                    type="text"
                                    value={(data.label as string) || ''}
                                    onChange={(e) => setDraftData((prev: Record<string, unknown> | null) => ({
                                        ...(prev || {}),
                                        label: e.target.value
                                    }))}
                                    placeholder="e.g. Lead Upgraded to Premium"
                                    className="h-11 rounded-xl bg-background border-none font-semibold px-4 shadow-inner text-xs"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Goal Target Conditions</Label>
                                <ConditionsBuilder
                                    groups={(config.groups as ConditionGroup[]) || []}
                                    relation={(config.relation as 'and' | 'or') || 'and'}
                                    onChange={(rel: 'and' | 'or', grps: ConditionGroup[]) => {
                                        setDraftData((prev: any) => ({
                                            ...prev,
                                            config: {
                                                ...(prev?.config || {}),
                                                relation: rel,
                                                groups: grps
                                            }
                                        }));
                                    }}
                                    accentColor="purple"
                                    nodes={nodes}
                                />
                            </div>

                            <Separator className="bg-fuchsia-500/10" />

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <input
                                        type="checkbox"
                                        id="jumpFromAnywhere"
                                        checked={(config.jumpFromAnywhere as boolean) !== false}
                                        onChange={(e) => setDraftData((prev: any) => ({
                                            ...prev,
                                            config: {
                                                ...(prev?.config || {}),
                                                jumpFromAnywhere: e.target.checked
                                            }
                                        }))}
                                        className="h-4 w-4 rounded border-border text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                                    />
                                    <Label htmlFor="jumpFromAnywhere" className="text-[10px] font-semibold cursor-pointer text-foreground/80">
                                        Trigger goal jump from anywhere in this automation
                                    </Label>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Sequential Entry Behavior</Label>
                                    <Select
                                        value={(config.sequentialBehavior as string) || 'wait'}
                                        onValueChange={(v) => setDraftData((prev: any) => ({
                                            ...prev,
                                            config: {
                                                ...(prev?.config || {}),
                                                sequentialBehavior: v
                                            }
                                        }))}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl bg-background border-none font-bold shadow-inner px-4 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl animate-fade-in">
                                            <SelectItem value="wait">Wait at this step until conditions are met</SelectItem>
                                            <SelectItem value="proceed">Proceed to next step immediately</SelectItem>
                                            <SelectItem value="exit">End this automation sequence</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
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
                                    value={(config.waitType as string) || 'period'}
                                    onValueChange={(v) => {
                                        let defaultLabel = 'Wait Period';
                                        if (v === 'specific_date') defaultLabel = 'Wait Until Specific Date';
                                        if (v === 'date_field') defaultLabel = 'Wait Until Date Field';
                                        if (v === 'conditions_met') defaultLabel = 'Wait Until Conditions';
                                        if (v === 'scheduled_day') defaultLabel = 'Wait for Scheduled Day & Time';
                                        if (v === 'scheduled_month') defaultLabel = 'Wait for Month/Day of Month';
                                        setDraftData((prev: any) => ({
                                            ...prev,
                                            label: defaultLabel,
                                            config: { ...(prev?.config || {}), waitType: v }
                                        }));
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
                                        <SelectItem value="scheduled_day">On a specific day & time</SelectItem>
                                        <SelectItem value="scheduled_month">On a specific month/day of month</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 1. Set Period of Time */}
                            {config.waitType === 'period' || !config.waitType ? (
                                <div className="space-y-4 pt-2">
                                    {/* List of periods */}
                                    {((config.periods as { value: number; unit: string }[] | undefined) || [
                                        { value: config.value ?? 5, unit: config.unit || 'Minutes' }
                                    ]).map((period, index: number) => (
                                        <div key={index} className="flex items-end gap-2 animate-fade-in">
                                            <div className="space-y-2 flex-1">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Amount</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={(period.value as number) ?? 1}
                                                    onChange={(e) => {
                                                        const newVal = Number(e.target.value) || 1;
                                                        const currentPeriods = config.periods 
                                                            ? [...(config.periods as { value: number; unit: string }[])] 
                                                            : [{ value: config.value ?? 5, unit: config.unit || 'Minutes' }];
                                                        currentPeriods[index] = { ...currentPeriods[index], value: newVal };
                                                        updateConfig({
                                                            periods: currentPeriods,
                                                            value: currentPeriods[0].value,
                                                            unit: currentPeriods[0].unit,
                                                        });
                                                    }}
                                                    className="h-10 rounded-xl bg-background border-none shadow-inner"
                                                />
                                            </div>
                                            <div className="space-y-2 flex-1">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Unit</Label>
                                                <Select
                                                    value={(period.unit as string) || 'Minutes'}
                                                    onValueChange={(v) => {
                                                        const currentPeriods = config.periods 
                                                            ? [...(config.periods as { value: number; unit: string }[])] 
                                                            : [{ value: config.value ?? 5, unit: config.unit || 'Minutes' }];
                                                        currentPeriods[index] = { ...currentPeriods[index], unit: v };
                                                        updateConfig({
                                                            periods: currentPeriods,
                                                            value: currentPeriods[0].value,
                                                            unit: currentPeriods[0].unit,
                                                        });
                                                    }}
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
                                            {config.periods && (config.periods as { value: number; unit: string }[]).length > 1 ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        const currentPeriods = [...(config.periods as { value: number; unit: string }[])];
                                                        currentPeriods.splice(index, 1);
                                                        updateConfig({
                                                            periods: currentPeriods,
                                                            value: currentPeriods[0].value,
                                                            unit: currentPeriods[0].unit,
                                                        });
                                                    }}
                                                    className="h-10 w-10 p-0 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50/10 flex-shrink-0 flex items-center justify-center border-none"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            ) : null}
                                        </div>
                                    ))}

                                    {/* Add Period Button */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            const currentPeriods = config.periods 
                                                ? [...(config.periods as { value: number; unit: string }[])] 
                                                : [{ value: config.value ?? 5, unit: config.unit || 'Minutes' }];
                                            currentPeriods.push({ value: 1, unit: 'Minutes' });
                                            updateConfig({
                                                periods: currentPeriods,
                                                value: currentPeriods[0].value,
                                                unit: currentPeriods[0].unit,
                                            });
                                        }}
                                        className="w-full h-9 rounded-xl border border-dashed border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40 text-[10px] font-bold uppercase tracking-wider gap-1.5 active:scale-[0.97] transition-all"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Another Period
                                    </Button>
                                </div>
                            ) : null}

                            {/* 2. Until a Specific Day and/or Time */}
                            {config.waitType === 'specific_date' ? (
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Date</Label>
                                        <Input
                                            type="date"
                                            value={(config.specificDate as string) || ''}
                                            onChange={(e) => updateConfig({ specificDate: e.target.value })}
                                            className="h-10 rounded-xl bg-background border-none shadow-inner text-xs"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Time</Label>
                                        <Input
                                            type="time"
                                            value={(config.specificTime as string) || '09:00'}
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
                                            value={(config.dateField as string) || 'onboarding_date'}
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
                                                value={(config.offsetDirection as string) || 'current_date'}
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
                                                    value={(config.offsetDays as number) || 1}
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
                                            value={(config.matchTime as string) || '09:00'}
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
                                        groups={(config.groups as ConditionGroup[]) || (Array.isArray(config.conditions) && config.conditions.length > 0 ? [{
                                            id: 'legacy_group',
                                            relation: (config.relation as 'and' | 'or') || (config.matchType as 'and' | 'or') || 'and',
                                            conditions: config.conditions.map((c: any, idx: number) => ({
                                                id: c.id || `c_legacy_${idx}`,
                                                field: c.field || 'tags',
                                                operator: c.operator || 'any_of',
                                                value: c.value,
                                                emailTemplateId: c.emailTemplateId,
                                                linkUrl: c.linkUrl
                                            }))
                                        }] : [])} 
                                        relation={(config.relation as 'and' | 'or') || (config.matchType as 'and' | 'or') || 'and'}
                                        onChange={(rel: 'and' | 'or', grps: any[]) => {
                                            setDraftData((prev: any) => ({
                                                ...prev,
                                                config: {
                                                    ...(prev?.config || {}),
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
                                            }));
                                        }}
                                        accentColor="purple"
                                        nodes={nodes}
                                    />

                                    <div className="flex items-center gap-2 px-1">
                                        <input
                                            type="checkbox"
                                            id="hasTimeLimit"
                                            checked={(config.hasTimeLimit as boolean) || false}
                                            onChange={(e) => updateConfig({ hasTimeLimit: e.target.checked })}
                                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                        />
                                        <Label htmlFor="hasTimeLimit" className="text-[10px] font-semibold cursor-pointer">Set a maximum wait limit</Label>
                                    </div>

                                    {config.hasTimeLimit ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in slide-in-from-top-2 duration-200">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Limit Amount</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={(config.timeLimitValue as number) || 30}
                                                    onChange={(e) => updateConfig({ timeLimitValue: Number(e.target.value) || 1 })}
                                                    className="h-9 rounded-lg bg-background border-none shadow-inner text-xs"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Limit Unit</Label>
                                                <Select
                                                    value={(config.timeLimitUnit as string) || 'Days'}
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

                            {/* 5. On a Specific Day & Time (day-of-week based) */}
                             {config.waitType === 'scheduled_day' ? (
                                 <div className="space-y-4 pt-2">
                                     {/* Day of Week Dropdown */}
                                     <div className="space-y-2">
                                         <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                             <CalendarDays className="h-3 w-3" /> Day of Week
                                         </Label>
                                         <Select
                                             value={(config.scheduledDayPreset as string) || 'monday'}
                                             onValueChange={(v) => updateConfig({ scheduledDayPreset: v })}
                                         >
                                             <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                 <SelectValue />
                                             </SelectTrigger>
                                             <SelectContent className="rounded-xl">
                                                 <SelectItem value="monday">Monday</SelectItem>
                                                 <SelectItem value="tuesday">Tuesday</SelectItem>
                                                 <SelectItem value="wednesday">Wednesday</SelectItem>
                                                 <SelectItem value="thursday">Thursday</SelectItem>
                                                 <SelectItem value="friday">Friday</SelectItem>
                                                 <SelectItem value="saturday">Saturday</SelectItem>
                                                 <SelectItem value="sunday">Sunday</SelectItem>
                                                 <SelectItem value="weekend">Weekend (Sat & Sun)</SelectItem>
                                                 <SelectItem value="weekday">Not a weekend (Mon–Fri)</SelectItem>
                                             </SelectContent>
                                         </Select>
                                     </div>

                                     {/* Time */}
                                     <div className="space-y-2">
                                         <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Time of Day</Label>
                                         <Input
                                             type="time"
                                             value={(config.scheduledTime as string) || '09:00'}
                                             onChange={(e) => updateConfig({ scheduledTime: e.target.value })}
                                             className="h-10 rounded-xl bg-background border-none shadow-inner text-xs"
                                         />
                                     </div>

                                     {/* Summary preview */}
                                     <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                         <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-0.5">Schedule Preview</p>
                                         <p className="text-[10px] text-purple-600 dark:text-purple-400">
                                             {(() => {
                                                 const preset = (config.scheduledDayPreset as string) || 'monday';
                                                 const dayMap: Record<string, string> = {
                                                     monday: 'Every Monday', tuesday: 'Every Tuesday', wednesday: 'Every Wednesday',
                                                     thursday: 'Every Thursday', friday: 'Every Friday', saturday: 'Every Saturday',
                                                     sunday: 'Every Sunday', weekend: 'Every Weekend (Sat & Sun)',
                                                     weekday: 'Every Weekday (Mon–Fri)'
                                                 };
                                                 return `${dayMap[preset] || preset} · at ${config.scheduledTime || '09:00'}`;
                                             })()}
                                         </p>
                                     </div>
                                 </div>
                             ) : null}

                             {/* 6. On a Specific Month / Day of Month */}
                             {config.waitType === 'scheduled_month' ? (
                                 <div className="space-y-4 pt-2">
                                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                         <div className="space-y-2">
                                             <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Year</Label>
                                             <Select
                                                 value={(config.scheduledYear as string) || 'any'}
                                                 onValueChange={(v) => updateConfig({ scheduledYear: v })}
                                             >
                                                 <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-3">
                                                     <SelectValue />
                                                 </SelectTrigger>
                                                 <SelectContent className="rounded-xl">
                                                     <SelectItem value="any">Any year</SelectItem>
                                                     <SelectItem value="2026">2026</SelectItem>
                                                     <SelectItem value="2027">2027</SelectItem>
                                                     <SelectItem value="2028">2028</SelectItem>
                                                     <SelectItem value="2029">2029</SelectItem>
                                                     <SelectItem value="2030">2030</SelectItem>
                                                 </SelectContent>
                                             </Select>
                                         </div>
                                         <div className="space-y-2">
                                             <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Month</Label>
                                             <Select
                                                 value={(config.scheduledMonth as string) || 'any'}
                                                 onValueChange={(v) => updateConfig({ scheduledMonth: v })}
                                             >
                                                 <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-3">
                                                     <SelectValue />
                                                 </SelectTrigger>
                                                 <SelectContent className="rounded-xl">
                                                     <SelectItem value="any">Any month</SelectItem>
                                                     <SelectItem value="1">January</SelectItem>
                                                     <SelectItem value="2">February</SelectItem>
                                                     <SelectItem value="3">March</SelectItem>
                                                     <SelectItem value="4">April</SelectItem>
                                                     <SelectItem value="5">May</SelectItem>
                                                     <SelectItem value="6">June</SelectItem>
                                                     <SelectItem value="7">July</SelectItem>
                                                     <SelectItem value="8">August</SelectItem>
                                                     <SelectItem value="9">September</SelectItem>
                                                     <SelectItem value="10">October</SelectItem>
                                                     <SelectItem value="11">November</SelectItem>
                                                     <SelectItem value="12">December</SelectItem>
                                                 </SelectContent>
                                             </Select>
                                         </div>
                                         <div className="space-y-2">
                                             <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Day of Month</Label>
                                             <Select
                                                 value={(config.scheduledDayOfMonth as string) || 'any'}
                                                 onValueChange={(v) => updateConfig({ scheduledDayOfMonth: v })}
                                             >
                                                 <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-3">
                                                     <SelectValue />
                                                 </SelectTrigger>
                                                 <SelectContent className="rounded-xl max-h-60">
                                                     <SelectItem value="any">Any day</SelectItem>
                                                     <SelectItem value="1">1st</SelectItem>
                                                     <SelectItem value="2">2nd</SelectItem>
                                                     <SelectItem value="3">3rd</SelectItem>
                                                     <SelectItem value="4">4th</SelectItem>
                                                     <SelectItem value="5">5th</SelectItem>
                                                     <SelectItem value="6">6th</SelectItem>
                                                     <SelectItem value="7">7th</SelectItem>
                                                     <SelectItem value="8">8th</SelectItem>
                                                     <SelectItem value="9">9th</SelectItem>
                                                     <SelectItem value="10">10th</SelectItem>
                                                     <SelectItem value="11">11th</SelectItem>
                                                     <SelectItem value="12">12th</SelectItem>
                                                     <SelectItem value="13">13th</SelectItem>
                                                     <SelectItem value="14">14th</SelectItem>
                                                     <SelectItem value="15">15th</SelectItem>
                                                     <SelectItem value="16">16th</SelectItem>
                                                     <SelectItem value="17">17th</SelectItem>
                                                     <SelectItem value="18">18th</SelectItem>
                                                     <SelectItem value="19">19th</SelectItem>
                                                     <SelectItem value="20">20th</SelectItem>
                                                     <SelectItem value="21">21st</SelectItem>
                                                     <SelectItem value="22">22nd</SelectItem>
                                                     <SelectItem value="23">23rd</SelectItem>
                                                     <SelectItem value="24">24th</SelectItem>
                                                     <SelectItem value="25">25th</SelectItem>
                                                     <SelectItem value="26">26th</SelectItem>
                                                     <SelectItem value="27">27th</SelectItem>
                                                     <SelectItem value="28">28th</SelectItem>
                                                     <SelectItem value="29">29th</SelectItem>
                                                     <SelectItem value="30">30th</SelectItem>
                                                     <SelectItem value="31">31st</SelectItem>
                                                     <SelectItem value="last">Last day</SelectItem>
                                                 </SelectContent>
                                             </Select>
                                         </div>
                                     </div>

                                     {/* Time */}
                                     <div className="space-y-2">
                                         <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Time of Day</Label>
                                         <Input
                                             type="time"
                                             value={(config.scheduledTime as string) || '09:00'}
                                             onChange={(e) => updateConfig({ scheduledTime: e.target.value })}
                                             className="h-10 rounded-xl bg-background border-none shadow-inner text-xs"
                                         />
                                     </div>

                                     {/* Summary preview */}
                                     {((config.scheduledMonth && config.scheduledMonth !== 'any') || (config.scheduledDayOfMonth && config.scheduledDayOfMonth !== 'any') || (config.scheduledYear && config.scheduledYear !== 'any')) ? (
                                         <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                             <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-0.5">Schedule Preview</p>
                                             <p className="text-[10px] text-purple-600 dark:text-purple-400">
                                                 {(() => {
                                                     const parts: string[] = [];
                                                     const monthNames: Record<string, string> = {
                                                         '1': 'January', '2': 'February', '3': 'March', '4': 'April', '5': 'May', '6': 'June',
                                                         '7': 'July', '8': 'August', '9': 'September', '10': 'October', '11': 'November', '12': 'December'
                                                     };
                                                     if (config.scheduledYear && config.scheduledYear !== 'any') {
                                                         parts.push(config.scheduledYear as string);
                                                     }
                                                     if (config.scheduledMonth && config.scheduledMonth !== 'any') {
                                                         parts.push(monthNames[config.scheduledMonth as string] || (config.scheduledMonth as string));
                                                     } else {
                                                         parts.push('Every month');
                                                     }
                                                     if (config.scheduledDayOfMonth && config.scheduledDayOfMonth !== 'any') {
                                                         const dom = (config.scheduledDayOfMonth as string) === 'last' ? 'last day' : `day ${(config.scheduledDayOfMonth as string)}`;
                                                         parts.push(`on the ${dom}`);
                                                     }
                                                     parts.push(`at ${config.scheduledTime || '09:00'}`);
                                                     return parts.join(' · ');
                                                 })()}
                                             </p>
                                         </div>
                                     ) : null}
                                 </div>
                             ) : null}
                        </div>
                    ) : null}

                    {node.type === 'tagConditionNode' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-violet-500/5 p-6 rounded-[2rem] border border-violet-500/20 shadow-inner">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-violet-600 flex items-center gap-2">
                                    <SplitSquareVertical className="h-3.5 w-3.5" /> Routing Mode
                                </Label>
                                <Select
                                    value={data.conditions ? 'switch' : 'legacy'}
                                    onValueChange={(v) => {
                                        if (v === 'switch') {
                                            updateTagNodeData({
                                                conditions: [
                                                    { id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, tagId: '' }
                                                ],
                                                logic: undefined,
                                                tagIds: undefined,
                                            });
                                        } else {
                                            updateTagNodeData({
                                                logic: 'has_tag',
                                                tagIds: [],
                                                conditions: undefined,
                                            });
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="legacy">Standard Split (Legacy)</SelectItem>
                                        <SelectItem value="switch">Multi-tag Route (Switch)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {data.conditions ? (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-violet-600 flex items-center gap-2">
                                            Evaluation Mode
                                        </Label>
                                        <Select
                                            value={(data.evaluationMode as string) || 'first_match'}
                                            onValueChange={(v) => updateTagNodeData({ evaluationMode: v })}
                                        >
                                            <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="first_match">First-Match Wins</SelectItem>
                                                <SelectItem value="all_matches">All-Matches Trigger</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Route Conditions</Label>
                                        <div className="space-y-3">
                                            {data.conditions.map((cond: { id: string; tagId: string }, idx: number) => (
                                                <div key={cond.id} className="flex flex-col gap-2 p-3 rounded-xl border border-violet-500/10 bg-violet-500/5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-violet-600">Branch #{idx + 1}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                                                            onClick={() => {
                                                                const updated = data.conditions.filter((c: any) => c.id !== cond.id);
                                                                updateTagNodeData({ conditions: updated });
                                                            }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <TagSelector
                                                            currentTagIds={cond.tagId ? [cond.tagId] : []}
                                                            onTagsChange={(newTags) => {
                                                                const lastTag = newTags[newTags.length - 1] || '';
                                                                const updated = data.conditions.map((c: any) => {
                                                                    if (c.id === cond.id) {
                                                                        return { ...c, tagId: lastTag };
                                                                    }
                                                                    return c;
                                                                });
                                                                updateTagNodeData({ conditions: updated });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-9 rounded-xl border-dashed text-xs font-bold gap-1 mt-2 text-violet-600 hover:bg-violet-50 border-violet-200"
                                            onClick={() => {
                                                const newCond = {
                                                    id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                                    tagId: '',
                                                };
                                                updateTagNodeData({
                                                    conditions: [...(data.conditions || []), newCond]
                                                });
                                            }}
                                        >
                                            <PlusCircle className="h-3.5 w-3.5" />
                                            Add Condition Branch
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Label className="text-[10px] font-semibold text-violet-600 flex items-center gap-2">
                                        <Tag className="h-3 w-3" /> Tag Logic
                                    </Label>
                                    <Select value={(data.logic as string) || ''} onValueChange={(v) => updateTagNodeData({ logic: v })}>
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
                                </>
                            )}
                        </div>
                    ) : null}

                    {node.type === 'tagActionNode' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                <Tag className="h-3 w-3" /> Tag Action
                            </Label>
                            <Select value={(data.action as string) || 'add_tags'} onValueChange={(v) => updateTagNodeData({ action: v })}>
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

                    {node.type === 'abSplitNode' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-violet-500/5 p-6 rounded-[2rem] border border-violet-500/20 shadow-inner">
                            <Label className="text-[10px] font-semibold text-violet-600 flex items-center gap-2">
                                <SplitSquareVertical className="h-3 w-3" /> A/B Split Configuration
                            </Label>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                    Variant A Traffic Ratio: {data.config?.splitRatio ?? 50}%
                                </Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={data.config?.splitRatio ?? 50}
                                    onChange={(e) => {
                                        const val = Math.min(99, Math.max(1, parseInt(e.target.value) || 50));
                                        setDraftData((prev: any) => ({
                                            ...prev,
                                            label: `A/B Split (${val}/${100 - val})`,
                                            config: { ...(prev?.config || {}), splitRatio: val }
                                        }));
                                    }}
                                    className="h-11 rounded-xl bg-background border-none font-bold shadow-inner px-4 text-xs"
                                />
                                <p className="text-[10px] text-muted-foreground font-semibold ml-1">
                                    Variant B Traffic Ratio: {100 - (data.config?.splitRatio ?? 50)}%
                                </p>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Note Section */}
            {node.type !== 'triggerNode' && (
                <div className="mt-4 pt-4 border-t border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                        <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Step Note</Label>
                    </div>
                    <textarea
                        value={(data.note as string) || ''}
                        onChange={(e) => setDraftData((prev: Record<string, unknown> | null) => ({
                            ...(prev || {}),
                            note: e.target.value,
                        }))}
                        placeholder="Add a note for your team..."
                        className="w-full min-h-[60px] max-h-[120px] rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 focus:outline-none resize-none transition-all"
                    />
                    {data.note && (
                        <p className="text-[9px] text-muted-foreground/60 mt-1 ml-1">
                            {data.note.length} characters
                        </p>
                    )}
                </div>
            )}

            {/* Sticky Action Footer */}
            <div className="pt-4 mt-auto border-t border-border/50 shrink-0 bg-card flex items-center justify-between gap-3">
                <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl font-bold flex-1 text-xs text-orange-600 bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/20"
                    onClick={() => onTest?.(node.id, data)}
                >
                    Test Step
                </Button>
                <div className="flex items-center gap-2 flex-[2]">
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-10 rounded-xl font-bold flex-1 text-xs"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={!isDirty}
                        className={cn(
                            "h-10 rounded-xl font-bold flex-1 text-xs transition-all",
                            isDirty 
                                ? "bg-primary text-white hover:bg-primary/95" 
                                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                        )}
                        onClick={() => {
                            let finalData = { ...data };
                            if (node.type === 'delayNode') {
                                const type = config?.waitType || 'period';
                                let computedLabel = 'Wait Period';
                                if (type === 'period') {
                                    const periods = config?.periods as { value: number; unit: string }[] | undefined;
                                    if (periods && periods.length > 0) {
                                        computedLabel = `Wait for ` + periods.map((p) => `${p.value ?? 1} ${p.unit || 'Minutes'}`).join(', ');
                                    } else {
                                        computedLabel = `Wait for ${config?.value ?? 5} ${config?.unit || 'Minutes'}`;
                                    }
                                } else if (type === 'specific_date') {
                                    computedLabel = `Until ${config?.specificDate || 'date'} at ${config?.specificTime || '09:00'}`;
                                } else if (type === 'date_field') {
                                    const offset = config?.offsetDirection === 'current_date' 
                                        ? 'On' 
                                        : `${config?.offsetDays ?? 1}d ${config?.offsetDirection}`;
                                    computedLabel = `Wait until ${offset} of ${config?.dateField || 'field'}`;
                                } else if (type === 'conditions_met') {
                                    const limitStr = config?.hasTimeLimit 
                                        ? ` (max ${config?.timeLimitValue ?? 30} ${config?.timeLimitUnit || 'Days'})` 
                                        : '';
                                    computedLabel = `Until conditions are met${limitStr}`;
                                } else if (type === 'scheduled_day') {
                                    const dayPreset = ((config?.scheduledDay as string) || (config?.scheduledDayPreset as string)) || 'monday';
                                    const time = (config?.scheduledTime as string) || '09:00';
                                    const dayLabel = dayPreset.charAt(0).toUpperCase() + dayPreset.slice(1);
                                    computedLabel = `Wait until ${dayLabel} at ${time}`;
                                } else if (type === 'scheduled_month') {
                                    const year = (config?.scheduledYear as string) || 'any';
                                    const month = (config?.scheduledMonth as string) || 'any';
                                    const day = (config?.scheduledDayOfMonth as string) || 'any';
                                    const time = (config?.scheduledTime as string) || '09:00';
                                    
                                    const yearStr = year === 'any' ? '' : ` of ${year}`;
                                    const monthStr = month === 'any' ? 'every month' : ` of ${month}`;
                                    const dayStr = day === 'any' ? 'any day' : `on day ${day}`;
                                    computedLabel = `Wait until ${dayStr}${monthStr}${yearStr} at ${time}`;
                                }
                                finalData.label = computedLabel;
                            }

                            if (node.type === 'triggerNode') {
                                onApply?.(node.id, finalData, draftTriggers);
                            } else {
                                onApply?.(node.id, finalData);
                            }
                        }}
                    >
                        Apply
                    </Button>
                </div>
            </div>
        </div>
    );
}

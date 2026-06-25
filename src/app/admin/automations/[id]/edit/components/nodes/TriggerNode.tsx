'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Zap, Target, Building, CheckSquare, Database, Globe, Play, Tag, Mail, DollarSign, ArrowRightLeft, Users, Link2, Settings2, Clock, Activity, ShieldAlert, Plus, StickyNote } from 'lucide-react';
import { NodeActionToolbar } from './NodeActionToolbar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceScopedQueries } from '../../../../hooks/useWorkspaceScopedQueries';
import { useExecutionOverlay, ExecutionBadge } from './ExecutionOverlay';

const TRIGGER_ICONS: Record<string, any> = {
    ENTITY_CREATED: Building,
    ENTITY_UPDATED: Building,
    ENTITY_ASSIGNED: Users,
    ENTITY_STAGE_CHANGED: Zap,
    ENTITY_LINKED: Link2,
    ENTITY_UNLINKED: Link2,
    WORKSPACE_ENTITY_UPDATED: Building,
    TASK_CREATED: CheckSquare,
    TASK_COMPLETED: CheckSquare,
    SURVEY_SUBMITTED: Database,
    PDF_SIGNED: Target,
    FORM_SUBMITTED: Database,
    WEBHOOK_RECEIVED: Globe,
    MEETING_CREATED: Play,
    MEETING_REGISTRANT_ADDED: Users,
    MEETING_REGISTRANT_ATTENDED: Play,
    MEETING_REGISTRANT_NO_SHOW: Play,
    TAG_ADDED: Tag,
    TAG_REMOVED: Tag,
    DEAL_CREATED: DollarSign,
    DEAL_STAGE_CHANGED: ArrowRightLeft,
    DEAL_STATUS_CHANGED: Zap,
    DEAL_VALUE_CHANGED: DollarSign,
    CAMPAIGN_PAGE_SUBMITTED: Globe,
    CAMPAIGN_DELIVERED: Mail,
    CAMPAIGN_FAILED: Mail,
    CAMPAIGN_OPENED: Mail,
    CAMPAIGN_CLICKED: Mail,
    CAMPAIGN_NOT_DELIVERED: Mail,
    ENTITY_FIELD_CHANGED: Settings2,
    DATE_REACHED: Clock,
    TASK_OVERDUE: ShieldAlert,
    WEBPAGE_VISITED: Globe,
    EVENT_RECORDED: Activity,
    EMAIL_BOUNCED: ShieldAlert,
    SCORE_CHANGED: Activity,
    DEAL_OWNER_CHANGED: Target,
    ENTITY_INACTIVE: Clock,
};

const TRIGGER_NAMES: Record<string, string> = {
    ENTITY_CREATED: 'Entity Created',
    ENTITY_UPDATED: 'Entity Updated',
    ENTITY_ASSIGNED: 'Entity Assigned',
    ENTITY_STAGE_CHANGED: 'Entity Stage Changed',
    ENTITY_LINKED: 'Entity Linked',
    ENTITY_UNLINKED: 'Entity Unlinked',
    WORKSPACE_ENTITY_UPDATED: 'Workspace Entity Updated',
    TASK_CREATED: 'Task Created',
    TASK_COMPLETED: 'Task Completed',
    SURVEY_SUBMITTED: 'Survey Submitted',
    PDF_SIGNED: 'PDF Signed',
    FORM_SUBMITTED: 'Form Submitted',
    WEBHOOK_RECEIVED: 'Webhook Received',
    MEETING_CREATED: 'Meeting Created',
    MEETING_REGISTRANT_ADDED: 'Meeting Registrant Added',
    MEETING_REGISTRANT_ATTENDED: 'Meeting Registrant Attended',
    MEETING_REGISTRANT_NO_SHOW: 'Meeting Registrant No-Show',
    TAG_ADDED: 'Tag Added',
    TAG_REMOVED: 'Tag Removed',
    DEAL_CREATED: 'Deal Created',
    DEAL_STAGE_CHANGED: 'Deal Stage Changed',
    DEAL_STATUS_CHANGED: 'Deal Status Changed',
    DEAL_VALUE_CHANGED: 'Deal Value Changed',
    CAMPAIGN_PAGE_SUBMITTED: 'Campaign Page Submitted',
    CAMPAIGN_DELIVERED: 'Campaign Delivered',
    CAMPAIGN_FAILED: 'Campaign Failed',
    CAMPAIGN_OPENED: 'Campaign Opened',
    CAMPAIGN_CLICKED: 'Campaign Clicked',
    CAMPAIGN_NOT_DELIVERED: 'Campaign Not Delivered',
    ENTITY_FIELD_CHANGED: 'Entity Field Changed',
    DATE_REACHED: 'Date Reached',
    TASK_OVERDUE: 'Task Overdue',
    WEBPAGE_VISITED: 'Webpage Visited',
    EVENT_RECORDED: 'Event Recorded',
    EMAIL_BOUNCED: 'Email Bounced',
    SCORE_CHANGED: 'Score Changed',
    DEAL_OWNER_CHANGED: 'Deal Owner Changed',
    ENTITY_INACTIVE: 'Entity Inactive',
};

/**
 * @fileOverview High-fidelity Trigger Node for Automation Canvas.
 * Represents the entry point of an institutional protocol.
 * Reads data.triggers[] (multi-trigger model) with fallback to data.trigger (legacy).
 */
export function TriggerNode({ id, data, selected }: any) {
    const [isHovered, setIsHovered] = React.useState(false);
    // Multi-trigger model: data.triggers[] is source of truth
    // Fall back to legacy data.trigger for canvas nodes not yet synced
    const triggers: any[] = data.triggers?.length
        ? data.triggers
        : data.trigger
        ? [{ id: 'primary', type: data.trigger, config: data.config ?? {} }]
        : [];

    const primary = triggers[0];
    const trigger = primary?.type ?? null;
    const config = primary?.config ?? data.config ?? {};
    const overflowCount = triggers.length - 1;

    const Icon = TRIGGER_ICONS[trigger] || Zap;

    const { allTags, forms, surveys, pipelines, stages } = useWorkspaceScopedQueries();

    const stepName = TRIGGER_NAMES[trigger] || (trigger ? trigger.replace(/_/g, ' ') : 'Event Trigger');

    const getTriggerSource = () => {
        if (!trigger) return 'Entry';
        if (trigger === 'WEBHOOK_RECEIVED') return 'Webhook';
        if (trigger === 'FORM_SUBMITTED') return 'Form';
        if (trigger === 'SURVEY_SUBMITTED') return 'Survey';
        if (trigger === 'PDF_SIGNED') return 'PDF';
        if (trigger === 'MEETING_CREATED' || trigger?.startsWith('MEETING_')) return 'Meeting';
        return 'System';
    };

    const getTriggerDescription = () => {
        if (!trigger) return 'Awaiting event signal';

        switch (trigger) {
            case 'ENTITY_CREATED':
                return 'Fires when a new entity is created';
            case 'ENTITY_UPDATED':
                return 'Fires when entity fields are updated';
            case 'ENTITY_ASSIGNED':
                return 'Fires when entity is assigned to user';
            case 'ENTITY_STAGE_CHANGED': {
                const stage = stages?.find((s: any) => s.id === config.stageId);
                const pipeline = pipelines?.find((p: any) => p.id === config.pipelineId);
                if (stage && pipeline) {
                    return `Stage changed to "${stage.name}" in "${pipeline.name}"`;
                }
                if (pipeline) {
                    return `Stage changed in "${pipeline.name}"`;
                }
                return 'Fires when pipeline stage changes';
            }
            case 'FORM_SUBMITTED': {
                const form = forms?.find((f: any) => f.id === config.formId);
                return form ? `Form: "${form.name || form.title}" submitted` : 'Any form submitted';
            }
            case 'SURVEY_SUBMITTED': {
                const survey = surveys?.find((s: any) => s.id === config.surveyId);
                return survey ? `Survey: "${survey.internalName || survey.title}" completed` : 'Any survey completed';
            }
            case 'TAG_ADDED': {
                const watchedTags = (config.tagIds || []).map((tid: string) => {
                    const tag = allTags?.find((t: any) => t.id === tid);
                    return tag ? tag.name : tid;
                });
                return watchedTags.length > 0 
                    ? `Tag added: ${watchedTags.join(', ')}` 
                    : 'Any tag added';
            }
            case 'TAG_REMOVED': {
                const watchedTags = (config.tagIds || []).map((tid: string) => {
                    const tag = allTags?.find((t: any) => t.id === tid);
                    return tag ? tag.name : tid;
                });
                return watchedTags.length > 0 
                    ? `Tag removed: ${watchedTags.join(', ')}` 
                    : 'Any tag removed';
            }
            case 'WEBHOOK_RECEIVED':
                return 'Fires when webhook payload received';
            case 'MEETING_CREATED':
                return config.meetingTypeId 
                    ? `Meeting created: ID "${config.meetingTypeId}"` 
                    : 'Any meeting created';
            case 'MEETING_REGISTRANT_ADDED':
                return config.meetingTypeId 
                    ? `Registrant added to ID "${config.meetingTypeId}"` 
                    : 'Registrant added to meeting';
            case 'MEETING_REGISTRANT_ATTENDED':
                return config.meetingTypeId 
                    ? `Attended meeting: ID "${config.meetingTypeId}"` 
                    : 'Attended meeting';
            case 'MEETING_REGISTRANT_NO_SHOW':
                return config.meetingTypeId 
                    ? `No-show for meeting: ID "${config.meetingTypeId}"` 
                    : 'No-show for meeting';
            case 'ENTITY_FIELD_CHANGED':
                return config.fieldPath 
                    ? `Field "${config.fieldPath}" changed` 
                    : 'Entity field changed';
            case 'DATE_REACHED':
                if (config.dateField) {
                    const offset = config.offsetDays || 0;
                    if (offset === 0) return `When date field "${config.dateField}" is reached`;
                    if (offset < 0) return `${Math.abs(offset)} days before date field "${config.dateField}"`;
                    return `${offset} days after date field "${config.dateField}"`;
                }
                return 'Date field reached';
            case 'SCORE_CHANGED': {
                const scoreType = config.scoreType || 'overallScore';
                const scoreLabel = scoreType.replace('Score', '');
                const op = config.operator || 'any_change';
                if (op === 'any_change') return `${scoreLabel} score changed`;
                const threshold = config.threshold ?? 50;
                const opSymbol = op === 'greater_than' ? '>' : '<';
                return `${scoreLabel} score ${opSymbol} ${threshold}`;
            }
            case 'ENTITY_INACTIVE':
                return `Entity inactive for ${config.inactivityDays || 30} days`;
            case 'WEBPAGE_VISITED':
                return config.urlPattern 
                    ? `URL matching "${config.urlPattern}" visited` 
                    : 'Tracked page URL visited';
            case 'EVENT_RECORDED':
                return config.eventName 
                    ? `Custom event "${config.eventName}" recorded` 
                    : 'Custom event recorded';
            case 'DEAL_CREATED':
                return 'Fires when a new deal is created';
            case 'DEAL_STAGE_CHANGED': {
                const stage = stages?.find((s: any) => s.id === config.stageId);
                const pipeline = pipelines?.find((p: any) => p.id === config.pipelineId);
                if (stage && pipeline) {
                    return `Deal stage changed to "${stage.name}" in "${pipeline.name}"`;
                }
                if (pipeline) {
                    return `Deal stage changed in "${pipeline.name}"`;
                }
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
                return 'Fires when task becomes overdue';
            default:
                return trigger.replace(/_/g, ' ');
        }
    };

    const overlay = useExecutionOverlay(data);

    return (
        <div className={cn(
            "relative transition-all duration-300",
            selected ? "scale-[1.02]" : "scale-100",
            overlay.opacityClass
        )} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <NodeActionToolbar
                nodeId={id}
                isVisible={selected || isHovered}
                isTrigger={true}
                canMoveUp={data.canMoveUp}
                canMoveDown={data.canMoveDown}
                hasNote={data.hasNote}
                onAddAbove={data.onAddAbove}
                onAddBelow={() => data.onAddStep(id)}
                onMoveUp={data.onMoveUp}
                onMoveDown={data.onMoveDown}
                onDuplicate={data.onDuplicate}
                onDelete={data.onDelete}
                onToggleNote={data.onToggleNote}
            />
            {overlay.badgeIcon && (
                <div className="absolute -top-2.5 -right-2.5 z-50">
                    <ExecutionBadge icon={overlay.badgeIcon} status={data.executionStatus} />
                </div>
            )}
            <Card className={cn(
                "w-64 h-14 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-row items-center",
                selected ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/20" : "border-emerald-200",
                overlay.borderClass,
                overlay.glowClass
            )}>
                {/* Left Colored Accent Block */}
                <div className="w-12 h-full bg-emerald-500 flex items-center justify-center flex-shrink-0 animate-fade-in">
                    <Icon className="h-4 w-4 text-white" />
                </div>
                
                {/* Right Content Area */}
                <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
                    <div className="flex flex-col justify-center min-w-0 pr-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mb-1 truncate">
                            Event Trigger
                        </span>
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {getTriggerDescription()}
                        </p>
                    </div>
                    {triggers.length > 1 && (
                        <div className="shrink-0 ml-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold whitespace-nowrap min-w-[18px] text-center shadow-sm animate-fade-in">
                            {triggers.length}
                        </div>
                    )}
                </div>
            </Card>
            <Handle 
                type="source" 
                position={Position.Bottom} 
                className={cn(
                    "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
                    data.isDefaultConnected ? "bg-emerald-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                )}
                style={{ width: '12px', height: '12px', bottom: '-6px' }}
                onClick={(e) => {
                    if (!data.isDefaultConnected && data.onAddStep) {
                        e.stopPropagation();
                        data.onAddStep(id);
                    }
                }}
            >
                {!data.isDefaultConnected && <Plus className="h-2.5 w-2.5 text-white pointer-events-none" />}
            </Handle>
            {data.note && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md px-1.5 py-0.5 max-w-[200px] cursor-pointer" onClick={() => data.onToggleNote?.()}>
                    <StickyNote className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                    <span className="text-[8px] text-amber-700 dark:text-amber-400 truncate font-medium">{data.note}</span>
                </div>
            )}
        </div>
    );
}

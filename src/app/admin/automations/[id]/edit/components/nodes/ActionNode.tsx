'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Play, Settings2, Mail, Clock, Building, Zap, ArrowRight, MousePointer2, Bell, BellOff, Smartphone, Plus, Sparkles, StickyNote, MessageSquare, CheckSquare, Building2, DollarSign, UserPlus, PhoneCall, StopCircle, Globe } from 'lucide-react';
import { NodeActionToolbar } from './NodeActionToolbar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceScopedQueries } from '../../../../hooks/useWorkspaceScopedQueries';
import { useExecutionOverlay, ExecutionBadge } from './ExecutionOverlay';
import { useAutomationMeta } from '../../../../components/AutomationMetaContext';
import { MessageNodeStatsStrip } from '../../../../components/message-stats/MessageNodeStatsStrip';

/**
 * @fileOverview Refined Action Node for Automation Canvas.
 * Provides high-visibility feedback on the specific task being executed.
 */
const ACTION_NAMES: Record<string, string> = {
    SEND_MESSAGE: 'Send Message',
    SEND_WHATSAPP: 'Send WhatsApp',
    DIRECT_EMAIL: 'Direct Email',
    DIRECT_SMS: 'Direct SMS',
    DIRECT_WHATSAPP: 'Direct WhatsApp',
    CREATE_TASK: 'Create Task',
    UPDATE_TASK: 'Update Task',
    CREATE_SCHOOL: 'Create School',
    CREATE_ENTITY: 'Create Entity',
    UPDATE_ENTITY: 'Update Entity',
    ASSIGN_ENTITY: 'Assign Entity',
    ADD_CONTACT_TO_ENTITY: 'Add Contact to Entity',
    UPDATE_CONTACT: 'Update Contact',
    ADD_TO_CALL_CAMPAIGN: 'Add to Call Campaign',
    END_AUTOMATION: 'End Automation',
    TRIGGER_OUTBOUND_WEBHOOK: 'Outbound Webhook',
    SEND_NOTIFICATION_EMAIL: 'Send Notification (Email)',
    SEND_NOTIFICATION_SMS: 'Send Notification (SMS)',
    SEND_NOTIFICATION_IN_APP: 'Send Notification (In-App)',
    SEND_NOTIFICATION_PUSH: 'Send Notification (Push)',
    RUN_AUTOMATION: 'Run Automation',
    ADD_NOTE: 'Add Note',
    CREATE_DEAL: 'Create Deal',
    UPDATE_DEAL_STAGE: 'Update Deal Stage',
    UPDATE_DEAL_VALUE: 'Update Deal Value',
    UPDATE_DEAL_STATUS: 'Update Deal Status',
    UPDATE_LEAD_SCORE: 'Adjust Lead Score',
};

function formatActionName(actionType?: string): string {
    if (!actionType) return 'Unconfigured';
    if (ACTION_NAMES[actionType]) return ACTION_NAMES[actionType];
    return actionType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface ActionNodeData {
    actionType?: string;
    config?: Record<string, unknown>;
    isDisabled?: boolean;
    stepNumber?: number;
    label?: string;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    hasNote?: boolean;
    onAddAbove?: () => void;
    onAddStep?: (id: string) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onToggleNote?: () => void;
    executionStatus?: string;
    isDefaultConnected?: boolean;
    note?: string;
}

export function ActionNode({ id, data, selected }: { id: string; data: ActionNodeData; selected?: boolean }) {
    const [isHovered, setIsHovered] = React.useState(false);
    const actionType = data.actionType || '';
    const config = (data.config || {}) as Record<string, any>;

    const { users, stages, pipelines } = useWorkspaceScopedQueries();
    const { automationId } = useAutomationMeta();

    const getIcon = () => {
        switch(actionType) {
            case 'SEND_MESSAGE': {
                if (config.channel === 'whatsapp') return MessageSquare;
                if (config.channel === 'sms') return Smartphone;
                return Mail;
            }
            case 'SEND_WHATSAPP':
            case 'DIRECT_WHATSAPP':
                return MessageSquare;
            case 'DIRECT_EMAIL':
            case 'SEND_NOTIFICATION_EMAIL':
                return Mail;
            case 'DIRECT_SMS':
            case 'SEND_NOTIFICATION_SMS':
            case 'SEND_NOTIFICATION_PUSH':
                return Smartphone;
            case 'SEND_NOTIFICATION_IN_APP':
                return Bell;
            case 'CREATE_TASK':
            case 'UPDATE_TASK':
                return CheckSquare;
            case 'CREATE_SCHOOL':
            case 'CREATE_ENTITY':
            case 'UPDATE_ENTITY':
            case 'ASSIGN_ENTITY':
                return Building2;
            case 'CREATE_DEAL':
            case 'UPDATE_DEAL_STAGE':
            case 'UPDATE_DEAL_VALUE':
            case 'UPDATE_DEAL_STATUS':
                return DollarSign;
            case 'ADD_CONTACT_TO_ENTITY':
            case 'UPDATE_CONTACT':
                return UserPlus;
            case 'ADD_TO_CALL_CAMPAIGN':
                return PhoneCall;
            case 'END_AUTOMATION':
                return StopCircle;
            case 'TRIGGER_OUTBOUND_WEBHOOK':
                return Globe;
            case 'UPDATE_LEAD_SCORE':
                return Sparkles;
            case 'ADD_NOTE':
                return StickyNote;
            default:
                return Zap;
        }
    };

    const Icon = getIcon();
    const stepName = formatActionName(actionType);

    const getResourceDetail = () => {
        if (!actionType) return 'Action';
        if (actionType === 'SEND_MESSAGE' || actionType?.startsWith('SEND_NOTIFICATION_')) {
            return config.templateName || (config.templateId ? 'Active Template' : 'Select Template');
        }
        if (actionType === 'DIRECT_EMAIL') {
            return config.directSubject || 'Direct Email';
        }
        if (actionType === 'DIRECT_SMS') {
            return config.directBody ? (String(config.directBody).substring(0, 20) + (String(config.directBody).length > 20 ? '...' : '')) : 'Direct SMS';
        }
        if (actionType === 'DIRECT_WHATSAPP') {
            return config.directBody ? (String(config.directBody).substring(0, 20) + (String(config.directBody).length > 20 ? '...' : '')) : 'Direct WhatsApp';
        }
        if (actionType === 'RUN_AUTOMATION') {
            return config.automationName || (config.automationId ? 'Sub-Flow' : 'Select Automation');
        }
        if (actionType === 'TRIGGER_OUTBOUND_WEBHOOK') {
            return config.webhookUrl ? config.webhookUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Webhook';
        }
        if (actionType === 'UPDATE_ENTITY') return 'App Fields';
        if (actionType === 'ASSIGN_ENTITY') return 'Assignee';
        if (actionType === 'CREATE_DEAL') return config.name || 'Deal';
        if (actionType === 'UPDATE_DEAL_STAGE') return 'Deal Stage';
        if (actionType === 'UPDATE_DEAL_VALUE') return 'Deal Value';
        if (actionType === 'UPDATE_DEAL_STATUS') return 'Deal Status';
        if (actionType === 'UPDATE_LEAD_SCORE') return 'Lead Score';
        return 'Details';
    };

    const getActionDescription = () => {
        if (!actionType) return 'Awaiting configuration';

        switch (actionType) {
            case 'SEND_MESSAGE': {
                const recipients = (config.recipientTargets || []).map((r: string) => {
                    if (r === 'triggering') return 'Triggering Contact';
                    if (r === 'primary') return 'Primary Contact';
                    if (r === 'signatories') return 'Signatories';
                    if (r === 'roles') return `Roles (${config.recipientRoles?.join(', ') || ''})`;
                    if (r === 'all') return 'All Contacts';
                    if (r === 'fixed') return 'Manual Entry';
                    return r;
                }).join(', ');
                const tName = config.templateName || 'Selected Template';
                return `Send "${tName}" to ${recipients || 'recipients'}`;
            }
            case 'DIRECT_EMAIL': {
                const recipients = (config.recipientTargets || []).map((r: string) => {
                    if (r === 'triggering') return 'Triggering Contact';
                    if (r === 'primary') return 'Primary Contact';
                    if (r === 'signatories') return 'Signatories';
                    if (r === 'roles') return `Roles (${config.recipientRoles?.join(', ') || ''})`;
                    if (r === 'all') return 'All Contacts';
                    if (r === 'fixed') return 'Manual Entry';
                    return r;
                }).join(', ');
                const subject = config.directSubject || 'Direct Email';
                return `Email "${subject}" to ${recipients || 'recipients'}`;
            }
            case 'DIRECT_SMS': {
                const recipients = (config.recipientTargets || []).map((r: string) => {
                    if (r === 'triggering') return 'Triggering Contact';
                    if (r === 'primary') return 'Primary Contact';
                    if (r === 'signatories') return 'Signatories';
                    if (r === 'roles') return `Roles (${config.recipientRoles?.join(', ') || ''})`;
                    if (r === 'all') return 'All Contacts';
                    if (r === 'fixed') return 'Manual Entry';
                    return r;
                }).join(', ');
                const snippet = config.directBody 
                    ? (String(config.directBody).substring(0, 20) + (String(config.directBody).length > 20 ? '...' : '')) 
                    : 'Direct SMS';
                return `SMS "${snippet}" to ${recipients || 'recipients'}`;
            }
            case 'DIRECT_WHATSAPP': {
                const recipients = (config.recipientTargets || []).map((r: string) => {
                    if (r === 'triggering') return 'Triggering Contact';
                    if (r === 'primary') return 'Primary Contact';
                    if (r === 'signatories') return 'Signatories';
                    if (r === 'roles') return `Roles (${config.recipientRoles?.join(', ') || ''})`;
                    if (r === 'all') return 'All Contacts';
                    if (r === 'fixed') return 'Manual Entry';
                    return r;
                }).join(', ');
                const snippet = config.directBody 
                    ? (String(config.directBody).substring(0, 20) + (String(config.directBody).length > 20 ? '...' : '')) 
                    : 'Direct WhatsApp';
                return `WhatsApp "${snippet}" to ${recipients || 'recipients'}`;
            }
            case 'SEND_NOTIFICATION_EMAIL':
            case 'SEND_NOTIFICATION_SMS':
            case 'SEND_NOTIFICATION_IN_APP':
            case 'SEND_NOTIFICATION_PUSH': {
                const channel = actionType.replace('SEND_NOTIFICATION_', '');
                const targets = (config.notificationTargets || []).map((t: string) => {
                    if (t === 'assignee') return 'Assignee';
                    if (t === 'users') return 'Team Members';
                    if (t === 'custom') return config.customRecipient || 'Custom Address';
                    return t;
                }).join(', ');
                const templateLabel = config.templateName
                    || (config.templateId ? 'Template Selected' : 'Select Template');
                return `Notify (${channel}) ${targets || 'team'}: ${templateLabel}`;
            }

            case 'CREATE_TASK':
                return `Create task: "${config.title || 'Untitled Task'}"`;
            case 'ADD_NOTE':
                return `Add note: "${config.content ? config.content.substring(0, 20) + (config.content.length > 20 ? '...' : '') : 'Awaiting content'}"`;
            case 'ASSIGN_ENTITY': {
                if (config.assignedTo === 'auto') return 'Auto-assign entity';
                const user = users?.find((u) => u.id === config.assignedTo);
                const name = user?.name || config.assigneeName;
                return `Assign entity to ${name || config.assignedTo || 'user'}`;
            }
            case 'UPDATE_ENTITY': {
                const updatesList: string[] = [];
                if (config.pipelineId) updatesList.push('Pipeline');
                if (config.stageId) {
                    const stage = stages?.find((s: any) => s.id === config.stageId);
                    updatesList.push(`Stage (${stage ? stage.name : 'Updated'})`);
                }
                if (config.assignedTo) {
                    const user = users?.find((u: any) => u.uid === config.assignedTo);
                    updatesList.push(`Assignee (${user ? user.name : 'Updated'})`);
                }
                if (config.updates && Object.keys(config.updates).length > 0) {
                    const fields = Object.keys(config.updates).join(', ');
                    updatesList.push(`Fields (${fields})`);
                }
                return updatesList.length > 0 
                    ? `Update: ${updatesList.join(', ')}` 
                    : 'Update entity fields';
            }
            case 'TRIGGER_OUTBOUND_WEBHOOK':
                return `Send Webhook to "${config.webhookUrl || 'Awaiting URL'}"`;
            case 'RUN_AUTOMATION':
                return `Run flow: "${config.automationName || 'Selected Sub-Flow'}"`;
            case 'CREATE_DEAL':
                return `Create deal: "${config.name || 'Untitled Deal'}"${config.value ? ` ($${config.value})` : ''}`;
            case 'UPDATE_DEAL_STAGE': {
                const stage = stages?.find((s: any) => s.id === config.stageId);
                return `Update deal stage to "${stage ? stage.name : (config.stageId || 'Stage')}"`;
            }
            case 'UPDATE_DEAL_VALUE':
                return `Update deal value to $${config.value || 0}`;
            case 'UPDATE_DEAL_STATUS':
                return `Update deal status to "${config.status || 'Status'}"`;
            case 'UPDATE_TASK':
                return `Update task status`;
            case 'UPDATE_LEAD_SCORE': {
                const op = config.operation === 'subtract' ? '-' : config.operation === 'set' ? '=' : '+';
                return `Adjust Score: ${op}${config.value !== undefined ? config.value : 0}`;
            }
            default:
                return actionType.replace(/_/g, ' ');
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
                isTrigger={false}
                canMoveUp={Boolean(data.canMoveUp)}
                canMoveDown={Boolean(data.canMoveDown)}
                hasNote={Boolean(data.hasNote)}
                onAddAbove={data.onAddAbove || (() => {})}
                onAddBelow={() => data.onAddStep?.(id)}
                onMoveUp={data.onMoveUp || (() => {})}
                onMoveDown={data.onMoveDown || (() => {})}
                onDuplicate={data.onDuplicate || (() => {})}
                onDelete={data.onDelete || (() => {})}
                onToggleNote={data.onToggleNote || (() => {})}
            />
            {overlay.badgeIcon && (
                <div className="absolute -top-2.5 -right-2.5 z-50">
                    <ExecutionBadge icon={overlay.badgeIcon} status={data.executionStatus} />
                </div>
            )}
            <Handle 
                type="target" 
                position={Position.Top} 
                className="bg-blue-500 border-2 border-white shadow-lg transition-colors hover:bg-blue-600" 
                style={{ width: '12px', height: '12px', top: '-6px' }}
            />
            {(() => {
                const isDisabledNode = typeof config.isDisabled === 'boolean' ? config.isDisabled : Boolean(data.isDisabled);
                return (
                    <Card className={cn(
                        "w-64 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-col",
                        actionType === 'SEND_MESSAGE' ? "h-[84px]" : "h-14",
                        isDisabledNode
                            ? "border-amber-400/80 border-dashed bg-amber-500/5 dark:bg-amber-950/10 opacity-90"
                            : selected
                            ? "border-blue-500 shadow-md ring-2 ring-blue-500/20"
                            : "border-blue-200",
                        overlay.borderClass,
                        overlay.glowClass
                    )}>
                        {/* Top Section */}
                        <div className="h-14 w-full flex flex-row items-center">
                            {/* Left Colored Accent Block */}
                            <div className={cn(
                                "w-12 h-full flex items-center justify-center flex-shrink-0 animate-fade-in",
                                isDisabledNode ? "bg-amber-500/80 text-white" : "bg-blue-500 text-white"
                            )}>
                                <Icon className="h-4 w-4" />
                            </div>
                            
                            {/* Right Content Area */}
                            <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
                                <div className="flex flex-col justify-center min-w-0 pr-1">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none truncate max-w-[180px]">
                                            {actionType ? `Action: ${stepName}` : 'Action: Unconfigured'}
                                        </span>
                                        {isDisabledNode && (
                                            <Badge variant="outline" className="text-[7px] font-extrabold px-1 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 uppercase tracking-wider flex items-center gap-0.5">
                                                <BellOff className="h-2 w-2" /> Bypassed
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs font-semibold text-foreground leading-tight truncate">
                                        {getActionDescription()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Stats Section */}
                        {actionType === 'SEND_MESSAGE' && (
                            <div className="h-7 w-full border-t border-border/40 bg-muted/5 flex items-center justify-between px-3">
                                <MessageNodeStatsStrip 
                                    automationId={automationId} 
                                    nodeId={id} 
                                    channel={config.channel} 
                                    integrated={true}
                                />
                            </div>
                        )}
                    </Card>
                );
            })()}
            <Handle
                type="source"
                position={Position.Bottom} 
                className={cn(
                    "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
                    data.isDefaultConnected ? "bg-blue-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
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
            {(selected || isHovered) && data.note && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-full px-2.5 py-1 max-w-[280px] shadow-sm cursor-pointer z-50" onClick={() => data.onToggleNote?.()}>
                    <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 truncate font-semibold">{data.note}</span>
                </div>
            )}
        </div>
    );
}

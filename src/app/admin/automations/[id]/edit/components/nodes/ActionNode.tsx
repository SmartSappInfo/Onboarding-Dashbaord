'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Play, Settings2, Mail, Clock, Building, Zap, ArrowRight, MousePointer2, Bell, Smartphone, Plus, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceScopedQueries } from '../../../../hooks/useWorkspaceScopedQueries';
import { useExecutionOverlay, ExecutionBadge } from './ExecutionOverlay';

/**
 * @fileOverview Refined Action Node for Automation Canvas.
 * Provides high-visibility feedback on the specific task being executed.
 */
const ACTION_NAMES: Record<string, string> = {
    SEND_MESSAGE: 'Send Message',
    CREATE_TASK: 'Create Task',
    UPDATE_ENTITY: 'Update Entity',
    ASSIGN_ENTITY: 'Assign Entity',
    TRIGGER_OUTBOUND_WEBHOOK: 'Outbound Webhook',
    SEND_NOTIFICATION_EMAIL: 'Notification (Email)',
    SEND_NOTIFICATION_SMS: 'Notification (SMS)',
    SEND_NOTIFICATION_IN_APP: 'Notification (In-App)',
    SEND_NOTIFICATION_PUSH: 'Notification (Push)',
    RUN_AUTOMATION: 'Run Automation',
    ADD_NOTE: 'Add Note',
    CREATE_DEAL: 'Create Deal',
    UPDATE_DEAL_STAGE: 'Update Deal Stage',
    UPDATE_DEAL_VALUE: 'Update Deal Value',
    UPDATE_DEAL_STATUS: 'Update Deal Status',
    UPDATE_TASK: 'Update Task',
    UPDATE_LEAD_SCORE: 'Adjust Lead Score',
};

export function ActionNode({ id, data, selected }: any) {
    const actionType = data.actionType;
    const config = data.config || {};

    const { users, stages, pipelines } = useWorkspaceScopedQueries();

    const getIcon = () => {
        switch(actionType) {
            case 'SEND_MESSAGE': return Mail;
            case 'CREATE_TASK': return Clock;
            case 'UPDATE_ENTITY': return Building;
            case 'ASSIGN_ENTITY': return Building;
            case 'TRIGGER_OUTBOUND_WEBHOOK': return Zap;
            case 'SEND_NOTIFICATION_EMAIL': return Mail;
            case 'SEND_NOTIFICATION_SMS': return Smartphone;
            case 'SEND_NOTIFICATION_IN_APP': return Bell;
            case 'SEND_NOTIFICATION_PUSH': return Smartphone;
            case 'UPDATE_LEAD_SCORE': return Sparkles;
            default: return Play;
        }
    };

    const Icon = getIcon();
    const stepName = ACTION_NAMES[actionType] || (actionType ? actionType.replace(/_/g, ' ') : 'Action Step');

    const getResourceDetail = () => {
        if (!actionType) return 'Action';
        if (actionType === 'SEND_MESSAGE' || actionType?.startsWith('SEND_NOTIFICATION_')) {
            return config.templateName || (config.templateId ? 'Active Template' : 'Select Template');
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
                const user = users?.find((u: any) => u.uid === config.assignedTo);
                return `Assign entity to ${user ? user.name : (config.assignedTo || 'user')}`;
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
        )}>
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
            <Card className={cn(
                "w-64 h-14 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-row items-center",
                selected ? "border-blue-500 shadow-md ring-2 ring-blue-500/20" : "border-blue-200",
                overlay.borderClass,
                overlay.glowClass
            )}>
                {/* Left Colored Accent Block */}
                <div className="w-12 h-full bg-blue-500 flex items-center justify-center flex-shrink-0 animate-fade-in">
                    <Icon className="h-4 w-4 text-white" />
                </div>
                
                {/* Right Content Area */}
                <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
                    <div className="flex flex-col justify-center min-w-0 pr-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mb-1 truncate">
                            Action Step
                        </span>
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {getActionDescription()}
                        </p>
                    </div>
                </div>
            </Card>
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
        </div>
    );
}

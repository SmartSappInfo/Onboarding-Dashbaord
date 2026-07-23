import React from 'react';
import {
  Sparkles,
  Trash2,
  Tag as TagIcon,
  PhoneCall,
  DollarSign,
  UserPlus,
  ClipboardList,
  CalendarDays,
  CheckCircle2,
  Eye,
  MousePointer2,
  AlertTriangle,
  MessageSquare,
  UserX,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TagSelector } from '@/components/tags/TagSelector';
import { cn } from '@/lib/utils';
import type {
  MessageDeliveryStatusEvent,
  MessageEventActionType,
  MessageStatusActionConfig,
  MessageStatusRule,
} from '@/lib/types';

interface MessageStatusAutomationsPanelProps {
  statusRules: MessageStatusRule[];
  onChangeRules: (updatedRules: MessageStatusRule[]) => void;
  pipelines?: Array<{ id: string; name: string; stages?: Array<{ id: string; name: string }> }>;
  automations?: Array<{ id: string; name: string }>;
  users?: Array<{ uid: string; displayName?: string; email?: string }>;
  callCampaigns?: Array<{ id: string; name: string }>;
  meetingTypes?: Array<{ id: string; name: string }>;
}

const EVENT_CONFIG: Record<
  MessageDeliveryStatusEvent,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  opened: {
    label: 'Email / Message Opened',
    description: 'Trigger actions when recipient opens the email or message.',
    icon: Eye,
    colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  clicked: {
    label: 'Link Clicked',
    description: 'Trigger actions when recipient clicks a link inside the message.',
    icon: MousePointer2,
    colorClass: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  },
  bounced: {
    label: 'Bounced / Failed',
    description: 'Trigger actions when delivery fails or email hard/soft bounces.',
    icon: AlertTriangle,
    colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  },
  replied: {
    label: 'Recipient Replied',
    description: 'Trigger actions when recipient sends an inbound reply.',
    icon: MessageSquare,
    colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  delivered: {
    label: 'Message Delivered',
    description: 'Trigger actions upon successful delivery to handset or inbox.',
    icon: CheckCircle2,
    colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  unsubscribed: {
    label: 'Unsubscribed',
    description: 'Trigger actions when recipient opts out or unsubscribes.',
    icon: UserX,
    colorClass: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  },
};

const ACTION_TYPES: Array<{ type: MessageEventActionType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: 'add_tags', label: 'Add Tag(s)', icon: TagIcon },
  { type: 'remove_tags', label: 'Remove Tag(s)', icon: TagIcon },
  { type: 'add_to_campaign', label: 'Add to Call Campaign', icon: PhoneCall },
  { type: 'move_deal', label: 'Create / Move Deal Stage', icon: DollarSign },
  { type: 'enroll_automation', label: 'Enroll in Automation', icon: Sparkles },
  { type: 'assign_user', label: 'Assign Lead Owner', icon: UserPlus },
  { type: 'create_task', label: 'Create Follow-up Task', icon: ClipboardList },
  { type: 'send_meeting', label: 'Send Meeting Invite', icon: CalendarDays },
];

export function MessageStatusAutomationsPanel({
  statusRules,
  onChangeRules,
  pipelines = [],
  automations = [],
  users = [],
  callCampaigns = [],
  meetingTypes = [],
}: MessageStatusAutomationsPanelProps): React.ReactElement {
  const [expandedEvent, setExpandedEvent] = React.useState<MessageDeliveryStatusEvent | null>('opened');

  const getRuleForEvent = (evt: MessageDeliveryStatusEvent): MessageStatusRule => {
    const existing = statusRules.find((r) => r.event === evt);
    if (existing) return existing;
    return {
      id: `rule_${evt}`,
      event: evt,
      enabled: false,
      actions: [],
    };
  };

  const updateRule = (updatedRule: MessageStatusRule) => {
    const next = [...statusRules];
    const idx = next.findIndex((r) => r.event === updatedRule.event);
    if (idx >= 0) {
      next[idx] = updatedRule;
    } else {
      next.push(updatedRule);
    }
    onChangeRules(next);
  };

  const toggleRuleEnabled = (evt: MessageDeliveryStatusEvent, enabled: boolean) => {
    const rule = getRuleForEvent(evt);
    updateRule({ ...rule, enabled });
  };

  const addActionToRule = (evt: MessageDeliveryStatusEvent, actionType: MessageEventActionType) => {
    const rule = getRuleForEvent(evt);
    const newAction: MessageStatusActionConfig = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: actionType,
    };
    updateRule({
      ...rule,
      enabled: true,
      actions: [...rule.actions, newAction],
    });
  };

  const updateActionConfig = (
    evt: MessageDeliveryStatusEvent,
    actionId: string,
    patch: Partial<MessageStatusActionConfig>
  ) => {
    const rule = getRuleForEvent(evt);
    const updatedActions = rule.actions.map((act) => (act.id === actionId ? { ...act, ...patch } : act));
    updateRule({ ...rule, actions: updatedActions });
  };

  const removeActionFromRule = (evt: MessageDeliveryStatusEvent, actionId: string) => {
    const rule = getRuleForEvent(evt);
    const updatedActions = rule.actions.filter((act) => act.id !== actionId);
    updateRule({ ...rule, actions: updatedActions });
  };

  const activeRuleCount = statusRules.filter((r) => r.enabled && r.actions.length > 0).length;

  return (
    <div className="space-y-4 text-left">
      {/* Header Summary */}
      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Event Automations</h4>
            <p className="text-[10px] text-muted-foreground">
              Define automated lead actions for each delivery status milestone.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20">
          {activeRuleCount} Active Events
        </Badge>
      </div>

      {/* List of Events */}
      <div className="space-y-3">
        {(Object.keys(EVENT_CONFIG) as MessageDeliveryStatusEvent[]).map((evt) => {
          const cfg = EVENT_CONFIG[evt];
          const IconComp = cfg.icon;
          const rule = getRuleForEvent(evt);
          const isExpanded = expandedEvent === evt;
          const hasActiveActions = rule.enabled && rule.actions.length > 0;

          return (
            <div
              key={evt}
              className={cn(
                'rounded-2xl border transition-all duration-200 bg-card overflow-hidden',
                isExpanded ? 'border-primary/40 shadow-sm' : 'border-border/60 hover:border-border'
              )}
            >
              {/* Card Bar */}
              <div
                className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedEvent(isExpanded ? null : evt)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border', cfg.colorClass)}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{cfg.label}</span>
                      {hasActiveActions && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 font-extrabold bg-primary/10 text-primary border-0">
                          {rule.actions.length} {rule.actions.length === 1 ? 'Action' : 'Actions'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{cfg.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => toggleRuleEnabled(evt, checked)}
                    className="scale-90"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={() => setExpandedEvent(isExpanded ? null : evt)}
                  >
                    <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isExpanded && 'rotate-180')} />
                  </Button>
                </div>
              </div>

              {/* Expanded Action List Builder */}
              {isExpanded && (
                <div className="p-3.5 pt-0 border-t border-border/40 bg-muted/10 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  {rule.actions.length === 0 ? (
                    <div className="py-4 text-center border border-dashed border-border/60 rounded-xl bg-background/50">
                      <p className="text-[11px] text-muted-foreground font-medium mb-2">No actions defined for this event.</p>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {ACTION_TYPES.map((actType) => {
                          const ActIcon = actType.icon;
                          return (
                            <Button
                              key={actType.type}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] font-bold gap-1 rounded-lg hover:bg-primary/5 active:scale-[0.97]"
                              onClick={() => addActionToRule(evt, actType.type)}
                            >
                              <ActIcon className="h-3 w-3 text-primary" />
                              {actType.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rule.actions.map((act, actionIndex) => {
                        const actionMeta = ACTION_TYPES.find((a) => a.type === act.type);
                        const ActIcon = actionMeta?.icon || Sparkles;

                        return (
                          <div key={act.id} className="p-3 rounded-xl border border-border/60 bg-background space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[9px] font-bold font-mono">
                                  #{actionIndex + 1}
                                </Badge>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                  <ActIcon className="h-3.5 w-3.5 text-primary" />
                                  {actionMeta?.label}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-md active:scale-[0.97]"
                                onClick={() => removeActionFromRule(evt, act.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Action-Specific Inputs */}
                            {act.type === 'add_tags' || act.type === 'remove_tags' ? (
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground">Select Tags</Label>
                                <TagSelector
                                  currentTagIds={act.tagIds || []}
                                  onTagsChange={(tagIds) => updateActionConfig(evt, act.id, { tagIds })}
                                />
                              </div>
                            ) : null}

                            {act.type === 'add_to_campaign' ? (
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground">Call Campaign</Label>
                                <select
                                  value={act.campaignId || ''}
                                  onChange={(e) => updateActionConfig(evt, act.id, { campaignId: e.target.value })}
                                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                                >
                                  <option value="">Select Call Campaign...</option>
                                  {callCampaigns.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            {act.type === 'move_deal' ? (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-semibold text-muted-foreground">Pipeline</Label>
                                  <select
                                    value={act.pipelineId || ''}
                                    onChange={(e) => updateActionConfig(evt, act.id, { pipelineId: e.target.value, stageId: '' })}
                                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                                  >
                                    <option value="">Select Pipeline...</option>
                                    {pipelines.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-[10px] font-semibold text-muted-foreground">Target Stage</Label>
                                  <select
                                    value={act.stageId || ''}
                                    onChange={(e) => updateActionConfig(evt, act.id, { stageId: e.target.value })}
                                    disabled={!act.pipelineId}
                                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs disabled:opacity-50"
                                  >
                                    <option value="">Select Stage...</option>
                                    {(pipelines.find((p) => p.id === act.pipelineId)?.stages || []).map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : null}

                            {act.type === 'enroll_automation' ? (
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground">Target Automation</Label>
                                <select
                                  value={act.automationId || ''}
                                  onChange={(e) => updateActionConfig(evt, act.id, { automationId: e.target.value })}
                                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                                >
                                  <option value="">Select Destination Automation...</option>
                                  {automations.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            {act.type === 'assign_user' ? (
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground">Assign Lead Owner</Label>
                                <select
                                  value={act.assignedUserId || ''}
                                  onChange={(e) => updateActionConfig(evt, act.id, { assignedUserId: e.target.value })}
                                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                                >
                                  <option value="">Select User Owner...</option>
                                  {users.map((u) => (
                                    <option key={u.uid} value={u.uid}>
                                      {u.displayName || u.email || u.uid}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            {act.type === 'create_task' ? (
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-semibold text-muted-foreground">Task Title</Label>
                                  <Input
                                    value={act.taskTitle || ''}
                                    onChange={(e) => updateActionConfig(evt, act.id, { taskTitle: e.target.value })}
                                    placeholder="e.g. Follow up on link click {{contact.first_name}}"
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-semibold text-muted-foreground">Description (Optional)</Label>
                                  <Textarea
                                    value={act.taskDescription || ''}
                                    onChange={(e) => updateActionConfig(evt, act.id, { taskDescription: e.target.value })}
                                    placeholder="Task instructions..."
                                    rows={2}
                                    className="text-xs p-2"
                                  />
                                </div>
                              </div>
                            ) : null}

                            {act.type === 'send_meeting' ? (
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-muted-foreground">Meeting Booking Flow</Label>
                                <select
                                  value={act.meetingTypeId || ''}
                                  onChange={(e) => updateActionConfig(evt, act.id, { meetingTypeId: e.target.value })}
                                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                                >
                                  <option value="">Select Meeting Type...</option>
                                  {meetingTypes.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {/* Add Action Button */}
                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground mr-1">+ Add Action:</span>
                        {ACTION_TYPES.map((actType) => {
                          const ActIcon = actType.icon;
                          return (
                            <Button
                              key={actType.type}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-[9px] font-bold gap-1 px-2 rounded-md hover:bg-primary/5 active:scale-[0.97]"
                              onClick={() => addActionToRule(evt, actType.type)}
                            >
                              <ActIcon className="h-3 w-3 text-primary" />
                              {actType.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

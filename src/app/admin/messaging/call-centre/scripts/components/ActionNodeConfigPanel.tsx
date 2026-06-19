'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, Calendar, Clock, CalendarDays } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CallActionType, ScriptNode } from '@/lib/types';
import { CALL_ACTION_TYPES, getActionMeta } from '@/lib/call-action-types';

// Lazy-load the heavy template selector (57KB) to avoid bundle bloat
// vercel-react: bundle-dynamic-imports
const MessagingTemplateSelector = dynamic(
  () =>
    import('@/app/admin/components/MessagingTemplateSelector').then(
      (m) => m.MessagingTemplateSelector
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-10 w-full rounded-xl" />,
  }
);

// ─── Sentinel value for empty Select.Item (avoids runtime crash) ─────────────
// Radix UI Select crashes when <SelectItem value=""> — use this instead and
// convert to/from undefined at the boundary.
const NONE_SENTINEL = '__none__';

function toSelectValue(v: string | undefined): string {
  return v && v.length > 0 ? v : NONE_SENTINEL;
}

function fromSelectValue(v: string): string | undefined {
  return v === NONE_SENTINEL ? undefined : v;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TagItem {
  id: string;
  name: string;
}

interface StageItem {
  id: string;
  name: string;
}

interface MeetingItem {
  id: string;
  title: string;
}

interface WorkspaceUserItem {
  id: string;
  name?: string;
  email: string;
  photoURL?: string;
}

interface ActionNodeConfigPanelProps {
  actionType: CallActionType | undefined;
  actionConfig: ScriptNode['data']['actionConfig'];
  onUpdate: (patch: Partial<ScriptNode['data']>) => void;
  tags: TagItem[];
  stages: StageItem[];
  meetings: MeetingItem[];
  workspaceUsers?: WorkspaceUserItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Prevents keyboard events containing "/" from bubbling to the React Flow
 * canvas, which would otherwise trigger canvas shortcuts mid-typing.
 */
function stopSlashPropagation(e: React.KeyboardEvent) {
  if (e.key === '/' || e.key === 'Slash') {
    e.stopPropagation();
  }
}

/** Small hint badge rendered beneath variable-aware inputs */
function VariableHint() {
  return (
    <p className="text-[8px] text-muted-foreground/50 leading-tight">
      Use{' '}
      <code className="font-mono bg-muted/40 px-0.5 rounded">
        {'{{VARIABLE}}'}
      </code>{' '}
      or{' '}
      <code className="font-mono bg-muted/40 px-0.5 rounded">/field</code>{' '}
      to inject contact/deal fields
    </p>
  );
}

// ─── Sub-component: DueDateField ─────────────────────────────────────────────

interface DueDateFieldProps {
  mode: 'days' | 'specific';
  dueDays: number;
  dueSpecificDate: string;
  dueTimeOfDay: string;
  onModeChange: (mode: 'days' | 'specific') => void;
  onDueDaysChange: (days: number) => void;
  onDueSpecificDateChange: (date: string) => void;
  onDueTimeOfDayChange: (time: string) => void;
}

const DueDateField = React.memo(function DueDateField({
  mode,
  dueDays,
  dueSpecificDate,
  dueTimeOfDay,
  onModeChange,
  onDueDaysChange,
  onDueSpecificDateChange,
  onDueTimeOfDayChange,
}: DueDateFieldProps) {
  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="space-y-1">
        <Label className="text-[8px] font-bold text-muted-foreground uppercase">
          Due Date
        </Label>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={mode === 'days' ? 'default' : 'outline'}
            className="h-7 text-[9px] flex-1 gap-1"
            onClick={() => onModeChange('days')}
          >
            <CalendarDays className="h-3 w-3" />
            Days from call
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'specific' ? 'default' : 'outline'}
            className="h-7 text-[9px] flex-1 gap-1"
            onClick={() => onModeChange('specific')}
          >
            <Calendar className="h-3 w-3" />
            Specific date
          </Button>
        </div>
      </div>

      {/* Days input (mode === 'days') */}
      {mode === 'days' && (
        <div className="space-y-1">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            Days After Call
          </Label>
          <Input
            type="number"
            min={0}
            value={dueDays}
            onChange={(e) => onDueDaysChange(Number(e.target.value) || 0)}
            onKeyDown={stopSlashPropagation}
            placeholder="3"
            className="h-8 bg-background border-border rounded-lg text-xs px-2"
          />
        </div>
      )}

      {/* Specific date picker (mode === 'specific') */}
      {mode === 'specific' && (
        <div className="space-y-1">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            Due Date
          </Label>
          <Input
            type="date"
            value={dueSpecificDate}
            onChange={(e) => onDueSpecificDateChange(e.target.value)}
            onKeyDown={stopSlashPropagation}
            className="h-8 bg-background border-border rounded-lg text-xs px-2"
          />
        </div>
      )}

      {/* Time-of-day — shared across both modes */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            Time of Day
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] max-w-[220px]">
                Sets the default call time. Agents can override this during the
                call to match a time agreed with the client.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
          <Input
            type="time"
            value={dueTimeOfDay}
            onChange={(e) => onDueTimeOfDayChange(e.target.value)}
            onKeyDown={stopSlashPropagation}
            className="h-8 bg-background border-border rounded-lg text-xs pl-7 pr-2"
          />
        </div>
        <p className="text-[8px] text-muted-foreground/50 leading-tight">
          Default time from config. Agents may update this to a client-agreed
          time during the call.
        </p>
      </div>
    </div>
  );
});

DueDateField.displayName = 'DueDateField';

// ─── Main Component ───────────────────────────────────────────────────────────

const ActionNodeConfigPanel = React.memo(function ActionNodeConfigPanel({
  actionType,
  actionConfig,
  onUpdate,
  tags,
  stages,
  meetings,
  workspaceUsers = [],
}: ActionNodeConfigPanelProps) {
  const config = actionConfig ?? {};
  const activeType = actionType || 'SEND_SMS';
  const meta = getActionMeta(activeType);

  const updateConfig = React.useCallback(
    (patch: Partial<NonNullable<ScriptNode['data']['actionConfig']>>) => {
      onUpdate({ actionConfig: { ...config, ...patch } });
    },
    [config, onUpdate]
  );

  const handleActionTypeChange = React.useCallback(
    (val: string) => {
      const typedVal = val as CallActionType;
      const newMeta = getActionMeta(typedVal);
      onUpdate({
        actionType: typedVal,
        label: `Action: ${newMeta.label}`,
      });
    },
    [onUpdate]
  );

  // ── Derived task due-date values ──────────────────────────────────────────
  const taskDueDateMode = config.taskDueDateMode ?? 'days';
  const taskDueDays = config.taskDueDays ?? 1;
  const taskDueSpecificDate = config.taskDueSpecificDate ?? '';
  const taskDueTimeOfDay = config.taskDueTimeOfDay ?? '15:00'; // default 3 PM

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
        Action Configuration
      </span>

      {/* ── Action Type Selector ──────────────────────────────────────────── */}
      <div className="space-y-1">
        <Label className="text-[8px] font-bold text-muted-foreground uppercase">
          Automation Trigger Type
        </Label>
        <Select value={activeType} onValueChange={handleActionTypeChange}>
          <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            {CALL_ACTION_TYPES.map((type) => {
              const m = getActionMeta(type);
              const Icon = m.icon;
              return (
                <SelectItem key={type} value={type}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-3 w-3 shrink-0 opacity-70" />
                    {m.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* ── Action Type Badge ─────────────────────────────────────────────── */}
      <Badge
        className={cn(
          'text-[8px] font-bold px-2 py-0.5 text-white border-0',
          meta.colorClass
        )}
      >
        <meta.icon className="h-2.5 w-2.5 mr-1" />
        {meta.label}
      </Badge>

      {/* ── Messaging Actions (SMS, Email, WhatsApp) ─────────────────────── */}
      {meta.channel ? (
        <div className="space-y-1.5 transition-opacity duration-200">
          <div className="flex items-center gap-1.5">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              {meta.label} Template
            </Label>
            {activeType === 'SEND_WHATSAPP' ? (
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
            ) : null}
          </div>
          <MessagingTemplateSelector
            category="campaigns"
            recipientType="entity"
            channel={meta.channel}
            value={config.templateId ?? ''}
            onValueChange={(val: string) => updateConfig({ templateId: val })}
            compact
          />
        </div>
      ) : null}

      {/* ── Create Task ───────────────────────────────────────────────────── */}
      {activeType === 'CREATE_TASK' ? (
        <div className="space-y-3 transition-opacity duration-200">

          {/* Task Title */}
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Task Title
            </Label>
            <Input
              value={config.taskTitle ?? ''}
              onChange={(e) => updateConfig({ taskTitle: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder="Follow up with {{CONTACT_NAME}}"
              className="h-8 bg-background border-border rounded-lg text-xs px-2"
            />
            <VariableHint />
          </div>

          {/* Task Description */}
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Task Description
            </Label>
            <Textarea
              value={config.taskDescription ?? ''}
              onChange={(e) => updateConfig({ taskDescription: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder={
                'Agreed action from call on {{CALL_DATE}}:\n• {{OUTCOME}}\n• Client prefers contact via {{PREFERRED_CHANNEL}}'
              }
              rows={3}
              className="bg-background border-border rounded-xl text-xs p-2 resize-none"
            />
            <VariableHint />
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Priority
            </Label>
            <Select
              value={config.taskPriority ?? 'medium'}
              onValueChange={(val) =>
                updateConfig({ taskPriority: val as 'low' | 'medium' | 'high' })
              }
            >
              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date (days vs specific + time picker) */}
          <DueDateField
            mode={taskDueDateMode}
            dueDays={taskDueDays}
            dueSpecificDate={taskDueSpecificDate}
            dueTimeOfDay={taskDueTimeOfDay}
            onModeChange={(m) => updateConfig({ taskDueDateMode: m })}
            onDueDaysChange={(d) => updateConfig({ taskDueDays: d })}
            onDueSpecificDateChange={(dt) =>
              updateConfig({ taskDueSpecificDate: dt })
            }
            onDueTimeOfDayChange={(t) => updateConfig({ taskDueTimeOfDay: t })}
          />

          {/* Assign To */}
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Assign To
            </Label>
            <Select
              value={config.taskAssigneeMode ?? 'caller'}
              onValueChange={(val) =>
                updateConfig({
                  taskAssigneeMode: val as 'caller' | 'specific' | 'round_robin',
                  // Clear assignee when switching away from 'specific'
                  taskAssigneeId: val === 'specific' ? config.taskAssigneeId : undefined,
                })
              }
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

          {/* Specific user picker — only shown when mode === 'specific' */}
          {config.taskAssigneeMode === 'specific' && (
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                Select User
              </Label>
              <Select
                value={toSelectValue(config.taskAssigneeId)}
                onValueChange={(val) =>
                  updateConfig({ taskAssigneeId: fromSelectValue(val) })
                }
              >
                <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
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
                    <SelectItem value={NONE_SENTINEL} disabled>
                      No workspace users found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {config.taskAssigneeId && (() => {
                const u = workspaceUsers.find(x => x.id === config.taskAssigneeId);
                return u ? (
                  <p className="text-[8px] text-muted-foreground/60">
                    Assigned to: <span className="font-semibold text-foreground/70">{u.name || u.email}</span>
                  </p>
                ) : null;
              })()}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Change Stage ──────────────────────────────────────────────────── */}
      {activeType === 'CHANGE_STAGE' ? (
        <div className="space-y-1 transition-opacity duration-200">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            Target Pipeline Stage
          </Label>
          <Select
            value={toSelectValue(config.stageId)}
            onValueChange={(val) =>
              updateConfig({ stageId: fromSelectValue(val) })
            }
          >
            <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
              <SelectValue placeholder="Select stage..." />
            </SelectTrigger>
            <SelectContent>
              {stages.length > 0 ? (
                stages.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value={NONE_SENTINEL} disabled>
                  No stages found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* ── Add Tag / Remove Tag ──────────────────────────────────────────── */}
      {activeType === 'ADD_TAG' || activeType === 'REMOVE_TAG' ? (
        <div className="space-y-1 transition-opacity duration-200">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            {activeType === 'ADD_TAG' ? 'Tag to Add' : 'Tag to Remove'}
          </Label>
          <Select
            value={toSelectValue(config.tagId)}
            onValueChange={(val) =>
              updateConfig({ tagId: fromSelectValue(val) })
            }
          >
            <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
              <SelectValue placeholder="Select tag..." />
            </SelectTrigger>
            <SelectContent>
              {tags.length > 0 ? (
                tags.map((tg) => (
                  <SelectItem key={tg.id} value={tg.id}>
                    {tg.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value={NONE_SENTINEL} disabled>
                  No tags found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* ── Webhook ───────────────────────────────────────────────────────── */}
      {activeType === 'WEBHOOK' ? (
        <div className="space-y-3 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Webhook Target URL
            </Label>
            <Input
              value={config.webhookUrl ?? ''}
              onChange={(e) => updateConfig({ webhookUrl: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder="https://api.thirdparty.com/webhook"
              className="h-8 bg-background border-border rounded-lg text-xs px-2"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              HTTP Method
            </Label>
            <Select
              value={config.webhookMethod ?? 'POST'}
              onValueChange={(val) =>
                updateConfig({ webhookMethod: val as 'POST' | 'GET' | 'PUT' })
              }
            >
              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Custom Headers (JSON format)
            </Label>
            <Textarea
              value={config.webhookHeaders ?? ''}
              onChange={(e) => updateConfig({ webhookHeaders: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder='{ "Authorization": "Bearer key" }'
              rows={2}
              className="bg-background border-border rounded-xl text-xs p-2 resize-none"
            />
          </div>
        </div>
      ) : null}

      {/* ── Log Note ──────────────────────────────────────────────────────── */}
      {activeType === 'LOG_NOTE' ? (
        <div className="space-y-1 transition-opacity duration-200">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            Note Content
          </Label>
          <Textarea
            value={config.noteContent ?? ''}
            onChange={(e) => updateConfig({ noteContent: e.target.value })}
            onKeyDown={stopSlashPropagation}
            placeholder="Agent logged: {{OUTCOME}} for {{CONTACT_NAME}}..."
            rows={3}
            className="bg-background border-border rounded-xl text-xs p-2 resize-none"
          />
          <VariableHint />
        </div>
      ) : null}

      {/* ── Schedule Meeting ──────────────────────────────────────────────── */}
      {activeType === 'SCHEDULE_MEETING' ? (
        <div className="space-y-1 transition-opacity duration-200">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            Meeting Type
          </Label>
          <Select
            value={toSelectValue(config.meetingTypeId)}
            onValueChange={(val) =>
              updateConfig({ meetingTypeId: fromSelectValue(val) })
            }
          >
            <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
              <SelectValue placeholder="Select meeting type..." />
            </SelectTrigger>
            <SelectContent>
              {meetings.length > 0 ? (
                meetings.map((mt) => (
                  <SelectItem key={mt.id} value={mt.id}>
                    {mt.title}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value={NONE_SENTINEL} disabled>
                  No meeting types found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* ── Transfer Call ─────────────────────────────────────────────────── */}
      {activeType === 'TRANSFER_CALL' ? (
        <div className="space-y-3 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Transfer Mode
            </Label>
            <Select
              value={config.transferMode ?? 'phone'}
              onValueChange={(val) =>
                updateConfig({
                  transferMode: val as 'phone' | 'agent' | 'campaign',
                })
              }
            >
              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Direct Phone Number</SelectItem>
                <SelectItem value="agent">To Agent / Extension</SelectItem>
                <SelectItem value="campaign">To Another Campaign</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              {config.transferMode === 'phone'
                ? 'Phone Number'
                : config.transferMode === 'agent'
                  ? 'Agent / Extension ID'
                  : 'Campaign ID'}
            </Label>
            <Input
              value={config.transferTarget ?? ''}
              onChange={(e) => updateConfig({ transferTarget: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder={
                config.transferMode === 'phone'
                  ? '+1 (555) 000-0000'
                  : config.transferMode === 'agent'
                    ? 'agent_id or ext 200'
                    : 'campaign_id_to_transfer'
              }
              className="h-8 bg-background border-border rounded-lg text-xs px-2"
            />
          </div>
        </div>
      ) : null}

      {/* ── Update Contact ────────────────────────────────────────────────── */}
      {activeType === 'UPDATE_CONTACT' ? (
        <div className="space-y-3 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Contact Name
            </Label>
            <Input
              value={config.contactName ?? ''}
              onChange={(e) => updateConfig({ contactName: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder="e.g. John Doe or {{CURRENT_CONTACT_NAME}}"
              className="h-8 bg-background border-border rounded-lg text-xs px-2"
            />
            <VariableHint />
          </div>
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Contact Email
            </Label>
            <Input
              value={config.contactEmail ?? ''}
              onChange={(e) => updateConfig({ contactEmail: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder="e.g. john@example.com"
              className="h-8 bg-background border-border rounded-lg text-xs px-2"
            />
            <VariableHint />
          </div>
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Contact Phone
            </Label>
            <Input
              value={config.contactPhone ?? ''}
              onChange={(e) => updateConfig({ contactPhone: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder="e.g. +1 (555) 000-0000"
              className="h-8 bg-background border-border rounded-lg text-xs px-2"
            />
            <VariableHint />
          </div>
        </div>
      ) : null}

      {/* ── Trigger Delay (shared across all action types) ────────────────── */}
      <div className="space-y-1 pt-2 border-t border-border/30">
        <Label className="text-[8px] font-bold text-muted-foreground uppercase">
          Trigger Delay (Seconds)
        </Label>
        <Input
          type="number"
          min={0}
          value={config.triggerDelaySeconds ?? 0}
          onChange={(e) =>
            updateConfig({
              triggerDelaySeconds: Number(e.target.value) || 0,
            })
          }
          onKeyDown={stopSlashPropagation}
          className="h-8 bg-background border-border rounded-lg text-xs px-2"
          aria-label="Trigger delay in seconds"
        />
      </div>
    </div>
  );
});

ActionNodeConfigPanel.displayName = 'ActionNodeConfigPanel';

export { ActionNodeConfigPanel };
export type { ActionNodeConfigPanelProps, TagItem, StageItem, MeetingItem };

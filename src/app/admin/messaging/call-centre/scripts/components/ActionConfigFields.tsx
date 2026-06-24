'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { SlashInput, SlashTextarea } from '@/components/messaging/SlashInput';
import { Info, Calendar, Clock, CalendarDays, CalendarPlus, UserPlus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CallActionType, CallActionParams } from '@/lib/types';
import { getActionMeta } from '@/lib/call-action-types';

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

// ─── Data source shapes (org-scoped lists fed to the per-action fields) ──────

export interface ActionConfigDataSources {
  tags: { id: string; name: string }[];
  /** Pipeline stages; `pipelineId` lets us group them under their pipeline. */
  stages: { id: string; name: string; pipelineId?: string }[];
  pipelines: { id: string; name: string }[];
  /** Create-mode meeting *types* (e.g. MEETING_TYPES) — { id, title }. */
  meetings: { id: string; title: string }[];
  /** Guest-list targets: existing, not-yet-due meetings — { id, title }. */
  activeMeetings: { id: string; title: string }[];
  callCampaigns: { id: string; name: string }[];
  workspaceUsers?: { id: string; name?: string; email: string; photoURL?: string }[];
}

export interface ActionConfigFieldsProps {
  type: CallActionType;
  params: CallActionParams;
  onChange: (patch: Partial<CallActionParams>) => void;
  data: ActionConfigDataSources;
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
            className="h-7 text-[9px] flex-1 gap-1 active:scale-[0.97] transition-transform"
            onClick={() => onModeChange('days')}
          >
            <CalendarDays className="h-3 w-3" />
            Days from call
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'specific' ? 'default' : 'outline'}
            className="h-7 text-[9px] flex-1 gap-1 active:scale-[0.97] transition-transform"
            onClick={() => onModeChange('specific')}
          >
            <Calendar className="h-3 w-3" />
            Specific date
          </Button>
        </div>
      </div>

      {/* Days input (mode === 'days') */}
      {mode === 'days' ? (
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
      ) : (
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

const ActionConfigFields = React.memo(function ActionConfigFields({
  type,
  params,
  onChange,
  data,
}: ActionConfigFieldsProps) {
  const meta = getActionMeta(type);
  const { tags, stages, pipelines, meetings, activeMeetings, callCampaigns, workspaceUsers = [] } = data;

  // ── Derived task due-date values ──────────────────────────────────────────
  const taskDueDateMode = params.taskDueDateMode ?? 'days';
  const taskDueDays = params.taskDueDays ?? 1;
  const taskDueSpecificDate = params.taskDueSpecificDate ?? '';
  const taskDueTimeOfDay = params.taskDueTimeOfDay ?? '15:00'; // default 3 PM

  // ── Stages grouped by pipeline (CHANGE_STAGE) ─────────────────────────────
  const stagesByPipeline = React.useMemo(() => {
    const pipelineNames = new Map(pipelines.map((p) => [p.id, p.name]));
    const groups = new Map<string, { pipelineName: string; stages: typeof stages }>();
    for (const stage of stages) {
      const key = stage.pipelineId ?? '__ungrouped__';
      const existing = groups.get(key);
      if (existing) {
        existing.stages.push(stage);
      } else {
        groups.set(key, {
          pipelineName: stage.pipelineId ? pipelineNames.get(stage.pipelineId) ?? 'Pipeline' : 'Other',
          stages: [stage],
        });
      }
    }
    return Array.from(groups.values());
  }, [stages, pipelines]);

  // ── Stages of the pipeline picked for ADD_TO_PIPELINE ─────────────────────
  const stagesForSelectedPipeline = React.useMemo(
    () => (params.pipelineId ? stages.filter((s) => s.pipelineId === params.pipelineId) : []),
    [stages, params.pipelineId]
  );

  const meetingMode = params.meetingMode ?? 'guest_list';

  return (
    <div className="space-y-3">
      {/* ── Messaging Actions (SMS, Email, WhatsApp) ─────────────────────── */}
      {meta.channel ? (
        <div className="space-y-1.5 transition-opacity duration-200">
          <div className="flex items-center gap-1.5">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              {meta.label} Template
            </Label>
            {type === 'SEND_WHATSAPP' ? (
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
            value={params.templateId ?? ''}
            onValueChange={(val: string) => onChange({ templateId: val })}
            compact
          />
        </div>
      ) : null}

      {/* ── Create Task ───────────────────────────────────────────────────── */}
      {type === 'CREATE_TASK' ? (
        <div className="space-y-3 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Task Title
            </Label>
            <SlashInput
              value={params.taskTitle ?? ''}
              onChange={(val) => onChange({ taskTitle: val })}
              placeholder="Follow up with {{CONTACT_NAME}}"
              className="h-8 bg-background border-border rounded-lg text-xs px-2"
            />
            <VariableHint />
          </div>

          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Task Description
            </Label>
            <SlashTextarea
              value={params.taskDescription ?? ''}
              onChange={(val) => onChange({ taskDescription: val })}
              placeholder={
                'Agreed action from call on {{CALL_DATE}}:\n• {{OUTCOME}}\n• Client prefers contact via {{PREFERRED_CHANNEL}}'
              }
              rows={3}
              className="bg-background border-border rounded-xl text-xs p-2 resize-none"
            />
            <VariableHint />
          </div>

          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Priority
            </Label>
            <Select
              value={params.taskPriority ?? 'medium'}
              onValueChange={(val) =>
                onChange({ taskPriority: val as 'low' | 'medium' | 'high' })
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

          <DueDateField
            mode={taskDueDateMode}
            dueDays={taskDueDays}
            dueSpecificDate={taskDueSpecificDate}
            dueTimeOfDay={taskDueTimeOfDay}
            onModeChange={(m) => onChange({ taskDueDateMode: m })}
            onDueDaysChange={(d) => onChange({ taskDueDays: d })}
            onDueSpecificDateChange={(dt) => onChange({ taskDueSpecificDate: dt })}
            onDueTimeOfDayChange={(t) => onChange({ taskDueTimeOfDay: t })}
          />

          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Assign To
            </Label>
            <Select
              value={params.taskAssigneeMode ?? 'caller'}
              onValueChange={(val) =>
                onChange({
                  taskAssigneeMode: val as 'caller' | 'specific' | 'round_robin',
                  taskAssigneeId: val === 'specific' ? params.taskAssigneeId : undefined,
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

          {params.taskAssigneeMode === 'specific' && (
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                Select User
              </Label>
              <Select
                value={toSelectValue(params.taskAssigneeId)}
                onValueChange={(val) => onChange({ taskAssigneeId: fromSelectValue(val) })}
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
              {params.taskAssigneeId && (() => {
                const u = workspaceUsers.find((x) => x.id === params.taskAssigneeId);
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

      {/* ── Change Stage (grouped by pipeline) ────────────────────────────── */}
      {type === 'CHANGE_STAGE' ? (
        <div className="space-y-1 transition-opacity duration-200">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            Target Pipeline Stage
          </Label>
          <Select
            value={toSelectValue(params.stageId)}
            onValueChange={(val) => {
              const stageId = fromSelectValue(val);
              const stage = stages.find((s) => s.id === stageId);
              onChange({ stageId, pipelineId: stage?.pipelineId });
            }}
          >
            <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
              <SelectValue placeholder="Select stage..." />
            </SelectTrigger>
            <SelectContent>
              {stages.length > 0 ? (
                stagesByPipeline.map((group, gi) => (
                  <SelectGroup key={gi}>
                    <SelectLabel className="text-[8px] uppercase text-muted-foreground/70">
                      {group.pipelineName}
                    </SelectLabel>
                    {group.stages.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
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

      {/* ── Add to Pipeline & Stage ───────────────────────────────────────── */}
      {type === 'ADD_TO_PIPELINE' ? (
        <div className="space-y-2 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Pipeline
            </Label>
            <Select
              value={toSelectValue(params.pipelineId)}
              onValueChange={(val) =>
                onChange({ pipelineId: fromSelectValue(val), stageId: undefined })
              }
            >
              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                <SelectValue placeholder="Select pipeline..." />
              </SelectTrigger>
              <SelectContent>
                {pipelines.length > 0 ? (
                  pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={NONE_SENTINEL} disabled>
                    No pipelines found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Stage
            </Label>
            <Select
              value={toSelectValue(params.stageId)}
              onValueChange={(val) => onChange({ stageId: fromSelectValue(val) })}
              disabled={!params.pipelineId}
            >
              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                <SelectValue placeholder={params.pipelineId ? 'Select stage...' : 'Pick a pipeline first'} />
              </SelectTrigger>
              <SelectContent>
                {stagesForSelectedPipeline.length > 0 ? (
                  stagesForSelectedPipeline.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={NONE_SENTINEL} disabled>
                    No stages in this pipeline
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {/* ── Add Tag / Remove Tag ──────────────────────────────────────────── */}
      {type === 'ADD_TAG' || type === 'REMOVE_TAG' ? (
        <div className="space-y-1 transition-opacity duration-200">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            {type === 'ADD_TAG' ? 'Tag to Add' : 'Tag to Remove'}
          </Label>
          <Select
            value={toSelectValue(params.tagId)}
            onValueChange={(val) => onChange({ tagId: fromSelectValue(val) })}
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
      {type === 'WEBHOOK' ? (
        <div className="space-y-3 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Webhook Target URL
            </Label>
            <Input
              value={params.webhookUrl ?? ''}
              onChange={(e) => onChange({ webhookUrl: e.target.value })}
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
              value={params.webhookMethod ?? 'POST'}
              onValueChange={(val) => onChange({ webhookMethod: val as 'POST' | 'GET' | 'PUT' })}
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
              value={params.webhookHeaders ?? ''}
              onChange={(e) => onChange({ webhookHeaders: e.target.value })}
              onKeyDown={stopSlashPropagation}
              placeholder='{ "Authorization": "Bearer key" }'
              rows={2}
              className="bg-background border-border rounded-xl text-xs p-2 resize-none"
            />
          </div>
        </div>
      ) : null}

      {/* ── Log Note ──────────────────────────────────────────────────────── */}
      {type === 'LOG_NOTE' ? (
        <div className="space-y-1 transition-opacity duration-200">
          <Label className="text-[8px] font-bold text-muted-foreground uppercase">
            Note Content
          </Label>
          <SlashTextarea
            value={params.noteContent ?? ''}
            onChange={(val) => onChange({ noteContent: val })}
            placeholder="Agent logged: {{OUTCOME}} for {{CONTACT_NAME}}..."
            rows={3}
            className="bg-background border-border rounded-xl text-xs p-2 resize-none"
          />
          <VariableHint />
        </div>
      ) : null}

      {/* ── Schedule Meeting (guest-list vs create mode) ──────────────────── */}
      {type === 'SCHEDULE_MEETING' ? (
        <div className="space-y-2 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Meeting Action
            </Label>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={meetingMode === 'guest_list' ? 'default' : 'outline'}
                className="h-7 text-[9px] flex-1 gap-1 active:scale-[0.97] transition-transform"
                onClick={() => onChange({ meetingMode: 'guest_list' })}
              >
                <UserPlus className="h-3 w-3" />
                Add to meeting
              </Button>
              <Button
                type="button"
                size="sm"
                variant={meetingMode === 'create' ? 'default' : 'outline'}
                className="h-7 text-[9px] flex-1 gap-1 active:scale-[0.97] transition-transform"
                onClick={() => onChange({ meetingMode: 'create' })}
              >
                <CalendarPlus className="h-3 w-3" />
                Create new
              </Button>
            </div>
          </div>

          {meetingMode === 'guest_list' ? (
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                Add Contact to Meeting
              </Label>
              <Select
                value={toSelectValue(params.meetingId)}
                onValueChange={(val) => onChange({ meetingId: fromSelectValue(val) })}
              >
                <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                  <SelectValue placeholder="Select an active meeting..." />
                </SelectTrigger>
                <SelectContent>
                  {activeMeetings.length > 0 ? (
                    activeMeetings.map((mt) => (
                      <SelectItem key={mt.id} value={mt.id}>
                        {mt.title}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={NONE_SENTINEL} disabled>
                      No upcoming meetings found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                Meeting Type
              </Label>
              <Select
                value={toSelectValue(params.meetingTypeId)}
                onValueChange={(val) => onChange({ meetingTypeId: fromSelectValue(val) })}
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
          )}
        </div>
      ) : null}

      {/* ── Transfer to another Call Campaign ─────────────────────────────── */}
      {type === 'ADD_TO_CALL_CAMPAIGN' ? (
        <div className="space-y-2 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Transfer to Campaign
            </Label>
            <Select
              value={toSelectValue(params.campaignId)}
              onValueChange={(val) => onChange({ campaignId: fromSelectValue(val) })}
            >
              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                <SelectValue placeholder="Select a call campaign..." />
              </SelectTrigger>
              <SelectContent>
                {callCampaigns.length > 0 ? (
                  callCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={NONE_SENTINEL} disabled>
                    No other campaigns found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Contact Scope
            </Label>
            <Select
              value={params.contactScope ?? 'primary'}
              onValueChange={(val) => onChange({ contactScope: val as 'primary' | 'all' })}
            >
              <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary contact only</SelectItem>
                <SelectItem value="all">All contacts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {/* ── Transfer Call (phone / agent / campaign) ──────────────────────── */}
      {type === 'TRANSFER_CALL' ? (
        <div className="space-y-3 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Transfer Mode
            </Label>
            <Select
              value={params.transferMode ?? 'phone'}
              onValueChange={(val) => onChange({ transferMode: val as 'phone' | 'agent' | 'campaign' })}
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
          {params.transferMode === 'campaign' ? (
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                Campaign
              </Label>
              <Select
                value={toSelectValue(params.campaignId)}
                onValueChange={(val) => onChange({ campaignId: fromSelectValue(val) })}
              >
                <SelectTrigger className="h-8 bg-background border-border rounded-lg text-xs">
                  <SelectValue placeholder="Select a call campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {callCampaigns.length > 0 ? (
                    callCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={NONE_SENTINEL} disabled>
                      No other campaigns found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-[8px] font-bold text-muted-foreground uppercase">
                {params.transferMode === 'agent' ? 'Agent / Extension ID' : 'Phone Number'}
              </Label>
              <Input
                value={params.transferTarget ?? ''}
                onChange={(e) => onChange({ transferTarget: e.target.value })}
                onKeyDown={stopSlashPropagation}
                placeholder={params.transferMode === 'agent' ? 'agent_id or ext 200' : '+1 (555) 000-0000'}
                className="h-8 bg-background border-border rounded-lg text-xs px-2"
              />
            </div>
          )}
        </div>
      ) : null}

      {/* ── Update Contact ────────────────────────────────────────────────── */}
      {type === 'UPDATE_CONTACT' ? (
        <div className="space-y-3 transition-opacity duration-200">
          <div className="space-y-1">
            <Label className="text-[8px] font-bold text-muted-foreground uppercase">
              Contact Name
            </Label>
            <Input
              value={params.contactName ?? ''}
              onChange={(e) => onChange({ contactName: e.target.value })}
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
              value={params.contactEmail ?? ''}
              onChange={(e) => onChange({ contactEmail: e.target.value })}
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
              value={params.contactPhone ?? ''}
              onChange={(e) => onChange({ contactPhone: e.target.value })}
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
          value={params.triggerDelaySeconds ?? 0}
          onChange={(e) => onChange({ triggerDelaySeconds: Number(e.target.value) || 0 })}
          onKeyDown={stopSlashPropagation}
          className="h-8 bg-background border-border rounded-lg text-xs px-2"
          aria-label="Trigger delay in seconds"
        />
      </div>
    </div>
  );
});

ActionConfigFields.displayName = 'ActionConfigFields';

export { ActionConfigFields };

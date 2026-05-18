'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { MessagingTemplateSelector } from '@/app/admin/components/MessagingTemplateSelector';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import {
  Mail,
  Smartphone,
  Bell,
  UserCheck,
  Users,
  Clock,
  Send,
  Plus,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import ReminderSlotRow from './ReminderSlotRow';
import { MessagingChannelBlock } from './MessagingChannelBlock';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { MeetingMessagingConfig, MeetingReminderSlot } from '@/lib/types';

// ─── Default Config ──────────────────────────────────────────────
const DEFAULT_CONFIG: MeetingMessagingConfig = {
  registrationAckEnabled: false,
  registrationAckChannels: ['email'],
  facilitatorRemindersEnabled: false,
  facilitatorPostEventEnabled: false,
  facilitatorChannels: ['email'],
  reminders: [],
  postEventEnabled: false,
  postEventDelayMinutes: 60,
  postEventAudience: 'attendees_only',
  postEventChannels: ['email'],
  postEventAbsenteeEnabled: false,
};

// ─── Main Component ──────────────────────────────────────────────
export default function MeetingMessagingTab() {
  const { watch, setValue } = useFormContext();
  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'workspace_users'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: workspaceUsers } = useCollection<any>(usersQuery);

  const userOptions = React.useMemo(() => {
    const sortedUsers = [...(workspaceUsers || [])].sort((a: any, b: any) => 
      (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')
    );
    return sortedUsers.map((u: any) => ({
      label: u.displayName || u.email || 'Unknown',
      value: u.userId || u.id,
    }));
  }, [workspaceUsers]);

  // Get messaging config from form, defaulting if absent
  const rawConfig = watch('messagingConfig') || {};
  const config: MeetingMessagingConfig = {
    ...DEFAULT_CONFIG,
    ...rawConfig,
    reminders: rawConfig.reminders || DEFAULT_CONFIG.reminders,
    registrationAckChannels: rawConfig.registrationAckChannels || DEFAULT_CONFIG.registrationAckChannels,
    facilitatorChannels: rawConfig.facilitatorChannels || DEFAULT_CONFIG.facilitatorChannels,
    postEventChannels: rawConfig.postEventChannels || DEFAULT_CONFIG.postEventChannels,
  };

  const updateConfig = React.useCallback(<K extends keyof MeetingMessagingConfig>(
    key: K,
    value: MeetingMessagingConfig[K]
  ) => {
    setValue('messagingConfig', { ...config, [key]: value }, { shouldDirty: true });
  }, [config, setValue]);



  const warnings = React.useMemo(() => {
    const hasAckWarning = config.registrationAckEnabled && (
      (config.registrationAckChannels.includes('email') && !config.registrationAckEmailTemplateId) ||
      (config.registrationAckChannels.includes('sms') && !config.registrationAckSmsTemplateId)
    );

    const hasFacilitatorWarning = (
      (config.facilitatorRemindersEnabled && (
        (config.facilitatorChannels.includes('email') && !config.facilitatorRemindersEmailTemplateId) ||
        (config.facilitatorChannels.includes('sms') && !config.facilitatorRemindersSmsTemplateId)
      )) ||
      (config.facilitatorPostEventEnabled && (
        (config.facilitatorChannels.includes('email') && !config.facilitatorPostEventEmailTemplateId) ||
        (config.facilitatorChannels.includes('sms') && !config.facilitatorPostEventSmsTemplateId)
      ))
    );

    const hasRemindersWarning = config.reminders.some(r =>
      r.enabled && (
        (r.channels.includes('email') && !r.emailTemplateId) ||
        (r.channels.includes('sms') && !r.smsTemplateId)
      )
    );

    const hasPostEventWarning = config.postEventEnabled && (
      ((config.postEventChannels.includes('email') && !config.postEventEmailTemplateId) ||
       (config.postEventChannels.includes('sms') && !config.postEventSmsTemplateId)) ||
      (config.postEventAbsenteeEnabled && (
        (config.postEventChannels.includes('email') && !config.postEventAbsenteeEmailTemplateId) ||
        (config.postEventChannels.includes('sms') && !config.postEventAbsenteeSmsTemplateId)
      ))
    );

    return {
      ack: hasAckWarning,
      facilitators: hasFacilitatorWarning,
      reminders: hasRemindersWarning,
      postEvent: hasPostEventWarning,
    };
  }, [config]);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    ack: true,
    facilitators: false,
    reminders: false,
    postEvent: false,
  });

  const toggleSection = React.useCallback((id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Reminder slot management ──
  const handleAddReminder = React.useCallback(() => {
    const newSlot: MeetingReminderSlot = {
      id: `reminder_${Date.now()}`,
      offsetMinutes: 60,
      offsetLabel: '1 hour before',
      channels: ['email'],
      enabled: true,
    };
    updateConfig('reminders', [...config.reminders, newSlot]);
  }, [config.reminders, updateConfig]);

  const handleUpdateReminder = React.useCallback((index: number, updated: MeetingReminderSlot) => {
    const reminders = [...config.reminders];
    reminders[index] = updated;
    updateConfig('reminders', reminders);
  }, [config.reminders, updateConfig]);

  const handleRemoveReminder = React.useCallback((index: number) => {
    const reminders = config.reminders.filter((_, i) => i !== index);
    updateConfig('reminders', reminders);
  }, [config.reminders, updateConfig]);



  return (
    <div className="space-y-4">
      {/* ── Section 1: Registration Acknowledgement ── */}
      <CollapsibleSection
        id="ack"
        title="Registration Acknowledgement"
        description="Auto-send to registrants after signup"
        icon={<UserCheck className="h-4 w-4 text-emerald-600" />}
        iconBg="bg-emerald-500/10"
        isOpen={openSections.ack}
        onToggle={() => toggleSection('ack')}
        badge={config.registrationAckEnabled ? 'Active' : undefined}
        hasWarning={warnings.ack}
      >
        <MessagingChannelBlock
          enableLabel="Enable Acknowledgement"
          enabled={config.registrationAckEnabled}
          onEnabledChange={(v) => updateConfig('registrationAckEnabled', v)}
          channels={config.registrationAckChannels}
          onChannelsChange={(v) => updateConfig('registrationAckChannels', v)}
          category="meetings"
          recipientType="external_alert"
          templateTypePrefix="meeting_registration_ack"
          emailValue={config.registrationAckEmailTemplateId || ''}
          onEmailChange={(v) => updateConfig('registrationAckEmailTemplateId', v)}
          smsValue={config.registrationAckSmsTemplateId || ''}
          onSmsChange={(v) => updateConfig('registrationAckSmsTemplateId', v)}
        />
      </CollapsibleSection>

      {/* ── Section 2: Facilitator Alerts ── */}
      <CollapsibleSection
        id="facilitators"
        title="Facilitator Alerts"
        description="Notify internal team members"
        icon={<Users className="h-4 w-4 text-violet-600" />}
        iconBg="bg-violet-500/10"
        isOpen={openSections.facilitators}
        onToggle={() => toggleSection('facilitators')}
        badge={watch('facilitators')?.length > 0 ? `${watch('facilitators').length} assigned` : undefined}
        hasWarning={warnings.facilitators}
      >
        <div className="space-y-4">
          {(!watch('facilitators') || watch('facilitators').length === 0) && (
            <div className="p-3 bg-muted/30 border rounded-xl text-xs text-muted-foreground mb-4">
              <span className="font-bold">No facilitators assigned.</span> You can assign facilitators in the Configuration tab.
            </div>
          )}

          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-1">
              {(['email', 'sms'] as const).map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    const set = new Set(config.facilitatorChannels);
                    set.has(ch) ? set.delete(ch) : set.add(ch);
                    updateConfig('facilitatorChannels', Array.from(set) as ('email' | 'sms')[]);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1",
                    config.facilitatorChannels.includes(ch)
                      ? ch === 'email' ? "bg-blue-500/10 text-blue-600" : "bg-green-500/10 text-green-600"
                      : "bg-muted/20 text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                >
                  {ch === 'email' ? <Mail className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                  {ch}
                </button>
              ))}
            </div>

            <div className="p-4 bg-muted/20 rounded-xl border space-y-4">
              <MessagingChannelBlock
                enableLabel="Pre-Event Reminders"
                enabled={config.facilitatorRemindersEnabled}
                onEnabledChange={(v) => updateConfig('facilitatorRemindersEnabled', v)}
                channels={config.facilitatorChannels}
                onChannelsChange={() => {}}
                category="meetings"
                recipientType="internal_alert"
                templateTypePrefix="meeting_facilitator_pre_event"
                emailValue={config.facilitatorRemindersEmailTemplateId || ''}
                onEmailChange={(v) => updateConfig('facilitatorRemindersEmailTemplateId', v)}
                smsValue={config.facilitatorRemindersSmsTemplateId || ''}
                onSmsChange={(v) => updateConfig('facilitatorRemindersSmsTemplateId', v)}
                placeholderEmail="Select pre-event template..."
                showChannelsToggle={false}
              />
            </div>

            <div className="p-4 bg-muted/20 rounded-xl border space-y-4">
              <MessagingChannelBlock
                enableLabel="Post-Event Debrief"
                enabled={config.facilitatorPostEventEnabled}
                onEnabledChange={(v) => updateConfig('facilitatorPostEventEnabled', v)}
                channels={config.facilitatorChannels}
                onChannelsChange={() => {}}
                category="meetings"
                recipientType="internal_alert"
                templateTypePrefix="meeting_facilitator_post_event"
                emailValue={config.facilitatorPostEventEmailTemplateId || ''}
                onEmailChange={(v) => updateConfig('facilitatorPostEventEmailTemplateId', v)}
                smsValue={config.facilitatorPostEventSmsTemplateId || ''}
                onSmsChange={(v) => updateConfig('facilitatorPostEventSmsTemplateId', v)}
                placeholderEmail="Select debrief template..."
                showChannelsToggle={false}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Section 3: Pre-Event Reminders ── */}
      <CollapsibleSection
        id="reminders"
        title="Pre-Event Reminders"
        description="Automated reminders to registrants"
        icon={<Clock className="h-4 w-4 text-blue-600" />}
        iconBg="bg-blue-500/10"
        isOpen={openSections.reminders}
        onToggle={() => toggleSection('reminders')}
        badge={config.reminders.filter(r => r.enabled).length > 0
          ? `${config.reminders.filter(r => r.enabled).length} active`
          : undefined
        }
        hasWarning={warnings.reminders}
      >
        <div className="space-y-3">
          {config.reminders.length > 0 ? (
            config.reminders.map((slot, index) => (
              <ReminderSlotRow
                key={slot.id}
                slot={slot}
                index={index}
                onChange={handleUpdateReminder}
                onRemove={handleRemoveReminder}
              />
            ))
          ) : (
            <p className="text-[10px] text-muted-foreground/50 italic py-4 text-center">
              No custom reminders configured yet.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddReminder}
            className="w-full h-9 rounded-xl text-[10px] font-bold gap-1 border-dashed"
          >
            <Plus className="h-3 w-3" /> Add Reminder Slot
          </Button>

          {/* Quick-add presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[9px] font-semibold text-muted-foreground/50 self-center mr-1">Quick:</span>
            {[
              { label: '15 min', offset: 15 },
              { label: '1 hour', offset: 60 },
              { label: '1 day', offset: 1440 },
              { label: '2 days', offset: 2880 },
            ].map(preset => {
              const exists = config.reminders.some(r => r.offsetMinutes === preset.offset);
              return (
                <button
                  key={preset.offset}
                  type="button"
                  disabled={exists}
                  onClick={() => {
                    const newSlot: MeetingReminderSlot = {
                      id: `reminder_${preset.offset}_${Date.now()}`,
                      offsetMinutes: preset.offset,
                      offsetLabel: `${preset.label} before`,
                      channels: ['email'],
                      enabled: true,
                    };
                    updateConfig('reminders', [...config.reminders, newSlot]);
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors",
                    exists
                      ? "bg-muted text-muted-foreground/30 cursor-not-allowed"
                      : "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Section 4: Post-Event Follow-Up ── */}
      <CollapsibleSection
        id="postEvent"
        title="Post-Event Follow-Up"
        description="Automated follow-up after the meeting"
        icon={<Send className="h-4 w-4 text-amber-600" />}
        iconBg="bg-amber-500/10"
        isOpen={openSections.postEvent}
        onToggle={() => toggleSection('postEvent')}
        badge={config.postEventEnabled ? 'Active' : undefined}
        hasWarning={warnings.postEvent}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold">Enable Follow-Up</Label>
            <Switch
              checked={config.postEventEnabled}
              onCheckedChange={(v) => updateConfig('postEventEnabled', v)}
            />
          </div>

          {config.postEventEnabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground/60">Delay After Event</Label>
                  <Select
                    value={String(config.postEventDelayMinutes)}
                    onValueChange={(v) => updateConfig('postEventDelayMinutes', Number(v))}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-muted/20 border-none text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="1440">1 day</SelectItem>
                      <SelectItem value="2880">2 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground/60">Audience</Label>
                  <Select
                    value={config.postEventAudience}
                    onValueChange={(v) => updateConfig('postEventAudience', v as 'all_registrants' | 'attendees_only')}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-muted/20 border-none text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="attendees_only">Attendees Only</SelectItem>
                      <SelectItem value="all_registrants">All Registrants</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <MessagingChannelBlock
                enableLabel="Enable Templates"
                enabled={true}
                onEnabledChange={() => {}}
                channels={config.postEventChannels}
                onChannelsChange={(v) => updateConfig('postEventChannels', v)}
                category="meetings"
                recipientType="external_alert"
                templateTypePrefix="meeting_post_event_thankyou"
                emailValue={config.postEventEmailTemplateId || ''}
                onEmailChange={(v) => updateConfig('postEventEmailTemplateId', v)}
                smsValue={config.postEventSmsTemplateId || ''}
                onSmsChange={(v) => updateConfig('postEventSmsTemplateId', v)}
                placeholderEmail="Select follow-up template..."
                placeholderSms="Select follow-up SMS..."
                hideSwitch={true}
              />

              {/* ── Absentee Follow-Up Sub-Section ── */}
              <div className="p-4 bg-muted/20 rounded-xl border space-y-4 mt-4">
                <MessagingChannelBlock
                  enableLabel="Absentee Follow-Up"
                  enabled={config.postEventAbsenteeEnabled}
                  onEnabledChange={(v) => updateConfig('postEventAbsenteeEnabled', v)}
                  channels={config.postEventChannels}
                  onChannelsChange={() => {}}
                  category="meetings"
                  recipientType="external_alert"
                  templateTypePrefix="meeting_post_event_absentee"
                  emailValue={config.postEventAbsenteeEmailTemplateId || ''}
                  onEmailChange={(v) => updateConfig('postEventAbsenteeEmailTemplateId', v)}
                  smsValue={config.postEventAbsenteeSmsTemplateId || ''}
                  onSmsChange={(v) => updateConfig('postEventAbsenteeSmsTemplateId', v)}
                  placeholderEmail="Select absentee template..."
                  placeholderSms="Select absentee SMS..."
                  showChannelsToggle={false}
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ─── Collapsible Section (hoisted per rerender-no-inline-components) ───

interface CollapsibleSectionProps {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  hasWarning?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  id,
  title,
  description,
  icon,
  iconBg,
  isOpen,
  onToggle,
  badge,
  hasWarning,
  children,
}: CollapsibleSectionProps) {
  return (
    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
      <CardHeader
        className="bg-muted/30 border-b pb-4 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl", iconBg)}>{icon}</div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                {title}
                {badge && (
                  <Badge variant="secondary" className="text-[8px] font-bold px-1.5 py-0 rounded-full">
                    {badge}
                  </Badge>
                )}
                {hasWarning && (
                  <TooltipProvider>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <div onClick={(e) => e.stopPropagation()}>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-bounce shrink-0 cursor-help" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center" className="w-60 p-3 rounded-2xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
                        <p className="text-[10px] font-bold leading-normal text-amber-600/90 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Action Required
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-1.5 leading-relaxed">
                          You have enabled active channels (Email or SMS) but have not selected their template blueprints.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </CardTitle>
              <CardDescription className="text-[10px] font-medium text-left">{description}</CardDescription>
            </div>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="p-6 bg-background animate-in fade-in slide-in-from-top-2">
          {children}
        </CardContent>
      )}
    </Card>
  );
}



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
import { fetchTemplatesCached } from '@/app/admin/components/template-cache-manager';
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
import { DateTimePicker, TimePicker } from '@/components/ui/datetime-picker';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { MeetingMessagingConfig, MeetingReminderSlot, MeetingInvitationSlot } from '@/lib/types';
import { DEFAULT_GLOBAL_INVITATION_TEMPLATE_ID, getDefaultMeetingMessagingConfig } from '@/lib/types';

// ─── Default Config ──────────────────────────────────────────────
const DEFAULT_CONFIG = getDefaultMeetingMessagingConfig();

const getMeetingTimeAsDate = (mTime: any): Date => {
  if (!mTime) return new Date();
  if (mTime instanceof Date) return mTime;
  return new Date(mTime);
};

// ─── Main Component ──────────────────────────────────────────────
export default function MeetingMessagingTab() {
  const { watch, setValue } = useFormContext();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const firestore = useFirestore();

  const watchedMeetingTime = watch('meetingTime');
  const lastMeetingTimeRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!watchedMeetingTime) return;
    const mDate = getMeetingTimeAsDate(watchedMeetingTime);
    const hours = String(mDate.getHours()).padStart(2, '0');
    const minutes = String(mDate.getMinutes()).padStart(2, '0');
    const defaultTimeStr = `${hours}:${minutes}`;
    const defaultDateStr = mDate.toISOString();

    const lastMeetingTime = lastMeetingTimeRef.current;
    lastMeetingTimeRef.current = defaultDateStr;

    let oldTimeStr = '';
    let oldDateStr = '';
    if (lastMeetingTime) {
      const oldDate = new Date(lastMeetingTime);
      const oldHours = String(oldDate.getHours()).padStart(2, '0');
      const oldMinutes = String(oldDate.getMinutes()).padStart(2, '0');
      oldTimeStr = `${oldHours}:${oldMinutes}`;
      oldDateStr = lastMeetingTime;
    }

    const currentSeries = watch('messagingConfig.invitationSeries') || DEFAULT_CONFIG.invitationSeries;
    let changed = false;
    const updated = currentSeries.map((slot: any) => {
      const slotCopy = { ...slot };
      if (slot.id === 'initial') {
        if (!slot.emailScheduledDate || slot.emailScheduledDate === oldDateStr) {
          slotCopy.emailScheduledDate = defaultDateStr;
          changed = true;
        }
        if (!slot.smsScheduledDate || slot.smsScheduledDate === oldDateStr) {
          slotCopy.smsScheduledDate = defaultDateStr;
          changed = true;
        }
      } else {
        if (!slot.emailScheduledTime || slot.emailScheduledTime === oldTimeStr) {
          slotCopy.emailScheduledTime = defaultTimeStr;
          changed = true;
        }
        if (!slot.smsScheduledTime || slot.smsScheduledTime === oldTimeStr) {
          slotCopy.smsScheduledTime = defaultTimeStr;
          changed = true;
        }
      }
      return slotCopy;
    });

    if (changed) {
      setValue('messagingConfig.invitationSeries', updated, { shouldDirty: true });
    }
  }, [watchedMeetingTime, setValue]);

  // Background-pre-fetch templates as soon as tab resolves workspace/organization context
  React.useEffect(() => {
    if (activeWorkspaceId) {
      fetchTemplatesCached('email', activeWorkspaceId, activeOrganizationId);
      fetchTemplatesCached('sms', activeWorkspaceId, activeOrganizationId);
    }
  }, [activeWorkspaceId, activeOrganizationId]);

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
    invitationSeries: rawConfig.invitationSeries || DEFAULT_CONFIG.invitationSeries,
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

  const updateConfigs = React.useCallback((updates: Partial<MeetingMessagingConfig>) => {
    setValue('messagingConfig', { ...config, ...updates }, { shouldDirty: true });
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

    const hasInvitationsWarning = config.invitationsEnabled && config.invitationSeries.some(inv => 
      inv.enabled && (
        (inv.channels.includes('email') && !inv.emailTemplateId) ||
        (inv.channels.includes('sms') && !inv.smsTemplateId)
      )
    );

    const hasRescheduleWarning = config.rescheduleEnabled && (
      (config.rescheduleChannels.includes('email') && (!config.rescheduleEmailTemplateId || !config.rescheduleFacilitatorEmailTemplateId || !config.rescheduleRegistrantEmailTemplateId)) ||
      (config.rescheduleChannels.includes('sms') && (!config.rescheduleSmsTemplateId || !config.rescheduleFacilitatorSmsTemplateId || !config.rescheduleRegistrantSmsTemplateId))
    );

    const hasCancelWarning = config.cancelEnabled && (
      (config.cancelChannels.includes('email') && (!config.cancelEmailTemplateId || !config.cancelFacilitatorEmailTemplateId || !config.cancelRegistrantEmailTemplateId)) ||
      (config.cancelChannels.includes('sms') && (!config.cancelSmsTemplateId || !config.cancelFacilitatorSmsTemplateId || !config.cancelRegistrantSmsTemplateId))
    );

    return {
      ack: hasAckWarning,
      facilitators: hasFacilitatorWarning,
      reminders: hasRemindersWarning,
      postEvent: hasPostEventWarning,
      invitations: hasInvitationsWarning,
      reschedule: hasRescheduleWarning,
      cancel: hasCancelWarning,
    };
  }, [config]);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    invitations: true,
    ack: false,
    facilitators: false,
    reminders: false,
    postEvent: false,
    reschedule: false,
    cancel: false,
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
      {/* ── Section 0: Invitation Series ── */}
      <CollapsibleSection
        id="invitations"
        title="Invitation Series"
        description="Automated invitations to pending records"
        icon={<Mail className="h-4 w-4 text-purple-600" />}
        iconBg="bg-purple-500/10"
        isOpen={openSections.invitations}
        onToggle={() => toggleSection('invitations')}
        badge={config.invitationsEnabled ? `${config.invitationSeries.filter(r => r.enabled).length} active` : undefined}
        hasWarning={warnings.invitations}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold">Enable Invitation Series</Label>
            <Switch
              checked={config.invitationsEnabled}
              onCheckedChange={(v) => updateConfig('invitationsEnabled', v)}
            />
          </div>

          {config.invitationsEnabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              {config.invitationSeries.map((inv, index) => (
                <div key={inv.id} className="p-4 bg-muted/20 rounded-xl border space-y-4">
                  <MessagingChannelBlock
                    enableLabel={inv.label}
                    enabled={inv.enabled}
                    onEnabledChange={(v) => {
                      const updated = [...config.invitationSeries];
                      updated[index].enabled = v;
                      if (v) {
                        // Automatically assign default template IDs for enabled channels if not set
                        if (updated[index].channels.includes('email') && !updated[index].emailTemplateId) {
                          updated[index].emailTemplateId = `global_meeting_invitation_${inv.id}_email`;
                        }
                        if (updated[index].channels.includes('sms') && !updated[index].smsTemplateId) {
                          updated[index].smsTemplateId = `global_meeting_invitation_${inv.id}_sms`;
                        }

                        // Intelligently default scheduled date/time based on meeting time
                        const mTime = watch('meetingTime');
                        const mDate = getMeetingTimeAsDate(mTime);
                        if (inv.id === 'initial') {
                          if (updated[index].channels.includes('email') && !updated[index].emailScheduledDate) {
                            updated[index].emailScheduledDate = mDate.toISOString();
                          }
                          if (updated[index].channels.includes('sms') && !updated[index].smsScheduledDate) {
                            updated[index].smsScheduledDate = mDate.toISOString();
                          }
                        } else {
                          const hours = String(mDate.getHours()).padStart(2, '0');
                          const minutes = String(mDate.getMinutes()).padStart(2, '0');
                          const defaultTime = `${hours}:${minutes}`;
                          if (updated[index].channels.includes('email') && !updated[index].emailScheduledTime) {
                            updated[index].emailScheduledTime = defaultTime;
                          }
                          if (updated[index].channels.includes('sms') && !updated[index].smsScheduledTime) {
                            updated[index].smsScheduledTime = defaultTime;
                          }
                        }
                      }
                      updateConfig('invitationSeries', updated);
                    }}
                    channels={inv.channels}
                    onChannelsChange={(v) => {
                      const updated = [...config.invitationSeries];
                      updated[index].channels = v;
                      // Automatically assign default template ID for newly added channels
                      if (v.includes('email') && !updated[index].emailTemplateId) {
                        updated[index].emailTemplateId = `global_meeting_invitation_${inv.id}_email`;
                      }
                      if (v.includes('sms') && !updated[index].smsTemplateId) {
                        updated[index].smsTemplateId = `global_meeting_invitation_${inv.id}_sms`;
                      }

                      // Intelligently default scheduled date/time based on meeting time for newly added channels
                      const mTime = watch('meetingTime');
                      const mDate = getMeetingTimeAsDate(mTime);
                      if (inv.id === 'initial') {
                        if (v.includes('email') && !updated[index].emailScheduledDate) {
                          updated[index].emailScheduledDate = mDate.toISOString();
                        }
                        if (v.includes('sms') && !updated[index].smsScheduledDate) {
                          updated[index].smsScheduledDate = mDate.toISOString();
                        }
                      } else {
                        const hours = String(mDate.getHours()).padStart(2, '0');
                        const minutes = String(mDate.getMinutes()).padStart(2, '0');
                        const defaultTime = `${hours}:${minutes}`;
                        if (v.includes('email') && !updated[index].emailScheduledTime) {
                          updated[index].emailScheduledTime = defaultTime;
                        }
                        if (v.includes('sms') && !updated[index].smsScheduledTime) {
                          updated[index].smsScheduledTime = defaultTime;
                        }
                      }
                      updateConfig('invitationSeries', updated);
                    }}
                    category="meetings"
                    recipientType="external_alert"
                    templateTypePrefix="meeting_invitation"
                    emailValue={inv.emailTemplateId || ''}
                    onEmailChange={(v) => {
                      const updated = [...config.invitationSeries];
                      updated[index].emailTemplateId = v;
                      updateConfig('invitationSeries', updated);
                    }}
                    smsValue={inv.smsTemplateId || ''}
                    onSmsChange={(v) => {
                      const updated = [...config.invitationSeries];
                      updated[index].smsTemplateId = v;
                      updateConfig('invitationSeries', updated);
                    }}
                    placeholderEmail={`Select ${inv.label} template...`}
                    placeholderSms={`Select ${inv.label} SMS...`}
                  >
                    {inv.enabled && (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Email Schedule */}
                          {inv.channels.includes('email') && (
                            <div className="space-y-1.5">
                              {inv.id === 'initial' ? (
                                <>
                                  <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-blue-500" /> Email Send Date &amp; Time
                                  </Label>
                                  <DateTimePicker
                                    value={inv.emailScheduledDate ? new Date(inv.emailScheduledDate) : undefined}
                                    onChange={(date) => {
                                      const updated = [...config.invitationSeries];
                                      updated[index].emailScheduledDate = date ? date.toISOString() : undefined;
                                      updateConfig('invitationSeries', updated);
                                    }}
                                  />
                                  <p className="text-[9px] text-muted-foreground/60 italic">Defaults to session start time.</p>
                                </>
                              ) : (
                                <>
                                  <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-blue-500" /> Email Send Time (Local)
                                  </Label>
                                  <TimePicker
                                    value={inv.emailScheduledTime}
                                    onChange={(time) => {
                                      const updated = [...config.invitationSeries];
                                      updated[index].emailScheduledTime = time;
                                      updateConfig('invitationSeries', updated);
                                    }}
                                  />
                                  <p className="text-[9px] text-muted-foreground/60 italic">Defaults to session start time.</p>
                                </>
                              )}
                            </div>
                          )}

                          {/* SMS Schedule */}
                          {inv.channels.includes('sms') && (
                            <div className="space-y-1.5">
                              {inv.id === 'initial' ? (
                                <>
                                  <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-green-600" /> SMS Send Date &amp; Time
                                  </Label>
                                  <DateTimePicker
                                    value={inv.smsScheduledDate ? new Date(inv.smsScheduledDate) : undefined}
                                    onChange={(date) => {
                                      const updated = [...config.invitationSeries];
                                      updated[index].smsScheduledDate = date ? date.toISOString() : undefined;
                                      updateConfig('invitationSeries', updated);
                                    }}
                                  />
                                  <p className="text-[9px] text-muted-foreground/60 italic">Defaults to session start time.</p>
                                </>
                              ) : (
                                <>
                                  <Label className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-green-600" /> SMS Send Time (Local)
                                  </Label>
                                  <TimePicker
                                    value={inv.smsScheduledTime}
                                    onChange={(time) => {
                                      const updated = [...config.invitationSeries];
                                      updated[index].smsScheduledTime = time;
                                      updateConfig('invitationSeries', updated);
                                    }}
                                  />
                                  <p className="text-[9px] text-muted-foreground/60 italic">Defaults to session start time.</p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </MessagingChannelBlock>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

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
                onEmailChange={(v) => {
                  updateConfigs({
                    facilitatorRemindersEmailTemplateId: v,
                    ...(v ? { facilitatorRemindersEnabled: true } : {})
                  });
                }}
                smsValue={config.facilitatorRemindersSmsTemplateId || ''}
                onSmsChange={(v) => {
                  updateConfigs({
                    facilitatorRemindersSmsTemplateId: v,
                    ...(v ? { facilitatorRemindersEnabled: true } : {})
                  });
                }}
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
                onEmailChange={(v) => {
                  updateConfigs({
                    facilitatorPostEventEmailTemplateId: v,
                    ...(v ? { facilitatorPostEventEnabled: true } : {})
                  });
                }}
                smsValue={config.facilitatorPostEventSmsTemplateId || ''}
                onSmsChange={(v) => {
                  updateConfigs({
                    facilitatorPostEventSmsTemplateId: v,
                    ...(v ? { facilitatorPostEventEnabled: true } : {})
                  });
                }}
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

      {/* ── Section 5: Reschedule Alerts ── */}
      <CollapsibleSection
        id="reschedule"
        title="Reschedule Alerts"
        description="Notify guests & facilitators on schedule changes"
        icon={<Clock className="h-4 w-4 text-indigo-600" />}
        iconBg="bg-indigo-500/10"
        isOpen={openSections.reschedule}
        onToggle={() => toggleSection('reschedule')}
        badge={config.rescheduleEnabled ? 'Active' : undefined}
        hasWarning={warnings.reschedule}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold">Enable Reschedule Alerts</Label>
            <Switch
              checked={config.rescheduleEnabled}
              onCheckedChange={(v) => updateConfig('rescheduleEnabled', v)}
            />
          </div>

          {config.rescheduleEnabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  {(['email', 'sms'] as const).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        const set = new Set(config.rescheduleChannels);
                        set.has(ch) ? set.delete(ch) : set.add(ch);
                        updateConfig('rescheduleChannels', Array.from(set) as ('email' | 'sms')[]);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1",
                        config.rescheduleChannels.includes(ch)
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
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Guest Rescheduled Alerts</h4>
                  <MessagingChannelBlock
                    enableLabel="Enable Guest Notifications"
                    enabled={true}
                    onEnabledChange={() => {}}
                    channels={config.rescheduleChannels}
                    onChannelsChange={() => {}}
                    category="meetings"
                    recipientType="external_alert"
                    templateTypePrefix="meeting_rescheduled_guest"
                    emailValue={config.rescheduleEmailTemplateId || ''}
                    onEmailChange={(v) => updateConfig('rescheduleEmailTemplateId', v)}
                    smsValue={config.rescheduleSmsTemplateId || ''}
                    onSmsChange={(v) => updateConfig('rescheduleSmsTemplateId', v)}
                    placeholderEmail="Select rescheduled guest template..."
                    showChannelsToggle={false}
                    hideSwitch={true}
                  />
                </div>

                <div className="p-4 bg-muted/20 rounded-xl border space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Registrant Rescheduled Alerts</h4>
                  <MessagingChannelBlock
                    enableLabel="Enable Registrant Notifications"
                    enabled={true}
                    onEnabledChange={() => {}}
                    channels={config.rescheduleChannels}
                    onChannelsChange={() => {}}
                    category="meetings"
                    recipientType="external_alert"
                    templateTypePrefix="meeting_rescheduled_registrant"
                    emailValue={config.rescheduleRegistrantEmailTemplateId || ''}
                    onEmailChange={(v) => updateConfig('rescheduleRegistrantEmailTemplateId', v)}
                    smsValue={config.rescheduleRegistrantSmsTemplateId || ''}
                    onSmsChange={(v) => updateConfig('rescheduleRegistrantSmsTemplateId', v)}
                    placeholderEmail="Select rescheduled registrant template..."
                    showChannelsToggle={false}
                    hideSwitch={true}
                  />
                </div>

                <div className="p-4 bg-muted/20 rounded-xl border space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Facilitator Rescheduled Alerts</h4>
                  <MessagingChannelBlock
                    enableLabel="Enable Facilitator Notifications"
                    enabled={true}
                    onEnabledChange={() => {}}
                    channels={config.rescheduleChannels}
                    onChannelsChange={() => {}}
                    category="meetings"
                    recipientType="internal_alert"
                    templateTypePrefix="meeting_rescheduled_facilitator"
                    emailValue={config.rescheduleFacilitatorEmailTemplateId || ''}
                    onEmailChange={(v) => updateConfig('rescheduleFacilitatorEmailTemplateId', v)}
                    smsValue={config.rescheduleFacilitatorSmsTemplateId || ''}
                    onSmsChange={(v) => updateConfig('rescheduleFacilitatorSmsTemplateId', v)}
                    placeholderEmail="Select rescheduled facilitator template..."
                    showChannelsToggle={false}
                    hideSwitch={true}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Section 6: Cancellation Alerts ── */}
      <CollapsibleSection
        id="cancel"
        title="Cancellation Alerts"
        description="Notify guests & facilitators on cancellations"
        icon={<Send className="h-4 w-4 text-rose-600" />}
        iconBg="bg-rose-500/10"
        isOpen={openSections.cancel}
        onToggle={() => toggleSection('cancel')}
        badge={config.cancelEnabled ? 'Active' : undefined}
        hasWarning={warnings.cancel}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold">Enable Cancellation Alerts</Label>
            <Switch
              checked={config.cancelEnabled}
              onCheckedChange={(v) => updateConfig('cancelEnabled', v)}
            />
          </div>

          {config.cancelEnabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  {(['email', 'sms'] as const).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        const set = new Set(config.cancelChannels);
                        set.has(ch) ? set.delete(ch) : set.add(ch);
                        updateConfig('cancelChannels', Array.from(set) as ('email' | 'sms')[]);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1",
                        config.cancelChannels.includes(ch)
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
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Guest Cancellation Alerts</h4>
                  <MessagingChannelBlock
                    enableLabel="Enable Guest Notifications"
                    enabled={true}
                    onEnabledChange={() => {}}
                    channels={config.cancelChannels}
                    onChannelsChange={() => {}}
                    category="meetings"
                    recipientType="external_alert"
                    templateTypePrefix="meeting_cancelled_guest"
                    emailValue={config.cancelEmailTemplateId || ''}
                    onEmailChange={(v) => updateConfig('cancelEmailTemplateId', v)}
                    smsValue={config.cancelSmsTemplateId || ''}
                    onSmsChange={(v) => updateConfig('cancelSmsTemplateId', v)}
                    placeholderEmail="Select cancelled guest template..."
                    showChannelsToggle={false}
                    hideSwitch={true}
                  />
                </div>

                <div className="p-4 bg-muted/20 rounded-xl border space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Registrant Cancellation Alerts</h4>
                  <MessagingChannelBlock
                    enableLabel="Enable Registrant Notifications"
                    enabled={true}
                    onEnabledChange={() => {}}
                    channels={config.cancelChannels}
                    onChannelsChange={() => {}}
                    category="meetings"
                    recipientType="external_alert"
                    templateTypePrefix="meeting_cancelled_registrant"
                    emailValue={config.cancelRegistrantEmailTemplateId || ''}
                    onEmailChange={(v) => updateConfig('cancelRegistrantEmailTemplateId', v)}
                    smsValue={config.cancelRegistrantSmsTemplateId || ''}
                    onSmsChange={(v) => updateConfig('cancelRegistrantSmsTemplateId', v)}
                    placeholderEmail="Select cancelled registrant template..."
                    showChannelsToggle={false}
                    hideSwitch={true}
                  />
                </div>

                <div className="p-4 bg-muted/20 rounded-xl border space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Facilitator Cancellation Alerts</h4>
                  <MessagingChannelBlock
                    enableLabel="Enable Facilitator Notifications"
                    enabled={true}
                    onEnabledChange={() => {}}
                    channels={config.cancelChannels}
                    onChannelsChange={() => {}}
                    category="meetings"
                    recipientType="internal_alert"
                    templateTypePrefix="meeting_cancelled_facilitator"
                    emailValue={config.cancelFacilitatorEmailTemplateId || ''}
                    onEmailChange={(v) => updateConfig('cancelFacilitatorEmailTemplateId', v)}
                    smsValue={config.cancelSmsTemplateId || ''}
                    onSmsChange={(v) => updateConfig('cancelSmsTemplateId', v)}
                    placeholderEmail="Select cancelled facilitator template..."
                    showChannelsToggle={false}
                    hideSwitch={true}
                  />
                </div>
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
        className="bg-muted/30 border-b py-3.5 px-5 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
              {icon}
            </div>
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
              {title}
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
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {badge && (
              <Badge variant="secondary" className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/10 select-none">
                {badge}
              </Badge>
            )}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
            )}
          </div>
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



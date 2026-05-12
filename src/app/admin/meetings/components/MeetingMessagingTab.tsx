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
import { SmartTemplateDropdown } from '@/app/admin/components/SmartTemplateDropdown';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import ReminderSlotRow from './ReminderSlotRow';
import type { MeetingMessagingConfig, MeetingReminderSlot } from '@/lib/types';

// ─── Default Config ──────────────────────────────────────────────
const DEFAULT_CONFIG: MeetingMessagingConfig = {
  registrationAckEnabled: false,
  registrationAckChannels: ['email'],
  facilitatorUserIds: [],
  facilitatorRemindersEnabled: false,
  facilitatorPostEventEnabled: false,
  facilitatorChannels: ['email'],
  reminders: [],
  postEventEnabled: false,
  postEventDelayMinutes: 60,
  postEventAudience: 'attendees_only',
  postEventChannels: ['email'],
};

// ─── Main Component ──────────────────────────────────────────────
export default function MeetingMessagingTab() {
  const { watch, setValue } = useFormContext();
  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();

  // Get messaging config from form, defaulting if absent
  const config: MeetingMessagingConfig = watch('messagingConfig') || DEFAULT_CONFIG;

  const updateConfig = React.useCallback(<K extends keyof MeetingMessagingConfig>(
    key: K,
    value: MeetingMessagingConfig[K]
  ) => {
    setValue('messagingConfig', { ...config, [key]: value }, { shouldDirty: true });
  }, [config, setValue]);

  // Fetch workspace users for facilitator selection
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'workspace_users'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('displayName', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: workspaceUsers } = useCollection<any>(usersQuery);

  const userOptions = React.useMemo(() => {
    return (workspaceUsers || []).map((u: any) => ({
      label: u.displayName || u.email || 'Unknown',
      value: u.userId || u.id,
    }));
  }, [workspaceUsers]);

  // ── Collapsible section state ──
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

  // ── Channel toggle helpers ──
  const ChannelToggle = React.useCallback(({ channels, onChange }: { channels: ('email' | 'sms')[]; onChange: (v: ('email' | 'sms')[]) => void }) => (
    <div className="flex items-center gap-1">
      {(['email', 'sms'] as const).map(ch => (
        <button
          key={ch}
          type="button"
          onClick={() => {
            const set = new Set(channels);
            set.has(ch) ? set.delete(ch) : set.add(ch);
            onChange(Array.from(set) as ('email' | 'sms')[]);
          }}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors",
            channels.includes(ch)
              ? ch === 'email' ? "bg-blue-500/10 text-blue-600" : "bg-green-500/10 text-green-600"
              : "bg-muted/20 text-muted-foreground/40"
          )}
        >
          {ch === 'email' ? <Mail className="h-3 w-3 inline mr-1" /> : <Smartphone className="h-3 w-3 inline mr-1" />}
          {ch}
        </button>
      ))}
    </div>
  ), []);

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
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold">Enable Acknowledgement</Label>
            <Switch
              checked={config.registrationAckEnabled}
              onCheckedChange={(v) => updateConfig('registrationAckEnabled', v)}
            />
          </div>

          {config.registrationAckEnabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <ChannelToggle
                channels={config.registrationAckChannels}
                onChange={(v) => updateConfig('registrationAckChannels', v)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.registrationAckChannels.includes('email') && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5" /> Email Template
                    </span>
                    <SmartTemplateDropdown
                      category="meetings"
                      recipientType="external_alert"
                      channel="email"
                      value={config.registrationAckEmailTemplateId || ''}
                      onValueChange={(v) => updateConfig('registrationAckEmailTemplateId', v)}
                      placeholder="Select email template..."
                      className="h-9 rounded-xl text-[10px] font-bold"
                    />
                  </div>
                )}
                {config.registrationAckChannels.includes('sms') && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
                      <Smartphone className="h-2.5 w-2.5" /> SMS Template
                    </span>
                    <SmartTemplateDropdown
                      category="meetings"
                      recipientType="external_alert"
                      channel="sms"
                      value={config.registrationAckSmsTemplateId || ''}
                      onValueChange={(v) => updateConfig('registrationAckSmsTemplateId', v)}
                      placeholder="Select SMS template..."
                      className="h-9 rounded-xl text-[10px] font-bold"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
        badge={config.facilitatorUserIds.length > 0 ? `${config.facilitatorUserIds.length} users` : undefined}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground/60">Select Facilitators</Label>
            <MultiSelect
              options={userOptions}
              value={config.facilitatorUserIds}
              onChange={(v) => updateConfig('facilitatorUserIds', v)}
              placeholder="Select team members..."
              className="rounded-xl"
            />
          </div>

          {config.facilitatorUserIds.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <ChannelToggle
                channels={config.facilitatorChannels}
                onChange={(v) => updateConfig('facilitatorChannels', v)}
              />

              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold">Pre-Event Reminders</Label>
                  <p className="text-[9px] text-muted-foreground">Notify facilitators before the meeting starts</p>
                </div>
                <Switch
                  checked={config.facilitatorRemindersEnabled}
                  onCheckedChange={(v) => updateConfig('facilitatorRemindersEnabled', v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold">Post-Event Debrief</Label>
                  <p className="text-[9px] text-muted-foreground">Send summary after the meeting ends</p>
                </div>
                <Switch
                  checked={config.facilitatorPostEventEnabled}
                  onCheckedChange={(v) => updateConfig('facilitatorPostEventEnabled', v)}
                />
              </div>
            </div>
          )}
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

              <ChannelToggle
                channels={config.postEventChannels}
                onChange={(v) => updateConfig('postEventChannels', v)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.postEventChannels.includes('email') && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5" /> Email Template
                    </span>
                    <SmartTemplateDropdown
                      category="meetings"
                      recipientType="external_alert"
                      channel="email"
                      value={config.postEventEmailTemplateId || ''}
                      onValueChange={(v) => updateConfig('postEventEmailTemplateId', v)}
                      placeholder="Select follow-up template..."
                      className="h-9 rounded-xl text-[10px] font-bold"
                    />
                  </div>
                )}
                {config.postEventChannels.includes('sms') && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
                      <Smartphone className="h-2.5 w-2.5" /> SMS Template
                    </span>
                    <SmartTemplateDropdown
                      category="meetings"
                      recipientType="external_alert"
                      channel="sms"
                      value={config.postEventSmsTemplateId || ''}
                      onValueChange={(v) => updateConfig('postEventSmsTemplateId', v)}
                      placeholder="Select follow-up SMS..."
                      className="h-9 rounded-xl text-[10px] font-bold"
                    />
                  </div>
                )}
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

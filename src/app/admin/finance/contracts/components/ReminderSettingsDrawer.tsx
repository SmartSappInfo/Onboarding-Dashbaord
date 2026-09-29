'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Automated Reminder & Notification Settings Drawer / Modal (P4.5 UI).
 *    Gives operations managers no-code control over signing reminder intervals,
 *    multi-channel toggles (Email, SMS, WhatsApp), renewal advance alert days,
 *    quiet hours windowing, and bi-directional CRM deal stage auto-advancement.
 * 2. Invariants Enforced:
 *    - Tenant Isolation: Scoped strictly to `workspaces/{workspaceId}/settings/signing_reminders` (FM-P4-04).
 *    - Mobile Ergonomics: Touch targets >= 44x44px, text-base inputs to prevent iOS zoom (FM-P4-10).
 *    - Zero Tolerance Typing: Strictly zero `any` or `any[]` (Rule 4).
 *    - Everyday English Dictionary: Clear, minimal labels ('Reminders', 'Quiet Hours', 'Channels') (Rule 7).
 */

import * as React from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Bell,
  Mail,
  MessageSquare,
  Loader2,
  Zap,
} from 'lucide-react';
import type {
  ReminderScheduleConfig,
  ReminderChannel,
} from '@/lib/types/document-signing';

export interface ReminderSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

const AVAILABLE_REMINDER_DAYS = [3, 7, 14, 21];
const AVAILABLE_RENEWAL_DAYS = [30, 60, 90];

export default function ReminderSettingsDrawer({
  open,
  onOpenChange,
  workspaceId,
}: ReminderSettingsDrawerProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [enabled, setEnabled] = React.useState(true);
  const [reminderDays, setReminderDays] = React.useState<number[]>([3, 7, 14]);
  const [channels, setChannels] = React.useState<ReminderChannel[]>(['email']);
  const [renewalAlertDays, setRenewalAlertDays] = React.useState<number[]>([30, 60, 90]);
  const [quietHoursEnabled, setQuietHoursEnabled] = React.useState(true);
  const [quietHoursStart, setQuietHoursStart] = React.useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = React.useState('08:00');
  const [dealAutoStageAdvance, setDealAutoStageAdvance] = React.useState(true);

  // Load existing settings
  React.useEffect(() => {
    if (!open || !firestore || !workspaceId) return;

    let isMounted = true;
    setIsLoading(true);

    async function loadSettings() {
      try {
        const settingsRef = doc(firestore, 'workspaces', workspaceId, 'settings', 'signing_reminders');
        const snap = await getDoc(settingsRef);
        if (snap.exists() && isMounted) {
          const data = snap.data() as Partial<ReminderScheduleConfig>;
          if (data.enabled !== undefined) setEnabled(data.enabled);
          if (data.reminderDays) setReminderDays(data.reminderDays);
          if (data.channels) setChannels(data.channels);
          if (data.renewalAlertDays) setRenewalAlertDays(data.renewalAlertDays);
          if (data.quietHours) {
            setQuietHoursEnabled(data.quietHours.enabled);
            setQuietHoursStart(data.quietHours.start || '22:00');
            setQuietHoursEnd(data.quietHours.end || '08:00');
          }
          if (data.dealAutoStageAdvance !== undefined) {
            setDealAutoStageAdvance(data.dealAutoStageAdvance);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load signing reminder settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [open, firestore, workspaceId]);

  const toggleReminderDay = (day: number) => {
    setReminderDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleRenewalDay = (day: number) => {
    setRenewalAlertDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleChannel = (ch: ReminderChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? (prev.length > 1 ? prev.filter((c) => c !== ch) : prev) : [...prev, ch]
    );
  };

  const handleSave = async () => {
    if (!firestore || !workspaceId) return;
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const config: ReminderScheduleConfig = {
        workspaceId,
        enabled,
        reminderDays,
        channels,
        renewalAlertDays,
        quietHours: {
          enabled: quietHoursEnabled,
          start: quietHoursStart,
          end: quietHoursEnd,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
        dealAutoStageAdvance,
        updatedAt: now,
        updatedBy: user?.uid || 'admin',
      };

      const settingsRef = doc(firestore, 'workspaces', workspaceId, 'settings', 'signing_reminders');
      await setDoc(settingsRef, config, { merge: true });

      toast({
        title: 'Settings Saved',
        description: 'Automated reminder cadences and escalation rules updated.',
      });
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Failed to save reminder settings:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to Save',
        description: err instanceof Error ? err.message : 'Unknown error saving settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Automated Reminders & Escalations
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure signer nudges, delivery channels, renewal alerts, and quiet hours.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p>Loading reminder preferences...</p>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="master-toggle" className="text-xs font-bold text-foreground">
                  Enable Automated Reminders
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Automatically nudges pending signers based on configured schedule
                </p>
              </div>
              <Switch id="master-toggle" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Reminder Intervals */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-foreground">
                  Signer Nudge Schedule
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Days after dispatch when automated reminders are sent to pending signers
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_REMINDER_DAYS.map((day) => {
                  const isSelected = reminderDays.includes(day);
                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleReminderDay(day)}
                      disabled={!enabled}
                      className="rounded-xl text-xs font-bold h-9 px-4 active:scale-[0.97] transition-all min-h-[44px] sm:min-h-0"
                    >
                      {day} Days After Sending
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Delivery Channels */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-foreground">Notification Channels</Label>
                <p className="text-[11px] text-muted-foreground">
                  Select which transactional communication rails to use for reminders
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => enabled && toggleChannel('email')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                    channels.includes('email')
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  <div className="text-xs font-semibold">Email</div>
                </div>

                <div
                  onClick={() => enabled && toggleChannel('sms')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                    channels.includes('sms')
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <div className="text-xs font-semibold">SMS (mNotify)</div>
                </div>

                <div
                  onClick={() => enabled && toggleChannel('whatsapp')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                    channels.includes('whatsapp')
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  <div className="text-xs font-semibold">WhatsApp</div>
                </div>
              </div>
            </div>

            {/* Contract Renewal Advance Alerts */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-foreground">
                  Contract Renewal Warnings
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Advance notices sent to internal deal owners before agreement expiration
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_RENEWAL_DAYS.map((day) => {
                  const isSelected = renewalAlertDays.includes(day);
                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleRenewalDay(day)}
                      disabled={!enabled}
                      className="rounded-xl text-xs font-bold h-9 px-4 active:scale-[0.97] transition-all min-h-[44px] sm:min-h-0"
                    >
                      {day} Days Before Renewal
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Quiet Hours Window */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="quiet-hours" className="text-xs font-bold text-foreground">
                    Quiet Hours Protection
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Holds messages during night hours in counterparty local time
                  </p>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={quietHoursEnabled}
                  onCheckedChange={setQuietHoursEnabled}
                  disabled={!enabled}
                />
              </div>

              {quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Start Time</Label>
                    <Input
                      type="time"
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                      disabled={!enabled}
                      className="text-base sm:text-xs rounded-xl h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">End Time</Label>
                    <Input
                      type="time"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
                      disabled={!enabled}
                      className="text-base sm:text-xs rounded-xl h-9"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Deal Stage Auto-Progression */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="auto-stage" className="text-xs font-bold text-foreground">
                  CRM Deal Auto-Won Progression
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Automatically mark linked CRM deal as Won upon final contract signature
                </p>
              </div>
              <Switch
                id="auto-stage"
                checked={dealAutoStageAdvance}
                onCheckedChange={setDealAutoStageAdvance}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-xl text-xs font-bold min-h-[44px] sm:min-h-0"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="rounded-xl text-xs font-bold active:scale-[0.97] transition-all min-h-[44px] sm:min-h-0"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

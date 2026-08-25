'use client';

/**
 * @fileoverview Availability Schedules Studio (Meetings 2.0).
 * Provides an interactive weekly schedule matrix, multi-interval daily windows,
 * date overrides, timezone configuration, notice lead times, and buffer padding.
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainerFluid } from '@/components/ui/page-container';
import { MeetingsNavigation } from '../components/MeetingsNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Plus,
  Trash2,
  Copy,
  Save,
  Loader2,
  CalendarOff,
  Globe,
  Calendar,
  Check,
} from 'lucide-react';
import type {
  AvailabilityProfile,
  AvailabilityRule,
  AvailabilityOverride,
  AvailabilityInterval,
} from '@/lib/meetings/types';
import {
  getDefaultAvailabilityProfileAction,
  updateAvailabilityProfileAction,
  DEFAULT_WEEKLY_RULES,
} from '@/app/actions/availability-actions';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

const DAYS_OF_WEEK = [
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
  { index: 0, name: 'Sunday' },
];

const COMMON_TIMEZONES = [
  { label: 'Accra / GMT (UTC+0)', value: 'Africa/Accra' },
  { label: 'London / BST (UTC+1)', value: 'Europe/London' },
  { label: 'Lagos / WAT (UTC+1)', value: 'Africa/Lagos' },
  { label: 'New York / EDT (UTC-4)', value: 'America/New_York' },
  { label: 'Chicago / CDT (UTC-5)', value: 'America/Chicago' },
  { label: 'Los Angeles / PDT (UTC-7)', value: 'America/Los_Angeles' },
  { label: 'Dubai / GST (UTC+4)', value: 'Asia/Dubai' },
  { label: 'Nairobi / EAT (UTC+3)', value: 'Africa/Nairobi' },
  { label: 'Johannesburg / SAST (UTC+2)', value: 'Africa/Johannesburg' },
  { label: 'UTC (Coordinated Universal Time)', value: 'UTC' },
];

// Generates time interval options in 15-minute increments (00:00 to 23:45)
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const hours = Math.floor(i / 4);
  const minutes = (i % 4) * 15;
  const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return time;
});

export default function AvailabilityClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [profile, setProfile] = React.useState<AvailabilityProfile | null>(null);

  // Editable state
  const [weeklyRules, setWeeklyRules] = React.useState<AvailabilityRule[]>(DEFAULT_WEEKLY_RULES);
  const [overrides, setOverrides] = React.useState<AvailabilityOverride[]>([]);
  const [timezone, setTimezone] = React.useState('UTC');
  const [minimumNoticeHours, setMinimumNoticeHours] = React.useState('2');
  const [maximumBookingHorizonDays, setMaximumBookingHorizonDays] = React.useState('30');
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = React.useState('0');
  const [bufferAfterMinutes, setBufferAfterMinutes] = React.useState('0');

  // Override dialog state
  const [overrideModalOpen, setOverrideModalOpen] = React.useState(false);
  const [newOverrideDate, setNewOverrideDate] = React.useState('');
  const [newOverrideType, setNewOverrideType] = React.useState<'available' | 'unavailable'>('unavailable');
  const [newOverrideReason, setNewOverrideReason] = React.useState('');
  const [newOverrideIntervals, setNewOverrideIntervals] = React.useState<AvailabilityInterval[]>([
    { start: '09:00', end: '17:00' },
  ]);

  // Load default profile on mount
  React.useEffect(() => {
    async function loadSchedule() {
      if (!activeWorkspaceId) return;
      setIsLoading(true);
      try {
        const res = await getDefaultAvailabilityProfileAction(activeWorkspaceId, activeOrganizationId || 'default');
        if (res.success && res.profile) {
          setProfile(res.profile);
          setWeeklyRules(res.profile.weeklyRules || DEFAULT_WEEKLY_RULES);
          setOverrides(res.profile.overrides || []);
          setTimezone(res.profile.timezone || 'UTC');
          setMinimumNoticeHours(String((res.profile.minimumNoticeMinutes || 120) / 60));
          setMaximumBookingHorizonDays(String(res.profile.maximumBookingHorizonDays || 30));
          setBufferBeforeMinutes(String(res.profile.defaultBufferBeforeMinutes || 0));
          setBufferAfterMinutes(String(res.profile.defaultBufferAfterMinutes || 0));
        } else {
          toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to load schedule.' });
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
      } finally {
        setIsLoading(false);
      }
    }
    loadSchedule();
  }, [activeWorkspaceId, activeOrganizationId, toast]);

  // Toggle Day Availability
  const handleToggleDay = (dayIndex: number, enabled: boolean) => {
    setWeeklyRules(prev =>
      prev.map(rule => {
        if (rule.dayOfWeek === dayIndex) {
          return {
            ...rule,
            isAvailable: enabled,
            intervals: enabled && rule.intervals.length === 0 ? [{ start: '09:00', end: '17:00' }] : rule.intervals,
          };
        }
        return rule;
      })
    );
  };

  // Add interval to a day
  const handleAddInterval = (dayIndex: number) => {
    setWeeklyRules(prev =>
      prev.map(rule => {
        if (rule.dayOfWeek === dayIndex) {
          const lastInterval = rule.intervals[rule.intervals.length - 1];
          const newStart = lastInterval ? lastInterval.end : '09:00';
          const newEnd = '17:00';
          return {
            ...rule,
            intervals: [...rule.intervals, { start: newStart, end: newEnd }],
          };
        }
        return rule;
      })
    );
  };

  // Remove interval from a day
  const handleRemoveInterval = (dayIndex: number, intervalIndex: number) => {
    setWeeklyRules(prev =>
      prev.map(rule => {
        if (rule.dayOfWeek === dayIndex) {
          const updated = rule.intervals.filter((_, idx) => idx !== intervalIndex);
          return {
            ...rule,
            intervals: updated,
            isAvailable: updated.length > 0 ? rule.isAvailable : false,
          };
        }
        return rule;
      })
    );
  };

  // Update interval start/end
  const handleUpdateInterval = (
    dayIndex: number,
    intervalIndex: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setWeeklyRules(prev =>
      prev.map(rule => {
        if (rule.dayOfWeek === dayIndex) {
          const updated = [...rule.intervals];
          updated[intervalIndex] = {
            ...updated[intervalIndex],
            [field]: value,
          };
          return { ...rule, intervals: updated };
        }
        return rule;
      })
    );
  };

  // Copy schedule from one day to all active days
  const handleCopyDayToAll = (sourceDayIndex: number) => {
    const sourceRule = weeklyRules.find(r => r.dayOfWeek === sourceDayIndex);
    if (!sourceRule) return;

    setWeeklyRules(prev =>
      prev.map(rule => ({
        ...rule,
        isAvailable: sourceRule.isAvailable,
        intervals: [...sourceRule.intervals],
      }))
    );

    toast({
      title: 'Schedule Applied',
      description: `Copied ${DAYS_OF_WEEK.find(d => d.index === sourceDayIndex)?.name}'s hours to all days.`,
    });
  };

  // Add Date Override
  const handleAddOverride = () => {
    if (!newOverrideDate) {
      toast({ variant: 'destructive', title: 'Invalid Date', description: 'Please select a valid date.' });
      return;
    }

    const newOverride: AvailabilityOverride = {
      id: `ov_${Date.now()}`,
      date: newOverrideDate,
      type: newOverrideType,
      reason: newOverrideReason.trim() || undefined,
      intervals: newOverrideType === 'available' ? newOverrideIntervals : [],
    };

    setOverrides(prev => [...prev.filter(o => o.date !== newOverrideDate), newOverride]);
    setOverrideModalOpen(false);
    setNewOverrideDate('');
    setNewOverrideReason('');
    toast({ title: 'Date Override Added', description: `Saved exception for ${newOverrideDate}.` });
  };

  // Remove Date Override
  const handleRemoveOverride = (id: string) => {
    setOverrides(prev => prev.filter(o => o.id !== id));
  };

  // Save Schedule
  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const noticeMins = Math.max(0, parseFloat(minimumNoticeHours || '2') * 60);
      const horizonDays = Math.max(1, parseInt(maximumBookingHorizonDays || '30', 10));
      const bufBefore = Math.max(0, parseInt(bufferBeforeMinutes || '0', 10));
      const bufAfter = Math.max(0, parseInt(bufferAfterMinutes || '0', 10));

      const res = await updateAvailabilityProfileAction(profile.id, {
        weeklyRules,
        overrides,
        timezone,
        minimumNoticeMinutes: noticeMins,
        maximumBookingHorizonDays: horizonDays,
        defaultBufferBeforeMinutes: bufBefore,
        defaultBufferAfterMinutes: bufAfter,
      });

      if (res.success) {
        toast({ title: 'Schedule Saved', description: 'Your availability settings have been updated.' });
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error || 'Failed to save.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainerFluid>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid>
      {/* Shared Navigation Tab Bar */}
      <MeetingsNavigation
        actions={
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl min-h-[44px] px-5 font-semibold gap-2 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Schedule
          </Button>
        }
      />

      <div className="space-y-8 max-w-5xl">
        {/* Header Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Availability Schedules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set your weekly working hours, date exceptions, and booking buffer rules.
          </p>
        </div>

        {/* Global Timezone & Booking Horizon Settings */}
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Timezone & Global Rules</CardTitle>
            </div>
            <CardDescription>
              Configure how slots are generated and localized for visitors.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="timezone-select" className="text-sm font-semibold">
                  Schedule Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone-select" className="rounded-xl min-h-[44px]">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-64">
                    {COMMON_TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Candidate hours below are computed in this base timezone.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="horizon-input" className="text-sm font-semibold">
                  Booking Horizon
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="horizon-input"
                    type="number"
                    min="1"
                    max="365"
                    value={maximumBookingHorizonDays}
                    onChange={e => setMaximumBookingHorizonDays(e.target.value)}
                    className="rounded-xl min-h-[44px]"
                  />
                  <span className="text-sm text-muted-foreground shrink-0 font-medium">days in advance</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="notice-input" className="text-sm font-semibold">
                  Minimum Notice
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="notice-input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={minimumNoticeHours}
                    onChange={e => setMinimumNoticeHours(e.target.value)}
                    className="rounded-xl min-h-[44px]"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">hours</span>
                </div>
                <p className="text-xs text-muted-foreground">Prevents last-minute bookings.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buffer-before-input" className="text-sm font-semibold">
                  Buffer Before
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="buffer-before-input"
                    type="number"
                    min="0"
                    step="5"
                    value={bufferBeforeMinutes}
                    onChange={e => setBufferBeforeMinutes(e.target.value)}
                    className="rounded-xl min-h-[44px]"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">mins</span>
                </div>
                <p className="text-xs text-muted-foreground">Prep time before session.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buffer-after-input" className="text-sm font-semibold">
                  Buffer After
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="buffer-after-input"
                    type="number"
                    min="0"
                    step="5"
                    value={bufferAfterMinutes}
                    onChange={e => setBufferAfterMinutes(e.target.value)}
                    className="rounded-xl min-h-[44px]"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">mins</span>
                </div>
                <p className="text-xs text-muted-foreground">Wrap-up time after session.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Working Hours Matrix */}
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Weekly Working Hours</CardTitle>
            </div>
            <CardDescription>
              Toggle days and configure multiple shift intervals for each day of the week.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DAYS_OF_WEEK.map(day => {
              const rule = weeklyRules.find(r => r.dayOfWeek === day.index) || {
                dayOfWeek: day.index,
                intervals: [],
                isAvailable: false,
              };

              return (
                <div
                  key={day.index}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors gap-4"
                >
                  {/* Day Toggle */}
                  <div className="flex items-center gap-3 w-36 shrink-0">
                    <Switch
                      checked={rule.isAvailable}
                      onCheckedChange={checked => handleToggleDay(day.index, checked)}
                      id={`day-switch-${day.index}`}
                    />
                    <Label
                      htmlFor={`day-switch-${day.index}`}
                      className="font-semibold text-sm cursor-pointer"
                    >
                      {day.name}
                    </Label>
                  </div>

                  {/* Intervals or Unavailable status */}
                  <div className="flex-1 w-full space-y-2">
                    {rule.isAvailable && rule.intervals.length > 0 ? (
                      rule.intervals.map((interval, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                          <Select
                            value={interval.start}
                            onValueChange={v => handleUpdateInterval(day.index, idx, 'start', v)}
                          >
                            <SelectTrigger className="w-28 rounded-xl min-h-[44px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-48">
                              {TIME_OPTIONS.map(t => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <span className="text-muted-foreground text-sm font-medium">to</span>

                          <Select
                            value={interval.end}
                            onValueChange={v => handleUpdateInterval(day.index, idx, 'end', v)}
                          >
                            <SelectTrigger className="w-28 rounded-xl min-h-[44px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-48">
                              {TIME_OPTIONS.map(t => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {rule.intervals.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveInterval(day.index, idx)}
                              className="text-destructive hover:bg-destructive/10 rounded-xl h-10 w-10 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Unavailable</span>
                    )}
                  </div>

                  {/* Day Actions */}
                  {rule.isAvailable && (
                    <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddInterval(day.index)}
                        className="rounded-xl text-xs gap-1 h-9"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Interval
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyDayToAll(day.index)}
                        title="Copy this schedule to all days"
                        className="rounded-xl text-xs gap-1 h-9"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy to All
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Date Overrides Studio */}
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Date Overrides</CardTitle>
              </div>
              <CardDescription>
                Add specific holidays, blackout dates, or special weekend working hours.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverrideModalOpen(true)}
              className="rounded-xl min-h-[44px] gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Date Override
            </Button>
          </CardHeader>
          <CardContent>
            {overrides.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
                No date overrides configured yet. Click above to add holiday exceptions.
              </div>
            ) : (
              <div className="space-y-3">
                {overrides.map(override => (
                  <div
                    key={override.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card/40"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{override.date}</span>
                          <Badge
                            variant={override.type === 'available' ? 'default' : 'secondary'}
                            className="rounded-lg text-xs"
                          >
                            {override.type === 'available' ? 'Custom Hours' : 'Unavailable'}
                          </Badge>
                        </div>
                        {override.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">{override.reason}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOverride(override.id)}
                      className="text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Date Override Modal */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Add Date Override</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="override-date" className="text-sm font-semibold">
                Select Date
              </Label>
              <Input
                id="override-date"
                type="date"
                value={newOverrideDate}
                onChange={e => setNewOverrideDate(e.target.value)}
                className="rounded-xl min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Availability on this date</Label>
              <Select
                value={newOverrideType}
                onValueChange={(v: 'available' | 'unavailable') => setNewOverrideType(v)}
              >
                <SelectTrigger className="rounded-xl min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="unavailable">Unavailable (Block whole day)</SelectItem>
                  <SelectItem value="available">Available (Custom hours)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-reason" className="text-sm font-semibold">
                Reason / Note (Optional)
              </Label>
              <Input
                id="override-reason"
                placeholder="e.g. Labor Day, Staff Retreat"
                value={newOverrideReason}
                onChange={e => setNewOverrideReason(e.target.value)}
                className="rounded-xl min-h-[44px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverrideModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddOverride} className="rounded-xl">
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainerFluid>
  );
}

'use client';

/**
 * @fileoverview Public Booking Portal Client Component (Meetings 2.0).
 * Implements high-conversion Calendly-grade booking experience with month calendar,
 * dynamic timezone switcher, slot discovery, 5-minute concurrency hold locks, and checkout form.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  Video,
  MapPin,
  Phone,
  Globe,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Timer,
  User,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import type {
  PublicBookingPageData,
  AvailableSlot,
  BookerInfo,
} from '@/lib/meetings/types';
import type { SupportedMeetingLocale } from '@/lib/meetings/types/localization';
import { getMeetingTranslations } from '@/lib/meetings/localization-service';
import { BookingLanguageSelector } from '@/components/shared/BookingLanguageSelector';
import {
  getAvailableSlotsAction,
  acquireBookingHoldAction,
  createBookingFromHoldAction,
} from '@/app/actions/booking-actions';
import { cn } from '@/lib/utils';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

interface PublicBookingClientProps {
  initialData: PublicBookingPageData;
  prefill?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

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

export default function PublicBookingClient({ initialData, prefill }: PublicBookingClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const { eventType, hostProfile, workspaceName, workspaceLogo } = initialData;

  // Session ID generated per visitor tab to protect holds
  const sessionId = React.useMemo(() => {
    if (typeof window === 'undefined') return 'session_default';
    let sid = sessionStorage.getItem('smartsapp_booking_sid');
    if (!sid) {
      sid = `sid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('smartsapp_booking_sid', sid);
    }
    return sid;
  }, []);

  // Timezone state (auto-detected on client mount)
  const [visitorTimezone, setVisitorTimezone] = React.useState('UTC');
  const [locale, setLocale] = React.useState<SupportedMeetingLocale>('en');
  const t = React.useMemo(() => getMeetingTranslations(locale), [locale]);

  React.useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setVisitorTimezone(detected);
    } catch {
      // Fall back to UTC
    }
  }, []);

  // Calendar navigation state
  const [currentMonth, setCurrentMonth] = React.useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<AvailableSlot | null>(null);

  // Slots computation state
  const [slotsByDate, setSlotsByDate] = React.useState<Record<string, AvailableSlot[]>>({});
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(false);

  // Hold lock state
  const [holdId, setHoldId] = React.useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = React.useState<string | null>(null);
  const [holdSecondsRemaining, setHoldSecondsRemaining] = React.useState<number | null>(null);
  const [isAcquiringHold, setIsAcquiringHold] = React.useState(false);

  // Details form step state
  const [currentStep, setCurrentStep] = React.useState<'select_time' | 'details'>('select_time');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form inputs
  const [firstName, setFirstName] = React.useState(() => {
    if (prefill?.name) {
      const parts = prefill.name.trim().split(' ');
      return parts[0] || '';
    }
    return '';
  });
  const [lastName, setLastName] = React.useState(() => {
    if (prefill?.name) {
      const parts = prefill.name.trim().split(' ');
      return parts.slice(1).join(' ') || '';
    }
    return '';
  });
  const [email, setEmail] = React.useState(prefill?.email || '');
  const [phone, setPhone] = React.useState(prefill?.phone || '');
  const [notes, setNotes] = React.useState('');
  const [customAnswers, setCustomAnswers] = React.useState<Record<string, string | number | boolean | string[]>>({});

  // Fetch available slots whenever month or timezone changes
  React.useEffect(() => {
    async function fetchSlots() {
      setIsLoadingSlots(true);
      try {
        const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

        const res = await getAvailableSlotsAction({
          eventTypeId: eventType.id,
          startDate: monthStart,
          endDate: monthEnd,
          visitorTimezone,
        });

        if (res.success && res.slots) {
          setSlotsByDate(res.slots);
        } else {
          setSlotsByDate({});
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
      } finally {
        setIsLoadingSlots(false);
      }
    }

    fetchSlots();
  }, [eventType.id, currentMonth, visitorTimezone]);

  // Hold countdown timer effect
  React.useEffect(() => {
    if (!holdExpiresAt) {
      setHoldSecondsRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000));
      setHoldSecondsRemaining(diff);

      if (diff <= 0) {
        clearInterval(interval);
        toast({
          variant: 'destructive',
          title: 'Hold Expired',
          description: 'Your 5-minute reservation has expired. Please select a time slot again.',
        });
        setHoldId(null);
        setHoldExpiresAt(null);
        setSelectedSlot(null);
        setCurrentStep('select_time');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [holdExpiresAt, toast]);

  // Days in current month for the calendar grid
  const daysInMonth = React.useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Handle Slot Selection (Acquires 5-minute atomic lock)
  const handleSelectSlot = async (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setIsAcquiringHold(true);

    try {
      const res = await acquireBookingHoldAction({
        eventTypeId: eventType.id,
        startAt: slot.start,
        endAt: slot.end,
        sessionId,
      });

      if (res.success && res.holdId && res.expiresAt) {
        setHoldId(res.holdId);
        setHoldExpiresAt(res.expiresAt);
        setCurrentStep('details');
      } else {
        toast({
          variant: 'destructive',
          title: 'Slot Unavailable',
          description: res.error || 'This slot was just booked by another user. Please choose another time.',
        });
        setSelectedSlot(null);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
      setSelectedSlot(null);
    } finally {
      setIsAcquiringHold(false);
    }
  };

  // Submit Booking Form
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!holdId) {
      toast({ variant: 'destructive', title: 'Session Expired', description: 'Please select a time slot again.' });
      setCurrentStep('select_time');
      return;
    }
    if (!firstName.trim() || !email.trim()) {
      toast({ variant: 'destructive', title: 'Missing required fields', description: 'Please provide your name and email.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const bookerPayload: BookerInfo = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        customResponses: customAnswers,
      };

      const res = await createBookingFromHoldAction({
        holdId,
        sessionId,
        booker: bookerPayload,
        visitorTimezone,
      });

      if (res.success && res.bookingId) {
        router.push(
          `/book/${eventType.slug}/confirmed?bookingId=${res.bookingId}${
            res.manageToken ? `&token=${res.manageToken}` : ''
          }`
        );
      } else {
        toast({
          variant: 'destructive',
          title: 'Booking Failed',
          description: res.error || 'Failed to complete booking. Please try again.',
        });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for rendering location badge
  const renderLocationBadge = () => {
    switch (eventType.locationType) {
      case 'google_meet':
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Video className="w-4 h-4 text-primary" /> Google Meet
          </span>
        );
      case 'zoom':
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Video className="w-4 h-4 text-blue-500" /> Zoom Video
          </span>
        );
      case 'teams':
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Video className="w-4 h-4 text-indigo-500" /> Microsoft Teams
          </span>
        );
      case 'phone':
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Phone className="w-4 h-4 text-green-500" /> Phone Call
          </span>
        );
      case 'in_person':
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <MapPin className="w-4 h-4 text-red-500" /> In-Person
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Globe className="w-4 h-4 text-primary" /> Online Meeting
          </span>
        );
    }
  };

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const availableSlotsForSelectedDate = selectedDateKey ? slotsByDate[selectedDateKey] || [] : [];

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-6 lg:p-12">
      <Card className="w-full max-w-4xl rounded-3xl border border-border shadow-xl overflow-hidden bg-card">
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
          {/* Left Column: Event & Host Overview */}
          <div className="md:col-span-5 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-border bg-muted/20 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              {/* Host / Workspace Profile */}
              <div className="flex items-center gap-3.5">
                {hostProfile?.avatarUrl ? (
                  <Image
                    src={hostProfile.avatarUrl}
                    alt={hostProfile.name}
                    width={48}
                    height={48}
                    className="rounded-2xl object-cover ring-2 ring-border shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg ring-2 ring-border shrink-0">
                    {hostProfile?.name?.slice(0, 2).toUpperCase() || 'SS'}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm leading-tight text-foreground">
                    {hostProfile?.name || workspaceName || 'Session Host'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hostProfile?.role || workspaceName || 'SmartSapp Platform'}
                  </p>
                </div>
              </div>

              {/* Event Title & Duration */}
              <div className="space-y-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                  {eventType.name}
                </h1>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Clock className="w-4 h-4 text-primary" /> {eventType.durationMinutes} mins
                  </span>
                  {renderLocationBadge()}
                </div>
              </div>

              {/* Description */}
              {eventType.description && (
                <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line border-t border-border/60 pt-4">
                  {eventType.description}
                </div>
              )}
            </div>

            {/* Timezone & Language Selector on Left Foot */}
            <div className="pt-4 border-t border-border/60 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Globe className="w-3.5 h-3.5" /> {t.selectTimezone}
                </Label>
                <Select value={visitorTimezone} onValueChange={setVisitorTimezone}>
                  <SelectTrigger className="rounded-xl min-h-[38px] text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-56">
                    {COMMON_TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value} className="text-xs">
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">Language</span>
                <BookingLanguageSelector currentLocale={locale} onLocaleChange={setLocale} />
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Step Area */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            {/* STEP 1: Date & Time Picker */}
            {currentStep === 'select_time' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Select a Date & Time</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Available times are calculated in {visitorTimezone}.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                  {/* Calendar Month View */}
                  <div className="sm:col-span-7 space-y-4">
                    {/* Month Nav */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {format(currentMonth, 'MMMM yyyy')}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                          className="h-8 w-8 rounded-xl"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                          className="h-8 w-8 rounded-xl"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Weekday Header */}
                    <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground pb-1">
                      <span>Su</span>
                      <span>Mo</span>
                      <span>Tu</span>
                      <span>We</span>
                      <span>Th</span>
                      <span>Fr</span>
                      <span>Sa</span>
                    </div>

                    {/* Month Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* Empty padding days before start of month */}
                      {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                        <div key={`pad-${i}`} className="h-9 w-full" />
                      ))}

                      {daysInMonth.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const hasSlots = (slotsByDate[dateKey] || []).length > 0;
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const isPast = isBefore(day, startOfDay(new Date()));

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            disabled={!hasSlots || isPast || isLoadingSlots}
                            onClick={() => setSelectedDate(day)}
                            className={cn(
                              'h-9 w-full rounded-xl text-xs font-medium transition-all flex items-center justify-center relative',
                              isSelected
                                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                                : hasSlots && !isPast
                                ? 'bg-primary/5 text-primary hover:bg-primary/20 font-semibold cursor-pointer'
                                : 'text-muted-foreground/40 cursor-not-allowed opacity-50'
                            )}
                          >
                            {format(day, 'd')}
                            {hasSlots && !isSelected && (
                              <span className="w-1 h-1 bg-primary rounded-full absolute bottom-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Slots Column */}
                  <div className="sm:col-span-5 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6 space-y-3">
                    <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block">
                      {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a date'}
                    </span>

                    {isLoadingSlots ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        <span className="text-xs text-muted-foreground">Finding slots...</span>
                      </div>
                    ) : !selectedDate ? (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        Please choose an available date on the calendar.
                      </div>
                    ) : availableSlotsForSelectedDate.length === 0 ? (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        No slots available on this date.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {availableSlotsForSelectedDate.map(slot => {
                          const isPicked = selectedSlot?.start === slot.start;

                          return (
                            <Button
                              key={slot.start}
                              type="button"
                              variant={isPicked ? 'default' : 'outline'}
                              disabled={isAcquiringHold}
                              onClick={() => handleSelectSlot(slot)}
                              className="w-full rounded-xl min-h-[44px] justify-center font-semibold text-xs"
                            >
                              {isAcquiringHold && isPicked ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                slot.formattedTime
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Checkout Details Form */}
            {currentStep === 'details' && selectedSlot && (
              <form onSubmit={handleSubmitBooking} className="space-y-6">
                {/* Hold Expiration Banner */}
                {holdSecondsRemaining !== null && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
                      <Timer className="w-4 h-4 animate-pulse" />
                      <span>Slot held for you:</span>
                    </div>
                    <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
                      {Math.floor(holdSecondsRemaining / 60)}:
                      {(holdSecondsRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentStep('select_time')}
                    className="rounded-xl h-9 w-9"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Enter Your Details</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')} at{' '}
                      {selectedSlot.formattedTime}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="first-name" className="text-xs font-semibold">
                        First Name *
                      </Label>
                      <Input
                        id="first-name"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="e.g. Kwame"
                        className="rounded-xl min-h-[44px]"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="last-name" className="text-xs font-semibold">
                        Last Name *
                      </Label>
                      <Input
                        id="last-name"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="e.g. Mensah"
                        className="rounded-xl min-h-[44px]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="guest-email" className="text-xs font-semibold">
                      Email Address *
                    </Label>
                    <Input
                      id="guest-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="kwame@example.com"
                      className="rounded-xl min-h-[44px]"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="guest-phone" className="text-xs font-semibold">
                      Phone Number (Optional)
                    </Label>
                    <Input
                      id="guest-phone"
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+233 24 123 4567"
                      className="rounded-xl min-h-[44px]"
                    />
                  </div>

                  {/* Custom Questions from Event Type */}
                  {(eventType.customQuestions || []).map(q => (
                    <div key={q.id} className="space-y-1.5">
                      <Label htmlFor={`q-${q.key}`} className="text-xs font-semibold">
                        {q.label} {q.required && '*'}
                      </Label>
                      {q.type === 'textarea' ? (
                        <Textarea
                          id={`q-${q.key}`}
                          value={String(customAnswers[q.key] ?? '')}
                          onChange={e => setCustomAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                          placeholder={q.placeholder || ''}
                          rows={3}
                          className="rounded-xl"
                          required={q.required}
                        />
                      ) : q.type === 'checkbox' ? (
                        <div className="flex items-center gap-2 pt-1">
                          <Checkbox
                            id={`q-${q.key}`}
                            checked={!!customAnswers[q.key]}
                            onCheckedChange={c => setCustomAnswers(prev => ({ ...prev, [q.key]: c }))}
                          />
                          <label htmlFor={`q-${q.key}`} className="text-xs cursor-pointer font-medium">
                            {q.placeholder || 'Yes, I agree'}
                          </label>
                        </div>
                      ) : (
                        <Input
                          id={`q-${q.key}`}
                          type={q.type === 'phone' ? 'tel' : q.type === 'email' ? 'email' : 'text'}
                          value={String(customAnswers[q.key] ?? '')}
                          onChange={e => setCustomAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                          placeholder={q.placeholder || ''}
                          className="rounded-xl min-h-[44px]"
                          required={q.required}
                        />
                      )}
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <Label htmlFor="guest-notes" className="text-xs font-semibold">
                      Please share anything that will help prepare for our meeting
                    </Label>
                    <Textarea
                      id="guest-notes"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Questions or topics to cover..."
                      rows={2}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCurrentStep('select_time')}
                    className="rounded-xl min-h-[44px]"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl min-h-[44px] px-6 font-semibold gap-2 shadow-sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Confirm Booking
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

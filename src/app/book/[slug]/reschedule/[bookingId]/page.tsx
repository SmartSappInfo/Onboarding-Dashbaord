'use client';

/**
 * @fileoverview Self-Service Booking Reschedule Portal (Meetings 2.0).
 * Allows an attendee to pick a new available date and time, locking the new slot
 * and transferring their reservation with 1 click.
 */

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
  RotateCcw,
  Globe,
  Video,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  startOfDay,
} from 'date-fns';
import type { AvailableSlot, PublicBookingPageData } from '@/lib/meetings/types';
import {
  getPublicBookingPageDataAction,
  getAvailableSlotsAction,
  acquireBookingHoldAction,
  rescheduleBookingAction,
} from '@/app/actions/booking-actions';
import { cn } from '@/lib/utils';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function RescheduleBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const slug = params.slug as string;
  const bookingId = params.bookingId as string;
  const manageToken = searchParams.get('token') || '';

  const sessionId = React.useMemo(() => {
    if (typeof window === 'undefined') return 'session_default';
    let sid = sessionStorage.getItem('smartsapp_booking_sid');
    if (!sid) {
      sid = `sid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('smartsapp_booking_sid', sid);
    }
    return sid;
  }, []);

  const [pageData, setPageData] = React.useState<PublicBookingPageData | null>(null);
  const [visitorTimezone, setVisitorTimezone] = React.useState('UTC');
  const [isLoading, setIsLoading] = React.useState(true);

  const [currentMonth, setCurrentMonth] = React.useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [slotsByDate, setSlotsByDate] = React.useState<Record<string, AvailableSlot[]>>({});
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(false);
  const [isRescheduling, setIsRescheduling] = React.useState(false);

  // Detect Timezone
  React.useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setVisitorTimezone(detected);
    } catch {}
  }, []);

  // Load Event Type
  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await getPublicBookingPageDataAction(slug);
        if (res.success && res.data) {
          setPageData(res.data);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Event not found.' });
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [slug, toast]);

  // Fetch Slots
  React.useEffect(() => {
    if (!pageData) return;
    async function fetchSlots() {
      setIsLoadingSlots(true);
      try {
        const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

        const res = await getAvailableSlotsAction({
          eventTypeId: pageData!.eventType.id,
          startDate: monthStart,
          endDate: monthEnd,
          visitorTimezone,
        });

        if (res.success && res.slots) {
          setSlotsByDate(res.slots);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [pageData, currentMonth, visitorTimezone]);

  const daysInMonth = React.useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Handle Pick New Slot to Reschedule
  const handleSelectNewSlot = async (slot: AvailableSlot) => {
    if (!pageData) return;
    setIsRescheduling(true);

    try {
      // 1. Acquire hold on new slot
      const holdRes = await acquireBookingHoldAction({
        eventTypeId: pageData.eventType.id,
        startAt: slot.start,
        endAt: slot.end,
        sessionId,
      });

      if (!holdRes.success || !holdRes.holdId) {
        toast({
          variant: 'destructive',
          title: 'Slot Unavailable',
          description: holdRes.error || 'This slot is no longer available.',
        });
        return;
      }

      // 2. Reschedule booking
      const res = await rescheduleBookingAction({
        bookingId,
        newHoldId: holdRes.holdId,
        sessionId,
        manageToken,
      });

      if (res.success) {
        toast({ title: 'Booking Rescheduled!', description: 'Your new appointment is confirmed.' });
        router.push(`/book/${slug}/confirmed?bookingId=${bookingId}${manageToken ? `&token=${manageToken}` : ''}`);
      } else {
        toast({ variant: 'destructive', title: 'Reschedule Failed', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsRescheduling(false);
    }
  };

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const availableSlots = selectedDateKey ? slotsByDate[selectedDateKey] || [] : [];

  if (isLoading || !pageData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-6 lg:p-12">
      <Card className="w-full max-w-3xl rounded-3xl border border-border shadow-xl overflow-hidden bg-card">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <div className="flex items-center gap-3">
            <Link href={`/book/${slug}/confirmed?bookingId=${bookingId}${manageToken ? `&token=${manageToken}` : ''}`}>
              <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-primary" />
                <CardTitle className="text-lg">Reschedule Session</CardTitle>
              </div>
              <CardDescription>
                Select a new time for <strong>{pageData.eventType.name}</strong>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
            {/* Calendar Month View */}
            <div className="sm:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
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

              <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground pb-1">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              <div className="grid grid-cols-7 gap-1">
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
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots */}
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
                  Please choose a date on the calendar.
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No slots available on this date.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {availableSlots.map(slot => (
                    <Button
                      key={slot.start}
                      type="button"
                      variant="outline"
                      disabled={isRescheduling}
                      onClick={() => handleSelectNewSlot(slot)}
                      className="w-full rounded-xl min-h-[44px] justify-center font-semibold text-xs hover:bg-primary hover:text-primary-foreground transition-all"
                    >
                      {slot.formattedTime}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

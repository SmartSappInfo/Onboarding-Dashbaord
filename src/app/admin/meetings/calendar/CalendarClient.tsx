'use client';

/**
 * @fileoverview High-Performance Calendar Hub Client (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Supports Day, 3-Day, Week, Month Grid (7-column matrix), and Agenda views.
 * - Integrates slide-over CalendarEventDetailDrawer on event click.
 * - In-memory event source filtering (All, 1:1 Consultations, Group Sessions).
 * - Exact calendar month date navigation via date-fns addMonths/subMonths.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Radio,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getWorkspaceCalendarEventsAction } from '@/app/actions/meeting-calendar-actions';
import type {
  CalendarGridEvent,
  CalendarViewMode,
} from '@/lib/meetings/types/calendar-view';
import {
  buildHourSlots,
  getCalendarGridDays,
} from '@/lib/meetings/calendar-view-service';
import {
  format,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isSameMonth,
} from 'date-fns';
import { QuickScheduleModal } from '../components/QuickScheduleModal';
import { CalendarEventDetailDrawer } from './components/CalendarEventDetailDrawer';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { isMeetingLiveNow } from '@/lib/meetings/unified-meeting-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export type EventSourceFilter = 'all' | '1to1' | 'group';

export function CalendarClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>('week');
  const [events, setEvents] = React.useState<CalendarGridEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [sourceFilter, setSourceFilter] = React.useState<EventSourceFilter>('all');

  // Quick schedule state
  const [scheduleModalOpen, setScheduleModalOpen] = React.useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = React.useState<Date>(new Date());
  const [selectedSlotHour, setSelectedSlotHour] = React.useState<number>(10);

  // Event detail drawer state
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarGridEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const fetchEvents = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const days = getCalendarGridDays(currentDate, viewMode);
      const startIso = new Date(days[0].getTime()).toISOString();
      const endIso = new Date(days[days.length - 1].getTime() + 86400000).toISOString();

      const res = await getWorkspaceCalendarEventsAction(activeWorkspaceId, startIso, endIso);
      if (res.success && res.events) {
        setEvents(res.events);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to load calendar events',
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, currentDate, viewMode, toast]);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Safe calendar navigation
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else if (viewMode === 'day') {
      setCurrentDate(prev => subDays(prev, 1));
    } else if (viewMode === '3day') {
      setCurrentDate(prev => subDays(prev, 3));
    } else {
      setCurrentDate(prev => subDays(prev, 7));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (viewMode === '3day') {
      setCurrentDate(prev => addDays(prev, 3));
    } else {
      setCurrentDate(prev => addDays(prev, 7));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedSlotDate(date);
    setSelectedSlotHour(hour);
    setScheduleModalOpen(true);
  };

  const handleEventClick = (evt: CalendarGridEvent) => {
    setSelectedEvent(evt);
    setDrawerOpen(true);
  };

  const gridDays = React.useMemo(() => {
    return getCalendarGridDays(currentDate, viewMode);
  }, [currentDate, viewMode]);

  const hourSlots = React.useMemo(() => {
    return buildHourSlots(8, 20);
  }, []);

  // Filter events in memory by source type
  const filteredEvents = React.useMemo(() => {
    if (sourceFilter === '1to1') {
      return events.filter(e => e.contactName || e.contactEmail || e.sourceType === 'booking_hold');
    }
    if (sourceFilter === 'group') {
      return events.filter(e => !e.contactName && !e.contactEmail && !e.isExternalCollision);
    }
    return events;
  }, [events, sourceFilter]);

  // Dynamic header date label
  const headerTitle = React.useMemo(() => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy');
    }
    if (viewMode === 'day') {
      return format(gridDays[0], 'EEEE, MMMM d, yyyy');
    }
    if (gridDays.length > 1) {
      const start = gridDays[0];
      const end = gridDays[gridDays.length - 1];
      if (format(start, 'MMM yyyy') === format(end, 'MMM yyyy')) {
        return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
      }
      return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return format(gridDays[0], 'MMMM yyyy');
  }, [viewMode, currentDate, gridDays]);

  return (
    <div className="space-y-6">
      {/* Calendar Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Navigation and Date Title */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/80">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8 rounded-lg active:scale-[0.97]"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="h-8 text-xs font-semibold px-3 rounded-lg active:scale-[0.97]"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8 rounded-lg active:scale-[0.97]"
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-base font-bold text-foreground tracking-tight">
            {headerTitle}
          </h2>
        </div>

        {/* Center/Right: Source Filter Pills + View Selector + Quick Schedule Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Source Filter Segmented Pill */}
          <div className="flex items-center p-1 bg-muted/40 rounded-xl border border-border/80 text-xs">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors active:scale-[0.97] ${
                sourceFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => setSourceFilter('1to1')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors active:scale-[0.97] ${
                sourceFilter === '1to1'
                  ? 'bg-background text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              1:1 Bookings
            </button>
            <button
              onClick={() => setSourceFilter('group')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors active:scale-[0.97] ${
                sourceFilter === 'group'
                  ? 'bg-background text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Group Sessions
            </button>
          </div>

          {/* View Mode Selector */}
          <Select
            value={viewMode}
            onValueChange={v => setViewMode(v as CalendarViewMode)}
          >
            <SelectTrigger className="rounded-xl h-9 text-xs w-32 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="day">Day View</SelectItem>
              <SelectItem value="3day">3-Day View</SelectItem>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="month">Month View</SelectItem>
              <SelectItem value="agenda">Agenda List</SelectItem>
            </SelectContent>
          </Select>

          {/* Quick Schedule Button */}
          <Button
            onClick={() => setScheduleModalOpen(true)}
            className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs font-semibold gap-1.5 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Main Calendar Display */}
      {isLoading ? (
        <Skeleton className="h-[600px] w-full rounded-3xl" />
      ) : viewMode === 'month' ? (
        /* Month 7-Column Grid View */
        <Card className="rounded-3xl border border-border/80 shadow-xs overflow-hidden bg-card">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 border-b border-border/80 bg-muted/30 text-center font-bold text-[11px] text-muted-foreground py-2.5">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 divide-x divide-y border-b border-border/80">
            {gridDays.map((dayDate, dayIdx) => {
              const dayDateStr = format(dayDate, 'yyyy-MM-dd');
              const isToday = dayDateStr === format(new Date(), 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(dayDate, currentDate);

              const dayEvents = filteredEvents.filter(evt => {
                return format(new Date(evt.startAt), 'yyyy-MM-dd') === dayDateStr;
              });

              const visibleEvents = dayEvents.slice(0, 3);
              const overflowCount = dayEvents.length - 3;

              return (
                <div
                  key={dayIdx}
                  onClick={() => handleSlotClick(dayDate, 10)}
                  className={`min-h-[115px] p-2 transition-colors cursor-pointer flex flex-col justify-between hover:bg-primary/5 ${
                    !isCurrentMonth ? 'bg-muted/10 opacity-50' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-primary text-primary-foreground font-black shadow-xs'
                          : isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {format(dayDate, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden flex-1">
                    {visibleEvents.map(evt => {
                      const isLive = isMeetingLiveNow(evt.startAt, evt.endAt);
                      return (
                        <div
                          key={evt.id}
                          onClick={e => {
                            e.stopPropagation();
                            handleEventClick(evt);
                          }}
                          className={`p-1 rounded-md text-[10px] font-semibold text-white truncate shadow-xs flex items-center gap-1 hover:brightness-110 active:scale-[0.98] transition-transform ${
                            isLive ? 'ring-2 ring-rose-500 animate-pulse' : ''
                          }`}
                          style={{ backgroundColor: evt.color || '#3b82f6' }}
                          title={`${evt.title} (${format(new Date(evt.startAt), 'p')})`}
                        >
                          <span className="opacity-90 shrink-0">{format(new Date(evt.startAt), 'p')}</span>
                          <span className="truncate">{evt.title}</span>
                        </div>
                      );
                    })}

                    {overflowCount > 0 && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setCurrentDate(dayDate);
                          setViewMode('day');
                        }}
                        className="text-[10px] font-bold text-primary hover:underline block pt-0.5 text-left"
                      >
                        +{overflowCount} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : viewMode === 'agenda' ? (
        /* Agenda List Mode */
        <Card className="rounded-3xl border border-border/80 shadow-xs p-6 space-y-4 bg-card">
          <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-foreground">Upcoming Agenda</CardTitle>
              <CardInfoTooltip text="Chronological list of all scheduled events and collision holds." />
            </div>
            <CardDescription className="sr-only">
              Chronological list of all scheduled events and collision holds
            </CardDescription>
          </CardHeader>

          <div className="space-y-2.5">
            {filteredEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-12 text-center">
                No meetings matching the selected filter for this period.
              </p>
            ) : (
              filteredEvents.map(evt => {
                const isLive = isMeetingLiveNow(evt.startAt, evt.endAt);
                const is1to1 = !!(evt.contactName || evt.contactEmail);

                return (
                  <div
                    key={evt.id}
                    onClick={() => handleEventClick(evt)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs active:scale-[0.99] ${
                      isLive
                        ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20'
                        : 'border-border/70 bg-muted/20 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-1.5 h-11 rounded-full shrink-0"
                        style={{ backgroundColor: evt.color || '#3b82f6' }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-foreground truncate hover:text-primary transition-colors">
                            {evt.title}
                          </h4>
                          {isLive && (
                            <Badge className="bg-rose-600 text-white font-bold text-[9px] uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                              <Radio className="w-2 h-2" /> Live
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {format(new Date(evt.startAt), 'EEE, MMM d, p')} – {format(new Date(evt.endAt), 'p')} • {evt.hostName || 'Host'}
                          {is1to1 && evt.contactName ? ` • With ${evt.contactName}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          is1to1
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200/50'
                            : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200/50'
                        }`}
                      >
                        {is1to1 ? '1:1 Booking' : 'Group Session'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl min-h-[44px] sm:min-h-[32px] text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      ) : (
        /* Multi-Day Grid View (Day, 3-Day, Week) */
        <Card className="rounded-3xl border border-border/80 shadow-xs overflow-x-auto bg-card">
          <div className="min-w-[700px]">
            {/* Day Header Row */}
            <div className="grid grid-cols-[80px_repeat(auto-fit,minmax(100px,1fr))] border-b border-border/80 bg-muted/30">
              <div className="p-3 text-[11px] font-bold text-muted-foreground text-center border-r border-border/80">
                Time
              </div>
              {gridDays.map((d, i) => {
                const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div
                    key={i}
                    className={`p-3 text-center border-r border-border/80 last:border-r-0 ${
                      isToday ? 'bg-primary/5 text-primary' : ''
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      {format(d, 'EEE')}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {format(d, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hours & Grid Columns */}
            <div className="divide-y divide-border/80 relative">
              {hourSlots.filter(h => h.minute === 0).map((h, hourIdx) => (
                <div
                  key={hourIdx}
                  className="grid grid-cols-[80px_repeat(auto-fit,minmax(100px,1fr))] min-h-[56px]"
                >
                  <div className="p-2 text-[10px] font-semibold text-muted-foreground text-center border-r border-border/80">
                    {h.timeStr}
                  </div>

                  {gridDays.map((dayDate, dayIdx) => {
                    const dayDateStr = format(dayDate, 'yyyy-MM-dd');
                    // Find events on this day and hour
                    const dayEvents = filteredEvents.filter(evt => {
                      const eDate = new Date(evt.startAt);
                      return (
                        format(eDate, 'yyyy-MM-dd') === dayDateStr &&
                        eDate.getHours() === h.hour
                      );
                    });

                    return (
                      <div
                        key={dayIdx}
                        onClick={() => handleSlotClick(dayDate, h.hour)}
                        className="p-1 border-r border-border/80 last:border-r-0 hover:bg-primary/5 transition-colors cursor-pointer relative min-h-[56px]"
                      >
                        {dayEvents.map(evt => {
                          const isLive = isMeetingLiveNow(evt.startAt, evt.endAt);
                          return (
                            <div
                              key={evt.id}
                              onClick={e => {
                                e.stopPropagation();
                                handleEventClick(evt);
                              }}
                              className={`p-1.5 rounded-lg text-[10px] font-semibold text-white truncate shadow-xs mb-1 hover:brightness-110 active:scale-[0.98] transition-transform ${
                                isLive ? 'ring-2 ring-rose-500 animate-pulse' : ''
                              }`}
                              style={{ backgroundColor: evt.color || '#3b82f6' }}
                              title={`${evt.title} (${format(new Date(evt.startAt), 'p')} - ${format(new Date(evt.endAt), 'p')})`}
                            >
                              <span className="block truncate">{evt.title}</span>
                              <span className="text-[9px] opacity-90 block">
                                {format(new Date(evt.startAt), 'p')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Quick Schedule Modal */}
      <QuickScheduleModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        defaultDate={selectedSlotDate}
        defaultHour={selectedSlotHour}
        onSuccess={fetchEvents}
      />

      {/* Interactive Calendar Event Detail Drawer */}
      <CalendarEventDetailDrawer
        event={selectedEvent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}

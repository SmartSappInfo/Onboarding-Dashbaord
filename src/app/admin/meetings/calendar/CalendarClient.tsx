'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Video,
  User,
  AlertTriangle,
  Layers,
  Sparkles,
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
  calculateEventGridPosition,
} from '@/lib/meetings/calendar-view-service';
import { format } from 'date-fns';
import { QuickScheduleModal } from '../components/QuickScheduleModal';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function CalendarClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>('week');
  const [events, setEvents] = React.useState<CalendarGridEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Quick schedule state
  const [scheduleModalOpen, setScheduleModalOpen] = React.useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = React.useState<Date>(new Date());
  const [selectedSlotHour, setSelectedSlotHour] = React.useState<number>(10);

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

  const handlePrev = () => {
    const shiftDays = viewMode === 'day' ? 1 : viewMode === '3day' ? 3 : viewMode === 'month' ? 30 : 7;
    setCurrentDate(prev => new Date(prev.getTime() - shiftDays * 86400000));
  };

  const handleNext = () => {
    const shiftDays = viewMode === 'day' ? 1 : viewMode === '3day' ? 3 : viewMode === 'month' ? 30 : 7;
    setCurrentDate(prev => new Date(prev.getTime() + shiftDays * 86400000));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedSlotDate(date);
    setSelectedSlotHour(hour);
    setScheduleModalOpen(true);
  };

  const gridDays = getCalendarGridDays(currentDate, viewMode);
  const hourSlots = buildHourSlots(8, 20);

  return (
    <div className="space-y-6">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8 rounded-lg active:scale-[0.97]"
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
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-base font-bold text-foreground">
            {format(gridDays[0], 'MMMM yyyy')}
          </h2>
        </div>

        {/* View Mode Selector + Quick Schedule Button */}
        <div className="flex items-center gap-2">
          <Select
            value={viewMode}
            onValueChange={v => setViewMode(v as CalendarViewMode)}
          >
            <SelectTrigger className="rounded-xl h-10 text-xs w-32 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="day">Day View</SelectItem>
              <SelectItem value="3day">3-Day View</SelectItem>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="agenda">Agenda List</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => setScheduleModalOpen(true)}
            className="rounded-xl min-h-[40px] text-xs font-semibold gap-1.5 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Main Calendar Display */}
      {isLoading ? (
        <Skeleton className="h-[600px] w-full rounded-3xl" />
      ) : viewMode === 'agenda' ? (
        /* Agenda List Mode */
        <Card className="rounded-3xl border shadow-sm p-6 space-y-4">
          <CardHeader className="p-0 pb-3 border-b">
            <CardTitle className="text-base font-bold">Upcoming Agenda</CardTitle>
            <CardDescription className="text-xs">Chronological list of all scheduled events and collision holds</CardDescription>
          </CardHeader>
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No meetings scheduled for this period.</p>
            ) : (
              events.map(evt => (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-2xl border bg-muted/20 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-1.5 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: evt.color || '#3b82f6' }}
                    />
                    <div>
                      <h4 className="font-bold text-foreground">{evt.title}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(evt.startAt), 'EEE, MMM d, p')} – {format(new Date(evt.endAt), 'p')} • {evt.hostName || 'Host'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                    {evt.status || evt.sourceType}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : (
        /* Multi-Day Grid View */
        <Card className="rounded-3xl border shadow-sm overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day Header Row */}
            <div className="grid grid-cols-[80px_repeat(auto-fit,minmax(100px,1fr))] border-b bg-muted/30">
              <div className="p-3 text-[11px] font-bold text-muted-foreground text-center border-r">
                Time
              </div>
              {gridDays.map((d, i) => (
                <div
                  key={i}
                  className={`p-3 text-center border-r last:border-r-0 ${
                    format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      ? 'bg-primary/5 text-primary'
                      : ''
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    {format(d, 'EEE')}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {format(d, 'd')}
                  </span>
                </div>
              ))}
            </div>

            {/* Hours & Grid Columns */}
            <div className="divide-y relative">
              {hourSlots.filter(h => h.minute === 0).map((h, hourIdx) => (
                <div
                  key={hourIdx}
                  className="grid grid-cols-[80px_repeat(auto-fit,minmax(100px,1fr))] min-h-[56px]"
                >
                  <div className="p-2 text-[10px] font-semibold text-muted-foreground text-center border-r">
                    {h.timeStr}
                  </div>

                  {gridDays.map((dayDate, dayIdx) => {
                    const dayDateStr = format(dayDate, 'yyyy-MM-dd');
                    // Find events on this day and hour
                    const dayEvents = events.filter(evt => {
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
                        className="p-1 border-r last:border-r-0 hover:bg-primary/5 transition-colors cursor-pointer relative min-h-[56px]"
                      >
                        {dayEvents.map(evt => (
                          <div
                            key={evt.id}
                            onClick={e => {
                              e.stopPropagation();
                              if (evt.joinUrl) window.open(evt.joinUrl, '_blank');
                            }}
                            className="p-1.5 rounded-lg text-[10px] font-semibold text-white truncate shadow-sm mb-1"
                            style={{ backgroundColor: evt.color || '#3b82f6' }}
                            title={`${evt.title} (${format(new Date(evt.startAt), 'p')} - ${format(new Date(evt.endAt), 'p')})`}
                          >
                            <span className="block truncate">{evt.title}</span>
                            <span className="text-[9px] opacity-90 block">
                              {format(new Date(evt.startAt), 'p')}
                            </span>
                          </div>
                        ))}
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
    </div>
  );
}

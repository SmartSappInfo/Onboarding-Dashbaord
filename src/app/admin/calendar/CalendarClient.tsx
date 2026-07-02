'use client';

import * as React from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckSquare, 
  Video, 
  Sparkles, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Meeting, Task } from '@/lib/types';

interface UnifiedEvent {
  id: string;
  title: string;
  time: string; // ISO
  type: 'meeting' | 'task';
  colorClass: string;
  icon: React.ElementType;
  description?: string;
}

export default function CalendarClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());

  // 1. Memoized Firestore Queries (parallelized)
  const meetingsQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId 
      ? query(
          collection(firestore, 'meetings'), 
          where('workspaceIds', 'array-contains', activeWorkspaceId),
          orderBy('meetingTime', 'asc')
        ) 
      : null, 
  [firestore, activeWorkspaceId]);

  const tasksQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId 
      ? query(
          collection(firestore, 'tasks'), 
          where('workspaceId', '==', activeWorkspaceId),
          orderBy('dueDate', 'asc')
        ) 
      : null, 
  [firestore, activeWorkspaceId]);

  const { data: meetingsData, isLoading: loadingMeetings } = useCollection<Meeting>(meetingsQuery);
  const { data: tasksData, isLoading: loadingTasks } = useCollection<Task>(tasksQuery);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  // 2. Generate Calendar Grid days
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // 3. Map meetings and tasks to a unified format
  const events = React.useMemo<UnifiedEvent[]>(() => {
    const unified: UnifiedEvent[] = [];

    if (meetingsData) {
      meetingsData.forEach(m => {
        if (m.meetingTime) {
          unified.push({
            id: m.id,
            title: m.title || m.entityName || 'Unscheduled Session',
            time: m.meetingTime,
            type: 'meeting',
            colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
            icon: Video,
            description: m.meetingLink,
          });
        }
      });
    }

    if (tasksData) {
      tasksData.forEach(t => {
        if (t.dueDate) {
          unified.push({
            id: t.id,
            title: t.title || 'Untitled Task',
            time: t.dueDate,
            type: 'task',
            colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
            icon: CheckSquare,
            description: t.description,
          });
        }
      });
    }

    // Sort chronologically
    return unified.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [meetingsData, tasksData]);

  // 4. Filter events for selected date view
  const selectedDateEvents = React.useMemo(() => {
    return events.filter(e => isSameDay(parseISO(e.time), selectedDate));
  }, [events, selectedDate]);

  const isLoading = loadingMeetings || loadingTasks;

  return (
    <div className="space-y-8 pb-12 w-full text-left">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-emerald-500" />
            Workspace Calendar & Timeline
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Monitor meetings, tasks, and scheduling velocity across your team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleToday}
            className="h-10 rounded-xl font-bold active:scale-[0.97] transition-transform"
          >
            Today
          </Button>
          <div className="flex gap-1 bg-muted/20 p-1 rounded-xl border">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left column: Calendar Grid */}
        <Card className="lg:col-span-3 border-none bg-background/40 backdrop-blur-sm ring-1 ring-border rounded-[2rem] overflow-hidden shadow-2xl">
          <CardContent className="p-0">
            {/* Weekdays header */}
            <div className="grid grid-cols-7 border-b bg-muted/10">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-4 text-center text-[10px] font-bold tracking-widest text-muted-foreground uppercase opacity-60">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid body */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-24 min-h-[500px]">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-semibold text-muted-foreground mt-4">Syncing Timeline Events...</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 auto-rows-[1fr] min-h-[500px] bg-background/5">
                {days.map((day, idx) => {
                  const dayEvents = events.filter(e => isSameDay(parseISO(e.time), day));
                  const isSelectedMonth = isSameMonth(day, currentMonth);
                  const isTodayDate = isToday(day);
                  const isSelected = isSameDay(day, selectedDate);

                  return (
                    <div 
                      key={day.toString()} 
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "min-h-[100px] border-r border-b border-border/50 p-2.5 transition-all flex flex-col gap-2 group cursor-pointer relative",
                        !isSelectedMonth && "bg-muted/5 opacity-30 pointer-events-none",
                        isTodayDate && "bg-emerald-500/5",
                        isSelected && "ring-2 ring-primary bg-primary/5",
                        idx % 7 === 6 && "border-r-0"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn(
                          "text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-md",
                          isTodayDate && "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25",
                          isSelected && !isTodayDate && "bg-primary text-primary-foreground font-bold"
                        )}>
                          {format(day, 'd')}
                        </span>
                        {dayEvents.length > 0 && (
                          <Badge variant="outline" className="text-[9px] font-bold bg-muted/40 h-5 px-1.5 rounded-lg border-none">
                            {dayEvents.length}
                          </Badge>
                        )}
                      </div>

                      {/* Display small dots or tags of events */}
                      <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className={cn(
                              "text-[9px] font-semibold px-2 py-1 rounded-lg border truncate leading-none",
                              event.colorClass
                            )}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[8px] font-bold text-muted-foreground/60 text-center">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Selected Date Events List */}
        <div className="space-y-6">
          <Card className="border-none bg-background/40 backdrop-blur-sm ring-1 ring-border rounded-[2rem] overflow-hidden shadow-2xl p-6">
            <h2 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              {format(selectedDate, 'MMMM d, yyyy')}
            </h2>

            <AnimatePresence mode="popLayout">
              {selectedDateEvents.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center justify-center p-8 text-center space-y-3"
                >
                  <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    No scheduled sessions or tasks on this day.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map(event => {
                    const IconComp = event.icon;
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className={cn(
                          "p-4 rounded-2xl border-2 shadow-sm cursor-pointer transition-all flex items-start gap-3",
                          event.colorClass
                        )}
                      >
                        <div className="p-2 rounded-xl bg-background/50 border shrink-0">
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5 opacity-60">
                            <Clock className="h-3 w-3" />
                            <span className="text-[10px] font-bold tabular-nums">
                              {format(parseISO(event.time), 'p')}
                            </span>
                          </div>
                          <h3 className="text-xs font-bold truncate leading-snug">
                            {event.title}
                          </h3>
                          {event.description && (
                            <p className="text-[9px] font-medium opacity-50 truncate">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </div>
  );
}

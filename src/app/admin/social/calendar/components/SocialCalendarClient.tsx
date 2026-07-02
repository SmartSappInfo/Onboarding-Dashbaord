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
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Youtube, 
  Globe, 
  Sparkles, 
  Clock, 
  Loader2 
} from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import type { SocialPost } from '@/lib/types';
import { updatePostScheduleAction } from '@/app/actions/social-composer-actions';

const iconMap: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  youtube: Youtube,
};

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  facebook: { bg: 'bg-blue-500/10 dark:bg-blue-500/5', border: 'border-blue-500/20 dark:border-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  instagram: { bg: 'bg-pink-500/10 dark:bg-pink-500/5', border: 'border-pink-500/20 dark:border-pink-500/10', text: 'text-pink-600 dark:text-pink-400' },
  linkedin: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/5', border: 'border-indigo-500/20 dark:border-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
  x: { bg: 'bg-slate-500/10 dark:bg-slate-500/5', border: 'border-slate-500/20 dark:border-slate-500/10', text: 'text-slate-700 dark:text-slate-300' },
  youtube: { bg: 'bg-red-500/10 dark:bg-red-500/5', border: 'border-red-500/20 dark:border-red-500/10', text: 'text-red-600 dark:text-red-400' },
};

interface DroppableDayProps {
  id: string;
  children: React.ReactNode;
  isToday: boolean;
  isCurrentMonth: boolean;
}

function DroppableDay({ id, children, isToday, isCurrentMonth }: DroppableDayProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-32 p-2 border-b border-r border-border/20 transition-all duration-200 relative flex flex-col gap-1.5",
        !isCurrentMonth && "bg-muted/10 opacity-30",
        isToday && "bg-emerald-500/5 dark:bg-emerald-500/2",
        isOver && "bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/40"
      )}
    >
      <div className="flex justify-between items-center mb-1">
        <span className={cn(
          "text-[10px] font-extrabold px-2 py-0.5 rounded-full select-none",
          isToday 
            ? "bg-emerald-500 text-white" 
            : "text-muted-foreground bg-muted/30"
        )}>
          {id.split('-')[2]}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-24 scrollbar-none">
        {children}
      </div>
    </div>
  );
}

interface DraggablePostCardProps {
  id: string;
  postId: string;
  platform: string;
  title: string;
  caption: string;
  timeDisplay: string;
  platformColors: { bg: string; border: string; text: string };
  Icon: React.ElementType;
}

function DraggablePostCard({ 
  id, 
  title, 
  timeDisplay, 
  platformColors, 
  Icon 
}: DraggablePostCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "px-2.5 py-2 border rounded-xl cursor-grab active:cursor-grabbing text-[10px] font-semibold flex flex-col gap-1 shadow-sm select-none hover:shadow-md transition-all active:scale-[0.97] duration-150 relative",
        platformColors.bg,
        platformColors.border,
        platformColors.text,
        isDragging && "opacity-40 z-50 scale-105 shadow-2xl border-emerald-500"
      )}
    >
      <div className="flex items-center gap-1.5 font-bold truncate">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{title}</span>
      </div>
      <div className="flex items-center gap-1 opacity-60 text-[9px] font-medium">
        <Clock className="h-3 w-3" />
        <span>{timeDisplay}</span>
      </div>
    </div>
  );
}

interface MappedEvent {
  id: string; // postId_platform
  postId: string;
  platform: string;
  title: string;
  caption: string;
  scheduledDate: Date;
  timeDisplay: string;
  rawTime: string;
}

export default function SocialCalendarClient() {
  const db = useFirestore();
  const { activeWorkspaceId } = useTenant();
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());

  // 1. Fetch Social Posts from Firestore
  const postsQuery = React.useMemo(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialPosts'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [db, activeWorkspaceId]);

  const { data: postsRaw, isLoading } = useCollection<SocialPost>(postsQuery);
  const posts = postsRaw || [];

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

  // 3. Map variations into flat events
  const events = React.useMemo<MappedEvent[]>(() => {
    const list: MappedEvent[] = [];

    posts.forEach((post) => {
      Object.entries(post.platformVariations).forEach(([platform, variation]) => {
        try {
          const dateObj = parseISO(variation.scheduledTime);
          if (isNaN(dateObj.getTime())) return;

          list.push({
            id: `${post.id}_${platform}`,
            postId: post.id,
            platform,
            title: post.contentObject.title,
            caption: variation.caption,
            scheduledDate: dateObj,
            timeDisplay: format(dateObj, 'h:mm a'),
            rawTime: variation.scheduledTime,
          });
        } catch {
          // Skip invalid date variations safely
        }
      });
    });

    return list;
  }, [posts]);

  // 4. Handle Drag and Drop Schedule Updates
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const eventId = String(active.id);
    const targetDateStr = String(over.id); // 'YYYY-MM-DD'

    const eventObj = events.find(e => e.id === eventId);
    if (!eventObj) return;

    try {
      // Retain the original hour and minutes of the post, but shift the calendar date
      const [year, month, day] = targetDateStr.split('-').map(Number);
      const originalTime = new Date(eventObj.rawTime);
      
      const newDate = new Date(originalTime);
      newDate.setFullYear(year, month - 1, day);
      const newIso = newDate.toISOString();

      // Optimistic UI updates are handled automatically by Firestore collection subscription.
      // Call Server Action
      const res = await updatePostScheduleAction(eventObj.postId, eventObj.platform, newIso);

      if (res.success) {
        toast({
          title: 'Schedule Updated',
          description: `Rescheduled ${eventObj.title} on ${eventObj.platform} to ${format(newDate, 'MMM d, h:mm a')}`,
        });
      } else {
        throw new Error(res.error || 'Reschedule API failed');
      }

    } catch (err: unknown) {
      console.error('[CALENDAR:DRAG] Reschedule failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown rescheduling error';
      toast({
        title: 'Error Rescheduling',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  return (
    <PageContainerFluid className="space-y-6 max-w-6xl mx-auto py-8">
      {/* Calendar Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <CalendarIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Content Calendar</h1>
            <p className="text-muted-foreground text-xs font-medium">Manage and schedule posts via drag-and-drop on the monthly planner grid.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="outline" size="icon" onClick={handlePrevMonth} className="rounded-xl h-9 w-9 active:scale-[0.97] transition-all">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday} className="rounded-xl h-9 px-4 font-semibold text-xs active:scale-[0.97] transition-all">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="rounded-xl h-9 w-9 active:scale-[0.97] transition-all">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-bold text-sm tracking-wide ml-2 bg-muted/40 py-1.5 px-4 rounded-xl border border-border/20">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
        </div>
      </div>

      {isLoading ? (
        <Card className="border border-border/30 rounded-3xl bg-card/40 backdrop-blur-md">
          <CardContent className="h-96 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading calendar...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <Card className="border border-border/30 rounded-3xl bg-card/30 backdrop-blur-md overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/2 to-transparent pointer-events-none" />
            
            {/* Grid Headers */}
            <div className="grid grid-cols-7 border-b border-border/30 bg-muted/10 text-center font-bold text-[10px] tracking-wider uppercase py-3 text-muted-foreground">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 bg-background/30">
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = events.filter((e) => isSameDay(e.scheduledDate, day));
                const currentMonthCheck = isSameMonth(day, currentMonth);
                const isTodayCheck = isToday(day);

                return (
                  <DroppableDay 
                    key={dateKey} 
                    id={dateKey} 
                    isToday={isTodayCheck} 
                    isCurrentMonth={currentMonthCheck}
                  >
                    {dayEvents.map((evt) => {
                      const Icon = iconMap[evt.platform] || Globe;
                      const colors = colorMap[evt.platform] || { bg: 'bg-muted/10', border: 'border-border/10', text: 'text-foreground' };

                      return (
                        <DraggablePostCard
                          key={evt.id}
                          id={evt.id}
                          postId={evt.postId}
                          platform={evt.platform}
                          title={evt.title}
                          caption={evt.caption}
                          timeDisplay={evt.timeDisplay}
                          platformColors={colors}
                          Icon={Icon}
                        />
                      );
                    })}
                  </DroppableDay>
                );
              })}
            </div>
          </Card>
        </DndContext>
      )}
    </PageContainerFluid>
  );
}

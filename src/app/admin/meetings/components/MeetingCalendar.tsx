
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
    isToday
} from 'date-fns';
import { 
    ChevronLeft, 
    ChevronRight, 
    Calendar as CalendarIcon, 
    Clock, 
    Building,
    Zap,
    Users,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Meeting } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface MeetingCalendarProps {
    meetings: Meeting[];
    onMeetingClick: (meeting: Meeting) => void;
}

/**
 * @fileOverview Institutional Meeting Calendar.
 * High-fidelity temporal grid for managing session velocity.
 */
export default function MeetingCalendar({ meetings, onMeetingClick }: MeetingCalendarProps) {
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    const days = React.useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth));
        const end = endOfWeek(endOfMonth(currentMonth));
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const handleToday = () => setCurrentMonth(new Date());

    const getMeetingColor = (type: string) => {
        switch (type) {
            case 'parent': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'kickoff': return 'bg-orange-50 text-orange-600 border-orange-100';
            case 'training': return 'bg-purple-50 text-purple-600 border-purple-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    return (
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 sm:p-8 border-b bg-muted/10 gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                        <CalendarIcon className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">
                            {format(currentMonth, 'MMMM yyyy')}
                        </h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Session Timeline</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleToday} className="h-10 px-6 rounded-xl font-bold border-primary/20 text-primary bg-white shadow-sm transition-all active:scale-95">Today</Button>
                    <div className="flex gap-1 bg-white p-1 rounded-xl border shadow-inner">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePrevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 border-b bg-muted/5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-4 text-center text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-[1fr] min-h-[700px] bg-slate-100/30">
                {days.map((day, idx) => {
                    const dayMeetings = meetings.filter(m => isSameDay(new Date(m.meetingTime), day));
                    const isSelectedMonth = isSameMonth(day, currentMonth);
                    const isTodayDate = isToday(day);

                    return (
                        <div 
                            key={day.toString()} 
                            className={cn(
                                "min-h-[140px] border-r border-b p-3 transition-colors flex flex-col gap-3 group",
                                !isSelectedMonth && "bg-slate-100/50 grayscale-[0.5] opacity-20",
                                isTodayDate && "bg-primary/[0.03] ring-1 ring-inset ring-primary/10",
                                idx % 7 === 6 && "border-r-0"
                            )}
                        >
                            <div className="flex justify-between items-start">
                                <span className={cn(
                                    "text-xs font-black tabular-nums transition-all",
                                    isTodayDate ? "bg-primary text-white w-7 h-7 flex items-center justify-center rounded-xl shadow-lg scale-110" : "text-muted-foreground opacity-40 group-hover:opacity-100"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {dayMeetings.length > 0 && (
                                    <Badge className="bg-primary/10 text-primary border-none font-black tabular-nums h-5 px-1.5 rounded-lg text-[9px]">
                                        {dayMeetings.length}
                                    </Badge>
                                )}
                            </div>

                            <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar pb-2">
                                {dayMeetings.sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime()).map(meeting => (
                                    <button
                                        key={meeting.id}
                                        onClick={() => onMeetingClick(meeting)}
                                        className={cn(
                                            "w-full text-left p-2 rounded-xl border-2 transition-all hover:scale-[1.03] active:scale-95 shadow-sm group/meeting",
                                            getMeetingColor(meeting.type?.id || 'parent')
                                        )}
                                    >
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-1.5 opacity-60">
                                                <Clock className="h-2.5 w-2.5" />
                                                <span className="text-[8px] font-black uppercase tabular-nums">{format(new Date(meeting.meetingTime), 'p')}</span>
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-tight truncate leading-none mb-0.5">
                                                {meeting.entityName}
                                            </p>
                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                <Badge variant="outline" className="h-4 border-none p-0 text-[7px] font-bold uppercase opacity-60 truncate">
                                                    {meeting.type?.name}
                                                </Badge>
                                                <ArrowRight className="h-2.5 w-2.5 opacity-0 group-hover/meeting:opacity-40 transition-opacity" />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

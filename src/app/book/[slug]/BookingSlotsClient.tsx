'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { BookingPage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Video, 
  Sparkles,
  ArrowRight,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';

export interface TimeSlot {
  start: string;
  end: string;
}

interface BookingSlotsClientProps {
  bookingPage: BookingPage;
  initialDate: string;
  initialSlots: TimeSlot[];
}

export default function BookingSlotsClient({ bookingPage, initialDate, initialSlots }: BookingSlotsClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = React.useState<string>(initialDate);
  const [slots, setSlots] = React.useState<TimeSlot[]>(initialSlots);
  const [loading, setLoading] = React.useState<boolean>(false);

  // Fetch slots whenever the date changes
  React.useEffect(() => {
    if (selectedDate === initialDate) {
      setSlots(initialSlots);
      return;
    }
    
    const loadSlots = async () => {
      setLoading(true);
      try {
        const { getAvailableSlotsAction } = await import('@/app/actions/scheduler-actions');
        const res = await getAvailableSlotsAction(bookingPage.availabilityId, selectedDate, bookingPage.durationMinutes);
        if (res.success && res.data) {
          setSlots(res.data);
        } else {
          setSlots([]);
        }
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };

    loadSlots();
  }, [selectedDate, bookingPage.availabilityId, initialDate, initialSlots]);

  const handlePrevDay = () => {
    const prevDay = subDays(parseISO(selectedDate), 1);
    setSelectedDate(format(prevDay, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const nextDay = addDays(parseISO(selectedDate), 1);
    setSelectedDate(format(nextDay, 'yyyy-MM-dd'));
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    // Navigate to confirm page, passing the chosen time in query
    router.push(`/book/${bookingPage.slug}/confirm?time=${encodeURIComponent(slot.start)}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-3xl z-10"
    >
      <Card className="border-none bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-5">
          
          {/* Host / Page Info Pane */}
          <div className="md:col-span-2 p-8 bg-slate-950/40 border-r border-white/5 flex flex-col justify-between text-left space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border-none font-bold text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Scheduler
                </Badge>
              </div>

              <div className="space-y-2">
                <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
                  {bookingPage.title}
                </h1>
                {bookingPage.description && (
                  <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                    {bookingPage.description}
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold">{bookingPage.durationMinutes} Minutes</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Video className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold capitalize">
                    {bookingPage.meetingProvider.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none pt-8">
              Powered by SmartSapp
            </p>
          </div>

          {/* Date & Time Slot Grid */}
          <div className="md:col-span-3 p-8 flex flex-col justify-between space-y-6">
            
            {/* Header: Date Selector */}
            <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevDay}
                disabled={parseISO(selectedDate) <= new Date()}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5 justify-center">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  {format(parseISO(selectedDate), 'EEEE, MMMM d')}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextDay}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Body: Slots List */}
            <div className="flex-1 min-h-[250px] flex flex-col justify-center">
              {loading ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-12">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  <p className="text-xs font-bold text-slate-400 animate-pulse">Calculating free slots...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-12 text-slate-500">
                  <HelpCircle className="h-8 w-8 opacity-40" />
                  <p className="text-xs font-semibold">No available slots on this day.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {slots.map((slot, index) => (
                    <motion.button
                      key={slot.start}
                      onClick={() => handleSelectSlot(slot)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full text-left p-3.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-slate-200">
                        <Clock className="h-3.5 w-3.5 text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                        <span className="text-xs font-bold tabular-nums">
                          {format(parseISO(slot.start), 'p')}
                        </span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </Card>
    </motion.div>
  );
}

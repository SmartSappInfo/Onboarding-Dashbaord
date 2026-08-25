'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Video, Calendar, User, Clock, ArrowRight } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { getWorkspaceCalendarEventsAction } from '@/app/actions/meeting-calendar-actions';
import type { CalendarGridEvent } from '@/lib/meetings/types/calendar-view';

interface GlobalMeetingSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalMeetingSearchModal({ open, onOpenChange }: GlobalMeetingSearchModalProps) {
  const { activeWorkspaceId } = useWorkspace();
  const router = useRouter();

  const [query, setQuery] = React.useState('');
  const [allEvents, setAllEvents] = React.useState<CalendarGridEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch recent meetings when opened
  React.useEffect(() => {
    if (open && activeWorkspaceId) {
      setIsLoading(true);
      const now = Date.now();
      const startIso = new Date(now - 30 * 86400000).toISOString();
      const endIso = new Date(now + 60 * 86400000).toISOString();

      getWorkspaceCalendarEventsAction(activeWorkspaceId, startIso, endIso)
        .then(res => {
          if (res.success && res.events) {
            setAllEvents(res.events);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [open, activeWorkspaceId]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return allEvents.slice(0, 10);
    const q = query.toLowerCase().trim();

    return allEvents
      .filter(
        e =>
          e.title.toLowerCase().includes(q) ||
          e.contactName?.toLowerCase().includes(q) ||
          e.contactEmail?.toLowerCase().includes(q) ||
          e.hostName?.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [allEvents, query]);

  const handleSelectEvent = (evt: CalendarGridEvent) => {
    onOpenChange(false);
    if (evt.sourceType === 'meeting') {
      router.push(`/admin/meetings/${evt.sourceId}`);
    } else {
      router.push('/admin/meetings/calendar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search meetings by title, attendee name, email, or host..."
            className="pl-10 h-11 rounded-2xl text-xs"
          />
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Loading meetings...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No meetings found matching "{query}".
            </p>
          ) : (
            filtered.map(evt => (
              <div
                key={evt.id}
                onClick={() => handleSelectEvent(evt)}
                className="p-3 rounded-2xl border bg-muted/20 hover:bg-primary/5 hover:border-primary/30 transition-all flex items-center justify-between gap-3 cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: evt.color || '#3b82f6' }}
                  />
                  <div>
                    <span className="font-bold text-foreground block">{evt.title}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {format(new Date(evt.startAt), 'EEE, MMM d, p')} • {evt.hostName || 'Host'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px] uppercase font-bold">
                    {evt.status || evt.sourceType}
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

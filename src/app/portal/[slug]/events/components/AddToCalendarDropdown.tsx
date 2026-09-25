'use client';

/**
 * {{Org_name}} Experience Platform — Add to Calendar Dropdown
 *
 * Universal calendar synchronization menu supporting Google Calendar,
 * Outlook Web, Yahoo Calendar, and RFC 5545 .ics downloads.
 * Adheres to Emil Kowalski tactile states and >=44px mobile touch targets.
 */

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  generateCalendarWebUrls,
  downloadEventIcs,
} from '@/lib/utils/event-calendar-utils';
import type { LiveEvent } from '@/lib/types/events';
import {
  CalendarPlus,
  Calendar,
  Download,
  ExternalLink,
} from 'lucide-react';

interface AddToCalendarDropdownProps {
  event: Pick<
    LiveEvent,
    'id' | 'title' | 'slug' | 'description' | 'scheduledStartTime' | 'scheduledEndTime' | 'meetingUrl'
  > & {
    createdAt?: string;
  };
  variant?: 'outline' | 'default' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  buttonText?: string;
}

export function AddToCalendarDropdown({
  event,
  variant = 'outline',
  size = 'sm',
  className,
  buttonText = 'Add to Calendar',
}: AddToCalendarDropdownProps) {
  const { toast } = useToast();
  const calendarUrls = React.useMemo(() => generateCalendarWebUrls(event), [event]);

  const handleDownloadIcs = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      downloadEventIcs(event);
      toast({
        title: 'Calendar File Downloaded! 📅',
        description: 'Import this .ics file into Apple Calendar, Outlook, or your preferred calendar app.',
      });
    } catch {
      toast({
        title: 'Download Failed',
        description: 'Could not export calendar file. Please try the web calendar link.',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`min-h-[44px] rounded-xl font-bold text-xs gap-1.5 active:scale-[0.97] transition-all shadow-2xs ${className || ''}`}
        >
          <CalendarPlus className="w-3.5 h-3.5 text-primary" />
          <span>{buttonText}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl border-2 border-border shadow-xl">
        <DropdownMenuItem asChild className="min-h-[40px] rounded-xl cursor-pointer text-xs font-semibold focus:bg-primary/10">
          <a
            href={calendarUrls.google}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Google Calendar</span>
            </span>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="min-h-[40px] rounded-xl cursor-pointer text-xs font-semibold focus:bg-primary/10">
          <a
            href={calendarUrls.outlook}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-cyan-600" />
              <span>Outlook Web</span>
            </span>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="min-h-[40px] rounded-xl cursor-pointer text-xs font-semibold focus:bg-primary/10">
          <a
            href={calendarUrls.yahoo}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Yahoo Calendar</span>
            </span>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-border" />

        <DropdownMenuItem
          onClick={handleDownloadIcs}
          className="min-h-[40px] rounded-xl cursor-pointer text-xs font-semibold text-primary focus:bg-primary/10"
        >
          <span className="flex items-center gap-2 w-full">
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Apple iCal / Download .ics</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

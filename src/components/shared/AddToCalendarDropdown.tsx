'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CalendarPlus, ExternalLink, Download } from 'lucide-react';
import { generateUniversalCalendarLinks } from '@/lib/meetings/universal-calendar-links-service';
import type { CalendarEventPayload } from '@/lib/meetings/types/calendar-links';

interface AddToCalendarDropdownProps {
  event: CalendarEventPayload;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function AddToCalendarDropdown({
  event,
  className,
  variant = 'outline',
  size = 'default',
}: AddToCalendarDropdownProps) {
  const links = React.useMemo(() => generateUniversalCalendarLinks(event), [event]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`rounded-xl gap-2 font-semibold min-h-[44px] active:scale-[0.97] ${className || ''}`}
        >
          <CalendarPlus className="h-4 w-4 text-primary" />
          <span>Add to Calendar</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 text-xs shadow-lg">
        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5">
          <a
            href={links.googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between"
          >
            <span className="font-semibold">Google Calendar</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5">
          <a
            href={links.outlookWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between"
          >
            <span className="font-semibold">Outlook Web (365)</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5">
          <a
            href={links.outlookDesktopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between"
          >
            <span className="font-semibold">Outlook Live</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5">
          <a
            href={links.yahooCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between"
          >
            <span className="font-semibold">Yahoo Calendar</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5 border-t mt-1">
          <a href={links.icsDownloadUrl} download className="flex items-center justify-between">
            <span className="font-semibold">Apple Calendar / .ics</span>
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Video, CalendarCheck, Clock, Layers, CalendarDays, GitFork, Vote, Radio, Webhook, BarChart3, Building2, ShieldCheck, Search, Bot, Activity, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalMeetingSearchModal } from './GlobalMeetingSearchModal';
import { AISchedulingAssistantModal } from './AISchedulingAssistantModal';

interface MeetingsNavigationProps {
  className?: string;
  actions?: React.ReactNode;
}

export function MeetingsNavigation({ className, actions }: MeetingsNavigationProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = React.useState(false);

  const tabs = [
    {
      label: 'Overview',
      href: '/admin/meetings/overview',
      icon: BarChart3,
      active: pathname === '/admin/meetings/overview',
    },
    {
      label: 'Calendar',
      href: '/admin/meetings/calendar',
      icon: CalendarDays,
      active: pathname.startsWith('/admin/meetings/calendar'),
    },
    {
      label: 'Sessions & Webinars',
      href: '/admin/meetings',
      icon: Video,
      active: pathname === '/admin/meetings',
    },
    {
      label: 'Event Types',
      href: '/admin/meetings/event-types',
      icon: Layers,
      active: pathname.startsWith('/admin/meetings/event-types'),
    },
    {
      label: 'Availability',
      href: '/admin/meetings/availability',
      icon: Clock,
      active: pathname.startsWith('/admin/meetings/availability'),
    },
    {
      label: 'Bookings',
      href: '/admin/meetings/bookings',
      icon: CalendarCheck,
      active: pathname.startsWith('/admin/meetings/bookings'),
    },
    {
      label: 'Calendars',
      href: '/admin/meetings/calendars',
      icon: CalendarDays,
      active: pathname.startsWith('/admin/meetings/calendars'),
    },
    {
      label: 'Routing',
      href: '/admin/meetings/routing',
      icon: GitFork,
      active: pathname.startsWith('/admin/meetings/routing'),
    },
    {
      label: 'Polls',
      href: '/admin/meetings/polls',
      icon: Vote,
      active: pathname.startsWith('/admin/meetings/polls'),
    },
    {
      label: 'Office Hours',
      href: '/admin/meetings/office-hours',
      icon: Radio,
      active: pathname.startsWith('/admin/meetings/office-hours'),
    },
    {
      label: 'Resources',
      href: '/admin/meetings/resources',
      icon: Building2,
      active: pathname.startsWith('/admin/meetings/resources'),
    },
    {
      label: 'Compliance',
      href: '/admin/meetings/compliance',
      icon: ShieldCheck,
      active: pathname.startsWith('/admin/meetings/compliance'),
    },
    {
      label: 'Developer',
      href: '/admin/meetings/developer',
      icon: Webhook,
      active: pathname.startsWith('/admin/meetings/developer'),
    },
    {
      label: 'Templates',
      href: '/admin/meetings/templates',
      icon: Layers,
      active: pathname.startsWith('/admin/meetings/templates'),
    },
    {
      label: 'Telemetry',
      href: '/admin/meetings/telemetry',
      icon: Activity,
      active: pathname.startsWith('/admin/meetings/telemetry'),
    },
  ];

  return (
    <>
      <div className={cn('flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4 mb-6', className)}>
        <nav className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none" aria-label="Meetings Navigation">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] shrink-0',
                  tab.active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiAssistantOpen(true)}
            className="rounded-xl h-10 px-3 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/5 active:scale-[0.97]"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden md:inline font-semibold">AI Copilot</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="rounded-xl h-10 px-3 text-xs gap-2 text-muted-foreground hover:text-foreground active:scale-[0.97]"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Quick Search...</span>
          </Button>

          {actions}
        </div>
      </div>

      <GlobalMeetingSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <AISchedulingAssistantModal open={aiAssistantOpen} onOpenChange={setAiAssistantOpen} />
    </>
  );
}

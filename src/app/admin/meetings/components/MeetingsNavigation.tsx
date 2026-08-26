'use client';

/**
 * @fileoverview 5-Pillar Navigation Architecture for SmartSapp Meetings 2.0.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Groups 16 sub-views into 5 primary pillars: Home, Schedule, Experiences, Intelligence, Settings.
 * - Supports responsive mobile bottom bar and global quick actions.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  CalendarDays,
  CalendarCheck,
  Clock,
  Vote,
  Layers,
  Radio,
  BarChart3,
  Building2,
  ShieldCheck,
  Webhook,
  Activity,
  Search,
  Sparkles,
  Plus,
  GitFork,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlobalMeetingSearchModal } from './GlobalMeetingSearchModal';
import { AISchedulingAssistantModal } from './AISchedulingAssistantModal';
import { NewMeetingModal } from './NewMeetingModal';

interface MeetingsNavigationProps {
  className?: string;
  actions?: React.ReactNode;
}

type MainPillar = 'home' | 'schedule' | 'experiences' | 'intelligence' | 'settings';

interface SubTab {
  label: string;
  href: string;
  icon: React.ElementType;
}

export function MeetingsNavigation({ className, actions }: MeetingsNavigationProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = React.useState(false);
  const [newMeetingOpen, setNewMeetingOpen] = React.useState(false);

  // Keyboard shortcut listener for Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine active pillar based on pathname
  const activePillar: MainPillar = React.useMemo(() => {
    if (pathname === '/admin/meetings') return 'home';
    if (
      pathname === '/admin/meetings/calendar' ||
      pathname.startsWith('/admin/meetings/calendar/') ||
      pathname.startsWith('/admin/meetings/bookings') ||
      pathname.startsWith('/admin/meetings/availability') ||
      pathname.startsWith('/admin/meetings/polls')
    ) {
      return 'schedule';
    }
    if (
      pathname.startsWith('/admin/meetings/sessions') ||
      pathname.startsWith('/admin/meetings/event-types') ||
      pathname.startsWith('/admin/meetings/office-hours') ||
      pathname.startsWith('/admin/meetings/templates')
    ) {
      return 'experiences';
    }
    if (
      pathname.startsWith('/admin/meetings/overview') ||
      pathname.startsWith('/admin/meetings/recordings')
    ) {
      return 'intelligence';
    }
    if (
      pathname.startsWith('/admin/meetings/calendars') ||
      pathname.startsWith('/admin/meetings/routing') ||
      pathname.startsWith('/admin/meetings/resources') ||
      pathname.startsWith('/admin/meetings/compliance') ||
      pathname.startsWith('/admin/meetings/developer') ||
      pathname.startsWith('/admin/meetings/telemetry')
    ) {
      return 'settings';
    }
    return 'home';
  }, [pathname]);

  // Sub-navigation tabs for the active pillar
  const subTabs: Record<MainPillar, SubTab[]> = {
    home: [
      { label: 'Today & Overview', href: '/admin/meetings', icon: Home },
    ],
    schedule: [
      { label: 'Calendar', href: '/admin/meetings/calendar', icon: CalendarDays },
      { label: 'Bookings Hub', href: '/admin/meetings/bookings', icon: CalendarCheck },
      { label: 'Availability', href: '/admin/meetings/availability', icon: Clock },
      { label: 'Consensus Polls', href: '/admin/meetings/polls', icon: Vote },
    ],
    experiences: [
      { label: 'Sessions & Webinars', href: '/admin/meetings/sessions', icon: Layers },
      { label: 'Event Types', href: '/admin/meetings/event-types', icon: Layers },
      { label: 'Drop-In Office Hours', href: '/admin/meetings/office-hours', icon: Radio },
      { label: 'Templates Studio', href: '/admin/meetings/templates', icon: Layers },
    ],
    intelligence: [
      { label: 'Analytics & Heatmaps', href: '/admin/meetings/overview', icon: BarChart3 },
    ],
    settings: [
      { label: 'Connected Calendars', href: '/admin/meetings/calendars', icon: CalendarDays },
      { label: 'Routing Forms', href: '/admin/meetings/routing', icon: GitFork },
      { label: 'Physical Resources', href: '/admin/meetings/resources', icon: Building2 },
      { label: 'Compliance & GDPR', href: '/admin/meetings/compliance', icon: ShieldCheck },
      { label: 'Developer Webhooks', href: '/admin/meetings/developer', icon: Webhook },
      { label: 'Telemetry Vitals', href: '/admin/meetings/telemetry', icon: Activity },
    ],
  };

  const primaryPillars: Array<{ key: MainPillar; label: string; href: string; icon: React.ElementType }> = [
    { key: 'home', label: 'Home', href: '/admin/meetings', icon: Home },
    { key: 'schedule', label: 'Schedule', href: '/admin/meetings/calendar', icon: CalendarDays },
    { key: 'experiences', label: 'Experiences', href: '/admin/meetings/sessions', icon: Layers },
    { key: 'intelligence', label: 'Intelligence', href: '/admin/meetings/overview', icon: BarChart3 },
    { key: 'settings', label: 'Settings', href: '/admin/meetings/calendars', icon: Settings },
  ];

  return (
    <>
      <div className={cn('space-y-3 mb-6', className)}>
        {/* Top Header Bar: Primary Pillars + Quick Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 pb-3">
          {/* 5 Primary Pillars */}
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none" aria-label="Meetings Pillars">
            {primaryPillars.map(pillar => {
              const Icon = pillar.icon;
              const isActive = activePillar === pillar.key;
              return (
                <Link key={pillar.key} href={pillar.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'rounded-2xl text-xs font-bold gap-2 min-h-[40px] px-3.5 transition-all active:scale-[0.97]',
                      isActive
                        ? 'shadow-sm text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{pillar.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Right Global Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search (Cmd+K) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="rounded-2xl text-xs font-semibold gap-2 min-h-[40px] px-3 text-muted-foreground hover:text-foreground border-border/80 bg-background active:scale-[0.97]"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search meetings...</span>
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
                ⌘K
              </kbd>
            </Button>

            {/* AI Copilot */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiAssistantOpen(true)}
              className="rounded-2xl text-xs font-bold gap-1.5 min-h-[40px] px-3 text-purple-600 bg-purple-500/10 border-purple-200/50 hover:bg-purple-500/15 active:scale-[0.97]"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">AI Copilot</span>
            </Button>

            {/* Custom Slot Actions */}
            {actions}

            {/* + New Meeting Primary CTA */}
            <Button
              size="sm"
              onClick={() => setNewMeetingOpen(true)}
              className="rounded-2xl text-xs font-bold gap-1.5 min-h-[40px] px-4 shadow-sm active:scale-[0.97]"
            >
              <Plus className="w-4 h-4" />
              <span>New Meeting</span>
            </Button>
          </div>
        </div>

        {/* Dynamic Sub-Navigation Bar (when active pillar has >1 sub-tabs) */}
        {subTabs[activePillar].length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border/40 pb-2">
            {subTabs[activePillar].map(sub => {
              const SubIcon = sub.icon;
              const isSubActive =
                pathname === sub.href ||
                (sub.href === '/admin/meetings/calendar'
                  ? pathname.startsWith('/admin/meetings/calendar/')
                  : (sub.href !== '/admin/meetings' && pathname.startsWith(sub.href)));
              return (
                <Link key={sub.href} href={sub.href}>
                  <Button
                    variant={isSubActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'rounded-xl text-[11px] font-semibold gap-1.5 h-8 px-3 transition-colors',
                      isSubActive
                        ? 'bg-muted text-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Modals */}
      <GlobalMeetingSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <AISchedulingAssistantModal open={aiAssistantOpen} onOpenChange={setAiAssistantOpen} />
      <NewMeetingModal open={newMeetingOpen} onOpenChange={setNewMeetingOpen} />
    </>
  );
}

'use client';

/**
 * @fileOverview Live Platform Activity Stream (Analytics 2.0)
 *
 * Real-time telemetry feed displaying platform events across authentication, workforce, CRM, and governance.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski kinetic scroll physics and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Activity,
  RefreshCw,
  LogIn,
  LogOut,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlatformEvent, PlatformEventCategory } from '@/lib/types';
import { listPlatformEventsAction } from '@/app/actions/analytics-actions';

export function LiveActivityStream() {
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [events, setEvents] = React.useState<PlatformEvent[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<PlatformEventCategory | 'all'>('all');
  const [isLoading, setIsLoading] = React.useState(false);

  const loadEvents = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await listPlatformEventsAction({
        idToken,
        organizationId: activeOrganizationId,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        limitCount: 50,
      });

      if (res.success) {
        setEvents(res.events);
      }
    } catch (err: unknown) {
      console.warn('[LiveActivityStream] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId, selectedCategory]);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const getEventIcon = (category: PlatformEventCategory) => {
    switch (category) {
      case 'auth':
        return <LogIn className="w-3.5 h-3.5 text-blue-500" />;
      case 'governance':
        return <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />;
      case 'onboarding':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
      case 'crm':
        return <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-primary" />;
    }
  };

  return (
    <Card className="border bg-card shadow-xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold">Real-Time Platform Telemetry</CardTitle>
          <CardDescription className="text-xs">
            Live stream of workforce actions, CRM operations, and system events
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {(['all', 'auth', 'workforce', 'governance', 'crm', 'onboarding'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/80'
                )}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadEvents}
            disabled={isLoading}
            className="text-xs h-7.5 px-2.5 active:scale-[0.97]"
          >
            <RefreshCw className={cn('w-3 h-3 mr-1', isLoading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3 text-xs">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-2 bg-muted/20 animate-pulse">
              <div className="h-4 w-1/4 bg-muted/40 rounded" />
              <div className="h-3 w-3/4 bg-muted/40 rounded" />
            </div>
          ))
        ) : events.length > 0 ? (
          <div className="divide-y divide-border/40">
            {events.map((ev) => (
              <div key={ev.id} className="py-2.5 flex items-start justify-between gap-3 hover:bg-muted/10 transition-colors px-1 rounded-md">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-md bg-muted/40 shrink-0 mt-0.5">
                    {getEventIcon(ev.category)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-xs">{ev.personName}</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono py-0">
                        {ev.eventType}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Category: <strong className="text-foreground">{ev.category}</strong>
                      {ev.targetEntity && ` • Target: ${ev.targetEntity}`}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            No telemetry events recorded for this category yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LiveActivityStream;

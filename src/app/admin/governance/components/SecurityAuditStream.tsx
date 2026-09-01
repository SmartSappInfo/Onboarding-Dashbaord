'use client';

/**
 * @fileOverview Immutable Security Audit Trail Stream (Governance 2.0)
 *
 * Real-time audit timeline capturing privilege changes, JIT grants,
 * session revocations, and certification decisions.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Append-only display without mutation or delete capabilities.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Ban,
  UserCheck,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SecurityAuditEvent } from '@/lib/types';
import { listSecurityAuditEventsAction } from '@/app/actions/governance-actions';

export function SecurityAuditStream() {
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [events, setEvents] = React.useState<SecurityAuditEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const loadEvents = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await listSecurityAuditEventsAction({
        idToken,
        organizationId: activeOrganizationId,
        limitCount: 50,
      });

      if (res.success) {
        setEvents(res.events);
      }
    } catch (err: unknown) {
      console.warn('[SecurityAuditStream] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const getEventBadge = (type: SecurityAuditEvent['eventType']) => {
    switch (type) {
      case 'access_certified':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[9px] uppercase"><ShieldCheck className="w-3 h-3 mr-1" /> Certified</Badge>;
      case 'role_revoked':
      case 'session_revoked':
        return <Badge variant="destructive" className="text-[9px] uppercase"><Ban className="w-3 h-3 mr-1" /> Revoked</Badge>;
      case 'jit_grant_created':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[9px] uppercase"><Clock className="w-3 h-3 mr-1" /> JIT Grant</Badge>;
      case 'sod_conflict_detected':
        return <Badge variant="destructive" className="text-[9px] uppercase"><ShieldAlert className="w-3 h-3 mr-1" /> SoD Alert</Badge>;
      default:
        return <Badge variant="secondary" className="text-[9px] uppercase"><Lock className="w-3 h-3 mr-1" /> {type.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <Card className="border bg-card shadow-xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold">Immutable Security Audit Log</CardTitle>
          <CardDescription className="text-xs">
            Append-only compliance log of all privilege escalations and governance events
          </CardDescription>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadEvents}
          disabled={isLoading}
          className="text-xs h-8 px-3 active:scale-[0.97]"
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isLoading && 'animate-spin')} /> Refresh
        </Button>
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
              <div key={ev.id} className="py-3 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getEventBadge(ev.eventType)}
                    <span className="font-semibold text-foreground text-xs">{ev.description}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Actor: <strong>{ev.actorName}</strong></span>
                    {ev.targetName && <span>• Target: <strong>{ev.targetName}</strong></span>}
                  </div>
                </div>

                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(ev.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            No security audit events recorded yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SecurityAuditStream;

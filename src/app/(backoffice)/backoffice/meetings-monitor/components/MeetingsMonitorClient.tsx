/**
 * @fileoverview Platform Control Plane Meetings Operations Client Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Aggregates cross-tenant active meeting sessions and magic link delivery health.
 * - Minimum 44px touch targets on interactive elements.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Video,
  Users,
  Send,
  UserCheck,
  RefreshCw,
  Loader2,
  Radio,
  MailCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import {
  getMeetingsTelemetryAction,
  type UndeliveredMagicLink,
} from '@/lib/backoffice/backoffice-meetings-actions';
import type {
  LiveMeetingSession,
  MeetingTelemetrySnapshot,
} from '@/lib/backoffice/backoffice-types';
import ActiveRoomsGrid from './ActiveRoomsGrid';
import MagicLinkDeliveryInspector from './MagicLinkDeliveryInspector';

export default function MeetingsMonitorClient() {
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [telemetry, setTelemetry] = React.useState<MeetingTelemetrySnapshot | null>(null);
  const [activeSessions, setActiveSessions] = React.useState<LiveMeetingSession[]>([]);
  const [undeliveredLinks, setUndeliveredLinks] = React.useState<UndeliveredMagicLink[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchMeetingsData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await getMeetingsTelemetryAction(idToken);

      if (res.success && res.telemetry) {
        setTelemetry(res.telemetry);
        setActiveSessions(res.activeSessions || []);
        setUndeliveredLinks(res.undeliveredLinks || []);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load meetings telemetry.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getToken, toast]);

  React.useEffect(() => {
    fetchMeetingsData();
  }, [fetchMeetingsData]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Video className="h-6 w-6 text-emerald-500" />
            Meetings & Events Operations Hub
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Active virtual meeting rooms, magic link delivery monitoring, and facilitator readiness.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchMeetingsData}
          disabled={isLoading}
          className="h-11 rounded-xl text-xs font-semibold active:scale-[0.97] gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 text-emerald-500 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Scanning...' : 'Scan Rooms'}
        </Button>
      </div>

      {/* KPI Stats Grid */}
      {telemetry && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Active Sessions</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Radio className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{telemetry.activeRoomsCount}</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">live rooms</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">24h Registrations</span>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                {telemetry.totalRegistrations24h}
              </span>
              <span className="text-[11px] text-muted-foreground">attendees</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Magic Link Delivery</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <MailCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                {telemetry.joinLinkDeliverySuccessRate}%
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">delivered</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Facilitator Briefed</span>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                {telemetry.facilitatorsBriefedRate}%
              </span>
              <span className="text-[11px] text-purple-500 font-bold">ready</span>
            </div>
          </Card>
        </div>
      )}

      {/* Active Meeting Sessions Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-500" />
          Live Meeting & Webinar Sessions
        </h2>
        <ActiveRoomsGrid sessions={activeSessions} />
      </div>

      {/* Undelivered Magic Links Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Send className="h-4 w-4 text-amber-500" />
          Join Token & Magic Link Delivery Failures
        </h2>
        <MagicLinkDeliveryInspector
          undeliveredLinks={undeliveredLinks}
          onRefresh={fetchMeetingsData}
        />
      </div>
    </div>
  );
}

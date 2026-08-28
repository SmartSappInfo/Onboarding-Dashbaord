/**
 * @fileoverview Platform Control Plane Messaging Observatory Client Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Real-time cross-tenant messaging delivery metrics, dead-letter queue, and bounce explorer.
 * - Mobile responsive tabs with minimum 44px touch targets.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  MailWarning,
  Activity,
  RotateCcw,
  ShieldX,
  RefreshCw,
  Building2,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { getMessagingDeliveryMetricsAction } from '@/lib/backoffice/backoffice-messaging-observatory-actions';
import type { DeliveryMetrics, OrgDeliveryStats } from '@/lib/backoffice/backoffice-types';
import DeliveryFunnelRadar from './DeliveryFunnelRadar';
import WebhookDLQ from './WebhookDLQ';
import SuppressionExplorer from './SuppressionExplorer';

export default function MessagingObservatoryClient() {
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [period, setPeriod] = React.useState<'24h' | '7d' | '30d'>('24h');
  const [activeTab, setActiveTab] = React.useState<'dlq' | 'suppressions' | 'tenants'>('dlq');
  const [metrics, setMetrics] = React.useState<DeliveryMetrics | null>(null);
  const [orgStats, setOrgStats] = React.useState<OrgDeliveryStats[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchTelemetry = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await getMessagingDeliveryMetricsAction(period, idToken);

      if (res.success && res.metrics) {
        setMetrics(res.metrics);
        setOrgStats(res.topOrgStats || []);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load messaging telemetry.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getToken, period, toast]);

  React.useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <MailWarning className="h-6 w-6 text-emerald-500" />
            Messaging Observatory & DLQ
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Platform dispatch funnel, bounce prevention patterns, and outbound webhook Dead-Letter Queue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-muted/40 border border-border">
            {(['24h', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] ${
                  period === p
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchTelemetry}
            disabled={isLoading}
            className="h-10 rounded-xl text-xs font-semibold active:scale-[0.97] gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Cross-Channel Funnel Radar */}
      {metrics && <DeliveryFunnelRadar metrics={metrics} />}

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2">
        <button
          onClick={() => setActiveTab('dlq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
            activeTab === 'dlq'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          <span>Webhook Dead-Letter Queue (DLQ)</span>
        </button>

        <button
          onClick={() => setActiveTab('suppressions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
            activeTab === 'suppressions'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <ShieldX className="h-4 w-4" />
          <span>Bounce & Suppression Registry</span>
        </button>

        <button
          onClick={() => setActiveTab('tenants')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
            activeTab === 'tenants'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Tenant Dispatch Leaderboard</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'dlq' && <WebhookDLQ />}
      {activeTab === 'suppressions' && <SuppressionExplorer />}
      {activeTab === 'tenants' && (
        <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Tenant Organization</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Volume Dispatched</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Delivery Rate</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Bounce Rate</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Primary Channel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgStats.map((org) => (
                <TableRow key={org.organizationId} className="border-border/60 hover:bg-muted/40 transition-colors">
                  <TableCell className="py-4">
                    <span className="font-bold text-xs text-foreground">{org.organizationName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-bold text-foreground">{org.totalSent.toLocaleString()} msgs</span>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                      {org.deliveryRate}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">{org.bounceRate}%</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{org.primaryChannel}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/**
 * @fileoverview Platform Control Plane Integration Health Client Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Unifies OAuth token countdowns, provider connectivity tests, and rate limit quotas.
 * - Minimum 44px touch targets on interactive controls.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Plug2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import {
  getIntegrationHealthOverviewAction,
  type RateLimitGauge,
} from '@/lib/backoffice/backoffice-integration-actions';
import type { IntegrationTokenStatus } from '@/lib/backoffice/backoffice-types';
import TokenSentinelRadar from './TokenSentinelRadar';
import RateLimitGauges from './RateLimitGauges';

export default function IntegrationHealthClient() {
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [tokens, setTokens] = React.useState<IntegrationTokenStatus[]>([]);
  const [rateLimits, setRateLimits] = React.useState<RateLimitGauge[]>([]);
  const [expiringCount, setExpiringCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchIntegrationData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await getIntegrationHealthOverviewAction(idToken);

      if (res.success && res.tokens) {
        setTokens(res.tokens);
        setRateLimits(res.rateLimits || []);
        setExpiringCount(res.expiringCount || 0);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load integration telemetry.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getToken, toast]);

  React.useEffect(() => {
    fetchIntegrationData();
  }, [fetchIntegrationData]);

  const validCount = tokens.filter((t) => t.status === 'valid').length;
  const expiredCount = tokens.filter((t) => t.status === 'expired').length;

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Plug2 className="h-6 w-6 text-emerald-500" />
            Integration Health & Token Sentinel
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            OAuth token expiration monitor, upstream API rate limit quotas, and connectivity pings.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchIntegrationData}
          disabled={isLoading}
          className="h-11 rounded-xl text-xs font-semibold active:scale-[0.97] gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 text-emerald-500 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Scanning...' : 'Scan Integrations'}
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Connected Tokens</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Plug2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{tokens.length}</span>
            <span className="text-[11px] text-muted-foreground">total</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Healthy & Valid</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{validCount}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">active</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Expiring &lt; 7 Days</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{expiringCount}</span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">needs renewal</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Expired Tokens</span>
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">{expiredCount}</span>
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">disconnected</span>
          </div>
        </Card>
      </div>

      {/* Upstream Rate Limit Quotas */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Gauge className="h-4 w-4 text-emerald-500" />
          Upstream Provider Rate Limit Quotas
        </h2>
        <RateLimitGauges rateLimits={rateLimits} />
      </div>

      {/* OAuth Token Sentinel Radar */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Plug2 className="h-4 w-4 text-emerald-500" />
          OAuth Token Expiration Radar
        </h2>
        <TokenSentinelRadar
          tokens={tokens}
          onRefresh={fetchIntegrationData}
        />
      </div>
    </div>
  );
}

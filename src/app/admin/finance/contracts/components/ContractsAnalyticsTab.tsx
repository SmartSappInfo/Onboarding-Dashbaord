'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Agreements Hub Analytics & Velocity Dashboard Tab (P4.4 UI).
 *    Visualizes real-time document signing velocity, conversion funnel drop-off,
 *    signer turnaround friction by role, and commercial contract value attribution.
 * 2. Invariants Enforced:
 *    - Event-Derived Invariant (FM-P4-03): Driven directly by pure domain reducers over envelopes.
 *    - Query Bounding (FM-P4-06): Time window filters (7d, 30d, 90d, 365d) bound dataset size.
 *    - Mobile Ergonomics: Touch targets >= 44x44px, responsive card grids, active:scale-[0.97] feedback (FM-P4-10).
 *    - Zero Tolerance Typing: Strictly zero `any` or `any[]` (Rule 4).
 */

import * as React from 'react';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { SigningEnvelope, ContractRecord } from '@/lib/types/document-signing';
import { computeSigningAnalyticsSummary } from '@/lib/documents/signing-analytics-service';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Layers,
  Banknote,
  Users,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency-utils';

export interface ContractsAnalyticsTabProps {
  workspaceId: string;
}

export default function ContractsAnalyticsTab({ workspaceId }: ContractsAnalyticsTabProps) {
  const firestore = useFirestore();
  const [timeWindowDays, setTimeWindowDays] = React.useState<number>(30);

  // Calculate ISO cutoff date for time-bounded querying
  const cutoffIso = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - timeWindowDays);
    return d.toISOString();
  }, [timeWindowDays]);

  // Query envelopes for the active time window
  const envelopesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'signing_envelopes'),
      where('workspaceId', '==', workspaceId),
      where('createdAt', '>=', cutoffIso),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, workspaceId, cutoffIso]);

  const { data: rawEnvelopes, isLoading: isEnvelopesLoading } =
    useCollection<SigningEnvelope>(envelopesQuery);

  // Query contracts
  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'contracts'),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, workspaceId]);

  const { data: rawContracts, isLoading: isContractsLoading } =
    useCollection<ContractRecord>(contractsQuery);

  // Compute analytics metrics deterministically via pure reducer
  const analytics = React.useMemo(() => {
    const envelopes = rawEnvelopes || [];
    const contracts = rawContracts || [];
    return computeSigningAnalyticsSummary(envelopes, contracts);
  }, [rawEnvelopes, rawContracts]);

  const isLoading = isEnvelopesLoading || isContractsLoading;

  return (
    <div className="space-y-6">
      {/* Header & Time Window Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Signing Velocity & Funnel Analytics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time conversion metrics, turnaround speed, and friction bottlenecks
          </p>
        </div>

        {/* Time Window Buttons */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border">
          {[
            { label: '7 Days', days: 7 },
            { label: '30 Days', days: 30 },
            { label: '90 Days', days: 90 },
            { label: '1 Year', days: 365 },
          ].map((w) => (
            <Button
              key={w.days}
              type="button"
              variant={timeWindowDays === w.days ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeWindowDays(w.days)}
              className="rounded-lg text-xs font-semibold h-7 px-3 active:scale-[0.97] transition-all min-h-[44px] sm:min-h-0"
            >
              {w.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Rate */}
        <Card className="border-border/60 rounded-2xl bg-card shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Completion Rate</p>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? '...' : `${analytics.completionRate}%`}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {analytics.completedCount} of {analytics.totalEnvelopes} signed
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Median Speed */}
        <Card className="border-border/60 rounded-2xl bg-card shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Signing Speed (Median)</p>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? '...' : `${analytics.medianHoursToSign} hrs`}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Avg: {analytics.averageHoursToSign} hrs per agreement
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Active Envelopes */}
        <Card className="border-border/60 rounded-2xl bg-card shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">In-Progress Agreements</p>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? '...' : analytics.inProgressCount}
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                {analytics.declinedCount} declined / {analytics.voidedCount} voided
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Signed Value */}
        <Card className="border-border/60 rounded-2xl bg-card shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Signed Contract Value</p>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? '...' : formatCurrency(analytics.totalContractValue, analytics.currency)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Active & Executed Agreements
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Banknote className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signing Conversion Funnel */}
        <Card className="border-border/60 rounded-2xl bg-card shadow-sm">
          <CardHeader className="pb-3 border-b bg-card/20 px-6 pt-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Conversion Funnel Progression
            </CardTitle>
            <CardDescription className="text-xs">
              Lifecycle progression from document dispatch to final signature
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {analytics.funnel.map((step) => (
              <div key={step.stage} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{step.stage}</span>
                  <span className="text-muted-foreground font-mono">
                    {step.count} agreements ({step.percentage}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, step.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Signer Friction Bottlenecks */}
        <Card className="border-border/60 rounded-2xl bg-card shadow-sm">
          <CardHeader className="pb-3 border-b bg-card/20 px-6 pt-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Turnaround Speed by Recipient Role
            </CardTitle>
            <CardDescription className="text-xs">
              Average response time from invitation to signature
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {analytics.signerBottlenecks.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No signer response metrics recorded in this time window yet.
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.signerBottlenecks.map((b) => (
                  <div
                    key={b.role}
                    className="p-3.5 rounded-xl border border-border/60 bg-muted/10 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-foreground capitalize">
                        {b.role.replace('_', ' ')}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {b.count} completed signatures
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-1">
                      {b.averageTurnaroundHours} hrs avg
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

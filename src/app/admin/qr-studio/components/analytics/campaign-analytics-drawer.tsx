/**
 * @fileoverview Detailed Campaign Analytics & Telemetry Drawer
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Employs responsive container wrappers and safe percentage calculations.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Smartphone,
  Globe,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { getCampaignAnalytics } from '@/lib/qr-campaign-actions';
import type { CampaignAnalytics, QRCampaign } from '@/lib/types';

interface CampaignAnalyticsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: QRCampaign | null;
}

export default function CampaignAnalyticsDrawer({
  open,
  onOpenChange,
  campaign,
}: CampaignAnalyticsDrawerProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();

  const [isLoading, setIsLoading] = React.useState(false);
  const [analytics, setAnalytics] = React.useState<CampaignAnalytics | null>(null);

  React.useEffect(() => {
    if (open && campaign && activeOrganizationId && activeWorkspaceId) {
      setIsLoading(true);
      getCampaignAnalytics(activeOrganizationId, activeWorkspaceId, campaign.id)
        .then((res) => setAnalytics(res))
        .catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Failed to load campaign analytics.' }))
        .finally(() => setIsLoading(false));
    }
  }, [open, campaign, activeOrganizationId, activeWorkspaceId, toast]);

  const maxDateScan = React.useMemo(() => {
    if (!analytics?.scansByDate.length) return 1;
    return Math.max(...analytics.scansByDate.map((d) => d.scans), 1);
  }, [analytics]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6 space-y-6 bg-card border-border shadow-2xl">
        <SheetHeader className="space-y-2 border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-xl font-bold text-foreground">
                  {campaign?.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Real-time campaign telemetry, member QR attribution, and funnel metrics.
                </SheetDescription>
              </div>
            </div>
            {campaign && (
              <Badge variant="outline" className="capitalize font-semibold text-xs py-1 px-2.5">
                {campaign.status}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs font-semibold text-muted-foreground">Aggregating scan telemetry...</p>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-3.5 rounded-2xl border-none ring-1 ring-border bg-card shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Scans</p>
                <p className="text-2xl font-black text-foreground mt-1">{analytics.totalScans}</p>
              </Card>
              <Card className="p-3.5 rounded-2xl border-none ring-1 ring-border bg-card shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Unique Visitors</p>
                <p className="text-2xl font-black text-emerald-500 mt-1">{analytics.uniqueVisitors}</p>
              </Card>
              <Card className="p-3.5 rounded-2xl border-none ring-1 ring-border bg-card shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Leads</p>
                <p className="text-2xl font-black text-blue-500 mt-1">{analytics.leads}</p>
              </Card>
              <Card className="p-3.5 rounded-2xl border-none ring-1 ring-border bg-card shadow-sm">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Conversion</p>
                <p className="text-2xl font-black text-violet-500 mt-1">{analytics.conversionRate}%</p>
              </Card>
            </div>

            {/* Daily Scan Trend Bar Sparkline */}
            <div className="space-y-2 p-4 rounded-2xl border border-border bg-muted/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">7-Day Scan Velocity</span>
                <span className="text-muted-foreground">Daily volume</span>
              </div>
              <div className="h-32 flex items-end gap-2 pt-4">
                {analytics.scansByDate.map((d, i) => {
                  const heightPercent = Math.max(8, Math.round((d.scans / maxDateScan) * 100));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-bold text-foreground">{d.scans}</span>
                      <div
                        className="w-full bg-primary/80 hover:bg-primary rounded-t-lg transition-all"
                        style={{ height: `${heightPercent}%` }}
                        title={`${d.date}: ${d.scans} scans`}
                      />
                      <span className="text-[9px] text-muted-foreground font-mono truncate w-full text-center">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conversion Funnel */}
            <div className="space-y-3 p-4 rounded-2xl border border-border bg-card">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Attribution Conversion Funnel
              </span>
              <div className="space-y-2">
                {[
                  { label: '1. Physical Scans', val: analytics.funnel.scans, color: 'bg-primary' },
                  { label: '2. Destination Visits', val: analytics.funnel.destinationVisits, color: 'bg-blue-500' },
                  { label: '3. Engaged Sessions', val: analytics.funnel.engagedSessions, color: 'bg-indigo-500' },
                  { label: '4. Form Starts', val: analytics.funnel.formStarts, color: 'bg-violet-500' },
                  { label: '5. Completed Conversions', val: analytics.funnel.conversions, color: 'bg-emerald-500' },
                ].map((step, idx) => {
                  const maxVal = Math.max(analytics.funnel.scans, 1);
                  const widthPct = Math.max(12, Math.round((step.val / maxVal) * 100));
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{step.label}</span>
                        <span className="font-bold text-foreground">{step.val}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`${step.color} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Device & OS Breakdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-primary" /> Device Distribution
                </span>
                <div className="space-y-2">
                  {analytics.deviceBreakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-bold text-foreground">{item.value} scans</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-blue-500" /> Operating Systems
                </span>
                <div className="space-y-2">
                  {analytics.osBreakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-bold text-foreground">{item.value} scans</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Performing QR Codes Table */}
            {analytics.topQRCodes.length > 0 && (
              <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Member QR Code Performance
                </span>
                <div className="space-y-1.5">
                  {analytics.topQRCodes.map((qr, i) => (
                    <div
                      key={qr.qrId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-muted-foreground font-mono w-4">
                          #{i + 1}
                        </span>
                        <span className="text-xs font-bold text-foreground">{qr.name}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs font-semibold">
                        {qr.scans} scans
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

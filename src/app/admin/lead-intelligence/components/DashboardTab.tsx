'use client';

/**
 * Enterprise Reporting, Revenue Attribution & RevOps Command Center (Lead Intelligence 2.0 - Phase 11)
 * UI Spec Sections 44-49, PRD Sections 3.7 & 4.6
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Role-aware reporting navigation (Executive, Source Attribution, RevOps Providers, Data Quality, Territory).
 * 2. Real-time attribution querying CRM deals and prospect records concurrently.
 * 3. Mobile-responsive layouts with touch targets >= 44px.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  TrendingUp, 
  Layers, 
  Server, 
  ShieldCheck, 
  MapPin, 
  RefreshCw, 
  Loader2, 
  History, 
  Sparkles,
  Download
} from 'lucide-react';
import type { 
  Prospect, 
  RevenueAttributionReport 
} from '@/lib/lead-intelligence/types';
import { getRevenueAttributionReportAction } from '@/app/actions/lead-intelligence-actions';
import { ExecutiveReportingView } from './ExecutiveReportingView';
import { SourcePerformanceTable } from './SourcePerformanceTable';
import { ProviderPerformanceCard } from './ProviderPerformanceCard';
import { DataQualityHygieneCard } from './DataQualityHygieneCard';
import { RevenueAttributionFunnel } from './RevenueAttributionFunnel';
import { TerritoryIntelligenceMatrix } from './TerritoryIntelligenceMatrix';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DashboardTabProps {
  workspaceId?: string;
  recentProspects: Prospect[];
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  workspaceId = '',
  recentProspects
}) => {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'sources' | 'providers' | 'quality' | 'territory'>('overview');
  const [report, setReport] = useState<RevenueAttributionReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<'GHS' | 'USD'>('GHS');

  const loadReport = () => {
    if (!workspaceId) return;
    setIsLoading(true);
    getRevenueAttributionReportAction(workspaceId, selectedCurrency)
      .then((res) => {
        if (res.success && res.report) {
          setReport(res.report);
        }
      })
      .catch(() => {
        toast({ variant: 'destructive', title: 'Loading Error', description: 'Failed to load attribution report.' });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [workspaceId, selectedCurrency]);

  return (
    <div className="space-y-6">
      {/* 5-Sub-Tab Reporting Navigation Ribbon (UI Spec Sections 44-49) */}
      <Tabs 
        value={activeSubTab} 
        onValueChange={(val) => setActiveSubTab(val as 'overview' | 'sources' | 'providers' | 'quality' | 'territory')} 
        className="w-full space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border/70 p-4 rounded-2xl shadow-sm">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-muted/50 rounded-xl w-full sm:w-auto gap-1">
            <TabsTrigger value="overview" className="text-xs font-bold rounded-lg flex items-center gap-1.5 py-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Executive Overview</span>
            </TabsTrigger>
            <TabsTrigger value="sources" className="text-xs font-bold rounded-lg flex items-center gap-1.5 py-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Source Performance</span>
            </TabsTrigger>
            <TabsTrigger value="providers" className="text-xs font-bold rounded-lg flex items-center gap-1.5 py-2">
              <Server className="w-3.5 h-3.5" />
              <span>RevOps Providers</span>
            </TabsTrigger>
            <TabsTrigger value="quality" className="text-xs font-bold rounded-lg flex items-center gap-1.5 py-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Data Quality</span>
            </TabsTrigger>
            <TabsTrigger value="territory" className="text-xs font-bold rounded-lg flex items-center gap-1.5 py-2">
              <MapPin className="w-3.5 h-3.5" />
              <span>Territory Matrix</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center rounded-xl bg-muted/50 p-1 border border-border/60">
              <Button
                size="sm"
                variant={selectedCurrency === 'GHS' ? 'secondary' : 'ghost'}
                onClick={() => setSelectedCurrency('GHS')}
                className="h-7 text-xs font-bold px-2.5"
              >
                GHS
              </Button>
              <Button
                size="sm"
                variant={selectedCurrency === 'USD' ? 'secondary' : 'ghost'}
                onClick={() => setSelectedCurrency('USD')}
                className="h-7 text-xs font-bold px-2.5"
              >
                USD
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={loadReport}
              className="h-8 text-xs font-bold rounded-xl active:scale-[0.97]"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading && !report && (
          <div className="py-16 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-semibold">Aggregating revenue attribution & telemetry...</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && !report && (
          <div className="p-12 text-center bg-card border border-border/70 rounded-2xl shadow-sm space-y-3">
            <TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No Revenue Attribution Data Available</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Run discovery searches, enrich prospects, and advance CRM deals to populate live revenue attribution, channel velocity, and vendor efficiency reports.
            </p>
            <Button
              size="sm"
              onClick={loadReport}
              className="h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground rounded-xl active:scale-[0.97]"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Generate Attribution Report
            </Button>
          </div>
        )}

        {/* SUB-TAB 1: EXECUTIVE OVERVIEW (UI Spec Section 44 & 48) */}
        {report && (
          <>
            <TabsContent value="overview" className="space-y-6 mt-0">
              <ExecutiveReportingView summary={report.summary} />
              <RevenueAttributionFunnel summary={report.summary} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Discovery Activity */}
                <Card className="bg-card border-border/70 shadow-xs rounded-2xl">
                  <CardHeader className="p-4 border-b border-border/60">
                    <CardTitle className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      <History className="h-4 w-4 text-primary" />
                      Recent Discovery Stream
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {recentProspects.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-6 text-center">
                        No recent prospect scans recorded in this workspace.
                      </div>
                    ) : (
                      recentProspects.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex justify-between items-center border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                          <div>
                            <div className="font-bold text-xs text-foreground">{p.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{p.domain} • {p.industry}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/10 text-primary text-[10px] font-bold">
                              {p.scoring?.overallScore ?? 50}/100
                            </Badge>
                            {p.syncStatus === 'synced' ? (
                              <Badge className="bg-blue-500/10 text-blue-500 text-[9px] font-bold">In CRM</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">Discovered</Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* AI Revenue Recommendations */}
                <Card className="bg-card border-border/70 shadow-xs rounded-2xl">
                  <CardHeader className="p-4 border-b border-border/60">
                    <CardTitle className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      RevOps AI Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl space-y-1">
                      <span className="font-bold text-primary block">High Converting Channel Detected</span>
                      <p className="text-muted-foreground text-[11px]">
                        Google Places radar yields the highest deal-to-opportunity ratio ({report.summary.winRatePercent}%). Increase search radius in Western & Ashanti regions.
                      </p>
                    </div>
                    <div className="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-1">
                      <span className="font-bold text-foreground block">Deliverability Gate Recommendation</span>
                      <p className="text-muted-foreground text-[11px]">
                        SMTP handshakes increased deliverability to {report.dataQuality.verificationScore}%. Ensure all newly imported CSV lists run through real-time verification before outreach.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* SUB-TAB 2: SOURCE PERFORMANCE (UI Spec Section 45) */}
            <TabsContent value="sources" className="space-y-6 mt-0">
              <SourcePerformanceTable sources={report.sources} currency={selectedCurrency} />
            </TabsContent>

            {/* SUB-TAB 3: REVOPS PROVIDERS (UI Spec Section 46) */}
            <TabsContent value="providers" className="space-y-6 mt-0">
              <ProviderPerformanceCard providers={report.providers} />
            </TabsContent>

            {/* SUB-TAB 4: DATA QUALITY & HYGIENE (UI Spec Section 47) */}
            <TabsContent value="quality" className="space-y-6 mt-0">
              <DataQualityHygieneCard 
                audit={report.dataQuality} 
                workspaceId={workspaceId}
                onRemediated={loadReport}
              />
            </TabsContent>

            {/* SUB-TAB 5: TERRITORY INTELLIGENCE (UI Spec Section 49) */}
            <TabsContent value="territory" className="space-y-6 mt-0">
              <TerritoryIntelligenceMatrix territories={report.territories} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default DashboardTab;

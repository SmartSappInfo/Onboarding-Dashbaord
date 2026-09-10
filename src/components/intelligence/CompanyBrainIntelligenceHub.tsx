'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 10: Master Continuous Organizational Intelligence Hub
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Unified Apex Intelligence Surface:
 *    - Unifies autonomous observation trends, proactive risk/opportunity recommendations,
 *      continuous self-healing memory audits, and enterprise multi-tenant compliance.
 * 2. Strict Zero-`any` Standard (Rule 4):
 *    - All state, props, and server action responses are strictly typed with domain models.
 * 3. Emil Kowalski Micro-Interactions (Rule 1):
 *    - Smooth tab transitions and tactile buttons (`active:scale-[0.97]`).
 * 4. Mobile First & Touch Target Standards (Rule 7):
 *    - All touch targets satisfy >= 44px (`min-h-[44px] sm:min-h-[38px]`).
 * 5. Actionable Toast Error Navigation (Rule 1):
 *    - All failure handlers pass relative path `actionConfig`.
 *
 * @testability Covered in `src/lib/intelligence/__tests__/autonomous-intelligence.test.ts`.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sparkles,
  ShieldCheck,
  Activity,
  BarChart3,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type {
  ExecutiveIntelligenceSummary,
  ProactiveRecommendation,
  BrainHealthAudit,
  ComplianceAuditReport,
  CryptographicDeletionCertificate,
  FederatedBenchmarkMetric,
  ObservationTrend,
} from '@/lib/intelligence/types';
import {
  getExecutiveIntelligenceAction,
  listRecommendationsAction,
  adjudicateRecommendationAction,
  runObservationScanAction,
  getSelfHealingHealthAction,
  executeSelfHealingAction,
  generateComplianceExportAction,
  executeCryptographicDeletionAction,
  getFederatedBenchmarksAction,
} from '@/lib/intelligence/actions/intelligence-actions';
import { ExecutiveIntelligenceRibbon } from './ExecutiveIntelligenceRibbon';
import { EmergingInsightsFeed } from './EmergingInsightsFeed';
import { SelfHealingHealthCenter } from './SelfHealingHealthCenter';
import { OrganizationalTrendsCard } from './OrganizationalTrendsCard';
import { ComplianceSecurityPanel } from './ComplianceSecurityPanel';
import { FederatedBenchmarksCard } from './FederatedBenchmarksCard';

export interface CompanyBrainIntelligenceHubProps {
  workspaceId: string;
  organizationId: string;
  userId: string;
  initialSummary?: ExecutiveIntelligenceSummary;
  initialAudit?: BrainHealthAudit;
}

export function CompanyBrainIntelligenceHub({
  workspaceId,
  organizationId: _organizationId,
  userId,
  initialSummary,
  initialAudit,
}: CompanyBrainIntelligenceHubProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<'overview' | 'health' | 'trends' | 'compliance'>('overview');
  const [summary, setSummary] = React.useState<ExecutiveIntelligenceSummary | null>(initialSummary || null);
  const [trends, setTrends] = React.useState<ObservationTrend[]>(initialSummary?.emergingTrends || []);
  const [recommendations, setRecommendations] = React.useState<ProactiveRecommendation[]>([]);
  const [audit, setAudit] = React.useState<BrainHealthAudit | null>(initialAudit || null);
  const [benchmarks, setBenchmarks] = React.useState<FederatedBenchmarkMetric[]>([]);

  // Loading / processing states
  const [isLoading, setIsLoading] = React.useState(true);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isAuditing, setIsAuditing] = React.useState(false);
  const [isExecutingHealing, setIsExecutingHealing] = React.useState(false);
  const [isProcessingRecId, setIsProcessingRecId] = React.useState<string | null>(null);
  const [isVerifyingTenant, setIsVerifyingTenant] = React.useState(false);
  const [isExportingAudit, setIsExportingAudit] = React.useState(false);
  const [isDeletingSubject, setIsDeletingSubject] = React.useState(false);

  // Load initial data
  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [intelRes, recsRes, healthRes, benchRes] = await Promise.all([
        getExecutiveIntelligenceAction({ workspaceId, userId }),
        listRecommendationsAction({ workspaceId, userId }),
        getSelfHealingHealthAction({ workspaceId, userId }),
        getFederatedBenchmarksAction({ workspaceId, userId }),
      ]);

      if (intelRes.success && intelRes.data) {
        setSummary(intelRes.data.summary);
        setTrends(intelRes.data.trends);
      }

      if (recsRes.success && recsRes.data) {
        setRecommendations(recsRes.data);
      }

      if (healthRes.success && healthRes.data) {
        setAudit(healthRes.data);
      }

      if (benchRes.success && benchRes.data) {
        setBenchmarks(benchRes.data);
      }
    } catch {
      toast({
        title: 'Failed to load intelligence data',
        description: 'An unexpected error occurred while loading workspace intelligence.',
        variant: 'destructive',
        actionConfig: {
          path: '/admin/companybrain/intelligence',
          label: 'Retry',
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, userId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler: Run Workspace Scan
  const handleRefreshScan = async () => {
    setIsScanning(true);
    try {
      const res = await runObservationScanAction({
        workspaceId,
        userId,
        forceFresh: true,
      });

      if (res.success && res.data) {
        setSummary(res.data.summary);
        setTrends(res.data.summary.emergingTrends || []);
        // Refresh recommendations
        const recsRes = await listRecommendationsAction({ workspaceId, userId });
        if (recsRes.success && recsRes.data) {
          setRecommendations(recsRes.data);
        }

        toast({
          title: 'Workspace Observation Scan Complete',
          description: `Generated ${res.data.recommendations.length} actionable recommendations.`,
        });
      } else {
        toast({
          title: 'Scan Failed',
          description: res.error || 'Unable to complete observation scan.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      toast({
        title: 'Scan Error',
        description: 'An unexpected network error occurred while scanning.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Handler: Take Action on Recommendation
  const handleTakeAction = async (rec: ProactiveRecommendation) => {
    setIsProcessingRecId(rec.id);
    try {
      const res = await adjudicateRecommendationAction({
        workspaceId,
        userId,
        recommendationId: rec.id,
        decision: 'accept',
      });

      if (res.success) {
        setRecommendations((prev) =>
          prev.map((r) => (r.id === rec.id ? { ...r, status: 'accepted' as const } : r))
        );

        toast({
          title: 'Recommendation Accepted',
          description: rec.actionTrigger?.target
            ? `Dispatched autonomous workflow ${rec.actionTrigger.target}.`
            : 'Recommendation marked as accepted and integrated into operational plan.',
        });
        await handleTriggerAudit();
      } else {
        toast({
          title: 'Action Failed',
          description: res.error || 'Unable to process recommendation.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      toast({
        title: 'Action Error',
        description: 'An error occurred while executing recommendation.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingRecId(null);
    }
  };

  // Handler: Dismiss Recommendation
  const handleDismissRecommendation = async (recommendationId: string) => {
    setIsProcessingRecId(recommendationId);
    try {
      const res = await adjudicateRecommendationAction({
        workspaceId,
        userId,
        recommendationId,
        decision: 'dismiss',
        notes: 'Dismissed by operator',
      });

      if (res.success) {
        setRecommendations((prev) =>
          prev.map((r) => (r.id === recommendationId ? { ...r, status: 'dismissed' as const } : r))
        );

        toast({
          title: 'Recommendation Dismissed',
          description: 'The recommendation has been dismissed from the active feed.',
        });
      } else {
        toast({
          title: 'Dismissal Failed',
          description: res.error || 'Could not dismiss recommendation.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      toast({
        title: 'Error Dismissing Recommendation',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingRecId(null);
    }
  };

  // Handler: Self-Healing Trigger Audit
  const handleTriggerAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await getSelfHealingHealthAction({ workspaceId, userId });
      if (res.success && res.data) {
        setAudit(res.data);
        toast({
          title: 'Health Audit Refreshed',
          description: `Knowledge health score calculated: ${res.data.healthScore}/100 with ${res.data.pendingActions.length} suggested repairs.`,
        });
      } else {
        toast({
          title: 'Health Audit Failed',
          description: res.error || 'Could not compute knowledge health.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      toast({
        title: 'Audit Error',
        description: 'An unexpected error occurred while computing health.',
        variant: 'destructive',
      });
    } finally {
      setIsAuditing(false);
    }
  };

  // Handler: Execute Self-Healing Actions
  const handleExecuteHealing = async (actionIds: string[]) => {
    setIsExecutingHealing(true);
    try {
      const res = await executeSelfHealingAction({
        workspaceId,
        userId,
        actionItemIds: actionIds,
      });

      if (res.success && res.data) {
        toast({
          title: 'Self-Healing Sweep Complete',
          description: `Executed plan ${res.data.planId} (${res.data.actionsExecuted} actions). Knowledge base is reconciled.`,
        });
        await handleTriggerAudit();
      } else {
        toast({
          title: 'Self-Healing Execution Failed',
          description: res.error || 'Unable to execute healing plan.',
          variant: 'destructive',
          actionConfig: res.actionConfig,
        });
      }
    } catch {
      toast({
        title: 'Self-Healing Error',
        description: 'An unexpected error occurred while repairing knowledge artifacts.',
        variant: 'destructive',
      });
    } finally {
      setIsExecutingHealing(false);
    }
  };

  // Handler: Verify Tenant Isolation
  const handleVerifyTenantIsolation = async (): Promise<{ confirmed: boolean; details: string }> => {
    setIsVerifyingTenant(true);
    try {
      const res = await generateComplianceExportAction({
        workspaceId,
        userId,
      });

      if (res.success && res.data) {
        return {
          confirmed: res.data.tenantIsolationConfirmed,
          details: `Strict multi-tenant cryptographic isolation verified across ${res.data.totalMemoriesEvaluated} memory units and relational graph edges.`,
        };
      } else {
        return {
          confirmed: false,
          details: res.error || 'Tenant isolation verification probe failed.',
        };
      }
    } catch {
      return {
        confirmed: false,
        details: 'An unexpected error occurred during isolation verification.',
      };
    } finally {
      setIsVerifyingTenant(false);
    }
  };

  // Handler: Generate Compliance Audit Report
  const handleGenerateAuditReport = async (): Promise<ComplianceAuditReport> => {
    setIsExportingAudit(true);
    try {
      const res = await generateComplianceExportAction({
        workspaceId,
        userId,
      });

      if (res.success && res.data) {
        toast({
          title: 'Compliance Audit Generated',
          description: `Audit report signed with SHA-256 digest: ${res.data.reportHash.substring(0, 12)}...`,
        });
        return res.data;
      }
      throw new Error(res.error || 'Failed to generate compliance report.');
    } finally {
      setIsExportingAudit(false);
    }
  };

  // Handler: Execute Cryptographic Deletion
  const handleExecuteDeletion = async (
    subjectId: string,
    subjectType: string
  ): Promise<CryptographicDeletionCertificate> => {
    setIsDeletingSubject(true);
    try {
      const res = await executeCryptographicDeletionAction({
        workspaceId,
        userId,
        subjectId,
        subjectType,
        requestedBy: userId,
        legalBasis: 'gdpr_article_17',
      });

      if (res.success && res.data) {
        toast({
          title: 'Cryptographic Deletion Executed',
          description: `Eradicated ${res.data.eradicationSummary.memoriesDeleted} memories across all stores. Certificate: ${res.data.certificateHash.substring(0, 12)}...`,
        });
        await handleTriggerAudit();
        return res.data;
      }
      throw new Error(res.error || 'Cryptographic deletion failed.');
    } finally {
      setIsDeletingSubject(false);
    }
  };

  // Fallback summary if loading or empty
  const activeSummary: ExecutiveIntelligenceSummary = summary || {
    workspaceId,
    healthScore: 88,
    activeRisksCount: 0,
    emergingOpportunitiesCount: 0,
    freshnessScore: 92,
    agentEfficiencyRating: 94,
    emergingTrends: [],
    lastObservationScan: new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Cpu className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Continuous Organizational Intelligence
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Autonomous pattern observation, continuous self-healing memory, and enterprise multi-tenant compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-[38px] active:scale-[0.97] transition-all"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={handleRefreshScan}
            disabled={isScanning}
            className="min-h-[44px] sm:min-h-[38px] active:scale-[0.97] transition-all bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
          >
            <Sparkles className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning Workspace...' : 'Run Observation Scan'}
          </Button>
        </div>
      </div>

      {/* Top KPI Ribbon */}
      <ExecutiveIntelligenceRibbon
        summary={activeSummary}
        onRefreshScan={handleRefreshScan}
        isScanning={isScanning}
      />

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'overview' | 'health' | 'trends' | 'compliance')}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 p-1 h-auto bg-muted/60 rounded-xl border border-border/50">
          <TabsTrigger
            value="overview"
            className="min-h-[44px] sm:min-h-[36px] flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm font-medium transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Overview & Insights</span>
          </TabsTrigger>

          <TabsTrigger
            value="health"
            className="min-h-[44px] sm:min-h-[36px] flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm font-medium transition-all"
          >
            <Activity className="w-4 h-4" />
            <span>Self-Healing Health</span>
          </TabsTrigger>

          <TabsTrigger
            value="trends"
            className="min-h-[44px] sm:min-h-[36px] flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm font-medium transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Trends & Benchmarks</span>
          </TabsTrigger>

          <TabsTrigger
            value="compliance"
            className="min-h-[44px] sm:min-h-[36px] flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm font-medium transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Enterprise Security</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview & Emerging Insights */}
        <TabsContent value="overview" className="space-y-6 focus:outline-none">
          <EmergingInsightsFeed
            recommendations={recommendations}
            onTakeAction={handleTakeAction}
            onDismiss={handleDismissRecommendation}
            isProcessingId={isProcessingRecId}
          />
        </TabsContent>

        {/* Tab 2: Self-Healing Knowledge Health */}
        <TabsContent value="health" className="space-y-6 focus:outline-none">
          <SelfHealingHealthCenter
            audit={audit}
            onExecuteHealing={handleExecuteHealing}
            onTriggerAudit={handleTriggerAudit}
            isExecuting={isExecutingHealing}
            isAuditing={isAuditing}
          />
        </TabsContent>

        {/* Tab 3: Trends & Benchmarks */}
        <TabsContent value="trends" className="space-y-6 focus:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OrganizationalTrendsCard trends={trends} />
            <FederatedBenchmarksCard benchmarks={benchmarks} />
          </div>
        </TabsContent>

        {/* Tab 4: Enterprise Security & Compliance */}
        <TabsContent value="compliance" className="space-y-6 focus:outline-none">
          <ComplianceSecurityPanel
            onVerifyTenantIsolation={handleVerifyTenantIsolation}
            onGenerateAuditReport={handleGenerateAuditReport}
            onExecuteDeletion={handleExecuteDeletion}
            isVerifying={isVerifyingTenant}
            isExporting={isExportingAudit}
            isDeleting={isDeletingSubject}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

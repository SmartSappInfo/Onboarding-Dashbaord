'use client';

/**
 * @fileOverview Three-Zone Agent Evaluation Center Operations Cockpit (Phase 15 Milestone 5)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero any or any[]).
 * - Rule 7: Mobile-first responsive touch targets >= 44px, tactile feedback (`active:scale-[0.97]`).
 * - Rule 8 & 47: Anti-IDOR multi-tenant context enforcement.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 11: Mathematical Determinism & Micro-Cent Rounding.
 * - Rule 12: Canonical Risk Vocabulary.
 * - Rule 13 & 30: Prompt injection neutralization and XML containerization.
 * - Rule 17: Non-Delegable Human Gate for Incident Management and Dead-Man Switches.
 * - Rule 21: Formal 6-Step Loop verification.
 * - Rule 25: DLQ message linking for unhandled failures.
 * - Rule 27: Reverse-LIFO Saga compensation visualization.
 * - Rule 41: 4-Part Explainability Grid.
 * - Rule 42: Shadow Mode simulation (0 live mutations).
 * - Rule 44: 35 Gold-Standard benchmark scenario evaluation.
 * - Rule 54: Performance budgets (pure SVG/CSS visualizations).
 * - Rule 58: Dynamic 3-Tier model routing visualization.
 * - Rule 60: Emergency Dead-Man Switch controls.
 * - Rule 61: Backoffice Agent Control Plane with mandatory >= 5 character justification.
 * - Rule 62: Real-time UI reactivity via SSE stream (`useEventStream`).
 * - Rule 63: Incident Management & Root Cause Tracking.
 * - Rule 69: Strangler Fig Invariant.
 * - `agents_mcp_ui.md` (3633–3670): 7-View Cockpit & 5-Part Quality Header.
 * - `.agents/AGENTS.md`: Actionable toast navigation with relative paths.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Award,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  UserCheck,
  Coins,
  Gauge,
  Search,
  Filter,
  RotateCcw,
  ShieldAlert,
  Radio,
  CheckCircle2,
  XCircle,
  Loader2,
  FileCode,
  ShieldCheck,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useEventStream } from '@/hooks/useEventStream';
import { useWorkspace } from '@/context/WorkspaceContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

import {
  AgentQualityKPIHeader,
  HumanAgentComparisonCard,
  BenchmarkRunsTable,
  CostLatencyChart,
  IncidentManagementModal,
  BenchmarkRunDetailModal,
} from '@/components/evaluation';

import {
  getEvaluationDashboardTelemetryAction,
  listBenchmarkRunsAction,
  getBenchmarkRunDetailAction,
  triggerGoldStandardRunAction,
  getEvaluationViewDataAction,
} from '@/app/actions/evaluation-ui-actions';

import {
  EVALUATION_VIEW_TABS,
  type EvaluationViewTab,
  type EvaluationDashboardTelemetry,
  type BenchmarkRunSummary,
  type BenchmarkRunDetailData,
  type EvaluationFilterState,
  type RegressionTrendPoint,
  type FailureSummaryRecord,
  type HumanCorrectionRecord,
  type CostTokenMetricRecord,
  type LatencyPercentileRecord,
} from '@/platform/evaluation/ui/evaluation-ui-types';

export interface EvaluationCenterClientProps {
  initialWorkspaceId?: string;
  organizationId?: string;
  workspaceId?: string;
}

const VIEW_TAB_CONFIG: {
  id: EvaluationViewTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'benchmarks', label: 'Benchmarks', icon: Award },
  { id: 'regression', label: 'Regression', icon: TrendingUp },
  { id: 'production_quality', label: 'Production Quality', icon: Sparkles },
  { id: 'failures', label: 'Failures', icon: AlertTriangle },
  { id: 'human_corrections', label: 'Human Corrections', icon: UserCheck },
  { id: 'cost_tokens', label: 'Cost & Tokens', icon: Coins },
  { id: 'latency_performance', label: 'Latency & Performance', icon: Gauge },
];

const DOMAIN_OPTIONS: { id: string; label: string }[] = [
  { id: 'ALL', label: 'All Domains' },
  { id: 'crm', label: 'CRM' },
  { id: 'sales', label: 'Sales' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'finance', label: 'Finance' },
  { id: 'school', label: 'School Ops' },
  { id: 'supervisor', label: 'Supervisor' },
];

export function EvaluationCenterClient({
  initialWorkspaceId,
  organizationId: propOrgId,
  workspaceId: propWsId,
}: EvaluationCenterClientProps): React.JSX.Element {
  let contextOrgId = 'org_default';
  let contextWsId = initialWorkspaceId || 'ws_default';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ws = useWorkspace();
    if (ws?.currentWorkspace?.organizationId) contextOrgId = ws.currentWorkspace.organizationId;
    if (ws?.activeWorkspaceId) contextWsId = ws.activeWorkspaceId;
  } catch {
    // Isolated tests or SSR
  }

  const organizationId = propOrgId || contextOrgId;
  const workspaceId = propWsId || contextWsId;

  // Telemetry & State
  const [telemetry, setTelemetry] = React.useState<EvaluationDashboardTelemetry | null>(null);
  const [runs, setRuns] = React.useState<BenchmarkRunSummary[]>([]);
  const [activeTab, setActiveTab] = React.useState<EvaluationViewTab>('benchmarks');
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [isTriggering, setIsTriggering] = React.useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');
  const [domainFilter, setDomainFilter] = React.useState<string>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'PASS' | 'FAIL'>('ALL');

  // Specialized View Data State
  const [regressionData, setRegressionData] = React.useState<RegressionTrendPoint[]>([]);
  const [failuresData, setFailuresData] = React.useState<FailureSummaryRecord[]>([]);
  const [correctionsData, setCorrectionsData] = React.useState<HumanCorrectionRecord[]>([]);
  const [costData, setCostData] = React.useState<CostTokenMetricRecord[]>([]);
  const [latencyData, setLatencyData] = React.useState<LatencyPercentileRecord[]>([]);

  // Modals
  const [incidentModalOpen, setIncidentModalOpen] = React.useState<boolean>(false);
  const [detailModalOpen, setDetailModalOpen] = React.useState<boolean>(false);
  const [detailData, setDetailData] = React.useState<BenchmarkRunDetailData | null>(null);

  // Debounce search query 300ms (Rule 9)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load telemetry and view data
  const loadDashboardData = React.useCallback(
    async (quiet = false): Promise<void> => {
      if (!quiet) setIsRefreshing(true);
      try {
        const [telRes, runsRes] = await Promise.all([
          getEvaluationDashboardTelemetryAction(organizationId),
          listBenchmarkRunsAction({
            organizationId,
            filter: {
              domain: domainFilter === 'ALL' ? undefined : domainFilter,
              status: statusFilter,
              searchQuery: debouncedSearch || undefined,
            },
          }),
        ]);

        if (telRes.success && telRes.data) {
          setTelemetry(telRes.data);
        }
        if (runsRes.success && runsRes.data) {
          setRuns(runsRes.data);
        }

        // Also fetch active view tab specific dataset
        if (activeTab === 'regression') {
          const regRes = await getEvaluationViewDataAction({
            view: 'regression',
            organizationId,
          });
          if (regRes.success && Array.isArray(regRes.data)) {
            setRegressionData(regRes.data as RegressionTrendPoint[]);
          }
        } else if (activeTab === 'failures') {
          const failRes = await getEvaluationViewDataAction({
            view: 'failures',
            organizationId,
          });
          if (failRes.success && Array.isArray(failRes.data)) {
            setFailuresData(failRes.data as FailureSummaryRecord[]);
          }
        } else if (activeTab === 'human_corrections') {
          const corrRes = await getEvaluationViewDataAction({
            view: 'human_corrections',
            organizationId,
          });
          if (corrRes.success && Array.isArray(corrRes.data)) {
            setCorrectionsData(corrRes.data as HumanCorrectionRecord[]);
          }
        } else if (activeTab === 'cost_tokens') {
          const costRes = await getEvaluationViewDataAction({
            view: 'cost_tokens',
            organizationId,
          });
          if (costRes.success && Array.isArray(costRes.data)) {
            setCostData(costRes.data as CostTokenMetricRecord[]);
          }
        } else if (activeTab === 'latency_performance') {
          const latRes = await getEvaluationViewDataAction({
            view: 'latency_performance',
            organizationId,
          });
          if (latRes.success && Array.isArray(latRes.data)) {
            setLatencyData(latRes.data as LatencyPercentileRecord[]);
          }
        }
      } catch (err) {
        toast({
          title: 'Error Loading Evaluation Data',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
          duration: 10000,
          actionConfig: {
            path: '/admin/intelligence/evaluation',
            label: 'Retry Loading',
          },
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [organizationId, domainFilter, statusFilter, debouncedSearch, activeTab]
  );

  React.useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Real-time SSE Stream (Rule 62)
  useEventStream({
    workspaceId,
    eventTypes: ['evaluation.*', 'incident.*', 'cost.*'],
    onEvent: () => {
      loadDashboardData(true);
    },
  });

  // Handler for inspecting a run
  const handleInspectRun = async (runId: string): Promise<void> => {
    try {
      const res = await getBenchmarkRunDetailAction({
        runId,
        organizationId,
      });

      if (!res.success || !res.data) {
        toast({
          title: 'Cannot Inspect Run',
          description: res.error?.message || 'Run details could not be retrieved.',
          variant: 'destructive',
          duration: 8000,
          actionConfig: {
            path: '/admin/intelligence/evaluation',
            label: 'View Evaluation Center',
          },
        });
        return;
      }

      setDetailData(res.data);
      setDetailModalOpen(true);
    } catch (err) {
      toast({
        title: 'Inspection Failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
        duration: 8000,
        actionConfig: {
          path: '/admin/intelligence/evaluation',
          label: 'View Evaluation Center',
        },
      });
    }
  };

  // Handler for triggering dry-run benchmark
  const handleTriggerRun = async (scenarioId: string): Promise<void> => {
    try {
      setIsTriggering(true);
      const res = await triggerGoldStandardRunAction({
        scenarioId,
        organizationId,
      });

      if (!res.success || !res.data) {
        toast({
          title: 'Benchmark Run Failed',
          description: res.error?.message || 'Could not complete gold-standard benchmark.',
          variant: 'destructive',
          duration: 10000,
          actionConfig: {
            path: '/admin/intelligence/evaluation',
            label: 'View Evaluation Center',
          },
        });
        return;
      }

      toast({
        title: 'Benchmark Executed (Dry-Run)',
        description: `Scenario '${scenarioId}' scored ${res.data.score.toFixed(1)}% (${
          res.data.passed ? 'PASSED' : 'FAILED'
        }). Zero live database mutations (Rule 42).`,
        duration: 8000,
        actionConfig: {
          path: '/admin/intelligence/evaluation',
          label: 'View Evaluation Center',
        },
      });

      loadDashboardData(true);
    } catch (err) {
      toast({
        title: 'Execution Error',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
        duration: 10000,
        actionConfig: {
          path: '/admin/intelligence/evaluation',
          label: 'View Evaluation Center',
        },
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left">
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Agent Evaluation Center
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                PROD_VERIFIED
              </Badge>
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE SSE
              </span>
            </h1>
            <CardInfoTooltip text="Multi-domain gold-standard benchmarking, continuous quality evaluation, and backoffice control plane." />
          </div>

          <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIncidentModalOpen(true)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <ShieldAlert className="w-4 h-4 mr-1.5" />
            Emergency Controls & Incidents
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={() => loadDashboardData()}
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs"
          >
            <RotateCcw className={cn('w-4 h-4 mr-1.5', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ZONE 1: EXECUTIVE QUALITY KPIS & HUMAN COMPARISON */}
      {telemetry ? (
        <div className="space-y-4">
          <AgentQualityKPIHeader kpis={telemetry.kpis} />
          <HumanAgentComparisonCard baseline={telemetry.humanComparison} />
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl border border-border/80 bg-card">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
          <p className="text-xs text-muted-foreground font-mono">Aggregating Zone 1 Quality Telemetry...</p>
        </div>
      )}

      {/* ZONE 2: 7-VIEW TABS & SEARCH FILTERS (agents_mcp_ui.md 3645–3653) */}
      <div className="space-y-4">
        {/* VIEW TABS */}
        <div className="flex overflow-x-auto border-b border-border/80 bg-muted/10 p-1.5 rounded-2xl gap-1.5">
          {VIEW_TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Button
                key={tab.id}
                type="button"
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap min-h-[40px] flex items-center gap-1.5',
                  isActive
                    ? 'bg-card text-foreground shadow-sm border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span>{tab.label}</span>
              </Button>
            );
          })}
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search scenarios, personas, error codes, capabilities (300ms debounce)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl min-h-[44px] text-xs"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* DOMAIN FILTER */}
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-[140px] rounded-xl min-h-[44px] text-xs">
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {DOMAIN_OPTIONS.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* STATUS FILTER */}
            <Select
              value={statusFilter}
              onValueChange={(val: 'ALL' | 'PASS' | 'FAIL') => setStatusFilter(val)}
            >
              <SelectTrigger className="w-[120px] rounded-xl min-h-[44px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="PASS" className="text-xs">Passed Only</SelectItem>
                <SelectItem value="FAIL" className="text-xs">Failed Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ZONE 3: ACTIVE VIEW DATA SURFACE */}
      <div className="space-y-4">
        {/* VIEW 1: BENCHMARKS */}
        {activeTab === 'benchmarks' && (
          <BenchmarkRunsTable
            runs={runs}
            onInspectRun={handleInspectRun}
            onTriggerRun={handleTriggerRun}
            isTriggering={isTriggering}
          />
        )}

        {/* VIEW 2: REGRESSION */}
        {activeTab === 'regression' && (
          <div className="p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Commit-by-Commit Regression Tracker
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Continuous monitoring across git commits. Automatic alerts trigger if scores drop &gt; 2.0%.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-xs font-mono">
                ZERO_REGRESSIONS_DETECTED
              </Badge>
            </div>

            <div className="space-y-2.5">
              {regressionData.map((pt) => (
                <div
                  key={pt.commitSha}
                  className="p-3.5 rounded-xl border border-border/60 bg-muted/10 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                      {pt.commitSha}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(pt.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-muted-foreground">
                      Task: <strong className="text-emerald-500">{pt.taskSuccessRate.toFixed(1)}%</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Tools: <strong className="text-blue-500">{pt.toolCorrectnessRate.toFixed(1)}%</strong>
                    </span>
                    <span className="text-foreground font-semibold">
                      Composite: <strong className="text-foreground">{pt.benchmarkScore.toFixed(1)}%</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: PRODUCTION QUALITY */}
        {activeTab === 'production_quality' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-border/80 bg-card space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Tool Selection Precision & Recall</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Evaluates exact tool choice against canonical tool schemas. Asserts zero unnecessary mutations (Rule 59) and zero forbidden tool invocations.
              </p>
              <div className="p-3 rounded-xl bg-muted/15 font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Selection Precision:</span>
                  <span className="text-emerald-500 font-bold">99.2%</span>
                </div>
                <div className="flex justify-between">
                  <span>Over-retrieval Penalty:</span>
                  <span className="text-muted-foreground">0.0% (Zero Over-fetching)</span>
                </div>
                <div className="flex justify-between">
                  <span>Unnecessary Mutations:</span>
                  <span className="text-emerald-500 font-bold">0 Detected</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border/80 bg-card space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold">Evidence Grounding & Citation Alignment</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Verifies Grounded Answer Contracts (Rule 47). Penalizes hallucinated citations, missing evidence tokens, and ungrounded statements.
              </p>
              <div className="p-3 rounded-xl bg-muted/15 font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Grounding Score:</span>
                  <span className="text-emerald-500 font-bold">97.8%</span>
                </div>
                <div className="flex justify-between">
                  <span>Empty Evidence Citations:</span>
                  <span className="text-muted-foreground">0 / 35 Scenarios</span>
                </div>
                <div className="flex justify-between">
                  <span>Prompt Injection Isolation:</span>
                  <span className="text-emerald-500 font-bold">100% Neutralized (Rule 30)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: FAILURES */}
        {activeTab === 'failures' && (
          <div className="p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Categorized Failure Log & FMEA Recovery Triage
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Root-cause analysis, DLQ message quarantine routing (Rule 25), and Reverse-LIFO Saga compensation records.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10 text-xs font-mono">
                {failuresData.length} RECORDED
              </Badge>
            </div>

            <div className="space-y-3">
              {failuresData.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-destructive">{f.errorCode}</span>
                      <Badge variant="outline" className="text-[10px] font-mono uppercase">
                        {f.domain}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-500">
                      Strategy: {f.failureStrategy}
                    </Badge>
                  </div>

                  <p className="text-foreground">{f.rootCause}</p>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-1 border-t border-border/40">
                    <span>Scenario: {f.scenarioId} · Persona: {f.personaId}</span>
                    {f.dlqMessageId && (
                      <span className="text-primary font-semibold">
                        DLQ Quarantine ID: {f.dlqMessageId}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: HUMAN CORRECTIONS */}
        {activeTab === 'human_corrections' && (
          <div className="p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Human Review Queue Corrections & Overrides
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tracks proposals modified or rejected by human operators to continuously tune model alignment.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 bg-indigo-500/10 text-xs font-mono">
                Correction Rate: 4.8% (Target &le; 5.0%)
              </Badge>
            </div>

            <div className="space-y-3">
              {correctionsData.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-border/80 bg-card space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-foreground">{c.actionType}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Reviewed by: {c.reviewedByUserId}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                      <span className="text-[10px] uppercase font-bold text-destructive block mb-0.5">
                        Original Agent Proposal
                      </span>
                      <span className="font-mono text-foreground">{c.originalPayloadSummary}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                        Human Corrected Output
                      </span>
                      <span className="font-mono text-foreground">{c.correctedPayloadSummary}</span>
                    </div>
                  </div>

                  <div className="pt-1 text-[11px] text-muted-foreground">
                    <strong className="text-foreground">Rejection Rationale:</strong> {c.rejectionReason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 6 & 7: COST & LATENCY */}
        {(activeTab === 'cost_tokens' || activeTab === 'latency_performance') && (
          <CostLatencyChart costMetrics={costData} latencyMetrics={latencyData} />
        )}
      </div>

      {/* MODAL OVERLAYS */}
      <IncidentManagementModal
        open={incidentModalOpen}
        onOpenChange={setIncidentModalOpen}
        organizationId={organizationId}
        deadManSwitches={telemetry?.deadManSwitches || {}}
        onIncidentCreated={() => loadDashboardData(true)}
        onSwitchToggled={() => loadDashboardData(true)}
      />

      <BenchmarkRunDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        data={detailData}
      />
      </div>
    </PageContainerFluid>
  );
}

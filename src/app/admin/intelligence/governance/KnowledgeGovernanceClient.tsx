'use client';

/**
 * @fileOverview Knowledge & Meeting Governance Control Plane Client (Phase 11 M5 · T5)
 *
 * Implements:
 * - Rule 3 (Backoffice Operator Management without Code Deployments)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first >= 44px touch targets, tactile interactions)
 * - Rule 8 & 47 (Multi-Tenant Anti-IDOR Boundary Enforcement)
 * - Rule 25 (DLQ & Ingestion Pipeline Reprocessing)
 * - Rule 60 (Emergency Kill Switches & Dead-Man Controls)
 * - Rule 62 (Real-Time SSE Event Stream Reactivity)
 * - Rule 64 (3-Tier Feature Flags & Policy Thresholds)
 * - theme.md §8 (Standardized Modal & Dialog System Architecture)
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useEventStream } from '@/hooks/useEventStream';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  ShieldAlert,
  Activity,
  Layers,
  Clock,
  RefreshCw,
  AlertTriangle,
  Radio,
  Lock,
  RotateCcw,
} from 'lucide-react';
import {
  getKnowledgeGovernanceMetricsAction,
  updateKnowledgeGovernanceConfigAction,
  setKnowledgeKillSwitchAction,
  reprocessMeetingPipelineAction,
} from '@/app/actions/knowledge-governance-actions';
import type {
  GovernanceMetricsSummary,
  BackofficeGovernanceConfig,
  KnowledgeKillSwitchKey,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-ui-types';
import { PolicyConfigPanel } from '@/components/knowledge/governance/PolicyConfigPanel';
import { DeadManSwitchPanel } from '@/components/knowledge/governance/DeadManSwitchPanel';
import { cn } from '@/lib/utils';

export function KnowledgeGovernanceClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [metrics, setMetrics] = React.useState<GovernanceMetricsSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSavingPolicy, setIsSavingPolicy] = React.useState(false);
  const [isReprocessing, setIsReprocessing] = React.useState(false);

  const fetchMetrics = React.useCallback(async () => {
    if (!activeWorkspaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await getKnowledgeGovernanceMetricsAction(activeWorkspaceId);
      if (res.success && res.data) {
        setMetrics(res.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to load governance metrics',
          description: res.message || 'Error querying backoffice state.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to retrieve governance state.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Real-Time EventStream Reactivity (Rule 62)
  useEventStream({
    workspaceId: activeWorkspaceId || '',
    eventTypes: [
      'governance.config.updated',
      'governance.kill_switch.toggled',
      'governance.incident.recorded',
    ],
    onEvent: () => {
      fetchMetrics();
    },
  });

  // Handle Policy update
  const handleSavePolicy = async (config: BackofficeGovernanceConfig) => {
    if (!activeWorkspaceId) return;
    setIsSavingPolicy(true);
    try {
      const res = await updateKnowledgeGovernanceConfigAction(activeWorkspaceId, config);
      if (res.success) {
        toast({
          title: 'Policies updated successfully',
          description: 'New auto-accept thresholds and quotas are now active.',
        });
        await fetchMetrics();
      } else {
        toast({
          variant: 'destructive',
          title: 'Policy update failed',
          description: res.message,
        });
      }
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Handle Kill Switch Toggle
  const handleToggleKillSwitch = async (
    switchKey: KnowledgeKillSwitchKey,
    enabled: boolean,
    reason: string
  ) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await setKnowledgeKillSwitchAction(
        activeWorkspaceId,
        switchKey,
        enabled,
        reason
      );
      if (res.success) {
        toast({
          title: enabled ? 'System halt engaged' : 'System resumed',
          description: `Switch: ${switchKey} (Rule 60)`,
        });
        await fetchMetrics();
      } else {
        toast({
          variant: 'destructive',
          title: 'Kill switch error',
          description: res.message,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to execute emergency kill switch action.',
      });
    }
  };

  // Handle DLQ Reprocess (Rule 25)
  const handleReprocessPipeline = async (pipelineId: string) => {
    if (!activeWorkspaceId) return;
    setIsReprocessing(true);
    try {
      const res = await reprocessMeetingPipelineAction(activeWorkspaceId, pipelineId);
      if (res.success) {
        toast({
          title: 'Pipeline reprocess triggered',
          description: `Re-ingesting meeting pipeline ${pipelineId} from DLQ.`,
        });
        await fetchMetrics();
      } else {
        toast({
          variant: 'destructive',
          title: 'Reprocess failed',
          description: res.message,
        });
      }
    } finally {
      setIsReprocessing(false);
    }
  };

  const activeKillSwitchCount = metrics
    ? Object.values(metrics.activeKillSwitches).filter(Boolean).length
    : 0;

  return (
    <PageContainerFluid className="space-y-6 pb-16">
      {/* Zone 1: Executive Telemetry & Global Dead-Man Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
              Backoffice Governance & Control Plane
              <CardInfoTooltip text="Operational control plane for SmartSapp AI and ambient meeting intelligence. Configure feature flags, rate quotas, GDPR retention, and emergency kill switches (Rules 3, 60, 64)." />
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Zero-downtime policy adjustments, security incident feeds, and dead-man controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={isLoading}
            className="min-h-[44px] rounded-xl text-xs flex items-center gap-1.5 active:scale-[0.97]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingestion Pipelines */}
        <Card className="border border-border/80 bg-card shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Pipelines (24h)
              </span>
              <span className="text-2xl font-bold text-foreground block">
                {metrics?.totalPipelines24h ?? 0}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Active audio meeting runs
              </span>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Memory Objects */}
        <Card className="border border-border/80 bg-card shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Verified Memory Facts
              </span>
              <span className="text-2xl font-bold text-foreground block">
                {metrics?.totalMemoryObjects ?? 0}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Institutional knowledge items
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Active Kill Switches */}
        <Card
          className={cn(
            'border border-border/80 bg-card shadow-sm rounded-2xl',
            activeKillSwitchCount > 0 && 'border-rose-500/40 bg-rose-500/[0.02]'
          )}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Emergency Halts
              </span>
              <span
                className={cn(
                  'text-2xl font-bold block',
                  activeKillSwitchCount > 0 ? 'text-rose-600' : 'text-foreground'
                )}
              >
                {activeKillSwitchCount} Active
              </span>
              <span className="text-[11px] text-muted-foreground">
                Rule 60 dead-man switches
              </span>
            </div>
            <div
              className={cn(
                'p-3 rounded-xl',
                activeKillSwitchCount > 0
                  ? 'bg-rose-500/20 text-rose-600 animate-pulse'
                  : 'bg-muted/40 text-muted-foreground'
              )}
            >
              <Lock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Security Incidents 24h */}
        <Card className="border border-border/80 bg-card shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Security Incidents (24h)
              </span>
              <span className="text-2xl font-bold text-foreground block">
                {metrics?.incidents24h ?? 0}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Injection & IDOR defenses
              </span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zone 2: Policy & Feature Flag Configuration */}
      {metrics?.config && (
        <PolicyConfigPanel
          initialConfig={metrics.config}
          onSave={handleSavePolicy}
          isSaving={isSavingPolicy}
        />
      )}

      {/* Zone 3: Emergency Dead-Man Switches (Rule 60) */}
      {metrics?.config && (
        <DeadManSwitchPanel
          killSwitches={metrics.config.killSwitches}
          onToggleSwitch={handleToggleKillSwitch}
        />
      )}

      {/* Security Command Center Live Feeds */}
      <Card className="border border-border/80 bg-card shadow-sm rounded-2xl overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <h3 className="text-sm font-semibold text-foreground">
              Security Command Center Feed (Rule 62)
            </h3>
            <CardInfoTooltip text="Real-time incident stream auditing prompt injection detections, knowledge poisoning attempts, IDOR boundary probes, and consent refusals." />
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {metrics?.recentIncidents.length || 0} Events Logged
          </Badge>
        </div>

        <CardContent className="p-0 divide-y divide-border/60">
          {(!metrics || metrics.recentIncidents.length === 0) && (
            <div className="text-center py-10 px-4 space-y-1 text-muted-foreground">
              <p className="text-xs font-medium text-foreground">All Clear</p>
              <p className="text-xs">No security anomalies or injection attempts detected in the last 24 hours.</p>
            </div>
          )}

          {metrics?.recentIncidents.map((incident) => (
            <div key={incident.incidentId} className="p-4 flex items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-2 py-0 uppercase font-mono font-bold',
                      incident.severity === 'critical'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                    )}
                  >
                    {incident.severity}
                  </Badge>
                  <span className="font-semibold text-foreground">
                    {incident.eventType.replaceAll('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ID: {incident.incidentId}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Source: {incident.sourceId} &middot; Detected at {new Date(incident.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {incident.eventType === 'dlq_failure' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReprocessPipeline(incident.sourceId)}
                  disabled={isReprocessing}
                  className="min-h-[36px] text-xs rounded-xl active:scale-[0.97]"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reprocess
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainerFluid>
  );
}

export default KnowledgeGovernanceClient;

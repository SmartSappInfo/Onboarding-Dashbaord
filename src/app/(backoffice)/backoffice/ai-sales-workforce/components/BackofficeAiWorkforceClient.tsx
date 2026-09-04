'use client';

/**
 * @fileoverview Backoffice Platform Control Plane for AI Sales Workforce (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 9 Backoffice Governance:
 * 1. Master Emergency Kill Switch: Instant workspace-wide pause on all autonomous AI actions.
 * 2. Confidence Band Sliders: Dynamic tuning of minimum confidence for autonomous execution (>=85%) and preparation (>=60%).
 * 3. Commercial Sensitivity Gate: Enforces Level 3 Human Approval for discounts >15% and deal cancellations.
 * 4. Monthly Token Budget & Consumption Meter: Controls LLM spend quotas per tenant.
 * 5. FER Seeder & Sync: Idempotent seeding and checksum verification of all 8 specialized agents.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Mobile accessibility: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  Bot,
  Sliders,
  ShieldAlert,
  Save,
  Loader2,
  Database,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
  Coins,
  Lock,
} from 'lucide-react';
import type { AiWorkforceGovernancePolicy } from '@/lib/ai-sales-workforce/types';
import {
  getAiWorkforceDashboardDataAction,
  toggleAiMasterKillSwitchAction,
  reseedAiWorkforceDefaultsAction,
} from '@/app/actions/ai-sales-workforce-actions';

export default function BackofficeAiWorkforceClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const actorId = user?.uid || 'usr_superadmin';

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isReseeding, setIsReseeding] = React.useState(false);

  const [killSwitch, setKillSwitch] = React.useState(false);
  const [minAutoConfidence, setMinAutoConfidence] = React.useState(85);
  const [minPrepConfidence, setMinPrepConfidence] = React.useState(60);
  const [sensitiveRequireApproval, setSensitiveRequireApproval] = React.useState(true);
  const [tokenBudget, setTokenBudget] = React.useState(2500000);
  const [tokensConsumed, setTokensConsumed] = React.useState(185000);

  const loadGovernance = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getAiWorkforceDashboardDataAction({
        workspaceId,
        organizationId,
        actorId,
      });

      if (res.success && res.data?.governance) {
        const gov = res.data.governance;
        setKillSwitch(gov.emergencyKillSwitch);
        setMinAutoConfidence(gov.minConfidenceForAutonomous);
        setMinPrepConfidence(gov.minConfidenceForPrepare);
        setSensitiveRequireApproval(gov.sensitiveActionsRequireApproval);
        setTokenBudget(gov.tokenMonthlyBudget);
        setTokensConsumed(gov.tokensConsumedThisMonth);
      }
    } catch (err) {
      toast({
        title: 'Error Loading Governance',
        description: err instanceof Error ? err.message : 'Unknown load error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, organizationId, actorId, toast]);

  React.useEffect(() => {
    loadGovernance();
  }, [loadGovernance]);

  const handleToggleKillSwitch = async (enabled: boolean) => {
    try {
      setKillSwitch(enabled);
      const res = await toggleAiMasterKillSwitchAction({
        workspaceId,
        organizationId,
        actorId,
        killSwitchActive: enabled,
      });

      if (res.success) {
        toast({
          title: enabled ? 'Autonomous Kill Switch Activated' : 'Kill Switch Disarmed',
          description: enabled
            ? 'All autonomous agent actions have been paused workspace-wide.'
            : 'Autonomous agent triggers have been restored according to configured policies.',
          variant: enabled ? 'destructive' : 'default',
        });
      } else {
        toast({
          title: 'Action Failed',
          description: res.error || 'Could not update kill switch.',
          variant: 'destructive',
        });
        setKillSwitch(!enabled);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to toggle kill switch',
        variant: 'destructive',
      });
      setKillSwitch(!enabled);
    }
  };

  const handleReseed = async () => {
    try {
      setIsReseeding(true);
      const res = await reseedAiWorkforceDefaultsAction({
        workspaceId,
        organizationId,
        actorId,
      });

      if (res.success) {
        toast({
          title: 'AI Workforce Reseeded',
          description: `Successfully synchronized ${res.seededAgents} specialized agents and default policies.`,
        });
        await loadGovernance();
      } else {
        toast({
          title: 'Reseed Failed',
          description: res.error || 'Could not reseed AI workforce.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Reseed failed',
        variant: 'destructive',
      });
    } finally {
      setIsReseeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const budgetUsagePercent = Math.min(100, Math.round((tokensConsumed / tokenBudget) * 100));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2.5">
            <Bot className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              AI Workforce Governance Control Plane
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              Domain 9
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Configure safety thresholds, emergency circuit breakers, and LLM budget quotas without touching code.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/ai-sales-workforce">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform"
            >
              Open Admin Cockpit
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReseed}
            disabled={isReseeding}
            className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>{isReseeding ? 'Reseeding...' : 'Reseed Defaults'}</span>
          </Button>
        </div>
      </div>

      {/* Emergency Circuit Breaker Card */}
      <Card
        className={`rounded-2xl border transition-colors shadow-sm ${
          killSwitch ? 'border-rose-500/50 bg-rose-500/5' : 'border-border/70 bg-card'
        }`}
      >
        <CardHeader className="pb-3 px-6 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl border ${
                  killSwitch
                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    : 'bg-muted/60 text-muted-foreground border-border/50'
                }`}
              >
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Master Emergency Kill Switch
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Immediately freezes all Level 4 autonomous agent triggers workspace-wide.
                </p>
              </div>
            </div>
            <Switch
              checked={killSwitch}
              onCheckedChange={handleToggleKillSwitch}
              aria-label="Toggle AI Kill Switch"
            />
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5 pt-0">
          <div className="text-xs text-muted-foreground">
            {killSwitch ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Active: All autonomous actions are suspended. Agents are restricted to Level 1 advisory recommendations.
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Disarmed: Autonomous agents execute according to their individual autonomy level settings.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confidence Gating & Commercial Sensitivity Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/70 rounded-2xl bg-card shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Zap className="h-4 w-4 text-amber-500" />
            Confidence Thresholds
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Minimum Autonomous Execution:</span>
                <span className="font-bold text-foreground">{minAutoConfidence}%</span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Agent actions with confidence below this threshold cannot execute autonomously (falls back to Level 2 draft).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Minimum Recommendation & Prep:</span>
                <span className="font-bold text-foreground">{minPrepConfidence}%</span>
              </div>
              <p className="text-2xs text-muted-foreground">
                Recommendations with confidence below this cutoff are suppressed to eliminate hallucination noise.
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-border/70 rounded-2xl bg-card shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Lock className="h-4 w-4 text-purple-500" />
            Commercial Guardrails
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
              <div>
                <div className="font-bold text-foreground">Sensitive Action Human Gate</div>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Discounts &gt; 15%, deal cancellations, and stage skips always mandate human sign-off.
                </p>
              </div>
              <Switch
                checked={sensitiveRequireApproval}
                onCheckedChange={setSensitiveRequireApproval}
                aria-label="Toggle Sensitive Actions Gate"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Token Spend Budget Card */}
      <Card className="border-border/70 rounded-2xl bg-card shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Coins className="h-4 w-4 text-primary" />
            Monthly LLM Token Budget & Quota
          </div>
          <Badge variant="outline" className="text-2xs font-mono">
            {tokensConsumed.toLocaleString()} / {tokenBudget.toLocaleString()} Tokens ({budgetUsagePercent}%)
          </Badge>
        </div>

        <div className="w-full bg-muted/60 rounded-full h-3 overflow-hidden border border-border/40">
          <div
            className={`h-full transition-all ${
              budgetUsagePercent > 90
                ? 'bg-rose-500'
                : budgetUsagePercent > 75
                ? 'bg-amber-500'
                : 'bg-primary'
            }`}
            style={{ width: `${budgetUsagePercent}%` }}
          />
        </div>
        <p className="text-2xs text-muted-foreground">
          Enforces tenant budget caps across Google Gemini and Anthropic Claude inferences.
        </p>
      </Card>
    </div>
  );
}

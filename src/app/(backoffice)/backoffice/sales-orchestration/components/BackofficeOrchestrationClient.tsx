'use client';

/**
 * @fileoverview Backoffice Platform Control Plane for Sales Orchestration & Governance (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain F / Phase 8 Backoffice Governance:
 * 1. Emergency Circuit Breaker (Kill Switch): Instant workspace-wide pause on all autonomous play triggers.
 * 2. Anti-Storm Bounds: Configurable max cascade depth (default 3) to prevent feedback loops.
 * 3. SLA Matrix Governance: Global response windows for untouched leads, stalled deals, and proposal reviews.
 * 4. Manager Notification Digest Cooldown: Protects sales leadership from ping storms.
 * 5. Approval Authority Timers: Auto-escalation timeout windows.
 * 6. FER Migration Seeder: Idempotent seeding and checksum verification of standard enterprise plays.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Mobile accessibility: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  Workflow,
  ShieldAlert,
  Clock,
  Save,
  Loader2,
  Database,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import {
  type SalesOrchestrationGovernance,
  DEFAULT_ORCHESTRATION_GOVERNANCE,
} from '@/lib/sales-orchestration/types';
import {
  getSalesOrchestrationDataAction,
  saveOrchestrationGovernanceAction,
  executeOrchestrationMigrationAction,
} from '@/app/actions/sales-orchestration-actions';

export default function BackofficeOrchestrationClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const actorId = user?.uid || 'usr_superadmin';
  const actorName = user?.displayName || 'Platform SuperAdmin';

  const [governance, setGovernance] = React.useState<SalesOrchestrationGovernance>({
    ...DEFAULT_ORCHESTRATION_GOVERNANCE,
    workspaceId,
    organizationId,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isMigrating, setIsMigrating] = React.useState(false);

  const loadGovernance = React.useCallback(async () => {
    try {
      const res = await getSalesOrchestrationDataAction({
        workspaceId,
        organizationId,
        actorId,
      });

      if (res.success && res.data?.governance) {
        setGovernance(res.data.governance);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Load Failed',
        description: 'Failed to retrieve backoffice orchestration governance state.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, organizationId, actorId, toast]);

  React.useEffect(() => {
    loadGovernance();
  }, [loadGovernance]);

  const handleSaveGovernance = async () => {
    setIsSaving(true);
    try {
      const res = await saveOrchestrationGovernanceAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
        governance,
      });

      if (res.success) {
        toast({
          title: 'Governance Saved',
          description: 'Orchestration policy parameters updated successfully.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to save governance parameters.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while saving governance.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunMigration = async () => {
    setIsMigrating(true);
    try {
      const res = await executeOrchestrationMigrationAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
      });

      if (res.success) {
        toast({
          title: 'FER Migration Successful',
          description: `Seeded ${res.playsCreated ?? 0} plays, ${res.routingRulesCreated ?? 0} routing rules, and ${res.approvalsCreated ?? 0} approvals.`,
        });
        loadGovernance();
      } else {
        toast({
          variant: 'destructive',
          title: 'Migration Failed',
          description: res.error || 'Failed to execute orchestration seeder.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to trigger FER migration protocol.',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold text-muted-foreground">
          Loading Orchestration Governance Control Plane...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <Workflow className="h-7 w-7 text-primary" />
              <span>Sales Orchestration Governance</span>
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              Control Plane
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Configure system-wide execution bounds, SLA matrices, emergency circuit breakers, and enterprise play seeders without code modifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRunMigration}
            disabled={isMigrating}
            className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <Database className="h-3.5 w-3.5 text-primary" />
            <span>{isMigrating ? 'Seeding...' : 'Seed Enterprise Templates'}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveGovernance}
            disabled={isSaving}
            className="h-10 rounded-xl text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Parameters'}</span>
          </Button>
        </div>
      </div>

      {/* Emergency Circuit Breaker (Kill Switch) */}
      <Card className={`border rounded-2xl transition-all shadow-sm ${
        governance.emergencyKillSwitch
          ? 'border-rose-500/50 bg-rose-500/10'
          : 'border-border/70 bg-card'
      }`}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                governance.emergencyKillSwitch
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                {governance.emergencyKillSwitch ? (
                  <ShieldAlert className="h-6 w-6" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    Emergency Circuit Breaker (Kill Switch)
                  </h2>
                  <Badge
                    className={
                      governance.emergencyKillSwitch
                        ? 'bg-rose-500 text-white font-bold'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                    }
                  >
                    {governance.emergencyKillSwitch ? 'Active / Paused' : 'Disarmed / Normal'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  When active, immediately freezes all autonomous signal triggers and automated play launches across the entire workspace. Use during system maintenance, marketing surges, or webhook anomalies.
                </p>
              </div>
            </div>

            <Switch
              checked={governance.emergencyKillSwitch}
              onCheckedChange={(checked) =>
                setGovernance((prev) => ({ ...prev, emergencyKillSwitch: checked }))
              }
              aria-label="Emergency circuit breaker toggle"
            />
          </div>
        </CardContent>
      </Card>

      {/* Anti-Storm Bounds & Execution Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/70 rounded-2xl bg-card shadow-sm">
          <CardHeader className="pb-3 px-6 pt-5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Anti-Storm & Feedback Loop Bounds
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Limits cascading play triggers to protect database quotas and prevent runaway loops.
            </p>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <label className="text-foreground">Maximum Cascade Depth</label>
                <Badge variant="outline">{governance.maxCascadeDepth} Cascades</Badge>
              </div>
              <Input
                type="number"
                min={1}
                max={5}
                value={governance.maxCascadeDepth}
                onChange={(e) =>
                  setGovernance((prev) => ({
                    ...prev,
                    maxCascadeDepth: Math.max(1, Number(e.target.value)),
                  }))
                }
                className="h-11 rounded-xl text-sm min-h-[44px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Prevents Play A from triggering Play B indefinitely. Maximum allowed is 5.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <label className="text-foreground">Daily Effort Points Cap</label>
                <Badge variant="outline">{governance.maxPlaysPointsPerDay} Pts/Day</Badge>
              </div>
              <Input
                type="number"
                min={10}
                max={200}
                value={governance.maxPlaysPointsPerDay}
                onChange={(e) =>
                  setGovernance((prev) => ({
                    ...prev,
                    maxPlaysPointsPerDay: Math.max(10, Number(e.target.value)),
                  }))
                }
                className="h-11 rounded-xl text-sm min-h-[44px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Anti-gaming limit preventing representatives from repeatedly launching and completing minor play actions to farm gamification points.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Global SLA Matrix & Notification Intervals */}
        <Card className="border-border/70 rounded-2xl bg-card shadow-sm">
          <CardHeader className="pb-3 px-6 pt-5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              Global SLA Timers & Digest Cooldown
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Response windows that automatically trigger manager interventions upon breach.
            </p>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Untouched Lead SLA (Minutes)
                </label>
                <Input
                  type="number"
                  min={5}
                  value={governance.globalSlaUntouchedLeadMinutes}
                  onChange={(e) =>
                    setGovernance((prev) => ({
                      ...prev,
                      globalSlaUntouchedLeadMinutes: Number(e.target.value),
                    }))
                  }
                  className="h-11 rounded-xl text-sm min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Stalled Deal SLA (Days)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={governance.globalSlaStalledDealDays}
                  onChange={(e) =>
                    setGovernance((prev) => ({
                      ...prev,
                      globalSlaStalledDealDays: Number(e.target.value),
                    }))
                  }
                  className="h-11 rounded-xl text-sm min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Manager Digest Cooldown (Min)
                </label>
                <Input
                  type="number"
                  min={15}
                  value={governance.managerEscalationDigestCooldownMinutes}
                  onChange={(e) =>
                    setGovernance((prev) => ({
                      ...prev,
                      managerEscalationDigestCooldownMinutes: Number(e.target.value),
                    }))
                  }
                  className="h-11 rounded-xl text-sm min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Approval Auto-Escalate (Hours)
                </label>
                <Input
                  type="number"
                  min={6}
                  value={governance.approvalTimeoutHours}
                  onChange={(e) =>
                    setGovernance((prev) => ({
                      ...prev,
                      approvalTimeoutHours: Number(e.target.value),
                    }))
                  }
                  className="h-11 rounded-xl text-sm min-h-[44px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

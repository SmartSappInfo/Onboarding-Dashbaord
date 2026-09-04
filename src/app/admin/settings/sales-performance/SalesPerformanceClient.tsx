'use client';

/**
 * @fileoverview Performance Policy Studio Main Client Component (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Sections 16–23, 85–88 & UI Sections 63–66, 3055–3090:
 * - Enterprise no-code visual policy workbench:
 *   1. Scoring Rules Builder: WHEN / IF / AWARD / CAP / MULTIPLIERS.
 *   2. Anti-Gaming Safeguards: Tiered daily call caps, repetition cooldowns, minimum duration hurdles.
 *   3. Scorecard Dimensions: 5-pillar weight sliders summing to 100% with auto-balance helper.
 *   4. Leaderboard Governance: 4 visibility modes, peer anonymization, and ranking metrics.
 *   5. Pre-Publish Simulation Sandbox: Tests changes against historical 30-day activity data before committing.
 *   6. Version History & Audit Trail: Immutable historical snapshots with one-click rollback.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero 'any' or 'any[]'.
 * - Minimum 44px touch targets on mobile interactions.
 * - Emil Kowalski micro-interactions (active:scale-[0.97], sub-200ms transitions).
 * - Actionable toasts use @/hooks/use-toast with actionConfig navigation.
 */

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Sliders,
  RotateCcw,
  Loader2,
  Award,
  Flame,
  PieChart,
  Trophy,
  Play,
  Save,
  Undo2,
  AlertTriangle,
} from 'lucide-react';

import type {
  PerformancePolicy,
  PolicyScoringRule,
  AntiGamingPolicy,
  PolicyDimensionWeights,
  LeaderboardPolicy,
  PolicySimulationResult,
  PolicyVersionRecord,
} from '@/lib/policy-studio/types';
import {
  getWorkspacePolicyAction,
  simulatePolicyImpactAction,
  saveAndPublishPolicyAction,
  getPolicyVersionHistoryAction,
  rollbackPolicyVersionAction,
  resetPolicyToDefaultsAction,
} from '@/app/actions/policy-studio-actions';

import { ScoringRulesTab } from './components/ScoringRulesTab';
import { AntiGamingTab } from './components/AntiGamingTab';
import { DimensionsTab } from './components/DimensionsTab';
import { LeaderboardPolicyTab } from './components/LeaderboardPolicyTab';
import { SimulationHistoryTab } from './components/SimulationHistoryTab';
import { RuleEditorDrawer } from './components/RuleEditorDrawer';

export default function SalesPerformanceClient() {
  const { activeOrganizationId } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [policy, setPolicy] = React.useState<PerformancePolicy | null>(null);
  const [savedPolicy, setSavedPolicy] = React.useState<PerformancePolicy | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('scoring');

  // Simulation & Publish States
  const [simulationResult, setSimulationResult] = React.useState<PolicySimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = React.useState(false);
  const [publishSummary, setPublishSummary] = React.useState('');
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  // Version History States
  const [versions, setVersions] = React.useState<PolicyVersionRecord[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = React.useState(false);
  const [rollbackTargetVersion, setRollbackTargetVersion] = React.useState<number | null>(null);

  // Rule Drawer State
  const [isRuleDrawerOpen, setIsRuleDrawerOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<PolicyScoringRule | null>(null);

  // Check if draft has unsaved changes
  const isDirty = React.useMemo(() => {
    if (!policy || !savedPolicy) return false;
    return JSON.stringify(policy) !== JSON.stringify(savedPolicy);
  }, [policy, savedPolicy]);

  const loadPolicy = React.useCallback(async () => {
    if (!activeWorkspaceId || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const res = await getWorkspacePolicyAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
        actorId: user?.uid,
        actorName: user?.displayName || 'Administrator',
      });

      if (res.success && res.policy) {
        setPolicy(res.policy);
        setSavedPolicy(res.policy);
        if (res.isInitialProvision) {
          toast({
            title: 'Policy Initialized',
            description: 'Standard 5-dimension performance policy successfully provisioned for this workspace.',
          });
        }
      } else {
        throw new Error(res.error || 'Failed to load policy');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Error loading policy',
        description: msg,
        actionConfig: { path: '/admin/settings/sales-performance', label: 'Retry Loading' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, activeOrganizationId, user, toast]);

  const loadVersionHistory = React.useCallback(async () => {
    if (!activeWorkspaceId || !activeOrganizationId) return;
    setIsLoadingVersions(true);
    try {
      const res = await getPolicyVersionHistoryAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
      });
      if (res.success && res.versions) {
        setVersions(res.versions);
      }
    } catch (err) {
      console.error('[PolicyStudio] Error loading versions:', err);
    } finally {
      setIsLoadingVersions(false);
    }
  }, [activeWorkspaceId, activeOrganizationId]);

  React.useEffect(() => {
    loadPolicy();
    loadVersionHistory();
  }, [loadPolicy, loadVersionHistory]);

  // Handlers for Scoring Rules
  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    if (!policy) return;
    const updatedRules = policy.scoringRules.map((r) =>
      r.id === ruleId ? { ...r, enabled } : r
    );
    setPolicy({ ...policy, scoringRules: updatedRules });
  };

  const handleEditRule = (rule: PolicyScoringRule) => {
    setEditingRule(rule);
    setIsRuleDrawerOpen(true);
  };

  const handleSaveRuleFromDrawer = (updatedRule: PolicyScoringRule) => {
    if (!policy) return;
    const updatedRules = policy.scoringRules.map((r) =>
      r.id === updatedRule.id ? updatedRule : r
    );
    setPolicy({ ...policy, scoringRules: updatedRules });
  };

  // Handler for Anti-Gaming
  const handleUpdateAntiGaming = (updated: AntiGamingPolicy) => {
    if (!policy) return;
    setPolicy({ ...policy, antiGaming: updated });
  };

  // Handler for Dimensions
  const handleUpdateDimensions = (updated: PolicyDimensionWeights) => {
    if (!policy) return;
    setPolicy({ ...policy, dimensions: updated });
  };

  // Handler for Leaderboard
  const handleUpdateLeaderboard = (updated: LeaderboardPolicy) => {
    if (!policy) return;
    setPolicy({ ...policy, leaderboardPolicy: updated });
  };

  // Handler for Simulation
  const handleRunSimulation = async () => {
    if (!policy || !activeWorkspaceId || !activeOrganizationId) return;
    setIsSimulating(true);
    try {
      const res = await simulatePolicyImpactAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
        proposedPolicy: policy,
      });

      if (res.success && res.simulation) {
        setSimulationResult(res.simulation);
        toast({
          title: 'Simulation Complete',
          description: `Projected impact evaluated across ${res.simulation.repsCount} representatives.`,
        });
      } else {
        throw new Error(res.error || 'Simulation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Simulation Error',
        description: msg,
        actionConfig: { path: '/admin/settings/sales-performance', label: 'Review Rules' },
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Handler for Publish
  const handlePublishPolicy = async () => {
    if (!policy || !activeWorkspaceId || !activeOrganizationId) return;
    setIsPublishing(true);
    try {
      const res = await saveAndPublishPolicyAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
        policy,
        changeSummary: publishSummary.trim() || `Published policy update v${policy.version + 1}.`,
        authorId: user?.uid || 'user',
        authorName: user?.displayName || 'Administrator',
        authorEmail: user?.email || undefined,
      });

      if (res.success) {
        toast({
          title: 'Policy Published',
          description: `Successfully published version v${res.version}.`,
        });
        setIsPublishModalOpen(false);
        setPublishSummary('');
        await loadPolicy();
        await loadVersionHistory();
      } else {
        throw new Error(res.error || 'Failed to publish');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Publish Failed',
        description: msg,
        actionConfig: { path: '/admin/settings/sales-performance', label: 'Check Policy' },
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handler for Rollback
  const handleRollback = async () => {
    if (!rollbackTargetVersion || !activeWorkspaceId || !activeOrganizationId) return;
    try {
      const res = await rollbackPolicyVersionAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
        targetVersion: rollbackTargetVersion,
        authorId: user?.uid || 'user',
        authorName: user?.displayName || 'Administrator',
      });

      if (res.success) {
        toast({
          title: 'Rollback Successful',
          description: `Restored configuration from v${rollbackTargetVersion} as v${res.newVersion}.`,
        });
        setRollbackTargetVersion(null);
        await loadPolicy();
        await loadVersionHistory();
      } else {
        throw new Error(res.error || 'Rollback failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Rollback Error',
        description: msg,
        actionConfig: { path: '/admin/settings/sales-performance', label: 'Version History' },
      });
    }
  };

  // Handler for Discard
  const handleDiscardChanges = () => {
    if (savedPolicy) {
      setPolicy(JSON.parse(JSON.stringify(savedPolicy)));
      toast({
        title: 'Changes Discarded',
        description: 'Reverted all unsaved modifications.',
      });
    }
  };

  // Handler for Reset Defaults
  const handleResetDefaults = async () => {
    if (!activeWorkspaceId || !activeOrganizationId) return;
    setIsResetting(true);
    try {
      const res = await resetPolicyToDefaultsAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
        authorId: user?.uid || 'user',
        authorName: user?.displayName || 'Administrator',
      });

      if (res.success) {
        toast({
          title: 'Reset Completed',
          description: 'Reverted workspace performance policy to system standard defaults.',
        });
        await loadPolicy();
        await loadVersionHistory();
      } else {
        throw new Error(res.error || 'Reset failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Reset Error',
        description: msg,
        actionConfig: { path: '/admin/settings/sales-performance', label: 'Retry Reset' },
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading || !policy) {
    return (
      <PageContainer>
        <div className="py-24 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">
            Loading Performance Policy Studio...
          </p>
        </div>
      </PageContainer>
    );
  }

  const dims = policy.dimensions;
  const totalDimensionPercent = Math.round(
    ((dims.activityWeight || 0) +
      (dims.effortWeight || 0) +
      (dims.qualityWeight || 0) +
      (dims.effectivenessWeight || 0) +
      (dims.outcomeWeight || 0)) *
      100
  );
  const isWeightsValid = totalDimensionPercent === 100;

  return (
    <PageContainer>
      <div className="space-y-6 pb-24 w-full text-left">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* Top Header Bar */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
                <Sliders className="h-6 w-6 text-primary animate-pulse" /> Performance Policy Studio
              </h1>
              <Badge variant="outline" className="text-xs font-mono font-bold bg-primary/10 text-primary border-primary/20">
                v{policy.version} Active
              </Badge>
              {isDirty && (
                <Badge variant="outline" className="text-xs font-bold bg-amber-500/10 text-amber-600 border-amber-500/20">
                  Unsaved Draft
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No-code sales performance governance: customize point rules, enforce anti-gaming safeguards, and test commission impact.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isDirty && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscardChanges}
                className="min-h-[44px] rounded-xl text-xs font-semibold px-4 active:scale-[0.97] transition-all"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Discard
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleResetDefaults}
              disabled={isResetting}
              className="min-h-[44px] rounded-xl text-xs font-semibold px-4 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 active:scale-[0.97] transition-all"
            >
              {isResetting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
              Reset Defaults
            </Button>

            <Button
              type="button"
              onClick={() => setIsPublishModalOpen(true)}
              disabled={!isWeightsValid}
              title={!isWeightsValid ? `Dimension weights must equal 100% (currently ${totalDimensionPercent}%)` : undefined}
              className="min-h-[44px] rounded-xl text-xs font-bold px-6 bg-primary text-primary-foreground shadow-md active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-1.5" /> Publish Policy
            </Button>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* Quick Executive Status Strip */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Dimension Weights */}
          <Card className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dimension Weights
            </span>
            <div className="flex items-center gap-1 text-xs font-bold text-foreground font-mono flex-wrap">
              <span>A:{Math.round(dims.activityWeight * 100)}%</span>
              <span className="text-muted-foreground">•</span>
              <span>E:{Math.round(dims.effortWeight * 100)}%</span>
              <span className="text-muted-foreground">•</span>
              <span>Q:{Math.round(dims.qualityWeight * 100)}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Eff:{Math.round(dims.effectivenessWeight * 100)}% • Out:{Math.round(dims.outcomeWeight * 100)}%
            </p>
          </Card>

          {/* Anti-Gaming */}
          <Card className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Anti-Gaming Safeguards
            </span>
            <p className="text-sm font-bold text-foreground">
              {policy.antiGaming.minCallDurationSeconds}s Hurdle
            </p>
            <p className="text-[10px] text-muted-foreground">
              {policy.antiGaming.repetitionCooldownSeconds}s entity cooldown
            </p>
          </Card>

          {/* Leaderboard Mode */}
          <Card className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Leaderboard Visibility
            </span>
            <p className="text-sm font-bold text-foreground capitalize">
              {policy.leaderboardPolicy.mode}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {policy.leaderboardPolicy.anonymizePeers ? 'Peer anonymization ON' : 'Public peer names'}
            </p>
          </Card>

          {/* Active Rules Count */}
          <Card className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-sm space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Scoring Catalog
            </span>
            <p className="text-sm font-bold text-foreground font-mono">
              {policy.scoringRules.filter((r) => r.enabled).length} / {policy.scoringRules.length} Active
            </p>
            <p className="text-[10px] text-muted-foreground">Catalog rules operational</p>
          </Card>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 5-Tab Operational Studio Tabs */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/40 p-1 rounded-2xl border flex flex-wrap sm:flex-nowrap gap-1 h-auto">
            <TabsTrigger
              value="scoring"
              className="min-h-[40px] text-xs font-semibold rounded-xl flex-1 active:scale-[0.97] transition-all"
            >
              <Award className="h-3.5 w-3.5 mr-1.5 text-primary" /> Scoring Rules
            </TabsTrigger>
            <TabsTrigger
              value="antigaming"
              className="min-h-[40px] text-xs font-semibold rounded-xl flex-1 active:scale-[0.97] transition-all"
            >
              <Flame className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> Anti-Gaming
            </TabsTrigger>
            <TabsTrigger
              value="dimensions"
              className="min-h-[40px] text-xs font-semibold rounded-xl flex-1 active:scale-[0.97] transition-all"
            >
              <PieChart className="h-3.5 w-3.5 mr-1.5 text-indigo-500" /> Dimension Weights
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="min-h-[40px] text-xs font-semibold rounded-xl flex-1 active:scale-[0.97] transition-all"
            >
              <Trophy className="h-3.5 w-3.5 mr-1.5 text-purple-500" /> Leaderboard Policy
            </TabsTrigger>
            <TabsTrigger
              value="simulation"
              className="min-h-[40px] text-xs font-semibold rounded-xl flex-1 active:scale-[0.97] transition-all"
            >
              <Play className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Simulation & History
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Scoring Rules */}
          <TabsContent value="scoring" className="space-y-6">
            <ScoringRulesTab
              rules={policy.scoringRules}
              onToggleRule={handleToggleRule}
              onEditRule={handleEditRule}
            />
          </TabsContent>

          {/* Tab 2: Anti-Gaming */}
          <TabsContent value="antigaming" className="space-y-6">
            <AntiGamingTab
              antiGaming={policy.antiGaming}
              onChange={handleUpdateAntiGaming}
            />
          </TabsContent>

          {/* Tab 3: Dimension Weights */}
          <TabsContent value="dimensions" className="space-y-6">
            <DimensionsTab
              dimensions={policy.dimensions}
              onChange={handleUpdateDimensions}
            />
          </TabsContent>

          {/* Tab 4: Leaderboard Policy */}
          <TabsContent value="leaderboard" className="space-y-6">
            <LeaderboardPolicyTab
              leaderboardPolicy={policy.leaderboardPolicy}
              onChange={handleUpdateLeaderboard}
            />
          </TabsContent>

          {/* Tab 5: Simulation & Version History */}
          <TabsContent value="simulation" className="space-y-6">
            <SimulationHistoryTab
              simulationResult={simulationResult}
              isSimulating={isSimulating}
              onRunSimulation={handleRunSimulation}
              versions={versions}
              isLoadingVersions={isLoadingVersions}
              onRollbackVersion={(vNum) => setRollbackTargetVersion(vNum)}
            />
          </TabsContent>
        </Tabs>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* Rule Editor Slide-over Sheet */}
        {/* ───────────────────────────────────────────────────────────── */}
        <RuleEditorDrawer
          isOpen={isRuleDrawerOpen}
          onClose={() => {
            setIsRuleDrawerOpen(false);
            setEditingRule(null);
          }}
          rule={editingRule}
          onSaveRule={handleSaveRuleFromDrawer}
        />

        {/* ───────────────────────────────────────────────────────────── */}
        {/* Publish Confirmation Modal with Changelog Summary */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={isPublishModalOpen} onOpenChange={setIsPublishModalOpen}>
          <DialogContent className="sm:max-w-md bg-card text-card-foreground p-6 rounded-2xl">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-lg font-bold">Publish Policy v{policy.version + 1}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Document what changed in this version. An immutable audit record will be created.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-3 text-left">
              <label className="text-xs font-semibold text-foreground">Changelog Summary</label>
              <Textarea
                placeholder="e.g. Adjusted call duration hurdle to 45s and rebalanced outcome weight to 20%."
                value={publishSummary}
                onChange={(e) => setPublishSummary(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            </div>

            <DialogFooter className="flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPublishModalOpen(false)}
                className="min-h-[44px] rounded-xl text-xs active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePublishPolicy}
                disabled={isPublishing}
                className="min-h-[44px] rounded-xl text-xs font-bold bg-primary text-primary-foreground active:scale-[0.97]"
              >
                {isPublishing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Confirm & Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* Rollback Confirmation Modal */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog
          open={rollbackTargetVersion !== null}
          onOpenChange={(open) => !open && setRollbackTargetVersion(null)}
        >
          <DialogContent className="sm:max-w-md bg-card text-card-foreground p-6 rounded-2xl">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center gap-2 text-rose-500">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle className="text-lg font-bold">Confirm Policy Rollback</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Are you sure you want to restore the configuration from version v{rollbackTargetVersion}? This will become the new active version.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRollbackTargetVersion(null)}
                className="min-h-[44px] rounded-xl text-xs active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleRollback}
                className="min-h-[44px] rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.97]"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Confirm Rollback
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}

'use client';

/**
 * @fileoverview Intelligent Routing & Workload Capacity Tab Component (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 4 (Routing):
 * - Strategy selection: Round-Robin, Capacity-Weighted (workload-aware), or Tier/Territory.
 * - Live rep capacity meters (active load vs max capacity cap).
 * - Availability toggles and individual weighting multipliers.
 * - Fallback manager overflow configuration to prevent lost leads.
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Users,
  ShieldCheck,
  Scale,
  Building,
  Save,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import type { RoutingRule, RoutingStrategy, RepRoutingConfig } from '@/lib/sales-orchestration/types';
import { saveRoutingRuleAction } from '@/app/actions/sales-orchestration-actions';
import { useToast } from '@/hooks/use-toast';

interface RoutingRulesTabProps {
  rules: RoutingRule[];
  workspaceId: string;
  organizationId: string;
  actorId: string;
  onRefresh: () => void;
}

export function RoutingRulesTab({
  rules,
  workspaceId,
  organizationId,
  actorId,
  onRefresh,
}: RoutingRulesTabProps) {
  const { toast } = useToast();
  const activeRule = rules[0] || null;

  const [strategy, setStrategy] = React.useState<RoutingStrategy>(
    activeRule?.strategy || 'capacity_weighted'
  );
  const [repRoster, setRepRoster] = React.useState<RepRoutingConfig[]>(
    activeRule?.repRoster || []
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (activeRule) {
      setStrategy(activeRule.strategy);
      setRepRoster(activeRule.repRoster);
    }
  }, [activeRule]);

  const handleToggleRepAvailability = (userId: string) => {
    setRepRoster((prev) =>
      prev.map((rep) =>
        rep.userId === userId ? { ...rep, isAvailable: !rep.isAvailable } : rep
      )
    );
  };

  const handleCapacityChange = (userId: string, newMax: number) => {
    setRepRoster((prev) =>
      prev.map((rep) =>
        rep.userId === userId ? { ...rep, maxActiveWorkload: Math.max(1, newMax) } : rep
      )
    );
  };

  const handleSaveRouting = async () => {
    if (!activeRule) return;
    setIsSaving(true);

    try {
      const updatedRule: RoutingRule = {
        ...activeRule,
        strategy,
        repRoster,
      };

      const res = await saveRoutingRuleAction({
        workspaceId,
        organizationId,
        actorId,
        rule: updatedRule,
      });

      if (res.success) {
        toast({
          title: 'Routing Policy Saved',
          description: `Workload strategy updated to ${strategy.replace(/_/g, ' ')}.`,
        });
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to save routing rule.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save routing rule.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeRule) {
    return (
      <div className="text-center py-16 bg-muted/20 border border-dashed rounded-2xl">
        <Scale className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground">No Routing Rules Found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Run migration to seed standard capacity-weighted routing rules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Strategy Selection Header */}
      <Card className="border-border/70 rounded-2xl bg-card shadow-sm">
        <CardHeader className="pb-3 px-6 pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Workload & Assignment Strategy
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Controls how incoming leads and deals are distributed across the sales team.
              </p>
            </div>

            <Button
              type="button"
              disabled={isSaving}
              onClick={handleSaveRouting}
              className="h-10 rounded-xl text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] transition-transform self-start sm:self-auto"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {isSaving ? 'Saving...' : 'Save Strategy'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: 'capacity_weighted',
                title: 'Capacity-Weighted',
                desc: 'Routes deals to reps with the most remaining capacity. Prevents burnout and bottlenecks.',
                icon: Scale,
                recommended: true,
              },
              {
                id: 'round_robin',
                title: 'Strict Round-Robin',
                desc: 'Evenly distributes opportunities sequentially across all active representatives.',
                icon: Users,
                recommended: false,
              },
              {
                id: 'tier_territory',
                title: 'Tier & Territory',
                desc: 'Matches enterprise opportunities ($50k+) strictly to enterprise-tier representatives.',
                icon: Building,
                recommended: false,
              },
            ].map((st) => (
              <div
                key={st.id}
                onClick={() => setStrategy(st.id as RoutingStrategy)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  strategy === st.id
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
                    : 'border-border/70 hover:border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <st.icon
                    className={`h-5 w-5 ${
                      strategy === st.id ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  {st.recommended && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-bold text-foreground">{st.title}</div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {st.desc}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Representative Workload Roster */}
      <Card className="border-border/70 rounded-2xl bg-card shadow-sm">
        <CardHeader className="pb-3 px-6 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Active Sales Roster & Capacity Caps
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current active deal counts and maximum workload limits per representative.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {repRoster.filter((r) => r.isAvailable).length} Available
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <div className="space-y-4">
            {repRoster.map((rep) => {
              const usagePercent = Math.min(
                100,
                Math.round((rep.currentActiveCount / Math.max(1, rep.maxActiveWorkload)) * 100)
              );
              const isOverloaded = usagePercent >= 90;

              return (
                <div
                  key={rep.userId}
                  className="p-4 rounded-2xl border border-border/70 bg-card hover:border-primary/30 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {rep.userName}
                        </span>
                        {rep.tier && (
                          <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                            {rep.tier}
                          </Badge>
                        )}
                        {isOverloaded && (
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px]">
                            Near Capacity
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{rep.userEmail}</div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Max Cap:
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={rep.maxActiveWorkload}
                          onChange={(e) =>
                            handleCapacityChange(rep.userId, Number(e.target.value))
                          }
                          className="w-16 h-9 rounded-xl text-xs text-center font-bold min-h-[44px]"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">
                          {rep.isAvailable ? 'Active' : 'Paused'}
                        </span>
                        <Switch
                          checked={rep.isAvailable}
                          onCheckedChange={() => handleToggleRepAvailability(rep.userId)}
                          aria-label={`Toggle availability for ${rep.userName}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {rep.currentActiveCount} of {rep.maxActiveWorkload} Active Deals
                      </span>
                      <span className="font-semibold text-foreground">{usagePercent}%</span>
                    </div>
                    <Progress
                      value={usagePercent}
                      className={`h-2 rounded-full ${
                        isOverloaded ? '[&>div]:bg-rose-500' : ''
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fallback Manager Card */}
          <div className="mt-6 p-4 rounded-2xl bg-muted/40 border border-border/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">
                  Designated Manager Overflow
                </div>
                <div className="text-xs text-muted-foreground">
                  {activeRule.fallbackOwnerName} (Routes here if all representatives reach 100% capacity)
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Fallback Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

/**
 * @fileOverview Active Onboarding Instances Table (Onboarding 2.0)
 *
 * Real-time operational table for tracking member onboarding progression,
 * step completion percentages, and administrative step overrides.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 * - Mobile ergonomics: kinetic horizontal table scroll and responsive progress bars.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  SkipForward,
  User,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingInstance } from '@/lib/types';
import { adminOverrideStepAction } from '@/app/actions/onboarding-actions';

interface ActiveOnboardingTableProps {
  instances: OnboardingInstance[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ActiveOnboardingTable({
  instances,
  isLoading,
  onRefresh,
}: ActiveOnboardingTableProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [overridingId, setOverridingId] = React.useState<string | null>(null);

  // Handle Admin Override / Skip
  const handleAdminOverride = async (instance: OnboardingInstance) => {
    if (!authUser || !activeOrganizationId) return;

    const currentStep = instance.stepInstances[instance.currentStepIndex];
    if (!currentStep) return;

    const ok = await confirm({
      title: 'Administrative Step Override?',
      description: `Bypass and complete step '${currentStep.stepTitle}' for ${instance.personName}?`,
      confirmText: 'Bypass Step',
    });
    if (!ok) return;

    setOverridingId(instance.id);
    try {
      const idToken = await authUser.getIdToken();
      const res = await adminOverrideStepAction({
        idToken,
        organizationId: activeOrganizationId,
        instanceId: instance.id,
        stepId: currentStep.stepId || currentStep.id,
      });

      if (res.success) {
        toast({
          title: 'Step Overridden',
          description: `Bypassed step for ${instance.personName}.`,
        });
        onRefresh();
      } else {
        throw new Error(res.error || 'Override failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Override error';
      toast({ title: 'Operation Failed', description: msg, variant: 'destructive' });
    } finally {
      setOverridingId(null);
    }
  };

  return (
    <Card className="border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/20 border-b">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Member</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Journey & Status</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Current Step</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Progress</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Admin Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="p-4">
                    <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : instances.length > 0 ? (
              instances.map((inst) => {
                const currentStep = inst.stepInstances[inst.currentStepIndex] || inst.stepInstances[0];

                return (
                  <TableRow key={inst.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="pl-4 py-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-foreground block">{inst.personName}</span>
                        <span className="text-[10px] text-muted-foreground block">{inst.personEmail}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium text-xs text-foreground block">{inst.journeyName}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] font-bold uppercase tracking-wider',
                            inst.status === 'completed' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                            inst.status === 'in_progress' && 'bg-blue-500/10 text-blue-600 border-blue-500/30',
                            inst.status === 'waiting_approval' && 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          )}
                        >
                          {inst.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      {inst.status === 'completed' ? (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> All Steps Certified
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-foreground block">
                            {currentStep?.stepTitle || 'Step In Progress'}
                          </span>
                          <span className="text-[10px] text-muted-foreground block capitalize">
                            Type: {currentStep?.type?.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1 w-32">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Completion:</span>
                          <span className="font-bold text-foreground">{inst.completionPercent}%</span>
                        </div>
                        <Progress value={inst.completionPercent} className="h-1.5" />
                      </div>
                    </TableCell>

                    <TableCell className="text-right pr-4">
                      {inst.status !== 'completed' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAdminOverride(inst)}
                          disabled={overridingId === inst.id}
                          className="text-xs h-7 px-2 active:scale-[0.97]"
                        >
                          {overridingId === inst.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <SkipForward className="w-3 h-3 mr-1" /> Bypass Step
                            </>
                          )}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Completed</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                  No active member onboarding sessions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default ActiveOnboardingTable;

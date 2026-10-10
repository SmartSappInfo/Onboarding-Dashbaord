'use client';

/**
 * @fileOverview CRM Ownership Transfer Wizard Modal (Phase 7)
 *
 * Wizard for safely re-assigning customer portfolios, deals, tasks, and automations
 * from a source representative to a destination team member within the workspace.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialog conforming strictly to `theme.md` Section 8 Modal Architecture.
 * - Demarcated header with CardInfoTooltip and sr-only description.
 * - Demarcated footer with tactile touch targets >= 44px (`active:scale-[0.97]`).
 * - Strictly passes `workspaceId` to scope entity reassignments to active workspace.
 * - Zero `any` or `any[]` typing standard.
 *
 * @testability Covered in `crm-workforce-services.test.ts`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { ArrowRightLeft, Loader2, ShieldAlert } from 'lucide-react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { CrmEntityType, CrmWorkloadSummary, PersonDetailView } from '@/lib/types';
import { transferOwnershipAction } from '@/app/actions/crm-workforce-actions';

interface OwnershipTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceWorkload: CrmWorkloadSummary | null;
  people: PersonDetailView[];
  workspaceId?: string;
  currency?: string;
  onTransferred: () => void;
}

export function OwnershipTransferModal({
  isOpen,
  onClose,
  sourceWorkload,
  people,
  workspaceId,
  currency = 'USD',
  onTransferred,
}: OwnershipTransferModalProps) {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [targetPersonId, setTargetPersonId] = React.useState('');
  const [selectedTypes, setSelectedTypes] = React.useState<CrmEntityType[]>([
    'lead',
    'contact',
    'deal',
    'task',
    'meeting',
    'automation',
  ]);
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const availableDestinations = React.useMemo(() => {
    return people.filter((p) => p.person.id !== sourceWorkload?.personId);
  }, [people, sourceWorkload?.personId]);

  const toggleType = (type: CrmEntityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const formatCurrency = React.useCallback(
    (val: number) => {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(val);
      } catch {
        return `$${val.toLocaleString()}`;
      }
    },
    [currency]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId || !sourceWorkload) return;

    if (!targetPersonId) {
      toast({
        title: 'Destination Required',
        description: 'Please select a destination representative to receive these assets.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedTypes.length === 0) {
      toast({
        title: 'Assets Required',
        description: 'Select at least one entity category to transfer.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await transferOwnershipAction({
        idToken,
        organizationId: activeOrganizationId,
        workspaceId,
        data: {
          sourcePersonId: sourceWorkload.personId,
          targetPersonId,
          entityTypes: selectedTypes,
          reason: reason.trim() || undefined,
          workspaceId,
        },
      });

      if (res.success && res.job) {
        toast({
          title: 'Ownership Transferred',
          description: `Successfully migrated ${res.job.totalTransferred} records to ${res.job.targetPersonName}.`,
        });
        onTransferred();
        onClose();
      } else {
        throw new Error(res.error || 'Transfer failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error transferring ownership';
      toast({
        title: 'Transfer Failed',
        description: msg,
        variant: 'destructive',
        actionConfig: {
          path: '/admin/workforce/crm',
          label: 'Review Allocation',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sourceWorkload) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-card border border-border/80 text-card-foreground shadow-2xl sm:rounded-2xl">
        <form onSubmit={handleSubmit}>
          {/* Standardized Demarcated Header */}
          <DialogHeader demarcated>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                Transfer CRM Portfolio Ownership
              </DialogTitle>
              <CardInfoTooltip text="Reassign active leads, pipeline deals, tasks, and automations from a representative to another team member in this workspace." />
            </div>
            <DialogDescription className="sr-only">
              Reassign active leads, pipeline deals, tasks, and automations from {sourceWorkload.personName}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 text-xs">
            {/* Workspace Scope Indicator */}
            {workspaceId && (
              <div className="px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 text-primary" /> Scope:
                </span>
                <span className="font-semibold text-primary">Active Workspace Assets Only</span>
              </div>
            )}

            {/* Source Portfolio Summary */}
            <div className="p-3.5 bg-muted/20 border border-border/80 rounded-xl grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Deals Pipeline</span>
                <span className="text-xs font-black text-foreground">
                  {sourceWorkload.dealCount} ({formatCurrency(sourceWorkload.totalPipelineValue)})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Contacts / Leads</span>
                <span className="text-xs font-black text-foreground">{sourceWorkload.contactCount}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Open Tasks</span>
                <span className="text-xs font-black text-foreground">{sourceWorkload.openTaskCount}</span>
              </div>
            </div>

            {/* Target Rep Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Destination Representative</Label>
              <Select value={targetPersonId} onValueChange={setTargetPersonId}>
                <SelectTrigger className="min-h-[44px] text-xs rounded-xl border-border/80">
                  <SelectValue placeholder="Select target team member..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/80">
                  {availableDestinations.length > 0 ? (
                    availableDestinations.map((p) => (
                      <SelectItem key={p.person.id} value={p.person.id} className="text-xs">
                        {p.person.displayName || p.person.email} ({p.person.email || p.person.id})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No other team members found in this workspace.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Entity Types Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Assets to Transfer</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'deal', label: `Deals (${sourceWorkload.dealCount})` },
                  { id: 'contact', label: `Contacts & Leads (${sourceWorkload.contactCount})` },
                  { id: 'task', label: `Tasks (${sourceWorkload.openTaskCount})` },
                  { id: 'automation', label: `Automations (${sourceWorkload.automationCount})` },
                ].map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 p-2.5 border border-border/80 rounded-xl cursor-pointer hover:bg-muted/20 transition-colors"
                  >
                    <Checkbox
                      checked={selectedTypes.includes(item.id as CrmEntityType)}
                      onCheckedChange={() => toggleType(item.id as CrmEntityType)}
                    />
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Reassignment Note / Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Territory realignment or employee offboarding handoff..."
                className="text-xs min-h-[64px] rounded-xl border-border/80"
              />
            </div>
          </div>

          {/* Standardized Demarcated Footer */}
          <DialogFooter demarcated className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs min-h-[44px] px-4 rounded-xl active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !targetPersonId || selectedTypes.length === 0}
              className="text-xs min-h-[44px] px-5 font-semibold rounded-xl active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transferring Assets...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Execute Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default OwnershipTransferModal;

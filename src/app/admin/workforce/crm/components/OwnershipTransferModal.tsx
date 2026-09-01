'use client';

/**
 * @fileOverview CRM Ownership Transfer Wizard Modal (Phase 7)
 *
 * Wizard for safely re-assigning customer portfolios, deals, tasks, and automations
 * from a source representative to a destination team member.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialog with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
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
import { ArrowRightLeft, Loader2, DollarSign, Users, CheckSquare, Sparkles } from 'lucide-react';
import type { CrmEntityType, CrmWorkloadSummary, PersonDetailView } from '@/lib/types';
import { transferOwnershipAction } from '@/app/actions/crm-workforce-actions';

interface OwnershipTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceWorkload: CrmWorkloadSummary | null;
  people: PersonDetailView[];
  onTransferred: () => void;
}

export function OwnershipTransferModal({
  isOpen,
  onClose,
  sourceWorkload,
  people,
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

  const availableDestinations = people.filter(
    (p) => p.person.id !== sourceWorkload?.personId
  );

  const toggleType = (type: CrmEntityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId || !sourceWorkload) return;

    if (!targetPersonId) {
      toast({ title: 'Validation Error', description: 'Please select a destination representative.', variant: 'destructive' });
      return;
    }
    if (selectedTypes.length === 0) {
      toast({ title: 'Validation Error', description: 'Select at least one entity type to transfer.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await transferOwnershipAction({
        idToken,
        organizationId: activeOrganizationId,
        data: {
          sourcePersonId: sourceWorkload.personId,
          targetPersonId,
          entityTypes: selectedTypes,
          reason: reason.trim() || undefined,
        },
      });

      if (res.success && res.job) {
        toast({
          title: 'Ownership Transferred Successfully',
          description: `Transferred ${res.job.totalTransferred} records to ${res.job.targetPersonName}.`,
        });
        onTransferred();
        onClose();
      } else {
        throw new Error(res.error || 'Transfer failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error transferring ownership';
      toast({ title: 'Transfer Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sourceWorkload) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-card border shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base font-bold">Transfer CRM Portfolio Ownership</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Reassign active leads, pipeline deals, tasks, and automations from <strong>{sourceWorkload.personName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            {/* Source Portfolio Summary */}
            <div className="p-3 bg-muted/30 border rounded-lg grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Deals Pipeline</span>
                <span className="text-sm font-black text-foreground">
                  {sourceWorkload.dealCount} (${sourceWorkload.totalPipelineValue.toLocaleString()})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Contacts / Leads</span>
                <span className="text-sm font-black text-foreground">{sourceWorkload.contactCount}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Open Tasks</span>
                <span className="text-sm font-black text-foreground">{sourceWorkload.openTaskCount}</span>
              </div>
            </div>

            {/* Target Rep Selector */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Destination Representative</Label>
              <Select value={targetPersonId} onValueChange={setTargetPersonId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select target team member..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinations.map((p) => (
                    <SelectItem key={p.person.id} value={p.person.id} className="text-xs">
                      {p.person.displayName} ({p.person.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entity Types Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Assets to Transfer</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'deal', label: `Deals (${sourceWorkload.dealCount})` },
                  { id: 'contact', label: `Contacts & Leads (${sourceWorkload.contactCount})` },
                  { id: 'task', label: `Tasks (${sourceWorkload.openTaskCount})` },
                  { id: 'automation', label: `Automations (${sourceWorkload.automationCount})` },
                ].map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/20"
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
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Reassignment Note / Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Territory realignment or employee offboarding handoff..."
                className="text-xs min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !targetPersonId || selectedTypes.length === 0}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Transferring Assets...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Execute Transfer
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

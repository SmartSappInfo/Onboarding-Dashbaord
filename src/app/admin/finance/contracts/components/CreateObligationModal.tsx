'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Dedicated Obligation Creation Modal (Phase 3 Task 8).
 * 2. SmartSapp Task Core Integration:
 *    When `syncToTasks` is true and responsible party is `internal` or `mutual`,
 *    this modal calls `createContractObligationAction` which calls `createTaskCore`,
 *    making contractual deliverables appear in the assignee's daily work console (`/admin/tasks`).
 * 3. Quick Presets & Everyday English:
 *    Provides one-click date presets (+30d, +60d, +90d, End of Quarter) and minimal labels.
 * 4. Micro-Interactions & Touch Targets:
 *    `min-h-[44px]` touch targets, `active:scale-[0.97]` tactile transitions.
 * 5. Strict Typing (Rule 4):
 *    Strictly zero `any`.
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createContractObligationAction } from '@/lib/documents/contract-actions';
import type { ObligationType, ContractRecord } from '@/lib/types/document-signing';

export interface CreateObligationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  contracts?: ContractRecord[];
  defaultContractId?: string;
  onSuccess?: () => void;
}

export default function CreateObligationModal({
  isOpen,
  onClose,
  workspaceId,
  contracts = [],
  defaultContractId,
  onSuccess,
}: CreateObligationModalProps) {
  const { toast } = useToast();

  const [contractId, setContractId] = React.useState(defaultContractId || '');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [type, setType] = React.useState<ObligationType>('deliverable');
  const [dueDate, setDueDate] = React.useState('');
  const [responsibleParty, setResponsibleParty] = React.useState<'internal' | 'counterparty' | 'mutual'>('internal');
  const [syncToTasks, setSyncToTasks] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (defaultContractId) {
      setContractId(defaultContractId);
    } else if (contracts.length > 0 && !contractId) {
      setContractId(contracts[0].id);
    }
  }, [defaultContractId, contracts, contractId]);

  // Quick preset dates helper
  const applyDatePreset = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setDueDate(d.toISOString().split('T')[0]);
  };

  const applyQuarterEndPreset = () => {
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const endMonth = (currentQuarter + 1) * 3;
    const endOfQuarter = new Date(now.getFullYear(), endMonth, 0);
    setDueDate(endOfQuarter.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId || !title.trim() || !dueDate || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const res = await createContractObligationAction({
        workspaceId,
        contractId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        dueDate: new Date(dueDate).toISOString(),
        responsibleParty,
        syncToTasks,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to create obligation.');
      }

      toast({
        title: 'Deliverable Created',
        description: `"${title}" has been registered and synced to active tasks.`,
        actionConfig: {
          path: '/admin/tasks',
          label: 'View in Tasks',
        },
      });

      setTitle('');
      setDescription('');
      setDueDate('');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating obligation.';
      toast({ title: 'Submission Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                Milestone Tracking
              </Badge>
              <span className="text-xs text-muted-foreground">Contract Deliverable</span>
            </div>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Add Contract Deliverable
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Track deadlines, payment milestones, audits, or reporting commitments for this agreement.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {/* Agreement Selector (if not fixed) */}
            {contracts.length > 0 && !defaultContractId && (
              <div className="space-y-1.5">
                <Label htmlFor="contractId" className="text-xs font-medium">
                  Associated Agreement <span className="text-rose-500">*</span>
                </Label>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger id="contractId" className="text-xs min-h-[44px] sm:min-h-[38px]">
                    <SelectValue placeholder="Select contract" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium">
                Deliverable Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Deliver Annual Security Audit Report"
                className="text-xs min-h-[44px] sm:min-h-[38px]"
                required
              />
            </div>

            {/* Type & Responsible Party */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs font-medium">Type</Label>
                <Select value={type} onValueChange={(val: ObligationType) => setType(val)}>
                  <SelectTrigger id="type" className="text-xs min-h-[44px] sm:min-h-[38px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deliverable">Deliverable</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="reporting">Reporting</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="renewal_notice">Renewal Notice</SelectItem>
                    <SelectItem value="audit">Audit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="party" className="text-xs font-medium">Responsible Party</Label>
                <Select
                  value={responsibleParty}
                  onValueChange={(val: 'internal' | 'counterparty' | 'mutual') => setResponsibleParty(val)}
                >
                  <SelectTrigger id="party" className="text-xs min-h-[44px] sm:min-h-[38px]">
                    <SelectValue placeholder="Party" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal Team</SelectItem>
                    <SelectItem value="counterparty">Counterparty</SelectItem>
                    <SelectItem value="mutual">Mutual Commitment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="dueDate" className="text-xs font-medium">
                  Due Date <span className="text-rose-500">*</span>
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => applyDatePreset(30)}
                    className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                  >
                    +30d
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => applyDatePreset(60)}
                    className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                  >
                    +60d
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => applyDatePreset(90)}
                    className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                  >
                    +90d
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={applyQuarterEndPreset}
                    className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                  >
                    Quarter End
                  </Button>
                </div>
              </div>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs min-h-[44px] sm:min-h-[38px]"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium">
                Deliverable Details (Optional)
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specific instructions, acceptance criteria, or evidence required."
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            {/* Sync to Task Queue Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                  Sync to SmartSapp Tasks
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Creates an actionable task on `/admin/tasks` for the assigned team member.
                </p>
              </div>
              <Switch
                checked={syncToTasks}
                onCheckedChange={setSyncToTasks}
                disabled={responsibleParty === 'counterparty'}
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !title.trim() || !dueDate}
              className="min-h-[44px] sm:min-h-[36px] px-4 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Save Deliverable
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

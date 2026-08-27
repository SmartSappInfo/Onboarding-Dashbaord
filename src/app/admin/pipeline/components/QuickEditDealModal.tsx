'use client';

/**
 * Quick-Edit Deal Modal
 *
 * ARCHITECTURAL POINTER (Rule 10):
 * Lightweight, accessible dialog for inline updates to deal value, stage, forecast date,
 * owner, and status directly from the Kanban Board or Deals List View without navigating away.
 *
 * WORKSPACE RULES & COMPLIANCE:
 * - Strict typing: Zero 'any' or 'any[]'.
 * - Mobile First: Minimum 44px touch targets.
 * - Dynamic Currency formatting.
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, UserCircle2, Calendar, Banknote, Layers, Trophy, Target } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { updateDealAction, updateDealStageAction } from '@/app/actions/deal-actions';
import type { Deal, OnboardingStage } from '@/lib/types';
import { getCurrencySymbol } from '@/lib/currency-utils';

interface QuickEditDealModalProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages?: OnboardingStage[];
}

export default function QuickEditDealModal({
  deal,
  open,
  onOpenChange,
  stages = [],
}: QuickEditDealModalProps) {
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { data: workspaceUsers } = useWorkspaceUsers(activeWorkspaceId);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState('');
  const [value, setValue] = React.useState('');
  const [stageId, setStageId] = React.useState('');
  const [status, setStatus] = React.useState<'open' | 'won' | 'lost'>('open');
  const [expectedCloseDate, setExpectedCloseDate] = React.useState('');
  const [assignedUserId, setAssignedUserId] = React.useState<string>('unassigned');

  React.useEffect(() => {
    if (open && deal) {
      setName(deal.name || '');
      setValue(deal.value !== undefined ? String(deal.value) : '');
      setStageId(deal.stageId || (stages[0]?.id ?? ''));
      setStatus(deal.status || 'open');
      setExpectedCloseDate(
        deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : ''
      );
      setAssignedUserId(deal.assignedTo?.userId || 'unassigned');
    }
  }, [open, deal, stages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal || !activeWorkspaceId) return;

    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Deal title cannot be empty.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let assignedToObj: { userId: string | null; name: string | null; email: string | null } | null = null;
      if (assignedUserId !== 'unassigned') {
        const foundUser = workspaceUsers?.find((u) => u.id === assignedUserId);
        if (foundUser) {
          assignedToObj = {
            userId: foundUser.id,
            name: foundUser.name || foundUser.email || 'User',
            email: foundUser.email || null,
          };
        }
      }

      const selectedStage = stages.find((s) => s.id === stageId);
      const stageName = selectedStage?.name || deal.stageName;

      // 1. Update core deal properties
      const res = await updateDealAction(
        deal.id,
        {
          name: name.trim(),
          value: parseFloat(value) || 0,
          status,
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null,
          assignedTo: assignedToObj,
          stageId,
          stageName,
        },
        activeWorkspaceId,
        user?.uid
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to update deal.');
      }

      // 2. If stage changed, trigger stage transition protocol
      if (stageId && stageId !== deal.stageId) {
        await updateDealStageAction(deal.id, stageId, {
          status,
          userId: user?.uid,
        });
      }

      toast({
        title: 'Deal Updated',
        description: `Successfully updated "${name.trim()}".`,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update deal.';
      toast({ variant: 'destructive', title: 'Update Failed', description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol = getCurrencySymbol();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl p-0 border border-border/50 shadow-2xl overflow-hidden bg-background z-[150]">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 border-b border-border/50 shrink-0 text-left bg-muted/10">
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Quick Edit Deal</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Adjust deal values, stage progress, and ownership without leaving the pipeline view.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-deal-name" className="text-xs font-bold text-muted-foreground ml-1">
                Deal Title
              </Label>
              <Input
                id="edit-deal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Entity Name"
                className="h-10 rounded-xl font-bold bg-background border-border"
                required
              />
            </div>

            {/* Value & Stage */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-deal-value" className="text-xs font-bold text-muted-foreground ml-1">
                  Estimated Value ({currencySymbol})
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="edit-deal-value"
                    type="number"
                    min="0"
                    step="any"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className="h-10 pl-7 rounded-xl font-bold bg-background border-border"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-deal-stage" className="text-xs font-bold text-muted-foreground ml-1">
                  Pipeline Stage
                </Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger id="edit-deal-stage" className="h-10 rounded-xl font-bold bg-background border-border text-xs">
                    <SelectValue placeholder="Select Stage" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="font-bold text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status & Expected Close Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-deal-status" className="text-xs font-bold text-muted-foreground ml-1">
                  Deal Status
                </Label>
                <Select value={status} onValueChange={(v: 'open' | 'won' | 'lost') => setStatus(v)}>
                  <SelectTrigger id="edit-deal-status" className="h-10 rounded-xl font-bold bg-background border-border text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    <SelectItem value="open" className="font-bold text-xs text-blue-600">
                      Open
                    </SelectItem>
                    <SelectItem value="won" className="font-bold text-xs text-emerald-600">
                      Won (Closed)
                    </SelectItem>
                    <SelectItem value="lost" className="font-bold text-xs text-rose-600">
                      Lost
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-deal-close-date" className="text-xs font-bold text-muted-foreground ml-1">
                  Forecast Close Date
                </Label>
                <Input
                  id="edit-deal-close-date"
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="h-10 rounded-xl font-bold bg-background border-border text-xs"
                />
              </div>
            </div>

            {/* Owner / Assignee */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-deal-owner" className="text-xs font-bold text-muted-foreground ml-1">
                Assigned Owner
              </Label>
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger id="edit-deal-owner" className="h-10 rounded-xl font-bold bg-background border-border text-xs">
                  <UserCircle2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Select Owner" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl max-h-[220px]">
                  <SelectItem value="unassigned" className="font-bold text-xs text-muted-foreground">
                    Unassigned
                  </SelectItem>
                  {workspaceUsers?.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="font-bold text-xs">
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl font-bold h-10 px-5 text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-bold h-10 px-7 shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

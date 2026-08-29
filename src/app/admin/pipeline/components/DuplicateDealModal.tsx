'use client';

/**
 * @fileoverview Deal Duplication & Cloning Modal
 *
 * ARCHITECTURAL POINTER (Phase 1 - Opportunity Cloning):
 * Allows operators to clone an existing deal with configurable options:
 * - Selective inclusion of Line Items, Contacts, and Custom Fields.
 * - Target Pipeline & Stage routing with auto-recalculated close dates.
 * - Produces a fresh deal with clean initial stage history.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - System-generated audit activity and previous stage durations must NEVER be cloned.
 * - All actions must pass actionable toasts with relative navigation paths.
 * - Zero 'any' or 'any[]' in types.
 *
 * TESTABILITY POINTER:
 * Validated by unit tests in `src/app/actions/__tests__/deal-actions.phase1.test.ts`.
 */

import * as React from 'react';
import type { Deal, Pipeline, OnboardingStage, DealDuplicateOptions } from '@/lib/types';
import { 
  Copy, 
  Loader2, 
  Layers, 
  Workflow, 
  ShoppingBag, 
  Users, 
  SlidersHorizontal 
} from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { duplicateDealAction } from '@/app/actions/deal-actions';

interface DuplicateDealModalProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
  onDuplicated?: (newDealId: string) => void;
  pipelines?: Pipeline[];
  stages?: OnboardingStage[];
}

export default function DuplicateDealModal({
  deal,
  isOpen,
  onClose,
  onDuplicated,
  pipelines = [],
  stages = [],
}: DuplicateDealModalProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [newName, setNewName] = React.useState('');
  const [selectedPipelineId, setSelectedPipelineId] = React.useState('');
  const [selectedStageId, setSelectedStageId] = React.useState('');
  const [copyLineItems, setCopyLineItems] = React.useState(true);
  const [copyContacts, setCopyContacts] = React.useState(true);
  const [copyCustomFields, setCopyCustomFields] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync state whenever dialog opens with a new deal
  React.useEffect(() => {
    if (deal) {
      setNewName(`${deal.name} (Copy)`);
      setSelectedPipelineId(deal.pipelineId || '');
      setSelectedStageId(deal.stageId || '');
      setCopyLineItems(true);
      setCopyContacts(true);
      setCopyCustomFields(true);
    }
  }, [deal]);

  // Filter stages matching selected pipeline
  const filteredStages = React.useMemo(() => {
    if (!selectedPipelineId) return stages;
    return stages.filter((s) => s.pipelineId === selectedPipelineId);
  }, [stages, selectedPipelineId]);

  // Auto-select first stage if pipeline changes
  const handlePipelineChange = (newPipeId: string) => {
    setSelectedPipelineId(newPipeId);
    const pipeStages = stages.filter((s) => s.pipelineId === newPipeId);
    if (pipeStages.length > 0) {
      setSelectedStageId(pipeStages[0].id);
    } else {
      setSelectedStageId('');
    }
  };

  const handleDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal) return;

    if (!newName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Deal Name Required',
        description: 'Please specify a name for the duplicated opportunity.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const options: DealDuplicateOptions = {
        newName: newName.trim(),
        targetPipelineId: selectedPipelineId || deal.pipelineId,
        targetStageId: selectedStageId || deal.stageId,
        copyLineItems,
        copyContacts,
        copyCustomFields,
      };

      const res = await duplicateDealAction(deal.id, options, user?.uid);

      if (res.success && res.newDealId) {
        toast({
          title: 'Deal Cloned Successfully',
          description: `Created new deal "${newName.trim()}".`,
          actionConfig: {
            path: `/admin/deals/${res.newDealId}`,
            label: 'View Deal',
          },
        });
        onDuplicated?.(res.newDealId);
        onClose();
      } else {
        throw new Error(res.error || 'Failed to clone opportunity.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: 'Duplication Failed',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!deal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl max-w-md bg-background border border-border shadow-2xl p-6 z-[200]">
        <form onSubmit={handleDuplicate}>
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-foreground">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Copy className="h-4 w-4" />
              </div>
              <span>Duplicate Opportunity</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Clone &quot;{deal.name}&quot; into a new opportunity with clean lifecycle history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-5">
            {/* New Deal Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">New Deal Name *</Label>
              <Input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Acme Corp - Phase 2"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            {/* Target Pipeline & Stage */}
            {pipelines.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                    <Workflow className="h-3 w-3 text-muted-foreground" /> Pipeline
                  </Label>
                  <Select value={selectedPipelineId} onValueChange={handlePipelineChange}>
                    <SelectTrigger className="h-10 text-xs rounded-xl">
                      <SelectValue placeholder="Select Pipeline" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3 text-muted-foreground" /> Initial Stage
                  </Label>
                  <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                    <SelectTrigger className="h-10 text-xs rounded-xl">
                      <SelectValue placeholder="Select Stage" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {filteredStages.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Clone Options Toggles */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Include in Cloned Deal
              </span>

              <div className="space-y-2.5">
                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="copy-line-items"
                    checked={copyLineItems}
                    onCheckedChange={(checked) => setCopyLineItems(!!checked)}
                  />
                  <label
                    htmlFor="copy-line-items"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-primary/80" />
                    <span>Products & Line Items ({deal.lineItems?.length || 0})</span>
                  </label>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="copy-contacts"
                    checked={copyContacts}
                    onCheckedChange={(checked) => setCopyContacts(!!checked)}
                  />
                  <label
                    htmlFor="copy-contacts"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5 text-primary/80" />
                    <span>Linked Contacts & Stakeholders</span>
                  </label>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="copy-custom-fields"
                    checked={copyCustomFields}
                    onCheckedChange={(checked) => setCopyCustomFields(!!checked)}
                  />
                  <label
                    htmlFor="copy-custom-fields"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary/80" />
                    <span>Custom Metadata Fields</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl font-bold bg-primary text-primary-foreground gap-1.5 shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Clone Opportunity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

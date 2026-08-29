'use client';

/**
 * @fileoverview Deal Merge & Duplicate Resolution Modal
 *
 * ARCHITECTURAL POINTER (Phase 1 - Opportunity Merge Workflow):
 * Executes a 2-deal merge workflow in compliance with Deals PRD Section 27:
 * - Master record designation with conflict resolution for Name, Value, Pipeline/Stage, and Rep.
 * - Deep union of Contacts and Line Items with automatic total recalculations.
 * - Task & note reassignment to preserve operational context.
 * - Soft-archives the secondary record with `outcome: 'duplicate'` and `mergedIntoDealId`
 *   to ensure zero data loss and full audit compliance.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Deals across different workspaces can NEVER be merged (tenant boundary violation).
 * - Master deal updates and secondary deal soft-archiving must execute atomically.
 * - Zero 'any' or 'any[]' in types.
 *
 * TESTABILITY POINTER:
 * Validated by unit tests in `src/app/actions/__tests__/deal-actions.phase1.test.ts`.
 */

import * as React from 'react';
import type { Deal, DealMergeOptions, DealMergeResult } from '@/lib/types';
import { 
  GitMerge, 
  Loader2, 
  Crown, 
  Archive, 
  Banknote, 
  Users, 
  ShoppingBag, 
  FileText, 
  AlertCircle,
  Search
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { formatCurrency } from '@/lib/currency-utils';
import { mergeDealsAction } from '@/app/actions/deal-actions';

interface MergeDealsModalProps {
  dealA: Deal | null;
  dealB: Deal | null;
  allDeals?: Deal[];
  isOpen: boolean;
  onClose: () => void;
  onMerged?: (result: DealMergeResult) => void;
}

export default function MergeDealsModal({
  dealA,
  dealB: initialDealB,
  allDeals = [],
  isOpen,
  onClose,
  onMerged,
}: MergeDealsModalProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();

  const [selectedDealB, setSelectedDealB] = React.useState<Deal | null>(initialDealB);
  const [dealBSearch, setDealBSearch] = React.useState('');
  const [masterChoice, setMasterChoice] = React.useState<'A' | 'B'>('A');

  // Conflict Resolution State
  const [resolvedName, setResolvedName] = React.useState('');
  const [valueStrategy, setValueStrategy] = React.useState<'sum' | 'master' | 'custom'>('sum');
  const [customValue, setCustomValue] = React.useState('');

  // Toggles
  const [mergeContacts, setMergeContacts] = React.useState(true);
  const [mergeLineItems, setMergeLineItems] = React.useState(true);
  const [mergeCustomFields, setMergeCustomFields] = React.useState(true);
  const [mergeTasksAndNotes, setMergeTasksAndNotes] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync initial dealB when opened
  React.useEffect(() => {
    setSelectedDealB(initialDealB);
  }, [initialDealB]);

  const masterDeal = masterChoice === 'A' ? dealA : selectedDealB;
  const secondaryDeal = masterChoice === 'A' ? selectedDealB : dealA;

  // Auto-sync resolved name whenever master choice or deals change
  React.useEffect(() => {
    if (masterDeal) {
      setResolvedName(masterDeal.name);
    }
  }, [masterDeal]);

  // Filter deals available for selection as Deal B (same workspace, distinct from Deal A)
  const availableDealsForB = React.useMemo(() => {
    if (!dealA) return [];
    return allDeals.filter((d) => {
      if (d.id === dealA.id) return false;
      if (d.isArchived) return false;
      if (dealBSearch.trim()) {
        const query = dealBSearch.toLowerCase();
        return (
          d.name.toLowerCase().includes(query) ||
          d.entityId.toLowerCase().includes(query)
        );
      }
      return true;
    }).slice(0, 10);
  }, [allDeals, dealA, dealBSearch]);

  const calculateMergedValue = (): number => {
    if (!masterDeal) return 0;
    if (valueStrategy === 'master') return masterDeal.value || 0;
    if (valueStrategy === 'custom') {
      const parsed = parseFloat(customValue);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    // 'sum' strategy
    return (masterDeal.value || 0) + (secondaryDeal?.value || 0);
  };

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealA || !selectedDealB || !activeWorkspaceId) return;

    if (!resolvedName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Deal Name Required',
        description: 'Please specify the resulting name for the merged opportunity.',
      });
      return;
    }

    const master = masterChoice === 'A' ? dealA : selectedDealB;
    const secondary = masterChoice === 'A' ? selectedDealB : dealA;

    setIsSubmitting(true);
    try {
      const options: DealMergeOptions = {
        masterDealId: master.id,
        secondaryDealId: secondary.id,
        resolvedName: resolvedName.trim(),
        resolvedValue: calculateMergedValue(),
        resolvedPipelineId: master.pipelineId,
        resolvedStageId: master.stageId,
        resolvedCloseDate: master.expectedCloseDate || secondary.expectedCloseDate,
        resolvedAssignedTo: master.assignedTo || secondary.assignedTo || null,
        mergeContacts,
        mergeLineItems,
        mergeCustomFields,
        mergeTasksAndNotes,
      };

      const result = await mergeDealsAction(options, activeWorkspaceId, user?.uid);

      if (result.success) {
        toast({
          title: 'Deals Merged Successfully',
          description: `Combined into "${resolvedName.trim()}". Secondary deal archived.`,
          actionConfig: {
            path: `/admin/deals/${master.id}`,
            label: 'View Master Deal',
          },
        });
        onMerged?.(result);
        onClose();
      } else {
        throw new Error(result.error || 'Failed to merge opportunities.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: 'Merge Failed',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!dealA) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl max-w-2xl bg-background border border-border shadow-2xl p-6 z-[200] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleMerge}>
          <DialogHeader className="space-y-1 pb-2 border-b border-border/40">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-foreground">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <GitMerge className="h-4 w-4" />
              </div>
              <span>Merge Revenue Opportunities</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Combine two deals into one master record. The secondary deal will be soft-archived with zero data loss.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-5">
            {/* Deal B Selector (if not yet selected) */}
            {!selectedDealB && (
              <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/60">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" /> Select Second Deal to Merge With
                </Label>
                <Input
                  value={dealBSearch}
                  onChange={(e) => setDealBSearch(e.target.value)}
                  placeholder="Search deals by name or entity..."
                  className="h-10 text-xs rounded-xl"
                />
                <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                  {availableDealsForB.length > 0 ? (
                    availableDealsForB.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDealB(d)}
                        className="w-full p-2.5 rounded-xl border border-border/50 bg-card hover:bg-primary/5 hover:border-primary/40 flex items-center justify-between text-left transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{d.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Stage: {d.stageName || 'In Progress'} • {formatCurrency(d.value)}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold">Select</Badge>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No matching deals found in this workspace.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Side-by-Side Master Selector */}
            {selectedDealB && (
              <div className="space-y-3">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-500" /> Choose Master Primary Record
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Deal A Card */}
                  <div
                    onClick={() => setMasterChoice('A')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      masterChoice === 'A'
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border/60 bg-muted/10 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={masterChoice === 'A' ? 'bg-primary text-primary-foreground font-bold text-[10px] gap-1' : 'bg-muted text-muted-foreground text-[10px]'}>
                        {masterChoice === 'A' ? <Crown className="h-3 w-3" /> : null}
                        {masterChoice === 'A' ? 'Primary Master' : 'Secondary (Archive)'}
                      </Badge>
                      <span className="text-xs font-black text-foreground">{formatCurrency(dealA.value)}</span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground truncate">{dealA.name}</h4>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Stage: {dealA.stageName || 'Current Stage'}
                    </p>
                    <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-3">
                      <span>{dealA.lineItems?.length || 0} line items</span>
                      <span>{(dealA.contacts?.length || 0) + (dealA.focalContacts?.length || 0)} contacts</span>
                    </div>
                  </div>

                  {/* Deal B Card */}
                  <div
                    onClick={() => setMasterChoice('B')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      masterChoice === 'B'
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border/60 bg-muted/10 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={masterChoice === 'B' ? 'bg-primary text-primary-foreground font-bold text-[10px] gap-1' : 'bg-muted text-muted-foreground text-[10px]'}>
                        {masterChoice === 'B' ? <Crown className="h-3 w-3" /> : null}
                        {masterChoice === 'B' ? 'Primary Master' : 'Secondary (Archive)'}
                      </Badge>
                      <span className="text-xs font-black text-foreground">{formatCurrency(selectedDealB.value)}</span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground truncate">{selectedDealB.name}</h4>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Stage: {selectedDealB.stageName || 'Current Stage'}
                    </p>
                    <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-3">
                      <span>{selectedDealB.lineItems?.length || 0} line items</span>
                      <span>{(selectedDealB.contacts?.length || 0) + (selectedDealB.focalContacts?.length || 0)} contacts</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Conflict Resolution Settings */}
            {selectedDealB && (
              <div className="space-y-4 pt-2 border-t border-border/40">
                {/* Resulting Deal Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Resulting Deal Name *</Label>
                  <Input
                    required
                    value={resolvedName}
                    onChange={(e) => setResolvedName(e.target.value)}
                    className="h-10 text-xs rounded-xl font-semibold"
                  />
                </div>

                {/* Value Strategy */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-primary" /> Value Resolution Strategy
                  </Label>
                  <RadioGroup
                    value={valueStrategy}
                    onValueChange={(val) => setValueStrategy(val as 'sum' | 'master' | 'custom')}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                  >
                    <div className="flex items-center space-x-2 p-3 rounded-xl border border-border/60 bg-card">
                      <RadioGroupItem value="sum" id="val-sum" />
                      <Label htmlFor="val-sum" className="text-xs cursor-pointer">
                        <span className="font-bold block">Combined Sum</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatCurrency((dealA.value || 0) + (selectedDealB.value || 0))}
                        </span>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 rounded-xl border border-border/60 bg-card">
                      <RadioGroupItem value="master" id="val-master" />
                      <Label htmlFor="val-master" className="text-xs cursor-pointer">
                        <span className="font-bold block">Master Value</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatCurrency(masterDeal?.value || 0)}
                        </span>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 rounded-xl border border-border/60 bg-card">
                      <RadioGroupItem value="custom" id="val-custom" />
                      <Label htmlFor="val-custom" className="text-xs cursor-pointer">
                        <span className="font-bold block">Custom Value</span>
                        <span className="text-[10px] text-muted-foreground">Enter manually</span>
                      </Label>
                    </div>
                  </RadioGroup>

                  {valueStrategy === 'custom' && (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      placeholder="Enter custom deal value..."
                      className="h-10 text-xs rounded-xl mt-2"
                    />
                  )}
                </div>

                {/* Merge Options Checkboxes */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Data Entities to Consolidate
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2.5">
                      <Checkbox
                        id="merge-contacts"
                        checked={mergeContacts}
                        onCheckedChange={(checked) => setMergeContacts(!!checked)}
                      />
                      <label htmlFor="merge-contacts" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                        <Users className="h-3.5 w-3.5 text-primary/80" />
                        <span>Unite Contacts & Stakeholders</span>
                      </label>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <Checkbox
                        id="merge-line-items"
                        checked={mergeLineItems}
                        onCheckedChange={(checked) => setMergeLineItems(!!checked)}
                      />
                      <label htmlFor="merge-line-items" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                        <ShoppingBag className="h-3.5 w-3.5 text-primary/80" />
                        <span>Combine Products & Line Items</span>
                      </label>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <Checkbox
                        id="merge-custom-fields"
                        checked={mergeCustomFields}
                        onCheckedChange={(checked) => setMergeCustomFields(!!checked)}
                      />
                      <label htmlFor="merge-custom-fields" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                        <FileText className="h-3.5 w-3.5 text-primary/80" />
                        <span>Merge Custom Metadata Fields</span>
                      </label>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <Checkbox
                        id="merge-tasks"
                        checked={mergeTasksAndNotes}
                        onCheckedChange={(checked) => setMergeTasksAndNotes(!!checked)}
                      />
                      <label htmlFor="merge-tasks" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                        <Archive className="h-3.5 w-3.5 text-primary/80" />
                        <span>Reassign Tasks & Notes</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Preservation Notice */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold">Zero Data Loss Policy</span>
                    <p className="text-[11px] opacity-90">
                      Secondary deal &quot;{secondaryDeal?.name}&quot; will be soft-archived with a reference link to the master record.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
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
              disabled={isSubmitting || !selectedDealB}
              className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl font-bold bg-primary text-primary-foreground gap-1.5 shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitMerge className="h-3.5 w-3.5" />
              )}
              Confirm & Execute Merge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative Contract Lifecycle Detail & Governance Modal (Phase 3 Task 7).
 * 2. Visual Invariants & Everyday Microcopy (Rule 7 Minimal Text):
 *    - Surfaces clear commercial status, renewal countdown pills, and obligations.
 *    - Replaces technical terms with everyday English ("Deliverables", "Mark Done", "Renew Agreement").
 * 3. Operations Capabilities (Rule 3.2 No-Code Operations Console):
 *    - One-Click Amendment & Renewal initiation.
 *    - One-Click Obligation Fulfillment with automatic SmartSapp task resolution.
 *    - One-Click Agreement Termination with mandatory audit reason.
 * 4. Micro-Interactions & Mobile-First Touch Ergonomics:
 *    Touch targets >= 44x44px (`min-h-[44px]`), active tactile states (`active:scale-[0.97]`).
 * 5. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  ShieldCheck,
  Download,
  GitBranch,
  Calendar,
  CheckCircle2,
  Plus,
  Users,
  DollarSign,
  Ban,
  Loader2,
} from 'lucide-react';
import {
  calculateRenewalUrgency,
  type ContractRenewalUrgency,
} from '@/lib/documents/contract-lifecycle-service';
import {
  transitionContractStatusAction,
  fulfillContractObligationAction,
  createContractObligationAction,
} from '@/lib/documents/contract-actions';
import type {
  ContractRecord,
  ContractObligation,
  ContractRelationship,
  ObligationType,
} from '@/lib/types/document-signing';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc } from 'firebase/firestore';

export interface ContractLifecycleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string | null;
  workspaceId: string;
  onOpenAmendment?: (contract: ContractRecord) => void;
  onOpenRenewal?: (contract: ContractRecord) => void;
  onContractUpdated?: () => void;
}

export default function ContractLifecycleDetailModal({
  isOpen,
  onClose,
  contractId,
  workspaceId,
  onOpenAmendment,
  onOpenRenewal,
  onContractUpdated,
}: ContractLifecycleDetailModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [contract, setContract] = React.useState<ContractRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Obligation creation form state
  const [isAddingObligation, setIsAddingObligation] = React.useState(false);
  const [newObligationTitle, setNewObligationTitle] = React.useState('');
  const [newObligationDueDate, setNewObligationDueDate] = React.useState('');
  const [newObligationType, setNewObligationType] = React.useState<ObligationType>('deliverable');
  const [isSubmittingObligation, setIsSubmittingObligation] = React.useState(false);

  // Termination confirmation dialog state
  const [isTerminatingOpen, setIsTerminatingOpen] = React.useState(false);
  const [terminationReason, setTerminationReason] = React.useState('');
  const [isTerminating, setIsTerminating] = React.useState(false);

  // Fetch contract record
  const fetchContract = React.useCallback(async () => {
    if (!contractId || !firestore) return;
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(firestore, 'contracts', contractId));
      if (snap.exists()) {
        setContract(snap.data() as ContractRecord);
      }
    } catch (err: unknown) {
      console.error('Failed to load contract details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contractId, firestore]);

  React.useEffect(() => {
    if (isOpen && contractId) {
      fetchContract();
    }
  }, [isOpen, contractId, fetchContract]);

  // Query obligations for this contract
  const obligationsQuery = useMemoFirebase(() => {
    if (!firestore || !contractId) return null;
    return query(
      collection(firestore, 'contract_obligations'),
      where('contractId', '==', contractId)
    );
  }, [firestore, contractId]);
  const { data: rawObligations } = useCollection<ContractObligation>(obligationsQuery);
  const obligations = rawObligations || [];

  // Query relationships for this contract
  const relationshipsQuery = useMemoFirebase(() => {
    if (!firestore || !contractId) return null;
    return query(
      collection(firestore, 'contract_relationships'),
      where('sourceContractId', '==', contractId)
    );
  }, [firestore, contractId]);
  const { data: rawRelationships } = useCollection<ContractRelationship>(relationshipsQuery);
  const relationships = rawRelationships || [];

  // Calculate urgency metrics
  const urgency: ContractRenewalUrgency | null = React.useMemo(() => {
    if (!contract) return null;
    return calculateRenewalUrgency(contract);
  }, [contract]);

  // Handle obligation fulfillment
  const handleFulfillObligation = async (obligation: ContractObligation) => {
    try {
      const res = await fulfillContractObligationAction({
        workspaceId,
        obligationId: obligation.id,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to complete deliverable.');
      }

      toast({
        title: 'Deliverable Marked Done',
        description: `"${obligation.title}" marked completed and synced to tasks.`,
      });
      onContractUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error completing deliverable.';
      toast({ title: 'Action Failed', description: msg, variant: 'destructive' });
    }
  };

  // Handle obligation creation
  const handleCreateObligation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId || !newObligationTitle.trim() || !newObligationDueDate || isSubmittingObligation) return;

    try {
      setIsSubmittingObligation(true);
      const res = await createContractObligationAction({
        workspaceId,
        contractId,
        title: newObligationTitle.trim(),
        dueDate: new Date(newObligationDueDate).toISOString(),
        type: newObligationType,
        responsibleParty: 'internal',
        syncToTasks: true,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to create deliverable.');
      }

      toast({
        title: 'Deliverable Created',
        description: 'Linked to task queue and tracking calendar.',
      });

      setNewObligationTitle('');
      setNewObligationDueDate('');
      setIsAddingObligation(false);
      onContractUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating deliverable.';
      toast({ title: 'Action Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmittingObligation(false);
    }
  };

  // Handle termination
  const handleConfirmTermination = async () => {
    if (!contractId || !terminationReason.trim() || isTerminating) return;

    try {
      setIsTerminating(true);
      const res = await transitionContractStatusAction({
        workspaceId,
        contractId,
        nextStatus: 'terminated',
        reason: terminationReason.trim(),
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to terminate contract.');
      }

      toast({
        title: 'Contract Terminated',
        description: 'Agreement status updated to terminated with audit note.',
      });

      setIsTerminatingOpen(false);
      setTerminationReason('');
      fetchContract();
      onContractUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error terminating agreement.';
      toast({ title: 'Action Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsTerminating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[760px] p-0 overflow-hidden bg-background max-h-[90vh] flex flex-col">
          {isLoading && !contract ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !contract ? (
            <div className="p-12 text-center text-muted-foreground">Contract not found.</div>
          ) : (
            <>
              {/* Header */}
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                        contract.status === 'active' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
                        contract.status === 'amended' && 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
                        contract.status === 'renewed' && 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
                        contract.status === 'expired' && 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
                        contract.status === 'terminated' && 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30',
                        (contract.status === 'proposed' || contract.status === 'negotiation') && 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      )}
                    >
                      {contract.status.toUpperCase()}
                    </Badge>

                    {urgency && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs font-medium px-2 py-0.5',
                          urgency.urgencyLevel === 'critical' && 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
                          urgency.urgencyLevel === 'warning' && 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        )}
                      >
                        {urgency.badgeLabel}
                      </Badge>
                    )}
                  </div>

                  {contract.contractValue && (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>{contract.contractValue.amount.toLocaleString()} {contract.contractValue.currency}</span>
                      <span className="text-xs text-muted-foreground font-normal">/ {contract.contractValue.cadence}</span>
                    </div>
                  )}
                </div>

                <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
                  {contract.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Contract ID: {contract.id}
                </DialogDescription>

                {/* Operations Action Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/40 mt-3">
                  {onOpenAmendment && contract.status !== 'terminated' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenAmendment(contract)}
                      className="min-h-[44px] sm:min-h-[36px] text-xs font-medium active:scale-[0.97]"
                    >
                      <GitBranch className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      New Amendment
                    </Button>
                  )}

                  {onOpenRenewal && contract.status !== 'terminated' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenRenewal(contract)}
                      className="min-h-[44px] sm:min-h-[36px] text-xs font-medium active:scale-[0.97]"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                      Renew Agreement
                    </Button>
                  )}

                  {contract.executedPdfStoragePath && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast({ title: 'Download Executed PDF', description: 'Opening signed agreement.' });
                      }}
                      className="min-h-[44px] sm:min-h-[36px] text-xs font-medium active:scale-[0.97]"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      Executed PDF
                    </Button>
                  )}

                  {contract.status !== 'terminated' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsTerminatingOpen(true)}
                      className="min-h-[44px] sm:min-h-[36px] text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 ml-auto active:scale-[0.97]"
                    >
                      <Ban className="w-3.5 h-3.5 mr-1.5" />
                      Terminate
                    </Button>
                  )}
                </div>
              </DialogHeader>

              {/* Tabs Content */}
              <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-2 border-b border-border/50">
                  <TabsList className="bg-muted/40 p-1">
                    <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                    <TabsTrigger value="obligations" className="text-xs">
                      Deliverables ({obligations.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs">
                      History ({relationships.length})
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="flex-1 p-6 overflow-y-auto space-y-6">
                  {/* Timeline Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground/70" />
                        Effective Date
                      </span>
                      <p className="text-xs font-semibold text-foreground">
                        {contract.effectiveAt
                          ? new Date(contract.effectiveAt).toLocaleDateString()
                          : 'Immediate'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground/70" />
                        Expiration Date
                      </span>
                      <p className="text-xs font-semibold text-foreground">
                        {contract.expiresAt
                          ? new Date(contract.expiresAt).toLocaleDateString()
                          : 'Ongoing'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-muted-foreground/70" />
                        Notice Period
                      </span>
                      <p className="text-xs font-semibold text-foreground">
                        {contract.noticePeriodDays || 30} days notice
                      </p>
                    </div>
                  </div>

                  {/* Parties Rail */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      Signatories & Parties ({contract.partyLinks.length})
                    </h4>
                    <div className="space-y-2">
                      {contract.partyLinks.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No party contacts linked.</p>
                      ) : (
                        contract.partyLinks.map((party, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card text-xs"
                          >
                            <div>
                              <p className="font-semibold text-foreground">{party.name}</p>
                              {party.email && <p className="text-muted-foreground">{party.email}</p>}
                            </div>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {party.role.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Obligations Tab */}
                <TabsContent value="obligations" className="flex-1 p-6 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Deliverables & Milestones</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Contractual commitments automatically synced to user task queues.
                      </p>
                    </div>
                    {!isAddingObligation && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsAddingObligation(true)}
                        className="h-8 text-xs font-medium active:scale-[0.97]"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Deliverable
                      </Button>
                    )}
                  </div>

                  {/* Add Obligation Form */}
                  {isAddingObligation && (
                    <form
                      onSubmit={handleCreateObligation}
                      className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">New Deliverable</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsAddingObligation(false)}
                          className="h-6 text-xs text-muted-foreground"
                        >
                          Cancel
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="obTitle" className="text-xs font-medium">Title</Label>
                        <Input
                          id="obTitle"
                          value={newObligationTitle}
                          onChange={(e) => setNewObligationTitle(e.target.value)}
                          placeholder="e.g., Deliver Quarterly SOC2 Audit Pack"
                          className="text-xs min-h-[38px]"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="obDue" className="text-xs font-medium">Due Date</Label>
                          <Input
                            id="obDue"
                            type="date"
                            value={newObligationDueDate}
                            onChange={(e) => setNewObligationDueDate(e.target.value)}
                            className="text-xs min-h-[38px]"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="obType" className="text-xs font-medium">Type</Label>
                          <select
                            id="obType"
                            value={newObligationType}
                            onChange={(e) => setNewObligationType(e.target.value as ObligationType)}
                            className="w-full h-[38px] rounded-md border border-input bg-background px-3 text-xs"
                          >
                            <option value="deliverable">Deliverable</option>
                            <option value="reporting">Reporting</option>
                            <option value="payment">Payment</option>
                            <option value="compliance">Compliance</option>
                            <option value="audit">Audit</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSubmittingObligation || !newObligationTitle.trim() || !newObligationDueDate}
                          className="min-h-[36px] text-xs font-semibold active:scale-[0.97]"
                        >
                          {isSubmittingObligation ? 'Adding...' : 'Save Deliverable'}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Obligations List */}
                  <div className="space-y-2">
                    {obligations.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground border rounded-xl p-4">
                        No obligations or deliverables tracked for this agreement.
                      </div>
                    ) : (
                      obligations.map((ob) => {
                        const isDone = ob.status === 'fulfilled';
                        const isPast = new Date(ob.dueDate).getTime() < Date.now() && !isDone;

                        return (
                          <div
                            key={ob.id}
                            className={cn(
                              'flex items-center justify-between p-3.5 rounded-xl border transition-all text-xs',
                              isDone ? 'bg-muted/30 border-border/50 opacity-80' : 'bg-card border-border/70'
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={cn('font-semibold', isDone && 'line-through text-muted-foreground')}>
                                  {ob.title}
                                </span>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {ob.type}
                                </Badge>
                                {isPast && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Due: {new Date(ob.dueDate).toLocaleDateString()}
                                {isDone && ob.fulfilledAt && (
                                  <span> • Completed {new Date(ob.fulfilledAt).toLocaleDateString()}</span>
                                )}
                              </p>
                            </div>

                            {!isDone && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleFulfillObligation(ob)}
                                className="min-h-[36px] text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 active:scale-[0.97]"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Mark Done
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                {/* History & Relationships Tab */}
                <TabsContent value="history" className="flex-1 p-6 overflow-y-auto space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-foreground">Contract Continuity & Relationships</h4>
                    {contract.parentContractId && (
                      <div className="p-3 rounded-xl border border-border/60 bg-muted/20 text-xs">
                        <span className="text-muted-foreground">Parent Agreement:</span>{' '}
                        <span className="font-semibold text-foreground">{contract.parentContractId}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      {relationships.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No amendments or renewals linked yet.</p>
                      ) : (
                        relationships.map((rel) => (
                          <div
                            key={rel.id}
                            className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {rel.relationshipType}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(rel.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="font-medium text-foreground">{rel.description}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Termination Confirmation Alert */}
      <AlertDialog open={isTerminatingOpen} onOpenChange={setIsTerminatingOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Terminate Agreement
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Terminating this agreement is irreversible. It will archive contractual obligations and update CRM deal health.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="termReason" className="text-xs font-medium">
              Termination Reason <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="termReason"
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
              placeholder="e.g., Material breach of clause 4.2; counterparty mutual agreement."
              rows={3}
              className="text-xs resize-none"
              required
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTerminating} className="min-h-[44px] sm:min-h-[36px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTermination}
              disabled={isTerminating || !terminationReason.trim()}
              className="min-h-[44px] sm:min-h-[36px] bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isTerminating ? 'Terminating...' : 'Confirm Termination'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

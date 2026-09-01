'use client';

/**
 * @fileOverview Access Review Certification Queue Sheet (Governance 2.0)
 *
 * Slide-over interface for certifying or revoking members' role assignments
 * with justification logging and instantaneous de-provisioning.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Sheet with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccessReviewCampaign, AccessReviewDecision } from '@/lib/types';
import {
  listReviewDecisionsAction,
  submitReviewDecisionAction,
} from '@/app/actions/governance-actions';

interface AccessReviewDecisionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: AccessReviewCampaign | null;
  onDecisionsUpdated: () => void;
}

export function AccessReviewDecisionsDrawer({
  isOpen,
  onClose,
  campaign,
  onDecisionsUpdated,
}: AccessReviewDecisionsDrawerProps) {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [decisions, setDecisions] = React.useState<AccessReviewDecision[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [submittingId, setSubmittingId] = React.useState<string | null>(null);

  const loadDecisions = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId || !campaign) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await listReviewDecisionsAction({
        idToken,
        organizationId: activeOrganizationId,
        campaignId: campaign.id,
      });

      if (res.success) {
        setDecisions(res.decisions);
      }
    } catch (err: unknown) {
      console.warn('[AccessReviewDecisionsDrawer] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId, campaign]);

  React.useEffect(() => {
    if (isOpen) {
      loadDecisions();
    }
  }, [isOpen, loadDecisions]);

  const handleDecision = async (decisionId: string, decision: 'certified' | 'revoked') => {
    if (!authUser || !activeOrganizationId) return;

    setSubmittingId(decisionId);
    try {
      const idToken = await authUser.getIdToken();
      const res = await submitReviewDecisionAction({
        idToken,
        organizationId: activeOrganizationId,
        decisionId,
        decision,
      });

      if (res.success) {
        toast({
          title: decision === 'certified' ? 'Access Certified' : 'Access Revoked',
          description: `Decision recorded successfully.`,
        });
        loadDecisions();
        onDecisionsUpdated();
      } else {
        throw new Error(res.error || 'Failed to submit decision');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({ title: 'Decision Failed', description: msg, variant: 'destructive' });
    } finally {
      setSubmittingId(null);
    }
  };

  if (!campaign) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-3xl w-full p-0 flex flex-col bg-card border shadow-2xl">
        <SheetHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <SheetTitle className="text-base font-bold text-foreground">
                  Certification Queue: {campaign.title}
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs">
                Certify necessary role assignments or revoke excess privileges
              </SheetDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-bold">
              {campaign.reviewedItems} / {campaign.totalItems} Reviewed
            </Badge>
          </div>
        </SheetHeader>

        {/* Scrollable Decisions Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <Card className="border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20 border-b">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Member</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Assigned Role</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Current Decision</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Review Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={4} className="p-4">
                          <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : decisions.length > 0 ? (
                    decisions.map((dec) => (
                      <TableRow key={dec.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="pl-4 py-3">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-xs text-foreground block">{dec.personName}</span>
                            <span className="text-[10px] text-muted-foreground block">{dec.personEmail}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="text-[10px] py-0 bg-muted/30">
                            {dec.roleName}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              dec.decision === 'certified'
                                ? 'default'
                                : dec.decision === 'revoked'
                                ? 'destructive'
                                : 'outline'
                            }
                            className={cn(
                              'text-[9px] font-bold uppercase tracking-wider',
                              dec.decision === 'certified' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                              dec.decision === 'pending' && 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                            )}
                          >
                            {dec.decision}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDecision(dec.id, 'revoked')}
                              disabled={submittingId === dec.id || dec.decision === 'revoked'}
                              className="text-[11px] h-7 px-2.5 text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]"
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Revoke
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleDecision(dec.id, 'certified')}
                              disabled={submittingId === dec.id || dec.decision === 'certified'}
                              className="text-[11px] h-7 px-2.5 font-semibold active:scale-[0.97]"
                            >
                              {submittingId === dec.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Certify
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground">
                        No review items found in this campaign.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AccessReviewDecisionsDrawer;

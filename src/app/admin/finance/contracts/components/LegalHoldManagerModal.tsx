'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Legal Hold & Retention Manager Modal (Phase 9 UI):
 * 1. Purpose & Standards:
 *    Allows workspace administrators and compliance officers to freeze contracts
 *    under active Legal Hold (FRCP 26/37) and export cryptographic e-Discovery ZIP bundles.
 * 2. Rule Compliance:
 *    - Mobile Ergonomics: Touch targets `min-h-[44px]`, `active:scale-[0.97]` tactile buttons.
 *    - Input Zoom Prevention: `text-base sm:text-sm` on all inputs.
 *    - Actionable Error & Toast Navigation: Toasts include actionConfig with relative paths.
 *    - Strict Typing (Rule 4): Strictly zero `any` or `any[]`.
 * 3. Deletion Protection:
 *    When active, contracts cannot be deleted or purged across the workspace.
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  placeContractLegalHoldAction,
  releaseContractLegalHoldAction,
  generateEDiscoveryPackageAction,
} from '@/app/actions/compliance-archival-actions';
import {
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  Download,
  Loader2,
  AlertTriangle,
  FileArchive,
} from 'lucide-react';
import { format } from 'date-fns';

export interface LegalHoldContractSummary {
  id: string;
  title: string;
  isUnderLegalHold?: boolean;
  legalHoldDetails?: {
    matterId?: string;
    reason?: string;
    placedAt?: string;
    placedByUserId?: string;
  };
  retentionCategory?: string;
}

export interface LegalHoldManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  contract: LegalHoldContractSummary | null;
  onHoldToggled?: () => void;
}

export function LegalHoldManagerModal({
  isOpen,
  onClose,
  workspaceId,
  contract,
  onHoldToggled,
}: LegalHoldManagerModalProps) {
  const { toast } = useToast();

  const [matterId, setMatterId] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [releaseReason, setReleaseReason] = React.useState('');
  const [isProcessingHold, setIsProcessingHold] = React.useState(false);
  const [isExportingArchive, setIsExportingArchive] = React.useState(false);
  const [isConfirmingRelease, setIsConfirmingRelease] = React.useState(false);

  // Sync state on contract change
  React.useEffect(() => {
    if (contract) {
      setMatterId(contract.legalHoldDetails?.matterId || '');
      setReason(contract.legalHoldDetails?.reason || '');
      setReleaseReason('');
      setIsConfirmingRelease(false);
    }
  }, [contract]);

  if (!contract) return null;

  const isHoldActive = Boolean(contract.isUnderLegalHold);

  const handlePlaceHold = async () => {
    if (!matterId.trim()) {
      toast({
        title: 'Matter ID Required',
        description: 'Please specify the legal matter, docket, or audit reference ID.',
        variant: 'destructive',
      });
      return;
    }
    if (!reason.trim()) {
      toast({
        title: 'Hold Reason Required',
        description: 'Please describe the litigation or statutory basis for this hold.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessingHold(true);
    try {
      const res = await placeContractLegalHoldAction(workspaceId, contract.id, {
        matterId: matterId.trim(),
        reason: reason.trim(),
      });

      if (!res.success) {
        toast({
          title: 'Legal Hold Failed',
          description: res.error || 'Failed to place contract on legal hold.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/finance/contracts',
            label: 'View Agreements',
          },
        });
        return;
      }

      toast({
        title: 'Contract Locked Under Legal Hold',
        description: `Agreement "${contract.title}" is now frozen against deletion or purge.`,
      });
      onHoldToggled?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({
        title: 'Action Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingHold(false);
    }
  };

  const handleReleaseHold = async () => {
    setIsProcessingHold(true);
    try {
      const res = await releaseContractLegalHoldAction(workspaceId, contract.id, {
        reason: releaseReason.trim() || 'Matter concluded / hold released by admin',
      });

      if (!res.success) {
        toast({
          title: 'Release Failed',
          description: res.error || 'Failed to release legal hold.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/finance/contracts',
            label: 'View Agreements',
          },
        });
        return;
      }

      toast({
        title: 'Legal Hold Released',
        description: `Agreement "${contract.title}" returned to standard retention lifecycle.`,
      });
      onHoldToggled?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({
        title: 'Release Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingHold(false);
      setIsConfirmingRelease(false);
    }
  };

  const handleExportEDiscovery = async () => {
    setIsExportingArchive(true);
    try {
      const res = await generateEDiscoveryPackageAction(workspaceId, contract.id);

      if (!res.success || !res.data) {
        toast({
          title: 'Export Failed',
          description: res.error || 'Unable to generate e-Discovery archival package.',
          variant: 'destructive',
        });
        return;
      }

      const bundle = res.data;

      // Handle download via Storage URL or Base64 Blob
      if (bundle.storageUrl) {
        window.open(bundle.storageUrl, '_blank');
        toast({
          title: 'Archive Ready',
          description: 'Large e-Discovery bundle generated and opened from secure storage.',
        });
      } else if (bundle.zipBase64) {
        const byteCharacters = atob(bundle.zipBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ediscovery-${contract.id}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'e-Discovery Package Downloaded',
          description: `Merkle Root: ${bundle.manifest.merkleRootSha256.substring(0, 16)}...`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast({
        title: 'Archival Export Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsExportingArchive(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isHoldActive
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {isHoldActive ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold truncate">Legal Hold & Retention Guard</DialogTitle>
                <Badge
                  variant={isHoldActive ? 'destructive' : 'secondary'}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  {isHoldActive ? 'Active Hold' : 'Normal Lifecycle'}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {contract.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Alert Banner */}
          {isHoldActive ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-foreground">Litigation Preservation Lock Active</p>
                    <p className="text-muted-foreground leading-relaxed">
                      This contract is strictly frozen against deletion, purging, and automated
                      lifecycle destruction under FRCP 26/37 preservation rules.
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                      Matter Reference
                    </span>
                    <span className="font-semibold text-foreground">
                      {contract.legalHoldDetails?.matterId || 'Not Specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                      Date Placed
                    </span>
                    <span className="font-semibold text-foreground">
                      {contract.legalHoldDetails?.placedAt
                        ? format(new Date(contract.legalHoldDetails.placedAt), 'MMM d, yyyy HH:mm')
                        : 'Unknown'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                      Hold Reason
                    </span>
                    <p className="text-foreground font-medium italic mt-0.5">
                      &quot;{contract.legalHoldDetails?.reason || 'No description recorded'}&quot;
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-muted/10">
              <CardContent className="p-4 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-foreground">Standard Retention Schedule</p>
                  <p className="text-muted-foreground leading-relaxed">
                    This agreement is under standard workspace retention rules ({contract.retentionCategory || 'general_commercial'}).
                    Placing a legal hold will immediately prevent accidental or scheduled deletion.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form Actions */}
          {!isHoldActive ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="matterId" className="text-xs font-bold text-foreground">
                  Legal Matter / Docket ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="matterId"
                  placeholder="e.g., LIT-2026-0048 or AUDIT-Q3"
                  value={matterId}
                  onChange={(e) => setMatterId(e.target.value)}
                  className="min-h-[44px] text-base sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-xs font-bold text-foreground">
                  Reason for Legal Hold <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Describe the pending litigation, regulatory subpoena, or internal investigation requiring record preservation..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-[90px] text-base sm:text-sm resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isConfirmingRelease ? (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
                  <div className="flex items-center gap-2 text-destructive font-bold text-xs">
                    <ShieldAlert className="h-4 w-4" />
                    Confirm Hold Release
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Releasing this legal hold will restore normal deletion and retention rules. Ensure
                    counsel has approved matter conclusion.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="releaseReason" className="text-xs font-semibold">
                      Reason for Release
                    </Label>
                    <Input
                      id="releaseReason"
                      placeholder="e.g., Matter settled / audit completed"
                      value={releaseReason}
                      onChange={(e) => setReleaseReason(e.target.value)}
                      className="min-h-[44px] text-base sm:text-sm bg-background"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleReleaseHold}
                      disabled={isProcessingHold}
                      className="min-h-[44px] active:scale-[0.97] transition-all font-bold text-xs px-4"
                    >
                      {isProcessingHold ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Unlock className="h-4 w-4 mr-2" />
                      )}
                      Confirm & Release
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsConfirmingRelease(false)}
                      disabled={isProcessingHold}
                      className="min-h-[44px] text-xs font-medium"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* e-Discovery Compliance Package Card */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">e-Discovery Evidence Archive</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                SHA-256 Merkle
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Export court-admissible audit bundle containing vector signed PDF, pre-execution original,
              biometric telemetry, append-only audit ledger, and standalone verification script.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportEDiscovery}
              disabled={isExportingArchive}
              className="w-full min-h-[44px] active:scale-[0.97] transition-all font-semibold text-xs gap-2"
            >
              {isExportingArchive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isExportingArchive ? 'Assembling Cryptographic Bundle...' : 'Export Court-Admissible Package (ZIP)'}
            </Button>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isProcessingHold}
            className="w-full sm:w-auto min-h-[44px] text-xs font-medium"
          >
            Close
          </Button>

          {!isHoldActive ? (
            <Button
              onClick={handlePlaceHold}
              disabled={isProcessingHold}
              className="w-full sm:w-auto min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md active:scale-[0.97] transition-all gap-2"
            >
              {isProcessingHold ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Place Legal Hold
            </Button>
          ) : !isConfirmingRelease ? (
            <Button
              variant="outline"
              onClick={() => setIsConfirmingRelease(true)}
              disabled={isProcessingHold}
              className="w-full sm:w-auto min-h-[44px] text-destructive hover:bg-destructive/10 border-destructive/30 font-bold text-xs active:scale-[0.97] transition-all gap-2"
            >
              <Unlock className="h-4 w-4" />
              Request Hold Release
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

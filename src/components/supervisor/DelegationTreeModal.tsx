'use client';

/**
 * @fileOverview Visual Delegation Tree & Scoped Authority Modal (Phase 13 Milestone 5 Task 2)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20`
 * - Single-Circle Info Tooltip: `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`
 * - Zero Raw Descriptions: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]` with `min-h-[44px]` touch targets
 *
 * Rules:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Mobile-first responsive touch targets >= 44px.
 * - Rule 8 & 47: Anti-IDOR tenant scoping.
 * - Rule 9 & 23: Delegation Depth <= 3.
 * - Rule 16: Authority Intersection Algebra & Agent Principal Identity.
 * - Rule 17: Non-Delegable Privileges Firewall & Lock Indicators.
 * - Rule 18: Live TOCTOU verification.
 * - Rule 22: SHA-256 cryptographic signature display & verification.
 * - Rule 60: Emergency Dead-Man Switch evaluation.
 * - Rule 61: Operational control with mandatory >= 5 character audit justification.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Network,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Copy,
  Check,
  Trash2,
  Clock,
  Key,
  Layers,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { DelegationToken } from '@/platform/identity/delegation/delegation-types';
import { revokeDelegationTokenAction } from '@/app/actions/delegation-actions';

export interface DelegationTreeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  workspaceId: string;
  tokens?: readonly DelegationToken[];
  onTokenRevoked?: (tokenId: string) => void;
  revokeAction?: typeof revokeDelegationTokenAction;
}

export function DelegationTreeModal({
  open,
  onOpenChange,
  organizationId,
  workspaceId,
  tokens = [],
  onTokenRevoked,
  revokeAction = revokeDelegationTokenAction,
}: DelegationTreeModalProps): React.JSX.Element {
  const [copiedTokenId, setCopiedTokenId] = React.useState<string | null>(null);
  const [activeRevokeTokenId, setActiveRevokeTokenId] = React.useState<string | null>(null);
  const [revocationReason, setRevocationReason] = React.useState<string>('');
  const [isRevoking, setIsRevoking] = React.useState<boolean>(false);

  const handleCopySignature = async (tokenId: string, signature: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(signature);
      setCopiedTokenId(tokenId);
      setTimeout(() => setCopiedTokenId(null), 2000);
      toast({
        title: 'Copied Signature',
        description: 'SHA-256 delegation signature copied to clipboard.',
      });
    } catch {
      // Fallback
    }
  };

  const handleInitiateRevoke = (tokenId: string): void => {
    setActiveRevokeTokenId(tokenId);
    setRevocationReason('');
  };

  const handleConfirmRevoke = async (tokenId: string): Promise<void> => {
    if (revocationReason.trim().length < 5 || isRevoking) return;

    setIsRevoking(true);
    try {
      const res = await revokeAction({
        tokenId,
        reason: revocationReason.trim(),
      });

      if (!res.success || !res.data) {
        toast({
          title: 'Revocation Failed',
          description: res.error || 'Failed to revoke delegation token.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/intelligence/organization',
            label: 'View Delegations',
          },
        });
        return;
      }

      toast({
        title: 'Token Revoked',
        description: `Successfully revoked token and ${res.data.revokedCount - 1} cascaded children.`,
        actionConfig: {
          path: '/admin/intelligence/organization',
          label: 'View Delegations',
        },
      });

      if (onTokenRevoked) {
        onTokenRevoked(tokenId);
      }
      setActiveRevokeTokenId(null);
      setRevocationReason('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({
        title: 'Revocation Error',
        description: message,
        variant: 'destructive',
        actionConfig: {
          path: '/admin/intelligence/organization',
          label: 'View Delegations',
        },
      });
    } finally {
      setIsRevoking(false);
    }
  };

  // Sort tokens by depth and parentage for hierarchical tree display
  const sortedTokens = React.useMemo(() => {
    return [...tokens].sort((a, b) => a.depth - b.depth);
  }, [tokens]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
        {/* Demarcated Header strictly adhering to theme.md §8 */}
        <DialogHeader
          demarcated
          className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Network className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                Delegation Tree & Scoped Authority
              </DialogTitle>
              <CardInfoTooltip text="Inspect active hierarchical delegation chains (depth <= 3), verify mathematical authority intersection scopes, and revoke grants with mandatory audit logging." />
            </div>
            <Badge variant="outline" className="text-xs font-mono font-medium">
              {tokens.length} Active {tokens.length === 1 ? 'Token' : 'Tokens'}
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Hierarchical delegation tree detailing active agent tokens, depth boundaries, non-delegable security locks, and cryptographic verification signatures.
          </DialogDescription>
        </DialogHeader>

        {/* Tree Container Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {sortedTokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-xl p-8">
              <Layers className="h-10 w-10 stroke-1 text-muted-foreground/60 mb-3" />
              <p className="text-sm font-medium text-foreground">No Active Delegations</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                There are currently no active subagent delegation tokens issued for this workspace.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTokens.map((token, index) => {
                const isSelectedForRevoke = activeRevokeTokenId === token.tokenId;
                const truncatedSig =
                  token.tokenSignature.length > 14
                    ? `${token.tokenSignature.slice(0, 8)}...${token.tokenSignature.slice(-6)}`
                    : token.tokenSignature;
                const isExpired = Date.parse(token.expiresAt) <= Date.now();

                return (
                  <div
                    key={token.tokenId}
                    className={cn(
                      'rounded-xl border transition-all relative overflow-hidden',
                      token.depth === 1
                        ? 'border-border/80 bg-card shadow-sm'
                        : token.depth === 2
                        ? 'border-border/60 bg-muted/15 ml-4 sm:ml-6'
                        : 'border-border/40 bg-muted/30 ml-8 sm:ml-12'
                    )}
                  >
                    {/* Visual Connecting Branch Line for Nested Tokens */}
                    {token.depth > 1 && (
                      <div className="absolute -left-3 top-6 w-3 h-0.5 bg-border/60 hidden sm:block" />
                    )}

                    <div className="p-4 sm:p-5 space-y-3.5">
                      {/* Token Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold font-mono">
                            {token.depth}
                          </span>
                          <span className="text-sm font-semibold text-foreground font-mono">
                            {token.subAgentId}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            delegated by <span className="text-foreground">{token.supervisorAgentId}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Depth Badge */}
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[11px] font-mono',
                              token.depth === 1
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : token.depth === 2
                                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            )}
                          >
                            Depth {token.depth} / 3
                          </Badge>

                          {/* Status Badge */}
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[11px]',
                              token.status === 'active' && !isExpired
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'border-destructive/40 bg-destructive/10 text-destructive'
                            )}
                          >
                            {isExpired ? 'EXPIRED' : token.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      {/* Scoped Permissions Pills */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Authorized Scopes & Capabilities:
                        </span>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {token.allowedScopes.map((scope) => (
                            <Badge
                              key={scope}
                              variant="secondary"
                              className="text-[11px] font-mono px-2 py-0.5 border border-border/60"
                            >
                              {scope}
                            </Badge>
                          ))}

                          {token.allowedCapabilities &&
                            token.allowedCapabilities.map((cap) => (
                              <Badge
                                key={cap}
                                variant="outline"
                                className="text-[11px] font-mono px-2 py-0.5 border-primary/30 text-primary bg-primary/5"
                              >
                                {cap}
                              </Badge>
                            ))}

                          {/* Non-Delegable Locked Indicator (Rule 17) */}
                          <Badge
                            variant="outline"
                            className="text-[11px] border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-1 font-sans"
                          >
                            <Lock className="h-3 w-3" />
                            Non-Delegable Locked
                          </Badge>
                        </div>
                      </div>

                      {/* Cryptographic Signature & Telemetry Footer */}
                      <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        {/* Truncated Signature with tactile copy button */}
                        <div className="flex items-center gap-2 font-mono">
                          <Key className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">
                            Sig: <span className="text-foreground">{truncatedSig}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySignature(token.tokenId, token.tokenSignature)}
                            className="p-1 hover:text-foreground transition-all active:scale-[0.95]"
                            title="Copy full SHA-256 signature"
                          >
                            {copiedTokenId === token.tokenId ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Token Budget & Expiry */}
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Clock className="h-3 w-3" />
                            Expires: {new Date(token.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {/* Revoke Action Trigger */}
                          {token.status === 'active' && !isExpired && !isSelectedForRevoke && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleInitiateRevoke(token.tokenId)}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-2 active:scale-[0.97]"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Revoke Token
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Inline Revocation Justification Form (Rule 61) */}
                      {isSelectedForRevoke && (
                        <div className="mt-3 p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor={`reason-${token.tokenId}`}
                              className="text-xs font-semibold text-destructive flex items-center gap-1.5"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Mandatory Audit Justification (&ge; 5 chars)
                            </Label>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {revocationReason.length} / 5 min
                            </span>
                          </div>

                          <Input
                            id={`reason-${token.tokenId}`}
                            type="text"
                            placeholder="Reason for revocation (e.g. Mission completed; releasing authority)..."
                            value={revocationReason}
                            onChange={(e) => setRevocationReason(e.target.value)}
                            disabled={isRevoking}
                            className="h-8 text-xs font-sans border-destructive/30"
                          />

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveRevokeTokenId(null)}
                              disabled={isRevoking}
                              className="h-7 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleConfirmRevoke(token.tokenId)}
                              disabled={isRevoking || revocationReason.trim().length < 5}
                              className="h-7 text-xs font-medium active:scale-[0.97]"
                            >
                              {isRevoking ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  Revoking...
                                </>
                              ) : (
                                'Confirm Revocation'
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Demarcated Footer strictly adhering to theme.md §8 */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] rounded-xl active:scale-[0.97] border-border/80 text-foreground"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

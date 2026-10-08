'use client';

/**
 * @fileOverview Standardized Capability Detail Modal (Phase 15 Milestone 4 Task 6)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20`
 * - Single-Circle Info Tooltip: `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`
 * - Zero Raw Descriptions: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]` with `min-h-[44px]` touch targets
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
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
import {
  Wrench,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  FileCode,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CapabilityCatalogItem } from '@/platform/registry/contracts/registry-types';
import { toast } from '@/hooks/use-toast';

export interface CapabilityDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capability: CapabilityCatalogItem | null;
}

export function CapabilityDetailModal({
  open,
  onOpenChange,
  capability,
}: CapabilityDetailModalProps) {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'schema' | 'governance' | 'drift'>(
    'overview'
  );
  const [copied, setCopied] = React.useState(false);

  if (!capability) return null;

  const handleCopySchema = async () => {
    try {
      const jsonContent = JSON.stringify(capability.schema || {}, null, 2);
      await navigator.clipboard.writeText(jsonContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied to Clipboard',
        description: `Schema for ${capability.id} copied successfully.`,
      });
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Unable to access clipboard.',
        variant: 'destructive',
      });
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'L0_READ':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'L1_INTERNAL_DRAFT':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'L2_STATE_MUTATION':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
        return 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400';
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return 'border-destructive/30 bg-destructive/10 text-destructive';
      default:
        return 'border-muted text-muted-foreground';
    }
  };

  const getDriftBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Approved Signature
          </Badge>
        );
      case 'DRIFT_DETECTED':
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            Drift Detected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive gap-1 text-xs">
            <ShieldAlert className="h-3 w-3" />
            Suspended
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
        {/* Demarcated Header strictly adhering to theme.md §8 */}
        <DialogHeader
          demarcated
          className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Wrench className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground font-mono">
                {capability.id}
              </DialogTitle>
              <CardInfoTooltip text="Cryptographically verifiable platform tool capability with strict parameter schemas, non-wildcard RBAC, and live drift auditing." />
            </div>
            {getDriftBadge(capability.driftStatus)}
          </div>
          <DialogDescription className="sr-only">
            Inspect canonical tool capability metadata, JSON schema, RBAC permissions, and drift verification status.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-border/60 bg-muted/10 px-6 pt-2 gap-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'px-3 py-2 border-b-2 font-medium transition-colors min-h-[36px]',
              activeTab === 'overview'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={cn(
              'px-3 py-2 border-b-2 font-medium transition-colors min-h-[36px]',
              activeTab === 'schema'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Schema
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            className={cn(
              'px-3 py-2 border-b-2 font-medium transition-colors min-h-[36px]',
              activeTab === 'governance'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Governance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drift')}
            className={cn(
              'px-3 py-2 border-b-2 font-medium transition-colors min-h-[36px]',
              activeTab === 'drift'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Drift & Verification
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn('text-xs font-mono', getRiskBadgeColor(capability.riskLevel))}>
                    {capability.riskLevel}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-mono">
                    Domain: {capability.domain}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                    v{capability.version}
                  </Badge>
                  {capability.isDelegable ? (
                    <Badge variant="outline" className="border-blue-500/30 text-blue-500 text-xs">
                      Delegable to Subagents
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-xs">
                      <Lock className="h-3 w-3 mr-1 inline" />
                      Non-Delegable (Admin Only)
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {capability.description}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Required RBAC Permissions
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {capability.permissions.length > 0 ? (
                    capability.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-muted text-muted-foreground border border-border/60"
                      >
                        {perm}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">None required</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5" />
                  JSON Schema Definition
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySchema}
                  className="rounded-lg h-7 px-2.5 text-xs gap-1.5 active:scale-[0.97]"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy Schema'}
                </Button>
              </div>
              <div className="relative rounded-xl border border-border/70 bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100 dark:text-zinc-200 overflow-x-auto max-h-[320px]">
                <pre>{JSON.stringify(capability.schema || {}, null, 2)}</pre>
              </div>
            </div>
          )}

          {activeTab === 'governance' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5 space-y-1">
                  <span className="text-xs text-muted-foreground">Requires Approval</span>
                  <div className="font-semibold text-sm">
                    {capability.requiresApproval ? (
                      <span className="text-amber-500 flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Yes (Two-Phase Interception)
                      </span>
                    ) : (
                      <span className="text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Autonomous Execution
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5 space-y-1">
                  <span className="text-xs text-muted-foreground">Audit Required</span>
                  <div className="font-semibold text-sm">
                    {capability.policies?.auditRequired ? (
                      <span className="text-primary flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Audited in Domain Event Bus
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Standard Telemetry</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5 space-y-1">
                  <span className="text-xs text-muted-foreground">Idempotency Key</span>
                  <div className="font-semibold text-sm">
                    {capability.policies?.requiresIdempotencyKey ? (
                      <span className="text-blue-500 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> Mandatory (Rule 19)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Optional</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5 space-y-1">
                  <span className="text-xs text-muted-foreground">State Version Check</span>
                  <div className="font-semibold text-sm">
                    {capability.policies?.requiresExpectedVersion ? (
                      <span className="text-purple-500 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> TOCTOU Guarded (Rule 18)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not Required</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'drift' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-primary" />
                    Tool Drift Monitor Status
                  </span>
                  {getDriftBadge(capability.driftStatus)}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cryptographic verification periodically validates runtime tool definitions against signed platform manifests to ensure zero unauthorized prompt injection or parameter mutation drift.
                </p>
                {capability.lastVerifiedAt && (
                  <p className="text-xs font-mono text-muted-foreground pt-1">
                    Last Verified: {new Date(capability.lastVerifiedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Demarcated Footer strictly adhering to theme.md §8 */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] px-5"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

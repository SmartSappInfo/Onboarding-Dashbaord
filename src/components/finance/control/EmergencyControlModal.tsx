'use client';

/**
 * @fileOverview Standardized Backoffice Finance Emergency Control Modal (Phase 12 Milestone 5)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 * - Zero Raw Descriptions: Guidance routed through `<CardInfoTooltip text="..." />` alongside title
 * - Accessibility: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97] min-h-[44px]`
 *
 * Implements Rules 4, 7, 60, 61:
 * - 4 Granular operational kill switches
 * - Double-confirmation workflow with mandatory audit justification (>= 5 chars)
 * - Instant in-memory cache invalidation upon switch toggle
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  type FinanceControlSwitchKey,
  type FinanceEmergencyControls,
} from '@/platform/policy/finance-control-policy';
import {
  ShieldAlert,
  AlertOctagon,
  FileText,
  DollarSign,
  GraduationCap,
  Ban,
} from 'lucide-react';

export interface EmergencyControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  controls: FinanceEmergencyControls | null;
  onToggleSwitch: (
    switchKey: FinanceControlSwitchKey,
    enabled: boolean,
    reason: string
  ) => Promise<void>;
}

interface SwitchMetadata {
  key: FinanceControlSwitchKey;
  label: string;
  description: string;
  icon: React.ElementType;
}

const SWITCH_METADATA: SwitchMetadata[] = [
  {
    key: 'agent_finance_paused',
    label: 'Automated Invoicing & Fee Runs',
    description: 'Halts automated billing draft generation, sequence increments, and batch invoices.',
    icon: FileText,
  },
  {
    key: 'agent_collections_paused',
    label: 'Automated Collections & Dunning',
    description: 'Halts automated debtor escalation, payment plan drafts, and promise-to-pay tracking.',
    icon: DollarSign,
  },
  {
    key: 'agent_school_ops_paused',
    label: 'Automated School Operations & Alerts',
    description: 'Halts attendance anomaly detection, absenteeism velocity alerts, and parent brief drafting.',
    icon: GraduationCap,
  },
  {
    key: 'financial_mutation_halt',
    label: 'Global Financial Mutation Freeze',
    description: 'Emergency master freeze stopping all state mutations across billing, payments, and accounts.',
    icon: Ban,
  },
];

export function EmergencyControlModal({
  isOpen,
  onClose,
  controls,
  onToggleSwitch,
}: EmergencyControlModalProps) {
  const [selectedSwitch, setSelectedSwitch] = useState<FinanceControlSwitchKey | null>(null);
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSelectSwitch = (key: FinanceControlSwitchKey) => {
    setSelectedSwitch(key);
    setReason('');
    setError(null);
  };

  const handleConfirmToggle = async () => {
    if (!selectedSwitch) return;

    if (!reason || reason.trim().length < 5) {
      setError('Audit justification note must be at least 5 characters long.');
      return;
    }

    const currentStatus = controls?.switches[selectedSwitch] ?? false;
    const targetStatus = !currentStatus;

    setIsSubmitting(true);
    setError(null);

    try {
      await onToggleSwitch(selectedSwitch, targetStatus, reason.trim());
      setSelectedSwitch(null);
      setReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update control switch.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl max-w-2xl p-0 overflow-hidden">
        {/* Demarcated Header (theme.md §8) */}
        <DialogHeader
          demarcated
          className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Backoffice Emergency Control Plane
            </DialogTitle>
            <CardInfoTooltip text="Backoffice emergency dead-man switches instantly halt background agents and financial mutations without redeploying." />
          </div>
          <DialogDescription className="sr-only">
            Backoffice finance emergency control plane
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Active Incident Warning Banner if any switch is engaged */}
          {controls && Object.values(controls.switches).some(Boolean) && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3">
              <AlertOctagon className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <p className="font-bold">One or more emergency dead-man switches are ACTIVE</p>
                <p className="text-destructive/80">
                  Last updated by {controls.updatedBy}: &quot;{controls.pauseReason}&quot;
                </p>
              </div>
            </div>
          )}

          {/* Granular Switches List */}
          <div className="space-y-3">
            {SWITCH_METADATA.map((meta) => {
              const isPaused = controls?.switches[meta.key] ?? false;
              const isSelected = selectedSwitch === meta.key;
              const Icon = meta.icon;

              return (
                <div
                  key={meta.key}
                  className={`p-4 rounded-xl border transition-all ${
                    isPaused
                      ? 'border-destructive/40 bg-destructive/5'
                      : isSelected
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/70 bg-card hover:border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isPaused
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{meta.label}</span>
                          <Badge
                            variant={isPaused ? 'destructive' : 'outline'}
                            className="text-[10px] px-2 py-0 h-4"
                          >
                            {isPaused ? 'PAUSED' : 'ACTIVE'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isPaused ? 'default' : 'outline'}
                      data-testid={`toggle-${meta.key}`}
                      onClick={() => handleSelectSwitch(meta.key)}
                      className="rounded-xl active:scale-[0.97] min-h-[44px] shrink-0 text-xs"
                    >
                      {isPaused ? 'Resume' : 'Pause'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Double-Confirmation Reason Form */}
          {selectedSwitch && (
            <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Confirm Emergency State Change
                </span>
                <span className="text-xs font-mono text-muted-foreground">{selectedSwitch}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Audit Justification Note (Required, min 5 chars):
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for this operational state change..."
                  className="text-xs min-h-[70px] resize-none"
                />
              </div>

              {error && <p className="text-xs text-destructive font-medium">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedSwitch(null)}
                  disabled={isSubmitting}
                  className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleConfirmToggle}
                  disabled={isSubmitting}
                  className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-semibold"
                >
                  {isSubmitting ? 'Updating...' : 'Confirm Toggle'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Demarcated Footer (theme.md §8) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl active:scale-[0.97] min-h-[44px]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

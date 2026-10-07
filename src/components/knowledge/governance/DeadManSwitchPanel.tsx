'use client';

/**
 * @fileOverview Emergency Dead-Man Switch & Kill Switch Panel (Phase 11 M5 · T5)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first >= 44px touch targets, tactile compression)
 * - Rule 60 (Emergency Dead-Man Switch Controls & Fail-Closed Semantics)
 * - theme.md §8 (Standardized Modal & Dialog System Architecture)
 */

import * as React from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  Power,
  RotateCcw,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type {
  KnowledgeKillSwitchKey,
  BackofficeGovernanceConfig,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-ui-types';
import { cn } from '@/lib/utils';

export interface DeadManSwitchPanelProps {
  killSwitches: BackofficeGovernanceConfig['killSwitches'];
  onToggleSwitch: (
    switchKey: KnowledgeKillSwitchKey,
    enabled: boolean,
    reason: string
  ) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

export function DeadManSwitchPanel({
  killSwitches,
  onToggleSwitch,
  isProcessing = false,
  className,
}: DeadManSwitchPanelProps) {
  // Modal state for double-confirmation (Rule 60)
  const [pendingSwitch, setPendingSwitch] = React.useState<{
    key: KnowledgeKillSwitchKey;
    targetState: boolean;
    label: string;
  } | null>(null);

  const [confirmReason, setConfirmReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const switchDefinitions: {
    key: KnowledgeKillSwitchKey;
    label: string;
    description: string;
    critical?: boolean;
  }[] = [
    {
      key: 'agent_meeting',
      label: 'Disable Meeting Agent',
      description: 'Halt all ambient recording transcription, topic segmentation, and action extraction.',
    },
    {
      key: 'agent_knowledge',
      label: 'Disable Knowledge Agent',
      description: 'Block natural language question answering and grounded memory synthesis.',
    },
    {
      key: 'capability_retrieval',
      label: 'Disable Hybrid Retrieval',
      description: 'Halt dense vector search, sparse BM25 retrieval, and knowledge graph traversals.',
    },
    {
      key: 'draft_messages',
      label: 'Block Follow-Up Drafts',
      description: 'Prevent generation and delivery of all post-meeting follow-up emails and messages.',
    },
    {
      key: 'global_halt',
      label: 'GLOBAL EMERGENCY HALT',
      description: 'Immediately pause all autonomous reasoning, tool executions, and pipeline ingestions across the entire platform.',
      critical: true,
    },
  ];

  const handleOpenConfirmation = (key: KnowledgeKillSwitchKey, currentState: boolean, label: string) => {
    setPendingSwitch({
      key,
      targetState: !currentState,
      label,
    });
    setConfirmReason('');
  };

  const handleExecuteToggle = async () => {
    if (!pendingSwitch) return;
    setIsSubmitting(true);
    try {
      await onToggleSwitch(
        pendingSwitch.key,
        pendingSwitch.targetState,
        confirmReason.trim() || 'Manual backoffice operator action'
      );
      setPendingSwitch(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <Card
        className={cn(
          'border border-border/80 bg-card shadow-sm rounded-2xl overflow-hidden',
          killSwitches.global_halt && 'border-rose-500/50 bg-rose-500/[0.02]'
        )}
      >
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'p-1.5 rounded-lg border',
                  killSwitches.global_halt
                    ? 'bg-rose-500/20 text-rose-600 border-rose-500/40 animate-pulse'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                )}
              >
                <AlertOctagon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                Emergency Dead-Man & Kill Switches (Rule 60)
                <CardInfoTooltip text="Fail-closed switches to instantly halt compromised pipelines, isolate malicious inputs, or stop rogue tool calls without restarting application servers." />
              </CardTitle>
            </div>

            {killSwitches.global_halt ? (
              <Badge variant="destructive" className="text-xs px-2.5 py-0.5 rounded-full animate-pulse">
                GLOBAL HALT ACTIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                All Systems Operational
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground pt-1">
            Engaging any switch requires explicit human reason auditing and immediately aborts active execution loops.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 divide-y divide-border/60">
          {switchDefinitions.map((sw) => {
            const isEngaged = killSwitches[sw.key];

            return (
              <div
                key={sw.key}
                className={cn(
                  'py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
                  sw.critical && 'bg-rose-500/[0.03] p-4 rounded-xl -mx-2 my-1 border border-rose-500/20'
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold tracking-tight',
                        sw.critical ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                      )}
                    >
                      {sw.label}
                    </span>
                    {isEngaged ? (
                      <Badge variant="destructive" className="text-[10px] px-2 py-0">
                        HALTED
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0 text-muted-foreground">
                        Enabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                    {sw.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant={isEngaged ? 'outline' : sw.critical ? 'destructive' : 'outline'}
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleOpenConfirmation(sw.key, isEngaged, sw.label)}
                    className={cn(
                      'min-h-[44px] px-4 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all flex items-center gap-1.5',
                      isEngaged && 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
                    )}
                  >
                    {isEngaged ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Resume System
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5 mr-1" />
                        {sw.critical ? 'EMERGENCY HALT' : 'Kill Switch'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Double Confirmation Modal (theme.md §8) */}
      <Dialog
        open={Boolean(pendingSwitch)}
        onOpenChange={(open) => !open && setPendingSwitch(null)}
      >
        <DialogContent className="sm:max-w-md border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 overflow-hidden flex flex-col">
          {/* Demarcated Header (theme.md §8.2) */}
          <DialogHeader
            demarcated
            className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'p-1.5 rounded-lg border',
                  pendingSwitch?.targetState
                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                )}
              >
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                  {pendingSwitch?.targetState ? 'Confirm System Halt' : 'Confirm System Resumption'}
                </DialogTitle>
                <CardInfoTooltip text="Double-confirmation required for all Rule 60 kill switches. All operations will record your ID and reason in immutable audit storage." />
              </div>
            </div>

            <DialogDescription className="sr-only">
              Confirm toggle of operational kill switch or global halt state.
            </DialogDescription>
          </DialogHeader>

          {/* Modal Body */}
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground block">
                Target: {pendingSwitch?.label}
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {pendingSwitch?.targetState
                  ? 'Engaging this kill switch will immediately reject incoming requests with HTTP 503 (KNOWLEDGE_DEAD_MAN_PAUSED) until an operator manually resumes execution.'
                  : 'Resuming will re-enable normal pipeline ingestions and agent executions.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                Audit Reason (Required)
              </Label>
              <Input
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                placeholder="e.g., Suspected prompt injection or model hallucination"
                className="h-10 rounded-xl text-xs bg-muted/20"
                autoFocus
              />
            </div>
          </div>

          {/* Demarcated Footer (theme.md §8.4) */}
          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingSwitch(null)}
              className="min-h-[44px] px-4 rounded-xl text-xs active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting || !confirmReason.trim()}
              onClick={handleExecuteToggle}
              className={cn(
                'min-h-[44px] px-5 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all text-white',
                pendingSwitch?.targetState
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              )}
            >
              {isSubmitting ? (
                'Processing…'
              ) : pendingSwitch?.targetState ? (
                'Confirm Halt'
              ) : (
                'Confirm Resumption'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

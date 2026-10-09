'use client';

/**
 * @fileOverview BlockersManagerView component (Phase 4B).
 *
 * Implements:
 * - Centralized workspace blocker lifecycle management (open -> acknowledged -> escalated -> resolved).
 * - Severity and status filtering.
 * - Resolution modal adhering to Section 8 Modal Architecture.
 * - In-flight mutation locking and TOCTOU protection via expectedUpdatedAt.
 * - Mobile-first controls (min-h-[44px]) with Emil Kowalski active:scale-[0.97].
 */

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Search,
  User,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import { mutateBlockerAction } from '@/lib/standup-server-actions';
import type { BlockerRecord, BlockerStatus, BlockerSeverity } from '@/lib/types';

export interface BlockersManagerViewProps {
  workspaceId: string;
  blockers: BlockerRecord[];
  onMutated?: () => void;
}

export function BlockersManagerView({
  workspaceId,
  blockers: initialBlockers,
  onMutated,
}: BlockersManagerViewProps) {
  const { toast } = useToast();
  const [blockers, setBlockers] = React.useState<BlockerRecord[]>(initialBlockers);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [severityFilter, setSeverityFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');

  // Pending mutation tracking
  const [pendingBlockerIds, setPendingBlockerIds] = React.useState<Set<string>>(new Set());

  // Resolution modal state
  const [resolvingBlocker, setResolvingBlocker] = React.useState<BlockerRecord | null>(null);
  const [resolutionNote, setResolutionNote] = React.useState('');
  const [isResolving, setIsResolving] = React.useState(false);

  React.useEffect(() => {
    setBlockers(initialBlockers);
  }, [initialBlockers]);

  const filteredBlockers = React.useMemo(() => {
    return blockers.filter((blk) => {
      if (statusFilter !== 'all' && blk.status !== statusFilter) return false;
      if (severityFilter !== 'all' && blk.severity !== severityFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          blk.summary.toLowerCase().includes(term) ||
          blk.raisedByName?.toLowerCase().includes(term) ||
          blk.category.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [blockers, statusFilter, severityFilter, searchTerm]);

  const setPending = (id: string, isPending: boolean) => {
    setPendingBlockerIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleAcknowledge = async (blk: BlockerRecord) => {
    try {
      setPending(blk.id, true);
      const res = await mutateBlockerAction(workspaceId, blk.id, {
        status: 'acknowledged',
        expectedUpdatedAt: blk.updatedAt,
      });

      if (!res.success) {
        toast({
          title: 'Update Failed',
          description: res.error || 'Failed to acknowledge blocker.',
          variant: 'destructive',
        });
        return;
      }

      setBlockers((prev) =>
        prev.map((b) =>
          b.id === blk.id
            ? { ...b, status: 'acknowledged', updatedAt: new Date().toISOString() }
            : b
        )
      );

      toast({
        title: 'Blocker Acknowledged',
        description: 'Obstacle has been acknowledged for investigation.',
      });
      onMutated?.();
    } catch (err: unknown) {
      console.error('[BLOCKER] Acknowledge error:', err);
    } finally {
      setPending(blk.id, false);
    }
  };

  const handleEscalate = async (blk: BlockerRecord) => {
    try {
      setPending(blk.id, true);
      const res = await mutateBlockerAction(workspaceId, blk.id, {
        status: 'escalated',
        expectedUpdatedAt: blk.updatedAt,
      });

      if (!res.success) {
        toast({
          title: 'Escalation Failed',
          description: res.error || 'Failed to escalate blocker.',
          variant: 'destructive',
        });
        return;
      }

      setBlockers((prev) =>
        prev.map((b) =>
          b.id === blk.id
            ? { ...b, status: 'escalated', updatedAt: new Date().toISOString() }
            : b
        )
      );

      toast({
        title: 'Blocker Escalated',
        description: 'Obstacle escalated to leadership for immediate resolution.',
      });
      onMutated?.();
    } catch (err: unknown) {
      console.error('[BLOCKER] Escalate error:', err);
    } finally {
      setPending(blk.id, false);
    }
  };

  const handleConfirmResolution = async () => {
    if (!resolvingBlocker) return;
    try {
      setIsResolving(true);
      const res = await mutateBlockerAction(workspaceId, resolvingBlocker.id, {
        status: 'resolved',
        resolutionNote: resolutionNote.trim() || undefined,
        expectedUpdatedAt: resolvingBlocker.updatedAt,
      });

      if (!res.success) {
        toast({
          title: 'Resolution Failed',
          description: res.error || 'Failed to resolve blocker.',
          variant: 'destructive',
        });
        return;
      }

      setBlockers((prev) =>
        prev.map((b) =>
          b.id === resolvingBlocker.id
            ? {
                ...b,
                status: 'resolved',
                resolutionNote: resolutionNote.trim(),
                resolvedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : b
        )
      );

      toast({
        title: 'Blocker Resolved',
        description: 'Obstacle successfully unblocked and recorded in audit log.',
        actionConfig: {
          path: '/admin/standups?tab=blockers',
          label: 'View Blockers',
        },
      });

      setResolvingBlocker(null);
      setResolutionNote('');
      onMutated?.();
    } catch (err: unknown) {
      console.error('[BLOCKER] Resolution error:', err);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-figtree">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Blockers & Dependencies</h2>
            <p className="text-xs text-muted-foreground">
              Active obstacles preventing milestone progress and workflow delivery
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'open', 'acknowledged', 'escalated', 'resolved'] as const).map((st) => (
            <Button
              key={st}
              type="button"
              variant={statusFilter === st ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(st)}
              aria-label={`Filter by ${st}`}
              className="rounded-xl h-11 min-h-[44px] px-3.5 text-xs font-bold capitalize active:scale-[0.97]"
            >
              {st}
            </Button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search blockers..."
            className="pl-10 h-11 min-h-[44px] rounded-xl text-xs bg-background"
          />
        </div>
      </div>

      {/* Blocker List */}
      <div className="space-y-3">
        {filteredBlockers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card">
            <CheckCircle2 className="h-10 w-10 text-emerald-500/40 mb-2" />
            <h3 className="text-sm font-bold text-foreground">No active blockers found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              All team dependencies and obstacles are unblocked.
            </p>
          </div>
        ) : (
          filteredBlockers.map((blk) => {
            const isPending = pendingBlockerIds.has(blk.id);
            return (
              <div
                key={blk.id}
                className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        blk.severity === 'critical'
                          ? 'border-rose-600 text-rose-600 bg-rose-50'
                          : blk.severity === 'high'
                          ? 'border-amber-600 text-amber-600 bg-amber-50'
                          : 'border-slate-500 text-slate-500'
                      }`}
                    >
                      {blk.severity}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {blk.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize font-semibold ${
                        blk.status === 'resolved'
                          ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/5'
                          : blk.status === 'escalated'
                          ? 'border-rose-600 text-rose-600 bg-rose-50'
                          : blk.status === 'acknowledged'
                          ? 'border-blue-500/40 text-blue-600 bg-blue-50'
                          : 'border-slate-400 text-slate-600'
                      }`}
                    >
                      {blk.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Raised by {blk.raisedByName || 'Team Member'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-foreground leading-snug">
                    {blk.summary}
                  </h4>
                  {blk.resolutionNote && (
                    <div className="mt-2 p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-800 dark:text-emerald-300">
                      <span className="font-bold">Resolution Note:</span> {blk.resolutionNote}
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                  {blk.status === 'open' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleAcknowledge(blk)}
                      className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97]"
                    >
                      <Clock className="h-3.5 w-3.5 mr-1 text-blue-600" />
                      Acknowledge
                    </Button>
                  )}

                  {blk.status !== 'resolved' && blk.status !== 'escalated' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleEscalate(blk)}
                      className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold text-rose-600 active:scale-[0.97]"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                      Escalate
                    </Button>
                  )}

                  {blk.status !== 'resolved' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        setResolvingBlocker(blk);
                        setResolutionNote('');
                      }}
                      className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97] bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* RESOLUTION MODAL */}
      <Dialog
        open={Boolean(resolvingBlocker)}
        onOpenChange={(open) => !open && setResolvingBlocker(null)}
      >
        <DialogContent className="p-0 overflow-hidden sm:max-w-lg">
          <DialogHeader demarcated>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold">Resolve Blocker</DialogTitle>
              <CardInfoTooltip text="Document how this obstacle was unblocked for team retrospective and knowledge retention." />
            </div>
            <DialogDescription className="sr-only">
              Document resolution for blocker.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Blocker</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {resolvingBlocker?.summary}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Resolution Details</label>
              <Textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe how this obstacle was resolved (root cause, fix applied, vendor response)..."
                className="min-h-[90px] rounded-xl text-sm"
              />
            </div>
          </div>

          <DialogFooter demarcated>
            <Button
              type="button"
              variant="outline"
              disabled={isResolving}
              onClick={() => setResolvingBlocker(null)}
              className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isResolving}
              onClick={handleConfirmResolution}
              className="rounded-xl h-11 min-h-[44px] px-5 text-xs font-bold active:scale-[0.97] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isResolving ? 'Resolving...' : 'Confirm Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

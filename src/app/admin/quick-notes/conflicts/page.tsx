'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Knowledge Conflict Center Page
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Dedicated Contradiction Surface:
 *    - Route: `/admin/quick-notes/conflicts`
 *    - Resolves opposing assertions across team notes, calls, and documents.
 * 2. Strict Zero-`any` Standard:
 *    - Strongly typed with `MemoryConflict` and `ConflictStatus`.
 * 3. Mobile & Accessibility First:
 *    - Touch targets >= 44px (`min-h-[44px]`) and Emil Kowalski interactions (`active:scale-[0.97]`).
 * 4. Suspense Boundary:
 *    - Wrapped in Suspense boundary for Next.js navigation compliance.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import type {
  MemoryConflict,
  ConflictStatus,
  ConflictResolutionChoice,
} from '@/lib/memory/orchestrator-types';
import {
  listMemoryConflictsAction,
  resolveMemoryConflictAction,
  scanMemoryConflictsBatchAction,
} from '@/lib/memory/actions/orchestrator-actions';
import { MemoryConflictCard } from '@/components/memory/orchestrator/MemoryConflictCard';
import { ConflictResolutionModal } from '@/components/memory/orchestrator/ConflictResolutionModal';

export default function KnowledgeConflictCenterPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 px-6 max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      }
    >
      <ConflictPageContent />
    </React.Suspense>
  );
}

function ConflictPageContent() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = React.useState<ConflictStatus | 'all'>('unresolved');
  const [conflicts, setConflicts] = React.useState<MemoryConflict[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isScanning, setIsScanning] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [activeModalConflict, setActiveModalConflict] = React.useState<MemoryConflict | null>(null);

  const workspaceId = activeWorkspaceId || '';
  const organizationId = activeOrganizationId || activeWorkspaceId || '';
  const userId = user?.uid || '';

  const fetchConflicts = React.useCallback(async () => {
    if (!workspaceId || !userId) return;
    setIsLoading(true);
    try {
      const res = await listMemoryConflictsAction({
        workspaceId,
        userId,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });

      if (res.success && res.data) {
        setConflicts(res.data);
      } else {
        toast({
          title: 'Could not load conflicts',
          description: res.error,
          variant: 'destructive',
          actionConfig: { path: '/admin/quick-notes', label: 'Back to Notes' },
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, userId, statusFilter, toast]);

  React.useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const handleTriggerAudit = async () => {
    if (!workspaceId || !userId) return;
    setIsScanning(true);
    try {
      const res = await scanMemoryConflictsBatchAction({
        workspaceId,
        organizationId,
        userId,
      });

      if (res.success && res.data) {
        toast({
          title: 'Memory Audit Complete',
          description: `Evaluated ${res.data.scannedPairs} memory pairs. Found ${res.data.conflictsDetected} new contradictions.`,
        });
        fetchConflicts();
      } else {
        toast({
          title: 'Audit Failed',
          description: res.error,
          variant: 'destructive',
          actionConfig: { path: '/admin/quick-notes/conflicts', label: 'Retry' },
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleResolve = async (
    conflictId: string,
    choice: ConflictResolutionChoice,
    notes: string = ''
  ) => {
    if (!workspaceId || !userId) return;
    setProcessingId(conflictId);
    try {
      const res = await resolveMemoryConflictAction({
        conflictId,
        workspaceId,
        userId,
        resolution: choice,
        resolutionNotes: notes,
      });

      if (res.success && res.data) {
        setConflicts((prev) => prev.map((c) => (c.id === conflictId ? res.data! : c)));
        toast({
          title: 'Conflict Resolved',
          description: `Decision applied: ${choice.replace('_', ' ')}.`,
        });
        fetchConflicts();
      } else {
        toast({
          title: 'Resolution Failed',
          description: res.error,
          variant: 'destructive',
          actionConfig: { path: '/admin/quick-notes/conflicts', label: 'Retry' },
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const unresolvedCount = conflicts.filter((c) => c.status === 'unresolved').length;

  return (
    <div className="font-figtree min-h-screen bg-background">
      <PageContainerFluid className="py-6 px-4 md:px-8 max-w-6xl mx-auto space-y-6">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/quick-notes">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Notes
              </Button>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                  Knowledge Conflict Center
                </h1>
                {unresolvedCount > 0 && (
                  <Badge variant="destructive" className="animate-pulse text-xs">
                    {unresolvedCount} Active
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review and adjudicate mutually contradictory facts detected across team notes and meetings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerAudit}
              disabled={isScanning || isLoading}
              className="gap-1.5 min-h-[44px] sm:min-h-[36px] text-xs active:scale-[0.97]"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isScanning && 'animate-spin')} />
              {isScanning ? 'Auditing...' : 'Run Live Audit'}
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {(['unresolved', 'resolved', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all min-h-[44px] flex items-center gap-1.5 active:scale-[0.97]',
                statusFilter === st
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Conflict Cards List */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-2xl" />
            ))}
          </div>
        ) : conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center rounded-3xl border border-dashed border-border/80 bg-muted/20">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {statusFilter === 'unresolved'
                ? 'Zero Unresolved Conflicts'
                : 'No Conflicts Found'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {statusFilter === 'unresolved'
                ? 'All organizational facts and extracted memories are in complete alignment. No contradictory assertions detected.'
                : 'No dispute records match the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {conflicts.map((conflict) => (
              <MemoryConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={(choice, notes) =>
                  handleResolve(conflict.id, choice, notes)
                }
                onOpenModal={(c) => setActiveModalConflict(c)}
                isResolving={processingId === conflict.id}
              />
            ))}
          </div>
        )}

        {/* Custom Resolution Modal */}
        <ConflictResolutionModal
          conflict={activeModalConflict}
          isOpen={Boolean(activeModalConflict)}
          onClose={() => setActiveModalConflict(null)}
          onSave={(conflictId, choice, notes) =>
            handleResolve(conflictId, choice, notes)
          }
          isSaving={Boolean(
            processingId && activeModalConflict && processingId === activeModalConflict.id
          )}
        />
      </PageContainerFluid>
    </div>
  );
}

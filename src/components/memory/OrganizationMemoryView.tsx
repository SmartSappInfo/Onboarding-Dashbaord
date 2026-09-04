'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: OrganizationMemoryView Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Primary Organization Memory & Governance Interface:
 *    - Surfaces atomic institutional knowledge, detects contradictions, monitors freshness decay,
 *      and consolidates fragmented memories.
 * 2. Unified Real-Time KPI Ribbon:
 *    - Displays health metrics across Transactional (Firestore), Vector (Qdrant), and Graph stores.
 * 3. Mobile Accessibility:
 *    - All touch targets >= 44px on mobile (`min-h-[44px]`).
 * 4. Emil Kowalski Interaction Polish:
 *    - Smooth transitions, responsive feedback, and `active:scale-[0.97]` action buttons.
 * 5. Actionable Toast Navigation:
 *    - Toasts provide relative paths for direct navigation on errors or alerts.
 * 6. Zero-`any` Invariant:
 *    - Strictly typed domain states.
 */

import * as React from 'react';
import {
  Brain,
  Sparkles,
  ShieldCheck,
  Search,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Clock,
  GitMerge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type {
  MemoryObject,
  MemoryType,
  VerificationState,
} from '@/lib/memory/types';
import type {
  MemoryHealthMetrics,
  MemoryConflict,
  ConflictResolutionChoice,
  MemoryFreshnessInfo,
  ConsolidationCandidate,
} from '@/lib/memory/orchestrator-types';
import {
  listWorkspaceMemoriesAction,
  confirmMemoryAction,
  invalidateMemoryAction,
  updateMemoryAction,
} from '@/lib/memory/actions/memory-actions';
import {
  getMemoryHealthAction,
  listMemoryConflictsAction,
  resolveMemoryConflictAction,
  scanMemoryConflictsBatchAction,
  listStaleMemoriesAction,
  reconfirmMemoryFreshnessAction,
  findConsolidationCandidatesAction,
  applyConsolidationAction,
} from '@/lib/memory/actions/orchestrator-actions';
import { MemoryCard } from './MemoryCard';
import { MemoryInspectorDrawer } from './MemoryInspectorDrawer';
import {
  MemoryHealthRibbon,
  type HealthRibbonTab,
} from './orchestrator/MemoryHealthRibbon';
import { MemoryConflictCard } from './orchestrator/MemoryConflictCard';
import { ConflictResolutionModal } from './orchestrator/ConflictResolutionModal';
import { StaleMemoryList } from './orchestrator/StaleMemoryList';
import { ConsolidationReviewDrawer } from './orchestrator/ConsolidationReviewDrawer';

export interface OrganizationMemoryViewProps {
  workspaceId: string;
  userId: string;
  organizationId?: string;
}

const FILTER_TYPES: { id: MemoryType | 'all'; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'decision', label: 'Decisions' },
  { id: 'insight', label: 'Insights' },
  { id: 'problem', label: 'Problems' },
  { id: 'opportunity', label: 'Opportunities' },
  { id: 'risk', label: 'Risks' },
  { id: 'action_item', label: 'Action Items' },
  { id: 'fact', label: 'Facts' },
];

export function OrganizationMemoryView({
  workspaceId,
  userId,
  organizationId = '',
}: OrganizationMemoryViewProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<HealthRibbonTab>('all');
  const [memories, setMemories] = React.useState<MemoryObject[]>([]);
  const [healthMetrics, setHealthMetrics] = React.useState<MemoryHealthMetrics>({
    totalMemories: 0,
    verifiedTruthCount: 0,
    unresolvedConflictCount: 0,
    staleMemoryCount: 0,
    qdrantIndexedCount: 0,
    graphNodesCount: 0,
    graphEdgesCount: 0,
    syncHealthPercentage: 100,
  });

  const [conflicts, setConflicts] = React.useState<MemoryConflict[]>([]);
  const [staleItems, setStaleItems] = React.useState<
    { memory: MemoryObject; freshness: MemoryFreshnessInfo }[]
  >([]);
  const [candidates, setCandidates] = React.useState<ConsolidationCandidate[]>([]);

  const [isLoading, setIsLoading] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<MemoryType | 'all'>('all');
  const [selectedVerification, setSelectedVerification] = React.useState<
    VerificationState | 'all'
  >('all');

  const [inspectTarget, setInspectTarget] = React.useState<MemoryObject | null>(null);
  const [activeConflictModal, setActiveConflictModal] =
    React.useState<MemoryConflict | null>(null);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  // Load unified memory health, memories, and governance records
  const fetchData = React.useCallback(async () => {
    if (!workspaceId || !userId) return;
    setIsLoading(true);
    try {
      const [memoriesRes, healthRes] = await Promise.all([
        listWorkspaceMemoriesAction({
          workspaceId,
          userId,
          filters: {
            type: selectedType === 'all' ? undefined : selectedType,
            verification:
              activeTab === 'verified'
                ? 'user_confirmed'
                : selectedVerification === 'all'
                ? undefined
                : selectedVerification,
            searchQuery: searchQuery.trim() || undefined,
          },
        }),
        getMemoryHealthAction({
          workspaceId,
          organizationId: organizationId || workspaceId,
          userId,
        }),
      ]);

      if (memoriesRes.success && memoriesRes.data) {
        setMemories(memoriesRes.data);
      }
      if (healthRes.success && healthRes.data) {
        setHealthMetrics(healthRes.data);
      }

      // Fetch specific tab data
      if (activeTab === 'conflicts') {
        const cRes = await listMemoryConflictsAction({ workspaceId, userId });
        if (cRes.success && cRes.data) setConflicts(cRes.data);
      } else if (activeTab === 'stale') {
        const sRes = await listStaleMemoriesAction({ workspaceId, userId });
        if (sRes.success && sRes.data) setStaleItems(sRes.data);
      } else if (activeTab === 'consolidation') {
        const canRes = await findConsolidationCandidatesAction({
          workspaceId,
          organizationId: organizationId || workspaceId,
          userId,
        });
        if (canRes.success && canRes.data) setCandidates(canRes.data);
      }
    } catch {
      toast({
        title: 'Error loading memories',
        description: 'Failed to retrieve memory data.',
        variant: 'destructive',
        actionConfig: { path: '/admin/quick-notes', label: 'Retry' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    workspaceId,
    userId,
    organizationId,
    selectedType,
    selectedVerification,
    searchQuery,
    activeTab,
    toast,
  ]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tab change handler
  const handleTabChange = (tab: HealthRibbonTab) => {
    setActiveTab(tab);
  };

  // Trigger manual contradiction scan
  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const res = await scanMemoryConflictsBatchAction({
        workspaceId,
        organizationId: organizationId || workspaceId,
        userId,
      });

      if (res.success && res.data) {
        toast({
          title: 'Memory Audit Complete',
          description: `Evaluated ${res.data.scannedPairs} pairs. Detected ${res.data.conflictsDetected} new contradictions.`,
          actionConfig: { path: '/admin/quick-notes/conflicts', label: 'Review Conflicts' },
        });
        fetchData();
      } else {
        toast({
          title: 'Scan Encountered An Issue',
          description: res.error,
          variant: 'destructive',
          actionConfig: { path: '/admin/quick-notes', label: 'Retry' },
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Conflict resolution handler
  const handleResolveConflict = async (
    conflictId: string,
    choice: ConflictResolutionChoice,
    notes: string = ''
  ) => {
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
        fetchData();
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

  // Reconfirm memory freshness
  const handleReconfirmFreshness = async (memoryId: string) => {
    setProcessingId(memoryId);
    try {
      const res = await reconfirmMemoryFreshnessAction({ memoryId, workspaceId, userId });
      if (res.success && res.data) {
        setStaleItems((prev) => prev.filter((item) => item.memory.id !== memoryId));
        toast({
          title: 'Memory Reconfirmed',
          description: 'Freshness restored to 100% truth validity.',
        });
        fetchData();
      } else {
        toast({
          title: 'Reconfirmation Failed',
          description: res.error,
          variant: 'destructive',
          actionConfig: { path: '/admin/quick-notes', label: 'Retry' },
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Apply memory consolidation
  const handleApplyConsolidation = async (candidate: ConsolidationCandidate) => {
    setProcessingId(candidate.id);
    try {
      const res = await applyConsolidationAction({ candidate, userId });
      if (res.success && res.data) {
        setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
        toast({
          title: 'Memories Consolidated',
          description: `Canonical memory created: "${res.data.title}".`,
        });
        fetchData();
      } else {
        toast({
          title: 'Consolidation Failed',
          description: res.error,
          variant: 'destructive',
          actionConfig: { path: '/admin/quick-notes', label: 'Retry' },
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Standard memory confirm
  const handleConfirm = async (memoryId: string) => {
    setProcessingId(memoryId);
    try {
      const res = await confirmMemoryAction({ memoryId, workspaceId, userId });
      if (res.success && res.data) {
        setMemories((prev) => prev.map((m) => (m.id === memoryId ? res.data! : m)));
        if (inspectTarget?.id === memoryId) setInspectTarget(res.data);
        toast({ title: 'Memory confirmed as verified truth' });
        fetchData();
      } else {
        toast({
          title: 'Confirmation failed',
          description: res.error,
          variant: 'destructive',
          actionConfig: { path: '/admin/quick-notes', label: 'Retry' },
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Standard memory invalidate
  const handleInvalidate = async (memoryId: string, reason = 'Manually archived') => {
    setProcessingId(memoryId);
    try {
      const res = await invalidateMemoryAction({ memoryId, workspaceId, reason, userId });
      if (res.success && res.data) {
        setMemories((prev) => prev.map((m) => (m.id === memoryId ? res.data! : m)));
        if (inspectTarget?.id === memoryId) setInspectTarget(res.data);
        toast({ title: 'Memory archived' });
        fetchData();
      } else {
        toast({
          title: 'Invalidation failed',
          description: res.error,
          variant: 'destructive',
          actionConfig: { path: '/admin/quick-notes', label: 'Retry' },
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Standard memory update
  const handleUpdate = async (
    memoryId: string,
    updates: { title?: string; content?: string }
  ) => {
    setProcessingId(memoryId);
    try {
      const res = await updateMemoryAction({ memoryId, workspaceId, updates, userId });
      if (res.success && res.data) {
        setMemories((prev) => prev.map((m) => (m.id === memoryId ? res.data! : m)));
        if (inspectTarget?.id === memoryId) setInspectTarget(res.data);
      } else {
        throw new Error(res.error || 'Failed to update memory');
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Unified Health & Governance KPI Ribbon */}
      <MemoryHealthRibbon
        metrics={healthMetrics}
        isLoading={isLoading && memories.length === 0}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onTriggerScan={handleTriggerScan}
        isScanning={isScanning}
      />

      {/* 2. TAB: Conflicts & Contradiction Resolution */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Knowledge Conflict Center
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mutually contradictory institutional facts detected by CompanyBrain across notes and meetings.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
              className="min-h-[44px] sm:min-h-[36px] text-xs gap-1.5 active:scale-[0.97]"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              Refresh Disputes
            </Button>
          </div>

          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Zero Active Contradictions</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                No opposing claims or diverging facts detected. All organizational knowledge is currently harmonious.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {conflicts.map((conflict) => (
                <MemoryConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={(choice, notes) =>
                    handleResolveConflict(conflict.id, choice, notes)
                  }
                  onOpenModal={(c) => setActiveConflictModal(c)}
                  isResolving={processingId === conflict.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB: Freshness & Staleness Queue */}
      {activeTab === 'stale' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Memory Freshness & Staleness Review
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Knowledge objects that have exceeded their category TTL and require 1-click human truth reconfirmation.
            </p>
          </div>

          <StaleMemoryList
            staleItems={staleItems}
            onReconfirm={handleReconfirmFreshness}
            onArchive={(id) => handleInvalidate(id, 'Archived due to staleness')}
            processingId={processingId}
            isLoading={isLoading && staleItems.length === 0}
          />
        </div>
      )}

      {/* 4. TAB: Consolidation Candidates */}
      {activeTab === 'consolidation' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Memory Consolidation Queue
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI-synthesized candidates merging fragmented, redundant memories into unified canonical records.
            </p>
          </div>

          <ConsolidationReviewDrawer
            candidates={candidates}
            onApply={handleApplyConsolidation}
            onDismiss={(id) => setCandidates((prev) => prev.filter((c) => c.id !== id))}
            isApplyingId={processingId}
            isLoading={isLoading && candidates.length === 0}
          />
        </div>
      )}

      {/* 5. TAB: All Memories & Verified Truth */}
      {(activeTab === 'all' || activeTab === 'verified') && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="space-y-3">
            {/* Type pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
              {FILTER_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl transition-all whitespace-nowrap min-h-[44px] flex items-center gap-1.5 active:scale-[0.97]',
                    selectedType === t.id
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter memories by concept, quote, or entity..."
                  className="pl-9 h-11 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchData}
                  disabled={isLoading}
                  className="h-11 px-3 text-xs gap-1.5 min-h-[44px] active:scale-[0.97]"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Memories Grid */}
          {isLoading && memories.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-2xl" />
              ))}
            </div>
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No Memories Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                No institutional knowledge matches the current filter criteria. Take notes or scan meetings to extract memories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {memories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onInspect={() => setInspectTarget(memory)}
                  onConfirm={() => handleConfirm(memory.id)}
                  onInvalidate={(reason) => handleInvalidate(memory.id, reason)}
                  isProcessing={processingId === memory.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Memory Inspector Drawer */}
      <MemoryInspectorDrawer
        memory={inspectTarget}
        isOpen={Boolean(inspectTarget)}
        onClose={() => setInspectTarget(null)}
        onConfirm={handleConfirm}
        onInvalidate={handleInvalidate}
        onUpdate={handleUpdate}
        isProcessing={Boolean(processingId && processingId === inspectTarget?.id)}
      />

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        conflict={activeConflictModal}
        isOpen={Boolean(activeConflictModal)}
        onClose={() => setActiveConflictModal(null)}
        onSave={(conflictId, choice, notes) =>
          handleResolveConflict(conflictId, choice, notes)
        }
        isSaving={Boolean(
          processingId && activeConflictModal && processingId === activeConflictModal.id
        )}
      />
    </div>
  );
}

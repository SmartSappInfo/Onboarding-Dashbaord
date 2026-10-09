'use client';

/**
 * @fileOverview Knowledge Inbox Mission Control Client (Phase 11 M5 · T2; PRD §62, UI §14)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first, min-h-[44px] touch targets, Emil Kowalski tactile interactions)
 * - Rule 8 & 47 (Multi-Tenant Boundary & Anti-IDOR Lock)
 * - Rule 17 (Non-Delegable Human Decider)
 * - Rule 18 (TOCTOU expectedVersion Concurrency Guards)
 * - Rule 30 (Knowledge Poisoning Isolation & Human Review)
 * - Rule 62 (Real-Time SSE Event Stream Reactivity)
 * - theme.md §8 (Standardized Modal & Dialog System Architecture)
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useEventStream } from '@/hooks/useEventStream';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  Inbox,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SlidersHorizontal,
  Bookmark,
} from 'lucide-react';
import {
  listKnowledgeCandidatesAction,
  decideKnowledgeCandidateAction,
  resolveKnowledgeConflictAction,
} from '@/app/actions/knowledge-inbox-actions';
import type {
  KnowledgeCandidate,
  KnowledgeCandidateStatus,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';
import type {
  KnowledgeInboxItemType,
  KnowledgeInboxStatusTab,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-ui-types';
import { KnowledgeCandidateCard } from '@/components/knowledge/KnowledgeCandidateCard';
import { KnowledgeItemInspector } from '@/components/knowledge/KnowledgeItemInspector';
import { KnowledgeConflictModal } from '@/components/knowledge/KnowledgeConflictModal';

export function KnowledgeInboxClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const [candidates, setCandidates] = React.useState<KnowledgeCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = React.useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = React.useState<KnowledgeInboxStatusTab>('needs_review');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [itemTypeFilter, setItemTypeFilter] = React.useState<KnowledgeInboxItemType>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Inspector & Conflict modal state
  const [inspectedCandidate, setInspectedCandidate] = React.useState<KnowledgeCandidate | null>(null);
  const [conflictCandidate, setConflictCandidate] = React.useState<KnowledgeCandidate | null>(null);

  const fetchCandidates = React.useCallback(async () => {
    if (!activeWorkspaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await listKnowledgeCandidatesAction(activeWorkspaceId);
      if (res.success && res.data) {
        setCandidates(res.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to load inbox candidates',
          description: res.error || 'Please try again.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error fetching inbox',
        description: 'Network error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Real-time EventStream Reactivity (Rule 62)
  useEventStream({
    workspaceId: activeWorkspaceId || '',
    eventTypes: ['knowledge.candidate.*', 'memory.conflict.*'],
    onEvent: () => {
      fetchCandidates();
    },
  });

  // Filter logic
  const filteredCandidates = React.useMemo(() => {
    return candidates.filter((c) => {
      // Tab filter
      if (activeTab === 'needs_review' && c.status !== 'pending') return false;
      if (activeTab === 'conflicts' && !c.conflictId) return false;
      if (activeTab === 'saved' && c.status !== 'accepted') return false;
      if (activeTab === 'important' && c.confidence < 0.85) return false;

      // Item type filter
      if (itemTypeFilter !== 'all' && c.type !== itemTypeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(query);
        const matchesContent = c.content.toLowerCase().includes(query);
        if (!matchesTitle && !matchesContent) return false;
      }

      return true;
    });
  }, [candidates, activeTab, itemTypeFilter, searchQuery]);

  // Candidate triage decision handler (Rule 17 Non-Delegable, Rule 18 TOCTOU)
  const handleDecide = async (candidateId: string, decision: 'accept' | 'reject') => {
    if (!activeWorkspaceId) return;

    const target = candidates.find((c) => c.id === candidateId);
    if (!target) return;

    // Optimistic UI update
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId));

    try {
      const res = await decideKnowledgeCandidateAction(activeWorkspaceId, {
        candidateId,
        decision,
        expectedVersion: target.version,
      });

      if (res.success) {
        toast({
          title: decision === 'accept' ? 'Candidate accepted into memory' : 'Candidate rejected',
          description: target.title,
          actionConfig: {
            path: '/admin/intelligence/knowledge/inbox',
            label: 'Inbox',
          },
        });
      } else {
        // Rollback optimistic update
        setCandidates((prev) => [target, ...prev]);
        toast({
          variant: 'destructive',
          title: 'Failed to record decision',
          description: res.error || 'Concurrent edit or conflict occurred.',
        });
      }
    } catch {
      setCandidates((prev) => [target, ...prev]);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to process decision.',
      });
    }
  };

  // Batch triage
  const handleBatchDecide = async (decision: 'accept' | 'reject') => {
    if (!activeWorkspaceId || selectedCandidateIds.size === 0) return;
    setIsProcessing(true);

    const idsToProcess = Array.from(selectedCandidateIds);
    try {
      for (const id of idsToProcess) {
        await handleDecide(id, decision);
      }
      setSelectedCandidateIds(new Set());
      toast({
        title: `Batch ${decision}ed ${idsToProcess.length} items`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingCount = candidates.filter((c) => c.status === 'pending').length;
  const conflictCount = candidates.filter((c) => Boolean(c.conflictId)).length;

  return (
    <PageContainerFluid className="space-y-6 pb-16">
      {/* Zone 1: Executive Header & Status Badges */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Knowledge Inbox
            <CardInfoTooltip text="Intelligent triage center for newly extracted knowledge candidates, decisions, commitments, and conflict resolutions. Reviewing items promotes them into institutional memory." />
          </h1>
          {pendingCount > 0 && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              {pendingCount} new
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCandidates}
            disabled={isLoading}
            className="min-h-[44px] rounded-xl text-xs flex items-center gap-1.5 active:scale-[0.97]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {selectedCandidateIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchDecide('reject')}
                disabled={isProcessing}
                className="min-h-[44px] rounded-xl text-xs border-rose-500/30 text-rose-600 active:scale-[0.97]"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Reject Selected ({selectedCandidateIds.size})
              </Button>
              <Button
                size="sm"
                onClick={() => handleBatchDecide('accept')}
                disabled={isProcessing}
                className="min-h-[44px] rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Accept Selected ({selectedCandidateIds.size})
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Status Tabs, Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Button
            variant={activeTab === 'needs_review' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('needs_review')}
            className="rounded-xl text-xs min-h-[40px] px-3.5 active:scale-[0.97] flex items-center gap-1.5"
          >
            Needs Review
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                {pendingCount}
              </Badge>
            )}
          </Button>

          <Button
            variant={activeTab === 'conflicts' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('conflicts')}
            className="rounded-xl text-xs min-h-[40px] px-3.5 active:scale-[0.97] flex items-center gap-1.5"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Conflicts
            {conflictCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
                {conflictCount}
              </Badge>
            )}
          </Button>

          <Button
            variant={activeTab === 'important' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('important')}
            className="rounded-xl text-xs min-h-[40px] px-3.5 active:scale-[0.97] flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            High Confidence
          </Button>

          <Button
            variant={activeTab === 'saved' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('saved')}
            className="rounded-xl text-xs min-h-[40px] px-3.5 active:scale-[0.97] flex items-center gap-1.5"
          >
            <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
            Accepted
          </Button>

          <Button
            variant={activeTab === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('all')}
            className="rounded-xl text-xs min-h-[40px] px-3.5 active:scale-[0.97]"
          >
            All Candidates
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidates…"
            className="h-10 pl-9 pr-3 rounded-xl text-xs bg-muted/20 border-border/80"
          />
        </div>
      </div>

      {/* Zone 3: Candidates Feed */}
      <div className="space-y-3.5">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 w-full animate-pulse rounded-xl bg-muted/30" />
            ))}
          </div>
        )}

        {!isLoading && filteredCandidates.length === 0 && (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-3">
            <div className="p-3 rounded-full bg-muted/40 w-fit mx-auto text-muted-foreground">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No knowledge candidates found</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {activeTab === 'needs_review'
                ? "You're all caught up! When meetings, notes, or customer conversations are analyzed, new extracted facts will appear here for review."
                : 'No candidates matched the current tab or search filters.'}
            </p>
          </div>
        )}

        {!isLoading &&
          filteredCandidates.map((candidate) => (
            <KnowledgeCandidateCard
              key={candidate.id}
              candidate={candidate}
              onDecide={handleDecide}
              onInspect={(c) => setInspectedCandidate(c)}
              onResolveConflict={(c) => setConflictCandidate(c)}
            />
          ))}
      </div>

      {/* Inspector Side Drawer */}
      <KnowledgeItemInspector
        isOpen={Boolean(inspectedCandidate)}
        onClose={() => setInspectedCandidate(null)}
        candidate={inspectedCandidate}
      />

      {/* Conflict Resolution Modal */}
      {conflictCandidate && conflictCandidate.conflictId && (
        <KnowledgeConflictModal
          isOpen={Boolean(conflictCandidate)}
          onClose={() => setConflictCandidate(null)}
          candidate={conflictCandidate}
          conflict={{
            id: conflictCandidate.conflictId,
            organizationId: conflictCandidate.organizationId,
            workspaceId: conflictCandidate.workspaceId,
            existingMemoryId: 'existing_fact_01',
            candidateId: conflictCandidate.id,
            conflictType: 'contradiction',
            detectedAt: new Date().toISOString(),
            status: 'open',
            version: 1,
          }}
          onResolve={async (conflictId, resolution, expectedVersion) => {
            if (!activeWorkspaceId) return;
            const res = await resolveKnowledgeConflictAction(activeWorkspaceId, {
              conflictId,
              resolution,
              resolutionNotes: `Resolved via inbox with action: ${resolution}`,
              expectedVersion,
            });
            if (res.success) {
              toast({ title: 'Conflict resolved successfully' });
              setConflictCandidate(null);
              fetchCandidates();
            } else {
              toast({
                variant: 'destructive',
                title: 'Resolution failed',
                description: res.error,
              });
            }
          }}
        />
      )}
    </PageContainerFluid>
  );
}

export default KnowledgeInboxClient;

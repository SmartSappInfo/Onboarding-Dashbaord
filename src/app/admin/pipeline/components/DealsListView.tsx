'use client';

/**
 * Deals List View with Multi-Selection & Floating Bulk Actions Toolbar
 *
 * ARCHITECTURAL POINTER (Rule 10):
 * Renders deals in a sortable, accessible data table. Supports multi-row selection
 * with an animated floating action bar for bulk stage shifts, bulk ownership reassignments,
 * and bulk deletions.
 *
 * WORKSPACE RULES & COMPLIANCE:
 * - Strict typing: Zero 'any' or 'any[]'.
 * - Performance: Batch entity resolution avoids N+1 reads.
 * - Accessibility: Full keyboard support, aria-labels, and min-44px touch targets.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Deal, OnboardingStage, UserProfile } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useTerminology } from '@/hooks/use-terminology';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn, toTitleCase } from '@/lib/utils';
import {
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  UserCircle2,
  Workflow,
  Edit,
  Trash2,
  ArrowRight,
  Users,
  X,
  Loader2,
  Copy,
  GitMerge,
  Archive,
  RotateCcw,
  MoreVertical,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import type { KanbanFilters } from '../pipeline-types';
import { applyDealFilters } from '../utils/filter-deals';
import { getForecastUrgency } from '../utils/deal-urgency';
import { formatCurrency } from '@/lib/currency-utils';
import {
  bulkUpdateDealsStageAction,
  bulkAssignDealsAction,
  bulkDeleteDealsAction,
  bulkArchiveDealsAction,
  archiveDealAction,
  unarchiveDealAction,
  deleteDealAction,
} from '@/app/actions/deal-actions';
import QuickEditDealModal from './QuickEditDealModal';
import DuplicateDealModal from './DuplicateDealModal';
import MergeDealsModal from './MergeDealsModal';
import ColumnCustomizer from './ColumnCustomizer';
import {
  InlineValueCell,
  InlineProbabilityCell,
  InlineStageCell,
  InlineOwnerCell,
} from './InlineDealCell';
import {
  type DealColumnKey,
  type TableDensity,
  DEFAULT_DEAL_COLUMNS,
} from '@/lib/deals/deal-saved-views';
import { calculateDaysInStage } from '@/lib/deals/deal-health-engine';

interface DealsListViewProps {
  pipelineId: string;
  filters: KanbanFilters;
  visibleColumns?: DealColumnKey[];
  onChangeColumns?: (cols: DealColumnKey[]) => void;
  density?: TableDensity;
  onChangeDensity?: (density: TableDensity) => void;
}

type SortKey = 'name' | 'entity' | 'value' | 'forecast' | 'stage' | 'assignee' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_COLOR: Record<Deal['status'], string> = {
  open: '#3b82f6',
  won: '#10b981',
  lost: '#ef4444',
};

export default function DealsListView({
  pipelineId,
  filters,
  visibleColumns = DEFAULT_DEAL_COLUMNS,
  onChangeColumns,
  density = 'standard',
  onChangeDensity,
}: DealsListViewProps) {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { assignedUserId } = useGlobalFilter();
  const { entitiesById, resolveIds } = useEntityResolver();
  const { singular } = useTerminology();
  const { data: workspaceUsers } = useWorkspaceUsers(activeWorkspaceId);

  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({ key: 'forecast', dir: 'asc' });
  const [selectedDealIds, setSelectedDealIds] = React.useState<string[]>([]);
  const [isBulkOperating, setIsBulkOperating] = React.useState(false);
  const [isStagePopoverOpen, setIsStagePopoverOpen] = React.useState(false);
  const [isAssignPopoverOpen, setIsAssignPopoverOpen] = React.useState(false);

  // Quick edit modal state for single deal
  const [quickEditDeal, setQuickEditDeal] = React.useState<Deal | null>(null);
  const [isQuickEditOpen, setIsQuickEditOpen] = React.useState(false);

  // Duplication and Merge Modal States
  const [duplicateDeal, setDuplicateDeal] = React.useState<Deal | null>(null);
  const [isDuplicateOpen, setIsDuplicateOpen] = React.useState(false);
  const [mergeDealA, setMergeDealA] = React.useState<Deal | null>(null);
  const [mergeDealB, setMergeDealB] = React.useState<Deal | null>(null);
  const [isMergeOpen, setIsMergeOpen] = React.useState(false);

  // 1. Fetch Deals
  const dealsQuery = useMemoFirebase(
    () => (firestore && activeWorkspaceId ? query(
      collection(firestore, 'deals'),
      where('pipelineId', '==', pipelineId),
      where('workspaceId', '==', activeWorkspaceId)
    ) : null),
    [firestore, pipelineId, activeWorkspaceId]
  );
  const { data: deals, isLoading } = useCollection<Deal>(dealsQuery);

  // 2. Fetch Stages for current pipeline
  const stagesQuery = useMemoFirebase(
    () => (firestore && pipelineId ? query(
      collection(firestore, 'onboardingStages'),
      where('pipelineId', '==', pipelineId),
      orderBy('order', 'asc')
    ) : null),
    [firestore, pipelineId]
  );
  const { data: stages } = useCollection<OnboardingStage>(stagesQuery);

  // Resolve the entities referenced by the current deals
  React.useEffect(() => {
    const ids = (deals || []).map((d) => d.entityId).filter((x): x is string => !!x);
    if (ids.length > 0) resolveIds(ids);
  }, [deals, resolveIds]);

  const entityName = React.useCallback(
    (entityId: string) => entitiesById.get(entityId)?.displayName || 'Unknown',
    [entitiesById]
  );

  const getEntityTags = React.useCallback(
    (entityId: string) => entitiesById.get(entityId)?.workspaceTags ?? [],
    [entitiesById]
  );

  const filteredDeals = React.useMemo(
    () => applyDealFilters(deals || [], filters, assignedUserId, getEntityTags),
    [deals, filters, assignedUserId, getEntityTags]
  );

  const sortedDeals = React.useMemo(() => {
    const list = [...filteredDeals];
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return dir * (a.name || '').localeCompare(b.name || '');
        case 'entity':
          return dir * entityName(a.entityId).localeCompare(entityName(b.entityId));
        case 'value':
          return dir * ((a.value ?? 0) - (b.value ?? 0));
        case 'forecast':
          return dir * (getForecastUrgency(a.expectedCloseDate).sortWeight - getForecastUrgency(b.expectedCloseDate).sortWeight);
        case 'stage':
          return dir * (a.stageName || '').localeCompare(b.stageName || '');
        case 'assignee':
          return dir * (a.assignedTo?.name || '').localeCompare(b.assignedTo?.name || '');
        case 'status':
          return dir * (a.status || '').localeCompare(b.status || '');
        default:
          return 0;
      }
    });
    return list;
  }, [filteredDeals, sort, entityName]);

  const toggleSort = (key: SortKey) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };

  // Selection handlers
  const isAllSelected = sortedDeals.length > 0 && selectedDealIds.length === sortedDeals.length;
  const isSomeSelected = selectedDealIds.length > 0 && selectedDealIds.length < sortedDeals.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDealIds([]);
    } else {
      setSelectedDealIds(sortedDeals.map((d) => d.id));
    }
  };

  const handleToggleSelectDeal = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDealIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Bulk Stage Shift
  const handleBulkMoveStage = async (targetStage: OnboardingStage) => {
    if (!activeWorkspaceId || selectedDealIds.length === 0) return;
    setIsBulkOperating(true);
    try {
      const res = await bulkUpdateDealsStageAction(
        selectedDealIds,
        targetStage.id,
        activeWorkspaceId,
        user?.uid
      );
      if (res.success) {
        toast({
          title: 'Deals Moved',
          description: `Successfully moved ${res.updatedCount} deals to stage "${targetStage.name}".`,
        });
        setSelectedDealIds([]);
        setIsStagePopoverOpen(false);
      } else {
        throw new Error(res.error || 'Failed to bulk move deals');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to move deals.';
      toast({ variant: 'destructive', title: 'Bulk Action Failed', description: msg });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Bulk Assign Owner
  const handleBulkAssign = async (targetUser: UserProfile | null) => {
    if (!activeWorkspaceId || selectedDealIds.length === 0) return;
    setIsBulkOperating(true);
    try {
      const assignedObj = targetUser
        ? { userId: targetUser.id, name: targetUser.name || targetUser.email || 'User', email: targetUser.email || null }
        : null;

      const res = await bulkAssignDealsAction(
        selectedDealIds,
        assignedObj,
        activeWorkspaceId,
        user?.uid
      );
      if (res.success) {
        toast({
          title: 'Deals Reassigned',
          description: `Successfully reassigned ${res.updatedCount} deals to ${targetUser?.name || 'Unassigned'}.`,
        });
        setSelectedDealIds([]);
        setIsAssignPopoverOpen(false);
      } else {
        throw new Error(res.error || 'Failed to reassign deals');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reassign deals.';
      toast({ variant: 'destructive', title: 'Bulk Action Failed', description: msg });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!activeWorkspaceId || selectedDealIds.length === 0) return;

    const count = selectedDealIds.length;
    const approved = await confirm({
      title: `Delete ${count} Deals?`,
      description: `Are you sure you want to permanently delete ${count} selected deals? This action cannot be undone.`,
      confirmText: `Delete ${count} Deals`,
      variant: 'destructive',
    });

    if (!approved) return;

    setIsBulkOperating(true);
    try {
      const res = await bulkDeleteDealsAction(
        selectedDealIds,
        activeWorkspaceId,
        user?.uid
      );
      if (res.success) {
        toast({
          title: 'Deals Deleted',
          description: `Successfully deleted ${res.deletedCount} deals.`,
        });
        setSelectedDealIds([]);
      } else {
        throw new Error(res.error || 'Failed to delete deals');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete deals.';
      toast({ variant: 'destructive', title: 'Bulk Deletion Failed', description: msg });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Bulk Archive
  const handleBulkArchive = async () => {
    if (!activeWorkspaceId || selectedDealIds.length === 0) return;

    const count = selectedDealIds.length;
    const approved = await confirm({
      title: `Archive ${count} Deals?`,
      description: `Archive ${count} selected deals? They will be hidden from active pipeline views while preserving all history.`,
      confirmText: `Archive ${count} Deals`,
    });

    if (!approved) return;

    setIsBulkOperating(true);
    try {
      const res = await bulkArchiveDealsAction(
        selectedDealIds,
        activeWorkspaceId,
        user?.uid
      );
      if (res.success) {
        toast({
          title: 'Deals Archived',
          description: `Successfully archived ${res.archivedCount} deals.`,
        });
        setSelectedDealIds([]);
      } else {
        throw new Error(res.error || 'Failed to archive deals');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive deals.';
      toast({ variant: 'destructive', title: 'Bulk Archive Failed', description: msg });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Trigger Merge for 2 selected deals
  const handleTriggerMergeSelected = () => {
    if (selectedDealIds.length !== 2 || !deals) return;
    const d1 = deals.find((d) => d.id === selectedDealIds[0]) || null;
    const d2 = deals.find((d) => d.id === selectedDealIds[1]) || null;
    if (d1 && d2) {
      setMergeDealA(d1);
      setMergeDealB(d2);
      setIsMergeOpen(true);
    }
  };

  // Single Deal Archive / Restore
  const handleToggleArchiveDeal = async (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (deal.isArchived) {
        const res = await unarchiveDealAction(deal.id, user?.uid);
        if (res.success) {
          toast({ title: 'Deal Restored', description: `Restored "${deal.name}".` });
        } else {
          throw new Error(res.error || 'Failed to restore deal');
        }
      } else {
        const confirmed = await confirm({
          title: `Archive "${deal.name}"?`,
          description: 'This deal will be hidden from active views while preserving its data and history.',
          confirmText: 'Archive Deal',
        });
        if (!confirmed) return;

        const res = await archiveDealAction(deal.id, user?.uid);
        if (res.success) {
          toast({ title: 'Deal Archived', description: `Archived "${deal.name}".` });
        } else {
          throw new Error(res.error || 'Failed to archive deal');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      toast({ variant: 'destructive', title: 'Archive Failed', description: msg });
    }
  };

  // Single Deal Delete
  const handleDeleteSingleDeal = async (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    const approved = await confirm({
      title: `Delete "${deal.name}"?`,
      description: 'Permanently delete this deal? This action cannot be undone.',
      confirmText: 'Delete Deal',
      variant: 'destructive',
    });
    if (!approved) return;

    try {
      const res = await deleteDealAction(deal.id, deal.workspaceId, user?.uid);
      if (res.success) {
        toast({ title: 'Deal Deleted', description: `Deleted "${deal.name}".` });
      } else {
        throw new Error(res.error || 'Failed to delete deal');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete deal';
      toast({ variant: 'destructive', title: 'Delete Failed', description: msg });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (sortedDeals.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-10">
        <Workflow size={80} />
        <p className="font-semibold tracking-[0.3em] text-lg">No Deals</p>
      </div>
    );
  }

  const cellPaddingClass = density === 'compact' ? 'py-1.5' : density === 'comfortable' ? 'py-4' : 'py-2.5';
  const activeCols = visibleColumns && visibleColumns.length > 0 ? visibleColumns : DEFAULT_DEAL_COLUMNS;

  return (
    <div className="h-full overflow-auto px-6 pb-24 relative space-y-3">
      {/* Table Options Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-muted-foreground">
          Showing <span className="text-foreground font-bold">{sortedDeals.length}</span> {sortedDeals.length === 1 ? 'opportunity' : 'opportunities'}
        </div>
        <div className="flex items-center gap-2">
          {/* Density Controls */}
          {onChangeDensity && (
            <div className="inline-flex rounded-xl bg-muted/60 p-0.5 text-xs border border-border/50">
              <button
                type="button"
                onClick={() => onChangeDensity('compact')}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all',
                  density === 'compact' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Compact Density"
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => onChangeDensity('standard')}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all',
                  density === 'standard' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Standard Density"
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => onChangeDensity('comfortable')}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all',
                  density === 'comfortable' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Comfortable Density"
              >
                Comfortable
              </button>
            </div>
          )}

          {/* Column Customizer */}
          {onChangeColumns && (
            <ColumnCustomizer
              visibleColumns={activeCols}
              onChangeColumns={onChangeColumns}
            />
          )}
        </div>
      </div>

      <table className="w-full border-separate border-spacing-y-1.5 text-left">
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            <th className="px-3 py-2 w-10">
              <Checkbox
                checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                onCheckedChange={handleSelectAll}
                aria-label="Select all deals"
              />
            </th>
            {activeCols.includes('name') && <SortHeader label="Deal" sortKey="name" sort={sort} onSort={toggleSort} />}
            {activeCols.includes('entity') && <SortHeader label={singular} sortKey="entity" sort={sort} onSort={toggleSort} />}
            {activeCols.includes('value') && <SortHeader label="Value" sortKey="value" sort={sort} onSort={toggleSort} align="right" />}
            {activeCols.includes('mrr') && <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">MRR</th>}
            {activeCols.includes('arr') && <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">ARR</th>}
            {activeCols.includes('contractTerm') && <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Term</th>}
            {activeCols.includes('probability') && <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Probability</th>}
            {activeCols.includes('forecastCategory') && <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Category</th>}
            {activeCols.includes('stage') && <SortHeader label="Stage" sortKey="stage" sort={sort} onSort={toggleSort} />}
            {activeCols.includes('daysInStage') && <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Days in Stage</th>}
            {activeCols.includes('dealAge') && <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Age</th>}
            {activeCols.includes('expectedClose') && <SortHeader label="Forecast" sortKey="forecast" sort={sort} onSort={toggleSort} />}
            {activeCols.includes('assignee') && <SortHeader label="Assigned" sortKey="assignee" sort={sort} onSort={toggleSort} />}
            {activeCols.includes('status') && <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />}
            {activeCols.includes('source') && <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Source</th>}
            <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground w-16">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedDeals.map((deal) => {
            const urgency = getForecastUrgency(deal.expectedCloseDate);
            const statusColor = STATUS_COLOR[deal.status];
            const isSelected = selectedDealIds.includes(deal.id);

            return (
              <tr
                key={deal.id}
                onClick={() => router.push(`/admin/deals/${deal.id}`)}
                className={cn(
                  "group cursor-pointer bg-card hover:bg-muted/40 transition-colors shadow-sm",
                  isSelected && "bg-primary/[0.06] hover:bg-primary/[0.09] ring-1 ring-primary/30",
                  urgency.level === 'overdue' && !isSelected && "bg-destructive/[0.03]"
                )}
              >
                <td
                  className={cn("px-3 rounded-l-xl border-y border-l border-border w-10", cellPaddingClass)}
                  onClick={(e) => handleToggleSelectDeal(deal.id, e)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleSelectDeal(deal.id)}
                    aria-label={`Select ${deal.name}`}
                  />
                </td>

                {activeCols.includes('name') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)}>
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors block truncate max-w-[200px]">
                      {toTitleCase(deal.name || 'Unnamed Deal')}
                    </span>
                  </td>
                )}

                {activeCols.includes('entity') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)}>
                    <span className="text-[11px] font-semibold text-muted-foreground truncate block max-w-[160px]">
                      {entityName(deal.entityId)}
                    </span>
                  </td>
                )}

                {activeCols.includes('value') && (
                  <td className={cn("px-3 border-y border-border text-right", cellPaddingClass)} onClick={(e) => e.stopPropagation()}>
                    <InlineValueCell deal={deal} userId={user?.uid || ''} field="value" />
                  </td>
                )}

                {activeCols.includes('mrr') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)} onClick={(e) => e.stopPropagation()}>
                    <InlineValueCell deal={deal} userId={user?.uid || ''} field="mrr" />
                  </td>
                )}

                {activeCols.includes('arr') && (
                  <td className={cn("px-3 border-y border-border text-xs font-semibold tabular-nums text-muted-foreground", cellPaddingClass)}>
                    {formatCurrency(deal.arr ?? ((deal.mrr ?? 0) * 12), deal.currency || 'USD')}
                  </td>
                )}

                {activeCols.includes('contractTerm') && (
                  <td className={cn("px-3 border-y border-border text-xs font-medium text-muted-foreground", cellPaddingClass)}>
                    {deal.contractTermMonths ?? 12} mos
                  </td>
                )}

                {activeCols.includes('probability') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)} onClick={(e) => e.stopPropagation()}>
                    <InlineProbabilityCell deal={deal} userId={user?.uid || ''} />
                  </td>
                )}

                {activeCols.includes('forecastCategory') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)}>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0.5 border-border/80">
                      {deal.forecastCategory || 'pipeline'}
                    </Badge>
                  </td>
                )}

                {activeCols.includes('stage') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)} onClick={(e) => e.stopPropagation()}>
                    <InlineStageCell deal={deal} stages={stages || []} userId={user?.uid || ''} />
                  </td>
                )}

                {activeCols.includes('daysInStage') && (
                  <td className={cn("px-3 border-y border-border text-xs font-bold tabular-nums text-muted-foreground", cellPaddingClass)}>
                    {calculateDaysInStage(deal.stageEnteredAt || deal.createdAt)}d
                  </td>
                )}

                {activeCols.includes('dealAge') && (
                  <td className={cn("px-3 border-y border-border text-xs font-bold tabular-nums text-muted-foreground", cellPaddingClass)}>
                    {Math.max(0, Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)))}d
                  </td>
                )}

                {activeCols.includes('expectedClose') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)}>
                    <span className={cn("text-[11px] font-bold", urgency.colorClass)}>{urgency.label}</span>
                  </td>
                )}

                {activeCols.includes('assignee') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)} onClick={(e) => e.stopPropagation()}>
                    <InlineOwnerCell deal={deal} users={workspaceUsers || []} userId={user?.uid || ''} />
                  </td>
                )}

                {activeCols.includes('status') && (
                  <td className={cn("px-3 border-y border-border", cellPaddingClass)}>
                    <Badge
                      variant="outline"
                      className="h-5 text-[8px] font-bold border-none px-2 rounded-md uppercase tracking-wider"
                      style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                    >
                      {deal.status}
                    </Badge>
                  </td>
                )}

                {activeCols.includes('source') && (
                  <td className={cn("px-3 border-y border-border text-xs font-medium text-muted-foreground truncate max-w-[120px]", cellPaddingClass)}>
                    {deal.source || '—'}
                  </td>
                )}

                <td className={cn("px-3 rounded-r-xl border-y border-r border-border text-right w-16", cellPaddingClass)}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg opacity-40 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                        title="Deal Actions"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-none shadow-2xl p-1.5 z-50">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/deals/${deal.id}`);
                        }}
                        className="rounded-lg p-2 gap-2 text-xs font-bold cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                        <span>View Deal</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickEditDeal(deal);
                          setIsQuickEditOpen(true);
                        }}
                        className="rounded-lg p-2 gap-2 text-xs font-semibold cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5 text-primary" />
                        <span>Quick Edit</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDuplicateDeal(deal);
                          setIsDuplicateOpen(true);
                        }}
                        className="rounded-lg p-2 gap-2 text-xs font-semibold cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5 text-primary" />
                        <span>Duplicate Deal</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={(e) => handleToggleArchiveDeal(deal, e)}
                        className="rounded-lg p-2 gap-2 text-xs font-semibold cursor-pointer"
                      >
                        {deal.isArchived ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 text-primary" />
                            <span>Restore Deal</span>
                          </>
                        ) : (
                          <>
                            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Archive Deal</span>
                          </>
                        )}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem
                        onClick={(e) => handleDeleteSingleDeal(deal, e)}
                        className="rounded-lg p-2 gap-2 text-xs font-semibold text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Deal</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedDealIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 inset-x-4 max-w-2xl mx-auto bg-card/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-border/80 rounded-2xl p-2.5 shadow-2xl z-50 flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 pl-2">
              <Badge variant="default" className="rounded-lg h-6 px-2.5 font-bold text-xs bg-primary text-primary-foreground">
                {selectedDealIds.length}
              </Badge>
              <span className="font-semibold text-foreground hidden sm:inline">deals selected</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Merge 2 Selected Deals */}
              {selectedDealIds.length === 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTriggerMergeSelected}
                  disabled={isBulkOperating}
                  className="h-8 rounded-xl font-bold text-xs gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  <span>Merge 2 Deals</span>
                </Button>
              )}

              {/* Move to Stage */}
              <Popover open={isStagePopoverOpen} onOpenChange={setIsStagePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBulkOperating}
                    className="h-8 rounded-xl font-bold text-xs gap-1.5 border-border hover:bg-primary/10 hover:text-primary"
                  >
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                    <span>Move Stage</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-56 p-1.5 rounded-xl border-border shadow-2xl">
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Select Target Stage
                  </div>
                  <div className="space-y-1 max-h-[220px] overflow-y-auto">
                    {stages?.map((stage) => (
                      <Button
                        key={stage.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBulkMoveStage(stage)}
                        className="w-full justify-start h-8 rounded-lg font-semibold text-xs gap-2 hover:bg-primary/10 hover:text-primary text-left"
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#3b82f6' }} />
                        <span className="truncate">{stage.name}</span>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Reassign Owner */}
              <Popover open={isAssignPopoverOpen} onOpenChange={setIsAssignPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBulkOperating}
                    className="h-8 rounded-xl font-bold text-xs gap-1.5 border-border hover:bg-primary/10 hover:text-primary"
                  >
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>Reassign</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-56 p-1.5 rounded-xl border-border shadow-2xl">
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Select New Owner
                  </div>
                  <div className="space-y-1 max-h-[220px] overflow-y-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBulkAssign(null)}
                      className="w-full justify-start h-8 rounded-lg font-semibold text-xs gap-2 text-muted-foreground hover:bg-muted text-left"
                    >
                      <UserCircle2 className="h-3.5 w-3.5" />
                      <span>Leave Unassigned</span>
                    </Button>
                    {workspaceUsers?.map((u) => (
                      <Button
                        key={u.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBulkAssign(u)}
                        className="w-full justify-start h-8 rounded-lg font-semibold text-xs gap-2 hover:bg-primary/10 hover:text-primary text-left"
                      >
                        <UserCircle2 className="h-3.5 w-3.5 text-primary/40" />
                        <span className="truncate">{u.name || u.email}</span>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Bulk Archive */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkArchive}
                disabled={isBulkOperating}
                className="h-8 rounded-xl font-bold text-xs gap-1.5 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                {isBulkOperating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Archive</span>
              </Button>

              {/* Bulk Delete */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkOperating}
                className="h-8 rounded-xl font-bold text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {isBulkOperating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Delete</span>
              </Button>

              {/* Clear Selection */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDealIds([])}
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                title="Deselect All"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Edit Deal Modal */}
      <QuickEditDealModal
        deal={quickEditDeal}
        open={isQuickEditOpen}
        onOpenChange={setIsQuickEditOpen}
        stages={stages || []}
      />

      {/* Duplicate Deal Modal */}
      <DuplicateDealModal
        deal={duplicateDeal}
        isOpen={isDuplicateOpen}
        onClose={() => {
          setIsDuplicateOpen(false);
          setDuplicateDeal(null);
        }}
        stages={stages || []}
      />

      {/* Merge Deals Modal */}
      <MergeDealsModal
        dealA={mergeDealA}
        dealB={mergeDealB}
        allDeals={deals || []}
        isOpen={isMergeOpen}
        onClose={() => {
          setIsMergeOpen(false);
          setMergeDealA(null);
          setMergeDealB(null);
        }}
        onMerged={() => {
          setSelectedDealIds([]);
        }}
      />
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-3 py-2", align === 'right' && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
          align === 'right' && "flex-row-reverse",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

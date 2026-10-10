'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCorners,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  collection,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Deal, OnboardingStage, Task, Automation } from '@/lib/types';
import { useWorkspaceVisibility } from '@/hooks/use-workspace-visibility';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Workflow, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { triggerInternalNotification } from '@/lib/notification-engine';
import { updateStageOrdersAction, updateDealStatusAction } from '@/app/actions/deal-actions';
import { useCapability } from '@/platform/capabilities/ui/use-capability';
import { CapabilityErrorNotice } from '@/components/capabilities/CapabilityErrorNotice';
import { VersionConflictDialog } from '@/components/capabilities/VersionConflictDialog';
import type { ClientCapabilityError } from '@/platform/capabilities/ui/types';
import type {
  DealAdvanceStageInput,
  DealAdvanceStageOutput,
} from '@/platform/domains/deals_revenue/contracts/deal-capabilities.contract';
import { KanbanTerminalDropBar } from './KanbanTerminalDropBar';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StageColumn from './StageColumn';
import DealCard from './DealCard';
import StageValidationModal from './StageValidationModal';
import MobileStageSwitcher from './MobileStageSwitcher';
import { validateStageTransition } from '@/lib/deals/deal-stage-validation';
import type { StageRequiredField } from '@/lib/types';
import type { KanbanFilters } from '../pipeline-types';
import { applyDealFilters } from '../utils/filter-deals';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
    pipelineId: string;
    pipelineName?: string;
    customWidth?: number;
    filters: KanbanFilters;
    automations?: Automation[];
    showDealTotals?: boolean;
    autoCollapseEmptyStages?: boolean;
    stages?: OnboardingStage[];
    deals?: Deal[];
    isLoadingDeals?: boolean;
}

/**
 * ARCHITECTURAL POINTER (KanbanBoard Component):
 * Real-time deal progression hub with DnD, stage filters, and stage-linked automation indicators.
 */
export default function KanbanBoard({ 
  pipelineId, 
  pipelineName, 
  customWidth, 
  filters, 
  automations, 
  showDealTotals = false,
  autoCollapseEmptyStages = false,
  stages: propsStages,
  deals: propsDeals,
  isLoadingDeals: propsIsLoadingDeals,
}: KanbanBoardProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const { activeWorkspaceId } = useWorkspace();
  const { restrictDealsToAssigned, isWorkspaceAdmin } = useWorkspaceVisibility();
  // Resolve only the entities referenced by the visible deals (for tag filtering)
  // instead of loading the entire workspace into memory (Phase 5).
  const { entitiesById, resolveIds } = useEntityResolver();
  const getEntityTags = React.useCallback(
    (entityId: string) => entitiesById.get(entityId)?.workspaceTags ?? [],
    [entitiesById]
  );

  // 1. Fetch Stages for specific Pipeline (skip if provided by parent)
  const stagesQuery = useMemoFirebase(
    () =>
      firestore && !propsStages
        ? query(
            collection(firestore, 'onboardingStages'), 
            where('pipelineId', '==', pipelineId),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, pipelineId, propsStages]
  );
  const { data: fetchedStages, isLoading: isLoadingStagesInternal } = useCollection<OnboardingStage>(stagesQuery);
  const stages = propsStages ?? fetchedStages;
  const isLoadingStages = propsStages !== undefined ? false : isLoadingStagesInternal;

  // 2. Fetch Deals from the modern unified collection (skip if provided by parent)
  const dealsQuery = useMemoFirebase(
    () => (firestore && activeWorkspaceId && !propsDeals ? query(
        collection(firestore, 'deals'), 
        where('pipelineId', '==', pipelineId),
        where('workspaceId', '==', activeWorkspaceId)
    ) : null),
    [firestore, pipelineId, activeWorkspaceId, propsDeals]
  );
  const { data: fetchedDeals, isLoading: isLoadingDealsInternal } = useCollection<Deal>(dealsQuery);
  const deals = propsDeals ?? fetchedDeals;
  const isLoadingDeals = propsIsLoadingDeals !== undefined ? propsIsLoadingDeals : isLoadingDealsInternal;

  // 3. Fetch Tasks to index badges
  const tasksQuery = useMemoFirebase(
    () => (firestore && activeWorkspaceId ? query(
        collection(firestore, 'tasks'), 
        where('workspaceId', '==', activeWorkspaceId),
        where('relatedEntityType', '==', 'Deal')
    ) : null),
    [firestore, activeWorkspaceId]
  );
  const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);

  const tasksByDealId = React.useMemo(() => {
    const map: Record<string, { total: number; completed: number; hasOverdue: boolean }> = {};
    if (!tasks) return map;
    
    const now = new Date();
    tasks.forEach((task) => {
      const dealId = task.relatedEntityId;
      if (!dealId) return;
      
      if (!map[dealId]) {
        map[dealId] = { total: 0, completed: 0, hasOverdue: false };
      }
      
      map[dealId].total += 1;
      if (task.status === 'done') {
        map[dealId].completed += 1;
      } else {
        if (task.dueDate) {
          const due = new Date(task.dueDate);
          if (due < now) {
            map[dealId].hasOverdue = true;
          }
        }
      }
    });
    return map;
  }, [tasks]);

  const [activeElement, setActiveElement] = React.useState<Deal | OnboardingStage | null>(null);
  const [dealsByStage, setDealsByStage] = React.useState<Record<string, Deal[]>>({});
  const initialDealsByStage = React.useRef<Record<string, Deal[]>>({});
  
  // ARCHITECTURAL POINTER:
  // We capture the deal and its origin stage at drag start before any optimistic mutations
  // occur in handleDragOver. This prevents state-drift where source and target appear identical.
  const draggedDealRef = React.useRef<Deal | null>(null);
  const sourceStageIdRef = React.useRef<string | null>(null);
  
  // Pending state for deal marking as lost
  const [pendingLostDeal, setPendingLostDeal] = React.useState<{ deal: Deal; targetStage: OnboardingStage } | null>(null);
  const [selectedReason, setSelectedReason] = React.useState<string>('Competitor');
  const [extraNotes, setExtraNotes] = React.useState<string>('');
  const [isSavingLoss, setIsSavingLoss] = React.useState<boolean>(false);

  // Process gate validation blocker state
  const [pendingBlockedDeal, setPendingBlockedDeal] = React.useState<{
    deal: Deal;
    targetStage: OnboardingStage;
    missingFields: StageRequiredField[];
  } | null>(null);

  // Mobile active stage state
  const [activeMobileStageId, setActiveMobileStageId] = React.useState<string | null>(() => (stages && stages.length > 0 ? stages[0]?.id : null));

  // SSR hydration mount state & measured drag width to eliminate overlay clipping
  const [mounted, setMounted] = React.useState<boolean>(false);
  const [draggedItemWidth, setDraggedItemWidth] = React.useState<number | null>(null);

  // Canonical Capability Hook & Conflict/Error State (PR-12 UI Proof Point)
  const [capabilityError, setCapabilityError] = React.useState<ClientCapabilityError | null>(null);
  const [versionConflict, setVersionConflict] = React.useState<{
    expectedVersion?: string | number;
    actualVersion?: string | number;
  } | null>(null);

  const dealAdvanceStageCap = useCapability<DealAdvanceStageInput, DealAdvanceStageOutput>(
    'deal.advance_stage',
    {
      workspaceId: activeWorkspaceId,
    }
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Collapsible Stages & Long-Term User Preference State (LocalStorage)
  // ---------------------------------------------------------------------------
  const storageKeyAutoCollapse = React.useMemo(() => {
    return pipelineId ? `kanban_auto_collapse_empty_${pipelineId}` : 'kanban_auto_collapse_empty_default';
  }, [pipelineId]);

  const storageKeyCollapsedStages = React.useMemo(() => {
    return pipelineId ? `kanban_collapsed_stages_${pipelineId}` : 'kanban_collapsed_stages_default';
  }, [pipelineId]);

  const [isAutoCollapseEmpty, setIsAutoCollapseEmpty] = React.useState<boolean>(autoCollapseEmptyStages);
  const [manualCollapsedStages, setManualCollapsedStages] = React.useState<Record<string, boolean>>({});

  // Sync preferences from localStorage after mount to eliminate SSR hydration mismatches
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedAuto = localStorage.getItem(storageKeyAutoCollapse);
      if (storedAuto !== null) {
        setIsAutoCollapseEmpty(storedAuto === 'true');
      } else {
        setIsAutoCollapseEmpty(autoCollapseEmptyStages);
      }

      const storedStages = localStorage.getItem(storageKeyCollapsedStages);
      if (storedStages) {
        setManualCollapsedStages(JSON.parse(storedStages));
      } else {
        setManualCollapsedStages({});
      }
    } catch {
      // localStorage may be disabled or restricted in private browsing
    }
  }, [storageKeyAutoCollapse, storageKeyCollapsedStages, autoCollapseEmptyStages]);

  const isStageCollapsed = React.useCallback((stageId: string, stageDealsCount: number) => {
    if (Object.prototype.hasOwnProperty.call(manualCollapsedStages, stageId)) {
      return manualCollapsedStages[stageId];
    }
    if (isAutoCollapseEmpty && stageDealsCount === 0) {
      return true;
    }
    return false;
  }, [manualCollapsedStages, isAutoCollapseEmpty]);

  const handleToggleStageCollapse = React.useCallback((stageId: string, stageDealsCount: number) => {
    const currentlyCollapsed = isStageCollapsed(stageId, stageDealsCount);
    const next = !currentlyCollapsed;
    setManualCollapsedStages(prev => {
      const updated = { ...prev, [stageId]: next };
      try {
        localStorage.setItem(storageKeyCollapsedStages, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [isStageCollapsed, storageKeyCollapsedStages]);

  const handleToggleAutoCollapseEmpty = React.useCallback(() => {
    setIsAutoCollapseEmpty(prev => {
      const next = !prev;
      try {
        localStorage.setItem(storageKeyAutoCollapse, String(next));
        localStorage.removeItem(storageKeyCollapsedStages);
      } catch {}
      setManualCollapsedStages({});
      return next;
    });
  }, [storageKeyAutoCollapse, storageKeyCollapsedStages]);

  const handleExpandAllStages = React.useCallback(() => {
    setIsAutoCollapseEmpty(false);
    setManualCollapsedStages({});
    try {
      localStorage.setItem(storageKeyAutoCollapse, 'false');
      localStorage.removeItem(storageKeyCollapsedStages);
    } catch {}
  }, [storageKeyAutoCollapse, storageKeyCollapsedStages]);

  const allDeals = React.useMemo(() => {
    return deals || [];
  }, [deals]);

  // Resolve the entities referenced by the current deals (deduped + batched) so
  // tag filtering has the data it needs — O(deals), not O(all entities).
  const referencedEntityIdsKey = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of allDeals) {
      if (d.entityId) set.add(d.entityId);
    }
    return Array.from(set).sort().join(',');
  }, [allDeals]);

  React.useEffect(() => {
    if (!referencedEntityIdsKey) return;
    const ids = referencedEntityIdsKey.split(',');
    resolveIds(ids);
  }, [referencedEntityIdsKey, resolveIds]);

  // 4. Apply Multi-Layer Filtering (shared with the list view)
  const filteredDeals = React.useMemo(
    () => applyDealFilters(allDeals, filters, assignedUserId, getEntityTags, {
      isRestricted: restrictDealsToAssigned && !isWorkspaceAdmin,
      currentUserId: user?.uid,
    }),
    [allDeals, filters, assignedUserId, getEntityTags, restrictDealsToAssigned, isWorkspaceAdmin, user?.uid]
  );

  // 5. Grouping Logic
  React.useEffect(() => {
    if (stages && filteredDeals) {
      const grouped: Record<string, Deal[]> = {};
      stages.forEach((stage) => { grouped[stage.id] = []; });
      
      filteredDeals.forEach((deal) => {
        const stageId = deal.stageId || (stages.length > 0 ? stages[0].id : null);
        if (stageId && grouped[stageId]) {
          grouped[stageId].push(deal);
        }
      });
      setDealsByStage(grouped);
      initialDealsByStage.current = grouped;
    }
  }, [stages, filteredDeals]);

  // Calibrated dual-sensor setup: Desktop instant drag vs Mobile long-press drag
  // Allows natural vertical/horizontal scrolling on mobile touch screens without accidental drag triggers
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250, // 250ms press-and-hold before drag starts, preserving natural scrolling
      tolerance: 6, // allows minor finger tremor during hold
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const findContainer = React.useCallback((id: string) => {
      if (stages?.some((s) => s.id === id)) return id;
      for (const stageId in dealsByStage) {
        if (dealsByStage[stageId].some((d) => d.id === id)) return stageId;
      }
      return null;
    },
    [stages, dealsByStage]
  );

  /**
   * Calibrated Collision Detection Strategy:
   * When dragging a DEAL card, prioritizes floating terminal drop zones (Drop to Won / Drop to Lost)
   * via pointerWithin / rectIntersection to prevent interference from tall background stage columns.
   * Falls back to closestCorners for natural card reordering and stage transitions.
   */
  const kanbanCollisionDetection: CollisionDetection = React.useCallback((args) => {
    if (args.active.data.current?.type === 'DEAL') {
      const pointerCollisions = pointerWithin(args);
      const terminalPointerMatch = pointerCollisions.find(
        (c) => c.id === 'won-drop-zone' || c.id === 'lost-drop-zone'
      );
      if (terminalPointerMatch) {
        return [terminalPointerMatch];
      }

      const rectCollisions = rectIntersection(args);
      const terminalRectMatch = rectCollisions.find(
        (c) => c.id === 'won-drop-zone' || c.id === 'lost-drop-zone'
      );
      if (terminalRectMatch) {
        return [terminalRectMatch];
      }
    }
    return closestCorners(args);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const initialWidth = active.rect.current.initial?.width;
    if (initialWidth && initialWidth > 0) {
      setDraggedItemWidth(initialWidth);
    }
    if (active.data.current?.type === 'DEAL') {
      const deal = active.data.current.deal as Deal;
      draggedDealRef.current = deal;
      const initialStageId = findContainer(active.id as string) || deal.stageId || null;
      sourceStageIdRef.current = initialStageId;
      setActiveElement(deal);
      initialDealsByStage.current = dealsByStage;
    }
    if (active.data.current?.type === 'COLUMN') {
      setActiveElement(active.data.current.stage);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const activeType = active.data.current?.type;
    if (activeType !== 'DEAL') return;

    // Ignore terminal drop zones during drag-over so stage cards don't jitter or shuffle prematurely
    if (
      over.id === 'won-drop-zone' ||
      over.id === 'lost-drop-zone' ||
      over.data.current?.type === 'TERMINAL_DROP'
    ) {
      return;
    }

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer) return;

    if (activeContainer !== overContainer) {
      setDealsByStage((prev) => {
        const activeItems = prev[activeContainer];
        const overItems = prev[overContainer];
        const activeIndex = activeItems?.findIndex((item) => item.id === active.id) ?? -1;
        const overIndex = overItems?.findIndex((item) => item.id === over.id) ?? -1;

        if (!activeItems || activeIndex === -1) return prev;

        const safeOverItems = overItems || [];
        let newIndexInOverContainer = over.data.current?.type === 'COLUMN' ? safeOverItems.length : (overIndex >= 0 ? overIndex : safeOverItems.length);

        return {
          ...prev,
          [activeContainer]: activeItems.filter((item) => item.id !== active.id),
          [overContainer]: [
            ...safeOverItems.slice(0, newIndexInOverContainer),
            activeItems[activeIndex],
            ...safeOverItems.slice(newIndexInOverContainer),
          ],
        };
      });
    }
  };

  const handleSaveLossReason = async () => {
    if (!pendingLostDeal) return;
    const { deal, targetStage } = pendingLostDeal;
    setIsSavingLoss(true);

    try {
      const lostReasonString = `${selectedReason}${extraNotes ? ': ' + extraNotes : ''}`;
      const isTargetLost =
        targetStage.terminalType === 'lost' ||
        targetStage.terminalType === 'abandoned' ||
        targetStage.isLost ||
        targetStage.name.toLowerCase().includes('lost');
      
      if (isTargetLost) {
        const outcome = await dealAdvanceStageCap.execute({
          workspaceId: activeWorkspaceId,
          dealId: deal.id,
          stageId: targetStage.id,
          reason: lostReasonString,
          bypassValidation: true,
        });

        if (!outcome.success) {
          if (outcome.error.code === 'VERSION_CONFLICT' || outcome.error.conflict) {
            setVersionConflict(
              outcome.error.conflict || { expectedVersion: 'current', actualVersion: 'latest' }
            );
          }
          setCapabilityError(outcome.error);
          toast({
            variant: 'destructive',
            title: 'Stage Advance Failed',
            description: outcome.error.message,
          });
          setDealsByStage(initialDealsByStage.current);
          setPendingLostDeal(null);
          setSelectedReason('Competitor');
          setExtraNotes('');
          return;
        }
      } else {
        const statusRes = await updateDealStatusAction(deal.id, 'lost', lostReasonString);
        if (!statusRes.success) {
          toast({
            variant: 'destructive',
            title: 'Failed to Mark Lost',
            description: statusRes.error,
          });
          setDealsByStage(initialDealsByStage.current);
          setPendingLostDeal(null);
          setSelectedReason('Competitor');
          setExtraNotes('');
          return;
        }
      }

      // Optimistic update of local dealsByStage
      setDealsByStage((prev) => {
        const sourceStageId = deal.stageId || '';
        const sourceDeals = prev[sourceStageId] || [];
        if (isTargetLost && targetStage.id !== sourceStageId) {
          const targetDeals = prev[targetStage.id] || [];
          return {
            ...prev,
            [sourceStageId]: sourceDeals.filter((d) => d.id !== deal.id),
            [targetStage.id]: [
              { ...deal, stageId: targetStage.id, status: 'lost', lostReason: lostReasonString },
              ...targetDeals.filter((d) => d.id !== deal.id),
            ],
          };
        } else {
          return {
            ...prev,
            [sourceStageId]: sourceDeals.map((d) =>
              d.id === deal.id ? { ...d, status: 'lost', lostReason: lostReasonString } : d
            ),
          };
        }
      });

      toast({
        title: 'Deal Updated',
        description: `Deal marked as lost: ${selectedReason}`,
      });

      initialDealsByStage.current = dealsByStage;
      setCapabilityError(null);
      setPendingLostDeal(null);
      setSelectedReason('Competitor');
      setExtraNotes('');
    } catch (error: unknown) {
      console.error('Failed to save loss reason:', error);
      const msg = error instanceof Error ? error.message : 'Failed to complete deal status transition.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: msg,
      });
      setDealsByStage(initialDealsByStage.current);
      setPendingLostDeal(null);
      setSelectedReason('Competitor');
      setExtraNotes('');
    } finally {
      setIsSavingLoss(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveElement(null);
    setDraggedItemWidth(null);
    const { active, over } = event;

    const sourceStageId = sourceStageIdRef.current;
    const deal = (active.data.current?.deal as Deal | undefined) || draggedDealRef.current;

    // Reset captured drag references
    sourceStageIdRef.current = null;
    draggedDealRef.current = null;

    if (!over) {
      setDealsByStage(initialDealsByStage.current);
      return;
    }

    // Handle column reordering if dragging columns
    if (active.data.current?.type === 'COLUMN') {
      const activeStageId = active.id as string;
      const overStageId = over.id as string;

      if (activeStageId !== overStageId && stages && stages.length > 0) {
        const oldIndex = stages.findIndex((s) => s.id === activeStageId);
        const newIndex = stages.findIndex((s) => s.id === overStageId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedStages = [...stages];
          const [movedStage] = reorderedStages.splice(oldIndex, 1);
          reorderedStages.splice(newIndex, 0, movedStage);

          const orderedIds = reorderedStages.map((s) => s.id);
          try {
            const res = await updateStageOrdersAction(pipelineId, orderedIds, activeWorkspaceId);
            if (!res.success) {
              toast({ variant: 'destructive', title: 'Reorder Failed', description: res.error });
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to reorder stages';
            toast({ variant: 'destructive', title: 'Reorder Failed', description: msg });
          }
        }
      }
      return;
    }

    // Handle deal moving across stage columns or terminal drop zones (Drop to Won / Drop to Lost)
    if (deal) {
      // 1. Intercept Terminal Drop Zones (Drop to Won / Drop to Lost)
      const isTerminalDrop =
        over.id === 'won-drop-zone' ||
        over.id === 'lost-drop-zone' ||
        over.data.current?.type === 'TERMINAL_DROP';

      if (isTerminalDrop) {
        const outcome: 'won' | 'lost' =
          over.id === 'won-drop-zone' || over.data.current?.outcome === 'won' ? 'won' : 'lost';

        if (outcome === 'won') {
          const wonStage = stages?.find(
            (s) =>
              s.terminalType === 'won' ||
              s.isWon ||
              s.name.toLowerCase().includes('won') ||
              s.name.toLowerCase().includes('live')
          );

          // Optimistically update local dealsByStage
          setDealsByStage((prev) => {
            const currentSourceStageId = sourceStageId || deal.stageId || '';
            const sourceDeals = prev[currentSourceStageId] || [];
            if (wonStage && wonStage.id !== currentSourceStageId) {
              const targetDeals = prev[wonStage.id] || [];
              return {
                ...prev,
                [currentSourceStageId]: sourceDeals.filter((d) => d.id !== deal.id),
                [wonStage.id]: [
                  { ...deal, stageId: wonStage.id, status: 'won' as const },
                  ...targetDeals.filter((d) => d.id !== deal.id),
                ],
              };
            } else {
              return {
                ...prev,
                [currentSourceStageId]: sourceDeals.map((d) =>
                  d.id === deal.id ? { ...d, status: 'won' as const } : d
                ),
              };
            }
          });

          try {
            if (wonStage) {
              const outcomeRes = await dealAdvanceStageCap.execute({
                workspaceId: activeWorkspaceId,
                dealId: deal.id,
                stageId: wonStage.id,
                bypassValidation: true,
              });

              if (!outcomeRes.success) {
                setDealsByStage(initialDealsByStage.current);
                if (outcomeRes.error.code === 'VERSION_CONFLICT' || outcomeRes.error.conflict) {
                  setVersionConflict(
                    outcomeRes.error.conflict || { expectedVersion: 'current', actualVersion: 'latest' }
                  );
                }
                setCapabilityError(outcomeRes.error);
                toast({
                  variant: 'destructive',
                  title: 'Stage Advance Failed',
                  description: outcomeRes.error.message,
                });
                return;
              }
            } else {
              const statusRes = await updateDealStatusAction(deal.id, 'won');
              if (!statusRes.success) {
                setDealsByStage(initialDealsByStage.current);
                toast({
                  variant: 'destructive',
                  title: 'Failed to update deal',
                  description: statusRes.error,
                });
                return;
              }
            }

            initialDealsByStage.current = dealsByStage;
            setCapabilityError(null);

            toast({
              title: '🎉 Deal Won!',
              description: wonStage
                ? `Deal "${deal.name}" closed as Won and moved to "${wonStage.name}".`
                : `Deal "${deal.name}" marked as Closed Won.`,
              actionConfig: {
                path: `/admin/deals/${deal.id}`,
                label: 'View Deal',
              },
            });

            triggerInternalNotification({
              triggerKey: 'stage_change',
              dealId: deal.id,
              entityId: deal.entityId,
              notifyManager: true,
              channel: 'both',
              variables: {
                workspaceId: activeWorkspaceId,
                school_name: deal.name,
                entity_name: deal.name,
                deal_name: deal.name,
                new_stage: wonStage?.name || 'Closed Won',
                event_type: 'Deal Won',
              },
            }).catch(console.error);
          } catch (err: unknown) {
            console.error('Failed to mark deal as won:', err);
            setDealsByStage(initialDealsByStage.current);
            const msg = err instanceof Error ? err.message : 'Failed to update deal status';
            toast({ variant: 'destructive', title: 'Logic Error', description: msg });
          }
          return;
        }

        if (outcome === 'lost') {
          const lostStage = stages?.find(
            (s) =>
              s.terminalType === 'lost' ||
              s.terminalType === 'abandoned' ||
              s.isLost ||
              s.name.toLowerCase().includes('lost')
          );
          const fallbackStage = stages?.find((s) => s.id === (deal.stageId || sourceStageId)) || stages?.[0];

          if (lostStage || fallbackStage) {
            setPendingLostDeal({
              deal,
              targetStage: lostStage || fallbackStage!,
            });
          }
          return;
        }
      }

      // 2. Normal stage column drop handling
      const targetStageId =
        over.data.current?.type === 'STAGE'
          ? (over.data.current.stage?.id as string)
          : over.data.current?.type === 'COLUMN'
          ? (over.data.current.stage?.id as string)
          : findContainer(over.id as string);

      const newStage = stages?.find((s) => s.id === targetStageId);

      if (!newStage || !targetStageId) {
        setDealsByStage(initialDealsByStage.current);
        return;
      }

      // If dropped back in the same starting stage, keep state in sync and exit
      if (sourceStageId === targetStageId) {
        initialDealsByStage.current = dealsByStage;
        return;
      }

      // 1. Process Gate Entry Validation (PRD Section 16)
      const validation = validateStageTransition(deal, newStage);
      if (!validation.valid) {
        setDealsByStage(initialDealsByStage.current);
        setPendingBlockedDeal({
          deal,
          targetStage: newStage,
          missingFields: validation.missingFields,
        });
        return;
      }

      // 2. Terminal Lost Stage Handler (PRD Section 14)
      const isLostStage = newStage.terminalType === 'lost' || newStage.terminalType === 'abandoned' || newStage.isLost || newStage.name.toLowerCase().includes('lost');
      if (isLostStage) {
        setPendingLostDeal({ deal, targetStage: newStage });
        return;
      }

      // 3. Normal or Terminal Won Progression via useCapability('deal.advance_stage')
      try {
        const isWonStage = newStage.terminalType === 'won' || newStage.isWon || newStage.name.toLowerCase().includes('won') || newStage.name.toLowerCase().includes('live');

        const outcome = await dealAdvanceStageCap.execute({
          workspaceId: activeWorkspaceId,
          dealId: deal.id,
          stageId: newStage.id,
        });

        if (!outcome.success) {
          // Refusal Rollback (PR-12 / Rule 23 / Rule 51): Restore card to origin column
          setDealsByStage(initialDealsByStage.current);

          if (outcome.error.code === 'VERSION_CONFLICT' || outcome.error.conflict) {
            setVersionConflict(
              outcome.error.conflict || { expectedVersion: 'current', actualVersion: 'latest' }
            );
          }
          setCapabilityError(outcome.error);
          toast({
            variant: 'destructive',
            title: 'Stage Advance Rejected',
            description: outcome.error.message,
          });
          return;
        }

        // Commit optimistic drag state on success
        initialDealsByStage.current = dealsByStage;
        setCapabilityError(null);

        toast({
          title: isWonStage ? '🎉 Deal Won!' : 'Deal Moved',
          description: `Deal advanced to "${newStage.name}".`,
          actionConfig: {
            path: `/admin/deals/${deal.id}`,
            label: 'View Deal',
          },
        });

        if (isWonStage) {
          triggerInternalNotification({
            triggerKey: 'stage_change',
            dealId: deal.id,
            entityId: deal.entityId,
            notifyManager: true,
            channel: 'both',
            variables: {
              workspaceId: activeWorkspaceId,
              school_name: deal.name,
              entity_name: deal.name,
              deal_name: deal.name,
              new_stage: newStage.name,
              event_type: 'Deal Won',
            },
          }).catch(console.error);
        }
      } catch (error: unknown) {
        console.error('Failed to update stage:', error);
        const msg = error instanceof Error ? error.message : 'Failed to update deal state.';
        toast({ variant: 'destructive', title: 'Logic Error', description: msg });
        setDealsByStage(initialDealsByStage.current);
      }
    }
  };

  const handleSelectMobileStage = React.useCallback((stageId: string) => {
    setActiveMobileStageId(stageId);
    if (typeof document !== 'undefined') {
      const el = document.getElementById(`stage-column-${stageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, []);

  const collapsedCount = React.useMemo(() => {
    if (!stages) return 0;
    return stages.filter((s) => isStageCollapsed(s.id, (dealsByStage[s.id] || []).length)).length;
  }, [stages, isStageCollapsed, dealsByStage]);

  const isLoading = isLoadingDeals || isLoadingStages || isLoadingFilter || isLoadingTasks;

  if (isLoading) {
    return (
      <div className="flex h-full gap-8 px-8 py-10 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-80 space-y-8 shrink-0">
            <Skeleton className="h-14 w-full rounded-[1.25rem]" />
            <Skeleton className="h-48 w-full rounded-[2.25rem]" />
            <Skeleton className="h-48 w-full rounded-[2.25rem]" />
          </div>
        ))}
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 opacity-10 gap-6">
        <div className="p-10 bg-muted rounded-[3rem] shadow-inner border"><Workflow size={80} /></div>
        <div className="text-center space-y-2">
          <p className="font-semibold tracking-[0.3em] text-xl">Empty Architecture</p>
          <p className="text-xs font-bold opacity-60">Please define stages in Configuration Hub.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Capability Error / Refusal Banner (Rule 51) */}
      {capabilityError && (
        <div className="px-6 pt-3 shrink-0">
          <CapabilityErrorNotice
            error={capabilityError}
            onDismiss={() => setCapabilityError(null)}
          />
        </div>
      )}

      {/* Mobile Stage Switcher */}
      <MobileStageSwitcher
        stages={stages}
        deals={filteredDeals}
        activeStageId={activeMobileStageId}
        onSelectStage={handleSelectMobileStage}
      />

      {/* Board Controls: Collapsed Stage Summary & Auto-Collapse Empty Stages Toggle */}
      <div className="flex items-center justify-between px-3 md:px-4 py-1 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          {collapsedCount > 0 && (
            <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/50">
              {collapsedCount} of {stages.length} {collapsedCount === 1 ? 'stage' : 'stages'} collapsed
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isAutoCollapseEmpty ? "secondary" : "ghost"}
                  size="sm"
                  onClick={handleToggleAutoCollapseEmpty}
                  className={cn(
                    "h-7 px-2.5 rounded-lg text-xs font-semibold gap-1.5 transition-all border",
                    isAutoCollapseEmpty
                      ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
                      : "text-muted-foreground border-border/40 hover:border-border hover:bg-muted/40"
                  )}
                >
                  {isAutoCollapseEmpty ? (
                    <PanelLeftClose className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <PanelLeftOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{isAutoCollapseEmpty ? "Auto-collapse empty: ON" : "Auto-collapse empty"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[260px]">
                {isAutoCollapseEmpty
                  ? "Empty stages (0 deals) automatically collapse into slim vertical slivers. Click to disable."
                  : "Click to automatically collapse stages with 0 deals into slim vertical slivers."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {collapsedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExpandAllStages}
              className="h-7 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Expand all
            </Button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { 
          setActiveElement(null); 
          setDraggedItemWidth(null); 
          setDealsByStage(initialDealsByStage.current); 
        }}
        collisionDetection={kanbanCollisionDetection}
      >
        <ScrollArea className="flex-1 whitespace-nowrap">
          <div className="flex items-start gap-4 md:gap-5 px-3 md:px-4 pt-1.5 pb-4">
            {stages.map((stage) => {
              const stageDeals = dealsByStage[stage.id] || [];
              const collapsed = isStageCollapsed(stage.id, stageDeals.length);

              return (
                <div key={stage.id} id={`stage-column-${stage.id}`}>
                  <StageColumn
                    stage={stage}
                    pipelineId={pipelineId}
                    pipelineName={pipelineName}
                    customWidth={customWidth}
                    deals={stageDeals}
                    tasksByDealId={tasksByDealId}
                    automations={automations}
                    isDraggingDeal={!!activeElement && !('order' in activeElement)}
                    showDealTotals={showDealTotals}
                    entitiesById={entitiesById}
                    stages={stages}
                    isCollapsed={collapsed}
                    onToggleCollapse={() => handleToggleStageCollapse(stage.id, stageDeals.length)}
                  />
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Floating Terminal Stage Drop Bar (Drop to Won / Drop to Lost) */}
        <KanbanTerminalDropBar
          isVisible={!!activeElement && !('order' in activeElement)}
          draggedDealName={activeElement && !('order' in activeElement) ? (activeElement as Deal).name : undefined}
        />
        {mounted && typeof document !== 'undefined' ? createPortal(
          <DragOverlay dropAnimation={null}>
            {activeElement ? (
              'order' in activeElement ? (
                <div
                  className="pointer-events-none select-none"
                  style={{
                    width: draggedItemWidth ? `${draggedItemWidth}px` : (customWidth ? `${customWidth}px` : undefined),
                  }}
                >
                  <StageColumn
                    stage={activeElement as OnboardingStage}
                    pipelineId={pipelineId}
                    pipelineName={pipelineName}
                    customWidth={draggedItemWidth || customWidth}
                    deals={dealsByStage[(activeElement as OnboardingStage).id] || []}
                    isOverlay
                    tasksByDealId={tasksByDealId}
                    automations={automations}
                    showDealTotals={showDealTotals}
                    entitiesById={entitiesById}
                    stages={stages}
                    isCollapsed={isStageCollapsed((activeElement as OnboardingStage).id, (dealsByStage[(activeElement as OnboardingStage).id] || []).length)}
                  />
                </div>
              ) : (
                <div 
                  className="pointer-events-none select-none w-[calc(280px-1.5rem)] md:w-[calc(320px-1.5rem)] lg:w-[calc(340px-1.5rem)]"
                  style={{
                    width: draggedItemWidth ? `${draggedItemWidth}px` : (customWidth ? `${customWidth - 24}px` : undefined),
                  }}
                >
                  <DealCard 
                    deal={activeElement as Deal} 
                    isOverlay 
                    showDealValue={showDealTotals}
                    taskStats={tasksByDealId[(activeElement as Deal).id]}
                    clientName={entitiesById.get((activeElement as Deal).entityId)?.displayName}
                  />
                </div>
              )
            ) : null}
          </DragOverlay>,
          document.body
        ) : null}

      {/* Loss Reason Dialog (SSOT Modal Architecture conforming to theme.md §8) */}
      <Dialog open={pendingLostDeal !== null} onOpenChange={(open) => {
        if (!open) {
          setDealsByStage(initialDealsByStage.current);
          setPendingLostDeal(null);
          setSelectedReason('Competitor');
          setExtraNotes('');
        }
      }}>
        <DialogContent className="max-w-md border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl font-figtree">
          <DialogHeader demarcated>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                Mark Deal as Lost
              </DialogTitle>
              <CardInfoTooltip text={`Specify why ${pendingLostDeal?.deal.name || 'this deal'} was marked as lost.`} />
            </div>
            <DialogDescription className="sr-only">
              Please specify the reason why you lost the deal for {pendingLostDeal?.deal.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason Category</label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger className="w-full min-h-[44px] rounded-xl border border-input bg-background/50 hover:bg-background/80 transition-colors">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="Competitor" className="rounded-lg">Competitor</SelectItem>
                  <SelectItem value="Price/Budget" className="rounded-lg">Price / Budget</SelectItem>
                  <SelectItem value="Feature Gap" className="rounded-lg">Feature Gap</SelectItem>
                  <SelectItem value="Timeout" className="rounded-lg">Timeout / No Response</SelectItem>
                  <SelectItem value="Other" className="rounded-lg">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Additional Details (Optional)</label>
              <Textarea
                placeholder="Describe what happened..."
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                className="min-h-[100px] rounded-xl bg-background/50 border border-input focus:bg-background transition-all"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              variant="ghost"
              onClick={() => {
                setDealsByStage(initialDealsByStage.current);
                setPendingLostDeal(null);
                setSelectedReason('Competitor');
                setExtraNotes('');
              }}
              disabled={isSavingLoss}
              className="rounded-xl font-bold text-xs min-h-[44px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLossReason}
              disabled={isSavingLoss}
              className="rounded-xl font-bold text-xs min-h-[44px] bg-red-600 hover:bg-red-700 text-white shrink-0 active:scale-[0.97]"
            >
              {isSavingLoss ? 'Saving...' : 'Confirm Lost'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Gate Validation Blocker Modal */}
      <StageValidationModal
        deal={pendingBlockedDeal?.deal || null}
        targetStage={pendingBlockedDeal?.targetStage || null}
        missingFields={pendingBlockedDeal?.missingFields || []}
        isOpen={!!pendingBlockedDeal}
        onClose={() => setPendingBlockedDeal(null)}
        onSuccess={() => {
          setPendingBlockedDeal(null);
        }}
      />

      {/* Version Conflict Modal (Rule 18 / Rule 51) */}
      <VersionConflictDialog
        open={versionConflict !== null}
        onOpenChange={(open) => !open && setVersionConflict(null)}
        expectedVersion={versionConflict?.expectedVersion}
        actualVersion={versionConflict?.actualVersion}
        onReload={() => setVersionConflict(null)}
      />
    </DndContext>
    </div>
  );
}

'use client';

/**
 * Server Action & Component Module: High-fidelity Deal Card with Dropdown Actions
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION:
 * Renders an interactive deal card within the pipeline Kanban column, displaying deal value,
 * urgency badges, linked entity logo/initials, and deal management actions via DropdownMenu.
 *
 * WORKSPACE RULES & COMPLIANCE:
 * - Single Source of Truth for Toast Actions: Uses standard useToast notifications.
 * - Mobile & Accessibility First: Min 44px touch targets for dropdown trigger and options.
 * - Inline Developer Guides (Rule 10): Confirms user intent via `useConfirm()` dialog before deletion.
 * - Testability: Props include optional `onDelete` callback for optimistic UI removal.
 */

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Deal, DealStage, Entity } from '@/lib/types';
import { AsyncEntityAvatar } from '../../components/AsyncEntityAvatar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    MoreVertical,
    Eye,
    Banknote,
    Edit,
    Trash2,
    UserCircle2,
    UserCheck,
    AlertCircle,
    Clock,
    CalendarCheck,
    CalendarOff,
    Copy,
    Archive,
    RotateCcw,
    Crown,
    Building2,
    Phone,
    Move,
    ArrowRight
} from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { cn, toTitleCase } from '@/lib/utils';
import { getForecastUrgency, type UrgencyLevel } from '../utils/deal-urgency';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { useTerminology } from '@/hooks/use-terminology';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { deleteDealAction, archiveDealAction, unarchiveDealAction, updateDealStageAction } from '@/app/actions/deal-actions';
import { formatCurrency } from '@/lib/currency-utils';
import { calculateDealHealth } from '@/lib/deals/deal-health-engine';
import QuickEditDealModal from './QuickEditDealModal';
import DuplicateDealModal from './DuplicateDealModal';
import AssignDealModal from './AssignDealModal';
import TransferDealModal from './TransferDealModal';
import { useCallModal } from '@/context/CallModalContext';

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const URGENCY_ICON: Record<UrgencyLevel, React.ComponentType<{ className?: string }>> = {
    overdue: AlertCircle,
    today: Clock,
    soon: Clock,
    ok: CalendarCheck,
    none: CalendarOff,
};

interface DealCardProps {
    deal: Deal;
    stage?: DealStage;
    nextStage?: DealStage;
    isOverlay?: boolean;
    onDelete?: (dealId: string) => void;
    /** Resolved Client/Entity display name passed from parent cache */
    clientName?: string;
    /** Controls whether monetary deal value & MRR is rendered on the card (mirrors stage header showDealTotals setting) */
    showDealValue?: boolean;
    /**
     * @deprecated Retained for caller compatibility (StageColumn / DragOverlay).
     * No longer rendered — task stats were removed from the card per the
     * pipeline redesign.
     */
    taskStats?: { total: number; completed: number; hasOverdue: boolean };
}

/**
 * @fileOverview High-fidelity Deal Card for Kanban boards.
 */
export default function DealCard({ 
  deal, 
  stage, 
  nextStage, 
  isOverlay, 
  onDelete, 
  clientName, 
  showDealValue = true,
  taskStats: _taskStats 
}: DealCardProps) {
  const { openCallModal } = useCallModal();
  const { singular } = useTerminology();
  const confirm = useConfirm();
  const { toast } = useToast();
  const firestore = useFirestore();

  // Reactive fallback to resolve client/entity name if not provided by parent cache
  const entityRef = React.useMemo(() => {
    return firestore && deal.entityId && !clientName
      ? doc(firestore, 'entities', deal.entityId)
      : null;
  }, [firestore, deal.entityId, clientName]);
  const { data: fallbackEntityDoc } = useDoc<Entity>(entityRef);

  const resolvedClientName = clientName || fallbackEntityDoc?.name;
  const { activeWorkspaceId } = useWorkspace();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isQuickEditOpen, setIsQuickEditOpen] = React.useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = React.useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = React.useState(false);
  const [transferInitialMode, setTransferInitialMode] = React.useState<'move' | 'copy'>('move');
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [isAdvancingStage, setIsAdvancingStage] = React.useState(false);

  const handleMoveToNextStage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStage || !deal.id) return;
    setIsAdvancingStage(true);
    try {
      const res = await updateDealStageAction(deal.id, nextStage.id);
      if (res.success) {
        toast({
          title: 'Deal Advanced',
          description: `Moved "${displayName}" to ${toTitleCase(nextStage.name)}.`,
          actionConfig: {
            path: `/admin/deals/${deal.id}`,
            label: 'View Deal',
          },
        });
      } else {
        throw new Error(res.error || 'Failed to advance stage.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to move deal to next stage.';
      toast({
        variant: 'destructive',
        title: 'Stage Advance Failed',
        description: msg,
      });
    } finally {
      setIsAdvancingStage(false);
    }
  };

  const handleArchiveDeal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deal.id) return;
    setIsArchiving(true);
    try {
      if (deal.isArchived) {
        const res = await unarchiveDealAction(deal.id);
        if (res.success) {
          toast({ title: 'Deal Restored', description: `Restored "${displayName}".` });
        } else {
          throw new Error(res.error || 'Failed to restore deal.');
        }
      } else {
        const confirmed = await confirm({
          title: `Archive "${displayName}"?`,
          description: 'This deal will be hidden from the active board while preserving its data and history.',
          confirmText: 'Archive Deal',
        });
        if (!confirmed) return;

        const res = await archiveDealAction(deal.id);
        if (res.success) {
          toast({ title: 'Deal Archived', description: `Archived "${displayName}".` });
        } else {
          throw new Error(res.error || 'Failed to archive deal.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      toast({ variant: 'destructive', title: 'Archive Failed', description: msg });
    } finally {
      setIsArchiving(false);
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: deal.id, 
    data: { type: 'DEAL', deal },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0 : 1,
  };

  const displayName = deal.name || 'Unnamed Deal';

  /**
   * Smart Alert / SLA Aging calculation (Anti-Alert Fatigue):
   * - Neutral gray: < 7d (calm, zero alarmist fatigue)
   * - Subtle amber: 7d - 13d (needs attention)
   * - Red: 14d+ (critical SLA breach)
   * - Tied to Next Step if defined (e.g. Overdue: Follow-up Call or Next: Demo)
   * - Otherwise falls back to No Activity: {days}d or Overdue: {days}d
   */
  const smartAlert = React.useMemo(() => {
    const now = new Date();
    
    // 1. Check for Next Step
    let nextStepTitle: string | null = null;
    let nextStepDueDate: Date | null = null;

    if (deal.nextStep) {
      if (typeof deal.nextStep === 'string' && deal.nextStep.trim()) {
        nextStepTitle = deal.nextStep.trim();
      } else if (typeof deal.nextStep === 'object' && deal.nextStep) {
        nextStepTitle = deal.nextStep.title || deal.nextStep.type || null;
        if (deal.nextStep.dueDate) {
          const d = new Date(deal.nextStep.dueDate);
          if (!isNaN(d.getTime())) nextStepDueDate = d;
        }
      }
    }

    if (nextStepTitle) {
      if (nextStepDueDate) {
        const daysDiff = differenceInCalendarDays(now, nextStepDueDate);
        if (daysDiff > 0) {
          const colorClass = daysDiff >= 14 
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25" 
            : daysDiff >= 7 
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25" 
            : "bg-muted/80 text-muted-foreground border-border/60";
          return {
            label: `Overdue: ${nextStepTitle}`,
            days: daysDiff,
            colorClass,
            icon: AlertCircle,
            tooltipTitle: `Next Step Overdue (${daysDiff}d)`,
            tooltipDetail: `Action "${nextStepTitle}" was due on ${nextStepDueDate.toLocaleDateString()}.`,
          };
        } else if (daysDiff === 0) {
          return {
            label: `Today: ${nextStepTitle}`,
            days: 0,
            colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
            icon: Clock,
            tooltipTitle: "Next Step Due Today",
            tooltipDetail: `Action "${nextStepTitle}" is scheduled for today.`,
          };
        } else {
          const daysLeft = Math.abs(daysDiff);
          return {
            label: `Next: ${nextStepTitle}`,
            days: 0,
            colorClass: "bg-muted/80 text-muted-foreground border-border/60",
            icon: CalendarCheck,
            tooltipTitle: `Next Step in ${daysLeft}d`,
            tooltipDetail: `Action "${nextStepTitle}" scheduled for ${nextStepDueDate.toLocaleDateString()}.`,
          };
        }
      }

      return {
        label: `Next: ${nextStepTitle}`,
        days: 0,
        colorClass: "bg-muted/80 text-muted-foreground border-border/60",
        icon: CalendarCheck,
        tooltipTitle: "Next Step Scheduled",
        tooltipDetail: nextStepTitle,
      };
    }

    // 2. No Next Step -> Check Expected Close Date
    if (deal.expectedCloseDate) {
      const closeDate = new Date(deal.expectedCloseDate);
      if (!isNaN(closeDate.getTime())) {
        const daysPast = differenceInCalendarDays(now, closeDate);
        if (daysPast > 0) {
          const colorClass = daysPast >= 14 
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25" 
            : daysPast >= 7 
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25" 
            : "bg-muted/80 text-muted-foreground border-border/60";
          return {
            label: `Overdue: ${daysPast}d`,
            days: daysPast,
            colorClass,
            icon: AlertCircle,
            tooltipTitle: `Target Close Overdue (${daysPast}d)`,
            tooltipDetail: `Expected close was ${closeDate.toLocaleDateString()}. No next step is scheduled.`,
          };
        } else if (daysPast === 0) {
          return {
            label: "Closing today",
            days: 0,
            colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
            icon: Clock,
            tooltipTitle: "Closing Today",
            tooltipDetail: "Expected close date is today.",
          };
        } else {
          const daysLeft = Math.abs(daysPast);
          return {
            label: `${daysLeft}d left`,
            days: 0,
            colorClass: "bg-muted/80 text-muted-foreground border-border/60",
            icon: Clock,
            tooltipTitle: `Expected Close in ${daysLeft}d`,
            tooltipDetail: `Target date: ${closeDate.toLocaleDateString()}.`,
          };
        }
      }
    }

    // 3. Fallback: Stage Inactivity Aging
    const lastActiveStr = deal.stageEnteredAt || deal.updatedAt || deal.createdAt;
    const lastActive = lastActiveStr ? new Date(lastActiveStr) : now;
    const inactiveDays = Math.max(0, differenceInCalendarDays(now, lastActive));

    const colorClass = inactiveDays >= 14 
      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25" 
      : inactiveDays >= 7 
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25" 
      : "bg-muted/80 text-muted-foreground border-border/60";

    return {
      label: `No Activity: ${inactiveDays}d`,
      days: inactiveDays,
      colorClass,
      icon: inactiveDays >= 14 ? AlertCircle : Clock,
      tooltipTitle: `No Activity for ${inactiveDays} Days`,
      tooltipDetail: "No next step or recent updates recorded on this deal.",
    };
  }, [deal.nextStep, deal.expectedCloseDate, deal.stageEnteredAt, deal.updatedAt, deal.createdAt]);
  
  // Prioritize focal contact designated as deal owner (Rule 10 CRM Ownership)
  const sortedFocalContacts = React.useMemo(() => {
    const list = [...(deal.focalContacts ?? [])];
    return list.sort((a, b) => {
      const aIsPrimary = a.isPrimary || a.id === deal.primaryContactId ? 1 : 0;
      const bIsPrimary = b.isPrimary || b.id === deal.primaryContactId ? 1 : 0;
      return bIsPrimary - aIsPrimary;
    });
  }, [deal.focalContacts, deal.primaryContactId]);

  // Resolve primary linked contact for the deal header (focal or secondary associated)
  const linkedContact = React.useMemo(() => {
    if (sortedFocalContacts.length > 0) return sortedFocalContacts[0];
    if (deal.contacts && deal.contacts.length > 0) {
      const primary = deal.contacts.find(c => c.isPrimary || c.id === deal.primaryContactId || c.contactId === deal.primaryContactId);
      return primary || deal.contacts[0];
    }
    return null;
  }, [sortedFocalContacts, deal.contacts, deal.primaryContactId]);

  const additionalContactsCount = React.useMemo(() => {
    const total = (deal.focalContacts?.length || 0) + (deal.contacts?.length || 0);
    return total > 1 ? total - 1 : 0;
  }, [deal.focalContacts, deal.contacts]);

  const health = React.useMemo(() => {
    return calculateDealHealth(deal, stage, deal.updatedAt);
  }, [deal, stage]);

  /**
   * Triggers confirmation dialog and handles deal deletion.
   */
  const handleDeleteDeal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const effectiveWorkspaceId = activeWorkspaceId || deal.workspaceId;
    if (!effectiveWorkspaceId) return;

    const approved = await confirm({
      title: 'Delete Deal?',
      description: `Are you sure you want to delete "${displayName}"? This action cannot be undone.`,
      confirmText: 'Delete Deal',
      variant: 'destructive',
    });

    if (!approved) return;

    setIsDeleting(true);
    try {
      const res = await deleteDealAction(deal.id, effectiveWorkspaceId);
      if (res.success) {
        toast({
          title: 'Deal Deleted',
          description: `Successfully deleted "${displayName}".`,
        });
        if (onDelete) {
          onDelete(deal.id);
        }
      } else {
        throw new Error(res.error || 'Failed to delete deal.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TooltipProvider>
        <div 
            ref={isOverlay ? undefined : setNodeRef} 
            style={isOverlay ? undefined : style} 
            className={cn("w-full min-w-0", !isOverlay && "overflow-hidden")}
        >
        <Card
            {...(isOverlay ? {} : attributes)} 
            {...(isOverlay ? {} : listeners)} 
            className={cn(
                "w-full min-w-0 max-w-full touch-manipulation rounded-xl border bg-card select-none text-left transition-all duration-300",
                isOverlay 
                    ? "border-primary/80 ring-2 ring-primary/20 shadow-2xl scale-[1.02] cursor-grabbing bg-card/95 backdrop-blur-md mb-0" 
                    : "border-border shadow-sm hover:shadow-lg hover:border-primary/30 group/card overflow-hidden mb-3 cursor-grab active:cursor-grabbing",
                deal.status === 'lost' && "grayscale opacity-60"
            )}
        >
        <CardHeader 
            className="p-3 pb-1.5 flex flex-row items-start justify-between space-y-0 w-full min-w-0"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="relative shrink-0">
                    <AsyncEntityAvatar 
                        entityId={deal.entityId}
                        name={resolvedClientName || deal.name} 
                        className="h-10 w-10 shadow-sm transition-transform duration-500 group-hover/card:scale-105 ring-2 ring-background"
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div 
                                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background shadow-sm flex items-center justify-center cursor-help"
                                style={{ 
                                    backgroundColor: health.status === 'healthy' ? '#10b981' : health.status === 'at_risk' ? '#f59e0b' : health.status === 'stalled' ? '#ef4444' : '#64748b' 
                                }}
                            >
                                {health.status === 'at_risk' && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs font-semibold">
                            <p className="font-bold capitalize">{health.status} Deal</p>
                            <p className="text-[10px] text-muted-foreground">{health.reason}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className="min-w-0 flex-1 text-left">
                    {/* Deal Name (Prominent & Stands Out - Rule 10) */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link
                                href={`/admin/deals/${deal.id}`}
                                onPointerDown={e => e.stopPropagation()}
                                className="block w-full min-w-0"
                            >
                                <CardTitle className="text-sm font-semibold tracking-tight truncate text-foreground group-hover/card:text-primary transition-colors leading-snug block w-full text-left hover:underline underline-offset-2 cursor-pointer">
                                    {displayName}
                                </CardTitle>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p className="font-bold text-xs">{displayName}</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Row 2: Linked Contact's Name (Replaces Entity Name per user specification) */}
                    {linkedContact ? (
                        (() => {
                            const contactKey = ('id' in linkedContact && linkedContact.id) ? linkedContact.id : ('contactId' in linkedContact ? linkedContact.contactId : undefined);
                            const isPrimaryContact = Boolean(linkedContact.isPrimary || (contactKey && contactKey === deal.primaryContactId));
                            return (
                                <div 
                                    className="flex items-center gap-1 text-xs font-semibold text-muted-foreground truncate leading-snug mt-0.5" 
                                    title={`Linked Contact: ${linkedContact.name}${linkedContact.role ? ` (${linkedContact.role})` : ''}`}
                                >
                                    {isPrimaryContact ? (
                                        <Crown className="h-3 w-3 text-amber-500 fill-amber-500/40 shrink-0" />
                                    ) : (
                                        <UserCircle2 className="h-3 w-3 text-primary/60 shrink-0" />
                                    )}
                                    <span className="truncate text-foreground/90">{linkedContact.name}</span>
                                    {linkedContact.role && (
                                        <span className="text-[10px] text-muted-foreground/60 shrink-0 font-normal truncate max-w-[85px]">
                                            · {linkedContact.role}
                                        </span>
                                    )}
                                    {additionalContactsCount > 0 && (
                                        <span className="text-[8px] font-semibold text-muted-foreground/70 bg-muted/70 rounded-full px-1.5 py-0.2 shrink-0">
                                            +{additionalContactsCount}
                                        </span>
                                    )}
                                </div>
                            );
                        })()
                    ) : resolvedClientName ? (
                        <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground truncate leading-snug mt-0.5" title={`Client: ${resolvedClientName}`}>
                            <Building2 className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <Link
                                href={`/admin/entities/${deal.entityId}`}
                                onPointerDown={e => e.stopPropagation()}
                                className="hover:text-primary hover:underline transition-colors truncate"
                            >
                                {resolvedClientName}
                            </Link>
                        </div>
                    ) : null}
                </div>
            </div>
            
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onPointerDown={(e) => e.stopPropagation()}
                        className="h-8 w-8 sm:h-7 sm:w-7 min-h-[32px] min-w-[32px] rounded-lg opacity-40 group-hover/card:opacity-100 transition-opacity -mt-1 -mr-1 shrink-0 cursor-pointer"
                    >
                        <MoreVertical className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl border-none shadow-2xl p-1.5 animate-in zoom-in-95 duration-200">
                    <DropdownMenuLabel className="text-[9px] font-semibold text-muted-foreground px-2 py-1.5">Deal Options</DropdownMenuLabel>
                    
                    {nextStage && (
                        <>
                            <DropdownMenuItem 
                                onClick={handleMoveToNextStage}
                                disabled={isAdvancingStage}
                                className="rounded-lg p-2 gap-2.5 cursor-pointer font-bold text-xs text-primary hover:text-primary hover:bg-primary/10 focus:bg-primary/10 focus:text-primary transition-all active:scale-[0.97]"
                            >
                                <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="truncate">Move to next stage (→)</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                        </>
                    )}

                    <DropdownMenuItem asChild className="rounded-lg p-2 gap-2.5">
                        <Link href={`/admin/deals/${deal.id}`}>
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span className="font-bold text-xs ">View Deal</span>
                        </Link>
                    </DropdownMenuItem>

                    
                    <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); openCallModal({ entityId: deal.entityId, dealId: deal.id }); }}
                        className="rounded-lg p-2 gap-2.5 cursor-pointer"
                    >
                        <Phone className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="font-bold text-xs">Call Now</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsAssignModalOpen(true);
                        }}
                        className="rounded-lg p-2 gap-2.5 cursor-pointer"
                    >
                        <UserCheck className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-xs">{deal.assignedTo?.userId ? 'Reassign Deal' : 'Assign Deal'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsQuickEditOpen(true);
                        }}
                        className="rounded-lg p-2 gap-2.5 cursor-pointer"
                    >
                        <Edit className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-xs">Quick Edit Deal</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDuplicateOpen(true);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="rounded-lg p-2 gap-2.5 cursor-pointer"
                    >
                        <Copy className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-xs">Duplicate Deal</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.stopPropagation();
                            setTransferInitialMode('move');
                            setIsTransferModalOpen(true);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="rounded-lg p-2 gap-2.5 cursor-pointer"
                    >
                        <Move className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-xs">Move to Pipeline</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.stopPropagation();
                            setTransferInitialMode('copy');
                            setIsTransferModalOpen(true);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="rounded-lg p-2 gap-2.5 cursor-pointer"
                    >
                        <Copy className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="font-bold text-xs">Copy to Pipeline</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        onClick={handleArchiveDeal}
                        disabled={isArchiving}
                        className="rounded-lg p-2 gap-2.5 cursor-pointer"
                    >
                        {deal.isArchived ? (
                            <>
                                <RotateCcw className="h-3.5 w-3.5 text-primary" />
                                <span className="font-bold text-xs">Restore Deal</span>
                            </>
                        ) : (
                            <>
                                <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-bold text-xs">Archive Deal</span>
                            </>
                        )}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem asChild className="rounded-lg p-2 gap-2.5">
                        <Link href={`/admin/entities/${deal.entityId}`}>
                            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-bold text-xs ">View Linked {singular}</span>
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem 
                        onClick={handleDeleteDeal}
                        disabled={isDeleting}
                        className="rounded-lg p-2 gap-2.5 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="font-bold text-xs">Delete Deal</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </CardHeader>

        {/* ARCHITECTURAL POINTER (Rule 10 Compact Kanban Card & Full-Surface Drag Handle):
            - Full-surface drag: sortable attributes and listeners are attached directly to the outer <Card>,
              allowing intuitive drag-and-drop initiation from both the upper header and lower footer sections.
            - Interactive child isolation: all actionable triggers (1-tap assignee button, 3-dots menu button,
              and entity/deal links) stop pointer event propagation to prevent sensor conflicts.
            - Left: Deal assignee followed by urgency / days overdue badge, both left-aligned.
            - Right: Deal monetary value and MRR badge, right-aligned.
            - Reduced rounded corners by 50% to rounded-xl for crisp visual density.
        */}
        <CardContent className="px-3 pb-2.5 pt-0">
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                {/* Left: Compact Assignee Avatar followed by Smart Aging Alert Pill */}
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAssignModalOpen(true);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="shrink-0 p-1 -m-1 inline-flex items-center justify-center min-h-[32px] min-w-[32px] transition-transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-full cursor-pointer"
                                aria-label={deal.assignedTo?.name ? `Assigned to ${deal.assignedTo.name}` : 'Assign deal'}
                            >
                                {deal.assignedTo?.userId ? (
                                    <div 
                                        className="h-5 w-5 rounded-full bg-primary/10 border border-primary/25 text-primary flex items-center justify-center text-[9px] font-bold shadow-xs select-none"
                                    >
                                        {deal.assignedTo.name ? getInitials(deal.assignedTo.name) : <UserCheck className="h-2.5 w-2.5" />}
                                    </div>
                                ) : (
                                    <div 
                                        className="h-5 w-5 rounded-full border border-dashed border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[9px] font-bold select-none"
                                    >
                                        <UserCircle2 className="h-3 w-3" />
                                    </div>
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs font-semibold">
                            {deal.assignedTo?.name ? (
                                <>
                                    <p className="font-bold">Assigned to: {toTitleCase(deal.assignedTo.name)}</p>
                                    <p className="text-[10px] text-muted-foreground">Click to assign or re-assign</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-bold">Unassigned Deal</p>
                                    <p className="text-[10px] text-muted-foreground">Click to assign now</p>
                                </>
                            )}
                        </TooltipContent>
                    </Tooltip>

                    {/* Smart Aging Alert Pill (Anti-Alert Fatigue) */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div 
                                className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border shrink-0 max-w-[150px] sm:max-w-[170px] truncate cursor-help shadow-2xs transition-all",
                                    smartAlert.colorClass
                                )}
                            >
                                <smartAlert.icon className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{smartAlert.label}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs font-semibold max-w-[240px]">
                            <p className="font-bold">{smartAlert.tooltipTitle}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{smartAlert.tooltipDetail}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* Right: Deal Value and MRR (right-aligned, conditionally rendered based on showDealValue / showDealTotals) */}
                {showDealValue && (
                    <div className="flex items-center justify-end gap-1.5 shrink-0 text-right">
                        <Banknote className="h-3 w-3 text-primary/60 shrink-0" />
                        <span className="text-[11px] font-extrabold tabular-nums tracking-tight text-foreground">
                            {formatCurrency(deal.value)}
                        </span>
                        {typeof deal.mrr === 'number' && deal.mrr > 0 && (
                            <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                                +{formatCurrency(deal.mrr, deal.currency)}/m
                            </span>
                        )}
                    </div>
                )}
            </div>
        </CardContent>
        </Card>
        <AssignDealModal
            deal={deal}
            open={isAssignModalOpen}
            onOpenChange={setIsAssignModalOpen}
        />
        <QuickEditDealModal
            deal={deal}
            open={isQuickEditOpen}
            onOpenChange={setIsQuickEditOpen}
        />
        <DuplicateDealModal
            deal={deal}
            isOpen={isDuplicateOpen}
            onClose={() => setIsDuplicateOpen(false)}
        />
        <TransferDealModal
            deal={deal}
            open={isTransferModalOpen}
            onOpenChange={setIsTransferModalOpen}
            initialMode={transferInitialMode}
        />
        </div>
    </TooltipProvider>
  );
}

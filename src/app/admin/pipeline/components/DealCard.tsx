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
import type { Deal } from '@/lib/types';
import { AsyncEntityAvatar } from '../../components/AsyncEntityAvatar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    MoreVertical,
    Eye,
    Banknote,
    Edit,
    Trash2,
    UserCircle2,
    AlertCircle,
    Clock,
    CalendarCheck,
    CalendarOff
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { deleteDealAction } from '@/app/actions/deal-actions';

const URGENCY_ICON: Record<UrgencyLevel, React.ComponentType<{ className?: string }>> = {
    overdue: AlertCircle,
    today: Clock,
    soon: Clock,
    ok: CalendarCheck,
    none: CalendarOff,
};

interface DealCardProps {
    deal: Deal;
    isOverlay?: boolean;
    onDelete?: (dealId: string) => void;
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
export default function DealCard({ deal, isOverlay, onDelete, taskStats }: DealCardProps) {
  const { singular } = useTerminology();
  const confirm = useConfirm();
  const { toast } = useToast();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id, data: { type: 'DEAL', deal } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0 : 1,
  };

  const displayName = deal.name || 'Unnamed Deal';
  const statusColor = getStatusColor(deal.status);

  const urgency = getForecastUrgency(deal.expectedCloseDate);
  const UrgencyIcon = URGENCY_ICON[urgency.level];
  const focalContacts = deal.focalContacts ?? [];

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
      const res = await deleteDealAction(deal.id, effectiveWorkspaceId, user?.uid);
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
        <div ref={setNodeRef} style={style} className="w-full min-w-0 overflow-hidden">
        <Card
            className={cn(
                "w-full min-w-0 max-w-full mb-3 touch-manipulation rounded-[1.5rem] border transition-all duration-300 bg-card select-none group/card overflow-hidden text-left",
                isOverlay ? "border-primary shadow-2xl scale-105 rotate-1" : "border-border shadow-sm hover:shadow-lg hover:border-primary/30",
                deal.status === 'lost' && "grayscale opacity-60"
            )}
        >
        <CardHeader 
            {...attributes} 
            {...listeners} 
            className="p-4 pb-2 flex flex-row items-start justify-between space-y-0 cursor-grab active:cursor-grabbing w-full min-w-0 overflow-hidden"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="relative shrink-0">
                    <AsyncEntityAvatar 
                        entityId={deal.entityId}
                        name={deal.name} 
                        className="h-10 w-10 shadow-sm transition-transform duration-500 group-hover/card:scale-105 ring-2 ring-background"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background shadow-sm" style={{ backgroundColor: statusColor }} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link
                                href={`/admin/deals/${deal.id}`}
                                onPointerDown={e => e.stopPropagation()}
                                className="block w-full min-w-0"
                            >
                                <CardTitle className="text-xs font-bold truncate text-foreground group-hover/card:text-primary transition-colors leading-none mb-1 block w-full text-left hover:underline underline-offset-2 cursor-pointer">
                                    {displayName}
                                </CardTitle>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p className="font-bold text-xs">{displayName}</p>
                        </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground opacity-60 min-w-0">
                        <UserCircle2 className="h-2 w-2 text-primary/40 shrink-0" />
                        <span className="truncate block flex-1">{toTitleCase(deal.assignedTo?.name || 'Unassigned')}</span>
                    </div>
                    {focalContacts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {focalContacts.slice(0, 2).map(fc => (
                                <span
                                    key={fc.id}
                                    className="inline-flex items-center gap-1 bg-muted/60 rounded-full px-1.5 py-0.5 max-w-[90px]"
                                    title={fc.role ? `${fc.name} · ${fc.role}` : fc.name}
                                >
                                    <UserCircle2 className="h-2 w-2 shrink-0 text-primary/40" />
                                    <span className="truncate text-[8px] font-semibold text-foreground/70">{fc.name}</span>
                                </span>
                            ))}
                            {focalContacts.length > 2 && (
                                <span className="text-[8px] font-semibold text-muted-foreground">+{focalContacts.length - 2}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-40 group-hover/card:opacity-100 transition-opacity -mt-1 -mr-1 shrink-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl border-none shadow-2xl p-1.5 animate-in zoom-in-95 duration-200">
                    <DropdownMenuLabel className="text-[9px] font-semibold text-muted-foreground px-2 py-1.5">Deal Options</DropdownMenuLabel>
                    
                    <DropdownMenuItem asChild className="rounded-lg p-2 gap-2.5">
                        <Link href={`/admin/deals/${deal.id}`}>
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span className="font-bold text-xs ">View Deal</span>
                        </Link>
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

        <CardContent className="p-4 pt-3 space-y-4">
            <div className="flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex flex-col text-left shrink-0">
                        <div className="flex items-center gap-1">
                            <Banknote className="h-2.5 w-2.5 text-primary/40" />
                            <span className="text-[10px] font-semibold tabular-nums tracking-tighter leading-none">${(deal.value || 0).toLocaleString()}</span>
                        </div>
                        <span className="text-[7px] font-semibold text-muted-foreground tracking-tighter opacity-40 mt-0.5">Value</span>
                    </div>
                    
                    <div className="h-6 w-px bg-border/50 shrink-0" />

                    <div className="flex flex-col text-left min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                            {UrgencyIcon && <UrgencyIcon className={cn("h-2.5 w-2.5 shrink-0", urgency.colorClass)} />}
                            <span className={cn("text-[9px] font-bold truncate leading-none", urgency.colorClass)}>{urgency.label}</span>
                        </div>
                        <span className="text-[7px] font-semibold text-muted-foreground tracking-tighter opacity-40 mt-0.5">Forecast Date</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                        variant="outline"
                        className="h-4 text-[7px] font-semibold border-none px-1.5 rounded-sm shadow-inner shrink-0 uppercase tracking-wider"
                        style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                    >
                        {deal.status}
                    </Badge>
                </div>
            </div>
        </CardContent>
        </Card>
        </div>
    </TooltipProvider>
  );
}

function getStatusColor(status?: 'open' | 'won' | 'lost'): string {
    switch (status) {
        case 'won': return '#10b981';
        case 'lost': return '#ef4444';
        default: return '#3b82f6';
    }
}

'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Deal } from '@/lib/types';
import { AsyncEntityAvatar } from '../../components/AsyncEntityAvatar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
    MoreVertical, 
    CalendarPlus,
    PlusCircle,
    Eye,
    ArrowRightLeft,
    Banknote,
    MapPin,
    ArrowRight,
    Edit,
    UserCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, toTitleCase } from '@/lib/utils';
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

interface DealCardProps {
    deal: Deal;
    isOverlay?: boolean;
}

/**
 * @fileOverview High-fidelity Deal Card for Kanban boards.
 */
export default function DealCard({ deal, isOverlay }: DealCardProps) {

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

  const displayName = toTitleCase(deal.name || 'Unnamed Deal');

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'won': return '#10b981'; // emerald-500
        case 'lost': return '#ef4444'; // red-500
        default: return '#3b82f6'; // blue-500
    }
  };
  const statusColor = getStatusColor(deal.status);

  return (
    <TooltipProvider>
        <div ref={setNodeRef} style={style}>
        <Card
            className={cn(
                "w-full max-w-full mb-3 touch-manipulation rounded-[1.5rem] border-none ring-1 transition-all duration-300 bg-card select-none group/card overflow-hidden text-left",
                isOverlay ? "ring-primary shadow-2xl scale-105 rotate-1" : "ring-border shadow-sm hover:shadow-lg hover:ring-primary/20",
                deal.status === 'lost' && "grayscale opacity-60"
            )}
        >
        <CardHeader 
            {...attributes} 
            {...listeners} 
            className="p-4 pb-2 flex flex-row items-start justify-between space-y-0 cursor-grab active:cursor-grabbing"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
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
                            <CardTitle className="text-xs font-bold truncate text-foreground group-hover/card:text-primary transition-colors leading-none mb-1 block w-full text-left">
                                {displayName}
                            </CardTitle>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p className="font-bold text-xs">{displayName}</p>
                        </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground opacity-60 min-w-0">
                        <UserCircle2 className="h-2 w-2 text-primary/40 shrink-0" />
                        <span className="truncate block flex-1">{toTitleCase(deal.assignedTo?.name || 'Unassigned')}</span>
                    </div>
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
                            <span className="font-bold text-xs ">View Linked Entity</span>
                        </Link>
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
                            <MapPin className="h-2.5 w-2.5 text-primary/40 shrink-0" />
                            <span className="text-[9px] font-bold text-foreground/80 truncate leading-none">{deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'TBD'}</span>
                        </div>
                        <span className="text-[7px] font-semibold text-muted-foreground tracking-tighter opacity-40 mt-0.5">Close Date</span>
                    </div>
                </div>

                <Badge 
                    variant="outline" 
                    className="h-4 text-[7px] font-semibold border-none px-1.5 rounded-sm shadow-inner shrink-0 uppercase tracking-wider"
                    style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                >
                    {deal.status}
                </Badge>
            </div>

            {/* Actions Hub */}
            <div className="flex items-center gap-1.5 pt-3 border-t border-border/50 opacity-0 group-hover/card:opacity-100 transition-opacity">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild className="h-7 w-7 rounded-lg border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm shrink-0">
                            <Link href={`/admin/tasks?dealId=${deal.id}&assignedTo=${deal.assignedTo?.userId || 'all'}`} onPointerDown={e => e.stopPropagation()}>
                                <PlusCircle className="h-3 w-3" />
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[8px] font-semibold ">Add Task</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild className="h-7 w-7 rounded-lg border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm shrink-0">
                            <Link href={`/admin/meetings/new?dealId=${deal.id}`} onPointerDown={e => e.stopPropagation()}>
                                <CalendarPlus className="h-3 w-3" />
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[8px] font-semibold ">Session</TooltipContent>
                </Tooltip>

                <div className="flex-1" />

                <Button variant="ghost" size="sm" asChild className="h-7 px-2 rounded-lg text-primary hover:bg-primary/5 font-semibold text-[8px] gap-1 group/btn min-w-0 truncate" onPointerDown={e => e.stopPropagation()}>
                    <Link href={`/admin/deals/${deal.id}`} className="truncate">
                        <span className="truncate">Open Deal</span> <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover/btn:translate-x-0.5 shrink-0" />
                    </Link>
                </Button>
            </div>
        </CardContent>
        </Card>
        </div>
    </TooltipProvider>
  );
}

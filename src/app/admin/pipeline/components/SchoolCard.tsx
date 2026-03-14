'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { School } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    ShieldCheck, 
    MoreVertical, 
    Zap, 
    CheckCircle2,
    CalendarPlus,
    PlusCircle,
    Send,
    Eye,
    ArrowRightLeft,
    Users,
    Building,
    MapPin,
    Trophy,
    ArrowRight,
    Edit
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
import ChangeStatusModal from '../../schools/components/ChangeStatusModal';
import TransferPipelineModal from '../../schools/components/TransferPipelineModal';

interface SchoolCardProps {
    school: School;
    isOverlay?: boolean;
}

/**
 * @fileOverview High-fidelity Institutional Card for Kanban boards.
 * Optimized for data density and professional SaaS aesthetic.
 * Fixed horizontal overflow issues with strict truncation and min-w-0.
 */
export default function SchoolCard({ school, isOverlay }: SchoolCardProps) {
  const [statusModalOpen, setStatusModalOpen] = React.useState(false);
  const [transferModalOpen, setTransferModalOpen] = React.useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: school.id, data: { type: 'SCHOOL', school } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0 : 1,
  };

  const signatory = school.focalPersons?.find(p => p.isSignatory) || school.focalPersons?.[0];
  const schoolTitle = toTitleCase(school.name);

  return (
    <TooltipProvider>
        <Card
        ref={setNodeRef}
        style={style}
        className={cn(
            "w-full mb-3 touch-manipulation rounded-[1.5rem] border-none ring-1 transition-all duration-300 bg-card select-none group/card overflow-hidden",
            isOverlay ? "ring-primary shadow-2xl scale-105 rotate-1" : "ring-border shadow-sm hover:shadow-lg hover:ring-primary/20",
            school.lifecycleStatus === 'Churned' && "grayscale opacity-60"
        )}
        >
        <CardHeader 
            {...attributes} 
            {...listeners} 
            className="p-4 pb-2 flex flex-row items-start justify-between space-y-0 cursor-grab active:cursor-grabbing"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative shrink-0">
                    <Avatar className={cn(
                        "h-10 w-10 shadow-sm transition-transform duration-500 group-hover/card:scale-105",
                        school.logoUrl ? "rounded-xl" : "rounded-full"
                    )}>
                        <AvatarImage src={school.logoUrl} alt={school.name} className="object-contain p-1.5" />
                        <AvatarFallback className="text-[10px] font-black bg-primary/5 text-primary">
                            {school.initials || school.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background shadow-sm",
                        school.lifecycleStatus === 'Active' ? "bg-emerald-500" : 
                        school.lifecycleStatus === 'Onboarding' ? "bg-blue-500" : "bg-slate-400"
                    )} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <CardTitle className="text-xs font-bold truncate text-foreground group-hover/card:text-primary transition-colors leading-none mb-1 block w-full">
                                {schoolTitle}
                            </CardTitle>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p className="font-bold text-xs">{schoolTitle}</p>
                        </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        <ShieldCheck className="h-2 w-2 text-primary/40" />
                        <span className="truncate block flex-1">{toTitleCase(signatory?.name || 'No Primary Contact')}</span>
                    </div>
                </div>
            </div>
            
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-40 group-hover/card:opacity-100 transition-opacity -mt-1 -mr-1">
                        <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl border-none shadow-2xl p-1.5 animate-in zoom-in-95 duration-200">
                    <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1.5">Record Logic</DropdownMenuLabel>
                    
                    <DropdownMenuItem asChild className="rounded-lg p-2 gap-2.5">
                        <Link href={`/admin/schools/${school.id}`}>
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span className="font-bold text-xs uppercase">Full Console</span>
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem className="rounded-lg p-2 gap-2.5" onClick={() => setStatusModalOpen(true)}>
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-bold text-xs uppercase">Lifecycle</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem className="rounded-lg p-2 gap-2.5" onClick={() => setTransferModalOpen(true)}>
                        <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-bold text-xs uppercase">Transfer</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem asChild className="rounded-lg p-2 gap-2.5">
                        <Link href={`/admin/schools/${school.id}/edit`}>
                            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-bold text-xs uppercase">Edit Profile</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </CardHeader>

        <CardContent className="p-4 pt-3 space-y-4">
            {/* Metrics Row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col text-left shrink-0">
                        <div className="flex items-center gap-1">
                            <Users className="h-2.5 w-2.5 text-primary/40" />
                            <span className="text-[10px] font-black tabular-nums tracking-tighter leading-none">{school.nominalRoll?.toLocaleString() || 0}</span>
                        </div>
                        <span className="text-[7px] font-black uppercase text-muted-foreground tracking-tighter opacity-40 mt-0.5">Students</span>
                    </div>
                    
                    <div className="h-6 w-px bg-border/50 shrink-0" />

                    <div className="flex flex-col text-left min-w-0">
                        <div className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5 text-primary/40" />
                            <span className="text-[9px] font-bold text-foreground/80 truncate leading-none">{toTitleCase(school.zone?.name || 'Global')}</span>
                        </div>
                        <span className="text-[7px] font-black uppercase text-muted-foreground tracking-tighter opacity-40 mt-0.5">Region</span>
                    </div>
                </div>

                <Badge 
                    variant="outline" 
                    className={cn(
                        "h-4 text-[7px] font-black uppercase border-none px-1.5 rounded-sm shadow-inner shrink-0 ml-2",
                        school.lifecycleStatus === 'Active' ? "bg-emerald-50 text-emerald-600" :
                        school.lifecycleStatus === 'Onboarding' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                    )}
                >
                    {school.lifecycleStatus}
                </Badge>
            </div>

            {/* Actions Hub */}
            <div className="flex items-center gap-1.5 pt-3 border-t border-border/50 opacity-0 group-hover/card:opacity-100 transition-opacity">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild className="h-7 w-7 rounded-lg border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                            <Link href={`/admin/tasks?schoolId=${school.id}&assignedTo=${school.assignedTo?.userId || 'all'}`} onPointerDown={e => e.stopPropagation()}>
                                <PlusCircle className="h-3 w-3" />
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[8px] font-black uppercase">Add Task</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild className="h-7 w-7 rounded-lg border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                            <Link href={`/admin/messaging/composer?schoolId=${school.id}&recipient=${signatory?.email || signatory?.phone || ''}`} onPointerDown={e => e.stopPropagation()}>
                                <Send className="h-3 w-3" />
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[8px] font-black uppercase">Message</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild className="h-7 w-7 rounded-lg border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                            <Link href={`/admin/meetings/new?schoolId=${school.id}`} onPointerDown={e => e.stopPropagation()}>
                                <CalendarPlus className="h-3 w-3" />
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[8px] font-black uppercase">Session</TooltipContent>
                </Tooltip>

                <div className="flex-1" />

                <Button variant="ghost" size="sm" asChild className="h-7 px-2.5 rounded-lg text-primary hover:bg-primary/5 font-black uppercase text-[8px] tracking-widest gap-1 group/btn" onPointerDown={e => e.stopPropagation()}>
                    <Link href={`/admin/schools/${school.id}`}>
                        Open Console <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover/btn:translate-x-0.5" />
                    </Link>
                </Button>
            </div>
        </CardContent>
        </Card>

        <ChangeStatusModal 
            school={school} 
            open={statusModalOpen} 
            onOpenChange={setStatusModalOpen} 
        />
        <TransferPipelineModal 
            school={school} 
            open={transferModalOpen} 
            onOpenChange={setTransferModalOpen} 
        />
    </TooltipProvider>
  );
}

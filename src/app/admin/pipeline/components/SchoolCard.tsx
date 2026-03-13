'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { School } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    ShieldCheck, 
    Users, 
    Building, 
    MoreVertical, 
    Zap, 
    CheckCircle2,
    CalendarPlus,
    PlusCircle,
    Send,
    Eye,
    ArrowRightLeft,
    RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

  // Signatory Intelligence: prioritize the designated legal signatory for business context
  const signatory = school.focalPersons?.find(p => p.isSignatory) || school.focalPersons?.[0];

  return (
    <>
        <Card
        ref={setNodeRef}
        style={style}
        className={cn(
            "mb-4 touch-manipulation rounded-[2.25rem] border-none ring-1 transition-all duration-500 bg-card select-none group/card",
            isOverlay ? "ring-primary shadow-2xl scale-105 rotate-2" : "ring-border shadow-sm hover:shadow-2xl hover:ring-primary/20",
            school.lifecycleStatus === 'Churned' && "grayscale opacity-60"
        )}
        >
        <CardHeader 
            {...attributes} 
            {...listeners} 
            className="p-5 pb-3 flex flex-row items-start justify-between space-y-0 cursor-grab active:cursor-grabbing"
        >
            <div className="flex items-center gap-4 min-w-0">
                <div className="relative">
                    <Avatar className="h-12 w-12 ring-4 ring-background shadow-xl">
                        <AvatarImage src={school.logoUrl} alt={school.name} className="object-contain p-2" />
                        <AvatarFallback className="text-xs font-black bg-primary/5 text-primary">
                            {school.initials || school.name.substring(0, 2)}
                        </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                        "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background shadow-sm",
                        school.lifecycleStatus === 'Active' ? "bg-emerald-500" : 
                        school.lifecycleStatus === 'Onboarding' ? "bg-blue-500" : "bg-slate-400"
                    )} />
                </div>
                <div className="min-w-0">
                    <CardTitle className="text-sm font-black uppercase tracking-tight truncate text-foreground group-hover/card:text-primary transition-colors">
                        {school.name}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        <ShieldCheck className="h-2.5 w-2.5 text-primary/40" />
                        <span className="truncate">{signatory?.name || 'No Primary Contact'}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 shrink-0">
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60 rounded-2xl border-none shadow-2xl p-2 animate-in zoom-in-95 duration-200">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Workflow Hub</DropdownMenuLabel>
                        
                        <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3">
                            <Link href={`/admin/schools/${school.id}`}>
                                <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Eye className="h-3.5 w-3.5" /></div>
                                <span className="font-bold text-sm uppercase tracking-tight">View Full Console</span>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setStatusModalOpen(true)}>
                            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /></div>
                            <span className="font-bold text-sm uppercase tracking-tight">Update Lifecycle Status</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setTransferModalOpen(true)}>
                            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><ArrowRightLeft className="h-3.5 w-3.5" /></div>
                            <span className="font-bold text-sm uppercase tracking-tight">Transfer Pipeline</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuItem className="rounded-xl p-2.5 gap-3 text-muted-foreground opacity-60">
                            <div className="p-1.5 bg-muted rounded-lg"><Zap className="h-3.5 w-3.5" /></div>
                            <span className="font-bold text-sm uppercase tracking-tight italic">Archive Record</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
            {/* Direct Action Hub */}
            <div className="flex items-center gap-2 mb-4">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" asChild className="h-8 w-8 rounded-lg border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                                <Link href={`/admin/tasks?schoolId=${school.id}&assignedTo=${school.assignedTo?.userId || 'all'}`}>
                                    <PlusCircle className="h-3.5 w-3.5" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-black uppercase">Initialize Task</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" asChild className="h-8 w-8 rounded-lg border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                                <Link href={`/admin/messaging/composer?schoolId=${school.id}&recipient=${signatory?.email || signatory?.phone || ''}`}>
                                    <Send className="h-3.5 w-3.5" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-black uppercase">Send Message</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" asChild className="h-8 w-8 rounded-lg border-primary/10 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                                <Link href={`/admin/meetings/new?schoolId=${school.id}`}>
                                    <CalendarPlus className="h-3.5 w-3.5" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-black uppercase">Book Session</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            <Users className="h-3 w-3 text-primary/40" />
                            <span className="text-sm font-black tabular-nums tracking-tighter leading-none">{school.nominalRoll?.toLocaleString() || 0}</span>
                        </div>
                        <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter opacity-40 mt-0.5">Students</span>
                    </div>
                    
                    <div className="h-8 w-px bg-border/50" />

                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            <Building className="h-3 w-3 text-primary/40" />
                            <span className="text-[10px] font-bold text-foreground/80 truncate max-w-[80px] leading-none">{school.zone?.name || 'Global'}</span>
                        </div>
                        <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter opacity-40 mt-0.5">Region</span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Badge 
                        variant="outline" 
                        className={cn(
                            "h-5 text-[8px] font-black uppercase border-none px-2 rounded-lg shadow-inner",
                            school.lifecycleStatus === 'Active' ? "bg-emerald-50 text-emerald-600" :
                            school.lifecycleStatus === 'Onboarding' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                        )}
                    >
                        {school.lifecycleStatus}
                    </Badge>
                </div>
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
    </>
  );
}

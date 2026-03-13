
'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { School } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    User, 
    ShieldCheck, 
    Users, 
    Building, 
    MoreVertical, 
    Zap, 
    CheckCircle2,
    Calendar,
    ArrowUpRight
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

interface SchoolCardProps {
    school: School;
    isOverlay?: boolean;
}

export default function SchoolCard({ school, isOverlay }: SchoolCardProps) {
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

  // Signatory Intelligence: prioritize the designated legal signatory
  const signatory = school.focalPersons?.find(p => p.isSignatory) || school.focalPersons?.[0];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
          "mb-4 touch-manipulation rounded-[2rem] border-none ring-1 transition-all duration-500 bg-card select-none",
          isOverlay ? "ring-primary shadow-2xl scale-105 rotate-2" : "ring-border shadow-sm hover:shadow-xl hover:ring-primary/20",
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
                <CardTitle className="text-sm font-black uppercase tracking-tight truncate text-foreground group-hover:text-primary transition-colors">
                    {school.name}
                </CardTitle>
                <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                    <ShieldCheck className="h-2.5 w-2.5 text-primary/40" />
                    <span className="truncate">{signatory?.name || 'No Signatory'}</span>
                </div>
            </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Workflow Actions</DropdownMenuLabel>
                    <DropdownMenuItem className="rounded-xl p-2.5 gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><CheckCircle2 className="h-3.5 w-3.5" /></div>
                        <span className="font-bold text-sm">View Console</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl p-2.5 gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><PlusCircle className="h-3.5 w-3.5" /></div>
                        <span className="font-bold text-sm">Add Protocol Task</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuItem className="rounded-xl p-2.5 gap-3">
                        <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Zap className="h-3.5 w-3.5" /></div>
                        <span className="font-bold text-sm text-muted-foreground">Transfer Pipeline</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-primary/40" />
                        <span className="text-sm font-black tabular-nums">{school.nominalRoll?.toLocaleString() || 0}</span>
                    </div>
                    <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter opacity-40">Active Roll</span>
                </div>
                
                <div className="h-8 w-px bg-border/50" />

                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        <Building className="h-3 w-3 text-primary/40" />
                        <span className="text-xs font-bold text-foreground/80">{school.zone?.name || 'Global'}</span>
                    </div>
                    <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter opacity-40">Regional Zone</span>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <Badge 
                    variant="outline" 
                    className={cn(
                        "h-5 text-[8px] font-black uppercase border-none px-2 rounded-lg",
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
  );
}

'use client';

import * as React from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { School, OnboardingStage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical, ShieldCheck as ShieldIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, toTitleCase } from '@/lib/utils';
import SchoolCard from './SchoolCard';

interface StageColumnProps {
    stage: OnboardingStage;
    schools: School[];
    isOverlay?: boolean;
    customWidth?: number;
}

/**
 * @fileOverview High-fidelity Kanban Column.
 * Updated with executive minimalist borders and contrasting surfaces.
 * Enforces uniform card widths and strict layout constraints.
 */
export default function StageColumn({ stage, schools, isOverlay, customWidth = 320 }: StageColumnProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver,
    } = useSortable({ id: stage.id, data: { type: 'COLUMN', stage } });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.5 : 1,
        width: `${customWidth}px`,
        borderColor: stage.color || 'hsl(var(--border))',
    };

    return (
        <div ref={setNodeRef} style={style} className="h-full flex-shrink-0 flex flex-col group/column transition-[width,border-color] duration-300 whitespace-normal overflow-hidden border rounded-[2rem] min-w-0">
            <Card 
                className={cn(
                    "h-full flex flex-col bg-slate-100/50 border-none rounded-[2rem] overflow-hidden transition-all duration-500 w-full",
                    isOverlay && "shadow-2xl scale-105 rotate-1",
                    isOver && "bg-primary/[0.03]"
                )}
            >
                <CardHeader className="p-5 pb-3 border-b bg-background shrink-0 flex flex-row items-center justify-between shadow-sm z-10">
                     <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Button 
                            variant="ghost" 
                            size="icon"
                            {...attributes} 
                            {...listeners} 
                            className="cursor-grab active:cursor-grabbing h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground/30 hover:text-primary transition-colors shrink-0"
                        >
                           <GripVertical className="h-4 w-4" />
                        </Button>
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground truncate block">
                                {toTitleCase(stage.name)}
                            </CardTitle>
                        </div>
                    </div>
                    <Badge variant="secondary" className="rounded-full h-6 px-3 font-black tabular-nums border-none shadow-inner bg-slate-100 text-slate-600 shrink-0 ml-2">
                        {schools.length}
                    </Badge>
                </CardHeader>
                
                <ScrollArea className="flex-1 w-full min-w-0">
                    <CardContent className="px-3 pt-5 pb-8 w-full min-w-0">
                         <SortableContext items={schools.map(s => s.id)} strategy={verticalListSortingStrategy}>
                            <div className="min-h-[100px] flex flex-col items-stretch w-full min-w-0 overflow-hidden">
                                {schools.map(school => (
                                    <div key={school.id} className="w-full min-w-0">
                                        <SchoolCard school={school} />
                                    </div>
                                ))}
                            </div>
                        </SortableContext>
                        
                        {schools.length === 0 && (
                            <div className="py-24 text-center flex flex-col items-center gap-4 opacity-5 pointer-events-none">
                                <ShieldIcon size={64} />
                                <p className="text-xs font-black uppercase tracking-[0.3em] leading-none">Segment Clear</p>
                            </div>
                        )}
                    </CardContent>
                </ScrollArea>
            </Card>
        </div>
    );
}

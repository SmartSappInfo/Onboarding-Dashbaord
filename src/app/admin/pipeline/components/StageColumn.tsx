
'use client';

import * as React from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { School, OnboardingStage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SchoolCard from './SchoolCard';

interface StageColumnProps {
    stage: OnboardingStage;
    schools: School[];
    isOverlay?: boolean;
}

export default function StageColumn({ stage, schools, isOverlay }: StageColumnProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: stage.id, data: { type: 'COLUMN', stage } });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="h-full w-80 flex-shrink-0 flex flex-col">
            <Card 
                className={cn(
                    "h-full flex flex-col bg-muted/20 border-none ring-1 ring-border rounded-[2.5rem] overflow-hidden transition-all duration-500",
                    isOverlay && "ring-primary shadow-2xl scale-105 rotate-1",
                    "border-t-4"
                )}
                style={{ borderTopColor: stage.color || 'hsl(var(--primary))' }}
            >
                <CardHeader className="p-6 pb-4 border-b bg-card shrink-0 flex flex-row items-center justify-between">
                     <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="icon"
                            {...attributes} 
                            {...listeners} 
                            className="cursor-grab active:cursor-grabbing h-8 w-8 rounded-lg hover:bg-muted"
                        >
                           <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        </Button>
                        <div className="flex flex-col">
                            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground/80">{stage.name}</CardTitle>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40 tracking-tighter">Workflow Phase</p>
                        </div>
                    </div>
                    <Badge variant="secondary" className="rounded-full h-6 px-3 font-black tabular-nums border-none shadow-inner bg-background">{schools.length}</Badge>
                </CardHeader>
                
                <ScrollArea className="flex-1">
                    <CardContent className="p-4 pt-6">
                         <SortableContext items={schools.map(s => s.id)} strategy={verticalListSortingStrategy}>
                            {schools.map(school => (
                                <SchoolCard key={school.id} school={school} />
                            ))}
                        </SortableContext>
                        
                        {schools.length === 0 && (
                            <div className="py-20 text-center flex flex-col items-center gap-3 opacity-10">
                                <ShieldCheck size={40} />
                                <p className="text-[10px] font-black uppercase tracking-widest leading-none">Segment Clear</p>
                            </div>
                        )}
                    </CardContent>
                </ScrollArea>
            </Card>
        </div>
    );
}

function ShieldCheck(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    )
}


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
 * Re-architected with white headers, color-matched top accent lines,
 * and high-contrast metric badges.
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
    };

    const stageColor = stage.color || '#3B5FFF';

    return (
        <div ref={setNodeRef} style={style} className="h-full flex-shrink-0 flex flex-col group/column transition-[width] duration-300 whitespace-normal overflow-hidden border border-border/50 rounded-[2.5rem] min-w-0 shadow-sm">
            <Card 
                className={cn(
                    "h-full flex flex-col bg-slate-100/50 border-none rounded-[2.5rem] overflow-hidden transition-all duration-500 w-full relative",
                    isOverlay && "shadow-2xl scale-105 rotate-1",
                    isOver && "bg-primary/[0.03]"
                )}
            >
                {/* Top Accent Line - Matches the image curvature and color */}
                <div 
                    className="absolute top-0 left-0 right-0 h-1.5 rounded-t-full z-20" 
                    style={{ backgroundColor: stageColor }} 
                />

                {/* White Header Section */}
                <CardHeader className="p-5 pb-3 border-b bg-white shrink-0 flex flex-row items-center justify-between shadow-sm z-10 pt-6">
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
                            <CardTitle 
                                className="text-sm font-black uppercase tracking-tight truncate block"
                                style={{ color: stageColor }}
                            >
                                {toTitleCase(stage.name)}
                            </CardTitle>
                        </div>
                    </div>
                    
                    {/* Color-Coded Count Badge - Updated for higher contrast and better grouping */}
                    <Badge 
                        variant="outline" 
                        className="rounded-full h-6 px-3 font-black tabular-nums border-none transition-colors shadow-inner shrink-0 ml-2"
                        style={{ 
                            backgroundColor: `${stageColor}15`, 
                            color: stageColor
                        }}
                    >
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

'use client';

import * as React from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Deal, OnboardingStage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical, ShieldCheck as ShieldIcon, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, toTitleCase } from '@/lib/utils';
import DealCard from './DealCard';
import CreateDealModal from '../../entities/components/CreateDealModal';

interface StageColumnProps {
    stage: OnboardingStage;
    deals: Deal[];
    isOverlay?: boolean;
    customWidth?: number;
}

/**
 * @fileOverview High-fidelity Kanban Column.
 * Powered by deals collection for modern transactional tracking.
 */
export default function StageColumn({ stage, deals, isOverlay, customWidth = 320 }: StageColumnProps) {
    const [isCreateDealOpen, setIsCreateDealOpen] = React.useState(false);
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
        <div ref={setNodeRef} style={style} className="h-full flex-shrink-0 flex flex-col group/column transition-[width] duration-300 whitespace-normal overflow-hidden border-none rounded-2xl min-w-0">
                <Card 
                    className={cn(
                        "h-full flex flex-col bg-card border border-border rounded-2xl overflow-hidden transition-all duration-500 w-full relative",
                    isOverlay && "shadow-2xl scale-105 rotate-1",
                    isOver && "bg-primary/[0.03]"
                )}
            >
                {/* Top Accent Line - Matches the image curvature and color */}
                <div 
                    className="absolute top-0 left-0 right-0 h-1.5 rounded-t-full z-20" 
                    style={{ backgroundColor: stageColor }} 
                />

                {/* Glass Header Section */}
                <CardHeader className="p-5 pb-3 border-b border-border/10 bg-card/40 backdrop-blur-xl shrink-0 flex flex-row items-center justify-between z-10 pt-6">
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
                                className="text-sm font-semibold tracking-tight truncate block"
                                style={{ color: stageColor }}
                            >
                                {toTitleCase(stage.name)}
                            </CardTitle>
                        </div>
                    </div>
                    
                    {/* Color-Coded Count Badge - High contrast metrics */}
                    <Badge 
                        variant="outline" 
                        className="rounded-full h-6 px-3 font-semibold tabular-nums border-none transition-colors shadow-inner shrink-0 ml-2"
                        style={{ 
                            backgroundColor: `${stageColor}15`, 
                            color: stageColor
                        }}
                    >
                        {deals.length}
                    </Badge>
                </CardHeader>
                
                <ScrollArea className="flex-1 w-full min-w-0">
                    <CardContent className="px-3 pt-5 pb-8 w-full min-w-0">
                         <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
                            <div className="min-h-[100px] flex flex-col items-stretch w-full min-w-0 overflow-hidden">
                                {deals.map(deal => (
                                    <div key={deal.id} className="w-full min-w-0">
                                        <DealCard deal={deal} />
                                    </div>
                                ))}
                            </div>
                        </SortableContext>
                        
                        {deals.length === 0 && (
                            <div className="py-24 text-center flex flex-col items-center gap-4 opacity-5 pointer-events-none">
                                <ShieldIcon size={64} />
                                <p className="text-xs font-semibold tracking-[0.3em] leading-none">Segment Clear</p>
                            </div>
                        )}

                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsCreateDealOpen(true)}
                            className="w-full mt-4 h-9 border border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-primary rounded-xl font-bold text-xs gap-1.5 flex items-center justify-center bg-muted/10 hover:bg-primary/5 transition-all"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add Deal
                        </Button>
                    </CardContent>
                </ScrollArea>
                <CreateDealModal open={isCreateDealOpen} onOpenChange={setIsCreateDealOpen} initialStageId={stage.id} />
            </Card>
        </div>
    );
}

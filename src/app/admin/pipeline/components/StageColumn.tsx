'use client';

import * as React from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import type { Deal, OnboardingStage, Automation } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { GripVertical, ShieldCheck as ShieldIcon, Plus, MoreVertical, Trash2, Zap, ExternalLink, ArrowDownToLine, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, toTitleCase } from '@/lib/utils';
import DealCard from './DealCard';
import CreateDealModal from '../../entities/components/CreateDealModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { clearStageDealsAction } from '@/app/actions/deal-actions';
import { isAutomationLinkedToStage } from '@/lib/automation-stage-helpers';
import { formatCurrency } from '@/lib/currency-utils';
import { calculateWeightedValue, calculateDaysInStage } from '@/lib/deals/deal-health-engine';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CachedEntity } from '@/context/EntityCacheContext';

interface StageColumnProps {
    stage: OnboardingStage;
    deals: Deal[];
    isOverlay?: boolean;
    customWidth?: number;
    tasksByDealId?: Record<string, { total: number; completed: number; hasOverdue: boolean }>;
    pipelineName?: string;
    pipelineId?: string;
    automations?: Automation[];
    isDraggingDeal?: boolean;
    showDealTotals?: boolean;
    entitiesById?: Map<string, CachedEntity>;
    stages?: OnboardingStage[];
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

interface TruncatedStageTitleProps {
    title: string;
    delayDuration?: number;
}

/**
 * ARCHITECTURAL POINTER:
 * Detects whether the stage title is visually truncated with text-overflow: ellipsis (...).
 * When truncated (scrollWidth > clientWidth), a Radix hover tooltip is mounted displaying the full title.
 * When untruncated, tooltip display is suppressed to avoid redundant UI tooltips.
 */
export function TruncatedStageTitle({ title, delayDuration = 150 }: TruncatedStageTitleProps) {
    const textRef = React.useRef<HTMLHeadingElement>(null);
    const [open, setOpen] = React.useState(false);

    const handleOpenChange = React.useCallback((nextOpen: boolean) => {
        if (nextOpen) {
            const el = textRef.current;
            // Only open tooltip if content overflows container and is truncated with ellipsis
            const isTruncated = el ? el.scrollWidth > el.clientWidth : false;
            setOpen(isTruncated);
        } else {
            setOpen(false);
        }
    }, []);

    return (
        <TooltipProvider delayDuration={delayDuration}>
            <Tooltip open={open} onOpenChange={handleOpenChange}>
                <TooltipTrigger asChild>
                    <h3 
                        ref={textRef}
                        data-slot="card-title"
                        className="text-sm font-bold tracking-tight truncate block text-foreground cursor-default select-none"
                    >
                        {title}
                    </h3>
                </TooltipTrigger>
                <TooltipContent 
                    side="top" 
                    align="start"
                    className="text-xs font-semibold max-w-[280px] break-words shadow-lg z-[100] px-2.5 py-1.5"
                >
                    {title}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/**
 * ARCHITECTURAL POINTER (High-Fidelity Kanban Stage Column):
 * Renders stage column header, deal list cards, deal creation triggers, and active stage automation indicators.
 *
 * CAUTION FOR MAINTAINERS:
 * When adding automations to a stage via handleAddAutomationToStage, parameters are passed in query params
 * so NewAutomationPage can auto-populate the workflow title and DEAL_STAGE_CHANGED trigger node.
 */
export default function StageColumn({ 
    stage, 
    deals, 
    isOverlay, 
    customWidth = 320, 
    tasksByDealId, 
    pipelineName, 
    pipelineId, 
    automations, 
    isDraggingDeal,
    showDealTotals = false,
    entitiesById,
    stages,
    isCollapsed = false,
    onToggleCollapse
}: StageColumnProps) {
    const [isCreateDealOpen, setIsCreateDealOpen] = React.useState(false);
    const [isClearing, setIsClearing] = React.useState(false);
    const confirm = useConfirm();
    const { user } = useUser();
    const { activeWorkspaceId } = useWorkspace();
    const { toast } = useToast();

    const activePipelineId = pipelineId || stage.pipelineId;

    const nextStage = React.useMemo(() => {
        if (!stages || stages.length === 0) return undefined;
        const sorted = [...stages].sort((a, b) => a.order - b.order);
        const currentIndex = sorted.findIndex(s => s.id === stage.id);
        if (currentIndex !== -1 && currentIndex < sorted.length - 1) {
            return sorted[currentIndex + 1];
        }
        return undefined;
    }, [stages, stage.id]);

    const attachedAutomations = React.useMemo(() => {
        return (automations || []).filter(a => isAutomationLinkedToStage(a, activePipelineId, stage.id));
    }, [automations, activePipelineId, stage.id]);

    const handleAddAutomationToStage = () => {
        const pName = pipelineName || 'Pipeline';
        const sName = stage.name;
        const url = `/admin/automations/new?pipelineId=${encodeURIComponent(activePipelineId)}&stageId=${encodeURIComponent(stage.id)}&pipelineName=${encodeURIComponent(pName)}&stageName=${encodeURIComponent(sName)}`;
        window.open(url, '_blank');
    };

    const handleClearStage = async () => {
        if (!user || !activeWorkspaceId) return;

        const approved1 = await confirm({
            title: 'Clear Stage Deals?',
            description: `Are you sure you want to clear all deals in the stage "${stage.name}"?`,
            confirmText: 'Clear Deals',
            variant: 'destructive'
        });
        if (!approved1) return;

        const approved2 = await confirm({
            title: 'Warning: Irreversible Action',
            description: `This will permanently delete all ${deals.length} deals in "${stage.name}". There is no way to undo this. Do you want to proceed?`,
            confirmText: 'Yes, permanently delete',
            variant: 'destructive'
        });
        if (!approved2) return;

        setIsClearing(true);
        try {
            const res = await clearStageDealsAction(stage.id, activeWorkspaceId);
            if (res.success) {
                toast({ title: 'Stage Cleared', description: `Successfully cleared ${res.count ?? 0} deals.` });
            } else {
                throw new Error(res.error || 'Failed to clear stage deals.');
            }
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            toast({ variant: 'destructive', title: 'Clear Stage Failed', description: error });
        } finally {
            setIsClearing(false);
        }
    };
    const { totalStageValue, weightedStageValue, avgStageDays } = React.useMemo(() => {
        let total = 0;
        let weighted = 0;
        let totalDays = 0;

        for (const d of deals) {
            const val = Number.isFinite(d.value) ? d.value : 0;
            total += val;
            const prob = d.probability ?? stage.probability ?? 50;
            weighted += calculateWeightedValue(val, prob);
            totalDays += calculateDaysInStage(d.stageEnteredAt, d.createdAt);
        }

        const avg = deals.length > 0 ? Math.round((totalDays / deals.length) * 10) / 10 : 0;

        return {
            totalStageValue: total,
            weightedStageValue: weighted,
            avgStageDays: avg,
        };
    }, [deals, stage]);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: stage.id,
        data: {
            type: 'STAGE',
            stage,
        },
    });

    const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
        id: stage.id,
        data: {
            type: 'STAGE',
            stage,
        },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    const stageColor = React.useMemo(() => {
        if (stage.color) return stage.color;
        if (stage.terminalType === 'won' || stage.isWon) return '#10B981';
        if (stage.terminalType === 'lost' || stage.terminalType === 'abandoned' || stage.isLost) return '#EF4444';
        return '#3B82F6';
    }, [stage.color, stage.terminalType, stage.isWon, stage.isLost]);

    if (isCollapsed) {
        return (
            <div
                ref={isOverlay ? undefined : setNodeRef}
                style={{ ...style, width: '56px' }}
                className="h-full flex-shrink-0 select-none pb-4 w-14 min-w-[56px] max-w-[56px] transition-all duration-300"
            >
                <Card
                    className={cn(
                        "flex flex-col flex-1 h-full min-h-[420px] bg-card/80 hover:bg-card border rounded-2xl overflow-hidden transition-all duration-300 w-full relative shadow-xs group/sliver cursor-pointer",
                        isOverlay && "shadow-2xl scale-[1.02] border-primary/60",
                        isDraggingDeal && !isOver && "border-dashed border-border/80",
                        isOver && isDraggingDeal
                            ? "bg-primary/15 border-primary ring-2 ring-primary/50 shadow-xl scale-[1.02]"
                            : "border-border/70 hover:border-primary/40"
                    )}
                >
                    <div ref={setDroppableNodeRef} className="absolute inset-0 z-0 pointer-events-none" />

                    {/* Top Rounded Color Bar */}
                    <div 
                        className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl z-30 pointer-events-none transition-colors duration-200" 
                        style={{ backgroundColor: stageColor }} 
                    />

                    {/* Top Control Bar: Grip and Expand Chevron */}
                    <div className="p-2 pt-2.5 border-b border-border/50 bg-card/95 backdrop-blur-md shrink-0 flex flex-col items-center gap-1 z-10 sticky top-0">
                        <Button 
                            variant="ghost" 
                            size="icon"
                            {...attributes} 
                            {...listeners} 
                            className="cursor-grab active:cursor-grabbing h-6 w-6 rounded-lg hover:bg-muted text-muted-foreground/30 hover:text-primary transition-colors shrink-0"
                            aria-label="Drag column"
                        >
                            <GripVertical className="h-3.5 w-3.5" />
                        </Button>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleCollapse?.();
                                        }}
                                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0 active:scale-95"
                                        aria-label={`Expand stage ${stage.name}`}
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="text-xs font-semibold">
                                    <p className="font-bold">Expand {toTitleCase(stage.name)}</p>
                                    <p className="text-[10px] text-muted-foreground">{deals.length} {deals.length === 1 ? 'deal' : 'deals'}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <Badge 
                            variant="secondary" 
                            className="rounded-full h-5 px-1.5 font-bold tabular-nums bg-muted/80 text-muted-foreground border border-border/60 text-[10px] select-none"
                        >
                            {deals.length}
                        </Badge>
                    </div>

                    {/* Center Area: Vertical Stage Name or Drop Cue */}
                    <div 
                        onClick={() => onToggleCollapse?.()}
                        className="flex-1 flex flex-col items-center justify-center py-6 px-1.5 overflow-hidden relative"
                        title={`Click to expand ${toTitleCase(stage.name)} (${deals.length} deals)`}
                    >
                        {isOver && isDraggingDeal ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 text-primary animate-pulse my-auto">
                                <ArrowDownToLine className="h-5 w-5 animate-bounce" />
                                <span className="text-[9px] font-black uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
                                    Drop to Move
                                </span>
                            </div>
                        ) : (
                            <div className="my-auto flex flex-col items-center justify-center gap-2">
                                {attachedAutomations.length > 0 && (
                                    <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500 animate-pulse shrink-0" />
                                )}
                                <span className="text-xs font-bold tracking-tight text-muted-foreground group-hover/sliver:text-foreground transition-colors [writing-mode:vertical-rl] rotate-180 truncate max-h-[300px] select-none">
                                    {toTitleCase(stage.name)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Bottom Area: Quick Add Deal */}
                    <div className="p-2 border-t border-border/40 bg-card/60 shrink-0 flex flex-col items-center">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsCreateDealOpen(true);
                                        }}
                                        className="h-7 w-7 rounded-lg text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                                        aria-label={`Add deal to ${stage.name}`}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="text-xs font-semibold">
                                    Add deal to {toTitleCase(stage.name)}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <CreateDealModal open={isCreateDealOpen} onOpenChange={setIsCreateDealOpen} initialStageId={stage.id} initialPipelineId={activePipelineId} />
                </Card>
            </div>
        );
    }

    return (
        <div
            ref={isOverlay ? undefined : setNodeRef}
            style={{ ...style, width: isOverlay ? (customWidth ? `${customWidth}px` : undefined) : undefined }}
            className={cn(
                "h-full flex-shrink-0 select-none pb-4",
                "w-[280px] md:w-[320px] lg:w-[340px]"
            )}
        >
            <Card
                className={cn(
                    "flex flex-col bg-card border rounded-2xl overflow-hidden transition-all duration-300 w-full relative",
                    isOverlay && "shadow-2xl scale-[1.02] border-primary/60",
                    isDraggingDeal && !isOver && "border-dashed border-border/90",
                    isOver && isDraggingDeal
                        ? "bg-primary/[0.04] dark:bg-primary/[0.08] border-primary ring-2 ring-primary/40 shadow-xl"
                        : "border-border shadow-xs"
                )}
            >
                <div ref={setDroppableNodeRef} className="absolute inset-0 z-0 pointer-events-none" />

                {/* Top Rounded Color Bar */}
                <div 
                    className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl z-30 pointer-events-none transition-colors duration-200" 
                    style={{ backgroundColor: stageColor }} 
                />

                {/* Sticky Header Section */}
                <CardHeader 
                    className={cn(
                        "p-3.5 pt-3.5 pb-2 border-b shrink-0 flex flex-col z-20 space-y-1.5 sticky top-0 transition-colors duration-200",
                        isOver && isDraggingDeal
                            ? "border-primary/40 bg-card/95 shadow-xs"
                            : "border-border/60 bg-card/95 backdrop-blur-md shadow-2xs"
                    )}
                >
                    <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Button 
                                variant="ghost" 
                                size="icon"
                                {...attributes} 
                                {...listeners} 
                                className="cursor-grab active:cursor-grabbing h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground/30 hover:text-primary transition-colors shrink-0"
                            >
                                <GripVertical className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0 flex-1">
                                <TruncatedStageTitle title={toTitleCase(stage.name)} />
                            </div>
                        </div>
                        
                        {/* Color-Coded Count Badge & Active Stage Automation Badge */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {attachedAutomations.length > 0 && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-extrabold flex items-center gap-1 shrink-0 transition-all shadow-sm active:scale-[0.97]"
                                            title={`${attachedAutomations.length} automation workflow(s) attached to this stage`}
                                        >
                                            <Zap className="h-3 w-3 fill-amber-500 text-amber-500 animate-pulse" />
                                            <span>{attachedAutomations.length}</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-[280px] p-3 rounded-2xl border border-border/80 shadow-2xl bg-popover z-[200]">
                                        <div className="flex items-center justify-between border-b pb-2 mb-2">
                                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
                                                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                                <span>Stage Automations ({attachedAutomations.length})</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleAddAutomationToStage}
                                                className="h-6 px-2 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/10"
                                            >
                                                + Add New
                                            </Button>
                                        </div>
                                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                            {attachedAutomations.map(auto => (
                                                <div key={auto.id} className="p-2 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/50 transition-all flex items-center justify-between gap-2">
                                                    <div className="min-w-0 flex-1 text-left">
                                                        <p className="text-xs font-bold text-foreground truncate">{auto.name}</p>
                                                        <p className="text-[9px] text-muted-foreground font-medium truncate">
                                                            {auto.isActive ? 'Active Workflow' : 'Draft / Paused'}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => window.open(`/admin/automations/${auto.id}/edit`, '_blank')}
                                                        className="h-7 w-7 rounded-lg shrink-0 border-border hover:bg-primary/10 hover:text-primary"
                                                        title="Edit Automation"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}

                            <Badge 
                                variant="secondary" 
                                className="rounded-full h-5 px-2 font-bold tabular-nums bg-muted/80 text-muted-foreground border border-border/60 text-[11px]"
                            >
                                {deals.length}
                            </Badge>

                            {/* Simple small + icon in column header next to the three-dot menu */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsCreateDealOpen(true)}
                                            className="h-6 w-6 rounded-lg text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                                            aria-label={`Add deal to ${stage.name}`}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                        Add deal to {toTitleCase(stage.name)}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {/* Quick Collapse to Vertical Sliver Button */}
                            {onToggleCollapse && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={onToggleCollapse}
                                                className="h-6 w-6 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                                                aria-label={`Collapse stage ${stage.name}`}
                                            >
                                                <ChevronsLeft className="h-3.5 w-3.5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-xs">
                                            Collapse stage to sliver
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-all shrink-0"
                                    >
                                        <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border-none shadow-2xl p-1.5 min-w-[180px]">
                                    <DropdownMenuItem
                                        onClick={() => setIsCreateDealOpen(true)}
                                        className="py-2 cursor-pointer font-semibold text-xs flex items-center gap-2 text-foreground hover:text-primary focus:text-primary focus:bg-primary/10 rounded-lg"
                                    >
                                        <Plus className="h-3.5 w-3.5 text-primary" />
                                        Add Deal to Stage
                                    </DropdownMenuItem>
                                    {onToggleCollapse && (
                                        <DropdownMenuItem
                                            onClick={onToggleCollapse}
                                            className="py-2 cursor-pointer font-semibold text-xs flex items-center gap-2 text-foreground hover:text-primary focus:text-primary focus:bg-primary/10 rounded-lg"
                                        >
                                            <ChevronsLeft className="h-3.5 w-3.5 text-muted-foreground" />
                                            Collapse to Sliver
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        onClick={handleAddAutomationToStage}
                                        className="py-2 cursor-pointer font-semibold text-xs flex items-center gap-2 text-amber-600 dark:text-amber-400 focus:text-amber-600 focus:bg-amber-500/10 rounded-lg"
                                    >
                                        <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                        Add Automation to Stage
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleClearStage}
                                        disabled={deals.length === 0 || isClearing}
                                        className="text-destructive focus:text-destructive focus:bg-destructive/5 rounded-lg py-2 cursor-pointer font-semibold text-xs flex items-center gap-2"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Clear Stage
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Stage Subheader: Financial Total & Velocity SLA (completely collapsed if financials / showDealTotals are off) */}
                    {showDealTotals && (
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground pt-1 border-t border-border/30">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="font-bold text-foreground cursor-help">
                                            {formatCurrency(totalStageValue)}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px]">
                                        <p className="font-bold">Total: {formatCurrency(totalStageValue)}</p>
                                        <p className="text-muted-foreground">Weighted Forecast: {formatCurrency(weightedStageValue)}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <div className="flex items-center gap-2 text-[10px]">
                                {stage.slaDays && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-semibold">
                                        SLA: {stage.slaDays}d
                                    </span>
                                )}
                                {deals.length > 0 && (
                                    <span className="text-muted-foreground/80">
                                        Avg {avgStageDays}d
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </CardHeader>
                
                <div 
                    className="w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                    style={{ maxHeight: 'min(700px, 75vh)' }}
                >
                    <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
                        <div className="min-h-[100px] flex flex-col items-stretch w-full min-w-0">
                            {deals.map(deal => (
                                <div key={deal.id} className="w-full min-w-0">
                                    <DealCard 
                                        deal={deal} 
                                        stage={stage} 
                                        nextStage={nextStage}
                                        showDealValue={showDealTotals}
                                        taskStats={tasksByDealId?.[deal.id]} 
                                        clientName={entitiesById?.get(deal.entityId)?.displayName}
                                    />
                                </div>
                            ))}

                            {/* Receiving Drop Target Indicator */}
                            {isOver && isDraggingDeal && (
                                <div 
                                    className="w-full rounded-2xl border-2 border-dashed border-primary bg-primary/10 dark:bg-primary/20 p-4 my-2 flex flex-col items-center justify-center gap-1.5 text-primary text-center shadow-lg ring-2 ring-primary/20 animate-pulse transition-all duration-200"
                                >
                                    <div className="flex items-center gap-2 font-bold text-xs">
                                        <ArrowDownToLine className="h-4 w-4 animate-bounce text-primary" />
                                        <span>Drop in {toTitleCase(stage.name)}</span>
                                    </div>
                                    <span className="text-[10px] text-primary/80 font-medium">Release to move deal to this stage</span>
                                </div>
                            )}
                            {/* Single ghost button at the very bottom of the scrollable card stack */}
                            {deals.length > 0 && !isDraggingDeal && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsCreateDealOpen(true)}
                                    className="w-full mt-1 mb-2 h-8 border border-dashed border-border/50 hover:border-primary/40 text-muted-foreground/60 hover:text-primary rounded-xl font-medium text-xs gap-1.5 flex items-center justify-center bg-transparent hover:bg-primary/5 transition-all"
                                >
                                    <Plus className="h-3 w-3" /> Add Deal
                                </Button>
                            )}
                        </div>
                    </SortableContext>
                    
                    {deals.length === 0 && (!isOver || !isDraggingDeal) && (
                        <div className="py-12 px-3 text-center flex flex-col items-center justify-center gap-3 w-full">
                            <div className="h-12 w-12 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center text-muted-foreground/40">
                                <ShieldIcon className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground">No deals in this stage</p>
                                <p className="text-[10px] text-muted-foreground/60 max-w-[200px]">
                                    Drop a deal here or create a new deal for this step.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsCreateDealOpen(true)}
                                className="mt-1 h-8 px-4 rounded-xl font-bold text-xs border-dashed border-primary/40 text-primary hover:bg-primary/10 transition-all active:scale-95"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Deal to Stage
                            </Button>
                        </div>
                    )}
                </div>
                
                <CreateDealModal open={isCreateDealOpen} onOpenChange={setIsCreateDealOpen} initialStageId={stage.id} initialPipelineId={activePipelineId} />
            </Card>
        </div>
    );
}

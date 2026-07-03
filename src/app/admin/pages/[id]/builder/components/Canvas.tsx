'use client';

import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    useDroppable,
    type CollisionDetection
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    GripVertical,
    Trash2,
    ArrowUp,
    ArrowDown,
    FolderHeart,
    PlusSquare,
    Copy,
    SlidersHorizontal,
} from 'lucide-react';
import type { PageSection, PageBlock, CampaignPageVersion, ResolvedTheme, BuilderResources } from '@/lib/types';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks'; // register all blocks
import { useToast } from '@/hooks/use-toast';

interface CanvasProps {
    version: CampaignPageVersion;
    viewport: 'desktop' | 'tablet' | 'mobile';
    theme: ResolvedTheme;
    resources: BuilderResources;
    selectedBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onSetTab: (tab: string) => void;
    onUpdateBlockProps: (blockId: string, props: Record<string, unknown>) => void;
    onRemoveBlock: (blockId: string) => void;
    onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
    onDuplicateBlock: (blockId: string) => void;
    onRemoveSection: (sectionId: string) => void;
    onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
    onEditSection: (sectionId: string) => void;
    onSaveSectionAsTemplate: (section: PageSection) => void;
    onReorderSections: (from: number, to: number) => void;
    onReorderBlocks: (sectionId: string, from: number, to: number) => void;
    onMoveBlockToColumn: (blockId: string, targetSectionId: string, targetColumnIndex: number, targetIndex: number) => void;
    canvasMode: 'edit' | 'preview';
    editMode: 'columns' | 'components';
    onSetEditMode: (mode: 'columns' | 'components') => void;
}
// ─── Sortable Section Wrapper ────────────────────────────────────────────
function SortableSection({ section, idx, total, children, onRemove, onMove, onSave, onEdit, editMode, canvasMode }: {
    section: PageSection;
    idx: number;
    total: number;
    children: React.ReactNode;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onSave: () => void;
    onEdit: () => void;
    editMode: 'columns' | 'components';
    canvasMode: 'edit' | 'preview';
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, disabled: canvasMode === 'preview' });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const isPreview = canvasMode === 'preview';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group relative transition-all border-2 border-transparent border-dashed rounded-xl",
                !isPreview && (editMode === 'columns' ? "hover:border-emerald-500/30" : "hover:border-slate-200/50"),
                isDragging && "z-50 shadow-2xl ring-2 ring-emerald-500/30"
            )}
        >
            {/* Section Controls - Top Left */}
            {!isPreview && (
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-20">
                    <div
                        {...attributes}
                        {...listeners}
                        className="h-7 w-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all"
                    >
                        <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="bg-slate-900 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-700 shadow-sm">
                        Section {idx + 1}
                    </div>
                    <Button
                        variant="secondary" size="icon"
                        className="h-7 w-7 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        title="Section settings"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                    <Button
                        variant="secondary" size="icon"
                        className="h-7 w-7 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                        onClick={(e) => { e.stopPropagation(); onSave(); }}
                        title="Save section as template"
                    >
                        <FolderHeart className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                </div>
            )}

            {/* Section Controls - Top Right */}
            {!isPreview && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-20">
                    <Button variant="secondary" size="icon" className="h-6 w-6 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-emerald-400 disabled:opacity-30" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); onMove('up'); }}>
                        <ArrowUp className="w-3 h-3 text-slate-400" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-6 w-6 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-emerald-400 disabled:opacity-30" disabled={idx === total - 1} onClick={(e) => { e.stopPropagation(); onMove('down'); }}>
                        <ArrowDown className="w-3 h-3 text-slate-400" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-6 w-6 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-red-400 transition-all" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-400" />
                    </Button>
                </div>
            )}

            {children}
        </div>
    );
}

// ─── Sortable Block Wrapper ──────────────────────────────────────────────
function SortableBlock({ block, bIdx, total, selected, onSelect, onRemove, onMove, onDuplicate, children, canvasMode }: {
    block: PageBlock;
    bIdx: number;
    total: number;
    selected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onDuplicate: () => void;
    children: React.ReactNode;
    canvasMode: 'edit' | 'preview';
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: canvasMode === 'preview' });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const isPreview = canvasMode === 'preview';

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={(e) => { 
                if (isPreview) return;
                e.stopPropagation(); 
                onSelect(); 
            }}
            className={cn(
                "p-4 bg-white ring-1 ring-slate-200 rounded-xl relative hover:ring-2 hover:ring-emerald-500/40 shadow-sm transition-all group/block",
                !isPreview && "cursor-pointer",
                selected && !isPreview && "ring-2 ring-emerald-500 bg-emerald-50/50",
                isDragging && "z-50 shadow-2xl"
            )}
        >
            {/* Block Controls */}
            {!isPreview && (
                <div className="absolute -top-3 -right-2 opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center gap-1 z-20 scale-90 origin-right">
                    <div
                        {...attributes}
                        {...listeners}
                        className="h-5 w-5 rounded-full shadow-md bg-white hover:bg-emerald-55 border border-slate-200 flex items-center justify-center cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical className="w-2.5 h-2.5 text-slate-400" />
                    </div>
                    <Button variant="secondary" size="icon" className="h-5 w-5 rounded-full shadow-md bg-white hover:text-emerald-600 border border-slate-100 disabled:opacity-30" disabled={bIdx === 0} onClick={(e) => { e.stopPropagation(); onMove('up'); }}>
                        <ArrowUp className="w-2.5 h-2.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-5 w-5 rounded-full shadow-md bg-white hover:text-emerald-600 border border-slate-100 disabled:opacity-30" disabled={bIdx === total - 1} onClick={(e) => { e.stopPropagation(); onMove('down'); }}>
                        <ArrowDown className="w-2.5 h-2.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-5 w-5 rounded-full shadow-md bg-white hover:text-blue-600 border border-slate-100" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicate block">
                        <Copy className="w-2.5 h-2.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-5 w-5 rounded-full shadow-md bg-white hover:text-red-600 border border-slate-100" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                        <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                </div>
            )}

            {children}
        </div>
    );
}

// ─── Column cell container ───────────────────────────────────────────────
function ColumnCell({
    sectionId,
    colIdx,
    blocks,
    selectedBlockId,
    onSelectBlock,
    onSetTab,
    onRemoveBlock,
    onMoveBlock,
    onDuplicateBlock,
    editCtx,
    editMode,
    canvasMode,
}: {
    sectionId: string;
    colIdx: number;
    blocks: PageBlock[];
    selectedBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onSetTab: (tab: string) => void;
    onRemoveBlock: (id: string) => void;
    onMoveBlock: (id: string, dir: 'up' | 'down') => void;
    onDuplicateBlock: (id: string) => void;
    editCtx: (id: string) => BlockRenderContext;
    editMode: 'columns' | 'components';
    canvasMode: 'edit' | 'preview';
}) {
    const colId = `${sectionId}-col-${colIdx}`;
    const { setNodeRef, isOver } = useDroppable({
        id: colId,
        disabled: canvasMode === 'preview',
    });

    const isPreview = canvasMode === 'preview';

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex-1 transition-all flex flex-col gap-4 relative border border-dashed border-transparent",
                !isPreview ? "min-h-[120px] p-4" : "p-0",
                editMode === 'columns' && !isPreview && "border-slate-300/40 bg-slate-50/30",
                isOver && "bg-emerald-500/5 border-emerald-500/20 scale-[0.99] shadow-inner"
            )}
        >
            {editMode === 'columns' && !isPreview && (
                <div className="absolute top-1.5 left-3 text-[8px] font-bold text-slate-400/50 uppercase tracking-widest pointer-events-none select-none">
                    Column {colIdx + 1}
                </div>
            )}

            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((block, bIdx) => (
                    <SortableBlock
                        key={block.id}
                        block={block}
                        bIdx={bIdx}
                        total={blocks.length}
                        selected={selectedBlockId === block.id}
                        onSelect={() => { onSelectBlock(block.id); onSetTab('edit'); }}
                        onRemove={() => onRemoveBlock(block.id)}
                        onMove={(dir) => onMoveBlock(block.id, dir)}
                        onDuplicate={() => onDuplicateBlock(block.id)}
                        canvasMode={canvasMode}
                    >
                        <BlockRenderer block={block} ctx={editCtx(block.id)} />
                    </SortableBlock>
                ))}
            </SortableContext>

            {blocks.length === 0 && !isPreview && (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <PlusSquare className="w-5 h-5 text-slate-300 mb-1" />
                    <p className="text-[9px] font-bold text-slate-400">Empty Column {colIdx + 1}</p>
                    <p className="text-[8px] text-slate-300">Drag components here</p>
                </div>
            )}
        </div>
    );
}

// ─── Main Canvas ─────────────────────────────────────────────────────────
const Canvas = React.memo(function Canvas({
    version,
    viewport,
    theme,
    resources,
    selectedBlockId,
    onSelectBlock,
    onSetTab,
    onUpdateBlockProps,
    onRemoveBlock,
    onMoveBlock,
    onDuplicateBlock,
    onRemoveSection,
    onMoveSection,
    onEditSection,
    onSaveSectionAsTemplate,
    onReorderSections,
    onMoveBlockToColumn,
    canvasMode,
    editMode,
    onSetEditMode: _onSetEditMode,
}: CanvasProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const [isMounted, setIsMounted] = React.useState(false);
    const { toast } = useToast();
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    // Per-block edit context: inline edits route back to the block's props.
    const editCtx = (blockId: string): BlockRenderContext => ({
        mode: canvasMode === 'preview' ? 'view' : 'edit',
        theme,
        interpolate: (t) => t,
        resources,
        onPropChange: (patch) => onUpdateBlockProps(blockId, patch),
    });

    const customCollisionDetection: CollisionDetection = (args) => {
        const activeId = args.active.id.toString();
        if (activeId.startsWith('sec_')) {
            const sectionDroppables = args.droppableContainers.filter(
                (c) => c.id.toString().startsWith('sec_')
            );
            return closestCenter({
                ...args,
                droppableContainers: sectionDroppables,
            });
        }

        const blockDroppables = args.droppableContainers.filter(
            (c) => !c.id.toString().startsWith('sec_')
        );
        return closestCenter({
            ...args,
            droppableContainers: blockDroppables,
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        // 1. Dragging a Section
        if (activeId.startsWith('sec_')) {
            if (activeId === overId) return;
            const sections = version.structureJson.sections;
            const fromIndex = sections.findIndex(s => s.id === activeId);
            const toIndex = sections.findIndex(s => s.id === overId);
            if (fromIndex !== -1 && toIndex !== -1) {
                onReorderSections(fromIndex, toIndex);
            }
            return;
        }

        // 2. Dragging a Block (Nestable / Cross-column movement)
        let targetSectionId = '';
        let targetColIdx = 0;
        let targetBlockIndex = 0;

        if (overId.includes('-col-')) {
            const parts = overId.split('-col-');
            targetSectionId = parts[0];
            targetColIdx = parseInt(parts[1], 10);

            const targetSection = version.structureJson.sections.find(s => s.id === targetSectionId);
            if (targetSection) {
                const targetColBlocks = targetSection.blocks.filter(b => ((b.props || {}) as { column?: number }).column === targetColIdx);
                targetBlockIndex = targetColBlocks.length;
            }
        } else {
            let found = false;
            for (const sec of version.structureJson.sections) {
                const bIdx = sec.blocks.findIndex(b => b.id === overId);
                if (bIdx !== -1) {
                    targetSectionId = sec.id;
                    const overBlock = sec.blocks[bIdx];
                    targetColIdx = ((overBlock.props || {}) as { column?: number }).column ?? 0;

                    const colBlocks = sec.blocks.filter(b => ((b.props || {}) as { column?: number }).column === targetColIdx);
                    targetBlockIndex = colBlocks.findIndex(b => b.id === overId);
                    found = true;
                    break;
                }
            }
            if (!found) return;
        }

        onMoveBlockToColumn(activeId, targetSectionId, targetColIdx, targetBlockIndex);
    };

    const sectionIds = version.structureJson.sections.map(s => s.id);

    return (
        <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-start custom-scrollbar gap-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
            {/* Grid Pattern Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <div
                className={cn(
                    "bg-white shadow-2xl shadow-black/20 transition-all duration-500 origin-top overflow-y-auto custom-scrollbar relative",
                    viewport === 'desktop'
                        ? "w-full max-w-[1400px] h-[calc(100vh-11rem)] min-h-[700px] rounded-2xl ring-1 ring-white/10"
                        : viewport === 'tablet'
                        ? "w-[768px] h-[850px] max-h-[calc(100vh-12rem)] rounded-[1.5rem] border-[8px] border-slate-800 ring-1 ring-slate-700"
                        : "w-[390px] h-[850px] max-h-[calc(100vh-12rem)] rounded-[2.5rem] border-[8px] border-slate-800 ring-1 ring-slate-700"
                )}
                onClickCapture={(e) => {
                    if (canvasMode === 'preview') {
                        const target = e.target as HTMLElement;
                        if (target.closest('a') || target.closest('button')) {
                            e.preventDefault();
                            e.stopPropagation();
                            toast({
                                title: "Interaction Disabled",
                                description: "Link navigation and button actions are disabled in preview mode.",
                            });
                        }
                    }
                }}
            >
                <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragEnd={handleDragEnd}>
                    <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                        <div className="divide-y divide-slate-100">
                            {version.structureJson.sections.length > 0 ? (
                                version.structureJson.sections.map((section, idx) => {
                                    const sectionProps = (section.props || {}) as {
                                        heading?: string;
                                        visibilityDevice?: string;
                                        visibilityBehavior?: string;
                                        visibilityTag?: string;
                                        paddingTop?: string;
                                        paddingBottom?: string;
                                        paddingLeft?: string;
                                        paddingRight?: string;
                                        minHeight?: string;
                                        backgroundType?: string;
                                        backgroundColor?: string;
                                        gradientAngle?: number;
                                        gradientFrom?: string;
                                        gradientTo?: string;
                                        backgroundImageUrl?: string;
                                        backgroundVideoUrl?: string;
                                        backgroundAttachment?: string;
                                        backgroundSize?: string;
                                        backgroundPosition?: string;
                                        backgroundRepeat?: string;
                                        layout?: string;
                                        columnGap?: string;
                                        verticalAlign?: string;
                                        overlayColor?: string;
                                        overlayOpacity?: number;
                                    };
                                    const bgType = sectionProps.backgroundType || 'none';
                                    const overlayCol = sectionProps.overlayColor || '#000000';
                                    const overlayOp = sectionProps.overlayOpacity !== undefined ? sectionProps.overlayOpacity : 0;

                                    const padTop = sectionProps.paddingTop || '2.5rem';
                                    const padBottom = sectionProps.paddingBottom || '2.5rem';
                                    const padLeft = sectionProps.paddingLeft || '1.5rem';
                                    const padRight = sectionProps.paddingRight || '1.5rem';
                                    const minHeight = sectionProps.minHeight || 'auto';

                                    const sectionStyle: React.CSSProperties = {
                                        position: 'relative',
                                        overflow: 'hidden',
                                        paddingTop: padTop,
                                        paddingBottom: padBottom,
                                        paddingLeft: padLeft,
                                        paddingRight: padRight,
                                        minHeight: minHeight,
                                        backgroundColor: bgType === 'color' ? sectionProps.backgroundColor : undefined,
                                        backgroundImage: bgType === 'gradient'
                                            ? `linear-gradient(${sectionProps.gradientAngle ?? 135}deg, ${sectionProps.gradientFrom || '#3B5FFF'}, ${sectionProps.gradientTo || '#7C3AED'})`
                                            : bgType === 'image' && sectionProps.backgroundImageUrl ? `url(${sectionProps.backgroundImageUrl})` : undefined,
                                        backgroundAttachment: sectionProps.backgroundAttachment || 'scroll',
                                        backgroundSize: sectionProps.backgroundSize || 'cover',
                                        backgroundPosition: sectionProps.backgroundPosition || 'center',
                                        backgroundRepeat: sectionProps.backgroundRepeat || 'no-repeat',
                                    };

                                    const layout = sectionProps.layout || '1-col';
                                    const colsCount = layout === '2-col' ? 2 : layout === '3-col' ? 3 : layout === '4-col' ? 4 : layout === 'grid' ? 2 : 1;

                                    // Distribute blocks dynamically across columns
                                    const columnsBlocks = Array.from({ length: colsCount }, (_, colIdx) => {
                                        return section.blocks.filter(b => {
                                            const colVal = ((b.props || {}) as { column?: number }).column ?? 0;
                                            if (colIdx === colsCount - 1) {
                                                return colVal >= colIdx;
                                            }
                                            return colVal === colIdx;
                                        });
                                    });

                                    const colGapClass = sectionProps.columnGap === 'small' ? 'gap-4' : sectionProps.columnGap === 'large' ? 'gap-12' : 'gap-8';
                                    const alignClass = sectionProps.verticalAlign === 'center' ? 'items-center' : sectionProps.verticalAlign === 'bottom' ? 'items-end' : 'items-start';

                                    let gridStyle: React.CSSProperties = {};
                                    if (layout === '2-col') {
                                        gridStyle = { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' };
                                    } else if (layout === '3-col') {
                                        gridStyle = { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' };
                                    } else if (layout === '4-col') {
                                        gridStyle = { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' };
                                    } else if (layout === 'grid') {
                                         gridStyle = { gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' };
                                     }

                                     return (
                                         <SortableSection
                                             key={section.id}
                                             section={section}
                                             idx={idx}
                                             total={version.structureJson.sections.length}
                                             onRemove={() => onRemoveSection(section.id)}
                                             onMove={(dir) => onMoveSection(section.id, dir)}
                                             onSave={() => onSaveSectionAsTemplate(section)}
                                             onEdit={() => onEditSection(section.id)}
                                             editMode={editMode}
                                             canvasMode={canvasMode}
                                         >
                                             {/* HTML5 Loop Video Background */}
                                            {bgType === 'video' && sectionProps.backgroundVideoUrl && isMounted && (
                                                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                                                    <video
                                                        src={sectionProps.backgroundVideoUrl}
                                                        autoPlay
                                                        loop
                                                        muted
                                                        playsInline
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            {/* Color Overlay */}
                                            {overlayOp > 0 && (
                                                <div
                                                    className="absolute inset-0 pointer-events-none z-10"
                                                    style={{
                                                        backgroundColor: overlayCol,
                                                        opacity: overlayOp,
                                                    }}
                                                />
                                            )}

                                            <div style={sectionStyle} className="w-full">
                                                <div className="max-w-4xl mx-auto relative z-20">
                                                    {sectionProps.heading && (
                                                        <h2
                                                            className="text-2xl font-bold tracking-tight mb-8"
                                                            style={{ color: theme.colors.text, fontFamily: theme.typography.headingFont }}
                                                        >
                                                            {sectionProps.heading}
                                                        </h2>
                                                    )}

                                                    <div
                                                        className={cn("w-full grid relative z-20", colGapClass, alignClass)}
                                                        style={layout !== '1-col' ? gridStyle : undefined}
                                                    >
                                                        {columnsBlocks.map((colBlocks, colIdx) => (
                                                            <ColumnCell
                                                                key={colIdx}
                                                                sectionId={section.id}
                                                                colIdx={colIdx}
                                                                blocks={colBlocks}
                                                                selectedBlockId={selectedBlockId}
                                                                onSelectBlock={onSelectBlock}
                                                                onSetTab={onSetTab}
                                                                onRemoveBlock={onRemoveBlock}
                                                                onMoveBlock={onMoveBlock}
                                                                onDuplicateBlock={onDuplicateBlock}
                                                                editCtx={editCtx}
                                                                editMode={editMode}
                                                                canvasMode={canvasMode}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </SortableSection>
                                    );
                                })
                            ) : (
                                <div className="p-24 text-center space-y-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center border border-slate-200 border-dashed">
                                        <PlusSquare className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold">Start building your page</h3>
                                        <p className="text-xs text-slate-500 mt-1">Add sections from the sidebar or start with an empty layout.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </main>
    );
});

export default Canvas;

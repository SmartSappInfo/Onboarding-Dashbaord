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

interface CanvasProps {
    version: CampaignPageVersion;
    viewport: 'desktop' | 'mobile';
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
}

// ─── Sortable Section Wrapper ────────────────────────────────────────────
function SortableSection({ section, idx, total, children, onRemove, onMove, onSave, onEdit }: {
    section: PageSection;
    idx: number;
    total: number;
    children: React.ReactNode;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onSave: () => void;
    onEdit: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group relative p-8 md:p-12 transition-all border-2 border-transparent hover:border-emerald-500/20 border-dashed rounded-xl",
                isDragging && "z-50 shadow-2xl ring-2 ring-emerald-500/30"
            )}
        >
            {/* Section Controls - Top Left */}
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
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
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                </Button>
                <Button
                    variant="secondary" size="icon"
                    className="h-7 w-7 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                    onClick={(e) => { e.stopPropagation(); onSave(); }}
                    title="Save section as template"
                >
                    <FolderHeart className="w-3.5 h-3.5" />
                </Button>
            </div>

            {/* Section Controls - Top Right */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10">
                <Button variant="secondary" size="icon" className="h-6 w-6 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-emerald-400 disabled:opacity-30" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); onMove('up'); }}>
                    <ArrowUp className="w-3 h-3" />
                </Button>
                <Button variant="secondary" size="icon" className="h-6 w-6 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-emerald-400 disabled:opacity-30" disabled={idx === total - 1} onClick={(e) => { e.stopPropagation(); onMove('down'); }}>
                    <ArrowDown className="w-3 h-3" />
                </Button>
                <Button variant="secondary" size="icon" className="h-6 w-6 rounded-lg shadow-sm border border-slate-700 bg-slate-900 hover:text-red-400 transition-all" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>

            {children}
        </div>
    );
}

// ─── Sortable Block Wrapper ──────────────────────────────────────────────
function SortableBlock({ block, bIdx, total, selected, onSelect, onRemove, onMove, onDuplicate, children }: {
    block: PageBlock;
    bIdx: number;
    total: number;
    selected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onDuplicate: () => void;
    children: React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={cn(
                "p-4 bg-white ring-1 ring-slate-200 rounded-xl relative hover:ring-2 hover:ring-emerald-500/40 shadow-sm transition-all cursor-pointer group/block",
                selected && "ring-2 ring-emerald-500 bg-emerald-50/50",
                isDragging && "z-50 shadow-2xl"
            )}
        >
            {/* Block Controls */}
            <div className="absolute -top-3 -right-2 opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center gap-1 z-10 scale-90 origin-right">
                <div
                    {...attributes}
                    {...listeners}
                    className="h-5 w-5 rounded-full shadow-md bg-white hover:bg-emerald-50 border border-slate-200 flex items-center justify-center cursor-grab active:cursor-grabbing"
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

            {children}
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
    onReorderBlocks,
}: CanvasProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Per-block edit context: inline edits route back to the block's props.
    const editCtx = (blockId: string): BlockRenderContext => ({
        mode: 'edit',
        theme,
        interpolate: (t) => t,
        resources,
        onPropChange: (patch) => onUpdateBlockProps(blockId, patch),
    });

    const handleSectionDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const sections = version.structureJson.sections;
        const fromIndex = sections.findIndex(s => s.id === active.id);
        const toIndex = sections.findIndex(s => s.id === over.id);
        if (fromIndex !== -1 && toIndex !== -1) {
            onReorderSections(fromIndex, toIndex);
        }
    };

    const sectionIds = version.structureJson.sections.map(s => s.id);

    return (
        <main className="flex-1 overflow-y-auto p-8 flex justify-center custom-scrollbar" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
            {/* Grid Pattern Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <div
                className={cn(
                    "bg-white shadow-2xl shadow-black/20 transition-all duration-500 origin-top overflow-hidden min-h-[800px] relative",
                    viewport === 'desktop'
                        ? "w-full max-w-5xl rounded-2xl ring-1 ring-white/10"
                        : "w-[390px] rounded-[2.5rem] border-[8px] border-slate-800 ring-1 ring-slate-700"
                )}
            >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                    <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                        <div className="divide-y divide-slate-100">
                            {version.structureJson.sections.length > 0 ? (
                                version.structureJson.sections.map((section, idx) => (
                                    <SortableSection
                                        key={section.id}
                                        section={section}
                                        idx={idx}
                                        total={version.structureJson.sections.length}
                                        onRemove={() => onRemoveSection(section.id)}
                                        onMove={(dir) => onMoveSection(section.id, dir)}
                                        onSave={() => onSaveSectionAsTemplate(section)}
                                        onEdit={() => onEditSection(section.id)}
                                    >
                                        <div className="max-w-4xl mx-auto space-y-4">
                                            {section.blocks.length > 0 ? (
                                                <SortableContext items={section.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                                    {section.blocks.map((block, bIdx) => (
                                                        <SortableBlock
                                                            key={block.id}
                                                            block={block}
                                                            bIdx={bIdx}
                                                            total={section.blocks.length}
                                                            selected={selectedBlockId === block.id}
                                                            onSelect={() => { onSelectBlock(block.id); onSetTab('edit'); }}
                                                            onRemove={() => onRemoveBlock(block.id)}
                                                            onMove={(dir) => onMoveBlock(block.id, dir)}
                                                            onDuplicate={() => onDuplicateBlock(block.id)}
                                                        >
                                                            <BlockRenderer block={block} ctx={editCtx(block.id)} />
                                                        </SortableBlock>
                                                    ))}
                                                </SortableContext>
                                            ) : (
                                                <div
                                                    className="py-20 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-4 group/empty hover:border-emerald-500/30 transition-all cursor-pointer"
                                                    onClick={() => onSetTab('add')}
                                                >
                                                    <div className="p-4 bg-slate-50 rounded-full group-hover/empty:scale-110 group-hover/empty:bg-emerald-500/5 transition-all">
                                                        <PlusSquare className="w-8 h-8 text-slate-300 group-hover/empty:text-emerald-500/40" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs font-bold text-slate-400 group-hover/empty:text-emerald-500/60">Empty Section</p>
                                                        <p className="text-[10px] text-slate-300 mt-1">Click to add blocks</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </SortableSection>
                                ))
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

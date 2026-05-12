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
    Zap,
    Type,
    MousePointer2,
    ClipboardList,
    FileCheck,
    HelpCircle,
    ImageIcon,
    Film,
    Quote,
    BarChart3,
    ArrowRight,
} from 'lucide-react';
import type { PageSection, PageBlock, CampaignPageVersion } from '@/lib/types';

interface CanvasProps {
    version: CampaignPageVersion;
    viewport: 'desktop' | 'mobile';
    selectedBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onSetTab: (tab: string) => void;
    onUpdateBlockProps: (blockId: string, props: Record<string, any>) => void;
    onRemoveBlock: (blockId: string) => void;
    onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
    onDuplicateBlock: (blockId: string) => void;
    onRemoveSection: (sectionId: string) => void;
    onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
    onSaveSectionAsTemplate: (section: PageSection) => void;
    onReorderSections: (from: number, to: number) => void;
    onReorderBlocks: (sectionId: string, from: number, to: number) => void;
}

// ─── Sortable Section Wrapper ────────────────────────────────────────────
function SortableSection({ section, idx, total, children, onRemove, onMove, onSave }: {
    section: PageSection;
    idx: number;
    total: number;
    children: React.ReactNode;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onSave: () => void;
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
                    onClick={(e) => { e.stopPropagation(); onSave(); }}
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

// ─── Block Preview Renderer ──────────────────────────────────────────────
function BlockPreview({ block, onUpdateProps }: { block: PageBlock; onUpdateProps: (id: string, props: Record<string, any>) => void }) {
    switch (block.type) {
        case 'hero':
            return (
                <div className="text-center space-y-4 py-8">
                    <input
                        className="w-full text-4xl font-bold tracking-tight text-slate-900 text-center bg-transparent border-none outline-none focus:ring-0 placeholder:opacity-30"
                        value={block.props.title || ''}
                        onChange={(e) => onUpdateProps(block.id, { title: e.target.value })}
                        placeholder="Hero Title"
                    />
                    <textarea
                        className="w-full text-lg text-slate-500 text-center bg-transparent border-none outline-none focus:ring-0 resize-none placeholder:opacity-30 px-4"
                        value={block.props.subtitle || ''}
                        onChange={(e) => {
                            onUpdateProps(block.id, { subtitle: e.target.value });
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        placeholder="Hero subtitle text"
                        rows={2}
                    />
                </div>
            );

        case 'text':
            return (
                <div className="prose prose-slate max-w-none">
                    {block.props.content ? (
                        <div dangerouslySetInnerHTML={{ __html: block.props.content }} className="text-sm text-slate-600 p-2" />
                    ) : (
                        <p className="text-sm text-slate-300 italic p-2">Click to edit rich text content...</p>
                    )}
                </div>
            );

        case 'image':
            return block.props.src ? (
                <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                    <img src={block.props.src} alt={block.props.alt || ''} className="w-full h-auto max-h-[300px] object-cover" />
                    {block.props.caption && <p className="text-xs text-slate-500 text-center py-2 italic">{block.props.caption}</p>}
                </div>
            ) : (
                <div className="h-40 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                    <span className="text-xs text-slate-400 font-medium">Add an image URL in the editor</span>
                </div>
            );

        case 'video':
            return block.props.url ? (
                <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <Film className="w-12 h-12 text-white/30" />
                    <span className="absolute text-xs text-white/50 mt-16 font-medium">Video embed: {block.props.url}</span>
                </div>
            ) : (
                <div className="h-40 bg-slate-900 rounded-xl flex flex-col items-center justify-center gap-2">
                    <Film className="w-8 h-8 text-slate-600" />
                    <span className="text-xs text-slate-500 font-medium">Add a video URL</span>
                </div>
            );

        case 'cta':
            return (
                <div className="flex justify-center py-4">
                    <Button
                        variant={block.props.variant === 'secondary' ? 'outline' : 'default'}
                        className={cn(
                            "h-12 px-8 rounded-xl font-bold gap-2",
                            block.props.variant === 'glass' && "bg-white/20 backdrop-blur-md border border-white/30 text-slate-900",
                            block.props.variant === 'glow' && "shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        )}
                    >
                        {block.props.label || 'Button Label'}
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            );

        case 'spacer':
            return (
                <div className="flex items-center justify-center group/spacer" style={{ height: block.props.height || 48 }}>
                    <div className="border-t-2 border-dashed border-slate-200 w-full relative">
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 bg-white px-2 font-bold opacity-0 group-hover/spacer:opacity-100 transition-opacity">
                            {block.props.height || 48}px
                        </span>
                    </div>
                </div>
            );

        case 'divider':
            return (
                <div className="py-4">
                    <hr className={cn(
                        "border-t-2",
                        block.props.style === 'dashed' && "border-dashed",
                        block.props.style === 'dotted' && "border-dotted",
                        block.props.style === 'gradient' && "border-none h-0.5 bg-gradient-to-r from-transparent via-slate-300 to-transparent"
                    )} style={block.props.style !== 'gradient' ? { borderColor: block.props.color || '#e2e8f0' } : undefined} />
                </div>
            );

        case 'form':
            return (
                <div className="max-w-md mx-auto space-y-4 p-10 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ClipboardList className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold">Embedded Form</h3>
                    {block.props.formId ? (
                        <p className="text-xs text-slate-500">Linked: <span className="font-bold text-slate-900">{block.props.formId}</span></p>
                    ) : (
                        <p className="text-xs text-amber-500 font-medium italic">No form selected</p>
                    )}
                </div>
            );

        case 'faq':
            return (
                <div className="space-y-2 max-w-2xl mx-auto">
                    <h3 className="text-lg font-bold text-slate-800 mb-3"><HelpCircle className="inline w-5 h-5 mr-2 text-emerald-500" />FAQ</h3>
                    {(block.props.items || []).length > 0 ? (
                        block.props.items.map((item: any) => (
                            <div key={item.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="font-bold text-sm text-slate-800">{item.question}</p>
                                <p className="text-xs text-slate-500 mt-1">{item.answer}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 italic text-center py-4">No FAQ items</p>
                    )}
                </div>
            );

        case 'testimonial':
            return (
                <div className="max-w-md mx-auto p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-3">
                    <Quote className="w-8 h-8 text-emerald-400/30 mx-auto" />
                    <p className="text-sm italic text-slate-600">{block.props.quote || 'Add a testimonial quote...'}</p>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{block.props.author || 'Author Name'}</p>
                        <p className="text-[10px] text-slate-500">{block.props.role || 'Role / Company'}</p>
                    </div>
                </div>
            );

        case 'stats':
            return (
                <div className="grid grid-cols-3 gap-4 text-center">
                    {(block.props.items || []).length > 0 ? (
                        block.props.items.map((item: any) => (
                            <div key={item.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-2xl font-black text-emerald-600">{item.value}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{item.label}</p>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-3 text-center py-4">
                            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-400 italic">Add stat items in the editor</p>
                        </div>
                    )}
                </div>
            );

        case 'html':
            return (
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 text-slate-400 font-mono text-[9px] overflow-hidden opacity-80 relative h-[120px]">
                    <code className="block whitespace-pre text-emerald-400/80">{block.props.html || '<!-- Write your HTML here -->'}</code>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
                    <div className="absolute top-2 right-2 bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[8px] font-bold">CUSTOM CODE</div>
                </div>
            );

        case 'survey':
        case 'agreement':
            return (
                <div className="max-w-md mx-auto space-y-4 p-10 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4", block.type === 'survey' ? "bg-indigo-100" : "bg-emerald-100")}>
                        {block.type === 'survey' ? <HelpCircle className="h-6 w-6 text-indigo-600" /> : <FileCheck className="h-6 w-6 text-emerald-600" />}
                    </div>
                    <h3 className="text-lg font-bold">{block.type === 'survey' ? 'Embedded Survey' : 'Agreement Embed'}</h3>
                    <p className="text-xs text-slate-500 truncate">{block.props.surveyId || block.props.agreementId || 'None Selected'}</p>
                </div>
            );

        default:
            return (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-400 font-medium">Block: {block.type}</p>
                </div>
            );
    }
}

// ─── Main Canvas ─────────────────────────────────────────────────────────
const Canvas = React.memo(function Canvas({
    version,
    viewport,
    selectedBlockId,
    onSelectBlock,
    onSetTab,
    onUpdateBlockProps,
    onRemoveBlock,
    onMoveBlock,
    onDuplicateBlock,
    onRemoveSection,
    onMoveSection,
    onSaveSectionAsTemplate,
    onReorderSections,
    onReorderBlocks,
}: CanvasProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

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
                                                            <BlockPreview block={block} onUpdateProps={onUpdateBlockProps} />
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

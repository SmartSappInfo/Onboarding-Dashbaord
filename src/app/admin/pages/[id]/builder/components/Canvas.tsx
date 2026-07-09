'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    horizontalListSortingStrategy,
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
    ArrowLeft,
    ArrowRight,
    FolderHeart,
    PlusSquare,
    Plus,
    Copy,
    SlidersHorizontal,
    ZoomIn,
    ZoomOut,
    Hand,
    MousePointer,
    RotateCcw,
    User,
    AlertTriangle,
    MessageSquare,
    Phone,
    MonitorPlay,
    Tablet,
    Smartphone,
    Search,
    Facebook,
    Twitter,
    Linkedin,
    Instagram,
    Youtube,
    MapPin,
    Mail,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    List,
    ListOrdered,
    Quote,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Link2,
    RemoveFormatting,
    Baseline,
    ChevronDown,
    CaseSensitive,
    Check,
    X
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { PageSection, PageBlock, CampaignPageVersion, ResolvedTheme, BuilderResources, PageHeaderSettings, PageFooterSettings } from '@/lib/types';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks'; // register all blocks
import { useToast } from '@/hooks/use-toast';
import { SmartSappLogo } from '@/components/icons';
import Footer from '@/components/footer';

interface CanvasProps {
    version: CampaignPageVersion;
    viewport: 'desktop' | 'tablet' | 'mobile';
    theme: ResolvedTheme;
    page?: { id: string; organizationId: string; workspaceId: string };
    resources: BuilderResources;
    selectedBlockId: string | null;
    selectedSectionId?: string | null;
    selectedColumnIndex?: number | null;
    onSelectBlock: (id: string | null) => void;
    themeMode: 'light' | 'dark';

    onSetTab: (tab: string) => void;
    onUpdateBlockProps: (blockId: string, props: Record<string, unknown>) => void;
    onRemoveBlock: (blockId: string) => void;
    onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
    onDuplicateBlock: (blockId: string) => void;
    onRemoveSection: (sectionId: string) => void;
    onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
    onInsertSection?: (index: number) => void;
    onEditSection: (sectionId: string, columnIndex?: number | null) => void;
    onSaveSectionAsTemplate: (section: PageSection) => void;

    onReorderSections: (from: number, to: number) => void;
    onReorderBlocks: (sectionId: string, from: number, to: number) => void;
    onMoveBlockToColumn: (blockId: string, targetSectionId: string, targetColumnIndex: number, targetIndex: number) => void;
    onSwapColumns?: (sectionId: string, fromColumnIndex: number, toColumnIndex: number) => void;
    canvasMode: 'edit' | 'preview';
    editMode: 'columns' | 'components';
    onSetEditMode: (mode: 'columns' | 'components') => void;
    showHeader?: boolean;
    showFooter?: boolean;
    onClickHeader?: () => void;
    onClickFooter?: () => void;
    onUpdateHeader?: (updates: Partial<PageHeaderSettings>) => void;
    onUpdateFooter?: (updates: Partial<PageFooterSettings>) => void;
    onSetViewport?: (viewport: 'desktop' | 'tablet' | 'mobile') => void;
}

// Custom PointerSensor to support custom scaled drag offsets without escaping pointer bounds
class ZoomPointerSensor extends PointerSensor {
    static activators = [
        {
            eventName: 'onPointerDown' as const,
            handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) => {
                const target = event.target as HTMLElement | null;
                if (
                    target?.closest('button') || 
                    target?.closest('input') || 
                    target?.closest('textarea') || 
                    target?.closest('[contenteditable="true"]') ||
                    event.button !== 0 // Only left click triggers drag
                ) {
                    return false;
                }
                return true;
            },
        },
    ];
}

// ─── Sortable Section Wrapper ────────────────────────────────────────────
function SortableSection({ section, idx, total, children, onRemove, onMove, onSave, onEdit, editMode, canvasMode, selected }: {
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
    selected?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, disabled: canvasMode === 'preview' });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const isPreview = canvasMode === 'preview';

    const isGlobal = section.props.category === 'global';

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={(e) => {
                if (!isPreview) {
                    e.stopPropagation();
                    onEdit();
                }
            }}
            className={cn(
                isPreview 
                    ? "group/section relative transition-all border-none rounded-none m-0 p-0"
                    : "group/section relative transition-all border border-dashed border-transparent hover:border-slate-350 dark:hover:border-slate-700 rounded-none p-0 m-0",
                !isPreview && (
                    isGlobal
                        ? "bg-purple-500/5 hover:bg-purple-500/10"
                        : editMode === 'columns'
                        ? "hover:bg-emerald-500/5"
                        : "hover:bg-slate-750/5"
                ),
                !isPreview && selected && "border-solid border-emerald-500/50 ring-2 ring-emerald-500/10",
                isDragging && "z-50 shadow-2xl ring-2 ring-emerald-500/30"
            )}
        >
            {/* Professional Section Left Toolbar Panel */}
            {!isPreview && (
                <div
                    className={cn(
                        "absolute -left-16 top-4 w-16 pl-2 pr-4 py-2 z-40 transition-all duration-300",
                        selected
                            ? "opacity-100 scale-100 pointer-events-auto"
                            : "opacity-0 scale-95 pointer-events-none group-hover/section:opacity-100 group-hover/section:scale-100 group-hover/section:pointer-events-auto"
                    )}
                >
                    <div
                        className={cn(
                            "w-10 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center py-2.5 gap-2 shadow-xl",
                            selected && "ring-2 ring-emerald-500/20"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(); // Make sure clicking the toolbar activates the section!
                        }}
                    >
                        {/* Drag Handle */}
                        <div
                            {...attributes}
                            {...listeners}
                            className="w-7 h-7 bg-slate-950 border border-slate-800 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors duration-200"
                            title="Drag to move section up or down"
                        >
                            <GripVertical className="w-4 h-4" />
                        </div>

                        <div className="w-6 h-[1px] bg-slate-800" />

                        {/* Up button */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onMove('up'); }}
                            disabled={idx === 0}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 rounded-lg disabled:opacity-20 disabled:pointer-events-none transition-colors duration-200 cursor-pointer"
                            aria-label="Move Section Up"
                            title="Move Section Up"
                        >
                            <ArrowUp className="w-4 h-4" aria-hidden="true" />
                        </button>

                        {/* Down button */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onMove('down'); }}
                            disabled={idx === total - 1}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 rounded-lg disabled:opacity-20 disabled:pointer-events-none transition-colors duration-200 cursor-pointer"
                            aria-label="Move Section Down"
                            title="Move Section Down"
                        >
                            <ArrowDown className="w-4 h-4" aria-hidden="true" />
                        </button>

                        <div className="w-6 h-[1px] bg-slate-800" />

                        {/* Edit Config button */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className={cn(
                                "w-7 h-7 flex items-center justify-center rounded-lg transition-colors duration-200 cursor-pointer",
                                selected
                                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                                    : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50"
                            )}
                            aria-label="Section Settings"
                            title="Section Settings"
                        >
                            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                        </button>

                        {/* Save Template button */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onSave(); }}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-violet-400 hover:bg-slate-800/50 rounded-lg transition-colors duration-200 cursor-pointer"
                            aria-label="Save Section as Template"
                            title="Save as Template"
                        >
                            <FolderHeart className="w-4 h-4" aria-hidden="true" />
                        </button>

                        {/* Delete button */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-colors duration-200 cursor-pointer"
                            aria-label="Delete Section"
                            title="Delete Section"
                        >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}

            {children}
        </div>
    );
}

interface SectionInserterLineProps {
    onClick: () => void;
}

function SectionInserterLine({ onClick }: SectionInserterLineProps) {
    return (
        <div className="group/inserter h-0 relative w-full flex items-center justify-center z-35 select-none pointer-events-none">
            <div className="absolute inset-x-0 h-3 -top-1.5 bg-transparent group-hover/inserter:bg-emerald-500 pointer-events-auto cursor-pointer transition-colors" />
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                className="absolute scale-0 group-hover/inserter:scale-100 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg transition-all active:scale-[0.96] z-40 border-0 cursor-pointer pointer-events-auto"
            >
                <Plus className="w-2.5 h-2.5" /> Add Section
            </button>
        </div>
    );
}
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
                isPreview 
                    ? "p-0 bg-transparent ring-0 border-none shadow-none relative transition-all group/block" 
                    : "p-4 bg-transparent border border-dashed border-slate-350/40 dark:border-slate-700/40 rounded-xl relative hover:border-slate-500/60 hover:bg-slate-750/5 transition-all group/block",
                !isPreview && "cursor-pointer",
                selected && !isPreview && "ring-2 ring-blue-500/80 border-solid border-blue-500/50 bg-blue-500/5",
                isDragging && "z-50 shadow-2xl bg-slate-800/80"
            )}
        >
            {/* Selected Block Info Tag */}
            {selected && !isPreview && (
                <div className="absolute -top-2.5 left-2 bg-blue-600 text-white text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded shadow-sm z-30 select-none pointer-events-none">
                    {block.props.customLabel as string || block.type}
                </div>
            )}

            {/* Block Controls */}
            {!isPreview && (
                <div className="absolute -top-3 -right-2 opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center gap-1 z-20 scale-90 origin-right">
                    <div
                        {...attributes}
                        {...listeners}
                        className="h-5 w-5 rounded-full shadow-md bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors"
                        aria-label="Drag block to reorder"
                        title="Drag block to reorder"
                        role="button"
                        tabIndex={0}
                    >
                        <GripVertical className="w-2.5 h-2.5 text-slate-800 dark:text-slate-200" aria-hidden="true" />
                    </div>
                    <Button variant="secondary" size="icon" className="h-5 w-5 rounded-full shadow-md bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-150 dark:border-zinc-800 disabled:opacity-30 transition-colors" disabled={bIdx === 0} onClick={(e) => { e.stopPropagation(); onMove('up'); }} aria-label="Move block up" title="Move block up">
                        <ArrowUp className="w-2.5 h-2.5" aria-hidden="true" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-5 w-5 rounded-full shadow-md bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-150 dark:border-zinc-800 disabled:opacity-30 transition-colors" disabled={bIdx === total - 1} onClick={(e) => { e.stopPropagation(); onMove('down'); }} aria-label="Move block down" title="Move block down">
                        <ArrowDown className="w-2.5 h-2.5" aria-hidden="true" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-5 w-5 rounded-full shadow-md bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-150 dark:border-zinc-800 transition-colors" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} aria-label="Duplicate block" title="Duplicate block">
                        <Copy className="w-2.5 h-2.5" aria-hidden="true" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-5 w-5 rounded-full shadow-md bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-150 dark:border-zinc-800 transition-colors" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Delete block" title="Delete block">
                        <Trash2 className="w-2.5 h-2.5" aria-hidden="true" />
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
    selectedSectionId,
    selectedColumnIndex,
    onSelectBlock,
    onSetTab,
    onRemoveBlock,
    onMoveBlock,
    onDuplicateBlock,
    editCtx,
    editMode,
    canvasMode,
    totalColumns,
    onSwapColumns,
    onEditSection,
}: {
    sectionId: string;
    colIdx: number;
    blocks: PageBlock[];
    selectedBlockId: string | null;
    selectedSectionId?: string | null;
    selectedColumnIndex?: number | null;
    onSelectBlock: (id: string | null) => void;
    onSetTab: (tab: string) => void;
    onRemoveBlock: (blockId: string) => void;
    onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
    onDuplicateBlock: (blockId: string) => void;
    editCtx: (blockId: string) => BlockRenderContext;
    editMode: 'columns' | 'components';
    canvasMode: 'edit' | 'preview';
    totalColumns: number;
    onSwapColumns?: (sectionId: string, fromIdx: number, toIdx: number) => void;
    onEditSection?: (sectionId: string, columnIndex?: number | null) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver
    } = useSortable({
        id: `col-${sectionId}-${colIdx}`,
        data: {
            type: 'column',
            sectionId,
            columnIndex: colIdx,
        },
        disabled: canvasMode === 'preview' || editMode !== 'columns',
    });

    const blockIds = blocks.map(b => b.id);
    const isPreview = canvasMode === 'preview';

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={(e) => {
                if (!isPreview) {
                    e.stopPropagation();
                    onEditSection?.(sectionId, colIdx);
                }
            }}
            className={cn(
                "flex-1 min-h-[120px] p-4 rounded-xl flex flex-col gap-4 transition-all duration-300 relative",
                !isPreview && (
                    editMode === 'columns'
                        ? selectedSectionId === sectionId && selectedColumnIndex === colIdx
                            ? "bg-emerald-50/10 dark:bg-emerald-950/15 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                            : "bg-slate-50/50 dark:bg-zinc-900/30 border-2 border-dashed border-emerald-500/40 hover:border-emerald-500/70"
                        : selectedSectionId === sectionId && selectedColumnIndex === colIdx
                            ? "bg-blue-500/5 dark:bg-blue-950/10 border-2 border-dashed border-blue-500/60"
                            : "bg-transparent border border-dashed border-slate-350/20 dark:border-slate-700/20 hover:border-blue-500/30"
                ),
                isOver && "bg-blue-500/5 border-blue-500/30 scale-[0.99] border-dashed ring-2 ring-blue-500/10"
            )}
        >
            {!isPreview && editMode === 'columns' && (
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[8px] font-black uppercase text-slate-400 tracking-wider mb-2 select-none z-10 shrink-0">
                    <div className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                        <GripVertical className="w-3 h-3 text-slate-500" />
                        <span>Column {colIdx + 1}</span>
                    </div>
                    <div className="flex items-center gap-1 pointer-events-auto">
                        {colIdx > 0 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSwapColumns?.(sectionId, colIdx, colIdx - 1);
                                }}
                                className="p-0.5 hover:text-white transition-colors cursor-pointer"
                            >
                                <ArrowLeft className="w-3 h-3" />
                            </button>
                        )}
                        {colIdx < totalColumns - 1 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSwapColumns?.(sectionId, colIdx, colIdx + 1);
                                }}
                                className="p-0.5 hover:text-white transition-colors cursor-pointer"
                            >
                                <ArrowRight className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {!isPreview && editMode === 'components' && (
                <div className="absolute top-2 left-2 text-[8px] font-black uppercase text-slate-400 bg-slate-100 px-1 py-0.5 rounded select-none">
                    Col {colIdx + 1}
                </div>
            )}

            <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                {blocks.map((block, bIdx) => {
                    const ctx = editCtx(block.id);
                    return (
                        <SortableBlock
                            key={block.id}
                            block={block}
                            bIdx={bIdx}
                            total={blocks.length}
                            selected={selectedBlockId === block.id}
                            onSelect={() => {
                                onSelectBlock(block.id);
                                onSetTab('edit');
                            }}
                            onRemove={() => onRemoveBlock(block.id)}
                            onMove={(dir) => onMoveBlock(block.id, dir)}
                            onDuplicate={() => onDuplicateBlock(block.id)}
                            canvasMode={canvasMode}
                        >
                            <BlockRenderer block={block} ctx={ctx} />
                        </SortableBlock>
                    );
                })}
            </SortableContext>

            {blocks.length === 0 && !isPreview && (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-slate-400/80 select-none">
                    <p className="text-[10px] font-bold uppercase tracking-wider">Empty Column</p>
                    <p className="text-[9px] mt-0.5 text-slate-500 leading-tight">Drag and drop or select items to place blocks here.</p>
                </div>
            )}
        </div>
    );
}

// ─── Main Canvas Component ───────────────────────────────────────────────
const Canvas = React.forwardRef<HTMLDivElement, CanvasProps>(({
    version,
    viewport,
    theme,
    page,
    resources,
    selectedBlockId,
    selectedSectionId,
    selectedColumnIndex,
    onSelectBlock,
    themeMode,

    onSetTab,
    onUpdateBlockProps,
    onRemoveBlock,
    onMoveBlock,
    onDuplicateBlock,
    onRemoveSection,
    onMoveSection,
    onInsertSection,
    onEditSection,
    onSaveSectionAsTemplate,

    onReorderSections,
    onMoveBlockToColumn,
    onSwapColumns,
    canvasMode,
    editMode,
    onSetEditMode: _onSetEditMode,
    showHeader,
    showFooter,
    onClickHeader,
    onClickFooter,
    onUpdateHeader,
    onUpdateFooter,
    onSetViewport,
}, ref) => {
    // Canvas Viewport Panning & Zooming Engine States
    const [zoom, setZoom] = useState(1.0);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panToolActive, setPanToolActive] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Ghana Profile Simulation States
    const [simulatedProfile, setSimulatedProfile] = useState<'none' | 'parent' | 'student'>('none');

    // Collaborative Comments Mode States
    const [commentsMode, setCommentsMode] = useState(false);
    const [comments, setComments] = useState<{ id: string; x: number; y: number; text: string }[]>([]);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [newCommentPos, setNewCommentPos] = useState<{ x: number; y: number } | null>(null);
    const [newCommentText, setNewCommentText] = useState('');

    // Inline Link Editing States
    const [linkUrl, setLinkUrl] = useState('');
    const [linkNewTab, setLinkNewTab] = useState(false);

    const toolbarRef = useRef<HTMLDivElement>(null);

    const activeBlockType = React.useMemo(() => {
        if (!selectedBlockId) return null;
        for (const sec of version.structureJson.sections) {
            for (const b of sec.blocks) {
                if (b.id === selectedBlockId) {
                    return b.type;
                }
            }
        }
        return null;
    }, [selectedBlockId, version.structureJson.sections]);

    const breadcrumbPath = React.useMemo(() => {
        if (!selectedBlockId) return null;
        for (const sec of version.structureJson.sections) {
            for (const b of sec.blocks) {
                if (b.id === selectedBlockId) {
                    const colVal = (b.props?.column as number) ?? 0;
                    return [
                        { label: 'Page', type: 'page' },
                        { label: (sec.props.name as string) || (sec.props.category as string) || 'Section', type: 'section', id: sec.id },
                        { label: `Column ${colVal + 1}`, type: 'column' },
                        { label: (b.props.customLabel as string) || b.type, type: 'block', id: b.id }
                    ];
                }
            }
        }
        return null;
    }, [selectedBlockId, version.structureJson.sections]);
    const panStartRef = useRef({ x: 0, y: 0 });
    const workspaceRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const savedSelectionRangeRef = useRef<Range | null>(null);

    React.useLayoutEffect(() => {
        if (savedSelectionRangeRef.current) {
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(savedSelectionRangeRef.current);
            }
            savedSelectionRangeRef.current = null;
        }
    });

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const toolbar = toolbarRef.current;
        if (activeBlockType !== 'text' || !selectedBlockId) {
            if (toolbar) toolbar.style.display = 'none';
            return;
        }

        const updatePosition = () => {
            const activeEl = document.getElementById(`text-block-${selectedBlockId}`);
            const workspace = workspaceRef.current;
            const tb = toolbarRef.current;
            if (!activeEl || !workspace || !tb) {
                if (tb) tb.style.display = 'none';
                return;
            }

            const rect = activeEl.getBoundingClientRect();
            const workspaceRect = workspace.getBoundingClientRect();
            
            const toolbarW = 620;
            const toolbarH = 42;
            
            const top = rect.top - workspaceRect.top - toolbarH - 12; // 12px gap above
            const left = rect.left - workspaceRect.left + (rect.width - toolbarW) / 2;

            const finalTop = Math.max(10, top);
            const finalLeft = Math.max(10, Math.min(workspaceRect.width - toolbarW - 10, left));

            tb.style.top = `${finalTop}px`;
            tb.style.left = `${finalLeft}px`;
            tb.style.display = 'flex';
        };

        // Defer execution to guarantee DOM paint has finished
        const rafId = requestAnimationFrame(() => {
            updatePosition();
        });

        const timeoutId = setTimeout(updatePosition, 50);

        window.addEventListener('resize', updatePosition);
        document.addEventListener('selectionchange', updatePosition);
        
        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updatePosition);
            document.removeEventListener('selectionchange', updatePosition);
        };
    }, [selectedBlockId, activeBlockType, zoom, panOffset]);

    // Bounded canvas offset constraint logic
    const clampPanOffset = useCallback((x: number, y: number, currentZoom: number) => {
        const workspace = workspaceRef.current;
        const canvas = canvasRef.current;
        if (!workspace || !canvas) return { x, y };

        const rectW = workspace.clientWidth;
        const rectH = workspace.clientHeight;
        const canvasW = canvas.clientWidth;
        const canvasH = canvas.clientHeight;

        const halfW = rectW / 2;
        const halfH = rectH / 2;
        const scaledW = (canvasW * currentZoom) / 2;
        const scaledH = (canvasH * currentZoom) / 2;

        const gap = 48;

        let minX = 0;
        let maxX = 0;
        if (canvasW * currentZoom > rectW) {
            maxX = scaledW - halfW + gap;
            minX = halfW - scaledW - gap;
        } else {
            // Keep centered horizontally if it fits inside the viewport
            minX = 0;
            maxX = 0;
        }

        let minY = 0;
        let maxY = 0;
        if (canvasH * currentZoom > rectH) {
            maxY = scaledH - halfH + gap;
            minY = halfH - scaledH - gap;
        } else {
            // Keep centered vertically if it fits inside the viewport
            minY = 0;
            maxY = 0;
        }

        return {
            x: Math.min(Math.max(x, minX), maxX),
            y: Math.min(Math.max(y, minY), maxY),
        };
    }, []);
    const { toast } = useToast();

    const sensors = useSensors(
        useSensor(ZoomPointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Spacebar listener to toggle Hand/Pan mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && document.activeElement === document.body) {
                e.preventDefault();
                setPanToolActive(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setPanToolActive(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Scroll Wheel Zoom and Pan (Native listener to allow e.preventDefault() on passive Chrome listeners)
    useEffect(() => {
        const workspace = workspaceRef.current;
        if (!workspace) return;

        const handleNativeWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = -e.deltaY * 0.005;
                setZoom(prev => {
                    const nextZoom = Math.min(Math.max(0.3, prev + delta), 2.0);
                    setPanOffset(cur => clampPanOffset(cur.x, cur.y, nextZoom));
                    return nextZoom;
                });
            } else {
                e.preventDefault();
                setPanOffset(prev => clampPanOffset(
                    prev.x - e.deltaX * 0.8,
                    prev.y - e.deltaY * 0.8,
                    zoom
                ));
            }
        };

        workspace.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => {
            workspace.removeEventListener('wheel', handleNativeWheel);
        };
    }, [zoom, clampPanOffset]);

    // Re-clamp panning coordinates when zoom, viewport, or mounting state changes
    useEffect(() => {
        if (isMounted) {
            setPanOffset(prev => clampPanOffset(prev.x, prev.y, zoom));
        }
    }, [viewport, zoom, isMounted, clampPanOffset]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const isMiddleClick = e.button === 1;
        if (panToolActive || isMiddleClick) {
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = {
                x: e.clientX - panOffset.x,
                y: e.clientY - panOffset.y,
            };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (workspaceRef.current) {
            const rect = workspaceRef.current.getBoundingClientRect();
            setMousePos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        }

        if (!isPanning) return;
        setPanOffset(clampPanOffset(
            e.clientX - panStartRef.current.x,
            e.clientY - panStartRef.current.y,
            zoom
        ));
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const resetZoomAndPan = () => {
        setZoom(1.0);
        setPanOffset({ x: 0, y: 0 });
        toast({
            title: "Canvas Reset",
            description: "Zoom set to 100% and pan alignment centered.",
        });
    };

    // Click on canvas container to drop collaborative comments
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (!commentsMode) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('select')) {
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = Math.round((e.clientX - rect.left - panOffset.x) / zoom);
        const clickY = Math.round((e.clientY - rect.top - panOffset.y) / zoom);

        setNewCommentPos({ x: clickX, y: clickY });
        setNewCommentText('');
    };



    // Simulated data context variables replacement mapping
    const simulatedData: Record<string, Record<string, string>> = {
        parent: {
            name: 'Kwame Mensah',
            phone: '+233 24 412 3456',
            email: 'kwame@mensah.gh'
        },
        student: {
            name: 'Ama Serwaa',
            id: 'STU-2026-092',
            class: 'Primary 5 B'
        },
        invoice: {
            amount: 'GH₵ 1,200.00',
            dueDate: 'June 30, 2026',
            number: 'INV-7731-2026'
        },
        current: {
            date: 'July 3, 2026',
            time: '14:30 GMT'
        },
        tenant: {
            name: 'SmartSapp Admissions'
        }
    };

    const interpolate = (text: string): string => {
        if (!text) return '';
        let result = text;
        
        // Match token identifiers like {{category.key}} and replace with local simulated values
        result = result.replace(/\{\{\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\}\}/g, (match, cat, key) => {
            if (simulatedProfile !== 'none') {
                return simulatedData[cat]?.[key] || match;
            }
            return match;
        });
        
        return result;
    };

    // WCAG Accessibility and Image size scanner
    const runWcagAudit = () => {
        const warnings: string[] = [];
        let imageCount = 0;
        let imageIssues = 0;
        let contrastIssues = 0;

        version.structureJson.sections.forEach((section, sIdx) => {
            section.blocks.forEach((block) => {
                // Check alt texts
                if (block.type === 'image') {
                    imageCount++;
                    if (!block.props.altText && !block.props.alt) {
                        imageIssues++;
                        warnings.push(`Section ${sIdx + 1}: Image block (ID: ${block.id}) lacks alt tag.`);
                    }
                }
                
                // Contrast checks
                if (block.type === 'text') {
                    const textColor = (block.props.textColor as string || '').toLowerCase();
                    const bgColor = (section.props.backgroundColor as string || '').toLowerCase();
                    if (textColor === '#ffffff' && (bgColor === '#ffffff' || bgColor === 'rgba(255,255,255,1)')) {
                        contrastIssues++;
                        warnings.push(`Section ${sIdx + 1}: Low contrast (white text on white background).`);
                    }
                }

                // Forms binding check
                if (block.type === 'form' && !block.props.formId) {
                    warnings.push(`Section ${sIdx + 1}: Form block is not bound to a database Form structure.`);
                }
            });
        });

        if (warnings.length === 0) {
            toast({
                title: "WCAG Audit Passed! 🎉",
                description: `Analyzed ${version.structureJson.sections.length} sections. 0 accessibility issues detected.`,
            });
        } else {
            toast({
                variant: "destructive",
                title: `Accessibility Audit: ${warnings.length} Warnings`,
                description: (
                    <div className="space-y-1 mt-1 font-mono text-[9px] text-left leading-normal max-h-40 overflow-y-auto pr-1">
                        {warnings.map((w, idx) => (
                            <p key={idx} className="border-b border-red-500/10 pb-0.5">• {w}</p>
                        ))}
                    </div>
                ) as unknown as string,
            });
        }
    };

    const editCtx = (blockId: string): BlockRenderContext => ({
        mode: canvasMode === 'preview' ? 'view' : 'edit',
        theme,
        interpolate,
        resources,
        page,
        onPropChange: (patch: Record<string, unknown>) => onUpdateBlockProps(blockId, patch)
    });

    const customCollisionDetection: CollisionDetection = (args) => {
        const centerCollisions = closestCenter(args);
        if (centerCollisions.length > 0) return centerCollisions;

        const { pointerCoordinates } = args;
        if (!pointerCoordinates) return [];

        const droppables = args.droppableContainers.filter(container => {
            const rect = container.rect.current;
            if (!rect) return false;
            return (
                pointerCoordinates.x >= rect.left &&
                pointerCoordinates.x <= rect.right &&
                pointerCoordinates.y >= rect.top &&
                pointerCoordinates.y <= rect.bottom
            );
        });

        return droppables.map(container => ({
            id: container.id,
            data: { droppableContainer: container }
        }));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // 1. Handle Section Reordering
        if (activeId.startsWith('sec_')) {
            if (overId.startsWith('sec_')) {
                const oldIdx = version.structureJson.sections.findIndex(s => s.id === activeId);
                const newIdx = version.structureJson.sections.findIndex(s => s.id === overId);
                if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
                    onReorderSections(oldIdx, newIdx);
                }
            }
            return;
        }

        // 1.5 Handle Column Reordering
        if (activeId.startsWith('col-')) {
            if (overId.startsWith('col-')) {
                const activeParts = activeId.split('-');
                const activeSectionId = activeParts.slice(1, -1).join('-');
                const activeColIdx = parseInt(activeParts[activeParts.length - 1], 10);

                const overParts = overId.split('-');
                const overSectionId = overParts.slice(1, -1).join('-');
                const overColIdx = parseInt(overParts[overParts.length - 1], 10);

                if (activeSectionId === overSectionId && activeColIdx !== overColIdx) {
                    onSwapColumns?.(activeSectionId, activeColIdx, overColIdx);
                }
            }
            return;
        }

        // 2. Handle Block Drag and Drop
        let targetSectionId = '';
        let targetColIdx = 0;
        let targetBlockIndex = 0;

        if (overId.startsWith('col-')) {
            // Dropped on an empty column area
            const parts = overId.split('-');
            targetSectionId = parts.slice(1, -1).join('-');
            targetColIdx = parseInt(parts[parts.length - 1], 10);
            
            const targetSection = version.structureJson.sections.find(s => s.id === targetSectionId);
            if (!targetSection) return;
            const colBlocks = targetSection.blocks.filter(b => ((b.props || {}) as { column?: number }).column === targetColIdx);
            targetBlockIndex = colBlocks.length;
        } else {
            // Dropped over another block (SortableBlock)
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
            if (!found) return; // Dropped outside a column/block (e.g. over empty space of a section)
        }

        onMoveBlockToColumn(activeId, targetSectionId, targetColIdx, targetBlockIndex);
    };

    // Custom pointer position dnd-kit modifier to divide coordinate transform offsets by the zoom factor
    const zoomModifier = ({ transform }: { transform: { x: number; y: number; scaleX: number; scaleY: number } }) => {
        return {
            ...transform,
            x: transform.x / zoom,
            y: transform.y / zoom,
        };
    };

    const executeCommand = (command: string, value: string = '') => {
        const sel = window.getSelection();
        const activeEl = document.getElementById(`text-block-${selectedBlockId}`);
        let range: Range | null = null;
        if (sel && sel.rangeCount > 0) {
            range = sel.getRangeAt(0);
        }

        const isSelectionCollapsed = !range || range.collapsed || sel?.toString().length === 0 || !activeEl?.contains(range.commonAncestorContainer);

        if (activeEl && isSelectionCollapsed) {
            const selectAllRange = document.createRange();
            selectAllRange.selectNodeContents(activeEl);
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(selectAllRange);
            }
        }

        document.execCommand(command, false, value);

        if (sel && sel.rangeCount > 0) {
            savedSelectionRangeRef.current = sel.getRangeAt(0);
        } else {
            savedSelectionRangeRef.current = range;
        }

        if (activeEl) {
            onUpdateBlockProps(selectedBlockId!, { content: activeEl.innerHTML });
        }
    };

    const applyStyleToSelection = (styleName: string, value: string) => {
        const sel = window.getSelection();
        const activeEl = document.getElementById(`text-block-${selectedBlockId}`);
        if (!activeEl) return;

        let range: Range | null = null;
        if (sel && sel.rangeCount > 0) {
            range = sel.getRangeAt(0);
        }

        const isSelectionCollapsed = !range || range.collapsed || sel?.toString().length === 0 || !activeEl.contains(range.commonAncestorContainer);

        if (isSelectionCollapsed) {
            let propKey = '';
            if (styleName === 'font-family') propKey = 'fontFamily';
            else if (styleName === 'font-size') propKey = 'fontSize';
            else if (styleName === 'color') propKey = 'textColor';

            if (propKey) {
                onUpdateBlockProps(selectedBlockId!, { [propKey]: value });
            }
            return;
        }

        if (!range) return;

        const span = document.createElement('span');
        span.style.setProperty(styleName, value);

        try {
            span.appendChild(range.extractContents());
            range.insertNode(span);

            if (sel) {
                sel.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                sel.addRange(newRange);
                savedSelectionRangeRef.current = newRange;
            }

            onUpdateBlockProps(selectedBlockId!, { content: activeEl.innerHTML });
        } catch (err) {
            console.error("Failed to apply style span to selection:", err);
        }
    };

    const insertHyperlink = (url: string, newTab: boolean) => {
        const sel = window.getSelection();
        const activeEl = document.getElementById(`text-block-${selectedBlockId}`);
        if (!sel || !activeEl) return;

        let range: Range | null = null;
        if (sel.rangeCount > 0) range = sel.getRangeAt(0);

        const isSelectionCollapsed = !range || range.collapsed || sel.toString().length === 0 || !activeEl.contains(range.commonAncestorContainer);

        if (isSelectionCollapsed) {
            const a = document.createElement('a');
            a.href = url;
            a.innerText = url;
            if (newTab) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
            if (range) {
                range.insertNode(a);
                sel.removeAllRanges();
                const newRange = document.createRange();
                newRange.setStartAfter(a);
                newRange.collapse(true);
                sel.addRange(newRange);
                savedSelectionRangeRef.current = newRange;
            }
        } else {
            document.execCommand('createLink', false, url);
            if (newTab) {
                const anchors = activeEl.getElementsByTagName('a');
                for (let i = 0; i < anchors.length; i++) {
                    if (anchors[i].getAttribute('href') === url) {
                        anchors[i].setAttribute('target', '_blank');
                        anchors[i].setAttribute('rel', 'noopener noreferrer');
                    }
                }
            }
        }

        onUpdateBlockProps(selectedBlockId!, { content: activeEl.innerHTML });
    };

    const removeHyperlink = () => {
        const activeEl = document.getElementById(`text-block-${selectedBlockId}`);
        document.execCommand('unlink', false);
        if (activeEl) {
            onUpdateBlockProps(selectedBlockId!, { content: activeEl.innerHTML });
        }
    };

    const sectionIds = version.structureJson.sections.map(s => s.id);
    const isPreview = canvasMode === 'preview';

    return (
        <main 
            ref={workspaceRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleCanvasClick}
            className="flex-1 overflow-hidden relative select-none bg-slate-950 canvas-workspace-bg"
            style={{ 
                cursor: isPanning ? 'grabbing' : panToolActive ? 'grab' : commentsMode ? 'cell' : 'default' 
            }}
        >
            {/* SVG Canvas Grid Pattern (Background panned/zoomed dynamically) */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-[0.04]" 
                style={{ 
                    backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', 
                    backgroundSize: '24px 24px',
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoom})`,
                    transformOrigin: 'top left'
                }} 
            />



            {/* Center Canvas Transform Scale Frame Viewport */}
            <div
                className="w-full h-full flex items-center justify-center transform-gpu"
                style={{
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoom})`,
                    transformOrigin: 'center center',
                    pointerEvents: isPanning ? 'none' : 'auto'
                }}
            >
                <div
                    ref={canvasRef}
                    className={cn(
                        "canvas-viewport-frame shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 relative select-none",
                        themeMode === 'dark' ? "dark" : "light",
                        viewport === 'desktop'
                            ? "w-[1280px] min-h-[800px] rounded-2xl ring-1 ring-slate-800/10"
                            : viewport === 'tablet'
                            ? "w-[768px] min-h-[1024px] rounded-[1.5rem] border-[8px] border-slate-900 ring-1 ring-slate-850"
                            : "w-[390px] min-h-[844px] rounded-[2.5rem] border-[8px] border-slate-900 ring-1 ring-slate-850"
                    )}
                    style={{
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        fontFamily: theme.typography.bodyFont + ', sans-serif'
                    }}
                    onClickCapture={(e) => {
                        if (canvasMode === 'preview') {
                            const target = e.target as HTMLElement;
                            if (target.closest('a') || target.closest('button')) {
                                e.preventDefault();
                                e.stopPropagation();
                                toast({
                                    title: "Preview Restriction",
                                    description: "Navigation links and dynamic button submissions are disabled in preview editing mode.",
                                });
                            }
                        }
                    }}
                >
                    <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragEnd={handleDragEnd} modifiers={[zoomModifier]}>
                        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                            <div className="min-h-[400px] flex flex-col relative">
                                {showHeader && (() => {
                                    const headerSettings = version.structureJson.header || {
                                        preset: 'native',
                                        overlap: false,
                                        sticky: false,
                                        floating: false,
                                        showSearch: false,
                                        showCta: false,
                                        showPhone: false,
                                        navItems: []
                                    };
                                    const isEditMode = canvasMode === 'edit';
                                    return (
                                        <div 
                                            onClick={onClickHeader}
                                            className={cn(
                                                "z-50 transition-all shrink-0 select-none",
                                                headerSettings.overlap ? "absolute top-0 inset-x-0" : "relative w-full",
                                                isEditMode ? "p-1 cursor-pointer pointer-events-auto border border-dashed border-blue-500/40 hover:border-blue-500 rounded-lg m-1" : "py-4 px-6 pointer-events-none"
                                            )}
                                        >
                                            {isEditMode && (
                                                <div className="absolute top-2 left-3 z-50 text-[8px] font-black uppercase text-blue-500 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-200/35 shadow-sm">
                                                    Header (Click to Customize)
                                                </div>
                                            )}
                                            <div className={cn(
                                                "w-full flex items-center justify-between transition-all",
                                                headerSettings.floating 
                                                    ? "max-w-4xl mx-auto rounded-full border border-slate-200/50 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md py-1.5 px-6 shadow-lg shadow-black/5"
                                                    : cn(
                                                        "rounded-none border-b border-slate-200/40 dark:border-zinc-800/40 py-3 px-8 shadow-sm",
                                                        headerSettings.overlap 
                                                            ? "bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md" 
                                                            : "bg-white dark:bg-zinc-950"
                                                      )
                                            )}>
                                                {headerSettings.preset === 'minimal' ? (
                                                    <div className="flex items-center justify-center w-full">
                                                        <SmartSappLogo className="h-8 w-auto text-[#0F172A] dark:text-white" />
                                                    </div>
                                                ) : headerSettings.preset === 'cta-only' ? (
                                                     <div className="flex justify-end w-full">
                                                         {headerSettings.showCta && (
                                                             <Button className="h-9 px-5 rounded-full font-bold text-xs bg-[#3B5FFF] text-white flex items-center justify-center gap-1 pointer-events-auto" disabled={!isEditMode}>
                                                                 {isEditMode ? (
                                                                     <span
                                                                         contentEditable
                                                                         suppressContentEditableWarning
                                                                         onBlur={(e) => onUpdateHeader?.({ ctaText: e.currentTarget.textContent || '' })}
                                                                         onKeyDown={(e) => {
                                                                             if (e.key === 'Enter') {
                                                                                 e.preventDefault();
                                                                                 e.currentTarget.blur();
                                                                             }
                                                                         }}
                                                                         className="outline-none border-0 bg-transparent text-white font-bold text-xs text-center cursor-text min-w-[20px] inline-block"
                                                                         onClick={(e) => e.stopPropagation()}
                                                                     >
                                                                         {headerSettings.ctaText || 'Get Started'}
                                                                     </span>
                                                                 ) : (
                                                                     headerSettings.ctaText || 'Get Started'
                                                                 )}
                                                             </Button>
                                                         )}
                                                     </div>
                                                 ) : (
                                                     <div className="flex items-center justify-between w-full">
                                                         <div className="flex items-center gap-6">
                                                             <SmartSappLogo className="h-8 w-auto text-[#0F172A] dark:text-white" />
                                                             {(headerSettings.preset === 'full-nav' || headerSettings.preset === 'search-nav') && (
                                                                 <nav className="hidden md:flex items-center gap-4 text-xs font-semibold text-slate-650 dark:text-slate-300">
                                                                     {headerSettings.navItems.map((item) => (
                                                                         <span 
                                                                             key={item.id} 
                                                                             className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer pointer-events-auto"
                                                                             onClick={(e) => e.stopPropagation()}
                                                                         >
                                                                             {isEditMode ? (
                                                                                 <span
                                                                                     contentEditable
                                                                                     suppressContentEditableWarning
                                                                                     onBlur={(e) => {
                                                                                         const updatedNavItems = headerSettings.navItems.map(navItem => 
                                                                                             navItem.id === item.id ? { ...navItem, label: e.currentTarget.textContent || '' } : navItem
                                                                                         );
                                                                                         onUpdateHeader?.({ navItems: updatedNavItems });
                                                                                     }}
                                                                                     onKeyDown={(e) => {
                                                                                         if (e.key === 'Enter') {
                                                                                             e.preventDefault();
                                                                                             e.currentTarget.blur();
                                                                                         }
                                                                                     }}
                                                                                     className="outline-none border-0 bg-transparent text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold text-xs text-center cursor-text min-w-[10px] inline-block"
                                                                                 >
                                                                                     {item.label}
                                                                                 </span>
                                                                             ) : (
                                                                                 item.label
                                                                             )}
                                                                         </span>
                                                                     ))}
                                                                 </nav>
                                                             )}
                                                         </div>
                                                         <div className="flex items-center gap-4">
                                                             {headerSettings.preset === 'search-nav' && headerSettings.showSearch && (
                                                                 <div className="relative max-w-xs hidden sm:block">
                                                                     <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-450" />
                                                                     <input type="text" placeholder="Search..." disabled className="h-8 w-32 pl-8 pr-2 text-xs bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg" />
                                                                 </div>
                                                             )}
                                                             {headerSettings.showPhone && headerSettings.phoneNumber && (
                                                                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                                     <Phone className="h-3 w-3" />
                                                                     {isEditMode ? (
                                                                         <span
                                                                             contentEditable
                                                                             suppressContentEditableWarning
                                                                             onBlur={(e) => onUpdateHeader?.({ phoneNumber: e.currentTarget.textContent || '' })}
                                                                             onKeyDown={(e) => {
                                                                                 if (e.key === 'Enter') {
                                                                                     e.preventDefault();
                                                                                     e.currentTarget.blur();
                                                                                 }
                                                                             }}
                                                                             className="outline-none border-0 bg-transparent text-slate-500 dark:text-slate-400 font-bold text-xs cursor-text min-w-[20px] inline-block"
                                                                         >
                                                                             {headerSettings.phoneNumber}
                                                                         </span>
                                                                     ) : (
                                                                         headerSettings.phoneNumber
                                                                     )}
                                                                 </span>
                                                             )}
                                                             {headerSettings.showCta && (
                                                                 <Button className="h-9 px-5 rounded-full font-bold text-xs bg-[#3B5FFF] text-white flex items-center justify-center gap-1 pointer-events-auto" disabled={!isEditMode}>
                                                                     {isEditMode ? (
                                                                         <span
                                                                             contentEditable
                                                                             suppressContentEditableWarning
                                                                             onBlur={(e) => onUpdateHeader?.({ ctaText: e.currentTarget.textContent || '' })}
                                                                             onKeyDown={(e) => {
                                                                                 if (e.key === 'Enter') {
                                                                                     e.preventDefault();
                                                                                     e.currentTarget.blur();
                                                                                 }
                                                                             }}
                                                                             className="outline-none border-0 bg-transparent text-white font-bold text-xs text-center cursor-text min-w-[20px] inline-block"
                                                                             onClick={(e) => e.stopPropagation()}
                                                                         >
                                                                             {headerSettings.ctaText || 'Get Started'}
                                                                         </span>
                                                                     ) : (
                                                                         headerSettings.ctaText || 'Get Started'
                                                                     )}
                                                                 </Button>
                                                             )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
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
                                            overlayType?: string;
                                            overlayGradientFrom?: string;
                                            overlayGradientTo?: string;
                                            overlayGradientAngle?: number;
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

                                        const headerSettings = version.structureJson.header || { overlap: false, floating: false };
                                        const isFirstSection = idx === 0;
                                        const adjustedPadTop = (isFirstSection && headerSettings.overlap && showHeader)
                                            ? `calc(${padTop} + ${headerSettings.floating ? '5.5rem' : '4.5rem'})`
                                            : padTop;

                                        const sectionStyle: React.CSSProperties = {
                                            position: 'relative',
                                            overflow: 'hidden',
                                            paddingTop: adjustedPadTop,
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

                                        const isResponsiveStacked = !isPreview && (viewport === 'mobile' || viewport === 'tablet');
                                        let gridColsClass = 'grid-cols-1';
                                        let gridStyle: React.CSSProperties = {};

                                        if (!isResponsiveStacked) {
                                            if (layout === '2-col') {
                                                gridColsClass = 'grid-cols-1 lg:grid-cols-2';
                                            } else if (layout === '3-col') {
                                                gridColsClass = 'grid-cols-1 lg:grid-cols-3';
                                            } else if (layout === '4-col') {
                                                gridColsClass = 'grid-cols-1 lg:grid-cols-4';
                                            } else if (layout === 'grid') {
                                                gridStyle = { gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' };
                                            }
                                        }

                                        return (
                                            <React.Fragment key={section.id}>
                                                {idx === 0 && (
                                                    <SectionInserterLine
                                                        onClick={() => {
                                                            onInsertSection?.(0);
                                                            onSetTab('add');
                                                        }}
                                                    />
                                                )}
                                                <SortableSection
                                                    section={section}
                                                    idx={idx}
                                                    total={version.structureJson.sections.length}
                                                    onRemove={() => onRemoveSection(section.id)}
                                                    onMove={(dir) => onMoveSection(section.id, dir)}
                                                    onSave={() => onSaveSectionAsTemplate(section)}
                                                    onEdit={() => onEditSection(section.id)}
                                                    editMode={editMode}
                                                    canvasMode={canvasMode}
                                                    selected={selectedSectionId === section.id}
                                                >
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

                                                    {overlayOp > 0 && (
                                                        <div
                                                            className="absolute inset-0 pointer-events-none z-10"
                                                            style={{
                                                                backgroundColor: sectionProps.overlayType === 'gradient' ? undefined : overlayCol,
                                                                backgroundImage: sectionProps.overlayType === 'gradient'
                                                                    ? `linear-gradient(${sectionProps.overlayGradientAngle ?? 135}deg, ${sectionProps.overlayGradientFrom || '#000000'}, ${sectionProps.overlayGradientTo || '#000000'})`
                                                                    : undefined,
                                                                opacity: overlayOp,
                                                            }}
                                                        />
                                                    )}

                                                    <div style={sectionStyle} className="w-full">
                                                        <div className="max-w-4xl mx-auto relative z-20">
                                                            {sectionProps.heading && (
                                                                <h2
                                                                    className="text-2xl font-bold tracking-tight mb-8 text-slate-900"
                                                                    style={{ color: theme.colors.text, fontFamily: theme.typography.headingFont }}
                                                                >
                                                                    {sectionProps.heading}
                                                                </h2>
                                                            )}

                                                            <div
                                                                className={cn("w-full grid relative z-20", gridColsClass, colGapClass, alignClass)}
                                                                style={layout === 'grid' && !isResponsiveStacked ? gridStyle : undefined}
                                                            >
                                                                <SortableContext
                                                                    items={Array.from({ length: colsCount }, (_, cI) => `col-${section.id}-${cI}`)}
                                                                    strategy={horizontalListSortingStrategy}
                                                                >
                                                                    {columnsBlocks.map((colBlocks, colIdx) => (
                                                                        <ColumnCell
                                                                            key={colIdx}
                                                                            sectionId={section.id}
                                                                            colIdx={colIdx}
                                                                            blocks={colBlocks}
                                                                            selectedBlockId={selectedBlockId}
                                                                            selectedSectionId={selectedSectionId}
                                                                            selectedColumnIndex={selectedColumnIndex}
                                                                            onSelectBlock={onSelectBlock}
                                                                            onSetTab={onSetTab}
                                                                            onRemoveBlock={onRemoveBlock}
                                                                            onMoveBlock={onMoveBlock}
                                                                            onDuplicateBlock={onDuplicateBlock}
                                                                            editCtx={editCtx}
                                                                            editMode={editMode}
                                                                            canvasMode={canvasMode}
                                                                            totalColumns={colsCount}
                                                                            onSwapColumns={onSwapColumns}
                                                                            onEditSection={onEditSection}
                                                                        />
                                                                    ))}
                                                                </SortableContext>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </SortableSection>
                                                <SectionInserterLine
                                                    onClick={() => {
                                                        onInsertSection?.(idx + 1);
                                                        onSetTab('add');
                                                    }}
                                                />
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <div className="p-24 text-center space-y-4">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center border border-slate-200 border-dashed">
                                            <PlusSquare className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-700">Start building your page</h3>
                                            <p className="text-xs text-slate-500 mt-1">Add sections from the sidebar or start with an empty layout.</p>
                                        </div>
                                    </div>
                                )}
                                {showFooter && (() => {
                                    const footerSettings = version.structureJson.footer || {
                                        preset: 'org',
                                        overrideOrg: false
                                    };
                                    const isEditMode = canvasMode === 'edit';

                                    // Render native org footer directly if org preset
                                    if (footerSettings.preset === 'org') {
                                        return (
                                            <div 
                                                onClick={onClickFooter}
                                                className={cn(
                                                    "w-full mt-auto shrink-0 relative transition-all",
                                                    isEditMode ? "p-1 cursor-pointer pointer-events-auto border border-dashed border-violet-500/40 hover:border-violet-500 rounded-lg m-1" : "pointer-events-none"
                                                )}
                                            >
                                                {isEditMode && (
                                                    <div className="absolute top-2 left-3 z-50 text-[8px] font-black uppercase text-violet-500 bg-violet-50 dark:bg-violet-950/80 px-1.5 py-0.5 rounded border border-violet-200/35 shadow-sm">
                                                        Footer (Click to Customize)
                                                    </div>
                                                )}
                                                <Footer className="w-full relative z-30 pointer-events-none" />
                                            </div>
                                        );
                                    }

                                    // Otherwise, render custom visual mockups of our footer presets
                                    const address = (footerSettings.overrideOrg ? footerSettings.address : '123 Business Rd, Suite 100') || '';
                                    const email = (footerSettings.overrideOrg ? footerSettings.email : 'contact@company.com') || '';
                                    const phone = (footerSettings.overrideOrg ? footerSettings.phone : '+1 (555) 019-2834') || '';
                                    const copyright = (footerSettings.overrideOrg ? footerSettings.copyrightText : 'Copyright © 2026 Company. All rights reserved.') || 'Copyright © 2026 Company. All rights reserved.';
                                    const socials = footerSettings.overrideOrg ? (footerSettings.socialLinks || {}) : {};

                                    const hasSocials = !!(socials.facebook || socials.twitter || socials.linkedin || socials.instagram || socials.youtube);

                                    return (
                                        <div 
                                            onClick={onClickFooter}
                                            className={cn(
                                                "w-full mt-auto shrink-0 relative transition-all bg-[#0A1427] text-white border-t border-border/10",
                                                isEditMode ? "p-1 cursor-pointer pointer-events-auto border border-dashed border-violet-500/40 hover:border-violet-500 rounded-lg m-1" : ""
                                            )}
                                        >
                                            {isEditMode && (
                                                <div className="absolute top-2 left-3 z-50 text-[8px] font-black uppercase text-violet-500 bg-violet-50 dark:bg-violet-950/80 px-1.5 py-0.5 rounded border border-violet-200/35 shadow-sm">
                                                    Footer (Click to Customize)
                                                </div>
                                            )}
                                            
                                            {footerSettings.preset === 'simple' && (
                                                <div className="max-w-4xl mx-auto px-6 py-8 text-center space-y-4">
                                                    <SmartSappLogo className="h-6 mx-auto opacity-70" />
                                                    <p className="text-[10px] text-slate-400 flex justify-center items-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                        {isEditMode ? (
                                                            <span
                                                                contentEditable
                                                                suppressContentEditableWarning
                                                                onBlur={(e) => onUpdateFooter?.({ copyrightText: e.currentTarget.textContent || '', overrideOrg: true })}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        e.currentTarget.blur();
                                                                    }
                                                                }}
                                                                className="outline-none border-0 bg-transparent text-slate-400 text-center font-normal text-[10px] cursor-text min-w-[20px] inline-block"
                                                            >
                                                                {copyright}
                                                            </span>
                                                        ) : (
                                                            copyright
                                                        )}
                                                    </p>
                                                </div>
                                            )}

                                            {footerSettings.preset === 'minimal' && (
                                                <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <SmartSappLogo className="h-6 opacity-70" />
                                                        <p className="text-[10px] text-slate-400 flex justify-center items-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                            {isEditMode ? (
                                                                <span
                                                                    contentEditable
                                                                    suppressContentEditableWarning
                                                                    onBlur={(e) => onUpdateFooter?.({ copyrightText: e.currentTarget.textContent || '', overrideOrg: true })}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            e.currentTarget.blur();
                                                                        }
                                                                    }}
                                                                    className="outline-none border-0 bg-transparent text-slate-400 text-center font-normal text-[10px] cursor-text min-w-[20px] inline-block"
                                                                >
                                                                    {copyright}
                                                                </span>
                                                            ) : (
                                                                copyright
                                                            )}
                                                        </p>
                                                    </div>
                                                    {hasSocials && (
                                                        <div className="flex items-center gap-4 text-slate-400">
                                                            {socials.facebook && <Facebook className="h-4 w-4" />}
                                                            {socials.twitter && <Twitter className="h-4 w-4" />}
                                                            {socials.linkedin && <Linkedin className="h-4 w-4" />}
                                                            {socials.instagram && <Instagram className="h-4 w-4" />}
                                                            {socials.youtube && <Youtube className="h-4 w-4" />}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {footerSettings.preset === 'social-heavy' && (
                                                <div className="max-w-4xl mx-auto px-6 py-10 text-center space-y-6">
                                                    <SmartSappLogo className="h-7 mx-auto" />
                                                    {hasSocials ? (
                                                        <div className="flex justify-center gap-6 text-slate-400">
                                                            {socials.facebook && <Facebook className="h-5 w-5" />}
                                                            {socials.twitter && <Twitter className="h-5 w-5" />}
                                                            {socials.linkedin && <Linkedin className="h-5 w-5" />}
                                                            {socials.instagram && <Instagram className="h-5 w-5" />}
                                                            {socials.youtube && <Youtube className="h-5 w-5" />}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-slate-500 italic">No social links configured</p>
                                                    )}
                                                    <p className="text-[10px] text-slate-500 pt-4 border-t border-slate-800/30 flex justify-center items-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                        {isEditMode ? (
                                                            <span
                                                                contentEditable
                                                                suppressContentEditableWarning
                                                                onBlur={(e) => onUpdateFooter?.({ copyrightText: e.currentTarget.textContent || '', overrideOrg: true })}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        e.currentTarget.blur();
                                                                    }
                                                                }}
                                                                className="outline-none border-0 bg-transparent text-slate-500 text-center font-normal text-[10px] cursor-text min-w-[20px] inline-block"
                                                            >
                                                                {copyright}
                                                            </span>
                                                        ) : (
                                                            copyright
                                                        )}
                                                    </p>
                                                </div>
                                            )}

                                            {footerSettings.preset === 'multi-column' && (
                                                <div className="max-w-4xl mx-auto px-6 py-12">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                                                        <div className="space-y-3">
                                                            <SmartSappLogo className="h-7 mx-auto md:mx-0" />
                                                            <p className="text-[10px] text-slate-400 flex justify-center md:justify-start items-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                                {isEditMode ? (
                                                                    <span
                                                                        contentEditable
                                                                        suppressContentEditableWarning
                                                                        onBlur={(e) => onUpdateFooter?.({ copyrightText: e.currentTarget.textContent || '', overrideOrg: true })}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                e.currentTarget.blur();
                                                                            }
                                                                        }}
                                                                        className="outline-none border-0 bg-transparent text-slate-400 text-center md:text-left font-normal text-[10px] cursor-text min-w-[20px] inline-block"
                                                                    >
                                                                        {copyright}
                                                                    </span>
                                                                ) : (
                                                                    copyright
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-350">Quick Links</h5>
                                                            <div className="flex flex-col gap-1.5 text-[10px] text-slate-400">
                                                                <span>Home</span>
                                                                <span>Privacy Policy</span>
                                                                <span>Terms of Service</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-3 text-slate-400">
                                                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-350">Contact</h5>
                                                            <div className="flex flex-col gap-1.5 text-[10px] items-center md:items-start">
                                                                {address && (
                                                                    <span className="flex items-center gap-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                                        <MapPin className="h-3 w-3" />
                                                                        {isEditMode ? (
                                                                            <span
                                                                                contentEditable
                                                                                suppressContentEditableWarning
                                                                                onBlur={(e) => onUpdateFooter?.({ address: e.currentTarget.textContent || '', overrideOrg: true })}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        e.preventDefault();
                                                                                        e.currentTarget.blur();
                                                                                    }
                                                                                }}
                                                                                className="outline-none border-0 bg-transparent text-slate-400 font-normal text-[10px] cursor-text min-w-[20px] inline-block"
                                                                            >
                                                                                {address}
                                                                            </span>
                                                                        ) : (
                                                                            address
                                                                        )}
                                                                    </span>
                                                                )}
                                                                {email && (
                                                                    <span className="flex items-center gap-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                                        <Mail className="h-3 w-3" />
                                                                        {isEditMode ? (
                                                                            <span
                                                                                contentEditable
                                                                                suppressContentEditableWarning
                                                                                onBlur={(e) => onUpdateFooter?.({ email: e.currentTarget.textContent || '', overrideOrg: true })}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        e.preventDefault();
                                                                                        e.currentTarget.blur();
                                                                                    }
                                                                                }}
                                                                                className="outline-none border-0 bg-transparent text-slate-400 font-normal text-[10px] cursor-text min-w-[20px] inline-block"
                                                                            >
                                                                                {email}
                                                                            </span>
                                                                        ) : (
                                                                            email
                                                                        )}
                                                                    </span>
                                                                )}
                                                                {phone && (
                                                                    <span className="flex items-center gap-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                                        <Phone className="h-3 w-3" />
                                                                        {isEditMode ? (
                                                                            <span
                                                                                contentEditable
                                                                                suppressContentEditableWarning
                                                                                onBlur={(e) => onUpdateFooter?.({ phone: e.currentTarget.textContent || '', overrideOrg: true })}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        e.preventDefault();
                                                                                        e.currentTarget.blur();
                                                                                    }
                                                                                }}
                                                                                className="outline-none border-0 bg-transparent text-slate-400 font-normal text-[10px] cursor-text min-w-[20px] inline-block"
                                                                            >
                                                                                {phone}
                                                                            </span>
                                                                        ) : (
                                                                            phone
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    );
                                })()}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {/* Absolute Pinned Collaborative Comments Overlay */}
                    {comments.map((c) => (
                        <div
                            key={c.id}
                            className="absolute z-40 transform -translate-x-1/2 -translate-y-1/2 group/pin"
                            style={{ left: `${c.x}px`, top: `${c.y}px` }}
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCommentId(activeCommentId === c.id ? null : c.id);
                                }}
                                className="w-6 h-6 rounded-full bg-violet-600 border border-violet-500 text-white flex items-center justify-center font-bold text-xs shadow-lg animate-pulse"
                            >
                                💬
                            </button>
                            
                            {activeCommentId === c.id && (
                                <div className="absolute top-7 left-0 bg-slate-900 border border-slate-800 p-2.5 rounded-lg shadow-2xl text-[10px] w-48 text-slate-200 z-50">
                                    <p className="font-semibold text-slate-400">Team Comment</p>
                                    <p className="mt-1 leading-normal font-medium text-slate-150">{c.text}</p>
                                    <div className="flex justify-end gap-1.5 mt-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setComments(prev => prev.filter(p => p.id !== c.id));
                                                setActiveCommentId(null);
                                            }}
                                            className="text-red-400 hover:text-red-300 font-bold uppercase text-[8px]"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Dropping temporary pin form popover */}
                    {newCommentPos && (
                        <div
                            className="absolute z-50 transform -translate-x-1/2 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl w-56 text-[10px] text-slate-200"
                            style={{ left: `${newCommentPos.x}px`, top: `${newCommentPos.y + 12}px` }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="font-bold text-slate-400 mb-1">Add Collaborative Comment</p>
                            <textarea
                                placeholder="Type your review comment..."
                                className="w-full h-12 bg-slate-950 border border-slate-850 text-slate-200 rounded p-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                            />
                            <div className="flex justify-end gap-1.5 mt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[9px]"
                                    onClick={() => setNewCommentPos(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-6 px-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-bold"
                                    onClick={() => {
                                        if (!newCommentText.trim()) return;
                                        setComments(prev => [
                                            ...prev,
                                            { id: `c-${Date.now()}`, x: newCommentPos.x, y: newCommentPos.y, text: newCommentText }
                                        ]);
                                        setNewCommentPos(null);
                                        toast({
                                            title: "Comment Added",
                                            description: "Positioned annotation pinned to page coordinates.",
                                        });
                                    }}
                                >
                                    Post Pin
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Ghana Role Simulator & Accessibility Audits (Bottom-Left) */}
            {isPreview && (
                <div className="absolute bottom-6 left-6 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-2xl z-40 backdrop-blur-md text-[10px] text-slate-300 font-semibold select-none">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider pl-1.5 pr-1 select-none flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" /> Profile:
                    </span>
                    
                    <Select
                        value={simulatedProfile}
                        onValueChange={(val: 'none' | 'parent' | 'student') => {
                            setSimulatedProfile(val);
                            toast({
                                title: `Simulated profile: ${val === 'none' ? 'Author View' : val === 'parent' ? 'Kwame Mensah (Parent)' : 'Ama Serwaa (Student)'}`,
                                description: "Canvas elements dynamically updated with local variables binding values.",
                            });
                        }}
                    >
                        <SelectTrigger className="h-7 w-32 bg-slate-950 border-slate-800 text-[10px] rounded-lg">
                            <SelectValue placeholder="Select Profile" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-[10px]">
                            <SelectItem value="none">Default Author View</SelectItem>
                            <SelectItem value="parent">Kwame Mensah (Parent)</SelectItem>
                            <SelectItem value="student">Ama Serwaa (Student)</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="h-4 w-[1px] bg-slate-800" />

                    <Button
                        onClick={runWcagAudit}
                        className="h-7 px-2 text-[9px] font-bold rounded-lg border border-slate-800 hover:border-emerald-500 hover:text-emerald-400 bg-slate-950/50 hover:bg-slate-900 transition-all flex items-center gap-1"
                        variant="ghost"
                    >
                        <AlertTriangle className="h-3 w-3 text-amber-500" /> WCAG Audit Scan
                    </Button>

                    <div className="h-4 w-[1px] bg-slate-800" />

                    {/* Page Health Metrics Scorecard */}
                    <div className="flex items-center gap-1 bg-slate-950/40 p-0.5 rounded-lg border border-slate-850/50" title="Page Health Metrics: Performance, Accessibility, SEO">
                        <div className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-400" title="Performance: 92/100">
                            ⚡92
                        </div>
                        <div className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-400" title="Accessibility: 98/100">
                            ♿98
                        </div>
                        <div className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-400" title="SEO: 95/100">
                            🔍95
                        </div>
                    </div>
                </div>
            )}

            {/* Figma-style Workspace Floating Navigation Toolbar (Bottom-Right) */}
            <div className="absolute bottom-6 right-6 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-2xl z-40 backdrop-blur-md">
                {/* Viewport Toggle */}
                <div className="flex items-center gap-0.5 bg-slate-950/40 p-0.5 rounded-lg border border-slate-850/50 mr-1">
                    <Button
                        variant="ghost"
                        onClick={() => onSetViewport?.('desktop')}
                        className={cn(
                            "h-7 w-7 p-0 rounded-md transition-all border-0",
                            viewport === 'desktop' ? "bg-slate-850 shadow-sm text-blue-400 hover:text-blue-400" : "bg-transparent text-slate-500 hover:text-slate-350"
                        )}
                        title="Desktop View"
                    >
                        <MonitorPlay className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => onSetViewport?.('tablet')}
                        className={cn(
                            "h-7 w-7 p-0 rounded-md transition-all border-0",
                            viewport === 'tablet' ? "bg-slate-850 shadow-sm text-blue-400 hover:text-blue-400" : "bg-transparent text-slate-500 hover:text-slate-350"
                        )}
                        title="Tablet View"
                    >
                        <Tablet className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => onSetViewport?.('mobile')}
                        className={cn(
                            "h-7 w-7 p-0 rounded-md transition-all border-0",
                            viewport === 'mobile' ? "bg-slate-850 shadow-sm text-blue-400 hover:text-blue-400" : "bg-transparent text-slate-500 hover:text-slate-350"
                        )}
                        title="Mobile View"
                    >
                        <Smartphone className="w-3.5 h-3.5" />
                    </Button>
                </div>
                
                <div className="h-4 w-[1px] bg-slate-850" />

                <Button
                    onClick={() => setPanToolActive(prev => !prev)}
                    className={cn(
                        "h-8 w-8 p-0 rounded-lg transition-colors border-0",
                        panToolActive 
                            ? "bg-emerald-500 text-white hover:bg-emerald-600" 
                            : "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    )}
                    variant="ghost"
                    title={panToolActive ? "Select Tool (V)" : "Hand Pan Tool (Space)"}
                >
                    {panToolActive ? <Hand className="h-4 w-4" /> : <MousePointer className="h-4 w-4" />}
                </Button>

                <Button
                    onClick={() => {
                        const next = !commentsMode;
                        setCommentsMode(next);
                        setNewCommentPos(null);
                        toast({
                            title: next ? "Comment Mode Activated 💬" : "Pointer Select Restored 🖱️",
                            description: next ? "Click anywhere on the canvas to place review annotation comment pins." : "Normal click select actions restored.",
                        });
                    }}
                    className={cn(
                        "h-8 w-8 p-0 rounded-lg transition-colors border-0",
                        commentsMode 
                            ? "bg-violet-600 text-white hover:bg-violet-500" 
                            : "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    )}
                    variant="ghost"
                    title="Collaboration Pin Comments (C)"
                >
                    <MessageSquare className="h-4 w-4" />
                </Button>
                <div className="h-4 w-[1px] bg-slate-800" />

                <Button
                    onClick={() => setZoom(prev => Math.max(0.3, prev - 0.1))}
                    className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 bg-transparent border-0"
                    variant="ghost"
                    title="Zoom Out"
                >
                    <ZoomOut className="h-4 w-4" />
                </Button>

                <button
                    onDoubleClick={resetZoomAndPan}
                    className="px-2 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors font-mono select-none"
                    title="Double click to reset canvas"
                >
                    {Math.round(zoom * 100)}%
                </button>

                <Button
                    onClick={() => setZoom(prev => Math.min(2.0, prev + 0.1))}
                    className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 bg-transparent border-0"
                    variant="ghost"
                    title="Zoom In"
                >
                    <ZoomIn className="h-4 w-4" />
                </Button>

                <div className="h-4 w-[1px] bg-slate-800" />

                <Button
                    onClick={resetZoomAndPan}
                    className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 bg-transparent border-0"
                    variant="ghost"
                    title="Reset Zoom & Pan"
                >
                    <RotateCcw className="h-4 w-4" />
                </Button>
            </div>

            {/* Floating minimap navigation stack */}
            {!isPreview && version.structureJson.sections.length > 0 && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2.5 z-45 bg-slate-950/80 border border-slate-850/80 backdrop-blur px-2.5 py-4 rounded-full shadow-2xl select-none">
                    <span className="text-[6px] text-slate-500 font-black text-center mb-1 uppercase tracking-wider">Map</span>
                    {version.structureJson.sections.map((sec, sIdx) => {
                        const label = (sec.props.name as string) || (sec.props.category as string) || `Section ${sIdx + 1}`;
                        return (
                            <button
                                key={sec.id}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className={cn(
                                    "w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all active:scale-95 group/map relative",
                                    selectedSectionId === sec.id
                                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                                        : "border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-400"
                                )}
                                title={label}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {/* Floating Tooltip */}
                                <span className="absolute right-9 scale-0 group-hover/map:scale-100 bg-slate-900 border border-slate-800 text-slate-350 px-2 py-0.5 rounded text-[8px] font-black tracking-wider uppercase whitespace-nowrap shadow-xl transition-all origin-right z-50">
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Persistent Nesting Breadcrumbs Bar */}
            {!isPreview && breadcrumbPath && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 z-45 text-[9px] font-black uppercase text-slate-400 tracking-wider transition-all select-none">
                    {breadcrumbPath.map((item, idx) => (
                        <React.Fragment key={idx}>
                            {idx > 0 && <span className="text-slate-700">/</span>}
                            <button
                                type="button"
                                onClick={() => {
                                    if (item.type === 'block' && item.id) {
                                        onSelectBlock(item.id);
                                        onSetTab('edit');
                                    } else if (item.type === 'section' && item.id) {
                                        onSelectBlock(null);
                                        onEditSection(item.id);
                                    }
                                }}
                                className={cn(
                                    "hover:text-slate-200 transition-colors font-bold",
                                    item.type === 'block' ? "text-blue-400 hover:text-blue-300" : item.type === 'section' ? "text-purple-400 hover:text-purple-300" : ""
                                )}
                                disabled={item.type === 'page' || item.type === 'column'}
                            >
                                {item.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Inline Floating WYSIWYG Editor Toolbar for Rich Text block */}
            {activeBlockType === 'text' && !isPreview && (
                <div
                    ref={toolbarRef}
                    className="absolute backdrop-blur bg-slate-900/95 border border-slate-950 shadow-2xl rounded-xl p-1.5 flex items-center gap-1 z-50 text-slate-200"
                    style={{
                        display: 'none',
                    }}
                >
                    {/* Fonts & Sizes Dropdowns */}
                    <div className="flex items-center gap-1">
                        <Select
                            onValueChange={(val) => {
                                applyStyleToSelection('font-family', val === 'default' ? 'inherit' : val);
                            }}
                        >
                            <SelectTrigger className="w-[80px] h-7 bg-slate-950 border-slate-800 text-[10px] font-medium text-slate-350 focus:ring-0 focus:ring-offset-0 px-2 rounded-lg">
                                <SelectValue placeholder="Font" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-950 border-slate-850 text-slate-200">
                                <SelectItem value="default" className="text-[10px]">Default</SelectItem>
                                <SelectItem value="Inter" className="text-[10px] font-sans">Sans (Inter)</SelectItem>
                                <SelectItem value="Playfair Display" className="text-[10px] font-serif">Serif (Playfair)</SelectItem>
                                <SelectItem value="Courier New" className="text-[10px] font-mono">Monospace</SelectItem>
                                <SelectItem value="Georgia" className="text-[10px]">Georgia</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            onValueChange={(val) => {
                                applyStyleToSelection('font-size', val);
                            }}
                        >
                            <SelectTrigger className="w-[60px] h-7 bg-slate-950 border-slate-800 text-[10px] font-medium text-slate-350 focus:ring-0 focus:ring-offset-0 px-2 rounded-lg">
                                <SelectValue placeholder="Size" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-950 border-slate-850 text-slate-200">
                                <SelectItem value="12px" className="text-[10px]">12px</SelectItem>
                                <SelectItem value="14px" className="text-[10px]">14px</SelectItem>
                                <SelectItem value="16px" className="text-[10px]">16px</SelectItem>
                                <SelectItem value="18px" className="text-[10px]">18px</SelectItem>
                                <SelectItem value="20px" className="text-[10px]">20px</SelectItem>
                                <SelectItem value="24px" className="text-[10px]">24px</SelectItem>
                                <SelectItem value="30px" className="text-[10px]">30px</SelectItem>
                                <SelectItem value="36px" className="text-[10px]">36px</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-[1px] h-4 bg-slate-850 mx-0.5" />

                    {/* Formatting Actions */}
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('bold');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Bold"
                    >
                        <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('italic');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Italic"
                    >
                        <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('underline');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Underline"
                    >
                        <Underline className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('strikeThrough');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Strikethrough"
                    >
                        <Strikethrough className="h-3.5 w-3.5" />
                    </button>

                    <div className="w-[1px] h-4 bg-slate-850 mx-0.5" />

                    {/* Headings */}
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('formatBlock', '<h1>');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors text-[10px] font-black w-6 h-6 flex items-center justify-center"
                        title="Heading 1"
                    >
                        H1
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('formatBlock', '<h2>');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors text-[10px] font-black w-6 h-6 flex items-center justify-center"
                        title="Heading 2"
                    >
                        H2
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('formatBlock', '<h3>');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors text-[10px] font-black w-6 h-6 flex items-center justify-center"
                        title="Heading 3"
                    >
                        H3
                    </button>

                    <div className="w-[1px] h-4 bg-slate-850 mx-0.5" />

                    {/* Lists & Quote */}
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('insertUnorderedList');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Bulleted List"
                    >
                        <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('insertOrderedList');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Numbered List"
                    >
                        <ListOrdered className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('formatBlock', '<blockquote>');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Blockquote"
                    >
                        <Quote className="h-3.5 w-3.5" />
                    </button>

                    <div className="w-[1px] h-4 bg-slate-850 mx-0.5" />

                    {/* Text Color Picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center justify-center"
                                title="Text Color"
                            >
                                <Baseline className="h-3.5 w-3.5" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 bg-slate-950 border-slate-850 p-3 rounded-xl shadow-xl z-50 text-slate-200 font-body">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preset Colors</Label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {[
                                        '#3b82f6', // blue
                                        '#10b981', // emerald
                                        '#8b5cf6', // violet
                                        '#f97316', // orange
                                        '#ef4444', // red
                                        '#09090b', // zinc-950
                                        '#71717a', // zinc-500
                                        '#f4f4f5', // zinc-100
                                        '#38bdf8', // sky-400
                                        '#a855f7'  // purple-500
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => applyStyleToSelection('color', color)}
                                            className="w-5 h-5 rounded-full border border-slate-800 transition-transform hover:scale-110"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <div className="h-[1px] bg-slate-850 my-2" />
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Custom HEX</Label>
                                    <Input
                                        type="text"
                                        placeholder="#000000"
                                        className="h-7 text-xs bg-slate-900 border-slate-800 text-slate-200 rounded px-2 focus-visible:ring-1 focus-visible:ring-slate-700 focus-visible:ring-offset-0 outline-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                applyStyleToSelection('color', e.currentTarget.value);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="w-[1px] h-4 bg-slate-850 mx-0.5" />

                    {/* Alignment */}
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('justifyLeft');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Align Left"
                    >
                        <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('justifyCenter');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Align Center"
                    >
                        <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('justifyRight');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Align Right"
                    >
                        <AlignRight className="h-3.5 w-3.5" />
                    </button>

                    <div className="w-[1px] h-4 bg-slate-850 mx-0.5" />

                    {/* Premium Hyperlink Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                                title="Insert Link"
                            >
                                <Link2 className="h-3.5 w-3.5" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 bg-slate-950 border-slate-850 p-4 rounded-xl shadow-xl z-50 text-slate-200 font-body space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Link URL</Label>
                                <Input
                                    type="text"
                                    placeholder="https://example.com"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200 rounded px-2 focus-visible:ring-1 focus-visible:ring-slate-700 focus-visible:ring-offset-0 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="link-new-tab"
                                    checked={linkNewTab}
                                    onChange={(e) => setLinkNewTab(e.target.checked)}
                                    className="rounded border-slate-800 bg-slate-900 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <Label htmlFor="link-new-tab" className="text-xs text-slate-350 cursor-pointer select-none">Open in a new tab</Label>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    onClick={() => {
                                        if (linkUrl.trim()) {
                                            insertHyperlink(linkUrl.trim(), linkNewTab);
                                            setLinkUrl('');
                                        }
                                    }}
                                    className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                    Apply
                                </button>
                                <button
                                    onClick={() => {
                                        removeHyperlink();
                                        setLinkUrl('');
                                    }}
                                    className="px-2 h-8 border border-slate-800 hover:bg-slate-900 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                                    title="Remove Link"
                                >
                                    Unlink
                                </button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            executeCommand('removeFormat');
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Clear Formatting"
                    >
                        <RemoveFormatting className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </main>
    );
});

Canvas.displayName = 'Canvas';

export default Canvas;

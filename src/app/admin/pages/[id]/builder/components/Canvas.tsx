'use client';

import React, { useState, useEffect, useRef } from 'react';
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
    MessageSquare
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
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
    selectedSectionId?: string | null;
    onSelectBlock: (id: string | null) => void;

    onSetTab: (tab: string) => void;
    onUpdateBlockProps: (blockId: string, props: Record<string, unknown>) => void;
    onRemoveBlock: (blockId: string) => void;
    onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
    onDuplicateBlock: (blockId: string) => void;
    onRemoveSection: (sectionId: string) => void;
    onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
    onInsertSection?: (index: number) => void;
    onEditSection: (sectionId: string) => void;
    onSaveSectionAsTemplate: (section: PageSection) => void;

    onReorderSections: (from: number, to: number) => void;
    onReorderBlocks: (sectionId: string, from: number, to: number) => void;
    onMoveBlockToColumn: (blockId: string, targetSectionId: string, targetColumnIndex: number, targetIndex: number) => void;
    canvasMode: 'edit' | 'preview';
    editMode: 'columns' | 'components';
    onSetEditMode: (mode: 'columns' | 'components') => void;
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

    const isGlobal = section.props.category === 'global';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group/section relative transition-all border border-dashed rounded-xl pt-8 pb-2 px-2 my-8",
                !isPreview && (
                    isGlobal
                        ? "border-purple-500 bg-purple-500/5 hover:border-purple-400"
                        : editMode === 'columns'
                        ? "border-emerald-500/30 hover:border-emerald-500/60"
                        : "border-slate-800/20 hover:border-slate-800/50"
                ),
                isDragging && "z-50 shadow-2xl ring-2 ring-emerald-500/30"
            )}
        >
            {/* Professional Section Header Bar */}
            {!isPreview && (
                <div className="absolute top-0 inset-x-0 h-7 bg-slate-900 border-b border-slate-800 rounded-t-xl flex items-center justify-between px-3 text-[9px] font-black uppercase text-slate-400 tracking-wider z-25 opacity-90 transition-opacity select-none group-hover/section:opacity-100">
                    <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-extrabold">Section</span>
                        <span className="text-slate-700">·</span>
                        <span className="text-slate-350">{(section.props.name as string) || (section.props.category as string) || 'Layout'}</span>
                        {isGlobal && (
                            <span className="ml-1 bg-purple-500/15 border border-purple-500/30 text-purple-400 text-[7px] font-black px-1 rounded">GLOBAL</span>
                        )}
                        <span className="text-slate-700">·</span>
                        <span className="text-slate-500">{(section.props.layout as string) || 'Grid'}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                        <div {...attributes} {...listeners} className="h-4.5 px-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-[8px] rounded flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 font-bold" title="Drag to reorder section">
                            DRAG
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onMove('up'); }} disabled={idx === 0} className="hover:text-emerald-400 disabled:opacity-20 text-[8px] font-bold">UP</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onMove('down'); }} disabled={idx === total - 1} className="hover:text-emerald-400 disabled:opacity-20 text-[8px] font-bold">DOWN</button>
                        <span className="text-slate-800">|</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onSave(); }} className="hover:text-violet-400 text-[8px] font-bold flex items-center gap-0.5">
                            <FolderHeart className="w-2.5 h-2.5" /> SAVE
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="hover:text-blue-400 text-[8px] font-bold flex items-center gap-0.5">
                            <SlidersHorizontal className="w-2.5 h-2.5" /> CONFIG
                        </button>
                        <span className="text-slate-800">|</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="hover:text-red-400 text-[8px] font-bold flex items-center gap-0.5">
                            <Trash2 className="w-2.5 h-2.5" /> DELETE
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
        <div className="group/inserter h-4 -my-2 relative flex items-center justify-center z-35 select-none cursor-pointer">
            <div className="absolute inset-x-0 h-[1.5px] bg-slate-200/0 group-hover/inserter:bg-emerald-500/30 transition-colors" />
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                className="scale-0 group-hover/inserter:scale-100 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg transition-all active:scale-[0.96] z-40 border-0 cursor-pointer"
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
                        className="h-5 w-5 rounded-full shadow-md bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center cursor-grab active:cursor-grabbing"
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
    onRemoveBlock: (blockId: string) => void;
    onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
    onDuplicateBlock: (blockId: string) => void;
    editCtx: (blockId: string) => BlockRenderContext;
    editMode: 'columns' | 'components';
    canvasMode: 'edit' | 'preview';
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `col-${sectionId}-${colIdx}`,
        data: { sectionId, columnIndex: colIdx }
    });

    const blockIds = blocks.map(b => b.id);
    const isPreview = canvasMode === 'preview';

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex-1 min-h-[120px] p-4 rounded-xl flex flex-col gap-4 transition-all duration-300 relative",
                !isPreview && (editMode === 'components' ? "bg-transparent border border-dashed border-slate-350/20 dark:border-slate-700/20 hover:border-blue-500/30" : "border border-transparent"),
                isOver && "bg-blue-500/5 border-blue-500/30 scale-[0.99] border-dashed ring-2 ring-blue-500/10"
            )}
        >
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
    resources,
    selectedBlockId,
    selectedSectionId,
    onSelectBlock,

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
    canvasMode,
    editMode,
    onSetEditMode: _onSetEditMode,
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
    const [isMounted, setIsMounted] = useState(false);
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
                setZoom(prev => Math.min(Math.max(0.3, prev + delta), 2.0));
            } else {
                e.preventDefault();
                setPanOffset(prev => ({
                    x: prev.x - e.deltaX * 0.8,
                    y: prev.y - e.deltaY * 0.8,
                }));
            }
        };

        workspace.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => {
            workspace.removeEventListener('wheel', handleNativeWheel);
        };
    }, []);

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
        setPanOffset({
            x: e.clientX - panStartRef.current.x,
            y: e.clientY - panStartRef.current.y,
        });
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

        if (activeId.startsWith('section-') || !activeId.includes('-')) {
            if (overId.startsWith('section-') || !overId.includes('-')) {
                const oldIdx = version.structureJson.sections.findIndex(s => s.id === activeId);
                const newIdx = version.structureJson.sections.findIndex(s => s.id === overId);
                if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
                    onReorderSections(oldIdx, newIdx);
                }
            }
            return;
        }

        let targetSectionId = '';
        let targetColIdx = 0;
        let targetBlockIndex = 0;

        if (overId.startsWith('col-')) {
            const parts = overId.split('-');
            targetSectionId = parts.slice(1, -1).join('-');
            targetColIdx = parseInt(parts[parts.length - 1], 10);
            const targetSection = version.structureJson.sections.find(s => s.id === targetSectionId);
            if (!targetSection) return;
            const colBlocks = targetSection.blocks.filter(b => ((b.props || {}) as { column?: number }).column === targetColIdx);
            targetBlockIndex = colBlocks.length;
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

    // Custom pointer position dnd-kit modifier to divide coordinate transform offsets by the zoom factor
    const zoomModifier = ({ transform }: { transform: { x: number; y: number; scaleX: number; scaleY: number } }) => {
        return {
            ...transform,
            x: transform.x / zoom,
            y: transform.y / zoom,
        };
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
            className="flex-1 overflow-hidden relative select-none"
            style={{ 
                background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)',
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
                    className={cn(
                        "bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 relative select-none text-slate-800",
                        viewport === 'desktop'
                            ? "w-[1280px] min-h-[800px] rounded-2xl ring-1 ring-slate-800/10"
                            : viewport === 'tablet'
                            ? "w-[768px] min-h-[1024px] rounded-[1.5rem] border-[8px] border-slate-900 ring-1 ring-slate-850"
                            : "w-[390px] min-h-[844px] rounded-[2.5rem] border-[8px] border-slate-900 ring-1 ring-slate-850"
                    )}
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
                            <div className="divide-y divide-slate-100 min-h-[400px]">
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
                                                                backgroundColor: overlayCol,
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
            {!isPreview && (
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
                </div>
            )}

            {/* Figma-style Workspace Floating Navigation Toolbar (Bottom-Right) */}
            <div className="absolute bottom-6 right-6 flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-2xl z-40 backdrop-blur-md">
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
        </main>
    );
});

Canvas.displayName = 'Canvas';

export default Canvas;

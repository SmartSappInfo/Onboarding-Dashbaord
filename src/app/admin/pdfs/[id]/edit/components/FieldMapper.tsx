'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
    Text, Signature, Calendar, Trash2, Loader2, Sparkles, 
    PanelLeftClose, PanelLeftOpen, ZoomIn, ZoomOut, Save, Eye, Copy, Replace, 
    EyeOff, Check, X, AlignStartHorizontal, AlignEndHorizontal, AlignStartVertical, AlignEndVertical, 
    AlignCenterHorizontal, AlignCenterVertical, GripVertical, Undo, Redo, ALargeSmall, ChevronDownSquare, ChevronDown, Key,
    Phone, Mail, Clock, Camera
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField } from '@/lib/types';
import { DndContext, useDraggable, type DragEndEvent, useSensors, useSensor, PointerSensor, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@nd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const pdfjsPromise = import('pdfjs-dist');

const DistributeHorizontal = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="6" height="14" x="2" y="5" rx="1"/>
    <rect width="6" height="14" x="16" y="5" rx="1"/>
    <path d="M12 2v20"/>
  </svg>
);

const DistributeVertical = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="14" height="6" x="5" y="2" rx="1"/>
    <rect width="14" height="6" x="5" y="16" rx="1"/>
    <path d="M2 12h20"/>
  </svg>
);

const fieldIcons: { [key in PDFFormField['type']]: React.ElementType } = {
  text: Text,
  signature: Signature,
  date: Calendar,
  dropdown: ChevronDownSquare,
  phone: Phone,
  email: Mail,
  time: Clock,
  photo: Camera,
};

type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';
type LocalPDFFormField = PDFFormField & { isSuggestion?: boolean };

function PageRenderer({ pdf, pageNumber, fields, selectedFieldIds, namingFieldId, onSelect, onUpdate, onDelete, onDuplicate, onChangeType, alignFields, distributeFields, bulkDuplicate, bulkRemove, zoom }: {
    pdf: PDFDocumentProxy;
    pageNumber: number;
    fields: LocalPDFFormField[];
    selectedFieldIds: string[];
    namingFieldId: string | null;
    onSelect: (id: string, multi?: boolean, toggle?: boolean) => void;
    onUpdate: (id: string, newProps: Partial<LocalPDFFormField>) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onChangeType: (id: string, newType: PDFFormField['type']) => void;
    alignFields: (type: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => void;
    distributeFields: (type: 'horizontal' | 'vertical') => void;
    bulkDuplicate: () => void;
    bulkRemove: () => void;
    zoom: number;
}) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const renderTaskRef = React.useRef<any>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [pageDimensions, setPageDimensions] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        let isMounted = true;
        const renderPage = async () => {
             if (!isMounted) return;
             setIsLoading(true);
             
             try {
                const pdfjs = await pdfjsPromise;
                const pdfjsVersion = '4.4.168';
                pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

                if (!isMounted) return;
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: zoom * 1.5, rotation: page.rotate });
                
                if (!isMounted) return;
                setPageDimensions({ width: viewport.width, height: viewport.height });

                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        if (renderTaskRef.current) {
                            renderTaskRef.current.cancel();
                        }
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        const renderTask = page.render({ canvasContext: context, viewport });
                        renderTaskRef.current = renderTask;
                        await renderTask.promise;
                    }
                }
            } catch (error: any) {
                if (error.name === 'RenderingCancelledException') return;
                console.error(`Error rendering page ${pageNumber}:`, error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        renderPage();
        return () => { 
            isMounted = false; 
            if (renderTaskRef.current) renderTaskRef.current.cancel();
        };
    }, [pdf, pageNumber, zoom]);

    const selectedOnThisPage = fields.filter(f => selectedFieldIds.includes(f.id));
    const isMultiSelect = selectedFieldIds.length > 1;
    
    const displayWidth = pageDimensions.width > 0 ? pageDimensions.width / 1.5 : 816;
    const displayHeight = pageDimensions.height > 0 ? pageDimensions.height / 1.5 : 1056;

    return (
        <div 
            data-page-number={pageNumber}
            className="relative mx-auto shadow-xl mb-8 bg-white pdf-page-container transition-all flex-shrink-0 touch-pan-x touch-pan-y"
            style={{ width: displayWidth, height: displayHeight }}
        >
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
            
            {(displayWidth > 0) && fields.map(field => (
                <ResizableField
                    key={field.id}
                    field={field}
                    pageDimensions={{ width: displayWidth * 1.5, height: displayHeight * 1.5 }}
                    isSelected={selectedFieldIds.includes(field.id)}
                    isPartOfMultiSelect={isMultiSelect}
                    isNamingField={field.id === namingFieldId}
                    onSelect={onSelect}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onChangeType={onChangeType}
                    zoom={zoom}
                />
            ))}

            {pageDimensions.width > 0 && selectedOnThisPage.length > 1 && (
                <SelectionOverlay
                    fields={selectedOnThisPage}
                    pageDimensions={pageDimensions}
                    onUpdate={onUpdate}
                    alignFields={alignFields}
                    distributeFields={distributeFields}
                    bulkDuplicate={bulkDuplicate}
                    bulkRemove={bulkRemove}
                />
            )}
        </div>
    );
}

const ResizableField = ({
    field, pageDimensions, isSelected, isPartOfMultiSelect, isNamingField, onSelect, onUpdate, onDelete, onDuplicate, onChangeType, zoom
}: {
    field: LocalPDFFormField;
    pageDimensions: { width: number, height: number };
    isSelected: boolean;
    isPartOfMultiSelect: boolean;
    isNamingField: boolean;
    onSelect: (id: string, multi?: boolean, toggle?: boolean) => void;
    onUpdate: (id: string, newProps: Partial<LocalPDFFormField>) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onChangeType: (id: string, type: PDFFormField['type']) => void;
    zoom: number;
}) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: field.id });
    const [isResizing, setIsResizing] = React.useState(false);
    const [isEditingPlaceholder, setIsEditingPlaceholder] = React.useState(false);
    const resizeHandleRef = React.useRef<ResizeHandle | null>(null);
    const initialResizeState = React.useRef<{
        startX: number; startY: number; startWidth: number; startHeight: number; startFieldX: number; startFieldY: number;
    } | null>(null);

    const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
        e.stopPropagation(); e.preventDefault();
        setIsResizing(true);
        resizeHandleRef.current = handle;
        const displayWidth = pageDimensions.width / 1.5;
        const displayHeight = pageDimensions.height / 1.5;
        initialResizeState.current = {
            startX: e.clientX, startY: e.clientY,
            startWidth: (field.dimensions.width / 100) * displayWidth,
            startHeight: (field.dimensions.height / 100) * displayHeight,
            startFieldX: (field.position.x / 100) * displayWidth,
            startFieldY: (field.position.y / 100) * displayHeight,
        };
        onSelect(field.id, false, false);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isPartOfMultiSelect) setIsEditingPlaceholder(true);
    };

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !initialResizeState.current || !resizeHandleRef.current) return;
            const dx = e.clientX - initialResizeState.current.startX;
            const dy = e.clientY - initialResizeState.current.startY;
            const { startWidth, startHeight, startFieldX, startFieldY } = initialResizeState.current;
            let newX = startFieldX, newY = startFieldY, newWidth = startWidth, newHeight = startHeight;
            const handle = resizeHandleRef.current;

            if (handle.includes('bottom')) newHeight = startHeight + dy;
            if (handle.includes('top')) { newHeight = startHeight - dy; newY = startFieldY + dy; }
            if (handle.includes('right')) newWidth = startWidth + dx;
            if (handle.includes('left')) { newWidth = startWidth - dx; newX = startFieldX + dx; }
            
            const displayWidth = pageDimensions.width / 1.5;
            const displayHeight = pageDimensions.height / 1.5;
            onUpdate(field.id, {
                position: { x: (newX / displayWidth) * 100, y: (newY / displayHeight) * 100 },
                dimensions: { width: (newWidth / displayWidth) * 100, height: (newHeight / displayHeight) * 100 },
                isSuggestion: false,
            });
        };
        const handleMouseUp = () => { setIsResizing(false); resizeHandleRef.current = null; };
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, field.id, onUpdate, pageDimensions]);

    const style: React.CSSProperties = {
        position: 'absolute', left: `${field.position.x}%`, top: `${field.position.y}%`,
        width: `${field.dimensions.width}%`, height: `${field.dimensions.height}%`,
        transform: CSS.Translate.toString(transform), zIndex: isSelected ? 10 : (field.isSuggestion ? 5 : 1),
    };

    const scaledFontSize = `${Math.max(8, 10 * zoom)}px`;
    const borderColorClass = isSelected ? 'border-primary' : field.isSuggestion ? 'border-green-500' : 'border-dashed border-primary/50 hover:border-primary';
    const resizeHandles: ResizeHandle[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes} 
            data-field-id={field.id}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { 
                e.stopPropagation(); 
                onSelect(field.id, e.shiftKey, e.ctrlKey || e.metaKey); 
            }} 
            onDoubleClick={handleDoubleClick}
            className={cn(
                "absolute border-2 transition-colors flex overscroll-behavior-none",
                borderColorClass,
                (field.type === 'signature' || field.type === 'photo') ? "items-center justify-center text-center" : "items-start justify-start p-1 text-left"
            )}
        >
            <div {...listeners} className="w-full h-full cursor-grab absolute inset-0 z-0" onMouseDown={(e) => e.stopPropagation()}></div>
            
            {isEditingPlaceholder ? (
                <textarea
                    autoFocus
                    className="absolute inset-0 w-full h-full bg-transparent border-none outline-none resize-none p-1 italic text-muted-foreground z-20 overflow-hidden"
                    style={{ fontSize: scaledFontSize }}
                    value={field.placeholder || ''}
                    onChange={(e) => onUpdate(field.id, { placeholder: e.target.value, isSuggestion: false })}
                    onBlur={() => setIsEditingPlaceholder(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setIsEditingPlaceholder(false);
                        }
                    }}
                />
            ) : (
                field.placeholder && (
                    <span 
                        className={cn(
                            "text-muted-foreground italic z-10 select-none pointer-events-none",
                            (field.type === 'signature' || field.type === 'photo') ? "w-full px-1" : "text-left"
                        )}
                        style={{ fontSize: scaledFontSize }}
                    >
                        {field.placeholder}
                    </span>
                )
            )}

            {(field.type === 'dropdown' || field.type === 'time') && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                    {field.type === 'dropdown' ? <ChevronDown className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                </div>
            )}

            {isNamingField && !isSelected && (
                <div className="absolute -top-5 -right-1 bg-primary text-white p-0.5 rounded-full shadow-sm z-30">
                    <Key className="h-2.5 w-2.5" />
                </div>
            )}

            {isSelected && !isPartOfMultiSelect && (
                <>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 flex gap-1 rounded-lg border bg-background p-1 shadow-md" onMouseDown={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setIsEditingPlaceholder(true); }}>
                                        <ALargeSmall className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Edit Placeholder</p></TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDuplicate(field.id); }}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Duplicate</p></TooltipContent>
                            </Tooltip>
                            
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7"><Replace className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Change Type</p></TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent className="w-auto p-1" side="top">
                                    {(['text', 'signature', 'date', 'dropdown', 'phone', 'email', 'time', 'photo'] as const).map(type => {
                                        const Icon = fieldIcons[type];
                                        return (
                                            <DropdownMenuItem key={type} className="text-xs capitalize" onClick={() => onChangeType(field.id, type)}>
                                                <Icon className="mr-2 h-4 w-4" />
                                                <span>{type}</span>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(field.id); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    {resizeHandles.map(handle => (
                         <div key={handle}
                            onMouseDown={(e) => handleResizeStart(e, handle)}
                            className={cn('absolute bg-primary rounded-full w-2.5 h-2.5 z-20 -translate-x-1/2 -translate-y-1/2',
                                handle.includes('top') ? 'top-0' : handle.includes('bottom') ? 'top-full' : 'top-1/2',
                                handle.includes('left') ? 'left-0' : handle.includes('right') ? 'left-full' : 'left-1/2',
                                handle === 'top' && 'cursor-n-resize', handle === 'bottom' && 'cursor-s-resize',
                                handle === 'left' && 'cursor-w-resize', handle === 'right' && 'cursor-e-resize',
                                handle === 'top-left' && 'cursor-nw-resize', handle === 'top-right' && 'cursor-ne-resize',
                                handle === 'bottom-left' && 'cursor-sw-resize', handle === 'bottom-right' && 'cursor-se-resize'
                            )}
                        />
                    ))}
                </>
            )}
             {field.isSuggestion && <span className="absolute -top-6 left-0 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">AI Suggestion</span>}
        </div>
    );
};

const SelectionOverlay = ({ fields, pageDimensions, onUpdate, alignFields, distributeFields, bulkDuplicate, bulkRemove }: {
    fields: LocalPDFFormField[];
    pageDimensions: { width: number, height: number };
    onUpdate: (id: string, newProps: Partial<LocalPDFFormField>) => void;
    alignFields: (type: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => void;
    distributeFields: (type: 'horizontal' | 'vertical') => void;
    bulkDuplicate: () => void;
    bulkRemove: () => void;
}) => {
    const [isResizing, setIsResizing] = React.useState(false);
    const resizeHandleRef = React.useRef<ResizeHandle | null>(null);
    const initialSelectionState = React.useRef<{
        startX: number; startY: number; 
        box: { x: number, y: number, w: number, h: number };
        fieldStates: { id: string, x: number, y: number, w: number, h: number }[];
    } | null>(null);

    const minX = Math.min(...fields.map(f => f.position.x));
    const minY = Math.min(...fields.map(f => f.position.y));
    const maxX = Math.max(...fields.map(f => f.position.x + f.dimensions.width));
    const maxY = Math.max(...fields.map(f => f.position.y + f.dimensions.height));
    const boxW = maxX - minX;
    const boxH = maxY - minY;

    const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
        e.stopPropagation(); e.preventDefault();
        setIsResizing(true);
        resizeHandleRef.current = handle;
        initialSelectionState.current = {
            startX: e.clientX, startY: e.clientY,
            box: { x: minX, y: minY, w: boxW, h: boxH },
            fieldStates: fields.map(f => ({ id: f.id, x: f.position.x, y: f.position.y, w: f.dimensions.width, h: f.dimensions.height }))
        };
    };

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !initialSelectionState.current || !resizeHandleRef.current) return;
            const displayWidth = pageDimensions.width / 1.5;
            const displayHeight = pageDimensions.height / 1.5;
            const dx = ((e.clientX - initialSelectionState.current.startX) / displayWidth) * 100;
            const dy = ((e.clientY - initialSelectionState.current.startY) / displayHeight) * 100;
            
            const { box, fieldStates } = initialSelectionState.current;
            const handle = resizeHandleRef.current;

            let newBoxW = box.w, newBoxH = box.h, newBoxX = box.x, newBoxY = box.y;

            if (handle.includes('right')) newBoxW = Math.max(1, box.w + dx);
            if (handle.includes('left')) { newBoxW = Math.max(1, box.w - dx); newBoxX = box.x + dx; }
            if (handle.includes('bottom')) newBoxH = Math.max(1, box.h + dy);
            if (handle.includes('top')) { newBoxH = Math.max(1, box.h - dy); newBoxY = box.y + dy; }

            const scaleX = newBoxW / box.w;
            const scaleY = newBoxH / box.h;

            fieldStates.forEach(f => {
                const relativeX = f.x - box.x;
                const relativeY = f.y - box.y;
                onUpdate(f.id, {
                    position: { 
                        x: newBoxX + (relativeX * scaleX), 
                        y: newBoxY + (relativeY * scaleY) 
                    },
                    dimensions: { 
                        width: f.w * scaleX, 
                        height: f.h * scaleY 
                    }
                });
            });
        };
        const handleMouseUp = () => { setIsResizing(false); resizeHandleRef.current = null; };
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, onUpdate, pageDimensions]);

    const handles: ResizeHandle[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];

    return (
        <div 
            className="absolute border-2 border-primary pointer-events-none z-20"
            style={{ left: `${minX}%`, top: `${minY}%`, width: `${boxW}%`, height: `${boxH}%` }}
        >
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-primary/20 bg-background/95 backdrop-blur-sm p-1 shadow-2xl pointer-events-auto">
                <TooltipProvider>
                    <DropdownMenu>
                        <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><AlignStartHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>Align</TooltipContent></Tooltip>
                        <DropdownMenuContent className="w-auto p-1" side="top">
                            <DropdownMenuItem className="text-xs" onClick={() => alignFields('left')}><AlignStartHorizontal className="mr-2 h-4 w-4" /> Left</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs" onClick={() => alignFields('center-h')}><AlignCenterHorizontal className="mr-2 h-4 w-4" /> Center H</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs" onClick={() => alignFields('right')}><AlignEndHorizontal className="mr-2 h-4 w-4" /> Right</DropdownMenuItem>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem className="text-xs" onClick={() => alignFields('top')}><AlignStartVertical className="mr-2 h-4 w-4" /> Top</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs" onClick={() => alignFields('center-v')}><AlignCenterVertical className="mr-2 h-4 w-4" /> Center V</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs" onClick={() => alignFields('bottom')}><AlignEndVertical className="mr-2 h-4 w-4" /> Bottom</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><DistributeHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>Distribute</TooltipContent></Tooltip>
                        <DropdownMenuContent className="w-auto p-1" side="top">
                            <DropdownMenuItem className="text-xs" onClick={() => distributeFields('horizontal')}><DistributeHorizontal className="mr-2 h-4 w-4" /> Horizontal</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs" onClick={() => distributeFields('vertical')}><DistributeVertical className="mr-2 h-4 w-4" /> Vertical</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <div className="w-px h-4 bg-border mx-1" />
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={bulkDuplicate}><Copy className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={bulkRemove}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Delete Selection</TooltipContent></Tooltip>
                </TooltipProvider>
            </div>

            {handles.map(h => (
                <div key={h}
                    onMouseDown={(e) => handleResizeStart(e, h)}
                    className={cn('absolute bg-white border-2 border-primary rounded-full w-3.5 h-3.5 z-30 pointer-events-auto -translate-x-1/2 -translate-y-1/2 shadow-sm transition-transform hover:scale-125',
                        h.includes('top') ? 'top-0' : h.includes('bottom') ? 'top-full' : 'top-1/2',
                        h.includes('left') ? 'left-0' : h.includes('right') ? 'left-full' : 'left-1/2',
                        h === 'top' && 'cursor-n-resize', h === 'bottom' && 'cursor-s-resize',
                        h === 'left' && 'cursor-w-resize', h === 'right' && 'cursor-e-resize',
                        h === 'top-left' && 'cursor-nw-resize', h === 'top-right' && 'cursor-ne-resize',
                        h === 'bottom-left' && 'cursor-sw-resize', h === 'bottom-right' && 'cursor-se-resize'
                    )}
                />
            ))}
        </div>
    );
};

const SortableFieldListItem = ({ field, isSelected, isNamingField, onSelect, onRemove, onUpdateLabel, isCollapsed }: { 
    field: PDFFormField; 
    isSelected: boolean; 
    isNamingField: boolean;
    onSelect: (e: React.MouseEvent) => void; 
    onRemove: () => void;
    onUpdateLabel: (newLabel: string) => void;
    isCollapsed: boolean;
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(field.label || '');
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
    const Icon = fieldIcons[field.type];
    
    const style = { transform: CSS.Transform.toString(transform), transition };

    const handleBlur = () => { setIsEditing(false); if (editValue.trim() !== field.label) onUpdateLabel(editValue.trim()); };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleBlur(); }
        if (e.key === 'Escape') { setEditValue(field.label || ''); setIsEditing(false); }
    };

    if (isCollapsed) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div 
                            ref={setNodeRef} 
                            style={style} 
                            className={cn(
                                "flex items-center justify-center p-2 rounded-md hover:bg-muted cursor-pointer transition-all",
                                isSelected && 'bg-primary/10 ring-1 ring-primary'
                            )}
                            onClick={onSelect}
                        >
                            <Icon className={cn("h-5 w-5", isSelected ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right"><p>{field.label || field.id}</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-1">
            <button {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-muted rounded text-muted-foreground"><GripVertical className="h-3 w-3" /></button>
            <div 
                className={cn("w-full text-left p-2 rounded-md flex items-center gap-2 hover:bg-muted transition-colors cursor-pointer", isSelected && 'bg-muted ring-1 ring-primary')}
                onClick={onSelect}
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                    <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} className="h-6 text-sm px-1 py-0 flex-1" onClick={(e) => e.stopPropagation()} />
                ) : (
                    <span className="truncate text-sm flex-1">{field.label || field.id}</span>
                )}
                {isNamingField && <Key className="h-3 w-3 text-primary shrink-0" />}
                {field.required && <span className="text-destructive font-bold text-lg leading-none">*</span>}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
        </div>
    );
};

interface PropertiesSidebarProps {
  fields: LocalPDFFormField[];
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
  selectedFieldIds: string[];
  setSelectedFieldIds: React.Dispatch<React.SetStateAction<string[]>>;
  namingFieldId: string | null;
  setNamingFieldId: (id: string | null) => void;
  handleSelect: (id: string, multi?: boolean, toggle?: boolean) => void;
  updateField: (id: string, newProps: Partial<PDFFormField>) => void;
  removeField: (id: string) => void;
  addField: (type: PDFFormField['type']) => void;
  alignFields: (type: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => void;
  distributeFields: (type: 'horizontal' | 'vertical') => void;
  bulkDuplicate: () => void;
  bulkRemove: () => void;
  pagesLength: number;
  pdf: PDFForm;
  isStatusChanging: boolean;
  onStatusChange: (status: PDFForm['status']) => void;
  password: string;
  setPassword: (password: string) => void;
  passwordProtected: boolean;
  setPasswordProtected: (isProtected: boolean) => void;
  onDetect: () => void;
  isDetecting: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const PropertiesSidebar = ({
  fields, setFields, selectedFieldIds, setSelectedFieldIds, namingFieldId, setNamingFieldId, handleSelect, updateField, removeField, addField,
  alignFields, distributeFields, bulkDuplicate, bulkRemove, pagesLength, pdf,
  isStatusChanging, onStatusChange, password, setPassword, passwordProtected, setPasswordProtected, onDetect, isDetecting,
  isCollapsed, onToggleCollapse
}: PropertiesSidebarProps) => {
  const selectedField = selectedFieldIds.length === 1 ? fields.find(f => f.id === selectedFieldIds[0]) : null;
  const [showPassword, setShowPassword] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const hasSuggestions = fields.some(f => f.isSuggestion);

  const acceptAllSuggestions = () => setFields(prev => prev.map(f => ({ ...f, isSuggestion: false })));
  const rejectAllSuggestions = () => setFields(prev => prev.filter(f => !f.isSuggestion));
  const deleteAllFields = () => { setFields([]); setSelectedFieldIds([]); setIsDeleteDialogOpen(false); };

  const bulkUpdate = (props: Partial<LocalPDFFormField>) => {
    setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, ...props } : f));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b shrink-0 bg-background/50 backdrop-blur-sm">
          {!isCollapsed && <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Properties</h2>}
          <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={onToggleCollapse}>
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
      </div>
      
      <ScrollArea className="flex-grow">
        <div className={cn("space-y-4 p-4", isCollapsed && "p-2")}>
            {!isCollapsed && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Quick Add</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 pb-4">
                        <Button variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2" onClick={() => addField('text')}><Text className="h-3 w-3 mr-1.5 text-primary" /> Text</Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2" onClick={() => addField('signature')}><Signature className="h-3 w-3 mr-1.5 text-primary" /> Sig</Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2" onClick={() => addField('date')}><Calendar className="h-3 w-3 mr-1.5 text-primary" /> Date</Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2" onClick={() => addField('dropdown')}><ChevronDownSquare className="h-3 w-3 mr-1.5 text-primary" /> Select</Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2" onClick={() => addField('phone')}><Phone className="h-3 w-3 mr-1.5 text-primary" /> Phone</Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2" onClick={() => addField('email')}><Mail className="h-3 w-3 mr-1.5 text-primary" /> Email</Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2" onClick={() => addField('time')}><Clock className="h-3 w-3 mr-1.5 text-primary" /> Time</Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] justify-start px-2" onClick={() => addField('photo')}><Camera className="h-3 w-3 mr-1.5 text-primary" /> Photo</Button>
                    </CardContent>
                </Card>
            )}

            {!isCollapsed && (
                <Card className={cn(hasSuggestions && "border-green-500 bg-green-50/10")}>
                    <CardHeader className="py-3">
                        <CardTitle className="text-xs font-bold uppercase flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-primary" /> 
                            <span>AI Assistant</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-4">
                        {!hasSuggestions ? (
                            <Button onClick={onDetect} disabled={isDetecting} className="w-full h-9 text-xs font-bold bg-primary text-primary-foreground">
                                {isDetecting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                                Auto-Detect Fields
                            </Button>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-xs" onClick={acceptAllSuggestions}>
                                    <Check className="h-3 w-3 mr-2" /> Accept Suggestions
                                </Button>
                                <Button size="sm" variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs" onClick={rejectAllSuggestions}>
                                    <X className="h-3 w-3 mr-2" /> Reject All
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card className={cn(isCollapsed && "border-none shadow-none bg-transparent")}>
              <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 py-4", isCollapsed && "hidden")}>
                <CardTitle className="text-base font-semibold">Fields ({fields.length})</CardTitle>
                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Delete All</p></TooltipContent></Tooltip>
                    </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className={cn("px-2 pb-2", isCollapsed && "px-0")}>
                  <ScrollArea className={cn("h-[calc(100vh-450px)] px-2", isCollapsed && "px-0")}>
                      <DndContext sensors={useSensors(useSensor(PointerSensor))} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-1">
                                  {fields.map((field) => (
                                      <SortableFieldListItem 
                                          key={field.id} field={field} isSelected={selectedFieldIds.includes(field.id)} isNamingField={field.id === namingFieldId}
                                          onSelect={(e) => handleSelect(field.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                                          onRemove={() => removeField(field.id)}
                                          onUpdateLabel={(newLabel) => updateField(field.id, { label: newLabel })}
                                          isCollapsed={isCollapsed}
                                      />
                                  ))}
                              </div>
                          </SortableContext>
                      </DndContext>
                  </ScrollArea>
              </CardContent>
            </Card>

            {!isCollapsed && (
                <>
                    {selectedField ? (
                        <Card>
                            <CardHeader className="py-4">
                                <CardTitle className="flex justify-between items-center text-sm font-semibold"><span>Field Properties</span><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeField(selectedField.id)}><Trash2 className="h-4 w-4" /></Button></CardTitle>
                                <CardDescription className="text-[10px]">ID: {selectedField.id}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2"><Label htmlFor="f-label" className="text-xs">Field Label</Label><Input id="f-label" value={selectedField.label || ''} onChange={e => updateField(selectedField.id, { label: e.target.value })} className="h-8 text-sm" /></div>
                                <div className="space-y-2"><Label htmlFor="f-placeholder" className="text-xs">Field Placeholder</Label><Input id="f-placeholder" value={selectedField.placeholder || ''} onChange={e => updateField(selectedField.id, { placeholder: e.target.value })} className="h-8 text-sm" /></div>
                                <div className="space-y-2"><Label className="text-xs">Type</Label>
                                    <Select value={selectedField.type} onValueChange={(v: PDFFormField['type']) => updateField(selectedField.id, { type: v, options: v === 'dropdown' ? (selectedField.options || ['Option 1', 'Option 2']) : undefined })}>
                                        <SelectTrigger className="h-8 text-sm capitalize"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="text">Text</SelectItem>
                                            <SelectItem value="signature">Signature</SelectItem>
                                            <SelectItem value="date">Date</SelectItem>
                                            <SelectItem value="dropdown">Dropdown</SelectItem>
                                            <SelectItem value="phone">Phone</SelectItem>
                                            <SelectItem value="email">Email</SelectItem>
                                            <SelectItem value="time">Time</SelectItem>
                                            <SelectItem value="photo">Photo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {selectedField.type === 'dropdown' && (
                                    <div className="space-y-2 pt-2 border-t"><Label className="text-xs font-semibold">Options</Label><Textarea value={selectedField.options?.join('\n')} onChange={e => updateField(selectedField.id, { options: e.target.value.split('\n').filter(Boolean) })} className="min-h-[80px] text-xs" placeholder="One option per line..." /></div>
                                )}
                                <div className="flex items-center justify-between rounded-lg border p-3"><Label className="text-xs">Required</Label><Switch checked={!!selectedField.required} onCheckedChange={(v) => updateField(selectedField.id, { required: v })} /></div>
                                <div className="flex items-center justify-between rounded-lg border p-3 bg-primary/5"><div className="space-y-0.5"><Label className="text-xs flex items-center gap-1.5"><Key className="h-3 w-3" /> Naming Field</Label><p className="text-[10px] text-muted-foreground">Use for file naming.</p></div><Switch checked={namingFieldId === selectedField.id} onCheckedChange={(v) => setNamingFieldId(v ? selectedField.id : null)} /></div>
                                <div className="space-y-2"><Label className="text-xs">Page Number</Label><Input type="number" min="1" max={pagesLength} value={selectedField.pageNumber} onChange={e => updateField(selectedField.id, { pageNumber: parseInt(e.target.value) || 1 })} className="h-8 text-sm" /></div>
                                <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label className="text-xs">X (%)</Label><Input type="number" step="0.1" value={selectedField.position.x.toFixed(1)} onChange={e => updateField(selectedField.id, { position: { ...selectedField.position, x: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" /></div><div className="space-y-2"><Label className="text-xs">Y (%)</Label><Input type="number" step="0.1" value={selectedField.position.y.toFixed(1)} onChange={e => updateField(selectedField.id, { position: { ...selectedField.position, y: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" /></div></div>
                                <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label className="text-xs">Width (%)</Label><Input type="number" step="0.1" value={selectedField.dimensions.width.toFixed(1)} onChange={e => updateField(selectedField.id, { dimensions: { ...selectedField.dimensions, width: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" /></div><div className="space-y-2"><Label className="text-xs">Height (%)</Label><Input type="number" step="0.1" value={selectedField.dimensions.height.toFixed(1)} onChange={e => updateField(selectedField.id, { dimensions: { ...selectedField.dimensions, height: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" /></div></div>
                            </CardContent>
                        </Card>
                    ) : selectedFieldIds.length > 1 ? (
                        <Card>
                            <CardHeader className="py-4"><CardTitle className="text-sm font-semibold text-primary">Bulk Editing</CardTitle><CardDescription className="text-[10px]">{selectedFieldIds.length} selected</CardDescription></CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Alignment</Label><div className="grid grid-cols-3 gap-1"><Button variant="outline" size="sm" onClick={() => alignFields('left')}><AlignStartHorizontal className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => alignFields('center-h')}><AlignCenterHorizontal className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => alignFields('right')}><AlignEndHorizontal className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => alignFields('top')}><AlignStartVertical className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => alignFields('center-v')}><AlignCenterVertical className="mr-2 h-4 w-4" /> Center V</Button><Button variant="outline" size="sm" onClick={() => alignFields('bottom')}><AlignEndVertical className="mr-2 h-4 w-4" /> Bottom</Button></div></div>
                                <div className="space-y-2 border-t pt-4"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Distribution</Label><div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => distributeFields('horizontal')} className="gap-2"><DistributeHorizontal className="h-4 w-4" /> Horiz.</Button><Button variant="outline" size="sm" onClick={() => distributeFields('vertical')} className="gap-2"><DistributeVertical className="h-4 w-4" /> Vert.</Button></div></div>
                                <div className="space-y-4 border-t pt-4"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Properties</Label>
                                    <Select onValueChange={(val: PDFFormField['type']) => bulkUpdate({ type: val })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Change Type..." /></SelectTrigger><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="signature">Signature</SelectItem><SelectItem value="date">Date</SelectItem><SelectItem value="dropdown">Dropdown</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="time">Time</SelectItem><SelectItem value="photo">Photo</SelectItem></SelectContent></Select>
                                    <div className="flex items-center justify-between rounded-lg border p-3"><Label className="text-xs">Mark Required</Label><Switch onCheckedChange={(v) => bulkUpdate({ required: v })} checked={fields.filter(f => selectedFieldIds.includes(f.id)).every(f => f.required)} /></div>
                                </div>
                                <div className="space-y-2 border-t pt-4"><div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="h-8 text-xs gap-2" onClick={bulkDuplicate}><Copy className="h-3 w-3" /> Duplicate</Button><Button variant="destructive" size="sm" className="h-8 text-xs gap-2" onClick={bulkRemove}><Trash2 className="h-3 w-3" /> Delete</Button></div></div>
                            </CardContent>
                        </Card>
                    ) : null}
                    
                    {!selectedField && selectedFieldIds.length === 0 && fields.length > 0 && (
                        <Button variant="destructive" size="sm" className="w-full h-9 text-xs gap-2" onClick={() => setIsDeleteDialogOpen(true)}>
                            <Trash2 className="h-3 w-3" /> Clear All Fields
                        </Button>
                    )}

                    <Card><CardHeader className="py-4"><CardTitle className="text-sm font-semibold">Security</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><Label className="text-xs">Password Protect</Label><p className="text-[10px] text-muted-foreground">Require a password to view.</p></div><Switch checked={passwordProtected} onCheckedChange={setPasswordProtected} /></div>{passwordProtected && <div className="relative"><Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 text-sm pr-8" /><Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button></div>}</CardContent></Card>
                    <Card><CardHeader className="py-4"><CardTitle className="text-sm font-semibold">Status</CardTitle></CardHeader><CardContent><Select value={pdf.status} onValueChange={(v: PDFForm['status']) => onStatusChange(v)} disabled={isStatusChanging}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Set status..." /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></CardContent></Card>
                </>
            )}
        </div>
      </ScrollArea>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete all mapped fields. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteAllFields} className="bg-destructive text-destructive-foreground">Delete All</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
};

interface FieldMapperProps {
  pdf: PDFForm;
  fields: LocalPDFFormField[];
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
  namingFieldId: string | null;
  setNamingFieldId: (id: string | null) => void;
  onSave: () => void;
  isSaving: boolean;
  onPreview: () => void;
  password: string;
  setPassword: (password: string) => void;
  passwordProtected: boolean;
  setPasswordProtected: (isProtected: boolean) => void;
  isStatusChanging: boolean;
  onStatusChange: (status: PDFForm['status']) => void;
  onDetect: () => void;
  isDetecting: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function FieldMapper({
  pdf, fields, setFields, namingFieldId, setNamingFieldId, onSave, isSaving, onPreview, password, setPassword, passwordProtected, setPasswordProtected, isStatusChanging, onStatusChange, onDetect, isDetecting, undo, redo, canUndo, canRedo
}: FieldMapperProps) {
  const { toast } = useToast();
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = React.useState<string[]>([]);
  const [marquee, setMarquee] = React.useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [displayZoom, setDisplayZoom] = React.useState(1);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const loadPdf = async () => {
        try {
            const pdfjs = await pdfjsPromise;
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
            const loadingTask = pdfjs.getDocument({ url: pdf.downloadUrl });
            setPdfDoc(await loadingTask.promise);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error Loading PDF' });
        }
    };
    if (pdf.downloadUrl) loadPdf();
  }, [pdf.downloadUrl, toast]);

  const handleSelect = React.useCallback((id: string, multi: boolean = false, toggle: boolean = false) => {
    setSelectedFieldIds(prev => toggle ? (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) : [id]);
  }, []);

  const addField = (type: PDFFormField['type']) => {
    const newField: LocalPDFFormField = { id: `field_${Date.now()}`, label: `New ${type}`, type, pageNumber: 1, position: { x: 5, y: 5 }, dimensions: { width: 20, height: 5 }, required: false, options: type === 'dropdown' ? ['Option 1', 'Option 2'] : undefined };
    setFields(prev => [...prev, newField]);
    setSelectedFieldIds([newField.id]);
  };
  
  const removeField = React.useCallback((id: string) => { setFields(prev => prev.filter(f => f.id !== id)); setSelectedFieldIds(prev => prev.filter(i => i !== id)); }, [setFields]);
  const updateField = React.useCallback((id: string, newProps: Partial<LocalPDFFormField>) => { setFields(prev => prev.map(f => f.id === id ? { ...f, ...newProps } : f)); }, [setFields]);
  const bulkRemove = React.useCallback(() => { setFields(prev => prev.filter(f => !selectedFieldIds.includes(f.id))); setSelectedFieldIds([]); }, [setFields, selectedFieldIds]);
  const bulkDuplicate = React.useCallback(() => {
    const toDup = fields.filter(f => selectedFieldIds.includes(f.id));
    const news = toDup.map(f => ({ ...JSON.parse(JSON.stringify(f)), id: `f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, position: { x: f.position.x + 2, y: f.position.y + 2 } }));
    setFields(prev => [...prev, ...news]);
    setSelectedFieldIds(news.map(n => n.id));
  }, [fields, selectedFieldIds, setFields]);

  const alignFields = React.useCallback((type: string) => {
    const sel = fields.filter(f => selectedFieldIds.includes(f.id));
    if (sel.length < 2) return;
    let val: number;
    if (type === 'left') { val = Math.min(...sel.map(f => f.position.x)); setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, x: val } } : f)); }
    if (type === 'top') { val = Math.min(...sel.map(f => f.position.y)); setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, y: val } } : f)); }
    if (type === 'right') { val = Math.max(...sel.map(f => f.position.x + f.dimensions.width)); setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, x: val - f.dimensions.width } } : f)); }
    if (type === 'bottom') { val = Math.max(...sel.map(f => f.position.y + f.dimensions.height)); setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, y: val - f.dimensions.height } } : f)); }
    if (type === 'center-h') {
        const minX = Math.min(...sel.map(f => f.position.x));
        const maxX = Math.max(...sel.map(f => f.position.x + f.dimensions.width));
        const mid = (minX + maxX) / 2;
        setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, x: mid - (f.dimensions.width / 2) } } : f));
    }
    if (type === 'center-v') {
        const minY = Math.min(...sel.map(f => f.position.y));
        const maxY = Math.max(...sel.map(f => f.position.y + f.dimensions.height));
        const mid = (minY + maxY) / 2;
        setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, y: mid - (f.dimensions.height / 2) } } : f));
    }
  }, [fields, selectedFieldIds, setFields]);

  const distributeFields = React.useCallback((type: 'horizontal' | 'vertical') => {
    const sel = fields.filter(f => selectedFieldIds.includes(f.id));
    if (sel.length < 3) return;
    const sorted = [...sel].sort((a, b) => type === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y);
    const start = type === 'horizontal' ? sorted[0].position.x : sorted[0].position.y;
    const endItem = sorted[sorted.length - 1];
    const end = type === 'horizontal' ? (endItem.position.x + endItem.dimensions.width) : (endItem.position.y + endItem.dimensions.height);
    const totalSize = sorted.reduce((a, f) => a + (type === 'horizontal' ? f.dimensions.width : f.dimensions.height), 0);
    const gap = (end - start - totalSize) / (sorted.length - 1);
    let cur = start;
    const maps = new Map();
    sorted.forEach(f => { maps.set(f.id, cur); cur += (type === 'horizontal' ? f.dimensions.width : f.dimensions.height) + gap; });
    setFields(prev => prev.map(f => maps.has(f.id) ? { ...f, position: { ...f.position, [type === 'horizontal' ? 'x' : 'y']: maps.get(f.id) } } : f));
  }, [fields, selectedFieldIds, setFields]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const fieldToMove = fields.find(f => f.id === active.id);
    if (!fieldToMove || !viewportRef.current) return;
    const page = viewportRef.current.querySelector(`[data-page-number="${fieldToMove.pageNumber}"]`);
    if (!page) return;
    const { width, height } = page.getBoundingClientRect();
    const dX = (delta.x / width) * 100;
    const dY = (delta.y / height) * 100;
    setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) && f.pageNumber === fieldToMove.pageNumber ? { ...f, position: { x: Math.max(0, Math.min(100 - f.dimensions.width, f.position.x + dX)), y: Math.max(0, Math.min(100 - f.dimensions.height, f.position.y + dY)) }, isSuggestion: false } : f));
  };

  const onMouseDown = (e: React.MouseEvent) => { if (e.button !== 0 || (e.target as HTMLElement).closest('[data-field-id]')) return; const r = viewportRef.current!.getBoundingClientRect(); const x = e.clientX - r.left + viewportRef.current!.scrollLeft; const y = e.clientY - r.top + viewportRef.current!.scrollTop; setMarquee({ startX: x, startY: y, endX: x, endY: y }); if (!e.shiftKey && !e.metaKey) setSelectedFieldIds([]); };
  const onMouseMove = (e: React.MouseEvent) => { if (!marquee) return; const r = viewportRef.current!.getBoundingClientRect(); const x = e.clientX - r.left + viewportRef.current!.scrollLeft; const y = e.clientY - r.top + viewportRef.current!.scrollTop; setMarquee(p => p ? { ...p, endX: x, endY: y } : null); };
  const onMouseUp = (e: React.MouseEvent) => { if (!marquee) return; const mL = Math.min(marquee.startX, marquee.endX), mT = Math.min(marquee.startY, marquee.endY), mR = Math.max(marquee.startX, marquee.endX), mB = Math.max(marquee.startY, marquee.endY); const newIds = e.shiftKey || e.metaKey ? [...selectedFieldIds] : []; viewportRef.current!.querySelectorAll('[data-field-id]').forEach(el => { const id = el.getAttribute('data-field-id')!; const rect = el.getBoundingClientRect(), vRect = viewportRef.current!.getBoundingClientRect(); const fL = rect.left - vRect.left + viewportRef.current!.scrollLeft, fT = rect.top - vRect.top + viewportRef.current!.scrollTop, fR = fL + rect.width, fB = fT + rect.height; if (!(fL > mR || fR < mL || fT > mB || fB < mT) && !newIds.includes(id)) newIds.push(id); }); setSelectedFieldIds(newIds); setMarquee(null); };

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <div className="flex-1 relative min-w-0 flex flex-col overflow-hidden">
          <DndContext sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))} onDragEnd={handleDragEnd}>
              <ScrollArea className="h-full w-full bg-muted/30" viewportRef={viewportRef}>
                <div className="p-4 sm:p-12 pb-48 flex flex-col items-center min-w-full relative touch-pan-x touch-pan-y" style={{ minWidth: 'fit-content' }} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => setMarquee(null)}>
                    {!pdfDoc ? Array.from({ length: 3 }).map((_, i) => <Skeleton className="w-[8.5in] h-[11in] bg-card shadow-xl rounded-lg mb-12" />) : Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                        <PageRenderer
                            key={i} pdf={pdfDoc} pageNumber={i + 1} fields={fields.filter(f => f.pageNumber === i + 1)}
                            selectedFieldIds={selectedFieldIds} namingFieldId={namingFieldId}
                            onSelect={handleSelect} onUpdate={updateField} onDelete={removeField} onDuplicate={bulkDuplicate}
                            onChangeType={(id, type) => setFields(p => p.map(f => f.id === id ? {...f, type, options: type === 'dropdown' ? (f.options || ['O1', 'O2']) : undefined} : f))} 
                            alignFields={alignFields} distributeFields={distributeFields} bulkDuplicate={bulkDuplicate} bulkRemove={bulkRemove} zoom={displayZoom} 
                        />
                    ))}
                    {marquee && <div className="absolute border border-primary bg-primary/10 pointer-events-none z-50" style={{ left: Math.min(marquee.startX, marquee.endX), top: Math.min(marquee.startY, marquee.endY), width: Math.abs(marquee.endX - marquee.startX), height: Math.abs(marquee.endY - marquee.startY) }} />}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
          </DndContext>
          
          <div className="absolute right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3">
              <div className="flex flex-col items-center bg-background/95 backdrop-blur-sm rounded-full border p-2 shadow-2xl h-48">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full mb-2" onClick={() => setDisplayZoom(p => Math.min(p+0.1, 3))}><ZoomIn className="h-4 w-4 text-primary" /></Button>
                  <Slider orientation="vertical" min={0.5} max={3} step={0.05} value={[displayZoom]} onValueChange={([v]) => setDisplayZoom(v)} className="flex-grow py-2" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full mt-2" onClick={() => setDisplayZoom(p => Math.max(p-0.1, 0.5))}><ZoomOut className="h-4 w-4 text-primary" /></Button>
              </div>
              <div className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-bold shadow-lg tabular-nums border border-primary/20">
                  {Math.round(displayZoom * 100)}%
              </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
              <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-md p-2 shadow-2xl overflow-x-auto max-w-[90vw]">
                  <TooltipProvider>
                      <div className="flex items-center gap-1 px-2 shrink-0">
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-none hover:bg-primary/10" onClick={() => addField('text')}><Text className="h-4 w-4 text-primary" /></Button></TooltipTrigger><TooltipContent side="top">Add Text</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-none hover:bg-primary/10" onClick={() => addField('signature')}><Signature className="h-4 w-4 text-primary" /></Button></TooltipTrigger><TooltipContent side="top">Add Signature</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-none hover:bg-primary/10" onClick={() => addField('date')}><Calendar className="h-4 w-4 text-primary" /></Button></TooltipTrigger><TooltipContent side="top">Add Date</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-none hover:bg-primary/10" onClick={() => addField('dropdown')}><ChevronDownSquare className="h-4 w-4 text-primary" /></Button></TooltipTrigger><TooltipContent side="top">Add Dropdown</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-none hover:bg-primary/10" onClick={() => addField('phone')}><Phone className="h-4 w-4 text-primary" /></Button></TooltipTrigger><TooltipContent side="top">Add Phone</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-none hover:bg-primary/10" onClick={() => addField('email')}><Mail className="h-4 w-4 text-primary" /></Button></TooltipTrigger><TooltipContent side="top">Add Email</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-none hover:bg-primary/10" onClick={() => addField('time')}><Clock className="h-4 w-4 text-primary" /></Button></TooltipTrigger><TooltipContent side="top">Add Time</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-none hover:bg-primary/10" onClick={() => addField('photo')}><Camera className="h-4 w-4 text-primary" /></Button></TooltipTrigger><TooltipContent side="top">Add Photo</TooltipContent></Tooltip>
                      </div>
                      <Separator orientation="vertical" className="h-8 mx-1 bg-border/50" />
                      <div className="flex items-center gap-1.5 px-2 shrink-0">
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={undo} disabled={!canUndo}><Undo className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="top">Undo (Ctrl+Z)</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={redo} disabled={!canRedo}><Redo className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="top">Redo (Ctrl+Y)</TooltipContent></Tooltip>
                      </div>
                      <Separator orientation="vertical" className="h-8 mx-1 bg-border/50" />
                      <div className="px-2 shrink-0">
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button 
                                    onClick={onDetect} 
                                    disabled={isDetecting} 
                                    className="h-9 px-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                                  >
                                    {isDetecting ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Sparkles className="h-4 w-4 sm:mr-2" />}
                                    <span className="hidden sm:inline">{isDetecting ? 'Analyzing...' : 'AI Detect'}</span>
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Auto-detect with AI</TooltipContent>
                          </Tooltip>
                      </div>
                  </TooltipProvider>
              </div>
          </div>
      </div>

      <div 
        className={cn(
            "h-full bg-card border-l hidden md:flex flex-col z-30 shadow-xl transition-all duration-300 ease-in-out",
            isSidebarCollapsed ? "w-16" : "w-[384px]"
        )}
      >
        <PropertiesSidebar 
            fields={fields} setFields={setFields} selectedFieldIds={selectedFieldIds} setSelectedFieldIds={setSelectedFieldIds} 
            namingFieldId={namingFieldId} setNamingFieldId={setNamingFieldId} handleSelect={handleSelect}
            updateField={updateField} removeField={removeField} addField={addField} alignFields={alignFields} distributeFields={distributeFields}
            bulkDuplicate={bulkDuplicate} bulkRemove={bulkRemove} pagesLength={pdfDoc?.numPages || 0} pdf={pdf} 
            isStatusChanging={isStatusChanging} onStatusChange={onStatusChange} password={password} setPassword={setPassword} 
            passwordProtected={passwordProtected} setPasswordProtected={setPasswordProtected} onDetect={onDetect} isDetecting={isDetecting}
            isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        {!isSidebarCollapsed && (
            <div className="p-4 border-t flex flex-col gap-2 bg-muted/10 shrink-0">
                <Button variant="outline" onClick={onPreview} size="sm"><Eye className="mr-2 h-4 w-4" /> Preview</Button>
                <Button onClick={onSave} disabled={isSaving} size="sm">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isSaving ? 'Saving...' : 'Save'}</Button>
            </div>
        )}
      </div>
    </div>
  );
}

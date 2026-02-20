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
    Text, Signature, Calendar, Trash2, Loader2, Sparkles, List, Settings2, 
    PanelLeftClose, PanelLeftOpen, ZoomIn, ZoomOut, Save, Eye, Copy, Replace, 
    EyeOff, Check, X, AlignStartHorizontal, AlignEndHorizontal, AlignStartVertical, AlignEndVertical, 
    AlignCenterHorizontal, AlignCenterVertical, GripVertical, Undo, Redo, Plus
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField } from '@/lib/types';
import { DndContext, useDraggable, type DragEndEvent, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';

// Shared PDF.js promise
const pdfjsPromise = import('pdfjs-dist');

// Custom Distribution Icons
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
};

function PageRenderer({ pdf, pageNumber, fields, selectedFieldIds, onSelect, onUpdate, onDelete, onDuplicate, onChangeType, zoom }: {
    pdf: PDFDocumentProxy;
    pageNumber: number;
    fields: LocalPDFFormField[];
    selectedFieldIds: string[];
    onSelect: (id: string, multi?: boolean, toggle?: boolean) => void;
    onUpdate: (id: string, newProps: Partial<LocalPDFFormField>) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onChangeType: (id: string, newType: PDFFormField['type']) => void;
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
    
    return (
        <div 
            data-page-number={pageNumber}
            className="relative mx-auto shadow-xl mb-8 bg-white pdf-page-container transition-all flex-shrink-0"
            style={{ width: pageDimensions.width / 1.5, height: pageDimensions.height / 1.5 }}
        >
            {isLoading && <Skeleton className="absolute inset-0 z-10" />}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
            
            {!isLoading && fields.map(field => (
                <ResizableField
                    key={field.id}
                    field={field}
                    pageDimensions={pageDimensions}
                    isSelected={selectedFieldIds.includes(field.id)}
                    showHandles={selectedFieldIds.length <= 1}
                    onSelect={onSelect}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onChangeType={onChangeType}
                    zoom={zoom}
                />
            ))}
        </div>
    );
}

type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';

const ResizableField = ({
    field, pageDimensions, isSelected, showHandles, onSelect, onUpdate, onDelete, onDuplicate, onChangeType
}: {
    field: LocalPDFFormField;
    pageDimensions: { width: number, height: number };
    isSelected: boolean;
    showHandles: boolean;
    onSelect: (id: string, multi?: boolean, toggle?: boolean) => void;
    onUpdate: (id: string, newProps: Partial<LocalPDFFormField>) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onChangeType: (id: string, type: PDFFormField['type']) => void;
    zoom: number;
}) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: field.id });
    const [isResizing, setIsResizing] = React.useState(false);
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
        onSelect(field.id);
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
            className={`absolute border-2 ${borderColorClass} transition-colors group/field`}
        >
            <div {...listeners} className="w-full h-full cursor-grab" onMouseDown={(e) => e.stopPropagation()}></div>
            {isSelected && showHandles && (
                <>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 flex gap-1 rounded-lg border bg-background p-1 shadow-md">
                        <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDuplicate(field.id); }}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger><TooltipContent><p>Duplicate</p></TooltipContent></Tooltip>
                        
                        <Popover onOpenChange={(e) => e.stopPropagation()}>
                            <PopoverTrigger asChild>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7"><Replace className="h-4 w-4" /></Button>
                                </TooltipTrigger><TooltipContent><p>Change Type</p></TooltipContent></Tooltip>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1" onClick={(e) => e.stopPropagation()}>
                                {(['text', 'signature', 'date'] as const).map(type => {
                                    const Icon = fieldIcons[type];
                                    return (
                                        <Button key={type} variant="ghost" className="w-full justify-start" onClick={() => onChangeType(field.id, type)}>
                                            <Icon className="mr-2 h-4 w-4" />
                                            <span className="capitalize">{type}</span>
                                        </Button>
                                    );
                                })}
                            </PopoverContent>
                        </Popover>
                        
                        <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(field.id); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger><TooltipContent><p>Delete</p></TooltipContent></Tooltip>
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

interface PropertiesSidebarProps {
  fields: LocalPDFFormField[];
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
  selectedFieldIds: string[];
  setSelectedFieldIds: React.Dispatch<React.SetStateAction<string[]>>;
  updateField: (id: string, newProps: Partial<PDFFormField>) => void;
  removeField: (id: string) => void;
  addField: (type: PDFFormField['type']) => void;
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
}

const PropertiesSidebar = ({
  fields, setFields, selectedFieldIds, setSelectedFieldIds, updateField, removeField, addField, pagesLength, pdf,
  isStatusChanging, onStatusChange, password, setPassword, passwordProtected, setPasswordProtected, onDetect, isDetecting
}: PropertiesSidebarProps) => {
  const selectedField = selectedFieldIds.length === 1 ? fields.find(f => f.id === selectedFieldIds[0]) : null;
  const [showPassword, setShowPassword] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const hasSuggestions = fields.some(f => f.isSuggestion);

  const acceptAllSuggestions = () => setFields(prev => prev.map(f => ({ ...f, isSuggestion: false })));
  const rejectAllSuggestions = () => setFields(prev => prev.filter(f => !f.isSuggestion));
  const deleteAllFields = () => { setFields([]); setSelectedFieldIds([]); setIsDeleteDialogOpen(false); };

  return (
    <>
      <ScrollArea className="flex-grow">
        <div className="space-y-4 p-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
                <CardTitle className="text-base font-semibold">Fields ({fields.length})</CardTitle>
                <div className="flex items-center gap-1">
                    <Popover>
                        <PopoverTrigger asChild>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Add Field</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="end">
                            <div className="flex flex-col gap-1">
                                <Button variant="ghost" className="justify-start px-2 h-9" onClick={() => addField('text')}>
                                    <Text className="mr-2 h-4 w-4" />
                                    <span>Text Field</span>
                                </Button>
                                <Button variant="ghost" className="justify-start px-2 h-9" onClick={() => addField('signature')}>
                                    <Signature className="mr-2 h-4 w-4" />
                                    <span>Signature Field</span>
                                </Button>
                                <Button variant="ghost" className="justify-start px-2 h-9" onClick={() => addField('date')}>
                                    <Calendar className="mr-2 h-4 w-4" />
                                    <span>Date Field</span>
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {hasSuggestions ? (
                        <>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={acceptAllSuggestions}>
                                            <Check className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Accept All AI Suggestions</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={rejectAllSuggestions}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Reject All AI Suggestions</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </>
                    ) : (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={onDetect} disabled={isDetecting}>
                                        {isDetecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>AI-Detect Fields</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete All Fields</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                  <ScrollArea className="h-48 px-2">
                      <div className="space-y-1">
                          {fields.map((field) => {
                              const Icon = fieldIcons[field.type];
                              const isSel = selectedFieldIds.includes(field.id);
                              return (
                                  <button key={field.id} onClick={() => setSelectedFieldIds([field.id])}
                                      className={cn("w-full text-left p-2 rounded-md flex items-center gap-2 hover:bg-muted transition-colors", isSel && 'bg-muted ring-1 ring-primary')}>
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                      <span className={cn("truncate text-sm flex-1", field.isSuggestion && "text-green-600 font-medium")}>{field.label || field.id}</span>
                                      {field.required && <span className="text-destructive font-bold text-lg">*</span>}
                                  </button>
                              );
                          })}
                      </div>
                  </ScrollArea>
              </CardContent>
            </Card>

            {selectedField ? (
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="flex justify-between items-center text-sm font-semibold">
                            <span>Field Properties</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeField(selectedField.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CardTitle>
                        <CardDescription className="text-[10px]">ID: {selectedField.id}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={`label-${selectedField.id}`} className="text-xs">Field Label</Label>
                            <Input id={`label-${selectedField.id}`} placeholder="e.g. Applicant Name" value={selectedField.label || ''} onChange={e => updateField(selectedField.id, { label: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Type</Label>
                            <Input value={selectedField.type} disabled className="capitalize h-8 text-sm" />
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label htmlFor={`required-toggle-${selectedField.id}`} className="text-xs">Required</Label>
                            <Switch id={`required-toggle-${selectedField.id}`} checked={!!selectedField.required} onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`page-${selectedField.id}`} className="text-xs">Page Number</Label>
                            <Input id={`page-${selectedField.id}`} type="number" min="1" max={pagesLength} value={selectedField.pageNumber} onChange={e => updateField(selectedField.id, { pageNumber: parseInt(e.target.value) || 1 })} className="h-8 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor={`x-pos-${selectedField.id}`} className="text-xs">X (%)</Label>
                                <Input id={`x-pos-${selectedField.id}`} type="number" value={selectedField.position.x.toFixed(2)} onChange={e => updateField(selectedField.id, { position: { ...selectedField.position, x: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`y-pos-${selectedField.id}`} className="text-xs">Y (%)</Label>
                                <Input id={`y-pos-${selectedField.id}`} type="number" value={selectedField.position.y.toFixed(2)} onChange={e => updateField(selectedField.id, { position: { ...selectedField.position, y: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor={`width-${selectedField.id}`} className="text-xs">Width (%)</Label>
                                <Input id={`width-${selectedField.id}`} type="number" value={selectedField.dimensions.width.toFixed(2)} onChange={e => updateField(selectedField.id, { dimensions: { ...selectedField.dimensions, width: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`height-${selectedField.id}`} className="text-xs">Height (%)</Label>
                                <Input id={`height-${selectedField.id}`} type="number" value={selectedField.dimensions.height.toFixed(2)} onChange={e => updateField(selectedField.id, { dimensions: { ...selectedField.dimensions, height: parseFloat(e.target.value) || 0 } })} className="h-8 text-sm" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : selectedFieldIds.length > 1 ? (
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-semibold">Bulk Editing</CardTitle>
                        <CardDescription className="text-[10px]">{selectedFieldIds.length} items selected</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground italic">Use the floating toolbar to align or duplicate items.</p>
                    </CardContent>
                </Card>
            ) : null}
            <Card>
                <CardHeader className="py-4"><CardTitle className="text-sm font-semibold">Security</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="password-protect-toggle" className="text-xs">Password Protect</Label>
                            <p className="text-[10px] text-muted-foreground">Require a password to view this form.</p>
                        </div>
                        <Switch id="password-protect-toggle" checked={passwordProtected} onCheckedChange={setPasswordProtected} />
                    </div>
                    {passwordProtected && (
                         <div className="space-y-2">
                            <Label htmlFor="form-password" className="text-xs">Form Password</Label>
                             <div className="relative">
                                <Input id="form-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 text-sm pr-8" />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" onClick={() => setShowPassword(prev => !prev)}>
                                    {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="py-4"><CardTitle className="text-sm font-semibold">Status</CardTitle></CardHeader>
                <CardContent>
                     <Select value={pdf.status} onValueChange={(value: PDFForm['status']) => onStatusChange(value)} disabled={isStatusChanging}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Set status..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        </div>
      </ScrollArea>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete all mapped fields for this document. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAllFields} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
};

interface FieldMapperProps {
  pdf: PDFForm;
  fields: LocalPDFFormField[];
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
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

type LocalPDFFormField = PDFFormField & { isSuggestion?: boolean };

export default function FieldMapper({
  pdf, fields, setFields, onSave, isSaving, onPreview, password, setPassword, passwordProtected, setPasswordProtected, isStatusChanging, onStatusChange, onDetect, isDetecting, undo, redo, canUndo, canRedo
}: FieldMapperProps) {
  const { toast } = useToast();
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = React.useState<string[]>([]);
  const [marquee, setMarquee] = React.useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);

  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [sidebarWidth, setSidebarWidth] = React.useState(384);
  const isResizing = React.useRef(false);
  const [isPropertiesSheetOpen, setIsPropertiesSheetOpen] = React.useState(false);
  const [displayZoom, setDisplayZoom] = React.useState(1);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setDisplayZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setDisplayZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setDisplayZoom(prev => Math.max(0.5, Math.min(prev - (e.deltaY > 0 ? 0.1 : -0.1), 2)));
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  React.useEffect(() => {
    const loadPdf = async () => {
        try {
            const pdfjs = await pdfjsPromise;
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
            const loadingTask = pdfjs.getDocument({ url: pdf.downloadUrl });
            const loadedPdf = await loadingTask.promise;
            setPdfDoc(loadedPdf);
        } catch (error: any) {
            console.error("PDF Loading Error:", error);
            toast({ variant: 'destructive', title: 'Error Loading PDF', description: 'Could not load document template.' });
        }
    };
    if (pdf.downloadUrl) loadPdf();
  }, [pdf.downloadUrl, toast]);

  const handleSelect = React.useCallback((id: string, multi: boolean = false, toggle: boolean = false) => {
    setSelectedFieldIds(prev => {
        if (toggle) return prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
        if (multi) return prev.includes(id) ? prev : [...prev, id];
        return [id];
    });
  }, []);

  const addField = (type: PDFFormField['type']) => {
    const newField: LocalPDFFormField = {
      id: `field_${Date.now()}`, label: `New ${type} field`, type, pageNumber: 1,
      position: { x: 5, y: 5 }, dimensions: { width: 20, height: 5 }, required: false,
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldIds([newField.id]);
  };
  
  const removeField = React.useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    setSelectedFieldIds(prev => prev.filter(i => i !== id));
  }, [setFields]);

  const updateField = React.useCallback((id: string, newProps: Partial<LocalPDFFormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...newProps } : f));
  }, [setFields]);

  const bulkRemove = React.useCallback(() => {
    setFields(prev => prev.filter(f => !selectedFieldIds.includes(f.id)));
    setSelectedFieldIds([]);
  }, [setFields, selectedFieldIds]);

  const bulkDuplicate = React.useCallback(() => {
    const toDuplicate = fields.filter(f => selectedFieldIds.includes(f.id));
    const newElements = toDuplicate.map(f => ({
        ...JSON.parse(JSON.stringify(f)),
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        position: { x: Math.min(95, f.position.x + 2), y: Math.min(95, f.position.y + 2) }
    }));
    setFields(prev => [...prev, ...newElements]);
    setSelectedFieldIds(newElements.map(n => n.id));
  }, [fields, selectedFieldIds, setFields]);

  // Alignment functions
  const alignFields = React.useCallback((type: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => {
    const sel = fields.filter(f => selectedFieldIds.includes(f.id));
    if (sel.length < 2) return;

    let target: number;
    switch(type) {
        case 'top': 
            target = Math.min(...sel.map(f => f.position.y));
            setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, y: target } } : f));
            break;
        case 'center-v': // Snap vertical positions to a center horizontal axis
            const centerY = sel.reduce((acc, f) => acc + (f.position.y + f.dimensions.height / 2), 0) / sel.length;
            setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, y: centerY - f.dimensions.height / 2 } } : f));
            break;
        case 'bottom':
            target = Math.max(...sel.map(f => f.position.y + f.dimensions.height));
            setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, y: target - f.dimensions.height } } : f));
            break;
        case 'left':
            target = Math.min(...sel.map(f => f.position.x));
            setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, x: target } } : f));
            break;
        case 'center-h': // Snap horizontal positions to a center vertical axis
            const centerX = sel.reduce((acc, f) => acc + (f.position.x + f.dimensions.width / 2), 0) / sel.length;
            setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, x: centerX - f.dimensions.width / 2 } } : f));
            break;
        case 'right':
            target = Math.max(...sel.map(f => f.position.x + f.dimensions.width));
            setFields(prev => prev.map(f => selectedFieldIds.includes(f.id) ? { ...f, position: { ...f.position, x: target - f.dimensions.width } } : f));
            break;
    }
    // Release selection so items can be moved independently immediately
    setSelectedFieldIds([]);
  }, [fields, selectedFieldIds, setFields]);

  // Distribution functions
  const distributeFields = React.useCallback((type: 'horizontal' | 'vertical') => {
    const sel = fields.filter(f => selectedFieldIds.includes(f.id));
    if (sel.length < 3) {
        toast({ title: 'Distribution', description: 'Select at least 3 fields to distribute.' });
        return;
    }

    if (type === 'horizontal') {
        const sorted = [...sel].sort((a, b) => a.position.x - b.position.x);
        const minX = sorted[0].position.x;
        const lastItem = sorted[sorted.length - 1];
        const maxX = lastItem.position.x + lastItem.dimensions.width;
        
        const totalItemsWidth = sorted.reduce((acc, f) => acc + f.dimensions.width, 0);
        const totalSpace = maxX - minX;
        const totalGap = totalSpace - totalItemsWidth;
        const gap = totalGap / (sorted.length - 1);

        let currentX = minX;
        const newPositions = new Map<string, number>();
        sorted.forEach((f) => {
            newPositions.set(f.id, currentX);
            currentX += f.dimensions.width + gap;
        });

        setFields(prev => prev.map(f => newPositions.has(f.id) ? { ...f, position: { ...f.position, x: newPositions.get(f.id)! } } : f));
    } else {
        const sorted = [...sel].sort((a, b) => a.position.y - b.position.y);
        const minY = sorted[0].position.y;
        const lastItem = sorted[sorted.length - 1];
        const maxY = lastItem.position.y + lastItem.dimensions.height;
        
        const totalItemsHeight = sorted.reduce((acc, f) => acc + f.dimensions.height, 0);
        const totalSpace = maxY - minY;
        const totalGap = totalSpace - totalItemsHeight;
        const gap = totalGap / (sorted.length - 1);

        let currentY = minY;
        const newPositions = new Map<string, number>();
        sorted.forEach((f) => {
            newPositions.set(f.id, currentY);
            currentY += f.dimensions.height + gap;
        });

        setFields(prev => prev.map(f => newPositions.has(f.id) ? { ...f, position: { ...f.position, y: newPositions.get(f.id)! } } : f));
    }
    // Release selection
    setSelectedFieldIds([]);
  }, [fields, selectedFieldIds, setFields, toast]);

  // Keydown handler for nudge and delete
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (selectedFieldIds.length === 0) return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            bulkRemove();
            return;
        }

        const nudge = e.shiftKey ? 1 : 0.1;
        const nudgeX = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0;
        const nudgeY = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0;

        if (nudgeX !== 0 || nudgeY !== 0) {
            e.preventDefault();
            setFields(prev => prev.map(f => {
                if (selectedFieldIds.includes(f.id)) {
                    return {
                        ...f,
                        position: {
                            x: Math.max(0, Math.min(100 - f.dimensions.width, f.position.x + nudgeX)),
                            y: Math.max(0, Math.min(100 - f.dimensions.height, f.position.y + nudgeY))
                        }
                    };
                }
                return f;
            }));
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldIds, setFields, bulkRemove]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const fieldToMove = fields.find(f => f.id === active.id);
    if (!fieldToMove) return;
    const pageContainer = viewportRef.current?.querySelector(`[data-page-number="${fieldToMove.pageNumber}"]`);
    if (!pageContainer) return;
    const { width, height } = pageContainer.getBoundingClientRect();
    const dX = (delta.x / width) * 100;
    const dY = (delta.y / height) * 100;

    setFields(prev => prev.map(f => {
        if (selectedFieldIds.includes(f.id) && f.pageNumber === fieldToMove.pageNumber) {
            return {
                ...f,
                position: {
                    x: Math.max(0, Math.min(100 - f.dimensions.width, f.position.x + dX)),
                    y: Math.max(0, Math.min(100 - f.dimensions.height, f.position.y + dY)),
                },
                isSuggestion: false,
            };
        }
        return f;
    }));
  };
  
  const handleSidebarMouseDown = (e: React.MouseEvent) => { e.preventDefault(); isResizing.current = true; };
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (isResizing.current) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 320 && newWidth < 600) setSidebarWidth(newWidth);
        }
    };
    const handleMouseUp = () => { isResizing.current = false; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    // If target is a field container, don't start marquee
    if ((e.target as HTMLElement).closest('[data-field-id]')) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left + viewport.scrollLeft;
    const y = e.clientY - rect.top + viewport.scrollTop;

    setMarquee({ startX: x, startY: y, endX: x, endY: y });

    // Clear selection on new click unless modifier keys are held
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setSelectedFieldIds([]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!marquee) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left + viewport.scrollLeft;
    const y = e.clientY - rect.top + viewport.scrollTop;

    setMarquee(prev => prev ? { ...prev, endX: x, endY: y } : null);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!marquee) return;

    const mLeft = Math.min(marquee.startX, marquee.endX);
    const mTop = Math.min(marquee.startY, marquee.endY);
    const mRight = Math.max(marquee.startX, marquee.endX);
    const mBottom = Math.max(marquee.startY, marquee.endY);

    // Don't do anything for tiny clicks
    if (Math.abs(marquee.endX - marquee.startX) < 5 && Math.abs(marquee.endY - marquee.startY) < 5) {
        setMarquee(null);
        return;
    }

    const viewport = viewportRef.current;
    const newSelectedIds = e.shiftKey || e.ctrlKey || e.metaKey ? [...selectedFieldIds] : [];

    if (viewport) {
        const fieldElements = viewport.querySelectorAll('[data-field-id]');
        fieldElements.forEach(el => {
            const id = el.getAttribute('data-field-id');
            if (!id) return;

            const fRect = el.getBoundingClientRect();
            const vRect = viewport.getBoundingClientRect();
            
            // Calculate coordinates relative to the same reference as the marquee
            const fLeft = fRect.left - vRect.left + viewport.scrollLeft;
            const fTop = fRect.top - vRect.top + viewport.scrollTop;
            const fRight = fLeft + fRect.width;
            const fBottom = fTop + fRect.height;

            const isOverlapping = !(fLeft > mRight || fRight < mLeft || fTop > mBottom || fBottom < mTop);

            if (isOverlapping && !newSelectedIds.includes(id)) {
                newSelectedIds.push(id);
            }
        });
    }

    setSelectedFieldIds(newSelectedIds);
    setMarquee(null);
  };

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      <div className="flex-1 h-full relative min-w-0">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <ScrollArea 
                className="h-full w-full" 
                onWheel={handleWheel} 
                viewportRef={viewportRef}
              >
                <div 
                    className="p-12 pb-32 flex flex-col items-center min-w-full relative" 
                    style={{ minWidth: 'fit-content' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => setMarquee(null)}
                >
                    {!pdfDoc && Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="w-[8.5in] h-[11in] max-w-full bg-card shadow-xl rounded-lg flex-shrink-0 mb-12" />
                    ))}
                    {pdfDoc && Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                        <PageRenderer
                            key={index} pdf={pdfDoc} pageNumber={index + 1}
                            fields={fields.filter(f => f.pageNumber === index + 1)}
                            selectedFieldIds={selectedFieldIds} onSelect={handleSelect}
                            onUpdate={updateField} onDelete={removeField} onDuplicate={bulkDuplicate}
                            onChangeType={(id, type) => setFields(prev => prev.map(f => f.id === id ? {...f, type} : f))} 
                            zoom={displayZoom} 
                        />
                    ))}

                    {marquee && (
                        <div 
                            className="absolute border border-primary bg-primary/10 pointer-events-none z-50"
                            style={{
                                left: Math.min(marquee.startX, marquee.endX),
                                top: Math.min(marquee.startY, marquee.endY),
                                width: Math.abs(marquee.endX - marquee.startX),
                                height: Math.abs(marquee.endY - marquee.startY),
                            }}
                        />
                    )}
                </div>
              </ScrollArea>
          </DndContext>
          
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
              {isDetecting && (
                  <Card className="shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm pointer-events-auto animate-in fade-in slide-in-from-bottom-2 w-64 overflow-hidden">
                      <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                                  <Sparkles className="h-3 w-3 animate-pulse" />
                                  AI analyzing
                              </span>
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          </div>
                          <Progress value={undefined} className="h-1" />
                          <p className="text-[9px] text-muted-foreground text-center">Detecting lines, boxes and signatures...</p>
                      </CardContent>
                  </Card>
              )}

              {/* Multi-Select Context Toolbar */}
              {selectedFieldIds.length > 1 && (
                  <Card className="shadow-2xl border-primary/40 bg-background/95 backdrop-blur-sm pointer-events-auto animate-in fade-in zoom-in-95 mb-2">
                      <CardContent className="p-1 flex items-center gap-1">
                          <TooltipProvider>
                              {/* Alignment Dropdown */}
                              <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <AlignStartVertical className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-1 flex flex-col gap-1" align="center">
                                    <Button variant="ghost" className="justify-start px-2 h-8 text-xs" onClick={() => alignFields('top')}>
                                        <AlignStartVertical className="mr-2 h-4 w-4" /> Align to Top
                                    </Button>
                                    <Button variant="ghost" className="justify-start px-2 h-8 text-xs" onClick={() => alignFields('center-v')}>
                                        <AlignCenterHorizontal className="mr-2 h-4 w-4" /> Align Horizontally H
                                    </Button>
                                    <Button variant="ghost" className="justify-start px-2 h-8 text-xs" onClick={() => alignFields('bottom')}>
                                        <AlignEndVertical className="mr-2 h-4 w-4" /> Align Bottom
                                    </Button>
                                    <div className="h-px bg-border my-1" />
                                    <Button variant="ghost" className="justify-start px-2 h-8 text-xs" onClick={() => alignFields('left')}>
                                        <AlignStartHorizontal className="mr-2 h-4 w-4" /> Left Aligned
                                    </Button>
                                    <Button variant="ghost" className="justify-start px-2 h-8 text-xs" onClick={() => alignFields('center-h')}>
                                        <AlignCenterVertical className="mr-2 h-4 w-4" /> Vertical Align V
                                    </Button>
                                    <Button variant="ghost" className="justify-start px-2 h-8 text-xs" onClick={() => alignFields('right')}>
                                        <AlignEndHorizontal className="mr-2 h-4 w-4" /> Right Align
                                    </Button>
                                </PopoverContent>
                              </Popover>

                              {/* Distribution Dropdown */}
                              <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <DistributeHorizontal className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-1 flex flex-col gap-1" align="center">
                                    <Button variant="ghost" className="justify-start px-2 h-8 text-xs" onClick={() => distributeFields('horizontal')}>
                                        <DistributeHorizontal className="mr-2 h-4 w-4" /> Distribute Horizontally
                                    </Button>
                                    <Button variant="ghost" className="justify-start px-2 h-8 text-xs" onClick={() => distributeFields('vertical')}>
                                        <DistributeVertical className="mr-2 h-4 w-4" /> Distribute Vertically
                                    </Button>
                                </PopoverContent>
                              </Popover>
                              
                              <div className="w-px h-4 bg-border mx-1" />
                              
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={bulkDuplicate}><Copy className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Duplicate Selection</p></TooltipContent></Tooltip>
                              
                              <div className="w-px h-4 bg-border mx-1" />
                              
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={bulkRemove}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Delete Selection</p></TooltipContent></Tooltip>
                          </TooltipProvider>
                      </CardContent>
                  </Card>
              )}

              <Card className="shadow-2xl border-primary/20 pointer-events-auto">
                <CardContent className="p-1 flex items-center gap-0.5 sm:gap-1">
                  <TooltipProvider>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => addField('text')}><Text className="h-4 w-4 sm:h-5 sm:w-5" /></Button></TooltipTrigger><TooltipContent><p>Add Text</p></TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => addField('signature')}><Signature className="h-4 w-4 sm:h-5 sm:w-5" /></Button></TooltipTrigger><TooltipContent><p>Add Signature</p></TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => addField('date')}><Calendar className="h-4 w-4 sm:h-5 sm:w-5" /></Button></TooltipTrigger><TooltipContent><p>Add Date</p></TooltipContent></Tooltip>
                      
                      <div className="w-px h-6 bg-border mx-1" />
                      
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={undo} disabled={!canUndo}><Undo className="h-4 w-4 sm:h-5 sm:w-5" /></Button></TooltipTrigger><TooltipContent><p>Undo (Ctrl+Z)</p></TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={redo} disabled={!canRedo}><Redo className="h-4 w-4 sm:h-5 sm:w-5" /></Button></TooltipTrigger><TooltipContent><p>Redo (Ctrl+Y)</p></TooltipContent></Tooltip>
                      
                      <div className="hidden sm:block w-px h-6 bg-border mx-1" />
                      
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={handleZoomOut}><ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" /></Button></TooltipTrigger><TooltipContent><p>Zoom Out</p></TooltipContent></Tooltip>
                      <span className="text-[10px] sm:text-xs font-mono w-10 sm:w-12 text-center text-muted-foreground">{Math.round(displayZoom * 100)}%</span>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={handleZoomIn}><ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" /></Button></TooltipTrigger><TooltipContent><p>Zoom In</p></TooltipContent></Tooltip>
                      
                      <div className="md:hidden flex items-center">
                        <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsPropertiesSheetOpen(true)}><Settings2 className="h-4 w-4" /></Button>
                        </TooltipTrigger><TooltipContent><p>Properties</p></TooltipContent></Tooltip>
                      </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
          </div>
      </div>
      
      <div className="w-1 cursor-col-resize bg-border hover:bg-primary transition-colors items-center justify-center hidden md:flex z-40" onMouseDown={handleSidebarMouseDown}></div>

      <div className="h-full bg-card border-l transition-all hidden md:flex flex-col z-30 shadow-xl" style={{ width: isCollapsed ? "56px" : `${sidebarWidth}px` }}>
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b flex justify-between items-center flex-shrink-0 h-14">
                 {!isCollapsed && <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-2">Properties</span>}
                 <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="h-8 w-8">{isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
            </div>
            {!isCollapsed && (
                <>
                    <PropertiesSidebar 
                        fields={fields} setFields={setFields} 
                        selectedFieldIds={selectedFieldIds} setSelectedFieldIds={setSelectedFieldIds} 
                        updateField={updateField} removeField={removeField} addField={addField}
                        pagesLength={pdfDoc?.numPages || 0} pdf={pdf} 
                        isStatusChanging={isStatusChanging} onStatusChange={onStatusChange} 
                        password={password} setPassword={setPassword} 
                        passwordProtected={passwordProtected} setPasswordProtected={setPasswordProtected} 
                        onDetect={onDetect} isDetecting={isDetecting}
                    />
                    <div className="p-4 border-t flex flex-col gap-2">
                        <Button variant="outline" onClick={onPreview} size="sm"><Eye className="mr-2 h-4 w-4" /> Preview</Button>
                        <Button onClick={onSave} disabled={isSaving} size="sm">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSaving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </>
            )}
            {isCollapsed && (
                <div className="flex flex-col items-center gap-4 py-4">
                    <TooltipProvider>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)}><List /></Button></TooltipTrigger><TooltipContent side="left"><p>Fields</p></TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onPreview}><Eye /></Button></TooltipTrigger><TooltipContent side="left"><p>Preview</p></TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onSave} disabled={isSaving} className="text-primary"><Save /></Button></TooltipTrigger><TooltipContent side="left"><p>Save</p></TooltipContent></Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </div>
      </div>

       <Sheet open={isPropertiesSheetOpen} onOpenChange={setIsPropertiesSheetOpen}>
        <SheetContent className="p-0 flex flex-col md:hidden w-full max-w-sm" side="right">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Fields & Properties</SheetTitle>
          </SheetHeader>
          <PropertiesSidebar 
            fields={fields} setFields={setFields} 
            selectedFieldIds={selectedFieldIds} setSelectedFieldIds={setSelectedFieldIds} 
            updateField={updateField} removeField={removeField} addField={addField}
            pagesLength={pdfDoc?.numPages || 0} pdf={pdf} 
            isStatusChanging={isStatusChanging} onStatusChange={onStatusChange} 
            password={password} setPassword={setPassword} 
            passwordProtected={passwordProtected} setPasswordProtected={setPasswordProtected} 
            onDetect={onDetect} onDetect={onDetect} isDetecting={isDetecting}
          />
          <SheetFooter className="p-4 border-t flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={onPreview} size="sm"><Eye className="mr-2 h-4 w-4" /> Preview</Button>
            <Button onClick={onSave} disabled={isSaving} size="sm">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

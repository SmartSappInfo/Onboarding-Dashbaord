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
import { Text, Signature, Calendar, Trash2, Loader2, Sparkles, List, Settings2, GripVertical, PanelLeftClose, PanelLeftOpen, ZoomIn, ZoomOut, Save, Eye, Copy, Replace, EyeOff, Check, X } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField, MediaAsset } from '@/lib/types';
import { detectPdfFields } from '@/ai/flows/detect-pdf-fields-flow';
import { DndContext, useDraggable, type DragEndEvent, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetFooter } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PdfPreviewDialog from './PdfPreviewDialog';
import { Progress } from '@/components/ui/progress';

// Shared PDF.js promise
const pdfjsPromise = import('pdfjs-dist');

const fieldIcons: { [key in PDFFormField['type']]: React.ElementType } = {
  text: Text,
  signature: Signature,
  date: Calendar,
};

function PageRenderer({ pdf, pageNumber, fields, selectedFieldId, onSelect, onUpdate, onDelete, onDuplicate, onChangeType, zoom }: {
    pdf: PDFDocumentProxy;
    pageNumber: number;
    fields: LocalPDFFormField[];
    selectedFieldId: string | null;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, newProps: Partial<LocalPDFFormField>) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onChangeType: (id: string, newType: PDFFormField['type']) => void;
    zoom: number;
}) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
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
                // HONOR INTRINSIC ROTATION
                const viewport = page.getViewport({ scale: zoom * 1.5, rotation: page.rotate });
                setPageDimensions({ width: viewport.width, height: viewport.height });

                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        // Use native PDF.js rendering coordinates
                        await page.render({ canvasContext: context, viewport }).promise;
                    }
                }
            } catch (error) {
                console.error(`Error rendering page ${pageNumber}:`, error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        renderPage();
        
        return () => { isMounted = false; };
    }, [pdf, pageNumber, zoom]);
    
    return (
        <div 
            data-page-number={pageNumber}
            className="relative mx-auto shadow-xl mb-8 bg-white pdf-page-container transition-all flex-shrink-0"
            style={{ 
                width: pageDimensions.width / 1.5, 
                height: pageDimensions.height / 1.5,
            }}
        >
            {isLoading && <Skeleton className="absolute inset-0 z-10" />}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
            
            {!isLoading && fields.map(field => (
                <ResizableField
                    key={field.id}
                    field={field}
                    pageDimensions={pageDimensions}
                    isSelected={selectedFieldId === field.id}
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
    field, pageDimensions, isSelected, onSelect, onUpdate, onDelete, onDuplicate, onChangeType
}: {
    field: LocalPDFFormField;
    pageDimensions: { width: number, height: number };
    isSelected: boolean;
    onSelect: (id: string | null) => void;
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
                position: { x: (newX / displayWidth) * 100, y: (newY / displayHeight) * 100, },
                dimensions: { width: (newWidth / displayWidth) * 100, height: (newHeight / displayHeight) * 100, },
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
        <div ref={setNodeRef} style={style} {...attributes} onClick={(e) => { e.stopPropagation(); onSelect(field.id); }} className={`absolute border-2 ${borderColorClass} transition-colors group/field`}>
            <div {...listeners} className="w-full h-full cursor-grab"></div>
            {isSelected && (
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
                            className={cn('absolute bg-primary rounded-full w-2.5 h-2.5 -m-1.5 z-20',
                                handle.includes('top') && 'top-0',
                                handle.includes('bottom') && 'bottom-0',
                                handle.includes('left') && 'left-0',
                                handle.includes('right') && 'right-0',
                                handle === 'top' && 'left-1/2 -translate-x-1/2 cursor-n-resize',
                                handle === 'bottom' && 'left-1/2 -translate-x-1/2 cursor-s-resize',
                                handle === 'left' && 'top-1/2 -translate-y-1/2 cursor-w-resize',
                                handle === 'right' && 'top-1/2 -translate-y-1/2 cursor-e-resize',
                                handle === 'top-left' && 'cursor-nw-resize',
                                handle === 'top-right' && 'cursor-ne-resize',
                                handle === 'bottom-left' && 'cursor-sw-resize',
                                handle === 'bottom-right' && 'cursor-se-resize'
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
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;
  updateField: (id: string, newProps: Partial<PDFFormField>) => void;
  removeField: (id: string) => void;
  pagesLength: number;
  pdf: PDFForm;
  onSave: () => void;
  isSaving: boolean;
  onPreview: () => void;
  isStatusChanging: boolean;
  onStatusChange: (status: PDFForm['status']) => void;
  password: string;
  setPassword: (password: string) => void;
  passwordProtected: boolean;
  setPasswordProtected: (isProtected: boolean) => void;
}

const PropertiesSidebar = ({
  fields, setFields, selectedFieldId, setSelectedFieldId, updateField, removeField, pagesLength, pdf,
  onSave, isSaving, onPreview, isStatusChanging, onStatusChange, password, setPassword, passwordProtected, setPasswordProtected
}: PropertiesSidebarProps) => {
  const selectedField = fields.find(f => f.id === selectedFieldId);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const hasSuggestions = fields.some(f => f.isSuggestion);

  const acceptAllSuggestions = () => {
    setFields(prev => prev.map(f => ({ ...f, isSuggestion: false })));
  };

  const rejectAllSuggestions = () => {
    setFields(prev => prev.filter(f => !f.isSuggestion));
  };

  const deleteAllFields = () => {
    setFields([]);
    setSelectedFieldId(null);
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <SheetHeader className="p-4 border-b md:hidden">
        <CardTitle>Fields & Properties</CardTitle>
      </SheetHeader>
      <ScrollArea className="flex-grow">
        <div className="space-y-4 p-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
                <CardTitle className="text-base font-semibold">Fields ({fields.length})</CardTitle>
                <div className="flex items-center gap-1">
                    {hasSuggestions && (
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
                              return (
                                  <button key={field.id} onClick={() => setSelectedFieldId(field.id)}
                                      className={cn("w-full text-left p-2 rounded-md flex items-center gap-2 hover:bg-muted transition-colors", selectedFieldId === field.id && 'bg-muted ring-1 ring-primary')}>
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
                                <Input 
                                    id="form-password" 
                                    type={showPassword ? 'text' : 'password'} 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    className="h-8 text-sm pr-8"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground"
                                    onClick={() => setShowPassword(prev => !prev)}
                                >
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
       <SheetFooter className="p-4 border-t flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={onPreview} size="sm"><Eye className="mr-2 h-4 w-4" /> Preview</Button>
            <Button onClick={onSave} disabled={isSaving} size="sm">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
        </SheetFooter>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete all mapped fields for this document. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAllFields} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete All
                    </AlertDialogAction>
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
}

type LocalPDFFormField = PDFFormField & { isSuggestion?: boolean };

export default function FieldMapper({
  pdf, fields, setFields, onSave, isSaving, onPreview, password, setPassword, passwordProtected, setPasswordProtected, isStatusChanging, onStatusChange,
}: FieldMapperProps) {
  const { toast } = useToast();
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [isDetecting, setIsDetecting] = React.useState(false);

  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [sidebarWidth, setSidebarWidth] = React.useState(384);
  const isResizing = React.useRef(false);
  const isMobile = useIsMobile();
  const [isPropertiesSheetOpen, setIsPropertiesSheetOpen] = React.useState(false);
  
  const [displayZoom, setDisplayZoom] = React.useState(1);
  const handleZoomIn = () => setDisplayZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setDisplayZoom(prev => Math.max(prev - 0.1, 0.5));
  
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomFactor = 0.1;
      const { deltaY } = e;
      setDisplayZoom(prev => Math.max(0.5, Math.min(prev - (deltaY > 0 ? zoomFactor : -zoomFactor), 2)));
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  React.useEffect(() => {
    const loadPdf = async () => {
        try {
            const pdfjs = await pdfjsPromise;
            const pdfjsVersion = '4.4.168';
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            
            const loadingTask = pdfjs.getDocument({ url: pdf.downloadUrl });
            const loadedPdf = await loadingTask.promise;
            setPdfDoc(loadedPdf);
        } catch (error: any) {
            console.error("PDF Loading Error:", error);
            toast({ variant: 'destructive', title: 'Error Loading PDF', description: 'Could not load document template.', duration: 15000 });
        }
    };
    if (pdf.downloadUrl) loadPdf();
  }, [pdf.downloadUrl, toast]);
  
  const addField = (type: PDFFormField['type']) => {
    const newField: LocalPDFFormField = {
      id: `field_${Date.now()}`, label: `New ${type} field`, type, pageNumber: 1,
      position: { x: 5, y: 5 }, dimensions: { width: 20, height: 5 }, required: false,
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };
  
  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const updateField = React.useCallback((id: string, newProps: Partial<PDFFormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...newProps } : f));
  }, [setFields]);

  const handleDuplicateField = (id: string) => {
    const fieldToDuplicate = fields.find(f => f.id === id);
    if (!fieldToDuplicate) return;
    const newField: LocalPDFFormField = {
      ...JSON.parse(JSON.stringify(fieldToDuplicate)),
      id: `field_${Date.now()}`,
      position: { x: fieldToDuplicate.position.x + 2, y: fieldToDuplicate.position.y + 2 },
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const handleChangeFieldType = (id: string, newType: PDFFormField['type']) => {
    setFields(prev => prev.map(f => (f.id === id ? { ...f, type: newType } : f)));
  };

  const handleDetectFields = async () => {
    if (isDetecting) return;
    setIsDetecting(true);
    toast({ title: 'AI Field Detection', description: 'Analyzing your PDF. This might take a moment...' });
    
    try {
        const response = await fetch(pdf.downloadUrl);
        if (!response.ok) throw new Error("Failed to fetch PDF data.");
        const blob = await response.blob();
        
        const base64data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file."));
            reader.readAsDataURL(blob);
        });

        const result = await detectPdfFields({ pdfDataUri: base64data });
        if (result.fields && result.fields.length > 0) {
            const newFields: LocalPDFFormField[] = result.fields.map(suggestion => ({ 
                ...suggestion, 
                id: `ai_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, 
                isSuggestion: true, 
            }));
            setFields(prev => [...prev.filter(f => !f.isSuggestion), ...newFields]);
            toast({ title: 'AI Suggestions Added', description: `${result.fields.length} potential fields detected.` });
        } else {
            toast({ variant: 'destructive', title: 'No Fields Detected', description: 'The AI could not find any fields in this document.' });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'AI Detection Failed', description: error.message || 'An unknown error occurred.' });
    } finally {
        setIsDetecting(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const fieldToMove = fields.find(f => f.id === active.id);
    if (!fieldToMove) return;
    const pageContainer = viewportRef.current?.querySelector(`[data-page-number="${fieldToMove.pageNumber}"]`);
    if (!pageContainer) return;
    const { width, height } = pageContainer.getBoundingClientRect();
    const newX = fieldToMove.position.x + (delta.x / width) * 100;
    const newY = fieldToMove.position.y + (delta.y / height) * 100;
    updateField(active.id as string, {
        position: {
            x: Math.max(0, Math.min(100 - fieldToMove.dimensions.width, newX)),
            y: Math.max(0, Math.min(100 - fieldToMove.dimensions.height, newY)),
        },
        isSuggestion: false,
    });
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => { e.preventDefault(); isResizing.current = true; };
  const handleMouseUp = React.useCallback(() => { isResizing.current = false; }, []);
  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isResizing.current) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 320 && newWidth < 600) setSidebarWidth(newWidth);
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      <div className="flex-1 h-full relative min-w-0">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <ScrollArea className="h-full w-full" onWheel={handleWheel} viewportRef={viewportRef}>
                <div 
                    className="p-12 pb-32 flex flex-col items-center min-w-full" 
                    style={{ minWidth: 'fit-content' }}
                    onClick={() => setSelectedFieldId(null)}
                >
                    {!pdfDoc && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="w-[8.5in] h-[11in] max-w-full bg-card shadow-xl rounded-lg flex-shrink-0 mb-12" />)}
                    {pdfDoc && Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                        <PageRenderer
                            key={index} pdf={pdfDoc} pageNumber={index + 1}
                            fields={fields.filter(f => f.pageNumber === index + 1)}
                            selectedFieldId={selectedFieldId} onSelect={setSelectedFieldId}
                            onUpdate={updateField} onDelete={removeField} onDuplicate={handleDuplicateField}
                            onChangeType={handleChangeFieldType} zoom={displayZoom} />
                    ))}
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
              <Card className="shadow-2xl border-primary/20 pointer-events-auto">
                <CardContent className="p-2 flex items-center gap-1 sm:gap-2">
                  <TooltipProvider>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => addField('text')}><Text className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Add Text</p></TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => addField('signature')}><Signature className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Add Signature</p></TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => addField('date')}><Calendar className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Add Date</p></TooltipContent></Tooltip>
                      <div className="w-px h-6 bg-border mx-1" />
                      <Tooltip><TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10" onClick={handleDetectFields} disabled={isDetecting}>
                              {isDetecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                          </Button>
                      </TooltipTrigger><TooltipContent><p>AI Detect Fields</p></TooltipContent></Tooltip>
                      <div className="w-px h-6 bg-border mx-1" />
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleZoomOut}><ZoomOut className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Zoom Out</p></TooltipContent></Tooltip>
                      <span className="text-xs font-mono w-12 text-center text-muted-foreground">{Math.round(displayZoom * 100)}%</span>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleZoomIn}><ZoomIn className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Zoom In</p></TooltipContent></Tooltip>
                      <div className="md:hidden">
                        <div className="w-px h-6 bg-border mx-1" />
                        <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setIsPropertiesSheetOpen(true)}><Settings2 className="h-5 w-5" /></Button>
                        </TooltipTrigger><TooltipContent><p>Properties</p></TooltipContent></Tooltip>
                      </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
          </div>
      </div>
      
      <div className="w-1 cursor-col-resize bg-border hover:bg-primary transition-colors items-center justify-center hidden md:flex z-40" onMouseDown={handleMouseDown}></div>

      <div className="h-full bg-card border-l transition-all hidden md:flex flex-col z-30 shadow-xl" style={{ width: isCollapsed ? "56px" : `${sidebarWidth}px` }}>
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b flex justify-between items-center flex-shrink-0 h-14">
                 {!isCollapsed && <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground ml-2">Properties</span>}
                 <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="h-8 w-8">{isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
            </div>
            {!isCollapsed && <PropertiesSidebar fields={fields} setFields={setFields} selectedFieldId={selectedFieldId} setSelectedFieldId={setSelectedFieldId} updateField={updateField} removeField={removeField} pagesLength={pdfDoc?.numPages || 0} pdf={pdf} onSave={onSave} isSaving={isSaving} onPreview={onPreview} isStatusChanging={isStatusChanging} onStatusChange={onStatusChange} password={password} setPassword={setPassword} passwordProtected={passwordProtected} setPasswordProtected={setPasswordProtected} />}
            {isCollapsed && (
                <div className="flex flex-col items-center gap-4 py-4"><TooltipProvider>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)}><List /></Button></TooltipTrigger><TooltipContent side="left"><p>Fields</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onPreview}><Eye /></Button></TooltipTrigger><TooltipContent side="left"><p>Preview</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onSave} disabled={isSaving} className="text-primary"><Save /></Button></TooltipTrigger><TooltipContent side="left"><p>Save</p></TooltipContent></Tooltip>
                </TooltipProvider></div>
            )}
        </div>
      </div>

       <Sheet open={isPropertiesSheetOpen} onOpenChange={setIsPropertiesSheetOpen}>
        <SheetContent className="p-0 flex flex-col md:hidden w-full max-w-sm" side="right">
          <PropertiesSidebar fields={fields} setFields={setFields} selectedFieldId={selectedFieldId} setSelectedFieldId={setSelectedFieldId} updateField={updateField} removeField={removeField} pagesLength={pdfDoc?.numPages || 0} pdf={pdf} onSave={onSave} isSaving={isSaving} onPreview={onPreview} isStatusChanging={isStatusChanging} onStatusChange={onStatusChange} password={password} setPassword={setPassword} passwordProtected={passwordProtected} setPasswordProtected={setPasswordProtected} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

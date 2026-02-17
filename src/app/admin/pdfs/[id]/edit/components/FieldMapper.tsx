
'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Text, Signature, Calendar, Trash2, Loader2, Sparkles, List, Settings2, GripVertical, PanelLeftClose, PanelLeftOpen, ZoomIn, ZoomOut, Save, Eye, Copy, Replace } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField } from '@/lib/types';
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
import { updatePdfFormStatus } from '@/lib/pdf-actions';

// Dynamically import pdfjs-dist
const pdfjsPromise = import('pdfjs-dist');
const pdfjsViewerPromise = import('pdfjs-dist/web/pdf_viewer.mjs');

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
    const textLayerRef = React.useRef<HTMLDivElement>(null);
    const annotationLayerRef = React.useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [pageDimensions, setPageDimensions] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        let isMounted = true;
        const renderPage = async () => {
             if (!isMounted) return;
             setIsLoading(true);
             
             try {
                const [pdfjs, pdfjsViewer] = await Promise.all([pdfjsPromise, pdfjsViewerPromise]);
                if (!isMounted) return;
                
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: zoom * 1.5 }); // Render at higher res
                setPageDimensions({ width: viewport.width, height: viewport.height });

                // Render Canvas
                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    if (context) {
                        await page.render({ canvasContext: context, viewport }).promise;
                    }
                }

                // Render Text Layer
                const textContent = await page.getTextContent();
                if (textLayerRef.current) {
                    textLayerRef.current.innerHTML = '';
                    pdfjs.renderTextLayer({ textContentSource: textContent, container: textLayerRef.current, viewport });
                }

                // Render Annotation Layer (for links)
                if (annotationLayerRef.current) {
                    annotationLayerRef.current.innerHTML = '';
                    const annotations = await page.getAnnotations();
                    const linkService = new pdfjsViewer.PDFLinkService();
                    pdfjsViewer.AnnotationLayer.render({ viewport: viewport.clone({ dontFlip: true }), div: annotationLayerRef.current, annotations, page, linkService: linkService, renderForms: false });
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
            className="relative mx-auto shadow-lg mb-4 bg-white pdf-page-container"
            style={{ 
                width: pageDimensions.width / 1.5, // Display at normal scale
                height: pageDimensions.height / 1.5,
            }}
        >
            {isLoading && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            <div ref={textLayerRef} className="textLayer absolute inset-0 w-full h-full" />
            <div ref={annotationLayerRef} className="annotationLayer absolute inset-0 w-full h-full" />
            
            {fields.map(field => (
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
        <div ref={setNodeRef} style={style} {...attributes} onClick={(e) => { e.stopPropagation(); onSelect(field.id); }} className={`absolute border-2 ${borderColorClass} transition-colors`}>
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
             {field.isSuggestion && <span className="absolute -top-6 left-0 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">AI Suggestion</span>}
        </div>
    );
};


interface PropertiesSidebarProps {
  fields: LocalPDFFormField[];
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
  fields, selectedFieldId, setSelectedFieldId, updateField, removeField, pagesLength, pdf,
  onSave, isSaving, onPreview, isStatusChanging, onStatusChange, password, setPassword, passwordProtected, setPasswordProtected
}: PropertiesSidebarProps) => {
  const selectedField = fields.find(f => f.id === selectedFieldId);

  return (
    <>
      <SheetHeader className="p-4 border-b md:hidden">
        <CardTitle>Fields & Properties</CardTitle>
      </SheetHeader>
      <ScrollArea className="flex-grow">
        <div className="space-y-4 p-4">
            <Card>
              <CardHeader><CardTitle>Fields ({fields.length})</CardTitle></CardHeader>
              <CardContent>
                  <ScrollArea className="h-48">
                      <div className="space-y-1">
                          {fields.map((field) => {
                              const Icon = fieldIcons[field.type];
                              return (
                                  <button key={field.id} onClick={() => setSelectedFieldId(field.id)}
                                      className={cn("w-full text-left p-2 rounded-md flex items-center gap-2 hover:bg-muted", selectedFieldId === field.id && 'bg-muted ring-1 ring-primary')}>
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                      <span className="truncate text-sm flex-1">{field.label || field.id}</span>
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
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <span>Field Properties</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeField(selectedField.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CardTitle>
                        <CardDescription>ID: {selectedField.id}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={`label-${selectedField.id}`}>Field Label</Label>
                            <Input id={`label-${selectedField.id}`} placeholder="e.g. Applicant Name" value={selectedField.label || ''} onChange={e => updateField(selectedField.id, { label: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Input value={selectedField.type} disabled className="capitalize" />
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label htmlFor={`required-toggle-${selectedField.id}`} className="text-sm">Required</Label>
                            <Switch id={`required-toggle-${selectedField.id}`} checked={!!selectedField.required} onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`page-${selectedField.id}`}>Page Number</Label>
                            <Input id={`page-${selectedField.id}`} type="number" min="1" max={pagesLength} value={selectedField.pageNumber} onChange={e => updateField(selectedField.id, { pageNumber: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor={`x-pos-${selectedField.id}`}>X (%)</Label>
                                <Input id={`x-pos-${selectedField.id}`} type="number" value={selectedField.position.x.toFixed(2)} onChange={e => updateField(selectedField.id, { position: { ...selectedField.position, x: parseFloat(e.target.value) || 0 } })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`y-pos-${selectedField.id}`}>Y (%)</Label>
                                <Input id={`y-pos-${selectedField.id}`} type="number" value={selectedField.position.y.toFixed(2)} onChange={e => updateField(selectedField.id, { position: { ...selectedField.position, y: parseFloat(e.target.value) || 0 } })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor={`width-${selectedField.id}`}>Width (%)</Label>
                                <Input id={`width-${selectedField.id}`} type="number" value={selectedField.dimensions.width.toFixed(2)} onChange={e => updateField(selectedField.id, { dimensions: { ...selectedField.dimensions, width: parseFloat(e.target.value) || 0 } })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`height-${selectedField.id}`}>Height (%)</Label>
                                <Input id={`height-${selectedField.id}`} type="number" value={selectedField.dimensions.height.toFixed(2)} onChange={e => updateField(selectedField.id, { dimensions: { ...selectedField.dimensions, height: parseFloat(e.target.value) || 0 } })} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : null}
            <Card>
                <CardHeader><CardTitle>Security</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="password-protect-toggle">Password Protect</Label>
                            <p className="text-xs text-muted-foreground">Require a password to view this form.</p>
                        </div>
                        <Switch id="password-protect-toggle" checked={passwordProtected} onCheckedChange={setPasswordProtected} />
                    </div>
                    {passwordProtected && (
                         <div className="space-y-2">
                            <Label htmlFor="form-password">Form Password</Label>
                            <Input id="form-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                    )}
                </CardContent>
            </Card>
             <Card>
                <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                <CardContent>
                     <Select value={pdf.status} onValueChange={(value: PDFForm['status']) => onStatusChange(value)} disabled={isStatusChanging}>
                        <SelectTrigger><SelectValue placeholder="Set status..." /></SelectTrigger>
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
            <Button variant="outline" onClick={onPreview}><Eye className="mr-2 h-4 w-4" /> Preview</Button>
            <Button onClick={onSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
        </SheetFooter>
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
            const [pdfjs, pdfjsViewer] = await Promise.all([pdfjsPromise, pdfjsViewerPromise]);
            (window as any).pdfjsLib = pdfjs;
            const pdfjsVersion = '4.4.168';
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            const loadingTask = pdfjs.getDocument({ url: pdf.downloadUrl });
            const loadedPdf = await loadingTask.promise;
            setPdfDoc(loadedPdf);
        } catch (error: any) {
            console.error("PDF Loading Error:", error);
            let description = 'Could not load document. Check the console for details.';
            if (error.name === 'NetworkError' || (error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch')))) {
                description = 'CORS policy error. The server for the PDF is not configured to allow this application to fetch it.';
            }
            toast({ variant: 'destructive', title: 'Error Loading PDF', description, duration: 15000 });
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
    setIsDetecting(true);
    toast({ title: 'AI Field Detection', description: 'The AI is analyzing your PDF. This might take a moment...' });
    try {
        const response = await fetch(pdf.downloadUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64data = reader.result as string;
            const result = await detectPdfFields({ pdfDataUri: base64data });
            if (result.fields && result.fields.length > 0) {
                const newFields: LocalPDFFormField[] = result.fields.map(suggestion => ({ ...suggestion, id: `ai_${Date.now()}_${Math.random()}`, isSuggestion: true, }));
                setFields(prev => [...prev.filter(f => !f.isSuggestion), ...newFields]);
                toast({ title: 'AI Suggestions Added', description: `${result.fields.length} potential fields have been added as suggestions.` });
            } else {
                toast({ variant: 'destructive', title: 'No Fields Detected', description: 'The AI could not find any fields in this document.' });
            }
        };
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
        isSuggestion: false, // Confirm suggestion on move
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
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 h-full relative min-w-0">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <ScrollArea className="h-full bg-muted" onWheel={handleWheel} viewportRef={viewportRef}>
                <div className="p-4 space-y-4 pb-24 flex flex-col items-center" onClick={() => setSelectedFieldId(null)}>
                    {!pdfDoc && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="w-[8.5in] h-[11in] max-w-full bg-white shadow-lg" />)}
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
          
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <Card className="shadow-lg"><CardContent className="p-2"><TooltipProvider>
                      <div className="flex items-center gap-1 sm:gap-2">
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => addField('text')}><Text /></Button></TooltipTrigger><TooltipContent><p>Add Text Field</p></TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => addField('signature')}><Signature /></Button></TooltipTrigger><TooltipContent><p>Add Signature Field</p></TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => addField('date')}><Calendar /></Button></TooltipTrigger><TooltipContent><p>Add Date Field</p></TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                              <Button variant="outline" size="icon" className="text-primary border-primary/50 hover:bg-primary/10 hover:text-primary" onClick={handleDetectFields} disabled={isDetecting}>
                                  {isDetecting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                              </Button>
                          </TooltipTrigger><TooltipContent><p>Auto-detect Fields (AI)</p></TooltipContent></Tooltip>
                          <Separator orientation="vertical" className="h-6 mx-1" />
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleZoomOut}><ZoomOut /></Button></TooltipTrigger><TooltipContent><p>Zoom Out</p></TooltipContent></Tooltip>
                           <Tooltip><TooltipTrigger asChild>
                              <div className="flex items-center justify-center w-16 h-9 text-sm font-medium text-muted-foreground border border-input rounded-md bg-transparent">{Math.round(displayZoom * 100)}%</div>
                           </TooltipTrigger><TooltipContent><p>Current Zoom</p></TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleZoomIn}><ZoomIn /></Button></TooltipTrigger><TooltipContent><p>Zoom In</p></TooltipContent></Tooltip>
                          <div className="md:hidden">
                            <Separator orientation="vertical" className="h-6 mx-1" />
                            <Tooltip><TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => setIsPropertiesSheetOpen(true)}><Settings2 /></Button>
                            </TooltipTrigger><TooltipContent><p>Fields & Properties</p></TooltipContent></Tooltip>
                          </div>
                      </div>
              </TooltipProvider></CardContent></Card>
          </div>
      </div>
      
      <div className="w-2 cursor-col-resize bg-border/50 hover:bg-border transition-colors items-center justify-center hidden md:flex" onMouseDown={handleMouseDown}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="h-full bg-card border-l transition-all hidden md:flex flex-col" style={{ width: isCollapsed ? "56px" : `${sidebarWidth}px` }}>
        <div className="flex flex-col h-full">
            <div className="p-2 border-b flex-shrink-0">
                 <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>{isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
            </div>
            {!isCollapsed && <PropertiesSidebar fields={fields} selectedFieldId={selectedFieldId} setSelectedFieldId={setSelectedFieldId} updateField={updateField} removeField={removeField} pagesLength={pdfDoc?.numPages || 0} pdf={pdf} onSave={onSave} isSaving={isSaving} onPreview={onPreview} isStatusChanging={isStatusChanging} onStatusChange={onStatusChange} password={password} setPassword={setPassword} passwordProtected={passwordProtected} setPasswordProtected={setPasswordProtected} />}
            {isCollapsed && (
                <div className="flex flex-col items-center gap-4 py-4"><TooltipProvider>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)}><List /></Button></TooltipTrigger><TooltipContent side="left"><p>Fields</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onPreview}><Eye /></Button></TooltipTrigger><TooltipContent side="left"><p>Preview</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onSave} disabled={isSaving}><Save /></Button></TooltipTrigger><TooltipContent side="left"><p>Save Changes</p></TooltipContent></Tooltip>
                </TooltipProvider></div>
            )}
        </div>
      </div>

       <Sheet open={isPropertiesSheetOpen} onOpenChange={setIsPropertiesSheetOpen}>
        <SheetContent className="p-0 flex flex-col md:hidden" side="right">
          <PropertiesSidebar fields={fields} selectedFieldId={selectedFieldId} setSelectedFieldId={setSelectedFieldId} updateField={updateField} removeField={removeField} pagesLength={pdfDoc?.numPages || 0} pdf={pdf} onSave={onSave} isSaving={isSaving} onPreview={onPreview} isStatusChanging={isStatusChanging} onStatusChange={onStatusChange} password={password} setPassword={setPassword} passwordProtected={passwordProtected} setPasswordProtected={setPasswordProtected} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

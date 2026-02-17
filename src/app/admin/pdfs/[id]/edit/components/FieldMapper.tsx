'use client';

import * as React from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Text, Signature, Calendar, Trash2, Loader2, Sparkles, List, Settings2, GripVertical, PanelLeftClose, PanelLeftOpen, ZoomIn, ZoomOut, Save, Eye } from 'lucide-react';
import type { PDFForm, PDFFormField } from '@/lib/types';
import { detectPdfFields } from '@/ai/flows/detect-pdf-fields-flow';
import { DndContext, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface PageDetail {
  dataUrl: string;
  width: number;
  height: number;
}

type LocalPDFFormField = PDFFormField & { isSuggestion?: boolean };

const fieldIcons: { [key in PDFFormField['type']]: React.ElementType } = {
  text: Text,
  signature: Signature,
  date: Calendar,
};

const ResizableField = ({
    field,
    page,
    isSelected,
    onSelect,
    onUpdate,
    zoom,
}: {
    field: LocalPDFFormField;
    page: PageDetail;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onUpdate: (id: string, newProps: Partial<LocalPDFFormField>) => void;
    zoom: number;
}) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: field.id,
    });
    
    const [isResizing, setIsResizing] = React.useState(false);
    const initialResizeState = React.useRef<{
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
    } | null>(null);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        initialResizeState.current = {
            startX: e.clientX,
            startY: e.clientY,
            startWidth: (field.dimensions.width / 100) * (page.width * zoom),
            startHeight: (field.dimensions.height / 100) * (page.height * zoom),
        };
        onSelect(field.id);
    };

    React.useEffect(() => {
        const handleResize = (e: MouseEvent) => {
            if (!isResizing || !initialResizeState.current) return;
            const dx = e.clientX - initialResizeState.current.startX;
            const dy = e.clientY - initialResizeState.current.startY;
            
            const newWidth = initialResizeState.current.startWidth + dx;
            const newHeight = initialResizeState.current.startHeight + dy;
            
            onUpdate(field.id, {
                dimensions: {
                    width: (newWidth / (page.width * zoom)) * 100,
                    height: (newHeight / (page.height * zoom)) * 100,
                },
            });
        };

        const handleResizeEnd = () => {
            setIsResizing(false);
            initialResizeState.current = null;
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleResize);
            window.addEventListener('mouseup', handleResizeEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleResize);
            window.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [isResizing, field.id, onUpdate, page.width, page.height, zoom]);

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${field.position.x}%`,
        top: `${field.position.y}%`,
        width: `${field.dimensions.width}%`,
        height: `${field.dimensions.height}%`,
        transform: CSS.Translate.toString(transform),
        zIndex: isSelected ? 10 : (field.isSuggestion ? 5 : 1),
    };

    const borderColorClass = isSelected
        ? 'border-primary'
        : field.isSuggestion
        ? 'border-green-500'
        : 'border-dashed border-primary/50 hover:border-primary';

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={(e) => { e.stopPropagation(); onSelect(field.id); }}
            className={`absolute border-2 cursor-grab ${borderColorClass}`}
        >
             {field.isSuggestion && <span className="absolute -top-6 left-0 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">AI Suggestion</span>}
            <div
                className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full cursor-se-resize -mb-1.5 -mr-1.5"
                onMouseDown={handleResizeStart}
            />
        </div>
    );
};

interface FieldMapperProps {
  pdf: PDFForm;
  fields: LocalPDFFormField[];
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
  onSave: () => Promise<void>;
  isSaving: boolean;
  onPreview: () => void;
}

export default function FieldMapper({ pdf, fields, setFields, onSave, isSaving, onPreview }: FieldMapperProps) {
  const { toast } = useToast();
  const [pages, setPages] = React.useState<PageDetail[]>([]);
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = React.useState(true);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const pdfjsRef = React.useRef<any>(null);

  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [sidebarWidth, setSidebarWidth] = React.useState(384);
  const isResizing = React.useRef(false);
  
  const [displayZoom, setDisplayZoom] = React.useState(1);
  const handleZoomIn = () => setDisplayZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setDisplayZoom(prev => Math.max(prev - 0.1, 0.5));

  React.useEffect(() => {
    const loadAndRenderPdf = async () => {
      setIsLoadingPdf(true);
      try {
        if (!pdfjsRef.current) {
          const pdfjsModule = await import('pdfjs-dist/build/pdf.mjs');
          const pdfjsVersion = '4.4.168';
          pdfjsModule.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
          pdfjsRef.current = pdfjsModule;
        }

        const pdfjs = pdfjsRef.current;
        const loadingTask = pdfjs.getDocument({ url: pdf.downloadUrl });
        const pdfDoc = await loadingTask.promise;
        const pageDetails: PageDetail[] = [];

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            pageDetails.push({
              dataUrl: canvas.toDataURL('image/webp', 0.9),
              width: viewport.width,
              height: viewport.height,
            });
          }
        }
        setPages(pageDetails);
      } catch (error: any) {
        console.error("PDF Loading Error:", error);
        toast({ 
            variant: 'destructive', 
            title: 'Error Loading PDF',
            description: error.message || 'Could not load document.',
            duration: 15000,
        });
      } finally {
        setIsLoadingPdf(false);
      }
    };

    if (pdf.downloadUrl) {
      loadAndRenderPdf();
    }
  }, [pdf.downloadUrl, toast]);
  
  const addField = (type: PDFFormField['type']) => {
    const newField: LocalPDFFormField = {
      id: `field_${Date.now()}`,
      label: `New ${type} field`,
      type,
      pageNumber: 1, // Default to first page
      position: { x: 5, y: 5 },
      dimensions: { width: 20, height: 5 },
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };
  
  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  const updateField = React.useCallback((id: string, newProps: Partial<PDFFormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...newProps } : f));
  }, [setFields]);

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
                const newFields: LocalPDFFormField[] = result.fields.map(suggestion => ({
                    ...suggestion,
                    id: `ai_${Date.now()}_${Math.random()}`,
                    isSuggestion: true,
                }));
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

    const pageDetail = pages[fieldToMove.pageNumber - 1];
    if (!pageDetail) return;

    const newX = fieldToMove.position.x + (delta.x / (pageDetail.width * displayZoom)) * 100;
    const newY = fieldToMove.position.y + (delta.y / (pageDetail.height * displayZoom)) * 100;

    const updatedField = {
        ...fieldToMove,
        position: {
            x: Math.max(0, Math.min(100 - fieldToMove.dimensions.width, newX)),
            y: Math.max(0, Math.min(100 - fieldToMove.dimensions.height, newY)),
        },
        isSuggestion: false, // Confirm suggestion on move
    };

    updateField(active.id as string, updatedField);
  };
  
  const selectedField = fields.find(f => f.id === selectedFieldId);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isResizing.current = true;
  };

  const handleMouseUp = React.useCallback(() => {
    isResizing.current = false;
  }, []);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isResizing.current) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 320 && newWidth < 600) { // Clamping the width
            setSidebarWidth(newWidth);
        }
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
      {/* PDF Viewer Column */}
      <div className="flex-1 h-full relative min-w-0">
          <DndContext onDragEnd={handleDragEnd}>
              <ScrollArea className="h-full bg-muted">
                <div
                    className="p-4 space-y-4 pb-24 flex flex-col items-center"
                    onClick={() => setSelectedFieldId(null)}
                >
                    {isLoadingPdf && <Skeleton className="w-full h-[1000px]" />}
                    {!isLoadingPdf && pages.map((page, index) => (
                        <div 
                            key={index}
                            className="relative mx-auto shadow-lg mb-4"
                            style={{ 
                                width: page.width * displayZoom,
                                height: page.height * displayZoom,
                            }}
                        >
                            <Image
                                src={page.dataUrl}
                                fill
                                sizes={`${page.width * displayZoom}px`}
                                alt={`Page ${index + 1}`}
                                priority
                            />
                            {fields.filter(f => f.pageNumber === index + 1).map(field => (
                                <ResizableField
                                    key={field.id}
                                    field={field}
                                    page={page}
                                    isSelected={selectedFieldId === field.id}
                                    onSelect={setSelectedFieldId}
                                    onUpdate={updateField}
                                    zoom={displayZoom}
                                />
                            ))}
                        </div>
                    ))}
                </div>
              </ScrollArea>
          </DndContext>
          
          {/* Floating Toolbar */}
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <Card className="shadow-lg">
                  <CardContent className="p-2">
                    <TooltipProvider>
                      <div className="flex items-center gap-2">
                          <Tooltip>
                              <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => addField('text')}><Text /></Button></TooltipTrigger>
                              <TooltipContent><p>Add Text Field</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                              <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => addField('signature')}><Signature /></Button></TooltipTrigger>
                              <TooltipContent><p>Add Signature Field</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                              <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => addField('date')}><Calendar /></Button></TooltipTrigger>
                              <TooltipContent><p>Add Date Field</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" className="text-primary border-primary/50 hover:bg-primary/10 hover:text-primary" onClick={handleDetectFields} disabled={isDetecting}>
                                      {isDetecting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Auto-detect Fields (AI)</p></TooltipContent>
                          </Tooltip>

                          <Separator orientation="vertical" className="h-6" />

                          <Tooltip>
                            <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleZoomOut}><ZoomOut /></Button></TooltipTrigger>
                            <TooltipContent><p>Zoom Out</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center w-12 h-9 text-sm font-medium text-muted-foreground border border-input rounded-md bg-transparent">
                                {Math.round(displayZoom * 100)}%
                              </div>
                            </TooltipTrigger>
                            <TooltipContent><p>Current Zoom</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                              <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleZoomIn}><ZoomIn /></Button></TooltipTrigger>
                              <TooltipContent><p>Zoom In</p></TooltipContent>
                          </Tooltip>

                           <Separator orientation="vertical" className="h-6" />

                          <Tooltip>
                            <TooltipTrigger asChild><Button variant="outline" size="icon" onClick={onPreview}><Eye /></Button></TooltipTrigger>
                            <TooltipContent><p>Preview</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" onClick={onSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Save Changes</p></TooltipContent>
                          </Tooltip>
                      </div>
                    </TooltipProvider>
                  </CardContent>
              </Card>
          </div>
      </div>
      
      {/* Resizer Handle */}
      <div 
        className="w-2 cursor-col-resize bg-border/50 hover:bg-border transition-colors flex items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Right Sidebar Column */}
      <div 
        className="h-full bg-card border-l transition-all"
        style={{ width: isCollapsed ? "56px" : `${sidebarWidth}px` }}
      >
        <div className="flex flex-col h-full">
            <div className="p-2 border-b flex-shrink-0">
                 <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
                    {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
            </div>
            
            {isCollapsed ? (
                <div className="flex flex-col items-center gap-4 py-4">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon"><List /></Button>
                            </TooltipTrigger>
                            <TooltipContent side="left"><p>Fields</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon"><Settings2 /></Button>
                            </TooltipTrigger>
                            <TooltipContent side="left"><p>Properties</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            ) : (
                <ScrollArea className="flex-grow">
                    <div className="space-y-4 p-4">
                         <Card>
                            <CardHeader>
                                <CardTitle>Fields ({fields.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-48">
                                    <div className="space-y-1">
                                        {fields.map((field) => {
                                            const Icon = fieldIcons[field.type];
                                            return (
                                                <button
                                                    key={field.id}
                                                    onClick={() => setSelectedFieldId(field.id)}
                                                    className={cn(
                                                        "w-full text-left p-2 rounded-md flex items-center gap-2 hover:bg-muted",
                                                        selectedFieldId === field.id && 'bg-muted ring-1 ring-primary'
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate text-sm flex-1">{field.label || field.id}</span>
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
                                    <div className="space-y-2">
                                        <Label htmlFor={`page-${selectedField.id}`}>Page Number</Label>
                                        <Input id={`page-${selectedField.id}`} type="number" min="1" max={pages.length} value={selectedField.pageNumber} onChange={e => updateField(selectedField.id, { pageNumber: parseInt(e.target.value) || 1 })} />
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
                        ) : (
                            <Card className="text-center text-sm text-muted-foreground p-8">
                                <p>Select a field to edit its properties or add a new field from the toolbar.</p>
                            </Card>
                        )}
                    </div>
                </ScrollArea>
            )}
        </div>
      </div>
    </div>
  );
}

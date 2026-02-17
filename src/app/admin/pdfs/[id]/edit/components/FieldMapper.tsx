
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text, Signature, Calendar, Plus, Trash2, Loader2, Save, Sparkles } from 'lucide-react';
import type { PDFForm, PDFFormField } from '@/lib/types';
import { updatePdfFormStatus } from '@/lib/pdf-actions';
import { detectPdfFields } from '@/ai/flows/detect-pdf-fields-flow';
import { DndContext, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
}: {
    field: LocalPDFFormField;
    page: PageDetail;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onUpdate: (id: string, newProps: Partial<LocalPDFFormField>) => void;
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
            startWidth: (field.dimensions.width / 100) * page.width,
            startHeight: (field.dimensions.height / 100) * page.height,
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
                    width: (newWidth / page.width) * 100,
                    height: (newHeight / page.height) * 100,
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
    }, [isResizing, field.id, onUpdate, page.width, page.height]);

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
}

export default function FieldMapper({ pdf, fields, setFields }: FieldMapperProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [pages, setPages] = React.useState<PageDetail[]>([]);
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = React.useState(true);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [isStatusChanging, setIsStatusChanging] = React.useState(false);
  const pdfjsRef = React.useRef<any>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);

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

    const newX = fieldToMove.position.x + (delta.x / pageDetail.width) * 100;
    const newY = fieldToMove.position.y + (delta.y / pageDetail.height) * 100;

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

  const handleStatusChange = async (newStatus: PDFForm['status']) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'You must be logged in.' });
        return;
    }
    setIsStatusChanging(true);
    const result = await updatePdfFormStatus(pdf.id, newStatus, user.uid);
    if (result.success) {
        toast({ title: 'Status Updated' });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsStatusChanging(false);
  };


  return (
    <div className="grid grid-cols-12 gap-4 h-full overflow-hidden p-4">
        {/* Left Panel: Field List */}
        <div className="col-span-2 bg-background border-r h-full overflow-y-auto">
            <div className="p-2 space-y-2">
                <h3 className="text-sm font-semibold px-2">Fields ({fields.length})</h3>
                <ScrollArea className="h-[calc(100vh-12rem)]">
                    {fields.map((field) => {
                        const Icon = fieldIcons[field.type];
                        return (
                            <button
                                key={field.id}
                                onClick={() => setSelectedFieldId(field.id)}
                                className={cn(
                                    "w-full text-left p-2 rounded-md flex items-center gap-2 hover:bg-muted",
                                    selectedFieldId === field.id && 'bg-muted ring-2 ring-primary'
                                )}
                            >
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate text-sm flex-1">{field.label || field.id}</span>
                            </button>
                        );
                    })}
                </ScrollArea>
            </div>
        </div>

        {/* Center Panel: PDF Viewer */}
        <div className="col-span-7 h-full">
            <DndContext onDragEnd={handleDragEnd}>
                <div
                    ref={containerRef}
                    className="bg-muted rounded-lg border overflow-auto p-4 space-y-4 h-full"
                    onClick={() => setSelectedFieldId(null)}
                >
                    {isLoadingPdf && <Skeleton className="w-full h-full" />}
                    {!isLoadingPdf && pages.map((page, index) => (
                        <div key={index} className="relative mx-auto shadow-lg" style={{ width: page.width, height: page.height }}>
                            <Image
                                src={page.dataUrl}
                                width={page.width}
                                height={page.height}
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
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </DndContext>
        </div>

        {/* Right Panel: Controls */}
        <div className="col-span-3 h-full overflow-y-auto">
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Toolbar</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-2">
                        <Button variant="outline" onClick={() => addField('text')}><Text className="mr-2 h-4 w-4" /> Text Input</Button>
                        <Button variant="outline" onClick={() => addField('signature')}><Signature className="mr-2 h-4 w-4" /> Signature</Button>
                        <Button variant="outline" onClick={() => addField('date')}><Calendar className="mr-2 h-4 w-4" /> Date</Button>
                        <Button variant="outline" className="text-primary border-primary/50 hover:bg-primary/10 hover:text-primary" onClick={handleDetectFields} disabled={isDetecting}>
                            {isDetecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Auto-detect Fields
                        </Button>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Status</CardTitle>
                        <CardDescription>Control the visibility of this form.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Select
                            value={pdf.status}
                            onValueChange={(value: PDFForm['status']) => handleStatusChange(value)}
                            disabled={isStatusChanging}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                        {isStatusChanging && <Loader2 className="mt-2 h-4 w-4 animate-spin" />}
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
        </div>
    </div>
  );
}

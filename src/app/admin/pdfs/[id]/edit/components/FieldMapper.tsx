'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Text, Signature, Calendar, Plus, Trash2, Loader2, Save } from 'lucide-react';
import type { PDFForm, PDFFormField } from '@/lib/types';
import { updatePdfFormMapping } from '@/lib/pdf-actions';
import { DndContext, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Set up the worker source for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PageDetail {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

const ResizableField = ({
    field,
    page,
    isSelected,
    onSelect,
    onUpdate,
}: {
    field: PDFFormField;
    page: PageDetail;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onUpdate: (id: string, newProps: Partial<PDFFormField>) => void;
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
        zIndex: isSelected ? 10 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onSelect(field.id)}
            className={`absolute border-2 cursor-grab ${isSelected ? 'border-primary' : 'border-dashed border-primary/50 hover:border-primary'}`}
        >
            <div
                className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full cursor-se-resize -mb-1.5 -mr-1.5"
                onMouseDown={handleResizeStart}
            />
        </div>
    );
};

export default function FieldMapper({ pdf }: { pdf: PDFForm }) {
  const { toast } = useToast();
  const [pages, setPages] = React.useState<PageDetail[]>([]);
  const [fields, setFields] = React.useState<PDFFormField[]>(() => JSON.parse(JSON.stringify(pdf.fieldMapping || [])));
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const loadPdf = async () => {
      try {
        setIsLoadingPdf(true);
        const loadingTask = pdfjs.getDocument({ url: pdf.downloadUrl, CMapReaderFactory: pdfjs.CMapCompressionType.NONE });
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
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            pageDetails.push({ canvas, width: viewport.width, height: viewport.height });
          }
        }
        setPages(pageDetails);
      } catch (error) {
        console.error("Failed to load PDF:", error);
        toast({ variant: 'destructive', title: 'Error loading PDF' });
      } finally {
        setIsLoadingPdf(false);
      }
    };
    loadPdf();
  }, [pdf.downloadUrl, toast]);
  
  const addField = (type: PDFFormField['type']) => {
    const newField: PDFFormField = {
      id: `field_${Date.now()}`,
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
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const fieldToMove = fields.find(f => f.id === active.id);
    if (!fieldToMove) return;

    const pageDetail = pages[fieldToMove.pageNumber - 1];
    if (!pageDetail) return;

    const newX = fieldToMove.position.x + (delta.x / pageDetail.width) * 100;
    const newY = fieldToMove.position.y + (delta.y / pageDetail.height) * 100;

    updateField(active.id as string, {
        position: {
            x: Math.max(0, Math.min(100 - fieldToMove.dimensions.width, newX)),
            y: Math.max(0, Math.min(100 - fieldToMove.dimensions.height, newY)),
        }
    });
  };
  
  const selectedField = fields.find(f => f.id === selectedFieldId);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updatePdfFormMapping(pdf.id, fields);
    if (result.success) {
      toast({ title: 'Field mapping saved successfully!' });
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
    }
    setIsSaving(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-full">
      {/* PDF Viewer */}
      <DndContext onDragEnd={handleDragEnd}>
        <div
          ref={containerRef}
          className="md:col-span-2 lg:col-span-3 bg-muted rounded-lg border overflow-auto p-4 space-y-4 h-full"
        >
          {isLoadingPdf && <Skeleton className="w-full h-[80vh]" />}
          {!isLoadingPdf && pages.map((page, index) => (
            <div key={index} className="relative mx-auto shadow-lg" style={{ width: page.width, height: page.height }}>
              <canvas
                ref={node => {
                  if (node && !node.firstChild) {
                    node.getContext('2d')?.drawImage(page.canvas, 0, 0);
                  }
                }}
                width={page.width}
                height={page.height}
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

      {/* Controls Panel */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Toolbar</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => addField('text')}><Text className="mr-2 h-4 w-4" /> Text</Button>
            <Button variant="outline" onClick={() => addField('signature')}><Signature className="mr-2 h-4 w-4" /> Signature</Button>
            <Button variant="outline" onClick={() => addField('date')}><Calendar className="mr-2 h-4 w-4" /> Date</Button>
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
        
        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Field Map
        </Button>
      </div>
    </div>
  );
}
    
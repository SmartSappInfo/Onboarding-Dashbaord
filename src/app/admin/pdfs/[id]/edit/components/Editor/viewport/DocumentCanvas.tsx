
'use client';

import * as React from 'react';
import { 
    DndContext, 
    useSensors, 
    useSensor, 
    PointerSensor, 
    type DragEndEvent, 
    closestCenter 
} from '@dnd-kit/core';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useEditor } from '../EditorContext';
import { PageRenderer } from './PageRenderer';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useToast } from '@/hooks/use-toast';

const pdfjsPromise = import('pdfjs-dist');

export function DocumentCanvas() {
  const { pdf, fields, setFields, selectedFieldIds, setSelectedFieldIds, marquee, setMarquee, zoom } = useEditor();
  const { toast } = useToast();
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  React.useEffect(() => {
    const load = async () => {
      try {
        const pdfjs = await pdfjsPromise;
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
        const loadingTask = pdfjs.getDocument({ url: pdf.downloadUrl });
        setPdfDoc(await loadingTask.promise);
      } catch (e) {
        toast({ variant: 'destructive', title: 'Error Loading PDF' });
      }
    };
    if (pdf.downloadUrl) load();
  }, [pdf.downloadUrl, toast]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (active.data.current?.type !== 'FIELD') return;

    const movedField = fields.find(f => f.id === active.id);
    if (!movedField || !viewportRef.current) return;

    const pageEl = viewportRef.current.querySelector(`[data-page-number="${movedField.pageNumber}"]`);
    if (!pageEl) return;

    const { width, height } = pageEl.getBoundingClientRect();
    const dxPercent = (delta.x / width) * 100;
    const dyPercent = (delta.y / height) * 100;

    setFields(prev => prev.map(f => {
      if (selectedFieldIds.includes(f.id) && f.pageNumber === movedField.pageNumber) {
        return {
          ...f,
          position: {
            x: Math.max(0, Math.min(100 - f.dimensions.width, f.position.x + dxPercent)),
            y: Math.max(0, Math.min(100 - f.dimensions.height, f.position.y + dyPercent)),
          },
          isSuggestion: false
        };
      }
      return f;
    }));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-field-id]')) return;
    const r = viewportRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left + viewportRef.current!.scrollLeft;
    const y = e.clientY - r.top + viewportRef.current!.scrollTop;
    setMarquee({ startX: x, startY: y, endX: x, endY: y });
    if (!e.shiftKey && !e.metaKey) setSelectedFieldIds([]);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!marquee) return;
    const r = viewportRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left + viewportRef.current!.scrollLeft;
    const y = e.clientY - r.top + viewportRef.current!.scrollTop;
    setMarquee({ ...marquee, endX: x, endY: y });
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!marquee) return;
    const mL = Math.min(marquee.startX, marquee.endX), mT = Math.min(marquee.startY, marquee.endY), mR = Math.max(marquee.startX, marquee.endX), mB = Math.max(marquee.startY, marquee.endY);
    const newIds = e.shiftKey || e.metaKey ? [...selectedFieldIds] : [];
    
    viewportRef.current!.querySelectorAll('[data-field-id]').forEach(el => {
      const id = el.getAttribute('data-field-id')!;
      const rect = el.getBoundingClientRect(), vRect = viewportRef.current!.getBoundingClientRect();
      const fL = rect.left - vRect.left + viewportRef.current!.scrollLeft, fT = rect.top - vRect.top + viewportRef.current!.scrollTop, fR = fL + rect.width, fB = fT + rect.height;
      if (!(fL > mR || fR < mL || fT > mB || fB < mT) && !newIds.includes(id)) newIds.push(id);
    });
    
    setSelectedFieldIds(newIds);
    setMarquee(null);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <ScrollArea className="h-full w-full bg-muted/30" viewportRef={viewportRef}>
        <div 
          className="p-8 sm:p-16 pb-64 flex flex-col items-center min-w-full relative touch-pan-x touch-pan-y" 
          style={{ minWidth: 'fit-content' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => setMarquee(null)}
        >
          {!pdfDoc ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-[8.5in] h-[11in] bg-card shadow-xl rounded-lg mb-12" />
            ))
          ) : (
            Array.from({ length: pdfDoc.numPages }).map((_, i) => (
              <PageRenderer key={i} pdfDoc={pdfDoc} pageNumber={i + 1} />
            ))
          )}

          {marquee && (
            <div 
              className="absolute border border-primary bg-primary/10 pointer-events-none z-[100] rounded-sm"
              style={{
                left: Math.min(marquee.startX, marquee.endX),
                top: Math.min(marquee.startY, marquee.endY),
                width: Math.abs(marquee.endX - marquee.startX),
                height: Math.abs(marquee.endY - marquee.startY)
              }}
            />
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DndContext>
  );
}

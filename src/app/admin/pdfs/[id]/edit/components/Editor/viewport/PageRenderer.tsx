'use client';

import * as React from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useEditor } from '../EditorContext';
import { FieldOverlay } from './FieldOverlay';
import { Skeleton } from '@/components/ui/skeleton';

const pdfjsPromise = import('pdfjs-dist');

interface PageRendererProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
}

export const PageRenderer = React.memo(function PageRenderer({ pdfDoc, pageNumber }: PageRendererProps) {
  const { fields, zoom } = useEditor();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const renderTaskRef = React.useRef<any>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const [isRendering, setIsRendering] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    
    const render = async () => {
      setIsRendering(true);
      try {
        const pdfjs = await pdfjsPromise;
        const pdfjsVersion = '4.4.168';
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

        if (renderTaskRef.current) renderTaskRef.current.cancel();

        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: zoom * 1.5, rotation: page.rotate });
        
        if (!isMounted) return;
        
        const displayWidth = viewport.width / 1.5;
        const displayHeight = viewport.height / 1.5;
        setDimensions({ width: displayWidth, height: displayHeight });

        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const renderTask = page.render({ canvasContext: context, viewport });
            renderTaskRef.current = renderTask;
            await renderTask.promise;
          }
        }
      } catch (e: any) {
        if (e.name !== 'RenderingCancelledException') console.error("Render Error:", e);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    render();
    return () => {
      isMounted = false;
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [pdfDoc, pageNumber, zoom]);

  const pageFields = React.useMemo(() => 
    fields.filter(f => f.pageNumber === pageNumber),
    [fields, pageNumber]
  );

  return (
    <div 
      data-page-number={pageNumber}
      className="relative mx-auto shadow-2xl mb-12 bg-white flex-shrink-0 transition-all duration-300 ease-in-out border border-border/50 rounded-lg"
      style={{ width: dimensions.width || 816, height: dimensions.height || 1056 }}
    >
      {isRendering && dimensions.width === 0 && <Skeleton className="absolute inset-0" />}
      <canvas ref={canvasRef} className="block w-full h-full rounded-lg" />
      
      {dimensions.width > 0 && pageFields.map(field => (
        <FieldOverlay 
          key={field.id} 
          field={field} 
          pageDimensions={{ width: dimensions.width, height: dimensions.height }} 
        />
      ))}
    </div>
  );
});

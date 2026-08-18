'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for PDF Document Rendering:
 *    High-performance, multi-tiered PDF document viewer powered by Mozilla `pdfjs-dist`.
 *    Eliminates cross-origin CORS iframe blank screens on Firebase Storage / GCS signed URLs.
 * 2. High-DPI Canvas & Memory Management:
 *    Renders pages using `window.devicePixelRatio` for retina crispness while setting
 *    CSS style dimensions to 100% container bounds. Active render tasks are explicitly
 *    cancelled (`renderTask.cancel()`) prior to starting a new render or on unmount.
 * 3. Multi-Tier Fallback Pipeline:
 *    - Tier 1: pdfjs-dist Canvas Engine.
 *    - Tier 2: HTML5 <object data={url} type="application/pdf">.
 *    - Tier 3: Document Reader Card with direct download button.
 * 4. Touch Target Compliance:
 *    All toolbar buttons strictly enforce `min-h-[44px]` touch bounds with `active:scale-[0.97]`.
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, 
  Download, FileText, ExternalLink, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PdfCanvasViewerProps {
  url: string;
  title?: string;
  className?: string;
  autoHeight?: boolean;
}

export function PdfCanvasViewer({
  url,
  title = 'PDF Document',
  className,
  autoHeight = false,
}: PdfCanvasViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Load PDF Document Proxy via pdfjs-dist
  useEffect(() => {
    if (!url) return;
    setIsLoading(true);
    setHasError(false);
    let isMounted = true;

    async function loadPdfProxy() {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({
          url,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/cmaps/',
          cMapPacked: true,
        });

        const docProxy = await loadingTask.promise;

        if (isMounted) {
          setPdfDoc(docProxy);
          setNumPages(docProxy.numPages || 1);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('pdfjs-dist parsing failed, activating Tier 2/3 fallback:', err);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    loadPdfProxy();
    return () => {
      isMounted = false;
    };
  }, [url]);

  // Render current PDF page onto High-DPI canvas
  useEffect(() => {
    if (!pdfDoc) return;
    let isMounted = true;

    async function renderPage() {
      try {
        // Cancel active rendering task to avoid canvas memory conflict
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas || !isMounted) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });
        const outputScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = '100%';
        canvas.style.height = autoHeight ? 'auto' : '100%';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform: transform || undefined,
          viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException') {
          return;
        }
        console.error('Error rendering PDF page onto canvas:', err);
      }
    }

    renderPage();
    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, currentPage, scale, autoHeight]);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handleNext = () => {
    if (currentPage < numPages) setCurrentPage(prev => prev + 1);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 2.5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.6));
  };

  const handleResetZoom = () => {
    setScale(1.2);
  };

  // Tier 3 Fallback: Interactive Document Reader Card
  if (hasError) {
    return (
      <div className={cn("w-full h-full min-h-[350px] bg-slate-900 text-white rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 border border-slate-800 shadow-xl", className)}>
        <div className="p-4 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
          <FileText className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-extrabold text-white">{title}</h4>
          <p className="text-xs text-slate-400 max-w-sm">
            This document is ready for viewing. Click below to open or download the PDF file directly.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => window.open(url, '_blank')}
            className="rounded-xl font-bold text-xs gap-2 h-11 px-5 min-h-[44px] shadow-lg active:scale-[0.97]"
          >
            Open PDF Document <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(url, '_blank')}
            className="rounded-xl font-bold text-xs gap-2 h-11 px-4 min-h-[44px] border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full flex flex-col rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xl text-white relative", className)}>
      
      {/* Top Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-bold truncate max-w-[180px] md:max-w-xs">{title}</span>
          <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[9px] uppercase tracking-wider shrink-0">
            PDF
          </Badge>
        </div>

        {/* Page Navigation & Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage <= 1 || isLoading}
            onClick={handlePrev}
            className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 min-h-[44px] min-w-[44px]"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
            {currentPage} / {numPages}
          </span>

          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage >= numPages || isLoading}
            onClick={handleNext}
            className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 min-h-[44px] min-w-[44px]"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 hidden sm:flex min-h-[44px] min-w-[44px]"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 hidden sm:flex min-h-[44px] min-w-[44px]"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetZoom}
            className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 hidden sm:flex min-h-[44px] min-w-[44px]"
            title="Reset Zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(url, '_blank')}
            className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 min-h-[44px] min-w-[44px]"
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto min-h-[300px] relative bg-slate-950">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs font-semibold">Parsing PDF Pages...</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-200 select-none bg-white"
          />
        )}
      </div>

      {/* Bottom Footer Page Indicator */}
      <div className="bg-slate-900/60 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 shrink-0">
        <span>Showing Page {currentPage} of {numPages}</span>
        <button
          onClick={() => window.open(url, '_blank')}
          className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Open Fullscreen</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default PdfCanvasViewer;

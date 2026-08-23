'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Viewer & Page Scroll Controls:
 *    High-performance document viewer supporting PDF (pdfjs-dist canvas engine), Word (.doc/.docx),
 *    PowerPoint (.ppt/.pptx), and eBooks with multi-tiered fallback capabilities.
 * 2. Floating Side Chevron Buttons & Gesture Controls:
 *    Provides floating left (`ChevronLeft`) and right (`ChevronRight`) action buttons anchored on
 *    either side of the viewport, mouse wheel scroll page turning, mobile touch swipe gestures,
 *    and keyboard arrow shortcuts (`ArrowRight`/`ArrowLeft`/`PageDown`/`PageUp`).
 * 3. High-DPI Canvas & Memory Management:
 *    Renders PDF pages using `window.devicePixelRatio` for retina crispness while applying
 *    CSS transform scaling (`transform: scale(...)`, `transformOrigin: 'top center'`). Active
 *    render tasks are explicitly cancelled (`renderTask.cancel()`) on page change or unmount.
 * 4. Touch Target Compliance:
 *    All toolbar and side navigation buttons strictly enforce `min-h-[44px] min-w-[44px]` bounds.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, 
  Maximize, FileText, ExternalLink, Loader2, Presentation, FileCode 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type DocumentTypeFormat = 'pdf' | 'word' | 'powerpoint' | 'generic';

export interface PdfCanvasViewerProps {
  url: string;
  title?: string;
  className?: string;
  autoHeight?: boolean;
}

export function detectDocumentFormat(url: string, mimeType?: string): DocumentTypeFormat {
  if (!url) return 'generic';
  const cleanUrl = url.toLowerCase().split('?')[0].split('#')[0];

  if (mimeType) {
    const lowerMime = mimeType.toLowerCase();
    if (lowerMime.includes('pdf')) return 'pdf';
    if (lowerMime.includes('word') || lowerMime.includes('docx') || lowerMime.includes('msword')) return 'word';
    if (lowerMime.includes('powerpoint') || lowerMime.includes('presentation') || lowerMime.includes('pptx')) return 'powerpoint';
  }

  if (cleanUrl.endsWith('.pdf')) return 'pdf';
  if (cleanUrl.endsWith('.docx') || cleanUrl.endsWith('.doc')) return 'word';
  if (cleanUrl.endsWith('.pptx') || cleanUrl.endsWith('.ppt')) return 'powerpoint';

  return 'generic';
}

export function PdfCanvasViewer({
  url,
  title = 'Document',
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
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const docFormat = detectDocumentFormat(url);
  const lastWheelTimeRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Load PDF Document Proxy via pdfjs-dist if format is PDF
  useEffect(() => {
    if (!url) return;
    if (docFormat !== 'pdf') {
      setIsLoading(false);
      setNumPages(1);
      return;
    }

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
  }, [url, docFormat]);

  // Render current PDF page onto High-DPI canvas
  useEffect(() => {
    if (!pdfDoc || docFormat !== 'pdf') return;
    let isMounted = true;

    async function renderPage() {
      try {
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

        const viewport = page.getViewport({ scale: 1.5 });
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
  }, [pdfDoc, currentPage, autoHeight, docFormat]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const handleNext = useCallback(() => {
    if (currentPage < numPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, numPages]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) {
        handleNext();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // Mouse wheel page scroll handler (debounced 200ms)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastWheelTimeRef.current < 200) return;

    if (e.deltaY > 15) {
      if (currentPage < numPages) {
        lastWheelTimeRef.current = now;
        handleNext();
      }
    } else if (e.deltaY < -15) {
      if (currentPage > 1) {
        lastWheelTimeRef.current = now;
        handlePrev();
      }
    }
  };

  // Touch swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 40 || Math.abs(deltaY) > 50) {
      if (deltaX < -40 || deltaY < -50) {
        handleNext();
      } else if (deltaX > 40 || deltaY > 50) {
        handlePrev();
      }
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 2.2));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.6));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  const handleOpenFullscreen = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getFormatBadgeLabel = () => {
    if (docFormat === 'word') return 'WORD DOCUMENT';
    if (docFormat === 'powerpoint') return 'POWERPOINT';
    return 'PDF DOCUMENT';
  };

  const getFormatIcon = () => {
    if (docFormat === 'word') return <FileCode className="h-4 w-4 text-blue-500 shrink-0" />;
    if (docFormat === 'powerpoint') return <Presentation className="h-4 w-4 text-amber-500 shrink-0" />;
    return <FileText className="h-4 w-4 text-primary shrink-0" />;
  };

  // Office / Google Docs Viewer embed URL for Word and PowerPoint
  const getEmbedViewerUrl = () => {
    const rawUrl = url.split('?')[0];
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(rawUrl)}`;
  };

  // Fallback view for unparseable documents
  if (hasError) {
    return (
      <div className={cn("w-full h-full min-h-[350px] bg-card text-card-foreground rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 border border-border shadow-xl", className)}>
        <div className="p-4 bg-primary/10 text-primary rounded-2xl border border-primary/20">
          {getFormatIcon()}
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-extrabold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            This document is ready for viewing. Click below to open or view the file directly.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleOpenFullscreen}
            className="rounded-xl font-bold text-xs gap-2 h-11 px-5 min-h-[44px] shadow-lg active:scale-[0.97]"
          >
            Open Document <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xl text-card-foreground relative transition-colors duration-200", className)}>
      
      {/* Top Toolbar */}
      <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md z-20">
        <div className="flex items-center gap-2 min-w-0">
          {getFormatIcon()}
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-background border-border text-foreground">
            {getFormatBadgeLabel()}
          </Badge>
        </div>

        {/* Page Navigation & Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage <= 1 || isLoading}
            onClick={handlePrev}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 min-h-[44px] min-w-[44px]"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-background border border-border text-foreground shadow-sm">
            {currentPage} / {numPages}
          </span>

          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage >= numPages || isLoading}
            onClick={handleNext}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 min-h-[44px] min-w-[44px]"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent min-h-[44px] min-w-[44px]"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent min-h-[44px] min-w-[44px]"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetZoom}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent min-h-[44px] min-w-[44px]"
            title="Reset Zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenFullscreen}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent min-h-[44px] min-w-[44px]"
            title="Open Fullscreen"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Preview Viewport with Wheel & Swipe Navigation */}
      <div 
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 flex items-center justify-center p-4 overflow-auto min-h-[350px] relative bg-muted/20 select-none group"
      >
        {/* Floating Left Chevron Side Button */}
        <button
          onClick={handlePrev}
          disabled={currentPage <= 1 || isLoading}
          className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-30 h-11 w-11 md:h-12 md:w-12 rounded-full bg-background/85 hover:bg-background border border-border shadow-xl backdrop-blur-md transition-all active:scale-95 text-foreground flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:pointer-events-none min-h-[44px] min-w-[44px] shrink-0"
          title="Previous Page (Scroll Up / Swipe Right)"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Floating Right Chevron Side Button */}
        <button
          onClick={handleNext}
          disabled={currentPage >= numPages || isLoading}
          className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-30 h-11 w-11 md:h-12 md:w-12 rounded-full bg-background/85 hover:bg-background border border-border shadow-xl backdrop-blur-md transition-all active:scale-95 text-foreground flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:pointer-events-none min-h-[44px] min-w-[44px] shrink-0"
          title="Next Page (Scroll Down / Swipe Left)"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs font-semibold">Loading Document Pages...</span>
          </div>
        ) : docFormat === 'pdf' ? (
          <div 
            style={{ 
              transform: `scale(${scale})`, 
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease-out' 
            }}
            className="max-w-full flex items-center justify-center"
          >
            <canvas
              ref={canvasRef}
              className="max-h-full max-w-full object-contain rounded-xl shadow-xl select-none bg-white border border-border/40"
            />
          </div>
        ) : (
          <div className="w-full h-full min-h-[400px] relative rounded-xl overflow-hidden shadow-lg border border-border/40 bg-white">
            <iframe
              src={getEmbedViewerUrl()}
              title={title}
              className="w-full h-full border-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfCanvasViewer;

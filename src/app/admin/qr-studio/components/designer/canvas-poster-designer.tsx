'use client';

import * as React from 'react';
import {
  Type,
  Square,
  Circle,
  Minus,
  Image as ImageIcon,
  Palette,
  Move,
  ChevronDown,
  Download,
  Save,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Layers,
  Sparkles,
  LayoutTemplate,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { QRDesign, QRCodeTemplate, MediaAsset } from '@/lib/types';
import { SYSTEM_POSTER_TEMPLATES, type PosterTemplate } from '@/lib/poster-templates';
import { listQRTemplates } from '@/lib/qr-actions';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import QRPreview from '../qr-preview';

import {
  type CanvasElement,
  type CanvasState,
  newTextElement,
  newRectElement,
  newCircleElement,
  newLineElement,
  newImageElement,
  makeId,
} from './canvas-types';
import CanvasPropertiesPanel from './canvas-properties-panel';
import CanvasInteractiveElement from './canvas-interactive-element';

interface CanvasPosterDesignerProps {
  qrData: string;
  qrDesign: QRDesign;
  orgId: string;
  wsId: string;
  onPosterDataChange?: (posterData: CanvasState) => void;
  onSaveAsTemplate?: () => void;
  onDownload?: (format: 'png' | 'jpg' | 'pdf' | 'svg') => void;
}

export default function CanvasPosterDesigner({
  qrData,
  qrDesign,
  orgId,
  wsId,
  onPosterDataChange,
  onSaveAsTemplate,
}: CanvasPosterDesignerProps) {
  const { toast } = useToast();
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [showTemplates, setShowTemplates] = React.useState(true);
  const [activeTemplate, setActiveTemplate] = React.useState<string | null>(null);
  const [showMediaDialog, setShowMediaDialog] = React.useState(false);
  const [workspaceTemplates, setWorkspaceTemplates] = React.useState<QRCodeTemplate[]>([]);
  const [snapGuides, setSnapGuides] = React.useState<{ x?: number; y?: number } | null>(null);

  // History states for canvas Undo/Redo
  const [pastCanvas, setPastCanvas] = React.useState<CanvasState[]>([]);
  const [futureCanvas, setFutureCanvas] = React.useState<CanvasState[]>([]);

  // Load workspace poster templates
  React.useEffect(() => {
    listQRTemplates(orgId, wsId).then(setWorkspaceTemplates).catch(() => {});
    const reload = () => listQRTemplates(orgId, wsId).then(setWorkspaceTemplates).catch(() => {});
    window.addEventListener('qr-template-saved', reload);
    return () => window.removeEventListener('qr-template-saved', reload);
  }, [orgId, wsId]);

  const [canvas, setCanvas] = React.useState<CanvasState>(() => {
    if (qrDesign?.posterData) return qrDesign.posterData;
    return {
      width: 600,
      height: 800,
      backgroundColor: '#FFFFFF',
      elements: [
        {
          type: 'text',
          id: 'title',
          x: 10,
          y: 6,
          width: 80,
          height: 6,
          text: 'SCAN ME',
          fontSize: 28,
          fontFamily: 'Inter',
          fontWeight: '800',
          fill: '#1a1a1a',
          textAlign: 'center',
        },
        { type: 'qr', id: 'qr-code', x: 15, y: 20, width: 70, height: 52, isQR: true },
        {
          type: 'text',
          id: 'subtitle',
          x: 10,
          y: 78,
          width: 80,
          height: 5,
          text: 'Point your camera at the code above',
          fontSize: 14,
          fontFamily: 'Inter',
          fontWeight: '400',
          fill: '#666666',
          textAlign: 'center',
        },
      ],
      selectedId: null,
    };
  });

  const lastSyncedCanvasRef = React.useRef<string>(JSON.stringify(canvas));

  // Sync upward without infinite loops
  React.useEffect(() => {
    const currentStr = JSON.stringify(canvas);
    if (currentStr !== lastSyncedCanvasRef.current) {
      lastSyncedCanvasRef.current = currentStr;
      onPosterDataChange?.(canvas);
    }
  }, [canvas, onPosterDataChange]);

  const selectedElement = canvas.elements.find((el) => el.id === canvas.selectedId) || null;

  // ── History Management ──
  const pushCanvasState = React.useCallback(
    (nextCanvas: CanvasState) => {
      setPastCanvas((prev) => [...prev, canvas]);
      setFutureCanvas([]);
      setCanvas(nextCanvas);
    },
    [canvas]
  );

  const handleUndo = () => {
    if (pastCanvas.length === 0) return;
    const newPast = [...pastCanvas];
    const previous = newPast.pop()!;
    setPastCanvas(newPast);
    setFutureCanvas((prev) => [canvas, ...prev]);
    setCanvas(previous);
  };

  const handleRedo = () => {
    if (futureCanvas.length === 0) return;
    const newFuture = [...futureCanvas];
    const next = newFuture.shift()!;
    setFutureCanvas(newFuture);
    setPastCanvas((prev) => [...prev, canvas]);
    setCanvas(next);
  };

  // ── Template Application ──
  const applyTemplate = (template: PosterTemplate) => {
    pushCanvasState({
      width: template.canvasWidth,
      height: template.canvasHeight,
      backgroundColor: template.backgroundColor,
      elements: template.elements.map((el) => ({ ...el })),
      selectedId: null,
    });
    setActiveTemplate(template.id);
    setShowTemplates(false);
  };

  // ── Element CRUD ──
  const addElement = (factory: () => CanvasElement) => {
    const newEl = factory();
    pushCanvasState({ ...canvas, elements: [...canvas.elements, newEl], selectedId: newEl.id });
  };

  const handleAssetSelect = (asset: MediaAsset) => {
    setShowMediaDialog(false);
    addElement(() => newImageElement(asset.url));
  };

  const updateElement = (id: string, patch: Partial<CanvasElement>) => {
    setCanvas((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    }));
  };

  const deleteElement = (id: string) => {
    pushCanvasState({
      ...canvas,
      elements: canvas.elements.filter((el) => el.id !== id),
      selectedId: canvas.selectedId === id ? null : canvas.selectedId,
    });
  };

  const duplicateElement = (id: string) => {
    const target = canvas.elements.find((el) => el.id === id);
    if (!target || target.isQR) return;
    const duplicated: CanvasElement = {
      ...target,
      id: makeId(),
      x: Math.min(80, target.x + 4),
      y: Math.min(80, target.y + 4),
    };
    pushCanvasState({
      ...canvas,
      elements: [...canvas.elements, duplicated],
      selectedId: duplicated.id,
    });
  };

  const bringToFront = (id: string) => {
    const index = canvas.elements.findIndex((el) => el.id === id);
    if (index === -1 || index === canvas.elements.length - 1) return;
    const el = canvas.elements[index];
    const newElements = canvas.elements.filter((e) => e.id !== id);
    newElements.push(el);
    pushCanvasState({ ...canvas, elements: newElements });
  };

  const sendToBack = (id: string) => {
    const index = canvas.elements.findIndex((el) => el.id === id);
    if (index <= 0) return;
    const el = canvas.elements[index];
    const newElements = canvas.elements.filter((e) => e.id !== id);
    newElements.unshift(el);
    pushCanvasState({ ...canvas, elements: newElements });
  };

  const alignElement = (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedElement) return;
    let patch: Partial<CanvasElement> = {};
    if (direction === 'left') patch = { x: 10 };
    if (direction === 'center') patch = { x: 50 - selectedElement.width / 2 };
    if (direction === 'right') patch = { x: 90 - selectedElement.width };
    if (direction === 'top') patch = { y: 6 };
    if (direction === 'middle') patch = { y: 50 - selectedElement.height / 2 };
    if (direction === 'bottom') patch = { y: 94 - selectedElement.height };
    updateElement(selectedElement.id, patch);
  };

  // ── Keyboard Shortcuts (Guarded against text fields) ──
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvas.selectedId && selectedElement && !selectedElement.isQR) {
          e.preventDefault();
          deleteElement(canvas.selectedId);
        }
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        if (canvas.selectedId && selectedElement && !selectedElement.isQR) {
          e.preventDefault();
          duplicateElement(canvas.selectedId);
        }
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === 'y' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRedo();
      } else if (selectedElement && !selectedElement.isLocked) {
        const step = e.shiftKey ? 2.5 : 0.5;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          updateElement(selectedElement.id, { x: selectedElement.x - step });
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          updateElement(selectedElement.id, { x: selectedElement.x + step });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          updateElement(selectedElement.id, { y: selectedElement.y - step });
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          updateElement(selectedElement.id, { y: selectedElement.y + step });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas.selectedId, selectedElement, pastCanvas, futureCanvas]);

  // ── High-Res Export ──
  const handleExport = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!canvasRef.current) return;

    setCanvas((prev) => ({ ...prev, selectedId: null }));
    await new Promise((r) => setTimeout(r, 100));

    try {
      const { toPng, toJpeg } = await import('html-to-image');

      const options = {
        pixelRatio: 3,
        quality: 0.95,
        skipFonts: false,
      };

      const dataUrl =
        format === 'jpg'
          ? await toJpeg(canvasRef.current, options)
          : await toPng(canvasRef.current, options);

      if (format === 'png' || format === 'jpg') {
        const link = document.createElement('a');
        link.download = `qr-poster-${Date.now()}.${format}`;
        link.href = dataUrl;
        link.click();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`qr-poster-${Date.now()}.pdf`);
      }
      toast({ title: 'Export Complete! 🎨', description: `Poster saved as high-resolution ${format.toUpperCase()}.` });
    } catch (err) {
      console.error('Export failed:', err);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not generate poster.' });
    }
  };

  // ── Template Gallery Overlay ──
  if (showTemplates) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Poster Canvas Presets</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a curated template, or start blank to build custom flyers and tent signs.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(false)} className="rounded-xl text-xs font-semibold active:scale-[0.97]">
            Start Blank Canvas
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-6 pr-1">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-1 mb-3">
              Official Presets ({SYSTEM_POSTER_TEMPLATES.length})
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {SYSTEM_POSTER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="group text-left p-3 border border-border rounded-2xl bg-card hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.97]"
                >
                  <div
                    className="w-full aspect-[3/4] rounded-xl overflow-hidden mb-3 relative flex items-center justify-center border border-border/40 shadow-inner"
                    style={{ backgroundColor: tpl.backgroundColor }}
                  >
                    <div className="h-16 w-16 bg-white/90 rounded-lg p-1.5 shadow flex items-center justify-center border border-border/40">
                      <div className="h-full w-full bg-zinc-900 rounded-sm" />
                    </div>
                  </div>
                  <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{tpl.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{tpl.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-card border border-border shadow-sm">
        {/* Insert Elements */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addElement(newTextElement)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold"
          >
            <Type className="h-3.5 w-3.5 mr-1 text-primary" /> Text
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addElement(newRectElement)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold"
          >
            <Square className="h-3.5 w-3.5 mr-1 text-blue-500" /> Box
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addElement(newCircleElement)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold"
          >
            <Circle className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Circle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addElement(newLineElement)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold"
          >
            <Minus className="h-3.5 w-3.5 mr-1 text-amber-500" /> Line
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMediaDialog(true)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold"
          >
            <ImageIcon className="h-3.5 w-3.5 mr-1 text-purple-500" /> Image
          </Button>
        </div>

        {/* Alignment & Action Controls */}
        <div className="flex items-center gap-1.5">
          {selectedElement && (
            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border border-border/60">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => alignElement('left')}
                className="h-7 w-7 rounded"
                title="Align Left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => alignElement('center')}
                className="h-7 w-7 rounded"
                title="Align Center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => alignElement('right')}
                className="h-7 w-7 rounded"
                title="Align Right"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => alignElement('middle')}
                className="h-7 w-7 rounded"
                title="Align Middle"
              >
                <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates(true)}
            className="h-8 rounded-xl text-xs font-semibold"
          >
            <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" /> Templates
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 rounded-xl text-xs font-semibold active:scale-[0.97]">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-44">
              <DropdownMenuItem onClick={() => handleExport('png')} className="text-xs font-medium cursor-pointer">
                PNG (Ultra-HD Image)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('jpg')} className="text-xs font-medium cursor-pointer">
                JPEG (High Quality)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs font-medium cursor-pointer">
                PDF (Print Ready 300 DPI)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Designer Canvas & Properties Panel */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Canvas Center Stage */}
        <div className="flex-1 w-full flex items-center justify-center p-6 rounded-3xl bg-muted/20 border border-border min-h-[550px] overflow-auto">
          <div
            ref={canvasRef}
            className="canvas-container relative shadow-2xl rounded-2xl overflow-hidden select-none transition-all"
            style={{
              width: `${canvas.width}px`,
              height: `${canvas.height}px`,
              backgroundColor: canvas.backgroundColor,
              maxWidth: '100%',
              aspectRatio: `${canvas.width} / ${canvas.height}`,
            }}
            onClick={() => setCanvas((prev) => ({ ...prev, selectedId: null }))}
          >
            {/* Visual Snap Alignment Guidelines */}
            {snapGuides?.x !== undefined && (
              <div
                className="absolute top-0 bottom-0 w-[1.5px] bg-cyan-500 z-50 pointer-events-none shadow-[0_0_4px_rgba(6,182,212,0.8)]"
                style={{ left: `${snapGuides.x}%` }}
              />
            )}
            {snapGuides?.y !== undefined && (
              <div
                className="absolute left-0 right-0 h-[1.5px] bg-fuchsia-500 z-50 pointer-events-none shadow-[0_0_4px_rgba(217,70,239,0.8)]"
                style={{ top: `${snapGuides.y}%` }}
              />
            )}

            {/* Elements Layer Stack */}
            {canvas.elements.map((el) => {
              const isSelected = canvas.selectedId === el.id;

              return (
                <CanvasInteractiveElement
                  key={el.id}
                  element={el}
                  isSelected={isSelected}
                  scaleFactor={1}
                  onSelect={() => setCanvas((prev) => ({ ...prev, selectedId: el.id }))}
                  onUpdate={(patch) => updateElement(el.id, patch)}
                  onSnapGuide={setSnapGuides}
                >
                  {el.isQR ? (
                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                      <QRPreview data={qrData} design={qrDesign} size={Math.min(canvas.width * (el.width / 100), 400)} showFrame={false} />
                    </div>
                  ) : el.type === 'text' ? (
                    <div
                      className="w-full h-full flex items-center overflow-hidden break-words whitespace-pre-wrap leading-tight"
                      style={{
                        fontFamily: el.fontFamily || 'Inter',
                        fontSize: `${el.fontSize || 16}px`,
                        fontWeight: el.fontWeight || '400',
                        color: el.fill || '#1a1a1a',
                        justifyContent:
                          el.textAlign === 'center'
                            ? 'center'
                            : el.textAlign === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                        textAlign: (el.textAlign as 'left' | 'center' | 'right') || 'left',
                      }}
                    >
                      {el.text}
                    </div>
                  ) : el.type === 'rect' ? (
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundColor: el.shapeFill || '#e0e0e0',
                        borderRadius: `${el.borderRadius || 0}px`,
                        opacity: el.opacity ?? 1,
                      }}
                    />
                  ) : el.type === 'circle' ? (
                    <div
                      className="w-full h-full rounded-full"
                      style={{
                        backgroundColor: el.shapeFill || '#d0d0d0',
                        opacity: el.opacity ?? 1,
                      }}
                    />
                  ) : el.type === 'line' ? (
                    <div className="w-full h-full flex items-center">
                      <div
                        className="w-full"
                        style={{
                          height: `${el.lineWidth || 2}px`,
                          backgroundColor: el.lineColor || '#999999',
                        }}
                      />
                    </div>
                  ) : el.type === 'image' && el.imageSrc ? (
                    <img
                      src={el.imageSrc}
                      alt="Canvas Layer"
                      className="w-full h-full object-cover rounded"
                      style={{
                        borderRadius: `${el.borderRadius || 0}px`,
                        opacity: el.opacity ?? 1,
                      }}
                    />
                  ) : null}
                </CanvasInteractiveElement>
              );
            })}
          </div>
        </div>

        {/* Properties Panel (Right sidebar) */}
        <CanvasPropertiesPanel
          canvas={canvas}
          selectedElement={selectedElement}
          onCanvasChange={(patch) => setCanvas((prev) => ({ ...prev, ...patch }))}
          onElementUpdate={updateElement}
          onElementDelete={deleteElement}
          onDuplicateElement={duplicateElement}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
        />
      </div>

      {/* Media Selector Dialog for uploading canvas assets */}
      <MediaSelectorDialog
        open={showMediaDialog}
        onOpenChange={setShowMediaDialog}
        onSelectAsset={handleAssetSelect}
      />
    </div>
  );
}

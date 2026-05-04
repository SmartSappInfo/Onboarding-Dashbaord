'use client';

import * as React from 'react';
import { Type, Square, Circle, Minus, Image as ImageIcon, Palette, Download, Move, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { QRDesign, MediaAsset } from '@/lib/types';
import { SYSTEM_POSTER_TEMPLATES, type PosterTemplate } from '@/lib/poster-templates';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import QRPreview from '../qr-preview';

import { 
  type CanvasElement, 
  type CanvasState, 
  newTextElement, 
  newRectElement, 
  newCircleElement, 
  newLineElement, 
  newImageElement 
} from './canvas-types';
import CanvasPropertiesPanel from './canvas-properties-panel';
import CanvasInteractiveElement from './canvas-interactive-element';

interface CanvasPosterDesignerProps {
  qrData: string;
  qrDesign: QRDesign;
  orgId: string;
  wsId: string;
  onPosterDataChange?: (posterData: CanvasState) => void;
}

export default function CanvasPosterDesigner({ qrData, qrDesign, orgId, wsId, onPosterDataChange }: CanvasPosterDesignerProps) {
  const { toast } = useToast();
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [showTemplates, setShowTemplates] = React.useState(true);
  const [activeTemplate, setActiveTemplate] = React.useState<string | null>(null);
  const [showMediaDialog, setShowMediaDialog] = React.useState(false);
  const [lastInsertType, setLastInsertType] = React.useState<'text' | 'rect' | 'circle' | 'line' | 'image'>('text');
  const [editingElementId, setEditingElementId] = React.useState<string | null>(null);

  const [canvas, setCanvas] = React.useState<CanvasState>(() => {
    if (qrDesign.posterData) return qrDesign.posterData;
    return {
      width: 600,
      height: 800,
      backgroundColor: '#FFFFFF',
      elements: [
        { type: 'text', id: 'title', x: 10, y: 6, width: 80, height: 6, text: 'SCAN ME', fontSize: 28, fontFamily: 'Inter', fontWeight: '800', fill: '#1a1a1a', textAlign: 'center' },
        { type: 'qr', id: 'qr-code', x: 15, y: 20, width: 70, height: 52, isQR: true },
        { type: 'text', id: 'subtitle', x: 10, y: 78, width: 80, height: 5, text: 'Point your camera at the code above', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', fill: '#666666', textAlign: 'center' },
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

  const selectedElement = canvas.elements.find(el => el.id === canvas.selectedId) || null;

  // ── Template Application ──
  const applyTemplate = (template: PosterTemplate) => {
    setCanvas({
      width: template.canvasWidth,
      height: template.canvasHeight,
      backgroundColor: template.backgroundColor,
      elements: template.elements.map(el => ({ ...el })),
      selectedId: null,
    });
    setActiveTemplate(template.id);
    setShowTemplates(false);
  };

  // ── Element CRUD ──
  const addElement = (factory: () => CanvasElement) => {
    const newEl = factory();
    setCanvas(prev => ({ ...prev, elements: [...prev.elements, newEl], selectedId: newEl.id }));
    setLastInsertType(newEl.type as any);
  };

  const handleAssetSelect = (asset: MediaAsset) => {
    setShowMediaDialog(false);
    addElement(() => newImageElement(asset.url));
  };

  const updateElement = (id: string, patch: Partial<CanvasElement>) => {
    setCanvas(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...patch } : el),
    }));
  };

  const deleteElement = (id: string) => {
    setCanvas(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id),
      selectedId: prev.selectedId === id ? null : prev.selectedId,
    }));
  };

  const handleCanvasChange = (patch: Partial<CanvasState>) => {
    setCanvas(prev => ({ ...prev, ...patch }));
  };

  // ── Export ──
  const handleExport = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!canvasRef.current) return;
    
    // Deselect before export
    setCanvas(prev => ({ ...prev, selectedId: null }));
    
    // Wait for state to apply
    await new Promise(r => setTimeout(r, 100));

    try {
      const { toPng, toJpeg } = await import('html-to-image');
      
      const options = {
        pixelRatio: 3,
        quality: 0.95,
        fontEmbedCSS: '', // Try to let html-to-image fetch or use injected styles
        skipFonts: false,
      };

      const dataUrl = format === 'jpg' 
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
          format: [canvas.width, canvas.height] 
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`qr-poster-${Date.now()}.pdf`);
      }
      toast({ title: 'Exported!', description: `Poster saved as ${format.toUpperCase()}.` });
    } catch (err) {
      console.error('Export failed:', err);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not generate poster.' });
    }
  };

  // ── Template Gallery ──
  if (showTemplates) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Choose a Poster Template</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Pick a starting point, then customize everything.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(false)} className="rounded-xl text-xs">
            Start Blank
          </Button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SYSTEM_POSTER_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl)}
              className="group text-left p-3 border border-border rounded-2xl bg-card hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div
                className="w-full aspect-[3/4] rounded-xl overflow-hidden mb-3 relative"
                style={{ backgroundColor: tpl.backgroundColor }}
              >
                {tpl.elements.filter(el => el.type === 'text').slice(0, 2).map(el => (
                  <div
                    key={el.id}
                    className="absolute truncate"
                    style={{
                      left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`,
                      fontSize: `${Math.max(6, (el.fontSize || 14) * 0.35)}px`,
                      fontWeight: el.fontWeight, color: el.fill, textAlign: el.textAlign as any,
                      fontFamily: el.fontFamily, fontStyle: el.fontStyle,
                    }}
                  >
                    {el.text?.split('\n')[0]}
                  </div>
                ))}
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <div className="w-[40%] aspect-square bg-black/10 rounded-lg" />
                </div>
              </div>
              <p className="text-xs font-bold text-foreground truncate">{tpl.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Main Editor ──
  // Calculate scale factor so the canvas fits in our max width (e.g., 500px)
  const MAX_CANVAS_WIDTH = 500;
  const scaleFactor = Math.min(1, MAX_CANVAS_WIDTH / canvas.width);
  const displayWidth = canvas.width * scaleFactor;
  const displayHeight = canvas.height * scaleFactor;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-muted/20">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (lastInsertType === 'image') setShowMediaDialog(true);
              else if (lastInsertType === 'text') addElement(newTextElement);
              else if (lastInsertType === 'rect') addElement(newRectElement);
              else if (lastInsertType === 'circle') addElement(newCircleElement);
              else if (lastInsertType === 'line') addElement(newLineElement);
            }} 
            className="rounded-r-none h-8 text-xs border-r-0"
          >
            {lastInsertType === 'text' && <Type className="h-3.5 w-3.5 mr-1.5" />}
            {lastInsertType === 'rect' && <Square className="h-3.5 w-3.5 mr-1.5" />}
            {lastInsertType === 'circle' && <Circle className="h-3.5 w-3.5 mr-1.5" />}
            {lastInsertType === 'line' && <Minus className="h-3.5 w-3.5 mr-1.5" />}
            {lastInsertType === 'image' && <ImageIcon className="h-3.5 w-3.5 mr-1.5" />}
            <span className="capitalize">{lastInsertType}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-l-none h-8 px-2">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => { setLastInsertType('text'); addElement(newTextElement); }} className="text-xs">
                <Type className="h-3.5 w-3.5 mr-2" /> Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setLastInsertType('rect'); addElement(newRectElement); }} className="text-xs">
                <Square className="h-3.5 w-3.5 mr-2" /> Rectangle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setLastInsertType('circle'); addElement(newCircleElement); }} className="text-xs">
                <Circle className="h-3.5 w-3.5 mr-2" /> Circle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setLastInsertType('line'); addElement(newLineElement); }} className="text-xs">
                <Minus className="h-3.5 w-3.5 mr-2" /> Line
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setLastInsertType('image'); setShowMediaDialog(true); }} className="text-xs">
                <ImageIcon className="h-3.5 w-3.5 mr-2" /> Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="h-5 w-px bg-border mx-1" />
        <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)} className="rounded-lg h-8 text-xs">
          <Palette className="h-3.5 w-3.5 mr-1.5" /> Templates
        </Button>
        
        <div className="flex-1" />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="rounded-lg h-8 text-xs shadow-lg shadow-primary/20">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('png')} className="text-xs font-medium">Download PNG</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('jpg')} className="text-xs font-medium">Download JPG</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs font-medium">Download PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex gap-4">
        {/* Canvas Area */}
        <div 
          className="flex-1 flex justify-center bg-muted/10 rounded-2xl border border-dashed border-border p-4 overflow-hidden"
          onClick={() => { setCanvas(prev => ({ ...prev, selectedId: null })); setEditingElementId(null); }}
        >
          <div
            ref={canvasRef}
            className="canvas-container relative shadow-xl shrink-0"
            style={{
              width: displayWidth,
              height: displayHeight,
              backgroundColor: canvas.backgroundColor,
              overflow: 'hidden',
            }}
          >
            {/* Embed Google Fonts to ensure html-to-image captures them properly */}
            <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&family=Georgia&family=Courier+New&family=Arial&display=swap');` }} />
            
            {canvas.elements.map(el => {
              const isSelected = canvas.selectedId === el.id;

              return (
                <CanvasInteractiveElement
                  key={el.id}
                  element={el}
                  isSelected={isSelected}
                  scaleFactor={scaleFactor}
                  onSelect={(e) => { e.stopPropagation(); setCanvas(prev => ({ ...prev, selectedId: el.id })); }}
                  onUpdate={(patch) => updateElement(el.id, patch)}
                >
                  {/* Element Content rendered exactly at 100% of the interactive wrapper */}
                  {el.isQR && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="bg-white rounded-lg p-1">
                        <QRPreview data={qrData} design={qrDesign} size={Math.round((el.width / 100) * canvas.width * scaleFactor)} />
                      </div>
                    </div>
                  )}

                  {el.type === 'rect' && (
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundColor: el.shapeFill || '#e0e0e0',
                        border: el.shapeStroke ? `${el.shapeStrokeWidth || 1}px solid ${el.shapeStroke}` : 'none',
                        opacity: el.opacity ?? 1,
                        borderRadius: el.borderRadius ? `${el.borderRadius * scaleFactor}px` : 0,
                      }}
                    />
                  )}

                  {el.type === 'circle' && (
                    <div
                      className="w-full h-full rounded-full"
                      style={{
                        backgroundColor: el.shapeFill || '#d0d0d0',
                        border: el.shapeStroke ? `${el.shapeStrokeWidth || 1}px solid ${el.shapeStroke}` : 'none',
                        opacity: el.opacity ?? 1,
                      }}
                    />
                  )}

                  {el.type === 'line' && (
                    <div className="w-full h-full flex items-center">
                      <div 
                        className="w-full" 
                        style={{ 
                          height: `${el.lineWidth || 2}px`, 
                          backgroundColor: el.lineColor || '#999' 
                        }} 
                      />
                    </div>
                  )}

                  {el.type === 'image' && el.imageSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={el.imageSrc}
                      alt="Canvas Element"
                      className="w-full h-full object-cover"
                      style={{
                        opacity: el.opacity ?? 1,
                        borderRadius: el.borderRadius ? `${el.borderRadius * scaleFactor}px` : 0,
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {el.type === 'text' && !el.isQR && (
                    editingElementId === el.id ? (
                      <textarea
                        value={el.text || ''}
                        onChange={(e) => updateElement(el.id, { text: e.target.value })}
                        onBlur={() => setEditingElementId(null)}
                        onMouseDown={(e) => e.stopPropagation()}
                        autoFocus
                        className="w-full h-full bg-transparent border-none outline-none resize-none p-0 m-0"
                        style={{
                          fontSize: `${(el.fontSize || 14) * scaleFactor}px`,
                          fontFamily: el.fontFamily || 'Inter',
                          fontWeight: el.fontWeight || '400',
                          fontStyle: el.fontStyle || 'normal',
                          color: el.fill || '#000',
                          textAlign: (el.textAlign as any) || 'left',
                          lineHeight: 1.2,
                        }}
                      />
                    ) : (
                      <div
                        onDoubleClick={() => setEditingElementId(el.id)}
                        className="w-full h-full flex flex-col justify-center cursor-text"
                        style={{
                          fontSize: `${(el.fontSize || 14) * scaleFactor}px`,
                          fontFamily: el.fontFamily || 'Inter',
                          fontWeight: el.fontWeight || '400',
                          fontStyle: el.fontStyle || 'normal',
                          color: el.fill || '#000',
                          textAlign: (el.textAlign as any) || 'left',
                          lineHeight: 1.2,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {el.text}
                      </div>
                    )
                  )}
                </CanvasInteractiveElement>
              );
            })}
          </div>
        </div>

        {/* Properties Panel */}
        <CanvasPropertiesPanel
          canvas={canvas}
          selectedElement={selectedElement}
          onCanvasChange={handleCanvasChange}
          onElementUpdate={updateElement}
          onElementDelete={deleteElement}
        />
      </div>
      
      <MediaSelectorDialog
        open={showMediaDialog}
        onOpenChange={setShowMediaDialog}
        onSelectAsset={handleAssetSelect}
        filterType="image"
        title="Select Poster Image"
      />
    </div>
  );
}

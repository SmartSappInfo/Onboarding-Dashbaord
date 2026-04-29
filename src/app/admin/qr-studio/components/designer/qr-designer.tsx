'use client';

import * as React from 'react';
import { Palette, Grid3X3, Image, Frame, Settings2, Shield, LayoutTemplate, PenTool, QrCode, Save, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Undo2, Redo2 } from 'lucide-react';
import { saveQRTemplate } from '@/lib/qr-actions';
import type { QRDesign } from '@/lib/types';
import QRPreview from '../qr-preview';
import ColorControls from './color-controls';
import PatternControls from './pattern-controls';
import LogoControls from './logo-controls';
import FrameControls from './frame-controls';
import AdvancedControls from './advanced-controls';
import ScannabilityChecker from './scannability-checker';
import TemplateControls from './template-controls';

// Lazy load the poster designer to keep the simple mode fast
const CanvasPosterDesigner = React.lazy(() => import('./canvas-poster-designer'));

interface QRDesignerProps {
  data: string;
  design: QRDesign;
  onDesignChange: (design: QRDesign) => void;
  orgId?: string;
  wsId?: string;
  className?: string;
}

/**
 * Full QR code designer with live preview and design controls.
 * Supports two modes:
 * - Simple: 3-column layout (controls | preview | scannability)
 * - Advanced (Poster): Full canvas-based poster/flyer designer
 */
export default function QRDesigner({ data, design, onDesignChange, orgId, wsId, className }: QRDesignerProps) {
  const [mode, setMode] = React.useState<'simple' | 'advanced'>('simple');
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  const [past, setPast] = React.useState<QRDesign[]>([]);
  const [future, setFuture] = React.useState<QRDesign[]>([]);
  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
  const [templateName, setTemplateName] = React.useState('');

  const updateDesign = React.useCallback(
    (patch: Partial<QRDesign>) => {
      // Clean up gradient if a solid color template is applied
      if (patch && 'gradient' in patch && patch.gradient === undefined) {
        delete patch.gradient; // It's safer to leave it or let qr-preview handle it via our recent fix
      }
      setPast(prev => [...prev, design]);
      setFuture([]); // clear future on new action
      onDesignChange({ ...design, ...patch });
    },
    [design, onDesignChange]
  );

  const handleUndo = () => {
    if (past.length === 0) return;
    const newPast = [...past];
    const previous = newPast.pop()!;
    setPast(newPast);
    setFuture(prev => [design, ...prev]);
    onDesignChange(previous);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const newFuture = [...future];
    const next = newFuture.shift()!;
    setFuture(newFuture);
    setPast(prev => [...prev, design]);
    onDesignChange(next);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !orgId || !wsId) return;
    setIsSaving(true);
    try {
      await saveQRTemplate(orgId, wsId, { 
        name: templateName, 
        category: 'Saved from QR Designer', 
        design, 
        createdBy: 'system' 
      });
      toast({ title: 'Template Saved!', description: 'Your design has been added to My Templates.' });
      window.dispatchEvent(new CustomEvent('qr-template-saved'));
      setSaveModalOpen(false);
      setTemplateName('');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save', description: 'Could not save the template.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={className || ''}>
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 mb-5 p-1 bg-muted/30 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode('simple')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            mode === 'simple'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <QrCode className="h-3.5 w-3.5" />
          Simple
        </button>
        <button
          type="button"
          onClick={() => setMode('advanced')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            mode === 'advanced'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PenTool className="h-3.5 w-3.5" />
          Advanced (Poster)
        </button>
      </div>

      {/* Undo/Redo Toolbar (Simple Mode Only) */}
      {mode === 'simple' && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handleUndo} disabled={past.length === 0} className="rounded-xl h-8 text-xs font-semibold">
            <Undo2 className="h-3.5 w-3.5 mr-2" />
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={handleRedo} disabled={future.length === 0} className="rounded-xl h-8 text-xs font-semibold">
            <Redo2 className="h-3.5 w-3.5 mr-2" />
            Redo
          </Button>
        </div>
      )}

      {/* Advanced Mode: Canvas Poster Designer */}
      {mode === 'advanced' && orgId && wsId && (
        <React.Suspense fallback={
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            <div className="text-center space-y-2">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold">Loading poster designer...</p>
            </div>
          </div>
        }>
          <CanvasPosterDesigner
            qrData={data}
            qrDesign={design}
            orgId={orgId}
            wsId={wsId}
            onPosterDataChange={(posterData) => updateDesign({ posterData })}
          />
        </React.Suspense>
      )}

      {/* Simple Mode: Standard QR Designer */}
      {mode === 'simple' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Left: Design Controls */}
          <div className="space-y-4 order-2 lg:order-1">
            <Accordion type="multiple" defaultValue={['colors', 'patterns']} className="space-y-2">
              {orgId && wsId && (
                <AccordionItem value="templates" className="border border-border rounded-xl overflow-hidden bg-card">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-sm font-semibold">
                    <div className="flex items-center gap-2.5">
                      <LayoutTemplate className="h-4 w-4 text-blue-500" />
                      Templates
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 bg-muted/5">
                    <TemplateControls orgId={orgId} wsId={wsId} updateDesign={updateDesign} />
                  </AccordionContent>
                </AccordionItem>
              )}

              <AccordionItem value="colors" className="border border-border rounded-xl overflow-hidden bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-sm font-semibold">
                  <div className="flex items-center gap-2.5">
                    <Palette className="h-4 w-4 text-primary" />
                    Colors
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ColorControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="patterns" className="border border-border rounded-xl overflow-hidden bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-sm font-semibold">
                  <div className="flex items-center gap-2.5">
                    <Grid3X3 className="h-4 w-4 text-violet-500" />
                    Patterns
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <PatternControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="logo" className="border border-border rounded-xl overflow-hidden bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-sm font-semibold">
                  <div className="flex items-center gap-2.5">
                    <Image className="h-4 w-4 text-amber-500" />
                    Logo
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <LogoControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="frame" className="border border-border rounded-xl overflow-hidden bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-sm font-semibold">
                  <div className="flex items-center gap-2.5">
                    <Frame className="h-4 w-4 text-emerald-500" />
                    Frame & CTA
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <FrameControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="advanced" className="border border-border rounded-xl overflow-hidden bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-sm font-semibold">
                  <div className="flex items-center gap-2.5">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    Advanced
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <AdvancedControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {/* Mobile/Tablet Scannability Tracker (shown under controls) */}
            <div className="lg:hidden p-4 rounded-xl border border-border bg-card space-y-3 mt-6">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold text-foreground">Scannability</p>
              </div>
              <ScannabilityChecker design={design} />
            </div>
          </div>

          {/* Right: Live Preview & Settings */}
          <div className="order-1 lg:order-2 flex flex-col gap-6 w-full max-w-sm mx-auto lg:max-w-none">
            <div className="sticky top-6 flex flex-col items-center">
              
              {/* Top Banner CTA */}
              {design.frameStyle === 'banner-top' && design.frameText && (
                <div
                  className="text-center py-2 px-4 font-bold text-sm rounded-t-2xl w-full max-w-[320px]"
                  style={{
                    backgroundColor: design.frameColor || design.foregroundColor || '#000',
                    color: design.backgroundColor || '#fff',
                  }}
                >
                  {design.frameText}
                </div>
              )}

              {/* QR Code Canvas Container */}
              <div className={`p-8 bg-white shadow-lg border border-border/50 w-full max-w-[320px] flex justify-center ${
                design.frameStyle === 'banner-top' ? 'rounded-b-2xl' :
                (design.frameStyle === 'banner-bottom' || design.frameStyle === 'rounded-bottom') ? 'rounded-t-2xl' :
                'rounded-2xl'
              }`}>
                <QRPreview data={data} design={design} size={Math.min(design.size || 300, 260)} />
              </div>

              {/* Bottom Banner/Pill CTA */}
              {design.frameStyle && design.frameStyle !== 'none' && design.frameStyle !== 'banner-top' && design.frameText && (
                <div
                  className={`mt-0 text-center py-2 px-4 font-bold text-sm w-full max-w-[320px] ${
                    design.frameStyle === 'pill' ? 'rounded-full mt-3' : 'rounded-b-2xl'
                  }`}
                  style={{
                    backgroundColor: design.frameColor || design.foregroundColor || '#000',
                    color: design.backgroundColor || '#fff',
                  }}
                >
                  {design.frameText}
                </div>
              )}

              {/* Controls below preview */}
              <div className="mt-5 flex flex-col items-center gap-3 w-full max-w-[320px]">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl font-semibold"
                    onClick={() => setSaveModalOpen(true)}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as Template
                  </Button>
              </div>

              {/* Desktop Scannability Tracker (shown under preview) */}
              <div className="hidden lg:block w-full mt-8 max-w-[320px]">
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <p className="text-sm font-bold text-foreground">Scannability</p>
                  </div>
                  <ScannabilityChecker design={design} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="rounded-2xl border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Template</DialogTitle>
            <DialogDescription>
              Name this design to save it to your workspace templates.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Summer Campaign Flyer"
              className="rounded-xl h-10 font-medium"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && templateName.trim()) {
                  handleSaveTemplate();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveModalOpen(false)} className="rounded-xl font-semibold">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTemplate} 
              disabled={isSaving || !templateName.trim()} 
              className="rounded-xl font-bold"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

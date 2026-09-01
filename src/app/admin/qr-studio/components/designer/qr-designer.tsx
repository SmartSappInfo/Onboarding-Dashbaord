'use client';

import * as React from 'react';
import { Palette, Grid3X3, Image, Frame, Settings2, LayoutTemplate, PenTool, QrCode, Save, Sparkles, Undo2, Redo2, ShieldCheck } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { saveQRTemplate } from '@/lib/qr-actions';
import type { QRDesign } from '@/lib/types';
import QRPreview from '../qr-preview';
import ColorControls from './color-controls';
import PatternControls from './pattern-controls';
import LogoControls from './logo-controls';
import FrameControls from './frame-controls';
import AdvancedControls from './advanced-controls';
import ScannabilityChecker, { computeScannabilityScore } from './scannability-checker';
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
 * Full QR code designer with live preview, brand kit integration,
 * scannability diagnostics, and canvas poster engine.
 */
export default function QRDesigner({ data, design, onDesignChange, orgId, wsId, className }: QRDesignerProps) {
  const [mode, setMode] = React.useState<'simple' | 'advanced'>('simple');
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  const { activeOrganization } = useTenant();

  const [past, setPast] = React.useState<QRDesign[]>([]);
  const [future, setFuture] = React.useState<QRDesign[]>([]);
  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
  const [templateName, setTemplateName] = React.useState('');

  const scoreData = React.useMemo(() => computeScannabilityScore(design), [design]);

  const updateDesign = React.useCallback(
    (patch: Partial<QRDesign>) => {
      if (patch && 'gradient' in patch && patch.gradient === undefined) {
        delete patch.gradient;
      }
      setPast((prev) => [...prev, design]);
      setFuture([]);
      onDesignChange({ ...design, ...patch });
    },
    [design, onDesignChange]
  );

  const handleUndo = () => {
    if (past.length === 0) return;
    const newPast = [...past];
    const previous = newPast.pop()!;
    setPast(newPast);
    setFuture((prev) => [design, ...prev]);
    onDesignChange(previous);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const newFuture = [...future];
    const next = newFuture.shift()!;
    setFuture(newFuture);
    setPast((prev) => [...prev, design]);
    onDesignChange(next);
  };

  /**
   * Applies the organization's primary color, secondary color, and logo to the QR design.
   */
  const handleApplyBrandKit = () => {
    if (!activeOrganization) {
      toast({
        title: 'No Brand Profile Found',
        description: 'Configure your organization branding in Organization Settings.',
      });
      return;
    }

    const brandPrimary = activeOrganization.brandPrimaryColor || '#2563eb';
    const brandLogo = activeOrganization.logoUrl || undefined;

    updateDesign({
      foregroundColor: brandPrimary,
      backgroundColor: '#FFFFFF',
      cornerSquareColor: brandPrimary,
      cornerDotColor: brandPrimary,
      frameColor: brandPrimary,
      frameTextColor: '#FFFFFF',
      logoUrl: brandLogo,
      logoSize: 20,
      logoMargin: 6,
      errorCorrection: brandLogo ? 'H' : design.errorCorrection,
    });

    toast({
      title: 'Workspace Brand Applied! ✨',
      description: `Applied ${activeOrganization.name}'s official brand theme and logo.`,
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !orgId || !wsId) return;
    setIsSaving(true);
    try {
      await saveQRTemplate(orgId, wsId, {
        name: templateName,
        category: 'Saved from QR Designer',
        design,
        createdBy: 'system',
      });
      toast({ title: 'Template Saved!', description: 'Your design has been added to My Templates.' });
      window.dispatchEvent(new CustomEvent('qr-template-saved'));
      setSaveModalOpen(false);
      setTemplateName('');
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save', description: 'Could not save the template.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={className || ''}>
      {/* Mode Toggle & Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] ${
              mode === 'simple'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            Simple QR
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] ${
              mode === 'advanced'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            Poster Canvas
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Real-time Scannability Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono transition-all ${scoreData.bgClass}`}
            title={`Scannability: ${scoreData.score}% (${scoreData.label})`}
          >
            <ShieldCheck className={`h-3.5 w-3.5 ${scoreData.colorClass}`} />
            <span className={scoreData.colorClass}>
              {scoreData.grade} ({scoreData.score}%)
            </span>
          </div>

          {/* One-Click Brand Kit Apply */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyBrandKit}
            className="rounded-xl h-8 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.97]"
            title="Apply workspace colors and logo"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
            Apply Brand
          </Button>

          {/* Undo/Redo */}
          {mode === 'simple' && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={past.length === 0}
                className="rounded-xl h-8 w-8 p-0"
                title="Undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={future.length === 0}
                className="rounded-xl h-8 w-8 p-0"
                title="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {orgId && wsId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveModalOpen(true)}
              className="rounded-xl h-8 text-xs font-semibold active:scale-[0.97]"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Preset
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Mode: Canvas Poster Designer */}
      {mode === 'advanced' && orgId && wsId && (
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center h-[500px] text-muted-foreground border border-border/60 rounded-2xl bg-card">
              <div className="text-center space-y-2">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-semibold">Loading poster canvas engine...</p>
              </div>
            </div>
          }
        >
          <CanvasPosterDesigner
            qrData={data}
            qrDesign={design}
            orgId={orgId}
            wsId={wsId}
            onPosterDataChange={(posterData) => updateDesign({ posterData })}
            onSaveAsTemplate={() => setSaveModalOpen(true)}
          />
        </React.Suspense>
      )}

      {/* Simple Mode: Standard QR Designer */}
      {mode === 'simple' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Left: Design Controls */}
          <div className="space-y-4 order-2 lg:order-1">
            <Accordion type="multiple" defaultValue={['colors', 'patterns', 'frame']} className="space-y-2.5">
              {orgId && wsId && (
                <AccordionItem value="templates" className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2.5">
                      <LayoutTemplate className="h-4 w-4 text-blue-500" />
                      Templates & Presets
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 bg-muted/5">
                    <TemplateControls orgId={orgId} wsId={wsId} currentDesign={design} updateDesign={updateDesign} />
                  </AccordionContent>
                </AccordionItem>
              )}

              <AccordionItem value="colors" className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2.5">
                    <Palette className="h-4 w-4 text-primary" />
                    Colors & Gradients
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ColorControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="patterns" className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2.5">
                    <Grid3X3 className="h-4 w-4 text-violet-500" />
                    Dot & Eye Patterns
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <PatternControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="frame" className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2.5">
                    <Frame className="h-4 w-4 text-emerald-500" />
                    Frames & CTA Badges
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <FrameControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="logo" className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2.5">
                    <Image className="h-4 w-4 text-amber-500" />
                    Logo & Watermark
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <LogoControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="advanced" className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2.5">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    Advanced & Error Correction
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <AdvancedControls design={design} updateDesign={updateDesign} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Right: Sticky Live Preview & Scannability Diagnostics */}
          <div className="space-y-6 order-1 lg:order-2 lg:sticky lg:top-6">
            {/* Live QR Framed Preview */}
            <div className="p-6 rounded-3xl border border-border bg-card shadow-lg flex flex-col items-center justify-center min-h-[360px]">
              <QRPreview data={data} design={design} size={260} showFrame={true} />
            </div>

            {/* Scannability Diagnostics Card */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Scannability Audit
              </h4>
              <ScannabilityChecker design={design} />
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Save as Reusable Template</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Save this configuration so your team can apply it to any future QR codes with one click.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-muted-foreground">Template Name</label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Corporate Brand Dark"
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setSaveModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || isSaving}
              className="rounded-xl text-xs font-semibold"
            >
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

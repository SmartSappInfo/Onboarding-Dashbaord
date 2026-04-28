'use client';

import * as React from 'react';
import { Palette, Grid3X3, Image, Frame, Settings2, Shield, Sparkles } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { QRDesign } from '@/lib/types';
import QRPreview from '../qr-preview';
import ColorControls from './color-controls';
import PatternControls from './pattern-controls';
import LogoControls from './logo-controls';
import FrameControls from './frame-controls';
import AdvancedControls from './advanced-controls';
import ScannabilityChecker from './scannability-checker';

interface QRDesignerProps {
  data: string;
  design: QRDesign;
  onDesignChange: (design: QRDesign) => void;
  className?: string;
}

/**
 * Full QR code designer with live preview and design controls.
 * 3-column layout on desktop (controls | preview | scannability), stacked on mobile.
 */
export default function QRDesigner({ data, design, onDesignChange, className }: QRDesignerProps) {
  const updateDesign = React.useCallback(
    (patch: Partial<QRDesign>) => {
      onDesignChange({ ...design, ...patch });
    },
    [design, onDesignChange]
  );

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-6 ${className || ''}`}>
      {/* Left: Design Controls */}
      <div className="space-y-0 order-2 lg:order-1">
        <Accordion type="multiple" defaultValue={['colors', 'patterns']} className="space-y-2">
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
      </div>

      {/* Center: Live Preview */}
      <div className="flex flex-col items-center gap-4 order-1 lg:order-2">
        <div className="sticky top-6">
          <div className="p-8 rounded-2xl bg-white shadow-lg border border-border/50">
            <QRPreview data={data} design={design} size={Math.min(design.size || 300, 320)} />
          </div>
          {/* Frame text preview */}
          {design.frameStyle && design.frameStyle !== 'none' && design.frameText && (
            <div
              className={`mt-0 text-center py-2 px-4 font-bold text-sm ${
                design.frameStyle === 'pill' ? 'rounded-full' :
                design.frameStyle === 'rounded-bottom' ? 'rounded-b-xl' :
                'rounded-b-lg'
              }`}
              style={{
                backgroundColor: design.frameColor || design.foregroundColor || '#000',
                color: design.backgroundColor || '#fff',
              }}
            >
              {design.frameText}
            </div>
          )}
          <p className="text-[10px] text-center uppercase font-bold tracking-widest text-muted-foreground mt-4">
            Live Preview
          </p>
        </div>
      </div>

      {/* Right: Scannability Checker */}
      <div className="order-3">
        <div className="sticky top-6 space-y-4">
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
  );
}

'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { QRDesign } from '@/lib/types';

interface FrameControlsProps {
  design: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

const FRAME_STYLES: { value: NonNullable<QRDesign['frameStyle']>; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'banner-bottom', label: 'Banner Bottom' },
  { value: 'banner-top', label: 'Banner Top' },
  { value: 'rounded-bottom', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
];

export default function FrameControls({ design, updateDesign }: FrameControlsProps) {
  const activeFrame = design.frameStyle || 'none';

  return (
    <div className="space-y-4">
      {/* Frame Style */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Frame Style</Label>
        <div className="grid grid-cols-3 gap-2">
          {FRAME_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => updateDesign({ frameStyle: style.value })}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all cursor-pointer ${
                activeFrame === style.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <span className={`text-[10px] font-bold ${activeFrame === style.value ? 'text-primary' : 'text-muted-foreground'}`}>
                {style.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Frame Text (CTA) */}
      {activeFrame !== 'none' && (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">CTA Text</Label>
            <Input
              value={design.frameText || ''}
              onChange={(e) => updateDesign({ frameText: e.target.value })}
              placeholder="Scan Me"
              className="h-9 rounded-lg bg-muted/30 border-none text-xs"
              maxLength={30}
            />
            <p className="text-[9px] text-muted-foreground">{(design.frameText || '').length}/30 characters</p>
          </div>

          {/* Frame Color */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Frame Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={design.frameColor || design.foregroundColor || '#000000'}
                onChange={(e) => updateDesign({ frameColor: e.target.value })}
                className="h-9 w-9 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
              />
              <Input
                value={design.frameColor || ''}
                onChange={(e) => updateDesign({ frameColor: e.target.value })}
                placeholder="Inherit foreground"
                className="flex-1 h-9 rounded-lg bg-muted/30 border-none font-mono text-xs"
                maxLength={7}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

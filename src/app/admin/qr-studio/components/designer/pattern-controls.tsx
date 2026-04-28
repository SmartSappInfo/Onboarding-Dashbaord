'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import type { QRDesign, QRDotStyle, QRCornerSquareStyle, QRCornerDotStyle } from '@/lib/types';

interface PatternControlsProps {
  design: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

const DOT_STYLES: { value: QRDotStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
  { value: 'classy', label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
];

const CORNER_SQUARE_STYLES: { value: QRCornerSquareStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'dot', label: 'Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
];

const CORNER_DOT_STYLES: { value: QRCornerDotStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'dot', label: 'Dot' },
];

function PatternSwatch({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
          : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20'
      }`}
    >
      <span className={`text-[10px] font-bold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </button>
  );
}

export default function PatternControls({ design, updateDesign }: PatternControlsProps) {
  return (
    <div className="space-y-5">
      {/* Dot Style */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Dot Style</Label>
        <div className="grid grid-cols-3 gap-2">
          {DOT_STYLES.map((style) => (
            <PatternSwatch
              key={style.value}
              selected={design.dotStyle === style.value}
              onClick={() => updateDesign({ dotStyle: style.value })}
              label={style.label}
            />
          ))}
        </div>
      </div>

      {/* Corner Square Style */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Corner Square</Label>
        <div className="grid grid-cols-3 gap-2">
          {CORNER_SQUARE_STYLES.map((style) => (
            <PatternSwatch
              key={style.value}
              selected={design.cornerSquareStyle === style.value}
              onClick={() => updateDesign({ cornerSquareStyle: style.value })}
              label={style.label}
            />
          ))}
        </div>
      </div>

      {/* Corner Dot Style */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Corner Dot</Label>
        <div className="grid grid-cols-2 gap-2">
          {CORNER_DOT_STYLES.map((style) => (
            <PatternSwatch
              key={style.value}
              selected={design.cornerDotStyle === style.value}
              onClick={() => updateDesign({ cornerDotStyle: style.value })}
              label={style.label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

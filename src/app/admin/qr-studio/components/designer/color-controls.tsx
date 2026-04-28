'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { QRDesign } from '@/lib/types';

interface ColorControlsProps {
  design: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

const PRESET_COLORS = [
  '#000000', '#1a1a2e', '#16213e', '#0f3460',
  '#e94560', '#533483', '#2d6a4f', '#f77f00',
  '#d62828', '#003049', '#264653', '#2a9d8f',
];

export default function ColorControls({ design, updateDesign }: ColorControlsProps) {
  const gradientEnabled = design.gradient?.enabled || false;

  return (
    <div className="space-y-5">
      {/* Foreground Color */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Foreground</Label>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="color"
              value={design.foregroundColor || '#000000'}
              onChange={(e) => updateDesign({ foregroundColor: e.target.value })}
              className="h-9 w-9 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
            />
          </div>
          <Input
            value={design.foregroundColor || '#000000'}
            onChange={(e) => updateDesign({ foregroundColor: e.target.value })}
            className="flex-1 h-9 rounded-lg bg-muted/30 border-none font-mono text-xs uppercase"
            maxLength={7}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => updateDesign({ foregroundColor: color })}
              className={`h-6 w-6 rounded-md border-2 transition-all cursor-pointer ${
                design.foregroundColor === color ? 'border-primary scale-110 shadow-sm' : 'border-transparent hover:border-border'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Background</Label>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="color"
              value={design.backgroundColor || '#FFFFFF'}
              onChange={(e) => updateDesign({ backgroundColor: e.target.value })}
              className="h-9 w-9 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
            />
          </div>
          <Input
            value={design.backgroundColor || '#FFFFFF'}
            onChange={(e) => updateDesign({ backgroundColor: e.target.value })}
            className="flex-1 h-9 rounded-lg bg-muted/30 border-none font-mono text-xs uppercase"
            maxLength={7}
          />
        </div>
      </div>

      {/* Corner Color Override */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Corner Color (optional)</Label>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="color"
              value={design.cornerSquareColor || design.foregroundColor || '#000000'}
              onChange={(e) => updateDesign({ cornerSquareColor: e.target.value, cornerDotColor: e.target.value })}
              className="h-9 w-9 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
            />
          </div>
          <Input
            value={design.cornerSquareColor || ''}
            onChange={(e) => updateDesign({ cornerSquareColor: e.target.value, cornerDotColor: e.target.value })}
            placeholder="Inherit from foreground"
            className="flex-1 h-9 rounded-lg bg-muted/30 border-none font-mono text-xs"
            maxLength={7}
          />
        </div>
      </div>

      {/* Gradient Toggle */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground">Gradient Dots</Label>
          <Switch
            checked={gradientEnabled}
            onCheckedChange={(checked) =>
              updateDesign({
                gradient: {
                  enabled: checked,
                  type: design.gradient?.type || 'linear',
                  rotation: design.gradient?.rotation || 0,
                  colorStops: design.gradient?.colorStops || [
                    { offset: 0, color: design.foregroundColor || '#000000' },
                    { offset: 1, color: '#6366f1' },
                  ],
                },
              })
            }
          />
        </div>

        {gradientEnabled && design.gradient && (
          <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
            <Select
              value={design.gradient.type}
              onValueChange={(val) =>
                updateDesign({ gradient: { ...design.gradient!, type: val as 'linear' | 'radial' } })
              }
            >
              <SelectTrigger className="h-9 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
              </SelectContent>
            </Select>

            {design.gradient.type === 'linear' && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Rotation</Label>
                <Slider
                  value={[design.gradient.rotation || 0]}
                  min={0}
                  max={360}
                  step={15}
                  onValueChange={([val]) =>
                    updateDesign({ gradient: { ...design.gradient!, rotation: val } })
                  }
                  className="py-2"
                />
                <p className="text-[10px] text-muted-foreground text-right">{design.gradient.rotation || 0}°</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground">Start Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.gradient.colorStops[0]?.color || '#000000'}
                  onChange={(e) => {
                    const stops = [...(design.gradient!.colorStops || [])];
                    stops[0] = { offset: 0, color: e.target.value };
                    updateDesign({ gradient: { ...design.gradient!, colorStops: stops } });
                  }}
                  className="h-8 w-8 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                />
                <Label className="text-[10px] text-muted-foreground">End Color</Label>
                <input
                  type="color"
                  value={design.gradient.colorStops[1]?.color || '#6366f1'}
                  onChange={(e) => {
                    const stops = [...(design.gradient!.colorStops || [])];
                    stops[1] = { offset: 1, color: e.target.value };
                    updateDesign({ gradient: { ...design.gradient!, colorStops: stops } });
                  }}
                  className="h-8 w-8 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

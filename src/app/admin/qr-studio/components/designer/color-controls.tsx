'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Eye, Palette, Sparkles, RefreshCw } from 'lucide-react';
import type { QRDesign } from '@/lib/types';

interface ColorControlsProps {
  design: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

const PRESET_COLORS = [
  '#000000', '#1a1a2e', '#16213e', '#0f3460',
  '#e94560', '#533483', '#2d6a4f', '#f77f00',
  '#d62828', '#003049', '#264653', '#2a9d8f',
  '#2563eb', '#7c3aed', '#db2777', '#059669',
];

const GRADIENT_PRESETS = [
  { name: 'Royal Indigo', colors: ['#4f46e5', '#06b6d4'], type: 'linear' as const, rotation: 45 },
  { name: 'Sunset Glow', colors: ['#f43f5e', '#fb923c'], type: 'linear' as const, rotation: 90 },
  { name: 'Emerald Wave', colors: ['#059669', '#10b981'], type: 'linear' as const, rotation: 135 },
  { name: 'Midnight Purple', colors: ['#7e22ce', '#3b82f6'], type: 'linear' as const, rotation: 45 },
  { name: 'Amber Flame', colors: ['#d97706', '#ef4444'], type: 'linear' as const, rotation: 180 },
  { name: 'Deep Oceanic', colors: ['#0284c7', '#0f172a'], type: 'linear' as const, rotation: 90 },
];

export default function ColorControls({ design, updateDesign }: ColorControlsProps) {
  const gradientEnabled = design.gradient?.enabled || false;
  const [customEyes, setCustomEyes] = React.useState(
    Boolean(design.cornerSquareColor || design.cornerDotColor)
  );

  return (
    <div className="space-y-6">
      {/* Foreground Color */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">Pattern / Foreground Color</Label>
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
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => updateDesign({ foregroundColor: color })}
              className={`h-6 w-6 rounded-md border-2 transition-all cursor-pointer active:scale-[0.97] ${
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
        <Label className="text-xs font-semibold text-muted-foreground">Background Color</Label>
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

      {/* Dual-Color Eye Styling */}
      <div className="space-y-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <Label className="text-xs font-semibold text-foreground">Dual-Color Eye Styling</Label>
          </div>
          <Switch
            checked={customEyes}
            onCheckedChange={(checked) => {
              setCustomEyes(checked);
              if (!checked) {
                updateDesign({ cornerSquareColor: undefined, cornerDotColor: undefined });
              } else {
                updateDesign({
                  cornerSquareColor: design.foregroundColor || '#000000',
                  cornerDotColor: design.foregroundColor || '#000000',
                });
              }
            }}
          />
        </div>

        {customEyes && (
          <div className="space-y-3 p-3.5 rounded-xl bg-muted/20 border border-border animate-in slide-in-from-top-2 duration-200">
            {/* Outer Eye Ring Color */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Eye Frame (Outer Ring)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.cornerSquareColor || design.foregroundColor || '#000000'}
                  onChange={(e) => updateDesign({ cornerSquareColor: e.target.value })}
                  className="h-8 w-8 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                />
                <Input
                  value={design.cornerSquareColor || ''}
                  onChange={(e) => updateDesign({ cornerSquareColor: e.target.value })}
                  placeholder="Inherit pattern color"
                  className="flex-1 h-8 rounded-lg bg-background border border-border/60 font-mono text-xs"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Inner Eye Pupil Color */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Eye Ball (Inner Pupil)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.cornerDotColor || design.foregroundColor || '#000000'}
                  onChange={(e) => updateDesign({ cornerDotColor: e.target.value })}
                  className="h-8 w-8 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                />
                <Input
                  value={design.cornerDotColor || ''}
                  onChange={(e) => updateDesign({ cornerDotColor: e.target.value })}
                  placeholder="Inherit pattern color"
                  className="flex-1 h-8 rounded-lg bg-background border border-border/60 font-mono text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Gradient Engine */}
      <div className="space-y-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label className="text-xs font-semibold text-foreground">Gradient Pattern Engine</Label>
          </div>
          <Switch
            checked={gradientEnabled}
            onCheckedChange={(checked) =>
              updateDesign({
                gradient: {
                  enabled: checked,
                  type: design.gradient?.type || 'linear',
                  rotation: design.gradient?.rotation || 45,
                  colorStops: design.gradient?.colorStops || [
                    { offset: 0, color: design.foregroundColor || '#000000' },
                    { offset: 1, color: '#4f46e5' },
                  ],
                },
              })
            }
          />
        </div>

        {gradientEnabled && design.gradient && (
          <div className="space-y-4 p-3.5 rounded-xl bg-muted/20 border border-border animate-in slide-in-from-top-2 duration-200">
            {/* Quick Gradient Presets */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Gradient Presets</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {GRADIENT_PRESETS.map((gp) => (
                  <button
                    key={gp.name}
                    type="button"
                    onClick={() =>
                      updateDesign({
                        gradient: {
                          enabled: true,
                          type: gp.type,
                          rotation: gp.rotation,
                          colorStops: [
                            { offset: 0, color: gp.colors[0] },
                            { offset: 1, color: gp.colors[1] },
                          ],
                        },
                      })
                    }
                    className="p-1.5 rounded-lg border border-border/60 bg-card hover:border-primary/40 flex items-center gap-1.5 text-left active:scale-[0.97] transition-all"
                  >
                    <div
                      className="h-4 w-4 rounded-full shrink-0 shadow-inner"
                      style={{
                        background: `linear-gradient(${gp.rotation}deg, ${gp.colors[0]}, ${gp.colors[1]})`,
                      }}
                    />
                    <span className="text-[10px] font-medium truncate">{gp.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gradient Type */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Gradient Mode</Label>
              <Select
                value={design.gradient.type}
                onValueChange={(val) =>
                  updateDesign({ gradient: { ...design.gradient!, type: val as 'linear' | 'radial' } })
                }
              >
                <SelectTrigger className="h-8 rounded-lg text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="linear">Linear Gradient</SelectItem>
                  <SelectItem value="radial">Radial Gradient (Center Out)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rotation Angle (Linear) */}
            {design.gradient.type === 'linear' && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Gradient Angle</span>
                  <span className="font-mono font-semibold text-foreground">{design.gradient.rotation || 0}°</span>
                </div>
                <Slider
                  value={[design.gradient.rotation || 0]}
                  min={0}
                  max={360}
                  step={15}
                  onValueChange={([val]) =>
                    updateDesign({ gradient: { ...design.gradient!, rotation: val } })
                  }
                  className="py-1"
                />
              </div>
            )}

            {/* Color Stops */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground">Color Stops</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-1">
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
                  <span className="text-[10px] text-muted-foreground font-mono">Start</span>
                </div>
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                  <span className="text-[10px] text-muted-foreground font-mono">End</span>
                  <input
                    type="color"
                    value={design.gradient.colorStops[1]?.color || '#4f46e5'}
                    onChange={(e) => {
                      const stops = [...(design.gradient!.colorStops || [])];
                      stops[1] = { offset: 1, color: e.target.value };
                      updateDesign({ gradient: { ...design.gradient!, colorStops: stops } });
                    }}
                    className="h-8 w-8 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                  />
                </div>
              </div>

              {/* Gradient Preview Bar */}
              <div
                className="h-3 w-full rounded-md border border-border shadow-inner"
                style={{
                  background:
                    design.gradient.type === 'radial'
                      ? `radial-gradient(circle, ${design.gradient.colorStops[0]?.color || '#000000'}, ${
                          design.gradient.colorStops[1]?.color || '#4f46e5'
                        })`
                      : `linear-gradient(${design.gradient.rotation || 0}deg, ${
                          design.gradient.colorStops[0]?.color || '#000000'
                        }, ${design.gradient.colorStops[1]?.color || '#4f46e5'})`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

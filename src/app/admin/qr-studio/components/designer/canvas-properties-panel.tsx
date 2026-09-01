'use client';

import * as React from 'react';
import { Trash2, Lock, Unlock, Copy, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import type { CanvasElement, CanvasState } from './canvas-types';
import { CANVAS_PRESETS, FONT_OPTIONS } from './canvas-types';

interface Props {
  canvas: CanvasState;
  selectedElement: CanvasElement | null;
  onCanvasChange: (patch: Partial<CanvasState>) => void;
  onElementUpdate: (id: string, patch: Partial<CanvasElement>) => void;
  onElementDelete: (id: string) => void;
  onDuplicateElement?: (id: string) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
}

export default function CanvasPropertiesPanel({
  canvas,
  selectedElement,
  onCanvasChange,
  onElementUpdate,
  onElementDelete,
  onDuplicateElement,
  onBringToFront,
  onSendToBack,
}: Props) {
  const el = selectedElement;
  const upd = (patch: Partial<CanvasElement>) => el && onElementUpdate(el.id, patch);

  return (
    <div className="w-[240px] shrink-0 space-y-3 overflow-y-auto max-h-[70vh] pr-1">
      {/* Canvas Dimensions & Background */}
      <Card className="p-3.5 rounded-2xl space-y-2.5 border-border/80 bg-card shadow-sm">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Canvas Setup</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={canvas.backgroundColor}
            onChange={(e) => onCanvasChange({ backgroundColor: e.target.value })}
            className="h-7 w-7 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
          />
          <Input
            value={canvas.backgroundColor}
            onChange={(e) => onCanvasChange({ backgroundColor: e.target.value })}
            className="h-7 rounded-lg text-[10px] flex-1 font-mono uppercase bg-muted/30"
          />
        </div>
        <Select
          value={`${canvas.width}x${canvas.height}`}
          onValueChange={(val) => {
            const [w, h] = val.split('x').map(Number);
            onCanvasChange({ width: w, height: h });
          }}
        >
          <SelectTrigger className="h-7 rounded-lg text-[10px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {CANVAS_PRESETS.map((p) => (
              <SelectItem key={p.label} value={`${p.w}x${p.h}`}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Selected Element Properties */}
      {el ? (
        <Card className="p-3.5 rounded-2xl space-y-3 border-border/80 bg-card shadow-sm animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-[11px] font-bold text-foreground capitalize">
              {el.isQR ? 'QR Code Block' : `${el.type} Layer`}
            </span>
            <div className="flex items-center gap-1">
              {/* Lock Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 rounded-lg ${el.isLocked ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground'}`}
                onClick={() => upd({ isLocked: !el.isLocked })}
                title={el.isLocked ? 'Unlock layer' : 'Lock layer'}
              >
                {el.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </Button>
              {/* Duplicate */}
              {onDuplicateElement && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => onDuplicateElement(el.id)}
                  title="Duplicate (Cmd+D)"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
              {/* Delete */}
              {!el.isQR && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => onElementDelete(el.id)}
                  title="Delete element"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Layer Ordering (Bring to Front / Send to Back) */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBringToFront?.(el.id)}
              className="flex-1 h-6 text-[9px] rounded-lg active:scale-[0.97]"
            >
              <ArrowUpToLine className="h-2.5 w-2.5 mr-1" />
              To Front
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSendToBack?.(el.id)}
              className="flex-1 h-6 text-[9px] rounded-lg active:scale-[0.97]"
            >
              <ArrowDownToLine className="h-2.5 w-2.5 mr-1" />
              To Back
            </Button>
          </div>

          {/* Position & Size Grid */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div className="space-y-0.5">
              <Label className="text-[9px] text-muted-foreground">X Pos (%)</Label>
              <Input
                type="number"
                value={Math.round(el.x)}
                onChange={(e) => upd({ x: Number(e.target.value) })}
                className="h-6 rounded-md text-[10px] bg-muted/30"
                disabled={el.isLocked}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-muted-foreground">Y Pos (%)</Label>
              <Input
                type="number"
                value={Math.round(el.y)}
                onChange={(e) => upd({ y: Number(e.target.value) })}
                className="h-6 rounded-md text-[10px] bg-muted/30"
                disabled={el.isLocked}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-muted-foreground">Width (%)</Label>
              <Input
                type="number"
                value={Math.round(el.width)}
                onChange={(e) => upd({ width: Number(e.target.value) })}
                className="h-6 rounded-md text-[10px] bg-muted/30"
                disabled={el.isLocked}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-muted-foreground">Height (%)</Label>
              <Input
                type="number"
                value={Math.round(el.height)}
                onChange={(e) => upd({ height: Number(e.target.value) })}
                className="h-6 rounded-md text-[10px] bg-muted/30"
                disabled={el.isLocked}
              />
            </div>
          </div>

          {/* Rotation Slider */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[9px] text-muted-foreground">
              <span>Rotation</span>
              <span className="font-mono">{el.rotation || 0}°</span>
            </div>
            <Slider
              value={[el.rotation || 0]}
              min={0}
              max={360}
              step={1}
              onValueChange={([v]) => upd({ rotation: v })}
              disabled={el.isLocked}
            />
          </div>

          {/* Text Element Properties */}
          {el.type === 'text' && !el.isQR && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="space-y-0.5">
                <Label className="text-[9px] text-muted-foreground">Text Content</Label>
                <Textarea
                  value={el.text || ''}
                  onChange={(e) => upd({ text: e.target.value })}
                  className="min-h-[50px] rounded-lg text-[10px] resize-y bg-muted/30"
                  disabled={el.isLocked}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] text-muted-foreground">Font</Label>
                  <Select
                    value={el.fontFamily || 'Inter'}
                    onValueChange={(v) => upd({ fontFamily: v })}
                    disabled={el.isLocked}
                  >
                    <SelectTrigger className="h-6 rounded-md text-[9px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] text-muted-foreground">Font Size</Label>
                  <Input
                    type="number"
                    value={el.fontSize || 14}
                    onChange={(e) => upd({ fontSize: Number(e.target.value) })}
                    className="h-6 rounded-md text-[10px] bg-muted/30"
                    disabled={el.isLocked}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] text-muted-foreground">Weight</Label>
                  <Select
                    value={el.fontWeight || '400'}
                    onValueChange={(v) => upd({ fontWeight: v })}
                    disabled={el.isLocked}
                  >
                    <SelectTrigger className="h-6 rounded-md text-[9px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {['300', '400', '600', '700', '800', '900'].map((w) => (
                        <SelectItem key={w} value={w}>
                          {w === '300'
                            ? 'Light'
                            : w === '400'
                              ? 'Normal'
                              : w === '600'
                                ? 'Semi'
                                : w === '700'
                                  ? 'Bold'
                                  : w === '800'
                                    ? 'X-Bold'
                                    : 'Black'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] text-muted-foreground">Color</Label>
                  <div className="flex gap-1 items-center">
                    <input
                      type="color"
                      value={el.fill || '#1a1a1a'}
                      onChange={(e) => upd({ fill: e.target.value })}
                      className="h-6 w-6 rounded-md border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
                      disabled={el.isLocked}
                    />
                    <Input
                      value={el.fill || '#1a1a1a'}
                      onChange={(e) => upd({ fill: e.target.value })}
                      className="h-6 rounded-md text-[8px] font-mono flex-1 bg-muted/30"
                      disabled={el.isLocked}
                    />
                  </div>
                </div>
              </div>
              {/* Text Alignment */}
              <div className="flex gap-1 pt-0.5">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <Button
                    key={a}
                    variant={el.textAlign === a ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => upd({ textAlign: a })}
                    className="h-6 flex-1 rounded-md text-[9px] capitalize active:scale-[0.97]"
                    disabled={el.isLocked}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Shape Properties */}
          {(el.type === 'rect' || el.type === 'circle') && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="space-y-0.5">
                <Label className="text-[9px] text-muted-foreground">Fill Color</Label>
                <div className="flex gap-1 items-center">
                  <input
                    type="color"
                    value={el.shapeFill || '#e0e0e0'}
                    onChange={(e) => upd({ shapeFill: e.target.value })}
                    className="h-6 w-6 rounded-md border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
                    disabled={el.isLocked}
                  />
                  <Input
                    value={el.shapeFill || '#e0e0e0'}
                    onChange={(e) => upd({ shapeFill: e.target.value })}
                    className="h-6 rounded-md text-[8px] font-mono flex-1 bg-muted/30"
                    disabled={el.isLocked}
                  />
                </div>
              </div>
              {el.type === 'rect' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                    <span>Corner Radius</span>
                    <span>{el.borderRadius || 0}px</span>
                  </div>
                  <Slider
                    value={[el.borderRadius || 0]}
                    min={0}
                    max={50}
                    step={1}
                    onValueChange={([v]) => upd({ borderRadius: v })}
                    disabled={el.isLocked}
                  />
                </div>
              )}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                  <span>Opacity</span>
                  <span>{Math.round((el.opacity ?? 1) * 100)}%</span>
                </div>
                <Slider
                  value={[(el.opacity ?? 1) * 100]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => upd({ opacity: v / 100 })}
                  disabled={el.isLocked}
                />
              </div>
            </div>
          )}

          {/* Line Properties */}
          {el.type === 'line' && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="space-y-0.5">
                <Label className="text-[9px] text-muted-foreground">Line Color</Label>
                <div className="flex gap-1 items-center">
                  <input
                    type="color"
                    value={el.lineColor || '#999999'}
                    onChange={(e) => upd({ lineColor: e.target.value })}
                    className="h-6 w-6 rounded-md border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
                    disabled={el.isLocked}
                  />
                  <Input
                    value={el.lineColor || '#999999'}
                    onChange={(e) => upd({ lineColor: e.target.value })}
                    className="h-6 rounded-md text-[8px] font-mono flex-1 bg-muted/30"
                    disabled={el.isLocked}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                  <span>Thickness</span>
                  <span>{el.lineWidth || 2}px</span>
                </div>
                <Slider
                  value={[el.lineWidth || 2]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([v]) => upd({ lineWidth: v })}
                  disabled={el.isLocked}
                />
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-4 rounded-2xl text-center space-y-1 border-dashed border-border/80 bg-muted/10">
          <p className="text-[11px] font-semibold text-muted-foreground">No Element Selected</p>
          <p className="text-[9px] text-muted-foreground">Click any text, shape, image or QR code on canvas to edit properties.</p>
        </Card>
      )}
    </div>
  );
}

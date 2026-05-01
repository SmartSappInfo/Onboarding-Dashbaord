'use client';

import * as React from 'react';
import { Trash2, Move } from 'lucide-react';
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
}

export default function CanvasPropertiesPanel({ canvas, selectedElement, onCanvasChange, onElementUpdate, onElementDelete }: Props) {
  const el = selectedElement;
  const upd = (patch: Partial<CanvasElement>) => el && onElementUpdate(el.id, patch);

  return (
    <div className="w-[220px] shrink-0 space-y-3 overflow-y-auto max-h-[70vh]">
      {/* Canvas Settings */}
      <Card className="p-3 rounded-xl space-y-2">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Canvas</p>
        <div className="flex items-center gap-2">
          <input type="color" value={canvas.backgroundColor} onChange={e => onCanvasChange({ backgroundColor: e.target.value })} className="h-7 w-7 rounded border-none cursor-pointer" />
          <Input value={canvas.backgroundColor} onChange={e => onCanvasChange({ backgroundColor: e.target.value })} className="h-7 rounded-lg text-[10px] flex-1 font-mono" />
        </div>
        <Select value={`${canvas.width}x${canvas.height}`} onValueChange={val => { const [w, h] = val.split('x').map(Number); onCanvasChange({ width: w, height: h }); }}>
          <SelectTrigger className="h-7 rounded-lg text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>{CANVAS_PRESETS.map(p => <SelectItem key={p.label} value={`${p.w}x${p.h}`}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {/* Element Properties */}
      {el ? (
        <Card className="p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              {el.isQR ? 'QR Code' : el.type}
            </p>
            {!el.isQR && (
              <Button variant="ghost" size="icon" className="h-5 w-5 rounded text-destructive" onClick={() => onElementDelete(el.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Position & Size */}
          <div className="grid grid-cols-2 gap-1.5">
            {[['X', 'x'], ['Y', 'y'], ['W', 'width'], ['H', 'height']].map(([label, key]) => (
              <div key={key} className="space-y-0.5">
                <Label className="text-[9px]">{label} (%)</Label>
                <Input type="number" value={Math.round((el as any)[key])} onChange={e => upd({ [key]: Number(e.target.value) })} className="h-6 rounded text-[10px]" />
              </div>
            ))}
          </div>

          <div className="space-y-0.5">
            <div className="flex justify-between">
              <Label className="text-[9px]">Rotation</Label>
              <span className="text-[9px] text-muted-foreground">{el.rotation || 0}°</span>
            </div>
            <Slider value={[el.rotation || 0]} min={0} max={360} step={1} onValueChange={([v]) => upd({ rotation: v })} />
          </div>

          {/* Text Props */}
          {el.type === 'text' && !el.isQR && (
            <>
              <div className="space-y-0.5">
                <Label className="text-[9px]">Content</Label>
                <Textarea value={el.text || ''} onChange={e => upd({ text: e.target.value })} className="min-h-[60px] rounded-lg text-[10px] resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px]">Font</Label>
                  <Select value={el.fontFamily || 'Inter'} onValueChange={v => upd({ fontFamily: v })}>
                    <SelectTrigger className="h-6 rounded text-[9px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px]">Size</Label>
                  <Input type="number" value={el.fontSize || 14} onChange={e => upd({ fontSize: Number(e.target.value) })} className="h-6 rounded text-[10px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px]">Weight</Label>
                  <Select value={el.fontWeight || '400'} onValueChange={v => upd({ fontWeight: v })}>
                    <SelectTrigger className="h-6 rounded text-[9px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['300','400','600','700','800','900'].map(w => <SelectItem key={w} value={w}>{w === '300' ? 'Light' : w === '400' ? 'Normal' : w === '600' ? 'Semi' : w === '700' ? 'Bold' : w === '800' ? 'X-Bold' : 'Black'}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px]">Color</Label>
                  <div className="flex gap-1">
                    <input type="color" value={el.fill || '#000'} onChange={e => upd({ fill: e.target.value })} className="h-6 w-6 rounded border-none cursor-pointer" />
                    <Input value={el.fill || '#000'} onChange={e => upd({ fill: e.target.value })} className="h-6 rounded text-[8px] font-mono flex-1" />
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                {(['left','center','right'] as const).map(a => (
                  <Button key={a} variant={el.textAlign === a ? 'default' : 'outline'} size="sm" onClick={() => upd({ textAlign: a })} className="h-6 flex-1 rounded text-[9px] capitalize">{a}</Button>
                ))}
              </div>
            </>
          )}

          {/* Shape Props */}
          {(el.type === 'rect' || el.type === 'circle') && (
            <>
              <div className="space-y-0.5">
                <Label className="text-[9px]">Fill</Label>
                <div className="flex gap-1">
                  <input type="color" value={el.shapeFill || '#e0e0e0'} onChange={e => upd({ shapeFill: e.target.value })} className="h-6 w-6 rounded border-none cursor-pointer" />
                  <Input value={el.shapeFill || '#e0e0e0'} onChange={e => upd({ shapeFill: e.target.value })} className="h-6 rounded text-[8px] font-mono flex-1" />
                </div>
              </div>
              {el.type === 'rect' && (
                <div className="space-y-0.5">
                  <Label className="text-[9px]">Radius</Label>
                  <Slider value={[el.borderRadius || 0]} min={0} max={50} step={1} onValueChange={([v]) => upd({ borderRadius: v })} />
                </div>
              )}
              <div className="space-y-0.5">
                <Label className="text-[9px]">Opacity</Label>
                <Slider value={[(el.opacity ?? 1) * 100]} min={0} max={100} step={5} onValueChange={([v]) => upd({ opacity: v / 100 })} />
              </div>
            </>
          )}

          {/* Line Props */}
          {el.type === 'line' && (
            <>
              <div className="space-y-0.5">
                <Label className="text-[9px]">Color</Label>
                <div className="flex gap-1">
                  <input type="color" value={el.lineColor || '#999'} onChange={e => upd({ lineColor: e.target.value })} className="h-6 w-6 rounded border-none cursor-pointer" />
                  <Input value={el.lineColor || '#999'} onChange={e => upd({ lineColor: e.target.value })} className="h-6 rounded text-[8px] font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px]">Thickness</Label>
                <Slider value={[el.lineWidth || 2]} min={1} max={10} step={1} onValueChange={([v]) => upd({ lineWidth: v })} />
              </div>
            </>
          )}

          {/* Image Props */}
          {el.type === 'image' && (
            <div className="space-y-0.5">
              <Label className="text-[9px]">Opacity</Label>
              <Slider value={[(el.opacity ?? 1) * 100]} min={0} max={100} step={5} onValueChange={([v]) => upd({ opacity: v / 100 })} />
            </div>
          )}
        </Card>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-border text-center">
          <Move className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Click an element to edit</p>
        </div>
      )}
    </div>
  );
}

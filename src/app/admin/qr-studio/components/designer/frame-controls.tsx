'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, ArrowDown, Sparkles, Lock, Link as LinkIcon, Phone, Star, ShoppingBag, Square, Smartphone, Tag, Ticket, MessageSquare, ShieldCheck } from 'lucide-react';
import type { QRDesign, QRFrameStyle, QRFrameIcon } from '@/lib/types';

interface FrameControlsProps {
  design: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

const FRAME_STYLES: { value: QRFrameStyle; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'none', label: 'None', icon: Square },
  { value: 'bottom-banner', label: 'Bottom Banner', icon: Tag },
  { value: 'top-banner', label: 'Top Header', icon: Tag },
  { value: 'rounded-box', label: 'Rounded Box', icon: Square },
  { value: 'polaroid', label: 'Polaroid Card', icon: Square },
  { value: 'phone-mockup', label: 'Phone Shell', icon: Smartphone },
  { value: 'scan-me-badge', label: 'Scan Ribbon', icon: ShieldCheck },
  { value: 'ticket-stub', label: 'Ticket / Pass', icon: Ticket },
  { value: 'minimalist-pill', label: 'Minimal Pill', icon: Tag },
  { value: 'bubble-callout', label: 'Speech Bubble', icon: MessageSquare },
];

const CTA_ICONS: { value: QRFrameIcon; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'camera', label: 'Camera', icon: Camera },
  { value: 'arrow-down', label: 'Arrow Down', icon: ArrowDown },
  { value: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { value: 'lock', label: 'Security Lock', icon: Lock },
  { value: 'link', label: 'Link', icon: LinkIcon },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'star', label: 'Star', icon: Star },
  { value: 'shopping-bag', label: 'Shopping Bag', icon: ShoppingBag },
  { value: 'none', label: 'No Icon', icon: Square },
];

const QUICK_CTA_PRESETS = [
  'SCAN ME',
  'POINT CAMERA HERE',
  'VIEW MENU',
  'TAP OR SCAN',
  'JOIN SESSION',
  'GET DISCOUNT',
  'CONNECT TO WI-FI',
  'REGISTER NOW',
];

export default function FrameControls({ design, updateDesign }: FrameControlsProps) {
  const activeFrame: QRFrameStyle = design.frameStyle || 'none';
  const activeIcon: QRFrameIcon = design.frameIcon || 'camera';

  return (
    <div className="space-y-5">
      {/* Frame Style Picker */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">CTA Frame Style</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FRAME_STYLES.map((style) => {
            const IconComp = style.icon;
            const isSelected = activeFrame === style.value;
            return (
              <button
                key={style.value}
                type="button"
                onClick={() => updateDesign({ frameStyle: style.value })}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.97] ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground'
                    : 'border-border bg-card hover:border-primary/30 text-muted-foreground'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    isSelected ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <IconComp className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-semibold truncate">{style.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Frame Configuration Controls */}
      {activeFrame !== 'none' && (
        <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border animate-in slide-in-from-top-2 duration-200">
          {/* CTA Text Input & Quick Suggestions */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-muted-foreground">CTA Banner Text</Label>
              <span className="text-[10px] text-muted-foreground">{(design.frameText || 'SCAN ME').length}/30</span>
            </div>
            <Input
              value={design.frameText !== undefined ? design.frameText : 'SCAN ME'}
              onChange={(e) => updateDesign({ frameText: e.target.value })}
              placeholder="e.g. SCAN ME"
              className="h-9 rounded-lg bg-background border border-border/60 text-xs font-semibold"
              maxLength={30}
            />
            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-1 pt-1">
              {QUICK_CTA_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateDesign({ frameText: preset })}
                  className="px-2 py-0.5 rounded-md bg-card border border-border/50 text-[9px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-[0.97] transition-all"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* CTA Icon Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">CTA Action Icon</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {CTA_ICONS.map((item) => {
                const IconComp = item.icon;
                const isSelected = activeIcon === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateDesign({ frameIcon: item.value })}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left active:scale-[0.97] transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border/60 bg-background text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <IconComp className="h-3 w-3 shrink-0" />
                    <span className="text-[10px] truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colors (Frame BG & Text) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Frame Background</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.frameColor || design.foregroundColor || '#000000'}
                  onChange={(e) => updateDesign({ frameColor: e.target.value })}
                  className="h-8 w-8 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                />
                <Input
                  value={design.frameColor || ''}
                  onChange={(e) => updateDesign({ frameColor: e.target.value })}
                  placeholder="Inherit pattern"
                  className="flex-1 h-8 rounded-lg bg-background border border-border/60 font-mono text-xs"
                  maxLength={7}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">CTA Text Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.frameTextColor || '#FFFFFF'}
                  onChange={(e) => updateDesign({ frameTextColor: e.target.value })}
                  className="h-8 w-8 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                />
                <Input
                  value={design.frameTextColor || '#FFFFFF'}
                  onChange={(e) => updateDesign({ frameTextColor: e.target.value })}
                  placeholder="#FFFFFF"
                  className="flex-1 h-8 rounded-lg bg-background border border-border/60 font-mono text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

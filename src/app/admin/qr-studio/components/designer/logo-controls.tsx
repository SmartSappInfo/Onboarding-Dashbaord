'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon, X } from 'lucide-react';
import type { QRDesign } from '@/lib/types';

interface LogoControlsProps {
  design: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

export default function LogoControls({ design, updateDesign }: LogoControlsProps) {
  const hasLogo = !!design.logoUrl;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a local preview URL for the logo
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      updateDesign({
        logoUrl: dataUrl,
        logoSize: design.logoSize || 20,
        logoMargin: design.logoMargin ?? 5,
        // Upgrade error correction when logo is added
        errorCorrection: design.errorCorrection === 'L' || design.errorCorrection === 'M' ? 'Q' : design.errorCorrection,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUrlInput = (url: string) => {
    updateDesign({
      logoUrl: url || undefined,
      logoSize: design.logoSize || 20,
      logoMargin: design.logoMargin ?? 5,
      errorCorrection: url && (design.errorCorrection === 'L' || design.errorCorrection === 'M') ? 'Q' : design.errorCorrection,
    });
  };

  const removeLogo = () => {
    updateDesign({ logoUrl: undefined, logoSize: undefined, logoMargin: undefined });
  };

  return (
    <div className="space-y-4">
      {/* Logo toggle / upload */}
      {!hasLogo ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Add a logo to the center of your QR code. Error correction will be automatically increased.
          </p>

          {/* Upload button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl h-20 border-dashed border-2 hover:border-primary/40 flex flex-col gap-1"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-semibold">Upload Logo</span>
            <span className="text-[9px] text-muted-foreground">PNG, JPG, SVG</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Or URL input */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Or paste image URL</Label>
            <Input
              placeholder="https://example.com/logo.png"
              onChange={(e) => handleUrlInput(e.target.value)}
              className="h-9 rounded-lg bg-muted/30 border-none text-xs"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Logo preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border">
            <div className="h-12 w-12 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
              {design.logoUrl?.startsWith('data:') ? (
                <img src={design.logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Logo added</p>
              <p className="text-[10px] text-muted-foreground">
                {design.logoSize || 20}% size, {design.logoMargin ?? 5}px margin
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={removeLogo} className="h-8 w-8 rounded-lg shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Logo Size */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-muted-foreground">Logo Size</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{design.logoSize || 20}%</span>
            </div>
            <Slider
              value={[design.logoSize || 20]}
              min={10}
              max={30}
              step={1}
              onValueChange={([val]) => updateDesign({ logoSize: val })}
              className="py-2"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Small (10%)</span>
              <span>Large (30%)</span>
            </div>
          </div>

          {/* Logo Margin */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-muted-foreground">Logo Padding</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{design.logoMargin ?? 5}px</span>
            </div>
            <Slider
              value={[design.logoMargin ?? 5]}
              min={0}
              max={20}
              step={1}
              onValueChange={([val]) => updateDesign({ logoMargin: val })}
              className="py-2"
            />
          </div>

          {/* Replace logo */}
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl h-9 text-xs"
          >
            <Upload className="h-3.5 w-3.5 mr-2" />
            Replace Logo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

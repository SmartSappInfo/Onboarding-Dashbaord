'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon, X, Image as ImageIcon2 } from 'lucide-react';
import type { QRDesign, MediaAsset } from '@/lib/types';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';

interface LogoControlsProps {
  design: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

export default function LogoControls({ design, updateDesign }: LogoControlsProps) {
  const hasLogo = !!design.logoUrl;
  const [showMediaDialog, setShowMediaDialog] = React.useState(false);

  const handleAssetSelect = (asset: MediaAsset) => {
    setShowMediaDialog(false);
    updateDesign({
      logoUrl: asset.url,
      logoSize: design.logoSize || 20,
      logoMargin: design.logoMargin ?? 5,
      errorCorrection: design.errorCorrection === 'L' || design.errorCorrection === 'M' ? 'Q' : design.errorCorrection,
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

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowMediaDialog(true)}
            className="w-full rounded-xl h-20 border-dashed border-2 hover:border-primary/40 flex flex-col gap-1"
          >
            <ImageIcon2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-semibold">Select from Library</span>
            <span className="text-[9px] text-muted-foreground">Choose or upload an image</span>
          </Button>
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
            onClick={() => setShowMediaDialog(true)}
            className="w-full rounded-xl text-xs font-semibold h-9"
          >
            Replace Logo
          </Button>
        </div>
      )}

      <MediaSelectorDialog
        open={showMediaDialog}
        onOpenChange={setShowMediaDialog}
        onSelectAsset={handleAssetSelect}
        filterType="image"
        title="Select Logo"
      />
    </div>
  );
}

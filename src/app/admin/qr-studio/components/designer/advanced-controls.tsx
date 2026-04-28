'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import type { QRDesign, QRErrorCorrection } from '@/lib/types';

interface AdvancedControlsProps {
  design: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

const EC_LEVELS: { value: QRErrorCorrection; label: string; description: string }[] = [
  { value: 'L', label: 'Low (7%)', description: 'Smallest QR, least redundancy. Use when QR will always be displayed on screens.' },
  { value: 'M', label: 'Medium (15%)', description: 'Default. Good balance of size and reliability.' },
  { value: 'Q', label: 'Quartile (25%)', description: 'Recommended when adding a logo. Tolerates more damage.' },
  { value: 'H', label: 'High (30%)', description: 'Maximum redundancy. Best for printing on materials that may get damaged.' },
];

export default function AdvancedControls({ design, updateDesign }: AdvancedControlsProps) {
  return (
    <div className="space-y-5">
      {/* Error Correction */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Error Correction</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px]">
                <p className="text-xs">Higher error correction makes the QR code more reliable but also larger. Use Q or H when adding logos.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          value={design.errorCorrection}
          onValueChange={(val) => updateDesign({ errorCorrection: val as QRErrorCorrection })}
        >
          <SelectTrigger className="h-9 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EC_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">{level.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[9px] text-muted-foreground">
          {EC_LEVELS.find((l) => l.value === design.errorCorrection)?.description}
        </p>
      </div>

      {/* Quiet Zone */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Quiet Zone</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px]">
                  <p className="text-xs">White space around the QR code. At least 16px recommended for reliable scanning.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{design.quietZone ?? 20}px</span>
        </div>
        <Slider
          value={[design.quietZone ?? 20]}
          min={0}
          max={50}
          step={2}
          onValueChange={([val]) => updateDesign({ quietZone: val })}
          className="py-2"
        />
      </div>

      {/* QR Size */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs font-semibold text-muted-foreground">Preview Size</Label>
          <span className="text-[10px] text-muted-foreground tabular-nums">{design.size || 300}px</span>
        </div>
        <Slider
          value={[design.size || 300]}
          min={200}
          max={600}
          step={50}
          onValueChange={([val]) => updateDesign({ size: val })}
          className="py-2"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>200px</span>
          <span>600px</span>
        </div>
      </div>
    </div>
  );
}

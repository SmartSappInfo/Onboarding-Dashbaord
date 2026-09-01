'use client';

/**
 * SmartSapp Forms 2.0: QR Code Studio & Vector Export
 * 
 * Generates customizable high-resolution QR codes (colors, dimensions)
 * with instant PNG and SVG vector download capabilities.
 */

import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Download, 
  Palette,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Form } from '@/lib/types';
import type { QrCodeConfig } from '@/lib/forms/form-distribution-types';

interface QrStudioCardProps {
  form: Form;
}

export default function QrStudioCard({ form }: QrStudioCardProps) {
  const { toast } = useToast();
  const [dataUrl, setDataUrl] = useState<string>('');
  const [svgString, setSvgString] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [qrConfig, setQrConfig] = useState<QrCodeConfig>({
    foregroundColor: '#000000',
    backgroundColor: '#ffffff',
    size: 512,
    errorCorrectionLevel: 'M',
    includeLogo: false,
    format: 'png',
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
  const targetUrl = `${origin}/p/f/${form.slug || form.id}`;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsGenerating(true);
      try {
        const url = await QRCode.toDataURL(targetUrl, {
          width: qrConfig.size,
          margin: 2,
          color: {
            dark: qrConfig.foregroundColor,
            light: qrConfig.backgroundColor,
          },
          errorCorrectionLevel: qrConfig.errorCorrectionLevel,
        });

        const svg = await QRCode.toString(targetUrl, {
          type: 'svg',
          margin: 2,
          color: {
            dark: qrConfig.foregroundColor,
            light: qrConfig.backgroundColor,
          },
          errorCorrectionLevel: qrConfig.errorCorrectionLevel,
        });

        if (isMounted) {
          setDataUrl(url);
          setSvgString(svg);
        }
      } catch (err) {
        console.error('QR generation error:', err);
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    })();
    return () => { isMounted = false; };
  }, [targetUrl, qrConfig.foregroundColor, qrConfig.backgroundColor, qrConfig.size, qrConfig.errorCorrectionLevel]);

  const handleDownloadPng = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `form-qr-${form.slug || form.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'PNG Downloaded', description: 'High-resolution QR code saved.' });
  };

  const handleDownloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `form-qr-${form.slug || form.id}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'SVG Vector Downloaded', description: 'Print-ready vector QR code saved.' });
  };

  const presetColors = [
    { label: 'Classic Black', fg: '#000000', bg: '#ffffff' },
    { label: 'Brand Indigo', fg: '#4f46e5', bg: '#ffffff' },
    { label: 'Emerald Green', fg: '#059669', bg: '#ffffff' },
    { label: 'Royal Purple', fg: '#7c3aed', bg: '#ffffff' },
    { label: 'Dark Mode', fg: '#ffffff', bg: '#09090b' },
  ];

  return (
    <Card className="rounded-3xl border-border/60 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              QR Code Studio
            </CardTitle>
            <CardDescription className="text-xs">
              Generate and customize high-resolution QR codes for physical flyers, posters, and events.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* QR Customizer Controls */}
          <div className="lg:col-span-7 space-y-4">
            {/* Color Presets */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-primary" />
                Color Theme Presets
              </span>
              <div className="flex flex-wrap gap-2">
                {presetColors.map((p) => {
                  const isSelected = qrConfig.foregroundColor === p.fg && qrConfig.backgroundColor === p.bg;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setQrConfig(prev => ({ ...prev, foregroundColor: p.fg, backgroundColor: p.bg }))}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                        isSelected 
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' 
                          : 'border-border/60 hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full border border-border/40" style={{ backgroundColor: p.fg }} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border/40">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">Foreground Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={qrConfig.foregroundColor}
                    onChange={(e) => setQrConfig(prev => ({ ...prev, foregroundColor: e.target.value }))}
                    className="h-8 w-8 rounded-lg border border-border/60 cursor-pointer p-0.5"
                  />
                  <Input
                    value={qrConfig.foregroundColor}
                    onChange={(e) => setQrConfig(prev => ({ ...prev, foregroundColor: e.target.value }))}
                    className="h-8 text-xs font-mono rounded-lg bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">Background Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={qrConfig.backgroundColor}
                    onChange={(e) => setQrConfig(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="h-8 w-8 rounded-lg border border-border/60 cursor-pointer p-0.5"
                  />
                  <Input
                    value={qrConfig.backgroundColor}
                    onChange={(e) => setQrConfig(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="h-8 text-xs font-mono rounded-lg bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Dimensions & Quality */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">Resolution Size</Label>
                <Select
                  value={String(qrConfig.size)}
                  onValueChange={(val) => setQrConfig(prev => ({ ...prev, size: Number(val) }))}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="256">256 × 256 px (Web)</SelectItem>
                    <SelectItem value="512">512 × 512 px (HD)</SelectItem>
                    <SelectItem value="1024">1024 × 1024 px (Print 300 DPI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">Error Correction</Label>
                <Select
                  value={qrConfig.errorCorrectionLevel}
                  onValueChange={(val) => setQrConfig(prev => ({ ...prev, errorCorrectionLevel: val as 'L'|'M'|'Q'|'H' }))}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Low (7% recovery)</SelectItem>
                    <SelectItem value="M">Medium (15% recovery)</SelectItem>
                    <SelectItem value="Q">Quartile (25% recovery)</SelectItem>
                    <SelectItem value="H">High (30% recovery)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleDownloadPng}
                disabled={!dataUrl || isGenerating}
                className="h-10 px-5 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0 flex-1"
              >
                <Download className="h-4 w-4" />
                Download PNG
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSvg}
                disabled={!svgString || isGenerating}
                className="h-10 px-5 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0 flex-1"
              >
                <Download className="h-4 w-4" />
                Download SVG Vector
              </Button>
            </div>
          </div>

          {/* QR Live Preview Frame */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-3xl bg-muted/10 border border-dashed border-border/60">
            <div className="p-4 rounded-2xl shadow-xl border border-border/60 transition-all duration-300" style={{ backgroundColor: qrConfig.backgroundColor }}>
              {dataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={dataUrl}
                  alt="Form QR Code"
                  className="w-48 h-48 rounded-xl object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-muted-foreground">
                  Generating QR...
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 text-center font-mono truncate max-w-[240px]">
              {targetUrl}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

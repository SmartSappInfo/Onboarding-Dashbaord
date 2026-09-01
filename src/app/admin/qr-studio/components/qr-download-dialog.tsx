'use client';

import * as React from 'react';
import { X, Download, Image, FileCode, FileImage, FileText, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { QRDesign } from '@/lib/types';
import { downloadQR } from './qr-preview';
import { computeScannabilityScore } from './designer/scannability-checker';

interface QRDownloadDialogProps {
  data: string;
  design: QRDesign;
  name: string;
  onClose: () => void;
}

const FORMATS = [
  { value: 'png' as const, label: 'PNG', description: 'Crisp raster image', icon: Image },
  { value: 'jpg' as const, label: 'JPG', description: 'Compressed web image', icon: FileImage },
  { value: 'svg' as const, label: 'SVG Vector', description: 'Lossless infinite scale', icon: FileCode },
  { value: 'pdf' as const, label: 'PDF Print', description: '300 DPI print document', icon: FileText },
];

const SIZES = [
  { label: 'Standard (600px)', size: 600, badge: 'Digital' },
  { label: 'High Res (1200px)', size: 1200, badge: 'HD' },
  { label: 'Ultra HD (2400px)', size: 2400, badge: 'Print 4K' },
];

const PDF_PRESETS = [
  { label: 'A4 Flyer (210 × 297 mm)', format: 'a4', orientation: 'portrait' as const },
  { label: 'A5 Mini Flyer (148 × 210 mm)', format: 'a5', orientation: 'portrait' as const },
  { label: 'US Letter (8.5 × 11 in)', format: 'letter', orientation: 'portrait' as const },
  { label: 'Table Tent (4 × 6 in)', format: [288, 432] as [number, number], orientation: 'portrait' as const },
  { label: 'ID / Event Badge (3.5 × 2 in)', format: [252, 144] as [number, number], orientation: 'landscape' as const },
];

export default function QRDownloadDialog({ data, design, name, onClose }: QRDownloadDialogProps) {
  const [format, setFormat] = React.useState<'png' | 'jpg' | 'svg' | 'pdf'>('png');
  const [sizeIndex, setSizeIndex] = React.useState(1); // default 1200px
  const [pdfPresetIndex, setPdfPresetIndex] = React.useState(0);
  const [downloading, setDownloading] = React.useState(false);

  const scoreData = React.useMemo(() => computeScannabilityScore(design), [design]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const selectedSize = format === 'svg' ? design.size || 1024 : SIZES[sizeIndex].size;
      const exportDesign = { ...design, size: selectedSize };
      const filename = name.replace(/[^a-z0-9]/gi, '-').toLowerCase() || `qr-${Date.now()}`;

      if (format === 'pdf') {
        const QRCodeStyling = (await import('qr-code-styling')).default;
        const { jsPDF } = await import('jspdf');
        const { DEFAULT_QR_DESIGN } = await import('@/lib/qr-constants');
        const merged = { ...DEFAULT_QR_DESIGN, ...exportDesign };

        const qrOpts: Record<string, unknown> = {
          width: 1200,
          height: 1200,
          data: data || 'https://smartsapp.com',
          margin: merged.quietZone ?? 20,
          qrOptions: { errorCorrectionLevel: merged.errorCorrection || 'M' },
          dotsOptions: { color: merged.foregroundColor || '#000000', type: merged.dotStyle || 'square' },
          backgroundOptions: { color: merged.backgroundColor || '#FFFFFF' },
          cornersSquareOptions: { color: merged.cornerSquareColor || merged.foregroundColor || '#000000' },
          cornersDotOptions: { color: merged.cornerDotColor || merged.foregroundColor || '#000000' },
        };

        if (merged.logoUrl) {
          qrOpts.image = merged.logoUrl;
          qrOpts.imageOptions = {
            crossOrigin: 'anonymous',
            margin: merged.logoMargin ?? 5,
            imageSize: (merged.logoSize || 20) / 100,
            hideBackgroundDots: true,
          };
        }

        const qr = new QRCodeStyling(qrOpts);
        const blob = await qr.getRawData('png');
        if (!blob) throw new Error('Failed to generate QR bitmap');

        const imgData = URL.createObjectURL(blob as Blob);
        const img = new window.Image();
        img.src = imgData;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const selectedPdfPreset = PDF_PRESETS[pdfPresetIndex];
        const pdf = new jsPDF({
          orientation: selectedPdfPreset.orientation,
          unit: 'pt',
          format: selectedPdfPreset.format,
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // White background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');

        // Center QR on page
        const qrSizePt = Math.min(pageWidth * 0.55, pageHeight * 0.55);
        const qrX = (pageWidth - qrSizePt) / 2;
        const qrY = (pageHeight - qrSizePt) / 2 - 20;

        pdf.addImage(img, 'PNG', qrX, qrY, qrSizePt, qrSizePt);

        // Header and CTA
        pdf.setFontSize(16);
        pdf.setTextColor(30, 41, 59);
        pdf.text(name, pageWidth / 2, qrY - 24, { align: 'center' });

        pdf.setFontSize(11);
        pdf.setTextColor(100, 116, 139);
        pdf.text(design.frameText || 'Scan with your smartphone camera', pageWidth / 2, qrY + qrSizePt + 24, {
          align: 'center',
        });

        pdf.save(`${filename}.pdf`);
        URL.revokeObjectURL(imgData);
      } else {
        await downloadQR(data, exportDesign, format, filename);
      }
      onClose();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50 duration-200" onClick={onClose}>
      <Card
        className="w-full max-w-lg p-6 rounded-3xl border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Export QR Code</h3>
              <p className="text-xs text-muted-foreground">{name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Format Selection Tabs */}
        <div className="space-y-2.5 mb-5">
          <Label className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">Export Format</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {FORMATS.map((f) => {
              const isSelected = format === f.value;
              const IconComp = f.icon;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground'
                      : 'border-border bg-card hover:border-primary/30 text-muted-foreground'
                  }`}
                >
                  {f.value === 'svg' && (
                    <span className="absolute -top-2 bg-emerald-500 text-white text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-full shadow-sm">
                      Vector
                    </span>
                  )}
                  {f.value === 'pdf' && (
                    <span className="absolute -top-2 bg-blue-500 text-white text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-full shadow-sm">
                      300 DPI
                    </span>
                  )}
                  <IconComp className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-bold">{f.label}</span>
                  <span className="text-[8px] text-muted-foreground text-center leading-tight">{f.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PDF Presets */}
        {format === 'pdf' && (
          <div className="space-y-2 mb-5 p-3.5 rounded-2xl bg-muted/20 border border-border">
            <Label className="text-xs font-semibold text-foreground">Print Page Template</Label>
            <Select value={String(pdfPresetIndex)} onValueChange={(val) => setPdfPresetIndex(Number(val))}>
              <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {PDF_PRESETS.map((p, idx) => (
                  <SelectItem key={p.label} value={String(idx)} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Raster Resolution Multipliers (PNG/JPG only) */}
        {(format === 'png' || format === 'jpg') && (
          <div className="space-y-2 mb-5">
            <Label className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">Image Resolution</Label>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s, idx) => {
                const isSelected = sizeIndex === idx;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSizeIndex(idx)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer active:scale-[0.97] ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span className="text-xs">{s.label}</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">{s.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scannability Guard Banner */}
        {scoreData.score < 65 && (
          <div className="p-3 mb-5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex gap-2.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Scannability Warning ({scoreData.grade} - {scoreData.score}%): </span>
              This design has lower contrast ({scoreData.contrastRatio.toFixed(1)}:1). Test thoroughly before printing large quantities.
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-xl text-xs font-semibold px-5 active:scale-[0.97]"
          >
            {downloading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download {format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

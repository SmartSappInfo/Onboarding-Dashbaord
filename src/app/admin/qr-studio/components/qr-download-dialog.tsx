'use client';

import * as React from 'react';
import { X, Download, Image, FileCode, FileImage, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { QRDesign } from '@/lib/types';
import { downloadQR } from './qr-preview';

interface QRDownloadDialogProps {
  data: string;
  design: QRDesign;
  name: string;
  onClose: () => void;
}

const FORMATS = [
  { value: 'png' as const, label: 'PNG', description: 'Best for digital use', icon: Image },
  { value: 'jpg' as const, label: 'JPG', description: 'Compressed for web', icon: FileImage },
  { value: 'svg' as const, label: 'SVG', description: 'Scalable for print', icon: FileCode },
  { value: 'pdf' as const, label: 'PDF', description: 'Print-ready document', icon: FileText },
];

const SIZES = [
  { label: '1x (300px)', size: 300 },
  { label: '2x (600px)', size: 600 },
  { label: '4x (1200px)', size: 1200 },
];

export default function QRDownloadDialog({ data, design, name, onClose }: QRDownloadDialogProps) {
  const [format, setFormat] = React.useState<'png' | 'jpg' | 'svg' | 'pdf'>('png');
  const [sizeIndex, setSizeIndex] = React.useState(1); // default 2x
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const selectedSize = (format === 'svg' || format === 'pdf') ? design.size || 600 : SIZES[sizeIndex].size;
      const exportDesign = { ...design, size: selectedSize };
      const filename = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

      if (format === 'pdf') {
        // Generate QR as PNG first, then wrap in PDF
        const QRCodeStyling = (await import('qr-code-styling')).default;
        const { jsPDF } = await import('jspdf');
        const { DEFAULT_QR_DESIGN } = await import('@/lib/qr-constants');
        const merged = { ...DEFAULT_QR_DESIGN, ...exportDesign };
        const qrOpts: any = {
          width: selectedSize, height: selectedSize,
          data: data || 'https://smartsapp.com',
          margin: merged.quietZone ?? 20,
          qrOptions: { errorCorrectionLevel: merged.errorCorrection || 'M' },
          dotsOptions: { color: merged.foregroundColor || '#000000', type: merged.dotStyle || 'square' },
          backgroundOptions: { color: merged.backgroundColor || '#FFFFFF' },
        };
        if (merged.logoUrl) {
          qrOpts.image = merged.logoUrl;
          qrOpts.imageOptions = { crossOrigin: 'anonymous', margin: 5, imageSize: (merged.logoSize || 20) / 100, hideBackgroundDots: true };
        }
        const qr = new QRCodeStyling(qrOpts);
        const blob = await qr.getRawData('png');
        if (!blob) throw new Error('Failed to generate QR');
        const imgData = URL.createObjectURL(blob as Blob);
        const img = new window.Image();
        img.src = imgData;
        await new Promise(resolve => { img.onload = resolve; });

        const padding = 60;
        const pdfW = selectedSize + padding * 2;
        const pdfH = selectedSize + padding * 2 + 40;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pdfW, pdfH] });
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfW, pdfH, 'F');
        pdf.addImage(img, 'PNG', padding, padding, selectedSize, selectedSize);
        // Add name below
        pdf.setFontSize(12);
        pdf.setTextColor(100, 100, 100);
        pdf.text(name, pdfW / 2, selectedSize + padding + 30, { align: 'center' });
        pdf.save(`${filename}.pdf`);
        URL.revokeObjectURL(imgData);
      } else {
        await downloadQR(data, exportDesign, format, filename);
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="w-full max-w-md mx-4 p-6 rounded-2xl border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-foreground">Download QR Code</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Format Selection */}
        <div className="space-y-3 mb-6">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Format</p>
          <div className="grid grid-cols-3 gap-3">
            {FORMATS.map((f) => {
              const isSelected = format === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  {f.value === 'svg' && (
                    <div className="absolute -top-2.5 inset-x-0 flex justify-center">
                      <span className="bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                        For Print
                      </span>
                    </div>
                  )}
                  <f.icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{f.label}</span>
                  <span className="text-[9px] text-muted-foreground text-center">{f.description}</span>
                </button>
              );
            })}
          </div>

          {format === 'svg' && design.logoUrl && design.errorCorrection !== 'H' && design.errorCorrection !== 'Q' && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1 text-left">
                <p className="text-xs font-semibold">Print Warning</p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  Your QR code has a logo but the Error Correction level is low ({design.errorCorrection}). Before printing, we recommend increasing it to High (H) or Quartile (Q) in the Design tab to ensure scannability.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Size Selection (not for SVG/PDF) */}
        {format !== 'svg' && format !== 'pdf' && (
          <div className="space-y-3 mb-6">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Size</p>
            <div className="grid grid-cols-3 gap-3">
              {SIZES.map((s, i) => {
                const isSelected = sizeIndex === i;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSizeIndex(i)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Download Button */}
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full rounded-xl h-12 font-semibold text-sm shadow-lg shadow-primary/20"
        >
          {downloading ? (
            <span className="animate-pulse">Generating...</span>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download {format.toUpperCase()}
              {format !== 'svg' && ` — ${SIZES[sizeIndex].label}`}
            </>
          )}
        </Button>
      </Card>
    </div>
  );
}

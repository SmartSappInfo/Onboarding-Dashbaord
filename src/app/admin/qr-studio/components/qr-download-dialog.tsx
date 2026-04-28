'use client';

import * as React from 'react';
import { X, Download, Image, FileCode, FileImage } from 'lucide-react';
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
];

const SIZES = [
  { label: '1x (300px)', size: 300 },
  { label: '2x (600px)', size: 600 },
  { label: '4x (1200px)', size: 1200 },
];

export default function QRDownloadDialog({ data, design, name, onClose }: QRDownloadDialogProps) {
  const [format, setFormat] = React.useState<'png' | 'jpg' | 'svg'>('png');
  const [sizeIndex, setSizeIndex] = React.useState(1); // default 2x
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const selectedSize = format === 'svg' ? design.size || 300 : SIZES[sizeIndex].size;
      const exportDesign = { ...design, size: selectedSize };
      const filename = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      await downloadQR(data, exportDesign, format, filename);
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
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <f.icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{f.label}</span>
                  <span className="text-[9px] text-muted-foreground">{f.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Size Selection (not for SVG) */}
        {format !== 'svg' && (
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

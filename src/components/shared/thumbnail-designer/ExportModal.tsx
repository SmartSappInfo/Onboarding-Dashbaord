'use client';

/**
 * ARCHITECTURE:
 * Enterprise High-Resolution Asset Export Modal (Phase 10)
 * 
 * Provides multi-format asset export generation (PNG, JPEG, WebP, SVG, Print PDF)
 * with scale multipliers (1x, 2x, 4x Ultra-HD) and transparency options.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import type {
  CreativeProject,
  CreativeDocument,
  ExportOptions,
} from '@/lib/creative/creative-types';
import { getExportDimensions } from '@/lib/creative/creative-performance-engine';
import { exportHighResolutionAssetAction } from '@/app/actions/creative-performance-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, FileImage, FileText, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: CreativeProject;
  document: CreativeDocument;
}

export function ExportModal({
  open,
  onOpenChange,
  project,
  document,
}: ExportModalProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ExportOptions['format']>('png');
  const [scale, setScale] = useState<ExportOptions['scale']>(2);
  const [transparent, setTransparent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const baseWidth = document.format === 'youtube_thumbnail' ? 1920 : document.format === 'story' ? 1080 : 1080;
  const baseHeight = document.format === 'youtube_thumbnail' ? 1080 : document.format === 'story' ? 1920 : 1080;
  const dimensions = getExportDimensions(baseWidth, baseHeight, scale);

  const handleExecuteExport = () => {
    startTransition(async () => {
      const res = await exportHighResolutionAssetAction(project.id, document.id, {
        format,
        scale,
        quality: 1.0,
        transparentBackground: transparent,
      });

      if (res.success && res.data) {
        toast({
          title: 'Export Prepared',
          description: `Downloaded ${res.data.filename} (${dimensions.width}×${dimensions.height}px @ ${dimensions.dpi} DPI).`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: 'Export Failed',
          description: res.error || 'Could not export.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <Download className="w-5 h-5 text-emerald-400" /> Export Production Asset
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Format Selector */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Export Format
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {(['png', 'jpeg', 'webp', 'svg', 'pdf'] as const).map((fmt) => {
                const isSelected = format === fmt;
                return (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={cn(
                      'p-2.5 rounded-2xl border text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.96]',
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10 text-white'
                        : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-800'
                    )}
                  >
                    {fmt === 'pdf' ? (
                      <FileText className="w-4 h-4 text-rose-400" />
                    ) : (
                      <FileImage className="w-4 h-4 text-emerald-400" />
                    )}
                    <span className="text-[10px] font-bold uppercase">{fmt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scale Resolution Selector */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Resolution Scale
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { scale: 1 as const, label: '1x Standard', sub: '72 DPI (Web)' },
                { scale: 2 as const, label: '2x Retina', sub: '144 DPI (HD)' },
                { scale: 4 as const, label: '4x Ultra-HD', sub: '300 DPI (Print)' },
              ].map((opt) => {
                const isSelected = scale === opt.scale;
                return (
                  <button
                    key={opt.scale}
                    onClick={() => setScale(opt.scale)}
                    className={cn(
                      'p-3 rounded-2xl border text-left transition-all active:scale-[0.96]',
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/50 shadow-lg text-white'
                        : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-800'
                    )}
                  >
                    <div className="text-xs font-bold text-white">{opt.label}</div>
                    <div className="text-[10px] text-slate-400">{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transparency Toggle (for PNG, WebP, SVG) */}
          {(format === 'png' || format === 'webp' || format === 'svg') && (
            <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Transparent Background</div>
                <div className="text-[10px] text-slate-400">Omit canvas background layer on export</div>
              </div>
              <button
                onClick={() => setTransparent(!transparent)}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative',
                  transparent ? 'bg-emerald-500' : 'bg-slate-800'
                )}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full bg-white transition-transform absolute top-1',
                    transparent ? 'right-1' : 'left-1'
                  )}
                />
              </button>
            </div>
          )}

          {/* Dimensions Geometry Info */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-850 flex items-center justify-between text-xs">
            <span className="text-slate-400">Output Geometry:</span>
            <span className="font-mono font-bold text-emerald-400">
              {dimensions.width} × {dimensions.height} px ({dimensions.dpi} DPI)
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-850">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="h-10 text-xs font-bold border-slate-800 bg-slate-900 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteExport}
              disabled={isPending}
              className="h-10 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg active:scale-[0.97]"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rendering...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Download {format.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

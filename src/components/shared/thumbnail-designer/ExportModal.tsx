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
import { exportHighResolutionAssetAction } from '@/app/actions/creative-performance-actions';
import { getExportDimensions } from '@/lib/creative/creative-performance-engine';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
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

  const baseWidth = document.format?.width || 1920;
  const baseHeight = document.format?.height || 1080;
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
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Download className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              Export Production Asset
              <CardInfoTooltip text="Multi-format asset export generation (PNG, JPEG, WebP, SVG, Print PDF) with scale multipliers and transparency options." />
            </DialogTitle>
            <DialogDescription className="sr-only">
              Multi-format asset export generation (PNG, JPEG, WebP, SVG, Print PDF) with scale multipliers and transparency options.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Format Selector */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Export Format
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {(['png', 'jpeg', 'webp', 'svg', 'pdf'] as const).map((fmt) => {
                const isSelected = format === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-[0.96]',
                      isSelected
                        ? 'bg-muted border-emerald-500/50 shadow-sm text-foreground'
                        : 'bg-background border-border/80 text-muted-foreground hover:border-border'
                    )}
                  >
                    {fmt === 'pdf' ? (
                      <FileText className="w-4 h-4 text-rose-500" />
                    ) : (
                      <FileImage className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span className="text-[10px] font-bold uppercase">{fmt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scale Resolution Selector */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
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
                    type="button"
                    onClick={() => setScale(opt.scale)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.96]',
                      isSelected
                        ? 'bg-muted border-emerald-500/50 shadow-sm text-foreground'
                        : 'bg-background border-border/80 text-muted-foreground hover:border-border'
                    )}
                  >
                    <div className="text-xs font-bold text-foreground">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground">{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transparency Toggle (for PNG, WebP, SVG) */}
          {(format === 'png' || format === 'webp' || format === 'svg') && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-foreground">Transparent Background</div>
                <div className="text-[10px] text-muted-foreground">Omit canvas background layer on export</div>
              </div>
              <button
                type="button"
                onClick={() => setTransparent(!transparent)}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative cursor-pointer',
                  transparent ? 'bg-emerald-600' : 'bg-muted border border-border'
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
          <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Output Geometry:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {dimensions.width} × {dimensions.height} px ({dimensions.dpi} DPI)
            </span>
          </div>
        </div>

        {/* Actions Footer */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="h-10 text-xs font-medium rounded-xl active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExecuteExport}
            disabled={isPending}
            className="h-10 px-5 font-medium text-xs rounded-xl shadow-sm active:scale-[0.97]"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

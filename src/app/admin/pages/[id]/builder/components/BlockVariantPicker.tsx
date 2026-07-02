'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getBlock } from '@/lib/page-builder/registry';
import type { PageBlockType } from '@/lib/types';
import '@/lib/page-builder/blocks'; // Ensure all blocks register themselves

interface BlockVariantPickerProps {
  readonly open: boolean;
  readonly type: PageBlockType | null;
  readonly onSelect: (type: PageBlockType, overrideDefaults: Record<string, unknown>) => void;
  readonly onClose: () => void;
}

const DIALOG_ANIMATION = `
  @keyframes variantPickerIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
  .variant-picker-content {
    animation: variantPickerIn 250ms cubic-bezier(0.23, 1, 0.32, 1) both;
  }
  @media (prefers-reduced-motion: reduce) {
    .variant-picker-content {
      animation: none;
      transition: opacity 150ms ease-out;
    }
  }
`;

export const BlockVariantPicker = React.memo(function BlockVariantPicker({
  open,
  type,
  onSelect,
  onClose,
}: BlockVariantPickerProps) {
  const def = type ? getBlock(type) : undefined;
  const variants = def?.variants;

  // Render nothing if there are no pre-defined variants or no valid definitions
  if (!variants || variants.length === 0) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DIALOG_ANIMATION }} />
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent
          className="variant-picker-content max-w-2xl bg-slate-900 border-slate-800 text-slate-100 animate-none"
          aria-describedby="variant-picker-description"
        >
          <DialogHeader>
            <DialogTitle className="text-xs font-black uppercase tracking-widest text-slate-300">
              Choose a {def.label} variant
            </DialogTitle>
            <DialogDescription id="variant-picker-description" className="text-[11px] text-slate-400">
              Select a pre-configured template layout to insert onto the canvas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 pt-3">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                aria-label={`Insert ${variant.label} layout`}
                onClick={() => onSelect(type!, variant.defaults)}
                className="group relative flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-left transition-all active:scale-[0.97] hover:border-emerald-500/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800/50">
                  {variant.thumbnail}
                </div>
                <span className="text-[11px] font-bold tracking-tight text-slate-200">{variant.label}</span>
                {variant.description ? (
                  <span className="text-[10px] text-slate-400 leading-snug">{variant.description}</span>
                ) : null}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

BlockVariantPicker.displayName = 'BlockVariantPicker';

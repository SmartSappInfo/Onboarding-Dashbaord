'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ThumbnailDesigner from './ThumbnailDesigner';
import type { ThumbnailDesign } from '@/lib/thumbnail/thumbnail-types';

interface ThumbnailDesignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  initialDesign?: ThumbnailDesign;
  onSave: (imageUrl: string) => void;
}

export default function ThumbnailDesignerDialog({
  open,
  onOpenChange,
  workspaceId,
  initialDesign,
  onSave,
}: ThumbnailDesignerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-[100dvh] max-w-none p-0 m-0 border-none rounded-none flex flex-col shadow-2xl overflow-hidden bg-slate-950">
        <DialogTitle className="sr-only">AI Thumbnail Designer</DialogTitle>
        <DialogDescription className="sr-only">Interactive canvas to design high CTR cover thumbnails.</DialogDescription>
        <div className="flex-1 overflow-hidden">
          <ThumbnailDesigner
            workspaceId={workspaceId}
            initialDesign={initialDesign}
            onSave={(url) => {
              onSave(url);
              onOpenChange(false);
            }}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

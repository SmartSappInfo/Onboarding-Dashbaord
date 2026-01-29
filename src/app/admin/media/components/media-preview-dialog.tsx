'use client';

import Image from 'next/image';
import type { MediaAsset } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface MediaPreviewDialogProps {
  asset: MediaAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MediaPreviewDialog({ asset, open, onOpenChange }: MediaPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{asset.name}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 max-h-[70vh] overflow-y-auto">
          {asset.type === 'image' && (
            <div className="relative aspect-video">
                <Image src={asset.url} alt={asset.name} fill className="object-contain" />
            </div>
          )}
          {asset.type === 'video' && (
            <video src={asset.url} controls className="w-full rounded-lg" />
          )}
          {asset.type === 'audio' && (
            <audio src={asset.url} controls className="w-full" />
          )}
          {asset.type === 'document' && (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-muted rounded-lg">
                <p className="mb-4">This is a document file. You can open it in a new tab to view it.</p>
                <Button asChild>
                    <a href={asset.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Document
                    </a>
                </Button>
            </div>
          )}
           {asset.type === 'link' && (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-muted rounded-lg">
                <p className="mb-4">This is a link asset. You can open it in a new tab.</p>
                 <p className="mb-4 text-sm text-muted-foreground break-all">{asset.url}</p>
                <Button asChild>
                    <a href={asset.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Link
                    </a>
                </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

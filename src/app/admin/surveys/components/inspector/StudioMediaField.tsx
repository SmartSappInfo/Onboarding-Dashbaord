'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Modern Full-Width Media Asset Field
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Image as ImageIcon, Upload, Library, X, Check, ExternalLink } from 'lucide-react';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import MediaUploader from '@/app/admin/media/components/media-uploader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface StudioMediaFieldProps {
  label: string;
  description?: string;
  value?: string;
  onChange: (val: string) => void;
  filterType?: 'image' | 'video';
  placeholder?: string;
}

export function StudioMediaField({
  label,
  description,
  value = '',
  onChange,
  filterType = 'image',
  placeholder = 'Paste URL or select from library...',
}: StudioMediaFieldProps) {
  const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);

  const isVideo = filterType === 'video';
  const hasValue = Boolean(value && value.trim().length > 0);

  const handleSelectAsset = (asset: MediaAsset) => {
    onChange(asset.url);
    setIsLibraryOpen(false);
  };

  const handleUploadComplete = (urls: string[]) => {
    if (urls && urls[0]) {
      onChange(urls[0]);
      setIsUploadOpen(false);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl border border-border/80 bg-card shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            {isVideo ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          </div>
          <div>
            <Label className="text-xs font-bold text-foreground">{label}</Label>
            {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
          </div>
        </div>

        {hasValue && (
          <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5 text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
            <Check className="h-2.5 w-2.5 mr-1" /> Attached
          </Badge>
        )}
      </div>

      {/* Media Preview Card if value present */}
      {hasValue && (
        <div className="relative rounded-xl overflow-hidden border border-border/60 bg-muted/30 aspect-video max-h-36 flex items-center justify-center group">
          {isVideo ? (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <Video className="h-8 w-8 text-primary mb-1" />
              <span className="text-xs font-mono font-bold text-foreground truncate max-w-[280px]">
                {value}
              </span>
            </div>
          ) : (
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          )}

          {/* Hover Overlay Controls */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setIsLibraryOpen(true)}
              className="h-8 text-xs font-semibold rounded-lg active:scale-[0.97]"
            >
              <Library className="h-3.5 w-3.5 mr-1" /> Change
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange('')}
              className="h-8 text-xs font-semibold rounded-lg active:scale-[0.97]"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Remove
            </Button>
          </div>
        </div>
      )}

      {/* URL Input & Quick Action Triggers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-10 rounded-xl bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-primary/40 flex-1 font-mono"
          />
          {hasValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange('')}
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Clear field"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="h-9 rounded-xl text-xs font-semibold active:scale-[0.97]"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5 text-primary" /> Direct Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsLibraryOpen(true)}
            className="h-9 rounded-xl text-xs font-semibold active:scale-[0.97]"
          >
            <Library className="h-3.5 w-3.5 mr-1.5 text-primary" /> Media Library
          </Button>
        </div>
      </div>

      {/* Media Selector Dialog */}
      <MediaSelectorDialog
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        onSelectAsset={handleSelectAsset}
        filterType={filterType}
      />

      {/* Direct Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="w-screen h-[100dvh] max-w-none p-0 m-0 border-none rounded-none flex flex-col shadow-2xl overflow-hidden bg-background">
          <DialogHeader className="p-8 border-b bg-muted/10 shrink-0 relative">
            <div className="flex items-center gap-4 w-2/3">
              <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-2xl font-semibold tracking-tight">Direct Asset Upload</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground">
                  Upload and optimize high-resolution institutional media.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 p-8 overflow-y-auto bg-background">
            <MediaUploader
              onUploadSuccess={() => setIsUploadOpen(false)}
              onUploadComplete={handleUploadComplete}
              acceptedFileTypes={[filterType as 'image' | 'video']}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

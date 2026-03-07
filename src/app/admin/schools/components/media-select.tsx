'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageIcon, Video, AudioWaveform, FileText } from 'lucide-react';
import MediaSelectorDialog from '../../media/components/media-selector-dialog';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';
import * as React from 'react';

export interface MediaSelectProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value?: string;
    onValueChange?: (value: string) => void;
    onChange?: (...event: any[]) => void; // From react-hook-form
    filterType?: MediaAsset['type'];
}

const MediaSelect = React.forwardRef<HTMLInputElement, MediaSelectProps>(
  ({ className, value, onValueChange, onChange, filterType = 'image', ...props }, ref) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // This function calls the correct callback, whether it's the standard
  // onValueChange or react-hook-form's onChange.
  const triggerChange = (newValue: string) => {
    if (onValueChange) {
        onValueChange(newValue);
    }
    if (onChange) {
        onChange(newValue);
    }
  }

  const handleSelect = (asset: MediaAsset) => {
    triggerChange(asset.url);
    setIsDialogOpen(false);
  };
  
  const PreviewIcon = () => {
    switch (filterType) {
      case 'video': return <Video className="w-8 h-8 text-muted-foreground" />;
      case 'audio': return <AudioWaveform className="w-8 h-8 text-muted-foreground" />;
      case 'document': return <FileText className="w-8 h-8 text-muted-foreground" />;
      default: return <ImageIcon className="w-8 h-8 text-muted-foreground" />;
    }
  };

  // Helper to determine if the value is likely an image that next/image can handle
  const isLikelyImage = (url?: string) => {
    if (!url) return false;
    // Explicitly exclude common video hosts that might be pasted into image fields
    const isVideoHost = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
    if (isVideoHost) return false;
    
    // Check extension or known high-fidelity image domains
    return url.match(/\.(jpeg|jpg|gif|png|webp|svg|avif)$/i) || 
           url.includes('firebasestorage.googleapis.com') ||
           url.includes('picsum.photos') ||
           url.includes('unsplash.com') ||
           url.includes('logo.clearbit.com');
  };

  return (
    <>
      <div className={cn("flex items-start gap-2", className)}>
        <div className="relative w-24 h-24 border rounded-md flex items-center justify-center bg-muted shrink-0">
          {value && filterType === 'image' && isLikelyImage(value) ? (
            <Image src={value} alt="Preview" fill className="object-contain rounded-md p-1" />
          ) : (
            <PreviewIcon />
          )}
        </div>
        <div className="flex-grow space-y-2">
          <Input 
            value={value || ''}
            onChange={(e) => triggerChange(e.target.value)}
            placeholder="https://... or select from library"
            ref={ref}
            {...props}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
            Select from Library
          </Button>
        </div>
      </div>
      <MediaSelectorDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSelectAsset={handleSelect}
        filterType={filterType}
      />
    </>
  );
});

MediaSelect.displayName = 'MediaSelect';

export { MediaSelect };

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageIcon, Video, AudioWaveform, FileText, AlertCircle } from 'lucide-react';
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

  const isInvalid = value && filterType === 'image' && !isLikelyImage(value);

  return (
    <>
      <div className={cn("space-y-2 w-full", className)}>
        <div className="flex items-start gap-2">
            <div className={cn(
                "relative w-24 h-24 border rounded-2xl flex items-center justify-center bg-muted shrink-0 transition-colors",
                isInvalid ? "border-rose-500/50 bg-rose-50" : "border-border"
            )}>
            {value && filterType === 'image' && isLikelyImage(value) ? (
                <Image src={value} alt="Preview" fill className="object-contain rounded-[inherit] p-1" />
            ) : (
                <PreviewIcon />
            )}
            </div>
            <div className="flex-grow space-y-2 min-w-0">
            <Input 
                value={value || ''}
                onChange={(e) => triggerChange(e.target.value)}
                placeholder="https://... or select from library"
                className={cn(
                    "h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 transition-all",
                    isInvalid ? "focus:ring-rose-500/30" : "focus:ring-primary/20"
                )}
                ref={ref}
                {...props}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(true)} className="rounded-lg font-bold border-border/50 text-[10px] uppercase tracking-widest h-8">
                Select from Library
            </Button>
            </div>
        </div>
        
        {isInvalid && (
            <motion.div 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100"
            >
                <AlertCircle className="h-3 w-3 shrink-0" />
                <p className="text-[9px] font-bold uppercase tracking-tight leading-none">
                    Format Mismatch: Image expected, but link looks like a video or external page.
                </p>
            </motion.div>
        )}
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

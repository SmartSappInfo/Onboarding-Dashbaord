'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageIcon, Video, AudioWaveform, FileText, AlertCircle, Upload, Library, Loader2 } from 'lucide-react';
import MediaSelectorDialog from '../../media/components/media-selector-dialog';
import MediaUploader from '../../media/components/media-uploader';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export interface MediaSelectProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value?: string;
    onValueChange?: (value: string) => void;
    onChange?: (...event: any[]) => void; // From react-hook-form
    filterType?: MediaAsset['type'];
}

const MediaSelect = React.forwardRef<HTMLInputElement, MediaSelectProps>(
  ({ className, value, onValueChange, onChange, filterType = 'image', ...props }, ref) => {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

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
    setIsLibraryOpen(false);
  };

  const handleUploadComplete = (asset: MediaAsset) => {
    triggerChange(asset.url);
    // Note: MediaUploader handles its own success state, we just need to wait or close
  };
  
  const PreviewIcon = () => {
    switch (filterType) {
 case 'video': return <Video className="w-8 h-8 text-muted-foreground" />;
 case 'audio': return <AudioWaveform className="w-8 h-8 text-muted-foreground" />;
 case 'document': return <FileText className="w-8 h-8 text-muted-foreground" />;
 default: return <ImageIcon className="w-8 h-8 text-muted-foreground" />;
    }
  };

  const isLikelyImage = (url?: string) => {
    if (!url) return false;
    const isVideoHost = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
    if (isVideoHost) return false;
    return url.match(/\.(jpeg|jpg|gif|png|webp|svg|avif)$/i) || 
           url.includes('firebasestorage.googleapis.com') ||
           url.includes('picsum.photos') ||
           url.includes('unsplash.com') ||
           url.includes('logo.clearbit.com') ||
           url.includes('dribbble.com');
  };

  const isInvalid = value && filterType === 'image' && !isLikelyImage(value);

  return (
    <>
 <div className={cn("space-y-2 w-full", className)}>
 <div className="flex items-start gap-3">
 <div className={cn(
                "relative w-24 h-24 border-2 rounded-2xl flex items-center justify-center bg-muted shrink-0 transition-all duration-300",
                isInvalid ? "border-rose-500/50 bg-rose-50" : "border-border hover:border-primary/20"
            )}>
            {value && filterType === 'image' && isLikelyImage(value) ? (
                /* Use standard img for external URLs to avoid unconfigured host errors */
                <img 
                    src={value} 
                    alt="Preview" 
 className="w-full h-full object-contain rounded-[inherit] p-2" 
                />
            ) : (
                <PreviewIcon />
            )}
            </div>
 <div className="flex-grow space-y-3 min-w-0">
                <Input 
                    value={value || ''}
                    onChange={(e) => triggerChange(e.target.value)}
                    placeholder="https://... or use buttons below"
 className={cn(
                        "h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 transition-all font-medium",
                        isInvalid ? "focus:ring-rose-500/30" : "focus:ring-primary/20"
                    )}
                    ref={ref}
                    {...props}
                />
 <div className="flex items-center gap-2">
 <Button type="button" variant="outline" size="sm" onClick={() => setIsUploadOpen(true)} className="rounded-xl font-semibold border-primary/10 text-[10px] h-9 px-4 hover:bg-primary/5 hover:text-primary transition-all">
 <Upload className="mr-2 h-3.5 w-3.5" /> Upload New
                    </Button>
 <Button type="button" variant="outline" size="sm" onClick={() => setIsLibraryOpen(true)} className="rounded-xl font-semibold border-primary/10 text-[10px] h-9 px-4 hover:bg-primary/5 hover:text-primary transition-all">
 <Library className="mr-2 h-3.5 w-3.5" /> Library
                    </Button>
                </div>
            </div>
        </div>
        
        <AnimatePresence>
            {isInvalid && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
 className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 overflow-hidden"
                >
 <AlertCircle className="h-3 w-3 shrink-0" />
 <p className="text-[9px] font-semibold tracking-tight leading-none">
                        Format Mismatch: Image expected, but link looks like a video or external page.
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      <MediaSelectorDialog 
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        onSelectAsset={handleSelect}
        filterType={filterType}
      />

      <Sheet open={isUploadOpen} onOpenChange={setIsUploadOpen}>
 <SheetContent className="w-full sm:max-w-5xl p-0 flex flex-col h-full border-none shadow-2xl rounded-l-[3rem]">
 <SheetHeader className="p-8 border-b bg-muted/30 shrink-0">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
 <Upload className="h-6 w-6" />
                </div>
 <div className="text-left">
 <SheetTitle className="text-2xl font-semibold tracking-tight">Direct Upload</SheetTitle>
 <SheetDescription className="text-xs font-bold text-muted-foreground">Upload and optimize institutional branding assets.</SheetDescription>
                </div>
            </div>
          </SheetHeader>
 <div className="flex-1 p-8 overflow-y-auto bg-background">
            <MediaUploader 
                onUploadSuccess={() => setIsUploadOpen(false)} 
                onUploadComplete={handleUploadComplete}
                acceptedFileTypes={[filterType as any]}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});

MediaSelect.displayName = 'MediaSelect';

export { MediaSelect };

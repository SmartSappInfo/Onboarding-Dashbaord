'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageIcon } from 'lucide-react';
import MediaSelectorDialog from '../../media/components/media-selector-dialog';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';
import * as React from 'react';

export interface MediaSelectProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value?: string;
    onValueChange?: (value: string) => void;
}

const MediaSelect = React.forwardRef<HTMLInputElement, MediaSelectProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSelect = (asset: MediaAsset) => {
    onValueChange?.(asset.url);
    setIsDialogOpen(false);
  };

  return (
    <>
      <div className={cn("flex items-start gap-2", className)}>
        <div className="relative w-24 h-24 border rounded-md flex items-center justify-center bg-muted shrink-0">
          {value ? (
            <Image src={value} alt="Preview" fill className="object-contain rounded-md p-1" />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-grow space-y-2">
          <Input 
            value={value || ''}
            onChange={(e) => onValueChange?.(e.target.value)}
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
        filterType="image"
      />
    </>
  );
});

MediaSelect.displayName = 'MediaSelect';

export { MediaSelect };

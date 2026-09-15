'use client';

/**
 * @fileOverview Standardized MediaSelect Component — Single Source of Truth Dispatcher
 * 
 * Automatically delegates to the unified ImageUploader, VideoUploader, or DocumentUploader
 * based on filterType to provide complete cross-platform consistency.
 * 
 * Strict compliance with Workspace Rules:
 * - Strict Typing: Zero 'any' or 'any[]'.
 * - Accessible: Proper ARIA labels, focus outlines, minimum touch targets.
 */

import * as React from 'react';
import { useState } from 'react';
import { ImageUploader } from '@/components/shared/image-uploader';
import { VideoUploader, type VideoUploaderValue } from '@/components/shared/video-uploader';
import { DocumentUploader } from '@/components/shared/document-uploader';
import MediaSelectorDialog from '../../media/components/media-selector-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AudioWaveform, Library } from 'lucide-react';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface MediaSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onChange?: ((value: string) => void) | ((event: React.ChangeEvent<HTMLInputElement>) => void);
  filterType?: MediaAsset['type'];
  label?: string;
  description?: string;
  category?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  workspaceId?: string;
  aspectRatio?: 'video' | 'square' | 'banner' | 'auto';
  name?: string;
  id?: string;
}

export const MediaSelect = React.forwardRef<HTMLInputElement, MediaSelectProps>(
  (
    {
      className,
      value,
      onValueChange,
      onChange,
      filterType = 'image',
      label,
      description,
      category = 'General',
      workspaceId,
      aspectRatio = 'auto',
      placeholder: _placeholder,
      disabled: _disabled,
      ..._rest
    }: MediaSelectProps,
    _ref
  ) => {
    const [audioLibraryOpen, setAudioLibraryOpen] = useState(false);
    const hiddenInputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(_ref, () => hiddenInputRef.current as HTMLInputElement);

    const triggerChange = React.useCallback(
      (newValue: string) => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = newValue;
        }
        if (onValueChange) {
          onValueChange(newValue);
        }
        if (onChange) {
          try {
            (onChange as (val: string) => void)(newValue);
          } catch {
            // Safety fallback for React Hook Form or synthetic event handlers
            if (hiddenInputRef.current) {
              const syntheticEvent = {
                target: hiddenInputRef.current,
                currentTarget: hiddenInputRef.current,
                preventDefault: () => {},
                stopPropagation: () => {},
              } as unknown as React.ChangeEvent<HTMLInputElement>;
              try {
                (onChange as (e: React.ChangeEvent<HTMLInputElement>) => void)(syntheticEvent);
              } catch (e) {
                console.warn('[MediaSelect] onChange invocation failed:', e);
              }
            }
          }
        }
      },
      [onValueChange, onChange]
    );

    const hiddenInput = (
      <input
        type="hidden"
        ref={hiddenInputRef}
        value={value || ''}
        name={_rest.name}
        id={_rest.id}
      />
    );

    // Video media selection
    if (filterType === 'video') {
      return (
        <div className={cn('w-full', className)}>
          {hiddenInput}
          <VideoUploader
            value={value || ''}
            onChange={(val: VideoUploaderValue) => triggerChange(val.videoUrl)}
            label={label}
            description={description}
            workspaceId={workspaceId}
          />
        </div>
      );
    }

    // Document media selection
    if (filterType === 'document') {
      return (
        <div className={cn('w-full space-y-1.5', className)}>
          {label && (
            <label className="text-xs font-semibold text-foreground">
              {label}
            </label>
          )}
          {description && (
            <p className="text-[11px] text-muted-foreground">
              {description}
            </p>
          )}
          {hiddenInput}
          <DocumentUploader
            value={value || ''}
            onChange={(url: string) => triggerChange(url)}
            workspaceId={workspaceId}
          />
        </div>
      );
    }

    // Audio media selection
    if (filterType === 'audio') {
      return (
        <>
          <div className={cn('space-y-2 w-full', className)}>
            {hiddenInput}
            {label && (
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                {label}
              </label>
            )}
            {value ? (
              <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <AudioWaveform className="w-5 h-5 text-primary shrink-0" />
                  <audio controls src={value} className="h-8 max-w-[260px]" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => triggerChange('')}
                  className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={value || ''}
                  onChange={(e) => triggerChange(e.target.value)}
                  placeholder="Paste audio URL (.mp3, .wav)..."
                  className="h-10 rounded-xl bg-muted/20 border-border text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAudioLibraryOpen(true)}
                  className="h-10 rounded-xl text-xs font-semibold gap-1.5 shrink-0"
                >
                  <Library className="w-4 h-4" /> Media Library
                </Button>
              </div>
            )}
            {description && (
              <p className="text-[10px] text-muted-foreground">{description}</p>
            )}
          </div>
          <MediaSelectorDialog
            open={audioLibraryOpen}
            onOpenChange={setAudioLibraryOpen}
            onSelectAsset={(asset) => {
              triggerChange(asset.url);
              setAudioLibraryOpen(false);
            }}
            filterType="audio"
            workspaceId={workspaceId}
          />
        </>
      );
    }

    // Default: Unified Image Uploader
    return (
      <div className={cn('w-full', className)}>
        {hiddenInput}
        <ImageUploader
          value={value || ''}
          onChange={triggerChange}
          label={label}
          description={description}
          category={category}
          workspaceId={workspaceId}
          aspectRatio={aspectRatio}
        />
      </div>
    );
  }
);

MediaSelect.displayName = 'MediaSelect';

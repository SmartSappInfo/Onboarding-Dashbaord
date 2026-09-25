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
import { ImageUploader } from '@/components/shared/image-uploader';
import { VideoUploader, type VideoUploaderValue } from '@/components/shared/video-uploader';
import { DocumentUploader } from '@/components/shared/document-uploader';
import { AudioUploader } from '@/components/shared/audio-uploader';
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
        <div className={cn('w-full', className)}>
          {hiddenInput}
          <AudioUploader
            value={value || ''}
            onChange={(url: string) => triggerChange(url)}
            label={label}
            description={description}
            workspaceId={workspaceId}
          />
        </div>
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

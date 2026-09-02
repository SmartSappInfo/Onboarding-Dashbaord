'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Standardized Studio Media Field
 * 
 * Delegates directly to the Single Source of Truth shared ImageUploader and VideoUploader.
 */

import * as React from 'react';
import { ImageUploader } from '@/components/shared/image-uploader';
import { VideoUploader, type VideoUploaderValue } from '@/components/shared/video-uploader';

export interface StudioMediaFieldProps {
  label: string;
  description?: string;
  value?: string;
  onChange: (val: string) => void;
  filterType?: 'image' | 'video';
  placeholder?: string;
  className?: string;
}

export function StudioMediaField({
  label,
  description,
  value = '',
  onChange,
  filterType = 'image',
  className,
}: StudioMediaFieldProps) {
  if (filterType === 'video') {
    return (
      <VideoUploader
        value={value}
        onChange={(val: VideoUploaderValue) => onChange(val.videoUrl)}
        label={label}
        description={description}
        className={className}
      />
    );
  }

  return (
    <ImageUploader
      value={value}
      onChange={onChange}
      label={label}
      description={description}
      className={className}
      aspectRatio="auto"
    />
  );
}

'use client';

/**
 * @fileOverview SmartSapp Unified Image Uploader — Single Source of Truth
 * 
 * Supports drag-and-drop upload, Firebase Storage upload with progress meter,
 * Media Library selection, direct URL links, full-screen previews, and responsive aspect ratios.
 */

import React, { useState, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { uploadPageImage } from '@/lib/page-builder/upload';
import { EmptyState } from './EmptyState';
import { UploadingState } from './UploadingState';
import { UploadedState } from './UploadedState';
import { UrlDialog } from './UrlDialog';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import { Label } from '@/components/ui/label';
import { Image as ImageIcon } from 'lucide-react';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  workspaceId?: string;
  label?: string;
  description?: string;
  category?: string;
  maxSizeMB?: number;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'banner' | 'auto';
}

export function ImageUploader({
  value,
  onChange,
  workspaceId: propWorkspaceId,
  label,
  description,
  category = 'General',
  maxSizeMB = 5,
  className,
  aspectRatio = 'auto',
}: ImageUploaderProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace() as { activeWorkspaceId: string | null };
  const effectiveWorkspaceId = propWorkspaceId || activeWorkspaceId || undefined;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tempPreview, setTempPreview] = useState<string>('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const handleTriggerReplace = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
    e.target.value = '';
  };

  const handleFileSelect = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File size too large',
        description: `Image size must be less than ${maxSizeMB}MB.`
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    const objectUrl = URL.createObjectURL(file);
    setTempPreview(objectUrl);

    try {
      const directWorkspaceId = effectiveWorkspaceId || 'temp';
      const downloadUrl = await uploadPageImage(file, directWorkspaceId, (percent: number) => {
        setUploadProgress(percent);
      });

      // Register in media library if workspaceId is present
      if (effectiveWorkspaceId && firestore && user) {
        const newAssetData = {
          name: file.name,
          originalName: file.name,
          url: downloadUrl,
          fullPath: `media/page-builder/${effectiveWorkspaceId}/${file.name}`,
          type: 'image' as const,
          mimeType: file.type || 'image/jpeg',
          size: file.size,
          uploadedBy: user.uid,
          workspaceIds: [effectiveWorkspaceId],
          category: category,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(firestore, 'media'), newAssetData);
      }

      onChange(downloadUrl);
      toast({
        title: 'Image uploaded successfully',
        description: effectiveWorkspaceId ? 'Registered in your Media Library.' : 'Applied successfully.'
      });
    } catch (error) {
      console.error('Image uploader failed:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'An error occurred during file upload.'
      });
    } finally {
      setIsUploading(false);
      setTempPreview('');
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleLinkConfirm = (url: string) => {
    onChange(url);
    toast({
      title: 'Image URL applied',
      description: 'Successfully set the direct image link.'
    });
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      {label && (
        <div className="space-y-0.5 text-left">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10 text-primary">
              <ImageIcon className="h-3.5 w-3.5" />
            </div>
            <Label className="text-xs font-bold text-foreground">{label}</Label>
          </div>
          {description && (
            <p className="text-[10px] text-muted-foreground pl-6">{description}</p>
          )}
        </div>
      )}

      {/* Isolated hidden file input managed at parent root */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {isUploading ? (
        <UploadingState
          previewUrl={tempPreview}
          progress={uploadProgress}
          className={className}
        />
      ) : value ? (
        <UploadedState
          imageUrl={value}
          showGallery={Boolean(effectiveWorkspaceId)}
          onTriggerReplace={handleTriggerReplace}
          onTriggerGallery={() => setGalleryOpen(true)}
          onOpenLink={() => setLinkDialogOpen(true)}
          onRemove={() => onChange('')}
        />
      ) : (
        <EmptyState
          onTriggerReplace={handleTriggerReplace}
          onOpenGallery={() => setGalleryOpen(true)}
          onOpenLink={() => setLinkDialogOpen(true)}
          showGallery={Boolean(effectiveWorkspaceId)}
          maxSizeMB={maxSizeMB}
          className={className}
        />
      )}

      {/* Link Dialog */}
      <UrlDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onConfirm={handleLinkConfirm}
        initialValue={value}
      />

      {/* Media Selector Dialog */}
      {effectiveWorkspaceId && (
        <MediaSelectorDialog
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          onSelectAsset={(asset: MediaAsset) => {
            onChange(asset.url);
            setGalleryOpen(false);
          }}
          filterType="image"
        />
      )}
    </div>
  );
}

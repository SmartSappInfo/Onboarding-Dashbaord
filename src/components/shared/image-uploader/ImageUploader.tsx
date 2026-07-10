'use client';

import React, { useState, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadPageImage } from '@/lib/page-builder/upload';
import { EmptyState } from './EmptyState';
import { UploadingState } from './UploadingState';
import { UploadedState } from './UploadedState';
import { UrlDialog } from './UrlDialog';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import type { MediaAsset } from '@/lib/types';

export interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  workspaceId?: string;
  label?: string;
  category?: string;
  maxSizeMB?: number;
  className?: string;
}

export function ImageUploader({
  value,
  onChange,
  workspaceId,
  label,
  category = 'General',
  maxSizeMB = 5,
  className
}: ImageUploaderProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
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
      const directWorkspaceId = workspaceId || 'temp';
      const downloadUrl = await uploadPageImage(file, directWorkspaceId, (percent: number) => {
        setUploadProgress(percent);
      });

      // Register in media library if workspaceId is present
      if (workspaceId && firestore && user) {
        const newAssetData = {
          name: file.name,
          originalName: file.name,
          url: downloadUrl,
          fullPath: `media/page-builder/${workspaceId}/${file.name}`,
          type: 'image' as const,
          mimeType: file.type || 'image/jpeg',
          size: file.size,
          uploadedBy: user.uid,
          workspaceIds: [workspaceId],
          category: category,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(firestore, 'media'), newAssetData);
      }

      onChange(downloadUrl);
      toast({
        title: 'Image uploaded successfully',
        description: workspaceId ? 'Registered in your Media.' : 'Applied successfully.'
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
    <div className="w-full">
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
          showGallery={!!workspaceId}
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
          showGallery={!!workspaceId}
          maxSizeMB={maxSizeMB}
          className={className}
        />
      )}
      
      <UrlDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onConfirm={handleLinkConfirm}
      />

      {workspaceId ? (
        <MediaSelectorDialog
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          onSelectAsset={(asset: MediaAsset) => {
            onChange(asset.url);
            setGalleryOpen(false);
          }}
          filterType="image"
          workspaceId={workspaceId}
        />
      ) : null}
    </div>
  );
}


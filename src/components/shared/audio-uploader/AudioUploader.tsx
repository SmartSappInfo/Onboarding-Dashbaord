'use client';

/**
 * @fileOverview SmartSapp Unified Audio Uploader — Single Source of Truth
 * 
 * Supports direct MP3/WAV/OGG/M4A audio uploads with progress tracking,
 * integrated media library asset selection, streaming links, and inline preview player.
 */

import React, { useState, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { uploadPageMedia } from '@/lib/page-builder/upload';
import { EmptyState } from './EmptyState';
import { UploadingState } from './UploadingState';
import { UploadedState } from './UploadedState';
import { UrlDialog } from './UrlDialog';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import { Label } from '@/components/ui/label';
import { Music } from 'lucide-react';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface AudioUploaderProps {
  value?: string;
  onChange: (value: string) => void;
  workspaceId?: string;
  label?: string;
  description?: string;
  maxAudioSizeMB?: number;
  className?: string;
}

export function AudioUploader({
  value = '',
  onChange,
  workspaceId: propWorkspaceId,
  label,
  description,
  maxAudioSizeMB = 25,
  className
}: AudioUploaderProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace() as { activeWorkspaceId: string | null };
  const effectiveWorkspaceId = propWorkspaceId || activeWorkspaceId || undefined;

  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const handleTriggerReplace = () => {
    audioInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleAudioUpload(file);
    }
    e.target.value = '';
  };

  const handleAudioUpload = async (file: File) => {
    if (file.size > maxAudioSizeMB * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Audio size too large',
        description: `Audio file must be less than ${maxAudioSizeMB}MB.`
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadingFileName(file.name);

    try {
      const directWorkspaceId = effectiveWorkspaceId || 'temp';
      const downloadUrl = await uploadPageMedia(file, directWorkspaceId, (percent: number) => {
        setUploadProgress(percent);
      });

      // Register in media library if workspaceId is present
      if (effectiveWorkspaceId && firestore && user) {
        const newAssetData = {
          name: file.name,
          originalName: file.name,
          url: downloadUrl,
          fullPath: `media/page-builder/${effectiveWorkspaceId}/${file.name}`,
          type: 'audio' as const,
          mimeType: file.type || 'audio/mpeg',
          size: file.size,
          uploadedBy: user.uid,
          workspaceIds: [effectiveWorkspaceId],
          category: 'Audio',
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(firestore, 'media'), newAssetData);
      }

      onChange(downloadUrl);
      toast({
        title: 'Audio uploaded successfully',
        description: effectiveWorkspaceId ? 'Registered in your Media Library.' : 'Applied successfully.'
      });
    } catch (error) {
      console.error('Audio upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'An error occurred during audio upload.'
      });
    } finally {
      setIsUploading(false);
      setUploadingFileName('');
    }
  };

  const handleLinkConfirm = (url: string) => {
    onChange(url);
    toast({
      title: 'Audio link applied',
      description: 'Direct audio URL set successfully.'
    });
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      {label && (
        <div className="space-y-0.5 text-left">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-violet-500/10 text-violet-500">
              <Music className="h-3.5 w-3.5" />
            </div>
            <Label className="text-xs font-bold text-foreground">{label}</Label>
          </div>
          {description && (
            <p className="text-[10px] text-muted-foreground pl-6">{description}</p>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
        className="hidden"
        onChange={handleFileChange}
      />

      {isUploading ? (
        <UploadingState
          progress={uploadProgress}
          fileName={uploadingFileName}
          className={className}
        />
      ) : value ? (
        <UploadedState
          audioUrl={value}
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
          maxSizeMB={maxAudioSizeMB}
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
          filterType="audio"
        />
      )}
    </div>
  );
}

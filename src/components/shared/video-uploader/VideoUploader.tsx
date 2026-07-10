'use client';

import React, { useState, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadPageMedia, uploadPageImage } from '@/lib/page-builder/upload';
import { EmptyState } from './EmptyState';
import { UploadingState } from './UploadingState';
import { UploadedState } from './UploadedState';
import { UrlDialog } from './UrlDialog';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import type { MediaAsset } from '@/lib/types';

export interface VideoUploaderValue {
  videoUrl: string;
  thumbnailUrl: string;
  title?: string;
  description?: string;
  fileName?: string;
  fileSize?: string;
}

export interface VideoUploaderProps {
  value?: VideoUploaderValue;
  onChange: (value: VideoUploaderValue) => void;
  workspaceId?: string;
  label?: string;
  maxVideoSizeMB?: number;
  className?: string;
}

function extractYouTubeID(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function VideoUploader({
  value = { videoUrl: '', thumbnailUrl: '', title: '', description: '' },
  onChange,
  workspaceId,
  label,
  maxVideoSizeMB = 150,
  className
}: VideoUploaderProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [tempVideoPreview, setTempVideoPreview] = useState('');

  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState(0);
  const [tempThumbnailPreview, setTempThumbnailPreview] = useState('');

  const [isVideoLinkOpen, setIsVideoLinkOpen] = useState(false);
  const [isThumbnailLinkOpen, setIsThumbnailLinkOpen] = useState(false);
  
  const [isVideoGalleryOpen, setIsVideoGalleryOpen] = useState(false);
  const [isThumbnailGalleryOpen, setIsThumbnailGalleryOpen] = useState(false);

  const handleTriggerVideoReplace = () => {
    videoInputRef.current?.click();
  };

  const handleTriggerThumbnailReplace = () => {
    thumbnailInputRef.current?.click();
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleVideoUpload(file);
    }
    e.target.value = '';
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleThumbnailUpload(file);
    }
    e.target.value = '';
  };

  const handleVideoUpload = async (file: File) => {
    if (file.size > maxVideoSizeMB * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Video size too large',
        description: `Video must be less than ${maxVideoSizeMB}MB.`
      });
      return;
    }

    setIsUploadingVideo(true);
    setVideoProgress(0);
    const objectUrl = URL.createObjectURL(file);
    setTempVideoPreview(objectUrl);

    try {
      const directWorkspaceId = workspaceId || 'temp';
      const downloadUrl = await uploadPageMedia(file, directWorkspaceId, (percent: number) => {
        setVideoProgress(percent);
      });

      // Register in media library if workspaceId is present
      if (workspaceId && firestore && user) {
        const newAssetData = {
          name: file.name,
          originalName: file.name,
          url: downloadUrl,
          fullPath: `media/page-builder/${workspaceId}/${file.name}`,
          type: 'video' as const,
          mimeType: file.type || 'video/mp4',
          size: file.size,
          uploadedBy: user.uid,
          workspaceIds: [workspaceId],
          category: 'Page Builder',
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(firestore, 'media'), newAssetData);
      }

      // Convert size to human readable format
      const kb = file.size / 1024;
      const sizeStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;

      onChange({
        ...value,
        videoUrl: downloadUrl,
        fileName: file.name,
        fileSize: sizeStr
      });

      toast({
        title: 'Video uploaded successfully',
        description: workspaceId ? 'Registered in your Media.' : 'Applied successfully.'
      });
    } catch (error) {
      console.error('Video uploader failed:', error);
      toast({
        variant: 'destructive',
        title: 'Video upload failed',
        description: 'An error occurred during file upload.'
      });
    } finally {
      setIsUploadingVideo(false);
      setTempVideoPreview('');
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    setIsUploadingThumbnail(true);
    setThumbnailProgress(0);
    const objectUrl = URL.createObjectURL(file);
    setTempThumbnailPreview(objectUrl);

    try {
      const directWorkspaceId = workspaceId || 'temp';
      const downloadUrl = await uploadPageImage(file, directWorkspaceId, (percent: number) => {
        setThumbnailProgress(percent);
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
          category: 'Page Builder',
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(firestore, 'media'), newAssetData);
      }

      onChange({
        ...value,
        thumbnailUrl: downloadUrl
      });

      toast({
        title: 'Thumbnail uploaded',
        description: 'Custom cover image applied successfully.'
      });
    } catch (error) {
      console.error('Thumbnail upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'Thumbnail upload failed',
        description: 'An error occurred during file upload.'
      });
    } finally {
      setIsUploadingThumbnail(false);
      setTempThumbnailPreview('');
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleVideoLinkConfirm = (url: string) => {
    // Attempt to derive YouTube thumbnail if not already present
    let derivedThumb = value.thumbnailUrl;
    if (!derivedThumb) {
      const ytid = extractYouTubeID(url);
      if (ytid) {
        derivedThumb = `https://img.youtube.com/vi/${ytid}/maxresdefault.jpg`;
      }
    }

    onChange({
      ...value,
      videoUrl: url,
      thumbnailUrl: derivedThumb,
      fileName: 'linked-video.mp4',
      fileSize: undefined
    });

    toast({
      title: 'Video link applied',
      description: 'Successfully set the direct video URL.'
    });
  };

  const handleThumbnailLinkConfirm = (url: string) => {
    onChange({
      ...value,
      thumbnailUrl: url
    });
    toast({
      title: 'Thumbnail link applied',
      description: 'Successfully set custom cover image URL.'
    });
  };

  const handleMetadataChange = (meta: { title: string; description: string }) => {
    onChange({
      ...value,
      title: meta.title,
      description: meta.description
    });
  };

  const handleRemoveVideo = () => {
    onChange({
      videoUrl: '',
      thumbnailUrl: '',
      title: '',
      description: '',
      fileName: undefined,
      fileSize: undefined
    });
  };

  const handleRemoveThumbnail = () => {
    onChange({
      ...value,
      thumbnailUrl: ''
    });
  };

  return (
    <div className="w-full">
      {/* Hidden file selector inputs */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoFileChange}
      />
      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleThumbnailFileChange}
      />

      {isUploadingVideo ? (
        <UploadingState
          previewUrl={tempVideoPreview}
          progress={videoProgress}
          className={className}
        />
      ) : isUploadingThumbnail ? (
        <UploadingState
          previewUrl={tempThumbnailPreview}
          progress={thumbnailProgress}
          className={className}
        />
      ) : value.videoUrl ? (
        <UploadedState
          videoUrl={value.videoUrl}
          thumbnailUrl={value.thumbnailUrl}
          title={value.title || ''}
          description={value.description || ''}
          fileName={value.fileName}
          fileSize={value.fileSize}
          showGallery={!!workspaceId}
          onTriggerReplaceVideo={handleTriggerVideoReplace}
          onTriggerReplaceThumbnail={handleTriggerThumbnailReplace}
          onTriggerGalleryVideo={() => setIsVideoGalleryOpen(true)}
          onTriggerGalleryThumbnail={() => setIsThumbnailGalleryOpen(true)}
          onOpenLinkVideo={() => setIsVideoLinkOpen(true)}
          onOpenLinkThumbnail={() => setIsThumbnailLinkOpen(true)}
          onRemoveVideo={handleRemoveVideo}
          onRemoveThumbnail={handleRemoveThumbnail}
          onMetadataChange={handleMetadataChange}
        />
      ) : (
        <EmptyState
          onTriggerReplace={handleTriggerVideoReplace}
          onOpenGallery={() => setIsVideoGalleryOpen(true)}
          onOpenLink={() => setIsVideoLinkOpen(true)}
          showGallery={!!workspaceId}
          maxSizeMB={maxVideoSizeMB}
          className={className}
        />
      )}

      {/* URL entry dialogs */}
      <UrlDialog
        open={isVideoLinkOpen}
        onOpenChange={setIsVideoLinkOpen}
        onConfirm={handleVideoLinkConfirm}
      />
      <UrlDialog
        open={isThumbnailLinkOpen}
        onOpenChange={setIsThumbnailLinkOpen}
        onConfirm={handleThumbnailLinkConfirm}
      />

      {/* Media Selector Dialogs */}
      {workspaceId && (
        <>
          <MediaSelectorDialog
            open={isVideoGalleryOpen}
            onOpenChange={setIsVideoGalleryOpen}
            onSelectAsset={(asset: MediaAsset) => {
              onChange({
                ...value,
                videoUrl: asset.url,
                fileName: asset.name,
                fileSize: asset.size ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : undefined
              });
              setIsVideoGalleryOpen(false);
            }}
            filterType="video"
            workspaceId={workspaceId}
          />
          <MediaSelectorDialog
            open={isThumbnailGalleryOpen}
            onOpenChange={setIsThumbnailGalleryOpen}
            onSelectAsset={(asset: MediaAsset) => {
              onChange({
                ...value,
                thumbnailUrl: asset.url
              });
              setIsThumbnailGalleryOpen(false);
            }}
            filterType="image"
            workspaceId={workspaceId}
          />
        </>
      )}
    </div>
  );
}

'use client';

/**
 * @fileOverview SmartSapp Unified Video Uploader — Single Source of Truth
 * 
 * Supports YouTube / Vimeo / MP4 streaming, direct video uploads with progress meter,
 * integrated poster frame / thumbnail management, AI Thumbnail Designer, and Media Library video selection.
 */

import React, { useState, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { uploadPageMedia, uploadPageImage } from '@/lib/page-builder/upload';
import { EmptyState } from './EmptyState';
import { UploadingState } from './UploadingState';
import { UploadedState } from './UploadedState';
import { UrlDialog } from './UrlDialog';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import ThumbnailDesignerDialog from '@/components/shared/thumbnail-designer/ThumbnailDesignerDialog';
import { Label } from '@/components/ui/label';
import { Video } from 'lucide-react';
import type { MediaAsset } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface VideoUploaderValue {
  videoUrl: string;
  thumbnailUrl: string;
  title?: string;
  description?: string;
  fileName?: string;
  fileSize?: string;
}

export interface VideoUploaderProps {
  value?: VideoUploaderValue | string;
  onChange: (value: VideoUploaderValue) => void;
  workspaceId?: string;
  label?: string;
  description?: string;
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
  workspaceId: propWorkspaceId,
  label,
  description,
  maxVideoSizeMB = 150,
  className
}: VideoUploaderProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace() as { activeWorkspaceId: string | null };
  const effectiveWorkspaceId = propWorkspaceId || activeWorkspaceId || undefined;
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const normalizedValue: VideoUploaderValue = React.useMemo(() => {
    if (typeof value === 'string') {
      return { videoUrl: value, thumbnailUrl: '', title: '', description: '' };
    }
    return value || { videoUrl: '', thumbnailUrl: '', title: '', description: '' };
  }, [value]);

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
  const [isAiDesignerOpen, setIsAiDesignerOpen] = useState(false);

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
      const directWorkspaceId = effectiveWorkspaceId || 'temp';
      const downloadUrl = await uploadPageMedia(file, directWorkspaceId, (percent: number) => {
        setVideoProgress(percent);
      });

      // Register in media library if workspaceId is present
      if (effectiveWorkspaceId && firestore && user) {
        const newAssetData = {
          name: file.name,
          originalName: file.name,
          url: downloadUrl,
          fullPath: `media/page-builder/${effectiveWorkspaceId}/${file.name}`,
          type: 'video' as const,
          mimeType: file.type || 'video/mp4',
          size: file.size,
          uploadedBy: user.uid,
          workspaceIds: [effectiveWorkspaceId],
          category: 'Page Builder',
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(firestore, 'media'), newAssetData);
      }

      // Convert size to human readable format
      const kb = file.size / 1024;
      const sizeStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;

      onChange({
        ...normalizedValue,
        videoUrl: downloadUrl,
        thumbnailUrl: '', // Reset thumbnail for new file upload
        fileName: file.name,
        fileSize: sizeStr
      });

      toast({
        title: 'Video uploaded successfully',
        description: effectiveWorkspaceId ? 'Registered in your Media Library.' : 'Applied successfully.'
      });
    } catch (error) {
      console.error('Video upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'Video upload failed',
        description: 'An error occurred during video upload.'
      });
    } finally {
      setIsUploadingVideo(false);
      setTempVideoPreview('');
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Image size too large',
        description: 'Thumbnail image must be less than 5MB.'
      });
      return;
    }

    setIsUploadingThumbnail(true);
    setThumbnailProgress(0);
    const objectUrl = URL.createObjectURL(file);
    setTempThumbnailPreview(objectUrl);

    try {
      const directWorkspaceId = effectiveWorkspaceId || 'temp';
      const downloadUrl = await uploadPageImage(file, directWorkspaceId, (percent: number) => {
        setThumbnailProgress(percent);
      });

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
          category: 'Page Builder',
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(firestore, 'media'), newAssetData);
      }

      onChange({
        ...normalizedValue,
        thumbnailUrl: downloadUrl
      });

      toast({
        title: 'Thumbnail uploaded',
        description: 'Poster frame applied successfully.'
      });
    } catch (error) {
      console.error('Thumbnail upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'Thumbnail upload failed',
        description: 'Failed to upload poster image.'
      });
    } finally {
      setIsUploadingThumbnail(false);
      setTempThumbnailPreview('');
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleVideoLinkConfirm = (url: string) => {
    let thumb = normalizedValue.thumbnailUrl;
    const ytId = extractYouTubeID(url);
    if (ytId && !thumb) {
      thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }

    onChange({
      ...normalizedValue,
      videoUrl: url,
      thumbnailUrl: thumb,
      fileName: 'Streaming Link'
    });

    toast({
      title: 'Video link applied',
      description: 'Stream URL set successfully.'
    });
  };

  const handleThumbnailLinkConfirm = (url: string) => {
    onChange({
      ...normalizedValue,
      thumbnailUrl: url
    });

    toast({
      title: 'Thumbnail link applied',
      description: 'Custom poster frame link set.'
    });
  };

  const handleSelectVideoAsset = (asset: MediaAsset) => {
    onChange({
      ...normalizedValue,
      videoUrl: asset.url,
      fileName: asset.name,
      fileSize: asset.size ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : undefined
    });
    setIsVideoGalleryOpen(false);
  };

  const handleSelectThumbnailAsset = (asset: MediaAsset) => {
    onChange({
      ...normalizedValue,
      thumbnailUrl: asset.url
    });
    setIsThumbnailGalleryOpen(false);
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      {label && (
        <div className="space-y-0.5 text-left">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10 text-primary">
              <Video className="h-3.5 w-3.5" />
            </div>
            <Label className="text-xs font-bold text-foreground">{label}</Label>
          </div>
          {description && (
            <p className="text-[10px] text-muted-foreground pl-6">{description}</p>
          )}
        </div>
      )}

      {/* Hidden inputs */}
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
          label="Uploading video file…"
          isVideo
        />
      ) : isUploadingThumbnail ? (
        <UploadingState
          previewUrl={tempThumbnailPreview}
          progress={thumbnailProgress}
          label="Uploading poster image…"
        />
      ) : normalizedValue.videoUrl ? (
        <UploadedState
          videoUrl={normalizedValue.videoUrl}
          thumbnailUrl={normalizedValue.thumbnailUrl}
          title={normalizedValue.title || ''}
          description={normalizedValue.description || ''}
          fileName={normalizedValue.fileName}
          fileSize={normalizedValue.fileSize}
          showGallery={Boolean(effectiveWorkspaceId)}
          onTriggerReplaceVideo={handleTriggerVideoReplace}
          onTriggerReplaceThumbnail={handleTriggerThumbnailReplace}
          onTriggerGalleryVideo={() => setIsVideoGalleryOpen(true)}
          onTriggerGalleryThumbnail={() => setIsThumbnailGalleryOpen(true)}
          onOpenLinkVideo={() => setIsVideoLinkOpen(true)}
          onOpenLinkThumbnail={() => setIsThumbnailLinkOpen(true)}
          onRemoveVideo={() => onChange({ videoUrl: '', thumbnailUrl: '', title: '', description: '' })}
          onRemoveThumbnail={() => onChange({ ...normalizedValue, thumbnailUrl: '' })}
          onMetadataChange={(meta) => onChange({ ...normalizedValue, ...meta })}
          onOpenAiDesigner={() => setIsAiDesignerOpen(true)}
        />
      ) : (
        <EmptyState
          onTriggerReplaceVideo={handleTriggerVideoReplace}
          onOpenGalleryVideo={() => setIsVideoGalleryOpen(true)}
          onOpenLinkVideo={() => setIsVideoLinkOpen(true)}
          showGallery={Boolean(effectiveWorkspaceId)}
          maxSizeMB={maxVideoSizeMB}
        />
      )}

      {/* Dialogs */}
      <UrlDialog
        open={isVideoLinkOpen}
        onOpenChange={setIsVideoLinkOpen}
        onConfirm={handleVideoLinkConfirm}
        initialValue={normalizedValue.videoUrl}
        title="Link External Video Stream"
        description="Paste a YouTube, Vimeo, or direct MP4 stream URL."
        placeholder="https://www.youtube.com/watch?v=..."
      />

      <UrlDialog
        open={isThumbnailLinkOpen}
        onOpenChange={setIsThumbnailLinkOpen}
        onConfirm={handleThumbnailLinkConfirm}
        initialValue={normalizedValue.thumbnailUrl}
        title="Link Poster Frame Image"
        description="Paste an image URL to use as the video cover."
        placeholder="https://example.com/poster.jpg"
      />

      {effectiveWorkspaceId && (
        <>
          <MediaSelectorDialog
            open={isVideoGalleryOpen}
            onOpenChange={setIsVideoGalleryOpen}
            onSelectAsset={handleSelectVideoAsset}
            filterType="video"
          />
          <MediaSelectorDialog
            open={isThumbnailGalleryOpen}
            onOpenChange={setIsThumbnailGalleryOpen}
            onSelectAsset={handleSelectThumbnailAsset}
            filterType="image"
          />
        </>
      )}

      {/* AI Thumbnail Designer */}
      <ThumbnailDesignerDialog
        open={isAiDesignerOpen}
        onOpenChange={setIsAiDesignerOpen}
        onApply={(url: string) => {
          onChange({
            ...normalizedValue,
            thumbnailUrl: url
          });
          setIsAiDesignerOpen(false);
        }}
        initialTitle={normalizedValue.title || 'Institutional Overview'}
        initialSubtitle={normalizedValue.description || 'Watch to learn more'}
        contextName={normalizedValue.title || 'SmartSapp Video'}
      />
    </div>
  );
}

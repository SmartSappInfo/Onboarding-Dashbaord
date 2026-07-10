# Unified Image Uploader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular, responsive, high-performance `<ImageUploader>` component that supports drag-and-drop, direct storage uploads with radial progress tracking, Firestore media library registration, gallery dialog asset selections, and custom URL links, then integrate it uniformly across the Page Builder, User Profile Settings, and Workspace Onboarding setups.

---

## 1. Plan Updates (Doughnut Menu & Bug Fixes)

### UI Layout Upgrades
1.  **Remove Duplicated Pencil Icons**: Get rid of both the center hover edit overlay and the standalone pencil buttons on the image preview.
2.  **Top-Right Dropdown Option Menu**: Render a single premium round options menu button in the top-right corner of the image card (using the `MoreVertical` icon from `lucide-react`).
3.  **Dropdown Actions**:
    *   **Full Screen Preview**: Open the image inside a sleek, animated Radix/shadcn `Dialog` modal popup.
    *   **Download Image**: Fetch the asset as a blob and force download it locally to support cross-origin files.
    *   **Copy URL**: Write the image URL string to the user's clipboard.
    *   **Replace**: Trigger the uploader's file browser dialog.
    *   **Select from Gallery** (if `workspaceId` is present): Launch the media library dialog.
    *   **Delete/Remove**: Clear the value field.

### Instance Isolation Bug Fix
- **File Input Ref**: Move the `<input type="file" ref={fileInputRef} className="hidden" />` to the root component `ImageUploader.tsx`. Use a React `useRef` to trigger `.click()` instead of performing a global `document.querySelector` which conflicts when multiple uploaders are present on the same page.

---

## 2. Directory Structure

We will create a dedicated module folder:
`src/components/shared/image-uploader/`

The files:
- `index.ts`: Public entry point.
- `UrlDialog.tsx`: Dialog modal for pasting image URLs.
- `EmptyState.tsx`: Dashed border dropzone.
- `UploadingState.tsx`: Upload overlay showing radial and horizontal progress.
- `UploadedState.tsx`: Image preview with dropdown menu & modal preview.
- `ImageUploader.tsx`: Main orchestrator managing refs, storage uploads, and database registration.

---

## 3. Bite-Sized Implementation Tasks

### Task 1: Create Shared Presentational Sub-Components

**Files:**
- Create: `src/components/shared/image-uploader/index.ts`
- Create: `src/components/shared/image-uploader/UrlDialog.tsx`
- Create: `src/components/shared/image-uploader/EmptyState.tsx`
- Create: `src/components/shared/image-uploader/UploadingState.tsx`
- Create: `src/components/shared/image-uploader/UploadedState.tsx`

- [ ] **Step 1: Write index.ts exports**
  Create `src/components/shared/image-uploader/index.ts`:
  ```typescript
  export { ImageUploader } from './ImageUploader';
  export type { ImageUploaderProps } from './ImageUploader';
  ```

- [ ] **Step 2: Create UrlDialog.tsx**
  Create `src/components/shared/image-uploader/UrlDialog.tsx`:
  ```typescript
  import React, { useState } from 'react';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';

  interface UrlDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (url: string) => void;
  }

  export function UrlDialog({ open, onOpenChange, onConfirm }: UrlDialogProps) {
    const [url, setUrl] = useState('');
    const handleConfirm = () => {
      if (url.trim()) {
        onConfirm(url.trim());
        setUrl('');
        onOpenChange(false);
      }
    };
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl border-slate-800 bg-slate-950 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold uppercase tracking-wider text-slate-300">Image URL Link</DialogTitle>
            <DialogDescription className="text-[10px] text-slate-500">
              Paste a direct web link to an image asset.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="url"
              placeholder="https://example.com/image.png"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-10 rounded-xl bg-slate-900 border-slate-800 text-xs font-semibold text-slate-200 focus-visible:ring-emerald-500/30"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-9 text-xs text-slate-400 hover:bg-slate-900">Cancel</Button>
            <Button type="button" onClick={handleConfirm} disabled={!url.trim()} className="h-9 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl">Save Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  ```

- [ ] **Step 3: Create EmptyState.tsx**
  Create `src/components/shared/image-uploader/EmptyState.tsx`:
  ```typescript
  import React, { useState } from 'react';
  import { Upload, FolderHeart, Link as LinkIcon } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { cn } from '@/lib/utils';

  interface EmptyStateProps {
    onTriggerReplace: () => void;
    onOpenGallery: () => void;
    onOpenLink: () => void;
    showGallery: boolean;
    maxSizeMB: number;
    className?: string;
  }

  export function EmptyState({ onTriggerReplace, onOpenGallery, onOpenLink, showGallery, maxSizeMB, className }: EmptyStateProps) {
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setDragActive(true);
      } else if (e.type === 'dragleave') {
        setDragActive(false);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        // Drag select is handled in Parent ImageUploader
      }
    };

    return (
      <div
        className={cn(
          "w-full rounded-2xl border-2 border-dashed transition-all duration-300 p-6 flex flex-col items-center justify-center gap-4 text-center cursor-pointer min-h-[220px]",
          dragActive ? "border-emerald-500 bg-emerald-500/5 scale-[1.01]" : "border-slate-800 bg-slate-900/10 hover:border-slate-700",
          className
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onTriggerReplace}
      >
        <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
          <Upload className="w-5 h-5" />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-300 hidden md:block">
            Drag & drop image here or click to browse
          </p>
          <p className="text-xs font-bold text-slate-300 block md:hidden">
            Tap to upload image or browse
          </p>
          <p className="text-[10px] font-medium text-slate-500">
            PNG • JPG • WEBP • Max {maxSizeMB}MB
          </p>
        </div>

        <div className="flex gap-2 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
          <Button type="button" size="sm" onClick={onTriggerReplace} className="h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 px-3">
            <Upload className="w-3 h-3" /> Upload
          </Button>
          {showGallery && (
            <Button type="button" variant="outline" size="sm" onClick={onOpenGallery} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400 gap-1.5 px-3">
              <FolderHeart className="w-3 h-3" /> Gallery
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onOpenLink} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400 gap-1.5 px-3">
            <LinkIcon className="w-3 h-3" /> Link
          </Button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Create UploadingState.tsx**
  Create `src/components/shared/image-uploader/UploadingState.tsx`:
  ```typescript
  import React from 'react';

  interface UploadingStateProps {
    previewUrl?: string;
    progress: number;
    className?: string;
  }

  export function UploadingState({ previewUrl, progress, className }: UploadingStateProps) {
    return (
      <div className="w-full relative h-[220px] rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center text-center">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Uploading preview" className="absolute inset-0 w-full h-full object-cover z-0 blur-md opacity-30" />
        ) : null}
        
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-800" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-emerald-500 transition-all duration-300" strokeDasharray={`${progress}, 100`} strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <span className="text-[10px] font-black text-slate-200">{progress}%</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase animate-pulse">Uploading...</span>
        </div>
        
        <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-900/50">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 5: Create UploadedState.tsx (with Dropdown Menu & full-screen modal preview)**
  Create `src/components/shared/image-uploader/UploadedState.tsx`:
  ```typescript
  import React, { useState } from 'react';
  import { MoreVertical, Download, Copy, Maximize2, RefreshCw, FolderHeart, Trash2 } from 'lucide-react';
  import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
  import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
  import { useToast } from '@/hooks/use-toast';

  interface UploadedStateProps {
    imageUrl: string;
    showGallery: boolean;
    onTriggerReplace: () => void;
    onTriggerGallery: () => void;
    onRemove: () => void;
  }

  export function UploadedState({ imageUrl, showGallery, onTriggerReplace, onTriggerGallery, onRemove }: UploadedStateProps) {
    const { toast } = useToast();
    const [previewOpen, setPreviewOpen] = useState(false);

    const handleCopyUrl = async () => {
      try {
        await navigator.clipboard.writeText(imageUrl);
        toast({ title: 'URL Copied', description: 'Image link copied to your clipboard.' });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Copy failed' });
      }
    };

    const handleDownload = async () => {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = imageUrl.split('/').pop()?.split('?')[0] || 'downloaded-image';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast({ title: 'Download Started' });
      } catch (error) {
        window.open(imageUrl, '_blank');
      }
    };

    return (
      <div className="w-full">
        <div className="relative h-[220px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center group cursor-pointer" onClick={() => setPreviewOpen(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Uploaded asset" className="w-full h-full object-cover" />
          
          {/* Overlay with subtle details */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform">
              <Maximize2 className="w-4 h-4" />
            </div>
          </div>

          {/* Options Dropdown - StopPropagation to prevent opening full screen preview */}
          <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Image actions" className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-200 transition-colors shadow-lg outline-none">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl bg-slate-900 border-slate-800 text-slate-200">
                <DropdownMenuItem onClick={() => setPreviewOpen(true)} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                  <Maximize2 className="w-3.5 h-3.5" /> Preview Full Screen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                  <Download className="w-3.5 h-3.5" /> Download Image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyUrl} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                  <Copy className="w-3.5 h-3.5" /> Copy Image Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onTriggerReplace} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                  <RefreshCw className="w-3.5 h-3.5" /> Replace from Device
                </DropdownMenuItem>
                {showGallery && (
                  <DropdownMenuItem onClick={onTriggerGallery} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800">
                    <FolderHeart className="w-3.5 h-3.5" /> Select from Gallery
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onRemove} className="text-xs font-semibold gap-2 cursor-pointer hover:bg-slate-800 text-red-400 focus:text-red-300">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Full screen preview modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl bg-slate-950/95 border-slate-900 p-2 overflow-hidden flex items-center justify-center rounded-2xl">
            <DialogTitle className="sr-only">Image Preview</DialogTitle>
            <DialogDescription className="sr-only">Full size view of uploaded asset</DialogDescription>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Full screen preview" className="max-h-[85vh] max-w-full object-contain rounded-xl" />
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  ```

---

### Task 2: Create Main Orchestrator ImageUploader.tsx

**Files:**
- Create: `src/components/shared/image-uploader/ImageUploader.tsx`

- [ ] **Step 1: Write ImageUploader.tsx implementation (supporting fileInputRef at root)**
  Create `src/components/shared/image-uploader/ImageUploader.tsx`:
  ```typescript
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
          description: workspaceId ? 'Registered in your Media Gallery.' : 'Applied successfully.'
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
  ```

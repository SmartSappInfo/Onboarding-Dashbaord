# Unified Image Uploader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular, responsive, high-performance `<ImageUploader>` component that supports drag-and-drop, direct storage uploads with radial progress tracking, Firestore media library registration, gallery dialog asset selections, and custom URL links, then integrate it uniformly across the Page Builder, User Profile Settings, and Workspace Onboarding setups.

**Architecture:** We use a composed component structure separating presentational states (EmptyState, UploadingState, UploadedState, UrlDialog) from the main state/event manager orchestrator (`ImageUploader.tsx`).

**Tech Stack:** Next.js (React 18), Firebase Storage, Cloud Firestore, Lucide Icons, Radix/shadcn Dialog.

---

## 1. Directory Structure

We will create a dedicated module folder:
`src/components/shared/image-uploader/`

The files:
- `index.ts`: Public module exports.
- `UrlDialog.tsx`: Dialog modal for pasting image URLs.
- `EmptyState.tsx`: Dashed border dropzone with drag-and-drop actions.
- `UploadingState.tsx`: Upload overlay showing radial and horizontal progress.
- `UploadedState.tsx`: Image preview with action toolbar.
- `ImageUploader.tsx`: Main orchestrator managing file checks, Storage uploads, and Firestore registration.

---

## 2. Infrastructure & Firebase Compliance

1.  **Firestore Index Rules**: Direct media upload registration writes to the `'media'` collection. This uses the existing `media` composite indexes (e.g., `workspaceId == asc, name == asc`). No new indexes are required.
2.  **Storage Rules**: Page builder images land in `media/page-builder/${workspaceId}/...`, which is already permitted (authenticated write, public read). No Storage rules changes are needed.
3.  **No Migration Protocol Required**: The component outputs a simple string URL via `onChange`. Existing data models (e.g., block props, org logs, profiles) store the image URL string, which remains fully backward-compatible.

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

- [ ] **Step 3: Create EmptyState.tsx (optimized for mobile/desktop drag zones)**
  Create `src/components/shared/image-uploader/EmptyState.tsx`:
  ```typescript
  import React, { useRef, useState } from 'react';
  import { Upload, FolderHeart, Link as LinkIcon } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { cn } from '@/lib/utils';

  interface EmptyStateProps {
    onFileSelect: (file: File) => void;
    onOpenGallery: () => void;
    onOpenLink: () => void;
    showGallery: boolean;
    maxSizeMB: number;
    className?: string;
  }

  export function EmptyState({ onFileSelect, onOpenGallery, onOpenLink, showGallery, maxSizeMB, className }: EmptyStateProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
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
        onFileSelect(file);
      }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
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
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        
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
          <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 rounded-xl text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 px-3">
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
  import { Loader2 } from 'lucide-react';

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

- [ ] **Step 5: Create UploadedState.tsx**
  Create `src/components/shared/image-uploader/UploadedState.tsx`:
  ```typescript
  import React from 'react';
  import { Edit2, RefreshCw, FolderHeart, Trash2 } from 'lucide-react';
  import { Button } from '@/components/ui/button';

  interface UploadedStateProps {
    imageUrl: string;
    showGallery: boolean;
    onTriggerReplace: () => void;
    onTriggerGallery: () => void;
    onRemove: () => void;
  }

  export function UploadedState({ imageUrl, showGallery, onTriggerReplace, onTriggerGallery, onRemove }: UploadedStateProps) {
    return (
      <div className="w-full flex flex-col gap-3">
        <div className="relative h-[220px] rounded-2xl overflow-hidden border border-slate-800 group bg-slate-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Uploaded asset" className="w-full h-full object-cover" />
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform">
              <Edit2 className="w-4 h-4" />
            </div>
          </div>
          <button type="button" onClick={onTriggerReplace} aria-label="Replace Image" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-200 transition-colors shadow-lg">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={onTriggerReplace} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400 gap-1.5 flex-1 px-3">
            <RefreshCw className="w-3 h-3" /> Replace
          </Button>
          {showGallery && (
            <Button type="button" variant="outline" size="sm" onClick={onTriggerGallery} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-slate-300 hover:text-emerald-400 gap-1.5 flex-1 px-3">
              <FolderHeart className="w-3 h-3" /> Gallery
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onRemove} className="h-8 rounded-xl text-[10px] font-bold bg-slate-800 border-slate-700 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1.5 px-3">
            <Trash2 className="w-3 h-3" /> Remove
          </Button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 6: Commit presentational components**
  ```bash
  git add src/components/shared/image-uploader/index.ts src/components/shared/image-uploader/UrlDialog.tsx src/components/shared/image-uploader/EmptyState.tsx src/components/shared/image-uploader/UploadingState.tsx src/components/shared/image-uploader/UploadedState.tsx
  git commit -m "feat: implement image uploader modular presentational sub-components"
  ```

---

### Task 2: Create Main Orchestrator ImageUploader.tsx

**Files:**
- Create: `src/components/shared/image-uploader/ImageUploader.tsx`

- [ ] **Step 1: Write ImageUploader.tsx implementation**
  Create `src/components/shared/image-uploader/ImageUploader.tsx`:
  ```typescript
  'use client';

  import React, { useState } from 'react';
  import { useFirestore, useUser } from '@/firebase';
  import { addDoc, collection } from 'firebase/firestore';
  import { useToast } from '@/hooks/use-toast';
  import { uploadPageImage } from '@/lib/page-builder/upload';
  import { EmptyState } from './EmptyState';
  import { UploadingState } from './UploadingState';
  import { UploadedState } from './UploadedState';
  import { UrlDialog } from './UrlDialog';
  import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';

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

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [tempPreview, setTempPreview] = useState<string>('');
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);

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
        const downloadUrl = await uploadPageImage(file, directWorkspaceId, (percent) => {
          setUploadProgress(percent);
        });

        // Register in media library if workspaceId is present
        if (workspaceId && firestore && user) {
          const newAssetData = {
            name: file.name,
            originalName: file.name,
            url: downloadUrl,
            fullPath: `media/page-builder/${workspaceId}/${file.name}`,
            type: 'image',
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

    if (isUploading) {
      return (
        <UploadingState
          previewUrl={tempPreview}
          progress={uploadProgress}
          className={className}
        />
      );
    }

    if (value) {
      return (
        <UploadedState
          imageUrl={value}
          showGallery={!!workspaceId}
          onTriggerReplace={() => {
            const el = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (el) el.click();
          }}
          onTriggerGallery={() => setGalleryOpen(true)}
          onRemove={() => onChange('')}
        />
      );
    }

    return (
      <>
        <EmptyState
          onFileSelect={handleFileSelect}
          onOpenGallery={() => setGalleryOpen(true)}
          onOpenLink={() => setLinkDialogOpen(true)}
          showGallery={!!workspaceId}
          maxSizeMB={maxSizeMB}
          className={className}
        />
        
        <UrlDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          onConfirm={handleLinkConfirm}
        />

        {workspaceId ? (
          <MediaSelectorDialog
            open={galleryOpen}
            onOpenChange={setGalleryOpen}
            onSelectAsset={(asset) => {
              onChange(asset.url);
              setGalleryOpen(false);
            }}
            filterType="image"
            workspaceId={workspaceId}
          />
        ) : null}
      </>
    );
  }
  ```

- [ ] **Step 2: Commit orchestrator component**
  ```bash
  git add src/components/shared/image-uploader/ImageUploader.tsx
  git commit -m "feat: implement main ImageUploader orchestrator controller"
  ```

---

### Task 3: Migrate Page Builder ImageField

**Files:**
- Modify: `src/components/page-builder/AutoBlockEditor.tsx`

- [ ] **Step 1: Replace ImageField with ImageUploader**
  Open `src/components/page-builder/AutoBlockEditor.tsx` and refactor the `ImageField` implementation:
  ```typescript
  import { ImageUploader } from '@/components/shared/image-uploader';

  function ImageField({ label, value, workspaceId, onChange }: {
    label: string;
    value: string;
    workspaceId?: string;
    onChange: (value: string) => void;
  }) {
    return (
      <div className="space-y-2">
        <ImageUploader
          value={value}
          onChange={onChange}
          workspaceId={workspaceId}
          label={label}
          category="Page Builder"
        />
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit Page Builder integration**
  ```bash
  git add src/components/page-builder/AutoBlockEditor.tsx
  git commit -m "feat: migrate page builder ImageField to new ImageUploader"
  ```

---

### Task 4: Migrate Onboarding Workspace Setup Logo Uploader

**Files:**
- Modify: `src/app/onboarding/setup/OnboardingSetupClient.tsx`

- [ ] **Step 1: Replace Logo Input with ImageUploader**
  Open `src/app/onboarding/setup/OnboardingSetupClient.tsx` and replace the logo upload block with the `<ImageUploader>` component:
  ```typescript
  import { ImageUploader } from '@/components/shared/image-uploader';
  ```
  And render:
  ```typescript
  <div className="space-y-2">
    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brand Logo</Label>
    <ImageUploader
      value={logoUrl || ''}
      onChange={(url) => setLogoUrl(url)}
      maxSizeMB={2}
    />
  </div>
  ```

- [ ] **Step 2: Commit Onboarding Wizard integration**
  ```bash
  git add src/app/onboarding/setup/OnboardingSetupClient.tsx
  git commit -m "feat: integrate ImageUploader into onboarding branding setup"
  ```

---

### Task 5: Migrate User Avatar Settings Uploader

**Files:**
- Modify: `src/app/admin/profile/ProfileClient.tsx`

- [ ] **Step 1: Replace Avatar form field with ImageUploader**
  Open `src/app/admin/profile/ProfileClient.tsx` and swap the manual avatar upload input trigger with `<ImageUploader>` inside `FormField`:
  ```typescript
  import { ImageUploader } from '@/components/shared/image-uploader';
  ```
  Render:
  ```typescript
  <FormField
    control={form.control}
    name="photoURL"
    render={({ field }) => (
      <FormItem className="flex flex-col gap-2">
        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Avatar Image</FormLabel>
        <FormControl>
          <ImageUploader
            value={field.value || ''}
            onChange={(url) => {
              field.onChange(url);
              setPhotoUrl(url);
            }}
            workspaceId={activeWorkspaceId}
            category="Avatars"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
  ```

- [ ] **Step 2: Commit Profile settings integration**
  ```bash
  git add src/app/admin/profile/ProfileClient.tsx
  git commit -m "feat: integrate ImageUploader into user profile avatar settings"
  ```

---

## 4. Verification Plan

### Automated Coverage
Run: `pnpm verify` (which triggers eslint, tsc compilation check, and vitest run).
Expected: 0 ESLint errors, 0 compilation errors, and all tests passing cleanly.

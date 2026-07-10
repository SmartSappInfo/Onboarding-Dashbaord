# Design Specification: Unified Video & Thumbnail Uploader

**Date**: 2026-07-10  
**Status**: Draft

---

## 1. Goal Description

Create a unified, premium reusable component (`VideoUploader`) that allows website creators and survey builders to upload or link videos, define custom video thumbnails, and optionally specify metadata (Title & Description).

The uploader should support:
1. **Direct Video Upload**: Upload files (`.mp4`, `.mov`, `.avi`, etc. up to 2GB) to Firebase Storage and track real-time upload progress.
2. **Media Gallery**: Select from existing videos in the workspace media library.
3. **URL Link**: Paste external video links (including YouTube, Vimeo, Loom, and direct video URLs).
4. **Custom Thumbnails**: Upload an image cover, choose from the media gallery, or link a URL.
5. **Metadata Form**: Toggleable accordion block for entering video Title and Description.

---

## 2. Component Design & API

The component will live in `src/components/shared/video-uploader/` and be exported from `src/components/shared/video-uploader/index.ts`.

### Props API

```typescript
export interface VideoUploaderValue {
  videoUrl: string;
  thumbnailUrl: string;
  title?: string;
  description?: string;
  fileName?: string; // Optional metadata for display
  fileSize?: string; // Optional metadata for display
}

export interface VideoUploaderProps {
  value?: VideoUploaderValue;
  onChange: (value: VideoUploaderValue) => void;
  workspaceId?: string;
  label?: string;
  maxVideoSizeMB?: number; // default: 100
  className?: string;
}
```

---

## 3. UI Layout (Mockup Alignment)

Following the provided mockup ("Variation 1 - Integrated Uploader"), the UI will render as follows:

1. **Empty State** (No Video Selected):
   - A dashed dropzone area allowing drag-and-drop or browsing for files.
   - Buttons to choose from "Media" (if workspaceId is provided) or add a direct "Link".

2. **Uploaded State** (Video Selected):
   - **Left Panel (Uploader / Dropzone)**: A dropzone card allowing drag-and-drop or clicking to replace/upload a new video.
   - **Right Panel (Video Preview & Thumbnail Settings)**:
     - **Video Cover Preview**: Displays the currently active video thumbnail (or a derived thumbnail/generic player if no custom thumbnail is uploaded) with a Play Icon overlay.
     - **Metadata Info**: Displays the filename (e.g. `my-video.mp4`) and file size (e.g. `120 MB`) if uploaded, along with a `Change Video` action button.
     - **Thumbnail Management**: Shows a small preview of the custom cover image, a `Change Thumbnail` button, and a delete button (reverts back to derived video cover).
   - **Bottom Panel (Accordion)**:
     - A toggle switch/collapsible header: `"Add Title & Description (Optional)"`.
     - Expanding it reveals a text input for the **Title** and a textarea for the **Description**.

Any changes in the inputs, video URL, or thumbnail will immediately call `onChange()` to keep the state synchronized with the parent form or page builder block.

---

## 4. Proposed Changes

### Storage upload extensions
*   Modify `src/lib/page-builder/upload.ts` to export a generic `uploadPageMedia(file, workspaceId, onProgress)` method that handles both videos and images.

### Shared components
*   Create `src/components/shared/video-uploader/VideoUploader.tsx` (main shell, state container, dialog control).
*   Create `src/components/shared/video-uploader/EmptyState.tsx` (dropzone/select states).
*   Create `src/components/shared/video-uploader/UploadingState.tsx` (upload progress layout).
*   Create `src/components/shared/video-uploader/UploadedState.tsx` (the side-by-side mockup view with video metadata, thumbnail options, title & description switch).
*   Create `src/components/shared/video-uploader/UrlDialog.tsx` (URL entry dialog).
*   Create `src/components/shared/video-uploader/index.ts` (exports wrapper).

---

## 5. Verification Plan

### Automated Tests
*   Write unit tests in `src/components/shared/video-uploader/__tests__/VideoUploader.test.tsx` verifying:
    - Renders empty state when value is undefined.
    - Renders uploaded layout when video is selected.
    - Triggers `onChange` when title, description, or custom thumbnail changes.

### Manual Verification
1. Place the new `<VideoUploader>` inside a settings panel or preview page.
2. Select a video by uploading, selecting from workspace media library, or pasting a YouTube/direct link.
3. Add a custom thumbnail and verify it renders in real-time.
4. Toggle "Add Title & Description (Optional)" and fill in metadata.
5. Verify `onChange` is called with the unified `VideoUploaderValue` payload.

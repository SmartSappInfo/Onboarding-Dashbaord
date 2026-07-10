# Design Specification: Unified Image Uploader Component

*   **Date**: 2026-07-10
*   **Status**: APPROVED
*   **Author**: Antigravity AI

---

## 1. Objectives & Scope
We will replace all disparate file/image input fields across the Page Builder (and eventually other admin forms) with a unified, high-quality, responsive `<ImageUploader>` component.

### Core Features
1.  **Drag and Drop Support**: A premium dropzone with active hover animations.
2.  **Direct Storage Upload**: Instant uploading to Firebase Storage with real-time radial progress tracking.
3.  **Media Library Integration**: If a `workspaceId` is available, direct uploads are automatically registered in the Firestore `'media'` collection so they show up in the user's asset gallery.
4.  **Gallery Selector Integration**: Built-in support to launch `MediaSelectorDialog` and select from existing gallery files.
5.  **Direct URL Links**: Support for pasting direct image URLs using a premium custom dialog popup.
6.  **Responsive Layout**: Fully optimized styling for desktop and mobile viewports.

---

## 2. Directory Structure
All files will reside in a dedicated modular folder:

```
src/components/shared/image-uploader/
├── index.ts                     # Public entry point
├── ImageUploader.tsx            # Main controller / state manager
├── EmptyState.tsx               # Empty dropzone + upload actions
├── UploadingState.tsx           # Blurred overlay + radial progress loader
├── UploadedState.tsx            # Image preview card + toolbar actions
└── UrlDialog.tsx                # Sleek link URL modal prompt
```

---

## 3. Data Interface & Props

```typescript
export interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  workspaceId?: string;               // If provided, enables Media Gallery selector & registers direct uploads
  label?: string;
  category?: string;                  // Category name in the Media Library, defaults to 'General'
  maxSizeMB?: number;                 // Maximum file size in MB, defaults to 5MB
  className?: string;
}
```

---

## 4. Sub-Component Details & Layout

### 4.1. EmptyState.tsx
- Renders a dotted border box using `bg-slate-900/30 backdrop-blur-sm border-slate-700/50 hover:border-emerald-500/50`.
- Implements dropzone event listeners (`onDragOver`, `onDragLeave`, `onDrop`). Displays a green glow border animation when dragging files over.
- Button Row:
  - **Upload**: Triggers the hidden file input.
  - **Gallery** (hidden if `workspaceId` is undefined): Launches the media dialog.
  - **Link**: Launches the custom link dialog popup.

### 4.2. UploadingState.tsx
- Displays a blurred version of the selected file using `URL.createObjectURL(file)`.
- Renders a central SVG-based radial loader showing the exact percentage (e.g. `62%`) and the text `Uploading...`.
- Renders a horizontal progress bar track running along the bottom.

### 4.3. UploadedState.tsx
- Displays the uploaded image within a neat card.
- Implements a circular hover edit button (pencil icon) in the top-right corner.
- Bottom Toolbar: Row of secondary buttons for **Replace** (opens browser input), **Gallery** (opens media dialog), and **Remove** (clears value).

### 4.4. UrlDialog.tsx
- A custom modal utilizing Radix / shadcn-based Dialog elements to prompt the user for a direct link URL.
- Validates the pasted link format before calling `onChange`.

---

## 5. Verification Plan

### Automated Coverage
1.  **State Transitions**: Test transition from `EmptyState` -> `UploadingState` -> `UploadedState`.
2.  **Upload Callback**: Assert that progress updates are correctly translated to radial percentage levels.
3.  **Firestore Registration**: Mock `addDoc` and assert it is called with correct metadata parameters when a file is uploaded in a workspace.

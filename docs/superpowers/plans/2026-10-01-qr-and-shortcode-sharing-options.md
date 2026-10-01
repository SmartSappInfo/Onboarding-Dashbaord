# QR & Shortcode Sharing Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the platform-wide `<ShareEmbedDialog>` to include dedicated **Shortcode** and **QR Code** creation and sharing options, reusing the existing QR actions (`createQRCode`, `getQRCodeByUrl`, `updateQRShortPath`), vector engine (`qr-code-styling`, `QRPreview`, `downloadQR`), and studio drawer (`UnifiedQRSheet`) with zero redundant infrastructure.

**Architecture:**
1. **Single Source of Truth Modal (`ShareEmbedDialog`)**: Expand `src/components/share-embed-dialog.tsx` tabs from 3 (`Direct Link`, `Iframe`, `Code Embed`) to 5 (`Direct Link`, `Shortcode`, `QR Code`, `Iframe`, `Code Embed`) with mobile-responsive tab triggers.
2. **Dynamic Shortcode Lifecycle Engine**: Connect to existing Firestore `short_paths` and server actions (`getQRCodeByUrl`, `createQRCode`, `updateQRShortPath`). If a shortcode exists for the target URL, display the short URL (`/q/[slug]`), scan count telemetry, 1-click copy, and custom slug editor. If none exists, provide 1-click creation with optional custom slug.
3. **Interactive High-Resolution QR Generator**: Embed a live visual QR preview powered by `qr-code-styling` (reusing `QRPreview`), offering target switching (Direct URL vs Short URL), brand color customization, dot shape options, logo overlay, PNG/SVG download (`downloadQR`), and seamless 1-click launcher to `UnifiedQRSheet` for advanced frames and print kits.
4. **Context Autoresolution**: Leverage `useTenant()` inside `ShareEmbedDialog` so `workspaceId`, `organizationId`, and current user resolve automatically even when callers omit them, while preserving explicit prop overrides for callers in `SurveysClient.tsx` and `step-4-publish.tsx`.

**Tech Stack:** Next.js 16 (Turbopack, Server Actions), React 19, TypeScript 5.8 (Strict Zero-`any`), Tailwind CSS, Radix UI Tabs/Dialog, Lucide Icons, `qr-code-styling`, Vitest.

---

## 1. Risk Analysis & Failure Modes ("What Could Go Wrong & Resolutions")

| Risk / Failure Mode | Root Mechanism | Resolution & Defense |
| :--- | :--- | :--- |
| **1. Shortcode Slug Collision** | User enters a custom shortcode slug (e.g. `onboarding`) that is already claimed by another QR or survey. | Validate via `updateQRShortPath` / `createQRCode` which checks `adminDb.collection('short_paths').doc(slug)`. If taken, display an inline friendly validation error ("This custom shortlink is already in use. Please choose another one.") without crashing the dialog. |
| **2. Modal Layout Overflow on Mobile** | 5 tab items in `TabsList` could wrap awkwardly or overflow on small viewports (<380px). | Use responsive tab triggers: icon + full label on `sm:` and up (`Direct Link`, `Shortcode`, `QR Code`), and compact icon + short label on mobile (`Link`, `Short`, `QR`). Tab container uses `grid grid-cols-5` with `overflow-x-auto` safety. |
| **3. Client-Side Rendering of `qr-code-styling`** | `qr-code-styling` accesses `window` and `document` DOM APIs which can trigger SSR hydration mismatch or canvas errors during Next.js SSR. | Reuse the established dynamic import pattern in `QRPreview` / `QrStudioTab` which executes inside `useEffect` on the client only, with fallback skeleton loader. |
| **4. Unsaved Shortcode State Desynchronization** | User modifies the shortcode input but switches tabs without saving. | Track `customSlug` draft state independently from `activeShortPath`. Display an inline badge ("Unsaved changes") with explicit "Save" and "Cancel" buttons, reverting to `activeShortPath` if discarded. |
| **5. Missing Workspace Context in Standalone Callers** | Some legacy callers might invoke `ShareEmbedDialog` without explicit `workspaceId` or `organizationId`. | Fallback automatically to `activeWorkspaceId` and `activeOrganization?.id` from `useTenant()`. If still resolving, show a graceful placeholder asking the user to select an active workspace. |

---

## 2. Component & Subsystem Reuse Matrix

| Capability Needed | Existing Implementation in Codebase | How It Is Reused |
| :--- | :--- | :--- |
| **Shortcode Generation & Validation** | `src/lib/qr-actions.ts`: `createQRCode`, `generateUniqueShortPath` | Called with `mode: 'dynamic'`, `destination: { url: publicUrl }`. Automatically claims `/q/[shortPath]`. |
| **Shortcode Lookup** | `src/lib/qr-actions.ts`: `getQRCodeByUrl` | Called on dialog mount to check if this URL already has a dynamic QR/shortcode record. |
| **Shortcode Slug Editing** | `src/lib/qr-actions.ts`: `updateQRShortPath` | Called when user saves a custom slug, renaming the global `short_paths` index in Firestore. |
| **Shortcode Redirection** | `src/app/q/[shortPath]/route.ts` | Built-in Next.js route handling redirect and scan telemetry tracking. |
| **QR Vector Preview** | `src/app/admin/qr-studio/components/qr-preview.tsx`: `QRPreview` | Embedded directly into the QR tab with customizable size, dots, and colors. |
| **QR Vector Download (PNG/SVG)** | `src/app/admin/qr-studio/components/qr-preview.tsx`: `downloadQR` | Reused directly for 1-click PNG/SVG download with exact filename and error correction level. |
| **Full QR Studio Integration** | `src/components/qr-studio/unified-qr-sheet.tsx`: `UnifiedQRSheet` | Triggered via "Advanced Studio Designer" button for users wanting frames, stickers, and print kits. |

---

## 3. UI/UX Wireframe & Flow in `ShareEmbedDialog`

```
┌─────────────────────────────────────────────────────────────────┐
│ Share & Embed Survey                                        [×] │
│ Share this survey directly or embed it inside your host page.   │
├─────────────────────────────────────────────────────────────────┤
│ [ Direct Link ] [ Shortcode ] [ QR Code ] [ Iframe ] [ Widget ] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [SHORTCODE TAB CONTENT]                                        │
│  TRACKABLE SHORT URL                                            │
│  ┌───────────────────────────────────────────────┐ ┌──────────┐ │
│  │ https://go.smartsapp.com/q/onboard-2026       │ │ 📋 Copy  │ │
│  └───────────────────────────────────────────────┘ └──────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ⚡ Active Dynamic Shortcode            [ 18 Total Scans ]   │ │
│  │ Target: https://go.smartsapp.com/surveys/smartsapp-admin.. │ │
│  │                                                            │ │
│  │ [✏️ Edit Slug]   [↗ View Live]   [📸 Generate QR Code]      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [QR CODE TAB CONTENT]                                          │
│  ┌─────────────────────────┐  STYLING & OPTIONS                 │
│  │                         │  Target Link:                      │
│  │      [ QR PREVIEW ]     │  (•) Short URL (/q/onboard)        │
│  │                         │  ( ) Direct Full URL               │
│  │       (with Logo)       │                                    │
│  │                         │  Color: [Brand] [Dark] [Emerald]   │
│  │                         │  [✓] Include Logo in Center        │
│  └─────────────────────────┘                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [📥 Download PNG]   [📐 Download SVG]   [🎨 QR Studio]     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Tasks

### Task 1: Create ShareEmbedDialog QR & Shortcode Test Suite

**Files:**
- Create: `src/components/__tests__/share-embed-dialog.test.tsx`

- [ ] **Step 1: Write tests verifying Shortcode and QR Code tabs**
  Verify that:
  1. `ShareEmbedDialog` renders all 5 tabs (`Direct Link`, `Shortcode`, `QR Code`, `Iframe`, `Code Embed`).
  2. Selecting the `Shortcode` tab displays the shortcode creation/view interface.
  3. Selecting the `QR Code` tab renders the QR preview container and export controls.
  4. Copying shortcode invokes clipboard API and triggers toast.

- [ ] **Step 2: Run test to observe baseline failure**
  Run: `pnpm vitest run src/components/__tests__/share-embed-dialog.test.tsx`
  Expected: Fails because `ShareEmbedDialog` only has 3 tabs currently.

---

### Task 2: Implement Shortcode & QR Code Engine in `ShareEmbedDialog`

**Files:**
- Modify: `src/components/share-embed-dialog.tsx`

- [ ] **Step 1: Enhance props & state management**
  - Accept optional `currentUser`, `initialTab`, and ensure `workspaceId` and `organizationId` fallback cleanly to `activeWorkspaceId` and `activeOrganization?.id` from `useTenant()`.
  - Add state for:
    - `shortcode`: current shortpath string (e.g. `'onboard'`).
    - `isGeneratingShortcode`: loading boolean.
    - `isEditingSlug`: boolean for inline slug customization mode.
    - `customSlugDraft`: string draft for slug input.
    - `qrTarget`: `'short' | 'direct'` (whether QR encodes shortcode or direct URL).
    - `qrDotColor`: string (defaults to brand primary color).
    - `qrDotType`: `'rounded' | 'dots' | 'square' | 'classy'`.
    - `qrIncludeLogo`: boolean (defaults to `true`).
    - `isQrStudioSheetOpen`: boolean to trigger `UnifiedQRSheet`.
    - `totalScans`: number (scan count from existing QR record).
    - `existingQrId`: string | null.

- [ ] **Step 2: Fetch existing QR/shortcode on mount**
  - In `useEffect`, call `getQRCodeByUrl(orgId, wsId, publicUrl)`.
  - If existing record found: populate `shortcode`, `existingQrId`, `totalScans`, and design colors.

- [ ] **Step 3: Implement Shortcode creation & customization handlers**
  - `handleCreateShortcode`: calls `createQRCode` with `mode: 'dynamic'`, `destination: { url: publicUrl }`, and optional `customShortPath`.
  - `handleUpdateShortcodeSlug`: calls `updateQRShortPath(orgId, wsId, existingQrId, customSlugDraft.trim())`.
  - Handles validation errors (e.g. invalid characters, collision) gracefully with toast feedback.

- [ ] **Step 4: Implement QR Code download handler**
  - Reuses `downloadQR` from `@/app/admin/qr-studio/components/qr-preview`.
  - Supports PNG and SVG with filename `${resourceName.toLowerCase()}-qr-${shortcode || 'share'}`.

- [ ] **Step 5: Render Shortcode and QR Code tabs**
  - Update `TabsList` to 5 columns with responsive labels.
  - Implement `<TabsContent value="shortcode">` with short URL input, copy button, telemetry stats, and edit mode.
  - Implement `<TabsContent value="qr">` with `<QRPreview>` container, color swatches, logo toggle, PNG/SVG download buttons, and "Customize in QR Studio" button.
  - Mount `<UnifiedQRSheet>` conditionally if `isQrStudioSheetOpen` is true.

---

### Task 3: Enhance Survey Callers with Explicit Tenant IDs

**Files:**
- Modify: `src/app/admin/surveys/SurveysClient.tsx:619-635`
- Modify: `src/app/admin/surveys/components/step-4-publish.tsx:502-510`

- [ ] **Step 1: Pass workspaceId and organizationId in `SurveysClient.tsx`**
  ```tsx
  <ShareEmbedDialog
    isOpen={!!shareSurvey}
    onOpenChange={(open) => !open && setShareSurvey(null)}
    title="Share & Embed Survey"
    resourceName="Survey"
    publicUrl={...}
    embedUrl={...}
    workspaceId={activeWorkspaceId || undefined}
    organizationId={activeOrganizationId || undefined}
  />
  ```

- [ ] **Step 2: Pass workspaceId and organizationId in `step-4-publish.tsx`**
  ```tsx
  <ShareEmbedDialog
    isOpen={isShareOpen}
    onOpenChange={setIsShareOpen}
    title="Share & Embed Survey"
    resourceName="Survey"
    publicUrl={getFullUrl()}
    embedUrl={`${getFullUrl()}?embed=true`}
    workspaceId={workspaceIds[0] || activeWorkspaceId || ''}
    organizationId={organizationId || activeOrganizationId || ''}
  />
  ```

---

### Task 4: Verification & Protocol Checks

**Files:**
- Run: Vitest unit tests
- Run: TypeScript typecheck

- [ ] **Step 1: Run component unit tests**
  Run: `pnpm vitest run src/components/__tests__/share-embed-dialog.test.tsx`
  Expected: PASS

- [ ] **Step 2: Run survey unit test suites**
  Run: `pnpm vitest run src/lib/surveys/__tests__/`
  Expected: 28 test files / 199 tests pass.

- [ ] **Step 3: Run TypeScript typecheck**
  Run: `pnpm typecheck`
  Expected: 0 errors.

- [ ] **Step 4: Local Git Commit**
  - Commit locally with message: `feat(share): add qr code and dynamic shortcode creation to share & embed dialog`
  - Strictly **NO** remote git push.

# Experience Platform: Real-Time Design Preview & Multi-Device Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable instant, zero-latency real-time preview of the Experience Portal and Content Studio during the design phase through a prominent, accessible Preview button in the header area, opening an immersive multi-device simulator (`<PortalPreviewModal>`) without disturbing form state, unmounting edits, or triggering browser print shortcuts.

**Architecture:** 
- **Simulator Engine**: `<PortalPreviewModal>` provides an isolated, full-screen portal preview surface wrapping the Single Source of Truth (SSOT) `<PortalLivePreviewCanvas>`. It features device viewport toggles (Desktop 1200px, Tablet 768px, Mobile 390px), responsive proportional scaling via `ResizeObserver`, theme mode toggle (Light/Dark), route simulation (`/`, `/learn`, `/community`, `/dashboard`, `/tasks`), and instant CSS variable injection directly reflecting un-saved draft state.
- **Header Action Integration**: A tactile, accessible `<Button>` in `PortalStudioClient.tsx` (with `<Eye className="w-4 h-4 text-primary" />`, active press `active:scale-[0.97]`, and `⌘P` keyboard shortcut with `e.preventDefault()`).
- **Content Studio AST Real-Time Preview**: In `ContentEditorModal.tsx`, an added `preview` view mode in the header View Switcher enables authors to preview document PageBlocks in real time using `BlockRenderer` with responsive device toggles.
- **Backoffice Governance & Zero-Code Management**: Operators can customize their default preview device and starting route in backoffice settings, persisted via localized storage preferences (`portal_studio_preview_prefs_${portalId}`).

**Tech Stack:** Next.js 15, React 19 (`useDeferredValue`), Tailwind CSS, Lucide icons, Vitest, TypeScript (Strict 0 `any`).

---

## 1. Failure Modes, Edge Cases & Mitigations ("What Could Go Wrong")

| Potential Risk | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Browser Print Hijack on `⌘P` / `Ctrl+P`** | `⌘P` is the default browser shortcut for Print. | Distracting print dialog interrupts operator workflow. | Keydown handler intercepts `(e.metaKey \|\| e.ctrlKey) && (e.key === 'p' \|\| e.key === 'P')`, calls `e.preventDefault()`, and smoothly toggles `<PortalPreviewModal>`. An active text input guard (`isTextInput`) ensures typing in inputs is unaffected. |
| **Form Unmount & Unsaved State Loss** | Switching views or navigating away to preview can unmount tabs. | Loss of un-saved theme tokens, logos, or navigation links. | The preview simulator renders as an overlay modal (`PortalPreviewModal`) atop `PortalStudioClient`. All underlying form state remains 100% mounted and untouched in memory. |
| **Viewport Squishing on Mobile / Tablet Screens** | Simulating a 1200px desktop viewport on small screens causes overflow or horizontal scrollbars. | Distorted preview, clipped layouts. | Single Source of Truth scaling engine: `ResizeObserver` detects container width and applies CSS `transform: scale(scale)` with `transformOrigin: 'top center'`, keeping coordinates pixel-accurate across 1200px, 768px, and 390px. |
| **Input Latency & Re-render Overload** | Continuous re-renders of the preview canvas during high-frequency typing in Studio forms. | Frame drops (<60fps), UI stutter. | Conforms to `vercel-react-best-practices` (`rerender-use-deferred-value`): `theme`, `branding`, and `navigation` are deferred with `React.useDeferredValue()`, prioritizing input responsiveness on the main thread. |
| **Draft Token Desync** | Preview fetches from Firestore instead of current in-memory draft state. | Changes to colors, typography, or cards only appear after clicking "Save Changes". | Real-time CSS token injection: in-flight React state (`theme`, `branding`) is mapped directly to CSS variables (`--portal-primary`, `--portal-radius`, `--portal-font-heading`) at the simulator root, rendering updates in 0ms. |
| **Privileged Data Leaks in Preview** | Previewing routes like `/dashboard` could attempt live Firestore queries with unauthorized roles. | Permission errors or member data leakage. | Anonymized preview persona (`sampleUser`) with simulated local enrollments and mock member badges, preventing live privileged mutations during preview. |
| **Memory Leaks from Listeners** | `ResizeObserver` and window event listeners not cleaned up on unmount. | Browser tab memory inflation during long design sessions. | Strict cleanup in `useEffect` return callbacks (`observer.disconnect()`, `window.removeEventListener()`). |

---

## 2. Cross-Feature Impact & Backoffice Governance

### How Other Features Are Affected:
1. **`PortalStudioClient` Workspace Layout Engine**:
   - The existing center View Mode Switcher ("Split View", "Editor Focus", "Live Canvas") continues to control inline workspace layouts.
   - The new **"Preview"** button in the header right action bar provides instant access to the full-screen simulator from *any* active tab or view mode without requiring the operator to leave "Editor Focus".
2. **`PortalStudioCommandPalette` (`Cmd+K`)**:
   - Added command: `Preview Portal (Cmd+P)` allows keyboard-first operators to trigger the preview modal from anywhere in the studio.
3. **`ContentEditorModal` (Content Studio for Articles, Lessons, Docs)**:
   - Previously only offered "Block Studio" and "Details & SEO" tabs. Authors had no way to preview the rendered AST blocks before publishing.
   - Adding `preview` mode enables authors to inspect blocks in real time with the portal's theme and device viewports (Desktop, Tablet, Mobile) via `BlockRenderer`.

### Backoffice Enhancement (Zero-Code Management):
- Operators can configure their preview preferences directly in the studio:
  - Default Preview Device: `Desktop` | `Tablet` | `Mobile`
  - Default Preview Route: `/` | `/learn` | `/community` | `/dashboard` | `/tasks`
- Stored in `localStorage` under `portal_studio_preview_prefs_${portalId}`.
- Next time the preview button or `⌘P` is pressed, the simulator immediately opens with the operator's preferred device mode and route.

---

## 3. Security, Rules & Single Source of Truth

- **Firestore Rules**: Public-facing portal routes (`/portals/{id}`, `/content_items/{id}`, `/courses/{id}`, `/community_spaces/{id}`) already allow `get, list: if true;`. Backoffice drafts remain secured under `/content_drafts/` (`allow read, write: if isAuthorized()`).
- **Data Integrity & Single Source of Truth**:
  - Presentation components are shared directly between the preview canvas (`PortalLivePreviewCanvas`) and the live runtime (`PortalRuntimeClient`), eliminating layout drift.
  - Double-brace variables in previews route exclusively through `FieldsVariablesService.resolveTemplateVariables`.
  - Tags rendered in previews route through `<TagSelector>` tokens.
- **XSS & Open Redirect Prevention**: External links in preview open in `_blank` with `rel="noopener noreferrer"`. No raw HTML injection is used; all rich text is sanitized through the standard block contracts.

---

## 4. Mobile Ergonomics & Micro-Interactions Standard

- **Touch Targets**: All header controls, device switcher buttons, route pills, and close buttons enforce `min-h-[44px]` (or `min-h-[38px]` with 44px hit bounds) to comply with mobile touch guidelines.
- **Tactile Feedback**: Interactive buttons utilize Emil Kowalski's `active:scale-[0.97]` transform with smooth `transition-all duration-150`.
- **Keyboard Navigation**: Full focus outlines, `Escape` key dismissal, and `⌘P` shortcut.
- **Simple Everyday UI English**: Clear, non-technical button labels: "Preview", "Desktop", "Tablet", "Mobile", "Open Live URL", "Done Previewing".

---

## 5. File Structure & Scope

```
src/
├── lib/
│   ├── utils/
│   │   └── portal-preview-utils.ts                 [CREATE: Viewport & scale math]
│   └── services/__tests__/
│       └── portal-preview.test.ts                  [CREATE: TDD test suite]
└── app/
    └── admin/
        └── portals/
            ├── components/
            │   ├── PortalPreviewModal.tsx          [CREATE: Full-screen live simulator]
            │   ├── PortalStudioCommandPalette.tsx  [MODIFY: Add Cmd+P command]
            │   └── ContentEditorModal.tsx          [MODIFY: Add live block preview tab]
            └── [portalId]/
                └── PortalStudioClient.tsx          [MODIFY: Add header button & Cmd+P]
```

---

## Phase-by-Phase Implementation Plan

### Phase 1: Viewport & Proportional Scale Engine (TDD)

#### Task 1.1: Write Unit Tests for Preview Utilities
- **File**: `src/lib/services/__tests__/portal-preview.test.ts`
- **Action**: Test `getTargetViewportWidth` and `calculatePreviewScale` for desktop (1200px), tablet (768px), and mobile (390px) with fit-to-width and zoom overrides (50%, 75%, 100%).
- **Verification**: Run `npx vitest run src/lib/services/__tests__/portal-preview.test.ts` (expect failure before implementation).

#### Task 1.2: Implement Preview Utilities
- **File**: `src/lib/utils/portal-preview-utils.ts`
- **Action**: Implement strictly typed utility functions with zero `any` or `unknown`.
- **Verification**: Run `npx vitest run src/lib/services/__tests__/portal-preview.test.ts` (expect 100% pass).
- **Commit**: `feat(portal): add preview viewport calculation utilities and unit tests`

---

### Phase 2: Full-Screen Live Simulator Modal (`<PortalPreviewModal>`)

#### Task 2.1: Implement `<PortalPreviewModal>` Component
- **File**: `src/app/admin/portals/components/PortalPreviewModal.tsx`
- **Action**:
  - Full-screen modal overlay (`fixed inset-0 z-50 bg-background/95 backdrop-blur-md`).
  - Top header toolbar: Portal title, Draft Preview badge, "Open Live URL" button, "Done Previewing" button, and `X` close button.
  - Hosts `<PortalLivePreviewCanvas>` with active draft props (`portal`, `theme`, `branding`, `navigation`, `features`, `primaryMode`, `portalName`, `slug`).
  - Native `Escape` key listener for instant keyboard dismissal.
  - Touch targets $\ge 44\text{px}$, micro-interactions with `active:scale-[0.97]`.
- **Verification**: Run `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`.
- **Commit**: `feat(portal): create PortalPreviewModal full-screen live simulator`

---

### Phase 3: Header Preview Button & Keyboard Shortcut in `PortalStudioClient`

#### Task 3.1: Wire Header Preview Button & `⌘P` Shortcut
- **File**: `src/app/admin/portals/[portalId]/PortalStudioClient.tsx`
- **Action**:
  - Add `isPreviewModalOpen` state.
  - Implement `⌘P` / `Ctrl+P` keydown listener with `e.preventDefault()` and input focus check.
  - Add prominent **"Preview"** button in header right actions with `<Eye className="w-4 h-4 text-primary" />` and `⌘P` badge.
  - Mount `<PortalPreviewModal />` before closing tag.
- **Verification**: Run `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`.

#### Task 3.2: Add Quick Action to Command Palette
- **File**: `src/app/admin/portals/components/PortalStudioCommandPalette.tsx`
- **Action**: Add "Preview Portal Simulator" item with shortcut badge `⌘P` that triggers `onOpenPreview`.
- **Commit**: `feat(portal): wire header preview button, ⌘P shortcut, and command palette action`

---

### Phase 4: Real-Time Block Preview in Content Studio (`ContentEditorModal`)

#### Task 4.1: Add `preview` Mode & Device Toggles in `ContentEditorModal`
- **File**: `src/app/admin/portals/components/ContentEditorModal.tsx`
- **Action**:
  - Expand `viewMode` state type: `'studio' | 'preview' | 'details'`.
  - Add `Preview` tab with `<Eye className="w-3.5 h-3.5" />` in center View Switcher.
  - When `viewMode === 'preview'`, render responsive block preview pane with Device Viewport Selector (`Desktop`, `Tablet`, `Mobile`) and live `BlockRenderer`.
  - Wrap in `<PortalThemeProvider>` to reflect active portal primary colors and typography.
- **Verification**: Run `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`.
- **Commit**: `feat(studio): add real-time responsive block preview tab to ContentEditorModal`

---

### Phase 5: Verification, Quality & Safety Audit

#### Task 5.1: Unit Test Suite
- Run `npx vitest run src/lib/services/__tests__/ src/hooks/__tests__/`.
- Verify all 33+ test files pass.

#### Task 5.2: Strict TypeScript & Lint Verification
- Run `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit` (expect 0 errors, 0 `any`).
- Run `npm run lint` (expect 0 errors).

#### Task 5.3: Git Safety & Local Commit
- Ensure git working tree is clean.
- Verify NO commits are pushed to `origin/main` (local commits only).

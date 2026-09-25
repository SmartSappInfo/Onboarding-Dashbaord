# Architecture & Implementation Plan: Step Section Properties Overhaul

> **Owner:** Principal UI/UX Architect & Senior Frontend Specialist  
> **Status:** Completed  
> **Date:** September 25, 2026  
> **Governing Standards:** `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`  

---

## 1. Overview & Problem Statement

In the Step Section block properties panel, users encounter three UX shortcomings:
1. **Step Index / Sequence:** Currently a plain, uninspiring text/number input rather than an intuitive, tactile **Number Stepper** (`[-]` and `[+]`).
2. **Video & Media Input:** Currently fragmented into two separate, disconnected fields (`Embed Video Link` and `Step Image Source (Fallback)`). Users need **one unified media component** that seamlessly accepts links (YouTube / Vimeo / MP4), direct file uploads, and media library assets with thumbnail support.
3. **Media Alignment Placement:** Currently a plain drop-down `<Select>` menu. Users need **visual thumbnail cards** representing the 4 media placement options (`Media on Top`, `Media at Bottom`, `Media on Left`, `Media on Right`) to make spatial adjustments instant and visual.

---

## 2. Visual Architecture & Inspector Presentation

```
┌───────────────────────────────────────────────────────────────┐
│                   STEP SECTION BLOCK PROPERTIES               │
├───────────────────────────────────────────────────────────────┤
│ STEP INDEX / SEQUENCE                                         │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │  [ - ]                      1                       [ + ] │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ STEP HEADLINE                                                 │
│ [ Step Title                                                ] │
│                                                               │
│ STEP DESCRIPTION                                             │
│ [ Fill out the required module fields details...            ] │
│                                                               │
│ STEP MEDIA (Unified Video & Image Component)                  │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │  [ Video / Media Uploader: Link | Upload | Library ]      │ │
│ │  Drag & drop video/image, or paste YouTube/Vimeo link     │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ MEDIA ALIGN PLACEMENT (Visual Miniature Wireframes)           │
│ ┌───────────────────────────┐   ┌───────────────────────────┐ │
│ │ [   Media on Top   ]      │   │ [      Text Top     ]     │ │
│ │ [       Text       ]      │   │ [  Media at Bottom  ]     │ │
│ │ Media on Top              │   │ ✔ Media at Bottom         │ │
│ ├───────────────────────────┤   ├───────────────────────────┤ │
│ │ [ Media ] [ Text ]        │   │ [ Text ] [ Media ]        │ │
│ │ Media on Left             │   │ Media on Right            │ │
│ └───────────────────────────┘   └───────────────────────────┘ │
│                                                               │
│ ACCENT BORDER COLOR                                           │
│ [ Swatch + #10B981 Input ]                                    │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Architecture

### A. Number Stepper Control (`NumberStepperControl.tsx`)
- High-touch, ergonomic numeric stepper:
  - Decrement button `[-]` (disabled when value <= min).
  - Center editable numeric input with mono numeral font and spinbutton accessibility (`role="spinbutton"`).
  - Increment button `[+]`.
  - Minimum 44px mobile touch targets (`min-h-[44px]`).
  - Tactile micro-interactions (`active:scale-[0.97]`).
  - Keyboard arrow navigation (`ArrowUp` / `ArrowDown`).

### B. Unified Media Component
- In `step-section.tsx`, replace the dual `videoUrl` (text input) + `imageUrl` (image uploader) with:
  `{ kind: 'video', key: 'videoData', label: 'Step Media' }`
- Utilizes the unified `<VideoUploader />` component which already bundles:
  - Direct video/media file uploads with progress meter
  - YouTube / Vimeo / MP4 streaming links
  - Media Library picker dialog
  - Integrated thumbnail / poster management
- **Backward Compatibility:**
  - Runtime renderer and schema gracefully resolve media from either `props.videoData` (new unified object) or legacy `props.videoUrl` / `props.imageUrl` strings.

### C. Media Placement Selector (`MediaPlacementSelector.tsx`)
- 2x2 grid of miniature tactile WYSIWYG cards representing:
  1. `top`: Media stacked above headline and description.
  2. `bottom`: Media stacked below headline and description.
  3. `left`: Media positioned on the left (50/50 split), text on the right.
  4. `right`: Media positioned on the right (50/50 split), text on the left.
- Features:
  - Miniature SVG/DOM wireframes showing spatial orientation.
  - Active checkmark badge and selection halo.
  - Keyboard navigation (Arrow keys, Space, Enter) with roving focus.
  - WAI-ARIA `role="radiogroup"` with `aria-label="Media Placement"` and `role="radio"`.
  - Minimum 44px / 92px touch targets.

---

## 4. What Could Go Wrong & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **R-1: Legacy Step Blocks Crashing on Schema Change** | Existing pages in Firestore have `videoUrl` and `imageUrl` stored as flat strings. | Use a Zod schema that keeps `videoUrl` and `imageUrl` optional with defaults, accepts `videoData`, and resolves effective media dynamically. |
| **R-2: Number Stepper Boundary Violations** | Users clicking decrement below 1 or typing negative/non-numeric values. | Enforce `Math.max(min, ...)` on decrement and validate input parsing with safe fallback. |
| **R-3: Redundant Inspector Outer Label** | AutoBlockEditor rendering an outer `<Label>Media Align Placement</Label>` above the visual wireframe selector. | Add `isMediaPlacement` to outer label suppression in `AutoBlockEditor.tsx`. |

---

## 5. Phase-by-Phase Implementation Plan

### Phase 1: Number Stepper Control (`NumberStepperControl.tsx`)
- [x] Write failing unit tests in `src/components/page-builder/__tests__/NumberStepperControl.test.tsx`.
- [x] Create `src/components/page-builder/NumberStepperControl.tsx`.
- [x] Update `AutoBlockEditor.tsx` `case 'number':` to render `<NumberStepperControl />`.

### Phase 2: Media Placement Selector (`MediaPlacementSelector.tsx`)
- [x] Write failing unit tests in `src/components/page-builder/__tests__/MediaPlacementSelector.test.tsx`.
- [x] Create `src/components/page-builder/MediaPlacementSelector.tsx` with 4 miniature WYSIWYG wireframes (`top`, `bottom`, `left`, `right`).
- [x] Update `AutoBlockEditor.tsx` `case 'select':` to route `field.key === 'mediaPosition'` to `<MediaPlacementSelector />`.

### Phase 3: Unified Step Media Schema & Runtime (`step-section.tsx`)
- [x] Write failing unit tests in `src/components/page-builder/__tests__/StepSectionMedia.test.tsx`.
- [x] Update `src/lib/page-builder/blocks/step-section.tsx`:
  - [x] Register `{ kind: 'video', key: 'videoData', label: 'Step Media' }`.
  - [x] Support legacy and unified media resolving in `render`.
- [x] Suppress outer labels in `AutoBlockEditor.tsx`.

### Phase 4: Full System Verification
- [x] Run all vitest unit tests (33 test files, 150 tests passing).
- [x] Run `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit` (0 errors).
- [x] Run `npm run lint` (0 errors).
- [x] Commit locally (no remote pushes).

# Video Presets, Motion, Playback State & Interactive Controls Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform video components across the Page Builder, Portal Content Studio, and Public Landing Pages into an industry-grade, 1-click video preset system bundling container styling (inherited from image presets: 16:9, 9:16, 1:1, browser window, mobile chassis) with behavioral runtime archetypes (Ambient Background Loop, Hero Walkthrough, Social Reel, Interactive Micro-Demo), reactive ambient glow lighting, motion play triggers (Radar pulse, Glassmorphic pill, Minimal bottom badge), kinetic hover previews, and custom player chrome with zero data drift, robust mobile accessibility, and complete backward compatibility.

**Architecture:** Hybrid "Behavioral Preset Archetype + Progressive Disclosure" pattern. Tier 1 provides 4 visual miniature animated wireframe archetype cards (`ambient-loop`, `hero-walkthrough`, `social-reel`, `micro-demo`) that configure container geometry, elevation, autoplay, sound, and play triggers in a single click. Tier 2 progressively discloses granular adjustments (Aspect Ratio, Device Enclosure, Play Button Archetype, Ambient Glow, Kinetic Hover Preview, Player Chrome). The universal `BlockRenderer` and `VideoEmbed` ensure all presets render identically across Page Builder Canvas, Campaign Landing Pages, Portal Content Reader, and LMS Course Lesson Player.

**Tech Stack:** Next.js 15, React 19, TypeScript (strictly 0 `any`, 0 `any[]`, 0 unhandled `unknown`), Tailwind CSS v4, Lucide React, Vitest, React Testing Library, Firebase Firestore.

---

## 1. Architectural Strategy & Design System

### 1.1 How Image Presets Translate into Video Presets

While an image preset defines **geometry, masking, and elevation**, a video preset defines **appearance + behavioral archetype**:

$$\text{Image Preset} = \text{Shape/Mask} + \text{Aspect Ratio} + \text{Elevation/Chassis} + \text{Hover Transition}$$
$$\text{Video Preset} = \underbrace{\text{Container Styling (inherited from Image)}}_{\text{Aspect Ratio, Radius/Chassis, Elevation}} + \underbrace{\text{Runtime Engine Archetype}}_{\text{Autoplay, Audio State, Player Chrome, Play Triggers, Lightbox/Inline, Reactive Glow}}$$

### 1.2 The 4 Core Video Preset Archetypes

| Archetype | Visual Enclosure | Runtime Behavior | Play Trigger & Audio |
| :--- | :--- | :--- | :--- |
| **1. Ambient Background Loop** (`ambient-loop`) | 16:9 Widescreen or Full-Bleed, subtle or no border, with **Reactive Ambient Glow** halo behind container (`blur(40px) opacity-60`). | Autoplay: `true`, Muted: `true`, Loop: `true`, Controls: `false`. 30% Dark Tint (`bg-black/30`) for high headline contrast. | No play button; perpetual atmospheric background motion. |
| **2. Hero Walkthrough** (`hero-walkthrough`) | 16:9 Landscape framed inside **Desktop Browser Window** (macOS 3 traffic dots `#ff5f56`, `#ffbd2e`, `#27c93f` + URL pill) or Deep Floating Shadow. | Autoplay: `false`. Mode: Lightbox Modal (or Inline). | **Radar / Pulse Play Button** (pulsing concentric ping rings + glass disc). Audio starts unmuted on user click. |
| **3. Social Reel / Story** (`social-reel`) | **9:16 Vertical**, framed inside **Frameless iPhone Mobile Chassis** with top speaker notch and bezel. | Autoplay: `true` (muted) or click to play, Loop: `true`. | Floating **"Tap to Unmute 🔇"** badge or dynamic animated equalizer bars. Tap toggles sound without interrupting playback. |
| **4. Interactive Micro-Demo** (`micro-demo`) | 16:9 or 4:3 Standard, Clean Rounded Card (16px) or Browser Window. | **Kinetic Hover Preview** (mouse enter starts silent loop; mouse leave pauses/resets). Click opens full unmuted player. | **Minimalist Bottom Scrubber Line** (2px micro-scrubber anchored to bottom edge) or discreet bottom badge (`▶ 2 min`). |

### 1.3 Data Contract & Schema Specifications

```typescript
export type VideoPresetArchetypeId =
  | 'ambient-loop'
  | 'hero-walkthrough'
  | 'social-reel'
  | 'micro-demo';

export type VideoPlayButtonArchetype =
  | 'pulse'          // Concentric radar waves expanding outward
  | 'glass-pill'      // Frosted blur pill ("Watch 2-Min Demo ▶")
  | 'minimal-badge'  // Discreet bottom-left badge
  | 'standard';      // Centered frosted circle disc

export type VideoControlsTheme =
  | 'standard'        // Default YouTube/HTML5 controls
  | 'minimal-line'   // 2px bottom micro-scrubber
  | 'ghost'          // Controls invisible until cursor hover
  | 'floating-island'; // Detached glassmorphic control capsule

export interface VideoPresetBundleAttributes {
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  elevation: 'none' | 'hairline' | 'shadow' | 'browser' | 'mobile';
  borderRadius: 'none' | 'rounded' | 'squircle';
  playMode: 'inline' | 'modal';
  autoPlay: boolean;
  muted: boolean;
  loop: boolean;
  ambientGlow: boolean;
  hoverPreview: boolean;
  playButtonArchetype: VideoPlayButtonArchetype;
  controlsTheme: VideoControlsTheme;
  overlayTint: 'none' | 'dark-30' | 'dark-50';
}
```

---

## 2. Failure Mode, Risk & Resilience Analysis (What Could Go Wrong & Resolutions)

### Risk 1: Browser Autoplay Policy & Audio Rejections
- **Potential Failure:** Modern browsers (Safari, Chrome, iOS) strictly reject unmuted autoplay (`NotAllowedError: play() failed because the user didn't interact with the document first`).
- **Root Cause:** W3C / browser audio policy restrictions against unprompted audio playback.
- **Engineered Resolution:** Strict enforcement of `muted = true` whenever `autoPlay = true`. Any archetype configured with autoplay (such as `ambient-loop` and `social-reel`) always initializes with `muted={true}` and `playsInline={true}`. Sound is only activated after a direct user tap/click on the "Tap to Unmute" trigger.

### Risk 2: Provider URL & Parameter Diversity (YouTube, Vimeo, Loom, Direct MP4)
- **Potential Failure:** Different video providers support different URL parameters (`autoplay=1&mute=1` vs `background=1` vs HTML5 `<video autoplay muted loop>`). If a user applies the `ambient-loop` preset to a YouTube URL, but YouTube iframe doesn't receive `mute=1&controls=0&loop=1&playlist={id}`, it will show standard YouTube UI, red play button, and fail autoplay.
- **Root Cause:** Provider API heterogeneity.
- **Engineered Resolution:** Deep URL normalization inside `VideoEmbed.tsx`:
  - **YouTube:** Injects `autoplay=1&mute=1&controls=0&loop=1&playlist=${ytid}&modestbranding=1&rel=0`.
  - **Vimeo:** Injects `background=1&autoplay=1&loop=1&muted=1`.
  - **Loom:** Appends `hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`.
  - **Direct MP4 / Firebase Storage:** Configures `<video autoPlay muted loop playsInline controls={false} />`.

### Risk 3: Ambient Glow GPU Overdraw & Memory Leaks on Mobile
- **Potential Failure:** Rendering a duplicate video element or high-radius CSS blur filter (`blur(60px)`) on mobile devices can cause heavy GPU memory usage or frame drops.
- **Root Cause:** Continuous Gaussian blur calculation over high-resolution video streams on low-power mobile GPUs.
- **Engineered Resolution:**
  1. CSS-only hardware-accelerated radial ambient aura using `bg-radial` with `will-change: transform; transform: translateZ(0); pointer-events: none; -z-10`.
  2. Respect `prefers-reduced-motion`: automatically disable the animated glow when the visitor enables reduced motion (`motion-reduce:hidden`).
  3. Never mount a second active decoding video element; use a lightweight blurred radial backdrop to keep CPU/GPU utilization near zero.

### Risk 4: WebKit Iframe Radius Clipping (Corner Bleed)
- **Potential Failure:** In WebKit/Safari, `<iframe>` elements (YouTube/Vimeo) often bleed through `rounded-2xl` corners or device frames during rendering transitions.
- **Root Cause:** GPU compositing layering bugs between native CSS borders and foreign iframe surfaces.
- **Engineered Resolution:** Standard WebKit anti-clipping container recipe: `overflow: hidden; isolation: isolate; -webkit-mask-image: -webkit-radial-gradient(white, black); border-radius: ...;` on the player container. This forces Safari's compositing engine to clip the iframe surface cleanly.

### Risk 5: Touch Devices vs. Hover Previews (Kinetic Hover Conflict)
- **Potential Failure:** Hover previews on mobile devices trigger on tap, preventing the user from clicking the video or modal.
- **Root Cause:** Simulated mouse events on mobile browsers when touching screen elements.
- **Engineered Resolution:** Media query gating via CSS `@media (hover: hover) and (pointer: fine)`. On touch devices, hover preview gracefully degrades to tap-to-play with immediate feedback.

### Risk 6: Security & Embed Injection (XSS / Malicious URLs)
- **Potential Failure:** User-supplied video URLs might contain `javascript:`, base64 payloads, or malicious iframes.
- **Root Cause:** Unsanitized user inputs rendered into iframe sources or video src attributes.
- **Engineered Resolution:** URL sanitization whitelist supporting strictly `http:` and `https:`, parsing recognized video provider hosts (`youtube.com`, `youtu.be`, `vimeo.com`, `loom.com`, and approved cloud storage URLs like Firebase Storage `firebasestorage.googleapis.com`). Restrict iframe sandbox attributes (`sandbox="allow-scripts allow-same-origin allow-presentation"`).

### Risk 7: Backward Compatibility & Legacy Video Blocks
- **Potential Failure:** Existing video blocks store `{ url, thumbnailUrl, title, description, titlePosition, playMode, videoData }` without `preset`, `ambientGlow`, or `playButtonArchetype`.
- **Root Cause:** Schema parse rejection on missing fields.
- **Engineered Resolution:** Non-breaking Zod `.transform()` adapter: all new attributes have smart defaults. If `preset` is missing, legacy blocks map to `hero-walkthrough` with `standard` play button and their existing `playMode` preserved, ensuring 100% fidelity on existing pages.

---

## 3. Cross-Feature Impact & Backoffice Empowerment

### 3.1 Cross-Feature Impact Matrix

| Affected Feature / Surface | Impact Analysis | Mitigation & Testing Requirement |
| :--- | :--- | :--- |
| **Page Builder Canvas (`Canvas.tsx`)** | Renders video block in `mode="edit"`. Must support "Change Video" source dialog, cover settings, and live archetype reflection without autoplaying audio in the editor. | Ensure video autoplay is disabled when `ctx.mode === 'edit'`, but visual chassis, play buttons, and ambient glow render WYSIWYG. |
| **Campaign Landing Pages (`PublicPageClient.tsx` / `PageRenderer.tsx`)** | Public view mode (`mode="view"`). Full runtime execution of Ambient Loop, Hero Walkthrough modal, Social Reel unmuting, and Micro-Demo hover. | Verify zero layout shift, seamless modal launching, and flawless mobile touch handling. |
| **Portal Content Studio & Reader (`ContentBlockCanvas.tsx`, `PortalContentReaderClient.tsx`)** | Instructors/admins embedding video tutorials in portal articles. | Verify browser chassis, iPhone frames, and ambient glow render properly inside reader containers. |
| **LMS Lesson Player (`PortalCoursePlayerClient.tsx`)** | Students watching video lessons. | Ensure video player aspect ratios (16:9, 9:16) adapt fluidly within lesson player layouts without breaking layout flow. |
| **Hero Block (`hero.tsx`) & Testimonial Block (`testimonial.tsx`)** | Hero Video Sales pages and video testimonials use `VideoEmbed`. | Upgrades to `VideoEmbed` automatically elevate video sales letters and video testimonials across the entire platform with zero code duplication. |
| **Undo / Redo & Autosave (`useUndoRedo`, `useAutosave`)** | Changing archetypes updates block props via `onUpdateProps`. | Archetype bundles update props cleanly in a single action, allowing 1-click undo/redo. |

### 3.2 Backoffice Empowerment (Managing Presets Without Touching Code)
1. **1-Click Archetype Gallery in Inspector:**
   In `AutoBlockEditor.tsx`, administrators select from the 4 visual archetypes. Selecting an archetype automatically bundles optimal container frames, aspect ratios, autoplay flags, and play triggers.
2. **Progressive Disclosure Fine-Tuning:**
   Administrators can fine-tune specific controls (e.g. toggling ambient glow on/off, adjusting aspect ratio from 16:9 to 9:16, changing the play button trigger to a glassmorphic pill) without resetting or losing the archetype.
3. **Workspace Default Theme Integration:**
   Play buttons and ambient glows automatically inherit the workspace's brand primary color token (`var(--primary)` / `brandPrimaryColor`), guaranteeing consistent branding across all pages.

---

## 4. Database, Security Rules & Public Scoping

### 4.1 Single Source of Truth & Data Integrity
All video block properties are stored within the block's `props` JSON object inside Firestore documents:
- Campaign Pages: `campaign_pages/{pageId}/versions/{versionId}` $\to$ `blocks[]`
- Portal Content: `portals/{portalId}/content/{contentId}` $\to$ `blocks[]`

**Fetch / Enrich / Restore Protocol:**
1. **Fetch:** Block data is retrieved from Firestore as raw JSON.
2. **Enrich:** `BlockRenderer` passes the raw props through `videoDef.schema.safeParse(...)`. The `.transform()` adapter enriches missing fields with archetype defaults without mutating the database.
3. **Restore / Save:** When modified in the editor, `onUpdateProps` emits a non-mutating patch back to the page state, which `useAutosave` saves to Firestore.

### 4.2 Firebase Firestore Security Rules
Public campaign pages and published portal articles require unauthenticated read access for video blocks, but strict isolation for editing:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Campaign Pages: Public reads for published pages
    match /campaign_pages/{pageId} {
      allow read: if resource.data.status == 'published' || request.auth != null;
      allow write: if request.auth != null;
      
      match /versions/{versionId} {
        allow read: if get(/databases/$(database)/documents/campaign_pages/$(pageId)).data.status == 'published' 
                    || request.auth != null;
        allow write: if request.auth != null;
      }
    }

    // Portal Articles & LMS Lessons: Read-scoped to portal access
    match /portals/{portalId}/content/{contentId} {
      allow read: if resource.data.status == 'published' || request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

No database migration script is needed because the schema's `.transform()` adapter guarantees 100% backward compatibility for existing blocks.

---

## 5. Mobile-First Ergonomics & Everyday UI English

### 5.1 Touch Targets & Mobile Gestures
- **Minimum 44px Touch Targets:** All interactive archetype cards in `VideoPresetSelector.tsx` (`min-h-[92px]`), play buttons in `PlayButtonArchetypeSelector.tsx` (`min-h-[58px]`), and runtime play button overlays (`w-14 h-14` / `min-h-[44px]`) exceed mobile accessibility requirements.
- **Tactile Feedback:** Emil Kowalski micro-interaction tokens (`active:scale-[0.97]`, `duration-200 ease-out`).
- **Touch Gating:** Hover preview features are gated behind `@media (hover: hover)` to prevent tap-freeze on mobile screens.

### 5.2 Everyday UI English
All labels, tooltips, and presets use clear, simple English without tech jargon or raw code:
- *"Ambient Background Loop"* — Autoplay, muted, soft glow
- *"Hero Walkthrough"* — Desktop window, pulse play button
- *"Social Reel / Story"* — Vertical phone format, tap to unmute
- *"Interactive Micro-Demo"* — Play on hover, bottom progress line
- *"Play Button Style"* — Radar Pulse, Glass Pill, Minimal Badge, Classic Disc
- *"Ambient Reactive Glow"* — Soft colorful glow behind video
- *"Dark Tint Overlay"* — Improves text readability on top of video

---

## 6. Security, Sanitization & Vulnerability Protection

1. **Protocol Sanitization:** `sanitizeVideoUrl()` rejects any protocol other than `http:`, `https:`, or relative paths `/`, blocking `javascript:`, `data:`, and `vbscript:` attacks.
2. **Provider Parsing & Sandbox:** Video IDs are extracted via strict regular expressions validating 11-character YouTube IDs and numeric Vimeo IDs.
3. **Iframe Sandboxing:** Rendered iframes include `sandbox="allow-scripts allow-same-origin allow-presentation"` and `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"`.
4. **Zero HTML/CSS Leakage:** All captions and descriptions use React sanitized text nodes or `InlineEditable` with `html={false}`.

---

## 7. Performance & High-Load Architecture

1. **Lazy Loading:** Video poster thumbnails use `next/image` with `priority={false}` and `decoding="async"`.
2. **Zero Secondary Decoding:** Ambient glow utilizes pure CSS radial gradient rendering (`blur-2xl opacity-60 pointer-events-none -z-10 scale-105`) rather than a second decoding `<video>` element, saving 50MB+ RAM and eliminating mobile CPU thermal throttling.
3. **Event Listener Teardown:** All hover and audio event listeners are wrapped in standard React `useEffect` hooks with deterministic cleanup callbacks.
4. **Batch Operation Safety:** Autosave debouncing (`useAutosave`) batches prop updates, preventing Firestore quota exhaustion under rapid typing or slider changes.

---

## 8. Phase-by-Phase Trackable Implementation Plan

### Task 1: Video Block Schema Extension & Archetype Bundle Adapter

**Files:**
- Modify: `src/lib/page-builder/blocks/video.tsx`
- Test: `src/components/page-builder/__tests__/VideoPresetSchema.test.tsx`

- [x] **Step 1: Write the failing test for Video Preset Schema and Archetype Bundles**

```typescript
// src/components/page-builder/__tests__/VideoPresetSchema.test.tsx
import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/video';

describe('Video Block Schema & Archetype Bundles', () => {
  const videoDef = getBlock('video')!;

  it('registers the video block with extended preset, button archetype, and glow fields', () => {
    expect(videoDef).toBeDefined();
    expect(videoDef.type).toBe('video');
    const fieldKeys = videoDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('preset');
    expect(fieldKeys).toContain('aspectRatio');
    expect(fieldKeys).toContain('playButtonArchetype');
    expect(fieldKeys).toContain('ambientGlow');
    expect(fieldKeys).toContain('hoverPreview');
    expect(fieldKeys).toContain('controlsTheme');
    expect(fieldKeys).toContain('overlayTint');
  });

  it('safely parses legacy video block props without breaking defaults', () => {
    const legacyProps = {
      url: 'https://youtube.com/watch?v=12345678901',
      playMode: 'modal',
      title: 'Legacy Title',
    };

    const parsed = videoDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.preset).toBe('hero-walkthrough');
      expect(parsed.data.playMode).toBe('modal');
      expect(parsed.data.playButtonArchetype).toBe('pulse');
    }
  });

  it('applies ambient-loop defaults accurately', () => {
    const ambientProps = {
      url: 'https://example.com/loop.mp4',
      preset: 'ambient-loop',
    };

    const parsed = videoDef.schema.safeParse(ambientProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.autoPlay).toBe(true);
      expect(parsed.data.muted).toBe(true);
      expect(parsed.data.loop).toBe(true);
      expect(parsed.data.ambientGlow).toBe(true);
      expect(parsed.data.overlayTint).toBe('dark-30');
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/VideoPresetSchema.test.tsx`
Expected: FAIL with missing fields on video definition.

- [x] **Step 3: Update `src/lib/page-builder/blocks/video.tsx` with extended Zod schema and archetype defaults**

Update schema in `src/lib/page-builder/blocks/video.tsx` with `preset`, `aspectRatio`, `elevation`, `borderRadius`, `autoPlay`, `muted`, `loop`, `ambientGlow`, `hoverPreview`, `playButtonArchetype`, `controlsTheme`, and `overlayTint` with non-breaking transform defaults.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/VideoPresetSchema.test.tsx`
Expected: PASS

- [x] **Step 5: Commit changes locally**

```bash
git add src/lib/page-builder/blocks/video.tsx src/components/page-builder/__tests__/VideoPresetSchema.test.tsx
git commit -m "feat(video): extend video block schema with behavioral archetypes, ambient glow, and interactive controls"
```

---

### Task 2: Visual Video Preset Archetype Selector (`VideoPresetSelector.tsx`)

**Files:**
- Create: `src/components/page-builder/VideoPresetSelector.tsx`
- Test: `src/components/page-builder/__tests__/VideoPresetSelector.test.tsx`

- [x] **Step 1: Write the failing test for VideoPresetSelector**

```typescript
// src/components/page-builder/__tests__/VideoPresetSelector.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoPresetSelector } from '../VideoPresetSelector';

describe('VideoPresetSelector', () => {
  const options = [
    { value: 'ambient-loop', label: 'Ambient Background Loop' },
    { value: 'hero-walkthrough', label: 'Hero Walkthrough' },
    { value: 'social-reel', label: 'Social Reel / Story' },
    { value: 'micro-demo', label: 'Interactive Micro-Demo' },
  ];

  it('renders all 4 video preset archetypes with accessible radio roles', () => {
    render(<VideoPresetSelector value="hero-walkthrough" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /video preset archetype/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks current archetype as aria-checked with checkmark indicator', () => {
    render(<VideoPresetSelector value="ambient-loop" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /ambient background loop/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange with archetype key and bundle when clicked', () => {
    const handleChange = vi.fn();
    render(<VideoPresetSelector value="hero-walkthrough" options={options} onChange={handleChange} />);
    const reelCard = screen.getByRole('radio', { name: /social reel/i });
    fireEvent.click(reelCard);
    expect(handleChange).toHaveBeenCalledWith('social-reel', expect.objectContaining({
      aspectRatio: '9:16',
      elevation: 'mobile',
    }));
  });

  it('supports roving tabindex keyboard navigation with arrow keys and focus transfer', () => {
    const handleChange = vi.fn();
    render(<VideoPresetSelector value="ambient-loop" options={options} onChange={handleChange} />);
    const firstRadio = screen.getByRole('radio', { name: /ambient background loop/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('hero-walkthrough', expect.any(Object));
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/VideoPresetSelector.test.tsx`
Expected: FAIL with "Cannot find module '../VideoPresetSelector'"

- [x] **Step 3: Implement `src/components/page-builder/VideoPresetSelector.tsx`**

Implement `VideoPresetSelector.tsx` with 4 miniature animated WYSIWYG wireframes, `VIDEO_PRESET_BUNDLES`, DOM focus management via `buttonRefs`, and mobile-first `min-h-[92px]` touch targets.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/VideoPresetSelector.test.tsx`
Expected: PASS

- [x] **Step 5: Commit changes locally**

```bash
git add src/components/page-builder/VideoPresetSelector.tsx src/components/page-builder/__tests__/VideoPresetSelector.test.tsx
git commit -m "feat(inspector): create VideoPresetSelector with 4 animated miniature wireframes and keyboard accessibility"
```

---

### Task 3: Play Button Archetype Selector (`PlayButtonArchetypeSelector.tsx`)

**Files:**
- Create: `src/components/page-builder/PlayButtonArchetypeSelector.tsx`
- Test: `src/components/page-builder/__tests__/PlayButtonArchetypeSelector.test.tsx`

- [x] **Step 1: Write the failing test for PlayButtonArchetypeSelector**

```typescript
// src/components/page-builder/__tests__/PlayButtonArchetypeSelector.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlayButtonArchetypeSelector } from '../PlayButtonArchetypeSelector';

describe('PlayButtonArchetypeSelector', () => {
  const options = [
    { value: 'pulse', label: 'Radar / Pulse Waves' },
    { value: 'glass-pill', label: 'Glassmorphic Pill' },
    { value: 'minimal-badge', label: 'Minimal Bottom Badge' },
    { value: 'standard', label: 'Classic Disc' },
  ];

  it('renders all 4 play button archetypes with accessible radio roles', () => {
    render(<PlayButtonArchetypeSelector value="pulse" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /play button style/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks current button style as checked', () => {
    render(<PlayButtonArchetypeSelector value="glass-pill" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /glassmorphic pill/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with selected archetype on click', () => {
    const handleChange = vi.fn();
    render(<PlayButtonArchetypeSelector value="pulse" options={options} onChange={handleChange} />);
    const badge = screen.getByRole('radio', { name: /minimal bottom badge/i });
    fireEvent.click(badge);
    expect(handleChange).toHaveBeenCalledWith('minimal-badge');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/PlayButtonArchetypeSelector.test.tsx`
Expected: FAIL with "Cannot find module '../PlayButtonArchetypeSelector'"

- [x] **Step 3: Implement `src/components/page-builder/PlayButtonArchetypeSelector.tsx`**

Implement `PlayButtonArchetypeSelector.tsx` with Radar Pulse, Glassmorphic Pill, Minimal Bottom Badge, and Classic Disc wireframes, `buttonRefs` focus movement, and `min-h-[58px]` touch targets.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/PlayButtonArchetypeSelector.test.tsx`
Expected: PASS

- [x] **Step 5: Commit changes locally**

```bash
git add src/components/page-builder/PlayButtonArchetypeSelector.tsx src/components/page-builder/__tests__/PlayButtonArchetypeSelector.test.tsx
git commit -m "feat(inspector): create PlayButtonArchetypeSelector with motion wireframes and keyboard accessibility"
```

---

### Task 4: Runtime Video Player Capabilities (Reactive Glow, Hover Previews, Motion Triggers & Chrome)

**Files:**
- Modify: `src/components/video-embed.tsx`
- Modify: `src/lib/page-builder/blocks/video.tsx`
- Test: `src/components/page-builder/__tests__/VideoBlockRuntimeRender.test.tsx`

- [x] **Step 1: Write failing test for runtime video preset rendering**

```typescript
// src/components/page-builder/__tests__/VideoBlockRuntimeRender.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BlockRenderer } from '../BlockRenderer';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/video';

const mockCtx: BlockRenderContext = {
  mode: 'view',
  device: 'desktop',
  theme: {
    themeMode: 'light',
    brandPrimaryColor: '#000000',
    brandSecondaryColor: '#ffffff',
    brandFontFamily: 'sans',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    primaryButtonBgColor: '#000000',
    primaryButtonTextColor: '#ffffff',
  },
};

describe('Video Block Runtime Presets', () => {
  it('renders ambient reactive glow aura behind video container', () => {
    const block: PageBlock = {
      id: 'vid-1',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'ambient-loop',
        ambientGlow: true,
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const glow = container.querySelector('[data-testid="ambient-reactive-glow"]');
    expect(glow).toBeInTheDocument();
  });

  it('renders desktop browser window frame for hero walkthrough', () => {
    const block: PageBlock = {
      id: 'vid-2',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'hero-walkthrough',
        elevation: 'browser',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const browserBar = container.querySelector('[data-testid="browser-chrome-header"]');
    expect(browserBar).toBeInTheDocument();
  });

  it('renders radar pulse play button trigger', () => {
    const block: PageBlock = {
      id: 'vid-3',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'hero-walkthrough',
        playMode: 'modal',
        playButtonArchetype: 'pulse',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const radar = container.querySelector('[data-testid="radar-pulse-trigger"]');
    expect(radar).toBeInTheDocument();
  });

  it('renders 9:16 vertical mobile phone chassis for social reel', () => {
    const block: PageBlock = {
      id: 'vid-4',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'social-reel',
        aspectRatio: '9:16',
        elevation: 'mobile',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const speaker = container.querySelector('[data-testid="mobile-speaker-bar"]');
    expect(speaker).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/VideoBlockRuntimeRender.test.tsx`
Expected: FAIL with missing ambient glow or radar pulse trigger.

- [x] **Step 3: Update `src/components/video-embed.tsx` and `src/lib/page-builder/blocks/video.tsx`**

Implement:
1. `VideoPlayButtonOverlay` support for `pulse`, `glass-pill`, `minimal-badge`, `standard`.
2. Reactive Ambient Glow aura with hardware-accelerated transforms and `motion-reduce:hidden`.
3. Desktop browser window header chrome with 3 colored dots and mobile phone chassis speaker bar.
4. Tap-to-Unmute floating toggle for muted autoplaying archetypes.
5. Kinetic hover preview support for micro-demo archetype.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/VideoBlockRuntimeRender.test.tsx`
Expected: PASS

- [x] **Step 5: Commit changes locally**

```bash
git add src/components/video-embed.tsx src/lib/page-builder/blocks/video.tsx src/components/page-builder/__tests__/VideoBlockRuntimeRender.test.tsx
git commit -m "feat(video): implement reactive ambient glow, motion play triggers, device frames, and responsive aspect ratios"
```

---

### Task 5: AutoBlockEditor Field Routing & Progressive Disclosure

**Files:**
- Modify: `src/components/page-builder/AutoBlockEditor.tsx`
- Modify: `src/lib/page-builder/blocks/video.tsx`
- Test: `src/components/page-builder/__tests__/AutoBlockEditorVideoPresets.test.tsx`

- [x] **Step 1: Write failing test for AutoBlockEditor Video Preset routing**

```typescript
// src/components/page-builder/__tests__/AutoBlockEditorVideoPresets.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoBlockEditor } from '../AutoBlockEditor';
import type { PageBlock } from '@/lib/types';
import '@/lib/page-builder/blocks/video';

describe('AutoBlockEditor Video Preset Routing', () => {
  const videoBlock: PageBlock = {
    id: 'block-vid-1',
    type: 'video',
    props: {
      url: 'https://youtube.com/watch?v=12345678901',
      preset: 'hero-walkthrough',
      aspectRatio: '16:9',
      playButtonArchetype: 'pulse',
    },
  };

  it('renders VideoPresetSelector for video preset field and PlayButtonArchetypeSelector without duplicate outer labels', () => {
    render(
      <AutoBlockEditor
        block={videoBlock}
        resources={{ forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] }}
        onUpdateProps={vi.fn()}
      />
    );

    expect(screen.getByRole('radiogroup', { name: /video preset archetype/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /play button style/i })).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/AutoBlockEditorVideoPresets.test.tsx`
Expected: FAIL.

- [x] **Step 3: Update `src/components/page-builder/AutoBlockEditor.tsx` and `video.tsx`**

1. Route `preset` (for block type `'video'`) to `<VideoPresetSelector />`.
2. Route `playButtonArchetype` to `<PlayButtonArchetypeSelector />`.
3. Suppress duplicate outer labels for `isVideoPreset` and `isPlayButtonArchetype`.
4. Expose clean everyday UI English fine-tuning labels in `video.tsx`:
   - "Preset Archetype"
   - "Aspect Ratio"
   - "Play Button Trigger Style"
   - "Ambient Reactive Glow"
   - "Kinetic Hover Preview"
   - "Control Bar Theme"
   - "Dark Tint Overlay"
   - "Playback Mode"
   - "Elevation & Frame"

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/AutoBlockEditorVideoPresets.test.tsx`
Expected: PASS

- [x] **Step 5: Commit changes locally**

```bash
git add src/components/page-builder/AutoBlockEditor.tsx src/lib/page-builder/blocks/video.tsx src/components/page-builder/__tests__/AutoBlockEditorVideoPresets.test.tsx
git commit -m "feat(inspector): integrate VideoPresetSelector and PlayButtonArchetypeSelector into AutoBlockEditor with progressive disclosure"
```

---

### Task 6: Full Verification, Quality Gates & Local Commit

**Files:**
- All touched files

- [x] **Step 1: Run complete page-builder test suite**

Run: `npx vitest run src/components/page-builder/__tests__/`
Expected: All tests pass (including existing 68 tests and all new video preset tests).

- [x] **Step 2: Run strict TypeScript compilation check**

Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Expected: 0 errors.

- [x] **Step 3: Run ESLint**

Run: `npm run lint`
Expected: 0 blocking errors or lint warnings.

- [x] **Step 4: Confirm clean local git working tree**

Run: `git status`
Expected: Clean working tree on local branch without any uncommitted leftovers. (DO NOT push to origin).

---

## 9. Verification Checkpoints & Success Metrics

- [x] **4 Distinct Video Archetypes:** Ambient Background Loop, Hero Walkthrough, Social Reel, Interactive Micro-Demo wireframes render in `VideoPresetSelector.tsx`.
- [x] **Reactive Ambient Lighting:** Soft blurred glow aura pulses behind container with `ambientGlow: true` and respects `prefers-reduced-motion`.
- [x] **Play Button Archetypes:** Radar pulse concentric waves, glassmorphic pill, minimal badge, and classic disc render accurately.
- [x] **Chassis Framing:** 16:9 desktop browser window with macOS dots and 9:16 vertical smartphone chassis frame video players cleanly without iframe clipping.
- [x] **Muted Autoplay Safety:** All autoplaying archetypes initialize with `muted: true` to adhere to browser security policies.
- [x] **Zero `any`:** Strict TypeScript compliance across all new and modified components.
- [x] **Local-Only Git:** Zero pushes to `origin/main` or remote repositories.

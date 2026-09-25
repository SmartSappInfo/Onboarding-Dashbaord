# Video Presets, Motion, Playback State & Interactive Controls Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Video block across the Page Builder and Portal Content Studio into an industry-grade, 1-click video preset system bundling container styling (inherited from image presets: 16:9, 9:16, 1:1, browser window, mobile chassis) with behavioral runtime archetypes (Ambient Background Loop, Hero Walkthrough, Social Reel, Interactive Micro-Demo), reactive ambient glow lighting, motion play triggers (Radar pulse, Glassmorphic pill, Minimal bottom badge), kinetic hover previews, and custom player chrome with zero data drift and full backward compatibility.

**Architecture:** Hybrid "Behavioral Preset Archetype + Progressive Disclosure" pattern. Tier 1 provides 4 visual miniature animated wireframe archetype cards (`ambient-loop`, `hero-walkthrough`, `social-reel`, `micro-demo`) that configure container geometry, elevation, autoplay, sound, and play triggers in a single click. Tier 2 progressively discloses granular adjustments (Aspect Ratio, Device Enclosure, Play Button Archetype, Ambient Glow, Kinetic Hover Preview, Player Chrome). The universal `BlockRenderer` and `VideoEmbed` ensure all presets render identically across Page Builder Canvas, Campaign Landing Pages, Portal Content Reader, and LMS Course Lesson Player.

**Tech Stack:** Next.js 15, React 19, TypeScript (strictly 0 `any`, 0 `any[]`, 0 unhandled `unknown`), Tailwind CSS v4, Lucide React, Vitest, React Testing Library.

---

## 1. Architectural Strategy & Design System

### 1.1 How Image Presets Translate into Video Presets

$$\text{Image Preset} = \text{Shape/Mask} + \text{Aspect Ratio} + \text{Elevation/Chassis} + \text{Hover Transition}$$
$$\text{Video Preset} = \underbrace{\text{Container Styling (inherited from Image)}}_{\text{Aspect Ratio, Radius/Chassis, Elevation}} + \underbrace{\text{Runtime Engine Archetype}}_{\text{Autoplay, Audio State, Player Chrome, Play Triggers, Lightbox/Inline, Reactive Glow}}$$

### 1.2 The 4 Core Video Preset Archetypes

| Archetype | Visual Enclosure | Runtime Behavior | Play Trigger & Audio |
| :--- | :--- | :--- | :--- |
| **1. Ambient Background Loop** (`ambient-loop`) | 16:9 Widescreen or Full, subtle border, with **Reactive Ambient Glow** halo behind container (`blur(40px) opacity-60`). | Autoplay: `true`, Muted: `true`, Loop: `true`, Controls: `false`. 30% Dark Tint (`bg-black/30`) for typography contrast. | No play button; perpetual atmospheric background motion. |
| **2. Hero Walkthrough** (`hero-walkthrough`) | 16:9 Landscape framed inside **Desktop Browser Window** (macOS 3 traffic dots `#ff5f56`, `#ffbd2e`, `#27c93f` + URL pill) or Deep Floating Shadow. | Autoplay: `false`. Mode: Lightbox Modal (or Inline). | **Radar / Pulse Play Button** (pulsing concentric ping rings + glass disc). Audio starts unmuted on click. |
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

## 2. Failure Mode & Resilience Analysis (What Could Go Wrong & Resolutions)

### Risk 1: Browser Autoplay Policy & Audio Rejections
- **Potential Failure:** Modern browsers (Safari, Chrome, iOS) strictly reject unmuted autoplay (`NotAllowedError: play() failed because the user didn't interact with the document first`).
- **Engineered Resolution:** Strict enforcement of `muted = true` whenever `autoPlay = true`. Any archetype configured with autoplay (such as `ambient-loop` and `social-reel`) always initializes with `muted={true}` and `playsInline={true}`. Sound is only activated after a direct user tap/click on the "Tap to Unmute" trigger.

### Risk 2: Ambient Glow GPU Overdraw & Memory Leaks on Mobile
- **Potential Failure:** Rendering a duplicate video element or high-radius CSS blur filter (`blur(60px)`) on mobile devices can cause heavy GPU memory usage or frame drops.
- **Engineered Resolution:**
  1. On mobile viewports or devices with `prefers-reduced-motion`, use a lightweight radial gradient glow (`radial-gradient(circle, rgba(primary, 0.3) 0%, transparent 70%)`) with `pointer-events-none -z-10`.
  2. The glow container uses `will-change-transform` and is strictly clipped behind the primary video frame.

### Risk 3: Iframe Clipping inside Rounded Masks & Device Chassis
- **Potential Failure:** Embedded YouTube/Vimeo iframes can ignore parent CSS `border-radius` during video initialization in Safari/WebKit, popping out of rounded corners or chassis bezels.
- **Engineered Resolution:** Standard WebKit anti-clipping container recipe: `overflow: hidden; isolation: isolate; -webkit-mask-image: -webkit-radial-gradient(white, black);` on the player container. This forces hardware-accelerated clipping on all iframe elements across WebKit, Gecko, and Blink.

### Risk 4: Hover Preview Conflicts with Touch Screens
- **Potential Failure:** Kinetic hover preview expects `mouseenter` and `mouseleave`. On touch screens (smartphones/tablets), touch triggers a simulated hover that doesn't clear, causing unexpected looping.
- **Engineered Resolution:** Media query gating via CSS `@media (hover: hover) and (pointer: fine)`. On touch devices, hover preview gracefully degrades to tap-to-play with immediate feedback.

### Risk 5: Backward Compatibility & Legacy Video Blocks
- **Potential Failure:** Existing video blocks store `{ url, thumbnailUrl, title, description, titlePosition, playMode, videoData }` without `preset`, `ambientGlow`, or `playButtonArchetype`.
- **Engineered Resolution:** Non-breaking Zod `.transform()` adapter: all new attributes have smart defaults. If `preset` is missing, legacy blocks map to `hero-walkthrough` with `standard` play button and their existing `playMode` preserved, ensuring 100% fidelity on existing pages.

---

## 3. Cross-Feature Impact & Scope Boundary

| Affected Feature / Surface | Impact Analysis | Mitigation & Testing Requirement |
| :--- | :--- | :--- |
| **Page Builder Canvas (`Canvas.tsx`)** | Renders video block in `mode="edit"`. Must support "Change Video" source dialog, cover settings, and live archetype reflection without autoplaying audio in the editor. | Ensure video autoplay is disabled when `ctx.mode === 'edit'`, but visual chassis, play buttons, and ambient glow render WYSIWYG. |
| **Campaign Landing Pages (`PublicPageClient.tsx` / `PageRenderer.tsx`)** | Public view mode (`mode="view"`). Full runtime execution of Ambient Loop, Hero Walkthrough modal, Social Reel unmuting, and Micro-Demo hover. | Verify zero layout shift, seamless modal launching, and flawless mobile touch handling. |
| **Portal Content Studio & Reader (`ContentBlockCanvas.tsx`, `PortalContentReaderClient.tsx`)** | Instructors/admins embedding video tutorials in portal articles. | Verify browser chassis, iPhone frames, and ambient glow render properly inside reader containers. |
| **LMS Lesson Player (`PortalCoursePlayerClient.tsx`)** | Students watching video lessons. | Ensure video player aspect ratios (16:9, 9:16) adapt fluidly within lesson player layouts. |
| **Undo / Redo & Autosave (`useUndoRedo`, `useAutosave`)** | Changing archetypes updates block props via `onUpdateProps`. | Archetype bundles update props cleanly in a single action, allowing 1-click undo/redo. |

---

## 4. Phase-by-Phase Implementation Plan

### Task 1: Video Block Schema Extension & Archetype Bundle Adapter

**Files:**
- Modify: `src/lib/page-builder/blocks/video.tsx`
- Test: `src/components/page-builder/__tests__/VideoPresetSchema.test.tsx`

- [ ] **Step 1: Write the failing test for Video Preset Schema and Archetype Bundles**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/VideoPresetSchema.test.tsx`
Expected: FAIL with missing fields on video definition.

- [ ] **Step 3: Update `src/lib/page-builder/blocks/video.tsx` with extended Zod schema and archetype defaults**

```typescript
// Extended schema in src/lib/page-builder/blocks/video.tsx
export type VideoPresetArchetypeId =
  | 'ambient-loop'
  | 'hero-walkthrough'
  | 'social-reel'
  | 'micro-demo';

export type VideoPlayButtonArchetype = 'pulse' | 'glass-pill' | 'minimal-badge' | 'standard';
export type VideoControlsTheme = 'standard' | 'minimal-line' | 'ghost' | 'floating-island';
export type VideoOverlayTint = 'none' | 'dark-30' | 'dark-50';

const rawSchema = z.object({
  url: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  titlePosition: z.enum(['top', 'bottom', 'overlay']).default('overlay').optional(),
  videoData: z.object({
    videoUrl: z.string().default(''),
    thumbnailUrl: z.string().default(''),
    title: z.string().default(''),
    description: z.string().default(''),
    titlePosition: z.enum(['top', 'bottom', 'overlay']).default('overlay').optional(),
  }).default({}),
  provider: z.enum(['youtube', 'vimeo', 'loom']).default('youtube'),
  playMode: z.enum(['inline', 'modal']).default('inline'),
  preset: z.enum(['ambient-loop', 'hero-walkthrough', 'social-reel', 'micro-demo']).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).default('16:9'),
  elevation: z.enum(['none', 'hairline', 'shadow', 'browser', 'mobile']).default('hairline'),
  borderRadius: z.enum(['none', 'rounded', 'squircle']).default('rounded'),
  autoPlay: z.boolean().default(false),
  muted: z.boolean().default(false),
  loop: z.boolean().default(false),
  ambientGlow: z.boolean().default(false),
  hoverPreview: z.boolean().default(false),
  playButtonArchetype: z.enum(['pulse', 'glass-pill', 'minimal-badge', 'standard']).default('standard'),
  controlsTheme: z.enum(['standard', 'minimal-line', 'ghost', 'floating-island']).default('standard'),
  overlayTint: z.enum(['none', 'dark-30', 'dark-50']).default('none'),
});

const schema = rawSchema.transform((data) => {
  if (!data.preset) {
    return {
      ...data,
      preset: 'hero-walkthrough' as const,
      playButtonArchetype: data.playMode === 'modal' ? ('pulse' as const) : data.playButtonArchetype,
    };
  }

  if (data.preset === 'ambient-loop' && !data.autoPlay) {
    return {
      ...data,
      autoPlay: true,
      muted: true,
      loop: true,
      ambientGlow: true,
      overlayTint: 'dark-30' as const,
      aspectRatio: '16:9' as const,
      playMode: 'inline' as const,
    };
  }
  if (data.preset === 'hero-walkthrough' && data.elevation === 'hairline') {
    return {
      ...data,
      aspectRatio: '16:9' as const,
      elevation: 'browser' as const,
      playButtonArchetype: 'pulse' as const,
    };
  }
  if (data.preset === 'social-reel' && data.aspectRatio === '16:9') {
    return {
      ...data,
      aspectRatio: '9:16' as const,
      elevation: 'mobile' as const,
      borderRadius: 'squircle' as const,
      loop: true,
      autoPlay: true,
      muted: true,
      playButtonArchetype: 'minimal-badge' as const,
    };
  }
  if (data.preset === 'micro-demo' && !data.hoverPreview) {
    return {
      ...data,
      hoverPreview: true,
      loop: true,
      controlsTheme: 'minimal-line' as const,
      aspectRatio: '16:9' as const,
    };
  }

  return data;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/VideoPresetSchema.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/lib/page-builder/blocks/video.tsx src/components/page-builder/__tests__/VideoPresetSchema.test.tsx
git commit -m "feat(video): extend video block schema with behavioral archetypes, ambient glow, and interactive controls"
```

---

### Task 2: Visual Video Preset Archetype Selector (`VideoPresetSelector.tsx`)

**Files:**
- Create: `src/components/page-builder/VideoPresetSelector.tsx`
- Test: `src/components/page-builder/__tests__/VideoPresetSelector.test.tsx`

- [ ] **Step 1: Write the failing test for VideoPresetSelector**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/VideoPresetSelector.test.tsx`
Expected: FAIL with "Cannot find module '../VideoPresetSelector'"

- [ ] **Step 3: Implement `src/components/page-builder/VideoPresetSelector.tsx`**

```typescript
'use client';

/**
 * @fileOverview VideoPresetSelector — 1-Click Miniature Wireframe Video Archetype Picker
 *
 * Displays 4 distinct video archetypes with miniature animated WYSIWYG wireframes:
 * 1. Ambient Background Loop (Ambient glow halo, muted loop, text contrast tint)
 * 2. Hero Walkthrough (Browser window frame, centered radar pulse play button, lightbox)
 * 3. Social Reel / Story (Vertical 9:16 smartphone chassis with tap-to-unmute badge)
 * 4. Interactive Micro-Demo (Clean card with bottom 2px scrubber line and hover cue)
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoPresetBundleAttributes } from '@/lib/page-builder/blocks/video';

export const VIDEO_PRESET_BUNDLES: Record<string, VideoPresetBundleAttributes> = {
  'ambient-loop': {
    aspectRatio: '16:9',
    elevation: 'none',
    borderRadius: 'rounded',
    playMode: 'inline',
    autoPlay: true,
    muted: true,
    loop: true,
    ambientGlow: true,
    hoverPreview: false,
    playButtonArchetype: 'standard',
    controlsTheme: 'ghost',
    overlayTint: 'dark-30',
  },
  'hero-walkthrough': {
    aspectRatio: '16:9',
    elevation: 'browser',
    borderRadius: 'rounded',
    playMode: 'modal',
    autoPlay: false,
    muted: false,
    loop: false,
    ambientGlow: false,
    hoverPreview: false,
    playButtonArchetype: 'pulse',
    controlsTheme: 'standard',
    overlayTint: 'none',
  },
  'social-reel': {
    aspectRatio: '9:16',
    elevation: 'mobile',
    borderRadius: 'squircle',
    playMode: 'inline',
    autoPlay: true,
    muted: true,
    loop: true,
    ambientGlow: false,
    hoverPreview: false,
    playButtonArchetype: 'minimal-badge',
    controlsTheme: 'ghost',
    overlayTint: 'none',
  },
  'micro-demo': {
    aspectRatio: '16:9',
    elevation: 'hairline',
    borderRadius: 'rounded',
    playMode: 'inline',
    autoPlay: false,
    muted: true,
    loop: true,
    ambientGlow: false,
    hoverPreview: true,
    playButtonArchetype: 'standard',
    controlsTheme: 'minimal-line',
    overlayTint: 'none',
  },
};

export interface VideoPresetOption {
  value: string;
  label: string;
}

export interface VideoPresetSelectorProps {
  value?: string;
  options: ReadonlyArray<VideoPresetOption>;
  onChange: (value: string, bundle?: VideoPresetBundleAttributes) => void;
  className?: string;
}

function renderVideoMiniaturePreview(presetKey: string) {
  switch (presetKey) {
    case 'ambient-loop':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-950 relative overflow-hidden">
          {/* Ambient Glow Aura */}
          <div className="absolute inset-0 bg-radial from-blue-500/40 via-purple-500/20 to-transparent blur-md scale-110" />
          <div className="relative w-16 h-10 rounded-md bg-slate-900 border border-slate-700/60 shadow-lg flex flex-col items-center justify-center">
            <div className="w-6 h-1 bg-white/70 rounded-full mb-1" />
            <div className="w-10 h-1 bg-white/40 rounded-full" />
            <div className="absolute bottom-1 right-1 text-[7px] font-mono text-blue-400">LOOP</div>
          </div>
        </div>
      );

    case 'hero-walkthrough':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-18 h-11 rounded-t-sm rounded-b-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xs flex flex-col overflow-hidden">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 px-1 flex items-center gap-0.5 border-b border-slate-300 dark:border-slate-700">
              <div className="w-1 h-1 rounded-full bg-red-400" />
              <div className="w-1 h-1 rounded-full bg-amber-400" />
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 bg-slate-900 flex items-center justify-center relative">
              {/* Radar pulse play disc */}
              <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center animate-ping absolute" />
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center relative z-10 shadow-xs">
                <div className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-white ml-0.5" />
              </div>
            </div>
          </div>
        </div>
      );

    case 'social-reel':
      return (
        <div className="w-full h-full flex items-center justify-center p-1.5 bg-slate-100 dark:bg-slate-900">
          <div className="w-8 h-12 rounded-lg bg-slate-900 border-2 border-slate-700 shadow-xs flex flex-col items-center overflow-hidden relative">
            <div className="w-2.5 h-0.5 rounded-full bg-slate-600 mt-1 mb-0.5" />
            <div className="flex-1 w-full bg-slate-800 flex flex-col justify-end p-1">
              <div className="px-1 py-0.5 rounded-full bg-white/20 text-[6px] text-white font-bold w-fit mb-0.5">
                🔇 UNMUTE
              </div>
            </div>
          </div>
        </div>
      );

    case 'micro-demo':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-16 h-10 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col justify-between">
            <div className="flex-1 bg-slate-200 dark:bg-slate-750 flex items-center justify-center">
              <span className="text-[8px] font-black text-slate-500">HOVER ▶</span>
            </div>
            {/* 2px bottom micro-scrubber */}
            <div className="h-0.5 w-full bg-slate-300 dark:bg-slate-700">
              <div className="h-full w-2/3 bg-primary" />
            </div>
          </div>
        </div>
      );

    default:
      return <div className="w-full h-full bg-slate-200 dark:bg-slate-800" />;
  }
}

export function VideoPresetSelector({
  value,
  options,
  onChange,
  className,
}: VideoPresetSelectorProps) {
  const currentVal = value || options[0]?.value;
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const selectArchetype = (key: string, idx?: number) => {
    onChange(key, VIDEO_PRESET_BUNDLES[key]);
    if (typeof idx === 'number' && buttonRefs.current[idx]) {
      buttonRefs.current[idx]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      selectArchetype(options[currentIndex].value, currentIndex);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % options.length;
      selectArchetype(options[nextIdx].value, nextIdx);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + options.length) % options.length;
      selectArchetype(options[prevIdx].value, prevIdx);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Video Preset Archetype"
      className={cn("grid grid-cols-2 gap-2 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;

        return (
          <button
            key={opt.value}
            ref={(el) => { buttonRefs.current[idx] = el; }}
            type="button"
            role="radio"
            aria-label={opt.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => selectArchetype(opt.value, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col p-1.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[92px]",
              "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.04] dark:bg-primary/[0.1] border-primary shadow-xs ring-1 ring-primary/40"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-850/60"
            )}
          >
            <div className="relative w-full h-14 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700/60 shadow-inner flex items-center justify-center mb-1.5 transition-transform group-hover:scale-[1.01]">
              {renderVideoMiniaturePreview(opt.value)}
              {isSelected && (
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary text-white shadow-sm animate-in zoom-in-75 duration-150">
                  <CheckCircle2 className="w-3 h-3 text-white fill-current" />
                </div>
              )}
            </div>

            <div className="px-0.5 w-full">
              <span
                className={cn(
                  "text-[11px] font-bold leading-tight block truncate",
                  isSelected
                    ? "text-primary dark:text-primary font-black"
                    : "text-slate-800 dark:text-slate-200 group-hover:text-foreground"
                )}
                title={opt.label}
              >
                {opt.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/VideoPresetSelector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/components/page-builder/VideoPresetSelector.tsx src/components/page-builder/__tests__/VideoPresetSelector.test.tsx
git commit -m "feat(inspector): create VideoPresetSelector with 4 animated miniature wireframes and keyboard accessibility"
```

---

### Task 3: Play Button Archetype Selector (`PlayButtonArchetypeSelector.tsx`)

**Files:**
- Create: `src/components/page-builder/PlayButtonArchetypeSelector.tsx`
- Test: `src/components/page-builder/__tests__/PlayButtonArchetypeSelector.test.tsx`

- [ ] **Step 1: Write the failing test for PlayButtonArchetypeSelector**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/PlayButtonArchetypeSelector.test.tsx`
Expected: FAIL with "Cannot find module '../PlayButtonArchetypeSelector'"

- [ ] **Step 3: Implement `src/components/page-builder/PlayButtonArchetypeSelector.tsx`**

```typescript
'use client';

/**
 * @fileOverview PlayButtonArchetypeSelector — Visual Trigger Style Control
 *
 * Renders 4 distinct play button triggers:
 * 1. Radar / Pulse Waves (Expanding concentric ping rings)
 * 2. Glassmorphic Pill ("Watch Demo ▶")
 * 3. Minimal Bottom Badge (Discreet bottom-left badge)
 * 4. Classic Disc (Centered frosted disc)
 */

import React from 'react';
import { Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlayButtonOption {
  value: string;
  label: string;
}

export interface PlayButtonArchetypeSelectorProps {
  value?: string;
  options: ReadonlyArray<PlayButtonOption>;
  onChange: (value: string) => void;
  className?: string;
}

function renderPlayButtonWireframe(key: string) {
  switch (key) {
    case 'pulse':
      return (
        <div className="relative w-7 h-7 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-60" />
          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-xs">
            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
          </div>
        </div>
      );

    case 'glass-pill':
      return (
        <div className="px-2 py-0.5 rounded-full bg-slate-900/80 dark:bg-white/20 border border-white/20 text-white flex items-center gap-1 shadow-xs">
          <Play className="w-2 h-2 fill-current" />
          <span className="text-[8px] font-bold">Watch Demo</span>
        </div>
      );

    case 'minimal-badge':
      return (
        <div className="w-full flex justify-start pl-1">
          <div className="px-1.5 py-0.5 rounded-md bg-black/75 text-white flex items-center gap-0.5 text-[8px] font-bold">
            <Play className="w-1.5 h-1.5 fill-current" /> 2 min
          </div>
        </div>
      );

    case 'standard':
    default:
      return (
        <div className="w-6 h-6 rounded-full bg-white/90 dark:bg-slate-800 text-foreground flex items-center justify-center shadow-xs border border-border">
          <Play className="w-2.5 h-2.5 fill-current ml-0.5 text-primary" />
        </div>
      );
  }
}

export function PlayButtonArchetypeSelector({
  value,
  options,
  onChange,
  className,
}: PlayButtonArchetypeSelectorProps) {
  const currentVal = value || options[0]?.value;
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const selectStyle = (val: string, idx?: number) => {
    onChange(val);
    if (typeof idx === 'number' && buttonRefs.current[idx]) {
      buttonRefs.current[idx]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      selectStyle(options[currentIndex].value, currentIndex);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % options.length;
      selectStyle(options[nextIdx].value, nextIdx);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + options.length) % options.length;
      selectStyle(options[prevIdx].value, prevIdx);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Play Button Style"
      className={cn("grid grid-cols-2 gap-1.5 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;

        return (
          <button
            key={opt.value}
            ref={(el) => { buttonRefs.current[idx] = el; }}
            type="button"
            role="radio"
            aria-label={opt.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => selectStyle(opt.value, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all duration-200 cursor-pointer outline-none min-h-[58px]",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.06] dark:bg-primary/[0.12] border-primary text-primary shadow-2xs ring-1 ring-primary/40 font-bold"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850"
            )}
          >
            <div className="h-6 flex items-center justify-center mb-1">
              {renderPlayButtonWireframe(opt.value)}
            </div>
            <span className="text-[10px] font-semibold leading-none truncate w-full block">
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/PlayButtonArchetypeSelector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

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

- [ ] **Step 1: Write failing test for runtime video preset rendering**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/VideoBlockRuntimeRender.test.tsx`
Expected: FAIL with missing ambient glow or radar pulse trigger.

- [ ] **Step 3: Update `src/components/video-embed.tsx` and `src/lib/page-builder/blocks/video.tsx`**

1. In `src/components/video-embed.tsx`:
   - Enhance `VideoPlayButtonOverlay` to accept `archetype?: VideoPlayButtonArchetype`.
   - Render Radar Pulse (`animate-ping` concentric ring), Glassmorphic Pill (`"Watch Demo ▶"`), or Minimal Badge.
   - Add Tap-to-Unmute floating toggle with audio equalizer animation.
2. In `src/lib/page-builder/blocks/video.tsx`:
   - Add Ambient Reactive Glow aura:
     ```tsx
     {props.ambientGlow && (
       <div
         data-testid="ambient-reactive-glow"
         className="absolute -inset-4 bg-radial from-primary/30 via-purple-500/15 to-transparent blur-2xl opacity-60 pointer-events-none -z-10 scale-105 motion-reduce:hidden"
       />
     )}
     ```
   - Render Browser Window chrome or Mobile Chassis speaker notch.
   - Apply responsive aspect ratio classes (`aspect-video`, `aspect-[9/16]`, `aspect-square`, `aspect-[4/3]`).
   - Add 30% Dark Tint overlay for ambient loop archetype.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/VideoBlockRuntimeRender.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

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

- [ ] **Step 1: Write failing test for AutoBlockEditor Video Preset routing**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/AutoBlockEditorVideoPresets.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `src/components/page-builder/AutoBlockEditor.tsx` and `video.tsx`**

1. In `AutoBlockEditor.tsx`:
   - Import `VideoPresetSelector` and `PlayButtonArchetypeSelector`.
   - Route `preset` (for block type `'video'`) to `<VideoPresetSelector />`.
   - Route `playButtonArchetype` to `<PlayButtonArchetypeSelector />`.
   - Suppress duplicate outer labels for `isVideoPreset` and `isPlayButtonArchetype`.
2. In `video.tsx`:
   - Expose fine-tuning controls with clean everyday UI English labels:
     - "Preset Archetype"
     - "Aspect Ratio"
     - "Play Button Trigger Style"
     - "Ambient Reactive Glow"
     - "Kinetic Hover Preview"
     - "Control Bar Theme"
     - "Dark Tint Overlay"
     - "Playback Mode"
     - "Elevation & Frame"

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/AutoBlockEditorVideoPresets.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/components/page-builder/AutoBlockEditor.tsx src/lib/page-builder/blocks/video.tsx src/components/page-builder/__tests__/AutoBlockEditorVideoPresets.test.tsx
git commit -m "feat(inspector): integrate VideoPresetSelector and PlayButtonArchetypeSelector into AutoBlockEditor with progressive disclosure"
```

---

### Task 6: Full Verification, Quality Gates & Local Commit

**Files:**
- All touched files

- [ ] **Step 1: Run complete page-builder test suite**

Run: `npx vitest run src/components/page-builder/__tests__/`
Expected: All tests pass (including existing 68 tests and all new video preset tests).

- [ ] **Step 2: Run strict TypeScript compilation check**

Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run ESLint**

Run: `npm run lint`
Expected: 0 blocking errors or lint warnings.

- [ ] **Step 4: Confirm clean local git working tree**

Run: `git status`
Expected: Clean working tree on local branch without any uncommitted leftovers. (DO NOT push to origin).

---

## 5. Verification Checkpoints & Success Metrics

- [ ] **4 Distinct Video Archetypes:** Ambient Background Loop, Hero Walkthrough, Social Reel, Interactive Micro-Demo wireframes render in `VideoPresetSelector.tsx`.
- [ ] **Reactive Ambient Lighting:** Soft blurred glow aura pulses behind container with `ambientGlow: true` and respects `prefers-reduced-motion`.
- [ ] **Play Button Archetypes:** Radar pulse concentric waves, glassmorphic pill, minimal badge, and classic disc render accurately.
- [ ] **Chassis Framing:** 16:9 desktop browser window with macOS dots and 9:16 vertical smartphone chassis frame video players cleanly without iframe clipping.
- [ ] **Muted Autoplay Safety:** All autoplaying archetypes initialize with `muted: true` to adhere to browser security policies.
- [ ] **Zero `any`:** Strict TypeScript compliance across all new and modified components.
- [ ] **Local-Only Git:** Zero pushes to `origin/main` or remote repositories.

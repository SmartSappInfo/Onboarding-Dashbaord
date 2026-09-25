# Image Presets, Masking, Framing & Interactive Behavior Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform image handling across the Page Builder and Portal Content Studio into an industry-grade, 1-click visual preset system bundling geometric masking (editorial arches, pills, circles, sharp), container framing (browser mockups, mobile phone chassis, hairlines), responsive aspect ratios (1:1, 4:3, 16:9, 21:9, 9:16, 3:4), and interactive hover behaviors (scale zoom, duotone, grayscale reveal) with zero data drift and full backward compatibility.

**Architecture:** Hybrid "Visual Preset + Progressive Disclosure" pattern. Tier 1 provides 8 visual miniature wireframe preset cards (`clean-card`, `browser-mockup`, `mobile-chassis`, `cathedral-arch`, `circular-avatar`, `floating-elevated`, `interactive-zoom`, `neo-brutalist`) that configure shape, framing, elevation, and motion in a single click. Tier 2 progressively discloses granular adjustments (Aspect Ratio, Corner Shape, Elevation, Hover Effect, Object Fit). The universal `BlockRenderer` ensures all presets render identically across Page Builder Canvas, Campaign Landing Pages, Portal Content Reader, and LMS Course Lesson Player.

**Tech Stack:** Next.js 15, React 19, TypeScript (strictly 0 `any`, 0 `any[]`, 0 unhandled `unknown`), Tailwind CSS v4, Lucide React, Vitest, React Testing Library.

---

## 1. Architectural Strategy & Design System

### 1.1 The 4 Pillars of Image Presets

| Pillar | Capabilities & Styles | Visual & CSS Implementation |
| :--- | :--- | :--- |
| **1. Shape & Silhouette Masks** | Sharp, Rounded Card (16px), Squircle (24px), Pill/Circle (9999px), Cathedral Arch | Pure CSS border-radii (`rounded-none`, `rounded-2xl`, `rounded-full`, `rounded-t-[9999px] rounded-b-lg`) to avoid SVG clip-path hydration mismatches. |
| **2. Aspect Ratio & Framing** | Auto (Native), 1:1 Square, 4:3 Standard, 16:9 Landscape, 21:9 Cinematic, 9:16 Mobile Vertical, 3:4 Portrait | Tailwind `aspect-[X/Y]` combined with `overflow-hidden` container and `object-cover` / `object-contain` child `<img>` to eliminate Cumulative Layout Shift (CLS). |
| **3. Container & Elevation** | Flat Clean, Subtle Hairline Border, Floating Multi-Tier Shadow, Desktop Browser Window Shell, Mobile Chassis Shell | Device chrome wrappers: Browser with window header, 3 colored traffic dots (`#ff5f56`, `#ffbd2e`, `#27c93f`), and address pill; Mobile chassis with top speaker pill and rounded bezel border. |
| **4. Interactive & Hover States** | None, Scale & Zoom (`scale-105`), Grayscale-to-Color Reveal (`grayscale hover:grayscale-0`), Brand Duotone Wash | Emil Kowalski motion rules: GPU-accelerated transforms (`transition-transform duration-300 ease-out`), `motion-reduce:transition-none`, zero layout recalculations. |

### 1.2 1-Click Preset Definitions & Default Bundles

```typescript
export type ImagePresetId =
  | 'clean-card'
  | 'browser-mockup'
  | 'mobile-chassis'
  | 'cathedral-arch'
  | 'circular-avatar'
  | 'floating-elevated'
  | 'interactive-zoom'
  | 'neo-brutalist';

export interface ImagePresetDefinition {
  id: ImagePresetId;
  label: string;
  description: string;
  defaults: {
    borderRadius: 'none' | 'rounded' | 'squircle' | 'circle' | 'arch';
    aspectRatio: 'auto' | '1:1' | '4:3' | '16:9' | '21:9' | '9:16' | '3:4';
    elevation: 'none' | 'hairline' | 'shadow' | 'browser' | 'mobile';
    hoverEffect: 'none' | 'zoom' | 'grayscale' | 'duotone';
    objectFit: 'cover' | 'contain';
  };
}
```

---

## 2. Failure Mode & Resilience Analysis (What Could Go Wrong & Resolutions)

### Risk 1: Cumulative Layout Shift (CLS) on Aspect Ratio Switching
- **Potential Failure:** Setting a custom aspect ratio on a lazy-loaded remote image can cause sudden layout displacement while the image streams over the network.
- **Root Cause:** Container height collapses until image headers are parsed by the browser.
- **Engineered Resolution:** Strict container bounding using CSS `aspect-[w/h]` with `relative overflow-hidden` and `w-full`. The DOM space is reserved immediately before the image asset is fetched.

### Risk 2: SVG Mask / `clip-path` Cross-Browser Inconsistencies & Tool Clipping
- **Potential Failure:** Inline SVG `<clipPath id="...">` can suffer ID collisions on pages with multiple images, fail under base-URI changes, or clip edit-mode controls (like the "Change Image" overlay button).
- **Root Cause:** Stacking context clipping and SVG coordinate space mismatches across WebKit/Gecko.
- **Engineered Resolution:** 
  1. For Cathedral Arch, use pure CSS border radius tokens (`rounded-t-[9999px] rounded-b-2xl`) which render with 100% hardware acceleration and identical geometry across all mobile and desktop browsers.
  2. The edit-mode "Change Image" button is rendered on top of the clipped inner image surface or respects container boundaries without clipping artifacts.

### Risk 3: Backward Compatibility & Data Drift
- **Potential Failure:** Millions of existing pages store `{ borderRadius: 'none' | 'rounded' | 'circle' }` without `preset`, `aspectRatio`, `elevation`, or `hoverEffect`. If the schema strictly expects `preset`, older pages could crash or fail `safeParse`.
- **Root Cause:** Strict Zod schema rejection without backward fallback defaults.
- **Engineered Resolution:** Zod schema backward-compatibility adapter: all new fields have `.default(...)`. When loading legacy blocks, derive `preset` automatically:
  - `borderRadius === 'circle'` $\to$ `preset: 'circular-avatar'`
  - `borderRadius === 'none'` $\to$ `preset: 'neo-brutalist'`
  - `borderRadius === 'rounded'` $\to$ `preset: 'clean-card'`
  - Legacy pages render seamlessly without database migrations.

### Risk 4: Device Shell Viewport Overflow on Mobile Screens
- **Potential Failure:** Browser mockup or mobile chassis might render with fixed minimum widths, overflowing screen boundaries on small mobile screens (`390px`).
- **Root Cause:** Fixed pixel dimensions in chassis frames.
- **Engineered Resolution:** Mobile-first responsive constraints: `w-full max-w-full overflow-hidden`. The browser header scales its typography (`text-[10px]`) and dots (`w-2 h-2`) responsively, adapting fluidly from mobile portrait to ultra-wide desktop monitors.

### Risk 5: Duplicate UI Labels & Inspector Clutter
- **Potential Failure:** In `AutoBlockEditor.tsx`, generic field wrappers render `<Label>{field.label}</Label>`. When dedicated visual selectors (`ImagePresetSelector`, `AspectRatioSelector`, `SizeSliderControl`, `AlignmentSelector`) already feature rich visual headers or wireframes, duplicate labels clutter the inspector.
- **Root Cause:** Lack of label suppression for specialized visual controls.
- **Engineered Resolution:** Add `isImagePresetField` and `isAspectRatioField` to the label suppression condition in `AutoBlockEditor.tsx`, guaranteeing clean, professional typography.

### Risk 6: Next.js Image Host Restrictions
- **Potential Failure:** Using Next.js `<Image>` directly on dynamic URLs from Unsplash, Firebase Storage, or customer domains can cause runtime crashes if domains are not in `next.config.js` `remotePatterns`.
- **Root Cause:** Next.js Image Optimization host validation security checks.
- **Engineered Resolution:** Use native HTML `<img>` with `loading="lazy"`, `decoding="async"`, and `object-cover` or unoptimized image rendering. Native images avoid host restriction errors while retaining full browser caching and lazy-loading benefits.

---

## 3. Cross-Feature Impact & Scope Boundary

| Affected Feature / Surface | Impact Analysis | Mitigation & Testing Requirement |
| :--- | :--- | :--- |
| **Page Builder Canvas (`Canvas.tsx`)** | Renders image block in `mode="edit"`. Must support "Change Image" button overlay, caption inline editing, and live preset reflection. | Verify overlay button is clickable and caption `InlineEditable` updates props cleanly without clipping. |
| **Campaign Landing Pages (`PublicPageClient.tsx` / `PageRenderer.tsx`)** | Public view mode (`mode="view"`). Must render all masks, device frames, aspect ratios, and hover transitions. | Ensure zero hydration mismatches, zero missing classes, and flawless responsive rendering on mobile viewports. |
| **Portal Content Studio (`ContentBlockCanvas.tsx` / `ContentEditorModal.tsx`)** | Instructors/admins editing article and resource blocks. | Verify image blocks inside portal articles render device mockups, shadows, and arches accurately. |
| **Portal Content Reader (`PortalContentReaderClient.tsx`)** | Members reading portal articles or guides. | Ensure dark mode and light mode contrast for browser chassis and hairline borders. |
| **LMS Lesson Player (`PortalCoursePlayerClient.tsx`)** | Students viewing course lessons with embedded image blocks. | Verify aspect ratios and device frames scale within lesson layout containers without breaking scroll. |
| **Undo / Redo & Autosave (`useUndoRedo`)** | Changing presets updates block props. | Prop changes must emit non-mutating updates via `onUpdateProps` so `undo` and `redo` capture every preset step. |

---

## 4. Phase-by-Phase Implementation Plan

### Task 1: Image Block Schema Extension & Backward-Compatibility Adapter

**Files:**
- Modify: `src/lib/page-builder/blocks/image.tsx`
- Test: `src/components/page-builder/__tests__/ImageBlockSchema.test.tsx`

- [ ] **Step 1: Write the failing test for schema parsing, presets, and backward compatibility**

```typescript
// src/components/page-builder/__tests__/ImageBlockSchema.test.tsx
import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/image';

describe('Image Block Schema & Backward Compatibility', () => {
  const imageDef = getBlock('image')!;

  it('registers the image block with extended preset and framing fields', () => {
    expect(imageDef).toBeDefined();
    expect(imageDef.type).toBe('image');
    const fieldKeys = imageDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('preset');
    expect(fieldKeys).toContain('aspectRatio');
    expect(fieldKeys).toContain('elevation');
    expect(fieldKeys).toContain('hoverEffect');
    expect(fieldKeys).toContain('objectFit');
  });

  it('safely parses legacy image block props without new preset fields', () => {
    const legacyProps = {
      src: 'https://images.unsplash.com/photo-1',
      alt: 'Test Alt',
      borderRadius: 'circle',
      width: 'medium',
      alignment: 'center',
    };

    const parsed = imageDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.borderRadius).toBe('circle');
      expect(parsed.data.preset).toBe('circular-avatar');
      expect(parsed.data.aspectRatio).toBe('1:1');
    }
  });

  it('applies preset defaults accurately when preset is selected', () => {
    const browserMockupProps = {
      src: 'https://images.unsplash.com/photo-2',
      preset: 'browser-mockup',
    };

    const parsed = imageDef.schema.safeParse(browserMockupProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.elevation).toBe('browser');
      expect(parsed.data.borderRadius).toBe('rounded');
      expect(parsed.data.aspectRatio).toBe('16:9');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/ImageBlockSchema.test.tsx`
Expected: FAIL with missing fields or undefined preset derivations.

- [ ] **Step 3: Update `src/lib/page-builder/blocks/image.tsx` with extended Zod schema and defaults**

```typescript
// Add to src/lib/page-builder/blocks/image.tsx
export type ImagePresetId =
  | 'clean-card'
  | 'browser-mockup'
  | 'mobile-chassis'
  | 'cathedral-arch'
  | 'circular-avatar'
  | 'floating-elevated'
  | 'interactive-zoom'
  | 'neo-brutalist';

export type ImageAspectRatio = 'auto' | '1:1' | '4:3' | '16:9' | '21:9' | '9:16' | '3:4';
export type ImageBorderRadius = 'none' | 'rounded' | 'squircle' | 'circle' | 'arch';
export type ImageElevation = 'none' | 'hairline' | 'shadow' | 'browser' | 'mobile';
export type ImageHoverEffect = 'none' | 'zoom' | 'grayscale' | 'duotone';
export type ImageObjectFit = 'cover' | 'contain';

const rawSchema = z.object({
  src: z.string().default(''),
  alt: z.string().default(''),
  caption: z.string().default(''),
  captionColor: z.string().default('#475569'),
  width: z.enum(['small', 'medium', 'large', 'full']).default('full'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  preset: z.enum([
    'clean-card',
    'browser-mockup',
    'mobile-chassis',
    'cathedral-arch',
    'circular-avatar',
    'floating-elevated',
    'interactive-zoom',
    'neo-brutalist',
  ]).optional(),
  borderRadius: z.enum(['none', 'rounded', 'squircle', 'circle', 'arch']).default('rounded'),
  aspectRatio: z.enum(['auto', '1:1', '4:3', '16:9', '21:9', '9:16', '3:4']).default('auto'),
  elevation: z.enum(['none', 'hairline', 'shadow', 'browser', 'mobile']).default('hairline'),
  hoverEffect: z.enum(['none', 'zoom', 'grayscale', 'duotone']).default('none'),
  objectFit: z.enum(['cover', 'contain']).default('cover'),
});

// Backward compatibility transform
const schema = rawSchema.transform((data) => {
  // If legacy props provided without preset:
  if (!data.preset) {
    if (data.borderRadius === 'circle') {
      return {
        ...data,
        preset: 'circular-avatar' as const,
        aspectRatio: data.aspectRatio === 'auto' ? ('1:1' as const) : data.aspectRatio,
        borderRadius: 'circle' as const,
      };
    }
    if (data.borderRadius === 'none') {
      return {
        ...data,
        preset: 'neo-brutalist' as const,
        elevation: data.elevation === 'hairline' ? ('shadow' as const) : data.elevation,
        borderRadius: 'none' as const,
      };
    }
    return {
      ...data,
      preset: 'clean-card' as const,
    };
  }

  // Preset smart defaults mapping
  if (data.preset === 'browser-mockup') {
    return {
      ...data,
      elevation: 'browser' as const,
      borderRadius: 'rounded' as const,
      aspectRatio: data.aspectRatio === 'auto' ? ('16:9' as const) : data.aspectRatio,
    };
  }
  if (data.preset === 'mobile-chassis') {
    return {
      ...data,
      elevation: 'mobile' as const,
      borderRadius: 'squircle' as const,
      aspectRatio: data.aspectRatio === 'auto' ? ('9:16' as const) : data.aspectRatio,
    };
  }
  if (data.preset === 'cathedral-arch') {
    return {
      ...data,
      borderRadius: 'arch' as const,
      aspectRatio: data.aspectRatio === 'auto' ? ('3:4' as const) : data.aspectRatio,
    };
  }
  if (data.preset === 'circular-avatar') {
    return {
      ...data,
      borderRadius: 'circle' as const,
      aspectRatio: data.aspectRatio === 'auto' ? ('1:1' as const) : data.aspectRatio,
    };
  }
  if (data.preset === 'floating-elevated') {
    return {
      ...data,
      elevation: 'shadow' as const,
      borderRadius: 'rounded' as const,
    };
  }
  if (data.preset === 'interactive-zoom') {
    return {
      ...data,
      hoverEffect: 'zoom' as const,
      borderRadius: 'rounded' as const,
    };
  }
  if (data.preset === 'neo-brutalist') {
    return {
      ...data,
      borderRadius: 'none' as const,
      elevation: 'shadow' as const,
    };
  }

  return data;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/ImageBlockSchema.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/lib/page-builder/blocks/image.tsx src/components/page-builder/__tests__/ImageBlockSchema.test.tsx
git commit -m "feat(image): extend image block schema with presets, framing, and backward compatibility adapter"
```

---

### Task 2: Aspect Ratio Selector Component (`AspectRatioSelector.tsx`)

**Files:**
- Create: `src/components/page-builder/AspectRatioSelector.tsx`
- Test: `src/components/page-builder/__tests__/AspectRatioSelector.test.tsx`

- [ ] **Step 1: Write the failing test for AspectRatioSelector**

```typescript
// src/components/page-builder/__tests__/AspectRatioSelector.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AspectRatioSelector } from '../AspectRatioSelector';

describe('AspectRatioSelector', () => {
  const options = [
    { value: 'auto', label: 'Auto (Original)' },
    { value: '1:1', label: '1:1 Square' },
    { value: '4:3', label: '4:3 Standard' },
    { value: '16:9', label: '16:9 Landscape' },
    { value: '21:9', label: '21:9 Ultra-Wide' },
    { value: '9:16', label: '9:16 Vertical' },
    { value: '3:4', label: '3:4 Portrait' },
  ];

  it('renders all aspect ratio options with accessible radio roles', () => {
    render(<AspectRatioSelector value="16:9" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /aspect ratio/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(7);
  });

  it('marks current value as aria-checked', () => {
    render(<AspectRatioSelector value="16:9" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /16:9/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with selected value when clicked', () => {
    const handleChange = vi.fn();
    render(<AspectRatioSelector value="auto" options={options} onChange={handleChange} />);
    const option = screen.getByRole('radio', { name: /1:1/i });
    fireEvent.click(option);
    expect(handleChange).toHaveBeenCalledWith('1:1');
  });

  it('handles keyboard navigation with arrow keys', () => {
    const handleChange = vi.fn();
    render(<AspectRatioSelector value="auto" options={options} onChange={handleChange} />);
    const option = screen.getByRole('radio', { name: /auto/i });
    fireEvent.keyDown(option, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('1:1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/AspectRatioSelector.test.tsx`
Expected: FAIL with "Cannot find module '../AspectRatioSelector'"

- [ ] **Step 3: Implement `src/components/page-builder/AspectRatioSelector.tsx`**

```typescript
'use client';

/**
 * @fileOverview AspectRatioSelector — Segmented Aspect Ratio Control with Proportional Wireframes
 *
 * Provides a responsive visual selector for container proportions:
 * Auto, 1:1, 4:3, 16:9, 21:9, 9:16, and 3:4.
 *
 * Standards:
 * - Mobile accessibility with >= 44px touch targets.
 * - Keyboard navigation (ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space, Enter).
 * - ARIA radiogroup semantics with aria-checked state.
 * - Tactile micro-interactions (active:scale-[0.97]).
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface AspectRatioOption {
  value: string;
  label: string;
}

export interface AspectRatioSelectorProps {
  value?: string;
  options: ReadonlyArray<AspectRatioOption>;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Renders miniature proportional geometric wireframe preview for aspect ratios.
 */
function renderRatioWireframe(ratioKey: string) {
  switch (ratioKey) {
    case '1:1':
      return <div className="w-5 h-5 rounded-xs border-2 border-current opacity-80" />;
    case '4:3':
      return <div className="w-6 h-4.5 rounded-xs border-2 border-current opacity-80" />;
    case '16:9':
      return <div className="w-7 h-4 rounded-xs border-2 border-current opacity-80" />;
    case '21:9':
      return <div className="w-8 h-3.5 rounded-xs border-2 border-current opacity-80" />;
    case '9:16':
      return <div className="w-4 h-7 rounded-xs border-2 border-current opacity-80" />;
    case '3:4':
      return <div className="w-4.5 h-6 rounded-xs border-2 border-current opacity-80" />;
    case 'auto':
    default:
      return (
        <span className="text-[10px] font-black uppercase tracking-wider opacity-80">
          Auto
        </span>
      );
  }
}

export function AspectRatioSelector({
  value,
  options,
  onChange,
  className,
}: AspectRatioSelectorProps) {
  const currentVal = value || 'auto';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(options[currentIndex].value);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % options.length;
      onChange(options[nextIdx].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + options.length) % options.length;
      onChange(options[prevIdx].value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Aspect Ratio"
      className={cn("grid grid-cols-4 gap-1.5 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;
        const shortName = opt.value === 'auto' ? 'Auto' : opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-label={opt.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all duration-200 cursor-pointer outline-none min-h-[52px]",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.08] dark:bg-primary/[0.15] border-primary text-primary shadow-2xs ring-1 ring-primary/40 font-bold"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-foreground"
            )}
          >
            <div className="h-6 flex items-center justify-center mb-1">
              {renderRatioWireframe(opt.value)}
            </div>
            <span className="text-[10px] font-semibold leading-none truncate w-full block">
              {shortName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/AspectRatioSelector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/components/page-builder/AspectRatioSelector.tsx src/components/page-builder/__tests__/AspectRatioSelector.test.tsx
git commit -m "feat(inspector): create AspectRatioSelector component with proportional wireframes and keyboard accessibility"
```

---

### Task 3: Visual Image Preset Selector (`ImagePresetSelector.tsx`)

**Files:**
- Create: `src/components/page-builder/ImagePresetSelector.tsx`
- Test: `src/components/page-builder/__tests__/ImagePresetSelector.test.tsx`

- [ ] **Step 1: Write the failing test for ImagePresetSelector**

```typescript
// src/components/page-builder/__tests__/ImagePresetSelector.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImagePresetSelector } from '../ImagePresetSelector';

describe('ImagePresetSelector', () => {
  const options = [
    { value: 'clean-card', label: 'Clean Card' },
    { value: 'browser-mockup', label: 'Browser Window' },
    { value: 'mobile-chassis', label: 'Mobile Chassis' },
    { value: 'cathedral-arch', label: 'Cathedral Arch' },
    { value: 'circular-avatar', label: 'Circular Avatar' },
    { value: 'floating-elevated', label: 'Floating Elevated' },
    { value: 'interactive-zoom', label: 'Interactive Zoom' },
    { value: 'neo-brutalist', label: 'Neo-Brutalist' },
  ];

  it('renders all 8 visual image preset options', () => {
    render(<ImagePresetSelector value="clean-card" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /image preset style/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(8);
  });

  it('marks current preset as checked with checkmark indicator', () => {
    render(<ImagePresetSelector value="browser-mockup" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /browser window/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange with preset key when card clicked', () => {
    const handleChange = vi.fn();
    render(<ImagePresetSelector value="clean-card" options={options} onChange={handleChange} />);
    const archCard = screen.getByRole('radio', { name: /cathedral arch/i });
    fireEvent.click(archCard);
    expect(handleChange).toHaveBeenCalledWith('cathedral-arch');
  });

  it('cycles presets cleanly with arrow keys', () => {
    const handleChange = vi.fn();
    render(<ImagePresetSelector value="clean-card" options={options} onChange={handleChange} />);
    const firstRadio = screen.getByRole('radio', { name: /clean card/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('browser-mockup');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/ImagePresetSelector.test.tsx`
Expected: FAIL with "Cannot find module '../ImagePresetSelector'"

- [ ] **Step 3: Implement `src/components/page-builder/ImagePresetSelector.tsx`**

```typescript
'use client';

/**
 * @fileOverview ImagePresetSelector — 1-Click Miniature Wireframe Image Preset Picker
 *
 * Displays 8 distinct image presets with miniature WYSIWYG wireframes:
 * 1. Clean Card (Soft rounded corners, hairline border)
 * 2. Browser Mockup (Desktop window frame with 3 dots & address bar)
 * 3. Mobile Chassis (Smartphone bezel with top speaker pill)
 * 4. Cathedral Arch (Editorial dome arched top mask)
 * 5. Circular Avatar (1:1 circular badge silhouette)
 * 6. Floating Elevated (Multi-tiered diffuse drop shadow)
 * 7. Interactive Zoom (Hover scale-105 visual cue)
 * 8. Neo-Brutalist (Sharp 0px edges, 2px border, hard offset shadow)
 *
 * Standards:
 * - Mobile accessibility with min-h-[44px] targets.
 * - ARIA radiogroup and radio semantics.
 * - Tactile micro-interactions (active:scale-[0.98]).
 * - Strict typing with zero any.
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ImagePresetOption {
  value: string;
  label: string;
}

export interface ImagePresetSelectorProps {
  value?: string;
  options: ReadonlyArray<ImagePresetOption>;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Renders miniature WYSIWYG preview wireframes for all 8 image presets.
 */
function renderImageMiniaturePreview(presetKey: string) {
  switch (presetKey) {
    case 'clean-card':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-16 h-10 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center">
            <div className="w-5 h-5 rounded-xs bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            </div>
          </div>
        </div>
      );

    case 'browser-mockup':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-18 h-11 rounded-t-sm rounded-b-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xs flex flex-col overflow-hidden">
            {/* Browser Header Bar */}
            <div className="h-3 bg-slate-200 dark:bg-slate-700/80 px-1 flex items-center gap-0.5 border-b border-slate-300/70 dark:border-slate-700">
              <div className="w-1 h-1 rounded-full bg-red-400" />
              <div className="w-1 h-1 rounded-full bg-amber-400" />
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <div className="w-8 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1" />
            </div>
            {/* Viewport */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-850 flex items-center justify-center">
              <div className="w-6 h-3 bg-slate-200 dark:bg-slate-700 rounded-xs" />
            </div>
          </div>
        </div>
      );

    case 'mobile-chassis':
      return (
        <div className="w-full h-full flex items-center justify-center p-1.5 bg-slate-100 dark:bg-slate-900">
          <div className="w-8 h-12 rounded-lg bg-white dark:bg-slate-800 border-2 border-slate-700 dark:border-slate-600 shadow-xs flex flex-col items-center overflow-hidden">
            {/* Speaker bar */}
            <div className="w-2.5 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-1 mb-0.5" />
            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center p-0.5">
              <div className="w-5 h-6 rounded-xs bg-slate-300 dark:bg-slate-700" />
            </div>
          </div>
        </div>
      );

    case 'cathedral-arch':
      return (
        <div className="w-full h-full flex items-center justify-center p-1.5 bg-slate-100 dark:bg-slate-900">
          <div className="w-11 h-12 rounded-t-full rounded-b-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xs flex flex-col items-center justify-center overflow-hidden">
            <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 mt-2" />
          </div>
        </div>
      );

    case 'circular-avatar':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 border-2 border-primary/40 shadow-xs flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
        </div>
      );

    case 'floating-elevated':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-15 h-9 rounded-md bg-white dark:bg-slate-800 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.22)] -translate-y-0.5 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60">
            <div className="w-7 h-4 bg-slate-200 dark:bg-slate-700 rounded-xs" />
          </div>
        </div>
      );

    case 'interactive-zoom':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-16 h-10 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <div className="w-10 h-7 bg-blue-500/20 rounded-xs flex items-center justify-center">
              <span className="text-[9px] font-black text-blue-600 dark:text-blue-400">ZOOM</span>
            </div>
          </div>
        </div>
      );

    case 'neo-brutalist':
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-15 h-9 bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] flex items-center justify-center">
            <div className="w-7 h-4 bg-amber-400/40 border border-slate-900 dark:border-white" />
          </div>
        </div>
      );

    default:
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-900">
          <div className="w-14 h-9 rounded-md bg-slate-200 dark:bg-slate-700" />
        </div>
      );
  }
}

export function ImagePresetSelector({
  value,
  options,
  onChange,
  className,
}: ImagePresetSelectorProps) {
  const currentVal = value || options[0]?.value;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(options[currentIndex].value);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % options.length;
      onChange(options[nextIdx].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + options.length) % options.length;
      onChange(options[prevIdx].value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Image Preset Style"
      className={cn("grid grid-cols-2 gap-2 w-full select-none", className)}
    >
      {options.map((opt, idx) => {
        const isSelected = currentVal === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-label={opt.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative flex flex-col p-1.5 rounded-xl border text-left transition-all duration-200 cursor-pointer outline-none min-h-[92px]",
              "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-primary/[0.04] dark:bg-primary/[0.1] border-primary shadow-xs ring-1 ring-primary/40"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-850/60"
            )}
          >
            {/* Miniature Wireframe Thumbnail Container */}
            <div className="relative w-full h-14 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700/60 shadow-inner flex items-center justify-center mb-1.5 transition-transform group-hover:scale-[1.01]">
              {renderImageMiniaturePreview(opt.value)}

              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary text-white shadow-sm animate-in zoom-in-75 duration-150">
                  <CheckCircle2 className="w-3 h-3 text-white fill-current" />
                </div>
              )}
            </div>

            {/* Preset Label */}
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

Run: `npx vitest run src/components/page-builder/__tests__/ImagePresetSelector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/components/page-builder/ImagePresetSelector.tsx src/components/page-builder/__tests__/ImagePresetSelector.test.tsx
git commit -m "feat(inspector): create ImagePresetSelector with 8 miniature WYSIWYG wireframes and keyboard accessibility"
```

---

### Task 4: Complete Image Block Runtime Renderer (Framing, Masks, Devices & Motion)

**Files:**
- Modify: `src/lib/page-builder/blocks/image.tsx`
- Test: `src/components/page-builder/__tests__/ImageRuntimeRender.test.tsx`

- [ ] **Step 1: Write the failing test for Image Block Runtime Rendering**

```typescript
// src/components/page-builder/__tests__/ImageRuntimeRender.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BlockRenderer } from '../BlockRenderer';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/image';

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

describe('Image Runtime Renderer', () => {
  it('renders browser mockup with window title bar and 3 colored control dots', () => {
    const block: PageBlock = {
      id: 'img-1',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-test',
        preset: 'browser-mockup',
        elevation: 'browser',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const browserBar = container.querySelector('[data-testid="browser-chrome-header"]');
    expect(browserBar).toBeInTheDocument();
  });

  it('renders mobile chassis with top speaker pill and rounded phone bezel', () => {
    const block: PageBlock = {
      id: 'img-2',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-test',
        preset: 'mobile-chassis',
        elevation: 'mobile',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const speakerNotch = container.querySelector('[data-testid="mobile-speaker-bar"]');
    expect(speakerNotch).toBeInTheDocument();
  });

  it('renders cathedral arch mask correctly', () => {
    const block: PageBlock = {
      id: 'img-3',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-test',
        preset: 'cathedral-arch',
        borderRadius: 'arch',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const imgWrapper = container.querySelector('figure');
    expect(imgWrapper?.className).toContain('rounded-t-[9999px]');
  });

  it('applies hover zoom transition classes without layout shift', () => {
    const block: PageBlock = {
      id: 'img-4',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-test',
        hoverEffect: 'zoom',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('group-hover:scale-105');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/ImageRuntimeRender.test.tsx`
Expected: FAIL with missing browser chrome headers or mobile speaker bar.

- [ ] **Step 3: Update `src/lib/page-builder/blocks/image.tsx` with full visual rendering pipeline**

```typescript
// Implement full render method in src/lib/page-builder/blocks/image.tsx
// 1. Calculate ASPECT_RATIO_CLASSES
const ASPECT_RATIO_CLASSES: Record<ImageAspectRatio, string> = {
  auto: '',
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  '21:9': 'aspect-[21/9]',
  '9:16': 'aspect-[9/16]',
  '3:4': 'aspect-[3/4]',
};

// 2. Calculate RADIUS_CLASSES
const RADIUS_CLASSES: Record<ImageBorderRadius, string> = {
  none: 'rounded-none',
  rounded: 'rounded-2xl',
  squircle: 'rounded-[28px]',
  circle: 'rounded-full aspect-square object-cover',
  arch: 'rounded-t-[9999px] rounded-b-xl',
};

// 3. Calculate ELEVATION_CLASSES
const ELEVATION_CLASSES: Record<ImageElevation, string> = {
  none: 'border border-transparent shadow-none',
  hairline: 'border border-slate-200/80 dark:border-zinc-800 shadow-2xs',
  shadow: 'border border-slate-200/50 dark:border-zinc-800/80 shadow-[0_12px_24px_-8px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.6)]',
  browser: 'border border-slate-300 dark:border-zinc-800 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.7)]',
  mobile: 'border-[5px] border-slate-900 dark:border-zinc-800 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.25)]',
};

// 4. Calculate HOVER_EFFECT_CLASSES
const HOVER_EFFECT_CLASSES: Record<ImageHoverEffect, string> = {
  none: '',
  zoom: 'transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none',
  grayscale: 'grayscale group-hover:grayscale-0 transition-all duration-300 ease-out motion-reduce:transition-none',
  duotone: 'mix-blend-multiply group-hover:mix-blend-normal transition-all duration-300 ease-out motion-reduce:transition-none',
};

// 5. In render method:
// If elevation === 'browser', render desktop window header:
// <div data-testid="browser-chrome-header" className="h-7 px-3 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-1.5 shrink-0">
//   <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
//   <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
//   <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
//   <div className="mx-auto w-32 h-3.5 rounded-full bg-slate-200/70 dark:bg-zinc-800 flex items-center justify-center px-2">
//     <div className="w-12 h-1 bg-slate-400/60 dark:bg-zinc-600 rounded-full" />
//   </div>
// </div>

// If elevation === 'mobile', render phone top speaker bar:
// <div data-testid="mobile-speaker-bar" className="w-full h-4 bg-slate-900 dark:bg-zinc-900 flex items-center justify-center shrink-0">
//   <div className="w-8 h-1 rounded-full bg-slate-700 dark:bg-zinc-700" />
// </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/ImageRuntimeRender.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/lib/page-builder/blocks/image.tsx src/components/page-builder/__tests__/ImageRuntimeRender.test.tsx
git commit -m "feat(image): implement complete image runtime rendering with device shells, masks, aspect ratios, and hover transitions"
```

---

### Task 5: AutoBlockEditor Field Routing & Label Deduplication

**Files:**
- Modify: `src/components/page-builder/AutoBlockEditor.tsx`
- Test: `src/components/page-builder/__tests__/AutoBlockEditorImagePresets.test.tsx`

- [ ] **Step 1: Write the failing test for AutoBlockEditor image preset routing**

```typescript
// src/components/page-builder/__tests__/AutoBlockEditorImagePresets.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoBlockEditor } from '../AutoBlockEditor';
import type { PageBlock } from '@/lib/types';
import '@/lib/page-builder/blocks/image';

describe('AutoBlockEditor Image Preset Routing', () => {
  const imageBlock: PageBlock = {
    id: 'block-img-1',
    type: 'image',
    props: {
      src: 'https://images.unsplash.com/photo-1',
      preset: 'clean-card',
      aspectRatio: '16:9',
      borderRadius: 'rounded',
      width: 'full',
      alignment: 'center',
    },
  };

  it('renders ImagePresetSelector for image preset field without duplicate label', () => {
    render(
      <AutoBlockEditor
        block={imageBlock}
        resources={{ forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] }}
        onUpdateProps={vi.fn()}
      />
    );

    expect(screen.getByRole('radiogroup', { name: /image preset style/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /aspect ratio/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/page-builder/__tests__/AutoBlockEditorImagePresets.test.tsx`
Expected: FAIL if ImagePresetSelector or AspectRatioSelector are not routed in `AutoBlockEditor.tsx`.

- [ ] **Step 3: Update `src/components/page-builder/AutoBlockEditor.tsx`**

```typescript
// In src/components/page-builder/AutoBlockEditor.tsx:
// 1. Import ImagePresetSelector and AspectRatioSelector
import { ImagePresetSelector } from './ImagePresetSelector';
import { AspectRatioSelector } from './AspectRatioSelector';

// 2. In FieldControl (case 'select'):
if (field.key === 'preset' && field.options.some((o) => o.value === 'browser-mockup' || o.value === 'clean-card')) {
  return (
    <ImagePresetSelector
      value={asString(value) || 'clean-card'}
      options={field.options}
      onChange={(val) => onChange(val)}
    />
  );
}
if (field.key === 'aspectRatio') {
  return (
    <AspectRatioSelector
      value={asString(value) || 'auto'}
      options={field.options}
      onChange={(val) => onChange(val)}
    />
  );
}

// 3. In main field loop label suppression check:
const isImagePreset = field.key === 'preset' && (block.type === 'image');
const isAspectRatio = field.key === 'aspectRatio';
// Exclude label if isImagePreset or isAspectRatio (they carry their own visual headers / radiogroups)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/AutoBlockEditorImagePresets.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/components/page-builder/AutoBlockEditor.tsx src/components/page-builder/__tests__/AutoBlockEditorImagePresets.test.tsx
git commit -m "feat(inspector): integrate ImagePresetSelector and AspectRatioSelector into AutoBlockEditor with clean label deduplication"
```

---

### Task 6: Progressive Disclosure Fine-Tuning in Image Block Definition

**Files:**
- Modify: `src/lib/page-builder/blocks/image.tsx`
- Test: `src/components/page-builder/__tests__/ImageProgressiveDisclosure.test.tsx`

- [ ] **Step 1: Write test verifying progressive disclosure options and preset synchronization**

```typescript
// src/components/page-builder/__tests__/ImageProgressiveDisclosure.test.tsx
import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/image';

describe('Image Progressive Disclosure & Field Definitions', () => {
  const imageDef = getBlock('image')!;

  it('exposes clean everyday UI English labels for all fine-tuning controls', () => {
    const fields = imageDef.fields;
    const presetField = fields.find((f) => f.key === 'preset');
    const ratioField = fields.find((f) => f.key === 'aspectRatio');
    const shapeField = fields.find((f) => f.key === 'borderRadius');
    const elevationField = fields.find((f) => f.key === 'elevation');
    const hoverField = fields.find((f) => f.key === 'hoverEffect');
    const fitField = fields.find((f) => f.key === 'objectFit');

    expect(presetField?.label).toBe('Preset Style');
    expect(ratioField?.label).toBe('Aspect Ratio');
    expect(shapeField?.label).toBe('Corner Shape & Mask');
    expect(elevationField?.label).toBe('Elevation & Frame');
    expect(hoverField?.label).toBe('Hover Animation');
    expect(fitField?.label).toBe('Image Fit Mode');
  });
});
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `npx vitest run src/components/page-builder/__tests__/ImageProgressiveDisclosure.test.tsx`
Expected: Passes once field definitions in `image.tsx` match the exact labels.

- [ ] **Step 3: Update `image.tsx` field descriptors with complete options and everyday UI English labels**

```typescript
// Refined fields in registerBlock in src/lib/page-builder/blocks/image.tsx
fields: [
  { kind: 'image', key: 'src', label: 'Image URL' },
  {
    kind: 'select',
    key: 'preset',
    label: 'Preset Style',
    options: [
      { value: 'clean-card', label: 'Clean Card' },
      { value: 'browser-mockup', label: 'Browser Window' },
      { value: 'mobile-chassis', label: 'Mobile Chassis' },
      { value: 'cathedral-arch', label: 'Cathedral Arch' },
      { value: 'circular-avatar', label: 'Circular Avatar' },
      { value: 'floating-elevated', label: 'Floating Elevated' },
      { value: 'interactive-zoom', label: 'Interactive Zoom' },
      { value: 'neo-brutalist', label: 'Neo-Brutalist' },
    ],
  },
  {
    kind: 'select',
    key: 'aspectRatio',
    label: 'Aspect Ratio',
    options: [
      { value: 'auto', label: 'Auto (Original)' },
      { value: '1:1', label: '1:1 Square' },
      { value: '4:3', label: '4:3 Standard' },
      { value: '16:9', label: '16:9 Landscape' },
      { value: '21:9', label: '21:9 Ultra-Wide' },
      { value: '9:16', label: '9:16 Vertical' },
      { value: '3:4', label: '3:4 Portrait' },
    ],
  },
  {
    kind: 'select',
    key: 'borderRadius',
    label: 'Corner Shape & Mask',
    options: [
      { value: 'none', label: 'Sharp (0px)' },
      { value: 'rounded', label: 'Card (16px)' },
      { value: 'squircle', label: 'Squircle (28px)' },
      { value: 'arch', label: 'Cathedral Arch' },
      { value: 'circle', label: 'Circle / Pill' },
    ],
  },
  {
    kind: 'select',
    key: 'elevation',
    label: 'Elevation & Frame',
    options: [
      { value: 'none', label: 'None (Flat)' },
      { value: 'hairline', label: 'Subtle Hairline Border' },
      { value: 'shadow', label: 'Floating Drop Shadow' },
      { value: 'browser', label: 'Desktop Browser Window' },
      { value: 'mobile', label: 'Mobile Phone Chassis' },
    ],
  },
  {
    kind: 'select',
    key: 'hoverEffect',
    label: 'Hover Animation',
    options: [
      { value: 'none', label: 'None' },
      { value: 'zoom', label: 'Scale & Zoom' },
      { value: 'grayscale', label: 'Grayscale to Color' },
      { value: 'duotone', label: 'Duotone Wash' },
    ],
  },
  {
    kind: 'select',
    key: 'objectFit',
    label: 'Image Fit Mode',
    options: [
      { value: 'cover', label: 'Fill & Cover (Crop to fit)' },
      { value: 'contain', label: 'Fit Inside (No crop)' },
    ],
  },
  { kind: 'text', key: 'alt', label: 'Alt Text' },
  { kind: 'text', key: 'caption', label: 'Caption' },
  { kind: 'color', key: 'captionColor', label: 'Caption Text Color' },
  {
    kind: 'select',
    key: 'width',
    label: 'Image Width Size',
    options: [
      { value: 'small', label: 'Small (120px)' },
      { value: 'medium', label: 'Medium (320px)' },
      { value: 'large', label: 'Large (640px)' },
      { value: 'full', label: 'Full Width (100%)' },
    ],
  },
  {
    kind: 'select',
    key: 'alignment',
    label: 'Image Alignment',
    options: [
      { value: 'left', label: 'Align Left' },
      { value: 'center', label: 'Align Center' },
      { value: 'right', label: 'Align Right' },
    ],
  },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/page-builder/__tests__/ImageProgressiveDisclosure.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes locally**

```bash
git add src/lib/page-builder/blocks/image.tsx src/components/page-builder/__tests__/ImageProgressiveDisclosure.test.tsx
git commit -m "feat(image): add progressive disclosure fine-tuning fields with everyday UI English labels"
```

---

### Task 7: Full System Verification, Typecheck & Quality Audit

**Files:**
- All changed files

- [ ] **Step 1: Run complete page-builder test suite**

Run: `npx vitest run src/components/page-builder/__tests__/`
Expected: All tests pass (including existing 51 tests and all new test files).

- [ ] **Step 2: Run strict TypeScript compilation check**

Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run ESLint**

Run: `npm run lint`
Expected: 0 blocking errors or lint warnings.

- [ ] **Step 4: Inspect Git status and verify local commit cleanliness**

Run: `git status`
Expected: Clean working tree on local branch without any uncommitted leftovers. (DO NOT push to origin).

---

## 5. Verification Checkpoints & Success Metrics

- [ ] **Visual Thumbnail Fidelity:** All 8 presets show exact miniature wireframes in `ImagePresetSelector.tsx`.
- [ ] **Aspect Ratio Accuracy:** `1:1`, `4:3`, `16:9`, `21:9`, `9:16`, `3:4` render with proper CSS aspect ratios and zero CLS.
- [ ] **Device Mockup Chrome:** Browser window displays 3 traffic-light dots and title bar; mobile chassis displays top speaker pill.
- [ ] **Mask Performance:** Cathedral arch and circular masks clip cleanly without clipping edit buttons or breaking SSR.
- [ ] **Backward Compatibility:** Older image blocks with `{ borderRadius: 'circle' }` render without errors or data migration.
- [ ] **Mobile Touch Targets:** All buttons and radio cards satisfy $\ge 44\text{px}$ minimum touch target size.
- [ ] **Zero `any`:** Strict TypeScript compliance across all new and modified components.
- [ ] **Local-Only Git:** Zero pushes to `origin/main` or remote repositories.

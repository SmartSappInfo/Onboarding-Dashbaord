# Pre-order Hub Design & Theme System (Light & Dark Modes)

This document details the backend UI and component theme system based on high-fidelity admin screens. It establishes core design rules, color palettes, typography, layout guidelines, performance-minded animations, and Next.js hydration-safe component specifications.

---

## 1. Visual Direction & Creative North Star

**"Modern Institutional Minimalism"**
*   **Structure:** Precise, clean layout lines with a clear visual hierarchy. It avoids templated defaults (no generic sand/cream backgrounds, no diagonal background stripes, no sketchy SVG doodles) to signal authority and professional reliability.
*   **Materiality:** Surfaces use subtle elevation, fine border treatments (1px lines), and generous, rhythmic whitespace.
*   **Adaptability:** Fully responsive dual-mode architecture that transitions seamlessly between a crisp light mode and a premium, deep-slate dark mode.

---

## 2. Theme Palettes (Light vs. Dark Mode)

All colors are configured using standard CSS custom properties (HSL/OKLCH) to allow dynamic toggling by class addition (`.dark` on `<html>` or `<body>`).

### 2.1 Core Neutral Palette

| Token | CSS Variable (Light) | Hex Value (Light) | CSS Variable (Dark) | Hex Value (Dark) | Core UI Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Canvas Background** | `var(--background)` | `HSL(231, 100%, 99%)` | `HSL(220, 18%, 8%)` | `#0D0F12` | Main page body, backdrop behind panel. |
| **Sidebar Background** | `--sidebar-bg` | `HSL(210, 17%, 98%)` | `HSL(220, 16%, 10%)` | `#11141B` | Fixed navigation column background. |
| **Panel Surface** | `--card` | `HSL(0, 0%, 100%)` | `HSL(220, 16%, 12%)` | `#141720` | Central form card, dialog popups, main panel surface. |
| **Primary Text** | `var(--foreground)` | `HSL(212, 56%, 12%)` | `HSL(220, 10%, 95%)` | `#F1F3F5` | Headings, active states, labels, tabular numbers. |
| **Secondary/Muted Text** | `--muted-foreground` | `HSL(215, 16%, 47%)` | `HSL(220, 10%, 65%)` | `#9CA3AF` | Inactive tabs, breadcrumbs, descriptions, placeholders. |
| **Borders** | `var(--border)` | `HSL(0, 0%, 90%)` | `HSL(220, 12%, 20%)` | `#2D323E` | 1px fine separators, input borders, grid/table lines. |
| **Inputs** | `var(--input)` | `HSL(0, 0%, 90%)` | `HSL(220, 12%, 18%)` | `#252A35` | Form input backgrounds. |
| **Focus Rings** | `var(--ring)` | `HSL(212, 56%, 12%)` | `HSL(0, 0%, 100%)` | `#FFFFFF` | Focus outline accents on elements. |

### 2.2 Accent & Semantic Status Palette

| Token | CSS Variable (Light & Dark Mapped) | Core UI Role |
| :--- | :--- | :--- |
| **Primary Button / Accent** | `var(--primary)` | Solid Black (`#000000`) in Light / Solid White (`#FFFFFF`) in Dark. |
| **Secondary Button Background**| `--button-secondary` | Warm Soft Gray (`#E2E8F0`) in Light / Dark Slate (`#252A35`) in Dark. |
| **Active Highlight / Patina** | `var(--secondary)` | Rich Teal (`#006a61`) in Light / Lighter Teal (`#00A395`) in Dark. |
| **Success / Stock (Emerald)** | `var(--reserved-emerald)` | Balanced Green (`#10B981`) for positive stock, completed checks. |
| **Warning / Pending (Amber)** | `--pending-amber` | Warm Amber (`#F59E0B`) for pending statuses, vital warnings. |
| **Danger / Cancel (Red)** | `var(--preservation-red)` | Crisp preservation red (`oklch(60% 0.2 27)`) for alerts, discount deletions. |

### 2.3 Color Badges & Tags (Categorization UI)

Colors are paired with high-contrast foregrounds. For dark mode, backgrounds are deeply desaturated with heightened text contrast to prevent blinding elements:

*   **Misty Rose Variant (Pink):**
    *   *Light Mode:* Bg `HSL(340, 70%, 94%)` (`#FCE4EC`) | Text `HSL(340, 75%, 40%)` (`#C2185B`)
    *   *Dark Mode:* Bg `HSL(340, 50%, 18%)` (`#471B26`) | Text `HSL(340, 85%, 75%)` (`#F48FB1`)
*   **Orange Variant:**
    *   *Light Mode:* Bg `HSL(24, 85%, 94%)` (`#FFF3E0`) | Text `HSL(24, 90%, 40%)` (`#E65100`)
    *   *Dark Mode:* Bg `HSL(24, 60%, 18%)` (`#4E2108`) | Text `HSL(24, 95%, 75%)` (`#FFB74D`)
*   **Neutral Badge:**
    *   *Light Mode:* Bg `HSL(210, 16%, 93%)` (`#E2E8F0`) | Text `HSL(215, 25%, 27%)` (`#334155`)
    *   *Dark Mode:* Bg `HSL(220, 12%, 20%)` (`#242936`) | Text `HSL(220, 10%, 80%)` (`#CBD5E1`)

### 2.4 Contrast and Accessibility Assurance
Body and secondary text elements are design-restricted to guarantee high visibility (meeting or exceeding WCAG AA standards):
*   **Light Mode Contrast:** Primary text (`#0D1C2E` on `#F8F9FF`) is **14.8:1**. Secondary muted text (`#627289` on `#F8F9FF`) is **4.8:1** (exceeds the `4.5:1` AA standard).
*   **Dark Mode Contrast:** Primary text (`#F1F3F5` on `#0D0F12`) is **17.8:1**. Secondary muted text (`#9CA3AF` on `#0D0F12`) is **6.5:1** (exceeds the `4.5:1` AA standard).

---

## 3. Typography Rules

*   **Header / Brand Typography:** `Hanken Grotesk`
    *   Used for primary headings (`h1`, `h2`), page titles, and the `ecom` sidebar brand logo.
    *   *Display Letter-Spacing Floor:* `-0.03em`. Avoid values tighter than `-0.04em` to prevent letters touching.
*   **Body & UI Typography:** `Inter`
    *   Used for form labels, descriptions, inputs, badges, buttons, and tables.
    *   Provides clean readability even in compact table grids.
    *   *Tabular numbers:* Ensure `font-variant-numeric: tabular-nums` (`text-tabular` class) is applied on table values to avoid alignment shifting during updates.
*   **Text wrap alignment:** Heading elements h1–h3 must use `text-wrap: balance` to prevent awkward lines. Longer body prose uses `text-wrap: pretty`.

---

## 4. Spacing, Elevation & Layout

```
+-------------------------------------------------------------------+
|  [Logo] ecom     |  Page Title (e.g. Add new product)             |
|                  |  Breadcrumb / Navigation                       |
|  * Dashboard     |  +------------------------------------------+  |
|  * Products      |  | Tab1 | [Tab2] | Tab3 | Tab4              |  |
|  * Orders        |  +------------------------------------------+  |
|  * Settings      |  |                                          |  |
|                  |  |  [Central Card Container]                |  |
|  ...             |  |                                          |  |
|  [Profile]       |  +------------------------------------------+  |
+-------------------+-----------------------------------------------+
```

*   **Two-Column Structure:**
    *   **Left Sidebar:** Fixed width (`240px` to `260px`). High-contrast line separator (`1px solid var(--border)`).
    *   **Main Container:** Responsive grid with standard padding:
        *   Desktop gutter: `2.5rem` (`40px`).
        *   Mobile gutter: `1rem` (`16px`).
*   **Elevation & Borders:**
    *   **Card border-radius:** Restricted to a maximum of `12px` to `16px` (`0.75rem` to `1rem`). Excessively rounded corners (e.g., `32px`+) are prohibited on container cards.
    *   **Button and input radius:** Set to `8px` (`0.5rem`).
    *   **Shadows:** Avoid pairing prominent shadows with borders. Clean, fine borders (`1px solid var(--border)`) are preferred for layout components. Drop shadows are reserved for modals, tooltips, or overlays.
    *   **Explicit Component Backgrounds:** Always define a background color on all layout cards, panels, listviews, dropdown menus, inputs, and custom container components (e.g. `bg-white dark:bg-card` or `bg-popover`). Never leave backgrounds transparent unless explicitly intended, to prevent layout bleeding issues against the main canvas background.

---

## 5. Component Design Specifications

### 5.1 Left Sidebar Navigation
*   **Logo/Header:** Text "ecom" in Hanken Grotesk (extra-bold) paired with a clean TP monogram/three-bar logo.
*   **Nav Items:**
    *   Vertical spacing: `0.5rem` gaps between items.
    *   Border-radius: `8px`.
    *   *Active State:* Background shifted to a subtle neutral color highlight (`#E2E8F0` in Light Mode, `#242936` in Dark Mode) and text color darkened to `--foreground`.
    *   *Hover State:* Muted background opacity shifts (`0.05` ambient transparency) with a subtle micro-transition.
*   **Profile Section:** Placed at the bottom with avatar, name, and vertical dropdown chevron.

### 5.2 Forms & Selection Inputs
*   **Inputs & Dropdowns:**
    *   White background in Light Mode, deep dark container background in Dark Mode.
    *   `1px solid var(--border)`.
    *   `padding: 0.5rem 0.75rem`.
    *   *Focus State:* A crisp 1px ring or outline matching `var(--ring)` (no colored glows or shadow offsets).
*   **Radio & Checkbox Controls:**
    *   Standard circular elements for Radios, rounded squares for Checkboxes.
    *   *Active state:* Fill uses `var(--primary)` (black in light, white in dark) with a high-contrast tick or center dot.

### 5.3 Segmented Tab Bars
*   **Tabs:** Layout in a flat, horizontal row.
*   **Interactive Indicator:** The active tab is indicated by a clean, thick primary line underline (`3px` height) aligned to the baseline, and active text weight. Inactive tabs have muted gray text colors and transition to active weight on click.

### 5.4 Tag Badges
*   **Design:** Capsule-shaped tags with `6px` border-radius.
*   **Elements:** Text alongside a small colored status circle (variation identifiers) and a remove cross icon ("x") aligned to the right.
*   **Hover:** Hovering over the badge shifts opacity or scales the cross icon slightly to indicate clickability.

### 5.5 Action Buttons
*   **Primary Button:** Dark background (`#000000` text-white) in Light Mode, transitioning to White background (`#FFFFFF` text-black) in Dark Mode.
*   **Secondary Button (e.g. Save):** Neutral background (`#E2E8F0` in Light / `#252A35` in Dark).
*   **Cancel / Text Links:** Plain underline styling (`text-decoration: underline`).

### 5.6 Data Tables
*   **Headers:** Muted text with a light container background tint (`HSL(210, 17%, 98%)` in Light / `HSL(220, 16%, 10%)` in Dark).
*   **Subtle Grids:** Cell dividing lines are ultra-fine (`1px solid var(--border)`).
*   **Inputs in Cells:** Table inputs for Stock or Prices are border-less, inheriting cell properties, and only showing borders/rings when focused for immediate editing.

---

## 6. Animation & Motion Guidelines

We implement Emil Kowalski's UI motion principles to deliver a fast, performant, and premium interface that avoids unnecessary clutter.

### 7.1 Easing Curves & Timing Tokens
*   **Default Easing (UI Transitions):** `cubic-bezier(0.23, 1, 0.32, 1)` (Strong ease-out). Perfect for buttons, tabs, hover states.
*   **On-screen Movement:** `cubic-bezier(0.77, 0, 0.175, 1)` (Strong ease-in-out). Used for items shifting layout positions.
*   **Sheets & Drawers:** `cubic-bezier(0.32, 0.72, 0, 1)` (iOS-style sheet timing).

| Transition Target | Duration | Easing Curve |
| :--- | :--- | :--- |
| **Button press feedback** | `100ms - 160ms` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| **Dropdown & Select entrance** | `150ms - 220ms` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| **Modals, dialog overlays** | `200ms - 300ms` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| **Bottom drawer sheets** | `500ms` | `cubic-bezier(0.32, 0.72, 0, 1)` |

### 7.2 Property Selection (Hardware Acceleration)
*   **Rule:** Animate **only** `transform` and `opacity`. Avoid animating layout properties (`width`, `height`, `margin`, `padding`, `top`, `left`) to prevent layout thrashing and maintain 60/120fps.
*   **GPU Layer:** Apply CSS `will-change: transform, opacity` dynamically during active gestures to prompt GPU rendering layer promotion.

### 7.3 Micro-Interactions & Gestures
*   **Button Press Feedback:** Scale buttons down slightly on press/active triggers using `transform: scale(0.97)` to mimic mechanical click feedback.
*   **Menu Entrances:** Dropdown panels and selects animate using a combined opacity fade and vertical translate.
    *   *Scale constraint:* Start entry transforms at `scale(0.95)` (minimum) to the destination `scale(1.0)`. **Never animate from `scale(0)`** as it breaks organic motion.
*   **Tab Underline (Fluid Transition):** The active tab indicator underline transition is managed using the CSS View Transitions API or Framer Motion layout animations for smooth sliding.

### 7.4 Motion Accessibility
*   **Strict requirement:** All motion properties must respect the user's OS preference (`prefers-reduced-motion`).
*   **Reduced Motion Fallbacks:** Drop all translation and scaling transitions in favor of clean, instant changes or simple opacity fades (`opacity: 0` to `1`).
*   **Tailwind Integration:** Wrap motion declarations inside the `motion-safe:` modifier.

---

## 7. Implementation Reference (CSS & Tailwind)

### 7.1 globals.css Configuration
Map variables under `@layer base` to support both light and dark modes cleanly, and define custom easing curves.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* --- Light Mode Custom Properties --- */
    --background: 231 100% 99%;         /* #f8f9ff */
    --foreground: 212 56% 12%;          /* #0d1c2e */
    
    --card: 0 0% 100%;                  /* #ffffff */
    --card-foreground: 212 56% 12%;
    
    --popover: 0 0% 100%;
    --popover-foreground: 212 56% 12%;
    
    --primary: 0 0% 0%;                 /* #000000 */
    --primary-foreground: 0 0% 100%;    /* #ffffff */
    
    --secondary: 175 100% 21%;          /* #006a61 */
    --secondary-foreground: 0 0% 100%;
    
    --muted: 210 16% 93%;
    --muted-foreground: 215 16% 47%;    /* #627289 */
    
    --accent: 210 16% 93%;
    --accent-foreground: 212 56% 12%;
    
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    
    --border: 0 0% 90%;                 /* #e5e5e5 */
    --input: 0 0% 90%;
    --ring: 212 56% 12%;
    
    /* Layout Constants */
    --sidebar-bg: 210 17% 98%;
    --button-secondary: 210 16% 93%;
    
    /* Semantic Flags */
    --reserved-emerald: 158 64% 45%;
    --pending-amber: 38 92% 50%;
    --preservation-red: 343 90% 50%;

    /* Easing Tokens */
    --ease-out-default: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-in-out-onscreen: cubic-bezier(0.77, 0, 0.175, 1);
    --ease-ios-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  }

  .dark {
    /* --- Dark Mode Custom Properties --- */
    --background: 220 18% 8%;           /* #0D0F12 */
    --foreground: 220 10% 95%;          /* #F1F3F5 */
    
    --card: 220 16% 12%;                /* #141720 */
    --card-foreground: 220 10% 95%;
    
    --popover: 220 16% 12%;
    --popover-foreground: 220 10% 95%;
    
    --primary: 0 0% 100%;               /* #ffffff */
    --primary-foreground: 0 0% 0%;      /* #000000 */
    
    --secondary: 175 60% 45%;           /* Lighter Teal accent */
    --secondary-foreground: 0 0% 0%;
    
    --muted: 220 12% 16%;
    --muted-foreground: 220 10% 65%;    /* #9CA3AF */
    
    --accent: 220 12% 16%;
    --accent-foreground: 220 10% 95%;
    
    --destructive: 0 84% 65%;
    --destructive-foreground: 0 0% 100%;
    
    --border: 220 12% 20%;              /* #2D323E */
    --input: 220 12% 18%;
    --ring: 0 0% 100%;
    
    /* Layout Constants */
    --sidebar-bg: 220 16% 10%;          /* #11141B */
    --button-secondary: 220 12% 20%;
  }
}
```

### 7.2 tailwind.config.ts Color & Easing Extensions
Extend standard and transition components inside `tailwind.config.ts`:

```typescript
// tailwind.config.ts - Add mapped references inside theme.extend
theme: {
  extend: {
    colors: {
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      sidebar: {
        background: "hsl(var(--sidebar-bg))",
      },
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
      },
      secondary: {
        DEFAULT: "hsl(var(--secondary))",
        foreground: "hsl(var(--secondary-foreground))",
      },
      // Badge support and status indicators
      emerald: "hsl(var(--reserved-emerald))",
      amber: "hsl(var(--pending-amber))",
      red: "hsl(var(--preservation-red))",
    },
    transitionTimingFunction: {
      "out-default": "var(--ease-out-default)",
      "in-out-onscreen": "var(--ease-in-out-onscreen)",
      "ios-drawer": "var(--ease-ios-drawer)",
    }
  }
}
```

### 7.3 Next.js Hydration-Safe Theme Integration
To avoid theme flickering or layout shift during React hydration, the initial theme class configuration must execute via a blocking inline script in the `<head>` of `layout.tsx` before the UI is rendered.

#### 1. Page Layout Script Insertion (`src/app/layout.tsx`)
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sticky Book Covers | Pre-Order Hub',
  description: 'The institutional standard for premium book covers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        {/* Blocking hydration-safe script to align class with localStorage state immediately */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && preferDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
```

#### 2. Theme Toggle Hook (`src/hooks/useTheme.ts`)
Standard client component theme controller containing proper local storage updates and browser event synchronizations.

```typescript
'use client';

import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Read final runtime class list once hydrated
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return { theme, toggleTheme };
}
```

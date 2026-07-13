# AI Creative Studio - YouTube Thumbnail Product Specification

## 1. Vision: From Canvas Editor to AI Creative Studio

While a basic layout canvas provides essential editing capabilities (AI generation, canvas JSON structures, Firestore storage, WebP export, and editor modal bindings), YouTube creators need a platform built around **design intelligence, editing experience, asset management, and production workflows**. 

To build an industry-leading product that competes with Canva, VistaCreate, or Adobe Express for creators, the architecture must expand from a generic editor into an **AI Creative Studio** structured as follows:

```
Thumbnail Studio
│
├── AI Creative Director
│
├── Template Marketplace
│
├── Visual Asset Library
│
├── Editable Canvas
│
├── Typography Engine
│
├── Image Processing Engine
│
├── AI Copywriter
│
├── CTR Analyzer
│
├── Version History
│
├── Brand Kit
│
├── Export Pipeline
│
└── Publishing Integrations
```

---

## 2. Core Functional Specifications

### 2.1 AI Creative Director
The AI behaves as a Creative Director rather than a basic prompt responder. It understands YouTube audiences, video categories, and psychological click triggers.

- **Automated Reasoning Pipeline**: When given a simple prompt like *"How I Built a $1M SaaS"*, the AI makes design decisions based on:
  - **Topic Classification**: Business/Finance.
  - **Emotional Trigger**: Curiosity/Greed/Awe.
  - **CTR Strategy**: Big Shocking Numbers + High-contrast accent elements.
  - **Formula Layout**: Shocking Metric (Left) + Subject Person with expressive face (Right) + money accents + dark radial spotlight background.
  - **Typography Rules**: High-legibility sans-serif (`Anton` or `Bebas Neue`) in yellow/white, wrapped in a `12px` solid black stroke + drop shadow.
  - **Safe Zone Alignment**: Automatically offsets text and subjects from the bottom-right corner to avoid YouTube video timestamp overlays.

---

### 2.2 Layout Formulas Database
The engine routes design requests through a preset formulas registry, choosing predefined design frameworks rather than inventing coordinate layouts from scratch:

- **Reaction**: Expressive subject face + focal object + pointing arrow + radial glow background.
- **Before / After**: Split-screen comparative layout + vertical colored divider + contrastive labels.
- **Shocking Number**: Centered, giant numeric value + minimal hook text + glowing outer border.
- **Mistake / Warning**: Bold red warning badge + "Never do this" title + warning icon/indicator.
- **Gaming / Podcast**: Stylized branding borders + custom background lighting effects + high-contrast character overlays.

---

### 2.3 Professional Typography Engine
YouTube thumbnails rely heavily on typography readability at small sizes (e.g. mobile feeds).
- **Curated High-CTR Fonts**: Supporting Anton, Bebas Neue, League Spartan, Montserrat, Poppins, Impact, Luckiest Guy, Oswald, Archivo Black, and Figtree.
- **Style Presets**:
  - **YouTube Bold**: Massive font size, tight character tracking, 12px outer outline, black shadow.
  - **Gaming/Neon**: Outer color glow, uppercase lettering, cursive subtitle accents.
  - **Minimalist**: Clean sans-serif, high tracking, solid background banner badges.

---

### 2.4 Smart Copywriter & CTR Analysis AI
- **Smart Text Rewrite**: Automatically rewrites long user titles into short, high-CTR hook titles (e.g., *"How I Made My First Million"* is rewritten as *"$1M SECRET"*, *"FROM $0 → $1M"*, or *"THIS MADE ME RICH"*).
- **CTR Predictor Score**: Evaluates the canvas on:
  - **Contrast & Contrast Ratio** (Text readability over backgrounds).
  - **Face Visibility & Emotion** (Detects size and expression).
  - **Mobile Preview Test** (Simulates visual scaling down to `120px` width).
  - **Safe Zones** (Checks bottom-right timestamp block overlap).
  - **Overall score out of 100** with actionable design suggestions (e.g., *"Increase face size by 18%"*, *"Change title color to yellow for higher contrast"*).

---

### 2.5 Subject Extraction & Image Processing Engine
- **One-Click AI Background Removal**: Integrates background removal and subject cutout algorithms.
- **Subject Enhancements**: Relighting, glow outlines, drop shadows, and eye/smile brightness tweaks.
- **Semantic Layer Classification**: Automatically labels layers by context (`Hero Subject`, `Foreground`, `Background`, `Typography Hook`, `Arrow Decor`, `Safe Zone`).

---

### 2.6 Canvas Engine and User Experience
The editing workspace supports Canva-quality layouts:
- **Snapping & Guides**: Smart alignment grids and visual layout snapping.
- **Undo/Redo Stack**: Version control to revert canvas JSON state node-by-node.
- **YouTube UI Overlay**: Safe-area toggle to overlay the red progress bar and timestamp indicator to verify no elements are hidden.
- **Responsive Zoom**: Dynamic view scaling between 10% and 800%.

---

## 3. Implementation Blueprint

### Phase 1: Interactive Canvas Extensions (Konva/Fabric Integration)
- Migrate rendering structure to a custom canvas wrapper supporting snapping, guides, safe-area toggles, and live text block scaling.
- Integrate undo/redo state array wrappers for canvas JSON tracking.

### Phase 2: Creative Director AI Orchestration
- Build a multi-agent system where `CopywriterAgent` handles text hook summaries, `LayoutAgent` applies preset formulas, and `TypographyAgent` configures font scales and outlines.

### Phase 3: Image Processing & Object Cutouts
- Hook up background removal and subject detection APIs. Apply white outline glows to subject layers automatically.

### Phase 4: Creator Brand Kits & Publishing
- Support brand custom colors, fonts, and logo asset presets saved to Firebase.
- Add direct publishing integrations to sync final thumbnails back to YouTube channels or message templates.

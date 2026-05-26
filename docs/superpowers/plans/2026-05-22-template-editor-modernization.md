# Messaging Template Editor Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the template editor UI/UX to conform to back-office design standards using a premium blue theme and support the new three-axis classification system with an interactive Bento grid.

**Architecture:** We will redesign Step 1 of `TemplateWorkshop` to display a three-column bento-style selector for Channel, Category, and Recipient Role, syncing the Target Audience state dynamically. All primary theme highlights (`primary` / `emerald`) in the workspace components will be refactored to Tailwind blue styles, and `users` will be added to the category list and filters.

**Tech Stack:** React, Next.js, Tailwind CSS, Lucide icons, Radix UI primitives.

---

### Task 1: Add 'users' Category to filters and registries

**Files:**
- Modify: [template-gallery.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/templates/components/template-gallery.tsx)

- [x] **Step 1: Update the categories list in template-gallery.tsx filters**

Add `users` to the array of categories displayed in the gallery filter dropdown.

```typescript
// Around line 188 of src/app/admin/messaging/templates/components/template-gallery.tsx
<SelectContent className="rounded-xl">
    <SelectItem value="all">All Types</SelectItem>
    {['general', 'surveys', 'meetings', 'forms', 'agreements', 'campaigns', 'reminders', 'tasks', 'automations', 'qr_codes', 'users'].map(c => (
        <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
    ))}
</SelectContent>
```

- [x] **Step 2: Verify compiling**
Verify there are no compile or syntax errors.

- [x] **Step 3: Commit**
```bash
git add src/app/admin/messaging/templates/components/template-gallery.tsx
git commit -m "feat: add users category to gallery filters"
```

---

### Task 2: Shift color themes to premium blue in HTML/PlainText Editors, Block Inspector, and Visual Block

**Files:**
- Modify: [HtmlCodeEditor.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/templates/components/HtmlCodeEditor.tsx)
- Modify: [PlainTextEditor.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/templates/components/PlainTextEditor.tsx)
- Modify: [block-inspector.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/templates/components/block-inspector.tsx)
- Modify: [visual-block.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/templates/components/visual-block.tsx)

- [x] **Step 1: Replace primary colors in HtmlCodeEditor.tsx**
Replace focus-visible ring styles and primary highlight buttons with tailwind blue colors:
```diff
- 'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset',
+ 'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-inset',

- 'bg-primary/5 text-primary border border-primary/10',
+ 'bg-blue-50 text-blue-600 border border-blue-100',

- 'hover:bg-primary/10 hover:border-primary/20',
+ 'hover:bg-blue-100/50 hover:border-blue-200',

- 'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
+ 'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:outline-none',
```

- [x] **Step 2: Replace primary colors in PlainTextEditor.tsx**
```diff
- 'focus-visible:ring-2 focus-visible:ring-primary/30',
+ 'focus-visible:ring-2 focus-visible:ring-blue-500/20',

- 'bg-primary/5 text-primary border border-primary/10',
+ 'bg-blue-50 text-blue-600 border border-blue-100',

- 'hover:bg-primary/10 hover:border-primary/20',
+ 'hover:bg-blue-100/50 hover:border-blue-200',

- 'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
+ 'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:outline-none',
```

- [x] **Step 3: Replace colors in block-inspector.tsx**
```diff
- focus:ring-1 focus:ring-primary/20
+ focus:ring-1 focus:ring-blue-500/20

- focus-visible:ring-1 focus-visible:ring-primary/20
+ focus-visible:ring-1 focus-visible:ring-blue-500/20

- text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/20 hover:bg-primary/10
+ text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 hover:bg-blue-100/50

- bg-card shadow-md text-primary
+ bg-card shadow-md text-blue-600
```

- [x] **Step 4: Replace colors in visual-block.tsx**
Modify any accent borders, buttons, or indicators that reference `primary` or `emerald` when blocks are hovered or focused, changing them to blue equivalents.

- [x] **Step 5: Verify compiling**
Verify all edited files compile cleanly.

- [x] **Step 6: Commit**
```bash
git add src/app/admin/messaging/templates/components/HtmlCodeEditor.tsx src/app/admin/messaging/templates/components/PlainTextEditor.tsx src/app/admin/messaging/templates/components/block-inspector.tsx src/app/admin/messaging/templates/components/visual-block.tsx
git commit -m "style: migrate editors and block controls to premium blue accents"
```

---

### Task 3: Refactor simulation studio colors to blue

**Files:**
- Modify: [simulation-studio.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/templates/components/simulation-studio.tsx)

- [x] **Step 1: Replace all primary highlights in simulation-studio.tsx**
Update classes using `text-primary`, `bg-primary/5`, `border-primary`, `bg-primary/10` to `text-blue-600`, `bg-blue-50`, `border-blue-100`, `bg-blue-100/50` or direct blue colors where appropriate. Ensure visual feedback elements remain consistent and premium.

- [x] **Step 2: Commit**
```bash
git add src/app/admin/messaging/templates/components/simulation-studio.tsx
git commit -m "style: update simulation studio accents to premium blue"
```

---

### Task 4: Implement Step 1 Interactive Bento Dashboard & Taxonomy Sync (CANCELLED)

> [!NOTE]
> This task was bypassed/cancelled by the user on 2026-05-25. The existing category/recipient select dropdowns and target audience synchronization hooks will be retained as-is, and verification will focus on the updated blue themes.

- [~] **Step 1: Define bento grid visual icons and labels** (Skipped - marked as not necessary by user request)
- [~] **Step 2: Add dynamic synchronization hook for Target Audience** (Skipped - marked as not necessary by user request)
- [~] **Step 3: Redesign Step 1 UI block with Three-Column Grid** (Skipped - marked as not necessary by user request)
- [~] **Step 4: Verify type checker and local compiler** (Skipped - marked as not necessary by user request)
- [~] **Step 5: Commit** (Skipped - marked as not necessary by user request)

---

### Task 5: System Verification & Polish

- [x] **Step 1: Run type checker check**
Verify the application compiles without any TypeScript errors.
Command: `npm run typecheck` or similar check.

- [x] **Step 2: Verify UI and visual styles manually**
Ensure templates save cleanly, tags load correctly, colors are premium blue, and category filtering works.

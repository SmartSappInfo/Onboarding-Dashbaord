# Messaging Styles Restructuring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the message styling wrappers into Internal and External wrappers under a single style document, introduce visual theme overrides, and migrate legacy templates to modern blocks.

**Architecture:** Extend the `MessageStyle` Firestore model to contain `htmlWrapperInternal` and `htmlWrapperExternal` alongside visual tokens. The compiler dynamically selects the wrapper and passes custom colors/fonts/spacing to overrides during block rendering.

**Tech Stack:** React, Next.js, Firebase Firestore, Tailwind CSS, TypeScript.

---

## Proposed Changes

### Component 1: Core Type Updates

#### [MODIFY] [types.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/types.ts)
Add dual wrapper properties and visual tokens to `MessageStyle` interface.

```typescript
export interface MessageStyle {
  id: string;
  name: string;
  htmlWrapper?: string; // Legacy fallback
  htmlWrapperInternal: string; // Internal admin communications
  htmlWrapperExternal: string; // External client communications
  workspaceIds: string[];
  isDefault?: boolean;
  scope?: 'global' | 'organization';
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;

  // Custom visual overrides
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  backgroundColor?: string;
  textColor?: string;
  cardBackgroundColor?: string;
  borderRadius?: string;
}
```

- [ ] **Step 1: Update type definition in types.ts**
- [ ] **Step 2: Commit changes**
  ```bash
  git add src/lib/types.ts
  git commit -m "chore: update MessageStyle type definition"
  ```

---

### Component 2: Compiler & Resolution Logic

#### [MODIFY] [messaging-engine.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/messaging-engine.ts)
Update template compilation to resolve the correct style wrapper (internal or external) and pass visual style parameters.

- [ ] **Step 1: Refactor style resolution logic in compileTemplate function**
  Modify lines 382-389:
  ```typescript
      // 6. Resolve Style Wrapper
      let styleWrapper = '';
      let activeStyleDoc: MessageStyle | null = null;

      if (template.styleId !== 'none') {
          let styleIdToUse = template.styleId;
          
          // If styleId is empty or default, query default workspace style
          if (!styleIdToUse || styleIdToUse === 'default') {
              const defaultSnap = await adminDb.collection('message_styles')
                  .where('workspaceIds', 'array-contains', resolvedWorkspaceId)
                  .where('isDefault', '==', true)
                  .limit(1)
                  .get();
              if (!defaultSnap.empty) {
                  activeStyleDoc = defaultSnap.docs[0].data() as MessageStyle;
              }
          } else {
              const styleSnap = await adminDb.collection('message_styles').doc(styleIdToUse).get();
              if (styleSnap.exists) {
                  activeStyleDoc = styleSnap.data() as MessageStyle;
              }
          }

          if (activeStyleDoc) {
              // Select target-aware wrapper
              if (template.target === 'internal_team') {
                  styleWrapper = activeStyleDoc.htmlWrapperInternal || activeStyleDoc.htmlWrapper || '';
              } else {
                  styleWrapper = activeStyleDoc.htmlWrapperExternal || activeStyleDoc.htmlWrapper || '';
              }
          }
      }
  ```
- [ ] **Step 2: Refactor block rendering option passing**
  Modify lines 399-402:
  ```typescript
      if (useBlocks && template.blocks?.length) {
          resolvedBody = renderBlocksToHtml(template.blocks, finalVariables, {
              wrapper: styleWrapper || undefined,
              style: activeStyleDoc || undefined
          });
      } else {
          resolvedBody = resolveVariables(template.body, finalVariables);
          if (template.channel === 'email') {
              if (styleWrapper && styleWrapper.includes('{{content}}')) {
                  resolvedBody = resolveVariables(styleWrapper, finalVariables).replace('{{content}}', resolvedBody);
              } else if (template.contentMode === 'plain_text' || !template.contentMode) {
                  resolvedBody = plainTextToHtml(resolvedBody);
              }
          }
      }
  ```
- [ ] **Step 3: Commit changes**
  ```bash
  git add src/lib/messaging-engine.ts
  git commit -m "feat: implement target-aware style wrapper resolution in compilation engine"
  ```

#### [MODIFY] [messaging-utils.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/messaging-utils.ts)
Update `renderBlocksToHtml` to consume design token overrides from style properties.

- [ ] **Step 1: Update options interface in messaging-utils.ts**
  Modify lines 208-217:
  ```typescript
  export function renderBlocksToHtml(
    blocks: MessageBlock[], 
    variables: Record<string, any>, 
    options?: { 
      width?: string, 
      backgroundColor?: string,
      wrapper?: string,
      isDark?: boolean,
      style?: MessageStyle
    }
  ): string {
  ```
- [ ] **Step 2: Apply custom visual tokens dynamically**
  Modify lines 220-228:
  ```typescript
    const isDark = options?.isDark;
    const maxWidth = options?.width || '600px';
    const outerBg = options?.style?.backgroundColor || options?.backgroundColor || (isDark ? '#090d16' : '#F1F5F9');
    const cardBg = options?.style?.cardBackgroundColor || (isDark ? '#111827' : '#FFFFFF');
    const textColor = options?.style?.textColor || (isDark ? '#f3f4f6' : '#1e293b');
    const dividerColor = isDark ? '#374151' : '#e2e8f0';
    const footerTextColor = isDark ? '#6b7280' : '#94a3b8';
    const subBg = isDark ? '#1f2937' : '#f8fafc';
    const fontFam = options?.style?.fontFamily || 'Figtree';
  ```
- [ ] **Step 3: Inject custom font styles in head**
  Modify template stylesheet injections in lines 505-520 to load Google Font dynamically if custom font is specified.
- [ ] **Step 4: Commit changes**
  ```bash
  git add src/lib/messaging-utils.ts
  git commit -m "feat: add visual overrides to block rendering helper"
  ```

---

### Component 3: Styles Library UI

#### [MODIFY] [styles/[id]/page.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/styles/[id]/page.tsx)
Build tabbed dual-wrapper editing fields and styling override controls.

- [ ] **Step 1: Update state properties to track both wrappers and overrides**
- [ ] **Step 2: Refactor fetchStyle and handleSave triggers to update new fields**
- [ ] **Step 3: Render style settings tabs and visual control sidebar**
- [ ] **Step 4: Commit changes**
  ```bash
  git add src/app/admin/messaging/styles/[id]/page.tsx
  git commit -m "feat: complete modern dual-wrapper and design override styling page"
  ```

#### [MODIFY] [styles/page.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/styles/page.tsx)
- [ ] **Step 1: Ensure workspace-sharing queries read organization scope**
- [ ] **Step 2: Add option to configure default workspace style wrapper (including "No wrapper")**
- [ ] **Step 3: Commit changes**
  ```bash
  git add src/app/admin/messaging/styles/page.tsx
  git commit -m "feat: update styles dashboard list and organization configuration"
  ```

---

### Component 4: Template Visual Composer

#### [MODIFY] [template-workshop.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/templates/components/template-workshop.tsx)
Update visual preview simulator to dynamically resolve styles.

- [ ] **Step 1: Update style selector drop-down options**
- [ ] **Step 2: Bind preview wrapper resolver to use internal/external based on target**
- [ ] **Step 3: Commit changes**
  ```bash
  git add src/app/admin/messaging/templates/components/template-workshop.tsx
  git commit -m "feat: support default/none styling dropdown option in template visual composer"
  ```

---

### Component 5: FER Block Migration & Re-seeding

#### [NEW] [migrate-messaging-fer.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/migrate-messaging-fer.ts)
Migration script utilizing block parsing to upgrade templates.

- [ ] **Step 1: Write script to load legacy plain/HTML body templates and map them to blocks**
- [ ] **Step 2: Update database seeds with dual-wrapper blueprints**
- [ ] **Step 3: Commit changes**
  ```bash
  git add src/lib/migrate-messaging-fer.ts src/lib/seed-messaging-blueprint.ts
  git commit -m "feat: write FER block migration script and update design templates seeding blueprints"
  ```

# Design Specification: Messaging Template Editor Modernization & Three-Axis Classification Sync

**Date**: 2026-05-22  
**Feature**: Messaging Template Workshop / Editor Modernization  
**Theme**: Premium Blue Back-Office Standards

---

## 1. Objectives & Success Criteria

1. **Taxonomy Realignment**: Redesign the template creation/editing step (Step 1) to support a clean, three-axis taxonomy matching the app's server-side filtering criteria:
   * **Channel**: `email` or `sms`
   * **Category**: `forms`, `surveys`, `meetings`, `agreements`, `campaigns`, `reminders`, `tasks`, `automations`, `qr_codes`, `users`, `general`
   * **Recipient / Target Sync**: Sync target audience (`external_client` vs `internal_team`) automatically from the selected recipient role (`entity`, `external_alert`, `internal_alert`, `respondent`, `assignee`).
2. **Back-Office Design Standards**: Modernize the page layouts to look high-end, converting all existing primary green/emerald theme accents inside the workshop scope to a premium blue palette.
3. **Visual Bento Grid**: Replace standard dropdown lists in Step 1 with an interactive, multi-column dashboard card selection layout.
4. **Gallery Integration**: Add the new `users` category to the list of selectable categories in both the workshop and the gallery filtering dropdown.

---

## 2. Detailed Technical Design

### Step 1: The Three-Column Bento Dashboard Layout
Instead of a simple vertical list of selectors, the top half of the configuration form will render as a 3-column flex/grid container:

* **Column 1: Channel Selector (width: ~25%)**
  * Displays two large interactive cards for **Email** and **SMS**.
  * Email card displays a `Mail` icon, with a description of rich builder, HTML, and text modes.
  * SMS card displays a `Smartphone` icon, detailing text-only delivery.
  * *Interactivity*: Selecting SMS automatically resets Content Mode to `plain_text` and hides rich builder option alerts.
  
* **Column 2: Category Selector (width: ~45%)**
  * Displays a 11-tile bento grid of all supported template categories:
    * `general`: General notifications (Icon: `Settings2`)
    * `surveys`: Surveys and feedback (Icon: `ClipboardList` / `Zap`)
    * `meetings`: Meeting schedules and alerts (Icon: `Calendar`)
    * `forms`: Intake and pdf forms (Icon: `FileText`)
    * `agreements`: Contracts and signatures (Icon: `FileSignature` / `FileCheck`)
    * `campaigns`: Marketing campaigns (Icon: `Megaphone`)
    * `reminders`: Schedule notifications (Icon: `Bell`)
    * `tasks`: Operational task states (Icon: `CheckSquare`)
    * `automations`: Triggered operations (Icon: `Cpu`)
    * `qr_codes`: QR scans (Icon: `QrCode`)
    * `users`: Team profile contexts (Icon: `Users`) (NEW)
  * Each card shows a neat layout with a mini icon and title. Hover state transitions to soft blue. Selected category has a blue border and soft blue background.

* **Column 3: Target Audience & Recipient Role (width: ~30%)**
  * **Target Audience Panel**: Shows a read-only badge indicating if the audience is `external_client` (labeled "External Client") or `internal_team` (labeled "Team / Staff").
  * **Recipient Role Selector**: 5 styled cards representing:
    * `entity` (Label: "Participant / Client")
    * `external_alert` (Label: "External Alert")
    * `internal_alert` (Label: "Internal Alert")
    * `respondent` (Label: "Respondent")
    * `assignee` (Label: "Assignee")
  * *Sync Logic*:
    * Selecting `internal_alert` or `assignee` (or legacy `team_member`/`admin`) sets `target` to `internal_team`.
    * Selecting `entity`, `external_alert`, or `respondent` sets `target` to `external_client`.

### Accent Palette & Style Updates
To shift the UI to premium blue, we will perform file-wide replacements of emerald or generic green classes within the messaging template editor workspace components:

1. `bg-primary` / `text-primary` / `border-primary` -> hardcoded tailwind blue classes: `bg-blue-600`, `text-blue-600`, `border-blue-600`
2. Steps wizard: `step === n ? 'bg-primary/10 border-primary text-primary' : '...'` -> use blue values: `bg-blue-50 border-blue-600 text-blue-600`
3. Hover interactions: `hover:bg-primary/5 hover:text-primary` -> `hover:bg-blue-50/50 hover:text-blue-600`
4. Form controls focus rings: `focus:ring-primary/20` -> `focus:ring-blue-500/20`, `focus-visible:ring-blue-500/20`

Files to modify:
1. `src/app/admin/messaging/templates/components/template-workshop.tsx`
2. `src/app/admin/messaging/templates/components/block-inspector.tsx`
3. `src/app/admin/messaging/templates/components/visual-block.tsx`
4. `src/app/admin/messaging/templates/components/simulation-studio.tsx`
5. `src/app/admin/messaging/templates/components/HtmlCodeEditor.tsx`
6. `src/app/admin/messaging/templates/components/PlainTextEditor.tsx`
7. `src/app/admin/messaging/templates/components/template-gallery.tsx`

---

## 3. Verification Plan

### Automated Checks
* Execute the TypeScript build compiler to verify type check correctness.
* Ensure all files export correct JSX structures and compile cleanly.

### Manual Verification
* Access Step 1 of the Template Workshop and inspect the 3-column layout.
* Click different channels and categories to verify the UI transitions smoothly.
* Select different recipient roles and verify that the target audience dynamically changes (e.g. selecting `assignee` turns Target Audience to "Team / Staff").
* Verify that the template is saved successfully with correct classification values in Firebase.

# Design Specification — Minimal Console Notes Tab

We will redesign the Console Notes tab (`EntityNotesTab.tsx`) to implement a minimal, high-fidelity UI/UX that eliminates visual clutter, introduces a fluid inline composer, simplifies filtering, and polishes list item rendering.

---

## 1. Architectural Changes

### Components & Visual Style
*   **Header Toolbar**: A single row containing a search input, a dropdown selector for categories, and a compact "Add Note" trigger.
*   **Inline Composer**: A collapsible note-entry canvas that slides open with a smooth height transition directly above the timeline stream.
*   **Minimalist Note Feed**: Clean, border-tinted timeline items showing note content, metadata labels, and hover-triggered action buttons (pin, edit, delete, reply).

---

## 2. Technical Details & Interfaces

### File Locations
*   [EntityNotesTab.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/entities/components/EntityNotesTab.tsx) — Main entry point for the notes stream UI.

### State & Properties
*   `showAddNote`: Controls whether the inline editor panel is collapsed (`height: 0`, opacity `0`) or expanded (`height: auto`, opacity `1`).
*   `searchQuery`: Local string state bound to the header search input for filtering notes in-memory.
*   `filterType`: Restructured to filter notes by both type (Call, Meeting, Escalation, Follow-up) and text matches.

---

## 3. UI/UX & Responsive Layouts

### Desktop Layout
*   Flex row header toolbar with aligned search box and selectors.
*   Action buttons (Pin, Edit, Trash) show up on card-hover states to reduce static clutter.

### Mobile Layout
*   Input fields and search box stretch to full-width stacked rows on screens $< 768$px.
*   Touch targets for buttons remain at least `44x44px` for accessibility.

---

## 4. Verification & Testing

### Automated Unit Tests
*   Verify search filter filters list in-memory.
*   Verify adding a note collapses the inline composer and resets draft state.

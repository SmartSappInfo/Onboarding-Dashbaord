# Mobile Workspace Switcher: Sliding Panel Design

This spec describes the design and transition architecture for the mobile-responsive workspace and organization switcher in the Admin layout.

---

## 1. Problem Statement
On mobile viewport resolutions (under `768px`), opening nested dropdown menus (`DropdownMenuContent` and `DropdownMenuSubContent`) from within the sidebar Sheet causes major layout issues:
1. The sidebar occupies `288px` (leaving only `72px` of screen width).
2. Radix UI Sub-menus render side-by-side (opening to the right of the parent), which forces them to clip out of the viewport bounds or overlap entirely.
3. Hover interactions do not translate to touch screen gestures.

---

## 2. Proposed Solution: Multi-Step Sliding Panel
Instead of launching a popup dropdown menu overlay on mobile devices:
1. The sidebar will maintain two horizontal panes (views):
   * **Main Menu Pane**: Displays the list of navigation links (Dashboard, Campuses, Deals, etc.).
   * **Switcher Panel Pane**: Displays a list of Organizations and their Workspaces.
2. Clicking the switcher button in the sidebar header transitions the layout:
   * Main Menu Pane slides left (`translateX(-100%)`).
   * Switcher Panel Pane slides in from the right (`translateX(0)`).
3. The Switcher Panel Pane includes a prominent "Back" button at the top to slide back to the Main Menu. Tapping any workspace selects it and automatically slides the view back.
4. This ensures all interaction occurs strictly within the viewport width of the sidebar Sheet, keeping 100% of the screen clean.

---

## 3. Technical Implementation Details

### Component Structure
We will modify [AdminSidebar.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/components/AdminSidebar.tsx):
* Introduce a React state variable `activePanel` (`'menu' | 'switcher'`).
* Group the sidebar content into two containers:
  * Container 1: Switcher header + Navigation groups (`renderNavGroup`).
  * Container 2: Back button + Organization / Workspace flat selectors list (this container will be visible only when `isMobile` is true and `activePanel === 'switcher'`).
* Animate the transitions using Tailwind transition classes (`transition-transform duration-300 ease-out-in`) and translation transforms (`translate-x-0`, `translate-x-full`, `-translate-x-full`).

---

## 4. User Acceptance Criteria
* On **Desktop (`md` and wider)**: The switcher continues to open the standard dropdown menu popup.
* On **Mobile (`< md` screens)**: Tapping the switcher slides the menu out to reveal the workspace selector. No dropdown popup opens.
* Tapping a workspace switches the active organization/workspace and slides back to the main menu.
* Tapping "Back" slides back to the main menu.

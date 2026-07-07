# Design Spec: Workspace Creation Stepper & Industry Enablement

## Goal
Improve the workspace setup user experience by implementing a step-by-step guided wizard (stepper modal) inside the Workspace Architect settings. In addition, enable all supported industry verticals by default across both development and production environments, removing the environment variable gating.

---

## Architectural & UX Overview

### 1. Industry Vertical Enablement
- **Target File**: [feature-flags.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/feature-flags.ts)
- **Change**: Replace environment variable flags in `INDUSTRY_FEATURE_FLAGS` with hardcoded `true` values.
- **Enabled Verticals**:
  - `SaaS`
  - `Marketing`
  - `SchoolEnrollment`
  - `Consultancy`
  - `RealEstate`
  - `Law`

### 2. Multi-Step Workspace Stepper
- **Target File**: [WorkspaceEditor.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/app/admin/settings/components/WorkspaceEditor.tsx)
- **UI Design**: Horizontal Stepper Indicator with linear navigation constraints.
- **Steps Flow**:
  1. **Step 1: Basics**
     - Form Fields: Workspace Label (name), Theme (color), Objective Brief (description).
     - Validation: Name cannot be blank.
  2. **Step 2: Industry & Scope**
     - Form Fields: Industry Vertical Selection (6 options), Contact Scope Selection (`institution`, `family`, `person`).
     - Auto-mapping logic:
       - Selecting `SchoolEnrollment` auto-selects `family`.
       - Selecting `SaaS` auto-selects `institution`.
       - Selecting `Law`, `Marketing`, `RealEstate`, or `Consultancy` auto-selects `person` (with customizable options).
     - Validation: Both selections must be present.
  3. **Step 3: Security & Governance**
     - Form Fields: Contact Identifier Policy (Phone, Email, Phone or Email), Entity Visibility Scope (Assigned Only, All Entities).
  4. **Step 4: Lifecycle & Defaults**
     - Form Fields: Independent Status Lifecycle (status node list creator), Entity Defaults (per-workspace defaults).
     - Submit: Confirmation of inputs, showing a "Commit Workspace" button.

---

## Technical Details & Component Implementation

### State Management
```typescript
const [currentStep, setCurrentStep] = React.useState<number>(0);
```
- Navigation buttons: "Back" (disabled on step 0) and "Next" (changes to "Commit Workspace" on step 3).
- Moving forward requires validating inputs for the active step.
- Back navigation is always unconstrained and preserves state.
- Editing an existing workspace bypasses the stepper entirely, showing a unified form tabs interface or showing only editable configurations (as industry and scope are locked upon creation).

### Visual Layout & Animations
- The header of the dialog displays a sleek progress line with nodes:
  - **Completed steps**: Active theme color with a checkmark or number.
  - **Active step**: Ring highlights.
  - **Pending steps**: Slate/muted grey background.
- Tailwind transition wrappers (`transition-all duration-300 transform`) will be used to slide/fade steps in and out.

---

## Verification Plan

### Automated Verification
- Run components test suite to verify that the stepper component mounts and renders the steps properly.
```bash
pnpm test:components
```
- Execute the workspace test suite:
```bash
pnpm test:workspaces
```

### Manual Verification
- Deploy to local development server (`npm run dev`) and test the entire creation wizard:
  1. Click **New Workspace**.
  2. Complete Step 1 with a valid label. Click **Next**.
  3. Verify that 6 industries are visible.
  4. Select **School Enrollment** and check if **Families** is auto-selected. Click **Next**.
  5. Select policies on Step 3 and click **Next**.
  6. Add status nodes on Step 4 and click **Commit Workspace**.
  7. Check if the workspace is successfully created and has the correct capabilities and terminology configured.

# Design Specification - Pipeline Value Threshold Tiers Deal Auto-Assignment

This document details the design and implementation details for adding a value threshold tiers assignment strategy (`'value-tiers'`) to pipeline-level deal routing.

## 1. Requirements & User Intent
The goal is to route incoming deals in a pipeline to specific assignees based on the deal's estimated value:
* Define multiple value tiers (rules).
* Each tier has a `maxValue` (inclusive upper limit) and a paired assignee (`userId`).
* If a deal's value is less than or equal to a tier's `maxValue`, the deal is routed to that assignee.
* Rules are sorted ascending by `maxValue` and checked sequentially.
* A fallback assignee can be defined for deals exceeding all rules.
* If no assignee is matched/found, the routing falls back to the entity owner (Direct).

---

## 2. Firestore Schema & Types
We will extend the `Pipeline` type in [types.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/types.ts):

```typescript
export interface ValueTierRule {
  id: string;       // Unique ID for state tracking/React lists
  maxValue: number;  // Upper limit of deal value for this tier
  userId: string;    // The assignee for this tier
}

export interface Pipeline {
  // ... existing fields
  assignmentStrategy?: 'direct' | 'round-robin' | 'value-based' | 'unassigned' | 'value-tiers';
  assignmentValueTiers?: ValueTierRule[];
  assignmentValueTiersFallbackUserId?: string;
}
```

---

## 3. Backend Routing Logic
We will implement the matching logic in the following actions:
* `createDeal` in [deal-actions.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/actions/deal-actions.ts)
* `bulkCreateDealsAction` in [bulk-deal-actions.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/actions/bulk-deal-actions.ts)
* `processImportChunkBackground` in [bulk-upload-actions.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/bulk-upload-actions.ts)

### Matching Flow:
1. Load the pipeline's routing configurations.
2. If `activeStrategy` is `'value-tiers'`:
   * Retrieve the deal value (default to `0` if undefined/null).
   * Sort `assignmentValueTiers` ascending by `maxValue`.
   * Find the first rule where `dealValue <= rule.maxValue`.
   * If matched, resolve user details for `rule.userId`.
   * If not matched, check if `assignmentValueTiersFallbackUserId` is defined. If yes, resolve user details.
   * If still no assignee resolved, fall back to the entity owner (`'direct'`).

---

## 4. UI Configuration
We will add a dynamic rules editor inside the **Deal Assignment Rules** card in:
* [PipelineConfigView.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/pipeline/components/PipelineConfigView.tsx)
* [PipelineSettingsClient.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/pipeline/settings/PipelineSettingsClient.tsx)

### Rules Editor Layout:
* Displayed only when the strategy is `'value-tiers'`.
* **Rules List:** Renders threshold inputs paired with workspace member select triggers. Includes delete trash icon.
* **"Add Tier Rule" button:** Appends a new rule.
* **Fallback Assignee dropdown:** Configures the assignee for values over the maximum threshold.
* On Save: Automatically filters empty/invalid rules, sorts rules by `maxValue` ascending, and commits to Firestore.

---

## 5. UI Dialogs & Alignment
* [CreateDealModal.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/entities/components/CreateDealModal.tsx): Update `getAutoLabel` to map `'value-tiers'` to `"Auto — Value Threshold Tiers"`.
* [BulkCreateDealModal.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/entities/components/BulkCreateDealModal.tsx) & [DefaultSettingsStep.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/entities/upload/components/DefaultSettingsStep.tsx): Inherit through the default `'pipeline'` assignment strategy option.

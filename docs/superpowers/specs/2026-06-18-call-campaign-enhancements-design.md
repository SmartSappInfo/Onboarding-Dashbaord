# Call Campaign Enhancements Design Spec

## Goal
Enhance the call campaign system within SmartSapp Communications to support:
1. Adding contacts to call campaigns from the entity list view (single and bulk), entity console details, and campaign analytics views.
2. A premium "More Actions" dropdown (doughnut style) menu with cloning, archiving, deleting, launching, ending, and audience management.
3. Rigid vs loose campaign setting: "Fixed Audience" (no additions after launch) vs "Dynamic Audience" (allows additions).
4. Locking the script select setting once a campaign has recorded at least one outcome.
5. Interactive UI improvements like clickable progress bars and status indicators with tooltips.

---

## Proposed Changes

### 1. Schema & Types (`src/lib/types.ts`)
* Expand `CallCampaign` interface:
  ```typescript
  export interface CallCampaign {
    // ... existing fields ...
    allowAddContactsAfterLaunch?: boolean; // Toggle setting: true = Dynamic, false = Fixed
  }
  ```
* Update `CallCampaignStatus` type:
  ```typescript
  export type CallCampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'archived';
  ```

### 2. Backend Services (`src/lib/services/call-centre-service.ts` & `src/lib/call-centre-actions.ts`)
* Add `CallCentreService.cloneCampaign(campaignId: string, userId: string)`:
  * Copies campaign configurations (excluding queue statistics and actual contacts if Fixed Audience).
  * Sets status of the copy to `'draft'`.
* Add `CallCentreService.addContactsToCampaign(campaignId: string, entityIds: string[], workspaceId: string)`:
  * Batch-adds entities to `call_queue_items` for the campaign.
  * Ensures no duplicates are created.
  * Increments `progress.total` and `progress.pending` counts.
* Add `CallCentreService.archiveCampaign(campaignId: string)`:
  * Updates status to `'archived'`.
* Add server action wrappers in `call-centre-actions.ts`.

### 3. UI Components & Pages

#### A. Campaign Settings / Wizard (`CampaignWizardClient.tsx`)
* Add a toggle button under the settings step:
  * **Setting Label**: `Audience Management`
  * **Toggle Switch**: `Allow contacts to be added after campaign launch` (updates `allowAddContactsAfterLaunch`).
  * Displays status text: "Dynamic Audience" (Loose) when ON, "Fixed Audience" (Fixed) when OFF.
* Disable the Playbook Script selector dropdown if `campaign.progress.completed > 0`. Show an informative warning message explaining the change restriction.

#### B. Campaign List View (`CallCentreClient.tsx`)
* Replace row actions with a sleek circular dropdown trigger ("doughnut-style" button).
* Options inside Dropdown:
  * **Clone**: Triggers `cloneCallCampaignAction` and refreshes.
  * **Launch / End**: Updates status to `'running'` or `'completed'`.
  * **Audience Management**: Quick edit access to campaign audience configuration.
  * **Add Contacts**: Opens `AddContactsDialog` modal (hidden/disabled if campaign is Fixed Audience AND launched).
  * **Archive / Delete**: Updates status to `'archived'` or deletes document.
  * **View Statistics**: Navigates to the analytics dashboard.
* Progress Bar Interaction: Clicking on the progress bar routes the user to the stats dashboard.
* Status Dots: Add colored status dots with `Tooltip` messages next to running or completed campaign rows.

#### C. Entity Views (`EntitiesClient.tsx`, `BulkActionDock.tsx`, `Entities/[id]/page.tsx`)
* Row Dropdown / Bulk Action / Entity detail page header: Add `"Add to Call Campaign"` action.
* Opens `AddToCampaignDialog` listing all active campaigns.
* Hides or disables campaigns configured with a Fixed Audience that have already been launched.
* Submits selection, adding selected entities to `call_queue_items`.

#### D. Analytics/Statistics View (`CampaignAnalyticsClient.tsx`)
* Add an `"Add Contacts"` button inside the metrics grid/cards.
* Trigger a dialog allowing users to add workspace contacts.
* Disables/hides the button if the campaign is a Fixed Audience.

---

## Verification Plan

### Automated Checks
* Run `pnpm typecheck` to verify no compile errors with the new statuses or settings.

### Manual Verification
* Create a Fixed Audience campaign, launch it, and confirm:
  * "Add contacts" buttons/options are hidden or disabled with tooltips.
  * Script selector is disabled once progress is recorded.
* Create a Dynamic Audience campaign, launch it, and confirm:
  * Contacts can be added from row actions, bulk action dock, details page, and stats view.
  * Total/pending counts increment correctly on contact additions.

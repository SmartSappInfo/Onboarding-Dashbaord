# Agreements Hub UI Enhancement Specification

## Overview

The page has a solid foundation: the visual hierarchy is clean, the KPI cards are readable, and the institution table gives users a clear view of contract status. The main problem is the navigation architecture — seven or eight tabs compete for attention, several represent different types of functionality, and the most important workflow (identifying an institution and creating or managing its contract) is visually secondary to the navigation.

For SmartSapp CRM, we keep the existing minimalistic blue-and-white design but reorganize the page around one primary workflow, a small number of navigation groups, and contextual actions.

---

## 1. Core Changes

### 1. Replace the crowded tab bar with four logical sections
Group related features rather than displaying every module at the same level:
* **Contracts** — contract register, lifecycle, bulk campaigns.
* **Templates** — document templates and reusable clauses.
* **Obligations** — milestones, renewals, reminders, and compliance.
* **Insights** — analytics, governance, and audit reports.

Move **GA cutover/migration** and **Developer & Embedded SDK** into an **Administration** menu, accessible to authorized users only.

### 2. Make the contract register the centre of the page
Keep the search, status filters, institution list, assignees, and row actions together. Make it easy to answer:
* Which schools have no contract?
* Which agreements need signatures?
* Who is responsible?
* What needs attention today?

### 3. Add an AI-assisted action layer
Use AI to surface missing contracts, overdue signatures, upcoming obligations, and unusual contract states. Offer suggested actions such as:
* Preparing a contract from an approved template
* Drafting a reminder
* Identifying institutions that need follow-up
* *Requirement:* Maintain human review before sending messages or executing legally consequential actions.

### 4. Reduce visual noise in the table
* Replace repeated italic "Unassigned" labels with a compact assignee field.
* Use status badges for actionable states.
* Provide useful filters.
* Show a clear empty state when no contract exists.
* Keep the three-dot menu for secondary actions.

---

## 2. Information Architecture & Tab Mapping

| Current Feature | Recommended Location | Notes |
| :--- | :--- | :--- |
| **Contracts & Lifecycle** | **Contracts** | Primary default view with institution register and lifecycle inspection. |
| **Bulk Campaigns & Compliance** | **Contracts → Bulk Actions** | Accessible via contextual action bar or secondary tab within Contracts. |
| **Document Templates** | **Templates** | Dedicated section for document catalog and reusable clauses. |
| **Obligations & Milestones** | **Obligations** | Dedicated section for milestones, renewals, and compliance tracking. |
| **Analytics & Reports** | **Insights** | Dedicated section for contract velocity, signing times, and analytics. |
| **Enterprise & Governance** | **Administration → Governance** | Accessible via the Administration dropdown for authorized roles. |
| **GA Cutover & Migration** | **Administration → Migration** | Accessible via Administration dropdown for migration cutover tasks. |
| **Developer & Embedded SDK** | **Administration → Developer Tools** | Accessible via Administration dropdown for API keys & webhooks. |
| **Reminder Rules** | **Obligations → Reminder Settings** | Contextual drawer or button within Obligations view. |

---

## 3. Important UX Refinements

* **Fix KPI definitions:**
  * Define clear metrics: Total Institutions, No Contract (Needs preparation), Awaiting Signature (Pending completion), and Active Contracts (vs last 30 days trend).
  * Avoid ambiguous metrics that users cannot interpret.
* **Replace "Select All Unprepared":**
  * Use a conventional bulk-selection checkbox with a contextual floating/inline action bar: *"Prepare contracts for X selected institutions"*.
* **Make rows actionable:**
  * Clicking an institution opens a contract detail drawer with lifecycle history, assigned owner, outstanding actions, reminders, and documents.
* **Progressive disclosure:**
  * Show the four primary sections first; reveal advanced administration tools on demand.
* **Contextual AI Assistant:**
  * Recommendations utilize current institution context, selected contracts, and permitted workspace data.
  * AI-generated drafts remain reviewable before approval or dispatch.
* **Mobile-first responsive architecture:**
  * Collapse primary navigation into a compact selector / segment control.
  * 2x2 grid for KPI cards on mobile viewports.
  * Render the institution list as clean tactile cards rather than squeezing desktop tables onto small screens.
  * Mobile bottom navigation bar for quick section switching.

---

## 4. Visual Layout Mockup Reference

### Desktop View
* **Header:** Agreements Hub title with workspace descriptor and primary action (`+ New Contract`).
* **Section Nav:** Segmented control: `[Contracts]` `[Templates]` `[Obligations]` `[Insights]` + `[Administration ⌄]` dropdown menu.
* **KPI Cards (4-column grid):**
  1. *Total Institutions:* Count + trend vs last 30 days.
  2. *No Contract:* Count + trend (Needs preparation).
  3. *Awaiting Signature:* Count + trend (Pending completion).
  4. *Active Contracts:* Count + trend.
* **AI Contract Assistant Banner:**
  * Prompt copy + action chips: `[Find missing contracts]`, `[Prioritize overdue signatures]`, `[Draft a reminder]` + execute button.
* **Filter Bar:** Search input + Status select + Assignee select + Advanced filter toggle.
* **Institution Contracts Table:** Checkbox, Institution (name + zone/city), Contract Status badge, Last Update (date + relative time), Assigned Representative (avatar + name + role or compact dash), Management actions (`...`).
* **Pagination:** Item range count and page navigation controls.

### Mobile View
* **Header & App Bar:** Brand icon, notification badge, user profile.
* **Navigation:** Compact scrollable tab selector or bottom bar.
* **KPIs:** 2x2 compact grid cards with icons and delta indicators.
* **AI Assistant:** Collapsible compact card linking to AI recommendation sheet.
* **Filters:** Search bar + horizontal scrollable status filter chips (`[All]`, `[No Contract]`, `[Draft]`, `[Active]`, `[+]`).
* **Institution Cards:** Tactile cards displaying entity name, location, status badge, last update, chevron arrow for detail drawer, and `...` action sheet.

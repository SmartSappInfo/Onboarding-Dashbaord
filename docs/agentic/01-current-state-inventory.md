# Current-State Platform Inventory & Surface Audit (Phase 0)
**Document 01 in the Agentic Architecture Suite**

---

## 1. Executive Summary

An automated AST crawl of `src/` executed in Phase 0 discovered **1,964 active capabilities** across the SmartSapp platform:

| Capability Category | Total Count | Codebase Location |
| :--- | :--- | :--- |
| **Server Actions** | **1,686** | `src/lib/*-actions.ts`, `src/app/actions/*.ts` (297 files) |
| **API Routes** | **96** | `src/app/api/**/route.ts` (84 endpoints) |
| **Genkit AI Flows** | **42** | `src/ai/flows/*.ts` (63 flow files) |
| **Domain Services** | **128** | `src/lib/services/*.ts`, `src/lib/lead-intelligence/**/*.ts` |
| **Portal Studio Blocks** | **12** | `src/lib/page-builder/blocks/portal/*.tsx` |
| **Total Capabilities** | **1,964** | Fully cataloged in `docs/agentic/inventory.json` |

---

## 2. Inventory by Domain

```
General CRM & Operations:     722 capabilities (36.8%)
Forms & Surveys:              169 capabilities (8.6%)
Meetings & Conversations:     121 capabilities (6.2%)
Experience Platform & Portals:116 capabilities (5.9%)
Automation & Workflows:       114 capabilities (5.8%)
Knowledge & Memory:           112 capabilities (5.7%)
Lead Intelligence & SDR:       96 capabilities (4.9%)
Deals & Revenue:               88 capabilities (4.5%)
CRM Contacts & Verticals:      80 capabilities (4.1%)
Identity & Access:             68 capabilities (3.5%)
Media & Creative Studio:       60 capabilities (3.1%)
Communication & Messaging:     55 capabilities (2.8%)
AI Governance & Admin:         41 capabilities (2.1%)
Finance & Subscriptions:       38 capabilities (1.9%)
Tasks & Productivity:          35 capabilities (1.8%)
Analytics & Reporting:         24 capabilities (1.2%)
Campaigns & Marketing:         21 capabilities (1.1%)
Platform Integrations:          4 capabilities (0.2%)
```

---

## 3. Inventory by Risk Classification (Rule 12 & Rule 21)

Every operation has been mapped to a strict risk classification:
* **`L0_READ` (1,211 operations, 61.7%)**: Read-only queries, data filtering, searches, and status checks. Autonomous execution allowed within workspace boundary.
* **`L1_INTERNAL_DRAFT` (63 operations, 3.2%)**: Draft generations, calculation previews, variable simulations, and internal proposal creation.
* **`L2_STATE_MUTATION` (511 operations, 26.0%)**: Internal CRM modifications, contact tag additions, pipeline stage transitions, task creation. Requires delegated authority and TOCTOU optimistic locking.
* **`L3_EXTERNAL_COMMUNICATION_FINANCE` (57 operations, 2.9%)**: Outbound emails, SMS dispatches, WhatsApp messaging, payment collection, invoice finalization. Requires explicit user approval or tightly bounded delegation.
* **`L4_PRIVILEGED_DESTRUCTIVE` (122 operations, 6.2%)**: Document deletion, bulk purging, workspace archival, permission elevation. Mandatory two-phase human confirmation (Rule 21).

---

## 4. Subsystem Audits

### 4.1 Experience Platform & Portals Subsystem
* **Portal Services**: `PortalService`, `PortalMembershipService`, `PortalAccessService`, `CourseService`, `CommunityService`, `CredentialService`, `EnterpriseService`, `EngagementService`, `CommerceService`, `PortalAnalyticsService`.
* **Portal Actions**: `src/app/actions/portal-actions.ts`, `membership-actions.ts`, `learning-actions.ts`, `community-actions.ts`, `credential-actions.ts`, `enterprise-actions.ts`, `commerce-actions.ts`, `engagement-actions.ts`.
* **Portal Studio Blocks**: `ai-tutor`, `membership-status`, `course-list`, `resource-vault`, `upcoming-events`, `portal-search`, `my-tasks`, `related-content`, `community-feed`, `certificates`, `member-profile`, `lesson-list`.

### 4.2 Lead Intelligence & Autonomous SDR Subsystem
* **Engines**: `DeepResearchDossierEngine`, `TechnographicsCategorizer`, `SubdomainProberService`, `ContinuousSignalMonitorService`, `ExplainableScoringEngine`, `AutonomousSDREngine`.
* **Data Sources**: Multi-vendor waterfall enrichment, tech stack fingerprints, hiring signals, LinkedIn public schema signals.

### 4.3 Communication & Omnichannel Messaging Subsystem
* **Providers**: Resend (Email), mNotify (SMS), Meta WhatsApp Cloud API (AES-256 Vault), OneSignal (Push Notifications).
* **Single Source of Truth**: All dynamic variables mapped exclusively through `FieldsVariablesService.resolveTemplateVariables`.

---

## 5. Machine-Readable Export
The full, machine-readable JSON dataset is committed at:
👉 `docs/agentic/inventory.json`

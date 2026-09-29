# Domain Boundaries & Encapsulation Rules (Phase 0)
**Document 03 in the Agentic Architecture Suite**

---

## 1. Architectural Encapsulation Principles

SmartSapp's 17 capability domains must remain cleanly decoupled to prevent architectural degradation:
1. **Interface Segregation**: A domain must expose its capabilities solely via typed `CapabilityDefinition` contracts. Direct internal imports of private repositories, unexported helpers, or low-level database references by outside modules are prohibited.
2. **Asynchronous Cross-Domain Coupling via Events**: When an action in Domain A triggers side effects in Domain B (e.g. Deal Won in `deals_revenue` enrolling a school into an onboarding course in `experience_portal`), Domain A must emit a `DomainEvent`. It must never synchronously invoke Domain B's private internals.
3. **No Database Leaks**: No domain can read or write another domain's private Firestore collections directly.

---

## 2. Inter-Domain Dependency Graph

```
                               ┌─────────────────────────┐
                               │     IDENTITY_ACCESS     │ (Tenant boundary, Auth)
                               └────────────┬────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
            ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
            │ CRM_CONTACTS  │       │KNOWLEDGE_MEMOR│       │EXPERIENCE_PORT│
            └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
                    │                       │                       │
          ┌─────────┴─────────┐             │             ┌─────────┴─────────┐
          ▼                   ▼             │             ▼                   ▼
   DEALS_REVENUE       LEAD_INTEL           │      COMMUNITY_FEED      COURSES/LEARNING
          │                   │             │             │                   │
          └─────────┬─────────┴─────────────┼─────────────┴───────────────────┘
                    ▼                       ▼
          COMMUNICATION_MESSAGING   AUTOMATION_WORKFLOWS
                    │                       │
                    └───────────┬───────────┘
                                ▼
                      FINANCE_SUBSCRIPTIONS
```

---

## 3. Strict Boundary Rules

### 3.1 Experience Platform & Portals (`experience_portal`)
* **Encapsulated Scope**: Portals, Membership tiers, Courses, Lessons, Communities, Digital Credentials, B2B Enterprise seats.
* **Allowed Inbound**:
  - `crm_contacts`: Links student/member identities to contacts via `contactId`.
  - `finance_subscriptions`: Notifies membership payment success to activate access tiers.
* **Prohibited Outbound**:
  - Must not mutate core CRM pipeline stages directly. Emits `portal.course.completed` or `portal.credential.issued` to allow `automation_workflows` to advance stages.

### 3.2 Lead Intelligence & SDR (`lead_intelligence`)
* **Encapsulated Scope**: Scraping, technographics, subdomain probing, signal monitoring, waterfall enrichment.
* **Allowed Outbound**:
  - Writes enriched identity data to `entities` through `crm_contacts.contact.update`.
  - Emits `lead.enriched` and `lead.scored` events.
* **Prohibited Outbound**:
  - Must not trigger outbound email/SMS sends directly. Must hand off to `communication_messaging` or `campaigns_marketing` via human approval gates.

### 3.3 Communication & Messaging (`communication_messaging`)
* **Encapsulated Scope**: Resend, mNotify, WhatsApp Cloud API, OneSignal, template rendering.
* **Single Source of Truth**: Template variable substitution must exclusively route through `FieldsVariablesService`. Custom string replacements are strictly prohibited.
* **Suppression Rule**: Must check recipient suppression before every dispatch.

---

## 4. Boundary Violation Prevention & Linting Rules
Phase 1 introduces dependency-cruiser boundary checks to fail CI builds if cross-domain boundary violations occur.

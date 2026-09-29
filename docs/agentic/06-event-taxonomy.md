# Canonical Event Taxonomy & Observability (Phase 0)
**Document 06 in the Agentic Architecture Suite**

---

## 1. Event Backbone Architecture

In accordance with Phase 2 and Rule 39, SmartSapp operates as a reactive, observable system. Every state change executed by a user, agent, or automated workflow emits an immutable `DomainEvent` with OpenTelemetry tracing headers.

```
┌────────────────────────────────────────────────────────┐
│                      DOMAIN EVENT                      │
│                                                        │
│  id:              UUID v4                              │
│  type:            "domain.entity.action"               │
│  organizationId:  Tenant identifier                    │
│  workspaceId:     Workspace isolation context          │
│  actor:           { type: "user"|"agent", id: "..." }  │
│  entity:          { type: "...", id: "...", version }  │
│  payload:         Structured event data                │
│  correlationId:   OpenTelemetry trace propagation      │
│  causationId:     Parent event ID                      │
│  timestamp:       ISO 8601 UTC                         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Event Taxonomy by Domain

### CRM & Contacts
* `crm.contact.created`
* `crm.contact.updated`
* `crm.contact.tagged`
* `crm.contact.untagged`
* `crm.contact.linked_workspace`

### Experience Platform & Portals
* `portal.created`
* `portal.membership.subscribed`
* `portal.membership.cancelled`
* `portal.course.enrolled`
* `portal.course.lesson_completed`
* `portal.course.completed`
* `portal.credential.issued`
* `portal.community.post_created`
* `portal.event.rsvp_confirmed`

### Deals & Revenue
* `deal.created`
* `deal.stage_changed`
* `deal.value_updated`
* `deal.won`
* `deal.lost`

### Communication & Messaging
* `message.drafted`
* `message.approved`
* `message.sent`
* `message.delivered`
* `message.failed`
* `message.suppressed`

### Lead Intelligence & SDR
* `lead.discovered`
* `lead.enriched`
* `lead.scored`
* `lead.signal_detected`
* `lead.dossier_generated`

### Governance & Agent Runs
* `agent.run.started`
* `agent.run.step_executed`
* `agent.run.approval_requested`
* `agent.run.approval_decided`
* `agent.run.completed`
* `agent.run.failed`

---

## 3. Replay Protection & Dead-Letter Handling (Rules 20 & 25)

* **Replay Protection**: Every event contains an `idempotencyKey` and `correlationId`. Subscribers maintain an execution ledger in Firestore (`event_executions`) to prevent duplicate execution when Cloud Tasks or webhook providers retry deliveries.
* **Dead-Letter Queues (DLQ)**: Events that fail after 3 exponential backoff retries are moved to the Dead-Letter collection (`dead_letter_events`) and surfaced in the Backoffice Security Command Center for operator inspection.

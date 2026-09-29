# SmartSapp Agent-Native UI/UX Architecture (Phase 0)
**Document 13 in the Agentic Architecture Suite**

---

## 1. UX Mental Model: Navigate, Ask, Delegate, Understand

SmartSapp provides four simultaneous interaction modes for every user:
1. **Navigate**: Traditional browsing through lists, tables, pipelines, and portals.
2. **Ask**: Natural language queries via the Global ⌘K Command Bar ("Which deals are at risk?").
3. **Delegate**: Outcome-driven agent tasks with approval checkpoints ("Reconcile payments").
4. **Understand**: Exploring organizational connections through the Context Rail and Knowledge Graph.

---

## 2. The Three-Zone Application Shell

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SMARTSAPP            ⌘K Search or ask anything...               AI • Alerts •   │
├─────────────────┬───────────────────────────────────────────────┬───────────────┤
│ PRIMARY NAV     │               MAIN WORKSPACE                  │ CONTEXT RAIL  │
│                 │                                               │ (Adaptive)    │
│ WORK            │                                               │               │
│   Inbox         │                                               │ AI Insights   │
│   Contacts      │                                               │ Activity Log  │
│   Deals         │                                               │ Knowledge     │
│   Tasks         │                                               │ Connections   │
│   Meetings      │                                               │ Approvals     │
│                 │                                               │               │
│ AUTOMATION      │                                               │               │
│   Workflows     │                                               │               │
│   Runs          │                                               │               │
│                 │                                               │               │
│ INTELLIGENCE    │                                               │               │
│   Company Brain │                                               │               │
│   Knowledge     │                                               │               │
│   Agents / Runs │                                               │               │
│                 │                                               │               │
│ STUDIOS         │                                               │               │
│   Campaigns     │                                               │               │
│   Portals       │                                               │               │
│   Messaging     │                                               │               │
├─────────────────┴───────────────────────────────────────────────┴───────────────┤
│ Persistent AI Agent Activity Drawer (Expandable on demand)                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### The Adaptive Context Rail
The right context rail is **not permanently fixed**. It animates into view smoothly when:
* A contact, deal, or portal member is selected.
* An active agent run is executing steps.
* A human approval is waiting for confirmation.
* Related knowledge or timeline signals are detected.

---

## 3. Tool-Call Cards & Approval Modals

### 3.1 Transparent Tool-Call Card
Every executed tool renders an inspectable card:
```
┌────────────────────────────────────────────────────────┐
│  TOOL EXECUTED: Create Follow-up Task                 │
├────────────────────────────────────────────────────────┤
│  Entity:      Greenfield Academy                       │
│  Assignee:    Joseph                                   │
│  Due Date:    Tomorrow (2026-09-27)                    │
│  Priority:    High                                     │
│                                                        │
│  Reason / Evidence:                                    │
│  Follow-up requested during 2:00 PM zoom meeting.      │
│                                                        │
│  Risk Level:  L1_INTERNAL_DRAFT    Status: Success     │
│  [View Task Details]              [Undo]               │
└────────────────────────────────────────────────────────┘
```

### 3.2 Two-Phase Human Approval Modal (Rule 21 & Rule 22)
For high-impact operations (e.g. sending 1,243 campaign emails):
```
┌────────────────────────────────────────────────────────┐
│  ⚠️ APPROVAL REQUIRED                                  │
├────────────────────────────────────────────────────────┤
│  Action:      Dispatch Campaign: Welcome Onboarding    │
│  Recipients:  1,243 Contacts                           │
│  Channel:     Email (Resend)                           │
│  Est. Cost:   $1.24 USD                                │
│                                                        │
│  Audit Evidence Pack:                                  │
│  • Audience Filter: High-intent leads without notes    │
│  • Suppression Check: 82 suppressed recipients         │
│  • Template Render: FieldsVariablesService verified    │
│                                                        │
│  [Reject Action]     [Edit Parameters]     [Approve]   │
└────────────────────────────────────────────────────────┘
```

---

## 4. Backoffice Agent Control Plane (Rule 61 & 62)

The operator control plane is strictly hosted on `goadmin.smartsapp.com` (`APP_SURFACE=backoffice`):
* **`/backoffice/ai/agents`**: Agent Registry managing active agents, version pinning, allowed capabilities, and budget quotas.
* **`/backoffice/ai/capabilities`**: Capability Catalog inspecting failure rates, latencies, schema versions, and permission requirements.
* **`/backoffice/ai/runs`**: Live Run Center visualizing real-time step timelines and evidence packs.
* **`/backoffice/ai/security`**: Security Command Center displaying alerts for tool poisoning, prompt injection attempts, and SSRF blocks.
* **Emergency Dead-Man Controls (Rule 60)**: One-click "Disable Autonomous Execution" kill-switch modifying Firestore configuration without a code redeployment.

---

## 5. Mobile & Accessibility Standards

* **Touch Targets**: Minimum 44px $\times$ 44px for all buttons, chips, and menu items.
* **Responsive Breakpoints**: Context rail transitions to a bottom sheet drawer on screens $< 768$ px wide.
* **Typography**: Clean, plain everyday English with zero raw stack traces or leaked JSON in user views.

# SmartSapp Master Architecture (Phase 0 Baseline)
**Document 00 in the Agentic Architecture Suite**

---

## 1. The Architectural Destination

SmartSapp transforms from an application where humans manually browse modules and trigger isolated AI helpers into a **governed agentic operating platform**. In this environment, humans, in-app copilots, autonomous agents, and external MCP clients collaborate through a single shared capability and policy layer.

### Rule 69: The Master Axiom
> **Do not build an "AI layer" beside SmartSapp. Build a governed capability layer underneath SmartSapp that both humans and agents use.**

```
                                 USER / OPERATOR
                           Web • Tablet • Mobile • API
                                        │
                                ┌───────▼───────┐
                                │ AI EXPERIENCE │
                                │ Command Bar ⌘K│
                                │ Context Rail  │
                                │ Agent Runs UI │
                                └───────┬───────┘
                                        │
                                ┌───────▼───────┐
                                │ AGENT RUNTIME │
                                │ Genkit Flows  │
                                │ Planner/Budget│
                                └───────┬───────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 │                      │                      │
        ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
        │ POLICY / TRUST  │    │ 3-TIER MEMORY   │    │ DURABLE TASKS   │
        │ Principal Matrix│    │ Context Builder │    │ Cloud Tasks     │
        │ L0-L4 Approvals │    │ Firestore/Qdrant│    │ Checkpoints     │
        └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                 │                      │                      │
                 └──────────────────────┼──────────────────────┘
                                        │
                         CANONICAL CAPABILITY REGISTRY
                         Contracts • Schemas • Telemetry
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
          Native Low-Latency Adapters             Streamable HTTP MCP Servers
          In-App Copilots & Flows                 Claude, Cursor, External Hosts
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                               DOMAIN SERVICES (17)
                     CRM • Experience/Portals • Messaging
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
         Firestore (Truth)      Qdrant (Semantic)      Graph (Relationships)
```

---

## 2. The Cloud Run Serverless Substrate

The platform operates on **Google Cloud Run** using a dual-surface container topology (see `docs/agents_mcp/agents_mcp_cloudrun.md`):
* **`smartsapp-app` (`APP_SURFACE=client`)**: Serves `go.smartsapp.com` for end users, public portal members, and client-facing MCP endpoints.
* **`smartsapp-backoffice` (`APP_SURFACE=backoffice`)**: Serves `goadmin.smartsapp.com` for platform operators, housing the **Agent Control Plane**, Kill Switches, Security Command Center, and Audit Viewers.
* **Stateless Streamable HTTP (MCP `2026-07-28`)**: Replaces sticky SSE with multi-round-trip Streamable HTTP POSTs carrying `Mcp-Transaction-Id` headers.
* **Google Cloud Tasks Workers**: Offloads multi-step agent executions to prevent Cloud Run CPU throttling and cold-kill issues.

---

## 3. The 3-Tier Organizational Memory Architecture

Memory is separated into three complementary layers:
1. **Structured Memory (Firestore)**: Authoritative system of record for entities, deals, portal memberships, courses, invoices, and activity timelines.
2. **Semantic Memory (Qdrant)**: Tenant-isolated vector collections indexing call notes, transcripts, research documents, and customer feedback.
3. **Relationship Memory (Context Graph)**: Models directional associations between schools, contacts, deals, campaigns, meetings, and student enrollments.

---

## 4. The 17 Canonical Domains

1. **Identity & Access** (`identity_access`)
2. **CRM & Contacts** (`crm_contacts`)
3. **Deals & Revenue** (`deals_revenue`)
4. **Knowledge & Memory** (`knowledge_memory`)
5. **Tasks & Productivity** (`tasks_productivity`)
6. **Meetings & Conversations** (`meetings_conversations`)
7. **Communication & Messaging** (`communication_messaging`)
8. **Campaigns & Marketing** (`campaigns_marketing`)
9. **Forms & Surveys** (`forms_surveys`)
10. **Automation & Workflows** (`automation_workflows`)
11. **Media & Creative Studio** (`media_creative`)
12. **Finance & Subscriptions** (`finance_subscriptions`)
13. **Lead Intelligence & SDR** (`lead_intelligence`)
14. **Analytics & Reporting** (`analytics_reporting`)
15. **AI Governance & Administration** (`ai_governance`)
16. **Platform Integrations** (`platform_integrations`)
17. **Experience Platform & Portals** (`experience_portal`)

---

## 5. Strangler Migration & Definition of Done

* **Strangler Pattern**: Existing Server Actions and API routes are never discarded upfront. They are wrapped into canonical capability adapters, tested against baseline regression fixtures, and only deprecated after complete behavioral parity.
* **Verification**: No phase is considered complete merely because TypeScript passes. Every release must satisfy Gate A (Functional), Gate B (Security/Tenancy), Gate C (Agentic discoverability), and Gate D (Automated baseline passing).

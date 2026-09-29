# Canonical Capability Catalog (Phase 0)
**Document 02 in the Agentic Architecture Suite**

---

## 1. Overview & Capability Contract Architecture

In accordance with Section 4 of the Master Roadmap and Rule 69, every business operation in SmartSapp is exposed as a typed **Capability Contract** rather than raw database access or UI-specific server actions.

Each capability contract defines:
* **`id`**: Canonical identifier (e.g. `experience_portal.course.complete_lesson`).
* **`domain`**: One of the 17 platform domains.
* **`risk`**: L0 to L4 classification with idempotency and human-approval metadata.
* **`inputSchema` / `outputSchema`**: Strict Zod schemas (zero `any`).
* **`policies`**: TOCTOU version requirements, idempotency keys, and audit rules.

---

## 2. Master Domain Taxonomy & Representative Capabilities

### Domain 01: Identity, Organization & Access (`identity_access`)
* `identity.get_current_actor`: Resolves authenticated user or agent principal. (Risk: `L0_READ`)
* `organization.get_details`: Retrieves organization settings and branding. (Risk: `L0_READ`)
* `workspace.list_active`: Lists workspaces accessible by the actor. (Risk: `L0_READ`)
* `workspace.switch_active`: Sets active workspace context. (Risk: `L0_READ`)
* `permission.evaluate`: Evaluates actor authority against target action. (Risk: `L0_READ`)
* `agent.register_delegation`: Binds a temporary delegated authority token. (Risk: `L2_STATE_MUTATION`)

### Domain 02: CRM, Contacts & Verticals (`crm_contacts`)
* `contact.search`: Polymorphic query across `entities` and `workspace_entities`. (Risk: `L0_READ`)
* `contact.get_by_id`: Retrieves full contact record with industry data. (Risk: `L0_READ`)
* `contact.create`: Polymorphically creates entity with vertical validation. (Risk: `L2_STATE_MUTATION`)
* `contact.update`: Updates identity or custom fields with TOCTOU lock. (Risk: `L2_STATE_MUTATION`)
* `contact.link_to_workspace`: Associates entity with workspace and initial stage. (Risk: `L2_STATE_MUTATION`)
* `contact.apply_tag`: Applies scoped workspace tag via `tag-actions.ts`. (Risk: `L2_STATE_MUTATION`)
* `contact.remove_tag`: Removes tag via `tag-actions.ts`. (Risk: `L2_STATE_MUTATION`)

### Domain 03: Deals, Pipelines & Revenue (`deals_revenue`)
* `deal.search`: Queries active deals by stage, owner, and value. (Risk: `L0_READ`)
* `deal.get_by_id`: Retrieves deal record with line items and history. (Risk: `L0_READ`)
* `deal.create`: Opens new opportunity in target pipeline. (Risk: `L2_STATE_MUTATION`)
* `deal.advance_stage`: Transitions deal stage, validating entry/exit criteria. (Risk: `L2_STATE_MUTATION`)
* `deal.update_value`: Modifies financial value with audit trace. (Risk: `L2_STATE_MUTATION`)
* `deal.mark_won`: Closes deal as won, triggering downstream onboarding. (Risk: `L2_STATE_MUTATION`)
* `deal.mark_lost`: Closes deal as lost with mandatory loss reason. (Risk: `L2_STATE_MUTATION`)

### Domain 04: Organization Knowledge & Memory (`knowledge_memory`)
* `memory.search_semantic`: Hybrid vector search across Qdrant and Firestore. (Risk: `L0_READ`)
* `memory.get_context_graph`: Traverses relationship graph around an entity. (Risk: `L0_READ`)
* `note.create`: Saves quick note or meeting memo with provenance. (Risk: `L1_INTERNAL_DRAFT`)
* `memory.propose_insight`: Proposes AI-extracted fact for human review. (Risk: `L1_INTERNAL_DRAFT`)
* `memory.consolidate`: Merges related memory nodes and resolves contradictions. (Risk: `L2_STATE_MUTATION`)

### Domain 05: Tasks & Productivity (`tasks_productivity`)
* `task.search`: Filters tasks by assignee, due date, priority, and entity. (Risk: `L0_READ`)
* `task.create`: Creates action item linked to contact/deal. (Risk: `L1_INTERNAL_DRAFT`)
* `task.complete`: Marks task resolved, logging duration and outcome. (Risk: `L2_STATE_MUTATION`)
* `reminder.schedule`: Sets scheduled notification alert. (Risk: `L2_STATE_MUTATION`)

### Domain 06: Meetings & Conversations (`meetings_conversations`)
* `meeting.search_calendar`: Queries upcoming bookings and availability. (Risk: `L0_READ`)
* `meeting.get_dossier`: Assembles pre-meeting intelligence briefing. (Risk: `L0_READ`)
* `meeting.book`: Reserves calendar slot via public booking client. (Risk: `L2_STATE_MUTATION`)
* `meeting.reschedule`: Moves meeting time and notifies attendees. (Risk: `L2_STATE_MUTATION`)
* `meeting.process_transcript`: Ingests audio transcript, extracting actions. (Risk: `L1_INTERNAL_DRAFT`)

### Domain 07: Communication & Omnichannel Messaging (`communication_messaging`)
* `message.preview_template`: Renders template tokens via `FieldsVariablesService`. (Risk: `L1_INTERNAL_DRAFT`)
* `message.send_email`: Dispatches email via Resend with delivery tracking. (Risk: `L3_EXTERNAL_COMMUNICATION_FINANCE`)
* `message.send_sms`: Dispatches SMS via mNotify with balance check. (Risk: `L3_EXTERNAL_COMMUNICATION_FINANCE`)
* `message.send_whatsapp`: Sends WhatsApp template via Meta Cloud API. (Risk: `L3_EXTERNAL_COMMUNICATION_FINANCE`)
* `message.check_suppression`: Verifies recipient opt-out / hygiene status. (Risk: `L0_READ`)

### Domain 08: Campaigns & Marketing (`campaigns_marketing`)
* `campaign.preview_audience`: Evaluates segment filters and suppression rules. (Risk: `L1_INTERNAL_DRAFT`)
* `campaign.create`: Initializes draft campaign journey. (Risk: `L1_INTERNAL_DRAFT`)
* `campaign.schedule_launch`: Submits campaign for human approval (Rule 21). (Risk: `L3_EXTERNAL_COMMUNICATION_FINANCE`)
* `campaign.pause`: Immediately stops pending dispatch queues. (Risk: `L2_STATE_MUTATION`)

### Domain 09: Forms, Surveys & Public Pages (`forms_surveys`)
* `survey.get_structure`: Retrieves question blocks and logic branch trees. (Risk: `L0_READ`)
* `survey.submit_response`: Ingests public survey submission. (Risk: `L2_STATE_MUTATION`)
* `survey.analyze_sentiment`: AI analysis of open-ended survey themes. (Risk: `L0_READ`)
* `form.generate_ai`: Synthesizes form schema from natural language prompt. (Risk: `L1_INTERNAL_DRAFT`)

### Domain 10: Automation & Workflow Engine (`automation_workflows`)
* `workflow.evaluate_trigger`: Tests event payload against condition map. (Risk: `L0_READ`)
* `workflow.execute_step`: Advances state machine to next node. (Risk: `L2_STATE_MUTATION`)
* `call_centre.traverse_node`: Moves through call script decision graph. (Risk: `L0_READ`)
* `workflow.cancel_run`: Cancels running workflow with compensation (Rule 26 & 27). (Risk: `L2_STATE_MUTATION`)

### Domain 11: Media & Creative Studio (`media_creative`)
* `media.generate_thumbnail`: Synthesizes image thumbnail with text styling. (Risk: `L1_INTERNAL_DRAFT`)
* `qr.generate_code`: Creates branded dynamic QR code with link tracking. (Risk: `L2_STATE_MUTATION`)
* `page.publish`: Publishes landing page to public URL. (Risk: `L3_EXTERNAL_COMMUNICATION_FINANCE`)

### Domain 12: Finance & Subscriptions (`finance_subscriptions`)
* `invoice.search`: Queries invoices by status, customer, and aging. (Risk: `L0_READ`)
* `invoice.generate_statement`: Assembles PDF customer account statement. (Risk: `L1_INTERNAL_DRAFT`)
* `payment.reconcile`: Matches incoming transaction with open invoice. (Risk: `L3_EXTERNAL_COMMUNICATION_FINANCE`)
* `billing.modify_profile`: Updates payment gateway configuration. (Risk: `L4_PRIVILEGED_DESTRUCTIVE`)

### Domain 13: Lead Intelligence & SDR (`lead_intelligence`)
* `lead.enrich_waterfall`: Executes multi-vendor firmographic enrichment. (Risk: `L2_STATE_MUTATION`)
* `lead.probe_subdomains`: Scrapes technographic fingerprints and DNS. (Risk: `L0_READ`)
* `lead.calculate_score`: Generates explainable intent score. (Risk: `L0_READ`)
* `lead.generate_dossier`: Compiles comprehensive executive briefing. (Risk: `L1_INTERNAL_DRAFT`)

### Domain 14: Analytics & Reporting (`analytics_reporting`)
* `analytics.get_kpis`: Computes workspace health and funnel metrics. (Risk: `L0_READ`)
* `analytics.attribution_report`: Measures marketing campaign ROI. (Risk: `L0_READ`)

### Domain 15: AI Governance & Administration (`ai_governance`)
* `governance.request_approval`: Registers two-phase human confirmation request. (Risk: `L1_INTERNAL_DRAFT`)
* `governance.review_decision`: Records human approval or rejection. (Risk: `L2_STATE_MUTATION`)
* `governance.audit_log`: Queries tamper-evident decision trace. (Risk: `L0_READ`)

### Domain 16: Platform Integrations & Background Jobs (`platform_integrations`)
* `tasks.enqueue_step`: Dispatches async worker job to Google Cloud Tasks. (Risk: `L2_STATE_MUTATION`)
* `webhook.deliver`: Transmits signed outbound payload via Svix. (Risk: `L3_EXTERNAL_COMMUNICATION_FINANCE`)

### Domain 17: Experience Platform & Portals (`experience_portal`)
* `portal.get_details`: Retrieves portal configuration, theme, and navigation. (Risk: `L0_READ`)
* `portal.verify_access`: Checks member entitlements and subscription status. (Risk: `L0_READ`)
* `portal.membership.create_plan`: Configures membership tier and billing terms. (Risk: `L2_STATE_MUTATION`)
* `portal.membership.subscribe`: Enrolls member into active membership plan. (Risk: `L3_EXTERNAL_COMMUNICATION_FINANCE`)
* `portal.course.get_curriculum`: Retrieves modules, lessons, and video assets. (Risk: `L0_READ`)
* `portal.course.complete_lesson`: Records student progress and quiz score. (Risk: `L2_STATE_MUTATION`)
* `portal.credential.issue`: Generates verifiable digital certificate/credential. (Risk: `L2_STATE_MUTATION`)
* `portal.community.create_post`: Publishes member discussion post or question. (Risk: `L2_STATE_MUTATION`)
* `portal.event.rsvp`: Processes ticket registration for upcoming live event. (Risk: `L2_STATE_MUTATION`)
* `portal.enterprise.allocate_seats`: B2B enterprise organization seat allocation. (Risk: `L2_STATE_MUTATION`)
* `portal.ai_tutor.query`: Context-aware AI learning assistance on course lessons. (Risk: `L0_READ`)

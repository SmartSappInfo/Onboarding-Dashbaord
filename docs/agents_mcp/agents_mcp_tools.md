# SmartSapp MCP & Agent Tool Architecture 2.0

The key is to design a complete, governed tool ecosystem for SmartSapp—not just a list of MCP functions. Your agents need a reliable way to discover what they can do, retrieve the right organizational context, execute existing business operations, collaborate through shared knowledge, and safely perform actions across the CRM.

Given your existing architecture—Next.js, TypeScript, Firebase/Firestore, Genkit, the dual-tier `entities` and `workspace_entities` model, the Prompt Management System, and the existing AI services—the goal should be to expose existing capabilities through a governed tool layer rather than rebuild them inside agents.

I recommend treating this as six connected layers:

## 1. Agent Experience Layer

Ask Nexus · SDR Agent · Deal Coach · Meeting Agent · Campaign Agent

### 2. Agent Orchestration Layer

Planning · Routing · Context assembly · State · Handoffs · Approval gates

### 3. MCP & Internal Tool Registry

Discovery · Typed contracts · Validation · Authorization · Execution policies

### 4. Domain Service Layer

CRM · Knowledge & Memory · Messaging · Campaigns · Meetings · Finance · Automation

### 5. Context & Data Layer

Firestore · Qdrant · Knowledge Graph · Search indexes · Event history

### 6. Governance & Observability

Tenant isolation · RBAC · Audit logs · Budgets · Approvals · Evaluations · Kill switches

One distinction is important: MCP tools, agent tools, and workflow actions are not necessarily the same thing.

* MCP tools expose capabilities through the Model Context Protocol to compatible clients.

* Agent tools are the typed functions an in-app agent can invoke. They may call internal services directly without an MCP network round trip.

* Workflow actions are deterministic steps executed by SmartSapp's automation or orchestration engine. They may invoke the same underlying domain services.

All three should use shared business logic and authorization. Do not create three independent implementations of the same operation.


# 1. The master tool taxonomy

I recommend organizing SmartSapp's tools into 16 domains, with a shared execution framework underneath them.

Do not interpret this as a requirement to create hundreds of public MCP tools immediately. It is the complete capability map from which the in-app agent registry and externally exposed MCP toolsets should be built.

#### 01

Identity & access

Organizations, workspaces, users, roles, permissions

#### 02

CRM & contacts

Entities, contacts, pipelines, stages, activities

#### 03

Deals & revenue

Opportunities, line items, products, forecasting

#### 04

Organization Knowledge & Memory

Notes, shared memory, retrieval, provenance, graph

#### 05

Tasks & productivity

Tasks, reminders, assignments, priorities

#### 06

Meetings & conversations

Scheduling, preparation, transcripts, follow-ups

#### 07

Communication & messaging

Email, SMS, WhatsApp, templates, approvals

#### 08

Campaigns & marketing

Campaign planning, audiences, journeys, attribution

#### 09

Forms & surveys

Builders, submissions, scoring, sentiment, analytics

#### 10

Automation & workflows

Triggers, graph validation, execution, retries

#### 11

Media & creative studio

Social content, pages, thumbnails, QR codes, assets

#### 12

Finance & subscriptions

Invoices, payments, billing, collections, entitlements

#### 13

Lead intelligence & SDR

Enrichment, scoring, research, outreach preparation

#### 14

Analytics & reporting

Metrics, attribution, reporting, business questions

#### 15

AI governance & administration

Action proposals, access reviews, approvals, audits

#### 16

Platform integrations

External APIs, webhooks, calendars, connected services

Each domain should have a capability manifest that tells the system:

* Which tools exist and what they do.

* Which agent roles may use them.

* Which permissions and scopes they require.

* Whether they read data, create drafts, mutate records, or perform external side effects.

* Whether they require user confirmation or multiple approvers.

* Which context must be retrieved before execution.

* Which existing service implements the operation.

* How the operation is tested, audited, retried, and versioned.

MCP already provides discovery for tools, resources, and prompts. SmartSapp should build its own richer policy-aware registry on top of that foundation.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+2

# 2. The complete tool catalog

The catalog below is the proposed target inventory. Names are illustrative API contracts, not a claim that every function already exists in the codebase.

## Domain 1 — Identity, organization and access

Purpose: Establish the authenticated identity and the exact organizational boundary in which an agent operates.

|
Tool

|

Operation

|
| --- | --- |
|

`identity.get_current_actor`

|

Resolve the authenticated user or service identity

|
|

`organization.get_current`

|

Retrieve the active organization

|
|

`organization.get_details`

|

Retrieve permitted organization settings

|
|

`workspace.list_accessible`

|

List workspaces the actor can access

|
|

`workspace.get_details`

|

Retrieve workspace configuration and terminology

|
|

`access.check_permission`

|

Evaluate a specific permission

|
|

`access.list_effective_permissions`

|

Return the actor's effective permissions

|
|

`access.check_tool_policy`

|

Determine whether a tool is allowed for this actor and context

|
|

`access.request_elevation`

|

Request temporary additional privileges through an approved process

|

Critical design rule: Agents must not be allowed to choose an arbitrary `organizationId` or `workspaceId` and thereby gain access. The execution layer must resolve and validate those identifiers against the authenticated actor's grants.

Keep authorization checks in the service layer, even when the orchestration layer has already checked them.

## Domain 2 — CRM, contacts and entity relationships

This domain is the main operational interface for the CRM.

|
Tool

|

Operation

|
| --- | --- |
|

`crm.entity.search`

|

Search the permitted entity population

|
|

`crm.entity.get`

|

Read the global identity master

|
|

`crm.entity.create`

|

Create a global entity

|
|

`crm.entity.update`

|

Update permitted identity fields

|
|

`crm.entity.find_duplicates`

|

Identify possible duplicate entities

|
|

`crm.entity.propose_merge`

|

Prepare a merge proposal

|
|

`crm.entity.merge`

|

Execute an approved merge

|
|

`crm.workspace_entity.get`

|

Read workspace-specific CRM state

|
|

`crm.workspace_entity.create`

|

Add an entity to a workspace

|
|

`crm.workspace_entity.update`

|

Update workspace-specific fields

|
|

`crm.workspace_entity.archive`

|

Archive the workspace relationship

|
|

`crm.entity.get_timeline`

|

Retrieve permitted activity history

|
|

`crm.entity.summarize_history`

|

Summarize notes, interactions and next steps

|
|

`crm.entity.add_note`

|

Add a note through the canonical note service

|
|

`crm.entity.add_tag`

|

Add a workspace tag

|
|

`crm.entity.remove_tag`

|

Remove a workspace tag

|
|

`crm.entity.assign_owner`

|

Change an authorized assignment

|
|

`crm.entity.get_relationships`

|

Retrieve linked contacts, deals and activities

|
|

`crm.pipeline.list`

|

List accessible pipelines

|
|

`crm.pipeline.get`

|

Read stages and pipeline configuration

|
|

`crm.pipeline.get_metrics`

|

Retrieve pipeline metrics

|
|

`crm.stage.propose_transition`

|

Validate and propose a stage change

|
|

`crm.stage.transition`

|

Execute a permitted stage transition

|
|

`crm.activity.create`

|

Record an activity

|

### Preserve the dual-tier data model

For SmartSapp, the tool layer must distinguish:

* `entities`: the platform/organization-level identity master.

* `workspace_entities`: the operational CRM record for a particular workspace, using the existing `${workspaceId}_${entityId}` key convention.

A stage, assignment, tag, or pipeline update must target the appropriate workspace record. Do not accidentally mutate global identity data when an operation concerns only one department.

## Domain 3 — Deals, products and revenue operations

|
Tool

|

Operation

|
| --- | --- |
|

`deal.search`

|

Search accessible opportunities

|
|

`deal.get`

|

Retrieve deal details

|
|

`deal.create`

|

Create a deal

|
|

`deal.update`

|

Update permitted deal fields

|
|

`deal.get_line_items`

|

Retrieve products and pricing

|
|

`deal.add_line_item`

|

Add a line item

|
|

`deal.update_line_item`

|

Update quantity, discount or other permitted values

|
|

`deal.remove_line_item`

|

Remove a line item

|
|

`deal.get_stage_history`

|

Inspect stage progression

|
|

`deal.get_intelligence`

|

Run existing deal intelligence

|
|

`deal.get_risks`

|

Retrieve or derive deal risks

|
|

`deal.get_next_best_actions`

|

Generate prioritized recommended actions

|
|

`deal.create_followup_tasks`

|

Propose or create follow-up tasks

|
|

`deal.propose_stage_change`

|

Validate a potential stage change

|
|

`deal.advance_stage`

|

Execute a valid transition

|
|

`deal.get_forecast`

|

Retrieve supported revenue forecast data

|
|

`catalog.search_products`

|

Search the permitted product catalog

|
|

`catalog.get_product`

|

Retrieve product and package details

|
|

`revenue.get_attribution`

|

Retrieve source attribution

|

Use the existing `deal-actions.ts`, `deal-ai-actions.ts`, line-item services and revenue-attribution engine wherever their current behavior meets the contract.

Do not let an LLM independently calculate authoritative invoice totals, taxes, discounts, or recognized revenue. Use deterministic financial services and treat model-generated forecasts as estimates.

## Domain 4 — Organization Knowledge & Memory 2.0

This is the shared intelligence layer connecting CRM history, notes, meetings, campaigns, documents, and agent work.

## Memory tool families

A. Search and retrieval

Find relevant notes, knowledge, memories, documents and graph connections.

B. Capture and ingestion

Ingest notes, meeting outcomes, files, approved insights and structured facts.

C. Memory management

Create, update, supersede, archive, expire and restore memories.

D. Knowledge graph

Retrieve entities, relationships, paths, evidence and neighborhood context.

E. Governance

Review proposed memories, resolve conflicts, apply access policies and audit changes.

F. Context assembly

Build a bounded, relevant, source-attributed context package for each agent run.

### A. Search and retrieval

|
Tool

|

Operation

|
| --- | --- |
|

`knowledge.search`

|

Hybrid search across authorized knowledge sources

|
|

`knowledge.search_notes`

|

Search notes using lexical and semantic retrieval

|
|

`knowledge.search_documents`

|

Search indexed documents

|
|

`knowledge.search_meetings`

|

Retrieve relevant meeting records or transcript passages

|
|

`knowledge.search_decisions`

|

Find past decisions and their rationale

|
|

`knowledge.search_playbooks`

|

Retrieve approved procedures and operating guidance

|
|

`knowledge.get_item`

|

Retrieve a particular knowledge item

|
|

`knowledge.get_source`

|

Retrieve the originating note, document or record

|
|

`knowledge.get_evidence`

|

Retrieve supporting source passages

|
|

`knowledge.get_citations`

|

Return source references and relevant spans

|
|

`knowledge.get_related_items`

|

Retrieve related knowledge by explicit links or graph traversal

|
|

`knowledge.get_recent_changes`

|

Retrieve recent additions, corrections and supersessions

|

### B. Capture and ingestion

|
Tool

|

Operation

|
| --- | --- |
|

`knowledge.ingest_text`

|

Submit text for classification and ingestion

|
|

`knowledge.ingest_document`

|

Submit an authorized document for processing

|
|

`knowledge.ingest_meeting_outcome`

|

Capture meeting outcomes and action items

|
|

`knowledge.capture_observation`

|

Record a candidate observation from an agent run

|
|

`knowledge.propose_memory`

|

Submit a durable memory candidate for review

|
|

`knowledge.propose_fact`

|

Submit a structured claim with evidence

|
|

`knowledge.propose_decision`

|

Capture a decision, owner, date and rationale

|
|

`knowledge.propose_procedure`

|

Propose reusable procedural knowledge

|
|

`knowledge.extract_entities`

|

Extract references to people, organizations, deals and topics

|
|

`knowledge.classify_item`

|

Classify content, sensitivity, scope and retention category

|
|

`knowledge.check_duplicate`

|

Identify duplicate or substantially overlapping knowledge

|

### C. Memory lifecycle and maintenance

|
Tool

|

Operation

|
| --- | --- |
|

`memory.search`

|

Search durable organizational memories

|
|

`memory.get`

|

Retrieve a memory and its metadata

|
|

`memory.propose_update`

|

Suggest a change to an existing memory

|
|

`memory.approve`

|

Approve a pending memory when authorized

|
|

`memory.reject`

|

Reject a proposed memory

|
|

`memory.supersede`

|

Mark an older memory as replaced by a newer one

|
|

`memory.archive`

|

Archive a memory under policy

|
|

`memory.restore`

|

Restore an archived memory when permitted

|
|

`memory.get_history`

|

Inspect memory versions and state changes

|
|

`memory.resolve_conflict`

|

Resolve competing claims through an authorized review

|
|

`memory.review_expiry`

|

Identify memories due for review or expiry

|
|

`memory.record_feedback`

|

Record corrections, usefulness feedback or disputes

|

### D. Knowledge graph

|
Tool

|

Operation

|
| --- | --- |
|

`knowledge_graph.get_entity`

|

Retrieve a graph entity

|
|

`knowledge_graph.search_entities`

|

Search graph nodes

|
|

`knowledge_graph.get_neighbors`

|

Retrieve directly connected nodes

|
|

`knowledge_graph.get_relationships`

|

Retrieve permitted edges

|
|

`knowledge_graph.find_path`

|

Find a bounded relationship path

|
|

`knowledge_graph.query_subgraph`

|

Retrieve a bounded subgraph around a subject

|
|

`knowledge_graph.propose_relationship`

|

Propose a relationship with evidence

|
|

`knowledge_graph.approve_relationship`

|

Approve a relationship if authorized

|
|

`knowledge_graph.get_provenance`

|

Trace a node or edge to supporting sources

|
|

`knowledge_graph.flag_inconsistency`

|

Record conflicting graph facts

|
|

`knowledge_graph.rebuild_projection`

|

Request an authorized graph projection rebuild

|

### E. Context Builder

These tools connect memory to the actual agent runtime.

|
Tool

|

Operation

|
| --- | --- |
|

`context.build`

|

Assemble relevant context for a specific task

|
|

`context.get_entity_brief`

|

Produce a bounded contact or organization briefing

|
|

`context.get_deal_brief`

|

Assemble deal history, risks and relevant knowledge

|
|

`context.get_meeting_brief`

|

Assemble meeting history, objectives and open actions

|
|

`context.get_campaign_brief`

|

Retrieve campaign goals, audience, brand rules and evidence

|
|

`context.get_agent_memory`

|

Retrieve permitted agent-specific working context

|
|

`context.get_shared_memory`

|

Retrieve permitted organizational memory

|
|

`context.get_policy_context`

|

Retrieve applicable instructions and approved policies

|
|

`context.explain_inclusion`

|

Explain why a source was included

|
|

`context.validate_scope`

|

Verify the assembled context's authorization and scope

|

### F. Memory governance and evaluation

|
Tool

|

Operation

|
| --- | --- |
|

`knowledge.review_queue.list`

|

List pending items within the reviewer’s scope

|
|

`knowledge.review_queue.get`

|

Inspect a proposed item and its evidence

|
|

`knowledge.review_queue.decide`

|

Approve, reject or request changes

|
|

`knowledge.access.check`

|

Check whether a user or agent may retrieve an item

|
|

`knowledge.retention.evaluate`

|

Determine the applicable retention policy

|
|

`knowledge.audit.search`

|

Search authorized knowledge audit events

|
|

`knowledge.quality.evaluate`

|

Evaluate evidence coverage, duplication and freshness

|
|

`knowledge.reindex.request`

|

Request a controlled index refresh

|
|

`knowledge.export.request`

|

Request an authorized export

|
|

`knowledge.deletion.request`

|

Request policy-governed deletion

|

Important: Search results are not permission grants. Authorization must apply to each returned item and its source before it is included in a context package.

Also, do not expose unrestricted graph queries, arbitrary Firestore queries, or raw vector-database operations as general-purpose agent tools. Expose constrained, domain-aware operations instead.

## Domain 5 — Tasks and productivity

|
Tool

|

Operation

|
| --- | --- |
|

`task.search`

|

Search permitted tasks

|
|

`task.get`

|

Retrieve a task

|
|

`task.create`

|

Create a task

|
|

`task.update`

|

Update permitted task fields

|
|

`task.assign`

|

Assign a task

|
|

`task.complete`

|

Mark a task complete

|
|

`task.cancel`

|

Cancel a task

|
|

`task.add_comment`

|

Add a task comment

|
|

`task.set_due_date`

|

Change the due date

|
|

`task.create_reminder`

|

Create a reminder

|
|

`task.get_overdue`

|

Retrieve overdue tasks

|
|

`task.get_my_priorities`

|

Retrieve a user's prioritized task list

|
|

`task.propose_batch_update`

|

Prepare a batch change for review

|

Every task created by an agent should include its origin, such as a meeting action item, deal recommendation, campaign plan or user instruction. Use idempotency keys to prevent duplicate tasks during retries.

## Domain 6 — Meetings and conversation intelligence

|
Tool

|

Operation

|
| --- | --- |
|

`meeting.search`

|

Search permitted meetings

|
|

`meeting.get`

|

Retrieve meeting details

|
|

`meeting.create`

|

Create a meeting

|
|

`meeting.update`

|

Update meeting details

|
|

`meeting.check_availability`

|

Check calendar availability

|
|

`meeting.propose_booking`

|

Prepare a booking

|
|

`meeting.confirm_booking`

|

Confirm a booking when authorized

|
|

`meeting.cancel`

|

Cancel a meeting

|
|

`meeting.generate_prep_brief`

|

Assemble pre-meeting context

|
|

`meeting.ingest_transcript`

|

Process an authorized transcript

|
|

`meeting.summarize`

|

Generate a meeting summary

|
|

`meeting.extract_action_items`

|

Extract structured follow-ups

|
|

`meeting.create_followup_tasks`

|

Create idempotent tasks from action items

|
|

`meeting.analyze_coaching`

|

Analyze communication metrics

|
|

`meeting.capture_decisions`

|

Propose decisions for shared memory

|
|

`meeting.link_to_crm`

|

Link the meeting to relevant CRM records

|

Recording consent, transcript permissions and access to sensitive meeting content must be enforced before ingestion or retrieval.

## Domain 7 — Messaging and communications

Separate content creation from actual dispatch.

|
Tool

|

Operation

|
| --- | --- |
|

`message.search_templates`

|

Find approved templates

|
|

`message.get_template`

|

Retrieve a template

|
|

`message.generate_draft`

|

Generate channel-specific copy

|
|

`message.refine_draft`

|

Improve existing copy

|
|

`message.validate_variables`

|

Validate template variables

|
|

`message.preview`

|

Render a message using authorized data

|
|

`message.check_compliance`

|

Check applicable channel and consent rules

|
|

`message.create_draft`

|

Save a draft

|
|

`message.request_approval`

|

Submit a draft for approval

|
|

`message.get_approval_status`

|

Check approval state

|
|

`message.schedule`

|

Schedule an approved message

|
|

`message.send`

|

Dispatch an authorized message

|
|

`message.get_delivery_status`

|

Retrieve delivery status

|
|

`message.get_engagement`

|

Retrieve available engagement data

|
|

`message.get_unsubscribe_status`

|

Check suppression status

|
|

`message.unsubscribe_contact`

|

Apply an authorized suppression

|
|

`message.cancel_scheduled`

|

Cancel a pending scheduled message

|

Enforce the existing Zero-Silent-Send principle. AI-generated copy must not silently become a sent message.

All template variable resolution must use `FieldsVariablesService.resolveTemplateVariables`, not a second implementation of `{{variable}}` replacement.

## Domain 8 — Campaigns and marketing intelligence

|
Tool

|

Operation

|
| --- | --- |
|

`campaign.search`

|

Search campaigns

|
|

`campaign.get`

|

Retrieve campaign details

|
|

`campaign.create_draft`

|

Create a campaign draft

|
|

`campaign.update_draft`

|

Update a draft

|
|

`campaign.get_performance`

|

Retrieve campaign metrics

|
|

`campaign.get_attribution`

|

Retrieve available conversion attribution

|
|

`campaign.get_audience`

|

Retrieve an authorized audience definition

|
|

`campaign.propose_audience`

|

Propose an audience

|
|

`campaign.validate_audience`

|

Check audience eligibility and exclusions

|
|

`campaign.generate_strategy`

|

Generate a campaign strategy

|
|

`campaign.generate_assets`

|

Generate campaign copy and creative briefs

|
|

`campaign.generate_journey`

|

Propose a multistep journey

|
|

`campaign.simulate`

|

Evaluate a proposed campaign or journey

|
|

`campaign.request_launch_approval`

|

Request launch approval

|
|

`campaign.launch`

|

Launch an approved campaign

|
|

`campaign.pause`

|

Pause a running campaign

|
|

`campaign.get_recommendations`

|

Generate optimization recommendations

|
|

`campaign.record_outcome`

|

Record a verified outcome

|

Campaign Intelligence should call these tools alongside Knowledge & Memory retrieval. For example, a campaign agent should retrieve approved brand voice, prior campaign outcomes, audience evidence, and current objectives before drafting its strategy.

## Domain 9 — Forms and surveys

|
Tool

|

Operation

|
| --- | --- |
|

`form.search`

|

Search forms

|
|

`form.get`

|

Retrieve a form

|
|

`form.generate`

|

Generate a form structure

|
|

`form.modify`

|

Propose form modifications

|
|

`form.validate`

|

Validate fields and logic

|
|

`form.audit_friction`

|

Audit completion friction

|
|

`form.get_submissions`

|

Retrieve authorized submissions

|
|

`form.classify_submission`

|

Classify an individual submission

|
|

`form.cluster_topics`

|

Cluster submission themes

|
|

`form.map_pdf_fields`

|

Detect PDF field locations

|
|

`survey.generate_blueprint`

|

Generate a survey blueprint

|
|

`survey.generate_questions`

|

Generate survey questions

|
|

`survey.generate_logic`

|

Generate conditional logic

|
|

`survey.modify`

|

Propose survey edits

|
|

`survey.audit_quality`

|

Evaluate survey quality

|
|

`survey.detect_anomalies`

|

Analyze response anomalies

|
|

`survey.analyze_sentiment`

|

Identify sentiment and themes

|
|

`survey.query_analytics`

|

Answer questions about aggregate survey data

|
|

`survey.generate_report`

|

Produce an executive report

|
|

`survey.generate_messaging`

|

Generate survey invitation and reminder drafts

|

Reuse the existing survey, form and PDF Genkit flows. Enforce respondent-level permissions and redact sensitive fields before sending data to models.

## Domain 10 — Automation and workflow execution

This domain is particularly important because SmartSapp already has a visual automation engine.

|
Tool

|

Operation

|
| --- | --- |
|

`automation.search`

|

Search accessible workflows

|
|

`automation.get`

|

Retrieve workflow configuration

|
|

`automation.generate_draft`

|

Generate a workflow from instructions

|
|

`automation.validate_graph`

|

Validate node connectivity and types

|
|

`automation.validate_permissions`

|

Validate actions against required permissions

|
|

`automation.simulate`

|

Simulate execution without side effects

|
|

`automation.create_draft`

|

Save a draft workflow

|
|

`automation.request_activation`

|

Request activation approval

|
|

`automation.activate`

|

Activate an approved workflow

|
|

`automation.pause`

|

Pause execution

|
|

`automation.resume`

|

Resume a paused workflow

|
|

`automation.enroll_entity`

|

Enroll a record in a workflow

|
|

`automation.get_run`

|

Retrieve execution state

|
|

`automation.get_run_logs`

|

Retrieve authorized execution logs

|
|

`automation.retry_step`

|

Retry a failed step under policy

|
|

`automation.cancel_run`

|

Cancel a running workflow

|
|

`automation.reconcile_run`

|

Reconcile execution state

|
|

`automation.get_dead_letters`

|

Retrieve failed items requiring intervention

|

Keep durable execution state in the workflow engine, not in the LLM conversation. Delays, retries, scheduled work and recovery should remain deterministic and observable.

## Domain 11 — Media, creative and content studio

|
Tool

|

Operation

|
| --- | --- |
|

`creative.generate_concepts`

|

Generate creative concepts

|
|

`creative.generate_copy_variants`

|

Generate copy alternatives

|
|

`creative.get_brand_profile`

|

Retrieve the approved brand profile

|
|

`creative.generate_visual_style`

|

Generate a visual style configuration

|
|

`creative.modify_canvas`

|

Propose canvas modifications

|
|

`creative.generate_thumbnail`

|

Generate a thumbnail composition

|
|

`creative.modify_thumbnail`

|

Modify a thumbnail layout

|
|

`creative.generate_qr_design`

|

Generate a QR design configuration

|
|

`creative.generate_social_variants`

|

Generate platform-specific copy

|
|

`creative.generate_page_draft`

|

Generate a landing page structure

|
|

`creative.modify_page`

|

Propose changes to a page

|
|

`creative.generate_seo_metadata`

|

Generate SEO metadata

|
|

`creative.get_asset_metadata`

|

Retrieve asset metadata

|
|

`creative.search_assets`

|

Find relevant assets

|
|

`creative.request_publish_approval`

|

Submit content for approval

|
|

`creative.publish`

|

Publish approved content where integrations permit

|

The creative tools should return structured canvas or document mutations, not arbitrary executable frontend code.

## Domain 12 — Finance, subscriptions and payments

Financial tools need stronger permissions and deterministic validation.

|
Tool

|

Operation

|
| --- | --- |
|

`finance.invoice.search`

|

Search invoices

|
|

`finance.invoice.get`

|

Retrieve invoice details

|
|

`finance.invoice.create_draft`

|

Prepare an invoice

|
|

`finance.invoice.validate`

|

Validate amounts, numbering and line items

|
|

`finance.invoice.issue`

|

Issue an invoice when authorized

|
|

`finance.payment.search`

|

Search permitted payment records

|
|

`finance.payment.get`

|

Retrieve a payment

|
|

`finance.payment.reconcile`

|

Reconcile a payment

|
|

`finance.payment.propose_refund`

|

Prepare a refund request

|
|

`finance.payment.execute_refund`

|

Execute an approved refund

|
|

`finance.account.get_balance`

|

Retrieve a permitted account balance

|
|

`finance.receivables.get_aging`

|

Retrieve aging buckets

|
|

`finance.collection.get_case`

|

Retrieve a collection case

|
|

`finance.collection.propose_action`

|

Recommend a collection action

|
|

`finance.collection.execute_action`

|

Execute an approved action

|
|

`finance.subscription.get`

|

Retrieve subscription details

|
|

`finance.subscription.change_plan`

|

Propose or execute an authorized plan change

|
|

`finance.revenue.get_summary`

|

Retrieve financial summaries

|

Never expose arbitrary balance adjustments, invoice-number changes or payment mutations as unrestricted AI tools. Use the existing invoice sequence, recurring billing and aging services.

## Domain 13 — Lead intelligence and autonomous SDR

|
Tool

|

Operation

|
| --- | --- |
|

`lead.search`

|

Search permitted leads

|
|

`lead.enrich`

|

Enrich a prospect

|
|

`lead.get_intelligence`

|

Retrieve the intelligence dossier

|
|

`lead.score`

|

Calculate explainable lead scores

|
|

`lead.get_decision_makers`

|

Retrieve verified or confidence-scored contacts

|
|

`lead.get_buying_signals`

|

Retrieve evidence-backed signals

|
|

`lead.get_recommended_pitch`

|

Generate a contextual pitch

|
|

`lead.get_objection_handlers`

|

Prepare objection responses

|
|

`sdr.get_daily_briefing`

|

Retrieve a daily rep briefing

|
|

`sdr.get_priority_queue`

|

Retrieve prioritized follow-ups

|
|

`sdr.generate_outreach_draft`

|

Draft personalized outreach

|
|

`sdr.create_whatsapp_link`

|

Generate a correctly encoded WhatsApp link

|
|

`sdr.request_outreach_approval`

|

Request approval to send

|
|

`sdr.record_outreach_outcome`

|

Record the verified result

|
|

`sdr.get_conversion_insights`

|

Analyze outcomes and conversion patterns

|

Use the existing `AutonomousSDREngine`, explainable scoring and revenue attribution implementations rather than building duplicate scoring logic.

## Domain 14 — Analytics and reporting

|
Tool

|

Operation

|
| --- | --- |
|

`analytics.get_metric_definition`

|

Retrieve an approved metric definition

|
|

`analytics.query_crm`

|

Query approved CRM aggregates

|
|

`analytics.get_pipeline_report`

|

Retrieve pipeline metrics

|
|

`analytics.get_sales_performance`

|

Retrieve sales performance

|
|

`analytics.get_campaign_report`

|

Retrieve campaign metrics

|
|

`analytics.get_survey_report`

|

Retrieve survey analytics

|
|

`analytics.get_finance_report`

|

Retrieve permitted financial aggregates

|
|

`analytics.compare_periods`

|

Compare defined periods

|
|

`analytics.explain_change`

|

Explain changes using available evidence

|
|

`analytics.ask_data`

|

Answer a natural-language business question

|
|

`analytics.generate_executive_brief`

|

Produce an executive summary

|
|

`analytics.export_report`

|

Request an authorized report export

|

Use approved metric definitions and controlled query templates. Do not let the model generate unrestricted database queries against production collections.

## Domain 15 — AI governance and administrative operations

SmartSapp already has substantial administrative AI functionality. It should be surfaced as a separate, tightly governed toolset.

|
Tool

|

Operation

|
| --- | --- |
|

`ai.proposal.create`

|

Convert an instruction into a structured action proposal

|
|

`ai.proposal.get`

|

Retrieve a proposal

|
|

`ai.proposal.simulate_impact`

|

Assess blast radius and expected effects

|
|

`ai.proposal.request_approval`

|

Request approval

|
|

`ai.proposal.get_approvals`

|

Retrieve approval records

|
|

`ai.proposal.execute`

|

Execute an approved proposal

|
|

`ai.proposal.cancel`

|

Cancel a pending proposal

|
|

`ai.access_review.generate`

|

Generate an access review

|
|

`ai.role_advisor.get_recommendations`

|

Retrieve least-privilege recommendations

|
|

`ai.workforce_risk.get_findings`

|

Retrieve access-risk findings

|
|

`ai.audit.search`

|

Search authorized audit events

|
|

`ai.execution.get_status`

|

Retrieve execution progress

|
|

`ai.execution.get_receipt`

|

Retrieve the execution receipt

|
|

`ai.policy.get`

|

Retrieve applicable AI policies

|
|

`ai.model.get_capabilities`

|

Retrieve allowed model capabilities

|
|

`ai.usage.get_summary`

|

Retrieve usage and budget metrics

|

Critical operations should preserve the existing dual-approval and bounded-batch execution controls. The agent should never be able to approve its own critical proposal.

## Domain 16 — Integrations and external services

|
Tool

|

Operation

|
| --- | --- |
|

`integration.list_connected`

|

List permitted integrations

|
|

`integration.get_status`

|

Retrieve connection health

|
|

`integration.request_connection`

|

Initiate an authorized connection flow

|
|

`integration.refresh_connection`

|

Refresh an authorized connection

|
|

`integration.calendar.list_events`

|

Retrieve permitted calendar events

|
|

`integration.calendar.check_availability`

|

Check external calendar availability

|
|

`integration.calendar.create_event`

|

Create an authorized calendar event

|
|

`integration.email.get_status`

|

Retrieve email provider status

|
|

`integration.whatsapp.get_status`

|

Retrieve WhatsApp integration status

|
|

`integration.webhook.create_draft`

|

Prepare a webhook configuration

|
|

`integration.webhook.test`

|

Test a controlled webhook

|
|

`integration.webhook.get_delivery_logs`

|

Retrieve webhook delivery logs

|
|

`integration.connection.revoke`

|

Revoke an authorized connection

|

External integrations need their own credential and scope management. Never return provider secrets or forward an incoming MCP access token to another service.

# 3. The tools that are easy to miss

The business-domain catalog is only part of the system. An implementation can have dozens of useful CRM tools and still fail as an agent platform if the supporting capabilities are missing.

I would explicitly add the following platform-level capabilities.

### Tool discovery and planning

Search tools by capability, inspect contracts, retrieve usage examples, select a minimal toolset, and explain why a tool was selected. Do not expose a tool that grants the agent permission simply because it was discovered.

### Policy decision and approval

Evaluate risk, check permissions, enforce separation of duties, create approval requests, expire stale approvals and verify approval immediately before execution.

### Durable execution and recovery

Create run records, checkpoint plans, resume long-running work, cancel jobs, retry transient failures, reconcile uncertain outcomes and prevent duplicate effects.

### Evidence and provenance

Track source IDs, record versions, timestamps, confidence, evidence spans, and which observations support a recommendation or memory.

### Budgets and resource controls

Enforce model-token, tool-call, execution-time, search-result, batch-size and monetary limits per organization and per run.

### Evaluation and red-team testing

Test tool selection, authorization bypasses, prompt injection, memory poisoning, cross-tenant leakage, unsafe retries, and incorrect action execution.

These should be first-class capabilities of the platform, even when they are not exposed as callable tools to the model.

For example, `policy.evaluate` might be an internal service call rather than an LLM-selectable tool. The agent must not be able to bypass that policy by choosing a different tool.


# 4. The shared tool execution architecture

All tools should pass through the same execution pipeline, whether called by Nexus, an SDR agent, a workflow, or an external MCP client.

Diagram options

![](data\:image/svg+xml;utf8,%3Csvg%20id%3D%22mermaid-_r_vi_%22%20width%3D%22877.8076782226562%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20class%3D%22flowchart%22%20height%3D%221796.7999267578125%22%20viewBox%3D%224%204%20877.8076782226562%201796.7999267578125%22%20role%3D%22graphics-document%20document%22%20aria-roledescription%3D%22flowchart-v2%22%3E%3Cstyle%3E%23mermaid-_r_vi_%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A14px%3Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%40keyframes%20edge-animation-frame%7Bfrom%7Bstroke-dashoffset%3A0%3B%7D%7D%40keyframes%20dash%7Bto%7Bstroke-dashoffset%3A0%3B%7D%7D%23mermaid-_r_vi_%20.edge-animation-slow%7Bstroke-dasharray%3A9%2C5!important%3Bstroke-dashoffset%3A900%3Banimation%3Adash%2050s%20linear%20infinite%3Bstroke-linecap%3Around%3B%7D%23mermaid-_r_vi_%20.edge-animation-fast%7Bstroke-dasharray%3A9%2C5!important%3Bstroke-dashoffset%3A900%3Banimation%3Adash%2020s%20linear%20infinite%3Bstroke-linecap%3Around%3B%7D%23mermaid-_r_vi_%20.error-icon%7Bfill%3Argb\(33%2C%2033%2C%2033\)%3B%7D%23mermaid-_r_vi_%20.error-text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3Bstroke%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vi_%20.edge-thickness-normal%7Bstroke-width%3A1px%3B%7D%23mermaid-_r_vi_%20.edge-thickness-thick%7Bstroke-width%3A3.5px%3B%7D%23mermaid-_r_vi_%20.edge-pattern-solid%7Bstroke-dasharray%3A0%3B%7D%23mermaid-_r_vi_%20.edge-thickness-invisible%7Bstroke-width%3A0%3Bfill%3Anone%3B%7D%23mermaid-_r_vi_%20.edge-pattern-dashed%7Bstroke-dasharray%3A3%3B%7D%23mermaid-_r_vi_%20.edge-pattern-dotted%7Bstroke-dasharray%3A2%3B%7D%23mermaid-_r_vi_%20.marker%7Bfill%3Argb\(205%2C%20205%2C%20205\)%3Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vi_%20.marker.cross%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vi_%20svg%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A14px%3B%7D%23mermaid-_r_vi_%20p%7Bmargin%3A0%3B%7D%23mermaid-_r_vi_%20.label%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vi_%20.cluster-label%20text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vi_%20.cluster-label%20span%7Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vi_%20.cluster-label%20span%20p%7Bbackground-color%3Atransparent%3B%7D%23mermaid-_r_vi_%20.label%20text%2C%23mermaid-_r_vi_%20span%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vi_%20.node%20rect%2C%23mermaid-_r_vi_%20.node%20circle%2C%23mermaid-_r_vi_%20.node%20ellipse%2C%23mermaid-_r_vi_%20.node%20polygon%2C%23mermaid-_r_vi_%20.node%20path%7Bfill%3Argb\(9%2C%2023%2C%2044\)%3Bstroke%3Argb\(31%2C%2078%2C%20148\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vi_%20.rough-node%20.label%20text%2C%23mermaid-_r_vi_%20.node%20.label%20text%2C%23mermaid-_r_vi_%20.image-shape%20.label%2C%23mermaid-_r_vi_%20.icon-shape%20.label%7Btext-anchor%3Amiddle%3B%7D%23mermaid-_r_vi_%20.node%20.katex%20path%7Bfill%3A%23000%3Bstroke%3A%23000%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vi_%20.rough-node%20.label%2C%23mermaid-_r_vi_%20.node%20.label%2C%23mermaid-_r_vi_%20.image-shape%20.label%2C%23mermaid-_r_vi_%20.icon-shape%20.label%7Btext-align%3Acenter%3B%7D%23mermaid-_r_vi_%20.node.clickable%7Bcursor%3Apointer%3B%7D%23mermaid-_r_vi_%20.root%20.anchor%20path%7Bfill%3Argb\(205%2C%20205%2C%20205\)!important%3Bstroke-width%3A0%3Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vi_%20.arrowheadPath%7Bfill%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vi_%20.edgePath%20.path%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3Bstroke-width%3A2.0px%3B%7D%23mermaid-_r_vi_%20.flowchart-link%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3Bfill%3Anone%3B%7D%23mermaid-_r_vi_%20.edgeLabel%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Btext-align%3Acenter%3B%7D%23mermaid-_r_vi_%20.edgeLabel%20p%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vi_%20.edgeLabel%20rect%7Bopacity%3A0.5%3Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bfill%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vi_%20.labelBkg%7Bbackground-color%3Argba\(0%2C%200%2C%200%2C%200.5\)%3B%7D%23mermaid-_r_vi_%20.cluster%20rect%7Bfill%3Argb\(33%2C%2033%2C%2033\)%3Bstroke%3Argba\(255%2C%20255%2C%20255%2C%200.05\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vi_%20.cluster%20text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vi_%20.cluster%20span%7Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vi_%20div.mermaidTooltip%7Bposition%3Aabsolute%3Btext-align%3Acenter%3Bmax-width%3A200px%3Bpadding%3A2px%3Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A12px%3Bbackground%3Argb\(33%2C%2033%2C%2033\)%3Bborder%3A1px%20solid%20rgba\(255%2C%20255%2C%20255%2C%200.05\)%3Bborder-radius%3A2px%3Bpointer-events%3Anone%3Bz-index%3A100%3B%7D%23mermaid-_r_vi_%20.flowchartTitleText%7Btext-anchor%3Amiddle%3Bfont-size%3A18px%3Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vi_%20rect.text%7Bfill%3Anone%3Bstroke-width%3A0%3B%7D%23mermaid-_r_vi_%20.icon-shape%2C%23mermaid-_r_vi_%20.image-shape%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Btext-align%3Acenter%3B%7D%23mermaid-_r_vi_%20.icon-shape%20p%2C%23mermaid-_r_vi_%20.image-shape%20p%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bpadding%3A2px%3B%7D%23mermaid-_r_vi_%20.icon-shape%20rect%2C%23mermaid-_r_vi_%20.image-shape%20rect%7Bopacity%3A0.5%3Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bfill%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vi_%20.label-icon%7Bdisplay%3Ainline-block%3Bheight%3A1em%3Boverflow%3Avisible%3Bvertical-align%3A-0.125em%3B%7D%23mermaid-_r_vi_%20.node%20.label-icon%20path%7Bfill%3AcurrentColor%3Bstroke%3Arevert%3Bstroke-width%3Arevert%3B%7D%23mermaid-_r_vi_%20.node%20text%7Bfont-size%3A16px%3Bfont-weight%3A600%3Bletter-spacing%3A-0.32px%3Bfill%3A%2399ceff%3B%7D%23mermaid-_r_vi_%20.edgeLabels%20text%7Bfont-size%3A13px%3Bfont-weight%3A600%3Bletter-spacing%3A-0.08px%3Bfill%3A%2399ceff%3B%7D%23mermaid-_r_vi_%20.node%20tspan%5Bfont-weight%3D%22normal%22%5D%2C%23mermaid-_r_vi_%20.edgeLabels%20tspan%5Bfont-weight%3D%22normal%22%5D%7Bfont-weight%3A600%3B%7D%23mermaid-_r_vi_%20.edgeLabel%20.label%20rect%7Bopacity%3A1%3Brx%3A13px%3Bry%3A13px%3Bfill%3A%23000e1a%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vi_%20.node%20rect%2C%23mermaid-_r_vi_%20.node%20circle%2C%23mermaid-_r_vi_%20.node%20ellipse%2C%23mermaid-_r_vi_%20.node%20polygon%2C%23mermaid-_r_vi_%20.node%20path%7Bfill%3Argb\(0%2C%2040%2C%2077\)%3Bstroke%3Argba\(255%2C%20255%2C%20255%2C%200.1\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vi_%20.node%20rect%7Brx%3A16px%3Bry%3A16px%3B%7D%23mermaid-_r_vi_%20.node.mermaid-decision%20.label-container%7Bfill%3A%23000e1a%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-dasharray%3A2%202%3B%7D%23mermaid-_r_vi_%20.edgePaths%20.flowchart-link%7Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-width%3A1px%3Bstroke-linecap%3Around%3Bstroke-linejoin%3Around%3B%7D%23mermaid-_r_vi_%20.marker%7Bfill%3Argb\(26%2C%2062%2C%2095\)%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3B%7D%23mermaid-_r_vi_%20.node%7Bcolor-scheme%3Adark%3B%7D%23mermaid-_r_vi_%20%3Aroot%7B--mermaid-font-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3B%7D%3C%2Fstyle%3E%3Cg%3E%3Cmarker%20id%3D%22mermaid-_r_vi__flowchart-v2-pointEnd%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%22-5%20-5%2010%2010%22%20refX%3D%220%22%20refY%3D%220%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%200%200%20L%204%200%20M%200.8180194846605362%20-3.181980515339464%20L%204%200%20L%200.8180194846605362%203.181980515339464%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%20none%3B%20fill%3A%20none%3B%20stroke-linecap%3A%20round%3B%20stroke-linejoin%3A%20round%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vi__flowchart-v2-pointStart%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%22-5%20-5%2010%2010%22%20refX%3D%220%22%20refY%3D%220%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%200%200%20L%20-4%200%20M%20-0.8180194846605362%20-3.181980515339464%20L%20-4%200%20L%20-0.8180194846605362%203.181980515339464%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%20none%3B%20fill%3A%20none%3B%20stroke-linecap%3A%20round%3B%20stroke-linejoin%3A%20round%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vi__flowchart-v2-circleEnd%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%220%200%2010%2010%22%20refX%3D%2211%22%20refY%3D%225%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Ccircle%20cx%3D%225%22%20cy%3D%225%22%20r%3D%225%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fcircle%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vi__flowchart-v2-circleStart%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%220%200%2010%2010%22%20refX%3D%22-1%22%20refY%3D%225%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Ccircle%20cx%3D%225%22%20cy%3D%225%22%20r%3D%225%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fcircle%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vi__flowchart-v2-crossEnd%22%20class%3D%22marker%20cross%20flowchart-v2%22%20viewBox%3D%220%200%2011%2011%22%20refX%3D%2212%22%20refY%3D%225.2%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%201%2C1%20l%209%2C9%20M%2010%2C1%20l%20-9%2C9%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%202%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vi__flowchart-v2-crossStart%22%20class%3D%22marker%20cross%20flowchart-v2%22%20viewBox%3D%220%200%2011%2011%22%20refX%3D%22-1%22%20refY%3D%225.2%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%201%2C1%20l%209%2C9%20M%2010%2C1%20l%20-9%2C9%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%202%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3C%2Fg%3E%3Cg%20class%3D%22subgraphs%22%3E%3C%2Fg%3E%3Cg%20class%3D%22nodes%22%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-A-0%22%20transform%3D%22translate\(256.00171915690106%2C%20924.0999946594238\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-127.71219635009766%22%20y%3D%22-34.29999923706055%22%20width%3D%22255.4243927001953%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EUser%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20request%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20or%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20workflow%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Etrigger%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-B-1%22%20transform%3D%22translate\(256.00171915690106%2C%201028.3999938964844\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-133.0167236328125%22%20y%3D%22-30%22%20width%3D%22266.033447265625%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ESupervisor%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20%2F%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20Agent%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20Planner%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-C-3%22%20transform%3D%22translate\(297.5186462402344%2C%201131.2666600545247\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-124.55078125%22%20y%3D%22-30%22%20width%3D%22249.1015625%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EBuild%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20authorized%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20context%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-D-5%22%20transform%3D%22translate\(297.5186462402344%2C%201236.9999923706055\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-115.35546875%22%20y%3D%22-30%22%20width%3D%22230.7109375%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EDiscover%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20eligible%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20tools%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-E-7%22%20transform%3D%22translate\(297.5186462402344%2C%201341.299991607666\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-107.84765625%22%20y%3D%22-34.29999923706055%22%20width%3D%22215.6953125%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EPlan%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20with%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20typed%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20tool%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Econtracts%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-F-9%22%20transform%3D%22translate\(297.5186462402344%2C%201445.5999908447266\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-84.89823532104492%22%20y%3D%22-30%22%20width%3D%22169.79647064208984%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ETool%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20Gateway%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-G-11%22%20transform%3D%22translate\(297.5186462402344%2C%201549.899990081787\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-119.1484375%22%20y%3D%22-34.29999923706055%22%20width%3D%22238.296875%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EAuthenticate%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20actor%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eresolve%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20tenant%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-H-13%22%20transform%3D%22translate\(297.5186462402344%2C%201658.4999885559082\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-120.65625%22%20y%3D%22-34.29999923706055%22%20width%3D%22241.3125%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EAuthorize%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20resource%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eoperation%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-I-15%22%20transform%3D%22translate\(146.9774932861328%2C%201762.7999877929688\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-134.97750091552734%22%20y%3D%22-30%22%20width%3D%22269.9550018310547%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EValidate%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20schema%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20policy%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%20%20mermaid-decision%22%20id%3D%22flowchart-J-17%22%20transform%3D%22translate\(152.47718302408856%2C%2042\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-100.984375%22%20y%3D%22-30%22%20width%3D%22201.96875%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ERisk%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20classification%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-K-19%22%20transform%3D%22translate\(504.4482905069987%2C%20494\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-122.2265625%22%20y%3D%22-30%22%20width%3D%22244.453125%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EExecute%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20domain%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20service%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-L-21%22%20transform%3D%22translate\(689.8662592569988%2C%20228\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-123.48828125%22%20y%3D%22-30%22%20width%3D%22246.9765625%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ECreate%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20approval%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20request%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%20%20mermaid-decision%22%20id%3D%22flowchart-M-23%22%20transform%3D%22translate\(689.8662592569988%2C%20328\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-103.0078125%22%20y%3D%22-30%22%20width%3D%22206.015625%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EApproval%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20granted%3F%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-N-25%22%20transform%3D%22translate\(770.2412592569988%2C%20494\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-103.56640625%22%20y%3D%22-30%22%20width%3D%22207.1328125%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EStop%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20or%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20revise%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20plan%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-O-29%22%20transform%3D%22translate\(504.4482905069987%2C%20598.2999992370605\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-122.25%22%20y%3D%22-34.29999923706055%22%20width%3D%22244.5%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EVerify%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20result%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20persist%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eaudit%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-P-31%22%20transform%3D%22translate\(504.4482905069987%2C%20706.8999977111816\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-130.4765625%22%20y%3D%22-34.29999923706055%22%20width%3D%22260.953125%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EUpdate%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20run%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20state%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20emit%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eevents%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-Q-33%22%20transform%3D%22translate\(504.4482905069987%2C%20815.4999961853027\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-115.25%22%20y%3D%22-34.29999923706055%22%20width%3D%22230.5%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EReturn%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20typed%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20result%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20to%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eagent%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%20%20mermaid-decision%22%20id%3D%22flowchart-R-35%22%20transform%3D%22translate\(504.4482905069987%2C%20925.533327738444\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-80.734375%22%20y%3D%22-30%22%20width%3D%22161.46875%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EMore%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20steps%3F%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-S-39%22%20transform%3D%22translate\(568.2491149902344%2C%201132.699993133545\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-106.1796875%22%20y%3D%22-34.29999923706055%22%20width%3D%22212.359375%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EFinal%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20response%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20with%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eevidence%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edges%20edgePaths%22%3E%3Cpath%20d%3D%22M256.00171915690106%2C958.3999938964844L256.00171915690106%2C986.3999938964844%22%20id%3D%22L_A_B_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_A_B_0%22%20data-points%3D%22W3sieCI6MjU2LjAwMTcxOTE1NjkwMTA2LCJ5Ijo5NTguMzk5OTkzODk2NDg0NH0seyJ4IjoyNTYuMDAxNzE5MTU2OTAxMDYsInkiOjk5MC4zOTk5OTM4OTY0ODQ0fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M256.00171915690106%2C1058.3999938964844L256.001719156901%2C1089.2666600545247%22%20id%3D%22L_B_C_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_B_C_0%22%20data-points%3D%22W3sieCI6MjU2LjAwMTcxOTE1NjkwMTA2LCJ5IjoxMDU4LjM5OTk5Mzg5NjQ4NDR9LHsieCI6MjU2LjAwMTcxOTE1NjkwMSwieSI6MTA5My4yNjY2NjAwNTQ1MjQ3fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M297.5186462402344%2C1161.2666600545247L297.5186462402344%2C1194.9999923706055%22%20id%3D%22L_C_D_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_C_D_0%22%20data-points%3D%22W3sieCI6Mjk3LjUxODY0NjI0MDIzNDQsInkiOjExNjEuMjY2NjYwMDU0NTI0N30seyJ4IjoyOTcuNTE4NjQ2MjQwMjM0NCwieSI6MTE5OC45OTk5OTIzNzA2MDU1fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M297.5186462402344%2C1266.9999923706055L297.5186462402344%2C1294.9999923706055%22%20id%3D%22L_D_E_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_D_E_0%22%20data-points%3D%22W3sieCI6Mjk3LjUxODY0NjI0MDIzNDQsInkiOjEyNjYuOTk5OTkyMzcwNjA1NX0seyJ4IjoyOTcuNTE4NjQ2MjQwMjM0NCwieSI6MTI5OC45OTk5OTIzNzA2MDU1fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M297.5186462402344%2C1375.5999908447266L297.5186462402344%2C1403.5999908447266%22%20id%3D%22L_E_F_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_E_F_0%22%20data-points%3D%22W3sieCI6Mjk3LjUxODY0NjI0MDIzNDQsInkiOjEzNzUuNTk5OTkwODQ0NzI2Nn0seyJ4IjoyOTcuNTE4NjQ2MjQwMjM0NCwieSI6MTQwNy41OTk5OTA4NDQ3MjY2fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M297.5186462402344%2C1475.5999908447266L297.5186462402344%2C1503.5999908447266%22%20id%3D%22L_F_G_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_F_G_0%22%20data-points%3D%22W3sieCI6Mjk3LjUxODY0NjI0MDIzNDQsInkiOjE0NzUuNTk5OTkwODQ0NzI2Nn0seyJ4IjoyOTcuNTE4NjQ2MjQwMjM0NCwieSI6MTUwNy41OTk5OTA4NDQ3MjY2fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M297.5186462402344%2C1584.1999893188477L297.5186462402344%2C1612.1999893188477%22%20id%3D%22L_G_H_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_G_H_0%22%20data-points%3D%22W3sieCI6Mjk3LjUxODY0NjI0MDIzNDQsInkiOjE1ODQuMTk5OTg5MzE4ODQ3N30seyJ4IjoyOTcuNTE4NjQ2MjQwMjM0NCwieSI6MTYxNi4xOTk5ODkzMTg4NDc3fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M297.5186462402344%2C1692.7999877929688L297.5186462402344%2C1706.017031767674Q297.5186462402344%2C1707.7999877929688%20296.4328598026075%2C1709.2142013553419L296.4328598026075%2C1709.2142013553419Q295.3470733649806%2C1710.628414917715%20293.9328598026075%2C1711.7142013553419L293.9328598026075%2C1711.7142013553419Q292.5186462402344%2C1712.7999877929688%20290.7356902149397%2C1712.7999877929688L198.75294707347174%2C1712.7999877929688Q196.9699910481771%2C1712.7999877929688%20195.55577748580401%2C1713.8857742305956L195.55577748580401%2C1713.8857742305956Q194.1415639234309%2C1714.9715606682225%20193.05577748580401%2C1716.3857742305956L193.05577748580401%2C1716.3857742305956Q191.9699910481771%2C1717.7999877929688%20191.9699910481771%2C1719.5829438182634L191.9699910481771%2C1722.7999877929688%22%20id%3D%22L_H_I_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_H_I_0%22%20data-points%3D%22W3sieCI6Mjk3LjUxODY0NjI0MDIzNDQsInkiOjE2OTIuNzk5OTg3NzkyOTY4OH0seyJ4IjoyOTcuNTE4NjQ2MjQwMjM0NCwieSI6MTcxMi43OTk5ODc3OTI5Njg4fSx7IngiOjE5MS45Njk5OTEwNDgxNzcxLCJ5IjoxNzEyLjc5OTk4Nzc5Mjk2ODh9LHsieCI6MTkxLjk2OTk5MTA0ODE3NzEsInkiOjE3MjYuNzk5OTg3NzkyOTY4OH1d%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M101.98499552408852%2C1732.7999877929688L101.98499552408855%2C1658.4999885559082L101.98499552408855%2C1549.899990081787L101.98499552408855%2C1445.5999908447266L101.98499552408855%2C1341.299991607666L101.98499552408855%2C1236.9999923706055L101.98499552408855%2C1132.699993133545L101.98499552408855%2C1028.3999938964844L101.98499552408855%2C924.0999946594238L101.98499552408855%2C815.4999961853027L101.98499552408855%2C706.8999977111816L101.98499552408855%2C598.2999992370605L101.98499552408855%2C494L101.98499552408855%2C411L101.98499552408855%2C328L101.98499552408855%2C228L101.98499552408855%2C145L101.98499552408855%2C84%22%20id%3D%22L_I_J_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_I_J_0%22%20data-points%3D%22W3sieCI6MTAxLjk4NDk5NTUyNDA4ODUyLCJ5IjoxNzMyLjc5OTk4Nzc5Mjk2ODh9LHsieCI6MTAxLjk4NDk5NTUyNDA4ODU1LCJ5IjoxNjU4LjQ5OTk4ODU1NTkwODJ9LHsieCI6MTAxLjk4NDk5NTUyNDA4ODU1LCJ5IjoxNTQ5Ljg5OTk5MDA4MTc4N30seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjE0NDUuNTk5OTkwODQ0NzI2Nn0seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjEzNDEuMjk5OTkxNjA3NjY2fSx7IngiOjEwMS45ODQ5OTU1MjQwODg1NSwieSI6MTIzNi45OTk5OTIzNzA2MDU1fSx7IngiOjEwMS45ODQ5OTU1MjQwODg1NSwieSI6MTEzMi42OTk5OTMxMzM1NDV9LHsieCI6MTAxLjk4NDk5NTUyNDA4ODU1LCJ5IjoxMDI4LjM5OTk5Mzg5NjQ4NDR9LHsieCI6MTAxLjk4NDk5NTUyNDA4ODU1LCJ5Ijo5MjQuMDk5OTk0NjU5NDIzOH0seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjgxNS40OTk5OTYxODUzMDI3fSx7IngiOjEwMS45ODQ5OTU1MjQwODg1NSwieSI6NzA2Ljg5OTk5NzcxMTE4MTZ9LHsieCI6MTAxLjk4NDk5NTUyNDA4ODU1LCJ5Ijo1OTguMjk5OTk5MjM3MDYwNX0seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjQ5NH0seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjQxMX0seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjMyOH0seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjIyOH0seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjE0NX0seyJ4IjoxMDEuOTg0OTk1NTI0MDg4NTUsInkiOjgwfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M152.47718302408856%2C72L152.47718302408856%2C105.21704397470535Q152.47718302408856%2C107%20153.56296946171545%2C108.41421356237309L153.56296946171545%2C108.41421356237309Q154.64875589934238%2C109.82842712474618%20156.06296946171545%2C110.91421356237309L156.06296946171545%2C110.91421356237309Q157.47718302408856%2C112%20159.2601390493832%2C112L456.92314698170406%2C112Q458.7061030069987%2C112%20460.1203165693718%2C113.08578643762691L460.1203165693718%2C113.08578643762692Q461.53453013174493%2C114.17157287525382%20462.6203165693718%2C115.58578643762691L462.6203165693718%2C115.58578643762691Q463.7061030069987%2C117%20463.7061030069987%2C118.78295602529465L463.7061030069987%2C145L463.7061030069987%2C328L463.7061030069987%2C411L463.7061030069987%2C452%22%20id%3D%22L_J_K_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_J_K_0%22%20data-points%3D%22W3sieCI6MTUyLjQ3NzE4MzAyNDA4ODU2LCJ5Ijo3Mn0seyJ4IjoxNTIuNDc3MTgzMDI0MDg4NTYsInkiOjExMn0seyJ4Ijo0NjMuNzA2MTAzMDA2OTk4NywieSI6MTEyfSx7IngiOjQ2My43MDYxMDMwMDY5OTg3LCJ5IjoxNDV9LHsieCI6NDYzLjcwNjEwMzAwNjk5ODcsInkiOjMyOH0seyJ4Ijo0NjMuNzA2MTAzMDA2OTk4NywieSI6NDExfSx7IngiOjQ2My43MDYxMDMwMDY5OTg3LCJ5Ijo0NTZ9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M202.96937052408856%2C72L202.96937052408856%2C85.21704397470535Q202.96937052408856%2C87%20204.05515696171545%2C88.41421356237309L204.05515696171545%2C88.41421356237309Q205.14094339934238%2C89.82842712474618%20206.55515696171545%2C90.91421356237309L206.55515696171545%2C90.91421356237309Q207.96937052408856%2C92%20209.7523265493832%2C92L683.0833032317041%2C92Q684.8662592569988%2C92%20686.2804728193719%2C93.08578643762691L686.2804728193719%2C93.08578643762692Q687.694686381745%2C94.17157287525382%20688.7804728193719%2C95.58578643762691L688.7804728193719%2C95.58578643762691Q689.8662592569988%2C97%20689.8662592569988%2C98.78295602529465L689.8662592569988%2C186%22%20id%3D%22L_J_L_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_J_L_0%22%20data-points%3D%22W3sieCI6MjAyLjk2OTM3MDUyNDA4ODU2LCJ5Ijo3Mn0seyJ4IjoyMDIuOTY5MzcwNTI0MDg4NTYsInkiOjkyfSx7IngiOjY4OS44NjYyNTkyNTY5OTg4LCJ5Ijo5Mn0seyJ4Ijo2ODkuODY2MjU5MjU2OTk4OCwieSI6MTkwfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M689.8662592569988%2C258L689.8662592569988%2C286%22%20id%3D%22L_L_M_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_L_M_0%22%20data-points%3D%22W3sieCI6Njg5Ljg2NjI1OTI1Njk5ODgsInkiOjI1OH0seyJ4Ijo2ODkuODY2MjU5MjU2OTk4OCwieSI6MjkwfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M724.2021967569988%2C358L724.2021967569988%2C371.21704397470535Q724.2021967569988%2C373%20725.2879831946257%2C374.4142135623731L725.2879831946257%2C374.4142135623731Q726.3737696322526%2C375.8284271247462%20727.7879831946257%2C376.9142135623731L727.7879831946257%2C376.9142135623731Q729.2021967569988%2C378%20730.9851527822934%2C378L763.4583032317041%2C378Q765.2412592569988%2C378%20766.6554728193719%2C379.0857864376269L766.6554728193719%2C379.0857864376269Q768.069686381745%2C380.1715728752538%20769.1554728193719%2C381.5857864376269L769.1554728193719%2C381.5857864376269Q770.2412592569988%2C383%20770.2412592569988%2C384.78295602529465L770.2412592569988%2C452%22%20id%3D%22L_M_N_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_M_N_0%22%20data-points%3D%22W3sieCI6NzI0LjIwMjE5Njc1Njk5ODgsInkiOjM1OH0seyJ4Ijo3MjQuMjAyMTk2NzU2OTk4OCwieSI6Mzc4fSx7IngiOjc3MC4yNDEyNTkyNTY5OTg4LCJ5IjozNzh9LHsieCI6NzcwLjI0MTI1OTI1Njk5ODgsInkiOjQ1Nn1d%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M655.5303217569988%2C358L655.5303217569988%2C437.21704397470535Q655.5303217569988%2C439%20654.4445353193719%2C440.4142135623731L654.4445353193719%2C440.4142135623731Q653.358748881745%2C441.8284271247462%20651.9445353193719%2C442.9142135623731L651.9445353193719%2C442.9142135623731Q650.5303217569988%2C444%20648.7473657317041%2C444L551.9734340322934%2C444Q550.1904780069988%2C444%20548.7762644446257%2C445.0857864376269L548.7762644446257%2C445.0857864376269Q547.3620508822526%2C446.1715728752538%20546.2762644446257%2C447.5857864376269L546.2762644446257%2C447.5857864376269Q545.1904780069988%2C449%20545.1904780069988%2C450.78295602529465L545.1904780069988%2C454%22%20id%3D%22L_M_K_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_M_K_0%22%20data-points%3D%22W3sieCI6NjU1LjUzMDMyMTc1Njk5ODgsInkiOjM1OH0seyJ4Ijo2NTUuNTMwMzIxNzU2OTk4OCwieSI6NDQ0fSx7IngiOjU0NS4xOTA0NzgwMDY5OTg4LCJ5Ijo0NDR9LHsieCI6NTQ1LjE5MDQ3ODAwNjk5ODgsInkiOjQ1OH1d%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M504.4482905069987%2C524L504.4482905069987%2C552%22%20id%3D%22L_K_O_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_K_O_0%22%20data-points%3D%22W3sieCI6NTA0LjQ0ODI5MDUwNjk5ODcsInkiOjUyNH0seyJ4Ijo1MDQuNDQ4MjkwNTA2OTk4NywieSI6NTU2fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M504.4482905069987%2C632.5999984741211L504.4482905069987%2C660.5999984741211%22%20id%3D%22L_O_P_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_O_P_0%22%20data-points%3D%22W3sieCI6NTA0LjQ0ODI5MDUwNjk5ODcsInkiOjYzMi41OTk5OTg0NzQxMjExfSx7IngiOjUwNC40NDgyOTA1MDY5OTg3LCJ5Ijo2NjQuNTk5OTk4NDc0MTIxMX1d%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M504.4482905069987%2C741.1999969482422L504.4482905069987%2C769.1999969482422%22%20id%3D%22L_P_Q_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_P_Q_0%22%20data-points%3D%22W3sieCI6NTA0LjQ0ODI5MDUwNjk5ODcsInkiOjc0MS4xOTk5OTY5NDgyNDIyfSx7IngiOjUwNC40NDgyOTA1MDY5OTg3LCJ5Ijo3NzMuMTk5OTk2OTQ4MjQyMn1d%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M504.4482905069987%2C849.7999954223633L504.4482905069987%2C883.533327738444%22%20id%3D%22L_Q_R_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_Q_R_0%22%20data-points%3D%22W3sieCI6NTA0LjQ0ODI5MDUwNjk5ODcsInkiOjg0OS43OTk5OTU0MjIzNjMzfSx7IngiOjUwNC40NDgyOTA1MDY5OTg3LCJ5Ijo4ODcuNTMzMzI3NzM4NDQ0fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M477.53683217366535%2C955.533327738444L477.5368321736654%2C1071.3289260846188Q477.5368321736654%2C1078.3999938964844%20470.4657643617999%2C1078.3999938964844L345.81852934886234%2C1078.3999938964844Q344.0355733235677%2C1078.3999938964844%20342.6213597611946%2C1079.4857803341113L342.6213597611946%2C1079.4857803341113Q341.2071461988215%2C1080.5715667717382%20340.1213597611946%2C1081.9857803341113L340.1213597611946%2C1081.9857803341113Q339.0355733235677%2C1083.3999938964844%20339.0355733235677%2C1085.182949921779L339.0355733235677%2C1089.8333269755044%22%20id%3D%22L_R_C_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_R_C_0%22%20data-points%3D%22W3sieCI6NDc3LjUzNjgzMjE3MzY2NTM1LCJ5Ijo5NTUuNTMzMzI3NzM4NDQ0fSx7IngiOjQ3Ny41MzY4MzIxNzM2NjU0LCJ5IjoxMDc4LjM5OTk5Mzg5NjQ4NDR9LHsieCI6MzM5LjAzNTU3MzMyMzU2NzcsInkiOjEwNzguMzk5OTkzODk2NDg0NH0seyJ4IjozMzkuMDM1NTczMzIzNTY3NywieSI6MTA5My44MzMzMjY5NzU1MDQ0fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M531.3597488403321%2C955.533327738444L531.359748840332%2C971.328926084619Q531.359748840332%2C978.3999938964844%20538.4308166521974%2C978.3999938964844L561.4661589649397%2C978.3999938964844Q563.2491149902344%2C978.3999938964844%20564.6633285526075%2C979.4857803341113L564.6633285526075%2C979.4857803341113Q566.0775421149806%2C980.5715667717382%20567.1633285526075%2C981.9857803341113L567.1633285526075%2C981.9857803341113Q568.2491149902344%2C983.3999938964844%20568.2491149902344%2C985.182949921779L568.2491149902344%2C1086.3999938964844%22%20id%3D%22L_R_S_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_R_S_0%22%20data-points%3D%22W3sieCI6NTMxLjM1OTc0ODg0MDMzMjEsInkiOjk1NS41MzMzMjc3Mzg0NDR9LHsieCI6NTMxLjM1OTc0ODg0MDMzMiwieSI6OTc4LjM5OTk5Mzg5NjQ4NDR9LHsieCI6NTY4LjI0OTExNDk5MDIzNDQsInkiOjk3OC4zOTk5OTM4OTY0ODQ0fSx7IngiOjU2OC4yNDkxMTQ5OTAyMzQ0LCJ5IjoxMDkwLjM5OTk5Mzg5NjQ4NDR9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vi__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabels%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_A_B_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_B_C_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_C_D_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_D_E_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_E_F_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_F_G_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_G_H_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_H_I_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_I_J_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%20transform%3D%22translate\(463.5420405069987%2C%20228\)%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_J_K_0%22%20transform%3D%22translate\(-50.8359375%2C-8\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22%22%20x%3D%22-12%22%20y%3D%22-5%22%20width%3D%22125.671875%22%20height%3D%2226%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ERead%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20or%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20low-risk%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%20transform%3D%22translate\(689.7451655069988%2C%20145\)%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_J_L_0%22%20transform%3D%22translate\(-55.87890625%2C-8\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22%22%20x%3D%22-12%22%20y%3D%22-5%22%20width%3D%22135.7578125%22%20height%3D%2226%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EApproval%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20required%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_L_M_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%20transform%3D%22translate\(769.9873530069988%2C%20411\)%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_M_N_0%22%20transform%3D%22translate\(-8.74609375%2C-8\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22%22%20x%3D%22-12%22%20y%3D%22-5%22%20width%3D%2241.4921875%22%20height%3D%2226%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ENo%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%20transform%3D%22translate\(655.1240717569988%2C%20411\)%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_M_K_0%22%20transform%3D%22translate\(-11.09375%2C-8\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22%22%20x%3D%22-12%22%20y%3D%22-5%22%20width%3D%2246.1875%22%20height%3D%2226%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EYes%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_K_O_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_O_P_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_P_Q_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_Q_R_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%20transform%3D%22translate\(477.1305821736654%2C%201028.3999938964844\)%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_R_C_0%22%20transform%3D%22translate\(-11.09375%2C-8\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22%22%20x%3D%22-12%22%20y%3D%22-5%22%20width%3D%2246.1875%22%20height%3D%2226%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EYes%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%20transform%3D%22translate\(567.9952087402344%2C%201028.3999938964844\)%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_R_S_0%22%20transform%3D%22translate\(-8.74609375%2C-8\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22%22%20x%3D%22-12%22%20y%3D%22-5%22%20width%3D%2241.4921875%22%20height%3D%2226%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ENo%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E)

The execution gateway is responsible for authorization, validation, risk enforcement and audit logging. The agent planner is responsible for deciding what to do next. Neither should replace the other.

## 4.1 The internal tool registry

I recommend a central registry with a canonical definition for every capability. Each definition should include at least:

|
Field

|

Purpose

|
| --- | --- |
|

`name`

|

Stable, namespaced tool identifier

|
|

`version`

|

Contract version

|
|

`domain`

|

CRM, knowledge, finance, etc.

|
|

`description`

|

Precise explanation of when to use the tool

|
|

`inputSchema`

|

Strict typed input schema

|
|

`outputSchema`

|

Strict typed result schema

|
|

`implementationRef`

|

Canonical domain service or adapter

|
|

`requiredPermissions`

|

Required operations and scopes

|
|

`resourceScopes`

|

Organization, workspace, entity or record scope

|
|

`riskClass`

|

Read, draft, reversible mutation, external effect, critical

|
|

`approvalPolicy`

|

Required approval rule

|
|

`idempotencyPolicy`

|

How duplicate execution is prevented

|
|

`timeoutPolicy`

|

Timeout and cancellation behavior

|
|

`retryPolicy`

|

Which failures can be retried

|
|

`auditPolicy`

|

Required audit fields and retention

|
|

`dataClassification`

|

Sensitivity of inputs and outputs

|
|

`availability`

|

Whether the tool is enabled for this tenant and agent

|
|

`tests`

|

Contract, authorization and behavior test references

|

Use TypeScript types and Zod schemas as the source of truth for internal contracts. Generate or validate MCP input schemas from these canonical definitions rather than maintaining two drifting copies.

## 4.2 Risk classification

R0

Read-only

Search CRM, retrieve knowledge, read analytics. Enforce data access checks and bounded results.

R1

Draft or proposal

Draft a message, suggest a memory, prepare a campaign, or propose a deal update. Draft creation still requires permission.

R2

Bounded internal mutation

Create a task, add a note, or update a permitted CRM field. Require validation, idempotency and an audit record.

R3

External or consequential action

Send a message, launch a campaign, issue an invoice or execute a financial operation. Require explicit authorization and the relevant confirmation or approval.

R4

Critical administrative action

Change privileged access, perform broad data mutations or execute a critical administration proposal. Require the appropriate dual approval, blast-radius evaluation and deterministic execution.

These are proposed SmartSapp risk classes, not MCP protocol-defined levels. Your policy engine should evaluate the actual operation, resource, scope and consequences rather than relying only on a static label.

# 5. MCP server architecture

I would build a single logical SmartSapp MCP platform with separately configurable toolsets. You can deploy it as one service initially and split it into separate services later if security boundaries, scaling or external integrations justify that.

Diagram options

![](data\:image/svg+xml;utf8,%3Csvg%20id%3D%22mermaid-_r_vj_%22%20width%3D%221369.2427978515625%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20class%3D%22flowchart%22%20height%3D%221108.800048828125%22%20viewBox%3D%224%204%201369.2427978515625%201108.800048828125%22%20role%3D%22graphics-document%20document%22%20aria-roledescription%3D%22flowchart-v2%22%3E%3Cstyle%3E%23mermaid-_r_vj_%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A14px%3Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%40keyframes%20edge-animation-frame%7Bfrom%7Bstroke-dashoffset%3A0%3B%7D%7D%40keyframes%20dash%7Bto%7Bstroke-dashoffset%3A0%3B%7D%7D%23mermaid-_r_vj_%20.edge-animation-slow%7Bstroke-dasharray%3A9%2C5!important%3Bstroke-dashoffset%3A900%3Banimation%3Adash%2050s%20linear%20infinite%3Bstroke-linecap%3Around%3B%7D%23mermaid-_r_vj_%20.edge-animation-fast%7Bstroke-dasharray%3A9%2C5!important%3Bstroke-dashoffset%3A900%3Banimation%3Adash%2020s%20linear%20infinite%3Bstroke-linecap%3Around%3B%7D%23mermaid-_r_vj_%20.error-icon%7Bfill%3Argb\(33%2C%2033%2C%2033\)%3B%7D%23mermaid-_r_vj_%20.error-text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3Bstroke%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vj_%20.edge-thickness-normal%7Bstroke-width%3A1px%3B%7D%23mermaid-_r_vj_%20.edge-thickness-thick%7Bstroke-width%3A3.5px%3B%7D%23mermaid-_r_vj_%20.edge-pattern-solid%7Bstroke-dasharray%3A0%3B%7D%23mermaid-_r_vj_%20.edge-thickness-invisible%7Bstroke-width%3A0%3Bfill%3Anone%3B%7D%23mermaid-_r_vj_%20.edge-pattern-dashed%7Bstroke-dasharray%3A3%3B%7D%23mermaid-_r_vj_%20.edge-pattern-dotted%7Bstroke-dasharray%3A2%3B%7D%23mermaid-_r_vj_%20.marker%7Bfill%3Argb\(205%2C%20205%2C%20205\)%3Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vj_%20.marker.cross%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vj_%20svg%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A14px%3B%7D%23mermaid-_r_vj_%20p%7Bmargin%3A0%3B%7D%23mermaid-_r_vj_%20.label%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vj_%20.cluster-label%20text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vj_%20.cluster-label%20span%7Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vj_%20.cluster-label%20span%20p%7Bbackground-color%3Atransparent%3B%7D%23mermaid-_r_vj_%20.label%20text%2C%23mermaid-_r_vj_%20span%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vj_%20.node%20rect%2C%23mermaid-_r_vj_%20.node%20circle%2C%23mermaid-_r_vj_%20.node%20ellipse%2C%23mermaid-_r_vj_%20.node%20polygon%2C%23mermaid-_r_vj_%20.node%20path%7Bfill%3Argb\(9%2C%2023%2C%2044\)%3Bstroke%3Argb\(31%2C%2078%2C%20148\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vj_%20.rough-node%20.label%20text%2C%23mermaid-_r_vj_%20.node%20.label%20text%2C%23mermaid-_r_vj_%20.image-shape%20.label%2C%23mermaid-_r_vj_%20.icon-shape%20.label%7Btext-anchor%3Amiddle%3B%7D%23mermaid-_r_vj_%20.node%20.katex%20path%7Bfill%3A%23000%3Bstroke%3A%23000%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vj_%20.rough-node%20.label%2C%23mermaid-_r_vj_%20.node%20.label%2C%23mermaid-_r_vj_%20.image-shape%20.label%2C%23mermaid-_r_vj_%20.icon-shape%20.label%7Btext-align%3Acenter%3B%7D%23mermaid-_r_vj_%20.node.clickable%7Bcursor%3Apointer%3B%7D%23mermaid-_r_vj_%20.root%20.anchor%20path%7Bfill%3Argb\(205%2C%20205%2C%20205\)!important%3Bstroke-width%3A0%3Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vj_%20.arrowheadPath%7Bfill%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vj_%20.edgePath%20.path%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3Bstroke-width%3A2.0px%3B%7D%23mermaid-_r_vj_%20.flowchart-link%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3Bfill%3Anone%3B%7D%23mermaid-_r_vj_%20.edgeLabel%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Btext-align%3Acenter%3B%7D%23mermaid-_r_vj_%20.edgeLabel%20p%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vj_%20.edgeLabel%20rect%7Bopacity%3A0.5%3Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bfill%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vj_%20.labelBkg%7Bbackground-color%3Argba\(0%2C%200%2C%200%2C%200.5\)%3B%7D%23mermaid-_r_vj_%20.cluster%20rect%7Bfill%3Argb\(33%2C%2033%2C%2033\)%3Bstroke%3Argba\(255%2C%20255%2C%20255%2C%200.05\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vj_%20.cluster%20text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vj_%20.cluster%20span%7Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vj_%20div.mermaidTooltip%7Bposition%3Aabsolute%3Btext-align%3Acenter%3Bmax-width%3A200px%3Bpadding%3A2px%3Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A12px%3Bbackground%3Argb\(33%2C%2033%2C%2033\)%3Bborder%3A1px%20solid%20rgba\(255%2C%20255%2C%20255%2C%200.05\)%3Bborder-radius%3A2px%3Bpointer-events%3Anone%3Bz-index%3A100%3B%7D%23mermaid-_r_vj_%20.flowchartTitleText%7Btext-anchor%3Amiddle%3Bfont-size%3A18px%3Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vj_%20rect.text%7Bfill%3Anone%3Bstroke-width%3A0%3B%7D%23mermaid-_r_vj_%20.icon-shape%2C%23mermaid-_r_vj_%20.image-shape%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Btext-align%3Acenter%3B%7D%23mermaid-_r_vj_%20.icon-shape%20p%2C%23mermaid-_r_vj_%20.image-shape%20p%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bpadding%3A2px%3B%7D%23mermaid-_r_vj_%20.icon-shape%20rect%2C%23mermaid-_r_vj_%20.image-shape%20rect%7Bopacity%3A0.5%3Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bfill%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vj_%20.label-icon%7Bdisplay%3Ainline-block%3Bheight%3A1em%3Boverflow%3Avisible%3Bvertical-align%3A-0.125em%3B%7D%23mermaid-_r_vj_%20.node%20.label-icon%20path%7Bfill%3AcurrentColor%3Bstroke%3Arevert%3Bstroke-width%3Arevert%3B%7D%23mermaid-_r_vj_%20.node%20text%7Bfont-size%3A16px%3Bfont-weight%3A600%3Bletter-spacing%3A-0.32px%3Bfill%3A%2399ceff%3B%7D%23mermaid-_r_vj_%20.edgeLabels%20text%7Bfont-size%3A13px%3Bfont-weight%3A600%3Bletter-spacing%3A-0.08px%3Bfill%3A%2399ceff%3B%7D%23mermaid-_r_vj_%20.node%20tspan%5Bfont-weight%3D%22normal%22%5D%2C%23mermaid-_r_vj_%20.edgeLabels%20tspan%5Bfont-weight%3D%22normal%22%5D%7Bfont-weight%3A600%3B%7D%23mermaid-_r_vj_%20.edgeLabel%20.label%20rect%7Bopacity%3A1%3Brx%3A13px%3Bry%3A13px%3Bfill%3A%23000e1a%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vj_%20.node%20rect%2C%23mermaid-_r_vj_%20.node%20circle%2C%23mermaid-_r_vj_%20.node%20ellipse%2C%23mermaid-_r_vj_%20.node%20polygon%2C%23mermaid-_r_vj_%20.node%20path%7Bfill%3Argb\(0%2C%2040%2C%2077\)%3Bstroke%3Argba\(255%2C%20255%2C%20255%2C%200.1\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vj_%20.node%20rect%7Brx%3A16px%3Bry%3A16px%3B%7D%23mermaid-_r_vj_%20.node.mermaid-decision%20.label-container%7Bfill%3A%23000e1a%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-dasharray%3A2%202%3B%7D%23mermaid-_r_vj_%20.edgePaths%20.flowchart-link%7Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-width%3A1px%3Bstroke-linecap%3Around%3Bstroke-linejoin%3Around%3B%7D%23mermaid-_r_vj_%20.marker%7Bfill%3Argb\(26%2C%2062%2C%2095\)%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3B%7D%23mermaid-_r_vj_%20.node%7Bcolor-scheme%3Adark%3B%7D%23mermaid-_r_vj_%20%3Aroot%7B--mermaid-font-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3B%7D%3C%2Fstyle%3E%3Cg%3E%3Cmarker%20id%3D%22mermaid-_r_vj__flowchart-v2-pointEnd%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%22-5%20-5%2010%2010%22%20refX%3D%220%22%20refY%3D%220%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%200%200%20L%204%200%20M%200.8180194846605362%20-3.181980515339464%20L%204%200%20L%200.8180194846605362%203.181980515339464%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%20none%3B%20fill%3A%20none%3B%20stroke-linecap%3A%20round%3B%20stroke-linejoin%3A%20round%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vj__flowchart-v2-pointStart%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%22-5%20-5%2010%2010%22%20refX%3D%220%22%20refY%3D%220%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%200%200%20L%20-4%200%20M%20-0.8180194846605362%20-3.181980515339464%20L%20-4%200%20L%20-0.8180194846605362%203.181980515339464%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%20none%3B%20fill%3A%20none%3B%20stroke-linecap%3A%20round%3B%20stroke-linejoin%3A%20round%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vj__flowchart-v2-circleEnd%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%220%200%2010%2010%22%20refX%3D%2211%22%20refY%3D%225%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Ccircle%20cx%3D%225%22%20cy%3D%225%22%20r%3D%225%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fcircle%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vj__flowchart-v2-circleStart%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%220%200%2010%2010%22%20refX%3D%22-1%22%20refY%3D%225%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Ccircle%20cx%3D%225%22%20cy%3D%225%22%20r%3D%225%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fcircle%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vj__flowchart-v2-crossEnd%22%20class%3D%22marker%20cross%20flowchart-v2%22%20viewBox%3D%220%200%2011%2011%22%20refX%3D%2212%22%20refY%3D%225.2%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%201%2C1%20l%209%2C9%20M%2010%2C1%20l%20-9%2C9%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%202%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vj__flowchart-v2-crossStart%22%20class%3D%22marker%20cross%20flowchart-v2%22%20viewBox%3D%220%200%2011%2011%22%20refX%3D%22-1%22%20refY%3D%225.2%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%201%2C1%20l%209%2C9%20M%2010%2C1%20l%20-9%2C9%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%202%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3C%2Fg%3E%3Cg%20class%3D%22subgraphs%22%3E%3Cg%20class%3D%22subgraph%22%3E%3Cg%20class%3D%22cluster%22%20id%3D%22Data%22%20data-look%3D%22classic%22%3E%3Crect%20style%3D%22%22%20x%3D%22395.86207580566406%22%20y%3D%22966.7999954223633%22%20width%3D%22840.6141662597656%22%20height%3D%22138%22%20rx%3D%2216%22%20ry%3D%2216%22%3E%3C%2Frect%3E%3Cg%20class%3D%22cluster-label%22%20transform%3D%22translate\(733.0441589355469%2C%20966.7999954223633\)%20translate\(0%2C%2016\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EData%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20AI%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20infrastructure%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22subgraph%22%3E%3Cg%20class%3D%22cluster%22%20id%3D%22Core%22%20data-look%3D%22classic%22%3E%3Crect%20style%3D%22%22%20x%3D%2212%22%20y%3D%22753.7999954223633%22%20width%3D%221226.2262420654297%22%20height%3D%22138%22%20rx%3D%2216%22%20ry%3D%2216%22%3E%3C%2Frect%3E%3Cg%20class%3D%22cluster-label%22%20transform%3D%22translate\(544.4139022827148%2C%20753.7999954223633\)%20translate\(0%2C%2016\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EShared%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20platform%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20services%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22subgraph%22%3E%3Cg%20class%3D%22cluster%22%20id%3D%22MCP%22%20data-look%3D%22classic%22%3E%3Crect%20style%3D%22%22%20x%3D%22572.6879526774088%22%20y%3D%22205%22%20width%3D%22536.611572265625%22%20height%3D%22433.7999954223633%22%20rx%3D%2216%22%20ry%3D%2216%22%3E%3C%2Frect%3E%3Cg%20class%3D%22cluster-label%22%20transform%3D%22translate\(761.8960825602213%2C%20205\)%20translate\(0%2C%2016\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ESmartSapp%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20MCP%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20Service%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22subgraph%22%3E%3Cg%20class%3D%22cluster%22%20id%3D%22Clients%22%20data-look%3D%22classic%22%3E%3Crect%20style%3D%22%22%20x%3D%22643.1490529378254%22%20y%3D%2212%22%20width%3D%22722.09375%22%20height%3D%22138%22%20rx%3D%2216%22%20ry%3D%2216%22%3E%3C%2Frect%3E%3Cg%20class%3D%22cluster-label%22%20transform%3D%22translate\(981.9888966878254%2C%2012\)%20translate\(0%2C%2016\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EClients%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22nodes%22%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-N-13%22%20transform%3D%22translate\(1003.2262420654297%2C%201062.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-68.375%22%20y%3D%22-30%22%20width%3D%22136.75%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EFirestore%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-O-14%22%20transform%3D%22translate\(1163.0387420654297%2C%201062.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-61.4375%22%20y%3D%22-30%22%20width%3D%22122.875%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EQdrant%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-P-15%22%20transform%3D%22translate\(803.8863983154297%2C%201062.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-100.96484375%22%20y%3D%22-30%22%20width%3D%22201.9296875%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EKnowledge%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20Graph%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-Q-16%22%20transform%3D%22translate\(540.3918151855469%2C%201062.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-132.52974700927734%22%20y%3D%22-30%22%20width%3D%22265.0594940185547%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EGenkit%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20model%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20gateway%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-I-8%22%20transform%3D%22translate\(105.36582946777344%2C%20849.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-81.36582946777344%22%20y%3D%22-30%22%20width%3D%22162.73165893554688%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ETool%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20registry%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-J-9%22%20transform%3D%22translate\(349.7746276855469%2C%20849.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-133.04296875%22%20y%3D%22-30%22%20width%3D%22266.0859375%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EPolicy%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20approval%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20engine%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-K-10%22%20transform%3D%22translate\(605.2796249389648%2C%20849.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-92.46203231811523%22%20y%3D%22-30%22%20width%3D%22184.92406463623047%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EContext%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20Builder%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-L-11%22%20transform%3D%22translate\(1099.8512420654297%2C%20849.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-126.375%22%20y%3D%22-30%22%20width%3D%22252.75%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EDomain%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20service%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20adapters%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-M-12%22%20transform%3D%22translate\(835.6089477539062%2C%20849.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-107.86729431152344%22%20y%3D%22-30%22%20width%3D%22215.73458862304688%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EAudit%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20telemetry%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-D-3%22%20transform%3D%22translate\(750.9080047607422%2C%20305.29999923706055\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-100.2890625%22%20y%3D%22-34.29999923706055%22%20width%3D%22200.578125%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EStreamable%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20HTTP%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Etransport%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-E-4%22%20transform%3D%22translate\(750.9080047607422%2C%20403.89999771118164\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-134.75390625%22%20y%3D%22-34.29999923706055%22%20width%3D%22269.5078125%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EAuthentication%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20request%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eidentity%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-F-5%22%20transform%3D%22translate\(750.9080047607422%2C%20502.49999618530273\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-130.90234375%22%20y%3D%22-34.29999923706055%22%20width%3D%22261.8046875%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ETool%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20discovery%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20toolset%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Efiltering%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-G-6%22%20transform%3D%22translate\(707.2738901774088%2C%20596.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-122.5859375%22%20y%3D%22-30%22%20width%3D%22245.171875%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EResources%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20prompts%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-H-7%22%20transform%3D%22translate\(978.5796763102213%2C%20596.7999954223633\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-118.7198486328125%22%20y%3D%22-30%22%20width%3D%22237.439697265625%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ETool%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20execution%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20adapter%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-A-0%22%20transform%3D%22translate\(1018.1529591878254%2C%20108\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-111.24609375%22%20y%3D%22-30%22%20width%3D%22222.4921875%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ENexus%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20in-app%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20agents%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-B-1%22%20transform%3D%22translate\(1256.3209279378254%2C%20108\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-96.921875%22%20y%3D%22-30%22%20width%3D%22193.84375%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EWorkflow%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20engine%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-C-2%22%20transform%3D%22translate\(766.0279591878254%2C%20108\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-110.87890625%22%20y%3D%22-30%22%20width%3D%22221.7578125%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EExternal%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20MCP%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20clients%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edges%20edgePaths%22%20mask%3D%22url\(%23mermaid-_r_vj_-subgraph-titles\)%22%3E%3Cpath%20d%3D%22M1018.1529591878254%2C138L1018.1529591878254%2C157.5L1018.1529591878254%2C197.5L1018.1529591878254%2C554.7999954223633%22%20id%3D%22L_A_H_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_A_H_0%22%20data-points%3D%22W3sieCI6MTAxOC4xNTI5NTkxODc4MjU0LCJ5IjoxMzh9LHsieCI6MTAxOC4xNTI5NTkxODc4MjU0LCJ5IjoxNTcuNX0seyJ4IjoxMDE4LjE1Mjk1OTE4NzgyNTQsInkiOjE5Ny41fSx7IngiOjEwMTguMTUyOTU5MTg3ODI1NCwieSI6NTU4Ljc5OTk5NTQyMjM2MzN9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M1256.3209279378254%2C138L1256.3209279378254%2C157.5L1256.3209279378254%2C170.71704397470535Q1256.3209279378254%2C172.5%201255.2351415001986%2C173.9142135623731L1255.2351415001986%2C173.9142135623731Q1254.1493550625717%2C175.32842712474618%201252.7351415001986%2C176.41421356237308L1252.7351415001986%2C176.4142135623731Q1251.3209279378254%2C177.5%201249.5379719125308%2C177.5L1148.7591980907243%2C177.5Q1146.9762420654297%2C177.5%201145.5620285030566%2C178.5857864376269L1145.5620285030566%2C178.58578643762692Q1144.1478149406835%2C179.67157287525382%201143.0620285030566%2C181.0857864376269L1143.0620285030566%2C181.0857864376269Q1141.9762420654297%2C182.5%201141.9762420654297%2C184.28295602529465L1141.9762420654297%2C421.89999771118164L1141.9762420654297%2C746.2999954223633L1141.9762420654297%2C807.7999954223633%22%20id%3D%22L_B_L_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_B_L_0%22%20data-points%3D%22W3sieCI6MTI1Ni4zMjA5Mjc5Mzc4MjU0LCJ5IjoxMzh9LHsieCI6MTI1Ni4zMjA5Mjc5Mzc4MjU0LCJ5IjoxNTcuNX0seyJ4IjoxMjU2LjMyMDkyNzkzNzgyNTQsInkiOjE3Ny41fSx7IngiOjExNDEuOTc2MjQyMDY1NDI5NywieSI6MTc3LjV9LHsieCI6MTE0MS45NzYyNDIwNjU0Mjk3LCJ5Ijo0MjEuODk5OTk3NzExMTgxNjR9LHsieCI6MTE0MS45NzYyNDIwNjU0Mjk3LCJ5Ijo3NDYuMjk5OTk1NDIyMzYzM30seyJ4IjoxMTQxLjk3NjI0MjA2NTQyOTcsInkiOjgxMS43OTk5OTU0MjIzNjMzfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M766.0279591878254%2C138L766.0279591878254%2C157.5L766.0279591878254%2C170.71704397470535Q766.0279591878254%2C172.5%20764.9421727501986%2C173.9142135623731L764.9421727501986%2C173.9142135623731Q763.8563863125717%2C175.32842712474618%20762.4421727501986%2C176.41421356237308L762.4421727501986%2C176.4142135623731Q761.0279591878254%2C177.5%20759.2450031625308%2C177.5L757.6909607860368%2C177.5Q755.9080047607422%2C177.5%20754.4937911983691%2C178.5857864376269L754.4937911983691%2C178.58578643762692Q753.079577635996%2C179.67157287525382%20751.9937911983691%2C181.0857864376269L751.9937911983691%2C181.0857864376269Q750.9080047607422%2C182.5%20750.9080047607422%2C184.28295602529465L750.9080047607422%2C197.5L750.9080047607422%2C259%22%20id%3D%22L_C_D_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_C_D_0%22%20data-points%3D%22W3sieCI6NzY2LjAyNzk1OTE4NzgyNTQsInkiOjEzOH0seyJ4Ijo3NjYuMDI3OTU5MTg3ODI1NCwieSI6MTU3LjV9LHsieCI6NzY2LjAyNzk1OTE4NzgyNTQsInkiOjE3Ny41fSx7IngiOjc1MC45MDgwMDQ3NjA3NDIyLCJ5IjoxNzcuNX0seyJ4Ijo3NTAuOTA4MDA0NzYwNzQyMiwieSI6MTk3LjV9LHsieCI6NzUwLjkwODAwNDc2MDc0MjIsInkiOjI2M31d%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M750.9080047607422%2C339.5999984741211L750.9080047607422%2C357.5999984741211%22%20id%3D%22L_D_E_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_D_E_0%22%20data-points%3D%22W3sieCI6NzUwLjkwODAwNDc2MDc0MjIsInkiOjMzOS41OTk5OTg0NzQxMjExfSx7IngiOjc1MC45MDgwMDQ3NjA3NDIyLCJ5IjozNjEuNTk5OTk4NDc0MTIxMX1d%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M750.9080047607422%2C438.1999969482422L750.9080047607422%2C456.1999969482422%22%20id%3D%22L_E_F_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_E_F_0%22%20data-points%3D%22W3sieCI6NzUwLjkwODAwNDc2MDc0MjIsInkiOjQzOC4xOTk5OTY5NDgyNDIyfSx7IngiOjc1MC45MDgwMDQ3NjA3NDIyLCJ5Ijo0NjAuMTk5OTk2OTQ4MjQyMn1d%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M707.2738901774088%2C536.7999954223633L707.2738901774088%2C554.7999954223633%22%20id%3D%22L_F_G_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_F_G_0%22%20data-points%3D%22W3sieCI6NzA3LjI3Mzg5MDE3NzQwODgsInkiOjUzNi43OTk5OTU0MjIzNjMzfSx7IngiOjcwNy4yNzM4OTAxNzc0MDg4LCJ5Ijo1NTguNzk5OTk1NDIyMzYzM31d%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M794.5421193440754%2C536.7999954223633L794.5421193440754%2C545.0170393970686Q794.5421193440754%2C546.7999954223633%20795.6279057817023%2C548.2142089847364L795.6279057817023%2C548.2142089847364Q796.7136922193292%2C549.6284225471095%20798.1279057817023%2C550.7142089847364L798.1279057817023%2C550.7142089847364Q799.5421193440754%2C551.7999954223633%20801.3250753693701%2C551.7999954223633L932.2234374073225%2C551.7999954223633Q934.0063934326172%2C551.7999954223633%20935.4206069949903%2C552.8857818599902L935.4206069949903%2C552.8857818599902Q936.8348205573634%2C553.9715682976171%20937.9206069949903%2C555.3857818599902L938.2451671164441%2C555.8085144615952Q939.0063934326172%2C556.7999954223633%20939.0063934326172%2C558.0499954223633L939.0063934326172%2C559.2999954223633%22%20id%3D%22L_F_H_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_F_H_0%22%20data-points%3D%22W3sieCI6Nzk0LjU0MjExOTM0NDA3NTQsInkiOjUzNi43OTk5OTU0MjIzNjMzfSx7IngiOjc5NC41NDIxMTkzNDQwNzU0LCJ5Ijo1NTEuNzk5OTk1NDIyMzYzM30seyJ4Ijo5MzkuMDA2MzkzNDMyNjE3MiwieSI6NTUxLjc5OTk5NTQyMjM2MzN9LHsieCI6OTM5LjAwNjM5MzQzMjYxNzIsInkiOjU2My4yOTk5OTU0MjIzNjMzfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M899.433110555013%2C626.7999954223633L899.433110555013%2C646.2999954223633L899.433110555013%2C659.5170393970686Q899.433110555013%2C661.2999954223633%20898.347324117386%2C662.7142089847364L898.347324117386%2C662.7142089847364Q897.2615376797592%2C664.1284225471095%20895.847324117386%2C665.2142089847364L895.847324117386%2C665.2142089847364Q894.433110555013%2C666.2999954223633%20892.6501545297183%2C666.2999954223633L112.14878549306809%2C666.2999954223633Q110.36582946777344%2C666.2999954223633%20108.95161590540035%2C667.3857818599902L108.95161590540035%2C667.3857818599902Q107.53740234302725%2C668.4715682976171%20106.45161590540036%2C669.8857818599902L106.45161590540035%2C669.8857818599902Q105.36582946777344%2C671.2999954223633%20105.36582946777344%2C673.0829514476579L105.36582946777344%2C746.2999954223633L105.36582946777344%2C807.7999954223633%22%20id%3D%22L_H_I_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_H_I_0%22%20data-points%3D%22W3sieCI6ODk5LjQzMzExMDU1NTAxMywieSI6NjI2Ljc5OTk5NTQyMjM2MzN9LHsieCI6ODk5LjQzMzExMDU1NTAxMywieSI6NjQ2LjI5OTk5NTQyMjM2MzN9LHsieCI6ODk5LjQzMzExMDU1NTAxMywieSI6NjY2LjI5OTk5NTQyMjM2MzN9LHsieCI6MTA1LjM2NTgyOTQ2Nzc3MzQ0LCJ5Ijo2NjYuMjk5OTk1NDIyMzYzM30seyJ4IjoxMDUuMzY1ODI5NDY3NzczNDQsInkiOjc0Ni4yOTk5OTU0MjIzNjMzfSx7IngiOjEwNS4zNjU4Mjk0Njc3NzM0NCwieSI6ODExLjc5OTk5NTQyMjM2MzN9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M939.0063934326172%2C626.7999954223633L939.0063934326172%2C646.2999954223633L939.0063934326172%2C679.5170393970686Q939.0063934326172%2C681.2999954223633%20937.9206069949903%2C682.7142089847364L937.9206069949903%2C682.7142089847364Q936.8348205573634%2C684.1284225471095%20935.4206069949903%2C685.2142089847364L935.4206069949903%2C685.2142089847364Q934.0063934326172%2C686.2999954223633%20932.2234374073225%2C686.2999954223633L356.5575837108415%2C686.2999954223633Q354.7746276855469%2C686.2999954223633%20353.36041412317377%2C687.3857818599902L353.36041412317377%2C687.3857818599902Q351.94620056080066%2C688.4715682976171%20350.86041412317377%2C689.8857818599902L350.86041412317377%2C689.8857818599902Q349.7746276855469%2C691.2999954223633%20349.7746276855469%2C693.0829514476579L349.7746276855469%2C746.2999954223633L349.7746276855469%2C807.7999954223633%22%20id%3D%22L_H_J_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_H_J_0%22%20data-points%3D%22W3sieCI6OTM5LjAwNjM5MzQzMjYxNzIsInkiOjYyNi43OTk5OTU0MjIzNjMzfSx7IngiOjkzOS4wMDYzOTM0MzI2MTcyLCJ5Ijo2NDYuMjk5OTk1NDIyMzYzM30seyJ4Ijo5MzkuMDA2MzkzNDMyNjE3MiwieSI6Njg2LjI5OTk5NTQyMjM2MzN9LHsieCI6MzQ5Ljc3NDYyNzY4NTU0NjksInkiOjY4Ni4yOTk5OTU0MjIzNjMzfSx7IngiOjM0OS43NzQ2Mjc2ODU1NDY5LCJ5Ijo3NDYuMjk5OTk1NDIyMzYzM30seyJ4IjozNDkuNzc0NjI3Njg1NTQ2OSwieSI6ODExLjc5OTk5NTQyMjM2MzN9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M978.5796763102213%2C626.7999954223633L978.5796763102213%2C646.2999954223633L978.5796763102213%2C699.5170393970686Q978.5796763102213%2C701.2999954223633%20977.4938898725944%2C702.7142089847364L977.4938898725944%2C702.7142089847364Q976.4081034349675%2C704.1284225471095%20974.9938898725944%2C705.2142089847364L974.9938898725944%2C705.2142089847364Q973.5796763102213%2C706.2999954223633%20971.7967202849267%2C706.2999954223633L612.0625809642595%2C706.2999954223633Q610.2796249389648%2C706.2999954223633%20608.8654113765917%2C707.3857818599902L608.8654113765917%2C707.3857818599902Q607.4511978142186%2C708.4715682976171%20606.3654113765917%2C709.8857818599902L606.3654113765917%2C709.8857818599902Q605.2796249389648%2C711.2999954223633%20605.2796249389648%2C713.0829514476579L605.2796249389648%2C746.2999954223633L605.2796249389648%2C807.7999954223633%22%20id%3D%22L_H_K_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_H_K_0%22%20data-points%3D%22W3sieCI6OTc4LjU3OTY3NjMxMDIyMTMsInkiOjYyNi43OTk5OTU0MjIzNjMzfSx7IngiOjk3OC41Nzk2NzYzMTAyMjEzLCJ5Ijo2NDYuMjk5OTk1NDIyMzYzM30seyJ4Ijo5NzguNTc5Njc2MzEwMjIxMywieSI6NzA2LjI5OTk5NTQyMjM2MzN9LHsieCI6NjA1LjI3OTYyNDkzODk2NDgsInkiOjcwNi4yOTk5OTU0MjIzNjMzfSx7IngiOjYwNS4yNzk2MjQ5Mzg5NjQ4LCJ5Ijo3NDYuMjk5OTk1NDIyMzYzM30seyJ4Ijo2MDUuMjc5NjI0OTM4OTY0OCwieSI6ODExLjc5OTk5NTQyMjM2MzN9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M1057.7262420654297%2C626.7999954223633L1057.7262420654297%2C646.2999954223633L1057.7262420654297%2C746.2999954223633L1057.7262420654297%2C807.7999954223633%22%20id%3D%22L_H_L_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_H_L_0%22%20data-points%3D%22W3sieCI6MTA1Ny43MjYyNDIwNjU0Mjk3LCJ5Ijo2MjYuNzk5OTk1NDIyMzYzM30seyJ4IjoxMDU3LjcyNjI0MjA2NTQyOTcsInkiOjY0Ni4yOTk5OTU0MjIzNjMzfSx7IngiOjEwNTcuNzI2MjQyMDY1NDI5NywieSI6NzQ2LjI5OTk5NTQyMjM2MzN9LHsieCI6MTA1Ny43MjYyNDIwNjU0Mjk3LCJ5Ijo4MTEuNzk5OTk1NDIyMzYzM31d%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M1018.1529591878256%2C626.7999954223633L1018.1529591878254%2C646.2999954223633L1018.1529591878254%2C719.5170393970686Q1018.1529591878254%2C721.2999954223633%201017.0671727501986%2C722.7142089847364L1017.0671727501986%2C722.7142089847364Q1015.9813863125717%2C724.1284225471095%201014.5671727501986%2C725.2142089847364L1014.5671727501986%2C725.2142089847364Q1013.1529591878254%2C726.2999954223633%201011.3700031625308%2C726.2999954223633L842.3919037792009%2C726.2999954223633Q840.6089477539062%2C726.2999954223633%20839.1947341915331%2C727.3857818599902L839.1947341915331%2C727.3857818599902Q837.78052062916%2C728.4715682976171%20836.6947341915331%2C729.8857818599902L836.6947341915331%2C729.8857818599902Q835.6089477539062%2C731.2999954223633%20835.6089477539062%2C733.0829514476579L835.6089477539062%2C746.2999954223633L835.6089477539062%2C807.7999954223633%22%20id%3D%22L_H_M_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_H_M_0%22%20data-points%3D%22W3sieCI6MTAxOC4xNTI5NTkxODc4MjU2LCJ5Ijo2MjYuNzk5OTk1NDIyMzYzM30seyJ4IjoxMDE4LjE1Mjk1OTE4NzgyNTQsInkiOjY0Ni4yOTk5OTU0MjIzNjMzfSx7IngiOjEwMTguMTUyOTU5MTg3ODI1NCwieSI6NzI2LjI5OTk5NTQyMjM2MzN9LHsieCI6ODM1LjYwODk0Nzc1MzkwNjIsInkiOjcyNi4yOTk5OTU0MjIzNjMzfSx7IngiOjgzNS42MDg5NDc3NTM5MDYyLCJ5Ijo3NDYuMjk5OTk1NDIyMzYzM30seyJ4Ijo4MzUuNjA4OTQ3NzUzOTA2MiwieSI6ODExLjc5OTk5NTQyMjM2MzN9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M1099.8512420654297%2C879.7999954223633L1099.8512420654297%2C899.2999954223633L1099.8512420654297%2C932.5170393970686Q1099.8512420654297%2C934.2999954223633%201098.7654556278028%2C935.7142089847364L1098.7654556278028%2C935.7142089847364Q1097.679669190176%2C937.1284225471095%201096.2654556278028%2C938.2142089847364L1096.2654556278028%2C938.2142089847364Q1094.8512420654297%2C939.2999954223633%201093.068286040135%2C939.2999954223633L1010.0091980907243%2C939.2999954223633Q1008.2262420654297%2C939.2999954223633%201006.8120285030566%2C940.3857818599902L1006.8120285030566%2C940.3857818599902Q1005.3978149406835%2C941.4715682976171%201004.3120285030566%2C942.8857818599902L1004.3120285030566%2C942.8857818599902Q1003.2262420654297%2C944.2999954223633%201003.2262420654297%2C946.0829514476579L1003.2262420654297%2C959.2999954223633L1003.2262420654297%2C1020.7999954223633%22%20id%3D%22L_L_N_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_L_N_0%22%20data-points%3D%22W3sieCI6MTA5OS44NTEyNDIwNjU0Mjk3LCJ5Ijo4NzkuNzk5OTk1NDIyMzYzM30seyJ4IjoxMDk5Ljg1MTI0MjA2NTQyOTcsInkiOjg5OS4yOTk5OTU0MjIzNjMzfSx7IngiOjEwOTkuODUxMjQyMDY1NDI5NywieSI6OTM5LjI5OTk5NTQyMjM2MzN9LHsieCI6MTAwMy4yMjYyNDIwNjU0Mjk3LCJ5Ijo5MzkuMjk5OTk1NDIyMzYzM30seyJ4IjoxMDAzLjIyNjI0MjA2NTQyOTcsInkiOjk1OS4yOTk5OTU0MjIzNjMzfSx7IngiOjEwMDMuMjI2MjQyMDY1NDI5NywieSI6MTAyNC43OTk5OTU0MjIzNjMzfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M1163.03874206543%2C879.7999954223633L1163.0387420654297%2C899.2999954223633L1163.0387420654297%2C959.2999954223633L1163.0387420654297%2C1020.7999954223633%22%20id%3D%22L_L_O_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_L_O_0%22%20data-points%3D%22W3sieCI6MTE2My4wMzg3NDIwNjU0MywieSI6ODc5Ljc5OTk5NTQyMjM2MzN9LHsieCI6MTE2My4wMzg3NDIwNjU0Mjk3LCJ5Ijo4OTkuMjk5OTk1NDIyMzYzM30seyJ4IjoxMTYzLjAzODc0MjA2NTQyOTcsInkiOjk1OS4yOTk5OTU0MjIzNjMzfSx7IngiOjExNjMuMDM4NzQyMDY1NDI5NywieSI6MTAyNC43OTk5OTU0MjIzNjMzfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M1036.6637420654295%2C879.7999954223633L1036.6637420654297%2C899.2999954223633L1036.6637420654297%2C912.5170393970686Q1036.6637420654297%2C914.2999954223633%201035.5779556278028%2C915.7142089847364L1035.5779556278028%2C915.7142089847364Q1034.492169190176%2C917.1284225471095%201033.0779556278028%2C918.2142089847364L1033.0779556278028%2C918.2142089847364Q1031.6637420654297%2C919.2999954223633%201029.880786040135%2C919.2999954223633L810.6693543407243%2C919.2999954223633Q808.8863983154297%2C919.2999954223633%20807.4721847530566%2C920.3857818599902L807.4721847530566%2C920.3857818599902Q806.0579711906835%2C921.4715682976171%20804.9721847530566%2C922.8857818599902L804.9721847530566%2C922.8857818599902Q803.8863983154297%2C924.2999954223633%20803.8863983154297%2C926.0829514476579L803.8863983154297%2C959.2999954223633L803.8863983154297%2C1020.7999954223633%22%20id%3D%22L_L_P_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_L_P_0%22%20data-points%3D%22W3sieCI6MTAzNi42NjM3NDIwNjU0Mjk1LCJ5Ijo4NzkuNzk5OTk1NDIyMzYzM30seyJ4IjoxMDM2LjY2Mzc0MjA2NTQyOTcsInkiOjg5OS4yOTk5OTU0MjIzNjMzfSx7IngiOjEwMzYuNjYzNzQyMDY1NDI5NywieSI6OTE5LjI5OTk5NTQyMjM2MzN9LHsieCI6ODAzLjg4NjM5ODMxNTQyOTcsInkiOjkxOS4yOTk5OTU0MjIzNjMzfSx7IngiOjgwMy44ODYzOTgzMTU0Mjk3LCJ5Ijo5NTkuMjk5OTk1NDIyMzYzM30seyJ4Ijo4MDMuODg2Mzk4MzE1NDI5NywieSI6MTAyNC43OTk5OTU0MjIzNjMzfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M605.2796249389648%2C879.7999954223633L605.2796249389648%2C899.2999954223633L605.2796249389648%2C912.5170393970686Q605.2796249389648%2C914.2999954223633%20604.193838501338%2C915.7142089847364L604.193838501338%2C915.7142089847364Q603.108052063711%2C917.1284225471095%20601.693838501338%2C918.2142089847364L601.693838501338%2C918.2142089847364Q600.2796249389648%2C919.2999954223633%20598.4966689136702%2C919.2999954223633L547.1747712108415%2C919.2999954223633Q545.3918151855469%2C919.2999954223633%20543.9776016231738%2C920.3857818599902L543.9776016231738%2C920.3857818599902Q542.5633880608007%2C921.4715682976171%20541.4776016231738%2C922.8857818599902L541.4776016231738%2C922.8857818599902Q540.3918151855469%2C924.2999954223633%20540.3918151855469%2C926.0829514476579L540.3918151855469%2C959.2999954223633L540.3918151855469%2C1020.7999954223633%22%20id%3D%22L_K_Q_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_K_Q_0%22%20data-points%3D%22W3sieCI6NjA1LjI3OTYyNDkzODk2NDgsInkiOjg3OS43OTk5OTU0MjIzNjMzfSx7IngiOjYwNS4yNzk2MjQ5Mzg5NjQ4LCJ5Ijo4OTkuMjk5OTk1NDIyMzYzM30seyJ4Ijo2MDUuMjc5NjI0OTM4OTY0OCwieSI6OTE5LjI5OTk5NTQyMjM2MzN9LHsieCI6NTQwLjM5MTgxNTE4NTU0NjksInkiOjkxOS4yOTk5OTU0MjIzNjMzfSx7IngiOjU0MC4zOTE4MTUxODU1NDY5LCJ5Ijo5NTkuMjk5OTk1NDIyMzYzM30seyJ4Ijo1NDAuMzkxODE1MTg1NTQ2OSwieSI6MTAyNC43OTk5OTU0MjIzNjMzfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vj__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabels%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_A_H_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_B_L_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_C_D_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_D_E_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_E_F_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_F_G_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_F_H_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_H_I_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_H_J_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_H_K_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_H_L_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_H_M_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_L_N_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_L_O_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_L_P_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_K_Q_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cdefs%3E%3Cmask%20id%3D%22mermaid-_r_vj_-subgraph-titles%22%20maskUnits%3D%22userSpaceOnUse%22%20x%3D%2289.36582946777344%22%20y%3D%22122%22%20width%3D%221182.955078125%22%20height%3D%22914.7999877929688%22%20style%3D%22mask-type%3A%20luminance%3B%22%3E%3Crect%20x%3D%2289.36582946777344%22%20y%3D%22122%22%20width%3D%221182.955078125%22%20height%3D%22914.7999877929688%22%20fill%3D%22white%22%3E%3C%2Frect%3E%3Crect%20x%3D%22-4%22%20y%3D%22-3.4999990463256836%22%20width%3D%22174.25%22%20height%3D%2224.5%22%20transform%3D%22matrix\(1%2C0%2C0%2C1%2C733.044189453125%2C982.7999877929688\)%22%20fill%3D%22black%22%3E%3C%2Frect%3E%3Crect%20x%3D%22-4%22%20y%3D%22-3.4999990463256836%22%20width%3D%22169.3984375%22%20height%3D%2224.5%22%20transform%3D%22matrix\(1%2C0%2C0%2C1%2C544.4138793945312%2C769.7999877929688\)%22%20fill%3D%22black%22%3E%3C%2Frect%3E%3Crect%20x%3D%22-4%22%20y%3D%22-3.4999990463256836%22%20width%3D%22166.1953125%22%20height%3D%2224.5%22%20transform%3D%22matrix\(1%2C0%2C0%2C1%2C761.8960571289062%2C221\)%22%20fill%3D%22black%22%3E%3C%2Frect%3E%3Crect%20x%3D%22-4%22%20y%3D%22-3.4999990463256836%22%20width%3D%2252.4140625%22%20height%3D%2224.5%22%20transform%3D%22matrix\(1%2C0%2C0%2C1%2C981.9888916015625%2C28\)%22%20fill%3D%22black%22%3E%3C%2Frect%3E%3C%2Fmask%3E%3C%2Fdefs%3E%3C%2Fsvg%3E)

### Recommended implementation decisions

* SDK: Use the official TypeScript MCP SDK (`@modelcontextprotocol/sdk`) for the protocol adapter.

* Transport: Use Streamable HTTP for remote MCP access. Keep local development and IDE integration options separate from production authentication.

* In-app calls: Let internal agents use the same canonical tool definitions and execution services directly, without requiring every call to cross the MCP transport.

* Authentication: Integrate with SmartSapp's authenticated identity and authorization model. Implement the applicable MCP HTTP authorization requirements for external clients.

  ![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

  GitHub

  +1

* Toolsets: Expose domain-specific toolsets such as `crm`, `knowledge`, `campaigns`, and `finance`. Filter them by client, tenant, user permissions and agent role.

* Versioning: Version public contracts independently of internal implementation files.

* Isolation: Do not allow an external MCP client to access Firestore, Qdrant or privileged domain services directly.

MCP supports tools, resources and prompts as distinct primitives. Use all three rather than representing the entire platform as a large list of callable functions.

![](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1

## 5.1 What belongs in MCP resources and prompts?

### Resources — contextual data

Use resources for stable, addressable information that an authorized client needs to inspect.

* Organization and workspace profiles.

* Approved playbooks and policies.

* Knowledge item details and evidence.

* Deal or contact briefings.

* Knowledge graph snapshots.

* Tool catalog documentation and schemas.

### Prompts — reusable interaction patterns

Use prompts for reusable workflows or user-invoked templates, not for enforcing security.

* “Prepare for this meeting.”

* “Review this deal for risk.”

* “Build a campaign from our approved knowledge.”

* “Summarize what we learned from these meetings.”

* “Review this proposed organizational memory.”

* “Prepare an executive weekly briefing.”

### Tools — executable operations

Use tools for retrieval operations, business actions, proposals, workflow control and approved mutations.

* `knowledge.search`

* `context.build`

* `deal.get_intelligence`

* `task.create`

* `message.request_approval`

* `automation.simulate`

Resources and prompts must be authorized too. A resource URI is an identifier, not a security boundary.

# 6. Standard tool contracts

Every tool should follow a consistent contract. This makes it possible for an AI coding agent to implement tools systematically without inventing incompatible schemas.

## 6.1 Example: searching shared knowledge

The following is an illustrative internal TypeScript contract. Adapt field names to the actual SmartSapp types.

TypeScript

```
import { z } from "zod";

export const KnowledgeSearchInput = z.object({
  query: z.string().trim().min(1).max(1000),
  workspaceId: z.string().min(1),
  sources: z.array(
    z.enum([
      "notes",
      "memories",
      "meetings",
      "documents",
      "decisions",
      "playbooks"
    ])
  ).optional(),
  entityIds: z.array(z.string().min(1)).max(50).optional(),
  limit: z.number().int().min(1).max(20).default(10),
  includeEvidence: z.boolean().default(true)
}).strict();

export const KnowledgeSearchResult = z.object({
  items: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    summary: z.string(),
    sourceId: z.string(),
    sourceType: z.string(),
    updatedAt: z.string(),
    relevance: z.number().min(0).max(1),
    evidence: z.array(z.object({
      sourceId: z.string(),
      excerpt: z.string(),
      startOffset: z.number().int().optional(),
      endOffset: z.number().int().optional()
    }))
  })),
  nextCursor: z.string().optional()
}).strict();

export type KnowledgeSearchInput =
  z.infer<typeof KnowledgeSearchInput>;

export type KnowledgeSearchResult =
  z.infer<typeof KnowledgeSearchResult>;
```

The service must derive the actor's accessible organization and enforce workspace access before querying. The `workspaceId` supplied in the input is a requested scope, not proof of access.

The result must include source references and only the evidence the actor is allowed to see. Do not return internal embeddings, secrets or unrestricted raw database records.

## 6.2 Example: proposing a memory

A memory proposal should be a distinct operation from approving or publishing the memory.

TypeScript

```
export const ProposeMemoryInput = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10000),
  memoryType: z.enum([
    "fact",
    "decision",
    "preference",
    "procedure",
    "lesson",
    "relationship"
  ]),
  sourceRefs: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    sourceVersion: z.string().optional()
  })).min(1).max(20),
  reviewReason: z.string().max(1000).optional()
}).strict();
```

The execution service should then:

1. Authenticate the actor and validate workspace access.

2. Verify access to every referenced source.

3. Check for duplicates and conflicting existing memories.

4. Apply sensitivity, retention and evidence requirements.

5. Create a `pending_review` candidate or an appropriately governed record.

6. Emit a memory-proposed event and write an audit entry.

7. Return the proposal ID and review status.

The agent should not be able to supply its own `approvedBy`, assign itself reviewer privileges, or mark a memory as verified merely by including those values in the request.

## 6.3 A common execution envelope

For auditable operations, persist an execution record containing:

TypeScript

```
type ToolExecutionRecord = {
  executionId: string;
  toolName: string;
  toolVersion: string;
  actorId: string;
  organizationId: string;
  workspaceId?: string;
  agentRunId?: string;
  idempotencyKey?: string;
  resourceRefs: string[];
  policyDecision: "allow" | "deny" | "approval_required";
  approvalRefs: string[];
  status:
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled";
  startedAt: string;
  completedAt?: string;
  resultRef?: string;
  errorCode?: string;
};
```

Store detailed execution state and audit events separately from the model's conversational history. Do not log full message bodies, secrets or sensitive source content by default.

# 7. How to identify every tool the coding agent has missed

This is the most important part of the implementation brief.

The inventory above is a target capability catalog. It is not yet a verified, exhaustive inventory of SmartSapp's actual codebase. The AI agent implementing it must inspect the repository and reconcile every existing capability against this catalog.

Do not instruct the coding agent to simply “build all these tools.” That encourages it to invent functionality, duplicate services and overlook existing APIs.

Instead, require a repository-driven capability discovery and reconciliation process.

## 7.1 The discovery process

1. Discover all existing business operations.

   Scan server actions, API routes, Genkit flows, domain services, repository classes, webhook handlers, Cloud Tasks jobs, scheduled jobs, event handlers and Firestore collection access.

   Inspect the implementation and authorization checks, not just filenames or exported function names.

2. Build a canonical capability inventory.

   For each operation, record its business purpose, inputs, outputs, implementation, collections touched, side effects, permissions, tenancy requirements and current tests.

3. Map operations to the target tool catalog.

   Assign each capability one of four statuses: `reuse`, `wrap`, `extend`, or `missing`. Identify duplicate functions and competing implementations.

4. Discover missing lifecycle operations.

   For every entity and workflow, ask whether the system can create, read, update, archive, restore, search, validate, approve, cancel, retry, reconcile and inspect history where those operations are relevant.

5. Trace cross-domain dependencies.

   Check that meetings can create tasks, deals can retrieve knowledge, campaigns can use brand memory, workflows can request approvals, and all relevant agents can build authorized context.

6. Test security and operational behavior.

   Verify tenant isolation, least privilege, source-level authorization, idempotency, error handling, concurrency, approval enforcement, observability and recovery.

7. Generate a gap report and implementation plan.

   No capability should be marked complete merely because a tool schema exists. Require implementation evidence, contract tests, authorization tests and documented behavior.

## 7.2 Repository surfaces that must be scanned

For SmartSapp, the inventory must include at least these surfaces:

|
Surface

|

What the agent must extract

|
| --- | --- |
|

`src/app/actions/**`

|

Existing server actions, business operations, authorization

|
|

`src/app/api/**`

|

REST endpoints, webhooks, external APIs, cron routes

|
|

`src/ai/flows/**`

|

Genkit flows, Zod schemas, prompt dependencies

|
|

`src/lib/services/**`

|

Canonical business logic and integrations

|
|

`src/lib/lead-intelligence/**`

|

Enrichment, SDR, scoring, attribution

|
|

`src/lib/services/ai-admin/**`

|

Proposal, approval, impact and execution capabilities

|
|

`src/lib/pms-*` and AI gateway

|

Prompt resolution, model routing and credential handling

|
|

Entity, deal, task and workflow types

|

Domain models, invariants, valid states

|
|

Firestore rules and authorization services

|

Access boundaries and tenant isolation

|
|

`cron/**`, task workers and schedulers

|

Asynchronous execution, retries, scheduled triggers

|
|

Webhook and messaging handlers

|

External side effects, event ingestion, deduplication

|
|

Tests and fixtures

|

Existing guarantees and untested assumptions

|
|

UI component actions and forms

|

User-visible capabilities not obvious from API names

|

Also inspect the actual note, knowledge, embedding and graph implementation from the separate Knowledge & Memory work. Do not assume a proposed Qdrant or graph schema is already implemented.

## 7.3 Build a coverage matrix

Require the coding agent to create a persistent artifact, for example:

`docs/ai-platform/tool-registry-capability-matrix.md`

Each discovered capability should have a row with the following fields:

|
Field

|

Example

|
| --- | --- |
|

Capability ID

|

`CAP-KNOW-001`

|
|

Domain

|

Knowledge

|
|

Operation

|

Semantic knowledge search

|
|

Existing implementation

|

Actual file and exported function

|
|

Canonical service

|

Existing service or proposed new service

|
|

Target tool name

|

`knowledge.search`

|
|

Current status

|

`reuse`, `wrap`, `extend`, `missing`

|
|

Read/write classification

|

Read-only

|
|

Required permissions

|

Exact existing or proposed permission

|
|

Tenant scope

|

Organization + workspace

|
|

Data dependencies

|

Firestore, Qdrant, graph

|
|

Side effects

|

None, or explicitly listed

|
|

Idempotency

|

Not applicable, or defined key

|
|

Failure behavior

|

Typed errors and retry policy

|
|

Tests

|

Existing tests and required additions

|
|

Phase

|

Planned delivery phase

|
|

Acceptance evidence

|

File, test result or review record

|

The report should also include:

* An unmapped capability list: existing operations not represented by a planned tool.

* An unimplemented requirement list: requested tools without an existing implementation.

* A duplicate implementation list: tools that would duplicate current logic.

* An authorization gap list: capabilities lacking proven access enforcement.

* An integration gap list: missing cross-domain handoffs.

* A test gap list: operations without sufficient behavior or security tests.

This is how you prevent the coding agent from silently omitting tools that are not mentioned in the initial specification.


# 8. Agent tool discovery: how agents know what to use

You should not give every agent the entire catalog of tools on every model call. SmartSapp will have too many capabilities, and irrelevant tools increase ambiguity and tool-selection errors.

Use a three-stage discovery mechanism.

Diagram options

![](data\:image/svg+xml;utf8,%3Csvg%20id%3D%22mermaid-_r_vk_%22%20width%3D%22710.2135620117188%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20class%3D%22flowchart%22%20height%3D%22810.4000244140625%22%20viewBox%3D%224%204%20710.2135620117188%20810.4000244140625%22%20role%3D%22graphics-document%20document%22%20aria-roledescription%3D%22flowchart-v2%22%3E%3Cstyle%3E%23mermaid-_r_vk_%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A14px%3Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%40keyframes%20edge-animation-frame%7Bfrom%7Bstroke-dashoffset%3A0%3B%7D%7D%40keyframes%20dash%7Bto%7Bstroke-dashoffset%3A0%3B%7D%7D%23mermaid-_r_vk_%20.edge-animation-slow%7Bstroke-dasharray%3A9%2C5!important%3Bstroke-dashoffset%3A900%3Banimation%3Adash%2050s%20linear%20infinite%3Bstroke-linecap%3Around%3B%7D%23mermaid-_r_vk_%20.edge-animation-fast%7Bstroke-dasharray%3A9%2C5!important%3Bstroke-dashoffset%3A900%3Banimation%3Adash%2020s%20linear%20infinite%3Bstroke-linecap%3Around%3B%7D%23mermaid-_r_vk_%20.error-icon%7Bfill%3Argb\(33%2C%2033%2C%2033\)%3B%7D%23mermaid-_r_vk_%20.error-text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3Bstroke%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vk_%20.edge-thickness-normal%7Bstroke-width%3A1px%3B%7D%23mermaid-_r_vk_%20.edge-thickness-thick%7Bstroke-width%3A3.5px%3B%7D%23mermaid-_r_vk_%20.edge-pattern-solid%7Bstroke-dasharray%3A0%3B%7D%23mermaid-_r_vk_%20.edge-thickness-invisible%7Bstroke-width%3A0%3Bfill%3Anone%3B%7D%23mermaid-_r_vk_%20.edge-pattern-dashed%7Bstroke-dasharray%3A3%3B%7D%23mermaid-_r_vk_%20.edge-pattern-dotted%7Bstroke-dasharray%3A2%3B%7D%23mermaid-_r_vk_%20.marker%7Bfill%3Argb\(205%2C%20205%2C%20205\)%3Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vk_%20.marker.cross%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vk_%20svg%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A14px%3B%7D%23mermaid-_r_vk_%20p%7Bmargin%3A0%3B%7D%23mermaid-_r_vk_%20.label%7Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vk_%20.cluster-label%20text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vk_%20.cluster-label%20span%7Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vk_%20.cluster-label%20span%20p%7Bbackground-color%3Atransparent%3B%7D%23mermaid-_r_vk_%20.label%20text%2C%23mermaid-_r_vk_%20span%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vk_%20.node%20rect%2C%23mermaid-_r_vk_%20.node%20circle%2C%23mermaid-_r_vk_%20.node%20ellipse%2C%23mermaid-_r_vk_%20.node%20polygon%2C%23mermaid-_r_vk_%20.node%20path%7Bfill%3Argb\(9%2C%2023%2C%2044\)%3Bstroke%3Argb\(31%2C%2078%2C%20148\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vk_%20.rough-node%20.label%20text%2C%23mermaid-_r_vk_%20.node%20.label%20text%2C%23mermaid-_r_vk_%20.image-shape%20.label%2C%23mermaid-_r_vk_%20.icon-shape%20.label%7Btext-anchor%3Amiddle%3B%7D%23mermaid-_r_vk_%20.node%20.katex%20path%7Bfill%3A%23000%3Bstroke%3A%23000%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vk_%20.rough-node%20.label%2C%23mermaid-_r_vk_%20.node%20.label%2C%23mermaid-_r_vk_%20.image-shape%20.label%2C%23mermaid-_r_vk_%20.icon-shape%20.label%7Btext-align%3Acenter%3B%7D%23mermaid-_r_vk_%20.node.clickable%7Bcursor%3Apointer%3B%7D%23mermaid-_r_vk_%20.root%20.anchor%20path%7Bfill%3Argb\(205%2C%20205%2C%20205\)!important%3Bstroke-width%3A0%3Bstroke%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vk_%20.arrowheadPath%7Bfill%3Argb\(205%2C%20205%2C%20205\)%3B%7D%23mermaid-_r_vk_%20.edgePath%20.path%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3Bstroke-width%3A2.0px%3B%7D%23mermaid-_r_vk_%20.flowchart-link%7Bstroke%3Argb\(205%2C%20205%2C%20205\)%3Bfill%3Anone%3B%7D%23mermaid-_r_vk_%20.edgeLabel%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Btext-align%3Acenter%3B%7D%23mermaid-_r_vk_%20.edgeLabel%20p%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vk_%20.edgeLabel%20rect%7Bopacity%3A0.5%3Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bfill%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vk_%20.labelBkg%7Bbackground-color%3Argba\(0%2C%200%2C%200%2C%200.5\)%3B%7D%23mermaid-_r_vk_%20.cluster%20rect%7Bfill%3Argb\(33%2C%2033%2C%2033\)%3Bstroke%3Argba\(255%2C%20255%2C%20255%2C%200.05\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vk_%20.cluster%20text%7Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vk_%20.cluster%20span%7Bcolor%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vk_%20div.mermaidTooltip%7Bposition%3Aabsolute%3Btext-align%3Acenter%3Bmax-width%3A200px%3Bpadding%3A2px%3Bfont-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3Bfont-size%3A12px%3Bbackground%3Argb\(33%2C%2033%2C%2033\)%3Bborder%3A1px%20solid%20rgba\(255%2C%20255%2C%20255%2C%200.05\)%3Bborder-radius%3A2px%3Bpointer-events%3Anone%3Bz-index%3A100%3B%7D%23mermaid-_r_vk_%20.flowchartTitleText%7Btext-anchor%3Amiddle%3Bfont-size%3A18px%3Bfill%3Argb\(255%2C%20255%2C%20255\)%3B%7D%23mermaid-_r_vk_%20rect.text%7Bfill%3Anone%3Bstroke-width%3A0%3B%7D%23mermaid-_r_vk_%20.icon-shape%2C%23mermaid-_r_vk_%20.image-shape%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Btext-align%3Acenter%3B%7D%23mermaid-_r_vk_%20.icon-shape%20p%2C%23mermaid-_r_vk_%20.image-shape%20p%7Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bpadding%3A2px%3B%7D%23mermaid-_r_vk_%20.icon-shape%20rect%2C%23mermaid-_r_vk_%20.image-shape%20rect%7Bopacity%3A0.5%3Bbackground-color%3Argb\(0%2C%200%2C%200\)%3Bfill%3Argb\(0%2C%200%2C%200\)%3B%7D%23mermaid-_r_vk_%20.label-icon%7Bdisplay%3Ainline-block%3Bheight%3A1em%3Boverflow%3Avisible%3Bvertical-align%3A-0.125em%3B%7D%23mermaid-_r_vk_%20.node%20.label-icon%20path%7Bfill%3AcurrentColor%3Bstroke%3Arevert%3Bstroke-width%3Arevert%3B%7D%23mermaid-_r_vk_%20.node%20text%7Bfont-size%3A16px%3Bfont-weight%3A600%3Bletter-spacing%3A-0.32px%3Bfill%3A%2399ceff%3B%7D%23mermaid-_r_vk_%20.edgeLabels%20text%7Bfont-size%3A13px%3Bfont-weight%3A600%3Bletter-spacing%3A-0.08px%3Bfill%3A%2399ceff%3B%7D%23mermaid-_r_vk_%20.node%20tspan%5Bfont-weight%3D%22normal%22%5D%2C%23mermaid-_r_vk_%20.edgeLabels%20tspan%5Bfont-weight%3D%22normal%22%5D%7Bfont-weight%3A600%3B%7D%23mermaid-_r_vk_%20.edgeLabel%20.label%20rect%7Bopacity%3A1%3Brx%3A13px%3Bry%3A13px%3Bfill%3A%23000e1a%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vk_%20.node%20rect%2C%23mermaid-_r_vk_%20.node%20circle%2C%23mermaid-_r_vk_%20.node%20ellipse%2C%23mermaid-_r_vk_%20.node%20polygon%2C%23mermaid-_r_vk_%20.node%20path%7Bfill%3Argb\(0%2C%2040%2C%2077\)%3Bstroke%3Argba\(255%2C%20255%2C%20255%2C%200.1\)%3Bstroke-width%3A1px%3B%7D%23mermaid-_r_vk_%20.node%20rect%7Brx%3A16px%3Bry%3A16px%3B%7D%23mermaid-_r_vk_%20.node.mermaid-decision%20.label-container%7Bfill%3A%23000e1a%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-dasharray%3A2%202%3B%7D%23mermaid-_r_vk_%20.edgePaths%20.flowchart-link%7Bstroke%3Argb\(26%2C%2062%2C%2095\)%3Bstroke-width%3A1px%3Bstroke-linecap%3Around%3Bstroke-linejoin%3Around%3B%7D%23mermaid-_r_vk_%20.marker%7Bfill%3Argb\(26%2C%2062%2C%2095\)%3Bstroke%3Argb\(26%2C%2062%2C%2095\)%3B%7D%23mermaid-_r_vk_%20.node%7Bcolor-scheme%3Adark%3B%7D%23mermaid-_r_vk_%20%3Aroot%7B--mermaid-font-family%3A%22-apple-system%22%2C%22BlinkMacSystemFont%22%2C%22Segoe%20UI%22%2C%22Roboto%22%2C%22Oxygen%22%2C%22Ubuntu%22%2C%22Cantarell%22%2C%22Helvetica%20Neue%22%2C%22Arial%22%2C%22sans-serif%22%3B%7D%3C%2Fstyle%3E%3Cg%3E%3Cmarker%20id%3D%22mermaid-_r_vk__flowchart-v2-pointEnd%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%22-5%20-5%2010%2010%22%20refX%3D%220%22%20refY%3D%220%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%200%200%20L%204%200%20M%200.8180194846605362%20-3.181980515339464%20L%204%200%20L%200.8180194846605362%203.181980515339464%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%20none%3B%20fill%3A%20none%3B%20stroke-linecap%3A%20round%3B%20stroke-linejoin%3A%20round%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vk__flowchart-v2-pointStart%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%22-5%20-5%2010%2010%22%20refX%3D%220%22%20refY%3D%220%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2210%22%20markerHeight%3D%2210%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%200%200%20L%20-4%200%20M%20-0.8180194846605362%20-3.181980515339464%20L%20-4%200%20L%20-0.8180194846605362%203.181980515339464%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%20none%3B%20fill%3A%20none%3B%20stroke-linecap%3A%20round%3B%20stroke-linejoin%3A%20round%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vk__flowchart-v2-circleEnd%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%220%200%2010%2010%22%20refX%3D%2211%22%20refY%3D%225%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Ccircle%20cx%3D%225%22%20cy%3D%225%22%20r%3D%225%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fcircle%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vk__flowchart-v2-circleStart%22%20class%3D%22marker%20flowchart-v2%22%20viewBox%3D%220%200%2010%2010%22%20refX%3D%22-1%22%20refY%3D%225%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Ccircle%20cx%3D%225%22%20cy%3D%225%22%20r%3D%225%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%201%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fcircle%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vk__flowchart-v2-crossEnd%22%20class%3D%22marker%20cross%20flowchart-v2%22%20viewBox%3D%220%200%2011%2011%22%20refX%3D%2212%22%20refY%3D%225.2%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%201%2C1%20l%209%2C9%20M%2010%2C1%20l%20-9%2C9%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%202%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3Cmarker%20id%3D%22mermaid-_r_vk__flowchart-v2-crossStart%22%20class%3D%22marker%20cross%20flowchart-v2%22%20viewBox%3D%220%200%2011%2011%22%20refX%3D%22-1%22%20refY%3D%225.2%22%20markerUnits%3D%22userSpaceOnUse%22%20markerWidth%3D%2211%22%20markerHeight%3D%2211%22%20orient%3D%22auto%22%3E%3Cpath%20d%3D%22M%201%2C1%20l%209%2C9%20M%2010%2C1%20l%20-9%2C9%22%20class%3D%22arrowMarkerPath%22%20style%3D%22stroke-width%3A%202%3B%20stroke-dasharray%3A%201%2C%200%3B%22%3E%3C%2Fpath%3E%3C%2Fmarker%3E%3C%2Fg%3E%3Cg%20class%3D%22subgraphs%22%3E%3C%2Fg%3E%3Cg%20class%3D%22nodes%22%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-A-0%22%20transform%3D%22translate\(241.48046875%2C%20142\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-107.63081359863281%22%20y%3D%22-30%22%20width%3D%22215.26162719726562%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EAgent%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20receives%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20task%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-B-1%22%20transform%3D%22translate\(241.48046875%2C%20246.29999923706055\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-130.30859375%22%20y%3D%22-34.29999923706055%22%20width%3D%22260.6171875%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EClassify%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20task%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20required%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Ecapabilities%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-C-3%22%20transform%3D%22translate\(241.48046875%2C%20354.89999771118164\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-126.2578125%22%20y%3D%22-34.29999923706055%22%20width%3D%22252.515625%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ECheck%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20actor%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20permissions%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eand%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20agent%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20policy%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-D-5%22%20transform%3D%22translate\(279.08984375%2C%20463.49999618530273\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-112.828125%22%20y%3D%22-34.29999923706055%22%20width%3D%22225.65625%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ERetrieve%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20relevant%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20tool%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Edefinitions%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-E-7%22%20transform%3D%22translate\(279.08984375%2C%20572.0999946594238\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-117.0703125%22%20y%3D%22-34.29999923706055%22%20width%3D%22234.140625%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ESelect%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20minimal%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20eligible%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Etoolset%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-F-9%22%20transform%3D%22translate\(279.08984375%2C%20676.3999938964844\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-124.55078125%22%20y%3D%22-30%22%20width%3D%22249.1015625%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EBuild%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20authorized%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20context%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-G-11%22%20transform%3D%22translate\(119.83203125%2C%20776.3999938964844\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-88.98046875%22%20y%3D%22-30%22%20width%3D%22177.9609375%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EPlan%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20execution%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-H-13%22%20transform%3D%22translate\(129.2578125%2C%2042\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-117.2578125%22%20y%3D%22-30%22%20width%3D%22234.515625%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EValidate%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20every%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20tool%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20call%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-I-15%22%20transform%3D%22translate\(538.48828125%2C%20142\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-134.42578125%22%20y%3D%22-30%22%20width%3D%22268.8515625%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EExecute%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20and%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20observe%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20result%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%20%20mermaid-decision%22%20id%3D%22flowchart-J-17%22%20transform%3D%22translate\(538.48828125%2C%20247.73333231608072\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-126.69921875%22%20y%3D%22-30%22%20width%3D%22253.3984375%22%20height%3D%2260%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-9.5\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ENeed%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20another%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20capability%3F%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22node%20default%22%20id%3D%22flowchart-K-21%22%20transform%3D%22translate\(580.7213541666666%2C%20463.49999618530273\)%22%3E%3Crect%20class%3D%22basic%20label-container%22%20style%3D%22%22%20x%3D%22-125.4921875%22%20y%3D%22-34.29999923706055%22%20width%3D%22250.984375%22%20height%3D%2268.5999984741211%22%3E%3C%2Frect%3E%3Cg%20class%3D%22label%22%20style%3D%22%22%20transform%3D%22translate\(0%2C%20-18.299999237060547\)%22%3E%3Crect%3E%3C%2Frect%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EReturn%3C%2Ftspan%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3E%20evidence-backed%3C%2Ftspan%3E%3C%2Ftspan%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%221em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3Eresult%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edges%20edgePaths%22%3E%3Cpath%20d%3D%22M241.48046875%2C172L241.48046875%2C200%22%20id%3D%22L_A_B_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_A_B_0%22%20data-points%3D%22W3sieCI6MjQxLjQ4MDQ2ODc1LCJ5IjoxNzJ9LHsieCI6MjQxLjQ4MDQ2ODc1LCJ5IjoyMDR9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M241.48046875%2C280.5999984741211L241.48046875%2C308.5999984741211%22%20id%3D%22L_B_C_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_B_C_0%22%20data-points%3D%22W3sieCI6MjQxLjQ4MDQ2ODc1LCJ5IjoyODAuNTk5OTk4NDc0MTIxMX0seyJ4IjoyNDEuNDgwNDY4NzUsInkiOjMxMi41OTk5OTg0NzQxMjExfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M241.48046875%2C389.1999969482422L241.48046875%2C417.1999969482422%22%20id%3D%22L_C_D_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_C_D_0%22%20data-points%3D%22W3sieCI6MjQxLjQ4MDQ2ODc1LCJ5IjozODkuMTk5OTk2OTQ4MjQyMn0seyJ4IjoyNDEuNDgwNDY4NzUsInkiOjQyMS4xOTk5OTY5NDgyNDIyfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M279.08984375%2C497.7999954223633L279.08984375%2C525.7999954223633%22%20id%3D%22L_D_E_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_D_E_0%22%20data-points%3D%22W3sieCI6Mjc5LjA4OTg0Mzc1LCJ5Ijo0OTcuNzk5OTk1NDIyMzYzM30seyJ4IjoyNzkuMDg5ODQzNzUsInkiOjUyOS43OTk5OTU0MjIzNjMzfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M279.08984375%2C606.3999938964844L279.08984375%2C634.3999938964844%22%20id%3D%22L_E_F_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_E_F_0%22%20data-points%3D%22W3sieCI6Mjc5LjA4OTg0Mzc1LCJ5Ijo2MDYuMzk5OTkzODk2NDg0NH0seyJ4IjoyNzkuMDg5ODQzNzUsInkiOjYzOC4zOTk5OTM4OTY0ODQ0fV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M279.08984375%2C706.3999938964844L279.08984375%2C719.6170378711897Q279.08984375%2C721.3999938964844%20278.0040573123731%2C722.8142074588575L278.0040573123731%2C722.8142074588575Q276.9182708747462%2C724.2284210212306%20275.5040573123731%2C725.3142074588575L275.5040573123731%2C725.3142074588575Q274.08984375%2C726.3999938964844%20272.30688772470535%2C726.3999938964844L156.27514352529465%2C726.3999938964844Q154.4921875%2C726.3999938964844%20153.0779739376269%2C727.4857803341113L153.0779739376269%2C727.4857803341113Q151.66376037525382%2C728.5715667717382%20150.57797393762692%2C729.9857803341113L150.5779739376269%2C729.9857803341113Q149.4921875%2C731.3999938964844%20149.4921875%2C733.182949921779L149.4921875%2C736.3999938964844%22%20id%3D%22L_F_G_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_F_G_0%22%20data-points%3D%22W3sieCI6Mjc5LjA4OTg0Mzc1LCJ5Ijo3MDYuMzk5OTkzODk2NDg0NH0seyJ4IjoyNzkuMDg5ODQzNzUsInkiOjcyNi4zOTk5OTM4OTY0ODQ0fSx7IngiOjE0OS40OTIxODc1LCJ5Ijo3MjYuMzk5OTkzODk2NDg0NH0seyJ4IjoxNDkuNDkyMTg3NSwieSI6NzQwLjM5OTk5Mzg5NjQ4NDR9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M90.17187499999996%2C746.3999938964844L90.171875%2C676.3999938964844L90.171875%2C572.0999946594238L90.171875%2C463.49999618530273L90.171875%2C354.89999771118164L90.171875%2C246.29999923706055L90.171875%2C142L90.171875%2C84%22%20id%3D%22L_G_H_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_G_H_0%22%20data-points%3D%22W3sieCI6OTAuMTcxODc0OTk5OTk5OTYsInkiOjc0Ni4zOTk5OTM4OTY0ODQ0fSx7IngiOjkwLjE3MTg3NSwieSI6Njc2LjM5OTk5Mzg5NjQ4NDR9LHsieCI6OTAuMTcxODc1LCJ5Ijo1NzIuMDk5OTk0NjU5NDIzOH0seyJ4Ijo5MC4xNzE4NzUsInkiOjQ2My40OTk5OTYxODUzMDI3M30seyJ4Ijo5MC4xNzE4NzUsInkiOjM1NC44OTk5OTc3MTExODE2NH0seyJ4Ijo5MC4xNzE4NzUsInkiOjI0Ni4yOTk5OTkyMzcwNjA1NX0seyJ4Ijo5MC4xNzE4NzUsInkiOjE0Mn0seyJ4Ijo5MC4xNzE4NzUsInkiOjgwfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M168.34375000000003%2C72L168.34375%2C84.92893218813452Q168.34375%2C92%20175.41481781186548%2C92L531.7053252247053%2C92Q533.48828125%2C92%20534.9024948123731%2C93.08578643762691L534.9024948123731%2C93.08578643762692Q536.3167083747462%2C94.17157287525382%20537.4024948123731%2C95.58578643762691L537.4024948123731%2C95.58578643762691Q538.48828125%2C97%20538.48828125%2C98.78295602529465L538.48828125%2C102%22%20id%3D%22L_H_I_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_H_I_0%22%20data-points%3D%22W3sieCI6MTY4LjM0Mzc1MDAwMDAwMDAzLCJ5Ijo3Mn0seyJ4IjoxNjguMzQzNzUsInkiOjkyfSx7IngiOjUzOC40ODgyODEyNSwieSI6OTJ9LHsieCI6NTM4LjQ4ODI4MTI1LCJ5IjoxMDZ9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M538.48828125%2C172L538.48828125%2C205.73333231608072%22%20id%3D%22L_I_J_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_I_J_0%22%20data-points%3D%22W3sieCI6NTM4LjQ4ODI4MTI1LCJ5IjoxNzJ9LHsieCI6NTM4LjQ4ODI4MTI1LCJ5IjoyMDkuNzMzMzMyMzE2MDgwNzJ9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M530.6415087264804%2C277.7333323160807L503.03816435862797%2C277.7333323160807Q501.2552083333333%2C277.7333323160807%20499.8409947709602%2C278.8191187537076L499.8409947709602%2C278.8191187537076Q498.4267812085871%2C279.9049051913345%20497.3409947709602%2C281.3191187537076L497.3409947709602%2C281.3191187537076Q496.2552083333333%2C282.7333323160807%20496.2552083333333%2C284.51628834137534L496.2552083333333%2C402.41704092294754Q496.2552083333333%2C404.1999969482422%20495.1694218957064%2C405.6142105106153L495.1694218957064%2C405.6142105106153Q494.0836354580795%2C407.0284240729884%20492.6694218957064%2C408.1142105106153L492.6694218957064%2C408.1142105106153Q491.2552083333333%2C409.1999969482422%20489.47225230803866%2C409.1999969482422L323.48217477529465%2C409.1999969482422Q321.69921875%2C409.1999969482422%20320.2850051876269%2C410.2857833858691L320.2850051876269%2C410.2857833858691Q318.8707916252538%2C411.371569823496%20317.7850051876269%2C412.7857833858691L317.7850051876269%2C412.7857833858691Q316.69921875%2C414.1999969482422%20316.69921875%2C415.98295297353684L316.69921875%2C419.1999969482422%22%20id%3D%22L_J_D_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_J_D_0%22%20data-points%3D%22W3sieCI6NTMwLjY0MTUwODcyNjQ4MDQsInkiOjI3Ny43MzMzMzIzMTYwODA3fSx7IngiOjQ5Ni4yNTUyMDgzMzMzMzMzLCJ5IjoyNzcuNzMzMzMyMzE2MDgwN30seyJ4Ijo0OTYuMjU1MjA4MzMzMzMzMywieSI6NDA5LjE5OTk5Njk0ODI0MjJ9LHsieCI6MzE2LjY5OTIxODc1LCJ5Ijo0MDkuMTk5OTk2OTQ4MjQyMn0seyJ4IjozMTYuNjk5MjE4NzUsInkiOjQyMy4xOTk5OTY5NDgyNDIyfV0%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M545.4702368067863%2C277.7333323160807L573.938398141372%2C277.7333323160807Q575.7213541666666%2C277.7333323160807%20577.1355677290397%2C278.8191187537076L577.1355677290397%2C278.8191187537076Q578.5497812914128%2C279.9049051913345%20579.6355677290397%2C281.3191187537076L579.6355677290397%2C281.3191187537076Q580.7213541666666%2C282.7333323160807%20580.7213541666666%2C284.51628834137534L580.7213541666666%2C417.1999969482422%22%20id%3D%22L_J_K_0%22%20class%3D%22edge-thickness-normal%20edge-pattern-solid%20edge-thickness-normal%20edge-pattern-solid%20flowchart-link%22%20style%3D%22%3B%22%20data-edge%3D%22true%22%20data-et%3D%22edge%22%20data-id%3D%22L_J_K_0%22%20data-points%3D%22W3sieCI6NTQ1LjQ3MDIzNjgwNjc4NjMsInkiOjI3Ny43MzMzMzIzMTYwODA3fSx7IngiOjU4MC43MjEzNTQxNjY2NjY2LCJ5IjoyNzcuNzMzMzMyMzE2MDgwN30seyJ4Ijo1ODAuNzIxMzU0MTY2NjY2NiwieSI6NDIxLjE5OTk5Njk0ODI0MjJ9XQ%3D%3D%22%20marker-end%3D%22url\(%23mermaid-_r_vk__flowchart-v2-pointEnd\)%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabels%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22stroke%3A%20none%22%3E%3C%2Frect%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_A_B_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_B_C_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_C_D_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_D_E_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_E_F_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_F_G_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_G_H_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_H_I_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_I_J_0%22%20transform%3D%22translate\(0%2C%200\)%22%3E%3Ctext%20y%3D%22-10.1%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%20transform%3D%22translate\(495.8489583333333%2C%20354.89999771118164\)%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_J_D_0%22%20transform%3D%22translate\(-11.09375%2C-8\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22%22%20x%3D%22-12%22%20y%3D%22-5%22%20width%3D%2246.1875%22%20height%3D%2226%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3EYes%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20class%3D%22edgeLabel%22%20transform%3D%22translate\(580.4674479166666%2C%20354.89999771118164\)%22%3E%3Cg%20class%3D%22label%22%20data-id%3D%22L_J_K_0%22%20transform%3D%22translate\(-8.74609375%2C-8\)%22%3E%3Cg%3E%3Crect%20class%3D%22background%22%20style%3D%22%22%20x%3D%22-12%22%20y%3D%22-5%22%20width%3D%2241.4921875%22%20height%3D%2226%22%3E%3C%2Frect%3E%3Ctext%20y%3D%22-10.1%22%20style%3D%22%22%3E%3Ctspan%20class%3D%22text-outer-tspan%22%20x%3D%220%22%20y%3D%22-0.1em%22%20dy%3D%221.1em%22%3E%3Ctspan%20font-style%3D%22normal%22%20class%3D%22text-inner-tspan%22%20font-weight%3D%22normal%22%3ENo%3C%2Ftspan%3E%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E)

For example, when asked to prepare a school enrollment campaign, the planner might discover:

* `knowledge.search` and `context.get_campaign_brief`

* `crm.pipeline.get_metrics`

* `campaign.get_performance`

* `creative.generate_social_variants`

* `campaign.create_draft`

* `campaign.request_launch_approval`

It should not automatically receive payment refund tools, critical access administration tools or every finance operation.

Implement a registry search interface such as:

TypeScript

```
type ToolDiscoveryRequest = {
  taskDescription: string;
  agentRole: string;
  organizationId: string;
  workspaceId: string;
  requiredCapabilities: string[];
  riskCeiling: "R0" | "R1" | "R2" | "R3" | "R4";
};

type ToolDiscoveryResult = {
  eligibleTools: Array<{
    name: string;
    version: string;
    description: string;
    inputSchema: unknown;
    riskClass: string;
    requiredPermissions: string[];
  }>;
  excludedToolCount: number;
};
```

This is an internal discovery contract. The discovery service must apply permissions and tool policies independently of the agent's requested filters.

# 9. Agent-to-tool mapping

Once the registry exists, define an explicit capability manifest for each agent.

|
Agent

|

Primary toolsets

|

Additional constraints

|
| --- | --- | --- |
|

Nexus / Supervisor

|

Discovery, Context Builder, Knowledge, CRM, Tasks

|

Must not bypass domain permissions

|
|

Autonomous SDR

|

Lead Intelligence, CRM, Knowledge, Tasks, Messaging

|

Outreach requires approval

|
|

Deal Coach

|

Deals, CRM, Knowledge, Tasks, Analytics

|

Financial figures use deterministic services

|
|

Meeting Agent

|

Meetings, CRM, Knowledge, Tasks

|

Transcript access and recording consent

|
|

Campaign Agent

|

Campaigns, Creative, Knowledge, Analytics, Messaging

|

Launch requires approval

|
|

Survey Agent

|

Surveys, Forms, Knowledge, Analytics

|

Protect respondent-level data

|
|

Workflow Agent

|

Automation, CRM, Tasks, Messaging

|

Validated graphs and durable execution

|
|

Finance Agent

|

Finance, CRM, Knowledge, Analytics

|

Fine-grained permissions and approval controls

|
|

Administrative Governor

|

AI Governance, Access Review, Audit

|

Critical operations require dual approval

|
|

Knowledge Curator

|

Knowledge, Memory, Graph, Context Builder

|

Evidence, provenance and memory lifecycle controls

|

An agent manifest should define its allowed tools, prohibited tools, data scopes, maximum execution budget, allowed risk classes, approval rules and handoff conditions.

Important: Agent role restrictions are not substitutes for user authorization. An agent may have permission to prepare a campaign but still lack permission to launch it on behalf of a particular user.

# 10. The phased implementation plan

I would implement the platform in the following order, with each phase producing a testable and usable deliverable.

## P0

Foundation

Start here

### Repository audit and capability registry

* Inventory existing APIs, services, flows, jobs and permissions.

* Create the coverage matrix and canonical tool manifest.

* Define contracts, risk classes, error types and naming conventions.

* Identify missing capabilities and duplicate implementations.

Exit criterion: Every discovered capability is mapped, classified and assigned to a phase.

## P1

Security

### Shared execution gateway

* Identity and tenant resolution.

* Permission checks and tool filtering.

* Zod validation, idempotency, audit records and typed errors.

* Approval policies and risk enforcement.

Exit criterion: Representative read, write and approval-required tools pass authorization and isolation tests.

## P2

Memory

### Knowledge & Memory toolset

* Search and retrieval adapters.

* Memory proposals, evidence and lifecycle transitions.

* Context Builder.

* Graph retrieval and provenance.

* Qdrant and Firestore synchronization.

Exit criterion: An authorized agent can retrieve evidence-backed context and propose a memory without bypassing review policies.

## P3

Core tools

### CRM, deals, tasks and meetings

* Wrap existing canonical services.

* Add missing search, validation, history and lifecycle operations.

* Connect meeting intelligence to tasks and knowledge.

* Implement agent-specific tool manifests.

Exit criterion: The Deal Coach and Meeting Agent complete end-to-end tasks using the shared gateway.

## P4

Protocol

### MCP server and client integration

* Add Streamable HTTP transport.

* Expose approved tools, resources and prompts.

* Implement external-client authentication and authorization.

* Add toolset discovery, pagination and version compatibility.

Exit criterion: An authorized MCP client can discover and use permitted tools without direct database access.

## P5

Orchestration

### Agent planner and durable workflow runtime

* Tool discovery and planning.

* Checkpointed execution and resumable jobs.

* Approval waits, cancellation, retries and reconciliation.

* Agent handoffs and bounded execution budgets.

Exit criterion: Multi-step agent runs survive interruption without duplicate side effects or lost approval state.

## P6

Expansion

### Campaigns, communications, finance and admin

* Add remaining domain tools in priority order.

* Integrate the existing proposal and execution engine.

* Add additional integrations and analytics.

* Enforce approval policies for external and critical operations.

Exit criterion: Each enabled domain has complete contract coverage, operational monitoring and appropriate security evidence.

## P7

Hardening

### Red-team, evaluation and production readiness

* Cross-tenant isolation and privilege-escalation tests.

* Prompt-injection and memory-poisoning tests.

* Load, latency, cost and retry testing.

* Tool-selection evaluations and rollback drills.

* Operational dashboards and kill switches.

Exit criterion: Documented release gates pass before production rollout.

These phases are ordered by dependency, not by a fixed delivery estimate. Run the repository audit before estimating implementation effort.

# 11. The implementation brief for your AI coding agent

Give your coding agent a task that requires repository inspection and planning before it starts writing code.

## Copy-ready master instruction

Copy instruction

Use this as the starting instruction in your coding agent. Attach the full tool catalog and the existing SmartSapp architecture reference above it.

Required first deliverables

1. Repository capability inventory.

2. Existing-to-target tool mapping.

3. Missing capability and security gap report.

4. Proposed tool registry schema and architecture decisions.

5. Phase-by-phase implementation backlog with dependencies.

6. Acceptance tests and security test matrix.

7. List of changes explicitly deferred until approval.

# 12. Production acceptance checklist

Before considering the platform ready, require the coding agent to demonstrate the following.

## Release gate

0 of 11

Coverage

Every discovered capability is mapped to a tool, an internal service, a deliberate exclusion or a documented future phase.

Reuse

Existing business logic is reused through canonical services; duplicate implementations are identified.

Identity

Every execution has a validated actor, organization and applicable workspace scope.

Authorization

Read and write permissions are enforced at the resource and operation level.

Contracts

Tool inputs and outputs are strictly validated and versioned.

Memory

Knowledge retrieval is permission-filtered and evidence-backed; proposed memories follow the lifecycle policy.

Safety

External side effects and critical operations follow the appropriate approval requirements.

Reliability

Retries, timeouts, idempotency, cancellation and uncertain outcomes have defined behavior.

Auditability

Execution records include tool version, actor, scope, policy decision, outcome and relevant references.

Evaluation

Tool-selection tests, integration tests, cross-tenant tests and adversarial tests pass.

Operations

Metrics, error monitoring, cost limits, kill switches and rollback procedures are documented.

Copy checklist

## My recommendation

Start with Phase 0: repository audit and capability registry, followed by the shared execution gateway and Knowledge & Memory integration.

Do not begin by implementing the entire MCP catalog, and do not begin by creating more autonomous agents. SmartSapp already has many AI flows and specialized engines. The immediate architectural challenge is making their capabilities consistently discoverable, permission-aware, reusable and observable.

Once the registry and execution gateway are reliable, the MCP server becomes a protocol adapter, and the agentic workflow engine becomes a planner and durable coordinator over the same capabilities. That gives you one governed platform instead of a collection of disconnected AI features.

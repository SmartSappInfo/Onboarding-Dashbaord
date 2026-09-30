# SmartSapp CRM

# Document & Contract Intelligence Platform

## Implementation and Migration Roadmap

**Version:** 1.0\
**Date:** 28 September 2026\
**Status:** Proposed delivery plan aligned with the *SmartSapp Document
& Contract Intelligence Technical Audit and PRD*\
**Implementation posture:** Incremental, backward-compatible migration;
no big-bang replacement.

------------------------------------------------------------------------

## 1. Purpose

This roadmap translates the PRD into an execution plan for moving the
existing SmartSapp CRM DOC Signing feature to the target Document &
Contract Intelligence Platform.

The objective is to preserve current workflows and records while
progressively introducing reliable signing, a clearer document/contract
domain model, multi-party execution, lifecycle management, CRM
integration, analytics, automation, AI assistance, and enterprise
controls.

### 1.1 Planning rule

The current-state description in the PRD was reconstructed from a
coding-agent extraction. It is not an independently verified repository
or production audit. Therefore:

-   Treat reported components and behavior as hypotheses until verified
    in source code and the running application.
-   Do not remove or replace a current route, collection, status,
    PDF-generation path, notification, or integration until its callers
    and dependencies are understood.
-   Establish baseline tests before changing behavior.
-   Use feature flags, compatibility adapters, staged rollout, migration
    reconciliation, and tested rollback procedures.
-   Keep the existing Next.js/Firebase application and shared CRM
    services initially. Do not begin with a microservices rewrite.
-   Prioritize tenant isolation, signing correctness, artifact
    integrity, and recoverability before advanced functionality.

## 2. Target outcome

At completion, an authorized SmartSapp workspace should be able to:

1.  Create, edit, approve, version, and reuse document templates.
2.  Generate document instances from approved template versions and
    authorized CRM data.
3.  Issue one or more documents for signing through a signing envelope.
4.  Route signing to multiple recipients sequentially or in parallel,
    with defined approval and countersignature rules.
5.  Produce one authoritative completed artifact and a verifiable
    execution evidence record.
6.  Manage contracts after signing, including obligations, reminders,
    amendments, renewals, termination, and archival.
7.  Associate documents and contracts with existing CRM
    contacts/entities, deals, meetings, tasks, campaigns, finance, and
    subscriptions without duplicating master records.
8.  Analyze lifecycle performance through trustworthy event-derived
    analytics.
9.  Use AI for extraction, summaries, Q&A, drafting suggestions, clause
    comparison, and obligation detection, with source references and
    human review.
10. Operate with explicit tenant boundaries, audited permissions,
    durable background work, monitoring, tested recovery, and controlled
    releases.

## 3. Delivery principles and non-negotiable controls

-   **Preserve first:** existing templates, contracts, submissions,
    completed PDFs, audit history, and public signing links must remain
    accounted for.
-   **One source of truth:** canonical contract and signing state must
    not be inferred from analytics or duplicated CRM fields.
-   **Issued content is immutable:** edits after issue create a new
    version or amendment; they do not silently alter the document
    already sent.
-   **Server-side authority:** client state must not be able to mark a
    document signed, finalized, approved, or completed.
-   **Idempotent execution:** retries and duplicate requests must not
    create duplicate completions, artifacts, or logical notifications.
-   **Tenant-scoped access:** every read, write, download, background
    job, and AI retrieval must enforce workspace/tenant authorization.
-   **Evidence is protected:** record relevant execution events and
    artifact hashes; restrict and audit evidence access.
-   **Human approval for consequential AI actions:** AI cannot
    autonomously approve material terms, execute signatures, or send
    legally consequential documents.
-   **Observable and reversible:** every migration and rollout step
    needs metrics, reconciliation, rollback criteria, and an accountable
    owner.
-   **No unsupported legal claims:** legal enforceability and signature
    assurance require jurisdiction- and use-case-specific review.

## 4. Workstreams

These workstreams span the phases. They should have named owners before
implementation begins.

  -----------------------------------------------------------------------
  Workstream              Responsibility          Required participants
  ----------------------- ----------------------- -----------------------
  Product and delivery    Scope, priorities,      Product owner,
                          acceptance criteria,    engineering lead
                          customer impact,        
                          release decisions       

  Application             Domain boundaries,      Tech lead,
  architecture            adapters, API           backend/frontend
                          contracts, data         engineers
                          ownership               

  Data migration          Inventory, mapping,     Backend/data engineer
                          backfill,               
                          reconciliation,         
                          rollback                

  Signing integrity       State transitions, PDF  Backend engineer, QA,
                          rendering, recipient    security
                          sessions, evidence      

  Tenant security         Authorization matrix,   Security owner,
                          Firestore rules,        engineering
                          storage access, threat  
                          model                   

  UI/UX                   Template studio,        Product designer,
                          document workspace,     frontend engineer
                          signing flow, contract  
                          workspace, responsive   
                          behavior                

  CRM integration         Links to existing       CRM/domain owners
                          master records,         
                          activity timeline,      
                          tasks, deals, messaging 

  AI intelligence         Retrieval, extraction,  AI engineer, product,
                          evaluations,            security
                          provenance,             
                          prompt/model governance 

  Quality and operations  Automated tests,        QA, DevOps/platform,
                          observability, backups, support
                          runbooks, staged        
                          rollout                 

  Legal/compliance        Consent wording,        Legal/compliance owner
                          evidence, retention,    
                          jurisdiction profiles,  
                          customer-facing claims  
  -----------------------------------------------------------------------

## 5. Phase overview

Estimates below are **planning ranges, not commitments**. They assume a
small cross-functional team and are subject to Phase 0 findings,
existing test coverage, data volume, integration complexity, and
available engineering capacity. Phases may overlap only where
dependencies and risk controls permit.

  --------------------------------------------------------------------------
  Phase            Focus              Indicative duration Exit outcome
  ---------------- ---------------- --------------------- ------------------
  0                Discovery and               1--2 weeks Verified
                   baseline                               current-state map
                                                          and migration plan

  1                Integrity and               2--4 weeks Existing signing
                   execution                              flow is
                   reliability                            deterministic and
                                                          tested

  2                Domain model and            3--6 weeks New domain
                   multi-party                            concepts work
                   signing                                alongside legacy
                                                          records

  3                Document and                3--6 weeks Versioned
                   contract                               documents and core
                   management                             post-signing
                                                          lifecycle

  4                CRM, analytics,             2--5 weeks Connected
                   and automation                         lifecycle and
                                                          operational
                                                          reporting

  5                AI document                 3--6 weeks Evaluated,
                   intelligence                           permission-aware
                                                          AI assistance

  6                Enterprise                  2--5 weeks Approved
                   readiness                              assurance,
                                                          resilience,
                                                          governance, and
                                                          rollout

  **Total**        **Indicative          **16--34 weeks** Depends on
                   end-to-end                             parallelism, team
                   range**                                capacity, and
                                                          Phase 0 findings
  --------------------------------------------------------------------------

Do not use the total as a promised launch date. Security, legal review,
migration surprises, and external provider requirements may extend the
schedule.

------------------------------------------------------------------------

# 6. Phase 0 --- Discovery and baseline

**Objective:** Verify the actual implementation and establish safe
migration conditions.\
**Indicative duration:** 1--2 weeks.\
**Priority:** Must complete before behavior-changing implementation.

## 6.1 Work packages

### P0.1 --- Code-path inventory

Inspect and document:

-   All routes, server actions, API handlers, UI components, services,
    hooks, and shared utilities involved in template creation, editing,
    dispatch, public access, progress saving, signing, finalization,
    download, analytics, and bulk send.
-   Callers and downstream dependencies for every critical endpoint.
-   Messaging, email/SMS, storage, PDF libraries, scheduled jobs,
    background tasks, and third-party providers.
-   Every route and workflow that reads or writes `PDFForm`,
    `PDFFormField`, `Contract`, and `Submission`, or their actual
    repository equivalents.
-   Existing CRM activity, notification, and automation handoffs.
-   Error paths, retries, timeout behavior, and partial-failure
    behavior.

**Deliverable:** code-path inventory, call graph/sequence diagrams,
dependency map, owner list.

### P0.2 --- Data and security inventory

-   Inventory relevant Firestore collections, documents, field shapes,
    indexes, storage paths, security rules, and access patterns.
-   Establish record counts and identify orphaned, malformed, duplicate,
    or legacy records.
-   Determine how tenant/workspace ownership is represented and how
    `TenantContext` or the existing workspace mechanism is enforced.
-   Build an authorization matrix by actor, workspace, route/action,
    relationship, recipient status, and artifact type.
-   Inspect public signing links, token generation, expiry, revocation,
    rate limiting, and recipient identity/verification.
-   Review access to original PDFs, signature assets, completed PDFs,
    evidence, exports, and logs.
-   Check whether logs are append-only or otherwise protected against
    unauthorized modification.
-   Identify retention, deletion, legal-hold, backup, and restoration
    behavior.

**Deliverable:** schema and storage inventory, authorization matrix,
threat model, data-quality report.

### P0.3 --- Baseline tests and production behavior

Create tests for current expected behavior before refactoring:

-   Template create/edit/save and field mapping.
-   Contract creation and dispatch.
-   Recipient access and session validation.
-   Field validation and progress saving.
-   Consent/signature capture.
-   Successful finalization and completed PDF download.
-   Notifications and CRM activity.
-   Decline, expiry, invalid links, retries, and interrupted workflows,
    where supported.
-   Workspace isolation and unauthorized access.
-   Existing exports and analytics.

Record current defects instead of silently changing expected behavior.

**Deliverable:** baseline test suite, known-gap register, reproducible
test fixtures, representative redacted test data.

### P0.4 --- Operational baseline and migration rehearsal

-   Capture current error rates, latency, traffic, document/submission
    counts, PDF generation failures, and support incidents where
    telemetry exists.
-   Confirm backup and restore procedures.
-   Rehearse rollback in a non-production environment.
-   Identify production migration constraints, release windows, and
    support procedures.
-   Establish baseline artifact samples for PDF visual/regression tests.

**Deliverable:** baseline dashboard/report, backup/restore evidence,
rollback plan, initial release checklist.

## 6.2 Phase 0 acceptance gate

Do not proceed to a production-impacting change until:

-   Every critical workflow has an identified entry point, owner,
    dependencies, and failure paths.
-   Data ownership and authorization rules are documented and reviewed.
-   Existing golden-path tests pass or known failures are explicitly
    recorded and accepted.
-   Historical records and completed artifacts are accounted for.
-   Backup, restore, and rollback procedures are documented and
    rehearsed.
-   The team has agreed the first release scope and success metrics.

------------------------------------------------------------------------

# 7. Phase 1 --- Integrity and execution reliability

**Objective:** Make the existing signing path safe and deterministic
before introducing complex routing.\
**Indicative duration:** 2--4 weeks.\
**Depends on:** Phase 0.

## 7.1 Work packages

### P1.1 --- Unified PDF artifact service

-   Identify all PDF generation paths and consolidate completed-document
    generation behind a server-side service.
-   Define authoritative inputs and ensure rendering uses the exact
    issued document version and validated submission data.
-   Standardize page dimensions, rotation, fonts, wrapping, field
    placement, signatures, and supported links.
-   Persist the completed artifact and its metadata consistently.
-   Define artifact identifiers, storage locations, content type, size
    limits, and hash calculation.
-   Prevent a later template edit from changing an already issued or
    completed document.

**Acceptance criteria:** all completed-download paths return the
authoritative artifact; golden-file tests cover A4, Letter, Legal,
rotated pages, long text, and signature placement.

### P1.2 --- Idempotent finalization

-   Implement a server-side finalization command with a stable
    idempotency key.
-   Validate allowed state transitions and required fields before
    finalization.
-   Ensure concurrent or repeated requests converge on one completed
    execution.
-   Persist the canonical artifact and final state atomically where
    possible, or use a recoverable workflow where a transaction cannot
    cover all side effects.
-   Use a durable outbox or equivalent pattern for post-finalization
    notifications and CRM events.
-   Make each downstream consumer idempotent.

**Acceptance criteria:** repeated and concurrent finalization produces
one logical completion, one canonical artifact, and one logical
notification per intended recipient.

### P1.3 --- Recipient sessions and signing controls

-   Review and harden public signing token generation, expiry,
    revocation, and validation.
-   Bind recipient sessions to the correct envelope/submission and
    permitted actions.
-   Validate all submitted field values and signing actions server-side.
-   Apply rate limits and abuse controls to public endpoints.
-   Prevent recipients from accessing other recipients' private data or
    unrelated workspace records.
-   Ensure public access does not expose internal CRM details or private
    storage paths.

**Acceptance criteria:** unauthorized, expired, revoked, replayed, and
cross-tenant access tests fail safely; valid signing journeys continue
to work.

### P1.4 --- Evidence and state consistency

-   Define canonical execution events for view/access, consent, signing,
    decline, completion, and relevant administrative actions.
-   Record actor/recipient identity reference, timestamps, event type,
    document/envelope version, and relevant request metadata.
-   Hash final artifacts and retain evidence metadata.
-   Define controlled access and export behavior for evidence.
-   Reconcile contract, submission, and artifact states so partial
    failures are detectable and recoverable.

**Acceptance criteria:** support staff can trace a test execution from
dispatch to final artifact; inconsistent states are detectable; evidence
access is authorized and logged.

## 7.2 Phase 1 release gate

-   All critical legacy signing journeys pass regression tests.
-   No known release-blocking tenant-isolation or authorization defect
    remains.
-   Finalization, PDF generation, notification, and CRM event failures
    are observable.
-   Retry and concurrent-request tests pass.
-   Rollback has been tested and preserves records created during the
    release.

------------------------------------------------------------------------

# 8. Phase 2 --- Domain model and multi-party signing

**Objective:** Introduce the target domain boundaries and multi-party
execution without abruptly replacing the legacy schema.\
**Indicative duration:** 3--6 weeks.\
**Depends on:** Phase 1 foundations; domain design can begin during
Phase 1.

## 8.1 Target domain concepts

Introduce and document separate concepts, aligned with existing
workspace conventions:

-   **DocumentTemplate:** reusable template identity and metadata.
-   **TemplateVersion:** immutable version of template content, fields,
    and configuration.
-   **DocumentInstance:** a specific generated document based on a
    template version.
-   **DocumentArtifact:** original, preview, generated, completed, or
    exported file with metadata and hash.
-   **SigningEnvelope:** execution workflow containing documents,
    recipients, routing, and status.
-   **EnvelopeDocument:** association between an envelope and an issued
    document instance/version.
-   **Recipient:** signer, approver, reviewer, or copied party with
    defined permissions and status.
-   **RecipientFieldValue:** validated values captured from a recipient.
-   **DocumentEvent / EvidenceRecord:** execution and administrative
    history.
-   **Contract:** agreement lifecycle record, separate from the PDF and
    signing workflow.
-   **ContractDocumentLink:** link between a contract and relevant
    document instances/envelopes.
-   **Obligation:** dated or conditional commitment extracted or entered
    for follow-up.
-   **ContractRelationship:** amendment, renewal, supersedes, or
    related-agreement relationship.
-   **DocumentAnalysis:** AI or machine-generated analysis tied to a
    specific document version and source passages.

Use the PRD's suggested Firestore structure as a design input, not as an
instruction to create a parallel tenancy scheme. Align all paths,
indexes, and rules with the existing tenant/workspace partitioning
pattern.

## 8.2 Work packages

### P2.1 --- Domain contracts and schema design

-   Define TypeScript types and runtime validation schemas.
-   Specify ownership, lifecycle, immutable fields, timestamps, actor
    references, and allowed transitions.
-   Define relationships and deletion/retention behavior.
-   Specify indexes and query patterns before creating collections.
-   Document which domain owns each field and which service may mutate
    it.
-   Add schema-version and migration metadata where required.

**Acceptance criteria:** reviewed domain model, state-transition tables,
API/data contracts, index plan, and security rules plan.

### P2.2 --- Compatibility adapter

-   Create a modular service boundary between current UI/routes and the
    new domain model.
-   Map legacy templates, contracts, and submissions to the new concepts
    without changing public behavior.
-   Use stable IDs or explicit mapping records to link old and new
    records.
-   Keep legacy reads/writes supported during the transition where
    necessary.
-   Avoid uncontrolled dual writes. If dual writes are unavoidable,
    define the authoritative source, retry/reconciliation mechanism, and
    retirement condition.
-   Add feature flags to enable the new path for internal users or a
    limited cohort.

**Acceptance criteria:** legacy records can be read through the adapter;
mapping is deterministic; discrepancies are reported rather than
silently overwritten.

### P2.3 --- Immutable template versions and document instances

-   Introduce template version creation and publication.
-   Prevent edits to a published version used by an issued document.
-   Generate document instances from a selected immutable version.
-   Capture the authorized CRM variable values used at generation time.
-   Preserve the relationship between template version, generated
    document, envelope, and final artifact.

**Acceptance criteria:** template edits create new versions; previously
issued documents remain reproducible and unchanged.

### P2.4 --- Envelope and recipient state machines

-   Define envelope, recipient, and document state machines.
-   Implement allowed transitions and reject invalid transitions
    server-side.
-   Support sequential and parallel routing, internal review/approval,
    countersigning, decline, void, expiry, and reassignment policies
    according to approved requirements.
-   Define what happens when a recipient is reassigned, an envelope
    expires, or a required signer declines.
-   Make reminders and routing changes durable and auditable.
-   Ensure completed envelopes refer to immutable issued versions.

**Acceptance criteria:** state-machine tests cover valid and invalid
transitions, retries, partial completion, recipient order, expiry,
decline, void, and recovery.

### P2.5 --- Multi-party signing UI

-   Update the sender flow to configure recipients, roles, routing
    order, and required fields.
-   Show envelope progress and outstanding actions.
-   Keep the public signing portal focused on the current recipient's
    authorized actions.
-   Provide accessible loading, error, expired-link, completed,
    declined, and revoked states.
-   Preserve existing single-recipient flow as a supported path.

**Acceptance criteria:** existing single-recipient journeys remain
functional; multi-recipient test envelopes complete correctly across
sequential and parallel routes.

## 8.3 Phase 2 release gate

-   Legacy and new records can coexist.
-   The adapter is covered by integration and reconciliation tests.
-   Issued content is immutable.
-   Multi-party routing and state transitions are deterministic.
-   Public signing permissions pass security tests.
-   The new flow is enabled gradually behind a feature flag.

------------------------------------------------------------------------

# 9. Phase 3 --- Document and contract management

**Objective:** Deliver the everyday document workspace and core
post-signing contract lifecycle.\
**Indicative duration:** 3--6 weeks.\
**Depends on:** Phase 2 domain concepts and immutable document versions.

## 9.1 Work packages

### P3.1 --- Document workspace

Build a workspace for authorized users to:

-   Browse and search templates, drafts, issued documents, completed
    documents, and archived items.
-   Filter by status, owner, date, document type, contact/entity, deal,
    and contract where applicable.
-   View document details, versions, recipients, activity, linked CRM
    records, and artifacts.
-   Create, duplicate, preview, publish, archive, and retire templates
    according to permissions.
-   Download authorized artifacts and inspect execution history.
-   Handle empty, loading, partial, error, permission-denied, and
    no-results states.

### P3.2 --- Template studio maturity

-   Support reusable templates and immutable versions.
-   Define fields, required values, field validation, and conditional
    visibility where specified.
-   Support approved variable bindings to authorized CRM facts.
-   Add template validation and preview before publication.
-   Provide a clear distinction between draft, published, archived, and
    superseded versions.
-   Preserve existing PDF field-mapping functionality unless Phase 0
    proves a replacement is necessary.

### P3.3 --- Contract workspace and lifecycle

-   Provide a contract record separate from its PDF and envelope.
-   Link the contract to all relevant document instances and signing
    envelopes.
-   Track contract status, parties, key dates, value/currency where
    relevant, owner, source deal, and renewal settings.
-   Support amendments and renewals as linked records/documents rather
    than overwriting the original executed agreement.
-   Support termination and archival with controlled permissions and a
    clear audit trail.
-   Define how contract status is derived or updated from signing and
    lifecycle events.

### P3.4 --- Obligations and renewal operations

-   Support manually entered obligations first, with source references
    and owners.
-   Store due date or triggering condition, responsible party, status,
    reminder schedule, and linked contract.
-   Create tasks through existing SmartSapp task infrastructure rather
    than a parallel task system.
-   Provide renewal and expiry views.
-   Keep AI-suggested obligations in a review state until an authorized
    user confirms them.

### P3.5 --- UI/UX and accessibility

-   Define desktop, tablet, and mobile layouts.
-   Use existing SmartSapp navigation, design tokens, permission
    patterns, and component conventions.
-   Ensure keyboard operation, visible focus, accessible form labels,
    clear validation, and screen-reader status updates.
-   Test large PDFs, long titles, many recipients, long contract
    histories, and narrow viewports.

## 9.2 Phase 3 release gate

-   Users can manage templates, document instances, contracts, versions,
    and artifacts without bypassing permission checks.
-   Amendments and renewals preserve links to prior executed agreements.
-   Obligations and reminders use existing task/notification
    infrastructure.
-   User acceptance testing covers key document and contract workflows
    on desktop and mobile.
-   No historical artifact is overwritten by an edit or lifecycle
    action.

------------------------------------------------------------------------

# 10. Phase 4 --- CRM integration, analytics, and automation

**Objective:** Make the document lifecycle a connected part of SmartSapp
CRM.\
**Indicative duration:** 2--5 weeks.\
**Depends on:** stable domain events and core document/contract
workflows.

## 10.1 Work packages

### P4.1 --- CRM relationships

Connect document and contract records to existing master records where
relevant:

-   Contacts and entities/institutions.
-   Deals and sales opportunities.
-   Meetings.
-   Tasks and follow-ups.
-   Campaigns.
-   Finance and subscriptions, where there is a real business
    relationship.

Use existing entity/contact identity and workspace relationship
mechanisms. Do not create duplicate CRM master records to support
document features.

### P4.2 --- CRM contextual surfaces

-   Show related documents and contracts on relevant CRM records.
-   Add document and contract activity to the appropriate timeline.
-   Enable authorized users to create or issue a document from a
    relevant deal/contact context.
-   Preserve permission checks when documents are surfaced in another
    module.
-   Make status and next action visible without copying authoritative
    contract state into multiple modules.

### P4.3 --- Canonical event taxonomy

Define versioned events such as:

-   `document.template_published`
-   `document.instance_created`
-   `document.dispatched`
-   `document.viewed`
-   `signing.recipient_completed`
-   `signing.recipient_declined`
-   `signing.envelope_completed`
-   `signing.envelope_voided`
-   `contract.created`
-   `contract.amended`
-   `contract.renewal_due`
-   `contract.terminated`
-   `obligation.created`
-   `obligation.completed`

Names are proposed examples; finalize them against SmartSapp's event
conventions. Each event should include tenant/workspace identity, entity
IDs, event version, timestamp, actor/source, correlation ID, and only
the minimum necessary payload.

### P4.4 --- Analytics

Provide operational views such as:

-   Draft-to-dispatch conversion.
-   Time to first view and time to completion.
-   Completion, decline, expiry, and void rates.
-   Outstanding signatures by age and responsible party.
-   Funnel breakdowns by template, owner, source deal, and time period.
-   Contract expiries, renewals, and overdue obligations.
-   Deal-to-contract reporting where the relationship is explicit.

Document metric definitions, time windows, exclusions, and data
freshness. Derived analytics must not be treated as authoritative
contract state. Do not infer causal impact from a simple CRM
relationship.

### P4.5 --- Automation

-   Trigger reminders and follow-up tasks from durable events and due
    dates.
-   Reuse existing SmartSapp automation, messaging, and task services.
-   Add retry limits, idempotency, deduplication, dead-letter handling,
    and operator-visible run history.
-   Make time-zone and business-calendar behavior explicit.
-   Require authorization and confirmation for consequential actions.
-   Ensure retries cannot send duplicate reminders or mutate completed
    contracts.

## 10.2 Phase 4 release gate

-   CRM links resolve to the correct existing records and respect their
    permissions.
-   Event consumers are idempotent and failures are recoverable.
-   Analytics reconcile against canonical source records for sampled
    cases.
-   Metric definitions and freshness are visible.
-   Reminder and automation tests prove deduplication and safe retries.

------------------------------------------------------------------------

# 11. Phase 5 --- AI document intelligence

**Objective:** Add useful AI assistance without compromising
confidentiality, provenance, or human control.\
**Indicative duration:** 3--6 weeks.\
**Depends on:** stable document versions, access controls, and auditable
domain services.

## 11.1 Work packages

### P5.1 --- Extraction and field detection

-   Extract text and relevant structure from supported PDFs and document
    formats.
-   Suggest field locations and data types for template setup.
-   Show confidence and allow the user to correct suggestions.
-   Preserve page/section provenance for extracted content.
-   Build an evaluation corpus representative of real customer documents
    and document quality.

**Acceptance criteria:** an agreed evaluation threshold is met on a
representative corpus; suggestions remain reviewable and editable.

### P5.2 --- Drafting and clause assistance

-   Generate drafts from user instructions, approved clauses, template
    content, and authorized CRM facts.
-   Show proposed changes as a diff rather than silently replacing
    existing text.
-   Identify which CRM facts and approved clause sources were used.
-   Require an authorized user to review and apply changes.
-   Never modify issued or completed document content.

**Acceptance criteria:** every applied AI change has an actor,
timestamp, and version diff; issued content remains immutable.

### P5.3 --- Permission-aware document Q&A and summaries

-   Restrict retrieval to documents and versions the requesting user is
    authorized to access.
-   Ground answers in retrievable source passages.
-   Cite document version and page/section where available.
-   State when the answer is not supported by the source.
-   Prevent cross-tenant retrieval and unauthorized CRM fact access.
-   Keep private document content out of logs unless explicitly required
    and protected.

**Acceptance criteria:** citations resolve to the correct version and
location; cross-tenant and unsupported-answer tests pass.

### P5.4 --- Clause comparison and obligation detection

-   Compare selected versions and summarize material differences.
-   Suggest potential obligations, dates, renewal terms, notice periods,
    and responsible parties.
-   Link each suggestion to its source passage.
-   Keep extracted obligations in a pending-review state.
-   Create operational tasks only after authorized confirmation.

**Acceptance criteria:** every suggestion has provenance and a review
state; unreviewed AI output cannot create consequential actions.

### P5.5 --- AI governance and evaluation

-   Record model/provider, prompt version, source document version,
    evaluation outcome, and relevant cost/latency metadata.
-   Use the existing SmartSapp AI gateway and prompt-governance patterns
    where appropriate.
-   Apply data minimization, access control, retention rules, and
    provider-configuration review.
-   Test prompt injection in documents, malicious embedded instructions,
    data exfiltration attempts, and cross-tenant retrieval.
-   Establish regression evaluations for extraction, summaries, Q&A,
    clause comparisons, and obligation suggestions.
-   Provide user feedback and incident review paths.

**Acceptance criteria:** failures and costs are observable; evaluation
thresholds are agreed; prompt-injection and authorization tests pass;
humans retain control over consequential actions.

## 11.2 Phase 5 release gate

-   AI features are feature-flagged and released to a limited cohort
    first.
-   No AI feature bypasses tenant authorization or document permissions.
-   Source citations and version provenance are visible.
-   Evaluation results meet product-approved thresholds.
-   Human review is enforced for drafts, clauses, and obligations before
    application.
-   AI failure degrades safely without blocking normal document/signing
    workflows.

------------------------------------------------------------------------

# 12. Phase 6 --- Enterprise readiness

**Objective:** Complete assurance, resilience, governance, and
production-readiness requirements for supported customer use cases.\
**Indicative duration:** 2--5 weeks, with legal/security dependencies
potentially extending the phase.

## 12.1 Work packages

### P6.1 --- Assurance profiles

-   Define assurance profiles by jurisdiction and document type based on
    actual customer requirements.
-   Document required recipient verification, consent evidence, audit
    events, retention, and signing method.
-   Obtain legal/security review before exposing customer-facing
    assurance claims.
-   Clearly communicate which workflows are and are not supported.

### P6.2 --- Cryptographic signing where required

-   Determine whether certificate-backed PDF signatures are required for
    target use cases.
-   If required, design certificate/key lifecycle, signing, validation,
    expiry/revocation handling, and operational ownership.
-   Validate generated documents independently using appropriate
    validation tools.
-   Document limitations and failure handling.

Do not imply that a visual signature, hash, or completion certificate
alone guarantees legal enforceability.

### P6.3 --- Resilience and disaster recovery

-   Load-test PDF generation, signing traffic, event processing, and
    background jobs.
-   Test backup restoration and recovery of metadata and artifacts.
-   Define recovery time and recovery point objectives with
    product/operations owners.
-   Add operational alerts, dashboards, and incident runbooks.
-   Test provider outage, job retry exhaustion, partial finalization,
    and storage failure scenarios.

### P6.4 --- Governance and evidence operations

-   Finalize retention schedules, legal hold, archive, and deletion
    policies.
-   Restrict and audit evidence exports and privileged access.
-   Test retention jobs and exception handling.
-   Document incident response, customer support access, and audit
    procedures.
-   Review privacy and data-processing obligations for supported
    markets.

### P6.5 --- Accessibility, security, and release

-   Complete accessibility review of the template studio, sender
    workflow, signing portal, and contract workspace.
-   Complete application security review and tenant-isolation testing.
-   Resolve all release-blocking defects.
-   Approve monitoring, support readiness, rollout and rollback
    playbooks.
-   Obtain product, engineering, security, operations, and
    legal/compliance sign-off for the applicable scope.

## 12.2 Phase 6 release gate

-   Supported assurance profiles are explicitly documented and approved.
-   Required signature validation succeeds for supported profiles.
-   Backup/restore and recovery procedures are tested against agreed
    objectives.
-   Retention, legal hold, and evidence export controls are tested.
-   No unresolved release-blocking security or accessibility findings
    remain.
-   Staged rollout and rollback are approved.

------------------------------------------------------------------------

# 13. Migration strategy: how to move safely from old to new

## 13.1 Recommended migration pattern

Use an expand--migrate--verify--switch--contract sequence:

1.  **Expand:** add new types, collections, indexes, service boundaries,
    and feature flags without removing legacy paths.
2.  **Map:** create deterministic mappings between legacy records and
    new domain objects.
3.  **Backfill:** migrate in bounded batches with checkpoints and
    resumability.
4.  **Verify:** reconcile counts, IDs, relationships, statuses,
    timestamps, and artifact references.
5.  **Shadow-read:** compare new-model results with legacy results
    without changing user-visible behavior.
6.  **Canary:** enable the new workflow for internal users and a small,
    controlled cohort.
7.  **Expand rollout:** increase adoption only after metrics and support
    feedback meet release criteria.
8.  **Retire:** remove legacy reads/writes only after all consumers have
    migrated and rollback no longer depends on them.

## 13.2 Legacy mapping principles

  -----------------------------------------------------------------------
  Legacy concept          Target concept(s)       Migration rule
  (reported)                                      
  ----------------------- ----------------------- -----------------------
  `PDFForm`               `DocumentTemplate` and  Preserve legacy ID
                          possibly                mapping; do not assume
                          `TemplateVersion`       every old form is a
                                                  reusable published
                                                  template without
                                                  inspection.

  `PDFFormField`          Versioned template      Preserve field IDs and
                          field definition        semantics where
                                                  possible; validate
                                                  field geometry and
                                                  types.

  `Contract`              `Contract` plus links   Preserve contract
                          to document             identity and historical
                          instances/envelopes     status; do not derive a
                                                  new status without an
                                                  explicit mapping rule.

  `Submission`            `SigningEnvelope`,      Inspect actual record
                          recipient state, field  semantics before
                          values, events, and     splitting; retain
                          artifact links as       source record
                          appropriate             references.

  Stored source/completed `DocumentArtifact`      Do not rewrite or
  PDFs                    records and storage     delete source artifacts
                          references              during metadata
                                                  migration; verify
                                                  access and hashes where
                                                  feasible.

  Activity/notification   Canonical events and    Avoid duplicate
  records                 existing CRM activity   activity entries;
                          records                 define which historical
                                                  records are imported
                                                  versus left in place.
  -----------------------------------------------------------------------

These mappings are conceptual, not automatic one-to-one conversions.
Phase 0 must confirm actual fields, relationships, and historical usage.

## 13.3 Backfill controls

Every migration batch should record:

-   Migration version and run ID.
-   Source and target IDs.
-   Workspace/tenant ID.
-   Batch start/end and checkpoint.
-   Created, updated, skipped, and failed counts.
-   Validation errors and retry state.
-   Reconciliation result.
-   Operator and execution environment.

Requirements:

-   Make jobs resumable and idempotent.
-   Use dry-run mode and representative test data.
-   Rate-limit writes to avoid disrupting production.
-   Do not copy data across tenants when ownership is missing or
    ambiguous.
-   Quarantine malformed or ambiguous records for review.
-   Keep a rollback strategy for metadata and application routing.
-   Never delete source data as part of the first migration pass.

## 13.4 Reconciliation checks

At minimum, reconcile:

-   Source record counts by type and status.
-   Source-to-target mapping coverage.
-   Workspace ownership and access-control fields.
-   Template and field counts.
-   Contract and submission relationships.
-   Recipient counts and statuses.
-   Artifact references, existence, file size, and hashes where
    available.
-   Timestamps, creator/owner references, and historical activity.
-   Duplicate mappings, orphan records, and unmapped records.

Set acceptable variance to zero for identity, tenant ownership,
completed execution records, and authoritative artifact references,
unless a documented exception is approved. Other differences must be
explained and signed off.

## 13.5 Rollback rules

Rollback should switch application traffic or feature flags back to the
prior path without deleting records or artifacts created during the new
path.

Before release, document:

-   Which version of the application and data model is compatible with
    the rollback path.
-   Whether new-path records can be read by the legacy application.
-   How writes made during the canary are preserved.
-   How events and notifications are deduplicated after rollback/replay.
-   Who can authorize rollback and which thresholds trigger it.

If new-path records cannot safely be consumed by the legacy path, keep
the canary narrow and define a forward-recovery procedure before
enabling it.

------------------------------------------------------------------------

# 14. Architecture and engineering guardrails

## 14.1 Keep the initial deployment architecture simple

-   Retain the existing Next.js/Firebase deployment and shared CRM
    services initially.
-   Introduce clear module/service boundaries in the existing
    application.
-   Keep document rendering, signing execution, contract lifecycle, AI
    analysis, CRM integration, analytics, and automation
    responsibilities distinct.
-   Use durable background work for long-running or retryable
    operations.
-   Consider a separate service only when measured scaling, isolation,
    reliability, or operational requirements justify it.

## 14.2 State and data ownership

-   Signing service owns envelope and recipient execution state.
-   Document management owns template versions, document instances, and
    artifact metadata.
-   Contract lifecycle owns agreement metadata, obligations,
    amendment/renewal relationships, and lifecycle state.
-   CRM remains the master for contacts/entities and other CRM records.
-   Analytics is derived from canonical events and source records.
-   AI analysis is a versioned, reviewable result---not authoritative
    contract state.

## 14.3 API and event contracts

For each command or event, specify:

-   Actor and required permission.
-   Workspace/tenant scope.
-   Input validation and schema version.
-   Idempotency behavior.
-   Allowed state transition.
-   Side effects and durable delivery strategy.
-   Error codes and retryability.
-   Audit/event output.
-   Rate limits and observability.

Avoid introducing an event bus or abstraction that duplicates existing
SmartSapp infrastructure without a clear need. Reuse established
patterns after Phase 0 verifies their suitability.

------------------------------------------------------------------------

# 15. Test strategy

Testing is a continuous requirement, not a final phase.

## 15.1 Test layers

1.  **Unit tests:** validation, state transitions, mapping,
    authorization helpers, calculations, and idempotency logic.
2.  **Integration tests:** Firestore transactions, storage, PDF
    renderer, messaging, task creation, event delivery, and CRM links.
3.  **End-to-end tests:** template-to-signature journeys, multi-party
    routing, contract lifecycle, and public portal behavior.
4.  **Security tests:** cross-tenant access, broken object-level
    authorization, token replay, privilege escalation, public endpoint
    abuse, and AI retrieval boundaries.
5.  **Migration tests:** dry run, resume, duplicate execution, malformed
    records, reconciliation, rollback, and forward recovery.
6.  **Visual/regression tests:** PDF geometry and content, plus
    responsive workspace and signing UI.
7.  **Load/resilience tests:** concurrency, retries, provider outages,
    slow PDF generation, queue backlogs, and restoration.
8.  **AI evaluation tests:** extraction accuracy, citation correctness,
    unsupported answers, prompt injection, leakage, and output
    regressions.

## 15.2 Minimum end-to-end scenarios

-   Existing single-recipient signing succeeds from dispatch through
    final download.
-   A user cannot view or download another workspace's document.
-   Repeated finalization does not create duplicate completion or
    notification.
-   A template edit does not change a previously issued document.
-   Sequential signing waits for the required prior recipient.
-   Parallel signing tracks each recipient independently and completes
    only when requirements are met.
-   Declined, voided, expired, and revoked workflows stop further
    unauthorized actions.
-   A completed envelope points to one authoritative artifact.
-   An amendment links to, but does not overwrite, the previous executed
    contract.
-   An overdue obligation creates no duplicate task on retry.
-   Analytics reconcile to source records.
-   AI Q&A cites the correct document version and cannot retrieve
    unauthorized content.
-   A failed migration batch can resume without duplicate target
    records.

------------------------------------------------------------------------

# 16. Release management and rollout

## 16.1 Environment progression

1.  Local development with emulators or isolated test services where
    appropriate.
2.  CI with unit, integration, security, and type checks.
3.  Shared staging environment with representative synthetic/redacted
    data.
4.  Internal pilot using controlled workspace accounts.
5.  Limited production canary.
6.  Gradual rollout by workspace/cohort.
7.  General availability after monitoring and acceptance gates pass.

Do not use unredacted production contract content in development or AI
evaluation unless access, purpose, and controls have been explicitly
approved.

## 16.2 Feature flags

Use independent flags for major capability groups, for example:

-   New document-domain read path.
-   New template versioning.
-   New envelope execution.
-   Multi-party routing.
-   Contract lifecycle workspace.
-   Analytics dashboards.
-   AI extraction and Q&A.
-   AI drafting and obligation suggestions.

Define an owner, intended cohort, success criteria, kill switch, and
retirement condition for each flag. Avoid creating flags that are never
removed.

## 16.3 Canary monitoring

Monitor at least:

-   Signing completion and failure rates.
-   Finalization retries and duplicate attempts.
-   PDF generation duration and failures.
-   Artifact persistence and download errors.
-   Recipient access failures and suspicious token use.
-   Notification delivery and duplicate suppression.
-   Event backlog, retries, and dead-letter count.
-   Cross-tenant authorization test results and security alerts.
-   User support tickets and abandonment.
-   AI latency, errors, cost, citation failures, and user corrections
    when AI is enabled.

Define thresholds during Phase 0 using current baselines and agreed
service expectations. Do not invent thresholds without production data.

------------------------------------------------------------------------

# 17. Suggested delivery backlog and sequencing

The following backlog is the recommended order of execution. It can be
copied into an issue tracker and converted into epics/stories after
Phase 0.

  ----------------------------------------------------------------------------
                  Order Epic             Key output           Dependency
  --------------------- ---------------- -------------------- ----------------
                      1 Current-state    Code/data/security   None
                        audit            maps and baseline    
                                         tests                

                      2 Migration and    Feature flags,       1
                        release controls runbooks,            
                                         reconciliation plan  

                      3 Artifact         Unified renderer and 1
                        integrity        authoritative        
                                         artifacts            

                      4 Finalization     Idempotent           1, 3
                        reliability      finalization and     
                                         durable side effects 

                      5 Recipient        Hardened sessions    1, 4
                        security and     and execution        
                        evidence         evidence             

                      6 Domain model     Validated schemas    1
                                         and state machines   

                      7 Compatibility    Legacy-to-target     6
                        adapter          mapping and stable   
                                         service boundary     

                      8 Template         Immutable published  6, 7
                        versioning       versions             

                      9 Envelope and     Multi-party routing  4, 5, 6, 7
                        recipients       and recipient states 

                     10 Document         Search, details,     7, 8, 9
                        workspace        versions, artifact   
                                         access               

                     11 Contract         Contracts,           6, 7, 10
                        lifecycle        amendments,          
                                         obligations,         
                                         renewals             

                     12 CRM integration  Contextual links,    9, 11
                                         timeline, canonical  
                                         events               

                     13 Analytics and    Reconciled metrics,  12
                        automation       reminders, durable   
                                         workflows            

                     14 AI foundations   Permission-aware     8, 11, security
                                         retrieval and        controls
                                         evaluation harness   

                     15 AI capabilities  Extraction,          14
                                         drafting, Q&A,       
                                         comparison,          
                                         obligations          

                     16 Enterprise       Legal/security       Relevant phases
                        assurance        profiles,            complete
                                         resilience,          
                                         governance           

                     17 General          Final sign-off and   All release
                        availability     staged rollout       gates
  ----------------------------------------------------------------------------

Some work such as UX discovery, event design, test harness development,
and threat modeling can proceed in parallel. Implementation dependencies
and release gates remain mandatory.

------------------------------------------------------------------------

# 18. Definition of done for the finished platform

The project is not complete merely because all screens exist. The target
is reached when all applicable conditions below are met.

## Functional completeness

-   [ ] Reusable templates and immutable versions work.
-   [ ] Document instances and artifacts have clear identity and
    provenance.
-   [ ] Single- and multi-recipient signing workflows work.
-   [ ] Internal review, countersigning, decline, void, expiry, and
    supported reassignment policies work.
-   [ ] Completed documents and execution evidence are retrievable by
    authorized users.
-   [ ] Contract lifecycle, amendments, obligations, renewals,
    termination, and archive workflows work.
-   [ ] CRM records link to documents and contracts without duplicate
    master data.
-   [ ] Analytics reconcile to canonical records.
-   [ ] Automation retries are safe and observable.
-   [ ] AI features meet evaluation thresholds and preserve human
    review.

## Data and migration completeness

-   [ ] Every in-scope legacy record has a verified mapping or a
    documented exception.
-   [ ] Historical contracts, submissions, and completed artifacts
    remain accessible as authorized.
-   [ ] No unexplained tenant ownership or identity mismatches remain.
-   [ ] Reconciliation reports are reviewed and retained.
-   [ ] Legacy paths are retired only after dependency checks and
    rollback requirements are satisfied.

## Security and operational completeness

-   [ ] Tenant isolation and object-level authorization tests pass.
-   [ ] Public signing sessions are validated, expirable, and revocable
    as required.
-   [ ] Finalization and downstream side effects are idempotent.
-   [ ] Evidence and artifact access is controlled and audited.
-   [ ] Monitoring, alerting, incident runbooks, backup, and restoration
    are tested.
-   [ ] Accessibility and security reviews have no unresolved
    release-blocking findings.
-   [ ] Legal/compliance owners approve applicable assurance claims and
    retention policies.
-   [ ] Rollout and rollback procedures have been rehearsed.

## Product and support readiness

-   [ ] User documentation and internal support runbooks exist.
-   [ ] Support can investigate a signing failure using correlation IDs
    and authorized evidence.
-   [ ] Known limitations are documented.
-   [ ] Product owner accepts the scope and metrics.
-   [ ] Engineering, QA, security, operations, and legal/compliance
    provide the sign-offs relevant to the release.

------------------------------------------------------------------------

# 19. Governance: weekly delivery rhythm

Recommended cadence:

-   **Planning:** confirm the next sprint's stories, dependencies,
    owners, test plan, and acceptance criteria.
-   **Engineering review:** review schema/API changes, tenant scope,
    state transitions, idempotency, and rollback impact before merge.
-   **Migration review:** inspect backfill counts, failures,
    reconciliation, and exceptions.
-   **Quality review:** review CI results, security findings, regression
    failures, and test gaps.
-   **Operational review:** review errors, latency, artifact failures,
    event backlog, support incidents, and cost.
-   **Product demo:** demonstrate complete user journeys---not just
    isolated screens.
-   **Gate decision:** explicitly record whether each phase is accepted,
    blocked, or accepted with documented non-blocking follow-up work.

Every epic should include implementation, automated tests,
observability, security review, migration impact, documentation, and
release/rollback notes.

------------------------------------------------------------------------

# 20. Immediate next steps

The first sprint should focus on discovery and preparation, not new AI
features or a complete UI rewrite.

1.  Assign a product owner, technical lead, migration owner, QA owner,
    and security/compliance reviewer.
2.  Open a Phase 0 epic and track each work package as a separate issue.
3.  Have the coding agent inventory the repository, but require file
    paths, symbols, callers, tests, and evidence for every reported
    finding.
4.  Verify the current signing flow manually in a safe test environment.
5.  Build baseline end-to-end tests for the existing single-recipient
    flow.
6.  Inventory Firestore records, storage artifacts, tenant rules, and
    production dependencies.
7.  Review the target domain model and define the compatibility adapter
    before adding new collections.
8.  Agree on migration metrics, canary criteria, rollback triggers, and
    release sign-off owners.
9.  Exit Phase 0 with a verified implementation map and an estimate
    revised from actual repository findings.
10. Start Phase 1 only after the Phase 0 acceptance gate is met.

## Final recommendation

The safest route is to **stabilize the existing signing engine first,
introduce the new domain model through a compatibility layer, migrate
incrementally, and only then expand into contract lifecycle, CRM
analytics, automation, and AI intelligence**.

This sequence minimizes the risk of breaking current customers and
avoids building advanced capabilities on top of unverified state
handling, inconsistent PDF artifacts, or unclear tenant boundaries.

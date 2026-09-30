**SMARTSAPP CRM**

Document & Contract  
Intelligence Platform

Current-State Technical Audit, Migration Design & Phased Product
Requirements Document

Version 1.0 \| 28 September 2026 \| Status: Proposed target design;
source-code verification required

| **Document control**   | **Value**                                                                                                     |
|------------------------|---------------------------------------------------------------------------------------------------------------|
| Product                | SmartSapp CRM — Document Signing / Document & Contract Intelligence                                           |
| Audience               | Product, Engineering, Design, QA, Security, Operations, Legal/Compliance                                      |
| Baseline source        | User-provided coding-agent extraction of the current implementation                                           |
| Implementation posture | Incremental, backward-compatible migration; no big-bang replacement                                           |
| Important limitation   | This document is based on the supplied extraction, not an independent repository execution or security audit. |

Purpose: define the current-state assessment, target architecture,
migration controls, detailed product requirements, APIs, data contracts,
UX, security, testing, and phase acceptance gates needed to mature the
existing feature safely.

# How to read this specification

This document separates three evidence levels so that proposed design is
not mistaken for verified implementation.

| **Label**              | **Meaning**                                                                                             |
|------------------------|---------------------------------------------------------------------------------------------------------|
| Reported current state | Described in the supplied coding-agent extraction. It has not been independently tested in this review. |
| Verification required  | A claim or control that must be checked in source code, configuration, tests, or production telemetry.  |
| Target requirement     | A proposed requirement for the future platform. It is not a statement that the capability exists today. |

The report identifies the current PDFForm, PDFFormField, Contract, and
Submission concepts; a PDF template editor; CRM variable binding;
contract dispatch; public signing; signature capture; PDF generation;
notifications; activity logging; and submission analytics. All
recommendations below build on that baseline while explicitly calling
out unverified details.

# Executive summary

SmartSapp should evolve the existing signing feature into a CRM-native
Document & Contract Intelligence Platform. The platform should support
document creation and versioning, contract lifecycle management,
multi-party execution, trustworthy evidence, AI-assisted document work,
CRM contextual tracking, analytics, automation, and jurisdiction-aware
governance.

The main architectural change is to stop treating a PDF template and its
submission as the central model for every document workflow. Introduce
separate but linked domain concepts for reusable templates, immutable
template versions, generated document instances, signing envelopes,
recipients, contracts, artifacts, evidence events, obligations, and
analytics.

Keep the existing Next.js/Firebase application and shared CRM services
initially. Introduce modular boundaries and migration adapters before
considering separately deployed services. Prioritize correctness, tenant
isolation, document integrity, and reliable finalization before
expanding AI and advanced lifecycle features.

# 1. Product vision, goals, and non-goals

## 1.1 Vision

Provide one integrated SmartSapp workspace to create, personalize,
review, issue, sign, manage, analyze, renew, and archive business
documents and contracts, with CRM context and permission-aware AI
assistance throughout.

## 1.2 Product goals

- Preserve current document templates, contract records, submission
  history, and access to completed documents.

- Support multiple document types, reusable templates, versioned
  content, conditional fields, and branded output.

- Support multi-recipient signing, sequential and parallel routing,
  internal approvals, countersigning, decline, void, expiry, and
  reassignment policies.

- Produce one authoritative final artifact and a verifiable execution
  evidence record.

- Connect documents to SmartSapp contacts, institutions/entities, deals,
  meetings, tasks, campaigns, finance, and subscriptions without
  duplicating master records.

- Provide lifecycle analytics, reminders, obligations, amendments,
  renewals, and operational reporting.

- Add AI capabilities with provenance, access controls, evaluation,
  human review, and auditability.

- Operate with explicit tenant boundaries, recoverable background work,
  observability, and tested migration/rollback procedures.

## 1.3 Non-goals for the first release

- Replacing the entire CRM or rebuilding identity, messaging, task
  management, or billing services.

- Immediately decomposing the product into microservices or a separate
  deployment.

- Guaranteeing legal enforceability solely through a checkbox, hash,
  certificate page, or a particular PDF library.

- Allowing AI to autonomously approve, alter material contract terms,
  execute signatures, or send legally consequential documents without an
  authorized human action.

- Supporting every jurisdiction-specific signature formalism at launch;
  requirements must be prioritized by actual customer use cases and
  legal review.

# 2. Current-state technical audit

## 2.1 Reported architecture and flow

> Template PDF (Firebase Storage) → PDF Studio / field mapper → PDFForm
> in Firestore  
> → Contract wizard → Contract record + dispatch via messaging engine  
> → Public /forms/\[pdfId\] portal → PDF.js canvas + interactive
> fields  
> → Signature capture / consent → submission record + contract update  
> → PDF generation + signer confirmation + internal alert + CRM
> activity  
> → Results viewer, downloads, submission logs, CSV export, funnel
> analytics

This flow is reconstructed from the supplied extraction. Confirm actual
call graphs and alternate paths before changing any endpoint.

## 2.2 Reported components and verification focus

| **Area / reported file or concept**                               | **Reported responsibility**                            | **Audit questions / risk to verify**                                                                          |
|-------------------------------------------------------------------|--------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| src/lib/types.ts — PDFForm / PDFFormField / Contract / Submission | Core template, field, contract, and submission types   | Are fields optional or versioned? Which fields are required in production? Are tenant/workspace IDs enforced? |
| PDF Studio editor and Inspector.tsx                               | Upload PDF, place fields, edit styles and variables    | Are coordinates normalized per page size/rotation? Can published templates be edited after dispatch?          |
| FieldsVariablesService                                            | Resolve CRM tokens such as entity and signatory values | Are resolved values snapshotted at issue time? Are unknown variables rejected or silently blank?              |
| ContractsClient.tsx / ContractWizard.tsx / contract-actions.ts    | Select entities, create contracts, dispatch messages   | Are sends idempotent? Is recipient identity validated? Are partial bulk failures recoverable?                 |
| forms/\[pdfId\] and PdfFormRenderer.tsx                           | Public signing portal, rendering, field overlays       | Can entityId be manipulated? What server-side authorization is performed on every read/write?                 |
| SignaturePadModal.tsx / signature-processing.ts                   | Draw, type, scan, upload, refine signature image       | Are file type/size constrained? Are signatures retained as base64? Is consent wording versioned?              |
| pdf-actions.ts / api/pdfs/submit/route.ts                         | Save progress, finalize, generate PDF, update contract | Can concurrent submits create duplicates? What happens if PDF generation succeeds but message sending fails?  |
| SharedSubmissionView.tsx / generate routes                        | Results view and PDF downloads                         | Are client and server output identical? Are protected downloads short-lived and authorized?                   |
| Submissions page / activity collection                            | Submission logs, CSV export, funnel analytics          | Are exports tenant-scoped? Are events complete, deduplicated, and consistently defined?                       |

## 2.3 Strengths to preserve

- Existing visual PDF template editor and percentage-based field
  placement.

- Existing CRM variable binding through the shared
  FieldsVariablesService.

- Existing contract dispatch wizard and messaging-engine integration.

- Existing public signing route, password-gated experience, and progress
  saving.

- Multiple signature capture methods and image refinement.

- Server-side PDF generation, submission history, activity timeline, CSV
  export, and basic funnel analytics.

## 2.4 Risk register

| **ID / severity** | **Risk**                                                                                                | **Potential impact**                                                                      | **Required treatment**                                                                                                  |
|-------------------|---------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| R-01 Critical     | Signing authorization may depend too heavily on public URL parameters or incomplete server-side checks. | Cross-entity or cross-tenant access; unauthorized submission.                             | Trace every read/write; recipient-bound, expiring token; server-side tenant and resource authorization; negative tests. |
| R-02 Critical     | Finalization spans database writes, PDF generation, and external messaging.                             | Duplicate execution, inconsistent status, missing artifact, duplicate notifications.      | Idempotent command; durable state machine; transactional state writes; outbox/jobs for side effects.                    |
| R-03 Critical     | No complete evidence record is demonstrated by the extraction.                                          | Difficult to establish signing intent, sequence, integrity, and identity assurance.       | Define evidence policy; append-only event model; artifact digests; consent and verification records.                    |
| R-04 High         | Client screenshot and server PDF generation may diverge.                                                | Blurry, inaccessible, differently paginated or inconsistent completed documents.          | One authoritative server-side artifact pipeline; parity tests across page sizes, fonts, rotations and fields.           |
| R-05 High         | Template, contract, and submission concepts may be too tightly coupled.                                 | Hard to support multiple documents, versions, amendments, and multi-party envelopes.      | Add domain model and compatibility adapters; preserve legacy IDs and relationships.                                     |
| R-06 High         | Single-signer assumptions.                                                                              | Cannot reliably route agreements among customers, witnesses, and internal countersigners. | Recipient records, role assignment, routing rules, recipient-level state machine.                                       |
| R-07 High         | Contract status may be used to represent envelope and recipient status.                                 | Incorrect reporting and invalid transitions.                                              | Separate contract, document, envelope, and recipient state machines.                                                    |
| R-08 High         | Signature images may be stored in submission payloads as base64.                                        | Large Firestore documents, poor queryability, sensitive data exposure.                    | Store image/artifact bytes in protected object storage; store references and integrity metadata.                        |
| R-09 High         | CRM variable values may be resolved dynamically after issue.                                            | Document content can change relative to what the signer originally saw.                   | Resolve and freeze values into an issued-document snapshot.                                                             |
| R-10 Medium       | Manual field placement and no structured clause/version system.                                         | Template setup is slow and content reuse is difficult.                                    | Add optional OCR/AI-assisted field detection, content blocks, clause library, template versions.                        |
| R-11 Medium       | Current analytics may be submission-centric.                                                            | Weak funnel, cohort, commercial attribution, and renewal insights.                        | Standard event taxonomy, event ingestion, definitions, and derived aggregates.                                          |
| R-12 Medium       | Legal/security capabilities may be described too broadly.                                               | Incorrect claims about enforceability or compliance.                                      | Jurisdiction-aware assurance profiles and review by qualified counsel.                                                  |

## 2.5 Findings that cannot yet be confirmed

The extraction is a coding-agent report, not a complete repository
audit. The following remain unverified and must not be represented as
established vulnerabilities or existing capabilities:

- Actual Firestore rules, Firebase Storage rules, callable/server action
  authorization, and workspace scoping.

- Whether signing links are signed, high entropy, revocable, or bound to
  a recipient behind the scenes.

- Whether finalization already uses transactions, idempotency keys,
  locks, or retry-safe operations.

- Whether audit logs are append-only, access-restricted, exported, or
  protected against privileged modification.

- Whether document hashes, PDF signatures, certificates, or identity
  verification exist in unmentioned modules.

- Exact Firestore collection counts, data volumes, indexes, production
  traffic, latency, error rates, and cost.

- Existing test coverage, production incident patterns, retention
  policies, and disaster recovery capabilities.

## 2.6 Required audit deliverables

- Call graph and sequence diagrams for template creation, dispatch,
  access, progress save, finalization, PDF download, and bulk send.

- Collection/schema inventory with counts, tenant ownership, indexes,
  rules, and representative redacted records.

- Authorization matrix by route/action, actor, workspace, entity
  relationship, and recipient state.

- Artifact inventory: original PDF, preview, submitted values, signature
  assets, completed PDF, certificate, and storage location.

- State-transition table for all existing contract and submission
  statuses.

- Dependency and deployment inventory for scheduled jobs, messaging
  providers, storage, secrets, and existing automation.

- Baseline test suite and migration rehearsal results.

# 3. Target product and domain architecture

## 3.1 Product domains

| **Domain**          | **Owns**                                                                           | **Key boundary**                                                     |
|---------------------|------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| Document management | Templates, template versions, document instances, artifacts, rendering             | Does not own recipient authentication or commercial contract state.  |
| Signing execution   | Envelopes, recipients, routing, signing fields, consent, execution events          | Does not own CRM contact master data.                                |
| Contract lifecycle  | Agreement record, terms metadata, obligations, amendments, renewal and termination | Does not render PDFs or own raw signature assets.                    |
| AI intelligence     | Extraction, summaries, clause analysis, drafting suggestions, retrieval            | Cannot bypass permissions or directly execute consequential actions. |
| CRM integration     | Links to contacts/entities/deals/meetings/tasks/campaigns/finance                  | Uses existing master records; avoids duplicating CRM identity.       |
| Analytics           | Canonical events, aggregates, funnel metrics and reporting                         | Derived metrics are not the authoritative contract state.            |
| Automation          | Reminder schedules, triggers, retry policy, run records                            | Uses durable jobs and idempotent actions.                            |

## 3.2 Conceptual relationship model

> Workspace/Tenant  
> ├─ DocumentTemplate ──\< TemplateVersion  
> ├─ DocumentInstance ──\< DocumentArtifact  
> │ └─ issuedFrom → TemplateVersion  
> ├─ SigningEnvelope ──\< EnvelopeDocument (document instance +
> version)  
> │ ├─\< Recipient ──\< RecipientFieldValue  
> │ └─\< DocumentEvent / EvidenceRecord  
> └─ Contract ──\< ContractDocumentLink  
> ├─\< Obligation  
> └─\< ContractRelationship (amendment / renewal / supersedes)  
>   
> CRM links: entity/contact/deal/meeting/task/campaign/subscription
> IDs  
> AI: DocumentAnalysis → source document version + source passages +
> model/prompt version

One contract may link to multiple document instances and envelopes
across amendments and renewals. One envelope may contain one or more
related documents if product rules permit. A completed envelope must
refer to immutable issued versions.

## 3.3 Suggested Firestore structure

Paths are illustrative. Before implementation, align them with
SmartSapp's established tenant/workspace partitioning pattern and query
needs. Do not introduce a new tenancy convention that conflicts with
TenantContext or existing entities/workspace_entities.

> workspaces/{workspaceId}/document_templates/{templateId}  
> workspaces/{workspaceId}/document_templates/{templateId}/versions/{versionId}  
> workspaces/{workspaceId}/document_instances/{documentId}  
> workspaces/{workspaceId}/document_instances/{documentId}/artifacts/{artifactId}  
> workspaces/{workspaceId}/signing_envelopes/{envelopeId}  
> workspaces/{workspaceId}/signing_envelopes/{envelopeId}/recipients/{recipientId}  
> workspaces/{workspaceId}/signing_envelopes/{envelopeId}/events/{eventId}  
> workspaces/{workspaceId}/signing_envelopes/{envelopeId}/evidence/{evidenceId}  
> workspaces/{workspaceId}/contracts/{contractId}  
> workspaces/{workspaceId}/contracts/{contractId}/obligations/{obligationId}  
> workspaces/{workspaceId}/contracts/{contractId}/relationships/{relationshipId}  
> workspaces/{workspaceId}/document_analyses/{analysisId}  
> workspaces/{workspaceId}/document_automation_runs/{runId}  
> workspaces/{workspaceId}/document_analytics_daily/{yyyyMMdd}

A workspace-scoped path is a proposal, not a mandated path. If SmartSapp
uses top-level collections with workspaceId fields, preserve that
convention where it provides correct security and query behavior.
Security rules must not rely solely on the client-supplied path or ID.

## 3.4 Core schema contracts

### DocumentTemplate

> interface DocumentTemplate {  
> id: string;  
> workspaceId: string;  
> name: string;  
> description?: string;  
> documentType: 'contract' \| 'agreement' \| 'proposal' \| 'form' \|  
> 'letter' \| 'policy' \| 'certificate' \| 'other';  
> status: 'draft' \| 'published' \| 'archived';  
> currentPublishedVersionId?: string;  
> source: { kind: 'pdf' \| 'native'; storagePath?: string };  
> branding?: { logoPath?: string; themeId?: string };  
> variableSchema: VariableDefinition\[\];  
> createdBy: string;  
> createdAt: string;  
> updatedAt: string;  
> archivedAt?: string;  
> }

### TemplateVersion

> interface TemplateVersion {  
> id: string;  
> workspaceId: string;  
> templateId: string;  
> versionNumber: number;  
> status: 'draft' \| 'published' \| 'superseded';  
> contentSnapshot: { storagePath: string; sha256: string };  
> fields: DocumentFieldDefinition\[\];  
> clauses?: ClauseReference\[\];  
> variableSchemaVersion: string;  
> createdBy: string;  
> createdAt: string;  
> publishedAt?: string;  
> changeSummary?: string;  
> }

### DocumentInstance and Artifact

> interface DocumentInstance {  
> id: string;  
> workspaceId: string;  
> templateId?: string;  
> templateVersionId?: string;  
> documentType: string;  
> title: string;  
> status: 'draft' \| 'in_review' \| 'approved' \| 'issued' \|  
> 'completed' \| 'archived';  
> crmLinks: Array\<{ type: 'entity' \| 'contact' \| 'deal' \| 'meeting'
> \|  
> 'task' \| 'campaign' \| 'subscription'; id: string }\>;  
> issuedContentSnapshot?: { storagePath: string; sha256: string };  
> createdBy: string;  
> createdAt: string;  
> issuedAt?: string;  
> }  
>   
> interface DocumentArtifact {  
> id: string;  
> workspaceId: string;  
> documentId: string;  
> kind: 'source' \| 'preview' \| 'issued' \| 'completed' \|  
> 'certificate' \| 'attachment' \| 'archive';  
> storagePath: string;  
> mimeType: string;  
> sizeBytes: number;  
> sha256: string;  
> pageCount?: number;  
> createdAt: string;  
> immutable: boolean;  
> }

### SigningEnvelope and Recipient

> interface SigningEnvelope {  
> id: string;  
> workspaceId: string;  
> status: 'draft' \| 'pending_approval' \| 'ready_to_send' \| 'sent'
> \|  
> 'in_progress' \| 'completed' \| 'declined' \| 'voided' \| 'expired';  
> documentIds: string\[\];  
> contractId?: string;  
> routingMode: 'sequential' \| 'parallel' \| 'custom';  
> recipients: Array\<{ recipientId: string; routingOrder: number }\>;  
> expiresAt?: string;  
> idempotencyKey?: string;  
> issuedAt?: string;  
> completedAt?: string;  
> createdBy: string;  
> createdAt: string;  
> updatedAt: string;  
> version: number;  
> }  
>   
> interface EnvelopeRecipient {  
> id: string;  
> workspaceId: string;  
> envelopeId: string;  
> crmContactId?: string;  
> role: string;  
> displayName: string;  
> email?: string;  
> phone?: string;  
> routingOrder: number;  
> status: 'pending' \| 'invited' \| 'delivered' \| 'viewed' \|  
> 'authentication_required' \| 'signed' \| 'declined' \|  
> 'delivery_failed' \| 'revoked' \| 'reassigned';  
> verificationPolicy: 'none' \| 'email' \| 'sms_otp' \| 'stronger';  
> invitedAt?: string;  
> viewedAt?: string;  
> signedAt?: string;  
> declinedAt?: string;  
> identityVerificationRef?: string;  
> }

### Events, evidence, and contract

> interface DocumentEvent {  
> id: string;  
> workspaceId: string;  
> envelopeId?: string;  
> documentId?: string;  
> recipientId?: string;  
> eventType: string;  
> occurredAt: string; // UTC ISO-8601  
> recordedAt: string; // server timestamp  
> actorType: 'user' \| 'recipient' \| 'system' \| 'integration' \|
> 'ai';  
> actorId?: string;  
> correlationId: string;  
> idempotencyKey?: string;  
> metadata: Record\<string, unknown\>; // allowlisted, no secrets  
> integrity?: { previousEventHash?: string; eventHash?: string };  
> }  
>   
> interface DocumentEvidence {  
> id: string;  
> workspaceId: string;  
> envelopeId: string;  
> kind: 'consent' \| 'identity_verification' \| 'document_digest' \|  
> 'completion_certificate' \| 'cryptographic_signature';  
> documentId?: string;  
> artifactId?: string;  
> sha256?: string;  
> policyVersion?: string;  
> createdAt: string;  
> storagePath?: string;  
> verificationStatus?: 'unverified' \| 'valid' \| 'invalid' \|
> 'unavailable';  
> }  
>   
> interface Contract {  
> id: string;  
> workspaceId: string;  
> title: string;  
> status: 'proposed' \| 'negotiation' \| 'pending_execution' \|  
> 'executed' \| 'active' \| 'renewal_pending' \| 'renewed' \|  
> 'expired' \| 'terminated' \| 'superseded';  
> partyLinks: Array\<{ entityId?: string; contactId?: string; role:
> string }\>;  
> documentIds: string\[\];  
> envelopeIds: string\[\];  
> contractValue?: { amount: number; currency: string };  
> effectiveAt?: string;  
> expiresAt?: string;  
> renewalAt?: string;  
> ownerId: string;  
> createdAt: string;  
> updatedAt: string;  
> }

Schema notes: validate with runtime schemas (for example, the
repository's established validation library); do not trust TypeScript
types as runtime validation. Avoid storing raw signing tokens, OTPs,
full signature images, or unrestricted request headers in these records.
Keep PII and evidence metadata minimized and access-controlled.

## 3.5 Field model

> interface DocumentFieldDefinition {  
> id: string;  
> key: string;  
> type: 'text' \| 'multiline' \| 'number' \| 'date' \| 'checkbox' \|  
> 'dropdown' \| 'email' \| 'phone' \| 'static_text' \| 'variable' \|  
> 'signature' \| 'initials' \| 'photo';  
> page: number;  
> position: { x: number; y: number; width: number; height: number };  
> coordinateSpace: 'normalized_page';  
> required: boolean;  
> assignedRole?: string;  
> variableKey?: string;  
> validation?: Record\<string, unknown\>;  
> style?: Record\<string, unknown\>;  
> }

Use normalized coordinates with explicit page coordinate space, page
rotation, crop box, and source page dimensions. The rendering layer must
transform these correctly. Preserve legacy percentage coordinates via a
tested adapter rather than changing the meaning of existing values in
place.

## 3.6 Indexing and query design

- Design composite indexes from actual screens and queries:
  workspaceId + status + updatedAt; workspaceId + ownerId + status;
  workspaceId + recipient status + due date; workspaceId + contractId;
  workspaceId + CRM link ID.

- Keep high-volume events in subcollections or a dedicated event store
  pattern; do not load every event to render a list view.

- Use pagination with stable ordering and cursors; avoid unbounded
  collection reads.

- Create daily aggregates asynchronously for analytics; include
  metric-definition version and aggregation timestamp.

- Set explicit TTL/retention only for eligible transient records. Do not
  automatically TTL-delete signed evidence or executed artifacts.

# 4. State machines and invariants

## 4.1 Template

> draft → published → superseded → archived  
> Published versions are immutable. Editing creates a new draft/version;
> publishing never changes an already issued document.

## 4.2 Document instance

> draft → in_review → approved → issued → completed → archived  
> Exceptions: cancelled before issue; superseded by a new
> document/version; retention hold.

## 4.3 Envelope

> draft → pending_approval → ready_to_send → sent → in_progress →
> completed  
> Alternative terminal paths: declined, voided, expired.  
> Delivery failure is an event/recipient state and does not necessarily
> terminate the whole envelope.

## 4.4 Recipient

> pending → invited → delivered → viewed → signed  
> Alternative paths: authentication_required, delivery_failed, declined,
> revoked, reassigned.  
> A recipient can sign only when the envelope is active, required
> verification has passed, and routing permits the recipient to act.

## 4.5 Contract

> proposed → negotiation → pending_execution → executed → active  
> Possible later states: renewal_pending → renewed; or expired /
> terminated / superseded.  
> Contract lifecycle is not inferred solely from one envelope's status.

## 4.6 Invariants

- An issued envelope references immutable document versions and frozen
  resolved variable values.

- A completed envelope has all required recipient actions, a persisted
  final artifact, and the configured evidence record.

- A signature submission is accepted at most once for a
  recipient/field/action idempotency key.

- Sequential routing does not activate a later recipient before all
  required prior routing steps are complete or explicitly bypassed under
  policy.

- Voiding an envelope prevents further signing; the system retains the
  historical events and artifacts subject to retention policy.

- Changing a published template never changes an already issued
  document.

- An AI-generated draft or extracted obligation is not treated as
  approved contract content until an authorized user accepts it.

- Only authorized workspace members and the properly authenticated
  recipient can access protected document content.

# 5. Migration design

## 5.1 Migration principles

- Expand before contract: add new fields and new models before changing
  consumers.

- Do not destructively rewrite legacy records in place during the
  initial rollout.

- Use a compatibility adapter to map legacy PDFForm/Contract/Submission
  records into the new domain interfaces.

- Keep legacy routes operational while new routes are introduced behind
  feature flags.

- Use deterministic migration IDs and idempotent scripts; record
  checkpoints and per-record outcomes.

- Preserve original timestamps, actor information, template IDs,
  submission IDs, and existing download access where available.

- Never fabricate missing consent, identity-verification, or audit
  events for historical signatures. Mark evidence as legacy/incomplete
  where appropriate.

- Run dry-run migrations and compare record counts, relationship counts,
  artifact hashes, and representative rendered documents before cutover.

## 5.2 Legacy-to-target mapping

| **Legacy concept**                        | **Target mapping**                                                | **Migration rule**                                                                                                                  |
|-------------------------------------------|-------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| pdfs/{pdfId} PDFForm                      | DocumentTemplate + initial TemplateVersion                        | Preserve pdfId as legacyId; snapshot current template file/fields; do not claim historical version immutability unless proven.      |
| PDFFormField array                        | DocumentFieldDefinition                                           | Map coordinates through an adapter; retain original coordinate payload for rollback.                                                |
| contracts/{contractId}                    | Contract + optional SigningEnvelope link                          | Preserve contract ID, entityId, status history if available, pdfId and submissionId references.                                     |
| pdfs/{pdfId}/submissions/{submissionId}   | DocumentInstance/Envelope relationship + legacy submission record | Preserve submissionId and formData access; move large binary data to object storage only through a verified copy-and-check process. |
| Signed PDF output                         | DocumentArtifact(kind=completed)                                  | Compute digest of actual stored bytes; record provenance; do not assume existing downloads are byte-identical.                      |
| activity records                          | DocumentEvent projection or linked legacy event                   | Retain original event; only normalize events when source fields support the mapping.                                                |
| confirmationTemplateId/adminAlertChannels | Notification policy references                                    | Keep compatible behavior; map to versioned automation rules after parity tests.                                                     |

## 5.3 Rollout stages

| **Step** | **Action**                                   | **Safety control / exit**                                                                                     |
|----------|----------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| M0       | Inventory and backup                         | Approved inventory, verified backup/restore, data counts and baseline tests.                                  |
| M1       | Add target schema and adapter                | No behavior change; legacy writes remain authoritative.                                                       |
| M2       | Dual-read in shadow mode                     | Compare old and new projections; log mismatches without changing user-visible output.                         |
| M3       | Backfill templates and contracts             | Idempotent batches, checkpoints, dead-letter report, sampled manual validation.                               |
| M4       | Backfill submissions and artifacts           | Verify storage bytes and digests; preserve legacy records; quarantine corrupt/missing artifacts.              |
| M5       | Enable new flows for internal/test workspace | Feature flag, security tests, operational dashboard, rollback rehearsal.                                      |
| M6       | Canary rollout                               | Small controlled workspace cohort; monitor errors, completion, latency, duplicate events and support tickets. |
| M7       | Progressive rollout                          | Expand only after gates pass; maintain compatibility endpoints.                                               |
| M8       | Read-path cutover                            | New model serves production reads; compare against legacy; rollback flag remains available.                   |
| M9       | Legacy write retirement                      | Only after a defined observation window, data reconciliation and owner approval.                              |
| M10      | Legacy cleanup                               | Separate approval; preserve legal retention, exports and old links as required.                               |

## 5.4 Dual-write and consistency strategy

Avoid uncontrolled dual writes from every UI component. Prefer a single
application service/command handler that writes the authoritative state
and a durable outbox event in the same Firestore transaction where
possible. Consumers then project events into analytics, notifications,
CRM timeline, and secondary representations. If an existing workflow
must write both models temporarily, make the operation idempotent and
reconcile mismatches.

## 5.5 Rollback

- Feature flag returns traffic to the legacy path without deleting new
  records.

- Keep legacy collections read/write-compatible until rollback window
  closes.

- Never roll back by deleting completed envelopes, evidence, or issued
  artifacts.

- Provide a replayable migration ledger with record ID, stage, status,
  error, attempt count, and checksum.

- Document which schema changes are additive and which require
  forward-only remediation.

## 5.6 Migration acceptance

- 100% of in-scope records are classified as migrated, intentionally
  excluded, or quarantined with a reason.

- All migrated relationships resolve to the correct workspace and CRM
  entity.

- Counts reconcile within explicitly documented exclusions.

- Representative artifacts open correctly and their recorded SHA-256
  matches stored bytes.

- Legacy public links and admin routes behave according to the rollout
  plan.

- Restore and rollback rehearsals pass in a staging environment.

# 6. API and event design

## 6.1 API conventions

- Use authenticated server-side handlers for administrative actions and
  recipient-bound capabilities for public signing.

- Validate every input with runtime schemas; reject unknown or
  unauthorized fields.

- Use stable resource IDs, UTC ISO-8601 timestamps, explicit pagination,
  and consistent error envelopes.

- Use Idempotency-Key for create/send/finalize/void operations where
  retries are possible.

- Do not expose storage paths, raw tokens, signature bytes, internal
  prompts, or unrestricted audit metadata to clients.

- Version public APIs and webhook payloads; maintain compatibility
  during migration.

- Use correlationId/requestId across request, job, notification, event,
  and audit records.

## 6.2 Proposed endpoint inventory

| **Method / route**                                | **Purpose**                                | **Authorization / notes**                                                  |
|---------------------------------------------------|--------------------------------------------|----------------------------------------------------------------------------|
| GET /api/v1/documents                             | List/search documents                      | Workspace permission; paginated; filter allowlist.                         |
| POST /api/v1/documents                            | Create a document draft                    | Document:create permission; idempotency supported.                         |
| GET /api/v1/documents/{id}                        | Read document detail                       | Workspace scope + document access.                                         |
| POST /api/v1/documents/{id}/versions              | Create a new draft version                 | Template:edit; published version remains immutable.                        |
| POST /api/v1/documents/{id}/render-preview        | Generate preview                           | Permission checked; rate limited; no publication side effect.              |
| POST /api/v1/envelopes                            | Create envelope draft                      | Envelope:create; validate document versions and recipients.                |
| POST /api/v1/envelopes/{id}/approve               | Approve for dispatch                       | Approval permission; separate from sender where policy requires four-eyes. |
| POST /api/v1/envelopes/{id}/send                  | Issue and dispatch                         | Envelope:send; idempotency key; freeze document snapshot.                  |
| GET /api/v1/envelopes/{id}                        | Read envelope and recipient progress       | Workspace permission; redact recipient-sensitive fields.                   |
| POST /api/v1/envelopes/{id}/void                  | Void envelope                              | Envelope:void; reason required; prevent further signing.                   |
| POST /api/v1/signing-sessions/{token}/verify      | Complete configured recipient verification | Token validated server-side; rate limit OTP attempts.                      |
| GET /api/v1/signing-sessions/{token}              | Get authorized signing session             | Token scope, expiry, recipient binding and envelope state checked.         |
| POST /api/v1/signing-sessions/{token}/progress    | Save recipient progress                    | Session capability; validate field assignment; rate limit.                 |
| POST /api/v1/signing-sessions/{token}/sign        | Submit signature and consent               | Atomic/idempotent; required fields and routing checked server-side.        |
| POST /api/v1/signing-sessions/{token}/decline     | Decline with reason                        | Reason policy; immutable event; notification job.                          |
| GET /api/v1/envelopes/{id}/artifacts/{artifactId} | Download an artifact                       | Authorize every download or issue short-lived URL after check.             |
| GET /api/v1/verification/{verificationId}         | Verify public authenticity                 | Return minimal non-confidential validation result.                         |
| GET /api/v1/contracts/{id}                        | Contract detail and lifecycle              | Contract:read; workspace and record authorization.                         |
| POST /api/v1/contracts/{id}/obligations           | Create/review obligation                   | Contract:manage; AI extraction must be reviewed.                           |
| POST /api/v1/documents/{id}/ai/analyze            | Run AI analysis                            | AI:use + document:read; cost/rate limit; persist provenance.               |
| POST /api/v1/documents/{id}/ai/draft              | Generate suggested content                 | Document:edit + AI:use; output is draft only.                              |
| GET /api/v1/analytics/documents                   | Document analytics                         | Analytics:read; aggregation and export permissions.                        |

## 6.3 Standard response and error envelope

> {  
> "data": { },  
> "meta": {  
> "requestId": "req\_...",  
> "correlationId": "corr\_...",  
> "nextCursor": null  
> }  
> }  
>   
> {  
> "error": {  
> "code": "ENVELOPE_STATE_CONFLICT",  
> "message": "This envelope can no longer be signed.",  
> "retryable": false,  
> "requestId": "req\_..."  
> }  
> }

Do not return stack traces, internal document paths, token contents, or
confidential recipient data in client-facing errors.

## 6.4 Event taxonomy

| **Event**                    | **When emitted**                                           | **Typical consumers**              |
|------------------------------|------------------------------------------------------------|------------------------------------|
| document.created             | Draft created                                              | Timeline, analytics                |
| document.version.published   | Template version published                                 | Template index, audit              |
| envelope.created             | Envelope draft created                                     | Timeline                           |
| envelope.sent                | Dispatch accepted/committed                                | Reminder scheduler, analytics, CRM |
| recipient.delivery_succeeded | Provider confirms delivery where available                 | Recipient state, analytics         |
| recipient.viewed             | Recipient first views authorized content                   | Funnel analytics                   |
| recipient.authenticated      | Required identity step succeeds                            | Evidence, execution gate           |
| recipient.signed             | Validated signing action committed                         | Routing engine, timeline           |
| recipient.declined           | Decline committed                                          | Routing, notification, analytics   |
| envelope.completed           | All required actions complete and final artifact persisted | Certificate, CRM, analytics        |
| envelope.voided / expired    | Terminal action committed                                  | Notification, analytics            |
| contract.obligation.created  | Obligation accepted/created                                | Tasks, reminders                   |
| contract.renewal.due         | Renewal rule reaches threshold                             | Tasks, notification                |

## 6.5 Event delivery guarantees

Assume at-least-once delivery for jobs and webhooks. Consumers must
deduplicate by eventId/idempotency key. Store outbox state such as
pending, processing, delivered, retryable_failure, and dead_letter. Use
exponential backoff with jitter, bounded retries, operator-visible
failure queues, and replay controls.

## 6.6 Webhooks

- Support workspace-configured endpoints, event subscriptions, signing
  secrets, delivery attempts, response codes, and replay.

- Sign webhook payloads using HMAC over timestamp + raw body; include
  event ID and timestamp to prevent replay.

- Provide a bounded retry schedule and manual replay with audit logging.

- Never include raw signing tokens, full signature images, OTPs, or
  unnecessary personal data in webhook payloads.

- Require endpoint verification and protect against SSRF/private-network
  targets; revalidate destination policy at delivery time.

# 7. UI/UX product requirements

## 7.1 Navigation and information architecture

| **Navigation item**    | **Primary views**                                | **Core actions**                                    |
|------------------------|--------------------------------------------------|-----------------------------------------------------|
| Overview               | Dashboard, needs attention, recent activity      | Create document, resume draft, review overdue       |
| All Documents          | Table/list, saved filters, bulk actions          | Search, filter, assign, archive, export             |
| Templates              | Template list, version history, editor           | Create, import, duplicate, preview, publish         |
| Signature Requests     | Envelope list, recipient progress, exceptions    | Compose, send, remind, void, resend where allowed   |
| Contracts              | Contract list, contract detail, linked documents | Review, amend, manage parties, close, renew         |
| Obligations & Renewals | Obligation board, calendar, renewal queue        | Assign owner, confirm AI extraction, create task    |
| Analytics              | Funnel, throughput, velocity, outcomes           | Filter by date, template, owner, segment; export    |
| Audit & Verification   | Evidence timeline, artifact validation           | Inspect events, generate certificate, verify digest |

## 7.2 Key screens and requirements

### Overview dashboard

- Show counts for drafts, pending approvals, awaiting signature,
  overdue, completed in period, and upcoming renewals.

- Provide an actionable attention queue with owner, next action, due
  date, and current blocker.

- Support workspace/date/owner/template filters and role-based data
  visibility.

- Use aggregate metrics and paginated recent activity; do not load all
  event history client-side.

- Every metric has a definition tooltip and links to the filtered
  underlying records.

### Template Studio

- Support PDF import, page navigation, zoom, page rotation awareness,
  field placement, resizing, alignment, duplication, grouping, and
  keyboard controls.

- Provide field types, required flag, validation, role assignment,
  variable binding, default value, conditional visibility, and
  accessible labels.

- Show unresolved variables and validation errors before publication.

- Provide draft preview and published-version history; published
  versions are immutable.

- Support branding, reusable clauses/content blocks, and AI suggestions
  with explicit accept/reject actions.

- Maintain stable field IDs across versions when semantic continuity is
  intended; create new IDs when field meaning changes.

### Envelope composer

- Select document instances and exact versions; show the rendered output
  before issue.

- Add recipients from CRM or as external recipients; specify role,
  contact channel, verification method, routing order, and required
  fields.

- Validate missing recipient details, unassigned required fields,
  invalid routing, unresolved variables, expiry policy, and approval
  requirements.

- Offer test/send-to-self mode that cannot be confused with production
  execution.

- Require a confirmation summary with recipients, document
  names/version, expiry, notification message, and expected next steps.

### Recipient signing portal

- Use recipient-bound, expiring session capability; verify envelope and
  recipient status on every server action.

- Provide guided next-field navigation, progress indicator, accessible
  field labels, save/resume, and clear required-field validation.

- Offer PDF view and mobile-friendly form view where semantic mapping
  supports it; let users preview the original document.

- Present consent wording before the affirmative signing action and
  record the wording/policy version.

- Allow decline or request-changes where enabled, with a reason and
  clear consequence.

- Prevent signing after completion, void, expiry, revocation, or failed
  required authentication.

- Do not store a reusable signature profile by default. If later
  introduced, make it opt-in, securely protected, and subject to
  explicit user control.

### Contract workspace

- Show parties, owner, status, value/currency, effective/expiry/renewal
  dates, linked deals and documents, obligations, amendments, and event
  timeline.

- Separate legal status from operational reminders and finance payment
  status.

- Allow authorized users to create amendment/renewal relationships
  without modifying the original executed artifact.

- Show AI-extracted obligations with source page/paragraph, confidence,
  reviewer, and approval status.

### AI review workspace

- Show source document/version, extracted text, page references,
  model/prompt version, run time, and review state.

- Display clause comparison as side-by-side or inline changes; never
  silently overwrite source text.

- Mark generated content as a suggestion and require explicit user
  acceptance to apply it.

- Allow users to report incorrect extraction, correct values, and feed
  evaluation datasets under approved governance.

- Block retrieval of documents the actor cannot read, even if the user
  asks a broad natural-language question.

### Analytics

- Support date cohorts, workspace, owner, template, document type,
  channel, and CRM segment filters where data is available.

- Define denominators and exclusions for each rate; distinguish delivery
  attempts from successful delivery.

- Show medians/percentiles for completion time and outstanding workflow
  age.

- Distinguish campaign association from causal attribution.

- Use role-based exports and redact or omit sensitive recipient evidence
  from general reports.

## 7.3 Responsive behavior and accessibility

| **Viewport**       | **Requirements**                                                                                                                                                                                              |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Desktop ≥ 1024 px  | Multi-panel editor; side inspector; keyboard shortcuts; resizable preview; dense tables with saved filters.                                                                                                   |
| Tablet 640–1023 px | Collapsible inspector; touch-friendly controls; preserve canvas and field editing; avoid hover-only interactions.                                                                                             |
| Mobile \< 640 px   | Guided signing first; readable form mode; sticky action dock; large touch targets; simple document preview; no requirement to manipulate tiny PDF overlays to complete signing.                               |
| All sizes          | Semantic headings, keyboard focus order, visible focus, screen-reader labels, contrast, error summary, reduced motion, accessible consent and signature alternatives where legally/operationally appropriate. |

## 7.4 Loading, error, and empty states

- Empty template library: explain how to create/import a template and
  show permission-appropriate examples.

- Rendering failure: retain draft data, show retry, capture a
  correlation ID, and do not issue a partial artifact.

- Delivery failure: preserve envelope state, expose retry/resend
  controls under policy, and avoid duplicate envelope creation.

- Expired/voided link: explain that the link is no longer active and
  provide a safe route to request a new link without disclosing
  sensitive contract details.

- Partial bulk-send failure: report per-recipient result and allow retry
  only for failed dispatches.

- AI failure or timeout: preserve the user's work, show fallback/manual
  path, and do not present partial analysis as complete.

- Permission denied: disclose no sensitive record metadata; provide a
  safe return path.

# 8. Security, privacy, and compliance requirements

## 8.1 Authorization model

| **Permission**                                     | **Examples**                                                             |
|----------------------------------------------------|--------------------------------------------------------------------------|
| documents.read / create / edit / publish / archive | Template and document operations separated by action.                    |
| envelopes.create / send / void / manage            | Issuance and cancellation permissions separated.                         |
| contracts.read / manage / approve                  | Commercial record access and four-eyes approval policy.                  |
| evidence.read / export / verify                    | Restrict detailed evidence and bulk exports.                             |
| analytics.read / export                            | Aggregate analytics permissions separated from PII/evidence access.      |
| ai.use / ai.apply / ai.configure                   | Separate running analysis from applying changes and configuring prompts. |
| admin.retention / admin.security                   | Highly restricted governance controls.                                   |

Resolve permissions server-side using authenticated actor, active
workspace, record ownership, role grants, and relevant relationship
rules. Public signing sessions are a constrained capability, not a
general CRM identity.

## 8.2 Signing token controls

- Generate cryptographically random high-entropy tokens; store only a
  hash or keyed digest server-side.

- Bind token to envelope, recipient, permitted operations, issued-at,
  expiry, and revocation state.

- Never place PII or mutable authorization claims in a readable URL
  payload.

- Use short-lived session exchange after link validation; apply
  one-time/replay semantics to final signing actions, not necessarily to
  every page view.

- Redact tokens from application logs, analytics, referrer leakage, and
  error reporting; set an appropriate Referrer-Policy.

- Rate-limit token validation, OTP sending, OTP attempts, and public
  endpoints; avoid account/recipient enumeration.

## 8.3 Evidence and cryptographic integrity

- Compute SHA-256 on exact source and final artifact bytes; record
  algorithm, digest, byte length, artifact ID, and timestamp.

- Use immutable artifact paths or versioned object storage; restrict
  overwrite/delete permissions.

- Record consent text/policy version, affirmative action,
  signer/recipient reference, server timestamp, authentication method,
  and event correlation.

- Record request metadata only as needed. Trust forwarded IP headers
  only from configured reverse proxies; avoid collecting precise
  geolocation unless justified and disclosed.

- Hash-chain events only if verification and key-management design is
  specified; a hash chain alone does not prevent a privileged actor from
  rewriting the whole chain.

- Use managed key storage and key rotation for HMAC/webhook secrets and
  cryptographic signing keys.

- Keep a separate validation endpoint that returns minimal authenticity
  information and does not expose document content or signer PII
  publicly.

- Define retention, legal hold, export, deletion, and access policy with
  legal/privacy review.

## 8.4 Privacy and data minimization

- Keep signature images and identity-verification payloads out of
  ordinary logs and analytics.

- Define retention and deletion by artifact/evidence category; do not
  apply generic TTL to executed agreements.

- Use signed URLs with short expiry and authorization checks; avoid
  public object ACLs for confidential documents.

- Encrypt data in transit and at rest; scope service accounts and
  storage access to least privilege.

- Provide data-subject request and retention workflows consistent with
  applicable law and contractual obligations.

- Record access to sensitive evidence and exports.

## 8.5 AI threat model

- Treat uploaded document content as untrusted data, never as system
  instructions.

- Separate system instructions, user instructions, retrieved text, and
  tool permissions.

- Use permission-filtered retrieval before context assembly; do not
  retrieve broadly and rely on the model to redact.

- Require schema validation for extracted entities and obligations;
  preserve source passages and uncertainty.

- Use human approval for contract changes, legal interpretations used
  operationally, obligation creation, external messages, and workflow
  transitions with material effect.

- Prevent AI tools from directly reading arbitrary storage paths,
  executing code, changing permissions, or sending documents without an
  authorized action.

- Evaluate prompt injection, cross-tenant retrieval, data exfiltration,
  hallucinated clauses, and malicious PDF content.

## 8.6 Legal assurance profile

Define configurable signing assurance profiles by jurisdiction,
transaction type, document risk, and customer policy. A profile may
specify consent wording, authentication method, evidence fields,
retention, witnesses, certificate format, or cryptographic PDF signature
requirements. Do not claim ESIGN/UETA/eIDAS or Ghanaian-law compliance
without a jurisdiction-specific legal assessment. A certificate page and
an electronic signature image are not equivalent to a certificate-backed
PAdES signature.

# 9. AI requirements and evaluation

## 9.1 Capability roadmap

| **Capability**          | **Inputs / output**                                                     | **Control**                                                                        |
|-------------------------|-------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| OCR and field detection | PDF/text/image → suggested field map with page coordinates              | User confirms placement; confidence and source region shown.                       |
| Metadata extraction     | Document → parties, dates, values, governing law, document type         | Schema validation; source spans; review status.                                    |
| Summarization and Q&A   | Authorized document version → cited answer/summary                      | Permission-aware retrieval; citations to pages/sections; abstain when unsupported. |
| Clause drafting         | Prompt + approved clause library + permitted CRM facts → suggested text | Draft-only; explicit apply action; version diff.                                   |
| Version comparison      | Two immutable versions → added/removed/changed clauses                  | Trace each change to exact versions and source locations.                          |
| Obligation extraction   | Executed contract → candidate obligations and dates                     | Human approval before task/calendar creation; source and confidence.               |
| Execution insights      | Lifecycle events → bottleneck summary and follow-up suggestion          | Explain metric evidence; user confirms external actions.                           |

## 9.2 AI data contract

> interface DocumentAIAnalysis {  
> id: string;  
> workspaceId: string;  
> documentId: string;  
> documentVersionId: string;  
> taskType: 'classify' \| 'extract' \| 'summarize' \| 'qa' \|  
> 'compare' \| 'draft' \| 'obligations';  
> status: 'queued' \| 'running' \| 'succeeded' \| 'failed' \|
> 'review_required';  
> modelProvider: string;  
> modelName: string;  
> promptVersionId: string;  
> inputDigest: string;  
> outputStoragePath?: string;  
> sourceReferences: Array\<{  
> page?: number; startOffset?: number; endOffset?: number;  
> excerptDigest?: string;  
> }\>;  
> confidence?: number;  
> reviewedBy?: string;  
> reviewedAt?: string;  
> createdAt: string;  
> }

## 9.3 Evaluation and launch gates

- Create a representative, permission-cleared evaluation set covering
  SmartSapp's actual document types and languages.

- Measure extraction precision/recall for each field type and
  date/amount normalization accuracy.

- Measure citation correctness and answer support for document Q&A;
  unsupported answers must abstain or request clarification.

- Evaluate clause comparison completeness against manually reviewed
  pairs.

- Test prompt injection and cross-tenant leakage with adversarial
  documents.

- Track human correction rate, acceptance rate, latency, failure rate,
  and cost per task.

- Set launch thresholds per task with product/legal/security owners; do
  not invent a single global accuracy threshold for all AI tasks.

# 10. Reliability, performance, and operations

## 10.1 Reliability patterns

- Use a durable job queue for rendering, certificate generation,
  reminders, bulk dispatch, analytics aggregation, and AI tasks.

- Use explicit job state, attempts, nextAttemptAt, lease/lock expiry,
  lastErrorCode, and dead-letter status.

- Use idempotency keys for user commands and provider-specific
  idempotency where available.

- Store the authoritative final artifact before transitioning the
  envelope to completed.

- Treat email/SMS/WhatsApp providers as external systems that may fail
  independently of the database transaction.

- Use bounded retries, exponential backoff with jitter, circuit breakers
  where appropriate, and operator replay tools.

- Use Cloud Tasks or existing SmartSapp scheduling infrastructure if it
  is already the established pattern; avoid introducing overlapping
  schedulers without an inventory.

## 10.2 Observability

| **Signal** | **Examples**                                                                                                                    |
|------------|---------------------------------------------------------------------------------------------------------------------------------|
| Metrics    | Send success, finalization latency, render failures, job retries, queue age, duplicate-command rate, OTP failures, AI cost.     |
| Logs       | Structured logs with requestId, correlationId, workspaceId where safe, envelopeId, jobId, error code; never log secrets.        |
| Traces     | Dispatch → provider → recipient event → finalization → artifact → notification.                                                 |
| Alerts     | Finalization error spike, oldest queue age, storage failures, dead-letter growth, cross-tenant authorization denial anomalies.  |
| Runbooks   | Stuck envelope, failed render, provider outage, token compromise, artifact mismatch, migration mismatch, AI retrieval incident. |

## 10.3 Performance targets to validate

The following are initial engineering targets to validate with
production baselines and load tests, not current measured performance or
contractual SLAs.

| **Operation**                        | **Provisional target**                                                                                |
|--------------------------------------|-------------------------------------------------------------------------------------------------------|
| Document list/detail API             | p95 ≤ 500 ms for normal paginated queries, excluding external providers.                              |
| Signing session validation           | p95 ≤ 500 ms under expected load, excluding OTP provider latency.                                     |
| Finalization command acknowledgement | p95 ≤ 1 s to persist accepted command/state; artifact generation may complete asynchronously.         |
| Standard PDF generation              | p95 ≤ 10 s for agreed test corpus and size envelope; larger jobs asynchronous.                        |
| Background queue                     | 95% of normal jobs begin within 60 s; alert on sustained queue age.                                   |
| Analytics dashboard                  | p95 ≤ 2 s for pre-aggregated common views.                                                            |
| Availability                         | Set an SLO after baseline and operational capability review; do not claim a value before measurement. |

Set explicit limits for file size, page count, image dimensions,
concurrent render jobs, bulk recipient count, and AI input size. Enforce
them server-side and return actionable validation errors.

# 11. Phased PRD and engineering work packages

## Phase 0 — Discovery and baseline

Objective: verify the real implementation and establish safe migration
conditions.

| **Work package**             | **Deliverables**                                             | **Acceptance criteria**                                                                      |
|------------------------------|--------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| P0.1 Code-path inventory     | Routes, actions, components, services, schedulers, providers | Every critical workflow has an owner, entry point, downstream dependencies, and error paths. |
| P0.2 Data/security inventory | Schemas, rules, storage paths, indexes, tenant checks        | Authorization matrix and data inventory reviewed by engineering/security.                    |
| P0.3 Baseline tests          | Golden-path and failure-path tests                           | Existing workflows pass in CI and test environment; known gaps are documented.               |
| P0.4 Operational baseline    | Metrics, logs, data counts, restore plan                     | Backups/restore and rollback rehearsal documented.                                           |

## Phase 1 — Integrity and execution reliability

Objective: make the current single-recipient flow safe and deterministic
before adding complex routing.

| **Work package**                  | **Requirements**                                                                                               | **Acceptance criteria**                                                                                                                      |
|-----------------------------------|----------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| P1.1 Unified PDF artifact service | One server-side renderer for completed downloads; exact page geometry; fonts; wrapping; links where supported. | All download paths return the authoritative artifact; golden-file tests pass for A4, Letter, Legal, rotated pages, long text and signatures. |
| P1.2 Finalization command         | Idempotency key; state validation; final artifact persistence; durable outbox.                                 | Repeated/concurrent finalize requests produce one completed execution, one canonical artifact and one logical notification.                  |
| P1.3 Evidence record              | Document digests, consent/policy version, actor/recipient, timestamps, allowed request metadata, event IDs.    | Verifier detects changed bytes; evidence event sequence is queryable; no raw token/OTP appears in logs.                                      |
| P1.4 Access hardening             | Recipient-bound token/session, expiry, revocation, server-side workspace/resource checks.                      | Cross-tenant, modified-ID, expired-token, replay, and unauthorized-download tests are denied.                                                |
| P1.5 Certificate/verification     | Completion certificate and minimal public verification result.                                                 | Certificate references the correct envelope and artifact digest; public endpoint leaks no confidential content.                              |

## Phase 2 — Signing workflow maturity

| **Work package**     | **Requirements**                                                                         | **Acceptance criteria**                                                                                              |
|----------------------|------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| P2.1 Recipient model | Multiple recipients, roles, routing order, field assignments.                            | Fields are editable only by authorized active recipient; later sequential recipient is blocked until eligible.       |
| P2.2 Routing engine  | Sequential, parallel and policy-defined routing; countersignature and internal approval. | All transition paths tested; terminal envelope cannot accept new signatures.                                         |
| P2.3 Exceptions      | Decline, void, expiry, delivery failure, reassignment policy.                            | Each action records actor, reason where required, timestamp and notifications; retry does not duplicate transitions. |
| P2.4 Recipient UX    | Guided next field, progress, accessible controls, mobile form mode.                      | Required fields are discoverable; keyboard/screen-reader tests pass; mobile completion tested on supported devices.  |
| P2.5 Reminders       | Configurable cadence, expiry, quiet hours/time zone, cancellation on completion.         | No reminder after terminal state; jobs are idempotent and tenant-configured.                                         |

## Phase 3 — Document and contract platform

| **Work package**        | **Requirements**                                                                     | **Acceptance criteria**                                                                              |
|-------------------------|--------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| P3.1 Domain model       | Templates, immutable versions, instances, artifacts, envelopes, contracts, evidence. | Existing records map without loss of IDs/relationships; version edits do not alter issued documents. |
| P3.2 Template Studio    | Variable schema, content blocks, clause library, validation, branding, version diff. | Cannot publish with unresolved required variables or invalid fields; published version is immutable. |
| P3.3 Contract workspace | Parties, value, dates, links, obligations, amendments and renewals.                  | Original executed contract remains accessible and immutable after amendment/renewal.                 |
| P3.4 Migration adapter  | Legacy reads/writes during staged transition; reconciliation ledger.                 | Shadow read mismatches are below approved threshold; rollback is rehearsed.                          |
| P3.5 Document types     | PDF-based and native document templates as prioritized.                              | Document type is explicit; signing and artifact contracts are consistent across supported types.     |

## Phase 4 — CRM integration, automation and analytics

| **Work package**          | **Requirements**                                                        | **Acceptance criteria**                                                                                |
|---------------------------|-------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| P4.1 CRM links            | Contacts/entities/deals/meetings/tasks/campaigns/finance/subscriptions. | Links resolve only within authorized scope; deletion/archive behavior is defined.                      |
| P4.2 Activity timeline    | Canonical lifecycle events in CRM timeline.                             | Events are deduplicated and contain safe contextual links.                                             |
| P4.3 Analytics events     | Versioned event taxonomy and daily aggregates.                          | Metric definitions match test fixtures; cohort filters and denominators are documented.                |
| P4.4 Automation           | Triggers, reminders, tasks, webhook subscriptions and retries.          | Failed jobs are visible/replayable; duplicate delivery is safe; secrets are protected.                 |
| P4.5 Commercial reporting | Deal-to-contract and renewal views.                                     | Attribution method and exclusions are explicit; no causal claim is inferred from a relationship alone. |

## Phase 5 — AI document intelligence

| **Work package**                | **Requirements**                                                 | **Acceptance criteria**                                                                                     |
|---------------------------------|------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| P5.1 Extraction/field detection | OCR/text extraction and suggested field map.                     | Evaluation threshold met on representative corpus; user can review/edit suggestions.                        |
| P5.2 Drafting and clauses       | Prompted drafts using approved clauses and authorized CRM facts. | AI cannot silently overwrite issued content; every applied change has an actor and version diff.            |
| P5.3 Q&A and summaries          | Permission-aware retrieval with source citations.                | Citations resolve to the correct version/page; cross-tenant and unsupported-answer tests pass.              |
| P5.4 Comparison and obligations | Version comparison; candidate obligations and renewal dates.     | Source references and review state required before operational tasks are created.                           |
| P5.5 AI governance              | Prompt/model version, cost, evaluations, feedback and audit.     | Analysis is reproducible to the extent supported by provider/versioning; failures and costs are observable. |

## Phase 6 — Enterprise readiness

| **Work package**               | **Requirements**                                                   | **Acceptance criteria**                                                                                     |
|--------------------------------|--------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| P6.1 Assurance profiles        | Jurisdiction/document-type policies and stronger identity options. | Legal/security owner approves profiles and customer-facing claims.                                          |
| P6.2 Cryptographic signing     | Certificate-backed PDF signature where required; key lifecycle.    | Independent validation succeeds for supported profiles; expired/revoked certificate behavior is documented. |
| P6.3 Resilience                | Recovery, backups, incident runbooks, load testing.                | Restore objectives and recovery procedures tested against agreed targets.                                   |
| P6.4 Governance                | Retention, legal hold, evidence export, admin audit.               | Retention jobs are tested; protected evidence access and exports are audited.                               |
| P6.5 Accessibility and release | Accessibility audit, security review, rollout playbook.            | No unresolved release-blocking findings; staged rollout and rollback approved.                              |

# 12. Test strategy

## 12.1 Test layers

| **Layer**       | **Coverage**                                                                                                                                     |
|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| Unit            | State transitions, variable resolution, coordinate transforms, token validation, digest calculation, metric calculations, idempotency decisions. |
| Integration     | Firestore transactions, Storage artifacts, messaging provider adapters, Cloud Tasks/scheduler, outbox delivery, AI gateway, CRM links.           |
| Contract/API    | Runtime schema validation, authorization, error envelopes, pagination, webhook signatures, API version compatibility.                            |
| End-to-end      | Create template → publish → generate document → approve → send → authenticate → sign all parties → generate artifact → verify → CRM timeline.    |
| Security        | Cross-tenant access, IDOR, token replay, brute force, OTP abuse, SSRF, XSS, malicious PDF, prompt injection, data leakage, export permissions.   |
| PDF regression  | Golden fixtures for page sizes, rotations, fonts, long/multiline text, images, signature placement, links, form fields and mixed pages.          |
| Migration       | Dry-run, idempotent rerun, partial failure/resume, count reconciliation, relationship validation, artifact checksum, rollback.                   |
| Load/resilience | Bulk send, concurrent signing, render queue saturation, provider outage, retry storms, Firestore contention, AI rate limits.                     |
| Accessibility   | Keyboard-only, screen reader, contrast, zoom/reflow, focus management, mobile touch and error announcements.                                     |
| AI evaluation   | Extraction metrics, citation support, comparison completeness, hallucination/abstention, prompt injection, tenant isolation, cost and latency.   |

## 12.2 Critical end-to-end scenarios

- Legacy single-signer contract completes through the existing route and
  produces the expected final artifact.

- Two signers sign sequentially; signer two cannot act early; completion
  occurs only after required actions.

- Parallel signers can act independently; envelope completes after all
  required recipients sign.

- User edits a template after dispatch; issued document remains
  byte/content-stable.

- Recipient opens expired, revoked, voided, already completed, or
  wrong-recipient link.

- Two simultaneous sign requests target the same recipient; exactly one
  logical signature is committed.

- PDF generation fails after the signature event is accepted; job
  retries and eventually completes without duplicate signature.

- Notification provider fails after completion; envelope remains
  completed and notification retries independently.

- Bulk dispatch partially fails; successful recipients are not resent
  unintentionally.

- AI document contains instructions to exfiltrate another tenant's data;
  no unauthorized retrieval or tool execution occurs.

- AI extracts a renewal date incorrectly; reviewer correction is
  recorded and no task is created before approval.

- Migration is interrupted mid-batch and safely resumes without
  duplicate target records.

## 12.3 Release-blocking defects

- Any cross-tenant or unauthorized document/evidence access.

- Any possibility of signing after a terminal envelope state or of
  altering issued content without a new version.

- Duplicate or inconsistent finalization under retry/concurrency.

- Completed envelope without a retrievable final artifact or configured
  evidence record.

- Migration loses a completed document, submission relationship, or
  essential historical metadata without an approved exception.

- AI retrieves unauthorized content or executes a consequential action
  without required authorization.

- Critical accessibility, data-loss, or artifact-integrity failure.

# 13. Analytics definitions and event governance

| **Metric**                  | **Definition**                                                                              | **Required caveat**                                               |
|-----------------------------|---------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| Dispatch success rate       | Envelopes with at least one successful dispatch / envelopes with dispatch attempt in cohort | Provider acceptance/delivery receipt semantics must be defined.   |
| Completion rate             | Completed envelopes / eligible envelopes sent in cohort                                     | Specify observation window and treatment of still-open envelopes. |
| Recipient completion rate   | Signed required recipients / all required recipients in cohort                              | Do not count optional CC/viewers as required signers.             |
| Time to first view          | First authorized view timestamp − successful dispatch timestamp                             | Report median and percentiles; exclude invalid/test events.       |
| Time to completion          | Envelope completedAt − first successful dispatch time                                       | Report completed cohort and outstanding age separately.           |
| Decline rate                | Declined envelopes / eligible sent envelopes                                                | Separate decline from void, expiry and sender cancellation.       |
| Expiry rate                 | Expired envelopes / eligible sent envelopes                                                 | Define whether cohort is based on send date or expiry date.       |
| Deal-to-contract conversion | Eligible deals linked to executed contracts / eligible deals in a defined cohort            | Association is not proof of campaign causality.                   |
| Renewal rate                | Renewed agreements / agreements eligible for renewal in period                              | Define eligibility, renewal window and extensions.                |

Every event schema and metric definition should be versioned. Store
event time and ingestion time separately, support deduplication, and
document late-arriving events and backfill behavior.

# 14. Permissions matrix (initial proposal)

| **Action**                | **Workspace owner/admin** | **Document author** | **Contract manager** | **Approver**               | **Recipient/public session**         |
|---------------------------|---------------------------|---------------------|----------------------|----------------------------|--------------------------------------|
| Create/edit draft         | Yes                       | If granted          | If granted           | No by default              | No                                   |
| Publish template          | Policy-based              | If granted          | No by default        | Optional approval          | No                                   |
| Create envelope           | Yes                       | If granted          | If granted           | No by default              | No                                   |
| Approve dispatch          | Policy-based              | Only if permitted   | Only if permitted    | Yes                        | No                                   |
| Send/void envelope        | Policy-based              | If granted          | If granted           | Policy-based               | No                                   |
| Sign assigned fields      | No special bypass         | No special bypass   | No special bypass    | Only if assigned recipient | Only assigned recipient after checks |
| Read full evidence        | Restricted                | Policy-based        | Policy-based         | Policy-based               | Own signing session only             |
| Export analytics          | If granted                | If granted          | If granted           | If granted                 | No                                   |
| Apply AI suggestion       | If granted                | If granted          | If granted           | Policy-based               | No                                   |
| Change retention/security | Highly restricted         | No                  | No                   | No                         | No                                   |

This matrix is a starting point. Map it to SmartSapp's actual RBAC roles
and four-eyes approval conventions. Do not create parallel role systems
without integrating them with existing authorization services.

# 15. Operational and implementation conventions

- Use the repository's established package manager and code conventions;
  do not introduce a second dependency-management workflow.

- Keep server-only services, signing secrets, cryptographic keys, and
  privileged Firebase Admin access out of client bundles.

- Validate inputs at every API/server-action boundary and validate
  persisted data when reading legacy records.

- Use feature flags for new editor, envelope, signing, analytics, and AI
  paths; include workspace-level kill switches.

- Prefer small, reversible migrations and isolated pull requests aligned
  to the phases.

- Require code review from domain owners for schema/state-machine
  changes and security review for authorization/evidence changes.

- Maintain architecture decision records for token design, evidence
  immutability, storage layout, state ownership, and AI data access.

- Add dashboards and runbooks before enabling bulk dispatch, scheduled
  reminders, or high-volume AI processing.

# 16. Open decisions before implementation

| **Decision**                  | **Options / guidance**                                                                                        | **Owner(s)**                  |
|-------------------------------|---------------------------------------------------------------------------------------------------------------|-------------------------------|
| Tenant storage layout         | Workspace-scoped paths vs established top-level collection pattern; follow existing secure convention.        | Architecture + Firebase owner |
| Envelope/document cardinality | One document per envelope vs multiple related documents; choose based on actual workflows and artifact rules. | Product + engineering         |
| Native editor vs PDF-first    | Keep PDF-first initially; add native document composition in a staged scope.                                  | Product + design              |
| Signature assurance profiles  | Basic electronic signing vs OTP/stronger identity vs cryptographic PDF signature by risk/jurisdiction.        | Legal + security + product    |
| Evidence immutability         | Restricted append-only application model, versioned object storage, optional retention-locked storage.        | Security + operations         |
| AI provider and evaluation    | Use existing gateway where suitable; choose models per task based on evaluation/cost/privacy.                 | AI platform + product         |
| Analytics backend             | Firestore aggregates initially vs external analytical store when volume/query needs justify it.               | Data/architecture             |
| Retention and legal hold      | Per document/evidence category and applicable obligations.                                                    | Legal/privacy + operations    |
| Rollout cohorts               | Internal, pilot workspace, percentage rollout, then general availability.                                     | Product + customer success    |

# 17. Definition of done and go/no-go checklist

- Current-state audit artifacts approved; unverified assumptions are
  resolved or tracked as explicit risks.

- All existing critical flows have regression coverage and a documented
  rollback route.

- New schemas, state machines, and API contracts are reviewed and
  runtime-validated.

- Tenant isolation and recipient authorization tests pass, including
  negative cases.

- Document artifacts are immutable after issue and finalization is
  idempotent.

- Evidence record, artifact digest, completion certificate, and
  verification behavior are validated.

- Migration dry-run and restore/rollback rehearsal pass; counts and
  relationships reconcile.

- Multi-party routing, decline, void, expiry, and provider-failure paths
  pass end-to-end tests.

- Analytics definitions and event deduplication are validated against
  fixtures.

- AI quality, citation, permission, injection, human-review, and cost
  gates pass for each enabled capability.

- Accessibility, performance, security, privacy, and applicable legal
  reviews are signed off.

- Monitoring, alerting, runbooks, support procedures, and feature-flag
  rollback are ready.

# 18. Recommended implementation sequence

Start with Phase 0. Do not begin by replacing the PDF editor or adding
AI drafting. The highest-value first move is to establish the actual
behavior and data/security boundaries, then harden finalization and
artifact integrity. In parallel, design the new domain model and
compatibility adapter so later multi-party signing and contract
lifecycle capabilities do not have to be retrofitted into a
submission-centric schema.

1.  Audit and baseline: map all callers, data, authorization, storage,
    background jobs, and tests.

2.  Stabilize the existing path: idempotent finalization, authoritative
    artifact generation, secure recipient sessions, and evidence.

3.  Introduce recipient/envelope state machines and multi-party routing.

4.  Add immutable template versions and document/contract domain
    boundaries through a compatibility layer.

5.  Integrate CRM events, obligations, analytics, and automations.

6.  Add AI capabilities one by one, each behind evaluation and
    human-approval gates.

7.  Complete enterprise assurance, operational resilience, and
    jurisdiction-specific review.

# Appendix A — Suggested repository work areas

| **Area**          | **Likely files / modules from supplied extraction**                           | **Target action**                                                                       |
|-------------------|-------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| Types             | src/lib/types.ts                                                              | Introduce versioned domain types and runtime schemas; avoid unsafe broad type rewrites. |
| Template editor   | src/app/admin/pdfs/\[id\]/edit and Editor/Sidebar/Inspector.tsx               | Add version-aware editing and role assignment behind flags.                             |
| Signing renderer  | src/app/forms/\[pdfId\]/components/PdfFormRenderer.tsx                        | Add recipient-bound session, role filtering, guided signing.                            |
| Signature capture | src/components/SignaturePadModal.tsx; src/lib/signature-processing.ts         | Retain capture modes; strengthen validation and secure storage.                         |
| Execution         | src/lib/pdf-actions.ts; src/app/api/pdfs/submit/route.ts                      | Centralize idempotent command and artifact lifecycle.                                   |
| Contract dispatch | src/lib/contract-actions.ts; ContractsClient.tsx; ContractWizard.tsx          | Add envelope and recipient orchestration through adapter.                               |
| Results/download  | SharedSubmissionView.tsx; PDF generate routes                                 | Remove divergent screenshot download as authoritative output.                           |
| AI and automation | Existing AI gateway, prompt management, task/scheduler and messaging services | Reuse after source verification; add document-specific flows and controls.              |

# Appendix B — Glossary

| **Term**               | **Definition**                                                                                                   |
|------------------------|------------------------------------------------------------------------------------------------------------------|
| Template               | Reusable design and rules used to create documents.                                                              |
| Template version       | Immutable published snapshot of a template.                                                                      |
| Document instance      | A particular generated document with frozen content and CRM values.                                              |
| Artifact               | A file produced or retained by the platform, such as source, preview, issued PDF, completed PDF, or certificate. |
| Envelope               | A signing transaction coordinating one or more documents and recipients.                                         |
| Recipient              | A person assigned to view, approve, sign, witness, or receive a document.                                        |
| Contract               | The business agreement record and its commercial/legal lifecycle.                                                |
| Evidence record        | Structured record supporting the history and integrity of execution.                                             |
| Completion certificate | Human-readable summary of the execution evidence; not itself a guarantee of enforceability.                      |
| Outbox                 | Durable record of events/side effects to be delivered after the authoritative state change.                      |
| Idempotency            | A guarantee that repeating the same logical command does not create duplicate effects.                           |
| RAG                    | Retrieval-augmented generation; retrieving authorized source material to ground AI output.                       |

# Appendix C — Source baseline and limitations

Primary baseline: user-provided coding-agent extraction titled
“Comprehensive Analysis & Improvement Blueprint: Document Signing
Feature,” supplied in the conversation as a Markdown attachment. It
reports code paths and behaviors for PDFForm/PDFFormField, Contract,
Submission, PDF Studio, contract dispatch, public signing, signature
capture, PDF generation, result viewing, and submission analytics.

No repository checkout, runtime test, security-rule inspection,
production telemetry, or legal review was performed as part of creating
this design document. Treat all statements about current behavior as
reported findings until verified. The schemas, routes, targets, phase
gates, and architecture in this document are proposed requirements.

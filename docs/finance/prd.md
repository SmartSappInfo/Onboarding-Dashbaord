# SmartSapp Finance 2.0

## Target Architecture & Product Requirements Document

**Product:** SmartSapp CRM
**Module:** Finance 2.0
**Document Type:** Product Requirements + Technical Architecture
**Status:** Target Architecture / Engineering Blueprint
**Primary Stack:** Next.js + TypeScript + Firebase/Cloud Firestore
**Audience:** Product, Engineering, Architecture, QA, Security, AI Coding Agents

---

# 1. Executive Summary

SmartSapp Finance 2.0 will evolve the existing Finance & Billing Hub from a primarily invoice and billing-cycle system into a **full financial operations and accounts-receivable platform embedded directly into SmartSapp CRM**.

The current implementation already provides a strong foundation:

* Invoice Registry
* Invoice Studio
* Billing Periods
* Subscription Packages
* Billing Profiles
* Tax/levy calculations
* Public invoice portal
* Entity selection
* Contracts
* Workspace permissions
* Multi-workspace financial configuration

The existing specification explicitly identifies invoices, billing periods, billing profiles, subscription packages and contracts as core workspace-scoped financial objects.

Finance 2.0 will extend this foundation with:

* Financial Accounts
* Accounts Receivable
* Financial Ledger
* Payments
* Payment Allocation
* Payment Reconciliation
* Credit Notes
* Debit Notes
* Refunds
* Statements
* Payment Plans
* Promises to Pay
* Collection Cases
* Debt Collection Workflows
* Recurring Billing
* Financial Automation
* Financial Events
* Financial Analytics
* Strong auditability
* Provider-independent payment infrastructure

The central architectural principle is:

> **An invoice is a financial document, not the financial system.**

The financial system is built around the relationship:

```text
CRM Entity
    ↓
Financial Account
    ↓
Charges / Billing Agreements
    ↓
Invoices
    ↓
Receivables
    ↓
Payments
    ↓
Allocations
    ↓
Ledger
    ↓
Collections
    ↓
CRM Automation
```

---

# 2. Product Vision

SmartSapp Finance should allow a school, institution, business or other SmartSapp customer to manage its complete customer-to-cash lifecycle without leaving the CRM.

The system should answer:

### Billing

> What should this customer be billed?

### Invoicing

> What has been formally invoiced?

### Receivables

> What does this customer currently owe?

### Cash

> What has actually been received?

### Reconciliation

> Which payments correspond to which financial obligations?

### Collections

> Which customers require follow-up, and what should we do next?

### CRM

> What is happening with this customer financially, and how should the sales/customer-success team respond?

---

# 3. Product Goals

## 3.1 Primary goals

Finance 2.0 must:

1. Create and manage professional invoices.
2. Maintain accurate customer financial accounts.
3. Track outstanding receivables.
4. Record and reconcile payments.
5. Support partial and multiple payments.
6. Support automated online payment providers.
7. Maintain an auditable financial ledger.
8. Track overdue debt.
9. Manage debt collection.
10. Manage promises to pay.
11. Manage payment plans.
12. Generate customer statements.
13. Support credit notes, debit notes and refunds.
14. Integrate financial activity into SmartSapp CRM.
15. Expose financial events to SmartSapp Automations.
16. Provide management-level financial analytics.
17. Maintain strict tenant and permission isolation.
18. Scale without requiring a fundamental redesign.

---

# 4. Non-Goals

Finance 2.0 is **not initially intended to become a complete general ledger accounting package**.

The first major release should not attempt to replace:

* full double-entry accounting software
* payroll
* procurement
* inventory accounting
* fixed-asset accounting
* statutory accounting packages
* complete tax filing systems

However, the architecture should leave room for future accounting integrations and exports.

---

# 5. Current-State Foundation

The existing Finance & Billing Hub already provides:

```text
/admin/finance/invoices
/admin/finance/periods
/admin/finance/packages
/admin/finance/settings
/admin/finance/contracts
/invoice/[id]
```

along with:

```text
UnifiedEntitySelector
billing-actions
contract-actions
```

The Invoice Studio already supports line items, profile-bound taxes, discounts, arrears, credits, locking after sending and public invoice generation.

The existing public invoice portal provides invoice details, payment instructions, signatures and PDF/print functionality.

Finance 2.0 should **extend this foundation rather than replace it wholesale**.

---

# 6. Target Product Architecture

```text
                         SMARTSAPP
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
      CRM              AUTOMATION           MESSAGING
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                     FINANCE EVENT BUS
                            │
              ┌─────────────┴─────────────┐
              │                           │
      FINANCIAL DOMAIN              COLLECTION DOMAIN
              │                           │
     ┌────────┼────────┐          ┌───────┼────────┐
     │        │        │          │       │        │
 Accounts  Billing  Invoices   Cases   Promises  Plans
     │        │        │          │       │        │
     └────────┼────────┘          └───────┼────────┘
              │                           │
              └─────────────┬─────────────┘
                            │
                         LEDGER
                            │
                     PAYMENT ENGINE
                            │
              ┌─────────────┼─────────────┐
              │             │             │
          Paystack      Flutterwave    MTN MoMo
              │             │             │
              └─────────────┼─────────────┘
                            │
                      RECONCILIATION
                            │
                       ANALYTICS
```

---

# 7. Core Domain Model

The target domain consists of the following primary entities.

```text
Entity
FinancialAccount
BillingAgreement
Product
Price
BillingPeriod
Charge
Invoice
InvoiceLine
Payment
PaymentAllocation
FinancialTransaction
CreditNote
DebitNote
Refund
Adjustment
CollectionCase
CollectionActivity
PromiseToPay
PaymentPlan
PaymentPlanInstallment
Statement
PaymentProviderTransaction
ReconciliationRecord
FinancialEvent
AuditLog
```

---

# 8. Entity → Financial Account Relationship

The existing SmartSapp `Entity` remains the canonical CRM customer/business/institution record.

Finance must not duplicate the entity system.

The existing `UnifiedEntitySelector` should continue to be used for entity selection; it already provides search, segmentation, tags, location filtering, lifecycle filtering and cursor-based selection.

The new relationship becomes:

```text
Entity
   │
   └── Financial Account
          │
          ├── Billing Agreements
          ├── Invoices
          ├── Payments
          ├── Credits
          ├── Collections
          └── Ledger
```

---

# 9. Financial Account

## Purpose

The Financial Account is the customer's financial identity within SmartSapp.

### Required fields

```typescript
interface FinancialAccount {
  id: string;

  organizationId: string;
  workspaceId: string;

  entityId: string;

  accountNumber: string;
  accountName: string;

  currency: string;

  status:
    | 'active'
    | 'on_hold'
    | 'restricted'
    | 'closed';

  accountType:
    | 'customer'
    | 'partner'
    | 'other';

  creditLimit?: number;

  currentBalance: number;
  totalOutstanding: number;
  totalOverdue: number;
  availableCredit?: number;

  collectionStatus:
    | 'current'
    | 'reminder'
    | 'follow_up'
    | 'collection'
    | 'escalated'
    | 'disputed'
    | 'written_off';

  riskLevel:
    | 'low'
    | 'medium'
    | 'high';

  assignedTo?: string;

  createdAt: string;
  updatedAt: string;
}
```

### Source of truth

`currentBalance` is a materialized value.

The authoritative financial history remains the ledger.

---

# 10. Financial Ledger

The ledger is the core financial source of truth.

```text
financial_transactions
```

### Transaction types

```text
invoice_issued
payment_received
payment_allocated
credit_note
debit_note
refund
adjustment
write_off
reversal
```

### Model

```typescript
interface FinancialTransaction {
  id: string;

  organizationId: string;
  workspaceId: string;

  accountId: string;
  entityId: string;

  transactionType: FinancialTransactionType;

  referenceType: string;
  referenceId: string;
  referenceNumber?: string;

  debit: number;
  credit: number;

  currency: string;

  balanceAfter: number;

  effectiveAt: string;

  source:
    | 'system'
    | 'user'
    | 'payment_provider'
    | 'migration'
    | 'automation';

  createdBy?: string;

  correlationId?: string;
  idempotencyKey?: string;

  metadata?: Record<string, unknown>;

  createdAt: string;
}
```

---

# 11. Ledger Principles

The ledger must be:

* append-oriented
* auditable
* immutable after posting
* tenant scoped
* traceable to a source document
* reversible through compensating transactions

Financial records should never be silently deleted or rewritten.

If an error occurs:

```text
Incorrect transaction
        ↓
Reversal
        ↓
Correct transaction
```

---

# 12. Firestore Transaction Strategy

Firestore supports atomic transactions and batched writes, including serializable transaction isolation.

Finance operations that change multiple dependent financial records should use server-side transactional operations where consistency is required.

For example:

```text
Confirm Payment
       │
       ├── Create payment
       ├── Create allocation
       ├── Create ledger transaction
       ├── Update invoice balance
       └── Update account summary
```

These operations should either all succeed or none should.

Transactions must remain small because Firestore transaction latency and contention increase as more documents participate.

Therefore:

> **Do not put large invoice searches, reporting calculations or bulk collection processing inside financial write transactions.**

Use background jobs for those workloads.

---

# 13. Invoice Architecture

The existing Invoice model should be evolved rather than discarded.

## Invoice structure

```typescript
interface Invoice {
  id: string;

  organizationId: string;
  workspaceId: string;

  invoiceNumber: string;

  accountId: string;
  entityId: string;

  entitySnapshot: EntitySnapshot;

  billingAgreementId?: string;
  billingPeriodId?: string;

  issueDate: string;
  dueDate: string;

  currency: string;

  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxTotal: number;

  total: number;
  amountPaid: number;
  amountCredited: number;
  balanceDue: number;

  status:
    | 'draft'
    | 'issued'
    | 'void'
    | 'cancelled';

  paymentStatus:
    | 'unpaid'
    | 'partially_paid'
    | 'paid';

  collectionStatus:
    | 'none'
    | 'reminder'
    | 'follow_up'
    | 'collection'
    | 'escalated'
    | 'promise_to_pay'
    | 'disputed'
    | 'written_off';

  items: InvoiceItem[];

  taxSnapshot: TaxSnapshot;

  paymentTerms: PaymentTermsSnapshot;

  remittanceSnapshot: RemittanceSnapshot;

  createdAt: string;
  issuedAt?: string;
  sentAt?: string;
  paidAt?: string;
  voidedAt?: string;

  createdBy: string;
  issuedBy?: string;
}
```

---

# 14. Invoice State Machine

Invoice lifecycle and payment state must be separate.

## Invoice lifecycle

```text
DRAFT
  │
  ▼
ISSUED
  │
  ├──────► VOID
  │
  ▼
SENT
```

## Payment lifecycle

```text
UNPAID
  │
  ▼
PARTIALLY_PAID
  │
  ▼
PAID
```

## Collection lifecycle

```text
NONE
  ↓
REMINDER
  ↓
FOLLOW_UP
  ↓
COLLECTION
  ↓
ESCALATED
```

This allows:

```text
Invoice:
ISSUED

Payment:
PARTIALLY_PAID

Collection:
FOLLOW_UP
```

without forcing one status to represent three independent concepts.

---

# 15. Invoice Numbering

Invoice numbering must be:

* unique
* sequential/configurable
* tenant scoped
* concurrency safe
* non-reusable
* audit logged

Recommended format:

```text
INV-2026-000001
INV-2026-000002
INV-2026-000003
```

The sequence allocation must happen server-side.

---

# 16. Invoice Snapshotting

When an invoice is issued, snapshot:

* customer name
* billing address
* billing contact
* tax configuration
* tax rates
* product names
* prices
* discounts
* currency
* payment terms
* payment instructions
* authorized signatory

The invoice must remain historically correct even if the underlying customer, package or billing profile changes.

This extends the existing implementation's approach of falling back to historical tax rates when billing profiles change.

---

# 17. Billing Agreements

Introduce:

```text
billing_agreements
```

A billing agreement defines why and how a customer is billed.

### Example

```text
School ABC
   │
   └── SmartSapp Subscription
          │
          ├── Package: Level B
          ├── Quantity: 500 students
          ├── Rate: GHS 49.97
          ├── Frequency: Termly
          ├── Start: 2026-09-01
          └── Renewal: Automatic
```

---

# 18. Products and Pricing

Separate products from prices.

```text
products
    │
    └── prices
```

This prevents historical invoices from being affected by future price changes.

### Product

```text
id
name
description
sku
category
unit
taxProfileId
status
```

### Price

```text
id
productId
currency
unitAmount
billingFrequency
effectiveFrom
effectiveUntil
status
```

---

# 19. Charges

Introduce:

```text
charges
```

A charge is the financial obligation generated before or during invoice creation.

This provides flexibility for:

* subscriptions
* usage
* manual charges
* penalties
* late fees
* additional services
* one-off charges

Flow:

```text
Product / Agreement / Usage
          ↓
        Charge
          ↓
       Invoice
          ↓
      Receivable
```

---

# 20. Billing Periods

Retain the existing billing-period functionality.

Current functionality already supports cycle dates, invoice trigger dates, due dates and open/closed states.

Finance 2.0 adds:

* automated generation
* recurrence
* billing schedules
* holiday/weekend handling
* grace periods
* configurable payment terms
* batch invoice jobs

---

# 21. Payment Architecture

Payments become first-class entities.

```text
payments
```

### Payment model

```typescript
interface Payment {
  id: string;

  organizationId: string;
  workspaceId: string;

  accountId: string;
  entityId: string;

  amount: number;
  currency: string;

  paymentMethod:
    | 'mobile_money'
    | 'bank_transfer'
    | 'card'
    | 'cash'
    | 'cheque'
    | 'manual'
    | 'other';

  provider?: string;
  providerTransactionId?: string;

  status:
    | 'pending'
    | 'confirmed'
    | 'failed'
    | 'reversed'
    | 'refunded';

  reference?: string;

  receivedAt?: string;
  settledAt?: string;

  payerName?: string;

  idempotencyKey?: string;

  metadata?: Record<string, unknown>;

  createdAt: string;
}
```

---

# 22. Payment Allocation

Never make an invoice the owner of a payment.

Instead:

```text
Payment
    ↓
Payment Allocation
    ↓
Invoice
```

This permits one payment to settle multiple invoices.

Example:

```text
Payment
GHS 50,000
     │
     ├── INV-001 → GHS 20,000
     ├── INV-002 → GHS 25,000
     └── Account Credit → GHS 5,000
```

---

# 23. Payment Allocation Rules

The system must prevent:

```text
allocation > payment remaining
allocation > invoice balance
allocation < 0
currency mismatch
cross-account allocation
cross-workspace allocation
```

All financial allocation operations must be server-authoritative.

---

# 24. Payment Provider Architecture

Payment providers should be abstracted behind a common interface.

```text
PaymentProvider
      │
      ├── Paystack
      ├── Flutterwave
      ├── Stripe
      ├── MTN MoMo
      └── Manual
```

Each provider should implement:

```text
initializePayment()
verifyPayment()
getTransaction()
refundPayment()
```

SmartSapp Finance should not contain provider-specific business logic throughout the application.

---

# 25. Webhook Processing

Payment webhook flow:

```text
Provider
   ↓
Webhook Endpoint
   ↓
Signature Verification
   ↓
Schema Validation
   ↓
Idempotency Check
   ↓
Payment Processing
   ↓
Allocation
   ↓
Ledger
   ↓
Invoice Update
   ↓
Account Update
   ↓
Financial Event
```

Webhook processing must be idempotent.

A provider retry must not create duplicate payments.

Firestore's own documentation recommends transaction-based strategies for guaranteeing application-level idempotency in retry-sensitive workloads.

---

# 26. Reconciliation

Create:

```text
/admin/finance/reconciliation
```

Views:

```text
Unmatched
Matched
Partially Matched
Exceptions
Reversed
```

Example:

```text
Provider Transaction
TXN-839292
GHS 20,000

        ↓

SmartSapp Payment
PAY-000921

        ↓

Invoice
INV-2026-00391

        ↓

Allocation
GHS 20,000
```

---

# 27. Customer Statements

Create:

```text
/admin/finance/statements
```

Statement structure:

```text
Opening Balance

Invoices
Payments
Credit Notes
Debit Notes
Adjustments

Closing Balance
```

Statements should be:

* viewable
* downloadable
* PDF generated
* emailed
* WhatsApp/SMS linked where appropriate

---

# 28. Credit Notes

Credit notes provide controlled reductions to customer debt.

Workflow:

```text
Create Draft
    ↓
Review
    ↓
Approve
    ↓
Issue
    ↓
Ledger
    ↓
Account Balance
```

Credit notes must reference their originating invoice where applicable.

---

# 29. Debit Notes

Debit notes support additional formal charges without modifying an issued invoice.

Example:

```text
Invoice
GHS 50,000

Debit Note
GHS 5,000

Total Receivable
GHS 55,000
```

---

# 30. Refunds

Support:

* full refunds
* partial refunds
* provider refunds
* manual refunds
* payment reversals

Refunds must produce their own financial events.

---

# 31. Accounts Receivable

Create:

```text
/admin/finance/receivables
```

The AR dashboard should show:

```text
Total Receivable
Current
1–30 Days
31–60 Days
61–90 Days
90+ Days
```

---

# 32. Aging Engine

Aging is calculated from:

```text
Current Date - Due Date
```

Buckets:

```text
Current
1–30
31–60
61–90
90+
```

The UI should support filtering by:

* workspace
* entity
* account manager
* collection owner
* region
* customer segment
* amount
* aging
* collection status

---

# 33. Collection Cases

Introduce:

```text
collection_cases
```

### Model

```typescript
interface CollectionCase {
  id: string;

  organizationId: string;
  workspaceId: string;

  accountId: string;
  entityId: string;

  invoiceIds: string[];

  amountOutstanding: number;
  amountOverdue: number;

  oldestDueDate: string;

  stage:
    | 'upcoming'
    | 'reminder'
    | 'follow_up'
    | 'active_collection'
    | 'escalated'
    | 'final_notice'
    | 'payment_arrangement'
    | 'legal'
    | 'resolved';

  priority:
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';

  assignedTo?: string;

  nextAction?: string;
  nextActionAt?: string;

  lastContactAt?: string;
  lastContactOutcome?: string;

  promiseToPayId?: string;
  paymentPlanId?: string;

  status:
    | 'open'
    | 'paused'
    | 'resolved'
    | 'written_off';

  createdAt: string;
  closedAt?: string;
}
```

---

# 34. Collection Stages

Default workflow:

```text
Upcoming
   ↓
Reminder
   ↓
Follow-up
   ↓
Active Collection
   ↓
Escalated
   ↓
Final Notice
   ↓
Payment Arrangement
   ↓
Legal / External
   ↓
Resolved
```

Administrators should be able to customize stages.

---

# 35. Collection Activities

Collection activities should reuse SmartSapp CRM activity infrastructure.

Supported activities:

```text
Call
Email
SMS
WhatsApp
Meeting
Task
Note
Promise to Pay
Payment Plan
Document
```

Every activity should appear in the entity timeline.

---

# 36. Promise to Pay

Introduce:

```text
promise_to_pay
```

Fields:

```text
id
collectionCaseId
accountId
amount
promiseDate
notes
createdBy
status
createdAt
fulfilledAt
brokenAt
```

Statuses:

```text
pending
fulfilled
broken
cancelled
```

---

# 37. Payment Plans

Introduce:

```text
payment_plans
payment_plan_installments
```

Example:

```text
Debt = GHS 100,000

Installment 1 = 20,000
Installment 2 = 20,000
Installment 3 = 20,000
Installment 4 = 20,000
Installment 5 = 20,000
```

Each installment has:

```text
amount
dueDate
amountPaid
balance
status
```

Statuses:

```text
scheduled
due
partially_paid
paid
missed
cancelled
```

---

# 38. Automated Collections

Finance automation should support:

### Before due date

```text
7 days before due
→ Send reminder
```

### Due date

```text
Due today
→ Send payment notification
```

### Overdue

```text
1 day overdue
→ Reminder

7 days overdue
→ Create collection task

14 days overdue
→ Assign account manager

30 days overdue
→ Escalate

60 days overdue
→ Collection manager

90+ days
→ Final escalation
```

These thresholds must be configurable.

---

# 39. Finance Event Architecture

Introduce a standard financial event system.

Events:

```text
invoice.created
invoice.issued
invoice.sent
invoice.viewed
invoice.due
invoice.overdue

payment.created
payment.confirmed
payment.failed
payment.reversed
payment.refunded

payment.allocated

credit_note.created
credit_note.issued

debit_note.created
debit_note.issued

refund.created

collection.created
collection.stage_changed
collection.escalated

promise.created
promise.fulfilled
promise.broken

payment_plan.created
payment_plan.missed
payment_plan.completed

account.balance_changed
```

---

# 40. Financial Events and SmartSapp Automation

These events must become available to the SmartSapp automation engine.

Example:

```text
TRIGGER:
invoice.overdue

CONDITIONS:
daysOverdue > 14
AND
balanceDue > 10000

ACTIONS:
Send WhatsApp
Create Task
Assign Collection Manager
Create Collection Case
```

Another:

```text
TRIGGER:
payment.confirmed

ACTIONS:
Send Receipt
Update CRM Timeline
Close Collection Case
Notify Account Owner
```

---

# 41. Finance Automation Actions

Expose:

```text
Create Invoice
Send Invoice
Send Statement
Send Payment Reminder
Send Receipt
Create Collection Case
Assign Collection Case
Create Task
Create Payment Plan
Record Payment
Add Account Note
Add Customer Tag
Notify User
```

---

# 42. CRM Integration

The CRM entity page should contain:

```text
Overview
Contacts
Deals
Activities
Communications
Finance
Documents
```

Finance should display:

```text
Financial Account
Balance
Outstanding
Overdue
Invoices
Payments
Collections
Statements
Ledger
Payment Plans
```

---

# 43. Customer Financial Timeline

Example:

```text
01 Aug
Invoice INV-001 issued
GHS 50,000

02 Aug
Invoice sent

04 Aug
Invoice viewed

01 Sep
Invoice overdue

02 Sep
WhatsApp reminder sent

05 Sep
Collection task created

07 Sep
Customer promised GHS 25,000

10 Sep
Payment received
GHS 25,000

10 Sep
Invoice partially paid

10 Oct
Final payment received

10 Oct
Invoice paid
Collection case closed
```

---

# 44. Finance Navigation

Target navigation:

```text
Finance
│
├── Overview
│
├── Billing
│   ├── Invoices
│   ├── Billing Cycles
│   ├── Billing Agreements
│   ├── Products
│   └── Pricing
│
├── Receivables
│   ├── Accounts Receivable
│   ├── Aging
│   └── Statements
│
├── Payments
│   ├── Payments
│   ├── Reconciliation
│   └── Refunds
│
├── Collections
│   ├── Collection Cases
│   ├── Promises
│   └── Payment Plans
│
├── Adjustments
│   ├── Credit Notes
│   ├── Debit Notes
│   └── Write-offs
│
├── Reports
│
└── Settings
    ├── Financial Profiles
    ├── Tax
    ├── Payment Providers
    ├── Numbering
    ├── Collection Rules
    └── Permissions
```

---

# 45. Finance Dashboard

The primary dashboard should answer:

```text
TOTAL INVOICED
GHS 2.4M

TOTAL COLLECTED
GHS 1.9M

OUTSTANDING
GHS 500K

OVERDUE
GHS 180K
```

Secondary metrics:

* invoices issued
* invoices paid
* payment success rate
* average days to payment
* collection rate
* current AR
* 30-day AR
* 60-day AR
* 90+ AR
* active collection cases
* promised payments
* expected collections

---

# 46. Customer Financial Health

On the customer profile:

```text
Financial Health

Balance
GHS 84,500

Overdue
GHS 52,000

Oldest Debt
97 days

Collection Stage
Escalated

Payment Behaviour
High Risk

Promise to Pay
GHS 20,000
28 Aug 2026
```

---

# 47. Multi-Tenancy Architecture

The current implementation uses `workspaceIds: string[]` for financial documents.

Finance 2.0 should establish a canonical ownership model:

```text
Organization
    │
    ├── Workspace A
    ├── Workspace B
    └── Workspace C
```

Financial records should have:

```text
organizationId
workspaceId
```

as primary ownership attributes.

If cross-workspace sharing is needed, it should be represented separately rather than making multiple workspace IDs the fundamental ownership boundary.

---

# 48. Firestore Collection Architecture

Recommended top-level collections:

```text
financial_accounts
billing_agreements
products
prices
charges

invoices
invoice_items

payments
payment_allocations

financial_transactions

credit_notes
debit_notes
refunds
adjustments

collection_cases
collection_activities
promises_to_pay

payment_plans
payment_plan_installments

statements

payment_provider_transactions
reconciliation_records

financial_events
financial_jobs

financial_audit_logs
```

Existing collections retained:

```text
billing_profiles
billing_periods
subscription_packages
contracts
```

with gradual migration toward the new domain model.

---

# 49. Subcollection vs Top-Level Collection Strategy

Use top-level collections for objects that require:

* global querying
* reporting
* filtering
* background processing
* cross-account analysis

Examples:

```text
payments
invoices
collection_cases
financial_transactions
```

Use subcollections for tightly coupled child records where appropriate.

For example:

```text
payment/{paymentId}/allocations
```

or:

```text
invoice/{invoiceId}/items
```

The choice should be driven by query patterns rather than simply nesting everything beneath the parent.

---

# 50. Firestore Indexing

Required indexes should be designed from actual application queries.

Likely composite indexes include:

```text
invoices:
workspaceId + status + dueDate
workspaceId + paymentStatus + dueDate
accountId + issueDate
accountId + paymentStatus
workspaceId + collectionStatus + dueDate

payments:
workspaceId + status + receivedAt
accountId + receivedAt

collection_cases:
workspaceId + stage + priority
workspaceId + assignedTo + status
workspaceId + nextActionAt + status

financial_transactions:
accountId + effectiveAt
workspaceId + transactionType + effectiveAt
```

Avoid unnecessary indexing on large fields that aren't queried. Firestore documentation specifically identifies index fanout as a factor that can increase write latency and transaction cost.

---

# 51. Materialized Financial Summaries

Do not calculate every dashboard metric by scanning all invoices and payments.

Maintain summary documents such as:

```text
account_financial_summary
workspace_financial_summary
collection_summary
daily_financial_summary
```

Example:

```typescript
interface AccountFinancialSummary {
  accountId: string;

  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;

  current: number;
  overdue1To30: number;
  overdue31To60: number;
  overdue61To90: number;
  overdue90Plus: number;

  lastPaymentAt?: string;
  lastInvoiceAt?: string;

  updatedAt: string;
}
```

These are projections, not the source of truth.

---

# 52. Background Job Architecture

Long-running operations should not execute synchronously inside user requests.

Jobs include:

```text
invoice_generation
recurring_billing
pdf_generation
statement_generation
payment_reconciliation
aging_update
collection_escalation
reminder_dispatch
report_generation
data_migration
```

Architecture:

```text
Financial Event
      ↓
Job Queue
      ↓
Worker
      ↓
Financial Operation
      ↓
Event
```

---

# 53. Idempotency Architecture

Every retryable financial operation needs an idempotency key.

Examples:

```text
payment:{provider}:{transactionId}
invoice:{agreementId}:{billingPeriodId}
collection:{accountId}:{ruleId}:{date}
```

The system should guarantee:

```text
same operation
+
same idempotency key
=
same financial result
```

This is particularly important for webhook processing and scheduled jobs.

---

# 54. Financial Audit System

Create:

```text
financial_audit_logs
```

Capture:

```text
actor
action
entity
financial object
previous state
new state
reason
timestamp
IP/device metadata where appropriate
correlationId
```

Examples:

```text
Invoice voided
Payment manually created
Credit note issued
Refund approved
Write-off approved
Collection reassigned
Payment plan modified
```

---

# 55. Permissions

Finance permissions should be granular.

```text
finance.view
finance.create
finance.edit
finance.issue
finance.void
finance.record_payment
finance.allocate_payment
finance.refund
finance.credit
finance.debit
finance.writeoff
finance.manage_collections
finance.manage_payment_plans
finance.reconcile
finance.export
finance.settings
```

Sensitive operations should require elevated permissions.

---

# 56. Approval Workflows

Support approval requirements for:

```text
Large refunds
Large write-offs
Invoice voids
Large credit notes
Manual payment adjustments
Payment plan exceptions
```

Example:

```text
Write-off
GHS 25,000
       ↓
Finance Manager Approval
       ↓
Ledger Entry
```

---

# 57. Public Invoice Portal 2.0

The existing public invoice portal should evolve into a customer-facing financial experience.

Current functionality already provides invoice details, payment instructions, signatures and PDF/print capabilities.

Add:

```text
Invoice
Payment Status
Balance Due
Pay Now
Payment History
Download PDF
Download Receipt
Contact Billing
```

Potential future capability:

```text
Customer Financial Portal
```

where customers can access:

* invoices
* statements
* payments
* receipts
* payment plans
* outstanding balances

---

# 58. Public Access Security

Do not expose predictable internal invoice IDs as the sole security mechanism.

Use secure public tokens.

```text
/invoice/{securePublicToken}
```

Tokens should:

* be cryptographically random
* not expose internal IDs
* be revocable
* optionally expire
* be rate limited
* be logged
* never grant internal CRM access

Payment amount must always be resolved server-side.

---

# 59. Tax Architecture

The current billing profile supports levy %, VAT %, discount and remittance settings.

Finance 2.0 should introduce:

```text
tax_profiles
tax_rules
tax_rates
tax_exemptions
```

A tax rule should support:

```text
taxType
rate
calculationBasis
inclusive
exclusive
effectiveFrom
effectiveUntil
```

Issued invoices must retain their tax snapshot.

---

# 60. Currency Architecture

Initially:

```text
GHS
USD
NGN
```

or other supported currencies may be configured.

Each financial account should have a base currency.

Each invoice has an invoice currency.

Each payment has a settlement currency.

If multi-currency settlement is introduced:

```text
Invoice Currency
        ↓
Exchange Rate Snapshot
        ↓
Settlement Currency
```

Do not introduce live exchange-rate dependencies into the core ledger without explicit exchange-rate snapshots.

---

# 61. Reporting Architecture

Reporting should use read-optimized projections rather than repeatedly querying operational collections.

Core reports:

### Revenue

* invoiced
* collected
* outstanding

### Receivables

* aging
* outstanding by customer
* outstanding by workspace
* overdue trend

### Collections

* recovery amount
* recovery rate
* collector performance
* promise success rate
* payment-plan success

### Payments

* payment method
* provider
* failed payments
* settlement
* reconciliation exceptions

---

# 62. Key KPIs

Finance 2.0 should calculate:

```text
Total Invoiced
Total Collected
Total Outstanding
Total Overdue

Collection Rate
Payment Success Rate

Average Days to Payment
Average Days Outstanding

90+ Day Receivables

Promise-to-Pay Fulfillment Rate

Collection Recovery Rate
```

Future accounting metrics can include:

```text
MRR
ARR
DSO
Projected Collections
Revenue Forecast
```

---

# 63. API / Server Action Architecture

Avoid allowing UI components to directly mutate critical financial state.

Recommended domain services:

```text
InvoiceService
BillingService
FinancialAccountService
PaymentService
AllocationService
LedgerService
CollectionService
StatementService
RefundService
ReconciliationService
FinancialEventService
```

Example:

```text
PaymentService.confirm()
        ↓
AllocationService.allocate()
        ↓
LedgerService.post()
        ↓
FinancialEventService.emit()
```

---

# 64. Example Server Operations

```text
createDraftInvoice()
issueInvoice()
voidInvoice()

createFinancialAccount()
getFinancialAccount()

recordPayment()
confirmPayment()
reversePayment()

allocatePayment()
unallocatePayment()

issueCreditNote()
issueDebitNote()

createRefund()

createCollectionCase()
assignCollectionCase()
createPromiseToPay()
createPaymentPlan()

generateStatement()

reconcilePayment()
```

---

# 65. Domain Events Must Be Server-Generated

The browser must never be trusted to announce:

```text
payment.confirmed
invoice.paid
refund.completed
```

The server generates those events only after the underlying financial operation succeeds.

---

# 66. Invoice Creation Flow

```text
User selects Entity
        ↓
Resolve Financial Account
        ↓
Select Billing Agreement / Period
        ↓
Resolve Charges
        ↓
Calculate Line Items
        ↓
Calculate Discounts
        ↓
Calculate Taxes
        ↓
Generate Draft
        ↓
User Reviews
        ↓
Issue Invoice
        ↓
Assign Invoice Number
        ↓
Snapshot Financial Data
        ↓
Post Receivable
        ↓
Emit invoice.issued
        ↓
Send Invoice
```

---

# 67. Payment Flow

```text
Customer
   ↓
Public Invoice
   ↓
Pay Now
   ↓
Payment Provider
   ↓
Provider Confirmation
   ↓
Webhook
   ↓
Verify
   ↓
Idempotency
   ↓
Create Payment
   ↓
Allocate
   ↓
Ledger
   ↓
Update Invoice
   ↓
Update Account
   ↓
Emit payment.confirmed
   ↓
Receipt
```

---

# 68. Collection Flow

```text
Invoice Due
    ↓
Payment Received?
   / \
 YES  NO
  │    │
  │    ▼
  │  Overdue
  │    ↓
  │  Reminder
  │    ↓
  │  Follow-up
  │    ↓
  │  Collection Case
  │    ↓
  │  Contact Customer
  │    ↓
  │  Promise to Pay?
  │   / \
  │ YES  NO
  │  │    │
  │  ▼    ▼
  │ Plan  Escalate
  │  │
  │  ▼
  │ Monitor
  │  │
  └──┴──→ Payment
             ↓
          Resolve
```

---

# 69. Automation Example

```text
WHEN:
Invoice becomes 7 days overdue

IF:
Balance > GHS 5,000

THEN:
1. Create Collection Case
2. Assign Account Owner
3. Send WhatsApp
4. Send Email
5. Create Call Task
6. Add "Payment Follow-up" activity
```

---

# 70. Customer Portal Roadmap

### Phase 1

Public invoice.

### Phase 2

Payment.

### Phase 3

Receipt.

### Phase 4

Statement.

### Phase 5

Customer financial portal.

### Phase 6

Payment plans and self-service arrangements.

---

# 71. Migration Strategy

The existing billing system must remain operational while Finance 2.0 is introduced.

### Migration sequence

```text
Existing Billing
       ↓
Create Financial Accounts
       ↓
Migrate Existing Invoices
       ↓
Generate Historical Ledger
       ↓
Recalculate Balances
       ↓
Reconcile
       ↓
Enable New Payment Engine
       ↓
Enable Collections
       ↓
Switch Financial Source of Truth
       ↓
Deprecate Legacy Balance Logic
```

No legacy invoice should disappear.

---

# 72. Migration Validation

For every account:

```text
Legacy Outstanding
=
New Ledger Outstanding
```

For every invoice:

```text
Legacy Invoice Total
=
New Invoice Total
```

For every historical payment:

```text
Legacy Payment
=
New Payment
```

Any mismatch must produce a migration exception rather than being silently corrected.

---

# 73. Feature Flags

Finance 2.0 should be released behind feature flags.

Examples:

```text
finance_v2_accounts
finance_v2_ledger
finance_v2_payments
finance_v2_reconciliation
finance_v2_collections
finance_v2_automation
finance_v2_reports
```

This allows controlled rollout.

---

# 74. Testing Requirements

## Unit tests

Test:

* tax calculations
* invoice totals
* discounts
* balance calculations
* aging
* allocation
* refunds
* credits
* payment plans

## Integration tests

Test:

```text
Invoice → Ledger
Payment → Ledger
Payment → Allocation
Allocation → Invoice
Payment → Account
Credit → Account
Refund → Ledger
```

## Security tests

Test:

* cross-workspace access
* unauthorized invoice changes
* unauthorized refunds
* unauthorized write-offs
* public token access
* privilege escalation

## Webhook tests

Test:

* duplicate webhook
* invalid signature
* malformed payload
* delayed webhook
* failed payment
* reversed payment
* duplicate payment
* partial payment

## Load tests

Test:

* bulk invoice generation
* large AR reports
* high-volume payment events
* concurrent payment allocation
* collection batch processing

---

# 75. Observability

Every financial operation should have:

```text
correlationId
requestId
operationId
actorId
source
duration
result
error
```

Monitoring should identify:

* failed payment processing
* webhook failures
* reconciliation exceptions
* ledger failures
* duplicate events
* collection job failures
* invoice generation failures
* PDF generation failures

---

# 76. Reliability Requirements

Financial operations should target:

### Exactly-once financial effect

Even if requests are delivered multiple times.

### Atomic financial mutation

Dependent changes must succeed together.

### Eventual consistency

Non-critical projections and analytics may update asynchronously.

### Strong consistency

Balances, allocations and financial transaction posting must remain authoritative.

---

# 77. Scalability Principles

The architecture should follow these principles:

1. Keep financial write transactions small.
2. Avoid large collection scans inside transactions.
3. Use cursor pagination.
4. Use background jobs for batch processing.
5. Use materialized summaries for dashboards.
6. Avoid high-contention documents.
7. Minimize index fanout.
8. Use idempotency keys.
9. Separate operational writes from analytics reads.
10. Keep immutable financial history separate from mutable projections.

Firestore documentation specifically recommends avoiding large reads inside transactions and minimizing transaction participants for performance.

---

# 78. Product Phases

The engineering implementation should follow this sequence:

## Phase 0 — Architecture & Audit

Deliver:

* domain model
* terminology
* migration plan
* event catalogue
* permissions
* security model

## Phase 1 — Financial Accounts

Deliver:

* accounts
* account profile
* balance projection
* CRM integration

## Phase 2 — Ledger

Deliver:

* transactions
* posting engine
* audit trail
* reversals

## Phase 3 — Invoice 2.0

Deliver:

* improved lifecycle
* numbering
* snapshots
* immutable issued invoices
* balance tracking

## Phase 4 — Billing Engine

Deliver:

* products
* prices
* agreements
* recurring billing
* charges

## Phase 5 — Payments

Deliver:

* payments
* allocation
* partial payments
* receipts

## Phase 6 — Payment Providers

Deliver:

* provider abstraction
* webhooks
* idempotency
* reconciliation

## Phase 7 — Financial Adjustments

Deliver:

* statements
* credit notes
* debit notes
* refunds
* write-offs

## Phase 8 — Accounts Receivable

Deliver:

* AR dashboard
* aging
* customer balances
* financial health

## Phase 9 — Collections

Deliver:

* cases
* stages
* activities
* escalation

## Phase 10 — Payment Plans

Deliver:

* promises
* plans
* installments
* monitoring

## Phase 11 — Automation

Deliver:

* financial triggers
* conditions
* financial actions
* CRM timeline integration

## Phase 12 — Analytics & Production Hardening

Deliver:

* reports
* dashboards
* performance
* security
* load testing
* observability
* migration completion

---

# 79. Definition of Done

Finance 2.0 is considered production-ready when the following complete workflow works without manual database intervention:

```text
CRM Entity
    ↓
Financial Account
    ↓
Billing Agreement
    ↓
Charge
    ↓
Invoice
    ↓
Invoice Delivery
    ↓
Customer Views Invoice
    ↓
Payment
    ↓
Provider Verification
    ↓
Payment Allocation
    ↓
Ledger Posting
    ↓
Invoice Balance Update
    ↓
Account Balance Update
    ↓
Receipt
    ↓
CRM Timeline
```

If payment does not occur:

```text
Invoice
    ↓
Due
    ↓
Overdue
    ↓
Collection Case
    ↓
Reminder
    ↓
Follow-up
    ↓
Promise to Pay
    ↓
Payment Plan
    ↓
Payment
    ↓
Allocation
    ↓
Collection Resolved
```

Every step must be:

* auditable
* permission controlled
* tenant isolated
* idempotent where applicable
* observable
* recoverable
* testable

---

# 80. Final Target Architecture

The final SmartSapp Finance architecture should therefore be understood as seven layers:

```text
┌─────────────────────────────────────────────┐
│             SMARTSAPP CRM UX                │
│ Accounts / Invoices / Payments / Collections│
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│              DOMAIN SERVICES                │
│ Billing / Invoice / Payment / Collection    │
│ Ledger / Reconciliation / Statement         │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│             FINANCIAL DOMAIN                │
│ Accounts / Charges / Invoices / Payments    │
│ Credits / Refunds / Collections              │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│              FINANCIAL LEDGER               │
│ Immutable financial transaction history      │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│              EVENT SYSTEM                   │
│ Financial events → CRM / Automation / Jobs  │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│          PAYMENT & INTEGRATIONS             │
│ Paystack / Flutterwave / MoMo / Bank       │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│          ANALYTICS & PROJECTIONS             │
│ AR / Aging / Collections / Revenue / Cash  │
└─────────────────────────────────────────────┘
```

## Architectural north star

**SmartSapp Finance 2.0 should not be built as a larger collection of billing screens.**

It should be built as a **financial domain platform inside the CRM**, with the invoice, payment, receivables and collections interfaces all operating against the same financial account and ledger foundation.

That gives SmartSapp the ability to move from:

**"Create and send an invoice"**

to:

**"Manage the complete customer-to-cash lifecycle."**

And because financial events are exposed to the existing CRM automation and engagement infrastructure, Finance becomes a native part of SmartSapp rather than a separate accounting application.

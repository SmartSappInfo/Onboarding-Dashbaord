# SmartSapp Finance 2.0 — Full Implementation Roadmap

The goal should be to evolve the current Finance & Billing Hub from a **billing/invoicing module** into a **scalable financial operations platform embedded inside SmartSapp CRM**.

The existing implementation already gives us a strong starting point: invoice registry/studio, billing periods, packages, financial profiles, public invoices, entity selection, contracts, tax calculations and workspace permissions. 

The roadmap below deliberately starts with the **financial foundation**, rather than adding payment gateways or collection screens first.

---

# Target End State

At completion, the architecture should look like this:

```text
                         SMARTSAPP CRM
                              │
              ┌───────────────┴────────────────┐
              │                                │
          CRM ENTITY                       CRM SYSTEM
              │                     Activities / Tasks / Messaging
              │                     Automations / Deals / Contacts
              ▼
       FINANCIAL ACCOUNT
              │
     ┌────────┼───────────┬────────────┐
     │        │           │            │
   BILLING  INVOICING  PAYMENTS   COLLECTIONS
     │        │           │            │
     │        │           │            │
 Packages   Invoices    Payments    Collection Cases
 Cycles     Credits     Allocation   Promises
 Agreements Debits      Reversals    Payment Plans
 Charges    Refunds     Reconciliation Escalation
     │        │           │            │
     └────────┴───────────┴────────────┘
                    │
                    ▼
              FINANCIAL LEDGER
                    │
                    ▼
             REPORTING & ANALYTICS
```

The implementation should proceed in **12 phases**.

---

# Phase 0 — Discovery, Stabilisation & Architecture Freeze

### Objective

Before introducing new financial functionality, establish exactly what can be retained from the existing billing implementation and what must change.

### 0.1 Audit the current implementation

Inventory:

* Firestore collections
* TypeScript interfaces
* server actions
* client components
* hooks
* security rules
* indexes
* scheduled functions
* API routes
* public invoice routes
* PDF generation
* tax calculations
* billing profile logic
* entity resolution
* permission checks
* notification integrations

The current specification identifies `invoices`, `billing_profiles`, `billing_periods`, `subscription_packages` and `contracts` as the major financial documents. 

### 0.2 Classify existing code

Every existing component should be labelled:

```text
KEEP
REFACTOR
REPLACE
DEPRECATE
NEW
```

### 0.3 Freeze the financial vocabulary

Establish canonical definitions for:

* Entity
* Financial Account
* Customer
* Invoice
* Charge
* Payment
* Payment Allocation
* Credit Note
* Debit Note
* Refund
* Adjustment
* Receivable
* Collection Case
* Payment Plan
* Write-off
* Statement
* Billing Period
* Billing Agreement

This prevents different modules from inventing different meanings.

### 0.4 Establish financial invariants

Examples:

```text
Issued invoices cannot have their financial amounts directly edited.

Payments cannot exceed their verified amount.

A payment allocation cannot exceed:
    payment remaining amount
    OR
    invoice outstanding balance

Ledger entries cannot be deleted.

Voided documents remain auditable.

Invoice numbers cannot be reused.

Financial records require immutable audit history.
```

### Deliverables

* Current-state architecture map
* Target-state architecture
* Domain glossary
* Migration strategy
* Financial invariants
* Permission matrix
* Event catalogue
* Deprecation plan

---

# Phase 1 — Financial Domain Foundation

This is the most important phase.

Do **not** begin with payment gateways.

Build the financial core first.

---

## 1.1 Create Financial Accounts

Introduce:

```text
financial_accounts
```

Each SmartSapp entity can have one or more financial accounts depending on the eventual business model.

Core fields:

```typescript
FinancialAccount {
  id
  organizationId
  workspaceId
  entityId

  accountNumber
  accountName

  currency

  status
  accountType

  creditLimit

  currentBalance
  totalOutstanding
  totalOverdue
  availableCredit

  collectionStatus
  riskLevel

  assignedTo

  createdAt
  updatedAt
}
```

### Important

`currentBalance` should be a **materialized/derived value**, not the ultimate source of truth.

The ledger remains authoritative.

---

## 1.2 Build the financial account profile

On the CRM entity page, introduce a Finance section:

```text
Financial Overview

Current Balance
Outstanding
Overdue
Available Credit

Invoices
Payments
Statements
Collections
Payment Plans
Ledger
```

This creates the first real connection between CRM and Finance.

---

## 1.3 Build financial account lifecycle

Support:

```text
active
on_hold
restricted
closed
```

This allows future business rules such as:

> Account has GHS 100,000 overdue → restrict new billing services.

---

## 1.4 Build account numbering

Example:

```text
ACC-000001
ACC-000002
ACC-000003
```

Account numbers should be tenant/workspace scoped and never reused.

---

# Phase 2 — Financial Ledger

This phase establishes the financial source of truth.

Introduce:

```text
financial_transactions
```

or an equivalent ledger architecture.

---

## 2.1 Ledger transaction types

At minimum:

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

---

## 2.2 Ledger structure

Conceptually:

```typescript
FinancialTransaction {
  id

  organizationId
  workspaceId
  accountId
  entityId

  transactionType

  referenceType
  referenceId
  referenceNumber

  debit
  credit

  currency

  balanceAfter

  effectiveAt

  createdBy
  source
  metadata

  createdAt
}
```

---

## 2.3 Ledger rules

Every financial mutation should produce a ledger event.

For example:

```text
Invoice issued
       ↓
Debit customer account GHS 50,000
       ↓
Balance = GHS 50,000
```

Payment:

```text
Payment received
       ↓
Credit customer account GHS 20,000
       ↓
Balance = GHS 30,000
```

Credit:

```text
Credit note
       ↓
Credit customer account GHS 5,000
       ↓
Balance = GHS 25,000
```

---

## 2.4 Never delete financial transactions

Corrections happen through:

```text
reversal
adjustment
credit
debit
```

not deletion.

---

## 2.5 Audit trail

Every financial mutation should capture:

* actor
* timestamp
* source
* previous state
* new state
* reason
* related document
* request ID
* correlation ID

---

# Phase 3 — Rebuild the Invoice Engine

Now we mature the existing Invoice Studio.

The current implementation already supports line items, profile-bound taxes, discounts, arrears and credits. 

We retain those capabilities but change the underlying model.

---

## 3.1 Separate invoice state dimensions

Instead of:

```text
draft
sent
paid
overdue
```

use:

### Invoice lifecycle

```text
draft
issued
void
cancelled
```

### Payment state

```text
unpaid
partially_paid
paid
```

### Collection state

```text
none
reminder
follow_up
collection
escalated
promise_to_pay
disputed
written_off
```

---

## 3.2 Invoice numbering

Implement a sequence service:

```text
INV-2026-000001
INV-2026-000002
INV-2026-000003
```

Requirements:

* concurrency safe
* tenant scoped
* fiscal year aware
* configurable prefix
* no reuse
* atomic allocation

---

## 3.3 Invoice snapshots

When an invoice is issued, snapshot:

* entity name
* billing address
* contact
* tax profile
* tax rates
* product name
* product price
* discount
* payment terms
* currency
* exchange rate
* remittance details
* signatory

This prevents historical invoices from changing because a customer or pricing profile changes later.

---

## 3.4 Invoice lifecycle

Implement:

```text
Draft
  ↓
Issued
  ↓
Sent
  ↓
Unpaid
  ↓
Partially Paid
  ↓
Paid
```

Alternative path:

```text
Unpaid
  ↓
Overdue
  ↓
Collection
  ↓
Paid
```

And:

```text
Issued → Void
Issued → Disputed
```

with controlled permissions.

---

## 3.5 Replace manual arrears embedding

Instead of adding previous arrears directly into a new invoice, calculate:

```text
Previous Outstanding Balance
+
Current Invoice
-
Credits
=
Total Account Exposure
```

The existing `arrearsAdded` and `creditDeducted` mechanisms should be migrated toward formal ledger-backed balances. 

---

# Phase 4 — Products, Pricing, Billing Agreements & Recurring Billing

The existing package system supports package names, rates, currencies and billing terms. 

Now evolve it into a proper billing catalogue.

---

## 4.1 Product/service catalogue

Introduce:

```text
products
services
```

with:

* name
* SKU
* description
* category
* unit
* tax profile
* default price
* currency
* active status

---

## 4.2 Pricing plans

Separate:

```text
Product
```

from:

```text
Price
```

Example:

```text
SmartSapp Provider
   │
   ├── GHS 39.97 / student / term
   ├── GHS 49.97 / student / term
   └── GHS 89.95 / student / term
```

This makes future pricing changes historical rather than destructive.

---

## 4.3 Billing Agreements

Introduce:

```text
billing_agreements
```

Containing:

* customer
* product/package
* quantity
* rate
* currency
* billing frequency
* start date
* end date
* renewal
* payment terms
* status

---

## 4.4 Recurring billing engine

Support:

```text
monthly
quarterly
termly
annual
custom
```

Automated process:

```text
Agreement
    ↓
Billing Schedule
    ↓
Charge Generation
    ↓
Invoice Generation
    ↓
Invoice Issued
    ↓
Notification
```

---

# Phase 5 — Payment Engine

Now build payments as a first-class system.

---

## 5.1 Payment entity

```text
payments
```

Support:

* payment ID
* account
* entity
* amount
* currency
* method
* provider
* provider transaction ID
* status
* received date
* settlement date
* reference
* payer
* metadata

---

## 5.2 Payment lifecycle

```text
pending
confirmed
failed
reversed
refunded
```

---

## 5.3 Payment methods

Build an extensible payment method framework:

```text
mobile_money
bank_transfer
card
cash
cheque
manual
other
```

---

## 5.4 Payment allocation

Create:

```text
payment_allocations
```

Example:

```text
Payment
GHS 30,000
       │
       ├── Invoice A: 20,000
       ├── Invoice B: 8,000
       └── Account Credit: 2,000
```

This is essential.

---

## 5.5 Partial payments

Invoice:

```text
GHS 100,000
```

Payments:

```text
GHS 30,000
GHS 20,000
GHS 50,000
```

System automatically transitions:

```text
unpaid
→ partially_paid
→ paid
```

---

# Phase 6 — Payment Gateway & Reconciliation Infrastructure

Now integrate external payment systems.

The current roadmap already identifies Paystack, Stripe, Flutterwave and MTN Mobile Money as potential gateway integrations. 

The architecture should make these **providers**, not hard-coded finance logic.

---

## 6.1 Payment provider abstraction

```text
PaymentProvider
├── Paystack
├── Flutterwave
├── Stripe
├── MTN MoMo
└── Manual
```

Each implements common operations:

```text
initializePayment()
verifyPayment()
refundPayment()
getTransaction()
```

---

## 6.2 Webhook architecture

Webhook:

```text
Provider
   ↓
Webhook endpoint
   ↓
Signature verification
   ↓
Idempotency check
   ↓
Payment confirmation
   ↓
Ledger transaction
   ↓
Allocation
   ↓
Invoice update
   ↓
CRM event
   ↓
Receipt
```

---

## 6.3 Idempotency

This is mandatory.

If a payment provider sends the same webhook five times, SmartSapp must create:

**one payment**, not five.

Use:

```text
provider
+
providerTransactionId
+
eventId
```

as appropriate unique/idempotency keys.

---

## 6.4 Reconciliation workspace

Create:

```text
Finance → Reconciliation
```

with:

```text
Unmatched
Matched
Partially Matched
Exception
Reversed
```

Finance users can reconcile:

```text
Bank/Provider Transaction
          ↓
SmartSapp Payment
          ↓
Invoice
```

---

# Phase 7 — Statements, Credits, Debits, Refunds & Adjustments

Now make the financial account operationally complete.

---

## 7.1 Customer statements

Generate:

```text
Statement of Account
```

showing:

| Date | Reference | Description | Debit | Credit | Balance |
| ---- | --------- | ----------- | ----: | -----: | ------: |

This should be downloadable and sendable.

---

## 7.2 Credit notes

Workflow:

```text
Invoice
   ↓
Create Credit Note
   ↓
Approval
   ↓
Issue
   ↓
Ledger
   ↓
Account Balance
```

---

## 7.3 Debit notes

Used when additional charges need to be formally added without modifying the original invoice.

---

## 7.4 Refunds

Support:

```text
full refund
partial refund
payment reversal
```

Every refund produces the corresponding financial events.

---

## 7.5 Write-offs

Support controlled write-offs:

```text
Bad Debt
Administrative Adjustment
Small Balance Write-off
Other
```

Require:

* reason
* amount
* approver
* timestamp
* audit trail

---

# Phase 8 — Accounts Receivable & Aging

Now introduce the proper AR system.

---

## 8.1 AR dashboard

Create:

```text
Finance
→ Accounts Receivable
```

Top metrics:

* Total Receivables
* Current
* 1–30 Days
* 31–60
* 61–90
* 90+
* Collection Pipeline
* Promised Payments
* Collection Rate

---

## 8.2 Aging engine

Every outstanding receivable gets an aging bucket:

```text
current
1_30
31_60
61_90
90_plus
```

The system calculates this dynamically from:

```text
dueDate
+
currentDate
```

rather than permanently storing a potentially stale bucket.

---

## 8.3 Customer financial health

On the CRM entity:

```text
Financial Health

Outstanding: GHS 84,500
Overdue: GHS 52,000
Oldest Invoice: 97 days
Collection Status: Escalated
Promise to Pay: GHS 20,000
Next Payment: 28 Aug
```

This makes Finance immediately useful to Sales and Customer Success.

---

# Phase 9 — Debt Collection System

This becomes a dedicated workspace.

```text
Finance
→ Collections
```

---

## 9.1 Collection cases

Create:

```text
collection_cases
```

A case can contain multiple invoices.

Example:

```text
School ABC

Total Outstanding
GHS 120,000

Invoices:
INV-1001
INV-1007
INV-1012

Oldest Debt:
93 days

Collection Stage:
Escalation

Assigned:
Kwame

Next Action:
Call Finance Director
```

---

## 9.2 Collection stages

Recommended default:

```text
Stage 0 — Upcoming
Stage 1 — Reminder
Stage 2 — Follow-up
Stage 3 — Active Collection
Stage 4 — Escalation
Stage 5 — Final Notice
Stage 6 — Payment Arrangement
Stage 7 — Legal/External
Stage 8 — Resolved
```

Stages should be configurable.

---

## 9.3 Collection activities

Every collection activity becomes a CRM activity:

```text
call
email
SMS
WhatsApp
meeting
task
note
payment commitment
document
```

This means finance activity appears naturally in the customer timeline.

---

# Phase 10 — Promise-to-Pay & Payment Plans

This is particularly important for institutional customers.

---

## 10.1 Promise to Pay

Record:

```text
promisedAmount
promisedDate
method
notes
createdBy
status
```

Statuses:

```text
pending
fulfilled
broken
cancelled
```

---

## 10.2 Automated promise monitoring

Example:

```text
Promise:
GHS 20,000
Due:
28 Aug
```

On 29 Aug:

```text
Payment received?
      │
   ┌──┴──┐
  YES    NO
   │      │
Fulfil   Broken
          │
          ▼
     Escalate case
```

---

## 10.3 Payment plans

Support:

* down payment
* number of installments
* installment frequency
* amount
* dates
* grace period
* late rules

Example:

```text
Debt: GHS 100,000

20,000 — immediate
20,000 — 30 days
20,000 — 60 days
20,000 — 90 days
20,000 — 120 days
```

---

# Phase 11 — Finance Automation & CRM Integration

This is where the system becomes part of the SmartSapp platform.

---

## 11.1 Financial events

Create a standard event catalogue:

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

credit_note.issued
debit_note.issued

collection.created
collection.stage_changed

promise.created
promise.fulfilled
promise.broken

payment_plan.created
payment_plan.missed

account.balance_changed
```

---

## 11.2 Automation triggers

Users should be able to build:

```text
WHEN
Invoice becomes overdue

IF
Balance > GHS 10,000
AND
Days overdue > 7

THEN
Send WhatsApp
Create Task
Assign Finance Manager
```

---

## 11.3 Finance actions in automation

Add actions such as:

```text
Create Invoice
Send Invoice
Send Statement
Send Payment Reminder
Create Collection Case
Assign Collection Case
Create Payment Plan
Add Account Note
Record Payment
Send Receipt
Create Task
```

---

## 11.4 CRM timeline

Example:

```text
Aug 01
Invoice INV-1022 issued
GHS 50,000

Aug 02
Invoice emailed

Aug 08
Invoice viewed

Aug 31
Invoice overdue

Sep 01
WhatsApp reminder sent

Sep 03
Collection task assigned

Sep 05
Customer promised GHS 25,000

Sep 05
Payment plan created

Sep 20
Payment received
```

This is exactly where the finance module should intersect with the CRM.

---

# Phase 12 — Reporting, Security, Scale & Production Hardening

This is the final maturity layer.

---

## 12.1 Financial reporting

Build:

### Revenue

* invoiced revenue
* collected revenue
* outstanding revenue
* projected revenue

### Receivables

* total AR
* aging
* overdue percentage
* average days outstanding

### Collections

* amount collected
* collection rate
* recovery rate
* promise-to-pay success
* collector performance

### Customer

* customer balance
* payment behaviour
* overdue history
* lifetime billing
* lifetime payments

---

# 13. Executive Finance Dashboard

The final dashboard should answer four questions immediately:

### What did we bill?

```text
GHS 2.4M
```

### What did we collect?

```text
GHS 1.9M
```

### What are we owed?

```text
GHS 500K
```

### What is at risk?

```text
GHS 180K
90+ days overdue
```

---

# 14. Security hardening

Financial functionality needs stricter controls than ordinary CRM data.

Implement:

### Permissions

```text
finance.view
finance.create
finance.edit
finance.issue
finance.void
finance.record_payment
finance.refund
finance.writeoff
finance.manage_collections
finance.manage_settings
finance.export
```

---

## Approval workflows

For example:

```text
Refund > GHS 5,000
        ↓
Manager approval
```

```text
Write-off > GHS 10,000
        ↓
Finance Manager approval
```

```text
Invoice void after issue
        ↓
Authorized approval
```

---

# 15. Data protection

Financial documents should have:

* tenant isolation
* workspace authorization
* server-side authorization
* immutable financial events
* audit logs
* signed webhooks
* rate limiting
* idempotency
* secure public invoice tokens
* encrypted sensitive payment metadata where appropriate
* no client-side authority over financial totals

---

# 16. Performance & scalability

As SmartSapp grows, do **not** rely on scanning all invoices for dashboards.

Introduce:

```text
materialized financial summaries
```

For example:

```text
account_financial_summary
workspace_financial_summary
collection_summary
```

Update them through financial events.

This allows:

```text
1,000 invoices
10,000 invoices
100,000 invoices
1,000,000 invoices
```

without every dashboard query becoming progressively more expensive.

---

# 17. Background processing architecture

Move expensive operations out of synchronous requests.

Use workers/jobs for:

```text
Invoice generation
Recurring billing
PDF generation
Email delivery
WhatsApp delivery
SMS delivery
Aging calculations
Reminder scheduling
Collection escalation
Payment reconciliation
Financial reports
Statement generation
```

The current specification already anticipates cron-based automated batch invoicing. 

The mature architecture should evolve that into a proper job/event processing layer.

---

# 18. Testing strategy

Every phase needs automated testing.

### Unit tests

Test:

* tax calculations
* discounts
* invoice totals
* allocation
* balances
* aging
* payment plans
* ledger calculations

### Integration tests

Test:

```text
Invoice → Ledger
Payment → Ledger
Payment → Allocation
Payment → Invoice
Payment → Account
```

### Webhook tests

Test:

* duplicate webhook
* invalid signature
* delayed webhook
* failed payment
* reversed payment
* partial payment

### Security tests

Test:

* cross-workspace access
* unauthorized financial actions
* public invoice access
* token guessing
* privilege escalation

### End-to-end tests

Test the complete customer journey:

```text
Entity
→ Agreement
→ Invoice
→ Send
→ View
→ Payment
→ Allocation
→ Receipt
→ Ledger
→ Account Balance
→ Collection Closure
```

---

# 19. Migration strategy from the current system

This needs to be handled carefully.

Do **not** delete or replace the existing invoice collection immediately.

Instead:

### Step 1

Introduce new financial collections.

```text
financial_accounts
financial_transactions
payments
payment_allocations
collection_cases
```

### Step 2

Create financial accounts for existing entities.

### Step 3

Migrate existing invoices.

For every existing invoice:

```text
Existing Invoice
      ↓
Financial Account
      ↓
Ledger transaction
```

### Step 4

Recalculate balances.

```text
Invoice total
-
historical payments
-
credits
+
adjustments
=
account balance
```

### Step 5

Run reconciliation.

Compare:

```text
Old billing totals
vs
New financial ledger
```

They must match before the new system becomes authoritative.

### Step 6

Enable new payment architecture.

### Step 7

Deprecate old balance calculations.

### Step 8

Remove old paths only after sufficient production validation.

---

# 20. Recommended development order

The actual engineering backlog should therefore be:

```text
PHASE 0
Architecture & Audit
        ↓
PHASE 1
Financial Accounts
        ↓
PHASE 2
Ledger
        ↓
PHASE 3
Invoice Engine
        ↓
PHASE 4
Products / Pricing / Agreements
        ↓
PHASE 5
Payments
        ↓
PHASE 6
Gateway + Reconciliation
        ↓
PHASE 7
Credits / Debits / Refunds / Statements
        ↓
PHASE 8
Accounts Receivable
        ↓
PHASE 9
Collections
        ↓
PHASE 10
Payment Plans / Promises
        ↓
PHASE 11
CRM Automation
        ↓
PHASE 12
Analytics / Security / Scale
```

---

# 21. What "done" should mean

I would not consider SmartSapp Finance 2.0 complete merely because users can create and pay invoices.

The feature is complete when this entire scenario works reliably:

> A SmartSapp entity has a financial account.
> A billing agreement generates a charge.
> SmartSapp generates an invoice.
> The invoice receives a unique immutable number.
> Tax and pricing are snapshotted.
> The invoice is delivered through email/WhatsApp/SMS.
> The customer opens the public invoice.
> The customer pays through a payment provider.
> The webhook is securely verified and processed exactly once.
> SmartSapp creates the payment.
> The payment is allocated to the invoice.
> The invoice becomes partially paid or paid.
> The account ledger is updated.
> The customer receives a receipt.
> The CRM timeline records the event.
> If unpaid, the invoice ages automatically.
> The account enters the appropriate collection stage.
> SmartSapp sends reminders.
> A collection task is assigned.
> The customer makes a promise to pay.
> SmartSapp tracks that promise.
> A payment plan can be established.
> Payments are allocated against the plan.
> The collection case closes automatically when the debt is settled.
> Every financial event remains auditable.
> Finance managers can reconcile payments.
> Management can see revenue, cash, AR and collection performance.

**That is the target I would use for SmartSapp Finance 2.0.**

The key architectural principle throughout the implementation is:

> **Don't build a bigger invoice module. Build a financial transaction system whose invoice module is one component.**

That distinction will determine whether SmartSapp can comfortably scale the feature from today's billing requirements into subscriptions, receivables, institutional debt collection, automated payments, financial reporting and deeper CRM automation without another major rewrite.

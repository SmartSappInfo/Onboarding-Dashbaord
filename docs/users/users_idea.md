# SmartSapp Identity & Access 2.0

## Industry-Grade User Management, Onboarding, Roles, Permissions, Governance, Analytics & AI Platform

**Document Version:** 3.0
**Status:** Target Architecture / Product & Engineering Reference
**Scope:** Identity, user management, organization membership, workspaces, roles, permissions, onboarding, governance, analytics, AI, CRM awareness, security and platform integrations
**Primary Stack Assumption:** Next.js + TypeScript + Firebase Authentication + Cloud Firestore + Firebase Admin SDK + event-driven backend

---

# 1. Executive Architectural Verdict

The extracted implementation is substantially stronger than a conventional CRM user-management feature.

It already contains several enterprise-grade ideas:

* organization/workspace separation
* server-side provisioning
* workspace-scoped permissions
* hierarchical RBAC
* invitation lifecycle
* real-time approval
* session revocation
* backoffice governance
* four-eyes approval
* audit logging
* multi-channel provisioning
* AI preferences
* tenant-aware branding
* legacy permission compatibility

However, there is a fundamental architectural issue:

> **The current system is an advanced user-access implementation, but it is not yet a complete Identity, Membership, Access Governance and Workforce Intelligence platform.**

The current architecture is moving toward this shape:

```text
Firebase User
     ↓
UserProfile
     ↓
Organization
     ↓
Workspace
     ↓
Workspace Roles
     ↓
Hydrated Permission Schema
     ↓
Application Access
```

For SmartSapp 2.0, this needs to become:

```text
Identity
   ↓
Person / Account
   ↓
Membership
   ↓
Organization / Workspace / Team
   ↓
Role Assignment
   ↓
Policy Evaluation
   ↓
Permission
   ↓
Entitlement
   ↓
Resource Scope
   ↓
Authorization Decision
   ↓
Product Actions
   ↓
Activity + Audit Events
   ↓
Analytics
   ↓
AI Intelligence
   ↓
Automation
```

This distinction is extremely important.

The new architecture should make **identity a platform service consumed by every SmartSapp product**, rather than something maintained independently by CRM, Finance, Forms, Surveys, Meetings, Deals, Lead Intelligence, Studios, Portals, etc.

---

# 2. What the Current Architecture Gets Right

## 2.1 Organization → Workspace hierarchy

The existing model correctly recognizes that an organization and an operational workspace are not necessarily the same thing.

This is important for SmartSapp because one customer may eventually operate:

```text
Organization
├── Ghana Operations
├── Nigeria Operations
├── Admissions
├── Sales
├── Marketing
├── Finance
└── Corporate
```

The workspace abstraction is therefore worth preserving.

---

## 2.2 Server-first provisioning

The move away from client-driven provisioning toward Admin SDK server actions is correct.

Sensitive operations should remain server authoritative:

```text
Client Request
      ↓
Authenticated Identity
      ↓
Server Authorization
      ↓
Tenant Boundary Validation
      ↓
Transaction
      ↓
Event
      ↓
Side Effects
```

This should become the standard pattern across SmartSapp.

---

## 2.3 Hierarchical permission schema

The four sections:

* Operations
* Finance
* Studios
* Management

are a useful organizational mechanism.

The problem is not the existence of the hierarchy.

The problem is that SmartSapp will eventually require more dimensions than:

```text
section
→ feature
→ CRUD
```

For example:

> A user may be allowed to **edit deals**, but only deals belonging to their team.

Or:

> A user may create invoices, but cannot approve invoices over GHS 50,000.

Or:

> A school admissions officer can see students assigned to Campus A but not Campus B.

That requires **scope-aware authorization**.

---

# 3. Current-State Architectural Findings

## 3.1 `UserProfile` is carrying too many responsibilities

The current profile contains:

```typescript
organizationId
workspaceIds
workspaceRoles
workspacePermissions
workspacePermissionsSchemas
roles
permissions
permissionsSchema
backofficeRoles
notificationPreferences
AI preferences
session preferences
```

This is convenient initially.

At scale, it becomes a synchronization liability.

The user profile has become:

```text
identity
+
membership
+
authorization
+
preferences
+
session state
+
administration
+
AI configuration
```

These should not remain one aggregate.

---

# 4. Target Domain Architecture

The mature platform should introduce clear bounded domains.

```text
SMARTSAPP IDENTITY PLATFORM

Identity
├── Account
├── Person
├── Authentication Identity
├── Credential
├── MFA
└── Session

Organization
├── Organization
├── Membership
├── Department
├── Team
├── Job Title
└── Organizational Structure

Workspace
├── Workspace
├── Workspace Membership
├── Workspace Scope
└── Workspace Policies

Authorization
├── Role
├── Role Assignment
├── Permission
├── Permission Bundle
├── Policy
├── Resource Scope
├── Access Exception
└── Entitlement

Onboarding
├── Onboarding Journey
├── Journey Instance
├── Step
├── Task
├── Invitation
├── Approval
└── Completion

Governance
├── Access Review
├── Approval Request
├── Security Policy
├── Administrative Action
├── Impersonation Session
└── Audit Event

Activity
├── User Activity
├── CRM Activity
├── Security Activity
└── Product Activity

Analytics
├── Adoption
├── Engagement
├── Productivity
├── Access
├── Security
└── Team Intelligence

AI
├── User Copilot
├── Access Advisor
├── Onboarding Copilot
├── Risk Engine
└── Team Intelligence
```

---

# 5. Target Identity Model

## 5.1 Separate Account from Person

A major architectural improvement is to separate:

### Account

Represents authentication.

```typescript
interface IdentityAccount {
  id: string;
  authProvider: 'firebase' | 'google' | 'saml' | 'oidc';
  authUid: string;
  email: string;
  emailVerified: boolean;
  phoneVerified: boolean;

  status:
    | 'pending'
    | 'active'
    | 'suspended'
    | 'disabled'
    | 'locked'
    | 'deleted';

  mfaStatus: 'not_enabled' | 'optional' | 'required' | 'enrolled';

  lastLoginAt?: Timestamp;
  lastSeenAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Person

Represents the human/business identity.

```typescript
interface Person {
  id: string;

  firstName: string;
  middleName?: string;
  lastName: string;
  displayName: string;

  email?: string;
  phone?: string;
  avatarUrl?: string;

  jobTitle?: string;
  departmentId?: string;
  teamIds?: string[];

  employeeCode?: string;
  externalReference?: string;

  timezone?: string;
  locale?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Why this matters

One person could eventually have:

```text
Person
  ↓
Account
  ↓
Membership A
  → Organization A

Membership B
  → Organization B
```

without corrupting the identity layer.

For normal SmartSapp customer users, you may initially enforce one organization membership. But the data model should not make future expansion impossible.

---

# 6. Membership Becomes the Core Tenant Relationship

Instead of:

```text
user.organizationId
```

being the complete representation of organizational access, introduce:

```typescript
interface OrganizationMembership {
  id: string;

  personId: string;
  accountId: string;
  organizationId: string;

  status:
    | 'invited'
    | 'pending'
    | 'active'
    | 'suspended'
    | 'revoked'
    | 'expired';

  memberType:
    | 'employee'
    | 'contractor'
    | 'partner'
    | 'administrator'
    | 'external';

  departmentId?: string;
  teamIds: string[];

  primaryWorkspaceId?: string;

  joinedAt?: Timestamp;
  invitedAt?: Timestamp;
  suspendedAt?: Timestamp;
  revokedAt?: Timestamp;

  source:
    | 'signup'
    | 'invitation'
    | 'import'
    | 'sso'
    | 'scim'
    | 'migration';

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

This becomes the authoritative link between identity and tenant.

---

# 7. Workspace Membership

Workspace access should be modeled independently.

```typescript
interface WorkspaceMembership {
  id: string;

  organizationId: string;
  workspaceId: string;

  personId: string;
  membershipId: string;

  status: 'active' | 'suspended' | 'revoked';

  roleAssignmentIds: string[];

  scopePolicy?: {
    type: 'all' | 'team' | 'department' | 'owner' | 'custom';
    values?: string[];
  };

  isPrimary: boolean;

  startsAt?: Timestamp;
  expiresAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

This gives SmartSapp a much stronger access model.

---

# 8. Organization Structure

User management should support a lightweight organizational model.

```text
Organization
│
├── Departments
│   ├── Sales
│   ├── Finance
│   ├── Marketing
│   └── Administration
│
├── Teams
│   ├── Admissions
│   ├── Sales Team A
│   └── Sales Team B
│
└── Members
```

Entities:

```typescript
Department
Team
JobTitle
Location
CostCenter
ManagerRelationship
```

The manager relationship is especially useful:

```typescript
interface ReportingRelationship {
  organizationId: string;
  personId: string;
  managerPersonId: string;
  startsAt: Timestamp;
  endsAt?: Timestamp;
}
```

This allows future workflows such as:

> “Require manager approval for this access.”

---

# 9. Roles 2.0

The existing roles are a useful starting point but should be redesigned.

## 9.1 Role categories

```text
Role
├── System Role
├── Organization Role
├── Workspace Role
├── Team Role
└── Custom Role
```

---

## 9.2 Role entity

```typescript
interface Role {
  id: string;

  organizationId?: string;

  key: string;
  name: string;
  description?: string;

  type:
    | 'system'
    | 'organization'
    | 'workspace'
    | 'custom';

  status: 'active' | 'archived';

  permissions: RolePermissionGrant[];

  inheritance?: {
    roleIds: string[];
  };

  constraints?: AccessConstraint[];

  templateKey?: string;

  isImmutable: boolean;
  isAssignable: boolean;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 10. Permission Model 2.0

The current schema:

```text
Section
→ Feature
→ CRUD
```

should evolve to:

```text
Resource
→ Action
→ Scope
→ Condition
```

For example:

```typescript
interface PermissionGrant {
  resource: 'deals';
  actions: ['view', 'create', 'edit'];

  scope: {
    type: 'workspace';
    values: ['workspace_123'];
  };

  conditions?: {
    ownerOnly?: boolean;
    teamOnly?: boolean;
    departmentOnly?: boolean;
    maxAmount?: number;
  };
}
```

---

# 11. RBAC + ABAC Hybrid

SmartSapp should not become purely RBAC.

The better architecture is:

## RBAC

Answers:

> What capabilities does this role normally provide?

## ABAC / policy constraints

Answers:

> Under what circumstances may the capability be used?

Example:

```text
Role:
Sales Executive

Permission:
deals.edit

Constraint:
ownerOnly = true
```

Another:

```text
Role:
Finance Manager

Permission:
invoices.approve

Constraint:
amount <= GHS 25,000
```

Another:

```text
Role:
Workspace Administrator

Permission:
users.edit

Constraint:
cannot_modify_roles >= own_role_level
```

This gives SmartSapp significantly stronger governance.

---

# 12. Permission Decision Pipeline

The central authorization engine should evaluate:

```text
Authenticated Identity
        ↓
Organization Membership
        ↓
Workspace Membership
        ↓
Role Assignments
        ↓
Permission Grants
        ↓
Policies
        ↓
Resource Scope
        ↓
Context
        ↓
Authorization Decision
```

Conceptually:

```typescript
authorize({
  actor,
  organization,
  workspace,
  resource,
  resourceId,
  action,
  context
})
```

returns:

```typescript
interface AuthorizationDecision {
  allowed: boolean;

  reason:
    | 'granted'
    | 'membership_missing'
    | 'workspace_access_missing'
    | 'permission_missing'
    | 'scope_denied'
    | 'policy_denied'
    | 'account_suspended'
    | 'session_invalid';

  matchedRoles: string[];
  matchedPolicies: string[];

  evaluatedAt: string;
}
```

---

# 13. Explicit Deny Support

The current additive OR-merging is the biggest limitation in the RBAC architecture.

Today:

```text
Role A → edit = true
Role B → edit = true

Effective = true
```

The mature model should support:

```text
grant
deny
```

with deterministic precedence.

Recommended model:

```text
Explicit Deny
      ↓
Policy Deny
      ↓
Scope Deny
      ↓
Explicit Grant
      ↓
Inherited Grant
      ↓
Default Deny
```

Do not rely on arbitrary object merge order.

---

# 14. Permission Snapshots

The extracted implementation stores hydrated permissions on users.

That should be retained only as a **derived cache**.

Recommended architecture:

```text
Canonical Role + Policy Definitions
            ↓
Authorization Compiler
            ↓
Permission Snapshot
            ↓
Cache
```

The snapshot may contain:

```typescript
interface PermissionSnapshot {
  subjectId: string;
  organizationId: string;
  workspaceId: string;

  grants: CompiledPermission[];
  hash: string;

  generatedAt: Timestamp;
  sourceVersions: {
    roles: string[];
    policies: string[];
  };
}
```

This preserves fast client-side authorization without making the user document the source of truth.

---

# 15. Authorization Versioning

Introduce:

```text
organization.accessVersion
workspace.accessVersion
membership.accessVersion
```

and/or:

```text
permissionSnapshotHash
```

When access changes:

```text
Role changed
    ↓
Access Version increments
    ↓
Snapshot invalidated
    ↓
Client receives change signal
    ↓
Rehydrates authorization
```

This directly addresses the stale permission issue identified in the current review.

---

# 16. User Lifecycle State Machine

The user lifecycle should become explicit.

```text
INVITED
   ↓
INVITATION_ACCEPTED
   ↓
IDENTITY_CREATED
   ↓
PROFILE_INCOMPLETE
   ↓
ONBOARDING
   ↓
PENDING_APPROVAL
   ↓
ACTIVE
   ├── SUSPENDED
   │      ↓
   │    ACTIVE
   │
   ├── LOCKED
   │      ↓
   │    ACTIVE
   │
   ├── OFFBOARDING
   │      ↓
   │    REVOKED
   │
   └── DELETED
```

Every transition should generate an event.

---

# 17. Invitation Lifecycle

The existing invitation functionality is good but should become first-class.

```text
DRAFT
 ↓
SENT
 ↓
DELIVERED
 ↓
OPENED
 ↓
ACCEPTED
 ↓
ACCOUNT_CREATED
 ↓
ONBOARDING
 ↓
ACTIVE
```

Failure branches:

```text
SENT
 ↓
DELIVERY_FAILED

SENT
 ↓
EXPIRED

OPENED
 ↓
REJECTED
```

Invitation should have:

```typescript
interface Invitation {
  id: string;

  organizationId: string;
  workspaceId?: string;

  email: string;
  phone?: string;

  invitedPersonName?: string;

  roleIds: string[];
  teamIds?: string[];
  departmentId?: string;

  tokenHash: string;
  expiresAt: Timestamp;

  status:
    | 'draft'
    | 'sent'
    | 'accepted'
    | 'expired'
    | 'revoked'
    | 'failed';

  channels: {
    email: DeliveryState;
    sms: DeliveryState;
  };

  invitedBy: string;
  acceptedBy?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 18. Important Security Improvement: Stop Treating Temporary Passwords as a Primary Invitation Mechanism

The extracted system generates temporary passwords and delivers them via email/SMS.

That works operationally, but the mature design should prioritize:

```text
Invitation Link
      ↓
Identity Verification
      ↓
Set Password / OAuth / SSO
      ↓
MFA
      ↓
Complete Onboarding
```

SMS/email should deliver a secure invitation URL, not preferably a reusable credential.

Temporary passwords can remain as a controlled fallback for specific workflows.

---

# 19. Onboarding 2.0

The onboarding architecture should evolve from a hard-coded wizard to an **Onboarding Journey Engine**.

Instead of:

```text
Step 1
Step 2
Step 3
Step 4
Step 5
```

use:

```text
Journey
 ├── Step
 ├── Condition
 ├── Task
 ├── Approval
 ├── Automation
 └── Completion Rule
```

---

# 20. Onboarding Journey Entity

```typescript
interface OnboardingJourney {
  id: string;

  organizationId: string;

  name: string;
  description?: string;

  audience:
    | 'founder'
    | 'employee'
    | 'manager'
    | 'finance'
    | 'sales'
    | 'contractor'
    | 'custom';

  trigger:
    | 'signup'
    | 'invitation'
    | 'role_assigned'
    | 'workspace_added'
    | 'manual';

  steps: OnboardingStep[];

  automationIds: string[];

  status: 'draft' | 'published' | 'archived';

  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 21. Adaptive Onboarding

The journey should change based on context.

Example:

```text
Founder
→ Organization setup
→ Branding
→ Workspace
→ Billing
→ Team
→ Roles
→ CRM configuration

Sales User
→ Profile
→ Workspace
→ Team
→ Role
→ CRM orientation
→ Assigned pipeline

Finance User
→ Profile
→ Workspace
→ Finance access
→ Approval policy
→ Finance onboarding

Platform Admin
→ Profile
→ MFA
→ Security policy
→ Access review
```

This is much more powerful than one universal wizard.

---

# 22. Onboarding Progress Model

Every user receives:

```typescript
interface OnboardingInstance {
  id: string;

  journeyId: string;
  journeyVersion: number;

  personId: string;
  organizationId: string;

  status:
    | 'not_started'
    | 'in_progress'
    | 'blocked'
    | 'waiting_approval'
    | 'completed'
    | 'abandoned';

  currentStepId?: string;

  completionPercent: number;

  startedAt?: Timestamp;
  completedAt?: Timestamp;

  lastActivityAt?: Timestamp;

  metadata: Record<string, unknown>;
}
```

This enables onboarding analytics.

---

# 23. Onboarding Analytics

Track:

```text
Invitation → Acceptance
Acceptance → Profile completion
Profile → First login
First login → First meaningful action
First meaningful action → Activation
```

Core metrics:

* invite acceptance rate
* median onboarding time
* drop-off by step
* incomplete profiles
* approval turnaround
* time to first CRM activity
* time to first deal/contact creation
* first-week activation
* first-30-day adoption

---

# 24. User Management Hub 2.0

The current `/admin/users` table should become a full **People & Access Center**.

Recommended navigation:

```text
People & Access
│
├── Overview
├── People
├── Invitations
├── Requests
├── Teams
├── Departments
├── Roles
├── Permissions
├── Policies
├── Access Reviews
├── Activity
├── Analytics
├── AI Insights
└── Settings
```

---

# 25. People Directory

The main user registry should support:

### Table

```text
Name
Status
Role
Department
Team
Workspace
Last Active
Onboarding
Security
Owner
Actions
```

Filters:

```text
Status
Role
Workspace
Department
Team
Activity
Onboarding status
Security risk
Last active
Created date
```

Search:

```text
Name
Email
Phone
Employee ID
CRM ownership
Workspace
Team
```

---

# 26. User Profile / Identity Record

Clicking a user should open a comprehensive profile.

Recommended tabs:

```text
Overview
Access
Workspaces
Roles
CRM
Activity
Security
Onboarding
Notifications
AI
Audit
```

---

# 27. User Overview Screen

The profile header should show:

```text
Avatar
Name
Job title
Status
Department
Team
Organization
Primary workspace
Last active
Onboarding status
Security status
```

Primary actions:

```text
Edit
Assign Workspace
Manage Roles
Suspend
Reset Access
Start Access Review
Offboard
```

---

# 28. User Access Screen

Display the effective access tree:

```text
Organization Access
│
├── Workspace A
│   ├── Sales Manager
│   ├── CRM
│   ├── Deals
│   └── Meetings
│
└── Workspace B
    ├── Viewer
    └── Reports
```

Crucially, distinguish:

```text
Assigned Role
Inherited Permission
Direct Grant
Policy Constraint
Explicit Deny
```

This dramatically improves explainability.

---

# 29. "Why Can This User Do This?" Experience

This should be a first-class authorization UX.

Example:

```text
Can John edit Deal #428?

✓ Allowed

Reason:
Sales Manager role
+ Workspace Sales permissions
+ Team scope: Admissions
+ Deal belongs to Admissions team
```

Or:

```text
✕ Denied

Reason:
User has deals.edit
but resource belongs to another team.
```

This is one of the highest-value additions to an enterprise authorization platform.

---

# 30. Roles Studio

The current role model should evolve into a dedicated **Roles Studio**.

Workspace:

```text
Role Library
Role Templates
Custom Roles
Permission Explorer
Role Simulator
Role Comparison
Version History
Usage
```

---

# 31. Role Builder

Rather than showing a giant boolean matrix alone, use progressive disclosure.

```text
Role Name
Description
Applies To
↓

Core Access
CRM
Finance
Studios
Management
↓

Detailed Permissions
Deals
Contacts
Invoices
Forms
Meetings
...

↓

Scope
All workspace
Team
Department
Own records

↓

Restrictions
Approval limits
Record ownership
Time restrictions
```

---

# 32. Role Simulator

Provide:

```text
Test User:
Sarah

Test Resource:
Deal #123

Test Action:
Edit
```

Output:

```text
AUTHORIZED

Matched role:
Sales Executive

Permission:
deals.edit

Scope:
Team = Admissions

Resource:
Deal belongs to Admissions

Policy:
No restriction
```

This should be available to administrators before publishing role changes.

---

# 33. Role Versioning

Roles should be versioned.

```text
Sales Manager v1
Sales Manager v2
Sales Manager v3
```

Changes should create:

```text
RoleChangeSet
```

rather than silently mutating history.

This enables:

* rollback
* audit
* approval
* change comparison
* impact analysis

---

# 34. Permission Impact Analysis

Before publishing a change:

> “This change will affect 27 users across 6 workspaces.”

The system should show:

```text
Users affected
Workspaces affected
Resources affected
New capabilities
Removed capabilities
Potential security implications
```

This is essential for enterprise-grade governance.

---

# 35. Access Reviews

Introduce periodic access certification.

Example:

```text
Quarterly Access Review

Finance users:
24

Users with privileged finance access:
7

Users inactive > 60 days:
3

Permissions with no recent usage:
14

Pending manager certifications:
5
```

Administrators can:

```text
Keep
Reduce Access
Suspend
Remove Role
Escalate
```

---

# 36. Just-In-Time Access

For sensitive operations:

```text
Request access
     ↓
Manager approval
     ↓
Security approval
     ↓
Access granted
     ↓
Expiry
     ↓
Automatic removal
```

Example:

> Finance export access for 2 hours.

This is a significant maturity step beyond traditional RBAC.

---

# 37. Separation of Duties

Support policies such as:

```text
A user who creates an invoice cannot approve that same invoice.
```

or:

```text
A user who creates a role cannot approve the role.
```

This should operate at the policy layer.

---

# 38. Organization Governance

Organization administrators need a dedicated Governance Center.

```text
Governance
├── Access Policies
├── Approval Policies
├── Security Policies
├── Session Policies
├── Password Policies
├── MFA Policies
├── Invitation Policies
├── Data Access Policies
└── Audit Policies
```

---

# 39. CRM-Aware Identity Model

This is one of the most important enhancements requested.

Users should become first-class operational participants in SmartSapp CRM.

A person can be:

```text
Owner
Assignee
Reviewer
Approver
Collaborator
Watcher
Follower
Manager
Source
Actor
```

---

# 40. CRM Ownership Model

Example:

```typescript
interface OwnershipAssignment {
  id: string;

  organizationId: string;
  workspaceId: string;

  personId: string;

  resourceType:
    | 'lead'
    | 'contact'
    | 'account'
    | 'deal'
    | 'meeting'
    | 'task'
    | 'campaign';

  resourceId: string;

  role:
    | 'owner'
    | 'assignee'
    | 'reviewer'
    | 'approver'
    | 'collaborator';

  startsAt: Timestamp;
  endsAt?: Timestamp;
}
```

This lets CRM modules reference identity consistently.

---

# 41. User Activity Graph

Instead of relying only on a traditional activity timeline, introduce an event graph:

```text
User
 ↓
Viewed Lead
 ↓
Opened Contact
 ↓
Edited Deal
 ↓
Created Task
 ↓
Held Meeting
 ↓
Sent Message
 ↓
Updated Pipeline
 ↓
Won Deal
```

This becomes the foundation for analytics and AI.

---

# 42. Event Taxonomy

Every meaningful action should emit a normalized event.

### Identity events

```text
identity.account.created
identity.account.verified
identity.account.suspended
identity.account.reactivated
identity.account.deleted
identity.login.succeeded
identity.login.failed
identity.mfa.enabled
identity.mfa.failed
```

### Membership events

```text
membership.invited
membership.accepted
membership.approved
membership.rejected
membership.suspended
membership.revoked
membership.workspace_assigned
membership.workspace_removed
```

### Authorization events

```text
role.created
role.updated
role.archived
role.assigned
role.removed
permission.changed
policy.created
policy.updated
access.review.started
access.review.completed
```

### Onboarding events

```text
onboarding.started
onboarding.step_viewed
onboarding.step_completed
onboarding.step_skipped
onboarding.blocked
onboarding.completed
```

### CRM activity events

```text
crm.lead.viewed
crm.lead.created
crm.contact.updated
crm.deal.created
crm.deal.updated
crm.deal.won
crm.task.completed
crm.meeting.completed
```

---

# 43. Canonical Event Envelope

Use one standard shape:

```typescript
interface PlatformEvent {
  id: string;

  type: string;
  version: number;

  actor: {
    personId?: string;
    accountId?: string;
    type: 'user' | 'system' | 'ai' | 'backoffice';
  };

  organizationId?: string;
  workspaceId?: string;

  resource?: {
    type: string;
    id: string;
  };

  correlationId: string;
  causationId?: string;

  timestamp: Timestamp;

  source:
    | 'web'
    | 'api'
    | 'automation'
    | 'system'
    | 'backoffice'
    | 'ai';

  metadata?: Record<string, unknown>;
}
```

---

# 44. Analytics Architecture

Do not build analytics from raw user documents.

Use:

```text
Application Events
       ↓
Event Processor
       ↓
Analytics Events
       ↓
Aggregations
       ↓
User / Team / Workspace Metrics
```

Recommended analytical dimensions:

```text
Person
Team
Department
Workspace
Organization
Feature
Resource
Action
Time
```

---

# 45. User Analytics Dashboard

### Executive KPIs

```text
Total Users
Active Users
Activation Rate
Onboarding Completion
30-Day Retention
Dormant Users
Security Risk
Access Changes
```

### Engagement

```text
DAU
WAU
MAU
Sessions
Session duration
Features used
Actions/user
Last active
```

### Adoption

```text
CRM adoption
Finance adoption
Forms adoption
Meetings adoption
Automation adoption
Studio adoption
```

---

# 46. Team Analytics

Show:

```text
Team size
Active users
Activity per user
Tasks completed
Deals handled
Meetings held
Lead response
Conversion
Feature adoption
```

This makes user management operationally valuable to managers.

---

# 47. User Health Score

Create an explainable user health score:

```text
Activation
+
Engagement
+
Feature adoption
+
Workflow completion
+
Recent activity
-
Security risk
-
Dormancy
```

For example:

```text
User Health: 84 / 100

Activation: 92
Engagement: 81
Adoption: 78
CRM utilization: 91
Security: 96
```

Do not make this a black-box score. Every component should be explainable.

---

# 48. AI Platform

The AI layer should be much broader than the current brand-seeding assistant.

Recommended architecture:

```text
Identity Data
Membership Data
Authorization Data
Activity Data
CRM Data
Onboarding Data
Analytics
        ↓
Context Layer
        ↓
AI Orchestration
        ↓
Models
        ↓
Recommendations / Actions
```

---

# 49. AI User Copilot

Administrators can ask:

> “Who joined the organization this month?”

> “Which users have not completed onboarding?”

> “Show people who have finance access but haven't used Finance in 90 days.”

> “Which users should probably have less access?”

> “Why can't Michael edit this deal?”

> “Which users are most active in the Admissions workspace?”

This should operate through controlled tools, not unrestricted database access.

---

# 50. AI Access Advisor

AI reviews:

```text
Role assignments
Actual usage
Peer roles
Team structure
Workspace activity
Resource access
Security policies
```

and produces:

```text
Recommendation
Confidence
Evidence
Impact
Required approval
```

Example:

```text
Recommendation:

Remove Finance.Invoice.Delete from 4 users.

Reason:
No matching activity in 120 days.
Comparable Finance Officers do not have this privilege.

Risk reduction:
Medium

Requires approval:
Yes
```

---

# 51. AI Role Recommendation

When creating a role:

> “Create a role for a School Admissions Officer.”

AI can propose:

```text
Registrar & Admissions Officer

CRM:
✓ Leads
✓ Contacts
✓ Applications
✓ Tasks
✓ Meetings

Finance:
View-only

Studios:
Forms
Messaging

Management:
Activities
```

But AI must **never directly grant high-risk privileges without policy/approval gates**.

---

# 52. AI Onboarding Copilot

During onboarding:

```text
User:
“I work in admissions.”

AI:
“Based on your role, you will primarily use:
Leads
Applications
Meetings
Tasks
Messaging

Would you like a guided setup?”
```

This produces contextual onboarding.

---

# 53. AI Anomaly Detection

Detect:

```text
Impossible travel
Unusual login behavior
Sudden permission escalation
Abnormal export behavior
Unusually high record access
Mass deletion
Repeated failed authentication
Unexpected workspace switching
```

AI can prioritize anomalies, while deterministic security controls remain authoritative.

---

# 54. AI Governance Rule

AI should be:

```text
Advisor
Explainer
Detector
Recommender
Assistant
```

not:

```text
Uncontrolled Authority
```

High-risk operations should follow:

```text
AI recommendation
      ↓
Human confirmation
      ↓
Authorization policy
      ↓
Approval if required
      ↓
Execution
      ↓
Audit
```

---

# 55. AI Context Security

The AI layer must inherit the exact same user authorization boundaries.

A finance administrator asking the AI:

> “Show me company users”

must not receive restricted backoffice or cross-tenant information.

AI retrieval should always be:

```text
AI request
 ↓
Actor identity
 ↓
Authorization engine
 ↓
Scoped retrieval
 ↓
Model context
```

Never:

```text
AI request
 ↓
Raw database query
```

---

# 56. Security Architecture 2.0

## 56.1 Zero-trust boundary

Every request must establish:

```text
Who?
 ↓
Which organization?
 ↓
Which workspace?
 ↓
What resource?
 ↓
What action?
 ↓
Under what policy?
```

Client-side permission checks remain UX aids only.

Server authorization remains authoritative.

---

# 57. MFA

MFA should become policy driven.

Examples:

```text
All administrators → required
Finance administrators → required
Backoffice → required
Support impersonation → required
Standard CRM users → optional
```

Support:

* TOTP
* passkeys/WebAuthn where practical
* recovery codes
* enterprise identity provider MFA

SMS should not be the preferred strong factor.

---

# 58. Enterprise Identity Roadmap

The architecture should be SSO-ready:

```text
Google Workspace
Microsoft Entra ID
Okta
OIDC
SAML
```

Later:

```text
SCIM
```

for automated:

```text
Create user
Update user
Suspend user
Remove user
Group membership
```

---

# 59. Session Management

Introduce explicit sessions:

```typescript
interface UserSession {
  id: string;
  accountId: string;
  organizationId?: string;
  workspaceId?: string;

  device?: {
    type: string;
    browser?: string;
    os?: string;
  };

  ipAddressHash?: string;

  createdAt: Timestamp;
  lastSeenAt: Timestamp;

  expiresAt: Timestamp;

  revokedAt?: Timestamp;
  revokeReason?: string;
}
```

The UI should provide:

```text
Active Sessions
Recent Sessions
Sign out all devices
```

---

# 60. Administrative Session Controls

For privileged users:

```text
Idle timeout
Absolute session timeout
Re-authentication for sensitive actions
MFA step-up
```

For example:

```text
View finance
→ normal session

Export finance data
→ re-authentication

Change role
→ re-authentication + approval
```

---

# 61. Impersonation 2.0

The existing support sandbox is good.

Mature it into:

```text
Impersonation Request
       ↓
Reason required
       ↓
Scope required
       ↓
Time limit
       ↓
Approval if sensitive
       ↓
Sandbox session
       ↓
Full audit trail
       ↓
Automatic expiration
```

Impersonation should never silently replace actor identity.

Audit should record:

```text
actor = support engineer
subject = target user
effective tenant = target organization
```

---

# 62. Organization Audit Log

Create:

```text
organization_audit_logs
```

for:

* role changes
* member changes
* invitation
* access changes
* workspace changes
* security changes
* policy changes
* onboarding approvals
* administrative resets

Platform audit and organization audit should remain separate.

---

# 63. Audit Event Quality

Every sensitive mutation should answer:

```text
Who?
What?
When?
Where?
Why?
Before?
After?
Which policy?
Which approval?
Which request?
Which IP/session?
```

Example:

```json
{
  "actorId": "u_123",
  "action": "role.assignment.updated",
  "subjectId": "u_456",
  "organizationId": "org_1",
  "workspaceId": "ws_7",
  "before": {...},
  "after": {...},
  "reason": "Promotion to Sales Manager",
  "approvalId": "apr_123"
}
```

---

# 64. Firestore Architecture

The current user document is too overloaded.

Recommended high-level structure:

```text
organizations/{orgId}

organizations/{orgId}/memberships/{membershipId}

organizations/{orgId}/departments/{departmentId}

organizations/{orgId}/teams/{teamId}

organizations/{orgId}/workspaces/{workspaceId}

organizations/{orgId}/roles/{roleId}

organizations/{orgId}/policies/{policyId}

organizations/{orgId}/accessReviews/{reviewId}

organizations/{orgId}/invitations/{invitationId}

organizations/{orgId}/auditLogs/{auditId}

organizations/{orgId}/onboardingJourneys/{journeyId}

organizations/{orgId}/onboardingInstances/{instanceId}
```

Identity:

```text
accounts/{accountId}
people/{personId}
sessions/{sessionId}
```

Derived:

```text
authorizationSnapshots/{snapshotId}
```

Analytics/event data should not all live as high-cardinality Firestore operational documents.

---

# 65. Search Architecture

The People Directory should not eventually depend entirely on Firestore client filtering.

At scale, create an indexed search projection.

Searchable:

```text
name
email
phone
job title
department
team
workspace
status
employee code
CRM owner
```

This can be powered by the search infrastructure already appropriate for SmartSapp's wider platform.

---

# 66. Transaction Boundaries

Critical operations should be transactional:

### Membership approval

```text
Membership
Account status
Access assignment
Audit event
```

### Role modification

```text
Role version
Access version
Affected membership snapshots
Audit event
Approval state
```

### Offboarding

```text
Membership revoked
Workspace access revoked
CRM assignments transferred
Sessions revoked
Automation ownership handled
Audit event
```

---

# 67. Offboarding Must Become CRM-Aware

This is currently underdeveloped conceptually.

When a user leaves:

```text
What happens to their:
Leads?
Deals?
Tasks?
Meetings?
Automations?
Campaigns?
Forms?
Surveys?
Approvals?
Reports?
```

The platform needs a **Work Reassignment Engine**.

Example:

```text
Offboard John
        ↓
24 Leads
8 Deals
14 Tasks
7 Meetings
3 Automations
2 Approval Chains
        ↓
Transfer to:
Sarah
```

The system should block completion until required assignments are resolved.

---

# 68. User Deletion Policy

Do not physically erase identity-related records casually.

Use:

```text
Active
Suspended
Revoked
Anonymized
Deleted
```

CRM activity should generally preserve historical actor references.

For example:

```text
Created by: Former User #483
```

rather than losing the historical attribution.

---

# 69. Ownership Transfer Engine

Introduce a reusable service:

```typescript
transferOwnership({
  actor,
  sourceUser,
  targetUser,
  organizationId,
  resources
})
```

Supported entities:

```text
Leads
Contacts
Accounts
Deals
Tasks
Meetings
Automations
Campaigns
Forms
Surveys
Reports
Approvals
```

This becomes a shared SmartSapp capability.

---

# 70. Automation Integration

User lifecycle events should trigger SmartSapp Automations.

Examples:

```text
When user joins
→ send onboarding email

When user becomes active
→ assign onboarding checklist

When user is inactive 30 days
→ notify manager

When user's role changes
→ notify user

When user is offboarded
→ transfer CRM ownership

When access review is due
→ create approval task
```

This connects Identity directly to the broader SmartSapp automation engine.

---

# 71. Notification Architecture

Notification delivery should become event-driven.

Instead of:

```text
Server Action
 → Email
 → SMS
```

prefer:

```text
Business Event
      ↓
Notification Orchestrator
      ↓
Preference Resolver
      ↓
Template Resolver
      ↓
Channel Router
      ↓
Email / SMS / Push / In-App
```

This prevents application code from being tightly coupled to providers.

---

# 72. Delivery Preferences

Users should have:

```text
Security notifications
System notifications
CRM notifications
Task notifications
Meeting notifications
Marketing notifications
```

with:

```text
email
SMS
push
in-app
```

and organization-level policy overrides.

---

# 73. Template Governance

Templates should support:

```text
system template
organization template
workspace template
```

and versioning.

Example:

```text
user_invitation v4
password_reset v2
access_approved v3
onboarding_reminder v5
```

---

# 74. Backoffice Integration

Backoffice should remain separate from organization identity, but use the same underlying authorization primitives where practical.

Architecture:

```text
Platform Identity
      ↓
Backoffice Membership
      ↓
Backoffice Role
      ↓
Backoffice Policy
      ↓
Platform Scope
```

Never treat:

```text
organization admin
```

as equivalent to:

```text
platform admin
```

---

# 75. Platform vs Organization Authorization

A hard boundary should exist:

```text
PLATFORM

Organizations
Platform configuration
Infrastructure
Security
Migrations
Feature flags
Provider configuration


ORGANIZATION

People
Workspaces
Roles
CRM
Finance
Studios
Reports
Automations
```

A customer administrator must never gain platform authority through organization roles.

---

# 76. UI Information Architecture

Recommended SmartSapp navigation:

```text
Settings
│
├── Organization
│   ├── Overview
│   ├── Branding
│   ├── Departments
│   ├── Teams
│   └── Workspaces
│
├── People & Access
│   ├── Overview
│   ├── People
│   ├── Invitations
│   ├── Requests
│   ├── Roles
│   ├── Permissions
│   ├── Policies
│   ├── Access Reviews
│   └── Audit
│
├── Onboarding
│   ├── Journeys
│   ├── Templates
│   └── Analytics
│
├── Analytics
│   ├── Adoption
│   ├── Engagement
│   ├── Teams
│   ├── Access
│   └── Security
│
└── AI
    ├── Copilot
    ├── Access Advisor
    ├── User Insights
    └── Recommendations
```

---

# 77. People Dashboard

The landing page should answer:

> “What is happening with our people and access?”

Top cards:

```text
342 People
318 Active
14 Pending
6 Suspended
4 Invitations
9 Access Reviews
```

Then:

```text
Onboarding funnel
Active users trend
Dormant users
Access risk
Team activity
Recent administrative events
```

---

# 78. User List UX

Avoid a spreadsheet-like overwhelming interface.

Use:

```text
Search
↓
Smart filters
↓
Saved views
↓
Dense but readable table
```

Saved views:

```text
New Employees
Finance Users
Inactive 30+ Days
Pending Approval
Admins
High-Risk Access
```

---

# 79. Progressive Disclosure

Do not put every permission on screen initially.

User sees:

```text
Sales Manager
12 permissions
2 workspaces
3 teams
```

Expand:

```text
CRM
  Deals
    View
    Create
    Edit
```

This keeps the system approachable despite enterprise-level complexity.

---

# 80. Onboarding UX

The experience should feel like:

```text
Welcome
 ↓
Why you're here
 ↓
What you need to complete
 ↓
Progress
 ↓
Contextual setup
 ↓
Approval
 ↓
You're ready
```

Avoid exposing:

```text
permissionsSchema
workspacePermissions
RBAC hierarchy
```

to normal users.

The enterprise complexity belongs in the administrator experience.

---

# 81. Admin Experience: "Simple by Default, Advanced on Demand"

The core principle should be:

```text
Common task
→ 1–3 interactions

Advanced governance
→ deeper tooling
```

For example:

**Simple**

> Assign Sales Manager

**Advanced**

> Customize role permissions

**Expert**

> Configure conditional access policy

This is how SmartSapp can remain easier than Figma/Photoshop-style complexity while still becoming enterprise-grade.

---

# 82. Responsive UX

Desktop:

```text
Sidebar
Directory
Details panel
```

Tablet:

```text
Sidebar collapsed
Master/detail
```

Mobile:

```text
People list
 ↓
User profile
 ↓
Sections as cards
```

Avoid huge permission matrices on mobile. Convert them into drill-down sections.

---

# 83. Accessibility

Keep the existing 44px touch target standard.

Additionally require:

* keyboard-first navigation
* focus preservation in dialogs
* semantic tables
* accessible status indicators
* no color-only authorization signals
* readable contrast
* screen-reader labels
* reduced-motion support
* confirmation states
* explicit error descriptions

---

# 84. API / Server Action Architecture

Create domain-oriented services instead of accumulating server actions.

Example:

```text
identity/
  createAccount
  suspendAccount
  revokeSessions

membership/
  invite
  approve
  reject
  suspend
  revoke

access/
  assignRole
  revokeRole
  evaluate
  compileSnapshot

workspace/
  addMember
  removeMember

onboarding/
  start
  advance
  complete

governance/
  createApproval
  approve
  reject

analytics/
  getUserMetrics
  getTeamMetrics

ai/
  recommendRole
  explainAccess
  summarizeUser
```

---

# 85. Authorization Middleware

Every sensitive server operation should follow:

```typescript
const actor = await authenticate();

const decision = await authorize({
  actor,
  resource,
  action,
  organizationId,
  workspaceId
});

if (!decision.allowed) {
  throw new AuthorizationError(decision.reason);
}
```

Avoid scattered logic such as:

```typescript
if (user.roles?.includes(...))
```

throughout the application.

---

# 86. Permission Engine API

The permission engine should become a proper service:

```typescript
authorize()
can()
explain()
getEffectiveAccess()
compileSnapshot()
invalidateSnapshot()
compareRoles()
simulate()
```

Important distinction:

```text
can()
```

for simple UX checks,

versus:

```text
authorize()
```

for security enforcement.

---

# 87. Firestore Rule Strategy

Firestore rules should enforce coarse-grained boundaries:

```text
Authentication
Organization membership
Workspace membership
Basic resource scope
```

Complex authorization should not become an enormous Firestore rule programming exercise.

Use trusted server execution for complex operations:

```text
Client
 ↓
API / Server Action
 ↓
Authorization Engine
 ↓
Admin SDK
```

---

# 88. Data Consistency Model

Introduce:

```text
Source of truth
Derived projection
Cache
Analytics projection
```

Example:

```text
Role
 ↓
Role Assignment
 ↓
Authorization Snapshot
 ↓
Client Cache
```

Never mutate all of these independently without an event/version mechanism.

---

# 89. Idempotency

Sensitive operations need idempotency keys.

Example:

```typescript
inviteUser({
  idempotencyKey
})
```

This prevents double invitations when:

* the client retries
* the browser refreshes
* the network fails
* a request is duplicated

Same for:

```text
role assignment
workspace addition
offboarding
ownership transfer
approval execution
notification dispatch
```

---

# 90. Distributed Side Effects

Avoid transactionally performing external communication inside the core business transaction.

Prefer:

```text
Transaction
 ↓
Commit business state
 ↓
Outbox/Event
 ↓
Async dispatcher
 ↓
Email/SMS
```

This is more reliable than coupling:

```text
Firestore transaction
+
Resend
+
mNotify
```

---

# 91. Outbox Pattern

Introduce an internal event/outbox collection or equivalent event infrastructure:

```text
outbox_events
```

Example:

```json
{
  "eventType": "membership.invited",
  "status": "pending",
  "attempts": 0,
  "createdAt": "..."
}
```

Worker:

```text
pending
 ↓
processing
 ↓
succeeded
```

or:

```text
failed
 ↓
retry
 ↓
dead-letter
```

---

# 92. Delivery Observability

The notification layer should track:

```text
queued
sent
delivered
opened
failed
provider throttled
provider rejected
```

Then the user management screen can show:

> Invitation sent via SMS — delivered.

rather than simply:

> Success.

---

# 93. Security Risk Engine

Introduce a deterministic risk score.

Inputs:

```text
Privileged role
MFA enabled
Inactive user
Recent access escalation
Unusual IP
Large data access
Failed login count
Impersonation
```

Output:

```text
Low
Medium
High
Critical
```

AI can enhance prioritization but should not replace security controls.

---

# 94. User Risk Profile

User profile:

```text
Security
Low Risk

MFA
Enabled

Last password change
23 days ago

Privileged access
2 roles

Sensitive permissions
Finance exports
User administration

Recent anomaly
None
```

---

# 95. Access Intelligence

Create a dedicated analytics concept:

```text
Permission Usage
```

Because:

> having a permission

is not the same as:

> needing the permission.

Track:

```text
Granted
Used
Last used
Frequency
Peer usage
Risk
```

This becomes powerful for AI recommendations.

---

# 96. Least Privilege Advisor

Example:

```text
User: Michael

Granted:
47 permissions

Used:
23 permissions

Unused for 90 days:
24

Recommended action:
Remove 11 low-risk permissions
Review 7 sensitive permissions
Keep 29 permissions
```

This is a flagship enterprise capability.

---

# 97. Role Effectiveness Analytics

Measure:

```text
Role utilization
Permission utilization
Users/role
Role overlap
Role duplication
Role complexity
Access risk
```

Find:

> “Sales Executive and Admissions Officer have 83% identical permissions.”

The administrator could merge or simplify them.

---

# 98. AI Role Optimization

AI can identify:

```text
duplicate roles
unused roles
overprivileged roles
underprivileged users
permission conflicts
role sprawl
```

and recommend:

```text
consolidate
remove
rename
split
inherit
```

---

# 99. Organization AI Administrative Copilot

A dedicated chat surface:

```text
Ask SmartSapp

“How many inactive users do we have?”

“Which users have Finance Admin access?”

“Show me people who haven't completed onboarding.”

“Transfer John's deals to Sarah.”

“Explain why David cannot approve this invoice.”
```

Mutations require confirmation:

```text
AI proposes action
 ↓
Preview
 ↓
Impact
 ↓
Confirm
 ↓
Authorization
 ↓
Approval if needed
 ↓
Execute
```

---

# 100. AI Action Safety

Never allow natural language to bypass authorization.

Bad:

```text
User says:
“Give me administrator access.”
```

AI:

```text
Done.
```

Correct:

```text
AI identifies requested capability
 ↓
Authorization check
 ↓
Current-user authority check
 ↓
Approval policy
 ↓
Request generated
```

---

# 101. Billing / Entitlements Integration

Permissions are not the same as product entitlements.

A user may have:

```text
Permission:
reports.view = true
```

but the organization may not have:

```text
Advanced Reporting entitlement
```

Therefore:

```text
Authorization =
Identity
+
Permission
+
Entitlement
+
Policy
+
Scope
```

This distinction will be critical as SmartSapp pricing becomes more sophisticated.

---

# 102. Example Authorization Decision

```text
User: Sarah

Action: Create Survey

Identity:
✓ Active

Organization:
✓ Active

Workspace:
✓ Member

Role:
✓ Survey Manager

Permission:
✓ surveys.create

Entitlement:
✓ Surveys Professional

Policy:
✓ Allowed

Scope:
✓ Current workspace

RESULT:
AUTHORIZED
```

---

# 103. Feature Entitlements

Examples:

```text
crm.basic
crm.advanced
finance
survey.pro
ai.copilot
advanced.analytics
automation
white.label
enterprise.sso
```

These should live outside the role model.

---

# 104. Migration from the Existing Architecture

Do not rewrite everything in one release.

Use an incremental migration.

### Phase 0 — Stabilize Current System

First:

* inventory all permission checks
* inventory all user mutations
* identify duplicate authorization logic
* identify client-only checks
* identify direct `UserProfile` mutations
* identify legacy permissions
* establish canonical event vocabulary

---

# 105. Phase 1 — Identity & Membership Foundation

Introduce:

```text
Account
Person
OrganizationMembership
WorkspaceMembership
```

Keep:

```text
users/{uid}
```

temporarily as a compatibility projection.

---

# 106. Phase 2 — Authorization 2.0

Implement:

```text
Roles
Role Assignments
Permissions
Policies
Scopes
Authorization Engine
Permission Snapshots
Access Versions
```

Keep the existing permission schema as a compatibility adapter.

---

# 107. Phase 3 — People & Access Hub

Build:

```text
People
Invitations
Requests
Teams
Departments
User Profile
Workspace Access
Role Management
Access Explainability
```

At this point `/admin/users` becomes a true Identity Hub.

---

# 108. Phase 4 — Onboarding Journey Engine

Replace the hard-coded wizard with:

```text
Journey
Step
Condition
Approval
Automation
Completion
```

Migrate existing founder/invitee flows into journey definitions.

---

# 109. Phase 5 — Governance

Implement:

```text
Audit
Access Reviews
Role Versioning
Role Approval
Temporary Access
Separation of Duties
Session Policies
MFA Policies
```

This is the major enterprise governance milestone.

---

# 110. Phase 6 — Analytics

Introduce event collection and analytics:

```text
Identity
Onboarding
Access
Engagement
Adoption
Team
Security
```

Launch:

```text
People Analytics
Access Analytics
Onboarding Analytics
```

---

# 111. Phase 7 — CRM Intelligence

Connect Identity to:

```text
Contacts
Leads
Deals
Tasks
Meetings
Campaigns
Automations
```

Implement:

```text
Ownership
Assignment
Attribution
Work transfer
User productivity
```

---

# 112. Phase 8 — AI

Launch in this order:

### AI 1

User Copilot

### AI 2

Access Explanation

### AI 3

Role Recommendation

### AI 4

Least Privilege Advisor

### AI 5

Onboarding Copilot

### AI 6

Risk Detection

### AI 7

Administrative Action Copilot

This order creates value while controlling operational risk.

---

# 113. Phase 9 — Enterprise Identity

Add:

```text
MFA
Passkeys
SAML
OIDC
SCIM
Directory Sync
Enterprise Provisioning
```

---

# 114. Phase 10 — Advanced Workforce Intelligence

Introduce:

```text
Team Intelligence
Role Optimization
User Health
Capacity
Workload
Activity Analytics
AI Organizational Insights
```

This turns Identity into an actual SmartSapp intelligence platform.

---

# 115. Recommended Target Repository Structure

A cleaner codebase could eventually resemble:

```text
src/
├── domains/
│   ├── identity/
│   ├── membership/
│   ├── organization/
│   ├── workspace/
│   ├── authorization/
│   ├── onboarding/
│   ├── governance/
│   ├── activity/
│   ├── analytics/
│   ├── ai/
│   └── notifications/
│
├── platform/
│   ├── auth/
│   ├── events/
│   ├── policies/
│   ├── search/
│   ├── audit/
│   └── tenancy/
│
└── app/
    ├── admin/
    ├── onboarding/
    └── backoffice/
```

---

# 116. Recommended UI Route Architecture

```text
/admin
  /people
    /overview
    /users/[id]
    /invitations
    /requests

  /organization
    /departments
    /teams
    /structure
    /workspaces

  /access
    /roles
    /roles/[id]
    /permissions
    /policies
    /reviews

  /onboarding
    /journeys
    /journeys/[id]
    /analytics

  /analytics
    /users
    /teams
    /adoption
    /security

  /ai
    /copilot
    /insights
    /access-advisor

  /governance
    /audit
    /approvals
    /sessions
```

---

# 117. Recommended Core Services

The target platform should have explicit services such as:

```text
IdentityService
MembershipService
WorkspaceService
RoleService
AuthorizationService
PolicyService
PermissionCompiler
OnboardingService
InvitationService
AccessReviewService
AuditService
ActivityService
AnalyticsService
OwnershipTransferService
NotificationService
AIIdentityService
```

This is considerably healthier than an ever-growing collection of action functions.

---

# 118. Critical Review of Specific Existing Components

## `TenantContext.tsx`

### Keep

* active tenant state
* active workspace
* branding
* route synchronization

### Change

Do not make the context itself the authority for access.

Instead:

```text
TenantContext
→ presentation state

AuthorizationService
→ security authority
```

Also move toward URL-derived context rather than localStorage-first context where possible.

---

## `permissions-engine.ts`

### Keep

* normalization
* hierarchical schema
* compatibility flattening

### Upgrade

Add:

```text
deny
scope
conditions
resource-level checks
explainability
versioning
simulation
snapshot compilation
```

---

## `UserProfile`

### Keep

A minimal compatibility projection.

### Remove from canonical source

* complete hydrated role trees
* complex workspace permission graphs
* authorization state that can drift

---

## `InviteUserModal`

### Keep

* multi-channel choice
* organization context
* role selection

### Upgrade

Shift from:

```text
generate password → deliver credentials
```

to:

```text
create invitation
→ secure activation link
→ identity verification
→ onboarding
→ MFA if required
```

---

## `completeOrganizationOnboardingAction`

The transaction idea is correct.

However, separate:

```text
domain state mutation
```

from:

```text
notifications
analytics
AI
```

using events/outbox.

---

# 119. Current Architecture: Major Risks to Address

The most important technical risks I see from the extracted implementation are:

### Risk 1 — User document overloading

Too many responsibilities.

### Risk 2 — Permission snapshot drift

Hydrated permissions can become stale.

### Risk 3 — Additive-only access

No explicit deny/scope/policy layer.

### Risk 4 — Hard-coded onboarding

Will become difficult to customize by industry.

### Risk 5 — Tight coupling to notification providers

External communication should be event-driven.

### Risk 6 — Temporary-password-heavy invitations

Prefer secure activation.

### Risk 7 — No explicit ownership-transfer model

Critical for CRM offboarding.

### Risk 8 — Analytics not yet domain-native

Activity should become event infrastructure.

### Risk 9 — Limited access governance

Need access reviews, versioning, temporary access and SoD.

### Risk 10 — AI not integrated with authorization intelligence

AI is currently a capability rather than a governed intelligence layer.

---

# 120. Target SmartSapp Identity Platform

The finished platform should ultimately look like this:

```text
                    SMARTSAPP IDENTITY PLATFORM
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
    Identity              Organization            Workspace
       │                      │                      │
    Account               Membership             Membership
    Person                Department              Scope
    Sessions              Teams                   Roles
    MFA                   Structure               Policies
       └──────────────────────┬──────────────────────┘
                              │
                        AUTHORIZATION
                              │
                ┌─────────────┼─────────────┐
                │             │             │
              Roles       Permissions     Policies
                │             │             │
                └─────────────┼─────────────┘
                              │
                        ENTITLEMENTS
                              │
                        ACCESS DECISION
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
      CRM                   Finance                Studios
       │                      │                      │
    Activity               Activity              Activity
       └──────────────────────┼──────────────────────┘
                              │
                           EVENTS
                              │
               ┌──────────────┼──────────────┐
               │              │              │
           Analytics        Audit          Automation
               │              │              │
               └──────────────┼──────────────┘
                              │
                             AI
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    User Copilot       Access Advisor      Team Intelligence
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                       ADMIN ACTIONS
                              │
                     Authorization Again
                              │
                         Execution + Audit
```

---

# 121. Final Product Definition

I would formally redefine SmartSapp's feature from:

> **User Management**

to:

> **SmartSapp Identity, Access & Workforce Intelligence**

with six major product pillars:

### 1. Identity

Authentication, account lifecycle, MFA, SSO, sessions and recovery.

### 2. People & Organization

People, memberships, teams, departments, workspaces and organizational structure.

### 3. Access

Roles, permissions, policies, scopes, entitlements, temporary access and access reviews.

### 4. Onboarding

Invitations, adaptive journeys, approvals, activation and automated onboarding.

### 5. Intelligence

Activity, analytics, adoption, security, workload, role effectiveness and CRM-aware user intelligence.

### 6. AI

User Copilot, Access Advisor, Onboarding Copilot, risk detection, role recommendations and administrative intelligence.

---

# 122. The Strategic Result for SmartSapp

This redesign changes the feature from an administrative utility into a **cross-platform operating system for people and access**.

Every SmartSapp module can then consume the same foundation:

```text
CRM
Deals
Leads Intelligence
Finance
Forms
Surveys
Meetings
Messaging
Automations
Landing Pages
Portals
Studios
Reports
AI
```

Every module can ask the same questions:

```text
Who is the actor?
What organization are they in?
Which workspace?
What role?
What permission?
What scope?
What entitlement?
What policy?
What did they do?
What should they be allowed to do?
What does AI recommend?
```

That is the architectural level I would target for SmartSapp.

## Recommended implementation priority

The immediate engineering sequence should be:

**Foundation → Membership model → Authorization 2.0 → People & Access Hub → Onboarding Engine → Governance → Event/Analytics layer → CRM ownership integration → AI intelligence → Enterprise SSO/SCIM.**

The most important point is **not to rebuild the whole system at once**. The current implementation contains enough useful infrastructure to serve as the compatibility layer while the canonical Identity 2.0 architecture is introduced underneath it. This greatly reduces migration risk and allows the existing CRM to continue operating while the new identity platform becomes the shared foundation.

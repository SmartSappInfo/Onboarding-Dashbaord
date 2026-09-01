# SmartSapp Identity, Access & Workforce Intelligence 2.0

## Product Requirements & Technical Architecture Document

**Document Version:** 3.0.0
**Status:** Production Target Architecture
**Product Area:** Identity, User Management, Onboarding, Roles & Permissions, Governance, Workforce Analytics, AI
**Primary Surfaces:** Admin, Onboarding, CRM, Finance, Studios, Backoffice
**Primary Technology Context:** Next.js, TypeScript, Firebase Authentication, Cloud Firestore, Firebase Admin SDK, server actions/API routes, event-driven processing

---

# 1. EXECUTIVE SUMMARY

SmartSapp currently has a mature foundation for authentication, onboarding, organization management, workspaces, role-based access, backoffice governance, session invalidation and multi-channel provisioning.

However, the current implementation is centered around a `UserProfile` and a permission schema. As SmartSapp expands into a broader CRM and business operating platform, identity must evolve into a reusable platform capability.

The target product is therefore:

# SmartSapp Identity, Access & Workforce Intelligence

It will provide a unified system for:

* identity and authentication
* people and organizational membership
* workspace access
* roles and permissions
* policy-based authorization
* product entitlements
* onboarding journeys
* invitations
* approvals
* access reviews
* security governance
* audit
* CRM ownership
* activity tracking
* workforce analytics
* AI-assisted administration
* enterprise identity integration

The system must remain approachable for normal administrators while supporting sophisticated security and governance requirements.

The design principle is:

> **Simple by default. Powerful when needed. Governed everywhere.**

---

# 2. PRODUCT VISION

SmartSapp should understand every authorized human interaction with the platform through a consistent identity model.

A person should have:

```text
Identity
+
Organization membership
+
Workspace memberships
+
Teams / departments
+
Roles
+
Permissions
+
Policies
+
Entitlements
+
Responsibilities
+
CRM ownership
+
Activity
+
Security posture
+
AI context
```

The platform should allow an administrator to answer:

> Who is this person?

> What can they access?

> Why can they access it?

> What have they actually used?

> What work are they responsible for?

> Is their access appropriate?

> What should happen when they leave?

> What should SmartSapp recommend?

---

# 3. PROBLEM STATEMENT

The current architecture has several structural limitations as SmartSapp scales.

## 3.1 User profile overload

The existing `UserProfile` contains identity, membership, permissions, workspace state, notification preferences, AI configuration and backoffice responsibilities.

This creates synchronization risk.

## 3.2 Permission snapshot drift

Hydrated permission trees stored on user profiles can become stale when roles change.

## 3.3 RBAC-only authorization

Role-based permissions are insufficient for ownership, team, amount, department, resource and policy constraints.

## 3.4 Hard-coded onboarding

The current onboarding wizard is optimized for one workflow rather than configurable journeys.

## 3.5 User management is not yet a workforce system

The platform needs teams, departments, ownership, workload and activity relationships.

## 3.6 Analytics are not identity-native

User activity should be captured through platform events rather than reconstructed from profile documents.

## 3.7 AI is currently capability-based rather than governance-based

AI must understand authorization context and produce explainable, controlled recommendations.

---

# 4. PRODUCT OBJECTIVES

## Primary Objectives

### O1 — Create a canonical identity architecture

Separate authentication, person identity, membership and authorization.

### O2 — Create scalable organization and workspace access

Support organizations, workspaces, teams and departments without duplicating access logic.

### O3 — Create enterprise-grade authorization

Support RBAC + policy constraints + scope + entitlements.

### O4 — Make onboarding configurable

Allow organizations to create adaptive onboarding journeys.

### O5 — Make user management operationally useful

Connect people to CRM ownership, tasks, meetings, automations and other work.

### O6 — Introduce first-class people analytics

Measure activation, engagement, adoption, access and workforce utilization.

### O7 — Add governed AI

Use AI for assistance, recommendation, explanation and risk detection while preserving deterministic security controls.

### O8 — Preserve compatibility

Migrate the current system incrementally rather than performing a high-risk rewrite.

---

# 5. NON-GOALS

This product is not intended to become a full HRIS.

The following are out of scope unless separately approved:

* payroll
* employee benefits
* performance reviews as an HR process
* statutory HR compliance
* recruitment ATS
* leave management
* employee compensation administration

The product may store limited organizational metadata required for access and workforce intelligence.

---

# 6. USER PERSONAS

## 6.1 Organization Owner

Needs:

* create organization
* establish workspace
* invite staff
* configure roles
* establish policies
* view organization analytics
* control billing-sensitive capabilities

## 6.2 Organization Administrator

Needs:

* manage users
* manage workspaces
* manage teams
* approve members
* assign roles
* perform access reviews
* manage security

## 6.3 Department / Team Manager

Needs:

* see team members
* understand workload
* request or recommend access
* approve certain actions
* monitor onboarding and adoption

## 6.4 Standard User

Needs:

* sign in
* complete onboarding
* access assigned workspaces
* understand their responsibilities
* manage profile/security preferences

They should not need to understand RBAC or policy mechanics.

## 6.5 Security / Governance Administrator

Needs:

* review privileged access
* manage authentication policies
* review audit activity
* investigate anomalies
* manage access reviews

## 6.6 Platform Backoffice Operator

Needs:

* manage platform-wide tenant operations
* handle support cases
* manage global configurations
* execute migrations
* use controlled impersonation

## 6.7 Support Operator

Needs:

* diagnose customer issues
* enter time-bounded support sandbox
* inspect tenant configuration
* act under explicit support controls

---

# 7. INFORMATION ARCHITECTURE

```text
People & Access
├── Overview
├── People
├── Invitations
├── Requests
├── Teams
├── Departments
└── Organization Structure

Roles & Permissions
├── Roles
├── Role Templates
├── Permissions
├── Policies
├── Simulator
└── Access Reviews

Onboarding
├── Overview
├── Journeys
├── Templates
├── Active Onboarding
└── Analytics

Governance
├── Security
├── Sessions
├── Approvals
├── Access Reviews
└── Audit

Analytics
├── People
├── Adoption
├── Engagement
├── Teams
├── Access
└── Security

AI
├── Copilot
├── Access Advisor
├── Role Advisor
├── Onboarding AI
└── Insights
```

Visibility must be permission-aware.

---

# 8. PRODUCT DOMAIN MODEL

## 8.1 Identity Domain

Entities:

* Account
* Person
* Authentication Identity
* Credential
* MFA Enrollment
* Session

## 8.2 Organization Domain

Entities:

* Organization
* Organization Membership
* Department
* Team
* Job Title
* Reporting Relationship
* Location

## 8.3 Workspace Domain

Entities:

* Workspace
* Workspace Membership
* Workspace Scope

## 8.4 Authorization Domain

Entities:

* Permission
* Role
* Role Assignment
* Role Version
* Policy
* Policy Rule
* Permission Snapshot
* Access Decision
* Access Exception
* Entitlement

## 8.5 Onboarding Domain

Entities:

* Journey
* Journey Version
* Step
* Journey Instance
* Journey Task
* Approval
* Invitation

## 8.6 Governance Domain

Entities:

* Access Review
* Access Review Item
* Approval Request
* Audit Event
* Security Event
* Impersonation Session

## 8.7 Activity Domain

Entities:

* Platform Event
* User Activity
* CRM Ownership
* Assignment
* Work Transfer

## 8.8 Analytics Domain

Entities:

* User Metric
* Team Metric
* Workspace Metric
* Adoption Metric
* Access Metric
* Security Metric

## 8.9 AI Domain

Entities:

* AI Recommendation
* AI Insight
* AI Action Proposal
* AI Conversation
* AI Evaluation Context

---

# 9. CANONICAL IDENTITY MODEL

## 9.1 Identity Account

```typescript
interface IdentityAccount {
  id: string;
  authUid: string;

  authProvider:
    | 'firebase'
    | 'google'
    | 'saml'
    | 'oidc';

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

  mfaStatus:
    | 'not_enabled'
    | 'optional'
    | 'required'
    | 'enrolled';

  lastLoginAt?: Timestamp;
  lastSeenAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 10. PERSON MODEL

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
  teamIds: string[];

  employeeCode?: string;
  externalReference?: string;

  timezone?: string;
  locale?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 11. ORGANIZATION MEMBERSHIP

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

  source:
    | 'signup'
    | 'invitation'
    | 'import'
    | 'sso'
    | 'scim'
    | 'migration';

  invitedAt?: Timestamp;
  joinedAt?: Timestamp;
  suspendedAt?: Timestamp;
  revokedAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 12. WORKSPACE MEMBERSHIP

```typescript
interface WorkspaceMembership {
  id: string;

  organizationId: string;
  workspaceId: string;

  personId: string;
  membershipId: string;

  status:
    | 'active'
    | 'suspended'
    | 'revoked';

  roleAssignmentIds: string[];

  scopePolicy?: {
    type:
      | 'all'
      | 'team'
      | 'department'
      | 'owner'
      | 'custom';

    values?: string[];
  };

  isPrimary: boolean;

  startsAt?: Timestamp;
  expiresAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 13. ORGANIZATIONAL STRUCTURE

SmartSapp supports lightweight organizational structures.

Entities:

```text
Department
Team
JobTitle
Location
ReportingRelationship
```

Reporting:

```typescript
interface ReportingRelationship {
  organizationId: string;
  personId: string;
  managerPersonId: string;

  startsAt: Timestamp;
  endsAt?: Timestamp;
}
```

---

# 14. WORKSPACE MODEL

```typescript
interface Workspace {
  id: string;

  organizationId: string;

  name: string;
  slug?: string;

  status:
    | 'draft'
    | 'active'
    | 'suspended'
    | 'archived';

  industry?: string;

  contactScope:
    | 'person'
    | 'institution'
    | 'family';

  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };

  settings: Record<string, unknown>;

  accessVersion: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 15. PERMISSION MODEL

Permission is defined as:

```text
Resource
+
Action
+
Scope
+
Conditions
```

Example:

```typescript
interface PermissionGrant {
  resource: string;
  actions: string[];

  scope: {
    type:
      | 'organization'
      | 'workspace'
      | 'team'
      | 'department'
      | 'owner'
      | 'custom';

    values?: string[];
  };

  conditions?: Record<string, unknown>;
}
```

---

# 16. ROLE MODEL

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

  status:
    | 'active'
    | 'archived';

  permissions: PermissionGrant[];

  inheritedRoleIds?: string[];

  constraints?: AccessConstraint[];

  templateKey?: string;

  isImmutable: boolean;
  isAssignable: boolean;

  version: number;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 17. ROLE ASSIGNMENT

```typescript
interface RoleAssignment {
  id: string;

  organizationId: string;
  workspaceId?: string;

  subjectId: string;
  roleId: string;

  scope?: {
    type: string;
    values?: string[];
  };

  startsAt?: Timestamp;
  expiresAt?: Timestamp;

  assignedBy: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 18. POLICY MODEL

Policies provide the contextual layer beyond RBAC.

Example:

```text
Finance Manager
+
Invoice approval
+
Amount <= GHS 25,000
```

Policy:

```typescript
interface AccessPolicy {
  id: string;

  organizationId: string;

  name: string;
  description?: string;

  priority: number;

  effect: 'allow' | 'deny' | 'require_approval';

  conditions: PolicyCondition[];

  status: 'draft' | 'active' | 'archived';

  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 19. AUTHORIZATION PRECEDENCE

The authorization engine must follow deterministic precedence:

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

The current additive permission merger becomes a compatibility mechanism rather than the final authorization model.

---

# 20. AUTHORIZATION DECISION

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
    | 'entitlement_missing'
    | 'account_suspended'
    | 'session_invalid'
    | 'approval_required';

  matchedRoles: string[];
  matchedPolicies: string[];
  matchedScopes: string[];

  evaluatedAt: string;
}
```

---

# 21. AUTHORIZATION API

The shared service must expose:

```text
can()
authorize()
explain()
getEffectiveAccess()
compileSnapshot()
invalidateSnapshot()
simulate()
compareRoles()
```

### `can()`

For lightweight UI visibility.

### `authorize()`

For security-critical server execution.

### `explain()`

For administrator-facing access explanations.

### `simulate()`

For role and policy testing.

---

# 22. PERMISSION SNAPSHOTS

The existing hydrated permission schema remains useful but becomes derived state.

```typescript
interface PermissionSnapshot {
  subjectId: string;
  organizationId: string;
  workspaceId: string;

  grants: PermissionGrant[];

  hash: string;

  generatedAt: Timestamp;

  sourceVersions: {
    roleVersions: string[];
    policyVersions: string[];
    entitlementVersion: string;
  };
}
```

The user profile must no longer be the canonical source of effective permissions.

---

# 23. ACCESS VERSIONING

Introduce version counters at organization/workspace/member level.

When authorization changes:

```text
Role change
→ Access version increments
→ Snapshot invalidated
→ Client notified
→ Authorization recompiled
```

This solves stale permission behavior.

---

# 24. ENTITLEMENT MODEL

Permissions and product subscriptions must remain separate.

```typescript
interface Entitlement {
  id: string;
  organizationId: string;

  key: string;

  status: 'active' | 'inactive';

  quantity?: number;

  startsAt?: Timestamp;
  expiresAt?: Timestamp;

  source:
    | 'subscription'
    | 'package'
    | 'promotion'
    | 'system';
}
```

Final authorization:

```text
Identity
+
Membership
+
Role
+
Permission
+
Policy
+
Scope
+
Entitlement
=
Access
```

---

# 25. IDENTITY LIFECYCLE

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
   └── DELETED / ANONYMIZED
```

All state transitions must emit events.

---

# 26. INVITATION LIFECYCLE

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

Failure states:

```text
DELIVERY_FAILED
EXPIRED
REVOKED
REJECTED
```

---

# 27. INVITATION MODEL

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

Prefer secure activation links over distributing reusable temporary passwords.

---

# 28. ONBOARDING JOURNEY ENGINE

Replace hard-coded onboarding with configurable journeys.

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

  status:
    | 'draft'
    | 'published'
    | 'archived';

  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 29. ONBOARDING STEP TYPES

Required step types:

```text
Profile
Form
Workspace Selection
Team Selection
Role Confirmation
MFA Setup
Policy Acceptance
Manager Approval
Guide / Video
Checklist
AI Conversation
Automation
```

---

# 30. ONBOARDING INSTANCE

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

---

# 31. ADAPTIVE ONBOARDING

Journey conditions must support:

```text
IF department = Finance
→ finance policy

IF role = Administrator
→ MFA

IF workspace = Admissions
→ CRM orientation

IF memberType = contractor
→ restricted onboarding
```

---

# 32. ONBOARDING ANALYTICS

Required metrics:

* invitation acceptance rate
* profile completion rate
* step completion rate
* step drop-off
* median onboarding time
* approval turnaround
* activation rate
* first meaningful action
* first CRM action
* seven-day activation
* thirty-day activation

---

# 33. USER MANAGEMENT HUB

The existing `/admin/users` evolves into:

# People & Access

Primary areas:

```text
Overview
People
Invitations
Requests
Teams
Departments
Organization Structure
```

---

# 34. PEOPLE DIRECTORY REQUIREMENTS

Columns:

```text
Name
Status
Role
Department
Team
Workspace
Last Active
Onboarding
Security Risk
```

Searchable fields:

```text
Name
Email
Phone
Employee Code
Role
Team
Workspace
Department
CRM Ownership
```

Filters:

```text
Status
Role
Workspace
Team
Department
Onboarding
Last Active
Risk
Created Date
```

Saved views are required.

Default views:

```text
All People
Pending Approval
Recently Joined
Inactive 30+ Days
Administrators
Finance Access
High Risk
```

---

# 35. USER PROFILE UX

Tabs:

```text
Overview
Access
Workspaces
CRM
Activity
Onboarding
Security
Notifications
AI
Audit
```

The profile header must display:

```text
Name
Job title
Status
Department
Team
Primary workspace
Last active
Security status
Onboarding status
```

---

# 36. ACCESS MANAGEMENT UX

The administrator should manage access using:

```text
Workspace
→ Role
→ Scope
→ Optional constraints
→ Review
→ Confirm
```

Do not initially expose a giant permission matrix.

---

# 37. ACCESS EXPLANATION UX

For every significant permission:

```text
Why does Sarah have access?

Role
Sales Manager

Workspace
Admissions

Scope
Admissions Team

Permission
deals.edit

Policy
No restriction

Result
Allowed
```

For denial:

```text
Permission exists
but policy restricts access to:
Finance Managers
```

---

# 38. ROLE LIBRARY

The Roles screen must contain:

```text
Role name
Category
Users
Workspaces
Permission count
Risk level
Status
Version
```

Actions:

```text
Create
Duplicate
Edit
Compare
Simulate
Archive
View users
```

---

# 39. ROLE BUILDER

Steps:

```text
1. Role identity
2. Capabilities
3. Resources
4. Actions
5. Scope
6. Restrictions
7. Review
8. Publish
```

Publishing a sensitive role may require approval.

---

# 40. ROLE TEMPLATES

Templates should be:

* Universal
* SaaS
* School Enrollment
* Marketing
* Legal
* Real Estate
* Consultancy

Existing blueprints become the seed catalog.

---

# 41. ROLE VERSIONING

Role changes create new versions.

```text
Sales Manager v1
Sales Manager v2
Sales Manager v3
```

Administrators can:

```text
Compare versions
View users affected
Rollback
View audit
```

---

# 42. ROLE IMPACT ANALYSIS

Before publishing:

```text
This change affects:

14 users
4 workspaces
37 role assignments

Access gained:
8 permissions

Access removed:
3 permissions

High-risk change:
Yes
```

If required:

```text
Submit for approval
```

---

# 43. ROLE SIMULATOR

Inputs:

```text
User
Workspace
Resource
Action
```

Output:

```text
Allowed / Denied
Why
Matched role
Matched policy
Scope
Entitlement
```

This is mandatory for complex role governance.

---

# 44. POLICY BUILDER UX

Use human-readable policy construction:

```text
WHEN
User has Finance Manager role

AND
Invoice amount > GHS 25,000

THEN
Require Finance Director approval
```

Advanced administrators can open technical details.

---

# 45. ACCESS REVIEWS

The Access Review Center must show:

```text
Review name
Scope
Users
Privileged users
Dormant users
Completion
Due date
```

Review item:

```text
User
Role
Permissions
Usage
Risk
Recommendation
Decision
```

Actions:

```text
Keep
Reduce
Remove
Investigate
```

---

# 46. TEMPORARY ACCESS

Required for privileged scenarios.

Flow:

```text
Request
→ Reason
→ Scope
→ Duration
→ Approval
→ Access granted
→ Automatic expiration
→ Audit
```

---

# 47. SEPARATION OF DUTIES

Policies must support conflicts such as:

```text
User cannot create and approve same invoice.
```

and:

```text
Role creator cannot approve the role.
```

---

# 48. TEAM MANAGEMENT

Team page:

```text
Overview
Members
Workload
CRM
Activity
Access
Analytics
```

Metrics:

```text
team size
active users
task volume
deal volume
activity
adoption
workload
```

---

# 49. DEPARTMENT MANAGEMENT

Departments are administrative organizational groupings used for:

* onboarding
* reporting
* role recommendation
* policy targeting
* analytics
* team membership

---

# 50. ORGANIZATION STRUCTURE

Display:

```text
Leadership
  ↓
Departments
  ↓
Teams
  ↓
Members
```

Managers and reporting relationships may be defined without introducing full HR functionality.

---

# 51. OFFBOARDING ENGINE

Offboarding is a controlled workflow.

```text
Offboarding initiated
      ↓
Access review
      ↓
CRM/work reassignment
      ↓
Automation ownership review
      ↓
Session revocation
      ↓
Membership revocation
      ↓
Notifications
      ↓
Audit
```

---

# 52. CRM OWNERSHIP MODEL

Users become first-class owners/assignees.

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

---

# 53. OWNERSHIP TRANSFER ENGINE

Required during offboarding.

Supported resources:

```text
Leads
Contacts
Accounts
Deals
Tasks
Meetings
Campaigns
Automations
Forms
Surveys
Reports
Approvals
```

The platform must show orphaned work before completing offboarding.

---

# 54. USER CRM PROFILE

User profile CRM tab:

```text
Leads owned
Contacts managed
Deals owned
Pipeline value
Tasks
Meetings
Response time
Conversion indicators
```

Managers can navigate directly into relevant CRM work.

---

# 55. USER ACTIVITY PLATFORM

Every significant action must emit a canonical event.

Identity:

```text
identity.account.created
identity.login.succeeded
identity.login.failed
identity.mfa.enabled
```

Membership:

```text
membership.invited
membership.accepted
membership.approved
membership.revoked
workspace.access.granted
workspace.access.revoked
```

Authorization:

```text
role.created
role.updated
role.assigned
role.removed
permission.changed
policy.created
access.review.started
access.review.completed
```

CRM:

```text
crm.lead.viewed
crm.deal.created
crm.deal.updated
crm.deal.won
crm.task.completed
crm.meeting.completed
```

Onboarding:

```text
onboarding.started
onboarding.step.completed
onboarding.approval.requested
onboarding.completed
```

---

# 56. CANONICAL EVENT ENVELOPE

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

# 57. ANALYTICS ARCHITECTURE

Analytics must use event-driven projections.

```text
Application Events
        ↓
Event Processing
        ↓
Analytics Events
        ↓
Aggregations
        ↓
User / Team / Workspace Metrics
```

Operational Firestore documents should not become the analytical store for all high-cardinality activity.

---

# 58. PEOPLE ANALYTICS

Dashboard metrics:

```text
Total People
Active
Pending
Suspended
Dormant
Activation Rate
Retention
```

---

# 59. ADOPTION ANALYTICS

Track:

```text
Signed in
Activated
Used feature
Repeatedly used
Proficient
```

Feature dimensions:

```text
CRM
Finance
Forms
Surveys
Meetings
Automations
Messaging
Studios
Reports
AI
```

---

# 60. ENGAGEMENT ANALYTICS

Metrics:

```text
DAU
WAU
MAU
Sessions
Feature usage
Actions per user
Last activity
Session frequency
```

---

# 61. TEAM ANALYTICS

Metrics:

```text
Team size
Active members
Tasks
Deals
Meetings
CRM activity
Feature adoption
Workload
```

---

# 62. ACCESS ANALYTICS

Metrics:

```text
Privileged users
Sensitive permissions
Unused permissions
Dormant privileged users
Duplicate roles
Access reviews
Role complexity
```

---

# 63. SECURITY ANALYTICS

Metrics:

```text
MFA adoption
Failed logins
Security anomalies
Permission escalations
Impersonation sessions
Session revocations
High-risk accounts
```

---

# 64. USER HEALTH SCORE

User health combines:

```text
Activation
Engagement
Adoption
CRM activity
Security posture
```

with transparent scoring.

Example:

```text
User Health
84 / 100

Activation       92
Engagement       81
Adoption         78
CRM activity     91
Security         96
```

The user can inspect the evidence for the score.

---

# 65. PERMISSION USAGE INTELLIGENCE

Track:

```text
Permission granted
Permission used
Last used
Usage frequency
Peer usage
Risk classification
```

This allows SmartSapp to identify unnecessary permissions.

---

# 66. LEAST-PRIVILEGE ADVISOR

Example:

```text
Sarah

47 permissions granted
23 actively used
24 unused for 90 days

Recommendation:
Review 11 permissions.
```

Recommendations must show evidence.

---

# 67. ROLE INTELLIGENCE

Detect:

```text
duplicate roles
high-overlap roles
unused roles
overprivileged roles
underprivileged users
complex roles
role sprawl
```

---

# 68. AI ARCHITECTURE

AI is layered on top of authorized SmartSapp context.

```text
Identity
Membership
Authorization
CRM
Activity
Analytics
        ↓
Context Resolver
        ↓
AI Orchestration
        ↓
Model
        ↓
Recommendation / Explanation / Proposal
```

---

# 69. AI CONTEXT SECURITY

AI requests must follow:

```text
Actor
→ Authorization
→ Scoped retrieval
→ Context construction
→ Model
```

The AI layer must never receive unrestricted raw tenant data.

---

# 70. AI USER COPILOT

Supported questions:

```text
Who joined this month?
Who has Finance access?
Who has not completed onboarding?
Which users are inactive?
Why can't Sarah edit this deal?
Which users appear overprivileged?
```

---

# 71. AI ROLE ADVISOR

Input:

```text
Department
Team
Job title
Workspace
Observed responsibilities
```

Output:

```text
Recommended role
Confidence
Reasoning
Permissions
Scope
Risk
```

---

# 72. AI ACCESS ADVISOR

Review:

```text
Assigned permissions
Role
Usage
Peers
Risk
Policies
Workspace
```

Produce:

```text
Recommendation
Evidence
Confidence
Impact
Required approval
```

---

# 73. AI ONBOARDING ASSISTANT

During onboarding:

```text
User:
I work in Admissions.

AI:
You appear to need access to:
Leads
Contacts
Meetings
Tasks
Messaging.

Would you like a guided setup?
```

The assistant cannot bypass organizational policy.

---

# 74. AI RISK DETECTION

Potential signals:

```text
unusual login behaviour
permission escalation
large-scale access
mass deletion
unusual export behaviour
repeated authentication failures
unexpected workspace switching
```

AI prioritizes signals but deterministic controls remain authoritative.

---

# 75. AI ACTION SAFETY

Every mutating AI request follows:

```text
AI proposal
↓
Impact preview
↓
Authorization
↓
Approval if required
↓
Human confirmation
↓
Execution
↓
Audit
```

---

# 76. NOTIFICATION ARCHITECTURE

Move from direct notification calls to:

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

Channels:

```text
Email
SMS
Push
In-App
```

Providers must be replaceable.

---

# 77. OUTBOX / EVENT DELIVERY

Core mutation:

```text
Transaction
↓
Commit
↓
Outbox Event
↓
Async Worker
↓
Notification / Analytics / Automation
```

This prevents external communication failures from corrupting business state.

---

# 78. DELIVERY STATES

Notifications should track:

```text
queued
sent
delivered
opened
failed
throttled
rejected
```

---

# 79. SECURITY ARCHITECTURE

## Authentication

* Firebase Authentication
* Google/OAuth
* enterprise federation roadmap
* MFA
* session management

## Authorization

* server-side enforcement
* organization boundary
* workspace boundary
* role
* policy
* scope
* entitlement

## Data

* default deny
* server-side privileged writes
* organization isolation
* audit

---

# 80. FIRESTORE STRATEGY

Recommended logical structure:

```text
organizations/{orgId}

organizations/{orgId}/memberships/{membershipId}

organizations/{orgId}/departments/{departmentId}

organizations/{orgId}/teams/{teamId}

organizations/{orgId}/workspaces/{workspaceId}

organizations/{orgId}/roles/{roleId}

organizations/{orgId}/policies/{policyId}

organizations/{orgId}/roleAssignments/{assignmentId}

organizations/{orgId}/invitations/{invitationId}

organizations/{orgId}/accessReviews/{reviewId}

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

---

# 81. LEGACY COMPATIBILITY

The current structures should remain temporarily supported:

```text
users/{uid}
roles
workspacePermissions
permissionsSchema
flat permissions
```

Introduce adapters:

```text
legacy user
→ canonical identity projection

legacy role
→ canonical role

legacy permissions
→ canonical grants
```

The application should eventually stop mutating legacy fields directly.

---

# 82. SESSION MANAGEMENT

Required capabilities:

```text
Active sessions
Recent sessions
Sign out current device
Sign out all other devices
Revoke all sessions
Session expiry
Idle timeout
Sensitive-action reauthentication
```

---

# 83. MFA POLICY

Policies may require MFA for:

```text
Administrators
Finance roles
Backoffice users
Support impersonation
Sensitive exports
Role administration
```

---

# 84. ENTERPRISE IDENTITY

Architecture should be ready for:

```text
OIDC
SAML
Google Workspace
Microsoft Entra ID
Okta
```

Future:

```text
SCIM
```

---

# 85. SUPPORT SANDBOX

Support impersonation:

```text
Reason required
Scope required
Duration required
Approval required where appropriate
Banner
Audit trail
Automatic expiry
```

Actor identity must remain visible.

---

# 86. AUDIT ARCHITECTURE

Separate:

```text
organization_audit_logs
platform_audit_logs
security_events
```

Organization audit records:

```text
actor
action
target
organization
workspace
before
after
reason
approval
timestamp
session
```

---

# 87. OWNERSHIP TRANSFER DURING OFFBOARDING

Before offboarding is completed, display:

```text
24 Leads
8 Deals
14 Tasks
7 Meetings
3 Automations
```

The administrator must resolve all required ownership relationships.

This prevents operational dead ends.

---

# 88. DATA RETENTION

Identity data and business activity should have separate retention policies.

Historical CRM activity should preserve attribution to former users without requiring their active account.

---

# 89. UI/UX DESIGN SYSTEM

The administration UI must use:

* restrained visual hierarchy
* clear status badges
* progressive disclosure
* contextual drawers
* side sheets
* clear primary actions
* local loading states
* actionable errors
* impact previews
* confirmation for high-risk actions

Avoid dense enterprise interfaces by default.

---

# 90. GLOBAL PEOPLE PICKER

Reusable SmartSapp component:

```text
Search
Avatar
Name
Job title
Team
Department
Workspace
Status
```

Used throughout:

```text
CRM
Deals
Tasks
Meetings
Approvals
Automations
Forms
Surveys
Finance
```

---

# 91. GLOBAL ROLE PICKER

Reusable role assignment component.

Features:

```text
Recommended
Recently used
Templates
Custom roles
Role risk
Permission count
```

---

# 92. GLOBAL ACCESS SUMMARY

Reusable component:

```text
Role
Workspace
Scope
Permission summary
Why?
```

This should appear inside CRM, Finance and other modules when access context matters.

---

# 93. DESIGN RULE: PROGRESSIVE DISCLOSURE

Normal administrator:

```text
Choose role
→ Choose workspace
→ Done
```

Advanced administrator:

```text
Customize permissions
→ configure scope
→ configure policy
→ test
→ publish
```

---

# 94. CORE UI SCREENS

## Phase foundation

* Admin Shell
* Global Search
* Notification Center
* Shared Dialogs
* Shared Drawers

## People

* People Overview
* People Directory
* Person Profile
* Invitations
* Requests
* Teams
* Departments
* Organization Structure

## Access

* Roles
* Role Detail
* Role Builder
* Permission Explorer
* Policy Builder
* Simulator
* Access Reviews

## Onboarding

* Onboarding Overview
* Journey Library
* Journey Builder
* Journey Detail
* Active Onboarding
* Analytics

## Governance

* Security
* Sessions
* Approvals
* Audit
* Access Reviews

## Analytics

* People
* Adoption
* Engagement
* Teams
* Access
* Security

## AI

* Copilot
* Access Advisor
* Role Advisor
* User Insights
* Onboarding Assistant

---

# 95. RESPONSIVE DESIGN

## ≥1440px

Three-zone layouts are permitted:

```text
Navigation
Main content
Details rail
```

## 1200–1439px

Use drawers and side sheets.

## 768–1199px

Use master/detail layouts.

## <768px

Use:

```text
List
→ Detail
→ Contextual actions
```

Do not expose giant permission grids on mobile.

---

# 96. ACCESSIBILITY REQUIREMENTS

All administrative experiences must provide:

* keyboard navigation
* focus management
* semantic controls
* accessible tables
* accessible dialogs
* color-independent status indicators
* adequate contrast
* reduced motion
* descriptive errors
* touch targets approximately 44px or greater

---

# 97. LOADING STATES

Use structural skeletons.

For actions:

```text
Assigning access…
Saving role…
Starting review…
Transferring work…
```

Never leave the user staring at a generic spinner without context.

---

# 98. ERROR STATES

Errors must answer:

```text
What failed?
What was preserved?
What should happen next?
```

Example:

> Role assignment failed. Sarah's existing access remains unchanged.

---

# 99. BULK ACTIONS

Bulk operations must show impact before execution.

Example:

```text
12 people selected.

You are granting:
Finance Viewer

Affected:
12 users
3 workspaces

[Review] [Cancel]
```

High-risk bulk mutations require approval.

---

# 100. SEARCH

Global search should support natural queries across:

```text
People
Roles
Teams
Workspaces
Invitations
Audit events
Access records
```

Future AI search may support:

> users in Finance who haven't logged in for 60 days

---

# 101. PHASED IMPLEMENTATION PLAN

## PHASE 0 — FOUNDATION

### Backend

* identity inventory
* authorization inventory
* event taxonomy
* legacy mapping
* domain contracts
* design architecture

### UI/UX

* navigation
* shell
* design system
* tables
* drawers
* dialogs
* filters
* status
* skeletons
* errors
* responsive foundation

### Exit criteria

All future modules can use common People, Role and Access components.

---

# 102. PHASE 1 — IDENTITY & MEMBERSHIP

### Backend

Build:

```text
Account
Person
OrganizationMembership
WorkspaceMembership
Session
```

### UI

Build:

```text
People
Person Profile
Membership
Workspace Access
```

### Migration

Existing `UserProfile` remains a compatibility projection.

### Exit criteria

Every production user can be represented through canonical identity + membership entities.

---

# 103. PHASE 2 — AUTHORIZATION 2.0

### Backend

Build:

```text
Permission
Role
RoleAssignment
Policy
AuthorizationService
PermissionSnapshot
AccessVersion
```

### UI

Build:

```text
Roles
Role Builder
Permission Explorer
Simulator
Access Explanation
```

### Migration

Existing four-section permission model translates into canonical grants.

### Exit criteria

All new protected actions use the new authorization engine.

---

# 104. PHASE 3 — PEOPLE & ACCESS HUB

### Backend

Build:

```text
Invitation service
Bulk operations
Membership lifecycle
Team service
Department service
```

### UI

Build:

```text
People Dashboard
Directory
Invitations
Requests
Teams
Departments
Bulk actions
```

### UX

Current `/admin/users` becomes the initial production implementation of the new People & Access Hub.

---

# 105. PHASE 4 — ONBOARDING ENGINE

### Backend

Build:

```text
Journey
Journey Version
Step
Instance
Conditions
Approval
```

### UI

Build:

```text
Onboarding Home
Journey Library
Journey Builder
Active Onboarding
Analytics
```

### Migration

Founder onboarding and invitee onboarding are recreated as journeys.

---

# 106. PHASE 5 — GOVERNANCE & SECURITY

### Backend

Build:

```text
Access Reviews
Policy Engine
Role Versioning
Temporary Access
Separation of Duties
Organization Audit
MFA Enforcement
Session Controls
```

### UI

Build:

```text
Security Center
Audit
Approvals
Policies
Access Reviews
Sessions
```

---

# 107. PHASE 6 — ACTIVITY & ANALYTICS

### Backend

Build:

```text
Event pipeline
Activity projections
Analytics aggregation
User metrics
Team metrics
Access metrics
Security metrics
```

### UI

Build:

```text
People Analytics
Adoption
Engagement
Teams
Access
Security
```

---

# 108. PHASE 7 — CRM-AWARE WORKFORCE

### Backend

Integrate:

```text
Lead ownership
Contact ownership
Deal ownership
Task assignment
Meeting ownership
Campaign ownership
Automation ownership
```

Build:

```text
OwnershipTransferService
```

### UI

Add to user profile:

```text
CRM
Workload
Pipeline
Tasks
Meetings
```

### Exit criteria

Offboarding cannot create orphaned operational ownership.

---

# 109. PHASE 8 — AI INTELLIGENCE

### Backend

Build:

```text
AI Context Resolver
AI Role Advisor
Access Advisor
AI Risk Engine
AI Recommendation Model
```

### UI

```text
AI Copilot
Access Advisor
Role Advisor
User Insights
Onboarding Assistant
```

### Rule

AI recommendations cannot bypass deterministic authorization.

---

# 110. PHASE 9 — AI ADMINISTRATION

Build:

```text
Action Proposal
Impact Preview
Approval Routing
AI Execution
AI Audit
```

Examples:

> Review inactive Finance administrators.

> Find duplicate roles.

> Prepare access review for Sales.

---

# 111. PHASE 10 — ENTERPRISE IDENTITY

Build:

```text
MFA
Passkeys where appropriate
SAML
OIDC
Enterprise IdP configuration
SCIM-ready architecture
```

UI:

```text
Authentication
Identity Providers
MFA
Session Policy
Directory Sync
```

---

# 112. PHASE 11 — WORKFORCE INTELLIGENCE

Build:

```text
Permission intelligence
Role intelligence
User health
Team workload
Adoption intelligence
AI organizational insights
```

UI:

```text
Workforce Overview
User Intelligence
Team Intelligence
Role Intelligence
Permission Intelligence
```

---

# 113. PHASE-TO-UI/UX DELIVERY MATRIX

| Phase | Backend        | UI                   | UX Outcome                  |
| ----- | -------------- | -------------------- | --------------------------- |
| 0     | Foundation     | Design system        | Consistency                 |
| 1     | Identity       | People/Profile       | Simple people management    |
| 2     | Authorization  | Roles/Access         | Guided access               |
| 3     | Membership     | People Hub           | Fast administration         |
| 4     | Onboarding     | Journey Builder      | Adaptive onboarding         |
| 5     | Governance     | Security/Reviews     | Safe administration         |
| 6     | Events         | Analytics            | Team understanding          |
| 7     | CRM            | Workload/Ownership   | People-to-work connection   |
| 8     | AI             | Copilot/Advisor      | Intelligent recommendations |
| 9     | AI Actions     | Action Center        | Governed automation         |
| 10    | Enterprise IAM | SSO/MFA              | Enterprise readiness        |
| 11    | Intelligence   | Workforce dashboards | Organizational optimization |

---

# 114. API / SERVER ACTION CONTRACTS

## Identity

```text
createAccount
getAccount
suspendAccount
reactivateAccount
deleteAccount
revokeSessions
```

## Membership

```text
inviteMember
acceptInvitation
approveMembership
rejectMembership
suspendMembership
revokeMembership
restoreMembership
```

## Workspace

```text
grantWorkspaceAccess
revokeWorkspaceAccess
updateWorkspaceScope
```

## Roles

```text
createRole
updateRole
archiveRole
assignRole
removeRole
cloneRole
compareRoles
simulateRole
```

## Authorization

```text
authorize
explainAccess
compileSnapshot
invalidateSnapshot
```

## Onboarding

```text
createJourney
publishJourney
startJourney
completeStep
completeJourney
pauseJourney
resumeJourney
```

## Governance

```text
createAccessReview
reviewAccess
createApproval
approveRequest
rejectRequest
```

## CRM

```text
assignOwner
transferOwnership
resolveOrphanedWork
```

---

# 115. IDEMPOTENCY

The following operations require idempotency:

```text
Invitation
Membership approval
Role assignment
Workspace assignment
Offboarding
Ownership transfer
Approval execution
Notification dispatch
```

Every mutation should support an idempotency key where retry duplication is possible.

---

# 116. TRANSACTION BOUNDARIES

Transactions are required for:

### Role assignment

```text
Assignment
Access version
Audit
```

### Membership state transition

```text
Membership
Account
Audit
```

### Offboarding

```text
Membership
Access
Ownership state
Audit
```

External providers must not be considered transactional.

---

# 117. EVENT / OUTBOX ARCHITECTURE

Critical business mutations should create events within the same logical commit.

Example:

```text
Role assignment
↓
transaction committed
↓
role.assigned event
↓
notifications
analytics
automation
AI signals
```

---

# 118. OBSERVABILITY REQUIREMENTS

Track:

```text
Authorization latency
Authorization failures
Permission compilation time
Invitation delivery success
Onboarding conversion
Role assignment failures
Audit write failures
Event processing lag
AI latency
AI action approval rate
```

Alerts should exist for material security failures.

---

# 119. PERFORMANCE TARGETS

The UX should aim for:

* fast people directory load
* sub-second local permission checks
* low-latency workspace switching
* immediate status updates for membership approval
* asynchronous processing for notifications and analytics
* paginated people/activity lists
* debounced server-side search at scale

Performance targets should be formally baselined during implementation.

---

# 120. SECURITY TESTING REQUIREMENTS

Test:

### Tenant isolation

User from Organization A cannot access Organization B.

### Workspace isolation

User without Workspace B membership cannot access Workspace B.

### Privilege escalation

User cannot modify a role with authority above their own.

### Invitation abuse

Expired/revoked invitations cannot create active access.

### Session invalidation

Disabled/revoked users cannot continue using protected services beyond expected token invalidation behavior.

### Impersonation

Support operators cannot hide actor identity.

### AI boundary

AI cannot retrieve or mutate resources outside actor authorization.

---

# 121. TESTING MATRIX

Every feature must have:

```text
Unit tests
Integration tests
Authorization tests
Tenant isolation tests
Transaction tests
UI tests
Accessibility tests
E2E tests
Failure/retry tests
```

High-risk authorization changes require regression coverage.

---

# 122. MIGRATION STRATEGY

Migration must be incremental.

## Stage 1

Introduce canonical entities.

## Stage 2

Synchronize legacy `UserProfile`.

## Stage 3

Move new writes to canonical entities.

## Stage 4

Use compatibility projection for legacy consumers.

## Stage 5

Migrate all reads.

## Stage 6

Remove legacy authorization writes.

## Stage 7

Deprecate legacy fields.

---

# 123. MIGRATION PRINCIPLE

For every legacy field, define:

```text
Canonical owner
Source
Derived status
Migration mechanism
Deprecation date
Consumer list
```

No legacy field should disappear without identifying its consumers.

---

# 124. SUCCESS METRICS

## Operational

* invitation acceptance
* onboarding completion
* median onboarding time
* approval turnaround
* offboarding completion

## Adoption

* active users
* feature adoption
* first meaningful action
* 7-day activation
* 30-day retention

## Governance

* access review completion
* stale permission reduction
* privileged-access review rate
* MFA adoption

## Efficiency

* time to provision user
* time to change access
* time to offboard
* admin actions per user
* support interventions

## AI

* recommendation acceptance
* recommendation accuracy
* access-risk detection precision
* AI task completion
* AI action approval rate

---

# 125. PRODUCT SUCCESS CRITERIA

The product is considered successful when:

### User provisioning

An administrator can add a standard user quickly without understanding technical permissions.

### Access control

An administrator can understand a user's effective access and why it exists.

### Role management

An advanced administrator can safely create and test custom roles without engineering intervention.

### Onboarding

Organizations can create different onboarding journeys for different user types.

### Offboarding

No critical CRM work is orphaned when a user leaves.

### Analytics

Managers can understand user adoption and team activity.

### Governance

Administrators can perform access reviews and track sensitive changes.

### AI

AI provides actionable, explainable assistance without bypassing security.

### Enterprise

The architecture can evolve toward SSO, MFA and SCIM without redesigning the core identity model.

---

# 126. RELEASE STRATEGY

Do not release this as one giant feature.

Recommended releases:

## Release 1

**People & Access Foundation**

People, profiles, memberships, workspaces, invitations.

## Release 2

**Access 2.0**

Roles, permission engine, scopes, simulator.

## Release 3

**Onboarding 2.0**

Journeys and adaptive onboarding.

## Release 4

**Governance**

Policies, reviews, audit, security, sessions.

## Release 5

**People Intelligence**

Analytics and CRM relationships.

## Release 6

**AI Administration**

Copilot, access advisor, role advisor.

## Release 7

**Enterprise Identity**

MFA, SSO, enterprise provisioning.

---

# 127. FINAL TARGET ARCHITECTURE

```text
                    SMARTSAPP IDENTITY PLATFORM

                           Identity
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 Account              Person
                    │                   │
                    └─────────┬─────────┘
                              │
                         Membership
                              │
                 ┌────────────┴────────────┐
                 │                         │
            Organization              Workspace
                 │                         │
           Departments                  Teams
           Teams                        Scope
           Policies                       │
                 └────────────┬────────────┘
                              │
                       Role Assignment
                              │
                    ┌─────────┴─────────┐
                    │                   │
               Permissions            Policies
                    │                   │
                    └─────────┬─────────┘
                              │
                         Entitlements
                              │
                       AUTHORIZATION
                              │
              ┌───────────────┼────────────────┐
              │               │                │
             CRM            Finance          Studios
              │               │                │
              └───────────────┼────────────────┘
                              │
                           Activity
                              │
                            Events
                              │
                ┌─────────────┼─────────────┐
                │             │             │
             Analytics       Audit       Automation
                │             │             │
                └─────────────┼─────────────┘
                              │
                              AI
                              │
              ┌───────────────┼────────────────┐
              │               │                │
          User Copilot    Access Advisor   Workforce AI
              │               │                │
              └───────────────┼────────────────┘
                              │
                      GOVERNED ACTION
                              │
                       AUTHORIZATION
                              │
                     EXECUTION + AUDIT
```

---

# 128. FINAL PRODUCT PRINCIPLE

SmartSapp Identity, Access & Workforce Intelligence 2.0 should not be treated as another settings page.

It should become a **shared platform capability underneath the entire SmartSapp ecosystem**.

CRM, Deals, Leads Intelligence, Finance, Forms, Surveys, Meetings, Messaging, Automations, Studios, Portals, Reports and AI should all consume the same:

```text
Identity
Membership
People
Workspace
Roles
Permissions
Policies
Entitlements
Activity
Audit
Analytics
AI context
```

The most important implementation rule is therefore:

> **Do not let each SmartSapp module invent its own user ownership, permission checks, team access, role logic or audit model.**

Instead:

```text
                    Identity Platform
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
            CRM         Finance        Studios
             ↓             ↓             ↓
          Shared authorization + identity
                           ↓
                 Shared activity/events
                           ↓
                      Shared analytics
                           ↓
                     Shared AI context
```

This makes Identity & Access the **control plane for SmartSapp**, while CRM, Finance, Studios and the other product surfaces remain operational domains on top of it.

The current architecture should therefore be evolved, not discarded: the existing `TenantContext`, hierarchical permissions, invitation engine, server-side provisioning, backoffice controls and legacy permission structures become the compatibility foundation while the canonical Identity 2.0 domains are introduced phase by phase.

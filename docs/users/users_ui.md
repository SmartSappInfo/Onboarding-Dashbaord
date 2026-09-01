# SMARTSAPP IDENTITY, ACCESS & WORKFORCE INTELLIGENCE 2.0

## Professional UI/UX Architecture & Phased Implementation Blueprint

**Version:** 3.0
**Status:** Product Design & Implementation Reference
**Primary Product Surface:** SmartSapp Admin / Settings
**Secondary Surfaces:** Onboarding, CRM, Finance, Studios, Automations, Backoffice
**Design Principle:** Simple by default. Powerful when needed. Governed everywhere.

---

# 1. UX NORTH STAR

SmartSapp Identity should answer five questions immediately:

1. **Who has access?**
2. **What can they access?**
3. **Why can they access it?**
4. **What are they doing?**
5. **What should I do next?**

The experience should therefore be organized around the administrator's jobs rather than around database entities.

## Primary Jobs-to-be-Done

```text
I need to add someone.
        ↓
Invite / onboard them.

I need to give someone access.
        ↓
Assign workspace + role.

I need to change their access.
        ↓
Manage access.

I need to understand their access.
        ↓
Access explanation.

I need to remove someone.
        ↓
Offboarding + work transfer.

I need to understand my team.
        ↓
People analytics.

I need help making access decisions.
        ↓
AI Copilot / Access Advisor.
```

---

# 2. PRODUCT INFORMATION ARCHITECTURE

The primary navigation should become:

```text
ADMIN
│
├── Overview
│
├── People & Access
│   ├── People
│   ├── Invitations
│   ├── Requests
│   ├── Teams
│   ├── Departments
│   └── Organization Structure
│
├── Roles & Permissions
│   ├── Roles
│   ├── Role Templates
│   ├── Permissions
│   ├── Policies
│   ├── Simulator
│   └── Access Reviews
│
├── Onboarding
│   ├── Journeys
│   ├── Templates
│   ├── Active Onboarding
│   └── Analytics
│
├── Activity & Governance
│   ├── User Activity
│   ├── Security
│   ├── Administrative Activity
│   ├── Approvals
│   └── Audit
│
├── Analytics
│   ├── People
│   ├── Adoption
│   ├── Engagement
│   ├── Access
│   ├── Teams
│   └── Security
│
└── AI
    ├── Copilot
    ├── Access Advisor
    ├── Onboarding AI
    └── Recommendations
```

## UX rule

Do not expose every menu item to every administrator.

A standard organization administrator should see:

```text
People
Roles
Onboarding
Activity
Analytics
AI
```

Advanced governance appears progressively when applicable.

---

# 3. GLOBAL APP SHELL

## Desktop

```text
┌──────────────────────────────────────────────────────────────────┐
│ SmartSapp     Search everything        Help   AI   Avatar        │
├───────────────┬──────────────────────────────────────────────────┤
│               │                                                  │
│ Admin Nav     │              Page Content                        │
│               │                                                  │
│ Overview      │                                                  │
│ People        │                                                  │
│ Access        │                                                  │
│ Onboarding    │                                                  │
│ Governance    │                                                  │
│ Analytics     │                                                  │
│ AI            │                                                  │
│               │                                                  │
└───────────────┴──────────────────────────────────────────────────┘
```

## Page header pattern

Every administrative page should use:

```text
Breadcrumb
Page title
1-line description
Primary action
Secondary actions
```

Example:

```text
People

Manage members, teams, workspace access and onboarding.

[Invite person]    [Import people]    [AI insights]
```

---

# 4. GLOBAL UX CONVENTIONS

## Primary actions

One dominant CTA per page.

Examples:

```text
People → Invite person
Roles → Create role
Onboarding → Create journey
Access Reviews → Start review
Teams → Create team
```

## Secondary actions

Use menus for:

```text
Export
Duplicate
Archive
Advanced settings
Bulk actions
```

## Destructive actions

Always use:

```text
Explain consequence
Show impact
Require confirmation
```

Never use a generic:

> Are you sure?

Instead:

> Suspending 6 users will immediately revoke their active sessions. Their CRM records will remain intact.

---

# 5. PEOPLE & ACCESS OVERVIEW

## Purpose

The administrator's operational homepage.

## Screen layout

```text
┌─────────────────────────────────────────────────────────────┐
│ People & Access                                             │
│ Manage people, access and team activity.                    │
│                                                             │
│ [Invite person]                         [AI Insights]        │
├─────────┬─────────┬─────────┬─────────┬─────────────────────┤
│ 342     │ 318     │ 14      │ 6       │ 9                   │
│ People  │ Active  │ Pending │ Review  │ At Risk             │
├─────────────────────────────┬───────────────────────────────┤
│ Onboarding Funnel           │ Activity                       │
│                             │                                │
│ Invited      42             │ New users                     │
│ Accepted     38             │ Access changes                │
│ Profile      34             │ Suspensions                   │
│ Active       31             │ Role changes                  │
├─────────────────────────────┴───────────────────────────────┤
│ Access Health                                                 │
│ Overprivileged users | Dormant users | Unused permissions    │
└──────────────────────────────────────────────────────────────┘
```

## UX behaviour

Cards are clickable.

Example:

`14 Pending` → Requests filtered to pending.

`6 Review` → Access Reviews.

`At Risk` → Security-risk people.

## Empty state

```text
Your organization has no additional team members yet.

Invite your first teammate to start collaborating.

[Invite person]
```

## Loading

Use dashboard skeletons.

## Error

Do not blank the entire dashboard.

Show:

```text
Some people metrics could not be loaded.

[Retry]
```

---

# 6. PEOPLE DIRECTORY

## Main screen

```text
People
──────────────────────────────────────────────────────────────

[Search people...] [Filters] [Saved views]        [Invite]

342 people

Name         Status    Role       Team      Workspace    Active
────────────────────────────────────────────────────────────
Sarah Mensah Active    Sales      Admissions CRM          8m
John Doe     Pending   —          —         —             —
...
```

## Filter drawer

Filters should include:

```text
Status
Role
Workspace
Team
Department
Job title
Onboarding
Last active
Security risk
Created date
```

## Saved views

Prebuilt:

```text
All People
Pending Approval
Recently Joined
Inactive 30+ Days
Administrators
Finance Access
High Risk
```

Users can create custom views.

---

# 7. PEOPLE BULK ACTIONS

Selecting users reveals a contextual toolbar:

```text
6 selected

[Assign role] [Add workspace] [Message]
[Suspend] [Export] [More]
```

Before applying a permission-changing action:

```text
6 people selected.

This will grant "Finance Viewer"
to:
• Sarah
• Michael
• John
...

[Cancel] [Review changes]
```

Then show impact before execution.

---

# 8. USER PROFILE

The user profile is the most important detail surface.

## Header

```text
┌──────────────────────────────────────────────────────────────┐
│ Avatar   Sarah Mensah                                        │
│          Admissions Manager                                  │
│          ● Active   Admissions Team                          │
│                                                              │
│ [Manage access] [Assign workspace] [More]                    │
└──────────────────────────────────────────────────────────────┘
```

## Tabs

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

---

# 9. USER OVERVIEW TAB

Cards:

```text
Identity
────────────────────────────
Email
Phone
Job title
Department
Team
Joined

Engagement
────────────────────────────
Last active
Sessions
Features used
User health

CRM
────────────────────────────
Leads owned
Deals owned
Open tasks
Upcoming meetings
```

## User health

Use an explainable score:

```text
User Health
84 / 100

Activation       92
Engagement       81
Adoption         78
CRM activity     91
Security         96
```

Clicking any score opens evidence.

---

# 10. ACCESS TAB

The administrator should see effective access first—not raw permissions.

```text
Access
─────────────────────────────────────────────

Organization
Administrator

Workspaces

Admissions
  Sales Manager
  18 permissions

Marketing
  Viewer
  7 permissions
```

Selecting a workspace:

```text
Admissions

Assigned Roles
Sales Manager
CRM Contributor

Effective Access
CRM
  Leads       View Create Edit
  Contacts    View Create Edit
  Deals       View Create Edit
  Tasks       View Create Edit

Finance
  Invoices    View
```

---

# 11. "WHY DOES THIS USER HAVE ACCESS?" UX

Every sensitive permission gets an explanation icon.

Example:

```text
Deals → Edit   ✓
                  [?]
```

Click:

```text
Why can Sarah edit deals?

✓ Role
  Sales Manager

✓ Workspace
  Admissions

✓ Scope
  Admissions team

✓ Resource
  Deal belongs to Admissions

No policy restrictions apply.

[View role]
[View policy]
```

This should become a defining SmartSapp UX feature.

---

# 12. "WHY IS THIS USER DENIED?" UX

```text
Deals → Delete   ✕

Why?

Sarah has:
✓ deals.view
✓ deals.create
✓ deals.edit

But:
✕ deals.delete

The current role does not grant deletion.

[Edit role]
```

If policy causes the denial:

```text
Permission exists.

Policy restriction:
Deletion allowed only for Workspace Administrators.
```

---

# 13. WORKSPACE ACCESS FLOW

From user profile:

`Manage workspace access`

opens a side sheet:

```text
Workspace Access

Search workspace...

☑ Admissions
   Sales Manager
   [Manage]

☑ Marketing
   Viewer
   [Manage]

☐ Finance
   No access
   [Grant access]
```

Grant flow:

```text
Select workspace
       ↓
Choose role
       ↓
Choose scope
       ↓
Review access
       ↓
Confirm
```

---

# 14. ROLE ASSIGNMENT UX

Never force administrators into a permission matrix for ordinary assignments.

Preferred flow:

```text
Assign role

Recommended
────────────────────
Sales Manager
Best match for this user's team.

Other roles
────────────────────
Sales Executive
CRM Viewer
Custom...

[Continue]
```

Then:

```text
Workspace
Admissions

Role
Sales Manager

Scope
○ Entire workspace
○ Team
○ Department
○ Own records

[Review]
```

---

# 15. AI ROLE RECOMMENDATION

Within assignment:

```text
✨ SmartSapp recommends

Sales Manager

Based on:
• Department: Admissions
• Team: Sales
• CRM responsibilities
• Similar users

Confidence: 94%

[Use recommendation]
[See reasoning]
```

Never auto-assign sensitive privileges.

---

# 16. ROLE LIBRARY

Roles screen:

```text
Roles

[Create role] [Role templates] [AI recommendations]

Search roles...

Role              Users   Workspaces   Risk
Administrator      6       3           High
Sales Manager     14       4           Medium
Finance Manager    3       2           High
CRM Viewer         27      5           Low
```

---

# 17. ROLE DETAIL

```text
Sales Manager
────────────────────────────────────────────

Users       14
Workspaces   4
Permissions  32
Risk         Medium

[Edit role] [Duplicate] [Archive]

Overview | Permissions | Scope | Users | History
```

---

# 18. ROLE BUILDER

The UI should progressively reveal complexity.

### Step 1 — Identity

```text
Role name
Description
Icon / colour
Category
```

### Step 2 — Capability groups

```text
CRM
Finance
Studios
Management
```

### Step 3 — Resources

```text
Deals
Contacts
Tasks
Meetings
```

### Step 4 — Actions

```text
View
Create
Edit
Delete
Approve
Export
Manage
```

### Step 5 — Scope

```text
Entire workspace
Team
Department
Own records
Custom
```

### Step 6 — Restrictions

```text
Approval limits
Sensitive fields
Time restrictions
```

---

# 19. ROLE SIMULATOR

Dedicated page and embedded tool.

```text
Role Simulator

Role:
Sales Manager

User:
Sarah

Workspace:
Admissions

Resource:
Deal #428

Action:
Edit

[Simulate]
```

Result:

```text
✓ AUTHORIZED

Reason
Sales Manager → deals.edit

Scope
Admissions team

Resource
Deal #428 belongs to Admissions.

[View authorization path]
```

---

# 20. ROLE COMPARISON

Useful for avoiding duplicate roles.

```text
Compare roles

                    Sales Manager   Sales Executive
Deals.view                ✓               ✓
Deals.create              ✓               ✓
Deals.edit                ✓               ✓
Deals.delete              ✓               ✕
Reports.view              ✓               ✕
Users.view                ✓               ✕
```

Then:

```text
Similarity: 82%

SmartSapp suggestion:
These roles may be consolidated.
```

---

# 21. PERMISSION EXPLORER

Advanced users get a resource-first view.

```text
Permissions

CRM
 ├── Leads
 │   ├── View
 │   ├── Create
 │   ├── Edit
 │   └── Delete
 │
 ├── Deals
 │   ├── View
 │   ├── Create
 │   ├── Edit
 │   ├── Delete
 │   └── Approve
```

Search:

> `invoice approve`

immediately finds:

```text
Finance → Invoices → Approve
```

---

# 22. POLICY BUILDER

Policies should use plain language first.

```text
Access Policy

Name:
Finance approval limit

WHEN
User has Finance Manager role

AND

Invoice amount is greater than GHS 25,000

THEN

Require approval from Finance Director
```

Advanced mode can reveal technical policy syntax.

---

# 23. ACCESS REVIEWS

Dashboard:

```text
Access Reviews

Quarterly Review
24 Finance users
7 privileged users
3 dormant users

[Continue review]
```

Review queue:

```text
Sarah Mensah
Finance Manager

Granted:
18 permissions

Used:
14

Last used:
Yesterday

Recommendation:
Keep access

[Keep] [Reduce] [Investigate]
```

---

# 24. ONBOARDING HOME

```text
Onboarding

42 people currently onboarding

Completion
██████████████░░ 78%

[Create journey]

Active journeys
────────────────────────────
New Employee
Founder
Admissions Staff
Finance Staff
```

KPIs:

```text
Completion Rate
Median Time
Drop-off
Pending Approvals
```

---

# 25. ONBOARDING JOURNEY BUILDER

The builder should resemble a lightweight workflow designer, not a technical BPM editor.

```text
New Employee Journey

START
  ↓
Profile
  ↓
Choose Workspace
  ↓
Accept Role
  ↓
Security Setup
  ↓
Manager Approval
  ↓
CRM Introduction
  ↓
COMPLETE
```

Each step is a card.

Clicking it opens a configuration drawer.

---

# 26. ONBOARDING STEP TYPES

```text
Profile
Form
Choose workspace
Choose team
Accept policy
MFA setup
Role assignment
Manager approval
Video / guide
Checklist
AI conversation
Automation
```

---

# 27. CONDITIONAL ONBOARDING

Example:

```text
IF Department = Finance
    → Finance policy step

IF Role = Administrator
    → MFA step

IF Workspace = Admissions
    → CRM onboarding step
```

Display this visually:

```text
Choose department
       ↓
 ┌─────┴─────┐
Finance      Sales
   ↓           ↓
Finance      CRM
Policy       Training
```

---

# 28. END-USER ONBOARDING UX

Normal users should never see the administrative journey builder.

Their experience:

```text
Welcome to SmartSapp

Hi Sarah 👋

Let's get your workspace ready.

3 things to complete
──────────────────────
✓ Personal profile
○ Confirm workspace
○ Complete security setup

[Continue]
```

---

# 29. ONBOARDING RESUME EXPERIENCE

When a user returns:

```text
Welcome back, Sarah.

You're 67% complete.

Continue where you left off:
Workspace setup

[Continue setup]
```

Never force the user to restart.

---

# 30. PENDING APPROVAL EXPERIENCE

Use a calm status experience rather than an alarming security page.

```text
Your access request is being reviewed.

Organization:
SmartSapp Admissions

Requested workspace:
Admissions

Requested role:
Admissions Officer

Submitted:
2 September, 10:42

✓ Profile complete
✓ Request submitted
○ Administrator approval
○ Workspace activation
```

Real-time status should update automatically.

---

# 31. INVITATION EXPERIENCE

Invitation email/SMS should deep-link to:

```text
You're invited to SmartSapp

SmartSapp
Admissions Workspace

Invited by:
John Mensah

Your role:
Admissions Officer

[Accept invitation]
```

After acceptance:

```text
Create your account
```

Then:

```text
Complete your profile
→ Security
→ Workspace
→ Ready
```

---

# 32. SECURITY CENTER

User profile > Security:

```text
Security

Account status
● Active

MFA
✓ Enabled

Password
Last changed 23 days ago

Active sessions
3

Recent security events
2

[Manage MFA]
[View sessions]
[Sign out other sessions]
```

---

# 33. SESSION MANAGEMENT

```text
Active sessions

Current device
Mac · Chrome
Accra
Active now

iPhone · Safari
Accra
2 hours ago

Windows · Chrome
Kumasi
Yesterday

[Sign out all other sessions]
```

---

# 34. ADMIN REAUTHENTICATION

Sensitive action:

```text
Confirm your identity

Changing administrator access requires re-authentication.

[Continue]
```

Then:

```text
Password
MFA code / Passkey

[Verify]
```

The normal UX should remain uninterrupted for low-risk operations.

---

# 35. OFFBOARDING FLOW

Click:

`Offboard user`

Do not immediately suspend.

Open an offboarding wizard:

```text
Offboard Sarah

Step 1
Access

Step 2
Work

Step 3
Sessions

Step 4
Communication

Step 5
Review
```

---

# 36. OFFBOARDING: WORK TRANSFER

This is essential for CRM.

```text
Sarah currently owns:

24 Leads
8 Deals
14 Tasks
7 Meetings
3 Automations

Transfer ownership to:

[ Select person ]

[Review transfer]
```

Items requiring manual decisions must be highlighted.

---

# 37. OFFBOARDING: ACCESS

```text
Access to be revoked:

Admissions Workspace
Marketing Workspace
Sales Manager role

CRM ownership transferred

All sessions revoked

[Continue]
```

---

# 38. OFFBOARDING: FINAL REVIEW

```text
Ready to offboard Sarah?

✓ 2 workspaces removed
✓ 2 roles revoked
✓ 24 leads transferred
✓ 8 deals transferred
✓ 14 tasks transferred
✓ 3 automations reassigned
✓ Sessions will be revoked

[Cancel] [Offboard user]
```

---

# 39. TEAM MANAGEMENT

Teams should be first-class.

```text
Teams

Admissions
12 people
Sales pipeline
Active

Marketing
8 people

Finance
6 people
```

Team detail:

```text
Members
Workload
Activity
CRM ownership
Access
Analytics
```

---

# 40. ORGANIZATION STRUCTURE

Use a lightweight visual org chart.

```text
Managing Director
        │
 ┌──────┼────────┐
Sales  Finance  Marketing
 │       │          │
Teams   Teams      Teams
```

Clicking a team opens its details.

This should not become a heavy HR system.

---

# 41. USER ANALYTICS

Main analytics screen:

```text
People Analytics

342 people

Active users         318
Activation rate      92%
7-day engagement     81%
30-day retention     87%

────────────────────────────────

Activity trend

████████████████████

Feature adoption

CRM          91%
Meetings     73%
Forms        64%
Automation   48%
Finance      39%
```

---

# 42. ADOPTION ANALYTICS

Focus on product adoption rather than vanity login metrics.

```text
Feature adoption

Users
├── Logged in
├── Activated
├── Used feature
├── Used repeatedly
└── Became proficient
```

This creates meaningful SmartSapp product intelligence.

---

# 43. TEAM ANALYTICS

```text
Team performance

Team       Users  Active  Tasks  Deals  Adoption
Admissions 12     11      164    48     91%
Finance     6      6       72     —     88%
Marketing   8      6       91     18     73%
```

Click team → detailed analysis.

---

# 44. ACCESS ANALYTICS

```text
Access health

Users with privileged access     27
Unused sensitive permissions     41
Dormant privileged users          3
Duplicate roles                    5
Access review completion          82%
```

---

# 45. SECURITY ANALYTICS

```text
Security

MFA adoption
████████████████░░ 87%

High-risk users
6

Failed login anomalies
12

Permission escalations
8

Active impersonation sessions
1
```

---

# 46. USER ACTIVITY

A user activity timeline should combine product activity with administrative events.

```text
Today

10:42
Updated Deal #428

10:20
Completed task "Follow up with parent"

09:54
Held meeting with Acme School

09:30
Logged into SmartSapp
```

Administrative events use a visually distinct category.

---

# 47. CRM USER INTELLIGENCE

User profile:

```text
CRM Performance

Leads
42 active

Deals
12 open

Tasks
18 overdue

Meetings
6 this week

Lead response
14m median

Pipeline value
GHS 428,000
```

This makes user management deeply connected to CRM operations.

---

# 48. WORKLOAD VIEW

```text
Team workload

Sarah     ████████████ 92%
Michael   ███████       58%
John      █████████     77%

AI:
Sarah may be overloaded.
12 tasks could be reassigned.
```

AI recommendations should always show evidence.

---

# 49. USER AI PANEL

Each user can have:

```text
AI Insights

Activation
Strong

CRM adoption
Excellent

Potential concern
5 overdue tasks

Recommendation
Redistribute 3 low-priority tasks.
```

The AI panel is advisory.

---

# 50. AI ADMIN COPILOT

Persistent access through the top-right AI button.

```text
Ask SmartSapp

"What do I need to know about my users?"

Suggested:
• Show inactive administrators
• Review Finance access
• Find incomplete onboarding
• Analyze team adoption
```

---

# 51. AI QUERY UX

User asks:

> Which Finance users haven't used Finance recently?

Response:

```text
I found 4 users.

3 have not used Finance in 60+ days.
1 has never used Finance.

[Review users]
[Start access review]
```

The response should include evidence and actions.

---

# 52. AI MUTATION UX

User:

> Remove Finance access from dormant users.

SmartSapp:

```text
I found 3 eligible users.

Before continuing:

• 3 users
• 8 permissions
• 1 workspace

This is a permission-changing action.

[Review changes]
```

Then:

```text
[Cancel] [Submit for approval]
```

Never execute high-risk mutations directly from conversational text.

---

# 53. AI ACCESS ADVISOR

Dedicated page:

```text
Access Advisor

12 recommendations

HIGH
3 users appear overprivileged

MEDIUM
7 unused permissions

LOW
2 duplicate roles
```

Each recommendation:

```text
Why?
Evidence
Impact
Suggested action
Required approval
```

---

# 54. AI ROLE RECOMMENDER

Inside role management:

```text
✨ Recommended roles

Based on actual user activity:

Admissions Officer
Similarity: 96%

Registrar
Similarity: 72%

Custom role
Similarity: 54%
```

This should use actual organizational context.

---

# 55. AUDIT CENTER

Audit should be understandable.

Filters:

```text
Actor
Target
Action
Resource
Workspace
Date
Severity
Approval
```

Example:

```text
09:42
Sarah Mensah
changed role

John Doe
Sales Executive → Sales Manager

Reason:
Promotion

Approved by:
Michael
```

---

# 56. GOVERNANCE APPROVALS

Approval center:

```text
Approvals

Pending 7

Role change      3
Tenant change    1
Sensitive export 2
Access change    1
```

Approval detail:

```text
Requested by:
Sarah

Operation:
Grant Finance Administrator

Impact:
3 users
2 workspaces

Risk:
High

[Reject] [Approve]
```

Requester must never approve their own request.

---

# 57. SUPPORT SANDBOX UX

When impersonating:

```text
┌─────────────────────────────────────────────────────────┐
│ ⚠ SUPPORT SANDBOX                                      │
│ Acting as support operator.                         │
│ Organization: Example Ltd                             │
│ Expires in 21:42                                      │
│ [Exit sandbox]                                        │
└─────────────────────────────────────────────────────────┘
```

Every page retains the banner.

---

# 58. MOBILE UX

Do not attempt to shrink desktop administration screens.

Mobile becomes:

```text
People
 ↓
Person
 ↓
Access
 ↓
Workspace
 ↓
Role
```

Cards replace wide tables.

Permission matrix:

```text
Deals
──────────────
View      ✓
Create    ✓
Edit      ✓
Delete    ✕
```

Bulk operations should be limited or deferred to desktop for high-risk changes.

---

# 59. RESPONSIVE BREAKPOINTS

## Large Desktop ≥ 1440px

Use:

```text
Navigation
Main content
Optional details rail
```

## Desktop 1200–1439px

Use:

```text
Navigation
Main content
Dialogs / drawers
```

## Tablet 768–1199px

Use:

```text
Collapsed navigation
Master/detail
```

## Mobile <768px

Use:

```text
List
→ Detail
→ Contextual actions
```

---

# 60. EMPTY STATES

Every feature needs useful empty states.

### Roles

```text
No custom roles yet.

Start with a SmartSapp role template or build your own.

[Browse templates]
```

### Access reviews

```text
No reviews are scheduled.

Set up your first quarterly access review.

[Create review]
```

### Analytics

```text
Not enough activity yet.

Analytics will appear as your team starts using SmartSapp.
```

---

# 61. LOADING STATES

Prefer structural skeletons over spinners.

For a user profile:

```text
Avatar skeleton
Name skeleton
Tabs skeleton
Card skeletons
```

Actions show local progress:

```text
Assigning role…
```

not:

```text
Loading…
```

---

# 62. ERROR UX

Errors should state:

```text
What happened
What was preserved
What to do next
```

Example:

```text
Role assignment could not be completed.

Sarah's existing access is unchanged.

[Retry]
```

For partial success:

```text
8 users updated.
2 users could not be updated.

[Review failures]
```

---

# 63. NOTIFICATION UX

Use in-app confirmation for routine actions:

```text
Role assigned to Sarah.
```

For significant changes:

```text
Access updated

Sarah now has Sales Manager access in Admissions.

View user
```

---

# 64. DESIGN SYSTEM

Use SmartSapp's existing visual identity while maintaining a restrained enterprise administrative style.

### Primary

SmartSapp Blue:

`#3A86FF`

### Typography

Use the existing SmartSapp type system consistently.

Primary recommendation:

* Figtree for UI density
* Poppins for prominent product headings
* Didact where editorial/presentation character is useful

Do not mix all three indiscriminately.

---

# 65. VISUAL LANGUAGE

The system should feel:

```text
Clean
Calm
Structured
Professional
Trustworthy
Approachable
```

Avoid:

```text
overly technical dashboards
dense permission tables
excessive gradients
excessive animation
security-theatre visuals
```

---

# 66. MOTION

Motion should communicate state, not decorate.

Useful:

```text
Panel transitions
Role assignment confirmation
Approval status changes
Onboarding progress
Live status updates
```

Avoid:

```text
constant pulsing
large animated canvases
long transitions
```

The current ambient WebGL treatment should be restricted to suitable onboarding/marketing contexts, not dense administrative screens.

---

# 67. PHASED IMPLEMENTATION MODEL

The UI/UX and backend should be delivered together.

The following phases deliberately map **architecture + UI + UX + dependencies**.

---

# PHASE 0 — DESIGN & ARCHITECTURE FOUNDATION

## Objective

Prepare the existing system without disrupting production.

### Backend

```text
Identity audit
Membership model
Event taxonomy
Authorization inventory
Data mapping
Legacy compatibility map
```

### UI

Build:

```text
Admin shell
Page header
Table system
Filter system
Drawer
Side sheet
Confirmation dialog
Impact preview
Status system
Empty states
Skeletons
```

### UX Deliverables

```text
Design tokens
Component library
Navigation model
Accessibility baseline
Responsive rules
Interaction patterns
```

### Success condition

Every future identity feature uses one consistent interaction model.

---

# PHASE 1 — IDENTITY & MEMBERSHIP FOUNDATION

## Backend

Introduce:

```text
Account
Person
OrganizationMembership
WorkspaceMembership
Session
```

Retain the existing `UserProfile` as compatibility projection.

## UI

### People

* People Directory
* Person Profile
* Organization Membership
* Workspace Membership
* Status management

### New screens

```text
/admin/people
/admin/people/[id]
/admin/people/[id]/access
```

## UX

Current users should see no disruptive change.

Admins gain clearer membership information.

---

# PHASE 2 — ACCESS 2.0

## Backend

Introduce:

```text
Role
RoleAssignment
Permission
Policy
Scope
AuthorizationDecision
PermissionSnapshot
AccessVersion
```

## UI

```text
Roles
Role Detail
Role Builder
Permission Explorer
Role Simulator
Access Explanation
```

## UX

The existing workspace access dialog becomes the new:

**Access Manager**

---

# PHASE 3 — PEOPLE & ACCESS HUB

## Backend

Implement:

```text
Invitation lifecycle
Membership lifecycle
Bulk operations
Ownership relationships
Access versioning
```

## UI

```text
People Overview
People Directory
Invitations
Requests
Teams
Departments
User Profile
Bulk Operations
```

## Major UX capability

**One user profile becomes the central administrative workspace.**

---

# PHASE 4 — ONBOARDING ENGINE

## Backend

Implement:

```text
OnboardingJourney
OnboardingStep
OnboardingInstance
Conditions
Approvals
Journey versioning
```

## UI

```text
Onboarding Home
Journey Library
Journey Builder
Journey Detail
Active Onboarding
Onboarding Analytics
```

## User UX

```text
Invitation
→ Account
→ Profile
→ Adaptive journey
→ Approval
→ Activation
```

This phase replaces the hard-coded onboarding journey progressively.

---

# PHASE 5 — GOVERNANCE & SECURITY

## Backend

Implement:

```text
Access Reviews
Role versioning
Policy engine
Temporary access
Separation of duties
MFA enforcement
Session management
Organization audit
```

## UI

```text
Governance
Security Center
Access Reviews
Approvals
Audit
Sessions
Policies
```

## UX

High-risk actions receive:

```text
Impact
Re-authentication
Approval
Audit
```

---

# PHASE 6 — EVENT & ANALYTICS FOUNDATION

## Backend

Implement:

```text
Platform events
Event ingestion
Activity projections
Analytics aggregation
User metrics
Team metrics
Access metrics
```

## UI

```text
People Analytics
Adoption
Engagement
Team Analytics
Access Analytics
Security Analytics
```

## Important UX improvement

Turn "last active" into a meaningful picture of adoption.

---

# PHASE 7 — CRM-AWARE PEOPLE INTELLIGENCE

## Backend

Connect users to:

```text
Lead ownership
Contact ownership
Deal ownership
Task assignment
Meeting responsibility
Campaign ownership
Automation ownership
```

Build:

```text
OwnershipTransferService
```

## UI

Add to user profiles:

```text
CRM
Workload
Pipeline
Tasks
Meetings
Performance
```

## Offboarding

Cannot complete until required CRM ownership is resolved.

This phase creates one of the strongest SmartSapp differentiators.

---

# PHASE 8 — AI ASSISTANCE

## Backend

Implement:

```text
AI Identity Context
AI authorization-aware retrieval
Recommendation engine
Risk model
Role recommendation
Access advisor
```

## UI

```text
AI Copilot
Access Advisor
Role Recommendations
Onboarding AI
User Insights
```

## UX

AI must explain every recommendation.

---

# PHASE 9 — AI-ASSISTED ADMINISTRATION

Expand from recommendations into controlled actions:

```text
AI
 ↓
Proposed action
 ↓
Impact preview
 ↓
Authorization
 ↓
Approval
 ↓
Execution
 ↓
Audit
```

UI:

```text
AI Command Center
```

Example:

> “Prepare a review of all inactive Finance administrators.”

The system generates the review, but administrator approval remains explicit.

---

# PHASE 10 — ENTERPRISE IDENTITY

## Backend

```text
MFA
Passkeys
SAML
OIDC
SCIM
Directory synchronization
```

## UI

```text
Authentication
Identity Providers
MFA Policy
Session Policy
Directory Sync
Provisioning
```

## UX

For supported enterprise organizations:

```text
Work email
    ↓
Organization SSO
    ↓
Identity verified
    ↓
SmartSapp membership
```

---

# PHASE 11 — WORKFORCE INTELLIGENCE

## Backend

Add:

```text
User health
Team utilization
Role effectiveness
Capacity
Permission usage
Workload intelligence
```

## UI

```text
Workforce Overview
User Health
Team Intelligence
Role Intelligence
Permission Intelligence
```

AI evolves from:

```text
Assistant
```

to:

```text
Organizational intelligence layer
```

---

# 68. COMPLETE PHASE-TO-UI/UX MAPPING

| Phase | Backend Capability      | Primary UI                | Primary UX                       |
| ----- | ----------------------- | ------------------------- | -------------------------------- |
| 0     | Architecture foundation | Design system/Admin shell | Consistency                      |
| 1     | Identity + Membership   | People/Profile            | Simple people management         |
| 2     | RBAC 2.0                | Roles/Access              | Guided access configuration      |
| 3     | People Hub              | Directory/Invites/Teams   | Fast workforce administration    |
| 4     | Onboarding engine       | Journey Builder           | Adaptive onboarding              |
| 5     | Governance              | Policies/Reviews/Audit    | Safe privileged operations       |
| 6     | Events/Analytics        | Analytics                 | Understand adoption              |
| 7     | CRM integration         | User CRM/Workload         | Connect people to work           |
| 8     | AI foundation           | AI Copilot                | Explain and recommend            |
| 9     | AI actions              | AI Command Center         | Governed automation              |
| 10    | SSO/SCIM/MFA            | Enterprise Security       | Seamless enterprise identity     |
| 11    | Workforce intelligence  | Intelligence dashboards   | Optimize people, access and work |

---

# 69. SCREEN DELIVERY MAP BY PHASE

## Phase 0

```text
Admin Shell
Global Search
Notification Center
Global Dialog System
Design System
```

## Phase 1

```text
People Overview
People Directory
Person Profile
Membership
Workspace Access
```

## Phase 2

```text
Roles
Role Detail
Role Builder
Permission Explorer
Role Simulator
Access Explanation
```

## Phase 3

```text
Invitations
Approval Requests
Teams
Departments
Bulk People Management
```

## Phase 4

```text
Onboarding Dashboard
Journey Library
Journey Builder
Journey Detail
Active Onboarding
```

## Phase 5

```text
Security Center
Access Reviews
Policy Builder
Approval Center
Audit Center
Sessions
```

## Phase 6

```text
People Analytics
Adoption
Engagement
Teams
Access
Security
```

## Phase 7

```text
CRM User Profile
Workload
Ownership
Transfers
User Productivity
```

## Phase 8

```text
AI Copilot
Access Advisor
Role Recommendations
Onboarding Assistant
```

## Phase 9

```text
AI Command Center
Action Preview
Approval Preview
AI History
```

## Phase 10

```text
SSO
MFA
Identity Providers
SCIM
Enterprise Provisioning
```

## Phase 11

```text
Workforce Intelligence
Team Intelligence
Role Intelligence
Permission Intelligence
```

---

# 70. CROSS-MODULE INTEGRATION UX

Identity should not feel isolated.

For CRM:

```text
Deal
Owner: Sarah Mensah

[View user]
[Change owner]
```

For Finance:

```text
Invoice
Approver: Michael

[View access]
```

For Meetings:

```text
Meeting owner
Sarah
```

For Automations:

```text
Created by
John

Owner
Marketing Team
```

For Forms:

```text
Editors
3 users
```

Every module should use the same People / Access components.

---

# 71. GLOBAL "SELECT USER" EXPERIENCE

Build one reusable SmartSapp People Picker.

Features:

```text
Search name/email
Department
Team
Role
Availability
Status
Avatar
```

Example:

```text
Assign owner

[Search people...]

Sarah Mensah
Admissions · Sales Manager
● Active

Michael Owusu
Finance · Finance Manager
● Active
```

This becomes a shared component throughout SmartSapp.

---

# 72. GLOBAL "SELECT ROLE" EXPERIENCE

Likewise:

```text
Choose role

Recommended
Sales Manager
Best fit

Templates
Admissions Officer
Finance Officer
Marketing Manager

Custom
Build custom role
```

---

# 73. GLOBAL ACCESS SUMMARY COMPONENT

Any SmartSapp module should be able to display:

```text
Access
✓ Can edit
✓ Workspace: Admissions
✓ Scope: Admissions Team

[Why?]
```

This removes inconsistent permission UX across products.

---

# 74. GLOBAL USER ACTION DRAWER

Clicking a person's avatar anywhere can open:

```text
Sarah Mensah

Admissions Manager

[View profile]

CRM
12 deals
18 tasks

Access
Sales Manager · Admissions

Activity
Active today
```

This makes the identity platform pervasive without making it intrusive.

---

# 75. DESIGN PRINCIPLE: NEVER MAKE USERS UNDERSTAND THE DATA MODEL

Do not expose concepts such as:

```text
OrganizationMembership
PermissionSnapshot
AccessVersion
RoleAssignment
AuthorizationDecision
```

to standard users.

Translate them into:

```text
Organization
Team
Workspace
Role
Access
```

Technical details appear only in expert administrative tools.

---

# 76. DESIGN PRINCIPLE: EVERY COMPLEX ACTION GETS A PREVIEW

Examples:

### Role changes

> 12 people affected.

### Workspace change

> 2 dashboards and 3 automations will become unavailable.

### Offboarding

> 48 CRM records require reassignment.

### Permission policy

> 17 users will lose export access.

This creates administrative confidence.

---

# 77. DESIGN PRINCIPLE: EVERY AI RECOMMENDATION GETS AN EXPLANATION

Never display:

> AI recommends removing this access.

Instead:

```text
Why?

• Permission unused for 120 days
• User's peers do not have it
• User's role does not normally require it
• Permission is security-sensitive

Confidence: 91%
```

---

# 78. DESIGN PRINCIPLE: MAKE THE SAFE PATH THE FASTEST PATH

The administrator should naturally follow:

```text
Recommended role
        ↓
Recommended scope
        ↓
Impact preview
        ↓
Confirm
```

rather than:

```text
100 checkboxes
        ↓
Guess
        ↓
Save
```

---

# 79. DESIGN PRINCIPLE: ADMINISTRATORS NEED CONFIDENCE, NOT POWER

Good enterprise UX does not maximize the number of controls visible.

It maximizes:

```text
Understanding
Predictability
Reversibility
Traceability
Safety
Speed
```

---

# 80. FINAL TARGET UX

The mature SmartSapp experience should feel like this:

```text
ADMIN OPENS SMARTSAPP
        ↓
"People & Access"
        ↓
Sees team health immediately
        ↓
Clicks Sarah
        ↓
Understands her role and activity
        ↓
Sees exact effective access
        ↓
Understands WHY she has access
        ↓
Can change it safely
        ↓
Gets impact preview
        ↓
Approval if necessary
        ↓
Change executes
        ↓
Audit recorded
        ↓
Analytics updated
        ↓
AI learns from the event
```

And for a new employee:

```text
INVITATION
    ↓
ACCEPT
    ↓
IDENTITY
    ↓
PROFILE
    ↓
ADAPTIVE ONBOARDING
    ↓
WORKSPACE
    ↓
ROLE
    ↓
SECURITY
    ↓
APPROVAL
    ↓
ACTIVATION
    ↓
FIRST CRM ACTION
    ↓
ONGOING ENGAGEMENT
    ↓
USER INTELLIGENCE
```

This produces a coherent end-to-end experience rather than separate "Users", "Roles", "Onboarding", "Permissions" and "Analytics" features.

# 81. PRODUCT SUCCESS CRITERIA

The UI/UX implementation should be judged against these targets:

### Add a new person

A normal administrator should be able to invite and provision a standard user without understanding RBAC.

### Change access

An administrator should understand exactly what changes before committing.

### Understand access

A user permission should be explainable in one or two clicks.

### Offboard

A departing user should never leave orphaned CRM work.

### Build a role

A sophisticated administrator should be able to create one without engineering help.

### Review access

An organization should be able to conduct an access review without exporting spreadsheets.

### Understand adoption

Managers should be able to see whether people are actually using SmartSapp.

### Use AI safely

AI should accelerate administration without becoming an uncontrolled authorization mechanism.

# 82. FINAL IMPLEMENTATION PRINCIPLE

The biggest architectural and UX mistake would be to build each of these as independent pages.

Instead, SmartSapp should build a **shared Identity Experience System**:

```text
People
     ↓
Membership
     ↓
Workspace
     ↓
Role
     ↓
Permission
     ↓
Policy
     ↓
Entitlement
     ↓
Activity
     ↓
Analytics
     ↓
AI
```

Every SmartSapp product then consumes the same system.

That means a user is not merely an account in SmartSapp. The system understands that person's:

**identity, organization, team, workspace, role, access, responsibilities, CRM ownership, activity, adoption, security posture and AI-derived operational context.**

That is the foundation that will allow SmartSapp to scale from a CRM with user administration into a genuinely **industry-grade business operating platform with a unified identity and workforce layer.**

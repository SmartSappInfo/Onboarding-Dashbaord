Absolutely. For the Deals 2.0 direction we just defined, I would **not treat this as a visual redesign of the existing Kanban**. The UI needs to evolve into a complete **revenue workspace**: fast for sales reps, information-dense for managers, configurable for admins, and AI-native without becoming cluttered.

# SmartSapp CRM — Deals 2.0

## Pro-Level UI/UX Enhancement & Design System Plan

**Design objective:** Transform Deals from a pipeline screen into an **industry-grade Deal Operating System**.

---

# 1. Design North Star

The primary question the UI should answer is:

> **“What should I know, and what should I do next, to move this deal forward?”**

The interface therefore needs four layers:

```text
┌─────────────────────────────────────────────────────────┐
│ 1. ORIENT                                               │
│ Where am I? Which pipeline? What is happening?          │
├─────────────────────────────────────────────────────────┤
│ 2. UNDERSTAND                                            │
│ What is this deal worth? Who is involved? What's wrong? │
├─────────────────────────────────────────────────────────┤
│ 3. ACT                                                   │
│ What should I do next?                                  │
├─────────────────────────────────────────────────────────┤
│ 4. ANALYZE                                               │
│ What patterns, risks and revenue opportunities exist?   │
└─────────────────────────────────────────────────────────┘
```

This should drive the entire design.

---

# 2. The Core UX Model

I recommend four primary Deal experiences:

```text
                 DEALS
                   │
       ┌───────────┼───────────┐
       │           │           │
     BOARD       TABLE       FORECAST
       │           │           │
       └──────┬────┴────┬──────┘
              │         │
              ▼         ▼
           DEAL WORKSPACE
                  │
        ┌─────────┼─────────┐
        │         │         │
      ACTIVITY   AI      COMMERCIAL
```

### Board

For **moving deals**.

### Table

For **managing large datasets**.

### Forecast

For **management and revenue planning**.

### Deal Workspace

For **working an individual opportunity**.

---

# 3. Global Deals Navigation

I would restructure the Deals section.

```text
Deals

Overview
Pipeline
My Deals
All Deals
Forecast
Analytics
────────────────
Settings
  Pipelines
  Stages
  Fields
  Products
  Automation
  Scoring
  AI
```

Don't make users navigate through configuration to perform normal sales work.

---

# 4. Deals Overview

Create a new **Deals Command Center**.

Instead of immediately landing users on Kanban, give them a business overview.

### Header

```text
Deals

Good afternoon, [Name]

Your pipeline has GHS 1.84M across 47 active opportunities.

[ + Create Deal ]   [ Import ]   [ Customize ]
```

Below:

```text
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Pipeline     │ Weighted     │ Won          │ Win Rate     │
│ GHS 1.84M    │ GHS 742K     │ GHS 318K     │ 34.8%        │
│ +12.4%       │ +8.1%        │ +16.3%       │ +4.2%        │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

Then:

```text
Pipeline Health

████████████████████░░░  Healthy

47 active deals
8 at risk
4 stalled
6 closing this week
```

---

# 5. The "Attention Required" Panel

This is one of the most important UX improvements.

Instead of making users inspect 50 deals, surface what needs attention.

```text
Attention Required

🔴 3 deals have breached their stage SLA
🟠 5 deals have no next step
🟠 2 high-value deals have gone inactive
🟡 4 deals close within 7 days
```

Clicking the item opens the appropriate filtered Deal view.

This turns Deals into a **decision-support interface** rather than a database.

---

# 6. Pipeline Workspace

The primary workspace should look approximately like:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Deals / New Business                              + Create Deal │
│                                                                 │
│ [Board] [Table] [Forecast]                 Search   Filter ⚙   │
├─────────────────────────────────────────────────────────────────┤
│ My Deals ▼   │  Filters: All ▾   Owner ▾   Health ▾   Date ▾    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ QUALIFICATION   DISCOVERY      PROPOSAL       NEGOTIATION       │
│ GHS 320K         GHS 580K       GHS 410K       GHS 530K          │
│ 12 deals        15 deals        9 deals         7 deals          │
│                                                                 │
│ ┌───────────┐   ┌───────────┐  ┌───────────┐   ┌───────────┐    │
│ │ Deal      │   │ Deal      │  │ Deal      │   │ Deal      │    │
│ │ Acme      │   │ School A  │  │ School B  │   │ School C  │    │
│ │ GHS 45K   │   │ GHS 80K   │  │ GHS 120K  │   │ GHS 200K  │    │
│ │ ● Healthy │   │ ⚠ Risk    │  │ ● Healthy │   │ 🔴 Stalled│    │
│ └───────────┘   └───────────┘  └───────────┘   └───────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

# 7. Board Design

The existing Kanban should become significantly more sophisticated while retaining its optimistic drag-and-drop behavior. The current implementation already has optimistic movement and rollback, so this is an enhancement rather than a redesign of the underlying interaction model. 

## Stage header

Each stage should show:

```text
Proposal

9 deals
GHS 410,000
Weighted GHS 295,000

Avg. age 6.4 days
```

Optional mini indicators:

```text
↑ 12%
⚠ 2 at risk
```

---

# 8. Deal Card Design

This is where I would make a major improvement.

### Recommended card

```text
┌───────────────────────────────────┐
│ ○  Acme International School      │
│                                   │
│ GHS 120,000                       │
│ 70% probability                   │
│                                   │
│ 🏢 Acme International             │
│ 👤 Kwame Mensah                   │
│                                   │
│ Next: Proposal review             │
│ Tomorrow · 10:30                  │
│                                   │
│ ● Healthy      4d in stage        │
└───────────────────────────────────┘
```

---

# 9. Card Hierarchy

Do not show every field.

### Priority 1

* Deal name
* Value
* Account

### Priority 2

* Owner
* Next step
* Close date

### Priority 3

* Health
* Stage age
* Probability

Everything else should be accessible through hover/detail.

---

# 10. Deal Health Visual Language

I recommend avoiding excessive color.

Use a small health indicator:

```text
● Healthy
● At Risk
● Stalled
● Critical
```

Use color only for meaningful exceptions.

Normal cards should remain visually calm.

---

# 11. Card Interaction

Hover:

```text
┌──────────────────────────┐
│ Deal                     │
│                          │
│ [Open] [Call] [Email]    │
│ [Task] [More]            │
└──────────────────────────┘
```

Click:

**Open Deal Workspace**

Drag:

**Move stage**

Keyboard:

**Open / move / action**

---

# 12. Drag-and-Drop UX

When dragging:

### Don't show only a dotted placeholder.

Show a realistic card preview.

```text
        ┌───────────────────────┐
        │ Acme International     │
        │ GHS 120,000            │
        │ 70% · Healthy          │
        └───────────────────────┘
                  ↓
        ┌───────────────────────┐
        │     PROPOSAL          │
        │   Drop deal here      │
        └───────────────────────┘
```

The destination stage should visibly react.

If the stage has requirements:

```text
Proposal

✓ Primary contact
✓ Deal value
⚠ Proposal document required
```

This is much better than allowing the drop and displaying an error afterward.

---

# 13. Table View

For power users, the table becomes extremely important.

Recommended:

```text
┌────┬──────────────┬──────────┬────────┬──────────┬──────────┐
│ □  │ Deal         │ Account  │ Value  │ Stage    │ Health   │
├────┼──────────────┼──────────┼────────┼──────────┼──────────┤
│ □  │ Acme         │ Acme     │ 120K   │ Proposal │ ●        │
│ □  │ Greenfield   │ Greenfld │ 85K    │ Discovery│ ⚠        │
│ □  │ Bright Kids  │ Bright   │ 200K   │ Negot.   │ ●        │
└────┴──────────────┴──────────┴────────┴──────────┴──────────┘
```

Allow:

* Resize
* Reorder
* Pin
* Hide
* Sort
* Group
* Inline edit

---

# 14. Saved Views

Place saved views prominently.

```text
My Views

⭐ My Deals
🔥 Closing This Month
⚠ At Risk
💰 High Value
🕐 Stalled
🏆 Won This Quarter
```

Users should be able to create their own.

---

# 15. Advanced Filter Builder

Avoid a giant filter dropdown.

Use:

```text
Filters

Stage       is       Proposal
AND
Value       greater than   GHS 50,000
AND
Health      is             At Risk
```

Advanced:

```text
(Owner = Me OR Owner = Team A)
AND
Value > GHS 50K
AND
(
  Health = At Risk
  OR
  Stage Age > 7 days
)
```

---

# 16. Deal Workspace — Major Redesign

This should be the **hero experience**.

I recommend a three-column layout on desktop.

```text
┌──────────────────────────────────────────────────────────────────┐
│ ← Deals / Proposal                                               │
│                                                                  │
│ Acme International School                         ● At Risk      │
│ GHS 120,000 · 70% · Expected Sep 12                              │
│                                                                  │
│ [Move Stage] [Add Task] [Message] [More]                         │
├──────────────────┬────────────────────────────────┬──────────────┤
│                  │                                │              │
│ DEAL CONTEXT     │ ACTIVITY                       │ AI           │
│                  │                                │              │
│ Account          │ Timeline                       │ Deal Health  │
│ Contact          │                                │              │
│ Owner            │ Emails                         │ Risk         │
│ Pipeline         │ Calls                          │              │
│                  │ Meetings                       │ Next Action │
│                  │ Notes                          │              │
│                  │ Tasks                          │              │
└──────────────────┴────────────────────────────────┴──────────────┘
```

---

# 17. Deal Header

The header needs to communicate the entire commercial state immediately.

```text
Acme International School

● At Risk

GHS 120,000
70% probability
Proposal
Expected close: Sep 12

Owner: Ama Mensah
```

Actions:

```text
[Move Stage]
[Add Activity]
[Create Task]
[Send Message]
[More]
```

---

# 18. Stage Progress Bar

Under the header:

```text
Qualification ── Discovery ── Demo ── Proposal ── Negotiation ── Won
                                      ▲
                                   CURRENT
```

Make completed stages clickable.

Current stage should be visually dominant.

---

# 19. Stage Transition Interaction

Clicking the stage should open:

```text
Move Deal

Current:
Proposal

Move to:
○ Negotiation
○ Won
○ Lost

Requirements

✓ Decision maker identified
✓ Proposal sent
⚠ Contract not uploaded

[Move Deal]
```

This is substantially safer than an uncontrolled dropdown.

---

# 20. Deal Information Panel

Use categorized information rather than a giant form.

### Commercial

```text
Deal value
Probability
Forecast
MRR
ARR
TCV
```

### Timing

```text
Created
Expected close
Deal age
Stage age
```

### Ownership

```text
Owner
Team
Source
Campaign
```

---

# 21. Inline Editing

Avoid "Edit Deal" for everything.

Allow click-to-edit:

```text
Value      GHS 120,000   ✎
Probability 70%          ✎
Close Date Sep 12        ✎
Owner      Ama Mensah    ✎
```

Save automatically where safe.

Use confirmation only for consequential changes.

---

# 22. Activity Timeline

This should be visually excellent.

Example:

```text
TODAY

10:32 AM
✉ Email sent
Proposal — Acme International

09:15 AM
📝 Task completed
"Confirm decision maker"

YESTERDAY

3:40 PM
📞 Call completed
Duration: 18 min
Outcome: Positive

MONDAY

11:20 AM
● Stage changed
Discovery → Proposal
```

---

# 23. Timeline Filters

```text
All
Emails
Calls
Meetings
Tasks
Notes
Documents
Stage Changes
AI
```

---

# 24. Activity Composer

At the top of the timeline:

```text
Add activity

[Note] [Email] [Call] [Meeting] [Task]

What happened?

[Write a note...]

                         [Add Activity]
```

This should become the fastest way to update the CRM.

---

# 25. Next-Step Module

Make this highly visible.

```text
NEXT STEP

Schedule proposal review

Tomorrow · 10:30 AM

[Complete] [Reschedule] [Edit]
```

If no next step exists:

```text
⚠ No next step

Deals with a defined next step are easier to progress.

[Add Next Step]
```

This is an excellent behavioral nudge.

---

# 26. AI Side Panel

AI should not dominate the interface.

Use a compact intelligence panel.

```text
✨ Deal Intelligence

Health
AT RISK

Win probability
74%

Top risk
No decision-maker meeting

Recommended action
Schedule a proposal review with the
decision maker.

[Create Task]
```

---

# 27. AI Expand Mode

Click:

**View AI Analysis**

Opens a dedicated intelligence workspace.

```text
Deal Intelligence

Summary
Stakeholders
Risk
Signals
Probability
Next Best Actions
Forecast
```

---

# 28. AI Risk Cards

Example:

```text
⚠ Decision Maker Risk

The primary decision maker has not
participated in the last 3 activities.

Impact
High

Recommended action
Request a decision-maker meeting.

[Create Task]
```

---

# 29. AI Confidence

Every prediction should show confidence:

```text
Win probability

74%

High confidence
```

or:

```text
61%

Medium confidence
```

Don't falsely imply precision.

---

# 30. Stakeholder Map

This is an important pro-level feature.

```text
Stakeholders

       Decision Maker
             │
        Kwame Mensah
             │
     ┌───────┴───────┐
     │               │
   Champion        Finance
   Ama K.          Kofi A.
     │
   Contact
```

Each person:

```text
Name
Role
Influence
Sentiment
Engagement
Last interaction
```

---

# 31. Commercial Tab

Create a dedicated commercial workspace.

```text
Products & Services

┌───────────────────────────────────────────────────────────┐
│ SmartSapp Enterprise                         GHS 80,000   │
│ 200 students × subscription                              │
├───────────────────────────────────────────────────────────┤
│ Implementation                                GHS 25,000 │
├───────────────────────────────────────────────────────────┤
│ Training                                      GHS 15,000 │
└───────────────────────────────────────────────────────────┘

Subtotal                                      GHS 120,000
Discount                                            GHS 0
Tax                                                  ...
───────────────────────────────────────────────────────────
Total                                         GHS 120,000

[+ Add Product]
```

---

# 32. Quote UX

Quote section:

```text
Quote #Q-1024

GHS 120,000

Draft
```

Timeline:

```text
Created
Sent
Viewed
Accepted
```

Actions:

```text
[Preview]
[Send]
[Duplicate]
[More]
```

---

# 33. Forecast Workspace

The Forecast page should not simply be a table.

Top:

```text
September Forecast

Pipeline              GHS 2.4M
Best Case             GHS 1.2M
Commit                GHS 780K
Won                   GHS 320K
```

Then:

```text
Forecast
────────────────────────────────────────────

Commit                GHS 780K
████████████████████

Best Case             GHS 1.2M
██████████████████████████

Pipeline              GHS 2.4M
████████████████████████████████████
```

---

# 34. Forecast Risk

Below:

```text
Forecast Risks

🔴 GHS 180K
High-risk commit deals

🟠 GHS 240K
Deals closing within 14 days

🟡 GHS 310K
Deals without next steps
```

---

# 35. Analytics UX

Don't start with 20 charts.

Use a hierarchy.

### Executive

```text
Revenue
Pipeline
Win Rate
Forecast
```

### Management

```text
Conversion
Velocity
Rep performance
Stage bottlenecks
```

### Operations

```text
Stalled
SLA
Activity
Data quality
```

---

# 36. Pipeline Analytics

Visual:

```text
Pipeline Conversion

100%  Qualification
 │
 ├──────── 72%
 │
 ├──────── 51%
 │
 ├──────── 38%
 │
 └──────── 27% Won
```

Then:

```text
Average time per stage

Qualification   3.2d
Discovery       5.8d
Proposal        8.4d  ⚠
Negotiation     4.1d
```

---

# 37. Configuration UX

This needs a completely separate administration experience.

```text
Deal Settings

Pipelines
Stages
Fields
Views
Products
Forecasting
Scoring
Automation
Notifications
Permissions
AI
```

Do not mix these controls into the normal sales interface.

---

# 38. Pipeline Builder UI

Use a visual process editor.

```text
New Business

┌───────────────┐
│ Qualification │
│ 20%           │
│ SLA: 3 days   │
└───────┬───────┘
        ↓
┌───────────────┐
│ Discovery     │
│ 40%           │
│ SLA: 7 days   │
└───────┬───────┘
        ↓
┌───────────────┐
│ Proposal      │
│ 70%           │
│ SLA: 5 days   │
└───────────────┘
```

Click stage:

**Configuration drawer opens.**

---

# 39. Stage Configuration Drawer

```text
Proposal

General
Probability: 70%

Requirements

Required fields
☑ Deal value
☑ Expected close
☑ Decision maker

Required activities
☑ Proposal sent

SLA
Target: 5 days
Warning: 4 days

Automation
2 rules

AI
☑ Enable stage intelligence
```

---

# 40. Custom Field Builder

Use a field-builder pattern.

```text
Deal Fields

+ Add Field

Field Name
Type
Required
Visible in Board
Visible in Table
Filterable
Reportable
AI Context
Automation
```

This is much better than hard-coded forms.

---

# 41. Automation Builder

Use the same SmartSapp automation canvas language across the platform.

```text
WHEN
Deal enters Proposal
       ↓
IF
Value > GHS 50,000
       ↓
THEN
Create Manager Approval Task
       ↓
AND
Notify Sales Manager
```

---

# 42. Natural Language Automation

Add:

```text
✨ Describe an automation

"When a high-value deal has been inactive
for 5 days, alert the owner."

[Generate Automation]
```

AI creates the rule visually.

The user reviews before publishing.

---

# 43. Empty States

Empty states should educate.

Example:

```text
No deals yet

Your pipeline is ready.

Create your first opportunity and start
tracking revenue from qualification to close.

[Create Deal]
```

Avoid generic:

> No data found.

---

# 44. Loading States

Use skeletons rather than spinners everywhere.

Board:

```text
┌──────────┐
│ ░░░░░░░  │
│ ░░░░     │
│ ░░░░░░   │
└──────────┘
```

Detail:

Skeleton header + timeline + AI card.

---

# 45. Error States

Errors must explain recovery.

Bad:

> Something went wrong.

Good:

> We couldn't move this deal to Negotiation because the stage requires a decision maker.

```text
[Review Requirements]
```

---

# 46. Confirmation Design

Don't use confirmation dialogs for every action.

### Immediate

* Add note
* Change owner
* Update probability

### Confirm

* Delete
* Merge
* Bulk delete
* Mark Won
* Mark Lost

---

# 47. Bulk Action Bar

When selecting deals:

```text
7 deals selected

[Assign]
[Move Stage]
[Update]
[Create Task]
[Message]
[Export]
[More]
```

Persistent bottom toolbar is ideal for this.

---

# 48. Search UX

Global search should feel instant.

```text
Search Deals

⌕ Acme

Deals
Acme International
GHS 120K
Proposal

Contacts
Kwame Mensah

Accounts
Acme International School
```

Keyboard shortcut:

**⌘/Ctrl + K**

---

# 49. Command Palette

I strongly recommend this for the mature version.

```text
⌘ K

Search or jump to...

Create Deal
Search Deals
My Pipeline
Forecast
At Risk Deals
Create Task
Open Reports
```

Power users will love this.

---

# 50. Keyboard Shortcuts

Examples:

```text
C     Create deal
/     Search
K     Command palette
B     Board
T     Table
F     Filter
N     Add note
```

Don't overload the system with shortcuts; document them in the command palette.

---

# 51. Design System

Use SmartSapp's existing brand direction:

**Primary:** `#3A86FF`

Typography:

* Poppins
* Figtree
* Didact where appropriate

I would use:

### Figtree

Primary application UI.

### Poppins

Marketing / prominent headings.

### Didact

Selective supporting display usage.

---

# 52. Visual Style

The Deals platform should have:

### Cards

Moderate radius:

**10–14px**

### Buttons

**8–10px**

### Inputs

**8px**

### Modals

**14–18px**

Avoid making every element excessively rounded.

The product should feel like an enterprise application, not a consumer social app.

---

# 53. Spacing System

Use an 8-point base system.

```text
4
8
12
16
24
32
40
48
64
```

Primary content padding:

**24px**

Dense table:

**12–16px**

Large section:

**32px**

---

# 54. Color Semantics

Use a restrained semantic system.

```text
Primary      Action
Success      Won / healthy
Warning      At risk
Danger       Lost / critical
Neutral      Informational
```

Do not color entire cards based on health.

Use:

* indicator
* badge
* icon
* subtle border

---

# 55. Typography Hierarchy

Example:

```text
Deal title
20px / 600

Section heading
14–16px / 600

Body
14px / 400

Metadata
12–13px / 400

Financial number
20–28px / 600
```

Financial figures should be visually prominent.

---

# 56. Financial Formatting

Always distinguish:

```text
GHS 120,000
```

from:

```text
70%
```

and:

```text
GHS 84,000 weighted
```

Use tabular numerals for financial tables where possible.

---

# 57. Responsive Architecture

### Desktop

Three-column Deal Workspace.

### Tablet

Two columns.

```text
Context
Activity

AI → drawer
```

### Mobile

Single-column:

```text
Header
Stage
Value
Next step
Activity
AI
Details
```

---

# 58. Mobile Deal Card

Use:

```text
Acme International

GHS 120K
Proposal · 70%

⚠ At Risk

Next:
Proposal review tomorrow
```

Swipe actions can provide:

```text
Call
Email
Task
Move
```

But don't rely on swipe gestures alone.

---

# 59. Microinteractions

Use animation sparingly.

Good:

* Stage movement
* Save confirmation
* AI generation
* Filter application
* New activity

Avoid:

* Excessive card animations
* Decorative transitions
* Large loading animations

---

# 60. Notification Design

Use contextual notifications.

Example:

> Deal moved to Proposal.

For important failures:

> Deal couldn't move to Negotiation — 2 requirements incomplete.

For AI:

> AI identified a high-risk signal in Acme International.

---

# 61. Progressive Disclosure

This should be a central UX principle.

Default:

```text
Deal
Value
Stage
Health
Next Step
```

Expand:

```text
Probability
Forecast
Stakeholders
Products
Activity
```

Advanced:

```text
Attribution
Audit
AI
Technical metadata
```

---

# 62. Don't Build a "Dashboard Graveyard"

A common CRM mistake is putting:

* 14 cards
* 8 graphs
* 5 charts
* 12 KPIs

on the first screen.

Don't.

The Deals home should answer:

1. How much pipeline do I have?
2. What's changing?
3. What needs attention?
4. What should I do next?

---

# 63. The Ideal Deal Page

The final mental model should be:

```text
                 DEAL
                  │
       ┌──────────┼───────────┐
       │          │           │
     VALUE      PEOPLE      PROCESS
       │          │           │
     Revenue   Stakeholders  Stage
       │          │           │
       └──────────┼───────────┘
                  │
               ACTIVITY
                  │
                  ▼
              INTELLIGENCE
                  │
                  ▼
              NEXT ACTION
```

This is the key design concept.

---

# 64. Recommended Final Information Architecture

```text
DEALS
│
├── Overview
│
├── Pipeline
│   ├── Board
│   ├── Table
│   └── Saved Views
│
├── My Deals
│
├── All Deals
│
├── Forecast
│
├── Analytics
│
└── Settings
    │
    ├── Pipelines
    ├── Stages
    ├── Fields
    ├── Products
    ├── Views
    ├── Scoring
    ├── Automation
    ├── Forecasting
    ├── Notifications
    ├── Permissions
    └── AI
```

---

# 65. The Most Important UI Upgrade

If I had to prioritize only **five UI improvements**, they would be:

### 1. Deal Workspace

Make the individual Deal the strongest experience in the entire module.

### 2. Attention Center

Automatically surface:

* stalled
* at-risk
* overdue
* high-value
* closing-soon

deals.

### 3. Configurable Board

Let users control:

* cards
* fields
* filters
* grouping
* sorting
* saved views.

### 4. AI Intelligence Layer

Put AI directly beside the deal context:

> **What is happening? Why? What should I do?**

### 5. Unified Activity Graph

Every interaction should appear in one timeline.

That is what transforms the UI from a **pipeline tracker** into a genuine **CRM operating environment**.

---

# 66. Recommended Build Order for the UI

I would **not** build every screen simultaneously.

### UI Sprint 1 — Foundation

* Design tokens
* Typography
* Buttons
* Inputs
* Badges
* Cards
* Drawers
* Modals
* Tables
* Empty states
* Skeletons

### UI Sprint 2 — Deals Workspace

* Deals navigation
* Overview
* Board
* Table
* Filters
* Saved views
* Create Deal

### UI Sprint 3 — Deal Workspace

* Header
* Stage progression
* Activity timeline
* Context panel
* Tasks
* Contacts
* Notes

### UI Sprint 4 — Commercial

* Products
* Line items
* Quotes
* Revenue metrics

### UI Sprint 5 — Intelligence

* Health
* AI summary
* Risk
* Next-best action
* Stakeholder map

### UI Sprint 6 — Management

* Forecast
* Analytics
* Pipeline performance
* Rep performance

### UI Sprint 7 — Administration

* Pipeline builder
* Stage builder
* Field builder
* Automation builder
* Permissions

### UI Sprint 8 — Power UX

* Command palette
* Keyboard shortcuts
* Bulk workflows
* Mobile optimization
* Advanced customization

---

# 67. Final Design Direction

The end product should **not look like a collection of CRUD screens**.

It should feel like this:

```text
┌──────────────────────────────────────────────────────────────┐
│ SmartSapp                                                   │
│                                                              │
│ Deals                                                        │
│                                                              │
│ GHS 1.84M Pipeline      47 Deals       8 At Risk             │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Attention Required                                      │ │
│ │                                                          │ │
│ │ 🔴 3 SLA breaches                                       │ │
│ │ 🟠 5 deals without next steps                           │ │
│ │ 🟠 2 high-value deals inactive                           │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Board] [Table] [Forecast]                                  │
│                                                              │
│ Qualification   Discovery      Proposal       Negotiation    │
│                                                              │
│  ┌─────────┐    ┌─────────┐   ┌─────────┐    ┌─────────┐   │
│  │ Deal    │    │ Deal    │   │ Deal    │    │ Deal    │   │
│  │ GHS 40K │    │ GHS 80K │   │ GHS120K │    │ GHS200K │   │
│  │ Healthy │    │ At Risk │   │ Healthy │    │ Stalled │   │
│  └─────────┘    └─────────┘   └─────────┘    └─────────┘   │
└──────────────────────────────────────────────────────────────┘
```

And when the user opens a deal:

```text
┌─────────────────────────────────────────────────────────────┐
│ ACME INTERNATIONAL                         ● AT RISK         │
│                                                             │
│ GHS 120,000     70%       Proposal       Sep 12             │
│                                                             │
│ Qualification → Discovery → Demo → PROPOSAL → Negotiation  │
├──────────────┬───────────────────────────┬──────────────────┤
│ CONTEXT      │ ACTIVITY                  │ AI INTELLIGENCE  │
│              │                           │                  │
│ Account      │ Email                    │ Health           │
│ Contact      │ Call                     │ 74% probability  │
│ Owner        │ Meeting                  │                  │
│ Campaign     │ Task                     │ ⚠ Risk           │
│ Products     │ Note                     │                  │
│              │                           │ Next action      │
│              │                           │                  │
│              │                           │ [Create Task]    │
└──────────────┴───────────────────────────┴──────────────────┘
```

That is the direction I would take.

**The key distinction is that the UI should organize itself around the lifecycle of an opportunity—not around the database schema.** The user should never have to think, *“Which table contains this information?”* They should think, *“What is happening with this deal, and what do I need to do next?”*
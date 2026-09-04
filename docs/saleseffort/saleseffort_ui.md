# SmartSapp Sales Performance & Intelligence 2.0

## Complete UI/UX Architecture & Phase-Mapped Experience Specification

**Product:** SmartSapp CRM
**Module:** Sales Performance & Intelligence 2.0
**UX Specification:** 2.0
**Primary principle:** Mobile-first, role-aware, AI-assisted, CRM-native
**Design language:** SmartSapp product system
**Brand primary:** `#3A86FF`

---

# 1. UX Vision

SmartSapp Sales Performance & Intelligence should not feel like an analytics application where salespeople occasionally check statistics.

It should feel like a **sales operating workspace**.

The product must help each user move through this loop:

> **Know → Prioritize → Act → Learn → Improve → Close**

For the seller:

> “What should I do next?”

For the manager:

> “Who needs attention and why?”

For the executive:

> “What is happening to revenue and why?”

For RevOps:

> “Are our sales processes, people and policies working?”

For AI:

> “What is the highest-value action supported by the available evidence?”

---

# 2. Core UX Principles

## 2.1 Action before analytics

Analytics should inform action.

The interface should not make a representative interpret five charts before knowing what to do.

Bad:

> 18 tasks
> 14 calls
> 4 meetings
> 76% activity attainment

Better:

> **Call Sunrise Academy now**
>
> Proposal viewed 4×
> Decision-maker attended last meeting
> Follow-up due today
>
> **[Call]**

---

# 3. Mobile-First Product Philosophy

SmartSapp should use a **mobile-first responsive system** with progressive enhancement.

The mobile experience must not be:

> Desktop dashboard → stacked cards

It should be:

> Desktop command center → mobile action center

The mobile version therefore changes information hierarchy rather than simply reducing width.

## Mobile priority order

1. Immediate action
2. Buyer/deal context
3. Important alert
4. Target progress
5. Performance
6. Supporting analytics

---

# 4. Responsive Breakpoint Strategy

Recommended design system:

### XS

320–374 px

### Small

375–479 px

### Medium

480–767 px

### Tablet

768–1023 px

### Desktop

1024–1439 px

### Wide desktop

1440 px+

---

# 5. Mobile Interaction Rules

Primary interactive targets should remain at least approximately 44px high, consistent with the accessibility/touch-target direction already used by the current module.

Mobile interaction standards:

* minimum 44px touch area
* sticky primary action
* bottom sheets instead of unnecessarily large dialogs
* swipeable cards where appropriate
* horizontal scrolling only for short filter/tab groups
* no dense desktop tables
* no hover-dependent functionality
* one-handed primary interactions where practical
* persistent save state
* concise confirmations
* progressive disclosure for secondary detail

---

# 6. Global Application Architecture

The Sales Performance product should have four primary experience modes.

## Seller

```text
My Day
My Work
My Leads
My Accounts
My Deals
My Meetings
My Performance
My Coaching
AI
```

## Manager

```text
Command Center
Team
Reps
Pipeline
Targets
Coaching
Interventions
AI Manager
```

## Executive

```text
Revenue
Forecast
Pipeline
Performance
Attribution
Benchmarks
Trends
```

## RevOps/Admin

```text
Workforce
Performance Policies
Scoring
Targets
Scorecards
Playbooks
Attribution
AI Governance
Billing
Audit
```

---

# 7. Global Navigation

## Desktop

Persistent left navigation:

```text
SMARTSAPP

Sales
  Command Center
  My Day
  Work Queue
  Leads
  Accounts
  Opportunities
  Activities
  Meetings
  Conversations

Performance
  Overview
  Team
  Reps
  Targets
  Leaderboard
  Benchmarks

Intelligence
  AI Insights
  Next Best Action
  Buyer Signals
  Deal Intelligence
  Revenue Intelligence
  Forecast

Coaching
  Scorecards
  Coaching
  Practice Lab
  Methodologies

Plays
  Active Plays
  Play Library
  Play Builder

Administration
  Workforce
  Performance Policies
  Scoring
  Targets
  Attribution
  AI Governance
  Billing
  Audit
```

---

# 8. Mobile Navigation

Use a five-item bottom navigation for the seller:

```text
┌─────────────────────────────────┐
│                                 │
│          Current Screen         │
│                                 │
├─────────────────────────────────┤
│ Home │ Work │ Deals │ AI │ More │
└─────────────────────────────────┘
```

## Home

My Day.

## Work

Tasks + AI priorities.

## Deals

Pipeline and active opportunities.

## AI

AI assistant and recommendations.

## More

Leads, accounts, meetings, performance, coaching and settings.

Managers receive:

```text
Home
Team
Deals
AI
More
```

The bottom bar must remain persistent except during focused workflows such as:

* calling
* full-screen conversation review
* roleplay
* form completion

---

# 9. Global Mobile Header

The mobile header should remain intentionally light.

```text
┌──────────────────────────────┐
│ ☰   My Day       🔔   AI ✦   │
└──────────────────────────────┘
```

When within a record:

```text
┌──────────────────────────────┐
│ ‹  Sunrise Academy      ⋮   │
└──────────────────────────────┘
```

---

# 10. Global AI Entry Point

AI should not exist only as a standalone page.

A persistent SmartSapp AI affordance appears contextually:

* on deals
* on accounts
* on conversations
* on performance
* on targets
* on work items

Example:

> **Ask SmartSapp AI**

The AI drawer/sheet should know the current context.

From a deal:

> “Why is this deal at risk?”

From a rep:

> “Why is my conversion falling?”

From a meeting:

> “Prepare me for this meeting.”

---

# 11. Global Notification Center

The notification center is divided into:

### Action required

Things requiring immediate attention.

### Intelligence

AI-detected events.

### Performance

Targets and score changes.

### Coaching

Feedback and recommended training.

### System

Administrative information.

Mobile uses a full-screen notification center.

Desktop uses a right-side notification drawer.

---

# 12. Seller Home — My Day

This is the most important screen in the product.

## Desktop

```text
Good morning, Ama
Monday, 7 September

Performance        Target             Pipeline
84                82%                 GHS 820k

AI PRIORITIES
─────────────────────────────────────────────
1  Sunrise Academy                  HIGH
   Proposal viewed 4×
   Decision maker engaged
   [Call] [Draft Follow-up]

2  Greenfield School                HIGH
   SLA expires in 2 hours
   [Call]

3  ABC Academy                      MEDIUM
   Meeting at 3:00 PM
   [Prepare]
```

## Mobile

The screen becomes:

```text
Good morning, Ama

84
Performance

72%
Target

────────────────────

🔥 DO THIS NOW

Sunrise Academy
Proposal viewed 4×

[Call]

────────────────────

Next

Greenfield School
SLA expires in 2h

[Follow up]

────────────────────

3:00 PM
Discovery meeting

[Prepare]
```

---

# 13. My Day Information Hierarchy

Mobile sections:

1. Greeting
2. Performance snapshot
3. Highest-priority action
4. Upcoming meetings
5. Buyer signals
6. Target progress
7. Pipeline
8. Secondary tasks

Never show all tasks equally.

---

# 14. AI Priority Card

Each recommendation card contains:

### What

> Call Sunrise Academy

### Why

> Proposal opened 4 times today.

### Impact

> High

### Confidence

> 89%

### Actions

* Call
* Email
* Message
* View Deal
* Dismiss

This follows the category direction toward AI-generated prioritized workflows rather than undifferentiated task lists.

---

# 15. Mobile Priority Card Interaction

Swipe left:

> Snooze

Swipe right:

> Complete

Tap:

> Open context

Long press:

> More actions

The primary button should remain visible without scrolling.

---

# 16. Work Queue

## Desktop

Three-pane concept:

```text
FILTERS
─────────────
Priority
Due date
Type
Team
Play

WORK QUEUE
────────────────────
Priority 1
Priority 2
Priority 3

CONTEXT
────────────────────
CRM record
Buyer signals
AI insight
Actions
```

## Mobile

Single feed:

```text
WORK

🔥 High Priority
Sunrise Academy
Call
Proposal viewed 4×

──────────

⚠ SLA
Greenfield School
Follow up
Due in 2h

──────────

📅 Meeting
ABC Academy
Prepare
3:00 PM
```

Filters appear in a bottom sheet.

---

# 17. Quick Action System

Global mobile quick actions:

```text
＋
Call
Create Task
Add Note
Send Email
Send WhatsApp
Schedule Meeting
Update Deal
```

Use a bottom sheet rather than navigating to another dashboard.

---

# 18. Seller Record Architecture

Every sales record should follow:

```text
Header
↓
Status
↓
AI Summary
↓
Primary Action
↓
Context
↓
Timeline
↓
Related Records
↓
Analytics
```

This applies to:

* Lead
* Contact
* Account
* Deal
* Meeting
* Conversation

---

# 19. Lead Detail UX

## Header

```text
Sarah Mensah
Qualified Lead
Score 87

[Call] [Message]
```

## AI Summary

> High-intent education buyer.
> Responded to campaign twice.
> Asked about implementation timeline.

## Next Best Action

> Schedule discovery call.

## Timeline

Calls
Emails
Forms
Meetings
Campaign interactions

## Mobile

Use collapsible sections.

---

# 20. Account Detail UX

Account header:

```text
Sunrise Academy

Health     HIGH
Pipeline   GHS 240k
Contacts   7
```

Sections:

* Overview
* Stakeholders
* Opportunities
* Engagement
* Meetings
* Conversations
* Documents
* Payments
* AI Strategy

---

# 21. Account AI Brief

A single mobile card:

> **AI Account Brief**
>
> Primary opportunity: SmartSapp CRM
>
> Decision-maker: CEO
>
> Main concern: implementation timeline
>
> Last meaningful interaction: 18h ago
>
> Recommended strategy:
> Reassure on onboarding and implementation support.

---

# 22. Deal Detail

The deal is a major intelligence surface.

## Header

```text
GHS 85,000
Discovery → Proposal

Health: 68
Risk: Medium
Win probability: 72%

[Call] [Email] [Update]
```

## Mobile tabs

```text
Overview
Signals
Activity
People
AI
```

Avoid six or eight horizontally scrolling tabs.

Use a “More” menu when necessary.

---

# 23. Deal Health Card

```text
DEAL HEALTH

68 / 100
Medium Risk

Why?
• 9 days in stage
• Only 1 stakeholder engaged
• Pricing objection unresolved

AI ACTION
Engage Finance Director

[Create Task]
```

---

# 24. Deal Timeline

Timeline events should visually distinguish:

**Human**

**Buyer**

**AI**

**Automation**

Example:

```text
09:20
👤 Ama
Sent proposal

10:15
👤 Buyer
Opened proposal

11:03
✦ AI
Detected pricing interest

11:30
🤖 Automation
Created follow-up task
```

This directly addresses the need to distinguish human and machine events in the performance model.

---

# 25. Pipeline Mobile Experience

Do not attempt to show a traditional wide Kanban board.

Use:

### Pipeline summary

```text
Pipeline
GHS 1.8m

Coverage
3.2×

At Risk
GHS 240k
```

Then:

```text
Discovery
8 deals
GHS 480k

Proposal
5 deals
GHS 720k

Negotiation
3 deals
GHS 600k
```

Tap a stage to see its deals.

---

# 26. Meeting Detail

Before meeting:

### Meeting Brief

* attendees
* account
* past meetings
* open opportunities
* previous objections
* buyer sentiment
* recommended questions
* desired outcome

Primary CTA:

**Start Meeting**

After meeting:

**Complete Meeting**

---

# 27. Meeting Completion UX

After ending a meeting:

```text
Meeting complete

How did it go?

[Positive]
[Neutral]
[Challenging]

AI processing…
```

Then:

```text
AI Summary Ready

Buying signal detected
2 commitments
1 objection
Next step identified

[Review AI Summary]
```

---

# 28. Post-Meeting Review

Sections:

### Summary

### Buying signals

### Objections

### Commitments

### Next steps

### AI scorecard

### Recommended actions

### CRM updates

The seller should be able to approve proposed CRM updates in one screen.

---

# 29. Conversation Intelligence UX

Use a timeline rather than displaying an overwhelming transcript first.

## Desktop

```text
Transcript                Intelligence
────────────────────      ──────────────
Conversation              Buying Signals
                          Objections
                          Sentiment
                          Scorecard
                          AI Coach
```

## Mobile

```text
Call Summary

72 / 100

🔥 Buying Signal
“We need this before January.”

⚠ Objection
Implementation timing

🎯 AI Recommendation
Clarify onboarding timeline

[View Transcript]
```

The transcript becomes secondary.

---

# 30. Transcript Mobile UX

When transcript is opened:

```text
00:15  Ama
Tell me about your current process.

00:39  Buyer
We are struggling with...

🔥 Buying Signal
```

AI insights are anchored to transcript timestamps.

This follows the strong coaching pattern of tying feedback to exact moments in conversations.

---

# 31. AI Call Scorecard

Mobile:

```text
DISCOVERY SCORE

78

✓ Agenda
✓ Pain identified
⚠ Decision process
✕ Budget exploration

AI COMMENT

You identified the core pain,
but did not establish who
approves the purchase.

[Practice This]
```

Desktop provides full scorecard detail.

---

# 32. Coaching Center

Navigation:

```text
Coaching
├── My Coaching
├── Team Coaching
├── Recommended
├── Scorecards
├── Practice Lab
└── Progress
```

---

# 33. Rep Coaching Home

```text
Your development

Discovery             86
Objection handling    68
Closing               61
Follow-up             92

THIS WEEK

Improve objection handling

[Practice]
```

The user should always see:

> What should I improve?

rather than only:

> What was my score?

---

# 34. Manager Coaching Home

Manager sees:

```text
COACHING OPPORTUNITIES

🔥 Michael
Pricing objections

⚠ Sarah
Discovery quality

↑ Ama
Strong improvement
```

Tap a rep to see recommended calls.

Gong's current coaching approach is instructive here: AI surfaces calls and specific coaching opportunities so managers do not have to manually review every conversation.

---

# 35. Scorecard Review UX

Desktop:

```text
Call
────────────────────────────
Transcript
────────────────────────────
Scorecard
1. Agenda           5/5
2. Pain             4/5
3. Authority        2/5
4. Next Step        3/5
```

Mobile:

```text
Discovery

1 / 6

Did the rep establish
the buyer's pain?

[1] [2] [3] [4] [5]

AI Evidence
00:43 — Buyer described...

[Next]
```

The mobile experience should use a **step-by-step evaluation flow**, not a huge form.

---

# 36. Practice Lab

Landing screen:

```text
Practice Lab

Recommended for you

🔥 Pricing Objections

Because your last 4 calls
showed pricing resistance.

[Start]
```

Scenario categories:

* Discovery
* Pricing
* Competitors
* Closing
* Procurement
* Existing Vendor
* Timing

---

# 37. Roleplay UX

```text
AI Buyer

“I don't think this fits our budget.”

────────────────

You:
[voice / text input]

AI:
“Why should we consider
your solution?”

────────────────

Live feedback
Listening        84
Questions        78
Objection        63
```

At completion:

> Retry objection handling.

---

# 38. Manager Command Center

The manager homepage should answer:

### Are we on target?

### Who needs attention?

### What changed?

### Which deals are at risk?

### What should I do?

---

# 39. Manager Dashboard

```text
SALES COMMAND CENTER

Revenue       Pipeline       Forecast
GHS 1.8m      GHS 4.7m       91%

Quota         Win Rate       Velocity
84%           28%            19 days

────────────────────────────

AI TEAM BRIEF

Pipeline is 8% below target.
Two enterprise deals account for 47%
of the shortfall.

[Review Risks]
```

---

# 40. Mobile Manager Dashboard

Mobile reduces the page to:

```text
Sales Command Center

84%
Quota

GHS 4.7m
Pipeline

91%
Forecast

────────────────

🔥 ATTENTION

2 deals at critical risk

[Review]

────────────────

TEAM

3 reps below target
1 rep overloaded

[Review]

────────────────

AI BRIEF

Pipeline is 8% below plan.

[Ask AI]
```

---

# 41. Team Performance

Desktop uses a rich table.

Mobile uses cards:

```text
TEAM

Ama Mensah
84
Target 92%
Pipeline GHS 820k
Health ● Good

────────────

Michael Owusu
68
Target 71%
Pipeline GHS 540k
Health ● At Risk
```

Sort controls appear in a bottom sheet.

---

# 42. Rep Performance Profile

## Header

```text
Ama Mensah
Sales Executive

Performance
84 / 100

↑ 8% this month
```

## Cards

* Target
* Pipeline
* Conversion
* Quality
* Revenue
* Coaching

## AI explanation

> Performance improved primarily because meeting conversion increased 13%.

---

# 43. Performance Breakdown

Use a radar chart on desktop only.

On mobile, replace with ranked horizontal bars:

```text
QUALITY             82
███████████████

EFFECTIVENESS       78
██████████████

OUTCOME             91
████████████████

ACTIVITY            94
████████████████
```

This is easier to scan on small screens.

---

# 44. “Why?” Pattern

Every score should support a Why action.

Example:

```text
Performance 76

Why?

+12% meeting conversion
-18% follow-up speed
+8% call quality
-7% late-stage conversion
```

Tap any component to inspect evidence.

---

# 45. Target Center

Desktop:

```text
TARGETS

Quarterly Revenue
GHS 5m

Actual
GHS 3.9m

Attainment
78%

Forecast
92%

Required Pace
GHS 110k/day
```

Mobile:

```text
Quarterly Target

78%
██████████████░░░

GHS 3.9m / GHS 5m

Forecast
92%

Need
GHS 110k/day
```

---

# 46. Target Detail

Include:

### Target

### Current

### Required pace

### Forecast

### Trend

### Contributors

### Risks

### AI recommendation

---

# 47. Intervention Center

This replaces passive notifications with actionable management.

Categories:

**Critical**

**Warning**

**Opportunity**

Example:

```text
CRITICAL

Sunrise Academy
GHS 240k opportunity

Stalled for 12 days

Recommended:
Manager intervention

[Open Deal]
```

---

# 48. Mobile Intervention UX

Each intervention is a swipeable action card:

```text
⚠ DEAL AT RISK

Sunrise Academy
GHS 240k

No progression in 12 days.

[Review] [Assign] [Dismiss]
```

Actions should remain visible without opening another page.

---

# 49. Workload Center

Manager sees:

```text
TEAM CAPACITY

Ama             82%
Michael         124% 🔴
Sarah           67%
Daniel          91%
```

Tap Michael:

```text
Michael

Capacity 124%

Open leads      24
Open deals       8
Meetings         9
Tasks           31

AI recommendation

Reassign 8 low-priority leads.
```

---

# 50. Workforce Management

Admin screen:

```text
Sales Workforce

Teams
Regions
Territories
Roles
Skills
Capacity
Assignments
Availability
```

Mobile uses a segmented control:

```text
People | Teams | Capacity
```

---

# 51. Assignment UX

Assignment dialog:

```text
Assign Lead

Recommended by SmartSapp

1. Ama
   Segment fit: 94%
   Capacity: 72%
   Win rate: 31%

2. Michael
   Segment fit: 88%
   Capacity: 124%
```

AI recommendation:

> Ama is the strongest available assignment.

---

# 52. Buyer Signals Center

The signal surface should not be just a log.

It should answer:

> Which signals require action?

Example:

```text
🔥 HIGH INTENT

Sunrise Academy
Proposal viewed 4×

Decision-maker engaged

Recommended:
Call within 2 hours

[Call]
```

---

# 53. Buyer Signal Detail

Show:

### Signal

Proposal viewed 4 times.

### Evidence

* 09:42
* 10:13
* 11:08
* 11:41

### Related people

CEO
Finance Director

### Related deal

GHS 240k

### AI recommendation

Call.

---

# 54. Revenue Intelligence Dashboard

Executive-oriented.

Desktop:

```text
Revenue Intelligence

Revenue       Forecast      Pipeline
GHS 8.4m      92%           GHS 20m

Win Rate      Velocity      Coverage
28%           24 days       3.1×

────────────────────

Revenue Drivers
Rep | Team | Segment | Source

────────────────────

Attribution
First | Weighted | Last
```

---

# 55. Revenue Intelligence Mobile

```text
Revenue

GHS 8.4m
↑ 11%

Forecast
92%

Pipeline
GHS 20m

────────────────

RISK

GHS 1.4m at risk

────────────────

TOP DRIVER

Enterprise segment
+18%

────────────────

AI INSIGHT

Two opportunities explain
41% of forecast uncertainty.
```

---

# 56. Revenue Attribution UX

Desktop can show Sankey/flow visualizations.

Mobile should use cards:

```text
GHS 100,000 DEAL

First Touch
20%      GHS 20k

Discovery
25%      GHS 25k

Demo
25%      GHS 25k

Proposal
15%      GHS 15k

Closing
15%      GHS 15k
```

No complex visualization should be mandatory on mobile.

---

# 57. Attribution Model Builder

Desktop:

Visual weighting interface.

Mobile:

Step flow:

```text
1. Select Model

2. Set Weight

3. Review Example

4. Validate

5. Publish
```

Each stage has a sticky **Continue** button.

---

# 58. Forecast UX

Use:

```text
Committed
Best Case
Likely
Upside
```

with confidence.

Example:

```text
Forecast

Likely
GHS 8.1m
91%

Best Case
GHS 8.8m
67%

Upside
GHS 9.5m
42%
```

Tap a forecast category to inspect deals.

---

# 59. AI Forecast Explanation

Example:

> Forecast confidence declined 4% because three large opportunities moved their expected close dates.

CTA:

**Review affected deals**

---

# 60. Play Library

Play cards:

```text
Proposal Viewed

Trigger:
Proposal viewed ≥ 3×

Actions:
• Notify owner
• Prioritize task
• Generate follow-up
• Escalate after 48h

Active: 142

[View]
```

---

# 61. Play Builder Desktop

Use a visual canvas:

```text
TRIGGER
Proposal Viewed ≥ 3
       ↓
CONDITION
Deal stage = Proposal
       ↓
AI ACTION
Generate recommendation
       ↓
TASK
Create call task
       ↓
WAIT
48 hours
       ↓
CONDITION
No response?
   ↓              ↓
Yes              No
 ↓                 ↓
Escalate          End
```

This should leverage SmartSapp's broader automation architecture rather than create a visually unrelated workflow builder.

---

# 62. Play Builder Mobile

Mobile should not show the full canvas.

Use a step sequence:

```text
Play Builder

1 Trigger
Proposal Viewed

2 Condition
Stage = Proposal

3 Action
AI Recommendation

4 Action
Create Call Task

5 Delay
48 hours

[Save Play]
```

The desktop canvas and mobile step-builder should create the same underlying model.

---

# 63. Performance Policy Studio

Tabs:

```text
Scoring
Targets
Quality
Scorecards
Plays
Attribution
Leaderboard
AI
Governance
```

Desktop supports side-by-side configuration and preview.

Mobile uses one configuration section at a time.

---

# 64. Scoring Builder

Desktop:

```text
WHEN
Call completed

IF
Duration > 120 sec
Outcome = Meaningful

THEN
Effort +8
Quality +4
```

Mobile:

```text
WHEN

Call completed

↓

Condition

Duration > 120 sec

↓

Outcome

Meaningful

↓

Reward

Effort +8

Quality +4

[Continue]
```

---

# 65. Scoring Preview

This is essential.

Before publishing:

> **What will this change?**

Show:

```text
Current score distribution
vs
Projected score distribution

Top performers affected
12

Average score change
+6%

Potential anomalies
2
```

This reduces dangerous scoring-policy changes.

---

# 66. AI Policy Studio

Administrators configure:

### AI visibility

### AI recommendations

### AI drafting

### AI actions

### Autonomous actions

### Approval thresholds

### Sensitive data

### Credit limits

Example:

```text
AI can automatically:

✓ Create tasks
✓ Draft messages
✓ Summarize meetings

Requires approval:

⚠ Send external communication
⚠ Change deal stage
⚠ Change forecast
⚠ Reassign ownership
```

---

# 67. AI Assistant UX

The AI assistant should operate in three modes.

## Global

Ask anything about authorized sales data.

## Contextual

Understand current record.

## Action mode

Prepare or execute an action.

---

# 68. AI Mobile Interface

Bottom sheet:

```text
SmartSapp AI

Ask about this deal...

[Why is it at risk?]

Suggested prompts:
• What should I do next?
• Summarize the buyer.
• Draft a follow-up.
• Prepare me for this meeting.
```

Voice input can be supported on capable devices.

---

# 69. AI Response Design

Avoid giant paragraphs.

Use:

```text
INSIGHT

This deal is at medium risk.

Why:
• 9 days in stage
• pricing objection
• one stakeholder

RECOMMENDED ACTION

Call Finance Director today.

[Create Task]
```

---

# 70. AI Evidence Drawer

Every AI answer should support:

**Why did AI say this?**

Displays evidence:

```text
Sources

Proposal viewed
Meeting transcript
Deal history
Buyer reply
CRM stage

Model confidence
89%
```

This is critical for trust.

---

# 71. AI Recommendation Feedback

Every recommendation supports:

```text
Useful
Not useful
Wrong
Already done
Not relevant
```

This becomes model feedback.

---

# 72. AI Action Confirmation

For sensitive actions:

```text
SmartSapp AI wants to:

Send this WhatsApp message
to Sarah Mensah.

Why:
Proposal follow-up.

[Review] [Send]
```

No hidden autonomous outbound messaging.

---

# 73. Activity Timeline

The timeline is a core cross-module UX primitive.

Each event should show:

* actor
* action
* entity
* timestamp
* source
* outcome
* AI signal
* performance impact where appropriate

Example:

```text
09:45  Ama
Called Sunrise Academy
12m 14s
Outcome: Discovery booked

+8 Effort
+4 Quality

10:22  Buyer
Opened proposal

🔥 High engagement
```

---

# 74. Performance Impact Drawer

From any qualifying activity:

> **Performance impact**

Show:

```text
Effort       +8
Quality      +4
Effectiveness +6

Revenue influence
GHS 12,500

Attribution
2.5%
```

This makes the relationship between action and outcome explicit.

---

# 75. Mobile Charts

Charts should follow a strict hierarchy.

Use mobile:

* horizontal bar charts
* compact line charts
* progress rings
* simple trend arrows
* ranked cards

Avoid:

* multi-axis charts
* large legends
* complex Sankey diagrams
* dense dashboards
* tiny labels

---

# 76. Desktop Analytics

Desktop may use:

* trend lines
* scatter plots
* funnel
* Sankey
* cohort heat maps
* rep distributions
* conversion matrices

But every advanced chart should have a mobile equivalent.

---

# 77. Performance Analytics Mobile

Instead of a dashboard with 8 charts:

```text
Performance

84
↑ 8%

Activity       91
Quality        76
Effectiveness  82
Outcome        88
Revenue        79

────────────────

Trend
↑ Improving

────────────────

Top strength
Discovery

────────────────

Focus area
Closing
```

---

# 78. Leaderboard UX

The current module already uses ranked standings and trophy treatment.

Retain it, but make leaderboard mode configurable.

## Competitive mode

```text
1  Ama       94
2  Michael   88
3  Sarah     84
```

## Coaching mode

Hide ranking and show:

> You are above your benchmark.

---

# 79. Mobile Leaderboard

Use a card list:

```text
#1
Ama
94
↑ 8%

#2
Michael
88
↑ 4%

#3
Sarah
84
↓ 2%
```

Do not use a tiny multi-column table.

---

# 80. Benchmarks UX

Show contextual comparison:

```text
YOU

84

Your team average
78

Role benchmark
80

Top quartile
89
```

Then:

> You are performing 5% above your team benchmark.

---

# 81. “What Changed?” View

This is a dedicated UX pattern.

```text
What changed?

Performance
↓ 7%

Main drivers

Follow-up speed
↓ 14%

Meeting conversion
↓ 9%

Call quality
↑ 6%

[View evidence]
```

---

# 82. Coaching Plan UX

```text
COACHING PLAN

Objective
Improve objection handling

Current
68

Target
82

Progress
54%

This week

✓ Review 2 calls
✓ Complete roleplay
□ Manager review

[Continue]
```

---

# 83. Learning Integration

Every coaching recommendation can link to:

* training
* SmartSapp courses
* documents
* examples
* recorded calls
* playbooks

This allows Sales Performance to connect with SmartSapp's broader learning ecosystem.

---

# 84. Weekly Sales Review

Manager receives:

```text
Weekly Sales Review

TEAM

Revenue       ↑ 8%
Pipeline      ↑ 12%
Win rate      ↓ 3%

Top improvement
Ama

At risk
Michael

Biggest deal risk
Sunrise Academy

Coaching priority
Closing

[Open Review]
```

---

# 85. Executive Weekly Brief

```text
Revenue Brief

Revenue
GHS 2.4m

Forecast
91%

Pipeline
GHS 8.2m

Major risk
Enterprise pipeline

Key driver
Inbound campaigns

AI recommendation
Increase attention on
high-value stalled opportunities.
```

---

# 86. Search UX

Global search should find:

* leads
* contacts
* accounts
* deals
* activities
* meetings
* conversations
* reps
* AI insights

Mobile search:

```text
Search SmartSapp

[ Sunrise Academy ]

Suggested:
Account
Deal
Meeting
Conversation
```

---

# 87. Filter System

Filters should use a reusable SmartSapp filter sheet.

Desktop:

inline filters.

Mobile:

```text
Filter

Period
[This Week]

Team
[All Teams]

Status
[At Risk]

Channel
[All]

[Apply]
```

Show active filter count:

> Filter · 3

---

# 88. Empty States

Never use:

> No data.

Use contextual guidance.

Example:

> **No performance data yet**
>
> Sales activity will appear here as your team works.
>
> **[Set Targets]**

---

# 89. First-Use Experience

When entering Sales Performance for the first time:

```text
Welcome to Sales Performance

Let's configure your workspace.

1. Set up teams
2. Define targets
3. Choose scoring model
4. Select methodology
5. Enable AI assistance

[Get Started]
```

Progress:

**1 of 5**

---

# 90. Workspace Setup Wizard

### Step 1

Sales team.

### Step 2

Targets.

### Step 3

Performance policy.

### Step 4

Scorecards.

### Step 5

AI governance.

Finish:

> Your Sales Performance workspace is ready.

---

# 91. Mobile Onboarding

Use a full-screen wizard with one decision per screen.

Avoid desktop setup forms.

---

# 92. Loading States

Use skeletons rather than blank pages.

For AI:

```text
Analyzing deal signals…

Collecting:
✓ CRM history
✓ Buyer activity
✓ Conversations
… Forecast analysis
```

AI states should feel intentional.

---

# 93. Error States

Example:

> **We couldn't load performance data.**
>
> Your sales activity is safe. Try refreshing the dashboard.

Actions:

**Retry**

**View cached data**

---

# 94. Offline/Weak Network Mobile Behavior

Seller mobile experience should gracefully preserve:

* recently loaded work queue
* upcoming meetings
* contact information
* recent notes
* pending actions

Pending changes should show:

> Waiting to sync.

Never silently fail an action.

---

# 95. Permissions UX

When access is restricted:

```text
You don't have access to team-level
performance analytics.

Ask your administrator for access.

[Request Access]
```

Avoid generic “Unauthorized”.

---

# 96. Sensitive Performance UX

For confidential performance information:

Use clear privacy labels:

> Manager-only

> Private coaching

> Executive-only

> Compensation-sensitive

---

# 97. Compensation Data

Compensation-sensitive performance records should show:

> **Compensation data**

and require explicit permission.

No accidental inclusion in normal team leaderboard views.

---

# 98. Mobile Manager Drill-Down

The drill path should be:

```text
Team
 ↓
Rep
 ↓
Performance
 ↓
Deal
 ↓
Conversation
 ↓
Evidence
```

At every level, the user can return with the back navigation without losing filters.

---

# 99. Mobile Deep Linking

Notifications should deep-link directly to the relevant action.

Example:

> “Sunrise Academy deal is at risk.”

Tap:

> `/sales/deals/123?view=risk`

The user lands directly on:

**Risk explanation + recommended action**

not the generic deal homepage.

---

# 100. Global Command Palette

Desktop:

`⌘K`

Commands:

```text
Go to My Day
Search Sunrise Academy
Create Task
Create Lead
Open Sales Performance
Ask AI
Create Play
Review At-Risk Deals
```

Mobile uses the search/AI launcher.

---

# 101. Cross-Module Navigation

Sales Performance must preserve context when moving between SmartSapp modules.

Example:

```text
Performance
 ↓
Deal
 ↓
Meeting
 ↓
Conversation
 ↓
AI Coaching
```

Back returns to the original performance context.

---

# 102. CRM-Aware Activity Creation

From every context, action buttons should intelligently prefill:

* lead
* contact
* account
* deal
* owner
* activity type
* due date

Example:

From a deal:

> Create Task

automatically associates the deal and account.

---

# 103. Universal Action Composer

One reusable SmartSapp component:

```text
Create Activity

Type
Call / Email / Task / Meeting / Note

Related to
Sunrise Academy

Owner
Ama

Due
Today

[Save]
```

This becomes a platform-level component.

---

# 104. Mobile Action Composer

Bottom sheet:

```text
Create

○ Call
○ Email
○ WhatsApp
○ Task
○ Meeting
○ Note

[Continue]
```

Then progressively collect required fields.

---

# 105. Sales Performance Home Variants

The system should select the default home based on role.

### Sales rep

**My Day**

### Team manager

**Command Center**

### Sales leader

**Revenue Intelligence**

### RevOps

**Performance Operations**

### Executive

**Revenue Pulse**

---

# 106. Phase-by-Phase UI/UX Implementation

The UX must be delivered incrementally with the engineering architecture.

---

# PHASE 0 — Architecture Integrity

## PRD alignment

Foundation requirements:

* canonical event
* tenant isolation
* aggregation
* idempotency
* human/machine distinction

These directly address the current identified collection, tenant and aggregation defects.

## UX deliverables

No major visual redesign.

Build reusable foundations:

* page container
* mobile shell
* desktop shell
* bottom navigation
* filter sheet
* action composer
* activity timeline
* record header
* AI card framework
* loading/error/empty states

## Acceptance criteria

Every future screen can use the same shell and interaction patterns.

---

# PHASE 1 — Sales Performance Core

## PRD alignment

Domains:

* Sales Workforce
* Performance
* Targets
* Benchmarks

## UX screens

### 1. Performance Overview

### 2. Team Performance

### 3. Rep Performance

### 4. Targets

### 5. Benchmarks

### 6. Workforce

## Mobile priority

* personal performance
* target attainment
* current pace
* key strengths
* improvement areas

## Desktop priority

* multidimensional analytics
* team comparison
* trends
* filters

---

# PHASE 2 — Seller Workspace

## PRD alignment

Domains:

* Sales Execution
* Work Queue
* Next Best Action
* SLA

## UX screens

### 1. My Day

### 2. Work Queue

### 3. Priority Actions

### 4. SLA Center

### 5. Workload

### 6. AI Assistant

## Primary outcome

A seller can open SmartSapp and immediately know:

> What should I do next?

## Mobile acceptance criterion

The seller can execute core activities from the phone without desktop dependency.

---

# PHASE 3 — Manager Command Center

## PRD alignment

Domains:

* Team Management
* Interventions
* Performance Health
* Workload

## UX screens

### 1. Command Center

### 2. Team

### 3. Rep Profile

### 4. Intervention Center

### 5. Workload

### 6. Weekly Review

## Primary outcome

Manager can identify and act on performance problems without constructing their own analysis.

---

# PHASE 4 — Performance Policy Studio

## PRD alignment

Domains:

* scoring
* quality
* target policies
* anti-gaming
* governance

## UX screens

### 1. Performance Policies

### 2. Scoring Builder

### 3. Quality Rules

### 4. Leaderboard Settings

### 5. Simulation/Preview

### 6. Version History

## Critical UX feature

Every policy change must include:

> **Preview impact**

before publishing.

---

# PHASE 5 — Conversation Intelligence & Coaching

## PRD alignment

Domains:

* Conversations
* Scorecards
* Coaching
* Practice Lab
* Methodologies

## UX screens

### 1. Conversations

### 2. Call Intelligence

### 3. Scorecard Review

### 4. Coaching Center

### 5. Practice Lab

### 6. Coaching Plans

## Mobile

Conversation summary and coaching recommendation come before transcript detail.

## Desktop

Transcript and scorecard can be viewed side-by-side.

---

# PHASE 6 — Buyer & Deal Intelligence

## PRD alignment

Domains:

* Buyer Signals
* Account Intelligence
* Deal Intelligence
* Next Best Action

## UX screens

### 1. Buyer Signal Center

### 2. Deal Intelligence

### 3. Account Intelligence

### 4. Stakeholder Map

### 5. Meeting Brief

### 6. Post-Meeting Intelligence

## Primary outcome

Convert scattered signals into clear action.

---

# PHASE 7 — Revenue Intelligence

## PRD alignment

Domains:

* Attribution
* Forecast
* Pipeline Velocity
* Revenue Analytics

## UX screens

### 1. Revenue Intelligence

### 2. Forecast

### 3. Attribution

### 4. Pipeline Velocity

### 5. Win/Loss

### 6. Revenue Drivers

## Mobile

Executive summary first.

Detailed analysis is progressively disclosed.

---

# PHASE 8 — Sales Orchestration

## PRD alignment

Domains:

* Sales Plays
* Routing
* Escalation
* AI Actions

## UX screens

### 1. Play Library

### 2. Play Builder

### 3. Active Plays

### 4. Routing

### 5. Escalation

### 6. Approval Queue

## Primary outcome

Turn intelligence into repeatable execution.

---

# PHASE 9 — AI Sales Workforce

## PRD alignment

Domains:

* AI agents
* seller copilot
* manager agent
* autonomous actions

## UX screens

### 1. AI Workspace

### 2. AI Recommendations

### 3. AI Agent Activity

### 4. AI Approvals

### 5. AI Governance

### 6. AI Impact

## Primary UX challenge

AI must feel powerful without feeling uncontrollable.

---

# PHASE 10 — Advanced Revenue Operating System

## PRD alignment

Domains:

* predictive performance
* capacity planning
* scenario analysis
* advanced AI

## UX screens

### 1. Revenue Simulator

### 2. Capacity Planner

### 3. Performance Forecast

### 4. Scenario Analysis

### 5. Organizational Intelligence

---

# 107. Phase-to-Screen Matrix

| Screen               | P0 | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 |
| -------------------- | -: | -: | -: | -: | -: | -: | -: | -: | -: | -: | --: |
| My Day               |    |    |  ● |    |    |    |    |    |  ● |  ● |     |
| Work Queue           |    |    |  ● |    |    |    |    |    |  ● |  ● |     |
| Performance Overview |    |  ● |  ● |  ● |  ● |    |    |    |    |    |   ● |
| Team Performance     |    |  ● |    |  ● |  ● |    |    |  ● |    |    |   ● |
| Rep Profile          |    |  ● |  ● |  ● |  ● |  ● |    |    |    |  ● |   ● |
| Targets              |    |  ● |  ● |  ● |    |    |    |  ● |    |  ● |   ● |
| Command Center       |    |    |    |  ● |    |    |  ● |  ● |  ● |  ● |   ● |
| Interventions        |    |    |  ● |  ● |    |    |  ● |  ● |  ● |  ● |   ● |
| Conversations        |    |    |    |    |    |  ● |  ● |    |    |  ● |   ● |
| Scorecards           |    |    |    |    |  ● |  ● |    |    |    |  ● |     |
| Coaching             |    |    |    |  ● |    |  ● |    |    |    |  ● |   ● |
| Buyer Signals        |    |    |    |    |    |    |  ● |  ● |  ● |  ● |   ● |
| Deal Intelligence    |    |    |    |    |    |    |  ● |  ● |  ● |  ● |   ● |
| Attribution          |    |    |    |    |    |    |    |  ● |    |  ● |   ● |
| Forecast             |    |    |    |    |    |    |  ● |  ● |    |  ● |   ● |
| Play Library         |    |    |    |    |    |    |    |    |  ● |  ● |   ● |
| Play Builder         |    |    |    |    |    |    |    |    |  ● |  ● |   ● |
| AI Workspace         |    |    |  ● |  ● |  ● |  ● |  ● |  ● |  ● |  ● |   ● |
| Workforce            |  ● |  ● |    |  ● |    |    |    |    |    |  ● |   ● |
| Governance           |  ● |    |    |    |  ● |  ● |    |  ● |  ● |  ● |   ● |
| Revenue Simulator    |    |    |    |    |    |    |    |    |    |    |   ● |

---

# 108. Mobile-First Phase Priority

The highest mobile investment should be concentrated in:

## Phase 2

Seller execution.

## Phase 3

Manager intervention.

## Phase 5

Conversation/coaching.

## Phase 6

Deal intelligence.

## Phase 9

AI assistance.

These are the workflows where mobile access materially changes daily productivity.

---

# 109. Desktop-First Phase Priority

Desktop can carry more analytical complexity in:

## Phase 1

Performance analytics.

## Phase 4

Policy builder.

## Phase 7

Revenue intelligence.

## Phase 8

Play builder.

## Phase 10

Scenario planning.

Mobile still requires a complete functional experience, but advanced desktop visualizations can have simplified mobile representations.

---

# 110. Core UX Component System

Create reusable components:

### SmartPerformanceCard

### SmartMetric

### SmartTrend

### SmartTargetProgress

### SmartPriorityCard

### SmartAIInsight

### SmartRecommendation

### SmartIntervention

### SmartActivityTimeline

### SmartDealHealth

### SmartBuyerSignal

### SmartScorecard

### SmartCoachingCard

### SmartWorkloadMeter

### SmartAttributionCard

### SmartForecast

### SmartFilterSheet

### SmartActionComposer

### SmartRecordHeader

### SmartEvidenceDrawer

### SmartAIApproval

These should become shared SmartSapp design-system primitives.

---

# 111. Design Tokens

Use SmartSapp's existing visual identity.

## Primary

`#3A86FF`

## Typography

Preferred SmartSapp fonts:

* Poppins
* Figtree
* Didact

Use:

### Poppins

Headings/major numeric displays.

### Figtree

Application/body/interface text.

### Didact

Selective product/marketing accents where appropriate.

---

# 112. Visual Hierarchy

Use restrained card architecture.

Avoid turning every metric into a floating card.

Prioritize:

1. Page objective
2. Primary decision
3. Primary action
4. Supporting metrics
5. Detail

This will make the product significantly less visually noisy than conventional enterprise CRM dashboards.

---

# 113. Color Semantics

The application should use semantic color rather than decorative color.

### Positive

Success/healthy/improving.

### Warning

Needs attention.

### Critical

Risk/urgent.

### Informational

Neutral intelligence.

### AI

Use a subtle AI treatment rather than an aggressive gradient aesthetic.

AI should feel embedded in SmartSapp, not like a separate consumer chatbot.

---

# 114. AI Visual Language

AI content should always be identifiable.

Example:

```text
✦ SmartSapp AI

Recommendation
```

Use consistent AI markers across:

* recommendations
* summaries
* scores
* coaching
* predictions

---

# 115. Avoid AI Overload

Do not put:

> AI insight

on every card.

Only surface AI where it changes the user's decision.

---

# 116. Accessibility

All surfaces must support:

* keyboard navigation
* screen-reader labels
* visible focus
* sufficient contrast
* 44px+ touch targets
* reduced motion
* semantic headings
* accessible charts
* non-color-dependent status
* keyboard-operable dialogs
* alternative representations for visual analytics

---

# 117. Mobile Accessibility

Specific requirements:

* bottom sheets keyboard-safe
* large touch areas
* no inaccessible horizontal tables
* screen-reader-friendly status messages
* voice-over-friendly dynamic updates
* sticky CTA must not obscure content

---

# 118. Animation

Use micro-interactions for:

* completion
* score changes
* progress
* navigation
* AI processing

Avoid:

* constant animation
* bouncing leaderboard trophies
* decorative motion during work

The current module uses trophy animation for the top rank. In 2.0, celebration should be configurable and secondary to operational information.

---

# 119. Mobile Gesture Strategy

Supported gestures:

### Swipe card

Snooze / complete.

### Swipe timeline

Navigate date groups.

### Pull to refresh

Only where live data benefits.

### Long press

Context menu.

### Bottom-sheet drag

Expand/collapse.

Do not rely on gestures alone; every gesture must have a visible alternative.

---

# 120. Mobile Performance

The seller mobile experience should prioritize fast time-to-action.

Optimize:

* first screen
* priority queue
* record header
* contact details
* call initiation
* task completion

Defer heavy analytics.

Load advanced charts only after the user requests them.

---

# 121. AI Loading Experience

Instead of spinner-only:

```text
Analyzing…

✓ CRM activity
✓ Buyer engagement
✓ Deal history
… Conversation context
```

For longer jobs:

> You can continue working. We'll notify you when the analysis is ready.

---

# 122. Real-Time Updates

Real-time events should update:

* buyer signals
* task status
* deal health
* notifications
* performance counters

But avoid aggressive UI jumps.

Use subtle:

> Updated 12 seconds ago

or:

> 2 new buyer signals

instead of continuously rearranging the screen while the user is reading.

---

# 123. Mobile Notification Deep Links

Every actionable notification should land directly on the action.

Examples:

> Lead SLA breached.

→ Lead + call action.

> Deal risk increased.

→ Deal + risk explanation.

> Coaching recommended.

→ Coaching item.

---

# 124. Sales Performance Search

Mobile search should provide predictive suggestions:

```text
Search:

Sunrise Academy

Account
GHS 240k pipeline

Deals
2

Recent meetings
3
```

---

# 125. Command Center “Explain Everything”

Every dashboard should provide:

**Explain this dashboard**

AI generates a structured summary:

> Pipeline is healthy overall, but enterprise conversion has fallen 8%.

Then allows:

> **Show me evidence**

---

# 126. UX Governance

Every new Sales Performance feature must answer:

### Which role uses it?

### What decision does it support?

### What is the primary action?

### What is the mobile version?

### What is the desktop version?

### What happens when data is empty?

### What happens when AI is unavailable?

### What permission is required?

### What event does it generate?

### Which phase does it belong to?

This becomes a mandatory product-development checklist.

---

# 127. UI-to-PRD Traceability

Every screen should map to a PRD domain.

Example:

| UI                | PRD domain      | Primary event       | AI  |
| ----------------- | --------------- | ------------------- | --- |
| My Day            | Sales Execution | task/activity       | Yes |
| Performance       | Performance     | performance.updated | Yes |
| Targets           | Targets         | attainment.changed  | Yes |
| Deal Intelligence | Intelligence    | deal.signal         | Yes |
| Scorecards        | Coaching        | scorecard.completed | Yes |
| Plays             | Orchestration   | play.executed       | Yes |
| Attribution       | Revenue         | attribution.updated | Yes |
| Workforce         | Workforce       | assignment.changed  | Yes |

---

# 128. UX Event Instrumentation

Track every important UX action:

```text
screen_viewed
filter_applied
recommendation_viewed
recommendation_accepted
recommendation_rejected
task_completed
intervention_opened
intervention_resolved
scorecard_started
scorecard_completed
coaching_started
coaching_completed
ai_prompt_submitted
ai_action_approved
ai_action_rejected
play_started
play_completed
```

This allows SmartSapp to measure its own UX effectiveness.

---

# 129. Product Analytics

Measure:

### Seller

* time to first action
* work queue completion
* recommendation acceptance
* task completion
* mobile action completion

### Manager

* intervention resolution
* dashboard usage
* coaching completion
* risk response time

### AI

* recommendation acceptance
* action execution
* correction rate
* user feedback
* downstream outcome

---

# 130. Critical UX Metrics by Phase

## Phase 0

Event integrity.

## Phase 1

Performance dashboard adoption.

## Phase 2

Time to first meaningful seller action.

## Phase 3

Manager intervention time.

## Phase 4

Policy creation success rate.

## Phase 5

Coaching completion and improvement.

## Phase 6

AI recommendation acceptance.

## Phase 7

Revenue insight engagement.

## Phase 8

Play execution success.

## Phase 9

AI-assisted outcome rate.

## Phase 10

Predictive decision accuracy.

---

# 131. Recommended Design Sprint Sequence

## Sprint 1

Design system + responsive shell.

## Sprint 2

My Day + Work Queue.

## Sprint 3

Performance + Targets.

## Sprint 4

Manager Command Center.

## Sprint 5

Rep performance.

## Sprint 6

Deal Intelligence.

## Sprint 7

Conversation Intelligence.

## Sprint 8

Coaching.

## Sprint 9

Revenue Intelligence.

## Sprint 10

Play Builder.

## Sprint 11

AI Workspace.

## Sprint 12

Cross-module refinement.

---

# 132. UX Acceptance Criteria — Seller

The seller must be able to:

* open the app
* understand their priorities
* execute a call
* send a follow-up
* update a deal
* complete a task
* review a buyer signal
* prepare for a meeting
* inspect performance
* receive coaching
* ask AI for assistance

without depending on desktop for core daily operations.

---

# 133. UX Acceptance Criteria — Manager

The manager must be able to:

* understand team performance
* identify underperformers
* identify overloaded reps
* identify at-risk deals
* inspect supporting evidence
* coach a rep
* create an intervention
* rebalance work
* review weekly performance
* ask AI why performance changed

from desktop and mobile.

---

# 134. UX Acceptance Criteria — Executive

Executive should be able to:

* see revenue
* see forecast
* see pipeline
* inspect risks
* identify revenue drivers
* understand attribution
* ask AI questions
* drill into supporting evidence

without needing operational CRM detail.

---

# 135. UX Acceptance Criteria — RevOps

RevOps must be able to:

* configure scoring
* define performance dimensions
* create targets
* create scorecards
* define attribution
* build plays
* configure AI policies
* inspect audit history
* review billing usage

with desktop optimized for configuration and mobile capable of review/approval.

---

# 136. Final Experience Model

The final SmartSapp Sales Performance & Intelligence ecosystem should feel like this:

```text
                 SMARTSAPP SALES
                       │
        ┌──────────────┼───────────────┐
        │              │               │
      SELLER         MANAGER         EXECUTIVE
        │              │               │
      My Day      Command Center    Revenue Pulse
        │              │               │
        └──────────────┼───────────────┘
                       │
                INTELLIGENCE
                       │
       ┌───────────────┼────────────────┐
       │               │                │
     Buyer           Deal            Performance
     Signals       Intelligence       Intelligence
       │               │                │
       └───────────────┼────────────────┘
                       │
                     AI
                       │
       ┌───────────────┼────────────────┐
       │               │                │
  Next Best        Coaching          Automation
    Action                          & Plays
       │               │                │
       └───────────────┼────────────────┘
                       │
                     REVENUE
                       │
             Attribution + Forecast
```

# 137. Final Design Direction

The most important UX decision is this:

## Do not build “a better Sales Effort dashboard.”

Build:

# **SmartSapp's Sales Operating Workspace**

The seller wakes up to **My Day**, not analytics.

The manager opens **Command Center**, not a leaderboard.

The executive sees **Revenue Intelligence**, not call counts.

The administrator uses **Performance Policy Studio**, not a point-settings page.

AI appears inside every relevant workflow, not as an isolated chatbot.

Mobile focuses on:

> **What should I do?**

Desktop focuses on:

> **Why is this happening, what should I change, and how should I configure it?**

And every surface is connected through the same SmartSapp event model, CRM entities, buyer signals, performance engine, attribution layer and AI context.

---

# 138. Recommended Final Navigation

## SALES

**My Day**
**Work Queue**
**Leads**
**Accounts**
**Opportunities**
**Activities**
**Meetings**
**Conversations**

## PERFORMANCE

**Overview**
**Team**
**Reps**
**Targets**
**Leaderboard**
**Benchmarks**

## INTELLIGENCE

**AI Insights**
**Next Best Action**
**Buyer Signals**
**Deal Intelligence**
**Revenue Intelligence**
**Forecast**

## COACHING

**My Coaching**
**Team Coaching**
**Scorecards**
**Practice Lab**
**Methodologies**

## PLAYS

**Active Plays**
**Play Library**
**Play Builder**

## ADMINISTRATION

**Workforce**
**Performance Policies**
**Scoring**
**Targets**
**Scorecards**
**Attribution**
**AI Governance**
**Billing & Credits**
**Audit**

---

# 139. Product North Star

The final experience should answer four questions continuously.

### Seller

> **What should I do next?**

### Manager

> **Who needs my attention?**

### Executive

> **What is driving revenue?**

### AI

> **What action is most likely to improve the outcome?**

Everything else in the interface exists to support those four questions.

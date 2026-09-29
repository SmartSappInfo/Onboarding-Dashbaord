# SmartSapp Unified Agentic UX Architecture 2.0

This is the UI/UX architecture I would use to turn the roadmap into a **single agent-native SmartSapp experience** rather than a collection of AI features.

The central design decision is:

> **SmartSapp should remain a complete business application for humans, while simultaneously becoming an operating environment that agents can navigate, understand, and execute through.**

The user should be able to work manually, conversationally, visually, or delegate the work entirely. The interfaces are different expressions of the same underlying capability system.

The architecture below incorporates the existing SmartSapp navigation direction, current CRM/Lead Intelligence/Meetings patterns, the knowledge and notes architecture, MCP, agents, workflows, Idea Canvas, Knowledge Graph, Knowledge Inbox, Campaign Intelligence, contextual CRM surfaces, approvals, and the phase roadmap.

Your current navigation concept already establishes **Work → Automation → Intelligence → Studios** as major product groupings, with Company Brain and Knowledge Graph under Intelligence.  The new architecture keeps that general mental model but elevates **AI / Command / Knowledge / Agents** into first-class cross-application surfaces.

The design is also grounded in current MCP Apps capabilities, which now allow tools to return interactive UI rather than only text/structured output, and in the current MCP 2026-07-28 architecture, which supports a stateless protocol core. ([Model Context Protocol Blog][1])

For AI interaction specifically, the design follows the established HAX principles of clear capability boundaries, contextual invocation, easy correction/dismissal, explanations, memory, global controls, and transparency around capability changes. Those guidelines were validated through multiple rounds of evaluation involving practitioners. ([Microsoft][2])

---

# 1. The New SmartSapp UX Mental Model

Today, a user typically thinks:

```text
Where is the thing I need?
```

The new SmartSapp experience should support four simultaneous modes:

```text
┌─────────────────────────────────────────────────────────┐
│                    SMARTSAPP                            │
│                                                         │
│  NAVIGATE     ASK       DELEGATE       UNDERSTAND       │
│                                                         │
│  Browse       Command   Agents         Knowledge        │
│  Search       AI        Workflows      Context          │
└─────────────────────────────────────────────────────────┘
```

### Mode 1 — Navigate

Traditional application interaction.

> “I want Deals.”

### Mode 2 — Ask

Natural language.

> “Which deals are at risk?”

### Mode 3 — Delegate

Outcome-oriented.

> “Fix the stalled deals.”

### Mode 4 — Understand

Explore the organization's knowledge.

> “Show me everything connected to Greenfield School.”

The user does not need to know which module performs the operation.

---

# 2. The Global Application Shell

## Desktop

Use a three-zone shell:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ SMARTSAPP         Search / Ask / Command ⌘K          AI • Alerts • │
├───────────────┬──────────────────────────────────────┬──────────────┤
│               │                                      │              │
│ Primary Nav   │            Main Workspace            │ Context      │
│               │                                      │ Rail         │
│ Work          │                                      │              │
│ Automation    │                                      │ AI Insights  │
│ Intelligence  │                                      │ Activity     │
│ Studios       │                                      │ Knowledge    │
│               │                                      │ Related      │
│               │                                      │              │
│               │                                      │              │
│               │                                      │              │
├───────────────┴──────────────────────────────────────┴──────────────┤
│ Persistent AI / Agent activity drawer when invoked                  │
└─────────────────────────────────────────────────────────────────────┘
```

The right contextual rail is **not permanently required**. It is an adaptive surface.

It appears when:

* an entity is selected;
* an agent run is active;
* AI analysis is available;
* related knowledge exists;
* an approval is waiting;
* a CRM contextual action is relevant.

This prevents the entire platform from becoming permanently crowded.

---

# 3. Desktop Navigation

I would evolve the current navigation into:

```text
SMARTSAPP

⌘K  Search or ask anything

RECENT
  Recent
  Favorites

WORK
  Inbox
  Contacts
  Deals
  Tasks
  Meetings
  Calendar

AUTOMATION
  Automations
  Workflows
  Runs
  Schedules

INTELLIGENCE
  Command Center
  Company Brain
  Knowledge Inbox
  Knowledge
  Knowledge Graph
  Ideas
  Agents
  Agent Runs

STUDIOS
  Campaign Intelligence
  Landing Pages
  Media
  Surveys
  Forms
  Flipbooks
  Messaging
  Call Centre

TRANSACT
  Finance
  Billing
  Payments
  Documents

SYSTEM
  Analytics
  Integrations
  Developers
  Settings
```

### Important change

**Company Brain, Knowledge, Knowledge Graph, Ideas, Agents and Agent Runs should not feel like isolated products.**

They are the operating intelligence layer of every SmartSapp module.

---

# 4. Navigation Behavior

The current SmartSapp sidebar concept already supports collapsed groups, expanded groups, a command/search field, Recent, Live Site and user profile controls. 

Keep those mechanics.

### Expanded

```text
Work
  Deals
  Tasks
  Meetings

Intelligence
  Command Center
  Company Brain
  Knowledge Inbox
  Knowledge Graph
  Ideas
  Agents
  Agent Runs
```

### Collapsed

Icons only.

### Hover

Tooltip.

### Keyboard

`⌘K`:

```text
global command
```

`⌘Shift+K`:

```text
knowledge search
```

`⌘Shift+A`:

```text
agent
```

`⌘Shift+I`:

```text
knowledge inbox
```

`⌘Shift+G`:

```text
knowledge graph
```

---

# 5. Responsive Breakpoints

I would standardize SmartSapp around four layout classes rather than simply desktop/mobile.

| Class    |         Width | Layout                         |
| -------- | ------------: | ------------------------------ |
| Mobile S |      `<480px` | single-column                  |
| Mobile L |   `480–767px` | single-column + bottom actions |
| Tablet   |  `768–1199px` | two-column / collapsible rail  |
| Desktop  | `1200–1439px` | full shell                     |
| Wide     |     `1440px+` | full shell + contextual rail   |

Use CSS container queries wherever components need to adapt to their **actual available width**, rather than assuming the viewport tells the whole story.

---

# 6. Mobile Shell

Mobile should **not** simply be desktop squeezed into 375 pixels.

Use:

```text
┌────────────────────────┐
│ ☰   SmartSapp     ◉    │
├────────────────────────┤
│ Ask SmartSapp...       │
├────────────────────────┤
│                        │
│      Main Content      │
│                        │
│                        │
├────────────────────────┤
│ Home │ Work │ + │ AI │ More │
└────────────────────────┘
```

### Bottom navigation

Primary:

```text
Home
Work
Create
AI
More
```

The `AI` button opens the command surface rather than a traditional chat screen.

The system should never force a user to drill through five levels of navigation on mobile.

---

# 7. Tablet Shell

Tablet gets:

```text
collapsed sidebar
+
main workspace
+
overlay contextual rail
```

When the user selects an entity:

```text
main
  ↓
context drawer
```

rather than permanently consuming horizontal space.

---

# 8. The Global Command Center

This is the most important new screen.

Route:

```text
/intelligence
```

But it should also open globally through `⌘K`.

## Initial state

```text
┌─────────────────────────────────────────────────────────┐
│ Good afternoon, Joseph                                 │
│                                                         │
│ What would you like SmartSapp to do?                    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Ask, find, analyze or delegate...               ⌘K │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Suggested                                                 │
│ [Review at-risk deals] [Prepare today's meetings]       │
│ [Find overdue payments] [Continue yesterday's work]      │
│                                                         │
│ ACTIVE AGENTS                                             │
│ 3 running   2 waiting for approval   7 scheduled        │
└─────────────────────────────────────────────────────────┘
```

### Input interpretation

As the user types:

> “Find stalled…”

the UI should classify the request:

```text
SEARCH
ANALYZE
EXECUTE
AUTOMATE
```

Do not force the user to specify.

---

# 9. Command Composer

The composer needs five states.

### State A — Empty

```text
What do you want SmartSapp to do?
```

### State B — Suggesting

```text
Find stalled deals...

Suggested:
• Find deals with no activity in 7 days
• Find deals with overdue tasks
• Find deals with declining engagement
```

### State C — Planning

```text
I can do this:

1. Find open deals
2. Check last activity
3. Check next scheduled task
4. Identify risk
5. Prepare recommended actions

[Review plan]
```

### State D — Executing

```text
Finding deals...
✓ 37 deals scanned

Analyzing activity...
✓ 37 analyzed

Preparing recommendations...
● Running
```

### State E — Completed

```text
Done.

12 deals need attention.

[Review 12 deals]
[Create follow-up tasks]
[Prepare outreach]
```

---

# 10. Agent Run Center

Route:

```text
/intelligence/runs
```

## List view

Columns:

```text
Agent
Goal
Status
Started
Duration
Tools
Entities
Cost
Outcome
```

Filters:

```text
Running
Waiting
Completed
Failed
Scheduled
Needs attention
```

## Run detail

```text
┌──────────────────────────────────────────────────────────┐
│ Prepare follow-up campaign                              │
│ Campaign Agent • Run #A-2934                            │
│ Status: Waiting for approval                            │
├──────────────────────────────────────────────────────────┤
│ PLAN                     │ CONTEXT                       │
│ ✓ Find audience          │ 1,243 contacts               │
│ ✓ Segment                │ 87 high-value                │
│ ✓ Draft messaging        │ 14 suppressed                │
│ ● Approval               │ 5 excluded                   │
│ ○ Schedule               │                              │
├──────────────────────────────────────────────────────────┤
│ TOOL ACTIVITY                                             │
│                                                            │
│ ✓ contact.search                                           │
│ ✓ campaign.create                                         │
│ ✓ audience.evaluate                                       │
│ ✓ message.draft                                           │
│ ● campaign.launch → approval required                     │
└──────────────────────────────────────────────────────────┘
```

---

# 11. Agent Run Timeline

Each action should be inspectable.

```text
14:02:11
Retrieved Greenfield School

14:02:12
Loaded 18 related notes

14:02:13
Loaded 4 meeting records

14:02:14
Detected unresolved payment commitment

14:02:16
Created follow-up task

14:02:17
Drafted communication

14:02:17
Awaiting approval
```

The user can expand every event to see:

```text
Input
Tool
Policy
Evidence
Output
Side effects
```

---

# 12. Agent Approval Center

Route:

```text
/intelligence/approvals
```

Cards:

```text
Campaign launch
Financial reconciliation
External message
Bulk update
Privileged change
```

Each card includes:

```text
WHAT
WHY
WHO / WHAT WILL BE AFFECTED
EVIDENCE
EXPECTED RESULT
RISK
POLICY
```

Never use a generic:

> “AI wants to do something.”

Instead:

> **“Launch campaign to 1,243 contacts.”**

That distinction matters enormously.

---

# 13. Company Brain

Route:

```text
/intelligence/company-brain
```

The Company Brain is the **organization-level intelligence dashboard**.

Top:

```text
Company Brain
[Ask Company Brain...]

Knowledge health
Memory coverage
New knowledge
Conflicts
Important unresolved questions
```

Sections:

```text
What's changed
What we know
What we don't know
What needs attention
Important relationships
Active initiatives
Strategic themes
Recent decisions
```

### Example

```text
RECENT DECISIONS

School expansion
Decision:
Prioritize Nigeria pilot before wider West Africa rollout.

Source:
Leadership Meeting — 12 Sep

Confidence:
High

[View evidence]
[Open related ideas]
```

The brain is not a document list.

It is an **interpretation layer over the knowledge graph + memory system**.

---

# 14. Knowledge Inbox

Route:

```text
/intelligence/knowledge/inbox
```

This should look structurally closer to an intelligent triage inbox than a file manager.

```text
┌─────────────────────────────────────────────────────────┐
│ Knowledge Inbox                              47 new      │
│                                                         │
│ [All] [Needs review] [Important] [Conflicts] [Saved]   │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│ New meeting  │ Customer wants annual billing            │
│ 12m ago      │                                          │
│              │ Source: Meeting                          │
│ New note     │ Confidence: High                         │
│ 18m ago      │                                          │
│              │ Suggested relationships:                 │
│ Web research │ • Greenfield School                      │
│ 31m ago      │ • Annual subscription                     │
│              │ • Billing                                 │
│              │ [Accept] [Edit] [Dismiss]                │
└──────────────┴──────────────────────────────────────────┘
```

### Knowledge Inbox item types

```text
New fact
New relationship
Decision
Commitment
Preference
Procedure
Conflict
Possible duplicate
Potentially sensitive
Low-confidence inference
```

### AI action

The user should never have to manually classify every piece of information.

AI proposes:

```text
Fact:
Customer prefers annual billing.

Source:
Meeting transcript.

Confidence:
0.91

Suggested entity:
Greenfield School

Suggested relationship:
PREFERS → Annual Billing
```

Actions:

```text
Accept
Accept all similar
Edit
Reject
```

---

# 15. Knowledge Item Inspector

Every knowledge item gets a side panel:

```text
Fact
Customer prefers annual billing.

TYPE
Preference

SOURCE
Meeting — Sep 12

CONFIDENCE
High

VALID FROM
Sep 12

VALID UNTIL
Unknown

ENTITIES
Greenfield School

RELATED
Billing
Subscription
Deal #1842

EVIDENCE
[View transcript excerpt]

USED BY
3 agents
2 workflows
1 campaign

[Edit]
[Invalidate]
```

This solves a major AI trust problem:

**memory without provenance becomes dangerous.**

---

# 16. Knowledge Search

Global `⌘Shift+K`.

Search supports:

```text
keyword
semantic
relationship
time
entity
event
source
confidence
```

Query:

> “What did we promise Greenfield School regarding payment terms?”

The result should not only produce text.

It should produce an **evidence stack**:

```text
Answer
──────
Greenfield was offered annual billing with...

Evidence
───────
Meeting Sep 12
Note Sep 13
Email Sep 13
Deal record

Confidence
High

Conflicts
None found

[Open knowledge graph]
[Open source]
[Create task]
```

---

# 17. Knowledge Graph

Route:

```text
/intelligence/knowledge-graph
```

Do not build a graph that looks like a developer debugging screen.

The primary graph should be an **exploration environment**.

```text
                    Greenfield School
                   /        |         \
                  /         |          \
          Deal #1842     Jane Doe     Annual Billing
             |              |              |
        Meeting            Contact       Preference
          /   \
      Note     Task
```

### Graph toolbar

```text
Search
Depth
Entity types
Relationships
Time
Confidence
Source
```

### Interaction

Click node:

```text
focused entity
```

Double click:

```text
expand relationship neighborhood
```

Hover:

```text
quick preview
```

Right click:

```text
Ask AI
Create task
Open CRM
Add to Idea Canvas
Create relationship
```

---

# 18. Graph Modes

Three modes:

### Explore

Manual graph navigation.

### Explain

AI explains:

> “Why is this school connected to this campaign?”

### Investigate

Agent traverses the graph and returns:

```text
Hypothesis
Evidence
Relationships
Missing information
Suggested next investigation
```

---

# 19. Idea Intelligence

Route:

```text
/intelligence/ideas
```

This is where **Idea Canvas** becomes a major product surface.

Tabs:

```text
Ideas
Canvas
Signals
Experiments
Initiatives
```

---

# 20. Idea Inbox

A lightweight stream:

```text
New idea
Suggested idea
Emerging pattern
Customer request
Market signal
Internal observation
AI-generated hypothesis
```

Every idea can be:

```text
Capture
Develop
Connect
Test
Promote to initiative
Archive
```

---

# 21. Idea Canvas

This should become one of SmartSapp's flagship interfaces.

Route:

```text
/intelligence/ideas/canvas/:id
```

## Canvas architecture

```text
┌────────────────────────────────────────────────────────────┐
│ Idea: Parent Retention Campaign                       ...  │
├────────────────────────────────────────────────────────────┤
│ Toolbar: Select • Connect • Group • AI • Present • Zoom   │
├───────────────────────────────┬────────────────────────────┤
│                               │                            │
│                               │ INSPECTOR                  │
│           CANVAS              │                            │
│                               │ Selected node              │
│      ┌───────────┐            │                            │
│      │ Problem   │──────────┐ │ Evidence                   │
│      └───────────┘          │ │                            │
│             │               ▼ │ Related entities           │
│             ▼         ┌──────────────┐                    │
│      ┌────────────┐   │ Opportunity  │                    │
│      │ Insight    │   └──────────────┘                    │
│      └────────────┘            │                           │
│                               ▼                            │
│                          ┌──────────┐                      │
│                          │ Campaign │                      │
│                          └──────────┘                      │
├───────────────────────────────┴────────────────────────────┤
│ AI: “What should I explore next?”                          │
└────────────────────────────────────────────────────────────┘
```

---

# 22. Idea Canvas Node Types

```text
Problem
Observation
Insight
Question
Hypothesis
Customer
Signal
Evidence
Opportunity
Solution
Feature
Campaign
Experiment
Decision
Risk
Constraint
Metric
Task
```

Nodes should have semantic types rather than being generic rectangles.

---

# 23. Idea Canvas AI

AI should be deeply embedded.

Select nodes:

> “Connect these ideas.”

AI proposes:

```text
Problem
↓
Possible cause
↓
Evidence
↓
Hypothesis
↓
Experiment
```

Actions:

```text
Explain
Expand
Challenge
Find evidence
Find contradictory evidence
Generate alternatives
Turn into experiment
Turn into campaign
Turn into workflow
```

### Important

AI must never silently modify the canvas.

Use:

```text
Proposed changes
→ Preview
→ Accept
```

---

# 24. Campaign Intelligence Handoff From Idea Canvas

This is one of the most important cross-module flows.

From the canvas:

```text
Idea
 ↓
Insight
 ↓
Audience
 ↓
Offer
 ↓
Campaign
```

Button:

```text
[Turn into Campaign]
```

The system opens Campaign Intelligence with the graph already populated.

Not:

```text
new blank campaign
```

but:

```text
Campaign Intelligence
Context imported from Idea Canvas

Problem:
Low parent engagement

Evidence:
...

Audience hypothesis:
...

Offer:
...

Desired outcome:
...
```

The campaign agent continues from there.

---

# 25. Campaign Intelligence Studio

Route:

```text
/studios/campaign-intelligence
```

This should be the **orchestration studio** for growth work.

It is not an email builder.

It is a campaign operating system.

## Main layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Campaign Intelligence                                       │
│                                                             │
│ [Campaigns] [Intelligence] [Canvas] [Assets] [Experiments]  │
├──────────────────────────────────────────────────────────────┤
│ CAMPAIGN GRAPH                                              │
│                                                             │
│ Objective                                                   │
│    ↓                                                        │
│ Audience                                                    │
│    ↓                                                        │
│ Insight                                                     │
│    ↓                                                        │
│ Offer                                                       │
│    ↓                                                        │
│ Landing Page ─ Form ─ Survey ─ Email ─ WhatsApp ─ CRM      │
│                                  ↓                          │
│                              Automation                      │
│                                  ↓                          │
│                             Measurement                      │
└──────────────────────────────────────────────────────────────┘
```

---

# 26. Campaign Graph

Every asset becomes a node.

```text
Campaign
 ├── Audience
 ├── Segment
 ├── Landing Page
 ├── Form
 ├── Survey
 ├── Email Sequence
 ├── WhatsApp Sequence
 ├── Creative
 ├── Automation
 ├── CRM Segment
 ├── Goal
 └── KPI
```

Connections indicate dependencies.

If the user changes:

```text
audience
```

the interface should show:

```text
Affected:
Landing Page
Form
Email
Automation
Analytics
```

This is **impact awareness**.

---

# 27. Campaign AI

Campaign agent actions:

```text
Research audience
Generate positioning
Find relevant CRM segments
Analyze previous campaigns
Recommend channels
Generate campaign graph
Generate assets
Validate variables
Validate links
Check audience overlap
Predict possible conflicts
Prepare launch
Monitor campaign
```

---

# 28. Campaign Builder State Machine

```text
Draft
 ↓
Researching
 ↓
Structured
 ↓
Assets Generated
 ↓
Validation
 ↓
Review
 ↓
Approval
 ↓
Scheduled
 ↓
Running
 ↓
Monitoring
 ↓
Optimizing
 ↓
Completed
```

The UI should visibly communicate state.

Do not use only a spinner.

---

# 29. Campaign Handoff Into CRM

Every campaign should have a contextual CRM view:

```text
Affected contacts
Affected accounts
Deals
Previous interactions
Suppression rules
Audience rationale
```

Selecting a contact:

```text
Open CRM
```

Selecting a campaign:

```text
Open Campaign Intelligence
```

Selecting an insight:

```text
Open Knowledge
```

This is the three-way contextual loop:

```text
CRM ↔ Knowledge ↔ Campaign
```

---

# 30. CRM Contextual Surface Architecture

This is critical.

A CRM record should become an **AI context hub**, not merely a record page.

For:

```text
/contacts/:id
/institutions/:id
/deals/:id
```

add a persistent intelligence header:

```text
┌──────────────────────────────────────────────────────────┐
│ Greenfield School                                      │
│ Institution • Active customer                            │
│                                                          │
│ [Overview] [Activity] [Deals] [Meetings] [Knowledge]    │
│ [Intelligence] [Campaigns] [AI]                          │
└──────────────────────────────────────────────────────────┘
```

---

# 31. CRM AI Surface

On the right:

```text
AI CONTEXT

Relationship health
████████░░ 82

Open commitments
3

At-risk items
1

Recommended action
Follow up on annual billing proposal

[Review]
```

---

# 32. CRM “Ask About This” Surface

Every entity gets:

```text
Ask AI about Greenfield...
```

Suggested:

```text
What do they care about?
What's unresolved?
What did we promise?
What are the risks?
What should happen next?
Summarize our relationship.
Prepare me for my meeting.
```

---

# 33. Entity Intelligence Tab

The existing Lead Intelligence architecture already contains a dedicated CRM embedded Lead Intelligence tab. 

Extend it instead of replacing it.

New tabs:

```text
Overview
Lead Intelligence
Knowledge
Relationships
Meetings
Communications
Tasks
Deals
AI
```

### Lead Intelligence

Keep:

```text
digital diagnosis
technographics
enrichment
scoring
opportunities
objections
```

but add:

```text
[Ask Agent]
[Enrich]
[Create Deal]
[Build Campaign]
[Add to Idea Canvas]
```

---

# 34. Deal Intelligence Screen

Route:

```text
/deals/:id
```

The upper section:

```text
Deal value
Stage
Probability
Health
Last activity
Next activity
```

Then:

```text
AI Deal Brief
```

```text
Current situation
Buying signals
Risks
Stakeholders
Open commitments
Competitive signals
Recommended next actions
```

Each recommendation should be executable:

```text
Create task
Draft email
Book meeting
Update stage
Add note
Launch research
```

---

# 35. Meeting Intelligence Surface

The current Meetings design already includes an AI scheduling assistant and extensive booking/event/calendar functionality. 

Add an AI meeting workspace.

### Before meeting

```text
Meeting Brief

Who is attending
Previous conversations
Current deal
Open commitments
Likely objectives
Potential objections
Questions to ask
Recommended strategy
```

### After meeting

```text
Meeting Outcomes

Decisions
Commitments
Action items
Buying signals
Objections
Changes in deal state

[Apply CRM updates]
[Create tasks]
[Draft follow-up]
```

---

# 36. Agent Builder

Route:

```text
/intelligence/agents
```

### Agent list

Cards:

```text
Deal Coach
Lead Researcher
Collections Agent
Campaign Agent
Meeting Assistant
School Operations Agent
```

Card information:

```text
status
version
runs
success rate
cost
last run
```

---

# 37. Agent Editor

Five sections:

```text
1. Identity
2. Goal
3. Capabilities
4. Memory
5. Governance
```

### Identity

```text
Name
Purpose
Description
Avatar
Tone
Owner
```

### Goal

```text
What is this agent trying to accomplish?
```

### Capabilities

Interactive tool picker:

```text
CRM
Sales
Meetings
Messaging
Finance
Knowledge
Campaigns
```

Each tool includes:

```text
Read
Create
Update
Execute
```

Do not expose “all permissions.”

---

# 38. Agent Policy Editor

Matrix:

| Capability | Read | Create | Update |       Execute |
| ---------- | ---: | -----: | -----: | ------------: |
| Contacts   |    ✓ |      ✓ |      ✓ |             — |
| Deals      |    ✓ |      ✓ |      ✓ |             — |
| Messages   |    ✓ |      ✓ |      — |      Approval |
| Campaigns  |    ✓ |      ✓ |      ✓ |      Approval |
| Payments   |    ✓ |      — |      — | Dual approval |

This is much easier to reason about than a giant JSON policy.

---

# 39. Agent Testing Workspace

Before publishing:

```text
Test Agent
```

User gives:

> “Find at-risk deals.”

Panel:

```text
INPUT
...

PLAN
...

TOOLS
deal.search
activity.search
knowledge.search

PROPOSED CHANGES
None

OUTPUT
...
```

Run against:

```text
Example workspace
Synthetic dataset
Production shadow dataset
```

---

# 40. Agent Version Diff

Like GitHub:

```text
Deal Agent v1.4
vs
Deal Agent v1.5

Changed:
- Added meeting context
- Added payment history
- Removed campaign launch capability
- Updated instruction
- Changed approval policy
```

This is necessary for accountable agent operations.

---

# 41. Workflow Builder

Route:

```text
/automation/workflows
```

New canvas:

```text
Trigger
  ↓
Retrieve
  ↓
Condition
  ↓
Agent
  ↓
Approval
  ↓
Tool
  ↓
Verify
  ↓
Wait
  ↓
Complete
```

Every node has:

```text
configuration
input
output
failure behavior
retry policy
permissions
```

---

# 42. Workflow Node Editor

Example Agent node:

```text
Agent
──────────────────
Agent: Deal Strategist

Goal:
Determine whether this deal requires intervention.

Input:
{{deal}}

Memory:
[Relevant CRM]
[Knowledge]
[Meeting history]

Budget:
$0.05
Max tools:
10

On uncertainty:
Escalate

Output:
risk classification
recommended action
```

---

# 43. MCP Capability Registry UI

Route:

```text
/settings/ai/capabilities
```

This is for technical administrators.

List:

```text
deal.search
deal.update
message.send
campaign.launch
knowledge.search
```

Columns:

```text
Capability
Domain
Risk
Version
Agents using
Success
Latency
```

Detail:

```text
Schema
Permissions
Risk
Dependencies
Events
MCP mapping
Tests
Version history
```

---

# 44. Knowledge Editor

Knowledge isn't just “notes.”

Editor types:

```text
Fact
Decision
Preference
Procedure
Policy
Insight
Hypothesis
Relationship
```

Each editor has:

```text
content
type
source
confidence
validity
entities
relationships
visibility
sensitivity
```

---

# 45. Memory Controls

User settings:

```text
What SmartSapp remembers

☑ Recent interactions
☑ Customer preferences
☑ Workspace procedures
☑ Meeting commitments
☐ Personal information
☑ Campaign outcomes
```

Also:

```text
View memory
Edit memory
Delete memory
Expire memory
```

This directly addresses the HAX principle that users need global control over what AI monitors and remembers. ([Microsoft][2])

---

# 46. AI Interaction Patterns

SmartSapp should use **six** standard AI interaction patterns.

### 1. Ask

Answers.

### 2. Suggest

Recommendations.

### 3. Propose

Changes awaiting acceptance.

### 4. Execute

Actions within authorization.

### 5. Delegate

Long-running agent work.

### 6. Monitor

Ongoing agent activity.

Never invent a seventh pattern for every feature.

---

# 47. AI Response Anatomy

Every substantive AI answer should be structurally capable of displaying:

```text
Answer

Why

Evidence

Actions

Confidence

Limitations
```

These sections can be collapsed.

Do not force every response to expose internal reasoning. The UI should provide **decision-relevant evidence and provenance**, not hidden chain-of-thought.

---

# 48. AI Uncertainty UI

Avoid:

```text
Confidence: 62%
```

when there is no statistically meaningful calibration behind it.

Prefer:

```text
Confidence: Moderate

Why:
Based on 3 recent interactions, but no recent
decision-maker activity was found.
```

---

# 49. AI Correction

Every AI-generated result:

```text
✓ Accept
✎ Edit
↻ Regenerate
⚠ Report issue
```

The system should record the correction.

For example:

```text
AI:
Lead priority = Medium

User:
Changed → High

Memory:
This correction can be used for future preference modeling,
subject to workspace policy.
```

---

# 50. Destructive / External Actions

Every action needs an explicit risk treatment.

### Low risk

```text
Create internal note
Create task
Search
Summarize
```

Immediate execution.

### Medium

```text
Modify deal
Reschedule meeting
Bulk edit CRM
```

Policy-based execution.

### High

```text
Send external message
Publish campaign
Issue financial transaction
Delete records
```

Explicit approval.

### Critical

```text
Privilege change
Bulk financial action
Tenant-wide mutation
```

Strong approval / dual control.

The UI must show **why approval is required**, not merely say “Approval required.”

---

# 51. Empty States

Every screen gets meaningful empty states.

## Knowledge Inbox empty

Not:

> No data.

Instead:

```text
Your knowledge inbox is clear.

SmartSapp will surface:
• important new facts
• decisions
• conflicts
• commitments
• suggested relationships

[Explore Company Brain]
```

---

# 52. Loading States

Avoid generic full-page spinners.

Use stage-specific progress.

Bad:

```text
Loading...
```

Better:

```text
Finding relevant records ✓
Checking relationships ✓
Searching knowledge ●
Preparing answer ○
```

For agents:

```text
Researching
Planning
Executing
Verifying
```

---

# 53. Error States

Three categories.

### Recoverable

```text
We couldn't retrieve the meeting.
[Retry]
```

### User-action required

```text
This agent doesn't have permission to send messages.

[Request permission]
```

### System failure

```text
The messaging provider is unavailable.

The campaign was not sent.
No changes were committed.

[View run]
[Retry when available]
```

The final line is critical:

**tell the user whether state changed.**

---

# 54. Offline State

On mobile:

```text
Offline

Drafts are saved locally.
Changes will sync when connection returns.
```

For sensitive actions:

```text
Sending is unavailable offline.
```

Never fake optimistic completion for irreversible operations.

---

# 55. Streaming Agent State

The UI must distinguish:

```text
Thinking / planning
```

from actual tool execution.

Do not expose internal reasoning.

Display:

```text
Planning next steps…

Searching 37 deals…

Updating 4 records…

Verifying results…
```

---

# 56. Agent Notifications

Global activity indicator:

```text
AI
3 running
2 approvals
1 failed
```

Click:

```text
Agent Center
```

Push-worthy events:

```text
Approval needed
Agent failed
Agent completed
High-risk issue found
Campaign needs intervention
```

---

# 57. Contextual AI Surfaces Everywhere

The same AI system appears differently depending on context.

### Contact

```text
Ask about this person
```

### Institution

```text
Relationship intelligence
```

### Deal

```text
Deal strategist
```

### Meeting

```text
Meeting brief
```

### Campaign

```text
Campaign strategist
```

### Invoice

```text
Collections analyst
```

### Knowledge

```text
Research assistant
```

### Canvas

```text
Idea strategist
```

Same runtime.

Different context.

---

# 58. Cross-Surface Context Persistence

If a user does:

```text
CRM
→ Deal
→ AI
→ “turn this into campaign”
```

the Campaign Intelligence Studio should open with:

```text
Origin:
Deal #1842

Context imported:
Customer
Problem
Audience
Opportunity
Recommended offer
Prior communication
```

The user should never have to manually reconstruct context.

---

# 59. Universal “Send To” Actions

Every meaningful object should have:

```text
Send to AI
Send to Knowledge
Send to Idea Canvas
Send to Campaign
Send to Workflow
Send to Agent
```

Example:

From meeting:

```text
[Add to Knowledge]
[Create Tasks]
[Add to Idea Canvas]
[Create Campaign]
```

From Knowledge:

```text
[Create Idea]
[Create Agent Task]
[Use in Campaign]
```

From Idea:

```text
[Create Campaign]
[Create Workflow]
[Create Experiment]
```

This is how the app becomes interconnected.

---

# 60. Design System

The visual system should retain SmartSapp's clean blue/white foundation while becoming more information-dense where needed.

The existing SmartSapp brand direction uses blue around `#3A86FF`; the older email work uses Poppins while the newer product direction uses Figtree.

I would use:

```text
Primary UI font:
Figtree

Brand:
SmartSapp Blue #3A86FF

Surface:
White
Neutral-50
Neutral-100

Text:
Neutral-950
Neutral-700
Neutral-500

Semantic:
Success
Warning
Danger
Info
```

Keep color semantic, not decorative.

---

# 61. Component System

The foundational component taxonomy should be:

## Shell

```text
AppShell
Sidebar
Topbar
CommandBar
Breadcrumbs
ContextRail
BottomNav
```

## Navigation

```text
NavGroup
NavItem
RecentList
WorkspaceSwitcher
EntitySwitcher
```

## Data

```text
DataTable
List
Card
Timeline
ActivityFeed
MetricCard
FilterBar
```

## AI

```text
AIComposer
AIResponse
AISuggestion
AIProposal
AIActionCard
AgentRunCard
ToolCallCard
EvidenceCard
ConfidenceBadge
ApprovalCard
AgentTimeline
```

## Knowledge

```text
KnowledgeCard
KnowledgeSource
KnowledgeInboxItem
FactInspector
EvidenceStack
RelationshipCard
GraphCanvas
GraphNode
GraphEdge
```

## Canvas

```text
Canvas
CanvasNode
CanvasEdge
MiniMap
CanvasToolbar
SelectionBox
InspectorPanel
```

## Editors

```text
EntityEditor
AgentEditor
WorkflowEditor
CampaignEditor
PromptEditor
SkillEditor
KnowledgeEditor
```

## Feedback

```text
Toast
Banner
InlineError
StatusIndicator
Progress
Skeleton
EmptyState
```

---

# 62. Component State Discipline

Every interactive component should explicitly define:

```text
default
hover
focus
active
selected
disabled
loading
success
error
empty
permission-denied
read-only
dirty
saving
saved
conflict
```

Editors additionally:

```text
draft
validation-error
unsaved
autosaving
published
archived
version-conflict
```

---

# 63. Editor State Architecture

All major editors should use the same conceptual state machine:

```text
VIEW
 ↓
EDIT
 ↓
DIRTY
 ↓
VALIDATING
 ↓
SAVING
 ↓
SAVED
 ↓
PUBLISHED
```

Or:

```text
DIRTY
 ↓
SAVE ERROR
 ↓
RETRY
```

Never lose unsaved work.

---

# 64. Autosave

For:

```text
Idea Canvas
Campaign Graph
Workflow Builder
Knowledge Editor
Agent Editor
Prompt Editor
```

use debounced autosave.

Show:

```text
Saving…
Saved 4 seconds ago
```

not a meaningless spinner.

---

# 65. Conflict Resolution

If another user edits:

```text
This canvas changed elsewhere.

Your version:
...

Current version:
...

[Review changes]
[Keep mine]
[Use current]
[Merge]
```

For structured data, provide field-level conflict resolution.

---

# 66. Canvas Interaction Rules

Idea Canvas and Campaign Graph share a common canvas engine.

Controls:

```text
Zoom +
Zoom -
Fit
Minimap
Undo
Redo
Select
Connect
Group
Comment
AI
```

Desktop:

```text
mouse
trackpad
keyboard
```

Tablet:

```text
touch pan
pinch zoom
long press
```

Mobile:

Do not attempt full free-form infinite-canvas editing as the primary experience.

Use:

```text
outline mode
node list
focused node editor
mini canvas preview
```

That dramatically improves usability.

---

# 67. Accessibility Architecture

Target:

**WCAG 2.2 AA.**

WCAG 2.2 explicitly covers focus behavior, target size, dragging, status messages, error prevention, accessible authentication and other requirements relevant to SmartSapp. ([W3C][3])

### Required principles

Every interactive control must have:

```text
accessible name
visible focus
keyboard operation
state
role
error description
```

ARIA should supplement proper HTML, not replace it. WAI-ARIA's APG defines keyboard and semantics patterns for dialogs, grids, tabs, comboboxes, trees and other complex controls. ([W3C][4])

---

# 68. Keyboard System

Global:

```text
⌘K  Command
⌘Shift+K  Knowledge
⌘Shift+A  Agent
⌘Shift+I  Inbox
⌘Shift+G  Graph
```

Canvas:

```text
Space + drag    pan
+               zoom in
-               zoom out
Delete          delete selection
⌘Z              undo
⌘Shift+Z        redo
```

Tables:

```text
Arrow keys
Home
End
Enter
Space
```

Dialogs:

```text
Esc close
Tab trap
Shift+Tab reverse
```

Complex widgets should follow WAI-ARIA Authoring Practices rather than inventing keyboard behavior. ([W3C][5])

---

# 69. Target Sizes

Interactive targets should meet at least the WCAG 2.2 minimum target-size requirement of 24×24 CSS pixels, with SmartSapp using larger targets for touch interactions where practical. ([W3C][6])

For mobile:

```text
primary action:
44–48px

icon-only:
44px preferred

dense desktop:
32–40px where appropriate
```

---

# 70. Screen Reader Behavior

AI updates should use polite status regions:

```text
“Agent completed.”
“Approval required.”
“Three records updated.”
```

Do not stream every intermediate event into the screen-reader announcement queue.

For agent runs:

```text
aria-live="polite"
```

only for meaningful state transitions.

---

# 71. Reduced Motion

Canvas animations, graph transitions, card motion and agent progress animations must honor:

```text
prefers-reduced-motion
```

A reduced-motion mode should retain state clarity without requiring animation.

---

# 72. AI-Specific Accessibility

AI output needs:

```text
semantic headings
structured lists
keyboard-accessible source links
accessible action buttons
non-color confidence indicators
```

Never communicate:

```text
high confidence = green
low confidence = red
```

without textual labels.

---

# 73. MCP Apps UX

SmartSapp itself should support MCP Apps where useful.

For example, an MCP tool can return:

```text
Campaign performance dashboard
```

which renders interactively.

MCP Apps defines `ui://` resources, tool/UI linkage and sandboxed bidirectional communication. ([GitHub][7])

But there is a critical UX rule:

> **MCP Apps are embedded capability surfaces, not the main SmartSapp navigation paradigm.**

Use them when:

```text
the result is inherently interactive
the tool owns the UX
the host should not need a full app page
```

Otherwise use native SmartSapp screens.

---

# 74. Desktop / Tablet / Mobile Matrix

| Surface          | Desktop          | Tablet          | Mobile         |
| ---------------- | ---------------- | --------------- | -------------- |
| Command Center   | full page        | full page       | full page      |
| Agent Runs       | 3-column         | 2-column        | stacked        |
| Knowledge Inbox  | list + inspector | list + drawer   | list → detail  |
| Knowledge Graph  | full canvas      | canvas + drawer | focus mode     |
| Idea Canvas      | infinite canvas  | canvas          | outline/focus  |
| Campaign Graph   | full canvas      | canvas          | vertical graph |
| Agent Builder    | 2-pane           | stacked panes   | stepper        |
| Workflow Builder | full canvas      | canvas          | node list      |
| CRM              | full record      | full record     | sections       |
| Context Rail     | persistent       | overlay         | bottom sheet   |
| Approval         | side panel       | drawer          | full screen    |
| Tables           | rich table       | condensed       | cards/list     |

---

# 75. The Mobile Agent Experience

This deserves separate design.

A mobile user might say:

> “Prepare me for my 2pm meeting.”

The UI:

```text
Preparing meeting brief…

✓ Participant history
✓ Open deal
✓ Recent communications
✓ Outstanding tasks

Ready.

[Open brief]
```

The brief:

```text
GREENFIELD SCHOOL

Meeting objective
Resolve annual billing terms

3 things to know
...

2 risks
...

1 recommended question
...

[Open CRM]
[Start meeting]
```

This is much better than showing a desktop “agent run” page on a phone.

---

# 76. Global Context Rail

Every major page can invoke:

```text
Context
```

It contains:

```text
Current entity
Related entities
Recent activity
Knowledge
AI recommendations
Active agents
Pending actions
```

For example on a Deal page:

```text
CONTEXT

Greenfield School
  ↓
Deal #1842
  ↓
2 contacts
4 meetings
9 notes
1 campaign
3 open tasks
```

This becomes the connective tissue between modules.

---

# 77. Notifications Architecture

SmartSapp should stop treating notifications as generic messages.

Notification types:

```text
ACTION_REQUIRED
AGENT_COMPLETED
AGENT_FAILED
KNOWLEDGE_DISCOVERED
APPROVAL_REQUIRED
CONFLICT_DETECTED
SYSTEM
```

Each notification links directly into the relevant object/run.

---

# 78. Search Architecture

Global search should unify:

```text
Contacts
Deals
Tasks
Meetings
Knowledge
Ideas
Campaigns
Agents
Workflows
Documents
```

Results should show:

```text
Exact match
Semantic match
Relationship match
```

Example:

> “payment”

returns:

```text
Deals
Invoices
Notes
Meetings
Knowledge
Campaigns
```

---

# 79. AI Search Result UX

Instead of dumping 100 results:

```text
Top answer
Related records
Evidence
Actions
```

Example:

```text
12 records found

Most relevant:
Greenfield School

Why:
Mentioned payment terms in 4 recent records.

[Open]
[Explain]
[Use in campaign]
```

---

# 80. Global Object Command Menu

Every object should have:

```text
...
```

Actions are contextual:

```text
Ask AI
Summarize
Find related
Add to canvas
Add to campaign
Create task
Create workflow
Share
Export
```

This dramatically reduces navigation complexity.

---

# 81. Design Principle: No Dead Ends

Every major SmartSapp object should expose its next logical destination.

### Knowledge

→ Idea

→ Campaign

→ Workflow

→ CRM

### CRM

→ Knowledge

→ Meeting

→ Campaign

→ Agent

### Campaign

→ CRM

→ Analytics

→ Knowledge

→ Workflow

### Meeting

→ CRM

→ Knowledge

→ Tasks

→ Campaign

### Idea

→ Campaign

→ Workflow

→ Agent

This is what makes the whole platform feel unified.

---

# 82. Phase-by-Phase UI/UX Delivery Map

Now mapping directly to the 15 implementation phases.

---

# PHASE 0 — Architecture Freeze

### UI/UX deliverables

```text
UX inventory
Screen inventory
Route inventory
Navigation inventory
Component inventory
Interaction inventory
AI touchpoint inventory
```

Create:

```text
/docs/ux/
  00-product-ia.md
  01-screen-inventory.md
  02-navigation.md
  03-component-system.md
  04-ai-interaction-model.md
  05-state-model.md
  06-accessibility.md
  07-responsive.md
  08-content-design.md
  09-usability-tests.md
```

### Validation

Test existing critical journeys:

```text
Create contact
Create deal
Create task
Schedule meeting
Send communication
Create campaign
Process payment
Open Lead Intelligence
```

### Exit

Current behavior documented and regression-tested.

---

# PHASE 1 — Capability Layer

### UI work

Build:

```text
Global Command Bar v1
Context Action System
Object Command Menu
AI action invocation framework
```

Every existing UI action maps to a canonical capability.

No visible redesign required everywhere yet.

### Deliverable

A button such as:

```text
Create task
```

and:

```text
AI → Create task
```

must ultimately call the same capability.

---

# PHASE 2 — Event Backbone

### UI

Build:

```text
Activity timeline 2.0
Global activity events
Live status indicators
```

Entity pages begin consuming the same event stream.

### New surface

```text
/admin/activity
```

with:

```text
Human
AI
Automation
System
```

filters.

---

# PHASE 3 — Policy / Identity

### UI

Build:

```text
AI permissions
Approval center
Agent authority indicator
```

Users see:

```text
Why approval?
Who can approve?
What will happen?
```

### Admin

```text
/settings/ai/policies
```

---

# PHASE 4 — Memory / Knowledge

### UI deliverables

This is the first major new product release.

Build:

```text
Company Brain
Knowledge Inbox
Knowledge Search
Knowledge Item Inspector
Memory Settings
Knowledge Graph v1
```

### CRM

Add:

```text
Knowledge tab
AI context panel
Evidence links
```

### Exit

A user can ask:

> “What do we know about this customer?”

and navigate from answer → source → graph → CRM.

---

# PHASE 5 — MCP

### UI

Build:

```text
Capability Registry
MCP Connections
Tool Inspector
MCP Activity
```

Technical users can see:

```text
tool
version
risk
permissions
status
usage
```

### Developer surface

```text
/settings/developers/mcp
```

---

# PHASE 6 — Agent Runtime

### UI

Launch:

```text
Agent Center
Agent Builder
Agent Run Detail
Agent Timeline
Agent Test Lab
```

### First UX milestone

Global Command Center goes from:

```text
AI answer
```

to:

```text
AI can actually perform work.
```

---

# PHASE 7 — Durable Workflows

### UI

Build:

```text
Workflow Canvas
Workflow Run
Waiting State
Approval Node
Agent Node
Verification Node
```

Agent runs can now visually transition:

```text
Executing
Waiting
Resumed
Verifying
Completed
```

---

# PHASE 8 — AI-Native UX

### Major release

Build:

```text
Command Center
AI composer
AI response cards
Proposals
Agent activity
Context rail
Universal AI action system
```

Every major module receives:

```text
Ask AI
```

and:

```text
Delegate
```

---

# PHASE 9 — CRM Agent

### CRM redesign

Contact:

```text
AI Overview
Knowledge
Recommendations
```

Deal:

```text
Deal Intelligence
```

Meetings:

```text
Meeting Brief
```

Lead Intelligence:

```text
AI Researcher
```

### First agentic CRM use cases

```text
Account research
Deal review
Next-best-action
Meeting preparation
Follow-up preparation
```

---

# PHASE 10 — Sales / Growth Agents

### UI

Upgrade Lead Intelligence:

```text
Dashboard
Prospect Finder
Website Scanner
Saved Searches
Enrichment
Agent Research
Campaign handoff
```

The current Lead Intelligence architecture already includes the Prospect Finder, Website Scanner, Saved Searches, Dashboard and CRM embedded intelligence surfaces, so these should evolve rather than be rebuilt as unrelated screens. 

Add:

```text
“Have the Agent research this market”
```

and:

```text
“Turn this segment into a campaign”
```

---

# PHASE 11 — Meetings / Knowledge Agents

### Meetings

Build:

```text
Meeting Brief
Meeting AI timeline
Decision extraction
Commitment extraction
Post-meeting execution panel
```

### Knowledge

Meeting transcript →

```text
Knowledge Inbox
```

with:

```text
facts
decisions
commitments
relationships
```

---

# PHASE 12 — Finance / Operations Agents

### Finance

Build:

```text
Finance Agent panel
Exception queue
Reconciliation agent workspace
Collection agent
```

### Operations

Build:

```text
Operational alerts
Agent recommendations
Bulk action review
```

For sensitive finance operations, the UI must explicitly distinguish recommendations from committed actions.

---

# PHASE 13 — Multi-Agent Orchestration

### New UI

```text
Agent Network
```

Visual:

```text
Supervisor
    │
 ┌──┼───────────┐
Research      Finance
   │             │
Sales          Operations
    \            /
      Supervisor
```

### Agent delegation view

```text
Parent agent
  ↓
Child agent
  ↓
Task
  ↓
Authority
  ↓
Result
```

Users can inspect but should not have to micro-manage routine work.

---

# PHASE 14 — Verification / Self-Management

### New UI

Every major agent run gets:

```text
Plan
Actions
Expected Result
Actual Result
Verification
Exception
```

Add:

```text
Agent Health
```

showing:

```text
success rate
failure rate
recovery rate
approval rate
average duration
cost
tool errors
```

---

# PHASE 15 — Production Evaluation

### UI

Build:

```text
Agent Evaluation Center
```

Views:

```text
Benchmarks
Regression
Production quality
Failures
Human corrections
Cost
Latency
```

### Critical screen

```text
Agent Quality

Task success      96.2%
Tool correctness  98.7%
Policy violations 0
Human correction  4.8%
Median runtime    18s
```

The important metric is not “AI confidence.”

It is **actual task performance**.

---

# 83. Testing Strategy for the UI

The UI needs its own testing pyramid.

## Component

Use:

```text
Vitest
React Testing Library
```

Test:

```text
state transitions
keyboard
accessibility
loading
error
empty
permission
```

---

# 84. Integration

Test:

```text
AI → capability
AI → approval
AI → tool
AI → CRM
AI → knowledge
AI → campaign
```

---

# 85. E2E

Use Playwright for journeys such as:

### Journey 1

```text
⌘K
→ “show stalled deals”
→ review
→ create tasks
→ verify
```

### Journey 2

```text
CRM contact
→ Ask AI
→ knowledge result
→ graph
→ campaign
```

### Journey 3

```text
Idea Canvas
→ campaign
→ generate assets
→ approval
→ schedule
```

### Journey 4

```text
Meeting
→ AI summary
→ knowledge
→ actions
→ CRM update
```

### Journey 5

```text
Agent run
→ approval
→ resume
→ verify
```

---

# 86. Visual Regression

Every major responsive breakpoint:

```text
375
430
768
1024
1280
1440
1920
```

Run screenshot comparison for:

```text
Command Center
CRM
Knowledge Inbox
Graph
Idea Canvas
Campaign Graph
Agent Builder
Workflow Builder
Approval
Run Detail
```

---

# 87. Accessibility Testing

Automate:

```text
axe
keyboard journeys
focus order
screen reader smoke tests
contrast
target size
reduced motion
```

The difficult components—tree/graph/canvas/grid/dialog/combobox—must have explicit keyboard behavior rather than simply receiving an ARIA role. W3C's APG exists precisely because complex widgets need authored keyboard interaction as well as semantics. ([W3C][4])

---

# 88. Agent UX Testing

This is separate from normal UI testing.

Measure:

```text
time to intent
number of interactions
unnecessary navigation
corrections
approval clarity
trust
task completion
```

A good agentic UX should reduce:

```text
clicks
screen switching
manual retrieval
duplicate entry
context rebuilding
```

without reducing:

```text
control
visibility
recoverability
security
```

---

# 89. UX Metrics

The north-star metric should be:

## Outcome Efficiency

```text
Successful business outcome
--------------------------------
human effort + system effort
```

Track:

```text
Time to outcome
Clicks
Screens visited
AI interventions
Human corrections
Agent tool calls
Task success
Error rate
```

---

# 90. Agentic Maturity Metrics

Create a dashboard:

```text
Manual
   ↓
Assisted
   ↓
Proposed
   ↓
Approved
   ↓
Delegated
   ↓
Autonomous
```

For each workflow:

```text
% manual
% AI assisted
% automated
% agent autonomous
```

This is much more useful than measuring how many AI buttons exist.

---

# 91. The Final Information Architecture

At maturity, the overall application becomes:

```text
SMARTSAPP
│
├── WORK
│   ├── Inbox
│   ├── Contacts
│   ├── Deals
│   ├── Tasks
│   ├── Meetings
│   └── Calendar
│
├── AUTOMATION
│   ├── Automations
│   ├── Workflows
│   ├── Schedules
│   └── Runs
│
├── INTELLIGENCE
│   ├── Command Center
│   ├── Company Brain
│   ├── Knowledge Inbox
│   ├── Knowledge
│   ├── Knowledge Graph
│   ├── Ideas
│   ├── Agents
│   ├── Agent Runs
│   └── Approvals
│
├── STUDIOS
│   ├── Campaign Intelligence
│   ├── Landing Pages
│   ├── Media
│   ├── Surveys
│   ├── Forms
│   ├── Flipbooks
│   ├── Messaging
│   └── Call Centre
│
├── TRANSACT
│   ├── Finance
│   ├── Billing
│   ├── Payments
│   └── Documents
│
└── SYSTEM
    ├── Analytics
    ├── Integrations
    ├── MCP
    ├── Capabilities
    ├── AI Policies
    ├── Agent Registry
    ├── Evaluation
    └── Settings
```

But the **true architecture underneath is not hierarchical**.

It is a graph:

```text
                KNOWLEDGE
                /       \
               /         \
             CRM ←────→ CAMPAIGN
              ↑            ↓
              │          WORKFLOW
              │             ↓
           MEETINGS ←──── AGENTS
              ↑             ↓
              └──────→ EVENTS
                           ↓
                         MEMORY
```

That is why the product should feel increasingly interconnected as these phases ship.

---

# 92. The Most Important UX Principle

The final SmartSapp experience should not make the human choose between:

> “Use the normal UI”

and

> “Use AI.”

Those should converge.

For example:

### Human path

```text
Deals
→ filter
→ open deal
→ review activity
→ check notes
→ create task
```

### Agent path

```text
“Review this deal and prepare the next action.”
```

### Final result

Both arrive at the same canonical objects, workflows, events and state.

That means the AI is not building a parallel application.

It is **operating the same SmartSapp that the user operates**.

That is the key to reaching your stated end state.

---

# 93. Final Design Rule Set

I would make these non-negotiable product rules:

**1. No AI feature without a contextual reason to exist.**

**2. No autonomous action without a capability contract.**

**3. No capability without authorization.**

**4. No high-risk execution without the appropriate approval state.**

**5. No important AI result without provenance.**

**6. No destructive operation without recoverability where technically possible.**

**7. No agent run without an observable lifecycle.**

**8. No long-running agent without durable state.**

**9. No important memory without source and validity.**

**10. No new standalone AI silo when an existing platform surface can host it.**

**11. No desktop-only canvas pretending to be a mobile experience.**

**12. No accessibility retrofit after the UI is finished.**

**13. No editor without explicit dirty/saved/conflict states.**

**14. No major action that leaves the user at a dead end.**

**15. No agent release without evaluation against a regression dataset.**

---

# 94. The Finished Experience

When all 15 phases are complete, the SmartSapp home experience should effectively become:

```text
┌──────────────────────────────────────────────────────────────┐
│ SMARTSAPP                                                    │
│                                                              │
│ What do you want to accomplish?                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Ask, find, analyze, create or delegate...              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ TODAY                                                        │
│                                                              │
│ 3 actions need your attention                                │
│ 2 agent approvals                                            │
│ 4 important customer developments                            │
│ 1 campaign requiring review                                  │
│                                                              │
│ ──────────────────────────────────────────────────────────── │
│                                                              │
│ COMPANY INTELLIGENCE                                         │
│                                                              │
│ New knowledge        Active agents        At-risk items      │
│ 24                   7                    12                 │
│                                                              │
│ ──────────────────────────────────────────────────────────── │
│                                                              │
│ RECENT WORK                                                  │
│                                                              │
│ Greenfield School                                            │
│ Deal reviewed • Meeting prepared • Payment issue detected   │
│                                                              │
│ ──────────────────────────────────────────────────────────── │
│                                                              │
│                   [ Ask SmartSapp ]                          │
└──────────────────────────────────────────────────────────────┘
```

From there, the user can go anywhere.

But more importantly, **the agent can go anywhere within the authority it has been given**.

That is the UX endpoint of the roadmap:

> **Humans express intent. SmartSapp supplies context. Agents perform the work. The application remains observable, governable, reversible and understandable.**

That is the difference between adding AI to a CRM and building an **agentic CRM operating system**.

The MCP ecosystem's current direction—interactive MCP Apps, a stateless core, durable Tasks, stronger authorization and increasingly sophisticated agent-oriented infrastructure—makes this architecture materially more viable now than it was even a year ago. ([Model Context Protocol Blog][1])

[1]: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/?utm_source=chatgpt.com "MCP Apps - Bringing UI Capabilities To MCP Clients | Model Context Protocol Blog"
[2]: https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/?utm_source=chatgpt.com "Guidelines for human-AI interaction design - Microsoft Research"
[3]: https://www.w3.org/WAI/WCAG22/Understanding/?utm_source=chatgpt.com "Understanding WCAG 2.2 | WAI | W3C"
[4]: https://www.w3.org/WAI/ARIA/apg/practices/?utm_source=chatgpt.com "Practices | APG | WAI | W3C"
[5]: https://www.w3.org/WAI/ARIA/apg/patterns/?utm_source=chatgpt.com "Patterns | APG | WAI | W3C"
[6]: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/?utm_source=chatgpt.com "What's New in WCAG 2.2 | Web Accessibility Initiative (WAI) | W3C"
[7]: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx?utm_source=chatgpt.com "ext-apps/specification/2026-01-26/apps.mdx at main · modelcontextprotocol/ext-apps · GitHub"

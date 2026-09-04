# SmartCRM Campaign Intelligence Studio 2.0

## Complete UI/UX Architecture, Mobile UX System & Phase-by-Phase Build Specification

**Product:** SmartCRM
**Module:** Campaign Intelligence Studio 2.0
**Primary surfaces:** Desktop Web, Tablet, Mobile Web / PWA
**Design objective:** Make sophisticated campaign planning, simulation and execution feel simpler than conventional marketing automation software.

---

# 1. PRODUCT UX NORTH STAR

Campaign Intelligence Studio must make the user feel:

> “I can describe what I want to achieve, and SmartCRM will help me think through it, show me what I need, simulate whether it can work, and then build it.”

The experience must therefore move naturally through:

**Idea → Strategy → Journey → Assets → Simulation → Build → QA → Launch → Performance → Optimization**

The UI should never force users to understand the underlying technical architecture before they can begin.

The system should progressively reveal complexity.

---

# 2. CORE UX PRINCIPLES

## 2.1 Start with intent, not configuration

Do not open the experience with:

* blank canvas
* dozens of node types
* settings
* technical fields

Start with:

> **What are you trying to achieve?**

---

## 2.2 AI is a collaborator, not a chatbot bolted onto the interface

The AI must be aware of:

* current campaign
* current view
* current node
* current asset
* campaign objective
* audience
* offer
* prior decisions
* simulation
* live results

The AI should therefore behave as a contextual campaign copilot.

---

## 2.3 The campaign graph is visually central

The graph is the visual representation of the strategy.

It should never feel like a technical workflow designer.

Use business-language labels such as:

> “Facebook Traffic”

rather than:

> “SourceNode::PaidSocialMeta”

---

## 2.4 One action should have one obvious primary CTA

Examples:

**Create Campaign**

**Build Journey**

**Run Simulation**

**Build Campaign**

**Prepare Launch**

**Launch Campaign**

Do not compete with multiple equally prominent buttons.

---

## 2.5 Every complex screen needs a simplified path

Every major workspace must answer:

1. Where am I?
2. What am I trying to accomplish?
3. What is incomplete?
4. What should I do next?
5. Can AI do it for me?

---

# 3. DESIGN LANGUAGE

SmartCRM existing visual language should remain dominant.

Primary brand:

**#3A86FF**

Typography:

**Poppins / Figtree / Didact**, according to existing SmartCRM design-system usage.

Use:

* rounded cards
* subtle borders
* generous spacing
* restrained shadows
* strong hierarchy
* high information density only where operationally useful

Avoid:

* Figma-style complexity
* excessive floating controls
* dense technical sidebars
* tiny labels
* spreadsheet-like tables as the primary UX
* modal overload

---

# 4. RESPONSIVE DESIGN PHILOSOPHY

The product is not a desktop UI squeezed onto mobile.

It must have three intentional interaction modes.

## Desktop

**Compose + inspect + compare**

Best for:

* graph editing
* scenario comparison
* asset management
* simulation analysis
* large campaign planning

---

## Tablet

**Compose + inspect**

Best for:

* moderate graph editing
* approvals
* AI interaction
* campaign management

---

## Mobile

**Inspect + decide + approve + execute**

Best for:

* campaign overview
* AI conversations
* task management
* asset review
* approvals
* simulation snapshots
* performance
* quick edits
* launching / pausing

Mobile should not attempt to reproduce the full desktop graph editor.

---

# 5. RESPONSIVE BREAKPOINTS

Recommended design tokens:

```text
xs: 0–479px
sm: 480–767px
md: 768–1023px
lg: 1024–1279px
xl: 1280–1535px
2xl: 1536px+
```

## Mobile

Single-column layout.

## Tablet

Two-pane where useful.

## Desktop

Three-zone architecture:

```text
Primary Navigation
      +
Workspace
      +
Contextual AI / Inspector
```

---

# 6. APPLICATION SHELL

The overall SmartCRM application remains the outer shell.

Inside Campaign Intelligence Studio:

```text
┌─────────────────────────────────────────────────────┐
│ SmartCRM Header                                     │
├──────────────┬──────────────────────────────────────┤
│ Campaign Nav │ Campaign Workspace                   │
│              │                                      │
│ Overview     │                                      │
│ Strategy     │                                      │
│ Journey      │                                      │
│ Assets       │                                      │
│ Simulation   │                                      │
│ Automation   │                                      │
│ Execution    │                                      │
│ Performance  │                                      │
│ Experiments  │                                      │
│ AI           │                                      │
└──────────────┴──────────────────────────────────────┘
```

On mobile:

```text
┌───────────────────────┐
│ Header                │
├───────────────────────┤
│ Campaign context      │
├───────────────────────┤
│ Current workspace     │
│                       │
│                       │
├───────────────────────┤
│ Contextual actions    │
└───────────────────────┘

Bottom navigation:
Overview | Journey | Assets | AI | More
```

---

# 7. MOBILE NAVIGATION MODEL

Use a five-item bottom navigation:

**Overview**

**Journey**

**Assets**

**AI**

**More**

More contains:

* Strategy
* Simulation
* Automation
* Execution
* Performance
* Experiments
* Settings

Do not put nine or ten icons into the mobile bottom bar.

---

# 8. CAMPAIGN HOME

## Purpose

Campaign command center.

## Desktop layout

### Header

Left:

Campaign name

Campaign type

Status

Center:

Readiness score

Right:

**Share**

**More**

**Primary CTA**

Button changes according to lifecycle:

* Start Planning
* Continue Planning
* Run Simulation
* Build Campaign
* Prepare Launch
* Launch Campaign

---

# 9. CAMPAIGN HOME — CONTENT

Top summary row:

```text
Goal
500 qualified leads
```

```text
Forecast
412–560
```

```text
Budget
GHS 15,000
```

```text
Readiness
78%
```

Below:

### AI Campaign Summary

> “Your campaign architecture is strong, but the qualification survey is currently the largest conversion risk.”

CTA:

**Review Recommendation**

---

# 10. CAMPAIGN HOME — PRIMARY SECTIONS

Order:

1. Objective
2. Forecast
3. Readiness
4. Journey snapshot
5. Asset progress
6. AI recommendations
7. Recent activity
8. Tasks
9. Performance if live

This ordering should remain consistent.

---

# 11. MOBILE CAMPAIGN HOME

Use stacked cards.

First card:

### Campaign Goal

**Generate 500 qualified leads**

Progress indicator.

Second:

### Forecast

**412–560**

Tap:

**View Simulation**

Third:

### Readiness

**78%**

Tap:

**See What’s Blocking Launch**

Fourth:

### Next Best Action

> Complete survey logic.

Button:

**Fix Now**

The user should understand the campaign state within five seconds.

---

# 12. CAMPAIGN CREATION

## Entry state

Screen title:

# Create Campaign

Subheading:

> Tell SmartCRM what you want to achieve.

Large AI input:

> “I want to generate 500 qualified leads for our Enrollment Growth offer…”

Below:

Suggested starters:

**Generate Leads**

**Launch Product**

**Run Survey**

**Promote Event**

**Increase Sales**

**Re-engage Customers**

---

# 13. CREATE CAMPAIGN — DESKTOP

Use a centered conversational workspace.

Left:

Campaign conversation.

Right:

Live structured summary.

Example:

```text
OBJECTIVE
Generate qualified leads

AUDIENCE
School owners

OFFER
Enrollment Growth Assessment

CHANNELS
Facebook
Email
WhatsApp
```

The structured summary updates as the conversation progresses.

---

# 14. CREATE CAMPAIGN — MOBILE

Do not show two permanent columns.

Use:

```text
AI conversation

↓
Campaign summary card
```

The summary can open as a bottom sheet.

Buttons:

**Review Plan**

**Continue with AI**

---

# 15. AI PLANNING EXPERIENCE

The AI should ask only questions that materially improve the strategy.

Example:

> What is the primary outcome you want from this campaign?

User answers.

Then:

> Who should enter the campaign?

Then:

> What happens after someone becomes qualified?

The AI should avoid interrogating users with twenty questions at once.

---

# 16. AI QUESTION PRIORITIZATION

Questions should be categorized:

### Required

Campaign cannot be intelligently modeled without the answer.

### Recommended

Improves quality but can be inferred.

### Optional

Can be completed later.

The UI should visually distinguish these.

---

# 17. AI GENERATED STRATEGY

After sufficient information:

Display:

# Proposed Campaign Strategy

Sections:

**Objective**

**Audience**

**Problem**

**Offer**

**Promise**

**CTA**

**Channels**

**Customer Journey**

**KPIs**

**Required Assets**

---

# 18. STRATEGY APPROVAL

Bottom action bar:

**Edit**

**Ask AI to Improve**

**Approve Strategy**

If the user approves:

```text
Strategy Approved ✓
```

Then automatically offer:

> “Next: build your campaign journey.”

CTA:

**Build Journey**

---

# 19. STRATEGY STUDIO

Navigation:

```text
Strategy
├── Objective
├── Audience
├── Offer
├── Positioning
├── Messaging
├── Channels
├── KPIs
├── Budget
└── Timeline
```

Desktop uses left sub-navigation.

Mobile uses a horizontal section selector or accordion.

---

# 20. STRATEGY CARD DESIGN

Every strategic section uses a card.

Example:

### Primary Audience

**School Proprietors**

Description.

Data source:

**AI hypothesis**

Button:

**Refine**

AI icon:

**Ask AI**

Avoid opening a full-screen editor for simple attributes.

---

# 21. CAMPAIGN MESSAGE ARCHITECTURE

A dedicated section:

### Message Core

**Primary Problem**

**Primary Promise**

**Proof**

**Differentiator**

**CTA**

Then:

### Messaging Variants

Variant A

Variant B

Variant C

The system should be able to propagate approved messaging into downstream assets.

---

# 22. JOURNEY CANVAS

This is the signature interface.

Desktop:

```text
┌─────────────────────────────────────────────────────────┐
│ Journey toolbar                                         │
├──────────────┬─────────────────────────┬────────────────┤
│ Node Library │       Graph Canvas       │ Inspector      │
│              │                         │                │
│ Traffic      │ Facebook → Landing      │ Node details   │
│ Experience   │            ↓            │                 │
│ Engagement   │          Form           │ AI actions     │
│ CRM          │            ↓            │                 │
│ Automation   │         Survey          │                 │
└──────────────┴─────────────────────────┴────────────────┘
```

---

# 23. JOURNEY CANVAS TOOLBAR

Top toolbar:

Left:

**Back**

Campaign name

Center:

**Undo**

**Redo**

**Zoom −**

**Zoom +**

**Fit**

Right:

**Validate**

**Simulate**

**Build**

**AI**

Do not overload toolbar with rarely used options.

Advanced controls go into More.

---

# 24. NODE LIBRARY

Categories:

### Traffic

### Experience

### Engagement

### Qualification

### CRM

### Automation

### Conversion

### Outcome

Each category expands.

Mobile:

The node library opens as a bottom sheet.

---

# 25. NODE CARD DESIGN

Each node has four layers.

### Header

Icon + node name.

### Purpose

Small description.

### Performance / Forecast

Example:

**28% expected CVR**

### Status

**Built**

or

**Needs Setup**

Footer action:

**Open**

---

# 26. NODE STATES

Every node supports:

* planned
* configured
* connected
* simulated
* built
* live
* warning
* error

Use icons + text.

Never rely on color alone.

---

# 27. NODE SELECTION

Selecting a node opens the inspector.

Desktop:

Right side panel.

Tablet:

Overlay panel.

Mobile:

Bottom sheet / full-screen detail page.

---

# 28. NODE INSPECTOR

Example:

## Landing Page

### Purpose

Capture qualified leads.

### Audience

School Owners.

### Expected conversion

28%.

### Asset

Enrollment Growth Landing Page.

### Form

Assessment Form.

### Tracking

Facebook / Campaign / UTM.

### Dependencies

Form required.

### AI

**Improve Conversion**

**Generate Copy**

**Simulate Change**

**Build Page**

---

# 29. NODE CREATION FLOW

When user taps:

**+ Add Node**

show a searchable picker.

Recommended categories.

Search:

> “survey”

Results:

**Survey**

**Qualification Survey**

**Feedback Survey**

User selects.

The new node appears with a contextual setup checklist.

---

# 30. SMART NODE SUGGESTIONS

After adding one node, AI should suggest the next logical node.

Example:

User adds:

**Landing Page**

AI suggests:

> Recommended next step:
>
> Add a Lead Form.

CTA:

**Add Form**

Secondary:

**Choose Another Step**

This dramatically simplifies graph creation.

---

# 31. GRAPH AUTO-LAYOUT

The graph engine should offer:

**Auto Arrange**

Default layout:

Left → Right for acquisition funnels.

Top → Bottom for workflow sequences.

Branches expand vertically.

The user can manually reposition nodes.

---

# 32. CONNECTION UX

When selecting a node, show connection handles subtly.

Do not permanently display dozens of handles.

Tap:

**Connect**

Then choose destination.

For mobile:

Node menu:

**Connect to…**

opens destination picker.

Avoid requiring drag-and-drop precision on small screens.

---

# 33. GRAPH BRANCH UX

A branch should appear as:

```text
         Survey
            ↓
        Qualification
        /           \
   Qualified      Not Qualified
      ↓               ↓
   Sales            Nurture
```

Display the condition on the branch itself:

**Score ≥ 70**

---

# 34. GRAPH VALIDATION

Button:

**Validate Journey**

Output:

### 3 issues found

1. Landing page has no form.
2. Email 2 trigger is undefined.
3. Qualified branch has no destination.

Each issue:

**Fix**

**View**

**Ask AI**

---

# 35. ASSET STUDIO

Asset Studio should answer:

> “What do I need to build this campaign?”

Top summary:

**17 assets required**

**11 ready**

**4 in progress**

**2 missing**

---

# 36. ASSET GROUPS

Group by:

### Pages

### Forms

### Surveys

### Messaging

### Social / Ads

### Automations

### CRM

### Tracking

---

# 37. ASSET LIST

Each item:

```text
Landing Page
Lead capture
Ready
AI copy ✓
Built ✓
Connected ✓

[Open]
```

Actions:

**Open**

**Generate**

**Build**

**Replace**

---

# 38. ASSET FILTERS

Filters:

* all
* missing
* needs review
* generated
* built
* blocked
* live

Mobile:

Horizontal chip scroller.

Desktop:

Inline segmented control.

---

# 39. ASSET DETAIL

Example:

# Enrollment Landing Page

### Purpose

Lead capture.

### Campaign position

Traffic → Landing Page → Form.

### Content

Headline.

Subheadline.

Benefits.

CTA.

### Build status

Draft.

### Dependencies

Assessment Form.

### AI Actions

**Improve**

**Create Variant**

**Build Page**

---

# 40. CONTENT GENERATION UX

Click:

**Generate with AI**

Show a compact configuration:

### Goal

Lead conversion.

### Audience

School owners.

### Tone

Professional.

### Desired length

Standard.

### Message

Campaign core message automatically loaded.

Button:

**Generate**

---

# 41. AI CONTENT RESULTS

Never immediately replace existing content.

Show:

### Current

vs

### Proposed

Then:

**Use Proposed**

**Regenerate**

**Edit**

**Create Variant**

---

# 42. SURVEY PLANNING UX

The survey node should display:

### Objective

### Questions required

### Logic

### Scoring

### Completion

AI recommendation:

> “Five questions instead of nine should reduce expected abandonment.”

Button:

**Apply Recommendation**

---

# 43. EMAIL SEQUENCE UX

Represent sequence visually:

```text
Email 1
↓
Wait 2 days
↓
Email 2
↓
Wait 3 days
↓
Email 3
```

Each message card shows:

* purpose
* subject
* CTA
* delay
* trigger

Mobile should use an accordion.

---

# 44. AUTOMATION UX

Automation should be understandable to nontechnical users.

Use:

```text
WHEN
Survey completed

IF
Score >= 70

THEN
Create qualified lead
Assign sales owner
Send notification
```

Avoid exposing implementation syntax.

---

# 45. SIMULATION LAB

Simulation is a major product surface.

Top header:

# Campaign Simulation

Scenario selector:

**Expected**

Dropdown.

Actions:

**New Scenario**

**Compare**

**Run Simulation**

---

# 46. SIMULATION KPI CARDS

Show six primary metrics:

### Visitors

### Leads

### Qualified

### Meetings

### Customers

### Revenue

Second row:

### CAC

### CPL

### ROI

### ROAS

On mobile:

Use a horizontal metric carousel with a pinned primary metric.

---

# 47. SIMULATION FUNNEL VIEW

Display graph using forecast numbers.

Example:

```text
10,000 impressions

↓

2,400 visits
24% transition

↓

672 leads
28%

↓

336 qualified
50%

↓

84 meetings
25%

↓

17 customers
20%
```

Each transition shows:

* rate
* volume
* confidence

---

# 48. WHAT-IF CONTROLS

A dedicated panel:

### Traffic

slider.

### Landing conversion

slider.

### Qualification

slider.

### Close rate

slider.

### Budget

slider.

As a value changes, key outputs update.

Desktop:

Right simulation controls.

Mobile:

Bottom-sheet “Adjust Assumptions.”

---

# 49. SCENARIO MANAGEMENT

Scenario cards:

### Conservative

Low assumptions.

### Expected

Recommended.

### Optimistic

High assumptions.

### Custom

User-created.

Each shows:

* leads
* customers
* revenue
* CAC
* ROI

---

# 50. SCENARIO COMPARISON

Desktop:

side-by-side table.

Mobile:

stacked comparison cards.

Mobile layout:

```text
EXPECTED
Leads 700
Customers 14
CAC GHS X
ROI X%

OPTIMISTIC
Leads 1050
Customers 27
CAC GHS X
ROI X%
```

---

# 51. SIMULATION AI PANEL

Permanent AI summary:

> **What the simulation says**
>
> Your target is achievable under the expected scenario.
>
> The largest sensitivity is landing-page conversion.
>
> Increasing conversion by 4 percentage points is projected to add 102 leads.

Actions:

**Optimize**

**Simulate Recommendation**

**Apply**

---

# 52. SENSITIVITY VIEW

Display ranked impact.

Example:

```text
Landing Page CVR
████████████████

Qualification
███████████

Close Rate
████████

CPC
██████
```

Use accessible intensity and labels.

---

# 53. GOAL FEASIBILITY UI

At top of simulation:

### Goal Feasibility

**Likely achievable**

Supporting copy:

> 78% modeled probability under current assumptions.

Or:

> **At risk**

> Your current funnel requires a 7.8% visitor-to-customer conversion rate, materially above historical performance.

CTA:

**Improve Plan**

---

# 54. EXPERIENCE SIMULATION

Button:

# Walk the Journey

Opens a safe simulated customer experience.

Example:

**Ad**

↓

**Landing Page**

↓

**Form**

↓

**Survey**

↓

**Thank You**

↓

**Email**

At each step show:

**Simulated**

Never imply that the simulation has triggered a real action.

---

# 55. MOBILE JOURNEY SIMULATION

Use a phone-shaped viewport occupying most of the screen.

Top:

**Simulation Mode**

Badge:

**No live actions**

Bottom:

**Previous**

**Next**

**Exit Simulation**

This can later become a very compelling demo feature.

---

# 56. CAMPAIGN COMPILER UX

Main action:

# Build Campaign

Before starting:

### 17 assets found

### 14 can be built automatically

### 2 require review

### 1 dependency missing

Buttons:

**Fix Dependency**

**Build 14 Assets**

---

# 57. BUILD PROGRESS

Show grouped progress:

```text
Pages            ✓
Forms            ✓
Surveys          2/3
Emails           4/4
Automation       1/2
Tracking         3/3
```

Each line is expandable.

---

# 58. BUILD FAILURE UX

Never show technical error as the only message.

Example:

> Automation could not be created because the target sales owner rule is incomplete.

Actions:

**Fix Rule**

**Ask AI**

**Retry**

Technical details may be expandable under:

**Developer details**

---

# 59. PLAN / LIVE DRIFT

If a live asset changes after compilation:

Display:

> **Plan / Live Difference Detected**

Example:

Planned CTA:

> Get My Assessment

Live CTA:

> Book a Demo

Actions:

**Update Plan**

**Restore Plan**

**Keep Live Version**

---

# 60. EXECUTION CENTER

The execution screen is a launch control room.

Sections:

### Readiness

### Build

### Tracking

### Automation

### Approvals

### Launch

---

# 61. READINESS CHECK

Example:

```text
Campaign Readiness 92%

✓ Strategy
✓ Audience
✓ Journey
✓ Assets
✓ Automation
✓ Tracking
⚠ Approval pending
```

Primary action:

**Request Approval**

---

# 62. APPROVAL UX

Approvers receive:

### Campaign Summary

### Forecast

### Budget

### Assets

### Risks

### Changes

Buttons:

**Approve**

**Request Changes**

**Reject**

Approval must include optional comment.

---

# 63. LAUNCH CONFIRMATION

Never make launch a single accidental click.

Confirmation screen:

# Launch Campaign?

Show:

* start date
* end date
* budget
* active assets
* channels
* primary goal
* expected outcomes

Confirmation checkbox:

> I understand this will activate the connected campaign assets.

Button:

**Launch Campaign**

---

# 64. POST-LAUNCH EXPERIENCE

The campaign home automatically transitions into:

# Live Campaign Mode

Primary metrics become:

**Actual**

with **Forecast** displayed beneath.

Example:

```text
Leads
487 actual
520 forecast
-6.3%
```

---

# 65. LIVE CAMPAIGN GRAPH

The same graph now displays runtime data.

Each node:

```text
Landing Page

Actual:
31%

Forecast:
28%

Variance:
+10.7%
```

The graph should visually preserve user familiarity.

---

# 66. PERFORMANCE CENTER

Sections:

### Overview

### Funnel

### Sources

### Assets

### Audience

### Revenue

### Forecast

### AI Insights

---

# 67. PERFORMANCE OVERVIEW

Cards:

* traffic
* leads
* qualified
* meetings
* deals
* revenue
* CAC
* ROI

Charts:

* performance over time
* forecast vs actual
* conversion trend

---

# 68. AI PERFORMANCE SUMMARY

Example:

> “The campaign is outperforming forecast by 8.4%. Email is the strongest source, while paid social is 14% below expected qualification rate.”

Actions:

**Investigate**

**Optimize**

**Create Experiment**

---

# 69. EXPERIMENT STUDIO

Button:

**Create Experiment**

AI asks:

> What do you want to improve?

Suggested:

**Increase leads**

**Improve qualification**

**Reduce CAC**

**Increase bookings**

AI then recommends tests.

---

# 70. EXPERIMENT CARD

Example:

### Shorter Qualification Form

**Hypothesis**

Reducing fields from 8 to 5 will increase completion.

**Expected impact**

+9–15%.

**Effort**

Low.

**Risk**

Low.

CTA:

**Simulate**

---

# 71. AI RECOMMENDATION UX

Each recommendation must include:

### Problem

### Evidence

### Recommendation

### Estimated impact

### Confidence

### Affected assets

### Simulation result

Actions:

**Apply**

**Simulate**

**Dismiss**

---

# 72. AI ACTION PREVIEW

Before changing multiple assets:

Show:

# Proposed Campaign Change

1. Change landing-page CTA.
2. Shorten survey.
3. Update email CTA.
4. Modify follow-up automation.

Then:

### Projected effect

+14% qualified leads.

User approves once.

---

# 73. CAMPAIGN AI FULL-SCREEN MODE

AI workspace should be available as a dedicated screen.

Structure:

```text
Conversation
──────────────
Campaign Context
──────────────
Suggested Actions
──────────────
Recent Recommendations
```

The AI must surface actionable outputs rather than generating long generic essays.

---

# 74. MOBILE AI

Mobile should treat AI as a primary workflow.

Bottom:

**Ask Campaign AI**

The input supports:

* text
* voice later
* attachments later
* quick commands

Suggestions:

**Review campaign**

**Find bottleneck**

**Generate email sequence**

**Improve landing page**

**Simulate 500 leads**

---

# 75. MOBILE AI ACTION CARDS

When AI recommends a change:

```text
Improve survey completion

Potential impact
+11%

Affected
Survey
Automation

[Simulate]
[Apply]
```

Do not force users to read a long response.

---

# 76. TASK MANAGEMENT

Tasks are secondary to campaign assets.

Show:

### My Tasks

### Blocked

### Due Soon

### Completed

Tasks link directly to the related asset/node.

Example:

> Finish survey logic

Tap → open survey node.

---

# 77. CAMPAIGN TIMELINE

Timeline should display:

```text
Strategy
●────────
Journey
   ●────────
Assets
      ●────────
QA
             ●──
Launch
                  ●
```

On mobile, use vertical timeline.

---

# 78. CAMPAIGN STATUS SYSTEM

Primary campaign statuses:

**Idea**

**Planning**

**Designed**

**Simulating**

**Building**

**Ready**

**Live**

**Optimizing**

**Completed**

**Archived**

Display status prominently but subtly.

---

# 79. EMPTY STATE SYSTEM

Every module must have educational empty states.

Example:

### No simulations

> Model your campaign before you spend.

Button:

**Create Simulation**

Secondary:

**Ask AI**

---

# 80. ERROR STATE SYSTEM

Every error must follow:

**What happened**

**Why**

**What can I do**

Example:

> Your survey cannot be simulated because Question 4 has an undefined branch.

**Fix Survey**

---

# 81. LOADING STATES

Use meaningful progression.

Instead of:

> Loading…

Use:

> Reading campaign strategy…

> Mapping customer journey…

> Identifying required assets…

> Calculating forecast…

This makes AI-heavy work feel intentional.

---

# 82. SUCCESS STATES

After significant actions:

### Strategy approved

> Campaign strategy is approved.

Next best action:

**Build Journey**

### Simulation completed

> Simulation complete.

Next:

**Review Bottlenecks**

### Campaign built

> 16 assets created successfully.

Next:

**Run QA**

---

# 83. NOTIFICATION SYSTEM

Notifications should prioritize actionable events.

Examples:

> Campaign is ready for approval.

> Landing page build failed.

> Simulation predicts goal is at risk.

> Campaign is outperforming forecast.

> AI found a high-impact optimization.

Push/email/mobile notification settings should be configurable later.

---

# 84. MOBILE APPROVAL FLOW

Approver opens notification.

Screen:

# Enrollment Growth Campaign

Readiness:

92%

Forecast:

500–630 leads

Risks:

2

Then:

**Approve**

or

**Request Changes**

The approval must be possible without opening desktop.

---

# 85. MOBILE PERFORMANCE FLOW

Open campaign.

Top:

**Campaign Live**

Primary KPI:

**487 qualified leads**

Forecast:

**520**

Then:

**AI Summary**

> Paid social underperforming.

Then:

**Top Opportunity**

> Email can potentially generate 38 more qualified leads.

Button:

**Review**

---

# 86. MOBILE SIMULATION FLOW

User opens:

**Simulation**

Shows primary forecast.

Button:

**Adjust Assumptions**

Bottom sheet allows:

* traffic
* conversion
* budget
* close rate

After changes:

**Recalculate**

Then show:

**New Expected Outcome**

---

# 87. RESPONSIVE TABLE STRATEGY

Do not horizontally scroll every table on mobile.

Use:

* cards
* stacked rows
* collapsible details
* comparison cards

Reserve horizontal scrolling for data that genuinely needs tabular comparison.

---

# 88. ACCESSIBILITY

Minimum target:

**WCAG 2.2 AA**

Requirements:

* keyboard navigation
* visible focus
* screen-reader labels
* non-color status indicators
* minimum tap size ~44px
* sufficient contrast
* reduced-motion support
* accessible graph descriptions

The graph needs an accessible alternative representation:

> “Landing Page connects to Form, which connects to Survey.”

---

# 89. TOUCH INTERACTION

Mobile:

* minimum 44×44px touch targets
* avoid drag-only interactions
* long-press for advanced actions
* swipe to dismiss sheets
* bottom sheets for contextual editing

Never require precision dragging to perform essential work.

---

# 90. GESTURE STRATEGY

Supported:

### Swipe

Cards.

### Pull to refresh

Performance.

### Pinch zoom

Journey canvas, where device supports it.

### Long press

Node actions.

But all gesture actions must have visible alternatives.

---

# 91. MOBILE GRAPH STRATEGY

Mobile is primarily:

**Browse**

**Inspect**

**Edit node**

**Connect**

**Reorder**

not:

**Construct huge graph manually.**

For complex graph creation, provide:

> **Build with AI**

This is a major usability advantage.

---

# 92. AI GRAPH BUILDER ON MOBILE

User says:

> “Add a survey after the form and send qualified respondents to sales.”

AI modifies the graph.

UI displays:

### Proposed change

Form → Survey → Qualification → Sales

Button:

**Apply**

This is preferable to forcing manual node manipulation.

---

# 93. COMMAND PALETTE

Desktop shortcut:

**Cmd/Ctrl + K**

Commands:

* Add node
* Generate asset
* Simulate
* Ask AI
* Validate
* Build campaign
* Find bottleneck
* Open page
* Open survey
* Open automation

Mobile equivalent:

Search/action button.

---

# 94. GLOBAL “NEXT BEST ACTION”

Every campaign workspace should expose one contextual recommendation.

Examples:

> Define your audience.

> Add a qualification step.

> Run simulation.

> Fix two blocked assets.

> Request approval.

This prevents users from getting lost.

---

# 95. ONBOARDING FLOW

New user:

### Step 1

What do you want to accomplish?

### Step 2

AI generates draft strategy.

### Step 3

Review journey.

### Step 4

See required assets.

### Step 5

Run first simulation.

### Step 6

Generate first asset.

The product teaches itself by doing.

---

# 96. FIRST-TIME GRAPH EDUCATION

Show a brief contextual tooltip:

> “This canvas represents the journey your customers will take. SmartCRM uses it to simulate outcomes and build your campaign.”

Then disappear permanently after interaction.

Avoid tutorial overload.

---

# 97. DESIGN SYSTEM COMPONENTS

Create reusable components:

### CampaignHeader

### CampaignStatus

### KPIHeroCard

### ReadinessCard

### AICopilot

### AIActionCard

### CampaignSection

### JourneyCanvas

### JourneyNode

### NodeInspector

### NodePicker

### EdgeCondition

### AssetCard

### AssetList

### AssetStatusBadge

### SimulationMetric

### ScenarioCard

### SimulationControls

### ForecastComparison

### SensitivityChart

### RecommendationCard

### ApprovalPanel

### BuildProgress

### LaunchGate

### PerformanceCard

### ExperimentCard

### MobileBottomSheet

### MobileActionBar

---

# 98. DESIGN TOKENS

Maintain centralized tokens for:

* typography
* spacing
* radius
* elevation
* colors
* status
* animation
* breakpoints
* component dimensions

Do not hard-code styles per screen.

---

# 99. STATUS TOKENS

Use semantic status mapping.

```text
planned
configured
ready
blocked
warning
error
approved
live
paused
completed
```

Each needs:

* icon
* label
* visual treatment
* accessible text

---

# 100. MOTION

Use motion to clarify state transitions, not decorate.

Examples:

* node added
* simulation updated
* build completed
* recommendation applied
* campaign launched

Avoid excessive graph animation.

---

# 101. AI GENERATION ANIMATION

When generating content:

1. Thinking / analyzing
2. Drafting
3. Reviewing
4. Ready

Do not pretend to expose hidden reasoning.

The interface should only communicate operational progress.

---

# 102. SCREEN INVENTORY

The full implementation should contain approximately:

### Campaign

1. Campaign List
2. Campaign Create
3. Campaign Home
4. Campaign Settings

### Strategy

5. Strategy Overview
6. Audience
7. Offer
8. Messaging
9. KPIs
10. Budget
11. Timeline

### Journey

12. Journey Canvas
13. Node Inspector
14. Node Picker
15. Branch Editor
16. Journey Validation

### Assets

17. Asset Overview
18. Asset Detail
19. AI Generation
20. Asset Dependencies
21. Asset Build

### Simulation

22. Simulation Home
23. Scenario Editor
24. Scenario Comparison
25. What-if Controls
26. Sensitivity
27. Experience Simulation

### Automation

28. Automation Overview
29. Automation Builder
30. Trigger Editor
31. Condition Editor

### Execution

32. Launch Readiness
33. Approval
34. Build Center
35. Launch Confirmation

### Performance

36. Live Overview
37. Funnel Performance
38. Source Performance
39. Asset Performance
40. Forecast vs Actual
41. AI Insights

### Optimization

42. Recommendations
43. Experiment Studio
44. Experiment Detail

### AI

45. Campaign AI
46. AI Recommendation Detail

---

# 103. PHASE-BY-PHASE UI IMPLEMENTATION MAP

The UI must be implemented in the same order as the platform architecture.

---

# PHASE 0 — FOUNDATION

## PRD domains

* Campaign
* Campaign Brief
* Campaign Goal
* Campaign KPI
* Campaign Graph
* Asset Registry
* Event model
* RBAC
* Audit

## UI

Build:

* application shell
* Campaign navigation
* Campaign List
* Campaign Home skeleton
* Campaign Header
* status system
* permission-aware actions
* activity timeline

## Do not build yet

* advanced simulation
* full graph editor
* AI optimization

## Acceptance criteria

A user can:

* create campaign
* name it
* assign owner
* set objective
* view status
* access campaign workspace

---

# PHASE 1 — AI CAMPAIGN PLANNER

## PRD mapping

Strategy Engine.

## UI

Build:

* Campaign Create
* AI planning conversation
* Campaign Brief
* Strategy Studio
* AI summary
* strategy approval

## AI UI requirements

AI can:

* ask questions
* suggest audience
* suggest offer
* propose journey
* define KPIs
* identify assets

## Acceptance criteria

Natural language campaign description produces:

* strategy
* audience
* offer
* message
* channels
* KPIs
* preliminary asset list

---

# PHASE 2 — CAMPAIGN GRAPH

## PRD mapping

Campaign Graph.

## UI

Build:

* Journey Canvas
* node library
* node picker
* node inspector
* edge creation
* branches
* graph validation
* auto-layout

## Mobile

Build:

* graph viewer
* node inspector
* add node bottom sheet
* connect-to flow
* AI graph editing

## Acceptance criteria

User can create:

```text
Traffic
→ Page
→ Form
→ Survey
→ Qualification
→ Sales
```

without technical knowledge.

---

# PHASE 3 — SIMULATION LAB

## PRD mapping

Simulation Engine.

## UI

Build:

* Simulation Home
* scenario editor
* KPI forecast cards
* funnel forecast
* what-if controls
* scenario comparison
* sensitivity
* feasibility score

## Mobile

Build:

* forecast card
* scenario carousel
* assumption bottom sheet
* simulation results

## Acceptance criteria

User can create:

* conservative
* expected
* optimistic

scenarios and compare their outcomes.

---

# PHASE 4 — AI ASSET STUDIO

## PRD mapping

AI architecture + content model.

## UI

Build:

* Asset Studio
* Asset Registry
* AI generation
* content versioning
* copy comparison
* campaign messaging library
* cross-asset consistency

## Assets initially

* landing page
* form
* survey
* email
* email sequence
* SMS
* automation copy

## Acceptance criteria

User can generate campaign content from one campaign context.

---

# PHASE 5 — ASSET COMPILER

## PRD mapping

Asset Compiler.

## UI

Build:

* Build Campaign
* Build Preview
* Build Progress
* Failure states
* dependencies
* retry
* rollback
* Plan/Live Drift

## Integrations

* Page Builder
* Forms
* Surveys
* Messaging
* Automation

## Acceptance criteria

User can click:

**Build Campaign**

and receive actual SmartCRM draft objects.

---

# PHASE 6 — AUTOMATION + CRM

## PRD mapping

CRM Integration + Automation Compiler.

## UI

Build:

* automation visualization
* trigger editor
* conditions
* routing
* CRM actions
* lead assignment
* task generation
* deal creation

## Acceptance criteria

Graph transitions can produce actual CRM workflow definitions.

---

# PHASE 7 — QA + LAUNCH

## PRD mapping

Launch Gate.

## UI

Build:

* readiness score
* QA panel
* launch blockers
* approval workflow
* approval screen
* launch confirmation
* execution center

## Acceptance criteria

A campaign cannot launch with unresolved critical dependencies.

---

# PHASE 8 — LIVE CAMPAIGN TWIN

## PRD mapping

Execution + analytics.

## UI

Build:

* Live Campaign Home
* live graph
* forecast vs actual
* performance center
* source analytics
* asset analytics

## Acceptance criteria

Every major campaign node can show:

**Forecast**

**Actual**

**Variance**

---

# PHASE 9 — AI OPTIMIZATION

## PRD mapping

Optimization Engine.

## UI

Build:

* AI recommendation center
* recommendation cards
* impact preview
* optimization simulation
* experiment creation
* experiment results

## Acceptance criteria

AI can:

1. identify bottleneck
2. propose change
3. simulate change
4. display expected impact
5. request approval
6. apply change

---

# PHASE 10 — PREDICTIVE INTELLIGENCE

## PRD mapping

Probabilistic simulation.

## UI

Build:

* probability of goal
* confidence ranges
* Monte Carlo results
* historical comparison
* benchmark explanations

## UX example

> 82% probability of reaching 500 qualified leads.

Show:

**Most likely range**

**Best case**

**Worst case**

---

# PHASE 11 — LEARNING NETWORK

## PRD mapping

Campaign Learning.

## UI

Build:

* Campaign Learnings
* historical comparisons
* reusable winning assets
* organizational benchmark
* AI assumptions
* “Build Similar Campaign”

## Acceptance criteria

Past campaigns improve future planning recommendations.

---

# 104. PHASE DEPENDENCY MATRIX

```text
Foundation
   ↓
AI Planning
   ↓
Campaign Graph
   ↓
Simulation
   ↓
Asset Studio
   ↓
Asset Compiler
   ↓
Automation/CRM
   ↓
QA/Launch
   ↓
Live Twin
   ↓
Optimization
   ↓
Predictive Intelligence
   ↓
Learning Network
```

Do not reverse this dependency order.

---

# 105. BUILD RULE FOR AI CODING AGENTS

The implementation agent must follow this rule:

> **Do not create a new campaign-specific implementation of an existing SmartCRM capability when an existing platform module can be invoked.**

Examples:

Do not build another:

* page builder
* form builder
* survey builder
* email engine
* automation engine
* CRM contact system

Campaign Intelligence Studio should orchestrate these.

---

# 106. SHARED CONTRACT RULE

Every integrated builder must expose a standard interface:

```text
createDraft()
updateDraft()
validate()
publish()
getStatus()
```

Campaign Studio interacts through this abstraction.

---

# 107. FRONTEND ARCHITECTURE

Recommended component hierarchy:

```text
CampaignStudio
 ├── CampaignShell
 │   ├── CampaignHeader
 │   ├── CampaignNav
 │   └── CampaignActions
 │
 ├── CampaignOverview
 │
 ├── StrategyStudio
 │
 ├── JourneyStudio
 │   ├── JourneyCanvas
 │   ├── NodeLibrary
 │   └── NodeInspector
 │
 ├── AssetStudio
 │
 ├── SimulationStudio
 │
 ├── AutomationStudio
 │
 ├── ExecutionCenter
 │
 ├── PerformanceCenter
 │
 └── CampaignAI
```

---

# 108. FRONTEND STATE MODEL

Use clear separation between:

### Server state

Campaign data.

### UI state

Selected node, opened panel, current tab.

### Editor state

Unsaved graph changes.

### AI state

Conversation and generation state.

### Simulation state

Current scenario and assumptions.

Do not mix these into one giant campaign state object.

---

# 109. URL STATE

Important workspace state should be deep-linkable.

Examples:

```text
/campaigns/:id
/campaigns/:id/strategy
/campaigns/:id/journey
/campaigns/:id/assets
/campaigns/:id/simulation
/campaigns/:id/execution
/campaigns/:id/performance
```

Node selection may use:

```text
?node=node_123
```

Asset selection:

```text
?asset=asset_123
```

This enables collaboration and browser navigation.

---

# 110. AUTOSAVE

Campaign graph editing should autosave.

Display:

**Saved**

**Saving…**

**Unsaved changes**

Never silently lose graph changes.

---

# 111. DESKTOP SHORTCUTS

Support:

**Cmd/Ctrl + K** — command palette

**Cmd/Ctrl + S** — save

**Cmd/Ctrl + Z** — undo

**Cmd/Ctrl + Shift + Z** — redo

**Space** — temporary canvas pan

---

# 112. MOBILE SAVE BEHAVIOR

Autosave by default.

When offline:

> Saved locally. Will sync when connection returns.

For risky structural changes, show:

> Saved.

---

# 113. MOBILE MODAL RULE

Avoid conventional centered modals for complex forms.

Use:

* bottom sheets
* full-screen sheets
* dedicated pages

Use centered dialogs only for:

* confirmation
* destructive action
* simple choice

---

# 114. UX WRITING RULES

Use action-oriented language.

Instead of:

> “Simulation configuration”

say:

> **Adjust assumptions**

Instead of:

> “Asset compilation”

say:

> **Build campaign**

Instead of:

> “Execution initialization”

say:

> **Prepare launch**

Instead of:

> “Node configuration”

say:

> **Set up this step**

---

# 115. AI LANGUAGE RULES

The AI should be:

* confident but transparent
* concise
* evidence-driven
* actionable
* explicit about assumptions

Avoid:

> “This will definitely increase conversion.”

Prefer:

> “Simulation projects a 10–14% improvement, based on your current assumptions.”

---

# 116. MOBILE CONTENT PRIORITY

When space is limited, preserve this order:

1. Goal
2. Current state
3. Next action
4. Primary metric
5. Critical warnings
6. AI recommendation
7. Supporting detail

Never sacrifice the next action to show metadata.

---

# 117. DESKTOP CONTENT PRIORITY

Desktop may show more information simultaneously:

* strategic context
* journey
* KPI
* asset status
* AI

But still preserve visual hierarchy.

Do not place every metric on screen simultaneously.

---

# 118. PROGRESSIVE DISCLOSURE

Basic user sees:

**Expected conversion: 28%**

Advanced user can open:

> Source
> Historical campaigns

> Confidence
> Medium

> Distribution
> Custom

This allows sophistication without overwhelming beginners.

---

# 119. ROLE-BASED UI

Different roles should see different emphasis.

### Executive

Focus:

* goal
* forecast
* budget
* ROI
* risk

### Marketer

Focus:

* strategy
* funnel
* assets
* campaigns

### Sales

Focus:

* leads
* qualification
* opportunities
* routing

### Operations

Focus:

* automation
* dependencies
* QA

### Content

Focus:

* messaging
* assets
* variants

---

# 120. EXECUTIVE MODE

Add:

# Campaign Brief

A simplified executive view containing:

* objective
* audience
* journey
* forecast
* budget
* expected return
* risk
* readiness

This should be shareable.

---

# 121. PRESENTATION MODE

Hide:

* technical node settings
* implementation details
* internal IDs

Show:

* strategic journey
* forecast
* KPIs
* asset status
* recommendations

Useful for client presentation.

---

# 122. SHARING

Support:

### Internal share

User/role based.

### Review link

Read/comment.

### Presentation link

Read-only.

### Client presentation

Branded view later.

All sharing must respect tenant security.

---

# 123. ANALYTICS UX FOR THE PRODUCT ITSELF

Track UI events such as:

```text
campaign_created
ai_plan_started
ai_plan_approved
graph_node_added
graph_node_connected
simulation_run
scenario_created
asset_generated
asset_built
campaign_launch_attempted
campaign_launched
recommendation_viewed
recommendation_applied
```

Use these for product adoption analytics.

---

# 124. KEY UX SUCCESS METRICS

## Planning

Median time from campaign creation to approved strategy.

## Journey

Percentage of campaigns with complete journey.

## Simulation

Percentage of planned campaigns simulated before build.

## Compilation

Percentage of assets successfully auto-built.

## Launch

Percentage of campaigns reaching launch without manual intervention.

## AI

AI suggestion acceptance.

## Mobile

Percentage of approvals and campaign-management actions completed on mobile.

---

# 125. CRITICAL UX QUALITY GATES

Do not promote a release to the next phase unless:

### Gate 1

A new user can create a campaign without training.

### Gate 2

A nontechnical user can construct a simple funnel.

### Gate 3

A user can understand the simulation without reading documentation.

### Gate 4

A user can understand exactly what will be built before clicking Build.

### Gate 5

A user can identify launch blockers immediately.

### Gate 6

A mobile user can approve, monitor and act on a campaign.

---

# 126. PHASE DELIVERY MATRIX

| Phase | Core UI              | Mobile           | AI      | Backend Dependency      |
| ----- | -------------------- | ---------------- | ------- | ----------------------- |
| 0     | Shell, Campaign Home | Full             | Minimal | Campaign domain         |
| 1     | Strategy Studio      | Full             | High    | AI context              |
| 2     | Journey Canvas       | Viewer + editing | High    | Graph engine            |
| 3     | Simulation Lab       | Full results     | High    | Simulation engine       |
| 4     | Asset Studio         | Full             | High    | Content system          |
| 5     | Build Center         | Full             | Medium  | Compiler                |
| 6     | Automation           | Full             | High    | Automation/CRM          |
| 7     | QA/Launch            | Full             | Medium  | Execution               |
| 8     | Live Twin            | Full             | High    | Events/analytics        |
| 9     | Optimization         | Full             | High    | AI + experiments        |
| 10    | Predictive           | Full             | High    | ML/simulation           |
| 11    | Learning             | Full             | High    | Historical intelligence |

---

# 127. MVP SCREEN PRIORITY

For the first production release, prioritize only:

### Tier 1

Campaign List

Campaign Create

Campaign Home

Strategy Studio

Journey Canvas

Asset Studio

Simulation Lab

Build Center

Launch Readiness

Campaign AI

### Tier 2

Performance Center

Automation

Experiments

### Tier 3

Predictive intelligence

Monte Carlo

Campaign Learning Network

---

# 128. AI BUILD SEQUENCE

The coding agent should implement features in the following order:

```text
1. Design tokens
2. Campaign shell
3. Campaign domain UI
4. Campaign creation
5. Strategy Studio
6. AI panel
7. Campaign Graph data model
8. Graph canvas
9. Node system
10. Asset registry
11. Simulation UI
12. Scenario system
13. Asset generation
14. Builder adapters
15. Automation compiler UI
16. QA
17. Launch
18. Live performance
19. Optimization
```

Never begin by building the full canvas first.

---

# 129. AI AGENT INSTRUCTION: PRODUCT BEHAVIOR

The implementation agent must treat the Campaign Graph as the single strategic source of truth.

When a user changes:

**Goal**

recalculate:

* KPI assumptions
* simulation
* asset recommendations
* potential workflow impact

When a user changes:

**Audience**

review:

* messaging
* asset copy
* channel recommendations
* simulation assumptions

When a user changes:

**Journey**

review:

* assets
* automations
* dependencies
* simulation

When a user changes:

**Asset**

check:

* graph consistency
* campaign messaging
* simulation sensitivity
* live drift

---

# 130. AI AGENT INSTRUCTION: DO NOT CREATE ISOLATED SCREENS

Every screen must connect to a meaningful domain.

Bad:

> “Simulation page”

with no campaign relationship.

Correct:

> `/campaigns/:campaignId/simulation`

and the simulation references:

* campaign
* graph
* scenario
* assumptions
* KPIs.

---

# 131. AI AGENT INSTRUCTION: NO DUPLICATE SYSTEMS

The coding agent must reuse existing SmartCRM:

* design system
* auth
* tenant context
* page builder
* form builder
* survey platform
* messaging
* automation
* CRM records
* analytics
* billing
* permissions

Campaign Intelligence Studio should orchestrate these systems.

---

# 132. AI AGENT INSTRUCTION: MOBILE FIRST FOR CRITICAL ACTIONS

For every desktop screen ask:

> What is the mobile equivalent?

At minimum mobile must support:

* create
* inspect
* edit essential fields
* ask AI
* review
* approve
* simulate
* build
* launch
* pause
* monitor

---

# 133. AI AGENT INSTRUCTION: COMPONENT REUSE

Do not create different implementations for:

* AI cards
* KPI cards
* status badges
* asset cards
* recommendations
* mobile sheets

Create shared components with responsive variants.

---

# 134. AI AGENT INSTRUCTION: API-FIRST UI

Every major screen should correspond to clear domain APIs.

Do not embed business logic inside UI components.

Examples:

```text
Campaign
Strategy
Graph
Simulation
Scenario
Asset
Recommendation
Execution
Experiment
```

The frontend should consume domain services.

---

# 135. AI AGENT INSTRUCTION: ERROR RESILIENCE

Every async action needs:

* idle
* loading
* success
* retry
* partial success
* failure

This is especially important for:

* AI generation
* simulation
* asset builds
* automation builds
* launch

---

# 136. AI AGENT INSTRUCTION: ACCESSIBILITY IS NOT OPTIONAL

Every interactive component must support:

* keyboard
* screen reader
* focus
* touch
* accessible status

Graph must have a nonvisual representation.

---

# 137. AI AGENT INSTRUCTION: PRESERVE USER CONTEXT

When a user navigates:

Campaign → Journey → Node → Asset

the system should retain:

* current campaign
* current node
* current asset
* graph position where possible

Returning should not feel like starting over.

---

# 138. AI AGENT INSTRUCTION: USE DOMAIN TERMINOLOGY

Use these terms consistently:

**Campaign**

**Journey**

**Asset**

**Simulation**

**Scenario**

**Recommendation**

**Execution**

**Forecast**

**Actual**

**Learning**

Do not interchange:

* campaign/funnel/project
* asset/content/task
* scenario/simulation
* execution/launch

unless the meaning genuinely requires it.

---

# 139. FINAL PRODUCT NAVIGATION

Desktop:

```text
SMARTCRM

Campaigns
│
├── All Campaigns
├── Templates
└── Campaign Intelligence Studio

Inside Campaign
│
├── Overview
├── Strategy
├── Journey
├── Assets
├── Simulation
├── Automation
├── Execution
├── Performance
├── Experiments
└── AI
```

Mobile:

```text
Overview
Journey
Assets
AI
More
 ├ Strategy
 ├ Simulation
 ├ Automation
 ├ Execution
 ├ Performance
 └ Experiments
```

---

# 140. THE CORE EXPERIENCE

The ideal user journey should feel like this:

```text
"I have an idea."
        ↓
Tell Campaign AI
        ↓
"Here's your proposed strategy."
        ↓
Review
        ↓
"Here's the customer journey."
        ↓
Review / modify
        ↓
"Here are the assets you need."
        ↓
Generate
        ↓
"Here's what the campaign could produce."
        ↓
Simulate
        ↓
"Here are the biggest risks."
        ↓
Optimize
        ↓
"Ready to build?"
        ↓
Build Campaign
        ↓
"Everything is connected."
        ↓
QA
        ↓
Launch
        ↓
"Here's what's happening."
        ↓
Live Campaign Twin
        ↓
"Here's what we should improve."
        ↓
Simulate Recommendation
        ↓
Apply
```

---

# 141. FINAL IMPLEMENTATION RULE

The entire Campaign Intelligence Studio should be built around one UX principle:

> **The user should never have to recreate something that they already defined in the campaign plan.**

If the user defined:

**Audience**

that audience should flow into:

* page copy
* form
* survey
* email
* simulation
* automation
* segmentation

If the user defined:

**CTA**

that CTA should flow into:

* landing page
* email
* social
* survey completion
* tracking

If the user defined:

**Journey**

that journey should drive:

* asset requirements
* automation
* simulation
* execution
* analytics

If the user defined:

**Expected outcome**

that target should drive:

* simulation
* feasibility
* performance comparison
* AI optimization.

---

# 142. FINAL UX ARCHITECTURE

The complete SmartCRM experience becomes:

```text
                     CAMPAIGN AI
                          │
                          ▼
                   STRATEGY STUDIO
                          │
                          ▼
                    CAMPAIGN GRAPH
                          │
               ┌──────────┼──────────┐
               ▼          ▼          ▼
             ASSETS   SIMULATION  AUTOMATION
               │          │          │
               └──────────┼──────────┘
                          ▼
                   ASSET COMPILER
                          │
                          ▼
                 NATIVE SMARTCRM
                      OBJECTS
                          │
                          ▼
                     QA / LAUNCH
                          │
                          ▼
                 LIVE CAMPAIGN TWIN
                          │
                          ▼
                   AI INTELLIGENCE
                          │
               ┌──────────┼──────────┐
               ▼          ▼          ▼
           INSIGHTS   EXPERIMENTS  OPTIMIZATION
               │          │          │
               └──────────┼──────────┘
                          ▼
                    LEARNING LOOP
                          │
                          └──────────→ NEXT CAMPAIGN
```

# 143. BUILD DEFINITION OF DONE

Campaign Intelligence Studio 2.0 is not considered complete merely because the screens exist.

The implementation is complete only when a user can:

**1. Describe a campaign in natural language.**

**2. Receive an AI-generated strategy.**

**3. Edit and approve that strategy.**

**4. Generate a visual campaign journey.**

**5. Add and configure journey branches.**

**6. Automatically identify required assets.**

**7. Generate campaign content from shared campaign context.**

**8. Simulate expected campaign performance.**

**9. Compare multiple scenarios.**

**10. Identify the most important bottleneck.**

**11. Build native SmartCRM assets from the campaign plan.**

**12. Automatically connect those assets.**

**13. Validate the campaign.**

**14. Approve and launch it.**

**15. Observe actual performance against forecast.**

**16. Receive AI recommendations.**

**17. Simulate recommendations before applying them.**

**18. Apply approved optimizations.**

**19. Record campaign learnings.**

**20. Use those learnings to improve the next campaign.**

That is the complete UX contract for the product.

---

# 144. PRODUCT DESIGN PRINCIPLE TO PRESERVE THROUGH EVERY PHASE

The strongest version of this product is **not** “a better campaign canvas.”

It is:

> **An intelligent campaign workspace where strategy becomes a graph, the graph becomes a simulation, the simulation becomes a build specification, the specification becomes real SmartCRM objects, and live performance feeds back into the next strategic decision.**

Every screen, component, API, AI agent and mobile experience should reinforce that loop.

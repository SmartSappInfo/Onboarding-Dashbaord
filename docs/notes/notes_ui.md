# SmartSapp Knowledge & Idea Intelligence 2.0

## Complete UI/UX Architecture & Phase-by-Phase Experience Specification

**Product:** SmartSapp
**Module:** Knowledge & Idea Intelligence 2.0
**UX Role:** Organizational knowledge, notes, ideas, insights, evidence and AI intelligence layer
**Platforms:** Desktop Web, Tablet Web, Mobile Web/PWA
**Primary Brand:** SmartSapp Blue `#3A86FF`
**Design Language:** Poppins / Figtree / Didact
**Status:** Production UX Architecture

---

# 1. PRODUCT EXPERIENCE VISION

SmartSapp Knowledge & Idea Intelligence should be experienced as a **universal intelligence layer**, not a standalone notes application.

Users should be able to:

* capture a thought from anywhere;
* append knowledge to a contact, lead, school, deal, campaign, meeting or task;
* transform rough notes into structured knowledge;
* create and develop ideas;
* visually map relationships;
* ask AI questions across authorized organizational knowledge;
* discover contradictions, patterns and opportunities;
* feed insights into Campaign Intelligence;
* convert knowledge into tasks, campaigns, decisions and actions;
* retrieve the reasoning behind previous decisions.

## Experience Loop

```text
CAPTURE
   ↓
KNOWLEDGE
   ↓
CONTEXTUALIZE
   ↓
CONNECT
   ↓
UNDERSTAND
   ↓
EVIDENCE
   ↓
AI REASONING
   ↓
INSIGHT
   ↓
IDEA
   ↓
DECISION
   ↓
ACTION
   ↓
OUTCOME
   ↓
NEW KNOWLEDGE
```

The UI must reinforce this loop continuously.

---

# 2. UX DESIGN PRINCIPLES

## 2.1 Capture before organization

Never force the user to classify something before allowing them to capture it.

Bad:

```text
Create Note
→ Choose Category
→ Choose Folder
→ Choose Contact
→ Choose Tags
→ Write
```

Preferred:

```text
Capture
→ Write
→ Save
→ AI organizes
```

---

## 2.2 Context should be automatic

When capturing from a CRM contact:

```text
Contact: John Mensah
School: Example Academy
Deal: 2026 Enrollment Package
```

should automatically become context.

The user should not manually reselect those entities.

---

## 2.3 Progressive disclosure

The first interaction should be extremely simple.

Advanced capabilities should appear progressively:

```text
Quick Capture
     ↓
Rich Editor
     ↓
AI Assistance
     ↓
Relationships
     ↓
Evidence
     ↓
Graph
     ↓
Intelligence
```

---

## 2.4 AI must feel assistive, not autonomous

AI should visually distinguish:

* user-authored information;
* extracted information;
* AI interpretation;
* AI recommendation.

Never visually present AI inference as fact.

---

## 2.5 Every object should have a destination

Knowledge should always be capable of becoming:

* a task;
* an idea;
* an insight;
* a decision;
* a campaign;
* a CRM activity;
* a research item;
* a strategy;
* a follow-up.

---

# 3. GLOBAL INFORMATION ARCHITECTURE

## Primary Navigation

Desktop:

```text
SmartSapp
────────────────────────

Workspace

Home
Inbox
Knowledge
Ideas
Insights
Graph
Ask AI

────────────────────────

CRM

Contacts
Leads
Schools
Deals
Activities

────────────────────────

Intelligence

Campaign Intelligence
Sales Intelligence
Research

────────────────────────

Workspace

Collections
Templates
Automations
Settings
```

Mobile:

```text
┌──────────────────────────┐
│ SmartSapp       🔍  +  ☰ │
├──────────────────────────┤
│                          │
│       Current View       │
│                          │
└──────────────────────────┘

Bottom navigation:

Home | Inbox | Knowledge | Ideas | AI
```

The global capture action remains permanently available.

---

# 4. GLOBAL COMMAND SYSTEM

A global command palette should be available through:

```text
⌘ K / Ctrl K
```

Commands:

```text
Create knowledge
Capture idea
Capture feedback
Capture observation
Create decision
Create task
Search knowledge
Ask AI
Open Knowledge Graph
Open Knowledge Inbox
Open Ideas
Open Insights
Open Campaign Intelligence
```

Contextual commands should dynamically change according to the current surface.

---

# 5. GLOBAL CAPTURE HUD

This is one of the most important experiences in the product.

The current Notes floating capture mechanism evolves into:

## Universal Knowledge Capture

Desktop shortcut:

```text
Alt + N
```

Desktop:

```text
                         ┌──────────────────────────────┐
                         │ What are you thinking?       │
                         │                              │
                         │ Start typing...              │
                         │                              │
                         │ + Contact  + Deal  + Campaign│
                         │                              │
                         │ Note  Idea  Feedback  Task   │
                         │                              │
                         │              Save     AI ✦   │
                         └──────────────────────────────┘
```

### Capture modes

* Note
* Idea
* Observation
* Feedback
* Question
* Decision
* Task
* Voice

Default mode:

**Note**

AI determines whether another type is more appropriate.

---

# 6. CAPTURE HUD STATES

## State A — Closed

Floating button:

```text
✦
```

Hover:

```text
Capture knowledge
Alt + N
```

---

## State B — Open

Small composer.

---

## State C — Expanded

Full-width composer with:

* title;
* rich editor;
* attachments;
* entity linking;
* AI actions;
* visibility;
* save controls.

---

## State D — Contextual Capture

If launched from CRM:

```text
Adding knowledge to

John Mensah
Example Academy
Enrollment Deal
```

---

## State E — AI Classification

After typing:

```text
AI detected:

Observation
Customer feedback
Potential campaign insight

[Accept] [Edit]
```

---

## State F — Saved

Toast:

```text
Knowledge captured
✓ Linked to John Mensah
✓ Indexed for AI
```

---

## State G — Offline

```text
Saved locally
Will sync when you're back online
```

---

# 7. KNOWLEDGE HOME

Route:

```text
/knowledge
```

Purpose:

The user's operational home for organizational knowledge.

## Desktop

```text
┌───────────────────────────────────────────────────────────┐
│ Knowledge                         Search...       + Capture│
├───────────────┬───────────────────────────────────────────┤
│               │                                           │
│ Overview      │ Knowledge Overview                        │
│ All Knowledge │                                           │
│ My Knowledge  │ ┌────────┐ ┌────────┐ ┌────────┐          │
│ Inbox         │ │ 1,284  │ │  342   │ │  87    │          │
│ Ideas         │ │Knowledge│ │ Ideas  │ │Insights│         │
│ Insights      │ └────────┘ └────────┘ └────────┘          │
│ Decisions     │                                           │
│ Graph         │ Recent Knowledge                          │
│               │ ───────────────────────────────────────   │
│ Collections   │                                           │
│ Templates     │ [Knowledge cards]                          │
│               │                                           │
│               │ AI Signals                                │
│               │ [Insight cards]                            │
└───────────────┴───────────────────────────────────────────┘
```

---

# 8. KNOWLEDGE HOME COMPONENTS

## KPI cards

* Total Knowledge
* New This Week
* Unreviewed
* AI Insights
* Open Ideas
* Knowledge-to-Action Rate

---

## Recent Knowledge

Each card contains:

```text
Type badge
Title
2-line preview
Author
Timestamp
Linked entities
AI confidence
Status
```

---

## AI Signals

Examples:

```text
↑ Emerging customer concern

AI detected 14 related notes about
fee-payment flexibility.

View evidence
```

---

# 9. KNOWLEDGE LIST

Route:

```text
/knowledge/all
```

Views:

* List
* Grid
* Timeline
* Table

Desktop table:

```text
Type | Title | Context | Author | AI Status | Updated
```

Mobile:

Cards replace tables.

---

# 10. FILTER SYSTEM

Filters:

```text
Type
Status
Author
Date
Collection
Tag
CRM entity
Campaign
Visibility
Evidence
AI confidence
Source
```

Advanced filters:

```text
Contains
Doesn't contain
Created before
Created after
Linked to
Not linked to
AI classified as
Has contradiction
Has action
Has campaign signal
```

Saved filters:

```text
Save view
```

---

# 11. KNOWLEDGE DETAIL

Route:

```text
/knowledge/:id
```

## Desktop layout

Three-column model:

```text
┌───────────────────────────────────────────────────────────┐
│ Breadcrumbs                         Edit  Share  More      │
├──────────────────────────┬──────────────────┬─────────────┤
│                          │                  │             │
│ Knowledge Content        │ AI Assistant     │ Context     │
│                          │                  │             │
│ Title                    │ Summary          │ Contacts    │
│                          │                  │ Deals       │
│ Rich content             │ Insights         │ Campaigns  │
│                          │ Actions          │ Collections │
│ Attachments              │ Questions        │ Relations   │
│                          │                  │             │
└──────────────────────────┴──────────────────┴─────────────┘
```

Tablet:

```text
Content
↓
Context
↓
AI
```

Mobile:

```text
Content

[Context] [AI] [Relations]

Bottom sheets provide detail.
```

---

# 12. KNOWLEDGE EDITOR

The editor is TipTap-based.

## Editor structure

```text
Title
Type / status
────────────────────────────
Formatting toolbar
────────────────────────────
Document
────────────────────────────
AI suggestions
Attachments
Relations
```

---

# 13. EDITOR STATES

The editor must support:

### 13.1 Empty

```text
Start writing...

Try:
• customer observation
• meeting note
• idea
• decision
```

---

### 13.2 Draft

Autosave:

```text
Saving...
Saved 10 seconds ago
```

---

### 13.3 Editing

Show:

```text
Last edited by Sarah
Version 12
```

---

### 13.4 Conflict

```text
This knowledge was updated elsewhere.

Your version
Latest version

[Review changes]
[Keep mine]
[Use latest]
```

Never silently overwrite.

---

### 13.5 Read-only

Used when permission is `view`.

---

### 13.6 Restricted

```text
Restricted knowledge

You don't have permission to view this content.
```

---

### 13.7 AI Processing

```text
AI is analyzing this knowledge...

✓ Extracting entities
✓ Identifying topics
○ Finding related knowledge
○ Detecting actions
```

---

### 13.8 Unsaved Changes

Navigation guard:

```text
You have unsaved changes.

Leave without saving?
[Stay] [Leave]
```

---

# 14. RICH EDITOR TOOLBAR

Desktop:

```text
Undo | Redo
H1 H2 H3
Bold Italic Underline
List
Quote
Code
Link
Mention
Attachment
Table
Divider
AI ✦
```

Mobile:

Toolbar becomes horizontally scrollable.

Most common actions remain fixed:

```text
Bold | List | Link | AI | More
```

---

# 15. AI EDITOR ASSISTANT

Click:

```text
AI ✦
```

opens contextual assistant.

Actions:

```text
Summarize
Rewrite
Expand
Make concise
Brainstorm
Challenge this
Find related
Find evidence
Extract actions
Create task
Create idea
Create campaign
Link contact
Link deal
Ask
```

---

# 16. INLINE AI

Selecting text produces:

```text
┌─────────────────────────────┐
│ AI ✦                        │
│ Summarize                   │
│ Rewrite                     │
│ Explain                     │
│ Challenge                   │
│ Expand                      │
└─────────────────────────────┘
```

AI-generated text must appear visually distinct until accepted.

---

# 17. KNOWLEDGE INBOX

Route:

```text
/knowledge/inbox
```

Purpose:

Human review queue for AI-generated or unstructured knowledge.

Inbox categories:

```text
Needs classification
Needs linking
Potential duplicate
Potential contradiction
AI insight
Suggested action
Suggested idea
```

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ Knowledge Inbox                         27 items         │
├───────────────┬──────────────────────────────────────────┤
│ Categories    │ Review Queue                             │
│               │                                          │
│ All       27  │ ┌──────────────────────────────────────┐ │
│ Classify  12  │ │ Potential customer insight           │ │
│ Link       6  │ │ "Parents keep asking..."             │ │
│ Duplicate  3  │ │                                      │ │
│ Conflict   2  │ │ AI confidence 91%                    │ │
│ Actions    4  │ │ [Accept] [Edit] [Dismiss]            │ │
│               │ └──────────────────────────────────────┘ │
└───────────────┴──────────────────────────────────────────┘
```

---

# 18. INBOX REVIEW EXPERIENCE

The reviewer should never need to navigate away.

Review drawer:

```text
Original
AI interpretation
Suggested classification
Suggested links
Suggested relations
Suggested action

[Accept all]
[Accept selected]
[Edit]
[Reject]
```

Bulk operations:

* Accept;
* reject;
* assign;
* categorize;
* link;
* archive.

---

# 19. EMPTY INBOX

```text
✓ You're all caught up

New AI suggestions and unprocessed
knowledge will appear here.
```

---

# 20. IDEAS HOME

Route:

```text
/knowledge/ideas
```

Ideas should feel distinct from ordinary notes.

Views:

* Board
* List
* Canvas
* Timeline

---

# 21. IDEA BOARD

Columns:

```text
Captured
Exploring
Structured
Evidence Gathering
Validating
Validated
Approved
Implemented
Measured
```

Cards:

```text
Idea title
Problem
Impact
Effort
Confidence
Evidence count
Owner
Last activity
```

---

# 22. IDEA DETAIL

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ Idea: Parent Enrollment Recovery Campaign                 │
│ Exploring                     Impact: High                │
├───────────────────────┬──────────────────────────────────┤
│ Problem               │ AI Assessment                    │
│                       │                                  │
│ Proposed solution     │ Opportunity: High               │
│                       │ Confidence: 84%                  │
│ Audience              │                                  │
│                       │ Evidence: 17                     │
│ Assumptions           │                                  │
│                       │                                  │
│ Hypotheses            │                                  │
├───────────────────────┴──────────────────────────────────┤
│ Evidence | Relations | Activity | AI | Decisions          │
└──────────────────────────────────────────────────────────┘
```

---

# 23. IDEA CANVAS

Route:

```text
/knowledge/ideas/:id/canvas
```

The Idea Canvas is a structured visual thinking environment.

## Canvas nodes

```text
Problem
Audience
Pain Point
Insight
Evidence
Assumption
Hypothesis
Solution
Feature
Campaign
Risk
Decision
Experiment
Outcome
```

Example:

```text
             CUSTOMER EVIDENCE
                    │
                    ▼
              ┌──────────┐
              │ Pain Point│
              └────┬─────┘
                   │
                   ▼
              ┌──────────┐
              │ Problem  │
              └────┬─────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
      Hypothesis         Audience
          │
          ▼
       Solution
          │
          ▼
       Campaign
          │
          ▼
        Outcome
```

---

# 24. CANVAS INTERACTION MODEL

Desktop:

* pan;
* zoom;
* multi-select;
* drag;
* connect;
* duplicate;
* group;
* align;
* collapse;
* expand;
* comments.

Keyboard:

```text
Space + drag = pan
Scroll = zoom
Delete = remove
Cmd/Ctrl + Z = undo
Cmd/Ctrl + K = command
```

---

# 25. CANVAS NODE DESIGN

Each node contains:

```text
Type
Title
Status
Confidence
Evidence count
Owner
```

Hover:

```text
Open
Edit
Expand
Connect
Ask AI
```

---

# 26. AI IDEA CANVAS

AI actions:

```text
Complete this idea
Find missing evidence
Challenge assumptions
Find similar ideas
Suggest hypotheses
Identify risks
Suggest experiments
Estimate effort
Find supporting knowledge
Create campaign concept
```

AI should never silently create nodes.

It proposes:

```text
AI suggestion

"Add an assumption that parents
will respond better to WhatsApp than email."

[Add to canvas]
[Dismiss]
```

---

# 27. KNOWLEDGE GRAPH

Route:

```text
/knowledge/graph
```

Purpose:

Expose relationships across organizational knowledge.

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ Knowledge Graph                         Search           │
├───────────────┬──────────────────────────────────────────┤
│ Filters       │                                          │
│               │                  ●                       │
│ Knowledge     │             ●────┼────●                 │
│ Ideas         │                  │                       │
│ Contacts      │             ●────┼────●                 │
│ Campaigns     │                  │                       │
│ Deals         │                  ●                       │
│               │                                          │
└───────────────┴──────────────────────────────────────────┘
```

---

# 28. GRAPH MODES

### Explore

Free-form exploration.

### Focus

Focus around one object.

### Path

Find relationship between two entities.

### Impact

Show downstream dependencies.

### Evidence

Show evidence supporting an idea.

### Campaign

Show knowledge → insight → campaign relationships.

---

# 29. GRAPH CONTROLS

```text
Zoom
Fit
Center
Filter
Hide node types
Show labels
Cluster
Expand
Collapse
Search
```

Mobile:

The graph should not attempt to replicate desktop complexity.

Use:

```text
Focused graph
+
relationship list
```

instead of unlimited canvas.

---

# 30. GRAPH NODE DRAWER

Selecting a node opens:

```text
Knowledge
────────────────
Title
Type
Status

Connected to:
• John Mensah
• Enrollment Campaign
• Idea #124

Relationships:
Supports
Derived from
Contradicts

[Open]
[Ask AI]
```

---

# 31. ASK SMARTSAPP KNOWLEDGE

Route:

```text
/knowledge/ask
```

This becomes the primary natural-language knowledge interface.

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ Ask SmartSapp Knowledge                                  │
│                                                          │
│ What do you want to understand?                          │
│                                                          │
│ "What are the biggest enrollment objections              │
│ parents have raised this term?"                          │
│                                                          │
│                         Ask ✦                            │
└──────────────────────────────────────────────────────────┘
```

---

# 32. AI ANSWER EXPERIENCE

Response:

```text
Answer

The strongest recurring objections are:

1. Fee affordability
2. Transportation
3. Uncertainty about academic outcomes

Confidence: High

Evidence
────────
[Knowledge #128]
[Call #239]
[Survey #87]

Related insights
───────────────
...

Recommended actions
──────────────────
...
```

Every factual statement should be traceable to evidence.

---

# 33. AI CHAT STATES

### Empty

Suggested questions.

### Thinking

```text
Searching authorized knowledge...
Analyzing relationships...
Synthesizing evidence...
```

### Answer

Show citations.

### Partial answer

If evidence is insufficient:

```text
I found limited evidence.

I can answer partially, but this conclusion
should not be treated as established.
```

### No evidence

```text
I couldn't find sufficient authorized knowledge
to answer this reliably.
```

### Restricted evidence

```text
Some potentially relevant information is
outside your access permissions.
```

Do not reveal restricted content.

---

# 34. AI SOURCE PANEL

Users can expand:

```text
Why am I seeing this answer?

Sources
Evidence
Relationships
AI reasoning summary
Confidence
Last updated
```

Never expose hidden chain-of-thought.

Show concise evidence provenance instead.

---

# 35. INSIGHTS HOME

Route:

```text
/knowledge/insights
```

Categories:

```text
Customer Signals
Market Signals
Campaign Signals
Product Signals
Risks
Opportunities
Trends
Patterns
```

Insight card:

```text
Customer Signal

"Parents increasingly ask for
flexible payment options."

Confidence       89%
Evidence         23
Impact           High

[View Evidence]
[Create Idea]
[Create Campaign]
[Dismiss]
```

---

# 36. INSIGHT DETAIL

Sections:

```text
Summary
Evidence
Affected entities
Trend
Relationships
AI explanation
Recommended actions
Campaign opportunities
Activity
```

Actions:

```text
Create Idea
Create Campaign Concept
Create Task
Create Decision
Share
```

---

# 37. DECISION CENTER

Route:

```text
/knowledge/decisions
```

Decision card:

```text
Decision
────────────
Use WhatsApp as the primary follow-up
channel for warm enrollment leads.

Status: Approved

Rationale
Evidence
Alternatives
Owner
Date
```

Decisions should be immutable historically.

Corrections create new versions rather than rewriting history.

---

# 38. COLLECTIONS

Route:

```text
/knowledge/collections
```

Examples:

```text
Enrollment Research
Customer Feedback
Product Strategy
Campaign Ideas
School Operations
Leadership Decisions
Market Intelligence
```

Collection types:

* manual;
* dynamic;
* AI-curated.

---

# 39. COLLECTION DETAIL

```text
Collection
────────────────────────────
Description

Knowledge
Ideas
Insights
Decisions
Documents

AI Summary
Recent activity
Graph
```

Dynamic collection example:

```text
Customer knowledge
WHERE
Type = Customer Statement
AND
Created = Last 90 days
```

---

# 40. KNOWLEDGE TEMPLATES

Route:

```text
/knowledge/templates
```

Templates:

```text
Meeting Note
Call Note
Customer Feedback
Research Note
Idea
Decision
Experiment
Campaign Concept
Product Insight
School Visit
```

Template editor:

```text
Fields
Blocks
AI instructions
Default relationships
Default visibility
```

---

# 41. CRM CONTEXTUAL SURFACES

Knowledge must appear inside CRM rather than requiring users to open Knowledge.

Supported entities:

* Contact
* Lead
* School
* Deal
* Campaign
* Task
* Meeting
* Call

---

# 42. CONTACT KNOWLEDGE TAB

Example:

```text
John Mensah

Overview | Activities | Deals | Knowledge | Messages
```

Knowledge:

```text
Customer statements
Observations
Call notes
Ideas
Insights
Tasks
```

CTA:

```text
+ Add knowledge
```

---

# 43. CRM TIMELINE

Knowledge events should appear naturally within the CRM timeline.

Example:

```text
10:42 AM
Customer statement captured

"Parents want easier payment options."

AI detected:
Customer pain point
Payment friction

[View knowledge]
```

---

# 44. DEAL KNOWLEDGE

Deal context should expose:

```text
Deal intelligence
───────────────
Known objections
Buying signals
Decision criteria
Customer statements
Risks
Next actions
```

AI can summarize deal knowledge.

---

# 45. SCHOOL KNOWLEDGE

School profile:

```text
School Intelligence

Recent observations
Parent feedback
Enrollment insights
Operational issues
Campaign opportunities
Decisions
```

---

# 46. CRM CAPTURE

Inside CRM:

```text
+ Add Knowledge
```

opens contextual composer with entity pre-linked.

The user should never need to search for the entity again.

---

# 47. CAMPAIGN INTELLIGENCE HANDOFF

Knowledge should be a first-class input to Campaign Intelligence.

Inside Knowledge:

```text
Create campaign opportunity
```

AI pre-populates:

```text
Audience
Problem
Pain point
Signal
Suggested message
Evidence
Recommended channel
```

User reviews before sending to Campaign Intelligence.

---

# 48. CAMPAIGN INTELLIGENCE → KNOWLEDGE

Campaign Intelligence should write knowledge back.

Examples:

```text
Campaign result
↓
Performance insight
↓
Knowledge object
```

Generated knowledge:

```text
Campaign Insight

"Message angle A generated stronger
engagement among warm leads."
```

This can feed future campaign strategy.

---

# 49. CAMPAIGN CONCEPT HANDOFF

Button:

```text
Send to Campaign Intelligence
```

Confirmation:

```text
Create Campaign Opportunity?

Source:
3 insights
17 evidence items
2 customer segments

Destination:
Campaign Intelligence

[Create Opportunity]
[Cancel]
```

Never silently create campaigns.

---

# 50. SALES INTELLIGENCE HANDOFF

Knowledge can generate:

```text
Buying signal
Objection
Risk
Follow-up opportunity
Lead insight
```

Actions:

```text
Create Sales Signal
Update Lead Intelligence
Create Task
Create Follow-up
```

---

# 51. MEETINGS INTEGRATION

After meeting:

```text
Meeting completed

AI detected:
✓ 7 action items
✓ 3 decisions
✓ 5 customer statements
✓ 2 risks
✓ 1 campaign opportunity
```

User can:

```text
Review all
Accept selected
Dismiss
```

Accepted items become Knowledge objects.

---

# 52. CALL INTEGRATION

Call recording/transcript:

```text
Call Intelligence

Summary
Customer statements
Objections
Buying signals
Actions
Insights
```

Each can become a Knowledge object with provenance.

---

# 53. FORMS & SURVEYS INTEGRATION

Structured responses can generate aggregated knowledge.

Example:

```text
Survey
↓
Response patterns
↓
Insight
↓
Idea
```

Important UX rule:

Individual responses remain evidence.

AI-generated aggregate insights must link back to the underlying responses.

---

# 54. LEAD INTELLIGENCE INTEGRATION

Lead Intelligence can create:

```text
Market signal
Prospect observation
Company intelligence
Buying signal
Opportunity
```

These should be available inside Knowledge.

---

# 55. KNOWLEDGE → TASK

Any knowledge object may expose:

```text
Create task
```

Task modal:

```text
Task title
Owner
Due date
Priority
Related entity
Source knowledge

[Create Task]
```

The resulting task maintains provenance.

---

# 56. KNOWLEDGE → IDEA

Button:

```text
Turn into idea
```

AI maps:

```text
Problem
Audience
Evidence
Potential solution
Assumptions
```

User confirms.

---

# 57. KNOWLEDGE → DECISION

```text
Create decision
```

AI proposes:

```text
Decision
Rationale
Evidence
Alternatives
Risks
```

User must explicitly approve.

---

# 58. RESPONSIVE DESIGN SYSTEM

## Breakpoints

```text
Mobile:
0–767px

Tablet:
768–1199px

Desktop:
1200px+

Large Desktop:
1440px+
```

---

# 59. DESKTOP LAYOUT RULES

Desktop uses:

```text
Sidebar
+
Primary content
+
Optional contextual rail
```

Maximum content width:

```text
1440px
```

Dense data screens may use full width.

---

# 60. TABLET LAYOUT RULES

Tablet uses:

```text
Collapsed navigation
+
Primary content
+
Overlay contextual panels
```

Never squeeze three desktop columns into tablet.

Convert:

```text
3 columns
↓
1 main column
+
drawers
```

---

# 61. MOBILE LAYOUT RULES

Mobile is not a reduced desktop experience.

Primary design:

```text
Single column
Bottom navigation
Bottom sheets
Floating capture
Sticky actions
```

Complex desktop interfaces become focused workflows.

---

# 62. MOBILE KNOWLEDGE DETAIL

```text
← Knowledge

Customer Feedback

[AI Summary]

Content

Linked:
John Mensah
Example Academy

Evidence
Relations

────────────────────
[Edit] [AI] [More]
```

---

# 63. MOBILE IDEA CANVAS

Do not expose a full infinite canvas by default.

Instead:

```text
Idea

Problem
↓
Evidence
↓
Hypothesis
↓
Solution
↓
Campaign
```

Users can tap:

```text
Open visual map
```

for the advanced canvas.

---

# 64. MOBILE GRAPH

Primary view:

```text
Knowledge Graph

John Mensah
     ↓
Customer Feedback
     ↓
Pain Point
     ↓
Enrollment Idea
     ↓
Campaign
```

Gestures:

* swipe;
* pinch;
* tap;
* expand.

---

# 65. MOBILE AI

AI should open as a full-height bottom sheet.

```text
Ask SmartSapp

Ask anything about your
authorized knowledge...

Suggested:
• Summarize this
• Find related knowledge
• What changed?
• What should I do next?
```

---

# 66. MOBILE CAPTURE

Capture should require minimal interaction.

```text
✦
```

opens:

```text
What's on your mind?

[Voice] [Text]

Note | Idea | Feedback

             Save
```

After save:

```text
Captured ✓

AI found:
Customer feedback
Linked to John Mensah

[Review] [Done]
```

---

# 67. VOICE CAPTURE

Mobile:

```text
Hold to record
```

After recording:

```text
Transcribing...

✓ Transcript
✓ Summary
✓ Entities
✓ Actions

[Review]
```

Never publish AI-extracted actions without review when they cause consequential changes.

---

# 68. COMPONENT SYSTEM

## Foundation

* Button
* IconButton
* Input
* Textarea
* Select
* Combobox
* Checkbox
* Radio
* Switch
* Tabs
* Badge
* Avatar
* Tooltip
* Popover
* Modal
* Drawer
* BottomSheet
* Toast
* Skeleton

---

# 69. KNOWLEDGE COMPONENTS

* KnowledgeCard
* KnowledgeList
* KnowledgeTimeline
* KnowledgeEditor
* KnowledgePreview
* KnowledgeTypeBadge
* KnowledgeStatusBadge
* KnowledgeContext
* KnowledgeRelations
* EvidenceList
* ProvenanceBadge
* AIConfidenceBadge
* AIInsightCard
* KnowledgeActionCard
* KnowledgeSearch

---

# 70. IDEA COMPONENTS

* IdeaCard
* IdeaBoard
* IdeaStageBadge
* IdeaScore
* IdeaEvidence
* IdeaCanvas
* IdeaNode
* IdeaEdge
* IdeaInspector
* IdeaAIRecommendations

---

# 71. GRAPH COMPONENTS

* GraphViewport
* GraphNode
* GraphEdge
* GraphControls
* GraphFilters
* GraphLegend
* GraphInspector
* GraphSearch
* GraphPathViewer

---

# 72. AI COMPONENTS

* AIAssistant
* AICommandMenu
* AISuggestion
* AIInsight
* AIAnswer
* AIEvidence
* AIConfidence
* AIProcessingState
* AIReviewCard
* AIActionConfirmation

---

# 73. ENTITY LINKING COMPONENT

Reusable everywhere:

```text
Link to...

Search contacts
Search schools
Search deals
Search campaigns
Search tasks
Search meetings
Search forms
Search surveys
```

AI suggestions:

```text
Suggested links

John Mensah — 96%
Example Academy — 91%

[Link]
```

---

# 74. SEARCH UX

Global search must support:

```text
Keyword
Semantic search
Entity
Relationship
Metadata
Date
Author
Type
```

Search result grouping:

```text
Knowledge
Ideas
Insights
Decisions
CRM
Campaigns
Documents
```

---

# 75. SEARCH RESULT CARD

```text
Customer Feedback
"Parents are requesting..."

John Mensah
Example Academy

Related:
Enrollment Campaign

Matched because:
semantic + entity + keyword
```

Do not expose technical ranking terminology to ordinary users unless requested.

---

# 76. COMMAND MENU UX

```text
⌘K

Search or command...

Capture knowledge
Ask AI
Create idea
Create task
Open graph
Open inbox
```

Keyboard-first users should be able to operate almost entirely from the keyboard.

---

# 77. NOTIFICATION UX

Notifications should be intelligent.

Examples:

```text
AI found 3 potential duplicates
```

```text
A decision conflicts with newer evidence
```

```text
Your idea now has enough evidence to validate
```

```text
Campaign Intelligence generated a new insight
```

Avoid noisy notifications for ordinary indexing.

---

# 78. LOADING STATES

Never show blank screens.

Use skeletons for:

* knowledge lists;
* detail views;
* cards;
* graphs.

AI loading:

```text
Analyzing knowledge...
```

Progressive rendering:

```text
Summary
↓
Evidence
↓
Relations
↓
Recommendations
```

---

# 79. EMPTY STATES

Every major screen requires a useful empty state.

Example Knowledge:

```text
Your knowledge workspace is empty.

Capture your first thought, observation,
meeting note or customer insight.

[Capture Knowledge]
```

Ideas:

```text
No ideas yet.

Turn observations and customer feedback
into structured ideas.

[Create Idea]
```

Graph:

```text
Your knowledge graph will appear
as relationships are created.

[Explore Knowledge]
```

Insights:

```text
No AI insights yet.

Capture more knowledge to give SmartSapp
more context to reason over.
```

---

# 80. ERROR STATES

Errors must be actionable.

Bad:

```text
Something went wrong.
```

Preferred:

```text
We couldn't save this knowledge.

Your local version is preserved.

[Retry]
[Download Copy]
```

AI:

```text
AI couldn't complete the analysis.

Your knowledge is safe.

[Retry]
```

Permission:

```text
You don't have permission to perform this action.

Contact your workspace administrator if you need access.
```

---

# 81. OFFLINE UX

Mobile/PWA should support offline capture.

State:

```text
Offline
```

Capture:

```text
Saved locally
Pending sync
```

Sync center:

```text
3 items waiting to sync

✓ 7 synced
⟳ 3 pending
! 1 conflict
```

---

# 82. CONFLICT UX

Never silently resolve important content conflicts.

```text
Conflict detected

Your version
vs.
Server version

[Compare]
```

Diff view:

```text
Removed
Added
Changed
```

Actions:

```text
Keep mine
Keep server
Merge
```

---

# 83. ACCESSIBILITY

Target:

**WCAG 2.2 AA**

Requirements:

* keyboard navigation;
* visible focus states;
* semantic headings;
* screen-reader labels;
* minimum touch targets;
* accessible color contrast;
* reduced motion;
* screen-reader graph alternatives;
* keyboard-accessible editor;
* ARIA states for drawers and dialogs.

---

# 84. GRAPH ACCESSIBILITY

A visual graph must always have an alternative representation.

Example:

```text
Relationship list

Customer Feedback
  supports → Enrollment Idea
  linked to → John Mensah
  derived from → Call #294
```

Never make graph visualization the only way to access relationship data.

---

# 85. MOTION SYSTEM

Motion should communicate:

* opening;
* hierarchy;
* state change;
* relationship;
* completion.

Avoid decorative animation.

Graph animation should be optional.

Respect:

```text
prefers-reduced-motion
```

---

# 86. TOUCH TARGETS

Mobile minimum:

```text
44 × 44 px
```

Preferred:

```text
48 × 48 px
```

Spacing should prevent accidental actions.

---

# 87. CONFIRMATION RULES

No confirmation required:

* saving a draft;
* adding a tag;
* linking an object;
* opening AI assistant.

Confirmation required:

* deleting knowledge;
* publishing campaign;
* creating consequential CRM changes;
* changing permissions;
* permanently removing relationships.

---

# 88. AI SAFETY UX

AI-generated information must carry one of:

```text
AI suggested
AI inferred
AI summarized
AI extracted
```

Never:

```text
Fact
```

unless it is explicitly sourced from user/system data.

---

# 89. AI ACCEPTANCE UX

For AI-generated changes:

```text
Suggested change

[Accept]
[Edit]
[Reject]
```

Bulk:

```text
Accept all suggestions
```

should only be available when the operations are reversible and low-risk.

---

# 90. KNOWLEDGE PROVENANCE UX

Every derived insight should expose:

```text
Source
Author
Created
Last updated
Source type
Evidence
AI processing
Model version
```

Users need to understand:

> “Why does SmartSapp believe this?”

---

# 91. KNOWLEDGE HEALTH DASHBOARD

Route:

```text
/knowledge/health
```

Metrics:

```text
Coverage
Connectivity
Freshness
Evidence
Actionability
AI readiness
```

Use diagnostic cards rather than vanity metrics.

Example:

```text
Connectivity
78%

17,240 knowledge objects
31,500 relationships

Opportunity:
2,340 objects have no meaningful links.
```

---

# 92. ADMINISTRATION UX

Route:

```text
/settings/knowledge
```

Sections:

```text
General
Permissions
Visibility
AI
Retention
Templates
Custom fields
Integrations
Indexing
Storage
Billing
Audit log
```

---

# 93. PERMISSIONS UI

Permissions:

```text
View
Create
Edit
Delete
Share
Export
Manage
Use AI
Graph
Insights
Ideas
Decisions
```

Visibility:

```text
Private
Team
Department
Workspace
Organization
```

Sensitive classification:

```text
Normal
Confidential
Restricted
```

---

# 94. AUDIT LOG

Route:

```text
/settings/knowledge/audit
```

Events:

```text
Knowledge created
Knowledge edited
Knowledge shared
Knowledge deleted
AI accessed knowledge
AI generated insight
Permission changed
Export created
```

---

# 95. RESPONSIVE NAVIGATION MATRIX

| Surface        | Desktop        | Tablet            | Mobile         |
| -------------- | -------------- | ----------------- | -------------- |
| Knowledge Home | Sidebar        | Collapsed sidebar | Bottom nav     |
| Knowledge List | Table/List     | List              | Cards          |
| Editor         | Full editor    | Full editor       | Mobile editor  |
| AI             | Side panel     | Drawer            | Bottom sheet   |
| Graph          | Full canvas    | Canvas + drawer   | Focus graph    |
| Idea Canvas    | Full canvas    | Canvas            | Structured map |
| CRM Context    | Right rail     | Drawer            | Bottom sheet   |
| Inbox          | Split view     | Split/drawer      | Stack          |
| Search         | Command + page | Command + page    | Full screen    |
| Capture        | HUD            | HUD               | Bottom sheet   |

---

# 96. PHASE-BY-PHASE UX IMPLEMENTATION

## PHASE 1 — FOUNDATION & NORMALIZATION

### Product scope

Build the Knowledge Object foundation.

### UI deliverables

1. Knowledge Home
2. Knowledge List
3. Knowledge Detail
4. Basic TipTap Editor
5. Universal Capture
6. Entity Linking
7. Attachments
8. Search
9. Basic CRM Knowledge tab
10. Migration compatibility indicators

### Desktop

Implement:

* permanent sidebar;
* three-column detail;
* full editor;
* table/list views.

### Tablet

Implement:

* collapsed sidebar;
* drawer context;
* responsive editor.

### Mobile

Implement:

* bottom navigation;
* capture sheet;
* card list;
* detail sheet.

### Acceptance criteria

User can:

```text
Capture
→ Save
→ Edit
→ Link CRM entity
→ Search
→ Open
→ Update
```

without leaving the Knowledge experience.

---

# 97. PHASE 1 — DESIGN SYSTEM DELIVERABLES

Build reusable:

```text
KnowledgeCard
KnowledgeEditor
EntityPicker
CaptureHUD
SearchBar
StatusBadge
TypeBadge
ContextPanel
AIPlaceholder
```

Establish tokens:

```text
Spacing
Typography
Radius
Elevation
Motion
Breakpoints
```

---

# 98. PHASE 2 — AI INTELLIGENCE

### UI deliverables

1. AI Assistant
2. AI classification
3. Summaries
4. Action extraction
5. Entity extraction
6. Related knowledge
7. Knowledge Inbox
8. AI review cards
9. Ask SmartSapp Knowledge

### Primary workflow

```text
Capture
↓
AI processing
↓
Suggested classification
↓
Suggested links
↓
Suggested actions
↓
Human review
```

---

# 99. PHASE 2 — AI UX ACCEPTANCE

AI must:

* explain suggestions;
* show confidence;
* show evidence;
* allow rejection;
* preserve user content;
* never silently modify important knowledge.

---

# 100. PHASE 3 — KNOWLEDGE GRAPH & RELATIONSHIPS

### UI deliverables

1. Graph Explorer
2. Graph Inspector
3. Relationship editor
4. Path finder
5. Focus mode
6. Evidence graph
7. Entity relationship visualization
8. Relationship timeline

### Core UX:

```text
Select object
↓
Show relationships
↓
Expand
↓
Explore connected knowledge
```

---

# 101. PHASE 3 — GRAPH MOBILE

Do not attempt feature parity with desktop canvas.

Provide:

```text
Focus node
↓
Relationship list
↓
Expand relationship
↓
Open object
```

---

# 102. PHASE 4 — IDEA INTELLIGENCE

### UI deliverables

1. Ideas Home
2. Idea Board
3. Idea Detail
4. Idea Canvas
5. Idea scoring
6. Evidence management
7. Hypothesis management
8. AI idea assistant
9. Experiment planning

Core journey:

```text
Knowledge
↓
Turn into idea
↓
Structure
↓
Gather evidence
↓
Validate
↓
Approve
↓
Implement
↓
Measure
```

---

# 103. PHASE 4 — IDEA CANVAS ACCEPTANCE

User must be able to:

* create node;
* connect node;
* edit node;
* delete node;
* convert node;
* attach evidence;
* ask AI;
* save;
* undo/redo;
* zoom;
* pan;
* open linked object.

---

# 104. PHASE 5 — INSIGHTS & DECISIONS

### UI deliverables

1. Insights Home
2. Insight Detail
3. Decision Center
4. Decision Detail
5. Evidence view
6. Contradiction UI
7. Recommendation UI
8. Knowledge Health dashboard

Core experience:

```text
Signal
↓
Insight
↓
Evidence
↓
Decision
↓
Action
```

---

# 105. PHASE 6 — CRM & CROSS-APP INTELLIGENCE

### UI deliverables

Knowledge becomes embedded across:

```text
Contacts
Leads
Schools
Deals
Meetings
Calls
Forms
Surveys
Messaging
Campaign Intelligence
Sales Intelligence
Lead Intelligence
```

Each integration must provide:

```text
View knowledge
Capture knowledge
Create insight
Create action
Ask AI
```

where contextually appropriate.

---

# 106. PHASE 6 — CAMPAIGN INTELLIGENCE UX

Knowledge should expose:

```text
Campaign opportunity
```

Campaign Intelligence should expose:

```text
Knowledge evidence
Customer signals
Historical campaign insights
```

Cross-product handoff must always preserve source provenance.

---

# 107. PHASE 7 — ADVANCED COLLABORATION

### UI deliverables

1. Presence
2. Comments
3. Mentions
4. Version history
5. Collaborative editor
6. Change history
7. Review workflows

Example:

```text
Sarah is editing...

Michael commented:
"Can we validate this with the enrollment team?"

[Reply]
```

---

# 108. PHASE 8 — AUTOMATION & INTELLIGENCE OPERATING SYSTEM

### UI deliverables

Knowledge-triggered automation builder.

Example:

```text
WHEN
new customer insight created

IF
confidence > 80%

THEN
create campaign opportunity
AND
notify marketing team
```

Visual builder should reuse SmartSapp's broader automation design language.

---

# 109. PHASE 8 — AI AGENT CONTROL CENTER

Admin/advanced users can see:

```text
Agents

Capture Agent
Classification Agent
Linking Agent
Evidence Agent
Idea Agent
Insight Agent
Campaign Agent
Action Agent
Governance Agent
```

Each agent:

```text
Status
Runs
Success rate
Errors
Last run
Permissions
Actions allowed
```

---

# 110. PHASE 9 — ENTERPRISE GOVERNANCE

### UI deliverables

* governance dashboard;
* retention policies;
* legal hold;
* restricted knowledge;
* audit logs;
* access review;
* AI usage logs;
* export controls;
* data residency configuration where supported.

---

# 111. PHASE 10 — OPTIMIZATION

Focus on:

```text
Search speed
Capture speed
AI latency
Mobile usability
Graph performance
Editor performance
Accessibility
Offline synchronization
```

Run usability testing around:

### Metric 1

Time from thought → saved knowledge.

### Metric 2

Time from question → useful answer.

### Metric 3

Time from insight → action.

### Metric 4

Knowledge retrieval success.

---

# 112. PHASE UX ROADMAP

| Phase | Primary UX Outcome              |
| ----- | ------------------------------- |
| 1     | Reliable Knowledge foundation   |
| 2     | AI-assisted organization        |
| 3     | Connected Knowledge Graph       |
| 4     | Structured Idea Intelligence    |
| 5     | Insights & Decisions            |
| 6     | CRM/Campaign intelligence layer |
| 7     | Collaboration                   |
| 8     | Automation & AI agents          |
| 9     | Enterprise governance           |
| 10    | Optimization & scale            |

---

# 113. DESIGN SYSTEM ARCHITECTURE

Recommended component hierarchy:

```text
Foundation
│
├── Typography
├── Colors
├── Spacing
├── Icons
├── Motion
└── Accessibility

Primitives
│
├── Buttons
├── Inputs
├── Cards
├── Tabs
├── Dialogs
└── Navigation

Knowledge
│
├── KnowledgeCard
├── KnowledgeEditor
├── KnowledgeTimeline
├── Evidence
└── Relations

Intelligence
│
├── AI Assistant
├── Insights
├── Recommendations
└── Confidence

Graph
│
├── Graph
├── Nodes
├── Edges
└── Inspector

Ideas
│
├── IdeaCard
├── IdeaBoard
├── IdeaCanvas
└── IdeaInspector

Integrations
│
├── CRMContext
├── CampaignContext
├── MeetingContext
└── SalesContext
```

---

# 114. VISUAL LANGUAGE

Knowledge types should be differentiated primarily by:

* icon;
* label;
* subtle surface treatment;
* semantic status.

Do not rely exclusively on color.

Example:

```text
📝 Note
💡 Idea
👁 Observation
💬 Customer Statement
❓ Question
🔎 Insight
⚖ Decision
⚡ Action
🧪 Experiment
```

---

# 115. INFORMATION DENSITY

Desktop:

High information density.

Tablet:

Medium density.

Mobile:

Low density with progressive disclosure.

Never shrink desktop UI until text becomes unreadable.

---

# 116. GLOBAL UX RULE

The user should never ask:

> “Where should I put this?”

SmartSapp should accept the information first and help organize it afterward.

---

# 117. SECOND GLOBAL UX RULE

The user should never ask:

> “Where did we discuss this?”

Ask SmartSapp Knowledge should provide the answer across authorized sources.

---

# 118. THIRD GLOBAL UX RULE

The user should never have to manually rebuild context.

If knowledge is associated with:

```text
Contact
School
Deal
Campaign
Meeting
Call
```

that context follows it across SmartSapp.

---

# 119. FOURTH GLOBAL UX RULE

AI should reduce cognitive work, not create additional review work.

Therefore:

```text
High-confidence + low-risk
→ lightweight confirmation

Low-confidence
→ explicit review

High-impact
→ explicit authorization
```

---

# 120. NORTH STAR UX

The ultimate experience is:

```text
A user has a thought.

Alt + N

They type:

"Several parents are asking whether we
can split the first term payment."

SmartSapp automatically detects:

Customer statement
Payment concern
Potential enrollment friction

It links the note to:
• relevant contacts
• school
• existing deal
• related knowledge

It finds:
18 similar statements

AI proposes:

Insight:
Payment flexibility is becoming a
recurring enrollment concern.

The user accepts.

SmartSapp suggests:

Idea:
Flexible Payment Enrollment Campaign

The user accepts.

The Idea Canvas opens with:

Problem
Evidence
Audience
Hypothesis
Solution

The user sends the campaign opportunity
to Campaign Intelligence.

Campaign Intelligence creates the strategy.

Campaign performance later returns to Knowledge.

The result becomes new evidence.

The organization gets smarter.
```

---

# 121. FINAL UX ARCHITECTURE

SmartSapp Knowledge & Idea Intelligence should therefore operate as:

```text
                    SMARTSAPP
                        │
        ┌───────────────┴────────────────┐
        │                                │
     CAPTURE                          SEARCH
        │                                │
        ▼                                ▼
   KNOWLEDGE OBJECTS              ASK SMARTSAPP
        │                                │
        ├──────────────┐                 │
        ▼              ▼                 │
 RELATIONSHIPS      EVIDENCE             │
        │              │                 │
        └──────┬───────┘                 │
               ▼                         │
         KNOWLEDGE GRAPH ◄───────────────┘
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
     IDEAS  INSIGHTS  DECISIONS
       │       │        │
       └───────┼────────┘
               ▼
             ACTION
               │
       ┌───────┴────────┐
       ▼                ▼
      CRM        CAMPAIGN INTELLIGENCE
       │                │
       └───────┬────────┘
               ▼
            OUTCOME
               │
               ▼
           NEW KNOWLEDGE
```

The UI should make this architecture feel like **one connected system**, even though technically it is composed of multiple domains.

The strategic goal is not to make SmartSapp users better at taking notes.

It is to make SmartSapp the place where an organization **captures what it knows, understands what it means, develops what it could do, records why decisions were made, and continuously turns organizational knowledge into action.**

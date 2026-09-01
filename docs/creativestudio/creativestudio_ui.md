# SmartSapp Creative Studio 2.0

# Professional UI/UX Architecture & Design System

**Product:** SmartSapp Creative Studio
**Version:** 2.0
**Surface:** SmartSapp CRM
**Primary Experience:** AI-native creative production
**Initial Experience:** Thumbnail Studio
**Design Goal:** Professional creative power without professional-tool complexity

---

# 1. UX NORTH STAR

## 1.1 The fundamental UX problem

Traditional creative applications expose the user to the machinery of design:

* layers
* frames
* vectors
* paths
* masks
* blending
* rulers
* panels
* properties
* artboards
* effects
* timelines
* complex menus

SmartSapp Creative Studio should expose the **outcome** instead.

Instead of:

> "Create a 1280 × 720 artboard and configure your layers."

The product should say:

> **What are you creating?**

**YouTube Thumbnail**

> **What are you promoting?**

**Our new enrollment campaign**

> **Who is it for?**

**School owners**

> **What's the message?**

**Get More Students**

Then:

> **Generate Concepts**

The professional editor remains available when needed, but it should not be the entry point for most users.

---

# 2. UX PRINCIPLES

## Principle 1 — Intent before tools

The interface should ask users what they want to accomplish before presenting advanced controls.

---

## Principle 2 — AI should remove work, not remove control

Every AI action should result in an editable design.

Never:

> AI generated image → flattened output

Prefer:

> AI generated concept → editable composition.

---

## Principle 3 — Progressive disclosure

Basic users see:

* Text
* Image
* Brand
* AI
* Layout
* Export

Advanced users can open:

* layers
* transforms
* constraints
* effects
* design tokens
* semantic roles
* advanced AI actions.

---

## Principle 4 — Context everywhere

The system should know:

* campaign
* audience
* content
* brand
* platform
* objective

without repeatedly asking the user.

---

## Principle 5 — One primary action per screen

Every major surface should have a clear dominant action.

Examples:

**Creative Home**

> Create Creative

**Project**

> Continue Editing

**AI Concept**

> Generate Concepts

**Review**

> Approve

**Publishing**

> Publish

---

# 3. INFORMATION ARCHITECTURE

Primary SmartSapp navigation:

```text
SMARTSAPP
│
├── CRM
├── Campaigns
├── Content
├── Creative Studio
│
│   ├── Home
│   ├── Projects
│   ├── Templates
│   ├── Assets
│   ├── Brand Studio
│   ├── AI Creative Director
│   ├── Reviews
│   ├── Publishing
│   ├── Experiments
│   ├── Performance
│   ├── Creative Intelligence
│   └── Automations
│
└── Settings
```

Creative Studio should feel like a **native SmartSapp product area**, not an externally bolted-on application.

---

# 4. CREATIVE STUDIO GLOBAL SHELL

Desktop:

```text
┌─────────────────────────────────────────────────────────────┐
│ SmartSapp │ Creative Studio     Search       Help   Avatar │
├───────────┬─────────────────────────────────────────────────┤
│           │                                                 │
│ Home      │                                                 │
│ Projects  │               APPLICATION                       │
│ Templates │                                                 │
│ Assets    │                                                 │
│ Brand     │                                                 │
│ Reviews   │                                                 │
│ Publish   │                                                 │
│ Experiments│                                                │
│ Performance│                                                │
│ Intelligence│                                               │
│           │                                                 │
│           │                                                 │
│ Settings  │                                                 │
└───────────┴─────────────────────────────────────────────────┘
```

---

# 5. NAVIGATION MODEL

## Desktop

Persistent left navigation.

## Tablet

Collapsed navigation rail.

## Mobile

Bottom navigation for the most important destinations:

```text
Home | Projects | Create | Assets | More
```

---

# 6. GLOBAL HEADER

Header elements:

### Left

SmartSapp logo

Creative Studio selector

### Centre

Global search

Placeholder:

> Search projects, templates, assets...

### Right

* AI Assistant
* Notifications
* Help
* Workspace selector
* User menu

---

# 7. GLOBAL SEARCH

Search should support:

```text
Projects
Templates
Assets
Brands
Campaigns
Creatives
People
```

AI semantic search should eventually support:

> "Find our best enrollment thumbnails."

> "Show creatives using parents and children."

> "Find last month's campaign graphics."

---

# 8. CREATIVE HOME

## Purpose

Home is the user's creative command centre.

---

## Screen structure

```text
Creative Studio

Good morning, Sarah.

What would you like to create?

[ + Create Creative ]

[ Ask AI to create something ]

------------------------------------------------

Continue Working

[Project] [Project] [Project]

------------------------------------------------

Needs Your Attention

3 creatives awaiting approval

------------------------------------------------

Recent Creatives

------------------------------------------------

Creative Performance

Top performing this week

------------------------------------------------

AI Recommendations
```

---

# 9. HOME — CREATE AREA

Large primary card:

### Create Creative

Subtext:

> Start from a template, your campaign, or an idea.

Actions:

```text
[YouTube Thumbnail]
[Social Post]
[Advertisement]
[Email Graphic]
[Custom]
```

---

# 10. QUICK CREATE

The user should not be forced through a large wizard.

Quick create opens a compact creation drawer:

```text
Create Creative

Format
[ YouTube Thumbnail ▼ ]

Purpose
[ Promote content ▼ ]

Campaign
[ Select campaign ]

[ Continue ]
```

---

# 11. AI CREATE

AI Create should support natural language.

Example:

> "Create a bold YouTube thumbnail promoting our school enrollment campaign. Target school owners. Use SmartSapp branding."

AI resolves:

* format
* campaign
* audience
* brand
* objective

and begins generation.

---

# 12. PROJECTS

Projects screen:

```text
Creative Projects

[+ New Creative]     [Search] [Filter] [Sort]

Tabs:

All | My Projects | Shared | In Review | Published | Archived

------------------------------------------------

Project cards
```

---

# 13. PROJECT CARD

Each card contains:

* preview
* project name
* type
* campaign
* status
* owner
* last updated
* collaborators
* performance indicator

Example:

```text
┌─────────────────────────┐
│                         │
│       PREVIEW           │
│                         │
├─────────────────────────┤
│ Get More Students       │
│ YouTube Thumbnail       │
│ Campaign: Enrollment    │
│ ● In Review             │
└─────────────────────────┘
```

---

# 14. PROJECT DETAIL

Project detail is the operational hub.

```text
Project Name

[Edit] [Share] [Review] [Publish]

Preview

Project Information

Campaign
Audience
Objective
Brand
Platform

Variants

Versions

Comments

Performance
```

---

# 15. PROJECT HEADER

Persistent actions:

```text
← Projects

Project Name

Draft ●

[Share]
[Review]
[Publish]
[•••]
```

The primary CTA changes based on state.

Draft:

> Continue Editing

In Review:

> View Review

Approved:

> Publish

Published:

> View Performance

---

# 16. PROJECT STATUS SYSTEM

Use clear visual status chips:

```text
Draft
In Review
Changes Requested
Approved
Scheduled
Published
Archived
```

Avoid relying on colour alone.

Every status should include:

* icon
* label
* tooltip

---

# 17. CREATION EXPERIENCE

The creation flow has five stages:

```text
1. Brief
2. Direction
3. Concepts
4. Edit
5. Publish
```

Progressive navigation:

```text
Brief ─── Direction ─── Concepts ─── Edit ─── Publish
```

The user may jump backward but should always understand where they are.

---

# 18. STAGE 1 — CREATIVE BRIEF

```text
What are you creating?

[YouTube Thumbnail]
[Social Graphic]
[Ad Creative]
[Email Graphic]
[Custom]
```

Then:

### Goal

```text
Awareness
Engagement
Traffic
Lead Generation
Conversion
Announcement
Education
```

---

# 19. STAGE 2 — CREATIVE CONTEXT

```text
What are you promoting?

[Campaign]
[Content]
[Offer]
[Product]
[Custom]
```

CRM context is automatically suggested.

Example:

> We found an active Enrollment Growth campaign.

[Use campaign]

---

# 20. AUDIENCE SELECTOR

```text
Who is this for?

[Existing Segment ▼]

Audience:
School Owners

Age:
26–60

Primary interest:
Student enrollment
```

AI can use this information to shape creative recommendations.

---

# 21. CREATIVE DIRECTION

Instead of forcing users to design from scratch:

```text
Choose a creative direction

[ Bold ]
High contrast, attention-focused

[ Premium ]
Clean and authoritative

[ Emotional ]
Human and story-driven

[ Minimal ]
Simple and focused

[ Curiosity ]
Question / intrigue driven

[ AI Suggest ]
Let SmartSapp recommend
```

---

# 22. CONCEPT GENERATION SCREEN

AI generates 3–5 concepts.

Each concept card contains:

```text
Preview

Concept:
"Transformation"

Headline:
"Get More Students"

Visual:
Happy students + school environment

Why it works:
Strong contrast and outcome-focused message

Creative Health:
92

[Open]
[Generate Variation]
```

---

# 23. CONCEPT COMPARISON

Users should be able to compare concepts side by side.

```text
Concept A      Concept B      Concept C

Preview        Preview        Preview

Strategy       Strategy       Strategy

Health 92      Health 88      Health 95

[Use]          [Use]          [Use]
```

---

# 24. THE EDITOR

The editor is the core professional surface.

It should deliberately resemble a **simplified professional creative application**, not a dense design suite.

---

# 25. EDITOR LAYOUT

```text
┌─────────────────────────────────────────────────────────────┐
│ ← Project   Saved ✓     Undo Redo    AI     Share Publish  │
├──────┬─────────────────────────────────────────────┬────────┤
│      │                                             │        │
│ TOOLS│                                             │        │
│      │                                             │        │
│  A   │                                             │ INSPECT│
│  T   │                 CANVAS                      │ OR     │
│  Img │                                             │        │
│  ◇   │                                             │        │
│  AI  │                                             │        │
│      │                                             │        │
├──────┴─────────────────────────────────────────────┴────────┤
│ Layers │ Pages │ Variants │ Comments │ AI │ Health │ Zoom   │
└─────────────────────────────────────────────────────────────┘
```

---

# 26. EDITOR TOP BAR

Left:

* Back
* project name
* status
* save state

Middle:

* undo
* redo
* zoom

Right:

* AI
* Share
* Review
* Export
* Publish

---

# 27. TOOL RAIL

Keep the initial tool rail extremely small.

```text
Select
Text
Image
Shape
Brand
AI
```

Advanced tools are nested.

For example:

**Shape**

opens:

* rectangle
* circle
* line
* arrow
* polygon

This prevents visual overload.

---

# 28. SELECT TOOL

Primary interaction.

Supports:

* click
* drag
* multi-select
* marquee
* keyboard navigation

Selected element displays:

* bounding box
* resize handles
* rotation handle
* contextual toolbar

---

# 29. CONTEXTUAL TOOLBAR

When text is selected:

```text
Font | Size | Weight | Align | Colour | AI Rewrite | More
```

When image selected:

```text
Crop | Replace | Remove BG | Adjust | AI | More
```

When group selected:

```text
Align | Distribute | Group | Ungroup | AI | More
```

This is one of the most important mechanisms for keeping the editor simple.

---

# 30. TEXT TOOL

Text insertion should offer presets:

```text
Headline
Subheadline
Body
CTA
Caption
```

rather than making users configure every property.

---

# 31. TEXT PRESETS

Example:

### Headline

Large, bold, high-contrast.

### CTA

Medium-weight, button-safe styling.

### Caption

Small supporting text.

Brand rules automatically influence presets.

---

# 32. IMAGE TOOL

Image options:

```text
Upload
Asset Library
AI Generate
Stock
CRM Content
```

After insertion:

```text
Crop
Position
Replace
Remove Background
Enhance
Describe
```

---

# 33. AI TOOL RAIL

AI should be represented as a first-class tool.

Clicking AI opens:

```text
AI Creative Director

What would you like to improve?

[ Rewrite ]
[ Improve Layout ]
[ Change Style ]
[ Generate Variation ]
[ Replace Image ]
[ Optimize ]
[ Ask Anything ]
```

---

# 34. RIGHT INSPECTOR

The inspector is contextual.

## When nothing is selected

Show:

```text
Design
Format
Brand
Background
Creative Health
```

## When an element is selected

Show:

```text
Position
Size
Appearance
Typography
Effects
AI
Accessibility
```

---

# 35. ADVANCED INSPECTOR

Advanced mode reveals:

```text
Transform
X
Y
W
H
Rotation

Constraints

Position
Lock aspect ratio
Responsive behaviour

Appearance

Opacity
Blend
Stroke
Shadow

Advanced
Semantic role
Element ID
AI metadata
```

---

# 36. LAYERS PANEL

Default:

```text
Layers

▼ Hero Group
   Headline
   Subject
   Badge

Logo
Background
```

Users should not have to understand layers to create a design.

Layers are primarily for advanced control.

---

# 37. SMART LAYERS

AI assigns semantic roles:

```text
Headline
Subject
CTA
Logo
Background
Decoration
```

This allows:

> "Move the subject to the right."

rather than:

> "Select layer 12."

---

# 38. CANVAS

The canvas should provide:

* responsive scaling
* rulers
* safe zones
* guides
* snapping
* alignment indicators
* zoom
* pan
* preview mode

---

# 39. SMART GUIDES

When moving an element:

```text
────────────
      ↑
  aligned
────────────
```

Show:

* centre
* edge
* spacing
* alignment

Avoid excessive guide lines.

---

# 40. SNAP SYSTEM

Snap options:

```text
☑ Canvas edges
☑ Centre
☑ Other elements
☑ Smart spacing
☑ Grid
```

Advanced users can configure snapping.

---

# 41. RESPONSIVE PREVIEW

The editor should offer:

```text
Desktop
Tablet
Mobile
```

For channel-specific creative formats, show the actual platform preview where feasible.

---

# 42. SAFE-ZONE PREVIEW

For YouTube thumbnails:

```text
┌──────────────────────────────┐
│                              │
│       SAFE CONTENT           │
│                              │
│                              │
│                              │
└──────────────────────────────┘
```

Platform warnings should appear non-intrusively.

---

# 43. BOTTOM DOCK

Tabs:

```text
Layers
Pages
Variants
Comments
AI
Health
```

The dock should be collapsible.

---

# 44. PAGES

Documents can contain multiple pages.

Example:

```text
Page 1 — Main
Page 2 — Mobile
Page 3 — Alternative
```

This becomes the foundation for multi-format creatives.

---

# 45. VARIANTS

Variants are visually grouped.

```text
Variant A
Variant B
Variant C
Variant D
```

Each inherits the source design but remains independently editable.

---

# 46. AI EDITING UX

AI should support natural language.

Input:

> "Make this look more premium."

The system returns:

```text
Suggested changes

✓ Increase whitespace
✓ Reduce decorative elements
✓ Change headline treatment
✓ Adjust colour hierarchy

[Preview Changes]

[Apply All]
```

---

# 47. AI ACTION PREVIEW

Never silently modify the design.

AI changes should be previewable.

```text
Before       After

[Preview]    [Preview]

Changes:
+ Larger headline
+ Darker background
+ Moved subject

[Apply]
[Reject]
```

---

# 48. AI COMMAND BAR

Global shortcut:

**⌘/Ctrl + K**

Opens:

```text
Ask Creative AI...

"Make this more professional"
"Create three alternatives"
"Fix the hierarchy"
"Make this work on mobile"
"Use our brand colours"
```

---

# 49. AI CHAT

The AI panel should remain contextual.

Example:

> **AI Creative Director**

> I noticed the headline is competing with the subject.

Actions:

**Fix hierarchy**

**Reduce headline**

**Show alternatives**

---

# 50. AI EXPLANATIONS

Recommendations should explain themselves.

Bad:

> "Score: 73."

Better:

> **Mobile readability is weak.**

> Your headline becomes difficult to read below approximately 30% of the current canvas size.

[Fix it]

---

# 51. CREATIVE HEALTH PANEL

```text
Creative Health

91 / 100

✓ Message clarity
✓ Contrast
✓ Brand
✓ Composition
⚠ Mobile readability
✓ Platform fit

[Improve All]
```

---

# 52. HEALTH DETAIL

Clicking:

> Mobile readability

opens:

```text
Mobile Readability

Score: 78

Problem:
Headline becomes difficult to scan at smaller sizes.

Recommendation:
Increase headline size by 12%.

[Apply]
```

---

# 53. BRAND HEALTH

```text
Brand Health

94 / 100

✓ Logo usage
✓ Colours
✓ Typography
✓ Tone

⚠ Secondary colour outside brand palette
```

---

# 54. ASSET LIBRARY

The asset library should feel closer to a **visual content library** than a file manager.

---

## Asset screen

```text
Assets

[Upload] [AI Generate] [Search]

All | Images | Videos | Logos | Fonts | AI Generated

------------------------------------------------

Filters

Campaign
Tag
Source
Date
Creator
Usage
```

---

# 55. ASSET CARD

```text
[IMAGE]

Students smiling

AI tags:
students
education
school
children

Used in:
4 creatives

[•••]
```

---

# 56. ASSET AI SEARCH

Search:

> "students in classroom"

The system uses semantic metadata.

---

# 57. BRAND STUDIO

Brand Studio:

```text
Brand Studio

Brand Kits

[SmartSapp Default]
[School Brand]
[Campaign Brand]

--------------------------------

Logo
Colours
Typography
Visual Style
AI Rules
```

---

# 58. BRAND KIT EDITOR

Sections:

```text
Identity
Colours
Typography
Imagery
Components
Voice
AI Rules
```

---

# 59. AI BRAND RULES

Example:

```text
Required:
Use primary logo on promotional creatives.

Recommended:
Use Poppins for headlines.

Avoid:
Using colours outside the approved palette.
```

---

# 60. TEMPLATE LIBRARY

Templates screen:

```text
Templates

Recommended for you

Trending

YouTube
Social
Ads
Education
Lead Generation

[Template]
[Template]
[Template]
```

---

# 61. TEMPLATE PREVIEW

Before using:

```text
Template Preview

[Large preview]

Designed for:
Lead Generation

Works well for:
Education
Campaigns

Creative Health:
91

[Use Template]
```

---

# 62. TEMPLATE CUSTOMIZATION

After selecting:

```text
Customize Template

Replace:
Headline
Image
Logo
CTA

AI can customize this template automatically.

[Customize with AI]
```

---

# 63. REVIEW CENTRE

```text
Reviews

Needs My Review
Sent by Me
Completed

--------------------------------

Enrollment Thumbnail
Sarah requested approval

[Open Review]
```

---

# 64. REVIEW EXPERIENCE

Reviewer sees:

```text
Creative

Version 12

[Preview]

Comments

John:
"Can we make the headline stronger?"

AI:
"Shortening the headline may improve mobile readability."

[Request Changes]
[Approve]
```

---

# 65. ANNOTATION UX

Users can click directly on the canvas to leave comments.

```text
      ● 1
        \
         "Move this slightly left."
```

Comments are anchored to elements whenever possible.

---

# 66. APPROVAL FLOW

Approval dialog:

```text
Approve Creative?

This will mark Version 12 as approved.

☑ Confirm brand compliance
☑ Confirm content
☑ Confirm destination

[Cancel] [Approve]
```

For sensitive workspaces, configurable approval requirements can be enforced.

---

# 67. PUBLISHING CENTRE

```text
Publishing

Scheduled
Published
Failed
Connections

[+ Schedule Creative]
```

---

# 68. PUBLISHING FLOW

```text
Publish Creative

1. Creative
2. Channel
3. Destination
4. Schedule
5. Confirm
```

---

# 69. CHANNEL SELECTOR

```text
Choose channels

☑ YouTube
☐ Instagram
☐ Facebook
☐ LinkedIn
☐ Website
☐ Email
```

Each channel displays requirements.

---

# 70. VALIDATION BEFORE PUBLISHING

Example:

```text
Ready to publish

✓ Format
✓ Dimensions
✓ Brand
✓ File size
✓ Destination

[Publish]
```

If errors exist:

```text
2 issues need attention

⚠ Instagram aspect ratio
⚠ Missing destination
```

---

# 71. PERFORMANCE CENTRE

Performance overview:

```text
Creative Performance

Impressions
Clicks
CTR
Engagement
Leads
Conversions
Revenue

--------------------------------

Top Creatives

--------------------------------

AI Insights
```

---

# 72. CREATIVE PERFORMANCE DETAIL

```text
Get More Students

Performance

CTR          8.4%
Clicks       4,210
Leads        184
Qualified    62
Deals        17
Revenue      GHS XXX,XXX

Variants

A   7.1%
B   9.3%
C   8.2%
```

---

# 73. CRM ATTRIBUTION VIEW

The interface should explicitly connect creative activity to business outcomes.

```text
Creative

↓ 4,210 clicks

↓ 184 leads

↓ 62 qualified leads

↓ 17 deals

↓ 8 won

↓ GHS XXX,XXX revenue
```

This is a major differentiator from standalone design tools.

---

# 74. EXPERIMENT CENTRE

```text
Experiments

Running
Completed
Draft

[+ New Experiment]
```

---

# 75. EXPERIMENT BUILDER

Step 1:

```text
Experiment Name
```

Step 2:

```text
Choose Variants

A
B
C
```

Step 3:

```text
Primary Metric

CTR
Conversions
Leads
Revenue
```

Step 4:

```text
Audience
Traffic allocation
```

Step 5:

```text
Launch
```

---

# 76. EXPERIMENT RESULTS

```text
Experiment: Enrollment Thumbnail Test

Winner

Variant B

CTR
+18%

Qualified Leads
+31%

Revenue
+24%

[Use Winner]
```

---

# 77. CREATIVE INTELLIGENCE

This should be a dedicated strategic surface.

```text
Creative Intelligence

Your creative performance this month

--------------------------------

What's Working

--------------------------------

Audience Insights

--------------------------------

Winning Patterns

--------------------------------

What to Create Next
```

---

# 78. AI INSIGHT CARD

```text
AI Insight

Short, high-contrast headlines are outperforming
long informational headlines in your enrollment campaigns.

Confidence: High

Based on:
17 creatives
42,000 impressions
184 leads

[Create More Like This]
```

---

# 79. "CREATE MORE LIKE THIS"

One-click action:

> Create 5 new concepts based on this winning pattern.

The system should inherit:

* strategy
* visual style
* audience
* channel
* brand
* successful structural attributes

but not blindly duplicate the original.

---

# 80. AUTOMATIONS

Creative Automation UI should resemble SmartSapp's existing automation philosophy.

```text
Trigger
   ↓
Condition
   ↓
AI Action
   ↓
Review
   ↓
Publish
```

---

# 81. CREATIVE AUTOMATION BUILDER

Example:

```text
WHEN
New campaign created

↓

AI
Generate 3 concepts

↓

Condition
Creative Health > 85

↓

Review
Request approval

↓

Publish
YouTube
```

---

# 82. SETTINGS

Creative Settings:

```text
General
Brand Defaults
AI
Credits
Storage
Publishing
Integrations
Permissions
Notifications
Audit Log
```

---

# 83. INTEGRATIONS

```text
Connected Channels

YouTube       Connected
Facebook      Connected
Instagram     Not connected
LinkedIn      Connected

[Connect]
```

---

# 84. AI CREDITS UI

Users need transparent usage information.

```text
AI Usage

2,430 / 5,000 credits

This month

Text       340
Vision     120
Images     1,220
Background 750

[View Usage]
```

Avoid technical token terminology for normal users.

---

# 85. ADVANCED AI USAGE

Admins can see:

```text
AI Operations

User
Operation
Credits
Estimated Cost
Date
```

---

# 86. RESPONSIVE ARCHITECTURE

The editor cannot simply be "desktop shrunk."

Different layouts are required.

---

# 87. BREAKPOINTS

Recommended:

```text
< 640px      Mobile
640–767px    Large Mobile
768–1023px   Tablet
1024–1279px  Small Desktop
1280–1535px  Desktop
1536px+      Large Desktop
```

---

# 88. MOBILE EXPERIENCE

Mobile should focus on:

* reviewing
* commenting
* quick editing
* AI actions
* publishing
* performance

Do not expose the entire desktop editor simultaneously.

---

# 89. MOBILE EDITOR

```text
┌─────────────────────────────┐
│ ←  Project       AI   ✓     │
├─────────────────────────────┤
│                             │
│                             │
│          CANVAS             │
│                             │
│                             │
├─────────────────────────────┤
│ Select Text Image AI More   │
└─────────────────────────────┘
```

Inspector becomes a bottom sheet.

---

# 90. MOBILE INTERACTION

Selected element:

```text
[ Edit ]

Bottom sheet:

Text
Size
Colour
AI
More
```

Use touch-friendly controls.

Minimum touch target:

**44 × 44 px**

---

# 91. TABLET

Tablet uses:

```text
Collapsed left rail
Canvas
Collapsible inspector
Bottom dock
```

It should support genuine editing rather than only review.

---

# 92. DESKTOP WIDTH STRATEGY

At 1280px:

* compact navigation
* canvas-first layout
* inspector 280–320px

At 1440px:

* full navigation
* canvas
* inspector

At 1920px:

* additional contextual information can appear without shrinking the canvas.

---

# 93. EDITOR STATE ARCHITECTURE

The editor should explicitly model its states.

```text
LOADING
READY
EDITING
SAVING
SAVED
UNSAVED
AI_PROCESSING
AI_PREVIEW
EXPORTING
REVIEWING
LOCKED
ERROR
OFFLINE
```

---

# 94. LOADING STATE

Avoid blank screens.

Use:

```text
Project skeleton
Canvas skeleton
Layer skeleton
Inspector skeleton
```

Then transition progressively.

---

# 95. SAVING STATE

Top bar:

```text
Saving...
```

Then:

```text
Saved ✓
```

Never interrupt editing while saving.

---

# 96. UNSAVED STATE

If network persistence fails:

```text
⚠ Changes saved locally

We'll retry automatically.

[Retry Now]
```

---

# 97. AI PROCESSING STATE

Avoid generic spinners.

Use:

```text
Creating your concepts...

Analysing your campaign
✓

Applying brand guidance
✓

Developing visual directions
●

Preparing editable designs
○
```

This makes AI latency understandable.

---

# 98. AI FAILURE

```text
We couldn't generate the design.

Your original design is safe.

Reason:
The image generation service is temporarily unavailable.

[Try Again]
[Use Existing Assets]
```

---

# 99. EMPTY STATES

Every major surface needs a purposeful empty state.

---

## Projects

> No creative projects yet.

> Create your first professional creative in minutes.

[Create Creative]

---

## Assets

> Your creative library is empty.

> Upload images or let AI create visuals for you.

[Upload] [Generate with AI]

---

## Templates

> Find a starting point for your next campaign.

[Browse Templates]

---

## Reviews

> Nothing needs your attention.

> You're all caught up.

---

## Experiments

> Turn creative ideas into measurable experiments.

[Create Experiment]

---

# 100. ERROR STATES

Errors should contain:

1. what happened
2. what is safe
3. what the user can do

Example:

```text
Publishing failed

Your creative is still saved.

YouTube rejected the upload.

[Reconnect YouTube]
[Retry]
```

---

# 101. OFFLINE EXPERIENCE

Editor should preserve local changes.

Banner:

```text
Offline

Your changes are being saved locally.
```

When connection returns:

```text
Back online

Syncing your changes...
```

---

# 102. CONFLICT RESOLUTION

If two people edit simultaneously:

```text
Newer version detected.

Your changes
Saved version

[Review Changes]
[Keep Mine]
[Use Latest]
[Create New Version]
```

Do not silently overwrite work.

---

# 103. COLLABORATION PRESENCE

Top bar:

```text
Sarah
John
Michael +2
```

Hover reveals:

> John is currently editing the headline.

---

# 104. NOTIFICATION SYSTEM

Notifications:

```text
Creative approved
Creative changes requested
You were mentioned
Publishing succeeded
Publishing failed
Experiment completed
AI generation complete
```

Notifications should deep-link directly to the relevant context.

---

# 105. TOAST SYSTEM

Use toasts for lightweight confirmation:

> Creative saved.

> Variant created.

> Comment resolved.

Never use toasts for critical failures that require action.

---

# 106. MODAL STRATEGY

Avoid modal overload.

Use:

### Modal

For:

* destructive actions
* irreversible confirmation
* complex creation

### Drawer

For:

* AI
* inspector
* publishing
* comments
* contextual settings

### Popover

For:

* formatting
* filters
* small settings

---

# 107. DESIGN SYSTEM

SmartSapp Creative Studio should inherit the broader SmartSapp design system but introduce creative-specific components.

---

# 108. TYPOGRAPHY

Use the established SmartSapp typography direction:

* Poppins
* Figtree
* Didact where appropriate

Recommended hierarchy:

```text
Display
Heading 1
Heading 2
Heading 3
Body
Body Small
Caption
Label
```

Do not use excessive typography sizes.

---

# 109. COLOUR SYSTEM

Primary SmartSapp brand:

**#3A86FF**

Use it primarily for:

* primary actions
* selected states
* links
* active controls

Creative Studio should not make every surface blue.

The editor itself should use restrained neutral surfaces so the creative canvas remains visually dominant.

---

# 110. BUTTON HIERARCHY

Primary:

**Create Creative**

Secondary:

**Preview**

Tertiary:

**Cancel**

Destructive:

**Delete**

AI:

**Generate with AI**

Do not make AI buttons visually compete with the primary workflow unnecessarily.

---

# 111. CARDS

Cards should be:

* moderately rounded
* low visual noise
* strong image preview
* clear metadata
* one primary action

Avoid excessive dashboard-card syndrome.

---

# 112. ICONOGRAPHY

Icons should communicate:

* action
* state
* category

Do not use icons without labels where the meaning is ambiguous.

---

# 113. ACCESSIBILITY

Minimum:

* WCAG 2.2 AA target
* keyboard navigation
* visible focus
* semantic controls
* screen-reader labels
* sufficient contrast
* reduced motion
* no colour-only communication

---

# 114. KEYBOARD SHORTCUTS

Core:

```text
⌘/Ctrl + Z      Undo
⌘/Ctrl + Shift + Z Redo
⌘/Ctrl + C      Copy
⌘/Ctrl + V      Paste
⌘/Ctrl + D      Duplicate
Delete          Delete
⌘/Ctrl + K      AI
Space           Pan
```

Advanced shortcuts should be discoverable rather than mandatory.

---

# 115. COMMAND PALETTE

**⌘/Ctrl + K**

```text
Search commands

Create text
Add image
Generate AI
Open assets
Show layers
Export
Publish
Open Creative Health
```

---

# 116. CONTEXT MENU

Right-click / long press:

```text
Duplicate
Delete
Bring Forward
Bring to Front
Send Back
Lock
Group
Copy
AI Actions
```

---

# 117. DRAG AND DROP

Supported:

* upload assets
* reorder layers
* insert templates
* rearrange variants
* move elements
* add images to canvas

---

# 118. UNDO/REDO UX

Undo must work at the command level.

Users should see:

> Undo Move Headline

rather than:

> Undo Action

This builds confidence.

---

# 119. VERSION HISTORY UX

Version drawer:

```text
Version History

v12   Approved
Sarah • 2 min ago

v11   Headline revised
John • 8 min ago

v10   AI Concept
SmartSapp AI • 14 min ago

v9    Initial
Sarah • 20 min ago
```

Actions:

**Preview**

**Restore**

**Duplicate**

---

# 120. EXPORT UX

```text
Export

Format
PNG
JPG
WebP

Quality
High

Dimensions
Original

[Export]
```

Advanced:

```text
2x
3x
Custom dimensions
Transparent background
```

---

# 121. AI EXPORT OPTIMIZATION

Before export:

> **AI Check**

```text
✓ Platform dimensions
✓ File size
✓ Readability
✓ Brand
```

---

# 122. DESIGN SYSTEM TOKENS

Creative Studio should use structured tokens:

```text
color.primary
color.surface
color.canvas
color.border
color.text
color.muted

spacing.xs
spacing.sm
spacing.md
spacing.lg
spacing.xl

radius.sm
radius.md
radius.lg

shadow.sm
shadow.md
shadow.lg
```

---

# 123. COMPONENT ARCHITECTURE

Core components:

```text
CreativeShell
CreativeHeader
CreativeSidebar
ProjectCard
CreativeCard
TemplateCard
AssetCard
CreativeCanvas
CanvasToolbar
CanvasElement
LayerPanel
InspectorPanel
AICommandBar
AIInsightCard
AIRecommendation
CreativeHealth
BrandHealth
ReviewPanel
CommentThread
VersionHistory
VariantPanel
ExperimentBuilder
PublishDrawer
PerformanceCard
```

---

# 124. DOMAIN COMPONENTS

Components should consume domain objects rather than duplicating business logic.

Example:

```text
<CreativeProjectCard project={project} />
```

rather than:

```text
<ThumbnailCard />
```

This preserves the generalized Creative Studio architecture.

---

# 125. STATE MANAGEMENT

Separate:

### UI state

* selected element
* active panel
* zoom
* modal
* inspector

### Editor state

* document
* elements
* history
* versions

### Server state

* projects
* assets
* reviews
* publications
* performance

### AI state

* generation
* streaming
* recommendations
* actions

This separation prevents the editor store from becoming a monolithic state object.

---

# 126. REAL-TIME STATE

Use real-time subscriptions for:

* comments
* presence
* reviews
* project updates
* publication status

Do not stream every mouse movement into Firestore.

High-frequency interaction remains local.

---

# 127. EDITOR PERFORMANCE UX

Large projects should not visually degrade.

Use:

* viewport rendering
* lazy asset loading
* image thumbnails
* caching
* debounced persistence
* background processing
* selective re-rendering

---

# 128. AI STREAMING UX

Text-based AI responses should stream where possible.

Instead of:

```text
Generating...
```

display:

```text
Headline ideas

Get More Students
Grow Your School
Fill Your Classrooms
...
```

---

# 129. AI IMAGE GENERATION UX

Generation should produce multiple concepts.

```text
Generate Image

Style:
[Photorealistic]

Subject:
[Students in classroom]

Mood:
[Positive]

[Generate 4]
```

Results:

```text
[1] [2] [3] [4]
```

User selects one.

---

# 130. AI REGENERATION

Never require the user to start again.

Actions:

```text
Regenerate
Make More Premium
Make More Emotional
Make Simpler
Make More Bold
Change Subject
Change Background
```

---

# 131. AI MEMORY

AI should understand project context during the session.

Example:

> "Use the second concept but keep the headline from the first."

The system understands both concepts.

---

# 132. CRM CONTEXT PANEL

Inside the editor:

```text
Campaign Context

Enrollment Growth

Objective:
Lead Generation

Audience:
School Owners

Offer:
Enrollment Growth Audit

CTA:
Book Consultation
```

This can be collapsed.

---

# 133. "DESIGN FROM CRM"

From a CRM campaign:

```text
Campaign

[Create Creative]

Choose:

YouTube
Social
Ad
Email
Landing Page
```

Creative Studio opens with campaign context already populated.

---

# 134. "CREATE FROM CONTENT"

From SmartSapp Content:

```text
Article / Video / Post

[Create Creative]

AI understands this content
and proposes creative directions.
```

---

# 135. "CREATE FROM DEAL"

For CRM-aware marketing workflows:

```text
Deal

[Create Sales Creative]
```

AI can use permitted deal context to produce relevant materials.

---

# 136. AI PERMISSION UX

If AI needs access to CRM data:

```text
SmartSapp AI wants to use:

Campaign
Audience
Content

[Allow for this project]
```

Users should understand what context is being used.

---

# 137. FIRST-TIME USER EXPERIENCE

First visit:

```text
Welcome to Creative Studio

Create professional marketing
creatives with AI.

[Create My First Creative]
```

Then guided setup:

```text
1. Choose brand
2. Choose objective
3. Choose format
4. Generate
```

Do not force users through a tutorial carousel.

---

# 138. CONTEXTUAL ONBOARDING

Instead of a 10-step product tour:

When user first opens editor:

> **Try this:** Click your headline and ask AI to improve it.

When opening Brand Studio:

> Add your brand colours so AI can keep your creatives consistent.

---

# 139. LEARNING MODE

Advanced features should reveal themselves progressively.

Example:

First use of layers:

> **Layers help you control individual parts of your design.**

[Got it]

No persistent instructional clutter.

---

# 140. PHASE 0 — UX DELIVERABLES

### Design

* Design system
* navigation
* component library
* accessibility foundation
* responsive framework
* editor information architecture

### Screens

* Creative Home
* Projects
* Create
* Project Detail
* Editor shell

### UX research

Test:

* terminology
* navigation
* creation flow
* AI mental model

---

# 141. PHASE 1 — UX DELIVERABLES

Build production:

* Projects
* Assets
* Brand Studio
* Version History
* Comments
* basic editor

### UX focus

Trust.

Users must always understand:

> Is my work saved?

> Who changed it?

> Can I recover it?

---

# 142. PHASE 2 — UX DELIVERABLES

Professional editor:

* multi-select
* layers
* groups
* guides
* snapping
* inspector
* keyboard shortcuts

### UX focus

Power without complexity.

---

# 143. PHASE 3 — UX DELIVERABLES

AI Creative Director:

* AI command bar
* AI panel
* concept generation
* AI edit previews
* AI image generation
* AI rewrite

### UX focus

Make AI feel like an expert collaborator.

---

# 144. PHASE 4 — UX DELIVERABLES

Creative Health:

* score
* issue list
* visual indicators
* recommendations
* fix actions

### UX focus

Explain, don't merely score.

---

# 145. PHASE 5 — UX DELIVERABLES

Templates:

* marketplace
* template search
* filters
* preview
* customization
* Brand Studio
* AI brand rules

### UX focus

Speed and consistency.

---

# 146. PHASE 6 — UX DELIVERABLES

CRM:

* campaign context
* content context
* audience context
* lead/deal attribution
* "Create Creative" entry points

### UX focus

Make CRM context feel automatic.

---

# 147. PHASE 7 — UX DELIVERABLES

Collaboration:

* comments
* mentions
* reviews
* approvals
* activity
* presence

### UX focus

Make team workflows feel natural.

---

# 148. PHASE 8 — UX DELIVERABLES

Publishing:

* channel selection
* connection management
* validation
* scheduling
* publication history

### UX focus

Confidence before publication.

---

# 149. PHASE 9 — UX DELIVERABLES

Experiments:

* variants
* experiment builder
* allocation
* results
* winner

### UX focus

Make experimentation understandable to non-analysts.

---

# 150. PHASE 10 — UX DELIVERABLES

Performance:

* creative metrics
* CRM attribution
* campaign comparison
* revenue

### UX focus

Connect creative to business results.

---

# 151. PHASE 11 — UX DELIVERABLES

Creative Intelligence:

* insights
* trends
* winning patterns
* audience intelligence
* recommendations

### UX focus

Turn analytics into decisions.

---

# 152. PHASE 12 — UX DELIVERABLES

Automation:

* triggers
* AI actions
* conditions
* approval
* publishing

### UX focus

Allow teams to automate repetitive creative production without losing governance.

---

# 153. PHASE-TO-SCREEN MATRIX

| Phase | Screens / Surfaces                               |
| ----- | ------------------------------------------------ |
| 0     | Shell, Design System, Editor Shell               |
| 1     | Home, Projects, Project Detail, Assets, Brand    |
| 2     | Advanced Editor, Layers, Inspector, Canvas Tools |
| 3     | AI Director, Concept Generator, AI Actions       |
| 4     | Creative Health, Brand Health, Platform Check    |
| 5     | Templates, Template Preview, Brand Studio        |
| 6     | Campaign Context, CRM Attribution                |
| 7     | Reviews, Comments, Activity, Approval            |
| 8     | Publishing, Scheduler, Connections               |
| 9     | Variants, Experiment Builder, Results            |
| 10    | Performance, Attribution                         |
| 11    | Creative Intelligence                            |
| 12    | Creative Automations                             |

---

# 154. CORE USER JOURNEY

The ideal user journey is:

```text
Campaign
 ↓
Create Creative
 ↓
AI understands campaign
 ↓
Generate Concepts
 ↓
Select Concept
 ↓
Edit
 ↓
AI Improve
 ↓
Creative Health
 ↓
Review
 ↓
Approve
 ↓
Publish
 ↓
Measure
 ↓
AI Insight
 ↓
Generate Better Variant
```

This should be the primary product loop.

---

# 155. BEGINNER JOURNEY

```text
Create
 ↓
Choose Template
 ↓
Replace Text/Image
 ↓
AI Improve
 ↓
Export
```

Five steps.

---

# 156. MARKETER JOURNEY

```text
Campaign
 ↓
Generate Concepts
 ↓
Select
 ↓
Generate Variants
 ↓
Approve
 ↓
Publish
 ↓
Track Leads
```

---

# 157. DESIGNER JOURNEY

```text
Project
 ↓
Professional Editor
 ↓
Layers
 ↓
Typography
 ↓
Brand
 ↓
AI Assistance
 ↓
Review
```

---

# 158. MANAGER JOURNEY

```text
Reviews
 ↓
Preview
 ↓
Comment
 ↓
Approve
 ↓
Performance
```

---

# 159. EXECUTIVE JOURNEY

```text
Creative Intelligence
 ↓
Performance
 ↓
Revenue
 ↓
What Works?
 ↓
What Should We Create Next?
```

---

# 160. AI-NATIVE UX LOOP

The AI experience should exist at every level:

```text
HOME
"Create something for me"

↓

PROJECT
"Help me develop the concept"

↓

EDITOR
"Improve this"

↓

HEALTH
"Fix these issues"

↓

PUBLISH
"Optimize for this platform"

↓

PERFORMANCE
"Why did this work?"

↓

INTELLIGENCE
"What should we create next?"
```

---

# 161. THE "AI DOES IT" RULE

When AI can safely perform multiple steps, present the workflow as one action.

Instead of:

```text
Generate image
Upload image
Remove background
Insert image
Resize
Position
```

Offer:

> **Create Subject**

The platform performs all six actions.

The user receives the editable result.

---

# 162. THE "SHOW ME" RULE

AI should prefer visual previews.

Instead of:

> "I recommend increasing contrast."

Show:

```text
Before | After
```

Whenever feasible.

---

# 163. THE "WHY" RULE

Every significant AI recommendation should answer:

1. What is wrong?
2. Why does it matter?
3. What will change?
4. Can I preview it?

---

# 164. THE "NEVER TRAP THE USER" RULE

Users must always be able to:

* undo
* reject AI
* restore versions
* recover deleted assets
* cancel generation
* exit workflows
* preserve original designs

---

# 165. PROFESSIONAL VS SIMPLE MODE

Creative Studio can eventually expose:

### Simple Mode

```text
Text
Image
AI
Brand
Export
```

### Advanced Mode

```text
Layers
Inspector
Constraints
Effects
Tokens
Semantic Roles
```

The product should remember the user's preference.

---

# 166. EDITOR DENSITY MODEL

Default:

**Low density**

Advanced:

**Medium density**

Expert:

**High density**

This allows one editor architecture to support different users.

---

# 167. DESIGN REVIEW CHECKLIST

Every screen must pass:

### Clarity

Can the user understand what this screen does within 5 seconds?

### Hierarchy

Is there one obvious primary action?

### Context

Does the user know where they are?

### Recovery

Can they undo or recover?

### Feedback

Does every important action produce visible feedback?

### Accessibility

Can keyboard and assistive technology users operate it?

---

# 168. AI REVIEW CHECKLIST

Every AI feature must answer:

```text
What did AI do?
Why did AI do it?
What data did AI use?
Can I preview it?
Can I undo it?
How much did it cost?
```

For normal users, cost information can remain secondary unless usage is relevant.

---

# 169. RESPONSIVE SCREEN MATRIX

| Surface        |       Mobile | Tablet |      Desktop |
| -------------- | -----------: | -----: | -----------: |
| Home           |            ✓ |      ✓ |            ✓ |
| Projects       |            ✓ |      ✓ |            ✓ |
| Project Detail |            ✓ |      ✓ |            ✓ |
| Assets         |            ✓ |      ✓ |            ✓ |
| Brand Studio   |            ✓ |      ✓ |            ✓ |
| Templates      |            ✓ |      ✓ |            ✓ |
| Editor         |   Simplified |   Full |         Full |
| AI Director    | Bottom sheet | Drawer |        Panel |
| Reviews        |            ✓ |      ✓ |            ✓ |
| Publishing     |            ✓ |      ✓ |            ✓ |
| Experiments    |  View/manage |      ✓ |         Full |
| Performance    |            ✓ |      ✓ |            ✓ |
| Intelligence   |            ✓ |      ✓ |            ✓ |
| Automations    |         View | Manage | Full builder |

---

# 170. MOBILE VS DESKTOP PRODUCT STRATEGY

Mobile is not a reduced desktop.

### Mobile is optimized for:

* review
* AI
* quick edits
* approvals
* publishing
* monitoring

### Desktop is optimized for:

* composition
* advanced editing
* asset management
* experimentation
* automation
* deep analytics

---

# 171. FUTURE EXTENSIBILITY

The UX architecture must support future creative types:

```text
Thumbnail
Social
Advertisement
Email
Landing Page
Presentation
Podcast
Video
Document
Infographic
```

The editor should therefore operate around:

**CreativeDocument**

rather than:

**ThumbnailDocument**.

---

# 172. FINAL UX ARCHITECTURE

The complete product becomes:

```text
                         CREATIVE STUDIO
                               │
                ┌──────────────┴──────────────┐
                │                             │
              CREATE                        MANAGE
                │                             │
       ┌────────┼────────┐          ┌─────────┼─────────┐
       │        │        │          │         │         │
     AI       Templates  CRM      Projects   Assets   Brand
       │        │        │
       └────────┼────────┘
                │
              EDIT
                │
       ┌────────┼─────────┐
       │        │         │
     Canvas    AI       Health
       │        │         │
       └────────┼─────────┘
                │
             REVIEW
                │
           APPROVAL
                │
            PUBLISH
                │
       ┌────────┼─────────┐
       │        │         │
     Channel  Schedule  Automate
       │
    PERFORMANCE
       │
   ATTRIBUTION
       │
 CREATIVE INTELLIGENCE
       │
    AI INSIGHTS
       │
 NEXT-BEST CREATIVE
       │
      CREATE
```

---

# 173. THE CORE PRODUCT LOOP

The most important UX loop should be:

> **Brief → AI Concept → Editable Design → Creative Health → Review → Publish → Performance → Intelligence → New Creative**

This is the loop that differentiates SmartSapp Creative Studio from a conventional design editor.

---

# 174. FINAL DESIGN DIRECTION

SmartSapp Creative Studio should feel:

**Professional**

* precise
* polished
* structured
* reliable

**Simple**

* low cognitive load
* progressive disclosure
* contextual controls
* guided workflows

**Intelligent**

* AI everywhere
* contextual recommendations
* automated optimisation
* business-aware intelligence

**CRM-native**

* campaigns
* audiences
* leads
* deals
* attribution

**Collaborative**

* comments
* approvals
* versions
* activity

**Performance-oriented**

* publishing
* experiments
* metrics
* revenue

The product should never feel like:

> "SmartSapp built a Canva/Figma clone."

It should feel like:

> **"SmartSapp understands what I'm trying to market, creates the creative with me, helps me improve it, gets it approved, publishes it, measures the result, and tells me what to create next."**

That should be the defining UX philosophy of Creative Studio 2.0.

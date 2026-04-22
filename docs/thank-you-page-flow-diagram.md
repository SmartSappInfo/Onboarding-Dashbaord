# Thank You Page System - Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SURVEY SYSTEM                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Survey Editor   │         │  Public Survey   │         │
│  │  (Admin)         │         │  (User-Facing)   │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                             │                    │
│           ▼                             ▼                    │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Results Configuration Step               │       │
│  ├─────────────────────────────────────────────────┤       │
│  │                                                  │       │
│  │  IF scoringEnabled = false:                     │       │
│  │  ┌────────────────────────────────────────┐    │       │
│  │  │  Thank You Page Builder                │    │       │
│  │  │  - Single page with blocks             │    │       │
│  │  │  - Default template                    │    │       │
│  │  │  - Submit Another button option        │    │       │
│  │  └────────────────────────────────────────┘    │       │
│  │                                                  │       │
│  │  IF scoringEnabled = true:                      │       │
│  │  ┌────────────────────────────────────────┐    │       │
│  │  │  Result Pages Builder                  │    │       │
│  │  │  - Multiple pages (score-based)        │    │       │
│  │  │  - Outcome logic rules                 │    │       │
│  │  │  - Submit Another button option        │    │       │
│  │  └────────────────────────────────────────┘    │       │
│  │                                                  │       │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## User Flow - Non-Scored Survey

```
┌─────────────┐
│   START     │
│  Survey     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Answer         │
│  Questions      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Click Submit   │
└──────┬──────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Show Thank You Page            │
│  ┌───────────────────────────┐  │
│  │  🎉 Thank You!            │  │
│  │                           │  │
│  │  We appreciate your       │  │
│  │  feedback!                │  │
│  │                           │  │
│  │  [Submit Another] ←─────┐ │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
       │                      │
       │                      │ Click
       │                      │
       ▼                      ▼
┌─────────────┐      ┌──────────────┐
│   END       │      │  Reset Form  │
└─────────────┘      │  Clear Data  │
                     │  Scroll Top  │
                     └──────┬───────┘
                            │
                            │ Loop back
                            ▼
                     ┌─────────────┐
                     │  Fresh Form │
                     └─────────────┘
```

## User Flow - Scored Survey

```
┌─────────────┐
│   START     │
│  Quiz       │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Answer         │
│  Questions      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Click Submit   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Calculate      │
│  Score          │
└──────┬──────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Match Score to Result Rule     │
│  (Priority-based)               │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Show Result Page               │
│  ┌───────────────────────────┐  │
│  │  🏆 Your Score: 85/100    │  │
│  │                           │  │
│  │  Great Job!               │  │
│  │  You scored in the        │  │
│  │  "Advanced" category      │  │
│  │                           │  │
│  │  [Take Quiz Again] ←────┐ │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
       │                      │
       │                      │ Click
       │                      │
       ▼                      ▼
┌─────────────┐      ┌──────────────┐
│   END       │      │  Reset Quiz  │
└─────────────┘      │  Clear Score │
                     │  Scroll Top  │
                     └──────┬───────┘
                            │
                            │ Loop back
                            ▼
                     ┌─────────────┐
                     │  Fresh Quiz │
                     └─────────────┘
```

## Editor UI - Results Step

### Non-Scored Survey View

```
╔═══════════════════════════════════════════════════════════╗
║  Results Configuration                                     ║
╠═══════════════════════════════════════════════════════════╣
║                                                            ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  ⚙️  Scoring Engine                              │    ║
║  │  ○ OFF  ● ON                                     │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                            ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  📄 Thank You Page Builder                       │    ║
║  ├──────────────────────────────────────────────────┤    ║
║  │                                                   │    ║
║  │  Block Palette:                                  │    ║
║  │  [Heading] [Text] [Image] [Button] [Divider]    │    ║
║  │  [Quote] [List] [Submit Another] ...            │    ║
║  │                                                   │    ║
║  │  ┌─────────────────────────────────────────┐    │    ║
║  │  │  Current Blocks:                        │    │    ║
║  │  │                                         │    │    ║
║  │  │  1. [Heading] Thank You!                │    │    ║
║  │  │  2. [Text] We appreciate your feedback  │    │    ║
║  │  │  3. [Divider] ─────────────────────     │    │    ║
║  │  │  4. [Submit Another] Submit Another     │    │    ║
║  │  │                                         │    │    ║
║  │  │  [+ Add Block]                          │    │    ║
║  │  └─────────────────────────────────────────┘    │    ║
║  │                                                   │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                            ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  👁️  Live Preview                                │    ║
║  │  ┌────────────────────────────────────────────┐ │    ║
║  │  │                                            │ │    ║
║  │  │         Thank You!                        │ │    ║
║  │  │                                            │ │    ║
║  │  │    We appreciate your feedback            │ │    ║
║  │  │                                            │ │    ║
║  │  │    ─────────────────────────────          │ │    ║
║  │  │                                            │ │    ║
║  │  │    [Submit Another Response]              │ │    ║
║  │  │                                            │ │    ║
║  │  └────────────────────────────────────────────┘ │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                            ║
╚═══════════════════════════════════════════════════════════╝
```

### Scored Survey View

```
╔═══════════════════════════════════════════════════════════╗
║  Results Configuration                                     ║
╠═══════════════════════════════════════════════════════════╣
║                                                            ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  ⚙️  Scoring Engine                              │    ║
║  │  ○ OFF  ● ON                                     │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                            ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  Tabs: [Outcome Logic] [Result Pages]           │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                            ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  🎯 Outcome Logic                                │    ║
║  ├──────────────────────────────────────────────────┤    ║
║  │                                                   │    ║
║  │  Rule 1: Low Score (0-50)    → Page: Beginner   │    ║
║  │  Rule 2: Medium Score (51-75) → Page: Intermediate│   ║
║  │  Rule 3: High Score (76-100) → Page: Advanced   │    ║
║  │                                                   │    ║
║  │  [+ Add Rule]                                    │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                            ║
║  ┌──────────────────────────────────────────────────┐    ║
║  │  📄 Result Pages                                 │    ║
║  ├──────────────────────────────────────────────────┤    ║
║  │                                                   │    ║
║  │  Page 1: Beginner                                │    ║
║  │  - [Score Card] Your Score                       │    ║
║  │  - [Heading] Keep Learning!                      │    ║
║  │  - [Text] You're on the right track...          │    ║
║  │  - [Submit Another] Try Again                    │    ║
║  │                                                   │    ║
║  │  Page 2: Intermediate                            │    ║
║  │  Page 3: Advanced                                │    ║
║  │                                                   │    ║
║  │  [+ Add Page]                                    │    ║
║  └──────────────────────────────────────────────────┘    ║
║                                                            ║
╚═══════════════════════════════════════════════════════════╝
```

## Block Type: Submit Another

```
┌─────────────────────────────────────────────────┐
│  Submit Another Button Block                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Configuration:                                 │
│  ┌────────────────────────────────────────────┐ │
│  │  Button Text: [Submit Another Response]   │ │
│  │                                            │ │
│  │  Reset Behavior:                           │ │
│  │  ● Full Reset (clear all data)            │ │
│  │  ○ Keep Session (maintain user context)   │ │
│  │                                            │ │
│  │  Style:                                    │ │
│  │  Variant: [Primary ▼]                     │ │
│  │  Size: [Medium ▼]                         │ │
│  │  Alignment: [● Left ○ Center ○ Right]     │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  Preview:                                       │
│  ┌────────────────────────────────────────────┐ │
│  │                                            │ │
│  │     [Submit Another Response]             │ │
│  │                                            │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Data Flow

```
Survey Creation/Edit
        │
        ▼
┌───────────────────┐
│  Set scoringEnabled│
└────────┬──────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
[FALSE]    [TRUE]
    │         │
    │         ▼
    │    ┌──────────────────┐
    │    │  Configure:      │
    │    │  - resultRules   │
    │    │  - resultPages   │
    │    │    (subcollection)│
    │    └──────────────────┘
    │
    ▼
┌──────────────────┐
│  Configure:      │
│  - thankYouPage  │
│    (inline)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Save to         │
│  Firestore       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Public Survey   │
│  Ready           │
└──────────────────┘
```

## Component Hierarchy

```
SurveyEditor
  └── ResultsStep
       ├── ScoringToggle
       │
       ├── [IF scoringEnabled = false]
       │   └── ThankYouPageBuilder
       │        ├── BlockPalette
       │        ├── BlockList
       │        │    └── BlockItem
       │        │         ├── BlockInspector
       │        │         └── BlockPreview
       │        └── LivePreview
       │
       └── [IF scoringEnabled = true]
            ├── Tabs
            │    ├── OutcomeLogic
            │    │    └── ResultRuleManager
            │    └── ResultPages
            │         └── ResultPageBuilder
            │              ├── BlockPalette (includes submit-another)
            │              ├── PageList
            │              └── LivePreview
            │
            └── LogicSimulator

PublicSurvey
  └── SurveyForm
       ├── QuestionPages
       └── CompletionView
            ├── [IF scoringEnabled = false]
            │   └── ThankYouPageRenderer
            │        └── BlockRenderer
            │             └── SubmitAnotherBlock
            │
            └── [IF scoringEnabled = true]
                 └── ResultPageRenderer
                      └── BlockRenderer
                           ├── ScoreCardBlock
                           └── SubmitAnotherBlock
```

---

These diagrams provide a visual understanding of the system architecture, user flows, and component relationships for the Thank You Page implementation.

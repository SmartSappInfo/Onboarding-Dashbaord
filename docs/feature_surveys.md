
# Feature: Intelligent Survey Engine

## 1. Overview

The Intelligent Survey Engine allows for the creation of multi-page, logic-driven assessments and feedback forms. It is powered by Generative AI for both creation and real-time design modification.

## 2. Core Capabilities

### AI-Powered Workflow
- **AI Architect**: Generates a complete survey structure (questions, sections, scoring, outcomes) from a text prompt or URL.
- **AI Design Partner**: A persistent chat-based editor that allows administrators to request architectural changes (e.g., "Add a section for pricing", "Make this scored") which the AI applies directly to the form state.

### Scoring & Outcomes
- **Dynamic Scoring**: Assign points to specific options.
- **Outcome Pages**: Full-page landings designed via a block-based builder (Heading, Text, Video, Score Card, Quote).
- **Threshold Logic**: Map score ranges to specific outcome pages.

### Navigation & Logic
- **Logic Blocks**: `Jump`, `Show/Hide`, `Require`, and `Disable Submit` actions based on conditional evaluation.
- **Multi-Page Stepper**: Automatically generates a progress stepper with "Strict Validation" mode (validate before next).
- **Auto-Advance**: Questions of type `multiple-choice` or `yes-no` can trigger automatic transitions to the next page.

---

## 3. Data Model Enhancements

### Survey Schema
- `scoringEnabled`: Boolean toggle for assessment mode.
- `resultRules`: Array of logic mapping scores to page IDs.
- `backgroundPattern`: Branded visual styling synchronized with PDF forms.
- `automationMessagingEnabled`: Trigger dispatches via the Messaging Engine upon completion.

---

## 4. Analytics & Insights
- **Analytics View**: Visual breakdown of every question with automated "AI Insights" generated from data trends.
- **Interactive AI Analysis**: Chat with the data. Ask natural language questions (e.g., "What are the common complaints?") and get HTML-formatted responses.
- **History**: All AI analyses are saved to a persistent summary history.

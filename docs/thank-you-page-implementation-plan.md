# Thank You Page Implementation Plan

## Overview

This document outlines the implementation of a flexible Thank You Page system for surveys, with support for both scored and non-scored surveys.

## Current State Analysis

### Existing Structure
- **Scored Surveys**: Use `resultPages` subcollection with `resultRules` for score-based routing
- **Non-Scored Surveys**: Use simple `thankYouTitle` and `thankYouDescription` fields
- **Result Pages**: Built with `SurveyResultBlock[]` supporting various block types

### Current Block Types
- `heading`, `text`, `image`, `video`, `button`, `quote`, `divider`, `score-card`, `list`, `logo`, `header`, `footer`

## Proposed Changes

### 1. Data Model Updates

#### Survey Interface (src/lib/types.ts)
```typescript
export interface Survey {
  // ... existing fields ...
  
  // NEW: Thank You Page Configuration
  thankYouPageEnabled?: boolean; // Default: true for non-scored, false for scored
  thankYouPage?: ThankYouPage; // Replaces simple thankYouTitle/Description
  
  // DEPRECATED (keep for backward compatibility)
  thankYouTitle?: string;
  thankYouDescription?: string;
}

export interface ThankYouPage {
  id: string;
  name: string;
  blocks: SurveyResultBlock[]; // Reuse existing block system
}
```

#### New Block Type: Submit Another Button
```typescript
export interface SurveyResultBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'quote' | 'divider' | 
        'score-card' | 'list' | 'logo' | 'header' | 'footer' | 'submit-another'; // NEW
  
  // ... existing fields ...
  
  // NEW: For submit-another block
  resetBehavior?: 'full' | 'keep-session'; // full = clear all data, keep-session = maintain user context
}
```

### 2. UI/UX Flow

#### Survey Editor - Results Step

**When Scoring is DISABLED:**
```
┌─────────────────────────────────────────┐
│  Results Configuration                   │
├─────────────────────────────────────────┤
│                                          │
│  ⚠️ Scoring Engine: OFF                 │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Thank You Page Builder            │ │
│  │                                    │ │
│  │  [Default Template]                │ │
│  │  - Heading: "Thank you!"           │ │
│  │  - Text: "We appreciate..."        │ │
│  │  - Button: "Submit Another"        │ │
│  │                                    │ │
│  │  [+ Add Block]                     │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Preview: [Live Preview Pane]           │
└─────────────────────────────────────────┘
```

**When Scoring is ENABLED:**
```
┌─────────────────────────────────────────┐
│  Results Configuration                   │
├─────────────────────────────────────────┤
│                                          │
│  ✅ Scoring Engine: ON                  │
│                                          │
│  Tabs: [Outcome Logic] [Result Pages]   │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Outcome Logic                     │ │
│  │  - Score ranges                    │ │
│  │  - Result page mapping             │ │
│  │  - Priority rules                  │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Result Pages                      │ │
│  │  - Page 1: Low Score               │ │
│  │  - Page 2: Medium Score            │ │
│  │  - Page 3: High Score              │ │
│  │  - Each can have "Submit Another"  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 3. Component Structure

#### New Components

**ThankYouPageBuilder.tsx**
```typescript
// Similar to ResultPageBuilder but simplified for single page
// Located: src/app/admin/surveys/components/thank-you-page-builder.tsx

interface ThankYouPageBuilderProps {
  // Uses react-hook-form context
  // Manages thankYouPage.blocks array
}

Features:
- Block palette (all block types including submit-another)
- Drag-and-drop reordering
- Block inspector for editing
- Live preview
- Default template generation
```

**SubmitAnotherBlock.tsx**
```typescript
// Block component for "Submit Another" button
// Located: src/app/surveys/components/blocks/submit-another-block.tsx

interface SubmitAnotherBlockProps {
  block: SurveyResultBlock;
  onSubmitAnother: () => void;
}

Features:
- Customizable button text
- Reset behavior options
- Styling options
- Animation on click
```

#### Modified Components

**results-step.tsx**
- Add conditional rendering based on `scoringEnabled`
- Show ThankYouPageBuilder when scoring is OFF
- Show existing ResultRuleManager + ResultPageBuilder when scoring is ON

**result-page-builder.tsx**
- Add "submit-another" to block palette
- Handle submit-another block rendering in preview

**survey-form.tsx** (public-facing)
- Handle "Submit Another" button click
- Reset form state
- Clear session data (optional)
- Scroll to top
- Show fresh form

### 4. Default Templates

#### Non-Scored Survey Default
```typescript
const DEFAULT_THANK_YOU_PAGE: ThankYouPage = {
  id: 'default-thank-you',
  name: 'Thank You Page',
  blocks: [
    {
      id: 'heading-1',
      type: 'heading',
      title: 'Thank You!',
      variant: 'h1',
      style: { textAlign: 'center' }
    },
    {
      id: 'text-1',
      type: 'text',
      content: 'We appreciate you taking the time to complete this survey. Your feedback is valuable to us.',
      style: { textAlign: 'center' }
    },
    {
      id: 'divider-1',
      type: 'divider'
    },
    {
      id: 'submit-another-1',
      type: 'submit-another',
      title: 'Submit Another Response',
      resetBehavior: 'full',
      style: { textAlign: 'center' }
    }
  ]
};
```

#### Scored Survey Result Page (Optional Submit Another)
```typescript
// Can be added to any result page
{
  id: 'submit-another-1',
  type: 'submit-another',
  title: 'Take the Quiz Again',
  resetBehavior: 'full',
  style: { textAlign: 'center' }
}
```

### 5. Migration Strategy

#### Backward Compatibility
```typescript
// In survey loading logic
function loadSurvey(surveyData: any): Survey {
  // If old format (thankYouTitle/Description exists but no thankYouPage)
  if ((surveyData.thankYouTitle || surveyData.thankYouDescription) && !surveyData.thankYouPage) {
    surveyData.thankYouPage = {
      id: 'migrated-thank-you',
      name: 'Thank You Page',
      blocks: [
        {
          id: 'heading-1',
          type: 'heading',
          title: surveyData.thankYouTitle || 'Thank You!',
          variant: 'h1',
          style: { textAlign: 'center' }
        },
        {
          id: 'text-1',
          type: 'text',
          content: surveyData.thankYouDescription || 'We appreciate your feedback.',
          style: { textAlign: 'center' }
        }
      ]
    };
  }
  
  return surveyData;
}
```

### 6. Implementation Phases

#### Phase 1: Data Model & Types
- [ ] Update Survey interface with thankYouPage field
- [ ] Add submit-another block type
- [ ] Update firestore-utils with defaults
- [ ] Update AI schemas for survey generation

#### Phase 2: Thank You Page Builder
- [ ] Create ThankYouPageBuilder component
- [ ] Add to results-step.tsx with conditional rendering
- [ ] Implement block palette with submit-another
- [ ] Add live preview

#### Phase 3: Submit Another Block
- [ ] Create SubmitAnotherBlock component
- [ ] Add to result-page-builder block palette
- [ ] Implement reset logic in survey-form.tsx
- [ ] Add animations and UX polish

#### Phase 4: Public-Facing Integration
- [ ] Update survey-form.tsx to show thankYouPage
- [ ] Handle submit-another button clicks
- [ ] Implement form reset logic
- [ ] Test session management

#### Phase 5: Migration & Testing
- [ ] Implement backward compatibility
- [ ] Migrate existing surveys
- [ ] E2E testing
- [ ] Documentation

### 7. File Structure

```
src/
├── lib/
│   ├── types.ts (UPDATE: Add ThankYouPage, submit-another type)
│   └── firestore-utils.ts (UPDATE: Add defaults)
├── app/
│   ├── admin/surveys/components/
│   │   ├── thank-you-page-builder.tsx (NEW)
│   │   ├── results-step.tsx (UPDATE: Conditional rendering)
│   │   ├── result-page-builder.tsx (UPDATE: Add submit-another)
│   │   └── add-result-block-modal.tsx (UPDATE: Add submit-another)
│   └── surveys/
│       ├── components/
│       │   └── blocks/
│       │       └── submit-another-block.tsx (NEW)
│       └── [slug]/components/
│           └── survey-form.tsx (UPDATE: Handle reset)
└── ai/
    └── schemas/
        └── survey-schemas.ts (UPDATE: Add thankYouPage schema)
```

### 8. User Experience Flow

#### Non-Scored Survey
1. User completes survey
2. Submits form
3. Sees custom Thank You Page with blocks
4. (Optional) Clicks "Submit Another"
5. Form resets, user can submit again

#### Scored Survey
1. User completes quiz
2. Submits form
3. Score is calculated
4. Routed to appropriate result page based on score
5. Sees score card + custom content
6. (Optional) Clicks "Submit Another" to retake quiz

### 9. Configuration Options

#### Survey Settings
```typescript
// In survey editor
{
  scoringEnabled: boolean; // Toggle between scored/non-scored
  
  // When scoringEnabled = false
  thankYouPageEnabled: boolean; // Show thank you page vs redirect
  thankYouPage: ThankYouPage; // Custom page builder
  
  // When scoringEnabled = true
  resultRules: SurveyResultRule[]; // Score-based routing
  // resultPages stored in subcollection
}
```

#### Submit Another Block Settings
```typescript
{
  type: 'submit-another',
  title: string; // Button text
  resetBehavior: 'full' | 'keep-session';
  style: {
    variant: 'default' | 'primary' | 'secondary';
    size: 'sm' | 'md' | 'lg';
    textAlign: 'left' | 'center' | 'right';
  }
}
```

### 10. Testing Checklist

- [ ] Non-scored survey shows Thank You Page builder
- [ ] Scored survey shows Result Pages builder
- [ ] Submit Another button appears in block palette
- [ ] Submit Another button works in preview
- [ ] Submit Another resets form correctly
- [ ] Session data handled properly
- [ ] Backward compatibility with old surveys
- [ ] AI generation includes thankYouPage
- [ ] Mobile responsive
- [ ] Accessibility compliant

## Benefits

1. **Unified System**: Same block builder for both thank you pages and result pages
2. **Flexibility**: Users can customize thank you pages with rich content
3. **Reusability**: Submit Another button works in both contexts
4. **Backward Compatible**: Existing surveys continue to work
5. **Better UX**: Clear separation between scored and non-scored flows
6. **Extensible**: Easy to add new block types in the future

## Technical Considerations

1. **State Management**: Use react-hook-form for consistent form handling
2. **Data Storage**: thankYouPage stored inline, resultPages in subcollection
3. **Performance**: Lazy load block components
4. **Validation**: Ensure at least one block in thank you page
5. **SEO**: Thank you pages should be indexable if public

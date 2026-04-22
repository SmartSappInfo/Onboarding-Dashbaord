# Thank You Page System - Executive Summary

## Problem Statement

Currently, non-scored surveys only have simple `thankYouTitle` and `thankYouDescription` text fields, while scored surveys have a rich result page builder. This creates an inconsistent experience and limits customization for non-scored surveys.

## Proposed Solution

Implement a unified Thank You Page system that:

1. **For Non-Scored Surveys**: Replace simple text fields with a full page builder (same as result pages)
2. **For Scored Surveys**: Keep existing result pages but add "Submit Another" button option
3. **New Block Type**: Add "Submit Another" button block that resets the form for fresh submissions

## Key Features

### 1. Conditional UI Based on Scoring

**Scoring OFF** → Show Thank You Page Builder
- Single page with block builder
- Default template with heading, text, and "Submit Another" button
- Full customization with all block types

**Scoring ON** → Show Result Pages Builder (existing)
- Multiple pages based on score ranges
- Score card display
- Optional "Submit Another" button on any page

### 2. Submit Another Button Block

**Functionality:**
- Resets form to initial state
- Clears session data
- Allows multiple submissions
- Smooth animation and UX

**Configuration:**
- Custom button text
- Reset behavior (full reset vs keep session)
- Styling options (variant, size, alignment)

**Available In:**
- Thank You Page builder (non-scored)
- Result Page builder (scored)

### 3. Unified Block System

Both Thank You Pages and Result Pages use the same block types:
- `heading`, `text`, `image`, `video`, `button`, `quote`, `divider`
- `score-card` (scored only), `list`, `logo`, `header`, `footer`
- `submit-another` (NEW - works in both)

## Implementation Approach

### Phase 1: Foundation (Data Model)
- Add `thankYouPage: ThankYouPage` field to Survey interface
- Add `submit-another` block type
- Update defaults and utilities

### Phase 2: Builder UI
- Create `ThankYouPageBuilder` component
- Update `results-step.tsx` with conditional rendering
- Add "Submit Another" to block palettes

### Phase 3: Public-Facing
- Update survey form to render thankYouPage
- Implement form reset logic
- Handle "Submit Another" clicks

### Phase 4: Polish & Migration
- Backward compatibility for existing surveys
- Testing and bug fixes
- Documentation

## User Experience

### Survey Creator Flow

1. Create/edit survey
2. Go to Results step
3. **If scoring is OFF:**
   - See "Thank You Page Builder"
   - Customize with blocks
   - Add "Submit Another" button if desired
4. **If scoring is ON:**
   - See "Outcome Logic" and "Result Pages" tabs
   - Configure score ranges and pages
   - Optionally add "Submit Another" to any result page

### Survey Taker Flow

1. Complete survey
2. Submit
3. **Non-scored:** See custom Thank You Page
4. **Scored:** See result page based on score
5. **Optional:** Click "Submit Another" to retake

## Benefits

✅ **Consistency**: Same powerful builder for all surveys
✅ **Flexibility**: Rich customization for thank you pages
✅ **Reusability**: Submit Another works everywhere
✅ **Backward Compatible**: Existing surveys unaffected
✅ **Better UX**: Clear separation of scored vs non-scored
✅ **Extensible**: Easy to add new features

## Technical Highlights

- **Reuses existing code**: Leverages ResultPageBuilder architecture
- **Type-safe**: Full TypeScript support
- **Form-integrated**: Uses react-hook-form for state management
- **Performant**: Lazy loading and optimized rendering
- **Accessible**: WCAG compliant components

## Migration Strategy

Existing surveys with `thankYouTitle` and `thankYouDescription` will automatically migrate to the new format:

```typescript
// Old format
{
  thankYouTitle: "Thank you!",
  thankYouDescription: "We appreciate your feedback."
}

// Auto-migrates to
{
  thankYouPage: {
    blocks: [
      { type: 'heading', title: "Thank you!" },
      { type: 'text', content: "We appreciate your feedback." }
    ]
  }
}
```

## Files to Create/Modify

### New Files (3)
- `src/app/admin/surveys/components/thank-you-page-builder.tsx`
- `src/app/surveys/components/blocks/submit-another-block.tsx`
- `docs/thank-you-page-implementation-plan.md`

### Modified Files (6)
- `src/lib/types.ts` - Add ThankYouPage interface
- `src/lib/firestore-utils.ts` - Add defaults
- `src/app/admin/surveys/components/results-step.tsx` - Conditional rendering
- `src/app/admin/surveys/components/result-page-builder.tsx` - Add submit-another
- `src/app/surveys/[slug]/components/survey-form.tsx` - Handle reset
- `src/ai/schemas/survey-schemas.ts` - Update AI schemas

## Estimated Effort

- **Phase 1 (Foundation)**: 2-3 hours
- **Phase 2 (Builder UI)**: 4-5 hours
- **Phase 3 (Public-Facing)**: 3-4 hours
- **Phase 4 (Polish)**: 2-3 hours

**Total**: ~12-15 hours of development time

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Iterative development with testing
4. Deploy and monitor

## Questions to Consider

1. Should "Submit Another" track multiple submissions from same user?
2. Should there be a limit on number of resubmissions?
3. Should we add analytics for "Submit Another" usage?
4. Should we allow conditional display of "Submit Another" based on answers?

---

**Status**: ✅ Plan Complete - Ready for Implementation
**Last Updated**: 2026-04-22

# Page Builder: Implementation TODO

## Overview

This document provides actionable next steps to bridge the gap between the current page builder implementation and the original vision. Tasks are organized by sprint with estimated effort and priority.

## Current Status

**Foundation:** ✅ Complete (Block registry, theme system, templates)  
**Features:** 🟡 40% Complete  
**Production Ready:** ❌ No (Forms don't work)  

## Critical Path to Production

```
Sprint 1 (Forms) → Sprint 2 (Personalization) → Sprint 3 (Conversion Blocks) → PRODUCTION READY
```

---

## 🔴 Sprint 1: Make Forms Work (2-3 weeks)

**Goal:** Functional lead capture system

**Priority:** P0 - BLOCKING PRODUCTION USE

### Task 1.1: Form Submission Backend
**Effort:** 3-4 days

**Files to Create:**
- [ ] `src/lib/page-builder-actions.ts` - Server actions for form submission
- [ ] `src/lib/page-builder/form-processor.ts` - Form data processing logic
- [ ] `src/lib/page-builder/__tests__/form-processor.test.ts` - Unit tests

**Implementation Steps:**
1. Create `submitPageFormAction()` server action
   ```typescript
   export async function submitPageFormAction(data: {
     pageId: string;
     formData: Record<string, unknown>;
     source: { utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string };
   }): Promise<{ success: boolean; submissionId?: string; error?: string }>;
   ```

2. Implement server-side validation
   - Required field checks
   - Email format validation
   - Phone number format
   - Max length enforcement

3. Store in `page_submissions` collection
   ```typescript
   interface PageSubmission {
     id: string;
     pageId: string;
     campaignId?: string;
     workspaceId: string;
     entityId?: string;
     submissionType: 'form' | 'registration' | 'signup';
     data: Record<string, unknown>;
     source: { utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string };
     createdAt: string;
   }
   ```

4. Add Firestore security rules
   - Public write allowed with rate limiting
   - Admin read/write for workspace users

**Success Criteria:**
- Form submissions persist to Firestore
- Server-side validation works
- Error messages display correctly

### Task 1.2: CRM Integration
**Effort:** 4-5 days

**Files to Create:**
- [ ] `src/lib/page-builder/crm-integration.ts` - Entity creation from forms
- [ ] `src/lib/page-builder/__tests__/crm-integration.test.ts` - Unit tests

**Implementation Steps:**
1. Create entity from form submission
   ```typescript
   export async function createEntityFromFormSubmission(
     submission: PageSubmission,
     config: {
       entityType: 'person' | 'family' | 'institution';
       workspaceId: string;
       organizationId: string;
       fieldMapping: Record<string, string>; // form field → entity field
       tags?: string[]; // tags to apply
       pipelineId?: string; // pipeline to add to
       stageId?: string; // initial stage
     }
   ): Promise<{ success: boolean; entityId?: string; error?: string }>;
   ```

2. Implement field mapping
   - Map form fields to entity fields
   - Handle custom fields
   - Support nested data (family → children)

3. Duplicate detection
   - Check email/phone before creating
   - Option to update existing or create new
   - Configurable duplicate strategy

4. Tag assignment
   - Apply tags configured in form block
   - Support dynamic tags from form data

**Success Criteria:**
- Form submission creates Person/Family/Institution
- Duplicate detection prevents duplicates
- Tags are applied correctly
- Entity appears in CRM immediately


### Task 1.3: Success States
**Effort:** 2-3 days

**Files to Modify:**
- [ ] `src/lib/page-builder/blocks/form.tsx` - Add success state UI
- [ ] `src/components/page-builder/embeds/EmbeddedForm.tsx` - Handle submission response

**Implementation Steps:**
1. Success message display
   - Show thank you message
   - Display submission details
   - Option to submit another form

2. Redirect on success
   - Redirect to URL after submit
   - Support query params
   - Track conversion in analytics

3. Email confirmation
   - Send confirmation email to submitter
   - Configurable template
   - Include submission details

4. Loading states
   - Spinner during submission
   - Disable form during processing
   - Error retry mechanism

**Success Criteria:**
- Success message displays after submit
- Redirect works correctly
- Confirmation email sent
- Form disabled during submission

### Task 1.4: Basic Analytics
**Effort:** 2-3 days

**Files to Create:**
- [ ] `src/lib/page-builder/analytics.ts` - Analytics tracking functions
- [ ] `src/app/admin/pages/[id]/analytics/page.tsx` - Analytics dashboard

**Implementation Steps:**
1. Track page views
   ```typescript
   export async function trackPageView(params: {
     pageId: string;
     sessionId: string;
     referrer?: string;
     utmSource?: string;
     utmMedium?: string;
     utmCampaign?: string;
     deviceType: 'desktop' | 'mobile' | 'tablet';
   }): Promise<void>;
   ```

2. Track form submissions
   - Count successful submissions
   - Calculate conversion rate
   - Group by source/medium

3. Create `page_events` collection
   ```typescript
   interface PageEvent {
     id: string;
     pageId: string;
     eventType: 'view' | 'cta_click' | 'form_start' | 'form_submit';
     sessionId: string;
     metadata: Record<string, unknown>;
     createdAt: string;
   }
   ```

4. Simple analytics dashboard
   - Total views
   - Total submissions
   - Conversion rate
   - Top sources

**Success Criteria:**
- Page views tracked
- Submission events tracked
- Analytics dashboard displays metrics
- No PII exposed in events

---


## 🟠 Sprint 2: Personalization & Tracking (2 weeks)

**Goal:** Dynamic content and campaign attribution

**Priority:** P1 - REQUIRED FOR FULL CAMPAIGN BUILDER

### Task 2.1: Query String Personalization
**Effort:** 3-4 days

**Files to Modify:**
- [ ] `src/app/p/[slug]/page.tsx` - Parse query params
- [ ] `src/components/page-builder/PageRenderer.tsx` - Inject personalization
- [ ] `src/lib/page-builder/personalization.ts` - New file for personalization logic

**Implementation Steps:**
1. Parse URL query parameters
   ```typescript
   export function parsePersonalizationParams(searchParams: URLSearchParams): {
     name?: string;
     email?: string;
     school?: string;
     campaign?: string;
     [key: string]: string | undefined;
   };
   ```

2. Variable replacement in blocks
   - Replace {{NAME}}, {{EMAIL}}, etc.
   - Support custom variables
   - HTML-escape user input

3. Hidden form fields
   - Auto-populate from query params
   - Pass campaign tracking data
   - Support pre-filled visible fields

4. Conditional section visibility
   - Show/hide sections based on params
   - Example: `?audience=parents` shows parent-specific content

**Success Criteria:**
- `?name=Kojo` displays "Welcome, Kojo"
- Hidden fields capture campaign source
- Conditional sections work
- XSS protection in place

### Task 2.2: UTM Tracking
**Effort:** 2-3 days

**Files to Modify:**
- [ ] `src/lib/page-builder/analytics.ts` - Add UTM tracking
- [ ] `src/app/p/[slug]/page.tsx` - Extract UTM params

**Implementation Steps:**
1. Extract UTM parameters
   - utm_source
   - utm_medium
   - utm_campaign
   - utm_term
   - utm_content

2. Store with page events
   - Add to `page_events.metadata`
   - Add to `page_submissions.source`

3. Display in analytics dashboard
   - Group views by source
   - Group conversions by source
   - Calculate ROI per campaign

**Success Criteria:**
- UTM params captured correctly
- Stored with submissions
- Analytics dashboard shows attribution

### Task 2.3: Dynamic Content Blocks
**Effort:** 3-4 days

**Files to Create:**
- [ ] `src/lib/page-builder/blocks/dynamic-text.tsx` - New dynamic block
- [ ] `src/lib/page-builder/blocks/conditional-section.tsx` - New conditional wrapper

**Implementation Steps:**
1. Dynamic text block
   - Insert query param values
   - Support fallback text
   - Multiple variable support

2. Conditional section
   - Show if query param matches
   - Hide if param doesn't match
   - Multiple conditions (AND/OR)

3. Entity-specific content
   - Fetch entity data by ID param
   - Display entity attributes
   - Cache entity lookups

**Success Criteria:**
- Dynamic text block works
- Conditional sections display correctly
- Entity lookups cached

---


## 🟡 Sprint 3: Conversion Blocks & Actions (2 weeks)

**Goal:** Complete the conversion toolkit

**Priority:** P1 - REQUIRED FOR FULL CAMPAIGN BUILDER

### Task 3.1: Countdown Timer Block
**Effort:** 2-3 days

**Files to Create:**
- [ ] `src/lib/page-builder/blocks/countdown.tsx` - New block

**Implementation:**
```typescript
interface CountdownBlockProps {
  targetDate: string; // ISO 8601
  heading?: string;
  subheading?: string;
  expiredText?: string;
  showDays?: boolean;
  showHours?: boolean;
  showMinutes?: boolean;
  showSeconds?: boolean;
}
```

**Features:**
- Client-side countdown timer
- Auto-update every second
- Expired state
- Timezone support

### Task 3.2: Pricing Cards Block
**Effort:** 3-4 days

**Files to Create:**
- [ ] `src/lib/page-builder/blocks/pricing-cards.tsx` - New block

**Implementation:**
```typescript
interface PricingCard {
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'one-time';
  features: string[];
  ctaText: string;
  ctaUrl: string;
  highlighted?: boolean;
  badge?: string;
}

interface PricingCardsBlockProps {
  heading?: string;
  cards: PricingCard[];
  columns: 2 | 3 | 4;
}
```

**Features:**
- Multiple pricing tiers
- Highlight recommended plan
- Feature comparison
- Responsive grid

### Task 3.3: Meeting Booking Widget
**Effort:** 4-5 days

**Files to Create:**
- [ ] `src/lib/page-builder/blocks/meeting-booking.tsx` - New block
- [ ] `src/components/page-builder/embeds/EmbeddedMeetingBooking.tsx` - Booking widget

**Implementation:**
```typescript
interface MeetingBookingBlockProps {
  meetingType: string; // ID of meeting type
  heading?: string;
  description?: string;
  displayMode: 'inline' | 'button';
  buttonText?: string;
}
```

**Features:**
- Embed meeting booking form
- Select meeting type
- Calendar integration
- Confirmation flow

### Task 3.4: School Info Card Block
**Effort:** 2-3 days

**Files to Create:**
- [ ] `src/lib/page-builder/blocks/school-info-card.tsx` - New block

**Implementation:**
```typescript
interface SchoolInfoCardBlockProps {
  entityId?: string; // Auto-populate from entity
  logo?: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  socialLinks?: { platform: string; url: string }[];
  showMap?: boolean;
}
```

**Features:**
- Display school/institution info
- Optional map embed
- Social links
- Contact buttons


### Task 3.5: Advanced CTA Actions
**Effort:** 3-4 days

**Files to Modify:**
- [ ] `src/lib/page-builder/blocks/cta.tsx` - Extend action types
- [ ] `src/components/page-builder/CTAHandler.tsx` - New component for action execution

**New Action Types:**
1. **Scroll to section**
   - Smooth scroll to section ID
   - Offset for fixed headers

2. **Open form modal**
   - Trigger form in overlay
   - Close on submit success

3. **Book meeting flow**
   - Open meeting booking widget
   - Pass pre-filled params

4. **Download file**
   - Trigger file download
   - Track download event

5. **Open WhatsApp**
   - `whatsapp://send?phone=...&text=...`
   - Pre-filled message

**Implementation:**
```typescript
type CTAAction =
  | { type: 'url'; url: string; openInNewTab?: boolean }
  | { type: 'scroll'; targetSectionId: string; offset?: number }
  | { type: 'form'; formId: string; displayMode: 'modal' | 'inline' }
  | { type: 'meeting'; meetingTypeId: string }
  | { type: 'download'; fileUrl: string; fileName: string }
  | { type: 'whatsapp'; phone: string; message?: string }
  | { type: 'phone'; phone: string }
  | { type: 'email'; email: string; subject?: string; body?: string };
```

**Success Criteria:**
- All action types work
- Events tracked in analytics
- Error handling for failed actions

### Task 3.6: Form Enhancements
**Effort:** 3-4 days

**Files to Modify:**
- [ ] `src/lib/page-builder/blocks/form.tsx` - Add field types

**New Field Types:**
1. **File upload**
   - Upload to Firebase Storage
   - Size/type validation
   - Progress indicator

2. **Date picker**
   - Calendar widget
   - Date validation
   - Format options

3. **Number input**
   - Min/max validation
   - Step increment
   - Currency formatting

4. **Consent checkbox**
   - Required for GDPR
   - Link to privacy policy
   - Validation

**Conditional Fields:**
- Show/hide based on previous answers
- Example: "Are you a parent? → Show child fields"

**Implementation:**
```typescript
interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 
        'file' | 'date' | 'number' | 'consent';
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    fileTypes?: string[];
    maxFileSize?: number; // bytes
  };
  conditional?: {
    dependsOn: string; // field ID
    showWhen: 'equals' | 'not_equals' | 'contains';
    value: string;
  };
}
```

**Success Criteria:**
- All field types render and validate
- File uploads work
- Conditional fields show/hide correctly

---


## 🟢 Sprint 4: Editor UX Polish (2 weeks)

**Goal:** Make editor delightful to use

**Priority:** P2 - NICE TO HAVE

### Task 4.1: Drag-and-Drop
**Effort:** 4-5 days

**Files to Modify:**
- [ ] `src/app/admin/pages/[id]/builder/components/BlockPalette.tsx` - Make draggable
- [ ] `src/app/admin/pages/[id]/builder/components/Canvas.tsx` - Add drop zones
- [ ] `src/app/admin/pages/[id]/builder/hooks/useDragAndDrop.ts` - New hook

**Implementation:**
Use `@dnd-kit/core` library (already in dependencies)

1. Drag from palette
   - Make block items draggable
   - Show drag preview
   - Drop into sections

2. Drag sections to reorder
   - Vertical sorting
   - Visual drop indicators
   - Smooth animations

3. Drag blocks within section
   - Vertical sorting
   - Visual drop indicators
   - Prevent invalid nesting

**Success Criteria:**
- Blocks drag from palette
- Sections reorder via drag
- Blocks reorder within sections
- Smooth animations

### Task 4.2: Inline Text Editing
**Effort:** 3-4 days

**Files to Modify:**
- [ ] `src/components/page-builder/BlockRenderer.tsx` - Add contentEditable
- [ ] `src/app/admin/pages/[id]/builder/components/Canvas.tsx` - Handle inline edits

**Implementation:**
1. Click to edit
   - Make text blocks contentEditable
   - Focus on click
   - Blur to save

2. Rich text toolbar
   - Bold, italic, underline
   - Headings, lists
   - Links

3. Image click to replace
   - Click image to open upload
   - Drag-drop to replace
   - Crop/resize tools

**Success Criteria:**
- Click text to edit inline
- Rich text formatting works
- Image replacement works
- Changes auto-save

### Task 4.3: Responsive Controls
**Effort:** 3-4 days

**Files to Modify:**
- [ ] `src/lib/page-builder/fields.ts` - Add responsive field support
- [ ] `src/components/page-builder/AutoBlockEditor.tsx` - Responsive UI
- [ ] `src/lib/page-builder/schema.ts` - Support responsive props

**Implementation:**
Per-breakpoint overrides:

```typescript
interface ResponsiveBlockProps {
  desktop: BlockProps;
  mobile?: Partial<BlockProps>; // overrides desktop
  tablet?: Partial<BlockProps>; // overrides desktop
}
```

**Breakpoints:**
- Desktop: > 1024px
- Tablet: 768px - 1024px
- Mobile: < 768px

**Responsive Properties:**
- Font size
- Padding/margin
- Visibility (hide on mobile)
- Column count (grid/layout)
- Image size

**Success Criteria:**
- Mobile overrides work
- Viewport toggle shows correct layout
- CSS media queries applied

---


## 🔵 Sprint 5: Analytics Dashboard (1-2 weeks)

**Goal:** Measure campaign performance

**Priority:** P2 - NICE TO HAVE

### Task 5.1: Page Analytics
**Effort:** 3-4 days

**Files to Create:**
- [ ] `src/app/admin/pages/[id]/analytics/page.tsx` - Analytics dashboard
- [ ] `src/lib/page-builder/analytics-queries.ts` - Data queries
- [ ] `src/components/page-builder/AnalyticsCharts.tsx` - Chart components

**Metrics to Display:**
1. **Overview Cards**
   - Total views
   - Unique visitors
   - Form submissions
   - Conversion rate %

2. **Time Series Chart**
   - Views over time (7d, 30d, 90d)
   - Submissions over time
   - Interactive line chart

3. **Top Sources**
   - UTM source breakdown
   - Referrer breakdown
   - Device type breakdown

4. **CTA Performance**
   - Click count per CTA
   - CTR (click-through rate)
   - Top performing CTAs

**Implementation:**
```typescript
export async function getPageAnalytics(
  pageId: string,
  dateRange: { start: Date; end: Date }
): Promise<{
  totalViews: number;
  uniqueVisitors: number;
  submissions: number;
  conversionRate: number;
  viewsByDate: { date: string; count: number }[];
  submissionsByDate: { date: string; count: number }[];
  topSources: { source: string; count: number }[];
  ctaClicks: { ctaId: string; label: string; count: number }[];
}>;
```

**Charts:** Use `recharts` library

**Success Criteria:**
- Dashboard displays all metrics
- Charts render correctly
- Date range filter works
- Export to CSV works

### Task 5.2: Event Tracking
**Effort:** 2-3 days

**Files to Modify:**
- [ ] `src/app/p/[slug]/page.tsx` - Add client-side tracking
- [ ] `src/lib/page-builder/track-events.ts` - Tracking functions

**Events to Track:**
1. **Page view** - On page load
2. **CTA click** - On button click
3. **Form start** - On first field focus
4. **Form submit** - On submit success
5. **Scroll depth** - 25%, 50%, 75%, 100%
6. **Time on page** - Session duration

**Implementation:**
```typescript
// Client-side tracking (lightweight, privacy-preserving)
export function trackEvent(params: {
  pageId: string;
  eventType: 'view' | 'cta_click' | 'form_start' | 'form_submit' | 'scroll_depth';
  metadata?: Record<string, unknown>;
  sessionId: string; // Generate on first visit
}): Promise<void>;
```

**Privacy:**
- No PII collection
- Session IDs are anonymous
- IP addresses not stored
- GDPR compliant

**Success Criteria:**
- All events track correctly
- No performance impact
- Privacy-compliant

### Task 5.3: Export & Reporting
**Effort:** 1-2 days

**Files to Create:**
- [ ] `src/lib/page-builder/export-analytics.ts` - CSV export

**Export Options:**
1. **Submissions CSV**
   - All form data
   - Date, source, UTM params
   - Entity ID (if created)

2. **Events CSV**
   - All tracked events
   - Timestamps, metadata
   - Session IDs

3. **Summary Report**
   - PDF report with charts
   - Executive summary
   - Email to team

**Success Criteria:**
- CSV export works
- Data is formatted correctly
- No PII exposed unintentionally

---


## 📋 Additional Tasks (Lower Priority)

### Missing Blocks (P2-P3)

**Effort:** 1-2 days each

- [ ] Icon List Block - Feature lists with icons
- [ ] Tabs Block - Tabbed content sections
- [ ] Card Group Block - Grid of cards
- [ ] Feature Comparison Block - Side-by-side comparison
- [ ] Quote Block - Styled blockquote
- [ ] Map Block - Google Maps embed
- [ ] Social Links Block - Social media links
- [ ] Download Button Block - File download with tracking
- [ ] Contact Card Block - Contact information display
- [ ] Admissions Journey Block - Timeline/steps
- [ ] Invoice Explainer Block - Billing information

### SEO Enhancements (P2)

**Effort:** 2-3 days

- [ ] Canonical URL support
- [ ] Structured data (schema.org)
- [ ] XML sitemap generation
- [ ] Social sharing preview
- [ ] Favicon per page

### Advanced Features (P3)

**Effort:** 1-2 weeks each

- [ ] A/B Testing - Split traffic between variants
- [ ] Funnel Support - Multi-page sequences
- [ ] AI Page Generation - Genkit integration
- [ ] Multi-user Collaboration - Real-time editing
- [ ] Custom Domains - White-label hosting
- [ ] Global Blocks - Reusable components

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] Form processor logic
- [ ] CRM integration
- [ ] Personalization engine
- [ ] Analytics queries
- [ ] All new blocks

### Integration Tests
- [ ] Form submission end-to-end
- [ ] Entity creation flow
- [ ] Analytics data flow
- [ ] Personalization rendering

### E2E Tests (Playwright)
- [ ] Create and publish page
- [ ] Submit form as visitor
- [ ] View analytics dashboard
- [ ] Edit published page

### Manual Testing Checklist
- [ ] Form submission on mobile
- [ ] Personalization with various params
- [ ] Analytics accuracy
- [ ] Cross-browser compatibility (Chrome, Safari, Firefox)
- [ ] Accessibility (keyboard nav, screen readers)

---

## 📊 Success Metrics

### Sprint 1 (Forms)
- ✅ 100% of submitted forms stored in Firestore
- ✅ 90% of forms create entities correctly
- ✅ 0 critical bugs after 1 week in production

### Sprint 2 (Personalization)
- ✅ Personalized pages load < 500ms
- ✅ 100% of UTM params captured
- ✅ 5+ personalization use cases documented

### Sprint 3 (Conversion Blocks)
- ✅ All 4 new blocks render correctly
- ✅ Meeting booking flow works end-to-end
- ✅ Form enhancements don't break existing forms

### Sprint 4 (Editor UX)
- ✅ Users create pages 50% faster (time to publish)
- ✅ Drag-and-drop works smoothly (60fps)
- ✅ Inline editing feels responsive (<100ms)

### Sprint 5 (Analytics)
- ✅ Analytics data accurate (±5% margin)
- ✅ Dashboard loads < 2 seconds
- ✅ Export works for 1000+ submission pages

---

## 🚀 Deployment Plan

### Sprint 1: Forms (Week 1-3)
**Deploy:** Week 3, Friday
**Rollout:** Feature flag `ENABLE_PAGE_FORMS=true`
**Monitoring:** Sentry error rate, form submission success rate

### Sprint 2: Personalization (Week 4-5)
**Deploy:** Week 5, Friday
**Rollout:** Gradual (10% → 50% → 100%)
**Monitoring:** Personalization render time, query param usage

### Sprint 3: Conversion Blocks (Week 6-7)
**Deploy:** Week 7, Friday
**Rollout:** Immediate (new blocks only affect new pages)
**Monitoring:** Block render errors, meeting booking success rate

### Sprint 4: Editor UX (Week 8-9)
**Deploy:** Week 9, Friday
**Rollout:** Feature flag `ENABLE_PAGE_BUILDER_DND=true`
**Monitoring:** Editor performance, user session duration

### Sprint 5: Analytics (Week 10-11)
**Deploy:** Week 11, Friday
**Rollout:** Immediate (read-only dashboard)
**Monitoring:** Analytics query performance

---

## 📝 Documentation TODO

### User Documentation
- [ ] How to create a landing page
- [ ] Form configuration guide
- [ ] Personalization guide
- [ ] Analytics dashboard guide
- [ ] Block library reference
- [ ] Template customization guide

### Developer Documentation
- [ ] Block development guide
- [ ] Form processor extension guide
- [ ] CRM integration customization
- [ ] Analytics query guide
- [ ] API reference

### Video Tutorials
- [ ] Page builder overview (5 min)
- [ ] Create lead capture page (10 min)
- [ ] Set up personalization (8 min)
- [ ] Track campaign performance (7 min)

---

## 🎯 Definition of Done

A feature is considered complete when:

✅ **Code Quality**
- All unit tests pass
- Code reviewed and approved
- No TypeScript errors
- Follows project conventions

✅ **Functionality**
- Feature works as specified
- Edge cases handled
- Error states implemented
- Loading states implemented

✅ **Testing**
- Unit tests written (>80% coverage)
- Integration tests pass
- E2E tests pass (where applicable)
- Manual testing complete

✅ **Documentation**
- Code commented
- User docs updated
- API docs updated (if applicable)
- Changelog entry added

✅ **Deployment**
- Feature flag configured
- Monitoring in place
- Rollback plan documented
- Team trained

---

## 🏁 Conclusion

This roadmap takes the page builder from **40% complete to 90% complete** in 5 sprints (~11 weeks). After Sprint 1, the builder will be **production-ready for lead capture**, which is the most critical use case.

**Quick Wins:**
- Sprint 1 (Forms) unlocks immediate value
- Sprint 2 (Personalization) enables campaign optimization
- Sprint 3 (Conversion Blocks) completes the toolkit

**Recommended Approach:**
1. **Focus on Sprint 1** - Forms MUST work
2. **Ship incrementally** - Don't wait for perfection
3. **Gather feedback** - User testing after each sprint
4. **Iterate rapidly** - Adjust priorities based on usage

**Next Steps:**
1. Review this TODO with the team
2. Create tickets for Sprint 1 tasks
3. Assign ownership and timelines
4. Begin Sprint 1 development

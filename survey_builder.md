# Survey Builder - Complete Design & Implementation Guide

## Overview

The Survey Builder is a comprehensive, drag-and-drop survey creation system built with React, TypeScript, and React Hook Form. It provides a multi-step wizard interface for creating interactive surveys with advanced features including AI assistance, real-time preview, and extensive customization options.

## Architecture

### Core Components Structure

```
src/app/admin/surveys/
├── new/
│   └── page.tsx                    # Main survey creation wizard
├── components/
│   ├── survey-form-builder.tsx     # Step 2: Main builder interface
│   ├── question-editor.tsx         # Individual element editors
│   ├── add-element-modal.tsx       # Element type selection
│   ├── live-preview-pane.tsx       # Real-time preview
│   ├── step-1-details.tsx          # Survey configuration
│   ├── results-step.tsx            # Step 3: Results configuration
│   ├── step-4-publish.tsx          # Publishing settings
│   ├── ai-chat-editor.tsx          # AI assistance
│   └── validation-error-modal.tsx  # Error handling
```

## Data Models

### Core Survey Types

```typescript
interface Survey {
  id: string;
  organizationId?: string;
  workspaceIds: string[];
  internalName: string;           // Internal reference name
  title: string;                  // Public survey title
  description: string;            // Survey description
  slug: string;                   // URL slug
  status: 'draft' | 'published' | 'archived';
  elements: SurveyElement[];      // Survey content
  
  // Media & Branding
  logoUrl?: string;
  bannerImageUrl?: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  videoCaption?: string;
  
  // Styling
  backgroundColor?: string;
  backgroundPattern?: 'none' | 'dots' | 'grid' | 'circuit' | 'topography' | 'cubes' | 'gradient';
  patternColor?: string;
  
  // Behavior
  startButtonText?: string;
  showCoverPage?: boolean;
  showSurveyTitles?: boolean;
  
  // Scoring & Results
  scoringEnabled?: boolean;
  maxScore?: number;
  scoreDisplayMode?: 'points' | 'percentage';
  resultRules?: SurveyResultRule[];
  
  // Thank You Page
  thankYouTitle?: string;
  thankYouDescription?: string;
  
  // Notifications
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'both';
  externalAlertsEnabled?: boolean;
  
  // Entity Integration
  entityId?: string | null;
  entityName?: string | null;
  useEntityLogo?: boolean;
  
  // Automation
  createEntity?: boolean;
  assignmentEnabled?: boolean;
  autoTags?: string[];
  
  createdAt: string;
  updatedAt: string;
}
```

### Survey Elements

#### Base Element Interface
```typescript
interface SurveyElement {
  id: string;
  type: string;
  title?: string;
  hidden?: boolean;
  style?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
  };
}
```

#### Question Types
```typescript
interface SurveyQuestion extends SurveyElement {
  type: 'text' | 'long-text' | 'yes-no' | 'multiple-choice' | 'checkboxes' | 
        'dropdown' | 'rating' | 'date' | 'time' | 'file-upload' | 'email' | 'phone';
  title: string;
  isRequired: boolean;
  placeholder?: string;
  defaultValue?: any;
  
  // Choice-based questions
  options?: string[];
  allowOther?: boolean;
  
  // Text validation
  minLength?: number;
  maxLength?: number;
  
  // Scoring
  enableScoring?: boolean;
  optionScores?: number[];
  yesScore?: number;
  noScore?: number;
  
  // Behavior
  autoAdvance?: boolean;
}
```

#### Layout Blocks
```typescript
interface SurveyLayoutBlock extends SurveyElement {
  type: 'heading' | 'description' | 'divider' | 'image' | 'video' | 
        'audio' | 'document' | 'embed' | 'section';
  
  // Content
  variant?: 'h1' | 'h2' | 'h3';
  text?: string;
  url?: string;
  html?: string;
  
  // Section-specific
  renderAsPage?: boolean;
  validateBeforeNext?: boolean;
  stepperTitle?: string;
  description?: string;
}
```

#### Logic Blocks
```typescript
interface SurveyLogicBlock extends SurveyElement {
  type: 'logic';
  rules: {
    sourceQuestionId: string;
    operator: 'isEqualTo' | 'isNotEqualTo' | 'contains' | 'doesNotContain' | 
             'startsWith' | 'doesNotStartWith' | 'endsWith' | 'doesNotEndWith' | 
             'isEmpty' | 'isNotEmpty' | 'isGreaterThan' | 'isLessThan';
    targetValue?: any;
    action: {
      type: 'jump' | 'require' | 'show' | 'hide' | 'disableSubmit';
      targetElementId?: string;
      targetElementIds?: string[];
    };
  }[];
}
```

## Step-by-Step Wizard

### Step 1: Survey Details & Branding

**Purpose**: Configure basic survey information, branding, and visual theme.

**Key Features**:
- **Identity & Branding**:
  - Internal Name (for organization)
  - Public Title (shown to respondents)
  - Description/Introduction
  - Entity Association (optional)
  - Logo Sync from Entity

- **Immersive Hero**:
  - Feature Video URL (YouTube, Vimeo, MP4)
  - Video Caption/CTA Text
  - Video Thumbnail
  - Cover Image (fallback)
  - Logo Upload

- **Visual Theme**:
  - Background Color (color picker)
  - Pattern Color (for overlays)
  - Background Pattern (dots, grid, circuit, topography, cubes, gradient)

**Validation Requirements**:
- Internal Name: min 2 characters
- Title: min 5 characters
- Description: min 10 characters
- URLs: valid URL format if provided

### Step 2: Survey Builder (Main Interface)

**Purpose**: Create and arrange survey content using drag-and-drop interface.

#### Builder Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: New Survey Blueprint                    [AI] [Save] │
├─────────────────────────────────────────────────────────────┤
│ [Stepper: Details > Builder > Results > Publish]           │
├──────┬──────────────────────────────────────────────────────┤
│ Tool │ Main Builder Area                                    │
│ bar  │ ┌─────────────────────────────────────────────────┐ │
│ ┌──┐ │ │ Element 1: Section                              │ │
│ │+│ │ │ ├─ Question 1: Multiple Choice                   │ │
│ │AI│ │ │ ├─ Question 2: Text Input                       │ │
│ │📄│ │ │ └─ [+ Add Element]                              │ │
│ │🔄│ │ └─────────────────────────────────────────────────┘ │
│ │👁│ │ ┌─────────────────────────────────────────────────┐ │
│ └──┘ │ │ Element 2: Logic Block                          │ │
│      │ └─────────────────────────────────────────────────┘ │
└──────┴──────────────────────────────────────────────────────┘
```

#### Vertical Toolbar Features

1. **Add Element** (`+`): Opens element selection modal
2. **AI Chat Editor**: AI-powered survey assistance
3. **Page Breaks** (`📄`): Toggle all sections as separate pages
4. **Validation** (`🔒`): Enable strict validation for all sections
5. **Undo/Redo** (`↶↷`): History management
6. **Preview** (`👁`): Live survey preview

#### Available Element Types

**Question Elements**:
- **Short Text**: Single-line text input
- **Long Text**: Multi-line textarea
- **Yes/No**: Boolean choice
- **Multiple Choice**: Single selection from options
- **Checkboxes**: Multiple selection
- **Dropdown**: Select from dropdown menu
- **Rating**: 1-5 star rating scale
- **Date**: Date picker
- **Time**: Time picker
- **File Upload**: File attachment

**Layout & Logic Blocks**:
- **Section**: Grouping container with optional page breaks
- **Heading**: H1, H2, H3 text headers
- **Description**: Rich text content
- **Divider**: Visual separator
- **Image**: Image display
- **Video**: Video embed
- **Audio**: Audio player
- **Document**: Document embed
- **Embed HTML**: Custom HTML content
- **Logic**: Conditional branching rules

#### Element Configuration

Each element type has specific configuration options:

**Text Questions**:
- Title (required)
- Placeholder text
- Required/Optional toggle
- Min/Max length validation
- Default value

**Choice Questions**:
- Title (required)
- Options list (editable)
- "Allow Other" option
- Scoring values per option
- Auto-advance setting

**Rating Questions**:
- Title (required)
- Rating scale (2-10)
- Min/Max labels
- Scoring enabled

**Section Elements**:
- Title (required)
- Stepper title (for navigation)
- Description
- Render as separate page
- Validate before next

**Logic Blocks**:
- Source question selection
- Condition operators
- Target values
- Actions (jump, show/hide, require)

#### Advanced Features

**Drag & Drop Reordering**:
- Visual drag handles
- Real-time position feedback
- Smooth animations
- Nested element support

**Auto-save System**:
- Debounced saves (5-second delay)
- Local storage backup
- Recovery on page reload
- Save status indicators

**Undo/Redo System**:
- Complete form state history
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- Visual state indicators
- Programmatic change detection

### Step 3: Results Configuration

**Purpose**: Configure scoring, result pages, and outcome logic.

**Key Features**:
- **Scoring System**:
  - Enable/disable scoring
  - Points vs percentage display
  - Maximum score calculation
  - Per-question scoring

- **Result Rules**:
  - Score range definitions
  - Priority ordering
  - Result page assignments
  - Email/SMS notifications

- **Result Pages**:
  - Custom result layouts
  - Dynamic content blocks
  - Conditional display
  - Branding integration

### Step 4: Publishing & Distribution

**Purpose**: Configure publication settings, notifications, and integrations.

**Key Features**:
- **Publication Settings**:
  - URL slug configuration
  - Workspace assignment
  - Status management (draft/published/archived)

- **Notification System**:
  - Admin alerts (email/SMS)
  - External notifications
  - Template selection
  - User targeting

- **Integration Options**:
  - Webhook configuration
  - Entity creation/assignment
  - Auto-tagging
  - Automation triggers

## AI Integration

### AI Chat Editor

**Purpose**: Provide intelligent assistance for survey creation and modification.

**Key Features**:
- **Natural Language Processing**: Understand user requests in plain English
- **Document Analysis**: Process uploaded PDFs, DOCX, TXT files
- **URL Content Extraction**: Analyze web pages for survey content
- **Multi-modal Support**: Handle text, images, and documents

**AI Capabilities**:
- Survey structure generation from descriptions
- Question suggestion and refinement
- Content optimization
- Logic flow recommendations
- Accessibility improvements

**Usage Patterns**:
```
User: "Create a customer satisfaction survey with 5 questions"
AI: Generates complete survey structure with appropriate question types

User: "Add a section about product quality"
AI: Inserts new section with relevant questions

User: "Make this survey more engaging"
AI: Suggests improvements to wording, flow, and visual elements
```

### AI Model Support

**Supported Providers**:
- Google Gemini (googleai/*)
- OpenAI (gpt-*)
- OpenRouter (meta-llama/*, nvidia/*)

**Dynamic Model Selection**:
- Organization-level API key management
- Per-user model preferences
- Fallback to system defaults
- Error handling and retry logic

## Live Preview System

### Real-time Preview

**Purpose**: Provide immediate visual feedback during survey creation.

**Features**:
- **Device Simulation**: Desktop and mobile views
- **Live Updates**: Real-time reflection of changes
- **Interactive Elements**: Functional preview components
- **Styling Preview**: Background patterns, colors, media

**Preview Components**:
- Cover page with branding
- Video hero sections
- Question rendering
- Navigation flow
- Thank you pages

### Responsive Design

**Breakpoints**:
- Desktop: Full-width layout
- Mobile: 375px width simulation
- Tablet: Adaptive scaling

**Visual Elements**:
- Background patterns (SVG-based)
- Color theming
- Typography scaling
- Media responsiveness

## Validation System

### Multi-level Validation

**Form-level Validation**:
- Zod schema validation
- Required field checking
- Format validation (URLs, emails)
- Length constraints

**Element-level Validation**:
- Question completeness
- Choice option validation
- Logic rule consistency
- Media URL verification

**Step-by-step Validation**:
- Progressive validation
- Step completion requirements
- Error aggregation
- User guidance

### Error Handling

**Validation Error Modal**:
- Categorized error display
- Clickable navigation to errors
- Required field highlighting
- Specific correction guidance

**Error Message Types**:
- Missing required fields
- Invalid formats
- Incomplete configurations
- Logic inconsistencies

## Data Persistence

### Auto-save System

**Local Storage**:
- Automatic form state backup
- Recovery on page reload
- Conflict resolution
- Storage cleanup

**Database Persistence**:
- Firestore integration
- Real-time synchronization
- Optimistic updates
- Error recovery

### State Management

**React Hook Form**:
- Centralized form state
- Field array management
- Validation integration
- Performance optimization

**Undo/Redo System**:
- Complete state snapshots
- Efficient diff tracking
- Memory management
- User action history

## Performance Optimizations

### Rendering Optimizations

**Component Memoization**:
- React.memo for expensive components
- useMemo for computed values
- useCallback for event handlers
- Selective re-rendering

**Lazy Loading**:
- Code splitting by routes
- Dynamic imports for heavy components
- Progressive enhancement
- Bundle optimization

### Data Optimizations

**Debounced Updates**:
- 5-second auto-save delay
- Reduced API calls
- Smooth user experience
- Conflict prevention

**Efficient Queries**:
- Firestore composite indexes
- Pagination support
- Selective field loading
- Cache optimization

## Accessibility Features

### Keyboard Navigation

**Full Keyboard Support**:
- Tab order management
- Focus indicators
- Keyboard shortcuts
- Screen reader compatibility

**ARIA Implementation**:
- Semantic markup
- Role definitions
- State announcements
- Relationship descriptions

### Visual Accessibility

**Color Contrast**:
- WCAG AA compliance
- High contrast mode
- Color-blind friendly palettes
- Alternative indicators

**Typography**:
- Scalable fonts
- Readable line heights
- Sufficient spacing
- Clear hierarchy

## Integration Points

### Entity System Integration

**Entity Association**:
- Survey-entity relationships
- Logo synchronization
- Branding inheritance
- Permission management

### Workspace Management

**Multi-workspace Support**:
- Workspace-scoped surveys
- Cross-workspace sharing
- Permission inheritance
- Data isolation

### Notification System

**Alert Configuration**:
- Admin notifications
- External alerts
- Template integration
- Multi-channel delivery

## Security Considerations

### Data Protection

**Input Sanitization**:
- XSS prevention
- SQL injection protection
- File upload validation
- Content filtering

**Access Control**:
- Role-based permissions
- Workspace isolation
- User authentication
- API key management

### Privacy Compliance

**Data Handling**:
- GDPR compliance
- Data minimization
- Consent management
- Right to deletion

## Testing Strategy

### Unit Testing

**Component Testing**:
- React Testing Library
- Jest test runner
- Mock implementations
- Snapshot testing

**Logic Testing**:
- Validation functions
- State management
- API interactions
- Error handling

### Integration Testing

**End-to-End Testing**:
- Playwright automation
- User journey testing
- Cross-browser validation
- Performance testing

### Property-based Testing

**Fast-check Integration**:
- Random input generation
- Edge case discovery
- Invariant verification
- Regression prevention

## Deployment & Monitoring

### Build Process

**Next.js Optimization**:
- Static generation
- Image optimization
- Bundle analysis
- Performance monitoring

### Error Tracking

**Sentry Integration**:
- Real-time error reporting
- Performance monitoring
- User session replay
- Alert management

## Future Enhancements

### Planned Features

**Advanced Logic**:
- Complex branching rules
- Calculated fields
- Dynamic scoring
- Advanced piping

**Collaboration**:
- Multi-user editing
- Comment system
- Version control
- Change tracking

**Analytics**:
- Response analytics
- Completion rates
- Drop-off analysis
- A/B testing

### Technical Improvements

**Performance**:
- Virtual scrolling
- Progressive loading
- Caching strategies
- Offline support

**User Experience**:
- Improved AI assistance
- Better mobile experience
- Enhanced accessibility
- Streamlined workflows

## Conclusion

The Survey Builder represents a comprehensive solution for creating interactive surveys with advanced features including AI assistance, real-time preview, and extensive customization options. Its modular architecture, robust validation system, and performance optimizations make it suitable for enterprise-level survey creation and management.

The system's flexibility allows for easy extension and customization while maintaining a user-friendly interface that enables both technical and non-technical users to create sophisticated surveys efficiently.
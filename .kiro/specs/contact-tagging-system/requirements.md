# Contact Tagging System - Requirements Document

## Executive Summary

A flexible, scalable tagging system for organizing contacts (schools, prospects, focal persons) to enable intelligent segmentation, personalized campaigns, automation triggers, and behavioral tracking. This system will integrate with the existing messaging variables infrastructure and automation engine.

## Problem Statement

Currently, the SmartSapp CRM lacks a systematic way to:
- Categorize contacts beyond basic fields (status, stage, etc.)
- Track behavioral patterns (engagement, interests, actions)
- Segment audiences for targeted messaging campaigns
- Trigger automations based on contact attributes and behaviors
- Maintain organized, scalable contact data as the database grows

Without tags, users must rely on rigid custom fields or manual filtering, leading to:
- Difficulty targeting specific contact segments
- Inability to track temporary states or behaviors
- Complex automation conditions
- Disorganized contact data over time

## Goals & Objectives

### Primary Goals
1. **Flexible Contact Organization**: Enable users to categorize contacts using lightweight, dynamic labels
2. **Campaign Personalization**: Support targeted messaging based on tags
3. **Automation Enhancement**: Use tags as triggers and conditions in automation workflows
4. **Behavioral Tracking**: Capture and track contact actions and engagement patterns
5. **Data Hygiene**: Maintain clean, organized contact data through tag management

### Success Metrics
- 80% of active users adopt tagging within 30 days
- 50% reduction in time spent manually filtering contacts
- 40% increase in campaign engagement through better segmentation
- 30% of automations utilize tag-based triggers within 60 days

## User Personas

### 1. Marketing Manager (Primary)
**Name**: Ama - Marketing Lead  
**Goals**: 
- Segment schools by engagement level for targeted campaigns
- Track which schools attended webinars or downloaded resources
- Automate follow-ups based on behavioral tags

**Pain Points**:
- Manually tracking engagement across multiple channels
- Difficulty identifying high-value prospects
- Time-consuming campaign segmentation

### 2. Sales Representative
**Name**: Kofi - Business Development Officer  
**Goals**:
- Quickly identify hot leads vs cold prospects
- Track schools by product interest (packages, services)
- Prioritize follow-ups based on engagement tags

**Pain Points**:
- Losing track of prospect status
- Unclear which schools to prioritize
- Manual lead scoring

### 3. System Administrator
**Name**: Kwame - CRM Admin  
**Goals**:
- Maintain organized tagging structure
- Prevent tag proliferation and duplication
- Ensure consistent naming conventions across team

**Pain Points**:
- Uncontrolled tag creation leading to chaos
- Duplicate or redundant tags
- Lack of tag governance

## Functional Requirements

### FR1: Tag Management

#### FR1.1: Create Tags
- **Description**: Users can create new tags with descriptive names and optional descriptions
- **Acceptance Criteria**:
  - Tag name is required (max 50 characters)
  - Tag description is optional (max 200 characters)
  - Tag color can be selected from predefined palette
  - Tag category can be assigned (Behavioral, Demographic, Interest, Status, Custom)
  - System prevents duplicate tag names (case-insensitive)
  - Tags are workspace-scoped (multi-tenant support)

#### FR1.2: Edit Tags
- **Description**: Users can modify existing tag properties
- **Acceptance Criteria**:
  - Can update tag name, description, color, and category
  - Editing a tag updates it across all tagged contacts
  - System tracks last modified date and user
  - Cannot edit system-generated tags (read-only)

#### FR1.3: Delete Tags
- **Description**: Users can remove tags from the system
- **Acceptance Criteria**:
  - Confirmation dialog shows number of affected contacts
  - Option to remove tag from all contacts or merge with another tag
  - System-generated tags cannot be deleted
  - Deletion is logged in activity history

#### FR1.4: Merge Tags
- **Description**: Combine duplicate or similar tags into one
- **Acceptance Criteria**:
  - Select source tag(s) and target tag
  - All contacts with source tags receive target tag
  - Source tags are deleted after merge
  - Merge action is logged and reversible (within 24 hours)

#### FR1.5: Tag Categories
- **Description**: Organize tags into logical categories
- **Predefined Categories**:
  - **Behavioral**: Actions taken (Downloaded, Attended, Clicked, Visited)
  - **Demographic**: Location, size, type (Urban School, Rural School, Large Institution)
  - **Interest**: Product/service interests (Interested in Analytics, Wants Training)
  - **Status**: Current state (Hot Lead, Active Customer, Churned, VIP)
  - **Lifecycle**: Journey stage (Prospect, Onboarding, Renewal Due)
  - **Engagement**: Activity level (Highly Engaged, Inactive, Re-engaged)
  - **Custom**: User-defined categories

### FR2: Contact Tagging

#### FR2.1: Apply Tags to Contacts
- **Description**: Add one or multiple tags to schools, prospects, or focal persons
- **Acceptance Criteria**:
  - Can apply tags individually or in bulk
  - Tags can be added from contact detail page
  - Tags can be added from list view (bulk action)
  - Auto-complete suggests existing tags while typing
  - Can create new tag inline during application
  - System logs who applied the tag and when

#### FR2.2: Remove Tags from Contacts
- **Description**: Remove tags from contacts
- **Acceptance Criteria**:
  - Can remove tags individually or in bulk
  - Confirmation required for bulk removal
  - Removal is logged in activity history
  - Can undo removal within 5 minutes

#### FR2.3: View Contact Tags
- **Description**: Display all tags associated with a contact
- **Acceptance Criteria**:
  - Tags shown as colored badges on contact cards
  - Tags visible in list view (configurable)
  - Tags displayed on contact detail page
  - Hover shows tag description and applied date
  - Click tag to filter other contacts with same tag

#### FR2.4: Bulk Tag Operations
- **Description**: Apply or remove tags from multiple contacts at once
- **Acceptance Criteria**:
  - Select multiple contacts from list view
  - Bulk actions menu includes "Add Tags" and "Remove Tags"
  - Can apply multiple tags in single operation
  - Progress indicator for large operations (>100 contacts)
  - Success/failure summary after completion

### FR3: Tag-Based Filtering & Search

#### FR3.1: Filter by Tags
- **Description**: Filter contact lists using tag criteria
- **Acceptance Criteria**:
  - Filter by single tag or multiple tags
  - Support AND/OR logic (has all tags vs has any tag)
  - Filter by tag category
  - Combine tag filters with other filters (status, stage, etc.)
  - Save filter combinations as views
  - Filter results update in real-time

#### FR3.2: Tag Search
- **Description**: Search for tags by name or description
- **Acceptance Criteria**:
  - Auto-complete search in tag selector
  - Search results show tag name, category, and usage count
  - Can search by partial match
  - Recent tags appear first in suggestions

#### FR3.3: Advanced Tag Queries
- **Description**: Complex tag-based queries for power users
- **Acceptance Criteria**:
  - Query builder interface for complex conditions
  - Support for NOT conditions (does not have tag)
  - Date-based queries (tagged within last X days)
  - Combine multiple tag conditions with AND/OR/NOT
  - Export query results to CSV

### FR4: Automation Integration

#### FR4.1: Tag-Based Triggers
- **Description**: Start automations when tags are applied or removed
- **Acceptance Criteria**:
  - "Tag Added" trigger type in automation builder
  - "Tag Removed" trigger type in automation builder
  - Can specify which tag(s) trigger the automation
  - Can filter by who applied the tag (manual vs automatic)
  - Trigger fires immediately upon tag change

#### FR4.2: Tag Conditions
- **Description**: Use tags as conditions in automation flows
- **Acceptance Criteria**:
  - "Has Tag" condition node in automation builder
  - "Does Not Have Tag" condition node
  - "Has Any Of Tags" condition (OR logic)
  - "Has All Of Tags" condition (AND logic)
  - Conditions evaluate in real-time during flow execution

#### FR4.3: Tag Actions
- **Description**: Apply or remove tags as automation actions
- **Acceptance Criteria**:
  - "Add Tag" action node in automation builder
  - "Remove Tag" action node
  - Can add/remove multiple tags in single action
  - Can use variables in tag names (dynamic tagging)
  - Action logs who/what triggered the tag change

### FR5: Campaign Integration

#### FR5.1: Tag-Based Segmentation
- **Description**: Use tags to segment audiences for messaging campaigns
- **Acceptance Criteria**:
  - Tag selector in campaign composer
  - Can target contacts with specific tags
  - Can exclude contacts with certain tags
  - Preview recipient count before sending
  - Save segments for reuse

#### FR5.2: Tag Variables in Messages
- **Description**: Reference tags in message templates
- **Acceptance Criteria**:
  - New variable category: "Contact Tags"
  - Can check if contact has specific tag in conditional blocks
  - Can list all contact tags in message body
  - Tags available in both SMS and email templates

### FR6: Analytics & Reporting

#### FR6.1: Tag Usage Statistics
- **Description**: View metrics on tag usage across the system
- **Acceptance Criteria**:
  - Dashboard showing most used tags
  - Tag usage trends over time
  - Contacts per tag (distribution chart)
  - Unused tags report (candidates for deletion)
  - Tag growth rate metrics

#### FR6.2: Tag Performance
- **Description**: Measure effectiveness of tagged segments
- **Acceptance Criteria**:
  - Campaign performance by tag segment
  - Conversion rates by tag
  - Engagement metrics by tag
  - Tag-based cohort analysis

### FR7: Tag Governance

#### FR7.1: Naming Conventions
- **Description**: Enforce consistent tag naming standards
- **Acceptance Criteria**:
  - Configurable naming convention templates
  - Examples: `[CATEGORY] Name`, `Category: Name`, `Category - Name`
  - System suggests format when creating tags
  - Warning when tag doesn't follow convention
  - Bulk rename tool to fix non-compliant tags

#### FR7.2: Tag Permissions
- **Description**: Control who can create, edit, and delete tags
- **Acceptance Criteria**:
  - Permission: "Manage Tags" (create, edit, delete)
  - Permission: "Apply Tags" (add/remove from contacts)
  - Permission: "View Tags" (read-only)
  - System admins have full tag management access
  - Regular users can apply existing tags only

#### FR7.3: Tag Audit Trail
- **Description**: Track all tag-related changes
- **Acceptance Criteria**:
  - Log tag creation, modification, deletion
  - Log tag application and removal from contacts
  - Log bulk tag operations
  - Audit log includes user, timestamp, and action details
  - Searchable audit history

## Non-Functional Requirements

### NFR1: Performance
- Tag filtering on 10,000+ contacts completes in <2 seconds
- Bulk tag operations (1,000 contacts) complete in <10 seconds
- Tag auto-complete suggestions appear in <200ms
- Real-time tag updates propagate to all users within 1 second

### NFR2: Scalability
- Support up to 500 unique tags per workspace
- Support up to 50 tags per contact
- Handle 100,000+ tagged contacts per workspace
- Efficient indexing for tag-based queries

### NFR3: Usability
- Tag creation requires ≤3 clicks
- Tag application requires ≤2 clicks
- Intuitive color-coding and visual hierarchy
- Mobile-responsive tag management interface
- Keyboard shortcuts for power users

### NFR4: Data Integrity
- No orphaned tags (tags with zero contacts)
- Consistent tag data across all contact types
- Automatic cleanup of deleted contact tags
- Transaction safety for bulk operations

### NFR5: Multi-Tenancy
- Tags are workspace-scoped (isolated per workspace)
- Organization-level tags (shared across workspaces) - optional
- Tag permissions respect workspace boundaries
- Cross-workspace tag analytics for super admins

## User Stories

### Epic 1: Tag Management
**As a** marketing manager  
**I want to** create and organize tags with clear naming conventions  
**So that** my team can consistently categorize contacts

**User Stories**:
1. As a user, I want to create a new tag with a name, description, and color, so I can start categorizing contacts
2. As a user, I want to assign tags to categories, so I can keep my tag library organized
3. As an admin, I want to merge duplicate tags, so I can maintain a clean tag system
4. As an admin, I want to see which tags are unused, so I can delete them and reduce clutter
5. As a user, I want to edit tag properties, so I can improve clarity as my needs evolve

### Epic 2: Contact Tagging
**As a** sales representative  
**I want to** quickly apply tags to contacts based on their actions and attributes  
**So that** I can segment and prioritize my outreach

**User Stories**:
1. As a user, I want to add tags to a contact from their detail page, so I can categorize them immediately
2. As a user, I want to apply tags to multiple contacts at once, so I can save time on bulk operations
3. As a user, I want to see all tags on a contact at a glance, so I understand their profile quickly
4. As a user, I want to remove tags from contacts, so I can update their categorization as things change
5. As a user, I want tag suggestions while typing, so I can reuse existing tags instead of creating duplicates

### Epic 3: Tag-Based Filtering
**As a** marketing manager  
**I want to** filter contacts by tags  
**So that** I can create targeted campaign segments

**User Stories**:
1. As a user, I want to filter the schools list by a single tag, so I can see all contacts in that category
2. As a user, I want to filter by multiple tags with AND/OR logic, so I can create complex segments
3. As a user, I want to save my tag filters as views, so I can quickly access common segments
4. As a user, I want to combine tag filters with other filters, so I can create precise targeting criteria
5. As a user, I want to see the contact count before applying filters, so I know the segment size

### Epic 4: Automation Integration
**As a** marketing manager  
**I want to** trigger automations based on tags  
**So that** I can automate personalized follow-ups

**User Stories**:
1. As a user, I want to start an automation when a specific tag is added, so I can automate responses to behaviors
2. As a user, I want to add tags as an automation action, so contacts are automatically categorized
3. As a user, I want to use tags as conditions in automation flows, so I can create branching logic
4. As a user, I want to remove tags via automation, so I can update contact states automatically
5. As a user, I want to see which automations use specific tags, so I understand dependencies before deleting

### Epic 5: Campaign Segmentation
**As a** marketing manager  
**I want to** target campaigns to tagged segments  
**So that** I can send relevant messages to the right audiences

**User Stories**:
1. As a user, I want to select tags when composing a campaign, so I can target specific segments
2. As a user, I want to exclude contacts with certain tags, so I can avoid sending irrelevant messages
3. As a user, I want to preview the recipient list before sending, so I can verify my targeting
4. As a user, I want to use tags in message conditional blocks, so I can personalize content
5. As a user, I want to save tag-based segments, so I can reuse them across campaigns

### Epic 6: Tag Analytics
**As an** admin  
**I want to** view tag usage analytics  
**So that** I can optimize our tagging strategy

**User Stories**:
1. As an admin, I want to see the most used tags, so I understand common categorization patterns
2. As an admin, I want to see tag usage trends over time, so I can identify growing categories
3. As an admin, I want to see campaign performance by tag, so I can measure segment effectiveness
4. As an admin, I want to identify unused tags, so I can clean up the tag library
5. As an admin, I want to see tag distribution across contacts, so I understand our audience composition

## Tag Naming Convention Best Practices

Based on ActiveCampaign and industry research, we recommend:

### Structure Options
1. **Bracket Notation**: `[CATEGORY] Descriptor`
   - Example: `[BEHAVIOR] Downloaded Brochure`
   - Example: `[STATUS] Hot Lead`

2. **Colon Notation**: `Category: Descriptor`
   - Example: `Interest: Analytics Dashboard`
   - Example: `Engagement: Highly Active`

3. **Dash Notation**: `Category - Descriptor`
   - Example: `Location - Greater Accra`
   - Example: `Product - Premium Package`

### Recommended Categories
- **[ACTION]**: User behaviors (Downloaded, Clicked, Attended, Visited)
- **[STATUS]**: Current state (Hot Lead, Active, Churned, VIP)
- **[INTEREST]**: Product/service interests (Analytics, Training, Consulting)
- **[STAGE]**: Lifecycle stage (Prospect, Onboarding, Renewal)
- **[ENGAGEMENT]**: Activity level (Highly Engaged, Inactive, Re-engaged)
- **[LOCATION]**: Geographic tags (Greater Accra, Ashanti Region)
- **[SIZE]**: Institution size (Small School, Large Institution)
- **[TYPE]**: School type (Public, Private, International)

### Naming Rules
1. Be descriptive but concise (max 50 characters)
2. Use consistent capitalization (Title Case recommended)
3. Avoid acronyms unless universally understood
4. Use present tense for actions ("Downloaded" not "Download")
5. Be specific ("Downloaded Pricing Guide" not "Downloaded Something")

## Integration Points

### Existing Systems
1. **Messaging Variables**: Tags can be referenced in message templates
2. **Automation Engine**: Tags trigger workflows and serve as conditions
3. **Schools/Prospects**: Tags apply to all contact types
4. **Activity Logger**: Tag changes logged as activities
5. **Firestore**: Tags stored as arrays on contact documents + separate collection

### Data Model Integration
```typescript
// Contact document (School/Prospect)
{
  tags: string[], // Array of tag IDs for quick filtering
  taggedAt: { [tagId: string]: Timestamp }, // When each tag was applied
  taggedBy: { [tagId: string]: string } // Who applied each tag
}

// Tags collection
{
  id: string,
  name: string,
  description: string,
  category: TagCategory,
  color: string,
  workspaceId: string,
  organizationId: string,
  usageCount: number, // Denormalized for performance
  createdBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  isSystem: boolean // System-generated tags (read-only)
}
```

## Out of Scope (Future Enhancements)

1. **AI-Powered Tag Suggestions**: Automatic tag recommendations based on contact behavior
2. **Tag Hierarchies**: Parent-child tag relationships
3. **Tag Scoring**: Weighted tags for lead scoring
4. **Tag Expiration**: Auto-remove tags after X days
5. **Tag Templates**: Pre-built tag sets for common use cases
6. **Cross-Workspace Tags**: Organization-level tags shared across workspaces
7. **Tag Import/Export**: Bulk tag operations via CSV
8. **Tag Webhooks**: External system notifications on tag changes

## Risks & Mitigation

### Risk 1: Tag Proliferation
**Impact**: High - Uncontrolled tag creation leads to chaos  
**Mitigation**: 
- Implement tag governance (naming conventions, permissions)
- Regular tag audits and cleanup tools
- Tag usage analytics to identify redundant tags
- Merge duplicate tags functionality

### Risk 2: Performance Degradation
**Impact**: Medium - Slow queries with many tags  
**Mitigation**:
- Efficient Firestore indexing on tag arrays
- Denormalized tag counts for quick stats
- Pagination for large tag lists
- Caching frequently used tag queries

### Risk 3: User Adoption
**Impact**: Medium - Users don't adopt tagging  
**Mitigation**:
- Intuitive UI with minimal friction
- Onboarding tutorials and examples
- Pre-built tag templates for common use cases
- Show value through analytics and automation

### Risk 4: Data Inconsistency
**Impact**: High - Tags out of sync across contacts  
**Mitigation**:
- Transactional updates for bulk operations
- Background jobs to verify tag integrity
- Audit trail for all tag changes
- Rollback capability for recent changes

## Success Criteria

### Phase 1 (MVP) - 4 weeks
- ✅ Tag CRUD operations functional
- ✅ Apply/remove tags from contacts
- ✅ Basic tag filtering in contact lists
- ✅ Tag management page with list and search
- ✅ Tag categories and color coding

### Phase 2 (Automation) - 2 weeks
- ✅ Tag-based automation triggers
- ✅ Tag conditions in automation flows
- ✅ Add/remove tag actions in automations
- ✅ Tag variables in message templates

### Phase 3 (Analytics) - 2 weeks
- ✅ Tag usage dashboard
- ✅ Campaign performance by tag
- ✅ Tag audit trail
- ✅ Bulk tag operations and merge

### Phase 4 (Governance) - 1 week
- ✅ Tag permissions and roles
- ✅ Naming convention enforcement
- ✅ Tag cleanup tools
- ✅ Advanced tag queries

## Appendix

### Reference Materials
- [ActiveCampaign Tag Best Practices](https://help.activecampaign.com/hc/en-us/articles/115001852844)
- Industry research on CRM tagging systems (2026)
- Existing messaging variables implementation
- Current automation engine architecture

### Glossary
- **Tag**: A lightweight label applied to contacts for categorization
- **Tag Category**: A grouping of related tags (Behavioral, Status, etc.)
- **Tag Segment**: A filtered group of contacts based on tag criteria
- **System Tag**: Auto-generated tag that cannot be manually edited
- **Tag Merge**: Combining duplicate tags into a single tag
- **Tag Governance**: Rules and processes for maintaining tag quality

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-23  
**Status**: Draft - Ready for Review

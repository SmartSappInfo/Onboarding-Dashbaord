# Implementation Plan: Contact Tagging System

## Overview

This implementation plan breaks down the Contact Tagging System into discrete, actionable coding tasks. The system provides flexible contact organization through tags, with integration into automation, messaging, and campaign systems. Implementation follows a phased approach: core tag management → contact tagging → filtering → automation integration → messaging integration → analytics and governance.

## Tasks

- [x] 1. Set up data models and type definitions
  - Create TypeScript interfaces for Tag, ContactTagging, TagUsageStats, TagAuditLog, and TagFilterQuery
  - Add tag-related types to existing type definitions
  - Define TagCategory enum and related types
  - _Requirements: FR1.1, FR1.5_

- [x] 2. Create Firestore indexes for tag queries
  - Add composite indexes for tag filtering with workspace scoping
  - Add indexes for tag usage analytics
  - Add indexes for audit log queries
  - Update firestore.indexes.json with required indexes
  - _Requirements: NFR1.1, NFR2.2_

- [x] 3. Implement core tag management server actions
  - [x] 3.1 Implement createTagAction with validation
    - Validate tag name (required, max 50 chars, no special chars)
    - Check for duplicate tag names (case-insensitive)
    - Generate slug from tag name
    - Create tag document in Firestore
    - Log audit trail for tag creation
    - _Requirements: FR1.1.1, FR1.1.2, FR1.1.3_

  - [x] 3.2 Write property test for tag name validation
    - **Property 1: Tag Name Validation**
    - **Validates: Requirements FR1.1.1**

  - [x] 3.3 Write property test for tag name uniqueness
    - **Property 2: Tag Name Uniqueness**
    - **Validates: Requirements FR1.1.2**

  - [x] 3.4 Implement updateTagAction
    - Validate tag exists and is not a system tag
    - Update tag properties (name, description, color, category)
    - Update timestamp
    - Revalidate cache paths
    - _Requirements: FR1.2.1, FR1.2.2_

  - [x] 3.5 Write property test for system tag immutability
    - **Property 5: System Tag Immutability**
    - **Validates: Requirements FR1.2.2, FR1.3.2**

  - [x] 3.6 Implement deleteTagAction with cascade
    - Validate tag exists and is not a system tag
    - Find all contacts with the tag
    - Remove tag from all contacts in batches
    - Delete tag document
    - Log audit trail with affected count
    - _Requirements: FR1.3.1, FR1.3.2_

  - [x] 3.7 Write property test for cascade tag deletion
    - **Property 6: Cascade Tag Deletion**
    - **Validates: Requirements FR1.3.1**

  - [x] 3.8 Implement mergeTagsAction
    - Validate source and target tags exist
    - Find all contacts with source tags
    - Replace source tags with target tag on all contacts
    - Preserve earliest timestamp
    - Delete source tags
    - Update target tag usage count
    - Log audit trail
    - _Requirements: FR1.4.1, FR1.4.2_

  - [x] 3.9 Write property test for tag merge completeness
    - **Property 7: Tag Merge Completeness**
    - **Validates: Requirements FR1.4.1, FR1.4.2_

  - [x] 3.10 Implement getTagsAction with workspace filtering
    - Query tags by workspaceId
    - Order by category and name
    - Return formatted tag list
    - _Requirements: FR1.1.3_

  - [x] 3.11 Write property test for workspace isolation
    - **Property 3: Workspace Isolation**
    - **Validates: Requirements FR1.1.3**

- [x] 4. Checkpoint - Ensure core tag management tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement contact tagging server actions
  - [x] 5.1 Implement applyTagsAction for single contact
    - Validate contact exists
    - Add tags to contact's tags array (avoid duplicates)
    - Update taggedAt and taggedBy maps
    - Increment tag usage counts
    - Log audit trail for each tag
    - Revalidate cache paths
    - _Requirements: FR2.1.1, FR2.1.2_

  - [x] 5.2 Write property test for tag operation audit trail
    - **Property 8: Tag Operation Audit Trail**
    - **Validates: Requirements FR2.1.2, FR2.2.1, FR7.3.1, FR7.3.2**

  - [x] 5.3 Implement removeTagsAction for single contact
    - Validate contact exists
    - Remove tags from contact's tags array
    - Remove entries from taggedAt and taggedBy maps
    - Decrement tag usage counts
    - Log audit trail for each tag
    - Revalidate cache paths
    - _Requirements: FR2.2.1, FR2.2.2_

  - [x] 5.4 Implement bulkApplyTagsAction
    - Process contacts in batches of 500 (Firestore limit)
    - Apply tags to each contact with timestamp
    - Update tag usage counts
    - Log bulk operation in audit trail
    - Return processed count
    - _Requirements: FR2.4.1, FR2.4.2_

  - [x] 5.5 Write property test for bulk operation accuracy
    - **Property 9: Bulk Operation Accuracy**
    - **Validates: Requirements FR2.4.2**

  - [x] 5.6 Implement bulkRemoveTagsAction
    - Process contacts in batches of 500
    - Remove tags from each contact
    - Update tag usage counts
    - Log bulk operation in audit trail
    - Return processed count
    - _Requirements: FR2.4.1, FR2.4.2_

  - [x] 5.7 Implement logTagAudit helper function
    - Create audit log document with all required fields
    - Include action type, tag info, contact info, user info, timestamp
    - Store metadata for bulk operations and merges
    - _Requirements: FR7.3.1, FR7.3.2_

- [x] 6. Checkpoint - Ensure contact tagging tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create tag management UI components
  - [x] 7.1 Create Tag management page (server component)
    - Fetch initial tags and usage stats server-side
    - Render TagsClient with initial data
    - Set up page layout with proper styling
    - _Requirements: FR1.1, FR1.2, FR1.3_

  - [x] 7.2 Create TagsClient component
    - Set up real-time Firestore listener for tags
    - Implement tag creation dialog
    - Implement tag editing dialog
    - Implement tag deletion with confirmation
    - Display tags in categorized tabs
    - Show usage statistics cards
    - _Requirements: FR1.1, FR1.2, FR1.3_

  - [x] 7.3 Create TagSelector component
    - Implement popover with search functionality
    - Display current tags with remove buttons
    - Display available tags with apply buttons
    - Show tag categories and descriptions
    - Include "Create New Tag" option
    - Handle tag application and removal
    - _Requirements: FR2.1, FR2.2, FR2.3_

  - [x] 7.4 Create BulkTagOperations component
    - Implement dialog with operation type selection (add/remove)
    - Create tag multi-select component
    - Show progress indicator during processing
    - Display operation summary before execution
    - Handle bulk apply and remove operations
    - _Requirements: FR2.4.1, FR2.4.2_

  - [x] 7.5 Add tag badges to contact cards
    - Display tags as colored badges on school/prospect cards
    - Show first 3 tags with "+N more" indicator
    - Add hover tooltips with tag descriptions
    - Make tags clickable to filter by that tag
    - _Requirements: FR2.3.1, FR2.3.2_

  - [x] 7.6 Integrate TagSelector into schools list view
    - Add tag selector to each school card
    - Enable bulk tag operations from list selection
    - Update list view when tags change
    - _Requirements: FR2.1, FR2.2, FR2.4_

  - [x] 7.7 Integrate TagSelector into school detail page
    - Add tag selector to school detail header
    - Display all tags with full descriptions
    - Show tag application history (who/when)
    - _Requirements: FR2.1, FR2.2, FR2.3_

- [x] 8. Implement tag filtering and search
  - [x] 8.1 Create TagFilter component
    - Implement tag multi-select for filtering
    - Add logic selector (AND/OR/NOT)
    - Add category filter option
    - Emit filter changes to parent
    - _Requirements: FR3.1.1, FR3.1.2_

  - [x] 8.2 Implement getContactsByTags query function
    - Handle AND logic (contacts with all tags)
    - Handle OR logic (contacts with any tag)
    - Handle NOT logic (contacts without tags)
    - Support category filtering
    - Return contact IDs efficiently
    - _Requirements: FR3.1.1, FR3.1.2, FR3.1.3_

  - [x] 8.3 Write property test for tag filter AND logic
    - **Property 10: Tag Filter AND Logic**
    - **Validates: Requirements FR3.1.1**

  - [x] 8.4 Write property test for tag filter OR logic
    - **Property 11: Tag Filter OR Logic**
    - **Validates: Requirements FR3.1.1**

  - [x] 8.5 Write property test for tag filter NOT logic
    - **Property 12: Tag Filter NOT Logic**
    - **Validates: Requirements FR3.1.1**

  - [x] 8.6 Integrate tag filtering into schools list page
    - Add TagFilter component to sidebar
    - Apply filters to schools query
    - Update URL params with filter state
    - Show active filter badges
    - _Requirements: FR3.1.1, FR3.1.2_

  - [x] 8.7 Implement tag search and autocomplete
    - Add search input to tag selector
    - Filter tags by name and description
    - Show recent tags first
    - Highlight matching text
    - _Requirements: FR3.2.1, FR3.2.2_

- [x] 9. Checkpoint - Ensure filtering tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integrate tags with automation engine
  - [x] 10.1 Add tag trigger types to automation system
    - Add TAG_ADDED and TAG_REMOVED to AutomationTrigger enum
    - Update automation type definitions
    - _Requirements: FR4.1.1, FR4.1.2_

  - [x] 10.2 Implement tag trigger handling in automation engine
    - Listen for tag changes on contacts
    - Match tag changes to automation triggers
    - Filter by specific tag IDs
    - Execute automation when tag trigger fires
    - _Requirements: FR4.1.1, FR4.1.2, FR4.1.3_

  - [x] 10.3 Create TagConditionNode for automation builder
    - Implement condition evaluation logic (has_tag, has_all_tags, has_any_tag, not_has_tag)
    - Create UI component for tag condition configuration
    - Add tag selector to condition node
    - _Requirements: FR4.2.1, FR4.2.2_

  - [x] 10.4 Write property test for tag condition evaluation
    - **Property 13: Tag Condition Evaluation**
    - **Validates: Requirements FR4.2.1**

  - [x] 10.5 Create TagActionNode for automation builder
    - Implement add_tags and remove_tags actions
    - Create UI component for tag action configuration
    - Add tag selector to action node
    - Execute tag actions during automation flow
    - _Requirements: FR4.3.1, FR4.3.2_

  - [x] 10.6 Update automation builder UI
    - Add tag trigger option to trigger selector
    - Add tag condition node to node palette
    - Add tag action node to node palette
    - Update node rendering for tag nodes
    - _Requirements: FR4.1, FR4.2, FR4.3_

- [x] 11. Integrate tags with messaging system
  - [x] 11.1 Add tag variables to messaging variable registry
    - Add contact_tags variable (comma-separated list)
    - Add has_tag variable (conditional)
    - Add tag_list variable (array)
    - Add tag_count variable (number)
    - _Requirements: FR5.2.1, FR5.2.2_

  - [x] 11.2 Implement resolveTagVariables function
    - Fetch contact's tag IDs
    - Resolve tag IDs to tag names
    - Format tags for template variables
    - Return tag variables object
    - _Requirements: FR5.2.1, FR5.2.2_

  - [x] 11.3 Add tag-based segmentation to campaign composer
    - Add tag selector to audience configuration
    - Implement tag inclusion/exclusion logic
    - Show recipient count preview
    - Save tag-based segments
    - _Requirements: FR5.1.1, FR5.1.2, FR5.1.3_

  - [x] 11.4 Implement previewCampaignAudience with tag filtering
    - Apply tag filters to contact query
    - Return contact count and preview list
    - Show tag distribution in preview
    - _Requirements: FR5.1.2, FR5.1.3_

  - [x] 11.5 Support tag conditionals in message templates
    - Enable has_tag checks in conditional blocks
    - Support tag_count comparisons
    - Allow tag_list iteration
    - _Requirements: FR5.2.2_

- [x] 12. Checkpoint - Ensure integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement tag analytics and governance
  - [x] 13.1 Create tag usage statistics dashboard
    - Display total tags count
    - Show most used tags chart
    - Display tag usage trends over time
    - Show contacts per tag distribution
    - Identify unused tags
    - _Requirements: FR6.1.1, FR6.1.2_

  - [x] 13.2 Implement getTagUsageStats function
    - Calculate usage count per tag
    - Determine trend direction (up/down/stable)
    - Count campaign and automation usage
    - Return formatted statistics
    - _Requirements: FR6.1.1, FR6.1.2_

  - [x] 13.3 Write property test for tag usage count accuracy
    - **Property 14: Tag Usage Count Accuracy**
    - **Validates: Requirements FR6.1.1**

  - [x] 13.4 Create TagMergeDialog component
    - Allow selection of source tags (multiple)
    - Allow selection of target tag (single)
    - Show affected contact count
    - Confirm merge operation
    - Execute merge and show results
    - _Requirements: FR1.4.1, FR1.4.2, FR1.4.3_

  - [x] 13.5 Implement tag cleanup tools
    - Identify unused tags (usageCount = 0)
    - Identify duplicate tags (similar names)
    - Bulk delete unused tags
    - Suggest tag merges for duplicates
    - _Requirements: FR7.1.1, FR7.1.2_

  - [x] 13.6 Write property test for no orphaned tags
    - **Property 16: No Orphaned Tags**
    - **Validates: Requirements NFR4.1**

  - [x] 13.7 Add tag permissions to permission system
    - Add tags_view permission
    - Add tags_manage permission
    - Add tags_apply permission
    - Implement permission checks in server actions
    - _Requirements: FR7.2.1, FR7.2.2_

  - [x] 13.8 Create tag audit log viewer
    - Display audit log with filters
    - Show tag creation, modification, deletion events
    - Show tag application and removal events
    - Filter by tag, contact, user, date range
    - _Requirements: FR7.3.1, FR7.3.2, FR7.3.3_

- [x] 14. Implement performance optimizations
  - [x] 14.1 Add React Query caching for tags
    - Set up useQuery hook for tags
    - Configure stale time and cache time
    - Implement cache invalidation on mutations
    - _Requirements: NFR1.3_

  - [x] 14.2 Implement optimistic UI updates
    - Update UI immediately on tag operations
    - Rollback on error
    - Show loading states during server sync
    - _Requirements: NFR1.3_

  - [x] 14.3 Add pagination for large tag lists
    - Implement cursor-based pagination
    - Add "Load More" button
    - Show loading skeleton during fetch
    - _Requirements: NFR2.1_

  - [x] 14.4 Optimize bulk operations with batching
    - Process contacts in chunks of 100
    - Show progress indicator
    - Handle partial failures gracefully
    - _Requirements: NFR1.2_

  - [x] 14.5 Write property test for query performance
    - **Property 17: Query Performance**
    - **Validates: Requirements NFR1.1**

  - [x] 14.6 Write property test for bulk operation performance
    - **Property 18: Bulk Operation Performance**
    - **Validates: Requirements NFR1.2**

- [x] 15. Add data integrity checks
  - [x] 15.1 Implement tag reference integrity validation
    - Check that all tag IDs in contacts exist in tags collection
    - Create background job to detect orphaned references
    - Provide cleanup function for invalid references
    - _Requirements: NFR4.2_

  - [x] 15.2 Write property test for tag reference integrity
    - **Property 15: Tag Reference Integrity**
    - **Validates: Requirements NFR4.2**

  - [x] 15.3 Add input validation with Zod schemas
    - Create TagSchema for tag creation/update
    - Validate all inputs in server actions
    - Return user-friendly error messages
    - _Requirements: NFR4.2_

  - [x] 15.4 Implement transaction safety for bulk operations
    - Use Firestore batches for atomic updates
    - Handle batch size limits (500 operations)
    - Rollback on partial failures
    - _Requirements: NFR4.3_

- [x] 16. Enhance UI/UX and accessibility
  - [x] 16.1 Add loading skeletons for all components
    - Create TagsSkeleton component
    - Create TagSelectorSkeleton component
    - Show skeletons during data fetch
    - _Requirements: NFR3.1_

  - [x] 16.2 Implement keyboard navigation
    - Add Tab navigation for all interactive elements
    - Add arrow key navigation in tag selector
    - Add Escape key to close dialogs
    - Add Enter key to confirm actions
    - _Requirements: NFR3.2_

  - [x] 16.3 Add ARIA labels and screen reader support
    - Add aria-label to all buttons and inputs
    - Add aria-live regions for dynamic updates
    - Use semantic HTML structure
    - Test with screen readers
    - _Requirements: NFR3.2_

  - [x] 16.4 Ensure color contrast compliance
    - Verify 4.5:1 contrast ratio for all text
    - Ensure tag badges have sufficient contrast
    - Add focus indicators with proper contrast
    - _Requirements: NFR3.2_

  - [x] 16.5 Optimize for mobile responsiveness
    - Use mobile drawer for tag selector on small screens
    - Make tag badges responsive
    - Ensure touch targets are 44x44px minimum
    - Test on various screen sizes
    - _Requirements: NFR3.1_

- [x] 17. Add error handling and user feedback
  - [x] 17.1 Implement comprehensive error handling
    - Create custom error classes (TagValidationError, TagPermissionError, TagConflictError)
    - Handle errors in all server actions
    - Return structured error responses
    - _Requirements: NFR4.2_

  - [x] 17.2 Add user-friendly error messages
    - Create error message dictionary
    - Map error codes to user-friendly messages
    - Display errors in toast notifications
    - _Requirements: NFR3.1_

  - [x] 17.3 Implement retry logic for transient failures
    - Add withRetry wrapper function
    - Retry on network errors (max 3 attempts)
    - Don't retry on validation/permission errors
    - Show retry status to user
    - _Requirements: NFR1.1_

  - [x] 17.4 Add success feedback for all operations
    - Show toast on successful tag creation
    - Show toast on successful tag application
    - Show progress for bulk operations
    - Provide undo option for recent changes
    - _Requirements: NFR3.1_

- [x] 18. Update Firestore security rules
  - [x] 18.1 Add security rules for tags collection
    - Allow read if user has workspace access
    - Allow create if user has tags_manage permission
    - Allow update if user has tags_manage permission and tag is not system tag
    - Allow delete if user has tags_manage permission and tag is not system tag
    - _Requirements: NFR5.1, NFR5.2_

  - [x] 18.2 Add security rules for tag operations on contacts
    - Allow update of tags field if user has schools_edit permission
    - Validate that only tags, taggedAt, taggedBy fields are updated
    - Ensure workspace access for contact
    - _Requirements: NFR5.1, NFR5.2_

  - [x] 18.3 Add security rules for audit logs
    - Allow read if user has activities_view permission
    - Allow create for all authenticated users
    - Disallow update and delete (immutable logs)
    - _Requirements: NFR5.1_

- [x] 19. Final checkpoint and integration testing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Documentation and deployment preparation
  - [x] 20.1 Write user documentation
    - Create tag management guide
    - Document best practices for tag naming
    - Write bulk operations tutorial
    - Document automation integration
    - _Requirements: All_

  - [x] 20.2 Write developer documentation
    - Document server action APIs
    - Provide component usage examples
    - Write integration guide for new features
    - Document testing approach
    - _Requirements: All_

  - [x] 20.3 Create migration script for existing data
    - Identify existing categorization fields
    - Create tags from existing categories
    - Apply tags to contacts based on old fields
    - Verify migration accuracy
    - _Requirements: All_

  - [x] 20.4 Prepare deployment checklist
    - Verify all Firestore indexes are deployed
    - Verify security rules are updated
    - Test in staging environment
    - Create rollback plan
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties from the design document
- Unit tests should be written alongside implementation for specific examples and edge cases
- All code should follow existing SmartSapp design patterns and TypeScript conventions
- Real-time updates should use Firestore listeners where appropriate
- Server actions should include proper error handling and validation
- UI components should follow the existing design system (rounded-2xl, proper spacing, etc.)
- Accessibility should be considered in all UI implementations
- Performance optimizations should be applied for operations on large datasets

## Implementation Order

The tasks are ordered to enable incremental development and testing:
1. Data models and infrastructure (tasks 1-2)
2. Core tag management (tasks 3-4)
3. Contact tagging (tasks 5-6)
4. UI components (task 7)
5. Filtering and search (tasks 8-9)
6. Automation integration (task 10)
7. Messaging integration (task 11-12)
8. Analytics and governance (task 13)
9. Performance and optimization (task 14)
10. Data integrity (task 15)
11. UI/UX polish (task 16)
12. Error handling (task 17)
13. Security (task 18)
14. Final testing (task 19)
15. Documentation and deployment (task 20)

Each phase builds on the previous one, allowing for testing and validation at each checkpoint.

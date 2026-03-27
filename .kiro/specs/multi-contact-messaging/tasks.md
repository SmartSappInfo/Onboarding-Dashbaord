# Implementation Plan: Multi-Contact Messaging

## Overview

This implementation adds multi-entity messaging capability through a thin orchestration layer. The approach focuses on two new components (Sequential_Scheduler and EntitySelector) that integrate with the existing messaging system without modifying any existing functions. The implementation follows a 3-phase approach: Backend → UI → Integration.

## Tasks

- [x] 1. Implement Sequential_Scheduler orchestration layer
  - [x] 1.1 Create sequential-scheduler.ts with core orchestration logic
    - Implement scheduleMultiEntityMessages function
    - Accept entityIds array and call sendMessage for each entity sequentially
    - Add configurable delay between messages (default 500ms)
    - Implement progress callbacks (onProgress, onError)
    - Enforce maximum queue size of 500 messages
    - _Requirements: 3.1, 3.3, 4.1, 4.2, 4.4, 10.6_
  
  - [x] 1.2 Write property test for Sequential_Scheduler invocation count
    - **Property 7: Sequential Scheduler Invocation Count**
    - **Validates: Requirements 3.1**
  
  - [x] 1.3 Write property test for sequential execution order
    - **Property 11: Sequential Execution Order**
    - **Validates: Requirements 4.1, 4.2**
  
  - [ ]* 1.4 Write property test for error resilience
    - **Property 12: Error Resilience**
    - **Validates: Requirements 4.3, 9.3**
  
  - [x] 1.5 Add unit tests for Sequential_Scheduler
    - Test successful sequential sending
    - Test error handling and continuation
    - Test progress callback invocation
    - Test queue size validation
    - _Requirements: 4.3, 9.3, 10.6_

- [x] 2. Checkpoint - Verify Sequential_Scheduler works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement EntitySelector UI component
  - [x] 3.1 Create EntitySelector component with multi-selection interface
    - Create EntitySelector.tsx in composer/components directory
    - Implement searchable entity list with checkboxes
    - Add search input with filtering by name, location, status
    - Display selected entity count
    - Add "Remove" button for each selected entity
    - Implement "Select All" with confirmation dialog
    - Add pagination (50 entities per page)
    - Implement search debouncing (300ms)
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.9, 7.3, 7.4, 10.1, 10.4_
  
  - [ ]* 3.2 Write property test for entity filtering correctness
    - **Property 2: Entity Filtering Correctness**
    - **Validates: Requirements 1.4**
  
  - [ ]* 3.3 Write property test for selection count validation
    - **Property 3: Selection Count Validation**
    - **Validates: Requirements 1.5**
  
  - [x] 3.4 Add unit tests for EntitySelector component
    - Test entity list rendering
    - Test checkbox selection/deselection
    - Test search filtering
    - Test "Select All" confirmation dialog
    - Test pagination controls
    - Test maximum selection limit (100 entities)
    - _Requirements: 1.2, 1.3, 1.5, 1.8, 10.1_

- [x] 4. Checkpoint - Verify EntitySelector renders and functions correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate EntitySelector into ComposerWizard
  - [x] 5.1 Add multi-entity mode toggle to ComposerWizard Step 2
    - Add Switch component for "Send to multiple schools"
    - Add selectedEntityIds field to form schema
    - Add useMultiEntity state management
    - Conditionally render EntitySelector or existing single-recipient input
    - _Requirements: 7.1, 7.2, 7.9_
  
  - [x] 5.2 Wire EntitySelector to form state
    - Connect EntitySelector onSelectionChange to form setValue
    - Display selected entities in form
    - Add validation for empty selection
    - _Requirements: 1.6, 7.3, 9.1_
  
  - [x] 5.3 Add unit tests for ComposerWizard integration
    - Test multi-entity mode toggle
    - Test EntitySelector visibility based on mode
    - Test form validation with no entities selected
    - Test backward compatibility with single-recipient mode
    - _Requirements: 7.1, 7.2, 8.2, 9.1_

- [x] 6. Implement progress tracking and summary reporting
  - [x] 6.1 Add progress tracking UI to ComposerWizard
    - Create sendProgress state (sent, total, errors)
    - Display progress bar during sequential sending
    - Show real-time count of sent/remaining messages
    - _Requirements: 4.5, 7.5_
  
  - [x] 6.2 Add summary reporting after bulk send
    - Display success/failure counts in toast or modal
    - Show list of failed entities with error messages
    - Provide option to retry failed entities
    - _Requirements: 5.7, 9.4_
  
  - [ ]* 6.3 Write property test for progress tracking accuracy
    - **Property 14: Progress Tracking Accuracy**
    - **Validates: Requirements 4.5**
  
  - [ ]* 6.4 Write property test for summary report accuracy
    - **Property 16: Summary Report Accuracy**
    - **Validates: Requirements 5.7**
  
  - [x] 6.5 Add unit tests for progress tracking
    - Test progress bar updates during sending
    - Test summary report displays correct counts
    - Test error list displays failed entities
    - _Requirements: 4.5, 5.7, 9.4_

- [x] 7. Checkpoint - Verify progress tracking and reporting work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Enhance ComposerWizard submit handler for multi-entity mode
  - [x] 8.1 Update onSubmit handler to support multi-entity sending
    - Check useMultiEntity flag in submit handler
    - Call scheduleMultiEntityMessages for multi-entity mode
    - Pass progress callbacks to Sequential_Scheduler
    - Handle errors and display summary
    - Preserve existing single-recipient logic
    - _Requirements: 3.1, 4.1, 8.1, 8.2_
  
  - [x] 8.2 Add message count preview before submission
    - Display estimated message count based on selected entities
    - Show warning when count exceeds 50 messages
    - Disable submit button when no entities selected
    - _Requirements: 3.6, 7.5, 7.6, 7.7_
  
  - [x] 8.3 Add unit tests for submit handler
    - Test multi-entity mode invokes Sequential_Scheduler
    - Test single-recipient mode uses existing sendMessage
    - Test submit button disabled with no selection
    - Test warning displayed for large message counts
    - _Requirements: 7.6, 7.7, 8.1, 8.2, 9.1_

- [x] 9. Add backward compatibility and integration tests
  - [x] 9.1 Test backward compatibility with existing workflows
    - Verify single-recipient mode still works
    - Verify CSV bulk upload still works
    - Verify scheduled messages still work
    - Verify attachments still work
    - Verify contextual binding features still work
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [x] 9.2 Test end-to-end multi-entity flow
    - Select multiple entities from EntitySelector
    - Submit message and verify Sequential_Scheduler is called
    - Verify progress tracking updates correctly
    - Verify summary report displays after completion
    - _Requirements: 1.2, 3.1, 4.5, 5.7_
  
  - [ ]* 9.3 Write property test for schoolId parameter passing
    - **Property 8: SchoolId Parameter Passing**
    - **Validates: Requirements 3.3, 6.5**

- [x] 10. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Optional: Implement ContactSelector for multi-contact within entity
  - [x] 11.1 Create ContactSelector component
    - Display Focal_Person records for selected entity
    - Filter contacts by channel (email/SMS)
    - Support multi-selection with checkboxes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 11.2 Integrate ContactSelector into ComposerWizard
    - Display ContactSelector when single entity selected
    - Wire to form state
    - Update Sequential_Scheduler to handle multiple contacts per entity
    - _Requirements: 2.6, 2.7, 2.8, 3.7_
  
  - [x] 11.3 Add tests for ContactSelector
    - Test contact list rendering
    - Test channel-based filtering
    - Test multi-selection
    - _Requirements: 2.1, 2.4, 2.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Focus is on adding new components without modifying existing code
- Sequential_Scheduler is the core orchestration layer that calls existing sendMessage
- EntitySelector is the primary UI component for multi-entity selection
- ContactSelector (Requirement 2) is entirely optional and deferred

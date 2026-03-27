# Requirements Document: Multi-Contact Messaging

## Introduction

This feature enhances the existing messaging portal (ComposerWizard) to support sending messages to multiple entities (schools/scores) at once, with optional support for selecting multiple contacts within each entity. The current system supports single-recipient messaging and bulk CSV upload, but lacks the ability to select multiple schools from the UI and send to them in one operation. This enhancement integrates with the existing messaging infrastructure to enable multi-entity selection and sequential message scheduling to avoid overwhelming the gateway.

## Glossary

- **Messaging_Portal**: The existing ComposerWizard component that provides the user interface for composing and sending messages
- **Message_Engine**: The existing sendMessage function in messaging-engine.ts that handles individual message dispatch
- **Entity**: A school or institution in the system (stored in the schools collection or entities collection via Contact Adapter)
- **Focal_Person**: A contact associated with an entity, with properties including name, email, phone, and type (role)
- **Message_Queue**: A sequential list of messages to be sent one after another
- **Gateway**: The external service provider (mNotify for SMS, Resend for email) that delivers messages
- **Sequential_Scheduler**: A new orchestration layer that queues and sends messages one after another using the existing sendMessage function

## Requirements

### Requirement 1: Multi-Entity Selection (PRIMARY)

**User Story:** As a messaging administrator, I want to select multiple schools at once, so that I can send messages to contacts across different institutions efficiently without creating separate messages or uploading a CSV.

#### Acceptance Criteria

1. THE Messaging_Portal SHALL provide a UI component for selecting multiple entities in the existing single mode
2. THE entity selector SHALL display a searchable list of all entities in the database
3. THE entity selector SHALL provide checkboxes for selecting multiple entities
4. THE entity selector SHALL support filtering entities by name, location, and status
5. THE Messaging_Portal SHALL allow users to select between 1 and 100 entities per message
6. WHEN multiple entities are selected, THE entity selector SHALL display the count of selected entities
7. THE entity selector SHALL provide a "Select All" option with appropriate safeguards
8. WHEN the "Select All" option is used, THE Messaging_Portal SHALL display a confirmation dialog showing the total number of entities and estimated message count
9. THE entity selector SHALL allow users to deselect individual entities from the selection
10. THE existing single-recipient manual input field SHALL remain available as an alternative

### Requirement 2: Multi-Contact Selection within Entity (OPTIONAL)

**User Story:** As a messaging administrator, I want to optionally select multiple contacts within a single school, so that I can send the same message to different focal persons when needed.

#### Acceptance Criteria

1. WHEN a user selects a single entity, THE Messaging_Portal MAY display all Focal_Person records associated with that Entity
2. IF multi-contact selection is implemented, THE contact selector SHALL display each Focal_Person with their name, role (type), email, and phone number
3. IF multi-contact selection is implemented, THE contact selector SHALL provide checkboxes for selecting multiple Focal_Person records
4. WHEN the message channel is email, THE contact selector SHALL only show Focal_Person records with valid email addresses
5. WHEN the message channel is SMS, THE contact selector SHALL only show Focal_Person records with valid phone numbers
6. THE Messaging_Portal SHALL allow users to select between 1 and 50 contacts per entity
7. THE contact selector SHALL indicate the total number of selected contacts
8. WHEN a user changes the selected entity, THE contact selector SHALL reset the contact selection state
9. THIS requirement is OPTIONAL and can be deferred to a future release

### Requirement 3: Contact Resolution for Multiple Entities

**User Story:** As a messaging administrator, I want the system to automatically determine which contact to message for each selected school, so that messages reach the appropriate recipients using the existing contact resolution logic.

#### Acceptance Criteria

1. WHEN multiple entities are selected, THE Sequential_Scheduler SHALL use the existing sendMessage function for each entity
2. THE existing sendMessage function already resolves the primary contact using the Contact Adapter Layer
3. THE Sequential_Scheduler SHALL pass the schoolId parameter to sendMessage for each selected entity
4. THE existing variable resolution logic in sendMessage SHALL handle entity-level and contact-level variables
5. WHEN an entity has no valid primary contact for the selected channel, THE Sequential_Scheduler SHALL log a warning and skip that Entity
6. THE Messaging_Portal SHALL display a preview showing the total number of messages that will be sent before submission
7. IF multi-contact selection is implemented (Requirement 2), THE Sequential_Scheduler SHALL send messages to all selected contacts for each entity

### Requirement 4: Sequential Message Scheduling

**User Story:** As a system administrator, I want messages to be sent sequentially rather than simultaneously, so that we avoid overwhelming the gateway and triggering rate limits.

#### Acceptance Criteria

1. WHEN multiple messages are queued for sending, THE Sequential_Scheduler SHALL call the existing sendMessage function for each message one after another
2. THE Sequential_Scheduler SHALL wait for each sendMessage call to complete before starting the next message
3. WHEN a message fails, THE Sequential_Scheduler SHALL log the failure and continue with the next message in the queue
4. THE Sequential_Scheduler SHALL implement a configurable delay between messages (default 500 milliseconds)
5. THE Messaging_Portal SHALL display real-time progress showing the number of messages sent and remaining
6. THE Sequential_Scheduler SHALL respect the existing scheduledAt parameter by passing it to each sendMessage call
7. THE existing sendMessage function already delegates scheduled message timing to external providers (mNotify/Resend)
8. THE Sequential_Scheduler SHALL NOT modify the existing sendMessage function signature or behavior

### Requirement 5: Individual Message Logging

**User Story:** As a compliance officer, I want each message to be logged individually with complete recipient information, so that we maintain a complete audit trail.

#### Acceptance Criteria

1. THE existing sendMessage function already creates individual message_logs entries
2. THE Sequential_Scheduler SHALL rely on the existing logging behavior of sendMessage
3. EACH message log SHALL automatically include the recipient email or phone number (existing behavior)
4. EACH message log SHALL automatically include the schoolId of the associated Entity (existing behavior)
5. EACH message log SHALL automatically include the resolved variables specific to that recipient (existing behavior)
6. THE Sequential_Scheduler MAY optionally add batch metadata to track related messages
7. THE Messaging_Portal SHALL provide a summary report after bulk sending showing successful and failed message counts
8. THE existing message logging structure and behavior SHALL NOT be modified

### Requirement 6: Variable Resolution for Multiple Recipients

**User Story:** As a messaging administrator, I want variables to be resolved correctly for each recipient, so that personalized information is accurate for each contact.

#### Acceptance Criteria

1. THE existing sendMessage function already resolves school-level variables (school_name, school_location, school_initials) from the Entity record
2. THE existing sendMessage function already resolves contact-level variables (contact_name, contact_email, contact_phone, contact_position) from the Focal_Person record
3. THE existing sendMessage function already resolves tag variables using the resolveTagVariables function
4. THE existing sendMessage function already resolves global constants from the messaging_variables collection
5. THE Sequential_Scheduler SHALL pass the schoolId parameter to sendMessage for each entity to trigger existing variable resolution
6. THE existing variable resolution logic SHALL NOT be modified
7. THE existing variable resolution priority SHALL be maintained: explicit variables > contact variables > tag variables > global constants

### Requirement 7: UI Enhancements for Multi-Selection

**User Story:** As a messaging administrator, I want a clear and intuitive interface for selecting multiple entities, so that I can efficiently compose messages without confusion.

#### Acceptance Criteria

1. THE Messaging_Portal SHALL add an entity selector component to the existing Step 2 (Identities & Resolution)
2. THE entity selector SHALL be displayed alongside or replace the existing single entity dropdown
3. THE Messaging_Portal SHALL display selected entities in a visually distinct section with entity details
4. THE Messaging_Portal SHALL provide a "Remove" button for each selected entity
5. THE Messaging_Portal SHALL display the estimated total message count prominently before submission
6. THE Messaging_Portal SHALL disable the submit button when no valid recipients are selected
7. THE Messaging_Portal SHALL display a warning when the message count exceeds 50 messages
8. THE Messaging_Portal SHALL provide a preview showing how the message will appear to the first selected recipient
9. THE existing single-recipient manual input field SHALL remain available as an alternative
10. THE existing contextual binding features (meetings, surveys, PDFs) SHALL continue to work

### Requirement 8: Backward Compatibility

**User Story:** As a system maintainer, I want the new multi-entity features to work alongside existing functionality, so that current workflows are not disrupted.

#### Acceptance Criteria

1. THE existing sendMessage function SHALL NOT be modified (signature, behavior, or logic)
2. THE Messaging_Portal SHALL continue to support the existing single-recipient mode with manual recipient input
3. THE Messaging_Portal SHALL continue to support the existing bulk CSV upload mode
4. THE existing scheduledAt parameter SHALL continue to work for delayed sending
5. THE existing attachments parameter SHALL continue to work for email messages
6. THE existing contextual binding features (meetings, surveys, PDFs) SHALL continue to work
7. THE existing Contact Adapter Layer SHALL continue to be used for contact resolution
8. THE existing variable resolution logic SHALL NOT be modified
9. THE existing message logging structure SHALL NOT be modified
10. ALL existing tests SHALL continue to pass without modification

### Requirement 9: Error Handling and Validation

**User Story:** As a messaging administrator, I want clear error messages when something goes wrong, so that I can correct issues and successfully send messages.

#### Acceptance Criteria

1. WHEN a user attempts to send messages without selecting any entities, THE Messaging_Portal SHALL display an error message "No recipients selected"
2. WHEN an entity has no valid contacts for the selected channel, THE Sequential_Scheduler SHALL log a warning and skip that Entity
3. WHEN the existing sendMessage function returns an error, THE Sequential_Scheduler SHALL log the error and continue with the next message
4. WHEN the Sequential_Scheduler encounters repeated failures, THE Messaging_Portal SHALL display an error summary with the number of failed messages
5. THE Messaging_Portal SHALL display a confirmation dialog when the user attempts to send more than 100 messages at once
6. THE existing error handling in sendMessage SHALL NOT be modified
7. THE existing validation logic SHALL continue to work

### Requirement 10: Performance Optimization

**User Story:** As a system administrator, I want the multi-entity messaging feature to perform efficiently, so that users experience minimal delays when composing and sending messages.

#### Acceptance Criteria

1. THE entity selector SHALL load and display entities using pagination (50 entities per page)
2. THE entity selector SHALL render entity lists without noticeable delay for up to 100 entities
3. THE Sequential_Scheduler SHALL process messages at a minimum rate of 2 messages per second
4. THE Messaging_Portal SHALL debounce search input in the entity selector with a 300ms delay
5. THE Messaging_Portal SHALL use React memoization to prevent unnecessary re-renders of entity lists
6. THE Sequential_Scheduler SHALL implement a maximum queue size of 500 messages to prevent memory issues
7. THE existing sendMessage function performance SHALL NOT be degraded

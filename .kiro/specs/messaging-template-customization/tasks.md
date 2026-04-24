# Implementation Tasks: Messaging Template Customization System

## Overview

These tasks implement the two-tier messaging template system as defined in the design document. Tasks are ordered by dependency — complete foundational layers before UI and integration work.

---

## Task 1: Extend Types and Schema

- [x] 1.1 Add `TemplateCategory`, `VariableContext`, `ReminderConfig`, and updated `MessageTemplate` interface to `src/lib/types.ts`
- [x] 1.2 Add `TemplateVariable` interface to `src/lib/types.ts`
- [x] 1.3 Add `ScheduledMessage` interface to `src/lib/types.ts`
- [x] 1.4 Add `ComposerContext` interface to `src/lib/types.ts`
- [x] 1.5 Add `REMINDER_OFFSETS` constant with the 5 predefined offsets (15min, 1hr, 2hr, 1day, time_up) to `src/lib/types.ts`

## Task 2: Variable Registry

- [x] 2.1 Create `src/lib/template-variable-registry.ts` with all static variable definitions for contexts: `common`, `meeting`, `form`, `survey`, `agreement`, `entity`
- [x] 2.2 Implement `getVariablesForContext(context: VariableContext): TemplateVariable[]` — returns static variables for a given context plus common variables
- [x] 2.3 Implement `registerFormVariables(formId: string, fields: FormField[]): Promise<void>` — writes dynamic form field variables to `template_variables` Firestore collection
- [x] 2.4 Implement `registerSurveyVariables(surveyId: string, elements: SurveyElement[]): Promise<void>` — writes dynamic survey question variables to `template_variables` collection
- [x] 2.5 Implement `getDynamicVariables(formId: string): Promise<TemplateVariable[]>` — fetches dynamic variables for a specific form or survey
- [x] 2.6 Write unit tests for variable registry functions in `src/lib/__tests__/template-variable-registry.test.ts`

## Task 3: Template Resolver

- [x] 3.1 Create `src/lib/template-resolver.ts`
- [x] 3.2 Implement `renderTemplate(body: string, variables: Record<string, any>): string` — replaces `{{var}}` placeholders; leaves unresolved vars as empty string
- [x] 3.3 Implement `resolveTemplateForOrg(category: TemplateCategory, type: string, orgId: string): Promise<MessageTemplate>` — checks org override first, falls back to global
- [x] 3.4 Implement `buildVariableMap(context: VariableContext, resolutionCtx: VariableResolutionContext): Promise<Record<string, any>>` — fetches and assembles variable values from Firestore based on context IDs
- [x] 3.5 Implement `resolveAndRender(category: TemplateCategory, type: string, orgId: string, resolutionCtx: VariableResolutionContext): Promise<{ subject?: string; body: string }>` — full pipeline: resolve template → build vars → render
- [x] 3.6 Write property-based tests using `fast-check` in `src/lib/__tests__/template-resolver.test.ts`:
  - Property: `renderTemplate` leaves no `{{...}}` placeholders in output when all vars are provided
  - Property: org override is always preferred over global when both exist
  - Property: scope isolation — org A template never returned for org B

## Task 4: Template Actions (CRUD)

- [x] 4.1 Create `src/lib/template-actions.ts`
- [x] 4.2 Implement `createGlobalTemplate(data: CreateTemplateInput): Promise<MessageTemplate>` — super admin only, sets `scope: 'global'`, `status: 'draft'`, `version: 1`
- [x] 4.3 Implement `updateGlobalTemplate(id: string, data: Partial<MessageTemplate>): Promise<void>` — increments version, validates super admin role
- [x] 4.4 Implement `deleteGlobalTemplate(id: string): Promise<void>` — checks no active scheduled messages reference this template before deleting
- [x] 4.5 Implement `createOrgOverride(globalTemplateId: string, orgId: string, overrideData: Partial<MessageTemplate>): Promise<MessageTemplate>` — copies global template, sets `scope: 'organization'`, links `globalTemplateId`
- [x] 4.6 Implement `updateOrgTemplate(id: string, orgId: string, data: Partial<MessageTemplate>): Promise<void>` — validates org admin role and org ownership
- [x] 4.7 Implement `revertToGlobal(orgTemplateId: string): Promise<void>` — deletes the org override document
- [x] 4.8 Implement `listTemplates(orgId: string, filters?: TemplateFilters): Promise<MessageTemplate[]>` — returns merged list: org overrides + global templates not overridden by org
- [x] 4.9 Implement `approveTemplate(id: string): Promise<void>` and `rejectTemplate(id: string, reason: string): Promise<void>` — status transitions with audit log entry
- [x] 4.10 Write unit tests in `src/lib/__tests__/template-actions.test.ts`

## Task 5: Reminder Scheduling

- [x] 5.1 Create `src/lib/reminder-actions.ts`
- [x] 5.2 Implement `scheduleRemindersForMeeting(meeting: Meeting, enabledTypes: string[], orgId: string): Promise<void>` — creates `ScheduledMessage` docs for each enabled reminder type
- [x] 5.3 Implement `cancelRemindersForMeeting(meetingId: string): Promise<void>` — sets status to `cancelled` for all pending reminders linked to the meeting
- [x] 5.4 Implement `rescheduleRemindersForMeeting(meeting: Meeting, orgId: string): Promise<void>` — cancels existing reminders and creates new ones based on updated meeting time
- [x] 5.5 Implement `scheduleFormReminders(formId: string, deadline: string, orgId: string, recipientEntityIds: string[]): Promise<void>` — schedules `1_day_before` and `2_hours_before` reminders
- [x] 5.6 Implement `processScheduledMessages(): Promise<{ sent: number; failed: number }>` — queries `scheduled_messages` where `status == 'pending'` and `scheduledAt <= now`, sends each via messaging engine, updates status
- [x] 5.7 Write unit tests in `src/lib/__tests__/reminder-actions.test.ts` verifying correct `scheduledAt` calculation for each offset type

## Task 6: Seed Global Default Templates

- [x] 6.1 Create `scripts/seed-global-templates.ts` migration script
- [x] 6.2 Seed all Meeting templates: `meeting_invitation` (email + sms), `meeting_confirmation` (email), `meeting_cancellation` (email + sms), `meeting_update` (email + sms)
- [x] 6.3 Seed all Meeting reminder templates: `meeting_reminder_15min`, `meeting_reminder_1hour`, `meeting_reminder_2hours`, `meeting_reminder_1day`, `meeting_time_up` (email + sms variants)
- [x] 6.4 Seed all Form templates: `form_invitation` (email + sms), `submission_confirmation` (email), `submission_reminder` (email + sms)
- [x] 6.5 Seed all Survey templates: `survey_invitation` (email + sms), `survey_completion` (email), `survey_reminder` (email + sms)
- [x] 6.6 Seed all Agreement templates: `contract_sent` (email), `contract_signed` (email), `contract_pending` (email + sms), `contract_reminder` (email + sms)
- [x] 6.7 Seed all General templates: `welcome_message` (email), `stage_change` (email + sms), `assignment_notification` (email), `status_update` (email + sms)
- [x] 6.8 Set all seeded templates to `scope: 'global'`, `status: 'approved'`, `isActive: true`



## Task 7: Schema Migration for Existing Templates

- [x] Task 7: Schema Migration for Existing Templates

- [x] 7.1 Create `scripts/migrate-existing-templates.ts`
- [x] 7.2 Add `scope: 'organization'` to all existing `message_templates` documents that lack the field
- [x] 7.3 Add `status: 'approved'` to all existing templates that lack the field
- [x] 7.4 Add `version: 1` to all existing templates that lack the field
- [x] 7.5 Add `category: 'general'` and `templateType: 'custom'` as defaults to existing templates
- [x] 7.6 Add new Firestore composite indexes to `firestore.indexes.json` for two-tier resolution queries and scheduled message processing

## Task 8: Back Office — Global Template Management UI

- [x] Task 8: Back Office — Global Template Management UI

- [x] 8.1 Create route `src/app/backoffice/messaging/templates/page.tsx` — global template list with category grouping, search, and filter by channel/status
- [x] 8.2 Create `src/app/backoffice/messaging/templates/new/page.tsx` — create global template form
- [x] 8.3 Create `src/app/backoffice/messaging/templates/[id]/page.tsx` — edit global template with version history panel
- [x] 8.4 Create shared `src/components/messaging/TemplateEditor.tsx` — rich text editor for email (using existing block editor pattern), plain text + char count for SMS
- [x] 8.5 Create `src/components/messaging/TemplateCard.tsx` — template list item showing name, category badge, channel, status badge, and action buttons
- [x] 8.6 Create `src/components/messaging/ReminderConfig.tsx` — UI for configuring reminder offset and event type when `category === 'reminders'`
- [x] 8.7 Add template preview panel to the editor: renders template body with sample variable values, highlights unresolved variables in red
- [x] 8.8 Add "Send Test" action in the editor: sends rendered template to a specified email/phone using sample data

## Task 9: Organization Template Management UI

- [x] 9: Organization Template Management UI
- [x] 9.1 Create route `src/app/admin/settings/messaging/templates/page.tsx` — org template list showing global templates with override indicators
- [x] 9.2 Create `src/app/admin/settings/messaging/templates/[id]/override/page.tsx` — create or edit org override, pre-populated from global template
- [x] 9.3 Add "Override" button on global template cards visible to org admins — navigates to override creation page
- [x] 9.4 Add "Revert to Global" button on org override cards — calls `revertToGlobal` action with confirmation dialog
- [x] 9.5 Add visual diff view in the override editor comparing org content vs global content side-by-side
- [x] 9.6 Show "Overriding global template" badge on org templates that have a `globalTemplateId` set

## Task 10: Variable Picker Component

- [x] Task 10: Variable Picker Component
- [x] 10.1 Create `src/components/messaging/VariablePicker.tsx` — dropdown/popover showing available variables grouped by context
- [x] 10.2 Add search/filter within the variable picker
- [x] 10.3 On variable click, insert `{{variable_name}}` at the current cursor position in the editor
- [x] 10.4 Highlight all `{{variable}}` tokens in the template body editor with a distinct style (e.g. blue pill)
- [x] 10.5 Show tooltip on hover of a variable token displaying the variable's label and example value

## Task 11: Update Message Composer (ComposerWizard)

- [x] Task 11: Update Message Composer (ComposerWizard)
- [x] 11.1 Add `composerContext?: ComposerContext` prop to `ComposerWizard`
- [x] 11.2 Update the Firestore templates query in `ComposerWizard.tsx` to filter by `category` when `composerContext.category` is provided, and by `status: 'approved'`
- [x] 11.3 Update the template dropdown in Step 1 to group templates by `templateType` within the filtered category
- [x] 11.4 Integrate `VariablePicker` into Step 2 (Builder) of the composer
- [x] 11.5 Pass `composerContext` from all call sites that open the composer: meetings, forms, surveys, agreements pages
- [x] 11.6 Update the survey `AssigneeLinksModal` and similar modals that trigger messaging to pass the correct `composerContext`

## Task 12: Integrate Reminders into Meetings

- [x] Task 12: Integrate Reminders into Meetings

- [x] 12.1 Add reminder configuration UI to the meeting create/edit form — checkboxes for each reminder type (15min, 1hr, 2hr, 1day, time_up)
- [x] 12.2 Call `scheduleRemindersForMeeting` when a meeting is created with reminders enabled
- [x] 12.3 Call `rescheduleRemindersForMeeting` when a meeting's time is updated
- [x] 12.4 Call `cancelRemindersForMeeting` when a meeting is cancelled or deleted
- [x] 12.5 Display scheduled reminders list on the meeting detail page showing status (pending/sent/cancelled)

## Task 13: Integrate Dynamic Variables with Forms and Surveys
- [x] Task 13: Integrate Dynamic Variables with Forms and Surveys

- [x] 13.1 Call `registerFormVariables` from `pdf-actions.ts` when a PDF form is created or its fields are updated
- [x] 13.2 Call `registerSurveyVariables` from `survey-actions.ts` when a survey is created or its elements are updated
- [x] 13.3 Update `buildVariableMap` in `template-resolver.ts` to fetch and include dynamic form/survey field values when `formId` or `surveyId` is present in the resolution context

## Task 14: Scheduled Message Processor

- [x] Task 14: Scheduled Message Processor
- [x] 14.1 Create API route `src/app/api/cron/process-scheduled-messages/route.ts` — calls `processScheduledMessages()`, secured with a cron secret header
- [x] 14.2 Add the cron job configuration to `vercel.json` (or equivalent) to call the route every minute
- [x] 14.3 Add error handling and retry logic in `processScheduledMessages` — failed messages retry up to 3 times before marking as `failed`
- [x] 14.4 Write integration test for the processor verifying it only processes messages where `scheduledAt <= now` and `status === 'pending'`

## Task 15: Update Automation Engine Integration

- [x] Task 15: Update Automation Engine Integration
- [x] 15.1 Update `src/lib/automation-engine.ts` send-message action to use `resolveAndRender` from `template-resolver.ts` instead of direct template body lookup
- [x] 15.2 Add `templateCategory` and `templateType` fields to the automation send-message action config so automations can reference templates by category/type rather than hard-coded ID
- [x] 15.3 Validate that referenced templates exist and are `approved` when an automation is saved

## Task 16: Firestore Security Rules

- [x] 16.1 Add security rules for `message_templates` collection:
  - Global templates (`scope == 'global'`): read by all authenticated users, write only by super admins
  - Org templates (`scope == 'organization'`): read/write scoped to matching `organizationId`
- [x] 16.2 Add security rules for `template_variables` collection: read by all authenticated users, write by super admins and org admins
- [x] 16.3 Add security rules for `scheduled_messages` collection: read/write scoped to `organizationId`
- [x] 16.4 Write Firestore rules unit tests using `@firebase/rules-unit-testing`

## Task 17: End-to-End Tests

- [x] 17.1 Write E2E test: super admin creates a global meeting invitation template and it appears in the org template list
- [x] 17.2 Write E2E test: org admin overrides a global template and the override is used in the composer
- [x] 17.3 Write E2E test: org admin reverts override and global template is restored
- [x] 17.4 Write E2E test: composer opened from meeting context shows only meeting templates
- [x] 17.5 Write E2E test: meeting reminder is scheduled and appears in scheduled messages list

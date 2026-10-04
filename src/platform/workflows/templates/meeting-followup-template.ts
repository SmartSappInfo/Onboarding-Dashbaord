/**
 * @fileOverview Pre-Built Enterprise Workflow Template: Meeting Follow-Up Flow (Phase 7 Milestone 5)
 *
 * Implements a 4-step executive meeting follow-up sequence:
 * 1. fetch_meeting_transcript: Ingests meeting transcript and metadata
 * 2. save_episodic_memory: Commits conversation takeaways to Platform Memory
 * 3. create_crm_note: Logs meeting summary under related CRM contact/deal
 * 4. send_attendee_recap: Dispatches executive recap email with action items
 */

import type { WorkflowTemplateDefinition } from './workflow-template-types';

export const MeetingFollowUpWorkflow: WorkflowTemplateDefinition = {
  id: 'meeting_followup_v1',
  version: '1.0.0',
  name: 'Meeting Transcript Follow-Up Flow',
  description:
    '4-step executive meeting recap extracting key action items into episodic memory, CRM notes, and email.',
  category: 'crm',
  parameters: [
    {
      name: 'meetingId',
      type: 'string',
      description: 'Identifier of the recorded meeting session',
      required: true,
    },
    {
      name: 'attendees',
      type: 'array',
      description: 'List of attendee email addresses',
      required: false,
    },
  ],
  steps: [
    {
      id: 'fetch_meeting_transcript',
      name: 'Fetch Meeting Transcript',
      description: 'Loads the structured audio transcript and speaker diarization',
      capabilityId: 'meetings.get_transcript',
      dependsOn: [],
      isMutating: false,
      riskLevel: 'L0_READ',
      timeoutSeconds: 60,
      maxAttempts: 3,
      inputMapping: {
        meetingId: '{{inputs.meetingId}}',
      },
    },
    {
      id: 'save_episodic_memory',
      name: 'Index Episodic Memory',
      description: 'Generates 768-D vector embeddings and commits key decisions to company brain',
      capabilityId: 'memory.create_item',
      dependsOn: ['fetch_meeting_transcript'],
      isMutating: true,
      riskLevel: 'L2_STATE_MUTATION',
      timeoutSeconds: 120,
      maxAttempts: 3,
      inputMapping: {
        meetingId: '{{inputs.meetingId}}',
        tier: 'episodic',
      },
    },
    {
      id: 'create_crm_note',
      name: 'Create CRM Note',
      description: 'Appends executive takeaways directly to CRM record timeline',
      capabilityId: 'crm.create_note',
      dependsOn: ['save_episodic_memory'],
      isMutating: true,
      riskLevel: 'L2_STATE_MUTATION',
      timeoutSeconds: 120,
      maxAttempts: 3,
      inputMapping: {
        meetingId: '{{inputs.meetingId}}',
      },
    },
    {
      id: 'send_attendee_recap',
      name: 'Send Attendee Recap',
      description: 'Emails all attendees with meeting action items, owners, and due dates',
      capabilityId: 'messaging.send_email',
      dependsOn: ['create_crm_note'],
      isMutating: true,
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      timeoutSeconds: 180,
      maxAttempts: 3,
      inputMapping: {
        meetingId: '{{inputs.meetingId}}',
        attendees: '{{inputs.attendees}}',
      },
    },
  ],
};

/**
 * @fileOverview Pre-Built Enterprise Workflow Template: Lead Onboarding Flow (Phase 7 Milestone 5)
 *
 * Implements a 5-step deterministic lead onboarding sequence:
 * 1. create_contact: Creates contact record in CRM
 * 2. qualify_lead: Evaluates ICP fit and lead score
 * 3. send_welcome_email: Dispatches personalized welcome email
 * 4. wait_nurture_window: Schedules a 3-day nurture pause
 * 5. schedule_sdr_call: Creates calendar task for SDR follow-up
 */

import type { WorkflowTemplateDefinition } from './workflow-template-types';

export const LeadOnboardingWorkflow: WorkflowTemplateDefinition = {
  id: 'lead_onboarding_v1',
  version: '1.0.0',
  name: 'Lead Onboarding Flow',
  description:
    '5-step customer acquisition & onboarding sequence with automated qualification and nurture delay.',
  category: 'onboarding',
  parameters: [
    {
      name: 'email',
      type: 'string',
      description: 'Primary contact email for onboarding',
      required: true,
    },
    {
      name: 'fullName',
      type: 'string',
      description: 'Lead full name',
      required: false,
    },
    {
      name: 'company',
      type: 'string',
      description: 'Company organization name',
      required: false,
    },
  ],
  steps: [
    {
      id: 'create_contact',
      name: 'Create CRM Contact',
      description: 'Ingests the inbound lead into CRM system as a prospective contact',
      capabilityId: 'crm.create_contact',
      dependsOn: [],
      isMutating: true,
      riskLevel: 'L2_STATE_MUTATION',
      timeoutSeconds: 120,
      maxAttempts: 3,
      inputMapping: {
        email: '{{inputs.email}}',
        name: '{{inputs.fullName}}',
        company: '{{inputs.company}}',
      },
    },
    {
      id: 'qualify_lead',
      name: 'Qualify Inbound Lead',
      description: 'Scores the lead against ICP criteria based on company and domain',
      capabilityId: 'crm.qualify_lead',
      dependsOn: ['create_contact'],
      isMutating: false,
      riskLevel: 'L0_READ',
      timeoutSeconds: 60,
      maxAttempts: 3,
      inputMapping: {
        contactId: '{{steps.create_contact.output.contactId}}',
      },
    },
    {
      id: 'send_welcome_email',
      name: 'Send Welcome Email',
      description: 'Sends automated onboarding greeting and product overview link',
      capabilityId: 'crm.send_email',
      dependsOn: ['qualify_lead'],
      isMutating: true,
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      timeoutSeconds: 180,
      maxAttempts: 3,
      inputMapping: {
        to: '{{inputs.email}}',
        template: 'lead_welcome_v1',
      },
    },
    {
      id: 'wait_nurture_window',
      name: 'Wait Nurture Window',
      description: 'Pauses workflow execution for 3 days to allow lead evaluation',
      capabilityId: 'system.delay',
      dependsOn: ['send_welcome_email'],
      isMutating: false,
      waitCondition: {
        type: 'schedule',
        details: { delayDays: 3 },
      },
      timeoutSeconds: 300,
      maxAttempts: 1,
      inputMapping: {
        durationHours: 72,
      },
    },
    {
      id: 'schedule_sdr_call',
      name: 'Schedule SDR Call',
      description: 'Books an introductory call or creates a high-priority task for sales rep',
      capabilityId: 'crm.schedule_call',
      dependsOn: ['wait_nurture_window'],
      isMutating: true,
      riskLevel: 'L2_STATE_MUTATION',
      timeoutSeconds: 120,
      maxAttempts: 3,
      inputMapping: {
        contactId: '{{steps.create_contact.output.contactId}}',
        priority: 'high',
      },
    },
  ],
};

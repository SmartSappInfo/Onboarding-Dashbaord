import { describe, it, expect } from 'vitest';

/**
 * Tests for Action Node header text formatting logic.
 */
const ACTION_NAMES: Record<string, string> = {
  SEND_MESSAGE: 'Send Message',
  SEND_WHATSAPP: 'Send WhatsApp',
  DIRECT_EMAIL: 'Direct Email',
  DIRECT_SMS: 'Direct SMS',
  DIRECT_WHATSAPP: 'Direct WhatsApp',
  CREATE_TASK: 'Create Task',
  UPDATE_TASK: 'Update Task',
  CREATE_SCHOOL: 'Create School',
  CREATE_ENTITY: 'Create Entity',
  UPDATE_ENTITY: 'Update Entity',
  ASSIGN_ENTITY: 'Assign Entity',
  ADD_CONTACT_TO_ENTITY: 'Add Contact to Entity',
  UPDATE_CONTACT: 'Update Contact',
  ADD_TO_CALL_CAMPAIGN: 'Add to Call Campaign',
  END_AUTOMATION: 'End Automation',
  TRIGGER_OUTBOUND_WEBHOOK: 'Outbound Webhook',
  SEND_NOTIFICATION_EMAIL: 'Send Notification (Email)',
  SEND_NOTIFICATION_SMS: 'Send Notification (SMS)',
  SEND_NOTIFICATION_IN_APP: 'Send Notification (In-App)',
  SEND_NOTIFICATION_PUSH: 'Send Notification (Push)',
  RUN_AUTOMATION: 'Run Automation',
  ADD_NOTE: 'Add Note',
  CREATE_DEAL: 'Create Deal',
  UPDATE_DEAL_STAGE: 'Update Deal Stage',
  UPDATE_DEAL_VALUE: 'Update Deal Value',
  UPDATE_DEAL_STATUS: 'Update Deal Status',
  UPDATE_LEAD_SCORE: 'Adjust Lead Score',
};

function formatActionName(actionType?: string): string {
  if (!actionType) return 'Unconfigured';
  if (ACTION_NAMES[actionType]) return ACTION_NAMES[actionType];
  return actionType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

describe('Action Node Header Formatting', () => {
  it('formats configured action types into Action: {{Action Name}}', () => {
    expect(`Action: ${formatActionName('SEND_WHATSAPP')}`).toBe('Action: Send WhatsApp');
    expect(`Action: ${formatActionName('DIRECT_SMS')}`).toBe('Action: Direct SMS');
    expect(`Action: ${formatActionName('CREATE_DEAL')}`).toBe('Action: Create Deal');
    expect(`Action: ${formatActionName('CREATE_TASK')}`).toBe('Action: Create Task');
    expect(`Action: ${formatActionName('END_AUTOMATION')}`).toBe('Action: End Automation');
  });

  it('formats custom or unmapped snake_case action types cleanly', () => {
    expect(`Action: ${formatActionName('CUSTOM_SCRIPT')}`).toBe('Action: Custom Script');
  });

  it('returns Action: Unconfigured when actionType is empty or undefined', () => {
    expect(formatActionName(undefined)).toBe('Unconfigured');
    expect(formatActionName('')).toBe('Unconfigured');
  });
});

// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminDb } from '../firebase-admin';

// Mock FieldsVariablesService
const mockResolveTemplateVariables = vi.fn().mockImplementation(async (text: string) => {
  if (text.includes('{{entity_name}}')) {
    return text.replace('{{entity_name}}', 'Dominase Prep');
  }
  return text;
});

vi.mock('../services/fields-variables-service-impl', () => ({
  FieldsVariablesService: {
    resolveTemplateVariables: (...args: any[]) => mockResolveTemplateVariables(...args),
  },
}));

// Mock message actions
const mockHandleSendMessage = vi.fn().mockResolvedValue(undefined);
vi.mock('../automations/actions/message-actions', () => ({
  handleSendMessage: (...args: any[]) => mockHandleSendMessage(...args),
}));

// Mock firebase-admin
vi.mock('../firebase-admin', () => {
  const mockGet = vi.fn().mockImplementation(async () => ({
    exists: true,
    data: () => ({
      name: 'Fee Campaign',
      nodes: [
        {
          id: 'node_msg',
          type: 'actionNode',
          data: {
            config: {
              channel: 'email',
              templateId: 'tpl_123',
            },
          },
        },
      ],
    }),
  }));

  return {
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: mockGet,
        })),
      })),
    },
    FieldValue: {
      increment: (val: number) => ({ type: 'increment', value: val }),
    },
  };
});

// Import the function under test after mocks
import { processResendCheck } from '../automations/resend-jobs';

describe('Message Resend Engine Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves variables in resend variants and dispatches them', async () => {
    const job = {
      id: 'job_resend_123',
      automationId: 'auto_resend_123',
      runId: 'run_resend_123',
      targetNodeId: '__resend_check__',
      payload: {
        __resend: {
          nodeId: 'node_msg',
          attempt: 1,
          config: {
            maxResends: 2,
            resendDelayHours: 48,
            triggerCondition: 'no_open',
            variants: [
              {
                title: 'Reminder for {{entity_name}}',
                previewText: 'Hurry up!',
              },
            ],
          },
          entityId: 'ent_resend_123',
          workspaceId: 'ws_resend_123',
        },
        entity_name: 'Dominase Prep',
      },
    };

    // Mock run document snap (not engaged yet)
    vi.spyOn(adminDb, 'collection').mockImplementation((col) => {
      if (col === 'automation_runs') {
        return {
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({ status: 'running' }),
            }),
          }),
        };
      }
      if (col === 'message_logs') {
        return {
          where: () => ({
            get: async () => ({
              docs: [], // No opens/clicks logged -> contact not engaged
            }),
          }),
        };
      }
      // default mock for automations
      return {
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({
              nodes: [
                {
                  id: 'node_msg',
                  type: 'actionNode',
                  data: {
                    config: {
                      channel: 'email',
                      templateId: 'tpl_123',
                    },
                  },
                },
              ],
            }),
          }),
        }),
        add: async () => ({ id: 'new_job_id' }),
      };
    });

    const success = await processResendCheck(job);
    expect(success).toBe(true);

    // Verify resolveTemplateVariables was called
    expect(mockResolveTemplateVariables).toHaveBeenCalledWith(
      'Reminder for {{entity_name}}',
      expect.objectContaining({ entityId: 'ent_resend_123' })
    );

    // Verify handleSendMessage was called with the resolved subject
    expect(mockHandleSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email' }),
      expect.any(Object),
      'node_msg',
      expect.objectContaining({
        subject: 'Reminder for Dominase Prep',
        isResend: true,
        resendNumber: 1,
      })
    );
  });

  it('routes resends to alternative channel when failover is configured', async () => {
    const job = {
      id: 'job_resend_123',
      automationId: 'auto_resend_123',
      runId: 'run_resend_123',
      targetNodeId: '__resend_check__',
      payload: {
        __resend: {
          nodeId: 'node_msg',
          attempt: 1,
          config: {
            maxResends: 2,
            resendDelayHours: 48,
            triggerCondition: 'no_open',
            resendChannel: 'sms', // Failover to SMS channel
            variants: [
              {
                title: 'Alternative SMS Reminder',
              },
            ],
          },
          entityId: 'ent_resend_123',
          workspaceId: 'ws_resend_123',
        },
      },
    };

    vi.spyOn(adminDb, 'collection').mockImplementation((col) => {
      if (col === 'automation_runs') {
        return {
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({ status: 'running' }),
            }),
          }),
        };
      }
      if (col === 'message_logs') {
        return {
          where: () => ({
            get: async () => ({
              docs: [],
            }),
          }),
        };
      }
      return {
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({
              nodes: [
                {
                  id: 'node_msg',
                  type: 'actionNode',
                  data: {
                    config: {
                      channel: 'email', // Native channel is email
                      templateId: 'tpl_123',
                    },
                  },
                },
              ],
            }),
          }),
        }),
        add: async () => ({ id: 'new_job_id' }),
      };
    });

    const success = await processResendCheck(job);
    expect(success).toBe(true);

    // Verify handleSendMessage was called with channel overridden to sms
    expect(mockHandleSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'sms' }),
      expect.any(Object),
      'node_msg',
      expect.any(Object)
    );
  });
});

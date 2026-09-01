import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveFormNotificationSettingsAction,
  getWorkspaceNotificationTemplatesAction,
  evaluateAutoResponderCondition,
  dispatchFormNotifications,
} from '../form-notification-actions';
import type { Form } from '@/lib/types';
import type { AutoResponderRule } from '../form-notification-types';

// Mock firebase-admin
vi.mock('@/lib/firebase-admin', () => {
  const updateMock = vi.fn().mockResolvedValue({});
  const docMock = vi.fn((docId: string) => ({
    update: updateMock,
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ id: docId, workspaceId: 'ws_123' }),
    }),
  }));

  const collectionMock = vi.fn(() => ({
    doc: docMock,
    where: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        docs: [
          { id: 'tmpl_email_1', data: () => ({ name: 'Welcome Email', type: 'email', workspaceId: 'ws_123' }) },
          { id: 'tmpl_sms_1', data: () => ({ name: 'Receipt SMS', type: 'sms', workspaceId: 'ws_123' }) },
        ],
      }),
    })),
  }));

  return {
    adminDb: {
      collection: collectionMock,
    },
  };
});

// Mock notification and messaging engines
const mockTriggerInternalNotification = vi.fn().mockResolvedValue({ success: true });
const mockTriggerExternalNotification = vi.fn().mockResolvedValue({ success: true });
const mockSendMessage = vi.fn().mockResolvedValue({ success: true, messageId: 'msg_123' });

vi.mock('@/lib/notification-engine', () => ({
  triggerInternalNotification: (...args: unknown[]) => mockTriggerInternalNotification(...args),
  triggerExternalNotification: (...args: unknown[]) => mockTriggerExternalNotification(...args),
}));

vi.mock('@/lib/messaging-engine', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

describe('SmartSapp Forms 2.0: 3-Tier Notification & Auto-Responder Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveFormNotificationSettingsAction', () => {
    it('validates empty formId', async () => {
      const res = await saveFormNotificationSettingsAction('', {});
      expect(res.success).toBe(false);
    });

    it('successfully saves notification settings', async () => {
      const res = await saveFormNotificationSettingsAction('form_123', {
        internalAlerts: { enabled: true, userIds: ['user_1'] },
        respondentAlerts: { enabled: true, respondentEmailField: 'email' },
      });
      expect(res.success).toBe(true);
    });
  });

  describe('getWorkspaceNotificationTemplatesAction', () => {
    it('fetches message templates for workspace', async () => {
      const res = await getWorkspaceNotificationTemplatesAction('ws_123');
      expect(res.success).toBe(true);
      expect(res.templates.length).toBe(2);
    });
  });

  describe('evaluateAutoResponderCondition', () => {
    it('evaluates immediate trigger as true', () => {
      const rule: AutoResponderRule = {
        id: 'r1',
        name: 'Immediate Rule',
        enabled: true,
        triggerType: 'immediate',
        channel: 'email',
        templateId: 'tmpl_1',
      };
      expect(evaluateAutoResponderCondition(rule, {})).toBe(true);
    });

    it('evaluates score threshold trigger correctly', () => {
      const rule: AutoResponderRule = {
        id: 'r2',
        name: 'High Score VIP',
        enabled: true,
        triggerType: 'score_threshold',
        minScore: 80,
        channel: 'email',
        templateId: 'tmpl_vip',
      };

      expect(evaluateAutoResponderCondition(rule, {}, 85)).toBe(true);
      expect(evaluateAutoResponderCondition(rule, {}, 60)).toBe(false);
    });

    it('evaluates conditional field comparison rules', () => {
      const rule: AutoResponderRule = {
        id: 'r3',
        name: 'Ghana Branch Welcome',
        enabled: true,
        triggerType: 'conditional',
        condition: {
          fieldId: 'country',
          operator: 'equals',
          value: 'Ghana',
        },
        channel: 'sms',
        templateId: 'tmpl_gh',
      };

      expect(evaluateAutoResponderCondition(rule, { country: 'Ghana' })).toBe(true);
      expect(evaluateAutoResponderCondition(rule, { country: 'Nigeria' })).toBe(false);
    });
  });

  describe('dispatchFormNotifications', () => {
    const mockForm: Form = {
      id: 'form_123',
      workspaceId: 'ws_123',
      organizationId: 'org_123',
      title: 'Admissions 2026',
      internalName: 'Admissions 2026',
      slug: 'admissions-2026',
      formType: 'global',
      status: 'published',
      fields: [],
      submissionCount: 0,
      theme: { preset: 'minimal' },
      successBehavior: { type: 'message', message: 'Thank you for your submission.' },
      createdBy: { userId: 'u1', name: 'Admin', email: 'admin@example.com' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actions: {
        tags: [],
        automations: [],
        webhooks: [],
        notifications: {
          internalAlerts: {
            enabled: true,
            userIds: ['user_admin'],
            notifyDealOwner: true,
            emailTemplateId: 'tmpl_email_internal',
          },
          respondentAlerts: {
            enabled: true,
            respondentEmailField: 'email',
            respondentPhoneField: 'phone',
            emailTemplateId: 'tmpl_email_receipt',
            autoResponderRules: [
              {
                id: 'rule_vip',
                name: 'VIP Acceptance',
                enabled: true,
                triggerType: 'score_threshold',
                minScore: 70,
                channel: 'email',
                templateId: 'tmpl_email_vip',
              },
            ],
          },
          externalAlerts: {
            enabled: true,
            emailAddresses: ['stakeholder@example.com'],
            emailTemplateId: 'tmpl_email_external',
          },
        },
      },
    };

    it('dispatches Tier 1, Tier 2, and Tier 3 notifications successfully', async () => {
      const result = await dispatchFormNotifications({
        form: mockForm,
        submissionId: 'sub_999',
        submissionData: {
          email: 'applicant@example.com',
          phone: '+233241234567',
        },
        totalScore: 85,
        assignedDealOwnerId: 'user_rep_2',
        resolvedEntityId: 'contact_888',
        automationVars: { 'form.title': 'Admissions 2026' },
      });

      expect(result.dispatchedTiers).toContain('tier_1_internal');
      expect(result.dispatchedTiers).toContain('tier_2_respondent');
      expect(result.dispatchedTiers).toContain('tier_3_external');
      expect(result.errors.length).toBe(0);

      // Verify internal notification received deal owner
      expect(mockTriggerInternalNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          specificUserIds: expect.arrayContaining(['user_admin', 'user_rep_2']),
        })
      );

      // Verify respondent messaging engine called for receipt & VIP rule
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'applicant@example.com',
          templateId: 'tmpl_email_receipt',
        })
      );
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'applicant@example.com',
          templateId: 'tmpl_email_vip',
        })
      );

      // Verify external notification called via messaging engine
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'stakeholder@example.com',
          templateId: 'tmpl_email_external',
        })
      );
    });

    it('handles provider dispatch errors gracefully without throwing', async () => {
      mockTriggerInternalNotification.mockRejectedValueOnce(new Error('SMTP Gateway Timeout'));

      const result = await dispatchFormNotifications({
        form: mockForm,
        submissionId: 'sub_999',
        submissionData: { email: 'applicant@example.com' },
        automationVars: {},
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('SMTP Gateway Timeout');
    });
  });
});

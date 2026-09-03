import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  InvitationDispatchService,
  type WorkforceInvitationDispatchInput,
} from '../invitation-dispatch-service';

// Mock dependencies
vi.mock('@/lib/resend-service', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/mnotify-service', () => ({
  sendSms: vi.fn(),
}));

vi.mock('@/lib/whatsapp/whatsapp-send', () => ({
  sendWhatsApp: vi.fn(),
}));

const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockDocGet = vi.fn().mockResolvedValue({
  exists: true,
  data: () => ({ name: 'Acme Academy' }),
});

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((_colName: string) => ({
      doc: vi.fn((_id?: string) => ({
        get: mockDocGet,
        update: mockDocUpdate,
      })),
    })),
  },
}));

describe('InvitationDispatchService Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseInput: WorkforceInvitationDispatchInput = {
    invitationId: 'inv-123',
    organizationId: 'org-456',
    organizationName: 'Acme Academy',
    email: 'newhire@acme.edu',
    invitedPersonName: 'Alex Doe',
    phone: '+233241234567',
    rawToken: 'abcdef1234567890abcdef1234567890',
    workspaceName: 'Secondary Campus',
    roleNames: ['Teacher', 'Department Head'],
    channels: ['email'],
    baseUrl: 'https://app.smartsapp.com',
  };

  describe('Email Channel Dispatch', () => {
    it('successfully dispatches email and records sent status', async () => {
      const { sendEmail } = await import('@/lib/resend-service');
      vi.mocked(sendEmail).mockResolvedValueOnce({ id: 'resend-msg-001' } as never);

      const result = await InvitationDispatchService.dispatch(baseInput);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(sendEmail).mock.calls[0][0];
      expect(callArgs.to).toBe('newhire@acme.edu');
      expect(callArgs.subject).toContain('Acme Academy');
      expect(callArgs.html).toContain('https://app.smartsapp.com/accept-invitation?token=abcdef1234567890abcdef1234567890');

      expect(result.success).toBe(true);
      expect(result.channels.email?.status).toBe('sent');
      expect(result.channels.email?.error).toBeUndefined();
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          'channels.email.status': 'sent',
        })
      );
    });

    it('captures Resend failure with descriptive error when sendEmail throws', async () => {
      const { sendEmail } = await import('@/lib/resend-service');
      vi.mocked(sendEmail).mockRejectedValueOnce(new Error('RESEND_API_KEY is not configured'));

      const result = await InvitationDispatchService.dispatch(baseInput);

      expect(result.success).toBe(false);
      expect(result.channels.email?.status).toBe('failed');
      expect(result.channels.email?.error).toContain('RESEND_API_KEY is not configured');
      expect(result.warnings).toContain('Email dispatch failed: RESEND_API_KEY is not configured');
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          'channels.email.status': 'failed',
          'channels.email.error': 'RESEND_API_KEY is not configured',
        })
      );
    });
  });

  describe('SMS Channel Dispatch', () => {
    it('successfully dispatches SMS when phone is provided', async () => {
      const { sendSms } = await import('@/lib/mnotify-service');
      vi.mocked(sendSms).mockResolvedValueOnce({ status: 'success' } as never);

      const result = await InvitationDispatchService.dispatch({
        ...baseInput,
        channels: ['sms'],
      });

      expect(sendSms).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(sendSms).mock.calls[0];
      expect(callArgs[0].recipient).toBe('+233241234567');
      expect(callArgs[0].message).toContain('https://app.smartsapp.com/accept-invitation?token=');

      expect(result.success).toBe(true);
      expect(result.channels.sms?.status).toBe('sent');
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          'channels.sms.status': 'sent',
        })
      );
    });

    it('fails SMS channel when phone is missing', async () => {
      const { sendSms } = await import('@/lib/mnotify-service');

      const result = await InvitationDispatchService.dispatch({
        ...baseInput,
        phone: undefined,
        channels: ['sms'],
      });

      expect(sendSms).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.channels.sms?.status).toBe('failed');
      expect(result.channels.sms?.error).toContain('Recipient phone number is required');
    });

    it('captures SMS provider rejection with error message', async () => {
      const { sendSms } = await import('@/lib/mnotify-service');
      vi.mocked(sendSms).mockRejectedValueOnce(new Error('Insufficient SMS balance'));

      const result = await InvitationDispatchService.dispatch({
        ...baseInput,
        channels: ['sms'],
      });

      expect(result.success).toBe(false);
      expect(result.channels.sms?.status).toBe('failed');
      expect(result.channels.sms?.error).toBe('Insufficient SMS balance');
      expect(result.warnings).toContain('SMS dispatch failed: Insufficient SMS balance');
    });
  });

  describe('WhatsApp Channel Dispatch', () => {
    it('successfully dispatches WhatsApp message', async () => {
      const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');
      vi.mocked(sendWhatsApp).mockResolvedValueOnce({
        metaMessageId: 'wamid.HBgL...',
        status: 'sent',
      });

      const result = await InvitationDispatchService.dispatch({
        ...baseInput,
        channels: ['whatsapp'],
      });

      expect(sendWhatsApp).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(sendWhatsApp).mock.calls[0][0];
      expect(callArgs.recipient).toBe('+233241234567');
      expect(callArgs.organizationId).toBe('org-456');
      expect(callArgs.resolvedBody).toContain('https://app.smartsapp.com/accept-invitation?token=');

      expect(result.success).toBe(true);
      expect(result.channels.whatsapp?.status).toBe('sent');
    });

    it('fails WhatsApp channel when phone is missing', async () => {
      const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');

      const result = await InvitationDispatchService.dispatch({
        ...baseInput,
        phone: '',
        channels: ['whatsapp'],
      });

      expect(sendWhatsApp).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.channels.whatsapp?.status).toBe('failed');
      expect(result.channels.whatsapp?.error).toContain('Recipient phone number is required');
    });

    it('captures WhatsApp unconfigured connection error', async () => {
      const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');
      vi.mocked(sendWhatsApp).mockRejectedValueOnce(
        new Error('No WhatsApp connection configured for this organization.')
      );

      const result = await InvitationDispatchService.dispatch({
        ...baseInput,
        channels: ['whatsapp'],
      });

      expect(result.success).toBe(false);
      expect(result.channels.whatsapp?.status).toBe('failed');
      expect(result.channels.whatsapp?.error).toContain('No WhatsApp connection configured');
      expect(result.warnings).toContain(
        'WhatsApp dispatch failed: No WhatsApp connection configured for this organization.'
      );
    });
  });

  describe('Multi-Channel Partial & Complete Failures', () => {
    it('returns success: true with warnings when Email succeeds but SMS fails', async () => {
      const { sendEmail } = await import('@/lib/resend-service');
      const { sendSms } = await import('@/lib/mnotify-service');
      vi.mocked(sendEmail).mockResolvedValueOnce({ id: 'msg-1' } as never);
      vi.mocked(sendSms).mockRejectedValueOnce(new Error('Gateway timeout'));

      const result = await InvitationDispatchService.dispatch({
        ...baseInput,
        channels: ['email', 'sms'],
      });

      expect(result.success).toBe(true);
      expect(result.channels.email?.status).toBe('sent');
      expect(result.channels.sms?.status).toBe('failed');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toBe('SMS dispatch failed: Gateway timeout');
    });

    it('returns success: false when all requested channels fail', async () => {
      const { sendEmail } = await import('@/lib/resend-service');
      const { sendSms } = await import('@/lib/mnotify-service');
      const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');

      vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Domain not verified'));
      vi.mocked(sendSms).mockRejectedValueOnce(new Error('Invalid phone format'));
      vi.mocked(sendWhatsApp).mockRejectedValueOnce(new Error('WABA disconnected'));

      const result = await InvitationDispatchService.dispatch({
        ...baseInput,
        channels: ['email', 'sms', 'whatsapp'],
      });

      expect(result.success).toBe(false);
      expect(result.channels.email?.status).toBe('failed');
      expect(result.channels.sms?.status).toBe('failed');
      expect(result.channels.whatsapp?.status).toBe('failed');
      expect(result.warnings).toHaveLength(3);
    });
  });

  describe('User Credentials Invitation Dispatch', () => {
    it('dispatches credentials across Email, SMS, and WhatsApp', async () => {
      const { sendEmail } = await import('@/lib/resend-service');
      const { sendSms } = await import('@/lib/mnotify-service');
      const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');

      vi.mocked(sendEmail).mockResolvedValueOnce({ id: 'resend-cred-001' } as never);
      vi.mocked(sendSms).mockResolvedValueOnce({ status: 'success' } as never);
      vi.mocked(sendWhatsApp).mockResolvedValueOnce({
        metaMessageId: 'wamid.123',
        status: 'sent',
      });

      const res = await InvitationDispatchService.dispatchUserCredentials({
        userId: 'usr-999',
        organizationId: 'org-456',
        organizationName: 'Acme Academy',
        email: 'john@acme.edu',
        fullName: 'John Doe',
        phone: '+233241234567',
        tempPassword: 'SecretPassword123!',
        loginUrl: 'https://app.smartsapp.com/login',
        channels: ['email', 'sms', 'whatsapp'],
      });

      expect(res.success).toBe(true);
      expect(res.channels.email?.status).toBe('sent');
      expect(res.channels.sms?.status).toBe('sent');
      expect(res.channels.whatsapp?.status).toBe('sent');
      expect(sendEmail).toHaveBeenCalled();
      expect(sendSms).toHaveBeenCalled();
      expect(sendWhatsApp).toHaveBeenCalled();
    });

    it('captures failures in credentials dispatch without crashing', async () => {
      const { sendEmail } = await import('@/lib/resend-service');
      vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Resend rate limited'));

      const res = await InvitationDispatchService.dispatchUserCredentials({
        userId: 'usr-999',
        organizationId: 'org-456',
        organizationName: 'Acme Academy',
        email: 'john@acme.edu',
        fullName: 'John Doe',
        phone: '',
        tempPassword: 'SecretPassword123!',
        loginUrl: 'https://app.smartsapp.com/login',
        channels: ['email', 'sms'],
      });

      expect(res.success).toBe(false);
      expect(res.channels.email?.status).toBe('failed');
      expect(res.channels.email?.error).toContain('Resend rate limited');
      expect(res.channels.sms?.status).toBe('failed');
      expect(res.channels.sms?.error).toContain('Recipient phone number is required');
      expect(res.warnings).toHaveLength(2);
    });
  });

  describe('Password Reset Notification Dispatch', () => {
    it('dispatches appropriate password reset messages across Email, SMS, and WhatsApp', async () => {
      const { sendEmail } = await import('@/lib/resend-service');
      const { sendSms } = await import('@/lib/mnotify-service');
      const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');

      vi.mocked(sendEmail).mockResolvedValueOnce({ id: 'resend-reset-001' } as never);
      vi.mocked(sendSms).mockResolvedValueOnce({ status: 'success' } as never);
      vi.mocked(sendWhatsApp).mockResolvedValueOnce({
        metaMessageId: 'wamid.reset456',
        status: 'sent',
      });

      const res = await InvitationDispatchService.dispatchPasswordReset({
        userId: 'usr-reset-1',
        organizationId: 'org-456',
        organizationName: 'Acme Academy',
        email: 'sarah@acme.edu',
        fullName: 'Sarah Connor',
        phone: '+233241234567',
        tempPassword: 'TemporaryKey789!',
        loginUrl: 'https://app.smartsapp.com/login',
        channels: ['email', 'sms', 'whatsapp'],
      });

      expect(res.success).toBe(true);
      expect(res.channels.email?.status).toBe('sent');
      expect(res.channels.sms?.status).toBe('sent');
      expect(res.channels.whatsapp?.status).toBe('sent');

      // Email template checks
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = vi.mocked(sendEmail).mock.calls[0][0];
      expect(emailArgs.to).toBe('sarah@acme.edu');
      expect(emailArgs.subject).toContain('Password Reset');
      expect(emailArgs.html).toContain('TemporaryKey789!');
      expect(emailArgs.html).toContain('https://app.smartsapp.com/login');

      // SMS template checks
      expect(sendSms).toHaveBeenCalledTimes(1);
      const smsArgs = vi.mocked(sendSms).mock.calls[0][0];
      expect(smsArgs.recipient).toBe('+233241234567');
      expect(smsArgs.message).toContain('password has been reset');
      expect(smsArgs.message).toContain('TemporaryKey789!');

      // WhatsApp template checks
      expect(sendWhatsApp).toHaveBeenCalledTimes(1);
      const waArgs = vi.mocked(sendWhatsApp).mock.calls[0][0];
      expect(waArgs.recipient).toBe('+233241234567');
      expect(waArgs.resolvedBody).toContain('password has been reset');
      expect(waArgs.resolvedBody).toContain('TemporaryKey789!');

      // Verify Firestore update on user document
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordResetDelivery: expect.objectContaining({
            email: expect.objectContaining({ status: 'sent' }),
            sms: expect.objectContaining({ status: 'sent' }),
            whatsapp: expect.objectContaining({ status: 'sent' }),
          }),
        })
      );
    });

    it('captures password reset delivery failures across channels with descriptive warnings', async () => {
      const { sendEmail } = await import('@/lib/resend-service');
      const { sendWhatsApp } = await import('@/lib/whatsapp/whatsapp-send');

      vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Resend invalid API key'));
      vi.mocked(sendWhatsApp).mockRejectedValueOnce(new Error('WhatsApp WABA token expired'));

      const res = await InvitationDispatchService.dispatchPasswordReset({
        userId: 'usr-reset-2',
        organizationId: 'org-456',
        organizationName: 'Acme Academy',
        email: 'sarah@acme.edu',
        fullName: 'Sarah Connor',
        phone: '', // missing phone
        tempPassword: 'TemporaryKey789!',
        loginUrl: 'https://app.smartsapp.com/login',
        channels: ['email', 'sms', 'whatsapp'],
      });

      expect(res.success).toBe(false);
      expect(res.channels.email?.status).toBe('failed');
      expect(res.channels.email?.error).toContain('Resend invalid API key');
      expect(res.channels.sms?.status).toBe('failed');
      expect(res.channels.sms?.error).toContain('Recipient phone number is required');
      expect(res.channels.whatsapp?.status).toBe('failed');
      expect(res.channels.whatsapp?.error).toContain('Recipient phone number is required');
      expect(res.warnings).toHaveLength(3);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailVerificationEngine } from '../email-verifier';
import { PhoneVerificationEngine } from '../phone-verifier';
import { checkMessageDeliveryLogs } from '../services/delivery-telemetry';

// Mock delivery telemetry
vi.mock('../services/delivery-telemetry', () => ({
  checkMessageDeliveryLogs: vi.fn(),
}));

describe('Verifier Delivery Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('EmailVerificationEngine', () => {
    it('should bypass SMTP checks and return telemetry results if checked logs return verified status', async () => {
      vi.mocked(checkMessageDeliveryLogs).mockResolvedValueOnce({
        status: 'verified',
        score: 100,
      });

      const engine = new EmailVerificationEngine([]);
      const result = await engine.verify('test@example.com');

      expect(checkMessageDeliveryLogs).toHaveBeenCalledWith('test@example.com', 'email');
      expect(result).toEqual({
        valid: true,
        score: 100,
        status: 'verified',
        checks: {
          syntax: true,
          dns: true,
          smtp: true,
          disposable: false,
          roleAccount: false,
          catchAll: false,
        },
        details: {
          telemetry: 'delivery_verified',
        },
      });
    });

    it('should bypass SMTP checks and return telemetry results if checked logs return bounced status', async () => {
      vi.mocked(checkMessageDeliveryLogs).mockResolvedValueOnce({
        status: 'bounced',
        score: 10,
      });

      const engine = new EmailVerificationEngine([]);
      const result = await engine.verify('test@example.com');

      expect(result).toEqual({
        valid: false,
        score: 10,
        status: 'invalid', // bounced mapping
        checks: {
          syntax: true,
          dns: false,
          smtp: false,
          disposable: false,
          roleAccount: false,
          catchAll: false,
        },
        details: {
          telemetry: 'delivery_bounced',
        },
      });
    });
  });

  describe('PhoneVerificationEngine', () => {
    it('should bypass carrier lookup and return telemetry results if checked logs return verified status', async () => {
      vi.mocked(checkMessageDeliveryLogs).mockResolvedValueOnce({
        status: 'verified',
        score: 100,
      });

      const engine = new PhoneVerificationEngine();
      const result = await engine.verify('+1234567890');

      expect(checkMessageDeliveryLogs).toHaveBeenCalledWith('+1234567890', 'phone');
      expect(result).toEqual({
        valid: true,
        score: 100,
        status: 'format_valid',
        e164: '+1234567890',
        country: null,
        callingCode: null,
        lineType: null,
        checks: {
          structure: true,
          possible: true,
          valid: true,
          lineType: true,
          suspicious: false,
        },
        details: {
          telemetry: 'delivery_verified',
        },
      });
    });
  });
});

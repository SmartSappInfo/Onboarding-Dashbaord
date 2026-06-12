import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyUnsubscribeToken, generateUnsubscribeToken } from '../services/unsubscribe-service';
import { isSuppressed } from '../suppression-service';

// Mock firebase-admin
vi.mock('../firebase-admin', () => {
  const mockCollection = vi.fn();
  return {
    adminDb: {
      collection: mockCollection,
    }
  };
});

describe('Unsubscription & Suppression Enhancements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UNSUBSCRIBE_SECRET_KEY = 'test-secret-key-123';
  });

  describe('Constant-Time HMAC Verification', () => {
    it('should verify correct tokens successfully', () => {
      const email = 'test@example.com';
      const token = generateUnsubscribeToken(email);
      
      expect(verifyUnsubscribeToken(email, token)).toBe(true);
    });

    it('should reject incorrect tokens safely', () => {
      const email = 'test@example.com';
      expect(verifyUnsubscribeToken(email, 'wrongtoken')).toBe(false);
    });

    it('should handle malformed non-hex or mismatched length tokens without throwing', () => {
      expect(verifyUnsubscribeToken('test@example.com', '')).toBe(false);
      expect(verifyUnsubscribeToken('test@example.com', 'non-hex-value-that-is-not-hex-at-all-but-has-length-sixty-four-chars-123')).toBe(false);
    });
  });

  describe('Self-Healing Snooze Suppression', () => {
    it('should return true if snooze is active and not expired', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days in future
      
      const { adminDb } = await import('../firebase-admin');
      
      const mockGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'snooze-doc-id',
            data: () => ({
              reason: 'snoozed',
              snoozedUntil: futureDate.toISOString(),
              status: 'active'
            }),
            ref: { delete: vi.fn().mockResolvedValue(true) }
          }
        ]
      });

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: mockGet
      });

      const suppressed = await isSuppressed({
        recipient: 'snoozed@example.com',
        workspaceId: 'ws-123',
        channel: 'email'
      });

      expect(suppressed).toBe(true);
      expect(adminDb.collection).toHaveBeenCalledWith('suppressions');
    });

    it('should return false and asynchronously purge suppression if snooze has expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2); // 2 days in past
      
      const { adminDb } = await import('../firebase-admin');
      
      const mockDelete = vi.fn().mockResolvedValue(true);
      const mockGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'expired-snooze-doc-id',
            data: () => ({
              reason: 'snoozed',
              snoozedUntil: pastDate.toISOString(),
              status: 'active'
            }),
            ref: { delete: mockDelete }
          }
        ]
      });

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: mockGet
      });

      const suppressed = await isSuppressed({
        recipient: 'snoozed@example.com',
        workspaceId: 'ws-123',
        channel: 'email'
      });

      // Assert: expired snooze is treated as NOT suppressed
      expect(suppressed).toBe(false);
      // Assert: self-healing delete was triggered on the doc ref
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});

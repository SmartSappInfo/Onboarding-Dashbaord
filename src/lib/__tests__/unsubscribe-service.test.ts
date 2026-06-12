import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  generateSecureUnsubscribeLink,
  processUnsubscribe,
} from '../services/unsubscribe-service';

// Mock firebase-admin
vi.mock('../firebase-admin', () => {
  const mockRunTransaction = vi.fn();
  const mockCollection = vi.fn();
  return {
    adminDb: {
      collection: mockCollection,
      runTransaction: mockRunTransaction,
    }
  };
});

// Mock suppression service
vi.mock('../suppression-service', () => {
  const mockAddSuppression = vi.fn();
  const mockRemoveSuppression = vi.fn();
  return {
    suppressRecipient: mockAddSuppression,
    removeSuppression: mockRemoveSuppression,
    // Expose mocks
    _suppressionMocks: {
      mockAddSuppression,
      mockRemoveSuppression,
    }
  };
});

// Mock URL helper
vi.mock('../utils/url-helpers', () => ({
  getRequestBaseUrl: vi.fn(async () => 'http://localhost:9002'),
}));

describe('UnsubscribeService tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UNSUBSCRIBE_SECRET_KEY = 'test-secret-key-123';
  });

  describe('HMAC Token Generation & Verification', () => {
    it('should generate consistent tokens for the same email', () => {
      const email = 'john@example.com';
      const token1 = generateUnsubscribeToken(email);
      const token2 = generateUnsubscribeToken(email);
      
      expect(token1).toBe(token2);
      expect(token1.length).toBe(64); // SHA-256 hex length
    });

    it('should generate different tokens for different emails', () => {
      const token1 = generateUnsubscribeToken('john@example.com');
      const token2 = generateUnsubscribeToken('alice@example.com');
      
      expect(token1).not.toBe(token2);
    });

    it('should verify valid tokens', () => {
      const email = 'john@example.com';
      const token = generateUnsubscribeToken(email);
      
      expect(verifyUnsubscribeToken(email, token)).toBe(true);
    });

    it('should fail verification for invalid tokens', () => {
      expect(verifyUnsubscribeToken('john@example.com', 'invalid-token')).toBe(false);
    });

    it('should normalize email strings before hashing', () => {
      const email1 = ' John@Example.com ';
      const email2 = 'john@example.com';
      const token1 = generateUnsubscribeToken(email1);
      const token2 = generateUnsubscribeToken(email2);
      
      expect(token1).toBe(token2);
      expect(verifyUnsubscribeToken(email1, token2)).toBe(true);
    });
  });

  describe('generateSecureUnsubscribeLink', () => {
    it('should generate unsubscribe link with params', async () => {
      const email = 'john@example.com';
      const link = await generateSecureUnsubscribeLink(email, 'entity-abc', 'workspace-xyz');
      
      expect(link).toContain('http://localhost:9002/preferences/john%40example.com');
      expect(link).toContain('token=');
      expect(link).toContain('entityId=entity-abc');
      expect(link).toContain('ws=workspace-xyz');
    });
  });

  describe('processUnsubscribe', () => {
    it('should add suppression and transactionally update entity when unsubscribing', async () => {
      const recipient = 'john@example.com';
      
      // Import mocked suppression functions to verify calls
      const { suppressRecipient } = await import('../suppression-service');
      const { adminDb } = await import('../firebase-admin');

      // Mock transaction behavior
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          entityContacts: [
            { id: 'c1', name: 'John Doe', email: 'john@example.com', emailStatus: 'valid' }
          ]
        })
      });
      const mockUpdate = vi.fn();
      (adminDb.runTransaction as any).mockImplementationOnce(async (cb: any) => {
        return cb({
          get: mockGet,
          update: mockUpdate,
        });
      });

      // Mock workspace entity query snapshot
      const mockWeGet = vi.fn().mockResolvedValue({
        docs: [
          { ref: { update: vi.fn() } }
        ]
      });
      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnThis(),
        where: vi.fn(() => ({
          get: mockWeGet
        }))
      });

      await processUnsubscribe(recipient, {
        emailStatus: 'unsubscribed',
        entityId: 'test-entity-id',
        workspaceId: 'test-ws'
      });

      // Verification: suppression should be added
      expect(suppressRecipient).toHaveBeenCalledWith(expect.objectContaining({
        recipient: 'john@example.com',
        workspaceId: 'test-ws',
        channel: 'email',
        reason: 'unsubscribed'
      }));

      // Verification: Transaction ran and update occurred
      expect(adminDb.runTransaction).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should remove suppression when status is set to valid', async () => {
      const recipient = 'john@example.com';
      const { removeSuppression } = await import('../suppression-service');
      const { adminDb } = await import('../firebase-admin');

      // Mock transaction behavior
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          entityContacts: [
            { id: 'c1', name: 'John Doe', email: 'john@example.com', emailStatus: 'unsubscribed' }
          ]
        })
      });
      const mockUpdate = vi.fn();
      (adminDb.runTransaction as any).mockImplementationOnce(async (cb: any) => {
        return cb({
          get: mockGet,
          update: mockUpdate,
        });
      });

      // Mock workspace entity query snapshot
      const mockWeGet = vi.fn().mockResolvedValue({ docs: [] });
      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnThis(),
        where: vi.fn(() => ({
          get: mockWeGet
        }))
      });

      await processUnsubscribe(recipient, {
        emailStatus: 'valid',
        entityId: 'test-entity-id',
        workspaceId: 'test-ws'
      });

      expect(removeSuppression).toHaveBeenCalledWith('john@example.com', 'test-ws');
    });
  });
});

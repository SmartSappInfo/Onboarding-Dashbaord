/**
 * @fileOverview Unit tests for invitation-crypto-actions.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateEncryptedInvitationAction,
  acceptInvitationLandingAction,
  declineInvitationLandingAction,
} from '@/app/actions/invitation-crypto-actions';
import { InviteCryptoService } from '@/lib/services/crypto/invite-crypto-service';
import type { EncryptedInvitePayload } from '@/lib/types';

// Mock storage
const mockInvitationsMap = new Map<string, Record<string, unknown>>();
const mockUsersMap = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => {
      if (colName === 'invitations') {
        return {
          doc: vi.fn((id: string) => ({
            id,
            get: vi.fn(async () => {
              const data = mockInvitationsMap.get(id);
              return {
                exists: Boolean(data),
                id,
                data: () => data,
              };
            }),
            update: vi.fn(async (updates: Record<string, unknown>) => {
              const existing = mockInvitationsMap.get(id) || {};
              mockInvitationsMap.set(id, { ...existing, ...updates });
            }),
          })),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn(async () => ({
            empty: true,
            docs: [],
          })),
        };
      }

      if (colName === 'users') {
        return {
          where: vi.fn((field: string, op: string, val: string) => {
            return {
              limit: vi.fn(() => ({
                get: vi.fn(async () => {
                  const matching: Array<{ id: string; data: () => Record<string, unknown> }> = [];
                  for (const [id, u] of mockUsersMap.entries()) {
                    if (field === 'email' && u.email === val) {
                      matching.push({ id, data: () => u });
                    }
                  }
                  return {
                    empty: matching.length === 0,
                    docs: matching,
                  };
                }),
              })),
            };
          }),
        };
      }

      return {
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({ exists: false })),
        })),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn(async () => ({ empty: true, docs: [] })),
      };
    }),
  },
}));

describe('invitation-crypto-actions', () => {
  const validPayload: EncryptedInvitePayload = {
    invitationId: 'inv-test-999',
    organizationId: 'org-smartsapp',
    organizationName: 'SmartSapp Tech',
    departmentId: 'dept-eng-1',
    departmentName: 'Engineering',
    email: 'newuser@example.com',
    fullName: 'Alex Smith',
    tempPassword: 'Password123!',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };

  beforeEach(() => {
    mockInvitationsMap.clear();
    mockUsersMap.clear();

    mockInvitationsMap.set('inv-test-999', {
      id: 'inv-test-999',
      organizationId: 'org-smartsapp',
      email: 'newuser@example.com',
      departmentId: 'dept-eng-1',
      status: 'sent',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  describe('validateEncryptedInvitationAction', () => {
    it('returns valid state for an active encrypted invitation', async () => {
      const token = InviteCryptoService.encryptInvitePayload(validPayload);
      const res = await validateEncryptedInvitationAction({ token });

      expect(res.success).toBe(true);
      expect(res.state).toBe('valid');
      expect(res.invitation?.email).toBe('newuser@example.com');
      expect(res.invitation?.organizationName).toBe('SmartSapp Tech');
      expect(res.invitation?.departmentName).toBe('Engineering');
    });

    it('returns already_completed if user profile is already completed in Firestore', async () => {
      mockUsersMap.set('user-alex', {
        id: 'user-alex',
        email: 'newuser@example.com',
        name: 'Alex Smith',
        profileCompleted: true,
      });

      const token = InviteCryptoService.encryptInvitePayload(validPayload);
      const res = await validateEncryptedInvitationAction({ token });

      expect(res.success).toBe(true);
      expect(res.state).toBe('already_completed');
    });

    it('returns declined state if invitation was previously declined', async () => {
      mockInvitationsMap.set('inv-test-999', {
        id: 'inv-test-999',
        organizationId: 'org-smartsapp',
        email: 'newuser@example.com',
        departmentId: 'dept-eng-1',
        status: 'declined',
        declinedAt: new Date().toISOString(),
      });

      const token = InviteCryptoService.encryptInvitePayload(validPayload);
      const res = await validateEncryptedInvitationAction({ token });

      expect(res.success).toBe(true);
      expect(res.state).toBe('declined');
    });

    it('returns revoked state if invitation was revoked by admin', async () => {
      mockInvitationsMap.set('inv-test-999', {
        id: 'inv-test-999',
        organizationId: 'org-smartsapp',
        email: 'newuser@example.com',
        departmentId: 'dept-eng-1',
        status: 'revoked',
      });

      const token = InviteCryptoService.encryptInvitePayload(validPayload);
      const res = await validateEncryptedInvitationAction({ token });

      expect(res.success).toBe(true);
      expect(res.state).toBe('revoked');
    });

    it('returns invalid state for empty or garbage tokens', async () => {
      const res1 = await validateEncryptedInvitationAction({ token: '' });
      expect(res1.success).toBe(false);
      expect(res1.state).toBe('invalid');

      const res2 = await validateEncryptedInvitationAction({ token: 'nonsense-token' });
      expect(res2.success).toBe(false);
      expect(res2.state).toBe('invalid');
    });
  });

  describe('acceptInvitationLandingAction', () => {
    it('updates invitation status to accepted in Firestore', async () => {
      const token = InviteCryptoService.encryptInvitePayload(validPayload);
      const res = await acceptInvitationLandingAction({ token });

      expect(res.success).toBe(true);
      const updated = mockInvitationsMap.get('inv-test-999');
      expect(updated?.status).toBe('accepted');
      expect(updated?.acceptedAt).toBeDefined();
    });
  });

  describe('declineInvitationLandingAction', () => {
    it('updates invitation status to declined with optional reason', async () => {
      const token = InviteCryptoService.encryptInvitePayload(validPayload);
      const res = await declineInvitationLandingAction({
        token,
        reason: 'Joined another company',
      });

      expect(res.success).toBe(true);
      const updated = mockInvitationsMap.get('inv-test-999');
      expect(updated?.status).toBe('declined');
      expect(updated?.declinedAt).toBeDefined();
      expect(updated?.declinedReason).toBe('Joined another company');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveRecipientContacts } from '../messaging-actions';
import { createBulkMessageJob } from '../bulk-messaging';
import { adminDb } from '../firebase-admin';
import { clearContactCache } from '../contact-adapter';
import type { EntityContact } from '../types';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
    batch: vi.fn(),
  },
}));

vi.mock('../mnotify-actions', () => ({
  fetchSmsStatusAction: vi.fn(),
}));

vi.mock('../resend-actions', () => ({
  fetchEmailStatusAction: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Contact Fallback & Duplicate Send Prevention Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearContactCache();
  });

  describe('resolveRecipientContacts with Fallback Logic', () => {
    it('falls back to the primary contact if matched roles list is empty', async () => {
      const mockEntityContacts: EntityContact[] = [
        { id: 'c1', name: 'Primary Parent', email: 'primary@example.com', phone: '+1111', isPrimary: true, isSignatory: false, typeKey: 'father', order: 0 },
        { id: 'c2', name: 'Admin Asst', email: 'admin@example.com', phone: '+2222', isPrimary: false, isSignatory: false, typeKey: 'admin', order: 1 }
      ];

      const mockEntity = {
        id: 'ent_1',
        name: 'Test Institution',
        entityType: 'institution',
        entityContacts: mockEntityContacts
      };

      const mockWorkspaceEntity = {
        id: 'we_1',
        entityId: 'ent_1',
        displayName: 'Test Institution',
        entityContacts: mockEntityContacts
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'ent_1',
                data: () => mockEntity
              })
            })
          };
        }
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: 'we_1', data: () => mockWorkspaceEntity }]
            })
          };
        }
        return {};
      });

      (adminDb.collection as unknown as ReturnType<typeof vi.fn>) = mockCollection;

      // Ask for 'signatories' scope which does not match c1 or c2.
      // Expect it to fall back to c1 (Primary Parent).
      const resolved = await resolveRecipientContacts({
        entityId: 'ent_1',
        workspaceId: 'ws_1',
        contactScope: 'signatories',
        channel: 'email',
      });

      expect(resolved).toHaveLength(1);
      expect(resolved[0].contact).toBe('primary@example.com');
      expect(resolved[0].contactName).toBe('Primary Parent');
    });

    it('enforces endpoint deduplication so the same contact is not returned twice', async () => {
      // Both primary and signatory contacts share the same email
      const mockEntityContacts: EntityContact[] = [
        { id: 'c1', name: 'Primary Parent', email: 'duplicate@example.com', phone: '+1111', isPrimary: true, isSignatory: false, typeKey: 'father', order: 0 },
        { id: 'c2', name: 'Signatory Parent', email: 'duplicate@example.com', phone: '+1111', isPrimary: false, isSignatory: true, typeKey: 'signatory', order: 1 }
      ];

      const mockEntity = {
        id: 'ent_1',
        name: 'Test Institution',
        entityType: 'institution',
        entityContacts: mockEntityContacts
      };

      const mockWorkspaceEntity = {
        id: 'we_1',
        entityId: 'ent_1',
        displayName: 'Test Institution',
        entityContacts: mockEntityContacts
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'ent_1',
                data: () => mockEntity
              })
            })
          };
        }
        if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: 'we_1', data: () => mockWorkspaceEntity }]
            })
          };
        }
        return {};
      });

      (adminDb.collection as unknown as ReturnType<typeof vi.fn>) = mockCollection;

      // Ask for 'all' contacts. Since c1 and c2 share the same email, it should deduplicate.
      const resolved = await resolveRecipientContacts({
        entityId: 'ent_1',
        workspaceId: 'ws_1',
        contactScope: 'all',
        channel: 'email',
      });

      expect(resolved).toHaveLength(1);
      expect(resolved[0].contact).toBe('duplicate@example.com');
    });
  });

  describe('createBulkMessageJob Deduplication', () => {
    it('de-duplicates input recipients by recipient and entityId', async () => {
      const mockTemplate = {
        id: 'tmpl_1',
        channel: 'email',
        subject: 'Welcome',
        body: 'Hello'
      };

      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(true)
      };

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => mockTemplate
              })
            })
          };
        }
        if (collectionName === 'message_jobs') {
          return {
            add: vi.fn().mockResolvedValue({
              id: 'job_123',
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue({
                  id: 'task_1'
                })
              })
            })
          };
        }
        return {};
      });

      (adminDb.collection as unknown as ReturnType<typeof vi.fn>) = mockCollection;
      (adminDb.batch as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(mockBatch);

      const inputRecipients = [
        { recipient: 'parent@example.com', variables: {}, entityId: 'ent_1' },
        { recipient: 'parent@example.com', variables: {}, entityId: 'ent_1' }, // Duplicate recipient + entityId
        { recipient: 'parent@example.com', variables: {}, entityId: 'ent_2' }  // Same recipient, different entityId (should keep)
      ];

      const res = await createBulkMessageJob({
        templateId: 'tmpl_1',
        senderProfileId: 'profile_1',
        recipients: inputRecipients,
        userId: 'user_1'
      });

      expect(res.jobId).toBe('job_123');

      // The batch set should have been called exactly 2 times (for unique entries: ent_1 and ent_2)
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
    });
  });
});

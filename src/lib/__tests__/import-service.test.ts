import { describe, it, expect, beforeEach, vi } from 'vitest';
import { importContactsAction } from '../import-service';
import { adminDb } from '../firebase-admin';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
    batch: vi.fn(),
  },
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(true),
}));

describe('Import Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importContactsAction', () => {
    it('should correctly parse a valid institution CSV and map contacts', async () => {
      const csvContent = `name,contact_name,contact_email,contact_phone,nominalRoll\nTest School,Admin User,admin@test.com,1234567890,500`;

      const addEntityMock = vi.fn().mockResolvedValue({ id: 'new_entity_id' });
      
      // Mock DB for finding existing entity (return empty)
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
            add: addEntityMock,
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
            add: vi.fn().mockResolvedValue({ id: 'we_id' }),
          };
        } else if (collectionName === 'activity_logs') {
          return { add: vi.fn() };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await importContactsAction({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        workspaceContactScope: 'institution',
        csvContent,
        userId: 'user_1',
      });

      if (!result.success) {
        throw new Error('Test 1 failed with errors: ' + JSON.stringify(result.errors, null, 2));
      }
      expect(result.success).toBe(true);
      expect(result.successCount).toBe(1);
      expect(result.createdEntityIds).toContain('new_entity_id');
      
      // Verify that entities.add was called with the correct contact mapping
      const addCall = addEntityMock.mock.calls[0][0];
      expect(addCall.name).toBe('Test School');
      expect(addCall.entityType).toBe('institution');
      
      // Should have mapped the CSV contact fields to the contacts array
      expect(addCall.contacts).toHaveLength(1);
      expect(addCall.contacts[0].name).toBe('Admin User');
      expect(addCall.contacts[0].email).toBe('admin@test.com');
      expect(addCall.contacts[0].isPrimary).toBe(true);
      
      // Should completely omit legacy focalPerson
      expect(addCall.focalPerson).toBeUndefined();
    });

    it('should fail elegantly when CSV scope does not match workspace scope', async () => {
      // Passing a person CSV (firstName, lastName) into an institution workspace
      const csvContent = `firstName,lastName,email\nJohn,Doe,john@test.com`;

      const result = await importContactsAction({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        workspaceContactScope: 'institution', // Mismatch!
        csvContent,
        userId: 'user_1',
      });

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].reason).toContain('cannot be added to a workspace with scope');
    });

    it('should return error for empty CSV', async () => {
      const result = await importContactsAction({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        workspaceContactScope: 'institution',
        csvContent: '',
        userId: 'user_1',
      });

      expect(result.success).toBe(false);
      expect(result.errors[0].reason).toContain('empty');
    });
  });
});

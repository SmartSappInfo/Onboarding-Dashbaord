/**
 * @fileOverview Settings Module Unit Tests
 * 
 * Tests for Task 20.3: Write unit tests for settings module
 * 
 * Validates:
 * - Settings load with entityId
 * - Settings update with entityId
 * - Backward compatibility with schoolId
 * 
 * Requirements: 26.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadSettings, updateSettings, createSettings } from '../settings-actions';

// Mock firebase-admin
const mockAdd = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockDoc = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      add: mockAdd,
      doc: mockDoc,
      where: mockWhere,
    })),
  },
}));

describe('Settings Module Unit Tests (Task 20.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock chain for queries
    mockLimit.mockReturnValue({
      get: mockGet,
    });
    mockWhere.mockReturnValue({
      where: mockWhere,
      limit: mockLimit,
    });
    mockGet.mockResolvedValue({
      empty: true,
      docs: [],
    });
    
    // Setup doc mock
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Settings Load with entityId', () => {
    it('should load settings using entityId', async () => {
      const mockSettings = {
        id: 'settings_123',
        entityId: 'entity_456',
        entityType: 'institution',
        workspaceId: 'workspace_1',
        notificationsEnabled: true,
        emailPreferences: {
          invoices: true,
          reminders: true,
          updates: false,
        },
        displayPreferences: {
          theme: 'dark',
          language: 'en',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'settings_123',
            data: () => mockSettings,
          },
        ],
      });

      const result = await loadSettings(
        { entityId: 'entity_456' },
        'workspace_1'
      );

      expect(result.success).toBe(true);
      expect(result.settings).toBeDefined();
      expect(result.settings?.entityId).toBe('entity_456');
      expect(result.settings?.entityType).toBe('institution');
      expect(result.settings?.notificationsEnabled).toBe(true);
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_456');
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('should return undefined when no settings found for entityId', async () => {
      mockGet.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await loadSettings(
        { entityId: 'entity_nonexistent' },
        'workspace_1'
      );

      expect(result.success).toBe(true);
      expect(result.settings).toBeUndefined();
    });

    it('should load settings for different entity types', async () => {
      const mockFamilySettings = {
        id: 'settings_124',
        entityId: 'entity_789',
        entityType: 'family',
        workspaceId: 'workspace_1',
        notificationsEnabled: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'settings_124',
            data: () => mockFamilySettings,
          },
        ],
      });

      const result = await loadSettings(
        { entityId: 'entity_789' },
        'workspace_1'
      );

      expect(result.success).toBe(true);
      expect(result.settings?.entityType).toBe('family');
      expect(result.settings?.notificationsEnabled).toBe(false);
    });

    it('should enforce workspace boundary when loading settings', async () => {
      const mockSettings = {
        id: 'settings_125',
        entityId: 'entity_456',
        workspaceId: 'workspace_1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'settings_125',
            data: () => mockSettings,
          },
        ],
      });

      await loadSettings(
        { entityId: 'entity_456' },
        'workspace_1'
      );

      // Verify workspace filter was applied
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
    });
  });

  describe('Settings Load with schoolId (Backward Compatibility)', () => {
    it('should load settings using schoolId for legacy records', async () => {
      const mockLegacySettings = {
        id: 'settings_126',
        schoolId: 'school_789',
        entityId: null,
        workspaceId: 'workspace_1',
        notificationsEnabled: true,
        emailPreferences: {
          invoices: true,
          reminders: true,
          updates: true,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'settings_126',
            data: () => mockLegacySettings,
          },
        ],
      });

      const result = await loadSettings(
        { schoolId: 'school_789' },
        'workspace_1'
      );

      expect(result.success).toBe(true);
      expect(result.settings).toBeDefined();
      expect(result.settings?.schoolId).toBe('school_789');
      expect(result.settings?.entityId).toBeNull();
      
      // Verify query was built with schoolId
      expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockWhere).toHaveBeenCalledWith('schoolId', '==', 'school_789');
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('should return undefined when no settings found for schoolId', async () => {
      mockGet.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await loadSettings(
        { schoolId: 'school_nonexistent' },
        'workspace_1'
      );

      expect(result.success).toBe(true);
      expect(result.settings).toBeUndefined();
    });

    it('should prefer entityId over schoolId when both provided', async () => {
      const mockSettings = {
        id: 'settings_127',
        entityId: 'entity_456',
        schoolId: 'school_789',
        workspaceId: 'workspace_1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'settings_127',
            data: () => mockSettings,
          },
        ],
      });

      await loadSettings(
        { entityId: 'entity_456', schoolId: 'school_789' },
        'workspace_1'
      );

      // Verify query used entityId (preferred)
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_456');
      // Should NOT query by schoolId when entityId is present
      const schoolIdCalls = vi.mocked(mockWhere).mock.calls.filter(
        call => call[0] === 'schoolId'
      );
      expect(schoolIdCalls).toHaveLength(0);
    });

    it('should return error when neither entityId nor schoolId provided', async () => {
      const result = await loadSettings(
        {},
        'workspace_1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Either entityId or schoolId must be provided');
      
      // Should not attempt to query
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('Settings Update with entityId', () => {
    it('should update settings and preserve entityId', async () => {
      const existingSettings = {
        id: 'settings_128',
        entityId: 'entity_456',
        schoolId: null,
        entityType: 'institution',
        workspaceId: 'workspace_1',
        notificationsEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        exists: true,
        data: () => existingSettings,
      });
      mockUpdate.mockResolvedValue(undefined);

      const updates = {
        notificationsEnabled: false,
        emailPreferences: {
          invoices: false,
          reminders: true,
          updates: true,
        },
      };

      const result = await updateSettings('settings_128', updates);

      expect(result.success).toBe(true);
      
      // Verify identifiers were preserved
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_456',
          schoolId: null,
          entityType: 'institution',
          notificationsEnabled: false,
          emailPreferences: {
            invoices: false,
            reminders: true,
            updates: true,
          },
          updatedAt: expect.any(String),
        })
      );
    });

    it('should update display preferences while preserving entityId', async () => {
      const existingSettings = {
        id: 'settings_129',
        entityId: 'entity_789',
        schoolId: null,
        entityType: 'family',
        workspaceId: 'workspace_1',
        displayPreferences: {
          theme: 'light',
          language: 'en',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        exists: true,
        data: () => existingSettings,
      });
      mockUpdate.mockResolvedValue(undefined);

      const updates = {
        displayPreferences: {
          theme: 'dark' as const,
          language: 'es',
        },
      };

      const result = await updateSettings('settings_129', updates);

      expect(result.success).toBe(true);
      
      // Verify entityId and entityType were preserved
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_789',
          entityType: 'family',
          displayPreferences: {
            theme: 'dark',
            language: 'es',
          },
        })
      );
    });

    it('should return error when settings not found', async () => {
      mockGet.mockResolvedValue({
        exists: false,
      });

      const updates = {
        notificationsEnabled: false,
      };

      const result = await updateSettings('settings_nonexistent', updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Settings not found');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should handle update errors gracefully', async () => {
      const existingSettings = {
        id: 'settings_130',
        entityId: 'entity_456',
        workspaceId: 'workspace_1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        exists: true,
        data: () => existingSettings,
      });
      mockUpdate.mockRejectedValue(new Error('Firestore error'));

      const updates = {
        notificationsEnabled: false,
      };

      const result = await updateSettings('settings_130', updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });
  });

  describe('Settings Update with schoolId (Backward Compatibility)', () => {
    it('should update settings and preserve schoolId for legacy records', async () => {
      const existingLegacySettings = {
        id: 'settings_131',
        schoolId: 'school_789',
        entityId: null,
        entityType: null,
        workspaceId: 'workspace_1',
        notificationsEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        exists: true,
        data: () => existingLegacySettings,
      });
      mockUpdate.mockResolvedValue(undefined);

      const updates = {
        notificationsEnabled: false,
      };

      const result = await updateSettings('settings_131', updates);

      expect(result.success).toBe(true);
      
      // Verify schoolId was preserved and entityId remains null
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: 'school_789',
          entityId: null,
          entityType: null,
          notificationsEnabled: false,
        })
      );
    });

    it('should preserve both identifiers for dual-write records', async () => {
      const existingDualWriteSettings = {
        id: 'settings_132',
        schoolId: 'school_789',
        entityId: 'entity_456',
        entityType: 'institution',
        workspaceId: 'workspace_1',
        notificationsEnabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({
        exists: true,
        data: () => existingDualWriteSettings,
      });
      mockUpdate.mockResolvedValue(undefined);

      const updates = {
        emailPreferences: {
          invoices: true,
          reminders: false,
          updates: true,
        },
      };

      const result = await updateSettings('settings_132', updates);

      expect(result.success).toBe(true);
      
      // Verify both identifiers were preserved
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: 'school_789',
          entityId: 'entity_456',
          entityType: 'institution',
          emailPreferences: {
            invoices: true,
            reminders: false,
            updates: true,
          },
        })
      );
    });
  });

  describe('Settings Creation', () => {
    it('should create settings with entityId', async () => {
      mockAdd.mockResolvedValue({ id: 'settings_133' });

      const input = {
        entityId: 'entity_456',
        entityType: 'institution' as const,
        workspaceId: 'workspace_1',
        notificationsEnabled: true,
        emailPreferences: {
          invoices: true,
          reminders: true,
          updates: false,
        },
      };

      const result = await createSettings(input);

      expect(result.success).toBe(true);
      expect(result.id).toBe('settings_133');
      
      // Verify settings were created with entityId
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_456',
          schoolId: null,
          entityType: 'institution',
          workspaceId: 'workspace_1',
          notificationsEnabled: true,
          emailPreferences: {
            invoices: true,
            reminders: true,
            updates: false,
          },
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })
      );
    });

    it('should create settings with schoolId for legacy compatibility', async () => {
      mockAdd.mockResolvedValue({ id: 'settings_134' });

      const input = {
        schoolId: 'school_789',
        workspaceId: 'workspace_1',
        notificationsEnabled: false,
      };

      const result = await createSettings(input);

      expect(result.success).toBe(true);
      expect(result.id).toBe('settings_134');
      
      // Verify settings were created with schoolId
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: 'school_789',
          entityId: null,
          entityType: null,
          workspaceId: 'workspace_1',
          notificationsEnabled: false,
        })
      );
    });

    it('should create settings with both identifiers (dual-write)', async () => {
      mockAdd.mockResolvedValue({ id: 'settings_135' });

      const input = {
        entityId: 'entity_456',
        schoolId: 'school_789',
        entityType: 'institution' as const,
        workspaceId: 'workspace_1',
      };

      const result = await createSettings(input);

      expect(result.success).toBe(true);
      
      // Verify both identifiers were written
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_456',
          schoolId: 'school_789',
          entityType: 'institution',
        })
      );
    });

    it('should apply default values when not provided', async () => {
      mockAdd.mockResolvedValue({ id: 'settings_136' });

      const input = {
        entityId: 'entity_456',
        workspaceId: 'workspace_1',
      };

      const result = await createSettings(input);

      expect(result.success).toBe(true);
      
      // Verify defaults were applied
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationsEnabled: true,
          emailPreferences: {
            invoices: true,
            reminders: true,
            updates: true,
          },
          displayPreferences: {
            theme: 'light',
            language: 'en',
          },
        })
      );
    });

    it('should handle creation errors gracefully', async () => {
      mockAdd.mockRejectedValue(new Error('Firestore error'));

      const input = {
        entityId: 'entity_456',
        workspaceId: 'workspace_1',
      };

      const result = await createSettings(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });
  });

  describe('Error Handling', () => {
    it('should handle load errors gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Query failed'));

      const result = await loadSettings(
        { entityId: 'entity_456' },
        'workspace_1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });

    it('should handle missing document in update', async () => {
      mockGet.mockResolvedValue({
        exists: false,
      });

      const result = await updateSettings('settings_missing', {
        notificationsEnabled: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Settings not found');
    });

    it('should handle Firestore errors during update', async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'settings_137',
          entityId: 'entity_456',
          workspaceId: 'workspace_1',
        }),
      });
      mockUpdate.mockRejectedValue(new Error('Permission denied'));

      const result = await updateSettings('settings_137', {
        notificationsEnabled: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });
});

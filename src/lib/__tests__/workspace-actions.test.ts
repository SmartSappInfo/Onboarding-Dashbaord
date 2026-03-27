/**
 * Unit Tests for Workspace Actions
 * 
 * Tests workspace management server actions:
 * 1. saveWorkspaceAction - Creates/updates workspaces with contactScope validation
 * 2. updateWorkspaceScopeAction - Updates scope with activation checks
 * 
 * Key test scenarios:
 * - ContactScope validation (institution, family, person)
 * - Default capabilities assignment
 * - Scope update rejection when workspace has active entities
 * - Scope update allowed when workspace has zero active entities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminDb } from '../firebase-admin';
import { logActivity } from '../activity-logger';
import {
  saveWorkspaceAction,
  updateWorkspaceScopeAction,
} from '../workspace-actions';

// Mock dependencies
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('saveWorkspaceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new workspace with contactScope and default capabilities', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn().mockResolvedValue(undefined),
    };

    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    });

    const result = await saveWorkspaceAction(null, {
      name: 'Test Workspace',
      organizationId: 'org_1',
      contactScope: 'institution',
    }, 'user_1');

    expect(result.success).toBe(true);
    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        contactScope: 'institution',
        capabilities: {
          billing: true,
          admissions: true,
          children: true,
          contracts: true,
          messaging: true,
          automations: true,
          tasks: true,
        },
        status: 'active',
        scopeLocked: false,
      })
    );
  });

  it('should validate contactScope and reject invalid values', async () => {
    const result = await saveWorkspaceAction(null, {
      name: 'Test Workspace',
      organizationId: 'org_1',
      contactScope: 'invalid' as any,
    }, 'user_1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid contactScope');
  });

  it('should accept custom capabilities when provided', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn().mockResolvedValue(undefined),
    };

    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    });

    const customCapabilities = {
      billing: false,
      admissions: true,
      children: false,
      contracts: true,
      messaging: true,
      automations: false,
      tasks: true,
    };

    const result = await saveWorkspaceAction(null, {
      name: 'Test Workspace',
      organizationId: 'org_1',
      contactScope: 'family',
      capabilities: customCapabilities,
    }, 'user_1');

    expect(result.success).toBe(true);
    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: customCapabilities,
      })
    );
  });

  it('should update existing workspace', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'workspace_1',
          name: 'Existing Workspace',
          contactScope: 'person',
          scopeLocked: false,
        }),
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    });

    const result = await saveWorkspaceAction('workspace_1', {
      name: 'Updated Workspace',
      contactScope: 'person',
    }, 'user_1');

    expect(result.success).toBe(true);
    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Workspace',
        contactScope: 'person',
      })
    );
  });

  it('should reject contactScope change when workspace is scope locked', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'workspace_1',
          name: 'Locked Workspace',
          contactScope: 'institution',
          scopeLocked: true,
        }),
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    });

    const result = await saveWorkspaceAction('workspace_1', {
      name: 'Locked Workspace',
      contactScope: 'family', // Attempting to change scope
    }, 'user_1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Scope cannot be changed after activation');
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it('should allow updates to other fields when workspace is scope locked', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'workspace_1',
          name: 'Locked Workspace',
          contactScope: 'institution',
          scopeLocked: true,
        }),
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    });

    const result = await saveWorkspaceAction('workspace_1', {
      name: 'Updated Name',
      description: 'New description',
      // Not changing contactScope
    }, 'user_1');

    expect(result.success).toBe(true);
    expect(mockDocRef.update).toHaveBeenCalled();
  });
});

describe('updateWorkspaceScopeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject scope update when workspace has active entities', async () => {
    const mockWorkspaceDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'workspace_1',
          contactScope: 'institution',
          scopeLocked: true,
        }),
      }),
    };

    const mockQuery = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false, // Has active entities
      }),
    };

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'workspaces') {
        return {
          doc: vi.fn().mockReturnValue(mockWorkspaceDocRef),
        };
      }
      if (collectionName === 'workspace_entities') {
        return mockQuery;
      }
    });

    const result = await updateWorkspaceScopeAction('workspace_1', 'family', 'user_1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Scope cannot be changed after activation');
  });

  it('should allow scope update when workspace has zero active entities', async () => {
    const mockWorkspaceDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'workspace_1',
          contactScope: 'institution',
          scopeLocked: false,
        }),
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    const mockQuery = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: true, // No active entities
      }),
    };

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'workspace_entities') {
        return mockQuery;
      }
      if (collectionName === 'workspaces') {
        return {
          doc: vi.fn().mockReturnValue(mockWorkspaceDocRef),
        };
      }
    });

    const result = await updateWorkspaceScopeAction('workspace_1', 'family', 'user_1');

    expect(result.success).toBe(true);
    expect(mockWorkspaceDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        contactScope: 'family',
      })
    );
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_1',
        type: 'workspace_scope_updated',
        description: 'Updated workspace scope to: family',
      })
    );
  });

  it('should validate contactScope and reject invalid values', async () => {
    const result = await updateWorkspaceScopeAction('workspace_1', 'invalid' as any, 'user_1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid contactScope');
  });

  it('should accept all valid contactScope values', async () => {
    const mockWorkspaceDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'workspace_1',
          contactScope: 'institution',
          scopeLocked: false,
        }),
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    const mockQuery = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: true,
      }),
    };

    (adminDb.collection as any).mockImplementation((collectionName: string) => {
      if (collectionName === 'workspace_entities') {
        return mockQuery;
      }
      if (collectionName === 'workspaces') {
        return {
          doc: vi.fn().mockReturnValue(mockWorkspaceDocRef),
        };
      }
    });

    // Test institution
    let result = await updateWorkspaceScopeAction('workspace_1', 'institution', 'user_1');
    expect(result.success).toBe(true);

    // Test family
    result = await updateWorkspaceScopeAction('workspace_1', 'family', 'user_1');
    expect(result.success).toBe(true);

    // Test person
    result = await updateWorkspaceScopeAction('workspace_1', 'person', 'user_1');
    expect(result.success).toBe(true);
  });
});

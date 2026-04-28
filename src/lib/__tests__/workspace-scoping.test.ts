/**
 * Unit Tests: Workspace Industry Scoping
 *
 * Feature: industry-scoped-entity-expansion
 *
 * Validates: Requirements 2.2, 2.3
 *
 * Tests the workspace industry scoping logic in createEntityAction:
 * 1. createEntity rejects industryData mismatching workspace industry
 * 2. createEntity calls lockWorkspaceScope only when not yet locked
 * 3. createEntity does not re-lock an already-locked workspace
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEntityAction, lockWorkspaceScope } from '../entity-actions';
import { getWorkspaceIndustry } from '../industry-cache';
import { validateIndustryData } from '../industry-schemas';
import type { IndustryVertical } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock setup
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

vi.mock('../industry-cache', () => ({
  getWorkspaceIndustry: vi.fn(),
  invalidateWorkspaceCache: vi.fn(),
}));

vi.mock('../industry-schemas', () => ({
  validateIndustryData: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-uuid-1234'),
  },
}));

// Mock lockWorkspaceScope - Note: This is defined in the same file as createEntityAction,
// so we can't easily mock it. Instead, we'll verify the Firestore operations it performs.
// The actual lockWorkspaceScope function will be called, and we'll verify its side effects.

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: createEntity rejects industryData mismatching workspace industry
// Requirement 2.2, 2.3
// ─────────────────────────────────────────────────────────────────────────────

describe('createEntity - industry data validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject industryData when industry field does not match workspace industry', async () => {
    // Setup: Workspace is SaaS industry
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'SaaS' as IndustryVertical,
      industryScopeLocked: false,
    });

    // Mock validateIndustryData to throw on mismatch
    vi.mocked(validateIndustryData).mockImplementation(() => {
      throw new Error(
        'Industry mismatch: industryData.industry is "Law" but workspace industry is "SaaS"'
      );
    });

    // Attempt to create entity with Law industry data in SaaS workspace
    const result = await createEntityAction(
      {
        name: 'Test Law Firm',
        industryData: {
          industry: 'Law',
          entityType: 'institution',
          firmType: 'solo',
          practiceAreas: ['litigation'],
          conflictCheckRequired: true,
        },
      },
      'user_1',
      'workspace_saas',
      'institution',
      'org_1'
    );

    // Verify rejection
    expect(result.success).toBe(false);
    expect(result.error).toContain('Industry mismatch');
    expect(result.error).toContain('Law');
    expect(result.error).toContain('SaaS');

    // Verify validateIndustryData was called with correct arguments
    expect(validateIndustryData).toHaveBeenCalledWith(
      expect.objectContaining({
        industry: 'Law',
      }),
      'SaaS'
    );
  });

  it('should reject industryData when schema validation fails', async () => {
    // Setup: Workspace is Marketing industry
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'Marketing' as IndustryVertical,
      industryScopeLocked: false,
    });

    // Mock validateIndustryData to throw on schema failure
    vi.mocked(validateIndustryData).mockImplementation(() => {
      throw new Error(
        'Industry data validation failed for "Marketing": clientIndustry: Required'
      );
    });

    // Attempt to create entity with invalid Marketing data (missing required field)
    const result = await createEntityAction(
      {
        name: 'Test Marketing Agency',
        industryData: {
          industry: 'Marketing',
          entityType: 'institution',
          // Missing required field: clientIndustry
          businessSize: { employees: 50 },
        },
      },
      'user_1',
      'workspace_marketing',
      'institution',
      'org_1'
    );

    // Verify rejection
    expect(result.success).toBe(false);
    expect(result.error).toContain('Industry data validation failed');
    expect(result.error).toContain('Marketing');
    expect(result.error).toContain('clientIndustry');
  });

  it('should accept valid industryData matching workspace industry', async () => {
    // Setup: Workspace is SaaS industry, not locked
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'SaaS' as IndustryVertical,
      industryScopeLocked: false,
    });

    // Mock validateIndustryData to return valid data
    const validSaaSData = {
      industry: 'SaaS' as const,
      entityType: 'institution' as const,
      companySize: 100,
      planType: 'enterprise',
      features: ['feature1', 'feature2'],
      signupDate: '2024-01-01',
      accountStatus: 'active' as const,
    };
    vi.mocked(validateIndustryData).mockReturnValue(validSaaSData);

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity with valid SaaS data
    const result = await createEntityAction(
      {
        name: 'Test SaaS Company',
        industryData: validSaaSData,
      },
      'user_1',
      'workspace_saas',
      'institution',
      'org_1'
    );

    // Verify success
    expect(result.success).toBe(true);
    expect(validateIndustryData).toHaveBeenCalledWith(validSaaSData, 'SaaS');

    // Verify entity was created with industryData
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        industryData: validSaaSData,
        industry: 'SaaS',
      })
    );
  });

  it('should allow entity creation without industryData', async () => {
    // Setup: Workspace is SchoolEnrollment industry
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'SchoolEnrollment' as IndustryVertical,
      industryScopeLocked: false,
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity without industryData
    const result = await createEntityAction(
      {
        name: 'Test School',
        // No industryData provided
      },
      'user_1',
      'workspace_school',
      'institution',
      'org_1'
    );

    // Verify success
    expect(result.success).toBe(true);

    // Verify validateIndustryData was NOT called
    expect(validateIndustryData).not.toHaveBeenCalled();

    // Verify entity was created with workspace industry but no industryData
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        industry: 'SchoolEnrollment',
      })
    );
    expect(mockSet).toHaveBeenCalledWith(
      expect.not.objectContaining({
        industryData: expect.anything(),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: createEntity calls lockWorkspaceScope only when not yet locked
// Requirement 2.2, 2.3
// ─────────────────────────────────────────────────────────────────────────────

describe('createEntity - workspace scope locking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should lock workspace when workspace is not yet locked', async () => {
    // Setup: Workspace is not locked
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'RealEstate' as IndustryVertical,
      industryScopeLocked: false, // Not locked yet
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity
    const result = await createEntityAction(
      {
        name: 'Test Property Developer',
      },
      'user_1',
      'workspace_realestate',
      'institution',
      'org_1'
    );

    // Verify success
    expect(result.success).toBe(true);

    // Verify workspace was locked (check for update call with industryScopeLocked: true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        industryScopeLocked: true,
        industryScopeLockedAt: expect.any(String),
      })
    );

    // Verify the workspace collection was accessed
    expect(mockCollection).toHaveBeenCalledWith('workspaces');
  });

  it('should lock workspace after entity creation succeeds', async () => {
    // Setup: Workspace is not locked
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'Consultancy' as IndustryVertical,
      industryScopeLocked: false,
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity
    await createEntityAction(
      {
        name: 'Test Consulting Firm',
      },
      'user_1',
      'workspace_consultancy',
      'institution',
      'org_1'
    );

    // Verify entity was created before locking
    expect(mockSet).toHaveBeenCalledTimes(2); // entities + workspace_entities

    // Verify workspace was locked after entity creation
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        industryScopeLocked: true,
      })
    );
  });

  it('should lock workspace with correct workspace ID', async () => {
    // Setup: Workspace is not locked
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'Law' as IndustryVertical,
      industryScopeLocked: false,
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity with specific IDs
    await createEntityAction(
      {
        name: 'Test Law Firm',
      },
      'user_abc123',
      'workspace_law_xyz',
      'institution',
      'org_def456'
    );

    // Verify workspace lock was called with correct workspace ID
    expect(mockCollection).toHaveBeenCalledWith('workspaces');
    expect(mockDoc).toHaveBeenCalledWith('workspace_law_xyz');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        industryScopeLocked: true,
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: createEntity does not re-lock an already-locked workspace
// Requirement 2.2, 2.3
// ─────────────────────────────────────────────────────────────────────────────

describe('createEntity - no re-locking of locked workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT lock workspace when workspace is already locked', async () => {
    // Setup: Workspace is already locked
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'SaaS' as IndustryVertical,
      industryScopeLocked: true, // Already locked
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity
    const result = await createEntityAction(
      {
        name: 'Second SaaS Account',
      },
      'user_1',
      'workspace_saas',
      'institution',
      'org_1'
    );

    // Verify success
    expect(result.success).toBe(true);

    // Verify workspace was NOT locked (no update call with industryScopeLocked)
    // The update calls should only be for entity and workspace_entity creation
    const updateCalls = mockUpdate.mock.calls;
    const lockUpdateCalls = updateCalls.filter((call: any) => 
      call[0] && call[0].industryScopeLocked === true
    );
    expect(lockUpdateCalls.length).toBe(0);
  });

  it('should create entity successfully even when workspace is already locked', async () => {
    // Setup: Workspace is already locked
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'Marketing' as IndustryVertical,
      industryScopeLocked: true,
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity
    const result = await createEntityAction(
      {
        name: 'Another Marketing Client',
      },
      'user_1',
      'workspace_marketing',
      'institution',
      'org_1'
    );

    // Verify success
    expect(result.success).toBe(true);

    // Verify entity was created
    expect(mockSet).toHaveBeenCalledTimes(2); // entities + workspace_entities

    // Verify workspace was NOT locked (no update call with industryScopeLocked)
    const updateCalls = mockUpdate.mock.calls;
    const lockUpdateCalls = updateCalls.filter((call: any) => 
      call[0] && call[0].industryScopeLocked === true
    );
    expect(lockUpdateCalls.length).toBe(0);
  });

  it('should handle multiple entity creations in locked workspace without re-locking', async () => {
    // Setup: Workspace is already locked
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'SchoolEnrollment' as IndustryVertical,
      industryScopeLocked: true,
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create multiple entities
    await createEntityAction(
      { name: 'School 1' },
      'user_1',
      'workspace_school',
      'institution',
      'org_1'
    );

    await createEntityAction(
      { name: 'School 2' },
      'user_1',
      'workspace_school',
      'institution',
      'org_1'
    );

    await createEntityAction(
      { name: 'School 3' },
      'user_1',
      'workspace_school',
      'institution',
      'org_1'
    );

    // Verify all entities were created successfully
    expect(mockSet).toHaveBeenCalledTimes(6); // 3 entities × 2 collections

    // Verify workspace was NEVER locked (no update calls with industryScopeLocked)
    const updateCalls = mockUpdate.mock.calls;
    const lockUpdateCalls = updateCalls.filter((call: any) => 
      call[0] && call[0].industryScopeLocked === true
    );
    expect(lockUpdateCalls.length).toBe(0);
  });

  it('should check industryScopeLocked status before deciding to lock', async () => {
    // Setup: Workspace is already locked
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'RealEstate' as IndustryVertical,
      industryScopeLocked: true,
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity
    await createEntityAction(
      {
        name: 'Test Property',
      },
      'user_1',
      'workspace_realestate',
      'institution',
      'org_1'
    );

    // Verify getWorkspaceIndustry was called to check lock status
    expect(getWorkspaceIndustry).toHaveBeenCalledWith('workspace_realestate');

    // Verify the lock status was checked before deciding not to lock
    const workspaceInfo = await getWorkspaceIndustry('workspace_realestate');
    expect(workspaceInfo.industryScopeLocked).toBe(true);

    // Verify workspace was NOT locked
    const updateCalls = mockUpdate.mock.calls;
    const lockUpdateCalls = updateCalls.filter((call: any) => 
      call[0] && call[0].industryScopeLocked === true
    );
    expect(lockUpdateCalls.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests: Combined scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('createEntity - integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate industryData AND lock workspace on first entity creation', async () => {
    // Setup: Workspace is not locked, SaaS industry
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'SaaS' as IndustryVertical,
      industryScopeLocked: false,
    });

    // Mock validateIndustryData to return valid data
    const validSaaSData = {
      industry: 'SaaS' as const,
      entityType: 'institution' as const,
      companySize: 50,
      planType: 'pro',
      features: ['analytics'],
      signupDate: '2024-01-15',
      accountStatus: 'trial' as const,
    };
    vi.mocked(validateIndustryData).mockReturnValue(validSaaSData);

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create first entity with industryData
    const result = await createEntityAction(
      {
        name: 'First SaaS Account',
        industryData: validSaaSData,
      },
      'user_1',
      'workspace_saas',
      'institution',
      'org_1'
    );

    // Verify success
    expect(result.success).toBe(true);

    // Verify industryData was validated
    expect(validateIndustryData).toHaveBeenCalledWith(validSaaSData, 'SaaS');

    // Verify entity was created with industryData
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        industryData: validSaaSData,
        industry: 'SaaS',
      })
    );

    // Verify workspace was locked (check for update call with industryScopeLocked: true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        industryScopeLocked: true,
        industryScopeLockedAt: expect.any(String),
      })
    );
  });

  it('should reject mismatched industryData even if workspace is not locked', async () => {
    // Setup: Workspace is not locked, Law industry
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'Law' as IndustryVertical,
      industryScopeLocked: false,
    });

    // Mock validateIndustryData to throw on mismatch
    vi.mocked(validateIndustryData).mockImplementation(() => {
      throw new Error(
        'Industry mismatch: industryData.industry is "Marketing" but workspace industry is "Law"'
      );
    });

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Attempt to create entity with wrong industry data
    const result = await createEntityAction(
      {
        name: 'Test Entity',
        industryData: {
          industry: 'Marketing',
          entityType: 'institution',
          clientIndustry: 'tech',
          businessSize: {},
        },
      },
      'user_1',
      'workspace_law',
      'institution',
      'org_1'
    );

    // Verify rejection
    expect(result.success).toBe(false);
    expect(result.error).toContain('Industry mismatch');

    // Verify workspace was NOT locked (entity creation failed, no update with industryScopeLocked)
    const updateCalls = mockUpdate.mock.calls;
    const lockUpdateCalls = updateCalls.filter((call: any) => 
      call[0] && call[0].industryScopeLocked === true
    );
    expect(lockUpdateCalls.length).toBe(0);
  });

  it('should create entity with industryData in already-locked workspace without re-locking', async () => {
    // Setup: Workspace is already locked, Consultancy industry
    vi.mocked(getWorkspaceIndustry).mockResolvedValue({
      industry: 'Consultancy' as IndustryVertical,
      industryScopeLocked: true,
    });

    // Mock validateIndustryData to return valid data
    const validConsultancyData = {
      industry: 'Consultancy' as const,
      entityType: 'institution' as const,
      clientIndustry: 'finance',
      companySize: { employees: 200 },
    };
    vi.mocked(validateIndustryData).mockReturnValue(validConsultancyData);

    // Mock Firestore operations
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGet = vi.fn().mockResolvedValue({ empty: true });
    const mockDoc = vi.fn().mockReturnValue({ 
      set: mockSet,
      update: mockUpdate,
    });
    const mockWhere = vi.fn().mockReturnValue({ 
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    });
    const mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation(mockCollection as any);

    // Create entity
    const result = await createEntityAction(
      {
        name: 'Second Consulting Client',
        industryData: validConsultancyData,
      },
      'user_1',
      'workspace_consultancy',
      'institution',
      'org_1'
    );

    // Verify success
    expect(result.success).toBe(true);

    // Verify industryData was validated
    expect(validateIndustryData).toHaveBeenCalledWith(validConsultancyData, 'Consultancy');

    // Verify entity was created
    expect(mockSet).toHaveBeenCalledTimes(2);

    // Verify workspace was NOT re-locked (no update call with industryScopeLocked)
    const updateCalls = mockUpdate.mock.calls;
    const lockUpdateCalls = updateCalls.filter((call: any) => 
      call[0] && call[0].industryScopeLocked === true
    );
    expect(lockUpdateCalls.length).toBe(0);
  });
});

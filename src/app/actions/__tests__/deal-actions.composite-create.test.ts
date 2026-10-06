/**
 * @fileoverview Unit Tests: createDealWithNewEntityAction
 *
 * Verifies Phase 1 of the Inline Entity & Primary Contact Creation implementation:
 * - Schema boundary enforcement (rejects missing contact phone/email)
 * - Anti-IDOR & session authorization (requireWorkspace)
 * - Atomic composite creation of entity and deal
 * - Duplicate entity handling
 * - Defensive rollback on deal failure
 *
 * Compliance: agents_mcp_rules.md, .agents/AGENTS.md (Rule 4, 5, 8, 9, 10).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDealWithNewEntityAction } from '../deal-actions';
import type { CreateDealWithNewEntityParams } from '@/lib/deals/deal-types';

// Mock requireAuth and requireWorkspace
let mockWorkspaceUid = 'user_sales_rep_1';
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({ uid: mockWorkspaceUid })),
  requireWorkspace: vi.fn().mockImplementation(async (workspaceId: string) => {
    if (workspaceId === 'forbidden_workspace') {
      throw new Error('User not in workspace');
    }
    return { uid: mockWorkspaceUid, workspaceId };
  }),
}));

// Mock workspace-permissions
let permissionGranted = true;
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockImplementation(async () => ({
    granted: permissionGranted,
    reason: permissionGranted ? undefined : 'Permission denied',
  })),
}));

// Mock entity-core
let entityCreateSuccess = true;
let isDuplicateEntity = false;
let createdEntityId = 'ent_new_999';
vi.mock('@/lib/crm/entity-core', () => ({
  createEntityCore: vi.fn().mockImplementation(async () => {
    if (isDuplicateEntity) {
      return {
        success: false,
        error: 'Duplicate entity found.',
        isDuplicate: true,
        duplicates: [{ entityId: 'ent_existing_1', name: 'Acme Corp', reason: 'Exact name match' }],
      };
    }
    if (!entityCreateSuccess) {
      return {
        success: false,
        error: 'Failed to create entity in database.',
      };
    }
    return {
      success: true,
      id: createdEntityId,
    };
  }),
}));

// Mock deal-core
let dealCreateSuccess = true;
let createdDealId = 'deal_new_888';
vi.mock('@/lib/crm/deal-core', () => ({
  createDealCore: vi.fn().mockImplementation(async () => {
    if (!dealCreateSuccess) {
      return { error: 'Pipeline stage not found' };
    }
    return { id: createdDealId };
  }),
  checkPipelinePermission: vi.fn().mockResolvedValue({ granted: true }),
  actorAttributionUid: vi.fn().mockReturnValue('user_sales_rep_1'),
  workspaceOrganizationId: vi.fn().mockResolvedValue('org_test'),
  loadAuthorizedDeal: vi.fn(),
  updateDealStageCore: vi.fn(),
  updateDealValueCore: vi.fn(),
  updateDealStatusCore: vi.fn(),
  updateDealOwnerCore: vi.fn(),
  checkDealPlacement: vi.fn().mockResolvedValue({ granted: true }),
  resolveWorkspaceEntityRecord: vi.fn(),
}));

// Mock Firebase Admin
const deletedDocs: string[] = [];
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((docId: string) => ({
        id: docId,
        colName,
      })),
    })),
    batch: vi.fn(() => ({
      delete: vi.fn((docRef: { id: string; colName: string }) => {
        deletedDocs.push(`${docRef.colName}/${docRef.id}`);
      }),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('createDealWithNewEntityAction', () => {
  const defaultParams: CreateDealWithNewEntityParams = {
    workspaceId: 'ws_alpha',
    organizationId: 'org_test',
    entity: {
      name: 'Sterling Partners',
      entityType: 'institution',
      primaryContact: {
        name: 'Eleanor Vance',
        phone: '+233241234567',
        email: 'eleanor@sterling.com',
        role: 'Managing Partner',
      },
    },
    deal: {
      pipelineId: 'pipe_expansion',
      stageId: 'stage_qualified',
      name: 'Sterling Q4 Enterprise Deal',
      value: 75000,
      assignmentStrategy: 'direct',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    permissionGranted = true;
    entityCreateSuccess = true;
    isDuplicateEntity = false;
    dealCreateSuccess = true;
    deletedDocs.length = 0;
  });

  it('validates schema and rejects when neither phone nor email is provided', async () => {
    const invalidParams: CreateDealWithNewEntityParams = {
      ...defaultParams,
      entity: {
        ...defaultParams.entity,
        primaryContact: {
          name: 'Eleanor Vance',
          phone: '',
          email: '',
        },
      },
    };

    const res = await createDealWithNewEntityAction(invalidParams);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Please provide at least a phone number or an email address');
  });

  it('rejects when workspace authentication fails (anti-IDOR)', async () => {
    const forbiddenParams: CreateDealWithNewEntityParams = {
      ...defaultParams,
      workspaceId: 'forbidden_workspace',
    };

    await expect(createDealWithNewEntityAction(forbiddenParams)).rejects.toThrow('User not in workspace');
  });

  it('returns duplicate diagnostics when duplicate entity is detected without creating deal', async () => {
    isDuplicateEntity = true;

    const res = await createDealWithNewEntityAction(defaultParams);
    expect(res.success).toBe(false);
    expect(res.isDuplicate).toBe(true);
    expect(res.duplicates).toBeDefined();
    expect(res.duplicates?.length).toBe(1);
    expect(res.dealId).toBeUndefined();
  });

  it('successfully creates entity with primary/signatory contact and creates deal atomically', async () => {
    const res = await createDealWithNewEntityAction(defaultParams);

    expect(res.success).toBe(true);
    expect(res.entityId).toBe('ent_new_999');
    expect(res.dealId).toBe('deal_new_888');
    expect(res.focalContact).toBeDefined();
    expect(res.focalContact?.name).toBe('Eleanor Vance');
    expect(res.focalContact?.phone).toBe('+233241234567');
    expect(res.focalContact?.role).toBe('Managing Partner');
  });

  it('rolls back created entity documents if deal creation fails', async () => {
    dealCreateSuccess = false;

    const res = await createDealWithNewEntityAction(defaultParams);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Pipeline stage not found');

    // Verify defensive rollback deleted the newly created entity documents
    expect(deletedDocs).toContain('workspace_entities/ws_alpha_ent_new_999');
    expect(deletedDocs).toContain('entities/ent_new_999');
  });
});

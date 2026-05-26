// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { propagateIndustryGroupChanges } from '../industry-propagation';
import { adminDb } from '../../firebase-admin';
import { canUser } from '../../workspace-permissions';
import { listIndustryPredefinedGroupsAction, installPredefinedIndustryGroupsAction } from '../../fields-actions';

// Mock permissions check using both relative and alias paths to guarantee resolution
vi.mock('../../workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true, reason: '' }),
}));
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true, reason: '' }),
}));

// Mock revalidatePath to avoid Invariant errors in tests
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Stable mock references
const mockWorkspacesGet = vi.fn();
const mockGroupsWhere = vi.fn();
const mockFieldsWhere = vi.fn();

const mockBatch = {
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((name) => {
        if (name === 'workspaces') {
          return {
            get: mockWorkspacesGet,
            doc: vi.fn((id) => ({
              get: mockWorkspacesGet,
              path: `workspaces/${id}`,
            })),
          };
        }
        if (name === 'field_groups' || name === 'platform_industry_field_groups') {
          return {
            where: mockGroupsWhere,
            doc: vi.fn((id) => ({ path: `${name}/${id}` })),
          };
        }
        if (name === 'app_fields') {
          return {
            where: mockFieldsWhere,
            doc: vi.fn((id) => ({ path: `app_fields/${id}` })),
          };
        }
        return {
          get: vi.fn(),
          where: vi.fn(() => ({ get: vi.fn() })),
          doc: vi.fn(() => ({ path: 'unknown' })),
        };
      }),
      batch: vi.fn(() => mockBatch),
    },
  };
});

describe('Industry Propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canUser.mockResolvedValue({ granted: true, reason: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should correctly select workspaces matching targeted industry including fallback', async () => {
    const mockWorkspaces = [
      { id: 'ws_saas', data: () => ({ industry: 'SaaS', organizationId: 'org_saas' }) },
      { id: 'ws_school', data: () => ({ industry: 'SchoolEnrollment', organizationId: 'org_school' }) },
      { id: 'ws_fallback', data: () => ({ industry: undefined, organizationId: 'org_fallback' }) }, // falls back to SchoolEnrollment
    ];

    mockWorkspacesGet.mockResolvedValue({ docs: mockWorkspaces });

    mockGroupsWhere.mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
    });
    mockFieldsWhere.mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
    });

    const groupDef = {
      slug: 'enrollment_metrics',
      name: 'Enrollment Metrics',
      description: 'Metrics',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'Capacity', variableName: 'capacity', type: 'number', compatibilityScope: ['institution'] }
      ]
    };

    const result = await propagateIndustryGroupChanges('SchoolEnrollment', 'enrollment_metrics', false, groupDef);

    expect(result.success).toBe(true);
    // Should update 2 workspaces: ws_school and ws_fallback
    expect(result.count).toBe(2);

    // Verify batch.set is called for both workspaces (2 group sets + 2 field sets)
    expect(mockBatch.set).toHaveBeenCalledTimes(4);
  });

  it('should perform a smart merge preserving local customizations', async () => {
    const mockWorkspaces = [
      { id: 'ws_saas', data: () => ({ industry: 'SaaS', organizationId: 'org_saas' }) },
    ];

    mockWorkspacesGet.mockResolvedValue({ docs: mockWorkspaces });

    const mockGroup = {
      id: 'group_ws_saas_saas_ops',
      workspaceId: 'ws_saas',
      slug: 'saas_ops',
      name: 'SaaS Ops',
    };

    const mockField = {
      id: 'field_ws_saas_saas_tier',
      workspaceId: 'ws_saas',
      variableName: 'saas_tier',
      label: 'SaaS Custom Tier Label', // Customized!
      helpText: 'Custom helper info', // Customized!
      status: 'active',
      groupId: 'group_ws_saas_saas_ops',
    };

    mockGroupsWhere.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [{ id: 'group_ws_saas_saas_ops', data: () => mockGroup }],
      }),
    });

    mockFieldsWhere.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [{ id: 'field_ws_saas_saas_tier', data: () => mockField }],
      }),
    });

    const groupDef = {
      slug: 'saas_ops',
      name: 'SaaS Ops',
      description: 'Operations',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        {
          name: 'SaaS Tier',
          variableName: 'saas_tier',
          type: 'select',
          compatibilityScope: ['institution'],
          helpText: 'Default help text',
        }
      ]
    };

    const result = await propagateIndustryGroupChanges('SaaS', 'saas_ops', false, groupDef);
    expect(result.success).toBe(true);

    const fieldSetCall = mockBatch.set.mock.calls.find(
      (call) => call[0].path === 'app_fields/field_ws_saas_saas_tier'
    );

    expect(fieldSetCall).toBeDefined();
    const savedPayload = fieldSetCall[1];

    // Smart Merge preserves local overrides
    expect(savedPayload.label).toBe('SaaS Custom Tier Label');
    expect(savedPayload.helpText).toBe('Custom helper info');
    expect(savedPayload.type).toBe('select');
  });

  it('should delete fields no longer in group list', async () => {
    const mockWorkspaces = [
      { id: 'ws_saas', data: () => ({ industry: 'SaaS', organizationId: 'org_saas' }) },
    ];

    mockWorkspacesGet.mockResolvedValue({ docs: mockWorkspaces });

    const mockGroup = {
      id: 'group_ws_saas_saas_ops',
      workspaceId: 'ws_saas',
      slug: 'saas_ops',
    };

    const mockFields = [
      { id: 'field_ws_saas_saas_tier', workspaceId: 'ws_saas', variableName: 'saas_tier', groupId: 'group_ws_saas_saas_ops' },
      { id: 'field_ws_saas_old_field', workspaceId: 'ws_saas', variableName: 'old_field', groupId: 'group_ws_saas_saas_ops', industryOrigin: 'SaaS', section: 'saas_ops' },
    ];

    mockGroupsWhere.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [{ id: 'group_ws_saas_saas_ops', data: () => mockGroup }],
      }),
    });

    mockFieldsWhere.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: mockFields.map(f => ({ id: f.id, data: () => f })),
      }),
    });

    const groupDef = {
      slug: 'saas_ops',
      name: 'SaaS Ops',
      description: 'Operations',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'SaaS Tier', variableName: 'saas_tier', type: 'select', compatibilityScope: ['institution'] }
      ]
    };

    const result = await propagateIndustryGroupChanges('SaaS', 'saas_ops', false, groupDef);
    expect(result.success).toBe(true);

    expect(mockBatch.delete).toHaveBeenCalledTimes(1);
    expect(mockBatch.delete.mock.calls[0][0].path).toBe('app_fields/field_ws_saas_old_field');
  });

  describe('Workspace Auto-Initialization Actions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('listIndustryPredefinedGroupsAction', () => {
      it('should query the platform predefined collection', async () => {
        const mockPredefinedGroups = [
          { slug: 'saas_ops', name: 'SaaS Ops', industry: 'SaaS' }
        ];

        mockGroupsWhere.mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: mockPredefinedGroups.map(g => ({ id: `SaaS_${g.slug}`, data: () => g }))
          })
        });

        const res = await listIndustryPredefinedGroupsAction('SaaS');

        expect(res.success).toBe(true);
        expect(res.data).toHaveLength(1);
        expect(res.data[0].slug).toBe('saas_ops');
      });
    });

    describe('installPredefinedIndustryGroupsAction', () => {
      it('should verify permission, fetch predefined groups, and transactionally seed them', async () => {
        // Mock workspaces doc lookup
        mockWorkspacesGet.mockResolvedValue({
          exists: true,
          data: () => ({ industry: 'SaaS', organizationId: 'org_saas' })
        });

        const mockPredefinedGroup = {
          slug: 'saas_ops',
          name: 'SaaS Ops',
          industry: 'SaaS',
          entityTypes: ['institution'],
          order: 10,
          fields: [
            { name: 'SaaS Tier', variableName: 'saas_tier', type: 'select', compatibilityScope: ['institution'], helpText: 'Help' }
          ]
        };

        mockGroupsWhere.mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: [{ id: 'SaaS_saas_ops', data: () => mockPredefinedGroup }]
          })
        });

        const res = await installPredefinedIndustryGroupsAction('ws_saas', 'org_saas', ['saas_ops'], 'user123');

        expect(res.success).toBe(true);

        // Verify deterministic group ID
        const groupSetCall = mockBatch.set.mock.calls.find(
          (call) => call[0].path === 'field_groups/group_ws_saas_saas_ops'
        );
        expect(groupSetCall).toBeDefined();
        expect(groupSetCall[1].slug).toBe('saas_ops');

        // Verify deterministic field ID
        const fieldSetCall = mockBatch.set.mock.calls.find(
          (call) => call[0].path === 'app_fields/field_ws_saas_saas_tier'
        );
        expect(fieldSetCall).toBeDefined();
        expect(fieldSetCall[1].variableName).toBe('saas_tier');
      });
    });
  });
});

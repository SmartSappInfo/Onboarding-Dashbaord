import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDocumentsExist,
  mockBatchSet,
  mockBatchCommit,
  mockAssertPermission,
} = vi.hoisted(() => {
  const mockDocumentsExist = vi.fn();
  const mockBatchSet = vi.fn();
  const mockBatchCommit = vi.fn();
  const mockAssertPermission = vi.fn();

  return {
    mockDocumentsExist,
    mockBatchSet,
    mockBatchCommit,
    mockAssertPermission,
  };
});

vi.mock('../firebase-admin', () => {
  const mockDb = {
    collection: vi.fn((colName: string) => {
      return {
        doc: vi.fn((id?: string) => {
          const finalId = id || `mock-id-${Math.random().toString(36).substring(7)}`;
          return {
            id: finalId,
            get: vi.fn(async () => {
              if (colName === 'automations') {
                return {
                  exists: true,
                  data: () => ({
                    name: 'Welcome Workflow',
                    description: 'A test flow',
                    triggers: [
                      {
                        type: 'TAG_ADDED',
                        config: { tagIds: ['tag-1'] },
                      },
                    ],
                    nodes: [
                      {
                        id: 'n1',
                        type: 'actionNode',
                        data: {
                          label: 'Send Email',
                          actionType: 'SEND_EMAIL',
                          config: { templateId: 'temp-1' },
                        },
                      },
                    ],
                    edges: [
                      {
                        id: 'e1',
                        source: 'triggerNode',
                        target: 'n1',
                      },
                    ],
                  }),
                };
              }
              if (colName === 'workspaces') {
                return {
                  exists: true,
                  data: () => ({ organizationId: 'org-99' }),
                };
              }
              if (colName === 'message_templates') {
                return {
                  exists: true,
                  data: () => ({
                    name: 'Sample Template',
                    status: 'active',
                    category: 'onboarding',
                    templateType: 'welcome',
                    channel: 'email',
                    body: 'Hello World',
                  }),
                };
              }
              return { exists: false, data: () => undefined };
            }),
            set: vi.fn(),
          };
        }),
        where: vi.fn((field?: string) => {
          const query = {
            where: () => query,
            limit: () => query,
            get: vi.fn(async () => {
              if (colName === 'message_templates') {
                if (field === '__name__') {
                  return {
                    empty: false,
                    docs: [
                      {
                        id: 'temp-1',
                        data: () => ({
                          name: 'Sample Template',
                          category: 'onboarding',
                          templateType: 'welcome',
                          channel: 'email',
                          body: 'Hello World',
                        }),
                      },
                    ],
                  };
                }
                // For duplicate check in import
                return { empty: true, docs: [] };
              }
              if (colName === 'tags') {
                if (field === '__name__') {
                  return {
                    empty: false,
                    docs: [
                      {
                        id: 'tag-1',
                        data: () => ({
                          name: 'LeadTag',
                          color: 'blue',
                        }),
                      },
                    ],
                  };
                }
                // For duplicate check in import
                return { empty: true, docs: [] };
              }
              return { empty: true, docs: [] };
            }),
          };
          return query;
        }),
      };
    }),
    getAll: vi.fn(async (...refs: { id: string }[]) => {
      return refs.map((ref) => ({
        id: ref.id,
        exists: true,
        data: () => ({
          name: 'Sample Template',
          status: 'active',
          category: 'onboarding',
          templateType: 'welcome',
          channel: 'email',
          body: 'Hello World',
        }),
      }));
    }),
    batch: vi.fn(() => ({
      set: mockBatchSet,
      commit: mockBatchCommit,
    })),
  };

  return {
    adminDb: mockDb,
  };
});

vi.mock('../automations/repository', () => ({
  documentsExist: mockDocumentsExist,
}));

vi.mock('../automation-permissions', () => ({
  assertAutomationManagePermission: mockAssertPermission,
}));

import { buildAutomationExport, importAutomationAction } from '../automations/portability';
import type { AutomationExportEnvelope } from '../automations/portability';

describe('Automation Portability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockAssertPermission.mockResolvedValue(undefined);
    mockDocumentsExist.mockResolvedValue(new Set());
  });

  describe('buildAutomationExport', () => {
    it('successfully extracts an automation, strips its identifiers, and populates the manifest', async () => {
      const result = await buildAutomationExport('auto-123');

      expect(result.format).toBe('minex360.automation');
      expect(result.automation.name).toBe('Welcome Workflow');
      expect(result.automation.description).toBe('A test flow');
      expect(result.manifest.templates).toBeDefined();
      expect(result.manifest.templates.length).toBe(1);
      expect(result.manifest.templates[0].id).toBe('temp-1');
      expect(result.manifest.tags).toBeDefined();
      expect(result.manifest.tags.length).toBe(1);
      expect(result.manifest.tags[0].name).toBe('LeadTag');
    });
  });

  describe('importAutomationAction', () => {
    it('creates missing templates and tags, maps IDs, and commits batch', async () => {
      const envelope: AutomationExportEnvelope = {
        format: 'minex360.automation',
        version: 1,
        exportedAt: new Date().toISOString(),
        automation: {
          name: 'Import Test',
          triggers: [{ type: 'TAG_ADDED', config: { tagIds: ['tag-1'] } }],
          nodes: [
            {
              id: 'n1',
              type: 'actionNode',
              data: {
                actionType: 'SEND_EMAIL',
                config: { templateId: 'temp-1' },
              },
            },
          ],
          edges: [],
        },
        manifest: {
          templates: [
            {
              id: 'temp-1',
              name: 'Sample Template',
              category: 'onboarding',
              templateType: 'welcome',
              channel: 'email',
              body: 'Hello World',
              variableContext: 'onboarding',
              declaredVariables: [],
            },
          ],
          tags: [{ id: 'tag-1', name: 'LeadTag' }],
          pipelines: [],
          webhooks: [],
        },
      };

      const result = await importAutomationAction(
        envelope,
        {
          pipelines: {},
          stages: {},
          webhooks: {},
        },
        'workspace-123',
        'user-abc'
      );

      expect(mockAssertPermission).toHaveBeenCalledWith('user-abc', ['workspace-123'], 'create');
      expect(mockBatchSet).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });
  });
});

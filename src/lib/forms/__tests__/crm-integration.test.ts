import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getWorkspacePipelinesAction, 
  getWorkspaceTeamMembersAction, 
  saveFormCrmSettingsAction 
} from '../crm-integration-actions';
import { resolveAndEnrichCrmEntity } from '../identity-resolution';
import type { Form } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/firebase-admin', () => {
  const mockPipelines = [
    {
      id: 'pipe_1',
      data: () => ({
        name: 'Admissions Pipeline',
        workspaceId: 'ws_test',
        stages: [
          { id: 'st_1', name: 'Inquiry', order: 0 },
          { id: 'st_2', name: 'Application Submitted', order: 1 },
        ],
      }),
    },
  ];

  const mockUsers = [
    {
      id: 'user_1',
      data: () => ({
        name: 'Dr. Sarah Connor',
        email: 'sarah@example.com',
        workspaceIds: ['ws_test'],
      }),
    },
  ];

  const mockFormsUpdate = vi.fn().mockResolvedValue(undefined);
  const mockFormsDoc = vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({
      exists: true,
      id: 'form_test',
      data: () => ({ workspaceId: 'ws_test', actions: {} }),
    }),
    update: mockFormsUpdate,
  });

  const mockCollection = vi.fn((name: string) => {
    if (name === 'pipelines') {
      return {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: mockPipelines }),
        }),
      };
    }
    if (name === 'users') {
      return {
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: mockUsers }),
          }),
        }),
      };
    }
    if (name === 'forms') {
      return { doc: mockFormsDoc };
    }
    if (name === 'workspace_entities') {
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'ent_crm_123',
            data: () => ({ workspaceId: 'ws_test', entityId: 'ent_crm_123' }),
          }),
        }),
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                empty: false,
                docs: [{ id: 'ent_crm_123', data: () => ({ entityId: 'ent_crm_123' }) }],
              }),
            }),
          }),
        }),
      };
    }
    if (name === 'app_fields') {
      const mockQuery: Record<string, unknown> = {};
      mockQuery.get = vi.fn().mockResolvedValue({ docs: [] });
      mockQuery.where = vi.fn().mockReturnValue(mockQuery);
      return mockQuery;
    }
    return {
      doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
      add: vi.fn().mockResolvedValue({ id: 'doc_123' }),
    };
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
  };
});

const mockCreateDeal = vi.fn().mockResolvedValue({ id: 'deal_999' });
vi.mock('@/app/actions/deal-actions', () => ({
  createDeal: (data: any) => mockCreateDeal(data),
}));

const mockCreateTask = vi.fn().mockResolvedValue({ success: true, id: 'task_888' });
vi.mock('@/lib/task-server-actions', () => ({
  createTaskAction: (data: any, userId: string) => mockCreateTask(data, userId),
}));

const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/activity-logger', () => ({
  logActivity: (data: any) => mockLogActivity(data),
}));

vi.mock('@/lib/tag-actions', () => ({
  applyTagsAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/entity-actions', () => ({
  createEntityAction: vi.fn().mockResolvedValue({ success: true, id: 'ent_crm_123' }),
  updateEntityAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('SmartSapp Forms 2.0: CRM Integration Studio & Automated Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pipelines & Team Members Server Actions', () => {
    it('fetches workspace pipelines and sorts stages', async () => {
      const pipelines = await getWorkspacePipelinesAction('ws_test');
      expect(pipelines.length).toBeGreaterThan(0);
      expect(pipelines[0].name).toBe('Admissions Pipeline');
      expect(pipelines[0].stages[0].name).toBe('Inquiry');
    });

    it('fetches workspace team members', async () => {
      const members = await getWorkspaceTeamMembersAction('ws_test');
      expect(members.length).toBe(1);
      expect(members[0].name).toBe('Dr. Sarah Connor');
      expect(members[0].email).toBe('sarah@example.com');
    });

    it('saves CRM settings onto the form document', async () => {
      const res = await saveFormCrmSettingsAction('form_test', {
        entityHandling: 'create_or_update',
        contactScope: 'person',
        leadSource: 'open_day_2026',
        dealCreation: {
          enabled: true,
          pipelineId: 'pipe_1',
          stageId: 'st_1',
          titleTemplate: '{{name}} - Admissions',
        },
      });

      expect(res.success).toBe(true);
    });
  });

  describe('Automated Deal & Follow-Up Task Spawning', () => {
    const mockFormWithCrmRules: Form = {
      id: 'form_crm_test',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      internalName: 'Admissions Intake',
      title: 'Admissions Intake',
      slug: 'admissions-intake',
      formType: 'global',
      contactScope: 'person',
      fields: [],
      theme: { preset: 'professional' } as any,
      successBehavior: { type: 'message' },
      actions: {
        entityHandling: 'create_or_update',
        dealCreation: {
          enabled: true,
          pipelineId: 'pipe_1',
          stageId: 'st_1',
          titleTemplate: '{{name}} - Admissions Inquiry',
        },
        taskAssignment: {
          enabled: true,
          titleTemplate: 'Follow up with {{name}}',
          assignedUserId: 'user_1',
          priority: 'high',
          dueInHours: 48,
        },
        tags: ['tag_lead'],
        automations: [],
        webhooks: [],
      },
      status: 'published',
      submissionCount: 0,
      createdAt: '2026-09-01T00:00:00Z',
    };

    it('spawns deal and follow-up task on submission and records in timeline activity', async () => {
      const result = await resolveAndEnrichCrmEntity({
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        form: mockFormWithCrmRules,
        formData: {
          name: 'Kwame Mensah',
          email: 'kwame@example.com',
        },
      });

      expect(result.matched).toBe(true);
      expect(result.entityId).toBe('ent_crm_123');

      // Verify createDeal was invoked with templated name
      expect(mockCreateDeal).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Kwame Mensah - Admissions Inquiry',
        entityId: 'ent_crm_123',
        pipelineId: 'pipe_1',
        stageId: 'st_1',
      }));

      // Verify createTaskAction was invoked with templated title and priority
      expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Follow up with Kwame Mensah',
        entityId: 'ent_crm_123',
        priority: 'high',
      }), expect.stringContaining('system-form-'));

      // Verify logActivity includes dealId and taskId
      expect(mockLogActivity).toHaveBeenCalledWith(expect.objectContaining({
        type: 'form_submitted',
        dealId: 'deal_999',
        metadata: expect.objectContaining({
          dealId: 'deal_999',
          taskId: 'task_888',
        }),
      }));
    });
  });
});

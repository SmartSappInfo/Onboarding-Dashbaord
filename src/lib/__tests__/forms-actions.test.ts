import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockStore, mockFirebase } = await vi.hoisted(async () => {
  const { createMockStore, createFirebaseAdminMock } = await import('./__mocks__/firebase-admin-mock');
  const store = createMockStore();
  const firebaseMock = createFirebaseAdminMock(store);
  return { mockStore: store, mockFirebase: firebaseMock };
});

// Mock firebase-admin first using hoisted factory
vi.mock('../firebase-admin', () => ({
  get adminDb() {
    return mockFirebase.adminDb;
  }
}));

// Mock firestore FieldValue
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: vi.fn((n: number) => ({
      _methodName: 'FieldValue.increment',
      value: n
    }))
  }
}));

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock webhook-engine
const mockDispatchWebhook = vi.fn(async () => {});
vi.mock('../webhook-engine', () => ({
  dispatchWebhook: mockDispatchWebhook
}));

// Mock workspace-permissions
vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn(async () => ({ granted: true }))
}));

// Mock entity-actions
const mockCreateEntityAction = vi.fn(async (data: any, userId: string, workspaceId: string, entityType: string, orgId: string) => {
  const id = `entity-${Date.now()}`;
  mockStore.entities.set(id, { id, ...data, organizationId: orgId, workspaceId, entityType });
  return { success: true, id };
});

const mockUpdateEntityAction = vi.fn(async (entityId: string, data: any, userId: string, workspaceId: string, orgId: string) => {
  const existing = mockStore.entities.get(entityId) || {};
  mockStore.entities.set(entityId, { ...existing, ...data });
  return { success: true };
});

vi.mock('../entity-actions', () => ({
  createEntityAction: (data: any, userId: string, workspaceId: string, entityType: any, orgId?: string, forceCreate?: boolean) =>
    mockCreateEntityAction(data, userId, workspaceId, entityType, orgId || 'default'),
  updateEntityAction: (entityId: string, data: any, userId: string, workspaceId: string, orgId: string) =>
    mockUpdateEntityAction(entityId, data, userId, workspaceId, orgId),
}));

import {
  getFormByIdAction,
  getFormSubmissionsAction,
  exportSubmissionsAsCsvAction,
  processFormSubmissionAction,
  deleteFormAction
} from '../forms-actions';
import type { Form, AppField } from '../types';

describe('Forms Actions', () => {
  beforeEach(() => {
    mockStore.reset();
    vi.clearAllMocks();
  });

  describe('getFormByIdAction', () => {
    it('should return a form if it exists', async () => {
      const mockForm = { id: 'form-1', title: 'Contact Us', workspaceId: 'ws-1' };
      mockStore.forms.set('form-1', mockForm);

      const result = await getFormByIdAction('form-1');
      expect(result).toEqual(mockForm);
    });

    it('should return null if it does not exist', async () => {
      const result = await getFormByIdAction('form-non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getFormSubmissionsAction', () => {
    it('should return paginated list of submissions ordered by submittedAt desc', async () => {
      const submissions = [
        { id: 's1', formId: 'form-1', submittedAt: '2026-05-22T10:00:00Z', data: {} },
        { id: 's2', formId: 'form-1', submittedAt: '2026-05-22T11:00:00Z', data: {} },
        { id: 's3', formId: 'form-1', submittedAt: '2026-05-22T09:00:00Z', data: {} },
      ];

      submissions.forEach(s => mockStore.form_submissions.set(s.id, s));

      const result = await getFormSubmissionsAction('form-1', { limit: 2 });
      
      // Should be sorted desc by submittedAt: s2 (11:00) then s1 (10:00)
      expect(result.submissions).toHaveLength(2);
      expect(result.submissions[0].id).toBe('s2');
      expect(result.submissions[1].id).toBe('s1');
      
      // Should return nextCursor (submittedAt of last returned submission)
      expect(result.nextCursor).toBe('2026-05-22T10:00:00Z');
    });
  });

  describe('exportSubmissionsAsCsvAction', () => {
    it('should return CSV representation of submissions', async () => {
      const mockForm = { id: 'form-1', internalName: 'Signup Form', workspaceId: 'ws-1' };
      mockStore.forms.set('form-1', mockForm);

      const submissions = [
        { id: 's1', formId: 'form-1', submittedAt: '2026-05-22T10:00:00Z', data: { name: 'Alice', age: '20' }, workspaceId: 'ws-1' },
      ];
      submissions.forEach(s => mockStore.form_submissions.set(s.id, s));

      const fields = [
        { id: 'f1', name: 'name', variableName: 'name', label: 'Name', type: 'short_text', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', createdAt: '', isNative: false, compatibilityScope: ['person'] },
        { id: 'f2', name: 'age', variableName: 'age', label: 'Age', type: 'number', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', createdAt: '', isNative: false, compatibilityScope: ['person'] },
      ] as unknown as AppField[];
      fields.forEach(f => mockStore.app_fields.set(f.id, f));

      const result = await exportSubmissionsAsCsvAction('form-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.csv).toContain('Name,Age');
        expect(result.csv).toContain('Alice,20');
        const today = new Date().toISOString().split('T')[0];
        expect(result.filename).toBe(`signup_form_submissions_${today}.csv`);
      }
    });
  });

  describe('processFormSubmissionAction', () => {
    it('should save submission, increment form counter, and dispatch webhooks', async () => {
      const mockForm = {
        id: 'form-1',
        title: 'Feedback',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        status: 'published',
        submissionCount: 5,
        formType: 'global',
        actions: { webhooks: ['http://example.com/webhook'], tags: [], automations: [] },
        fields: [
          { id: 'f1', appFieldId: 'f1', required: true, hidden: false, order: 0 }
        ],
        createdAt: '',
        updatedAt: '',
        internalName: '',
        contactScope: 'person',
        theme: { preset: 'minimal' },
        successBehavior: { type: 'message', value: 'Thank you' }
      } as unknown as Form;
      mockStore.forms.set('form-1', mockForm);

      const payload = {
        formId: 'form-1',
        data: { name: 'John Doe' },
        sourcePageId: 'page-123'
      };

      const result = await processFormSubmissionAction(payload);
      expect(result.success).toBe(true);

      // Verify submission is saved
      const savedSubs = Array.from(mockStore.form_submissions.values());
      expect(savedSubs).toHaveLength(1);
      expect(savedSubs[0].data).toEqual({ name: 'John Doe' });
      expect(savedSubs[0].sourcePageId).toBe('page-123');

      // Verify submissionCount is incremented atomically
      const updatedForm = mockStore.forms.get('form-1');
      expect(updatedForm.submissionCount).toBe(6); // 5 + 1

      // Verify webhook is dispatched
      expect(mockDispatchWebhook).toHaveBeenCalled();
    });

    it('should map native updates for bound form types', async () => {
      const mockForm = {
        id: 'form-1',
        title: 'Edit Profile',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        status: 'published',
        submissionCount: 0,
        formType: 'bound',
        contactScope: 'person',
        actions: { tags: [], automations: [], webhooks: [] },
        fields: [],
        createdAt: '',
        updatedAt: '',
        internalName: '',
        theme: { preset: 'minimal' },
        successBehavior: { type: 'message', value: '' }
      } as unknown as Form;
      mockStore.forms.set('form-1', mockForm);

      const fields = [
        { id: 'f1', name: 'name', variableName: 'name', label: 'Name', type: 'short_text', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: true, compatibilityScope: ['person'], createdAt: '' },
      ] as unknown as AppField[];
      fields.forEach(f => mockStore.app_fields.set(f.id, f));

      mockStore.entities.set('entity-1', { id: 'entity-1', name: 'Old Name', organizationId: 'org-1' });

      const payload = {
        formId: 'form-1',
        entityId: 'entity-1',
        data: { name: 'New Name' },
      };

      const result = await processFormSubmissionAction(payload);
      expect(result.success).toBe(true);

      const updatedEntity = mockStore.entities.get('entity-1');
      expect(updatedEntity.name).toBe('New Name');
    });

    it('should resolve and update entity if match is found by email', async () => {
      const mockForm = {
        id: 'form-1',
        title: 'Bound Form',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        status: 'published',
        submissionCount: 0,
        formType: 'bound',
        contactScope: 'person',
        actions: { entityHandling: 'create_or_update', tags: [], automations: [], webhooks: [] },
        fields: [],
        createdAt: '',
        updatedAt: '',
        internalName: '',
        theme: { preset: 'minimal' },
        successBehavior: { type: 'message', value: '' }
      } as unknown as Form;
      mockStore.forms.set('form-1', mockForm);

      const fields = [
        { id: 'f1', name: 'email', variableName: 'email', label: 'Email', type: 'email', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: true, compatibilityScope: ['person'], createdAt: '' },
        { id: 'f2', name: 'name', variableName: 'name', label: 'Name', type: 'short_text', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: true, compatibilityScope: ['person'], createdAt: '' },
      ] as unknown as AppField[];
      fields.forEach(f => mockStore.app_fields.set(f.id, f));

      // Preset an existing entity and a workspace_entities mapping
      mockStore.entities.set('entity-matched', { id: 'entity-matched', name: 'Old Name', organizationId: 'org-1', workspaceId: 'ws-1' });
      mockStore.setWorkspaceEntity('ws-1', { id: 'we-matched', entityId: 'entity-matched', workspaceId: 'ws-1', primaryEmail: 'matched@example.com' });

      const payload = {
        formId: 'form-1',
        data: { email: 'matched@example.com', name: 'Matched Name' }
      };

      const result = await processFormSubmissionAction(payload);
      expect(result.success).toBe(true);

      const updatedEntity = mockStore.entities.get('entity-matched');
      expect(updatedEntity.name).toBe('Matched Name');

      const savedSubs = Array.from(mockStore.form_submissions.values());
      const sub = savedSubs.find(s => s.formId === 'form-1');
      expect(sub.entityId).toBe('entity-matched');
    });

    it('should create new entity if no match is found by email/phone', async () => {
      const mockForm = {
        id: 'form-2',
        title: 'Bound Form 2',
        workspaceId: 'ws-2',
        organizationId: 'org-1',
        status: 'published',
        submissionCount: 0,
        formType: 'bound',
        contactScope: 'person',
        actions: { entityHandling: 'create_or_update', tags: [], automations: [], webhooks: [] },
        fields: [],
        createdAt: '',
        updatedAt: '',
        internalName: '',
        theme: { preset: 'minimal' },
        successBehavior: { type: 'message', value: '' }
      } as unknown as Form;
      mockStore.forms.set('form-2', mockForm);

      const fields = [
        { id: 'f1', name: 'email', variableName: 'email', label: 'Email', type: 'email', workspaceId: 'ws-2', organizationId: 'org-1', status: 'active', isNative: true, compatibilityScope: ['person'], createdAt: '' },
        { id: 'f2', name: 'name', variableName: 'name', label: 'Name', type: 'short_text', workspaceId: 'ws-2', organizationId: 'org-1', status: 'active', isNative: true, compatibilityScope: ['person'], createdAt: '' },
      ] as unknown as AppField[];
      fields.forEach(f => mockStore.app_fields.set(f.id, f));

      const payload = {
        formId: 'form-2',
        data: { email: 'new@example.com', name: 'New Contact' }
      };

      const result = await processFormSubmissionAction(payload);
      expect(result.success).toBe(true);

      // Verify the new entity was created
      const entitiesList = Array.from(mockStore.entities.values());
      const newEntity = entitiesList.find(e => e.workspaceId === 'ws-2');
      expect(newEntity).toBeDefined();
      expect(newEntity.name).toBe('New Contact');

      const savedSubs = Array.from(mockStore.form_submissions.values());
      const sub = savedSubs.find(s => s.formId === 'form-2');
      expect(sub.entityId).toBe(newEntity.id);
    });
  });

  describe('deleteFormAction', () => {
    it('should delete form and all its submissions in chunked batches', async () => {
      mockStore.forms.set('form-1', { id: 'form-1', title: 'To Delete', workspaceId: 'ws-1' });
      
      // Populate 450 submissions (needs chunked batch deletion)
      for (let i = 0; i < 450; i++) {
        mockStore.form_submissions.set(`s-${i}`, { id: `s-${i}`, formId: 'form-1', workspaceId: 'ws-1' });
      }

      const result = await deleteFormAction('form-1', 'user-1');
      expect(result.success).toBe(true);
      expect(result.deletedSubmissions).toBe(450);

      // Verify everything is deleted
      expect(mockStore.forms.has('form-1')).toBe(false);
      expect(mockStore.form_submissions.size).toBe(0);
    });
  });
});

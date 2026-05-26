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

// Mock workspace-permissions
vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn(async () => ({ granted: true }))
}));

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

import { deleteFieldAction } from '../fields-actions';

describe('Fields Actions - deleteFieldAction constraints', () => {
  beforeEach(() => {
    mockStore.reset();
    vi.clearAllMocks();
  });

  it('should delete a custom field if it is not used in any form', async () => {
    const customField = {
      id: 'field-1',
      workspaceId: 'ws-1',
      isNative: false,
      label: 'Admissions Notes'
    };
    mockStore.app_fields.set('field-1', customField);

    const result = await deleteFieldAction('field-1', 'user-1');
    expect(result.success).toBe(true);
    expect(mockStore.app_fields.has('field-1')).toBe(false);
  });

  it('should block deletion of a custom field if it is used in a workspace form', async () => {
    const customField = {
      id: 'field-1',
      workspaceId: 'ws-1',
      isNative: false,
      label: 'Admissions Notes'
    };
    mockStore.app_fields.set('field-1', customField);

    const mockForm = {
      id: 'form-1',
      workspaceId: 'ws-1',
      title: 'Contact Form',
      fields: [
        { id: 'inst-1', appFieldId: 'field-1', required: false, order: 0 }
      ]
    };
    mockStore.forms.set('form-1', mockForm);

    const result = await deleteFieldAction('field-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('This field is currently in use');
    expect(mockStore.app_fields.has('field-1')).toBe(true); // Should not be deleted
  });
});

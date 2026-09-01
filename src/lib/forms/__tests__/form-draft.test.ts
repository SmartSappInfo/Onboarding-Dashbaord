import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormDraftService } from '../form-draft-service';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('SmartSapp Forms 2.0: Form Draft Service Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('saves and retrieves local form drafts correctly', () => {
    const formId = 'test-form-123';
    const data = { firstName: 'Alice', email: 'alice@example.com', step: 2 };
    
    FormDraftService.saveLocalDraft(formId, data, 1);
    
    const draft = FormDraftService.getLocalDraft(formId);
    expect(draft).not.toBeNull();
    expect(draft?.formId).toBe(formId);
    expect(draft?.currentPageIndex).toBe(1);
    expect(draft?.data.firstName).toBe('Alice');
    expect(draft?.data.email).toBe('alice@example.com');
  });

  it('clears local form draft upon form submission', () => {
    const formId = 'test-form-456';
    FormDraftService.saveLocalDraft(formId, { completed: true }, 0);
    expect(FormDraftService.getLocalDraft(formId)).not.toBeNull();

    FormDraftService.clearLocalDraft(formId);
    expect(FormDraftService.getLocalDraft(formId)).toBeNull();
  });
});

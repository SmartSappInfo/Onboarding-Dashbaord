import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileTemplate, resolveAndCompilePrompt } from '../pms-resolver';
import * as firebaseAdmin from '../firebase-admin';

// ---------------------------------------------------------------------------
// Mock ./firebase-admin BEFORE importing resolver.
// ---------------------------------------------------------------------------
vi.mock('../firebase-admin', () => {
  const get = vi.fn();
  const limit = vi.fn(() => ({ get }));
  const where = vi.fn();
  where.mockReturnValue({ where, limit, get });
  const docGet = vi.fn();
  const docCollection = vi.fn(() => ({ where }));
  const doc = vi.fn(() => ({ get: docGet, collection: docCollection }));
  const collection = vi.fn(() => ({ where, doc }));
  const commit = vi.fn();
  const set = vi.fn();
  const batch = vi.fn(() => ({ set, commit }));

  return {
    adminDb: { collection, batch },
    __mocks: { get, limit, where, doc, docGet, collection, docCollection, batch, set, commit },
  };
});

// Helper to access mocks
interface FirestoreMock {
  get: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  doc: ReturnType<typeof vi.fn>;
  docGet: ReturnType<typeof vi.fn>;
  collection: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
}
const getMocks = (): FirestoreMock => (firebaseAdmin as unknown as { __mocks: FirestoreMock }).__mocks;

describe('compileTemplate', () => {
  it('correctly replaces variables', () => {
    const template = 'Hello {{ name }}! Welcome to {{place}}.';
    const variables = { name: 'Sarah', place: 'SmartSapp' };
    const result = compileTemplate(template, variables);
    expect(result).toBe('Hello Sarah! Welcome to SmartSapp.');
  });

  it('leaves unreplaced placeholders alone if not provided', () => {
    const template = 'Hello {{ name }}! Missing {{ missing }}.';
    const variables = { name: 'Sarah' };
    const result = compileTemplate(template, variables);
    expect(result).toBe('Hello Sarah! Missing {{ missing }}.');
  });

  it('handles spaces inside braces safely', () => {
    const template = '{{  spaced_key  }}';
    const variables = { spaced_key: 'value' };
    const result = compileTemplate(template, variables);
    expect(result).toBe('value');
  });
});

describe('resolveAndCompilePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = getMocks();
    mocks.limit.mockReturnValue({ get: mocks.get });
    mocks.where.mockReturnValue({ where: mocks.where, limit: mocks.limit, get: mocks.get });
  });

  it('falls back to codebase system prompts if firestore is empty', async () => {
    const mocks = getMocks();
    mocks.get.mockResolvedValueOnce({ empty: true, docs: [] }); // Workspace query -> empty
    mocks.get.mockResolvedValueOnce({ empty: true, docs: [] }); // Org query -> empty
    mocks.docGet.mockResolvedValueOnce({ exists: false });      // Global doc -> not found

    const result = await resolveAndCompilePrompt(
      'summarizeEntityNotesFlow',
      'org-1',
      'workspace-1',
      { entityName: 'Test School', notesContext: 'Note 1' }
    );

    expect(result.systemInstructions).toContain('expert CRM analyst');
    expect(result.userPrompt).toContain('Test School');
    expect(result.userPrompt).toContain('Note 1');
  });

  it('resolves workspace override when present', async () => {
    const mocks = getMocks();
    const overrideDoc = {
      systemPrompt: 'Workspace System Prompt for {{name}}',
      userPromptTemplate: 'Workspace User Prompt for {{name}}',
      variables: ['name'],
      aiModels: ['googleai/gemini-2.0-flash'],
      temperature: 0.5,
      maxTokens: 100
    };

    mocks.get.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'override-1', data: () => overrideDoc }]
    });

    const result = await resolveAndCompilePrompt(
      'summarizeEntityNotesFlow',
      'org-1',
      'workspace-1',
      { name: 'Sarah' }
    );

    expect(result.systemInstructions).toBe('Workspace System Prompt for Sarah');
    expect(result.userPrompt).toBe('Workspace User Prompt for Sarah');
    expect(result.temperature).toBe(0.5);
    expect(result.maxTokens).toBe(100);
  });
});

import { saveTenantOverride } from '../pms-repository';

describe('saveTenantOverride validations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails if target document ID does not match expected org/workspace pattern', async () => {
    const payload = {
      parentPromptId: 'summarizeEntityNotesFlow',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      flowName: 'summarizeEntityNotesFlow',
      title: 'Override Title',
      description: 'Test Override',
      category: 'crm',
      tags: [],
      systemPrompt: 'System rule',
      userPromptTemplate: 'User template',
      variables: [],
      aiModels: ['googleai/gemini-2.0-flash'],
      status: 'production' as const,
      isActive: true
    };

    const result = await saveTenantOverride('mismatched-id', payload, 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Override document ID mismatch');
  });

  it('fails if templates use unregistered variables', async () => {
    const payload = {
      parentPromptId: 'summarizeEntityNotesFlow',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      flowName: 'summarizeEntityNotesFlow',
      title: 'Override Title',
      description: 'Test Override',
      category: 'crm',
      tags: [],
      systemPrompt: 'System rule with {{ unregistered_variable }}',
      userPromptTemplate: 'User template',
      variables: ['registered_var'],
      aiModels: ['googleai/gemini-2.0-flash'],
      status: 'production' as const,
      isActive: true
    };

    const docId = 'org-1_workspace-1_summarizeEntityNotesFlow';
    const result = await saveTenantOverride(docId, payload, 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid template placeholders');
  });
});

import { seedDefaultPrompts } from '../seed-prompts';

describe('seedDefaultPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully seeds baseline global prompts and multi-tenant industry overrides', async () => {
    const mocks = getMocks();
    mocks.commit.mockResolvedValueOnce(undefined);

    const result = await seedDefaultPrompts();
    expect(result.success).toBe(true);
    expect(result.seededCount).toBe(10); // 3 global prompts + 7 overrides
    expect(mocks.batch).toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledTimes(10);
    expect(mocks.commit).toHaveBeenCalled();
  });
});



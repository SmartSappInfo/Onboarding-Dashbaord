// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ./firebase-admin BEFORE importing the module under test.
// vi.mock is hoisted, so the factory must not reference variables declared
// in the outer scope. We use module-level state objects instead.
// ---------------------------------------------------------------------------

vi.mock('../firebase-admin', () => {
  const set = vi.fn();
  const commit = vi.fn().mockResolvedValue(undefined);
  const batch = vi.fn(() => ({ set, commit }));
  const get = vi.fn();
  const where = vi.fn();
  where.mockReturnValue({ where, get });
  const doc = vi.fn((id: string) => ({ id }));
  const collection = vi.fn(() => ({ doc, where }));

  // Expose mocks on the module so tests can access them
  return {
    adminDb: { batch, collection },
    __mocks: { set, commit, batch, get, where, doc, collection },
  };
});

import {
  STATIC_VARIABLES,
  registerFormVariables,
  registerSurveyVariables,
  getDynamicVariables,
  type FormField,
  type SurveyElement,
} from '../template-variable-registry';
import { getVariablesForContext } from '../template-variable-utils';
import * as firebaseAdmin from '../firebase-admin';

// Helpers to access the mocks exposed by the factory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocks = () => (firebaseAdmin as any).__mocks as {
  set: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  doc: ReturnType<typeof vi.fn>;
  collection: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('STATIC_VARIABLES', () => {
  it('contains variables for all expected contexts', () => {
    const contexts = new Set(STATIC_VARIABLES.map((v) => v.context));
    expect(contexts).toContain('common');
    expect(contexts).toContain('meeting');
    expect(contexts).toContain('form');
    expect(contexts).toContain('survey');
    expect(contexts).toContain('agreement');
    expect(contexts).toContain('entity');
  });

  it('has 31 common variables', () => {
    const common = STATIC_VARIABLES.filter((v) => v.context === 'common');
    expect(common).toHaveLength(31);
  });

  it('every variable has required fields', () => {
    for (const v of STATIC_VARIABLES) {
      expect(v.id).toBeTruthy();
      expect(v.name).toBeTruthy();
      expect(v.label).toBeTruthy();
      expect(v.context).toBeTruthy();
      expect(['string', 'date', 'number', 'url', 'html']).toContain(v.dataType);
    }
  });
});

describe('getVariablesForContext', () => {
  it('returns only common variables when context is "common"', () => {
    const result = getVariablesForContext('common');
    expect(result.every((v) => v.context === 'common')).toBe(true);
  });

  it('returns common + meeting variables for "meeting" context', () => {
    const result = getVariablesForContext('meeting');
    const contexts = new Set(result.map((v) => v.context));
    expect(contexts).toContain('common');
    expect(contexts).toContain('meeting');
    expect(contexts.size).toBe(2);
  });

  it('returns common + form variables for "form" context', () => {
    const result = getVariablesForContext('form');
    const contexts = new Set(result.map((v) => v.context));
    expect(contexts).toContain('common');
    expect(contexts).toContain('form');
  });

  it('returns common + survey variables for "survey" context', () => {
    const result = getVariablesForContext('survey');
    const contexts = new Set(result.map((v) => v.context));
    expect(contexts).toContain('common');
    expect(contexts).toContain('survey');
  });

  it('returns common + agreement variables for "agreement" context', () => {
    const result = getVariablesForContext('agreement');
    const contexts = new Set(result.map((v) => v.context));
    expect(contexts).toContain('common');
    expect(contexts).toContain('agreement');
  });

  it('returns common + entity variables for "entity" context', () => {
    const result = getVariablesForContext('entity');
    const contexts = new Set(result.map((v) => v.context));
    expect(contexts).toContain('common');
    expect(contexts).toContain('entity');
  });

  it('does not include variables from other contexts', () => {
    const result = getVariablesForContext('meeting');
    const hasForm = result.some((v) => v.context === 'form');
    expect(hasForm).toBe(false);
  });

  it('common context result has no duplicates', () => {
    const result = getVariablesForContext('common');
    const ids = result.map((v) => v.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

describe('registerFormVariables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().commit.mockResolvedValue(undefined);
    mocks().where.mockReturnValue({ where: mocks().where, get: mocks().get });
  });

  it('calls batch.set for each field and commits', async () => {
    const fields: FormField[] = [
      { id: 'field_1', label: 'First Name', type: 'text' },
      { id: 'field_2', label: 'Date of Birth', type: 'date' },
    ];

    await registerFormVariables('form_abc', fields);

    expect(mocks().set).toHaveBeenCalledTimes(2);
    expect(mocks().commit).toHaveBeenCalledTimes(1);
  });

  it('writes variables with correct name pattern', async () => {
    const fields: FormField[] = [{ id: 'field_x', label: 'School Name' }];

    await registerFormVariables('form_123', fields);

    const [, writtenVar] = mocks().set.mock.calls[0];
    expect(writtenVar.name).toBe('form_fields.field_x');
    expect(writtenVar.sourceFormId).toBe('form_123');
    expect(writtenVar.sourceFieldId).toBe('field_x');
    expect(writtenVar.isDynamic).toBe(true);
    expect(writtenVar.context).toBe('form');
  });

  it('uses field label as variable label', async () => {
    const fields: FormField[] = [{ id: 'f1', label: 'Parent Email' }];
    await registerFormVariables('form_xyz', fields);
    const [, writtenVar] = mocks().set.mock.calls[0];
    expect(writtenVar.label).toBe('Parent Email');
  });

  it('handles empty fields array without error', async () => {
    await registerFormVariables('form_empty', []);
    expect(mocks().set).not.toHaveBeenCalled();
    expect(mocks().commit).toHaveBeenCalledTimes(1);
  });
});

describe('registerSurveyVariables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().commit.mockResolvedValue(undefined);
    mocks().where.mockReturnValue({ where: mocks().where, get: mocks().get });
  });

  it('calls batch.set for each element and commits', async () => {
    const elements: SurveyElement[] = [
      { id: 'q1', title: 'How satisfied are you?' },
      { id: 'q2', name: 'rating' },
    ];

    await registerSurveyVariables('survey_abc', elements);

    expect(mocks().set).toHaveBeenCalledTimes(2);
    expect(mocks().commit).toHaveBeenCalledTimes(1);
  });

  it('writes variables with correct name pattern', async () => {
    const elements: SurveyElement[] = [{ id: 'q1', title: 'Overall Rating' }];

    await registerSurveyVariables('survey_123', elements);

    const [, writtenVar] = mocks().set.mock.calls[0];
    expect(writtenVar.name).toBe('survey_fields.q1');
    expect(writtenVar.sourceFormId).toBe('survey_123');
    expect(writtenVar.sourceFieldId).toBe('q1');
    expect(writtenVar.isDynamic).toBe(true);
    expect(writtenVar.context).toBe('survey');
  });

  it('uses title as label when available', async () => {
    const elements: SurveyElement[] = [{ id: 'q1', title: 'My Question' }];
    await registerSurveyVariables('survey_xyz', elements);
    const [, writtenVar] = mocks().set.mock.calls[0];
    expect(writtenVar.label).toBe('My Question');
  });

  it('falls back to name when title is absent', async () => {
    const elements: SurveyElement[] = [{ id: 'q2', name: 'satisfaction' }];
    await registerSurveyVariables('survey_xyz', elements);
    const [, writtenVar] = mocks().set.mock.calls[0];
    expect(writtenVar.label).toBe('satisfaction');
  });

  it('falls back to id when both title and name are absent', async () => {
    const elements: SurveyElement[] = [{ id: 'q3' }];
    await registerSurveyVariables('survey_xyz', elements);
    const [, writtenVar] = mocks().set.mock.calls[0];
    expect(writtenVar.label).toBe('q3');
  });
});

describe('getDynamicVariables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, get: mocks().get });
  });

  it('queries by sourceFormId and isDynamic', async () => {
    mocks().get.mockResolvedValue({ docs: [] });

    await getDynamicVariables('form_abc');

    expect(mocks().where).toHaveBeenCalledWith('sourceFormId', '==', 'form_abc');
    expect(mocks().where).toHaveBeenCalledWith('isDynamic', '==', true);
  });

  it('returns mapped variable objects from Firestore docs', async () => {
    const doc1 = { data: () => ({ id: 'v1', name: 'form_fields.f1', isDynamic: true }) };
    const doc2 = { data: () => ({ id: 'v2', name: 'form_fields.f2', isDynamic: true }) };
    mocks().get.mockResolvedValue({ docs: [doc1, doc2] });

    const result = await getDynamicVariables('form_abc');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('form_fields.f1');
    expect(result[1].name).toBe('form_fields.f2');
  });

  it('returns empty array when no dynamic variables exist', async () => {
    mocks().get.mockResolvedValue({ docs: [] });
    const result = await getDynamicVariables('form_nonexistent');
    expect(result).toEqual([]);
  });
});

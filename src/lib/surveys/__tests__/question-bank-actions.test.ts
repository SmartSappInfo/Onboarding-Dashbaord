/**
 * @fileOverview Unit tests for question-bank-actions.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getQuestionBankItemsAction,
  saveQuestionToBankAction,
  seedSystemQuestionBankAction,
} from '../question-bank-actions';

const mockDbStore: Record<string, Record<string, unknown>> = {};

const { mockDoc, mockCollection, mockBatch } = vi.hoisted(() => {
  const set = vi.fn(async function (this: { id: string }, data: Record<string, unknown>) {
    mockDbStore[this.id] = { ...data, id: this.id };
    return true;
  });

  const doc = vi.fn((id?: string) => {
    const docId = id || `qb_${Math.random().toString(36).substring(7)}`;
    return {
      id: docId,
      set,
      get: vi.fn(async () => ({
        exists: !!mockDbStore[docId],
        id: docId,
        data: () => mockDbStore[docId],
      })),
    };
  });

  const where = vi.fn((field: string, op: string, val: string) => ({
    where: vi.fn((field2: string, op2: string, val2: string) => ({
      get: vi.fn(async () => {
        const docs = Object.values(mockDbStore)
          .filter((item) => item[field] === val && item[field2] === val2)
          .map((d) => ({ id: d.id as string, data: () => d }));
        return { docs };
      }),
    })),
    get: vi.fn(async () => {
      const docs = Object.values(mockDbStore)
        .filter((item) => item[field] === val)
        .map((d) => ({ id: d.id as string, data: () => d }));
      return { docs };
    }),
  }));

  const batch = vi.fn(() => ({
    set: vi.fn((targetRef: { id: string }, data: Record<string, unknown>) => {
      mockDbStore[targetRef.id] = { ...data, id: targetRef.id };
    }),
    commit: vi.fn(async () => true),
  }));

  return {
    mockDoc: doc,
    mockCollection: vi.fn(() => ({ doc, where })),
    mockBatch: batch,
  };
});

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: mockCollection,
    doc: mockDoc,
    batch: mockBatch,
  },
}));

describe('QuestionBankActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(mockDbStore)) delete mockDbStore[k];
  });

  it('should seed system question bank', async () => {
    const res = await seedSystemQuestionBankAction();
    expect(res.success).toBe(true);
    expect(res.seededCount).toBeGreaterThan(0);
    expect(Object.keys(mockDbStore).length).toBe(res.seededCount);
  });

  it('should save a workspace custom question item', async () => {
    const res = await saveQuestionToBankAction('ws_main', 'org_1', {
      visibility: 'workspace',
      category: 'admissions',
      title: 'How did you first hear about our school?',
      questionType: 'multiple-choice',
      tags: ['marketing', 'lead-source'],
    });

    expect(res.success).toBe(true);
    expect(res.item?.title).toBe('How did you first hear about our school?');
    expect(res.item?.visibility).toBe('workspace');
    expect(res.item?.workspaceId).toBe('ws_main');
  });

  it('should query question bank items with filters', async () => {
    mockDbStore['q1'] = {
      id: 'q1',
      visibility: 'system',
      category: 'nps',
      title: 'How likely are you to recommend our school?',
      questionType: 'rating',
      tags: ['nps'],
      usageCount: 50,
    };
    mockDbStore['q2'] = {
      id: 'q2',
      workspaceId: 'ws_main',
      visibility: 'workspace',
      category: 'facilities',
      title: 'Are the science labs adequate?',
      questionType: 'multiple-choice',
      tags: ['facilities'],
      usageCount: 10,
    };

    const res = await getQuestionBankItemsAction('ws_main', { category: 'nps' });
    expect(res.success).toBe(true);
    expect(res.items).toHaveLength(1);
    expect(res.items?.[0].title).toContain('recommend');
  });
});

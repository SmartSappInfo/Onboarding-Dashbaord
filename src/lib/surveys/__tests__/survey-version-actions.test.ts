/**
 * @fileOverview Unit tests for survey-version-actions.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDraftVersionAction,
  publishSurveyVersionAction,
  getSurveyVersionHistoryAction,
} from '../survey-version-actions';

const mockDbStore: Record<string, Record<string, unknown>> = {};
const mockVersionsStore: Record<string, Record<string, Record<string, unknown>>> = {};

const { mockDoc, mockCollection, mockBatch } = vi.hoisted(() => {
  const mockDocFn = vi.fn((id?: string) => {
    const docId = id || `doc_${Math.random().toString(36).substring(7)}`;
    return {
      id: docId,
      get: vi.fn(async () => {
        const data = mockDbStore[docId];
        return {
          exists: !!data,
          id: docId,
          data: () => data,
        };
      }),
      collection: vi.fn((subCol: string) => {
        if (!mockVersionsStore[docId]) {
          mockVersionsStore[docId] = {};
        }
        return {
          doc: vi.fn((vId?: string) => {
            const versionId = vId || `v_${Math.random().toString(36).substring(7)}`;
            return {
              id: versionId,
              get: vi.fn(async () => {
                const vData = mockVersionsStore[docId]?.[versionId];
                return {
                  exists: !!vData,
                  id: versionId,
                  data: () => vData,
                };
              }),
            };
          }),
          get: vi.fn(async () => {
            const docs = Object.values(mockVersionsStore[docId] || {}).map((vData) => ({
              id: (vData as { id: string }).id,
              data: () => vData,
            }));
            return { docs };
          }),
          where: vi.fn(() => ({
            get: vi.fn(async () => {
              const docs = Object.values(mockVersionsStore[docId] || {})
                .filter((v) => (v as { status: string }).status === 'published')
                .map((vData) => ({
                  id: (vData as { id: string }).id,
                  data: () => vData,
                  ref: { id: (vData as { id: string }).id },
                }));
              return { docs };
            }),
          })),
        };
      }),
    };
  });

  const batch = vi.fn(() => ({
    set: vi.fn((targetRef: { id: string }, data: Record<string, unknown>) => {
      // Find parent survey and set version
      for (const sId of Object.keys(mockDbStore)) {
        if (!mockVersionsStore[sId]) mockVersionsStore[sId] = {};
        mockVersionsStore[sId][targetRef.id] = { ...data, id: targetRef.id };
      }
    }),
    update: vi.fn((targetRef: { id: string }, updates: Record<string, unknown>) => {
      if (mockDbStore[targetRef.id]) {
        mockDbStore[targetRef.id] = { ...mockDbStore[targetRef.id], ...updates };
      }
      for (const sId of Object.keys(mockVersionsStore)) {
        if (mockVersionsStore[sId][targetRef.id]) {
          mockVersionsStore[sId][targetRef.id] = { ...mockVersionsStore[sId][targetRef.id], ...updates };
        }
      }
    }),
    commit: vi.fn(async () => true),
  }));

  return {
    mockDoc: mockDocFn,
    mockCollection: vi.fn(() => ({ doc: mockDocFn })),
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

describe('SurveyVersionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(mockDbStore)) delete mockDbStore[k];
    for (const k of Object.keys(mockVersionsStore)) delete mockVersionsStore[k];
  });

  it('should synthesize Version 1 for a legacy survey without version history', async () => {
    mockDbStore['s1'] = {
      id: 's1',
      workspaceIds: ['ws_main'],
      title: 'Legacy Survey',
      status: 'published',
      elements: [{ id: 'q1', title: 'Q1', type: 'text', required: true, order: 0 }],
      currentVersionNumber: 1,
    };

    const res = await getSurveyVersionHistoryAction('s1', 'ws_main');
    expect(res.success).toBe(true);
    expect(res.versions).toHaveLength(1);
    expect(res.versions?.[0].versionNumber).toBe(1);
    expect(res.versions?.[0].status).toBe('published');
  });

  it('should create a draft version with incremented version number', async () => {
    mockDbStore['s1'] = {
      id: 's1',
      workspaceIds: ['ws_main'],
      title: 'Survey 1',
      status: 'published',
      elements: [{ id: 'q1', title: 'Q1', type: 'text', required: true, order: 0 }],
      currentVersionNumber: 1,
    };

    const res = await createDraftVersionAction('s1', 'ws_main', 'user_1', 'John Doe');
    expect(res.success).toBe(true);
    expect(res.version?.versionNumber).toBe(2);
    expect(res.version?.status).toBe('draft');
    expect(res.version?.createdBy).toBe('user_1');
  });

  it('should publish a version and update master survey snapshot', async () => {
    mockDbStore['s1'] = {
      id: 's1',
      workspaceIds: ['ws_main'],
      title: 'Survey 1',
      status: 'draft',
      elements: [],
      currentVersionNumber: 1,
    };
    mockVersionsStore['s1'] = {
      v2: {
        id: 'v2',
        surveyId: 's1',
        workspaceId: 'ws_main',
        versionNumber: 2,
        status: 'draft',
        elements: [{ id: 'q2', title: 'New Question', type: 'text', required: true, order: 0 }],
      },
    };

    const res = await publishSurveyVersionAction('s1', 'v2', 'ws_main', 'user_1', 'Admin User', 'Launched V2');
    expect(res.success).toBe(true);
    expect(res.version?.status).toBe('published');
    expect(mockDbStore['s1'].publishedVersionId).toBe('v2');
    expect(mockDbStore['s1'].currentVersionNumber).toBe(2);
  });
});

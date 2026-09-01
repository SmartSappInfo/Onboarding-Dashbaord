/**
 * @fileOverview Unit tests for survey-project-actions.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSurveyProjectAction,
  getSurveyProjectsAction,
  getSurveyProjectByIdAction,
  updateSurveyProjectAction,
  assignSurveysToProjectAction,
} from '../survey-project-actions';

const mockDbStore: Record<string, Record<string, unknown>> = {};

const { mockSet, mockGetDoc, mockDoc, mockWhere, mockGetCollection, mockCollection, mockBatch } = vi.hoisted(() => {
  const set = vi.fn(async function (this: { id: string }, data: Record<string, unknown>) {
    mockDbStore[this.id] = { ...data, id: this.id };
    return true;
  });

  const getDoc = vi.fn(async function (this: { id: string }) {
    const data = mockDbStore[this.id];
    return {
      exists: !!data,
      id: this.id,
      data: () => data,
    };
  });

  const updateDoc = vi.fn(async function (this: { id: string }, updates: Record<string, unknown>) {
    if (mockDbStore[this.id]) {
      mockDbStore[this.id] = { ...mockDbStore[this.id], ...updates };
    }
    return true;
  });

  const doc = vi.fn((id?: string) => {
    const docId = id || `proj_${Math.random().toString(36).substring(7)}`;
    return {
      id: docId,
      set,
      get: getDoc,
      update: updateDoc,
    };
  });

  const getCollection = vi.fn(async () => {
    const docs = Object.values(mockDbStore).map((data) => ({
      id: (data as { id: string }).id,
      data: () => data,
    }));
    return { docs };
  });

  const where = vi.fn(() => ({
    get: getCollection,
  }));

  const collection = vi.fn(() => ({
    doc,
    where,
    get: getCollection,
  }));

  const batch = vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn(async () => true),
  }));

  return {
    mockSet: set,
    mockGetDoc: getDoc,
    mockDoc: doc,
    mockWhere: where,
    mockGetCollection: getCollection,
    mockCollection: collection,
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

describe('SurveyProjectActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockDbStore)) {
      delete mockDbStore[key];
    }
  });

  it('should create a survey project with valid parameters', async () => {
    const res = await createSurveyProjectAction('ws_main', 'org_1', {
      name: '2026 Parent Experience Study',
      description: 'Annual longitudinal parent feedback survey',
      projectType: 'experience',
      ownerId: 'user_admin',
      tags: ['parent', 'annual'],
    });

    expect(res.success).toBe(true);
    expect(res.project).toBeDefined();
    expect(res.project?.name).toBe('2026 Parent Experience Study');
    expect(res.project?.workspaceId).toBe('ws_main');
    expect(res.project?.status).toBe('active');
  });

  it('should reject creation without workspaceId or name', async () => {
    const res1 = await createSurveyProjectAction('', 'org_1', {
      name: 'Test',
      ownerId: 'user_1',
    });
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('workspaceId');

    const res2 = await createSurveyProjectAction('ws_1', 'org_1', {
      name: '',
      ownerId: 'user_1',
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Project name is required');
  });

  it('should retrieve projects for a workspace', async () => {
    mockDbStore['p1'] = {
      id: 'p1',
      workspaceId: 'ws_main',
      name: 'Project 1',
      status: 'active',
      updatedAt: '2026-09-01T00:00:00Z',
    };
    mockDbStore['p2'] = {
      id: 'p2',
      workspaceId: 'ws_main',
      name: 'Project 2',
      status: 'active',
      updatedAt: '2026-09-01T01:00:00Z',
    };

    const res = await getSurveyProjectsAction('ws_main');
    expect(res.success).toBe(true);
    expect(res.projects).toHaveLength(2);
  });

  it('should update an existing project', async () => {
    mockDbStore['p1'] = {
      id: 'p1',
      workspaceId: 'ws_main',
      name: 'Project 1',
      status: 'active',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    const res = await updateSurveyProjectAction('ws_main', 'p1', {
      name: 'Project 1 Updated',
      status: 'completed',
    });

    expect(res.success).toBe(true);
    expect(res.project?.name).toBe('Project 1 Updated');
    expect(res.project?.status).toBe('completed');
  });
});

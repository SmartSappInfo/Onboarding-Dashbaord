/**
 * @fileOverview Unit tests for survey-deployment-actions.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSurveyDeploymentAction,
  getSurveyDeploymentsAction,
  updateDeploymentStatusAction,
} from '../survey-deployment-actions';

const mockDbStore: Record<string, Record<string, unknown>> = {};

const { mockDoc, mockCollection, mockBatch } = vi.hoisted(() => {
  const set = vi.fn(async function (this: { id: string }, data: Record<string, unknown>) {
    mockDbStore[this.id] = { ...data, id: this.id };
    return true;
  });

  const doc = vi.fn((id?: string) => {
    const docId = id || `dep_${Math.random().toString(36).substring(7)}`;
    return {
      id: docId,
      set,
      get: vi.fn(async () => ({
        exists: !!mockDbStore[docId],
        id: docId,
        data: () => mockDbStore[docId],
      })),
      update: vi.fn(async (updates: Record<string, unknown>) => {
        if (mockDbStore[docId]) {
          mockDbStore[docId] = { ...mockDbStore[docId], ...updates };
        }
        return true;
      }),
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
    update: vi.fn((targetRef: { id: string }, updates: Record<string, unknown>) => {
      if (mockDbStore[targetRef.id]) {
        mockDbStore[targetRef.id] = { ...mockDbStore[targetRef.id], ...updates };
      }
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

describe('SurveyDeploymentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(mockDbStore)) delete mockDbStore[k];
  });

  it('should create a survey deployment with quota and schedule config', async () => {
    mockDbStore['s1'] = {
      id: 's1',
      workspaceIds: ['ws_main'],
      title: 'Parent Survey 2026',
      slug: 'parent-survey-2026',
      status: 'published',
    };

    const res = await createSurveyDeploymentAction('s1', 'ws_main', {
      name: 'WhatsApp Campaign Q1',
      channel: 'whatsapp',
      quotaConfig: { maxResponses: 500 },
      scheduleConfig: { startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-30T23:59:59Z' },
      attributionConfig: { campaignId: 'cmp_sept_2026' },
    });

    expect(res.success).toBe(true);
    expect(res.deployment).toBeDefined();
    expect(res.deployment?.channel).toBe('whatsapp');
    expect(res.deployment?.quotaConfig?.maxResponses).toBe(500);
    expect(res.deployment?.url).toContain('parent-survey-2026');
  });

  it('should retrieve all deployments for a survey', async () => {
    mockDbStore['d1'] = {
      id: 'd1',
      surveyId: 's1',
      workspaceId: 'ws_main',
      name: 'Web Poster QR',
      channel: 'qr',
      status: 'active',
      createdAt: '2026-09-01T00:00:00Z',
    };
    mockDbStore['d2'] = {
      id: 'd2',
      surveyId: 's1',
      workspaceId: 'ws_main',
      name: 'Email Blast',
      channel: 'email',
      status: 'active',
      createdAt: '2026-09-01T01:00:00Z',
    };

    const res = await getSurveyDeploymentsAction('s1', 'ws_main');
    expect(res.success).toBe(true);
    expect(res.deployments).toHaveLength(2);
  });

  it('should toggle deployment status', async () => {
    mockDbStore['d1'] = {
      id: 'd1',
      surveyId: 's1',
      workspaceId: 'ws_main',
      name: 'Web Poster QR',
      status: 'active',
    };

    const res = await updateDeploymentStatusAction('d1', 'ws_main', 'paused');
    expect(res.success).toBe(true);
    expect(mockDbStore['d1'].status).toBe('paused');
  });
});

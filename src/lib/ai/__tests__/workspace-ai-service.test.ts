// @vitest-environment node
/**
 * @fileOverview Unit Tests for WorkspaceAiService & getModel Resolution Engine
 *
 * Covers:
 * 1. Resolving workspace AI settings from cache and database.
 * 2. Fallback to system_settings/ai_config and registry defaults.
 * 3. Saving updated AI settings with model normalization.
 * 4. Cache eviction and manual cache invalidation.
 * 5. getModel resolution with workspaceId, organizationId, and tier.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.unmock('@/ai/genkit');

import { WorkspaceAiService } from '../services/workspace-ai-service';
import { getModel } from '@/ai/genkit';

const mockDocGet = vi.fn();
const mockDocSet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((docId: string) => ({
        get: () => mockDocGet(colName, docId),
        set: (data: unknown, options?: unknown) => mockDocSet(colName, docId, data, options),
      })),
    })),
  },
}));

vi.mock('@/lib/backoffice/audit-logger', () => ({
  logBackofficeAction: vi.fn(async () => {}),
}));

describe('WorkspaceAiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocGet.mockImplementation(async () => ({
      exists: false,
      data: () => undefined,
    }));
    WorkspaceAiService.invalidateCache('ws-test-1');
    WorkspaceAiService.invalidateCache('ws-test-2');
  });

  it('should return flagship default when workspace has no custom settings', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: false,
      data: () => undefined,
    }); // workspaces/ws-test-1
    mockDocGet.mockResolvedValueOnce({
      exists: false,
      data: () => undefined,
    }); // system_settings/ai_config

    const settings = await WorkspaceAiService.getSettings('ws-test-1');
    expect(settings.preferredModelId).toBe('gemini-3.6-flash');
    expect(settings.preferredProvider).toBe('googleai');
  });

  it('should resolve and normalize persisted workspace AI settings', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        organizationId: 'org-456',
        aiSettings: {
          preferredProvider: 'googleai',
          preferredModelId: 'gemini-2.5-flash', // Deprecated, should normalize
          reasoningModelId: 'claude-3.5-sonnet', // Deprecated, should normalize
          fastModelId: 'gemini-1.5-flash-8b', // Deprecated, should normalize to gemini-3.1-flash-lite
        },
      }),
    });

    const settings = await WorkspaceAiService.getSettings('ws-test-1');
    expect(settings.preferredModelId).toBe('gemini-3.6-flash');
    expect(settings.reasoningModelId).toBe('claude-3-5-sonnet');
    expect(settings.fastModelId).toBe('gemini-3.1-flash-lite');
    expect(settings.organizationId).toBe('org-456');
  });

  it('should serve subsequent calls from in-memory cache without hitting Firestore', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        aiSettings: {
          preferredProvider: 'anthropic',
          preferredModelId: 'claude-3-5-sonnet',
        },
      }),
    });

    const settings1 = await WorkspaceAiService.getSettings('ws-test-2');
    expect(settings1.preferredModelId).toBe('claude-3-5-sonnet');
    expect(mockDocGet).toHaveBeenCalledTimes(1);

    // Second call should hit in-memory cache
    const settings2 = await WorkspaceAiService.getSettings('ws-test-2');
    expect(settings2.preferredModelId).toBe('claude-3-5-sonnet');
    expect(mockDocGet).toHaveBeenCalledTimes(1);
  });

  it('should persist new settings, normalize models, and refresh local cache', async () => {
    mockDocSet.mockResolvedValueOnce(undefined);

    const saved = await WorkspaceAiService.saveSettings(
      'ws-test-1',
      {
        preferredProvider: 'anthropic',
        preferredModelId: 'claude-3.5-sonnet', // should normalize to claude-3-5-sonnet
      },
      'admin-user'
    );

    expect(saved.preferredModelId).toBe('claude-3-5-sonnet');
    expect(saved.preferredProvider).toBe('anthropic');
    expect(saved.updatedBy).toBe('admin-user');

    // Immediately fetch - should come from freshly updated cache
    const cached = await WorkspaceAiService.getSettings('ws-test-1');
    expect(cached.preferredModelId).toBe('claude-3-5-sonnet');
  });
});

describe('getModel (Workspace-Aware Resolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocGet.mockImplementation(async () => ({
      exists: false,
      data: () => undefined,
    }));
    WorkspaceAiService.invalidateCache('ws-genkit-1');
  });

  it('should auto-resolve model and provider from workspace settings when modelId is omitted', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        organizationId: 'org-789',
        aiSettings: {
          preferredProvider: 'anthropic',
          preferredModelId: 'claude-3-5-sonnet',
        },
      }),
    });

    const resolved = await getModel({ workspaceId: 'ws-genkit-1' });
    expect(resolved.modelString).toBe('claude-3-5-sonnet-20241022');
    expect(resolved.provider).toBe('anthropic');
    expect(resolved.modelId).toBe('claude-3-5-sonnet');
  });

  it('should resolve reasoning tier model from workspace settings or provider defaults', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        aiSettings: {
          preferredProvider: 'googleai',
          preferredModelId: 'gemini-3.6-flash',
          reasoningModelId: 'gemini-2.5-pro',
        },
      }),
    });

    const resolved = await getModel({
      workspaceId: 'ws-genkit-1',
      tier: 'reasoning',
    });
    expect(resolved.modelString).toBe('googleai/gemini-2.5-pro');
    expect(resolved.modelId).toBe('gemini-2.5-pro');
  });

  it('should normalize legacy string input passed to getModel', async () => {
    const resolved = await getModel('gemini-2.5-flash');
    expect(resolved.modelString).toBe('googleai/gemini-3.6-flash');
    expect(resolved.modelId).toBe('gemini-3.6-flash');
  });
});

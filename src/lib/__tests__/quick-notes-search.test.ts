import { describe, it, expect, vi, beforeEach } from 'vitest';

const embedMock = vi.fn();
const searchMock = vi.fn();
const canUserMock = vi.fn().mockResolvedValue({ granted: true });

vi.mock('@/ai/flows/embed-note-flow', () => ({
  embedText: (...args: unknown[]) => embedMock(...args),
}));
vi.mock('../note-index-repository', () => ({
  NoteIndexRepository: { searchByVector: (...args: unknown[]) => searchMock(...args) },
}));
vi.mock('../workspace-permissions', () => ({
  canUser: (...args: unknown[]) => canUserMock(...args),
}));

import { semanticSearchNotes } from '../quick-notes-search-actions';

beforeEach(() => {
  vi.clearAllMocks();
  canUserMock.mockResolvedValue({ granted: true });
});

describe('semanticSearchNotes', () => {
  it('requires authentication', async () => {
    const r = await semanticSearchNotes({ workspaceId: 'ws1', query: 'hi', userId: '' });
    expect(r).toMatchObject({ success: false, code: 'unauthenticated' });
    expect(embedMock).not.toHaveBeenCalled();
  });

  it('rejects when the caller lacks workspace access', async () => {
    canUserMock.mockResolvedValue({ granted: false, reason: 'No access' });
    const r = await semanticSearchNotes({ workspaceId: 'other', query: 'hi', userId: 'u1' });
    expect(r.success).toBe(false);
    expect(embedMock).not.toHaveBeenCalled();
  });

  it('rejects an empty query without embedding', async () => {
    const r = await semanticSearchNotes({ workspaceId: 'ws1', query: '   ', userId: 'u1' });
    expect(r.success).toBe(false);
    expect(embedMock).not.toHaveBeenCalled();
  });

  it('returns matches on success', async () => {
    embedMock.mockResolvedValue([0.1, 0.2, 0.3]);
    searchMock.mockResolvedValue([{ id: 'quick_note:n1', source: 'quick_note', title: 'Found', plainText: 'x' }]);
    const r = await semanticSearchNotes({ workspaceId: 'ws1', query: 'pricing', userId: 'u1' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toHaveLength(1);
    expect(searchMock).toHaveBeenCalledWith('ws1', [0.1, 0.2, 0.3], 10);
  });

  it('returns empty when the query embeds to nothing', async () => {
    embedMock.mockResolvedValue([]);
    const r = await semanticSearchNotes({ workspaceId: 'ws1', query: 'pricing', userId: 'u1' });
    expect(r).toEqual({ success: true, data: [] });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('maps a missing-vector-index error to a friendly no_index code', async () => {
    embedMock.mockResolvedValue([0.1, 0.2]);
    searchMock.mockRejectedValue(new Error('9 FAILED_PRECONDITION: missing vector index'));
    const r = await semanticSearchNotes({ workspaceId: 'ws1', query: 'pricing', userId: 'u1' });
    expect(r).toMatchObject({ success: false, code: 'no_index' });
  });

  it('rate-limits a noisy user', async () => {
    embedMock.mockResolvedValue([0.1]);
    searchMock.mockResolvedValue([]);
    let lastFailure = '';
    for (let i = 0; i < 35; i++) {
      const r = await semanticSearchNotes({ workspaceId: 'ws1', query: 'q', userId: 'noisy-search' });
      if (!r.success) lastFailure = r.error;
    }
    expect(lastFailure).toMatch(/too many/i);
  });
});

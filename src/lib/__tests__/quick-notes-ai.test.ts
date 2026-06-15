import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all I/O-bound dependencies so the action logic is tested in isolation
// (no Genkit init, no Firestore, no real task creation).
const summarizeMock = vi.fn();
const digestMock = vi.fn();
const setAiMetaMock = vi.fn().mockResolvedValue(undefined);
const getByIdMock = vi.fn().mockResolvedValue({ id: 'n1', workspaceId: 'ws1' });
const createTaskMock = vi.fn();
const canUserMock = vi.fn().mockResolvedValue({ granted: true });

vi.mock('@/ai/flows/summarize-quick-note-flow', () => ({
  summarizeQuickNoteFlow: (...args: unknown[]) => summarizeMock(...args),
}));
vi.mock('@/ai/flows/quick-notes-digest-flow', () => ({
  quickNotesDigestFlow: (...args: unknown[]) => digestMock(...args),
}));
vi.mock('../quick-notes-repository', () => ({
  QuickNoteRepository: {
    setAiMeta: (...args: unknown[]) => setAiMetaMock(...args),
    getById: (...args: unknown[]) => getByIdMock(...args),
  },
}));
vi.mock('../task-server-actions', () => ({
  createTaskAction: (...args: unknown[]) => createTaskMock(...args),
}));
vi.mock('../workspace-permissions', () => ({
  canUser: (...args: unknown[]) => canUserMock(...args),
}));

import {
  generateQuickNoteInsight,
  generateQuickNotesDigest,
  createTaskFromActionItem,
} from '../quick-notes-ai-actions';

beforeEach(() => {
  vi.clearAllMocks();
  canUserMock.mockResolvedValue({ granted: true });
  getByIdMock.mockResolvedValue({ id: 'n1', workspaceId: 'ws1' });
  setAiMetaMock.mockResolvedValue(undefined);
});

describe('generateQuickNoteInsight', () => {
  const insight = { summary: 's', suggestedTags: ['a'], sentiment: 'neutral' as const, actionItems: [] };

  it('rejects when unauthenticated', async () => {
    const r = await generateQuickNoteInsight({ noteId: 'n1', workspaceId: 'ws1', plainText: 'hi', userId: '' });
    expect(r.success).toBe(false);
    expect(summarizeMock).not.toHaveBeenCalled();
  });

  it('rejects when the caller lacks workspace access', async () => {
    canUserMock.mockResolvedValue({ granted: false, reason: 'No access' });
    const r = await generateQuickNoteInsight({ noteId: 'n1', workspaceId: 'other', plainText: 'hi', userId: 'u1' });
    expect(r).toEqual({ success: false, error: 'No access' });
    expect(summarizeMock).not.toHaveBeenCalled();
  });

  it('rejects empty content without calling the model', async () => {
    const r = await generateQuickNoteInsight({ noteId: 'n1', workspaceId: 'ws1', plainText: '   ', userId: 'u1' });
    expect(r.success).toBe(false);
    expect(summarizeMock).not.toHaveBeenCalled();
  });

  it('caps very long input before calling the flow', async () => {
    summarizeMock.mockResolvedValue(insight);
    const r = await generateQuickNoteInsight({ noteId: 'n1', workspaceId: 'ws1', plainText: 'x'.repeat(9000), userId: 'u1' });
    expect(r.success).toBe(true);
    const arg = summarizeMock.mock.calls[0][0] as { content: string };
    expect(arg.content).toHaveLength(8000);
  });

  it('caches the insight only when the note is in the authorised workspace', async () => {
    summarizeMock.mockResolvedValue(insight);
    await generateQuickNoteInsight({ noteId: 'n1', workspaceId: 'ws1', plainText: 'hello', userId: 'u2' });
    // getById → setAiMeta is fire-and-forget; flush the microtask chain.
    await new Promise((r) => setTimeout(r, 0));
    expect(getByIdMock).toHaveBeenCalledWith('n1');
    expect(setAiMetaMock).toHaveBeenCalledWith('n1', expect.objectContaining({ summary: 's' }));
  });

  it('does not cache when the note belongs to a different workspace', async () => {
    summarizeMock.mockResolvedValue(insight);
    getByIdMock.mockResolvedValue({ id: 'n1', workspaceId: 'someone-else' });
    await generateQuickNoteInsight({ noteId: 'n1', workspaceId: 'ws1', plainText: 'hello', userId: 'u2' });
    await new Promise((r) => setTimeout(r, 0));
    expect(setAiMetaMock).not.toHaveBeenCalled();
  });

  it('surfaces flow errors gracefully', async () => {
    summarizeMock.mockRejectedValue(new Error('model down'));
    const r = await generateQuickNoteInsight({ noteId: 'n1', workspaceId: 'ws1', plainText: 'hello', userId: 'u3' });
    expect(r).toEqual({ success: false, error: 'model down' });
  });

  it('rate-limits a noisy user', async () => {
    summarizeMock.mockResolvedValue(insight);
    let lastFailure = '';
    for (let i = 0; i < 25; i++) {
      const r = await generateQuickNoteInsight({ noteId: 'n1', workspaceId: 'ws1', plainText: 'hello', userId: 'noisy' });
      if (!r.success) lastFailure = r.error;
    }
    expect(lastFailure).toMatch(/too many/i);
  });
});

describe('generateQuickNotesDigest', () => {
  it('rejects when there are no notes with text', async () => {
    const r = await generateQuickNotesDigest({ notes: [{ plainText: '  ' }], workspaceId: 'ws1', userId: 'u1' });
    expect(r.success).toBe(false);
    expect(digestMock).not.toHaveBeenCalled();
  });

  it('caps the note count and per-note length', async () => {
    digestMock.mockResolvedValue({ overview: 'o', themes: [], outstandingActions: [] });
    const notes = Array.from({ length: 80 }, () => ({ plainText: 'y'.repeat(3000) }));
    const r = await generateQuickNotesDigest({ notes, workspaceId: 'ws1', userId: 'u4' });
    expect(r.success).toBe(true);
    const arg = digestMock.mock.calls[0][0] as { notes: Array<{ plainText: string }> };
    expect(arg.notes.length).toBe(50);
    expect(arg.notes[0].plainText).toHaveLength(1500);
  });
});

describe('createTaskFromActionItem', () => {
  it('builds a task with sensible defaults and links', async () => {
    createTaskMock.mockResolvedValue({ success: true, id: 't1' });
    const r = await createTaskFromActionItem({
      text: '  Call the client  ',
      workspaceId: 'ws1',
      organizationId: 'org1',
      userId: 'u1',
      links: { entityId: 'e1', entityName: 'Acme' },
    });
    expect(r).toEqual({ success: true, data: { id: 't1' } });
    const [taskData, userId] = createTaskMock.mock.calls[0];
    expect(userId).toBe('u1');
    expect(taskData).toMatchObject({
      workspaceId: 'ws1',
      title: 'Call the client',
      priority: 'medium',
      status: 'todo',
      category: 'follow_up',
      assignedTo: 'u1',
      entityId: 'e1',
      entityName: 'Acme',
    });
  });

  it('rejects an empty action item', async () => {
    const r = await createTaskFromActionItem({ text: '   ', workspaceId: 'ws1', organizationId: 'o', userId: 'u1' });
    expect(r.success).toBe(false);
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it('propagates a task-creation failure', async () => {
    createTaskMock.mockResolvedValue({ success: false, error: 'no permission' });
    const r = await createTaskFromActionItem({ text: 'do it', workspaceId: 'ws1', organizationId: 'o', userId: 'u1' });
    expect(r).toEqual({ success: false, error: 'no permission' });
  });
});

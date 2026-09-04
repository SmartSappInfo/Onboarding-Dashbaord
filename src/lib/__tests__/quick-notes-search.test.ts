import { describe, it, expect, vi, beforeEach } from 'vitest';

const embedMock = vi.fn();
const searchVectorMock = vi.fn();
const searchKeywordsMock = vi.fn();
const searchEntityMock = vi.fn();
const canUserMock = vi.fn().mockResolvedValue({ granted: true });
const askRagFlowMock = vi.fn();

vi.mock('@/ai/flows/embed-note-flow', () => ({
  embedText: (...args: unknown[]) => embedMock(...args),
}));

vi.mock('@/ai/flows/ask-knowledge-rag-flow', () => ({
  askKnowledgeRagFlow: (...args: unknown[]) => askRagFlowMock(...args),
}));

vi.mock('../note-index-repository', () => ({
  NoteIndexRepository: {
    searchByVector: (...args: unknown[]) => searchVectorMock(...args),
    searchByKeywords: (...args: unknown[]) => searchKeywordsMock(...args),
    searchByEntity: (...args: unknown[]) => searchEntityMock(...args),
    projectMany: vi.fn().mockResolvedValue(5),
  },
}));

vi.mock('../workspace-permissions', () => ({
  canUser: (...args: unknown[]) => canUserMock(...args),
}));

import {
  semanticSearchNotes,
  hybridSearchKnowledgeAction,
  askSmartSappKnowledgeAction,
} from '../quick-notes-search-actions';

beforeEach(() => {
  vi.clearAllMocks();
  canUserMock.mockResolvedValue({ granted: true });
  searchKeywordsMock.mockResolvedValue([]);
  searchVectorMock.mockResolvedValue([]);
});

describe('semanticSearchNotes (Legacy)', () => {
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

  it('returns matches on success', async () => {
    embedMock.mockResolvedValue([0.1, 0.2, 0.3]);
    searchVectorMock.mockResolvedValue([
      { id: 'quick_note:n1', source: 'quick_note', title: 'Found', plainText: 'x', createdAt: '2026-09-01T00:00:00Z' },
    ]);
    const r = await semanticSearchNotes({ workspaceId: 'ws1', query: 'pricing', userId: 'u1' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toHaveLength(1);
    expect(searchVectorMock).toHaveBeenCalledWith('ws1', [0.1, 0.2, 0.3], 10);
  });
});

describe('hybridSearchKnowledgeAction (Phase 4)', () => {
  it('returns fused search results combining lexical and vector matches', async () => {
    embedMock.mockResolvedValue([0.5, 0.5]);
    searchKeywordsMock.mockResolvedValue([
      {
        id: 'quick_note:1',
        source: 'quick_note',
        title: 'Fee Payment Guide',
        plainText: 'Details about fee payment deadlines',
        knowledgeType: 'note',
        createdAt: '2026-09-01T10:00:00Z',
        tags: ['billing'],
      },
    ]);
    searchVectorMock.mockResolvedValue([
      {
        id: 'call_note:2',
        source: 'call_note',
        title: 'Call with St. Jude School',
        plainText: 'Discussion on installment payment options',
        knowledgeType: 'feedback',
        createdAt: '2026-09-02T10:00:00Z',
        tags: ['pricing'],
      },
    ]);

    const result = await hybridSearchKnowledgeAction({
      workspaceId: 'ws1',
      userId: 'u1',
      query: 'fee payment options',
      limit: 5,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(2);
      expect(result.data[0].score).toBeGreaterThan(0);
      expect(result.data[0].scoreBreakdown).toBeDefined();
    }
  });

  it('gracefully degrades to keyword search when vector index is missing', async () => {
    embedMock.mockResolvedValue([0.1, 0.2]);
    searchKeywordsMock.mockResolvedValue([
      {
        id: 'quick_note:1',
        source: 'quick_note',
        title: 'Keyword Match',
        plainText: 'Found via keyword',
        knowledgeType: 'note',
        createdAt: '2026-09-01T10:00:00Z',
        tags: [],
      },
    ]);
    searchVectorMock.mockRejectedValue(new Error('9 FAILED_PRECONDITION: missing vector index'));

    const result = await hybridSearchKnowledgeAction({
      workspaceId: 'ws1',
      userId: 'u1',
      query: 'keyword',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(1);
      expect(result.fallbackNotice).toMatch(/vector search is currently offline/i);
    }
  });
});

describe('askSmartSappKnowledgeAction (Phase 4 RAG)', () => {
  it('orchestrates retrieval, chunking, and grounded synthesis with citations', async () => {
    embedMock.mockResolvedValue([0.1, 0.2]);
    searchKeywordsMock.mockResolvedValue([
      {
        id: 'quick_note:n10',
        source: 'quick_note',
        title: 'School Transport Concerns',
        plainText: 'Parents raised concerns regarding bus routes and schedules.',
        knowledgeType: 'feedback',
        createdAt: '2026-09-03T10:00:00Z',
        tags: ['transport'],
      },
    ]);
    searchVectorMock.mockResolvedValue([]);

    askRagFlowMock.mockResolvedValue({
      answer: 'Parents are primarily concerned about bus route coverage and schedules.',
      confidence: 'high',
      confidenceScore: 92,
      state: 'answered',
      keyFindings: ['Bus route coverage is the primary issue.'],
      citations: [
        {
          citationId: 'quick_note:n10:chunk_0',
          objectId: 'quick_note:n10',
          sourceType: 'quick_note',
          title: 'School Transport Concerns',
          authorName: 'Admin',
          timestamp: '2026-09-03T10:00:00Z',
          excerpt: 'Parents raised concerns regarding bus routes',
          relevanceScore: 0.95,
          originHref: '/admin/quick-notes',
        },
      ],
      recommendedActions: [
        {
          title: 'Review bus route schedule',
          priority: 'high',
          rationale: 'Address parent transport feedback',
        },
      ],
      unresolvedQuestions: [],
    });

    const res = await askSmartSappKnowledgeAction({
      workspaceId: 'ws1',
      userId: 'u1',
      query: 'What concerns did parents raise about transport?',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.confidence).toBe('high');
      expect(res.data.confidenceScore).toBe(92);
      expect(res.data.citations).toHaveLength(1);
      expect(res.data.recommendedActions).toHaveLength(1);
      expect(res.data.recommendedActions[0].title).toBe('Review bus route schedule');
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  extractPlainText,
  dedupeTags,
  pruneUndefined,
  unifiedNoteId,
  quickNoteToUnified,
  sortUnifiedNotes,
  attachmentTypeFromMime,
  sanitizeFileName,
  buildAttachmentStoragePath,
  collectOwnedStoragePaths,
  isSafeHttpUrl,
  clampText,
  hasRenderableThumbnail,
  buildAiInput,
  isAllowedAttachmentMime,
  normalizeKnowledgeType,
  buildTimelineStream,
  filterTimelineStream,
  extractActionItemsFromText,
  groupTimelineByPeriod,
  chunkNoteContent,
  calculateRecencyScore,
  calculateHybridScore,
  extractSearchHighlights,
  fuseSearchResults,
} from '../quick-notes-domain';
import type { QuickNoteAttachment, CRMKnowledgeTimelineItem, NoteIndexRow } from '../quick-notes-types';
import {
  quickNoteCreateInputSchema,
  type NoteDocument,
  type QuickNote,
  type UnifiedNote,
} from '../quick-notes-types';

describe('extractPlainText', () => {
  it('returns empty string for nullish or non-object input', () => {
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
    // @ts-expect-error — exercising the runtime guard
    expect(extractPlainText('not a doc')).toBe('');
  });

  it('extracts text from a single paragraph', () => {
    const doc: NoteDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    };
    expect(extractPlainText(doc)).toBe('Hello world');
  });

  it('separates block-level nodes with newlines', () => {
    const doc: NoteDocument = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body line' }] },
      ],
    };
    expect(extractPlainText(doc)).toBe('Title\nBody line');
  });

  it('walks nested list items', () => {
    const doc: NoteDocument = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('one\ntwo');
  });

  it('does not throw on pathologically deep documents (recursion guard)', () => {
    let node: NoteDocument = { type: 'text', text: 'deep' };
    for (let i = 0; i < 500; i++) node = { type: 'paragraph', content: [node] };
    expect(() => extractPlainText({ type: 'doc', content: [node] })).not.toThrow();
  });

  it('honours hardBreak nodes and collapses excess blank lines', () => {
    const doc: NoteDocument = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] },
        { type: 'paragraph' },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'c' }] },
      ],
    };
    expect(extractPlainText(doc)).toBe('a\nb\n\nc');
  });
});

describe('dedupeTags', () => {
  it('returns [] for undefined', () => {
    expect(dedupeTags(undefined)).toEqual([]);
  });

  it('trims, drops empties, and removes non-strings', () => {
    // @ts-expect-error — exercising runtime resilience
    expect(dedupeTags(['  hello ', '', '   ', 42, 'world'])).toEqual(['hello', 'world']);
  });

  it('de-duplicates case-insensitively, preserving first casing', () => {
    expect(dedupeTags(['Sales', 'sales', 'SALES', 'Lead'])).toEqual(['Sales', 'Lead']);
  });

  it('caps tag length and total count', () => {
    const long = 'x'.repeat(80);
    expect(dedupeTags([long])[0]).toHaveLength(50);

    const many = Array.from({ length: 40 }, (_, i) => `t${i}`);
    expect(dedupeTags(many)).toHaveLength(30);
  });
});

describe('pruneUndefined', () => {
  it('removes only undefined keys, keeping null/false/0/""', () => {
    expect(pruneUndefined({ a: undefined, b: null, c: false, d: 0, e: '', f: 'x' })).toEqual({
      b: null,
      c: false,
      d: 0,
      e: '',
      f: 'x',
    });
  });
});

describe('unifiedNoteId', () => {
  it('namespaces the id by source', () => {
    expect(unifiedNoteId('quick_note', 'abc')).toBe('quick_note:abc');
    expect(unifiedNoteId('entity_note', 'xyz')).toBe('entity_note:xyz');
  });
});

describe('quickNoteToUnified', () => {
  const base: QuickNote = {
    id: 'n1',
    organizationId: 'org1',
    workspaceId: 'ws1',
    title: 'My note',
    content: { type: 'doc' },
    plainText: 'My note body',
    contentVersion: 1,
    tags: ['a'],
    attachments: [],
    links: { entityId: 'e1', entityName: 'Acme' },
    isPinned: true,
    createdBy: 'u1',
    createdByName: 'Joe',
    createdAt: '2026-06-13T10:00:00.000Z',
    updatedAt: '2026-06-13T10:00:00.000Z',
  };

  it('maps a native note to an editable, origin-less unified note', () => {
    const u = quickNoteToUnified(base);
    expect(u).toMatchObject({
      id: 'quick_note:n1',
      source: 'quick_note',
      sourceId: 'n1',
      workspaceId: 'ws1',
      title: 'My note',
      plainText: 'My note body',
      isPinned: true,
      originHref: null,
      editable: true,
    });
    expect(u.links.entityName).toBe('Acme');
  });

  it('tolerates missing arrays', () => {
    const u = quickNoteToUnified({ ...base, tags: undefined as never, attachments: undefined as never, links: undefined as never });
    expect(u.tags).toEqual([]);
    expect(u.attachments).toEqual([]);
    expect(u.links).toEqual({});
  });
});

describe('sortUnifiedNotes', () => {
  const make = (id: string, isPinned: boolean, createdAt: string): UnifiedNote => ({
    id,
    source: 'quick_note',
    sourceId: id,
    workspaceId: 'ws1',
    plainText: '',
    tags: [],
    attachments: [],
    links: {},
    isPinned,
    createdAt,
    originHref: null,
    editable: true,
  });

  it('orders pinned first, then newest-first, without mutating input', () => {
    const input = [
      make('a', false, '2026-01-01T00:00:00.000Z'),
      make('b', true, '2026-01-02T00:00:00.000Z'),
      make('c', false, '2026-03-01T00:00:00.000Z'),
      make('d', true, '2026-05-01T00:00:00.000Z'),
    ];
    const sorted = sortUnifiedNotes(input);
    expect(sorted.map((n) => n.id)).toEqual(['d', 'b', 'c', 'a']);
    // input not mutated
    expect(input.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('attachmentTypeFromMime', () => {
  it('classifies by MIME prefix, defaulting to file', () => {
    expect(attachmentTypeFromMime('image/png')).toBe('image');
    expect(attachmentTypeFromMime('video/mp4')).toBe('video');
    expect(attachmentTypeFromMime('application/pdf')).toBe('file');
    expect(attachmentTypeFromMime(undefined)).toBe('file');
    expect(attachmentTypeFromMime('')).toBe('file');
  });
});

describe('sanitizeFileName', () => {
  it('strips unsafe characters and collapses underscores', () => {
    expect(sanitizeFileName('My Report (final).pdf')).toBe('My_Report_final_.pdf');
    expect(sanitizeFileName('a/b\\c:d*e.png')).toBe('a_b_c_d_e.png');
  });

  it('falls back for empty names', () => {
    expect(sanitizeFileName('')).toBe('file');
  });
});

describe('buildAttachmentStoragePath', () => {
  it('namespaces by workspace and id with a sanitized name', () => {
    expect(buildAttachmentStoragePath('ws1', 'abc', 'My File.png')).toBe('quick-notes/ws1/abc-My_File.png');
  });
});

describe('collectOwnedStoragePaths', () => {
  it('returns only attachments that we host', () => {
    const attachments: QuickNoteAttachment[] = [
      { id: '1', type: 'image', url: 'https://x/a.png', storagePath: 'quick-notes/ws/1-a.png' },
      { id: '2', type: 'link', url: 'https://ext.com', thumbnailUrl: 'https://x/t.png', storagePath: 'quick-notes/ws/2-t.png' },
      { id: '3', type: 'link', url: 'https://ext.com/no-thumb' },
    ];
    expect(collectOwnedStoragePaths({ attachments })).toEqual(['quick-notes/ws/1-a.png', 'quick-notes/ws/2-t.png']);
  });

  it('handles missing attachments', () => {
    expect(collectOwnedStoragePaths({ attachments: undefined as never })).toEqual([]);
  });
});

describe('isSafeHttpUrl', () => {
  it('accepts public http(s) URLs', () => {
    expect(isSafeHttpUrl('https://example.com/page')).toBe(true);
    expect(isSafeHttpUrl('http://203.0.113.5/og.png')).toBe(true);
  });

  it('rejects non-http schemes and malformed URLs', () => {
    expect(isSafeHttpUrl('ftp://example.com')).toBe(false);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
  });

  it('rejects localhost and private ranges (SSRF guard)', () => {
    expect(isSafeHttpUrl('http://localhost:3000')).toBe(false);
    expect(isSafeHttpUrl('http://127.0.0.1/x')).toBe(false);
    expect(isSafeHttpUrl('http://10.0.0.5/x')).toBe(false);
    expect(isSafeHttpUrl('http://192.168.1.1/x')).toBe(false);
    expect(isSafeHttpUrl('http://172.16.0.1/x')).toBe(false);
    expect(isSafeHttpUrl('http://169.254.1.1/x')).toBe(false);
    expect(isSafeHttpUrl('http://printer.local/x')).toBe(false);
  });

  it('allows public 172.x outside the private block', () => {
    expect(isSafeHttpUrl('http://172.15.0.1/x')).toBe(true);
    expect(isSafeHttpUrl('http://172.32.0.1/x')).toBe(true);
  });
});

describe('clampText', () => {
  it('trims and caps length, preserving undefined', () => {
    expect(clampText('  hi  ', 10)).toBe('hi');
    expect(clampText('abcdef', 3)).toBe('abc');
    expect(clampText(undefined, 5)).toBeUndefined();
  });
});

describe('hasRenderableThumbnail', () => {
  it('is true only for image/link with a thumbnail', () => {
    expect(hasRenderableThumbnail({ id: '1', type: 'image', url: 'u', thumbnailUrl: 't' })).toBe(true);
    expect(hasRenderableThumbnail({ id: '2', type: 'link', url: 'u', thumbnailUrl: 't' })).toBe(true);
    expect(hasRenderableThumbnail({ id: '3', type: 'link', url: 'u' })).toBe(false);
    expect(hasRenderableThumbnail({ id: '4', type: 'video', url: 'u', thumbnailUrl: 't' })).toBe(false);
    expect(hasRenderableThumbnail({ id: '5', type: 'file', url: 'u' })).toBe(false);
  });
});

describe('isAllowedAttachmentMime', () => {
  it('allows images, videos, and known document types', () => {
    expect(isAllowedAttachmentMime('image/png')).toBe(true);
    expect(isAllowedAttachmentMime('video/mp4')).toBe(true);
    expect(isAllowedAttachmentMime('application/pdf')).toBe(true);
    expect(isAllowedAttachmentMime('text/csv')).toBe(true);
  });

  it('rejects executables, unknown, and empty types', () => {
    expect(isAllowedAttachmentMime('application/x-msdownload')).toBe(false);
    expect(isAllowedAttachmentMime('application/octet-stream')).toBe(false);
    expect(isAllowedAttachmentMime('')).toBe(false);
    expect(isAllowedAttachmentMime(undefined)).toBe(false);
  });
});

describe('buildAiInput', () => {
  it('trims and returns text under the budget unchanged', () => {
    expect(buildAiInput('  hello  ')).toBe('hello');
    expect(buildAiInput(undefined)).toBe('');
  });

  it('hard-caps text to the budget', () => {
    const long = 'a'.repeat(9000);
    expect(buildAiInput(long)).toHaveLength(8000);
    expect(buildAiInput(long, 100)).toHaveLength(100);
  });
});

describe('quickNoteCreateInputSchema', () => {
  const validContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] };

  it('accepts a minimal valid payload and applies defaults', () => {
    const parsed = quickNoteCreateInputSchema.parse({ title: 'Hello', content: validContent });
    expect(parsed.tags).toEqual([]);
    expect(parsed.attachments).toEqual([]);
    expect(parsed.links).toEqual({});
  });

  it('rejects an empty title', () => {
    const result = quickNoteCreateInputSchema.safeParse({ title: '   ', content: validContent });
    expect(result.success).toBe(false);
  });

  it('rejects an attachment with a non-URL', () => {
    const result = quickNoteCreateInputSchema.safeParse({
      title: 'x',
      content: validContent,
      attachments: [{ id: 'a1', type: 'link', url: 'not-a-url' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a nested TipTap document', () => {
    const result = quickNoteCreateInputSchema.safeParse({
      title: 'Deep',
      content: {
        type: 'doc',
        content: [
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }] },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts Knowledge 2.0 fields with defaults', () => {
    const parsed = quickNoteCreateInputSchema.parse({
      title: 'Strategic Idea',
      content: validContent,
      knowledgeType: 'idea',
      status: 'active',
      visibility: 'workspace',
    });
    expect(parsed.knowledgeType).toBe('idea');
    expect(parsed.status).toBe('active');
    expect(parsed.visibility).toBe('workspace');
  });
});

describe('normalizeKnowledgeType', () => {
  it('defaults undefined or empty to "note"', () => {
    expect(normalizeKnowledgeType(undefined)).toBe('note');
    expect(normalizeKnowledgeType('')).toBe('note');
  });

  it('preserves valid Knowledge 2.0 types', () => {
    expect(normalizeKnowledgeType('idea')).toBe('idea');
    expect(normalizeKnowledgeType('insight')).toBe('insight');
    expect(normalizeKnowledgeType('decision')).toBe('decision');
    expect(normalizeKnowledgeType('feedback')).toBe('feedback');
    expect(normalizeKnowledgeType('action')).toBe('action');
    expect(normalizeKnowledgeType('research')).toBe('research');
    expect(normalizeKnowledgeType('strategy')).toBe('strategy');
  });

  it('maps legacy note types gracefully', () => {
    expect(normalizeKnowledgeType('call')).toBe('observation');
    expect(normalizeKnowledgeType('meeting')).toBe('observation');
    expect(normalizeKnowledgeType('followup')).toBe('action');
    expect(normalizeKnowledgeType('escalation')).toBe('feedback');
  });
});

describe('extractActionItemsFromText', () => {
  it('extracts Markdown checkbox items and TODO lines', () => {
    const text = `
Meeting with St. Patrick High School.
- [ ] Send invoice proposal by Friday
- [x] Completed curriculum alignment
TODO: Follow up with finance officer
Action: Prepare customized onboarding deck
Random observation text.
`;
    const actions = extractActionItemsFromText(text);
    expect(actions).toEqual([
      'Send invoice proposal by Friday',
      'Completed curriculum alignment',
      'Follow up with finance officer',
      'Prepare customized onboarding deck',
    ]);
  });

  it('handles empty or null text safely', () => {
    expect(extractActionItemsFromText(null)).toEqual([]);
    expect(extractActionItemsFromText('')).toEqual([]);
  });
});

describe('buildTimelineStream', () => {
  it('aggregates and sorts native notes, entity notes, activities, and tasks chronologically', () => {
    const mockQuickNotes: QuickNote[] = [
      {
        id: 'qn-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        title: 'Strategy Meeting Note',
        plainText: 'Key strategic discussion.',
        content: { type: 'doc' },
        contentVersion: 1,
        knowledgeType: 'strategy',
        isPinned: false,
        tags: ['strategy'],
        attachments: [],
        links: { entityId: 'school-123' },
        createdBy: 'user-1',
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z',
      },
      {
        id: 'qn-2',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        title: 'Pinned Executive Resolution',
        plainText: 'Crucial board decision.',
        content: { type: 'doc' },
        contentVersion: 1,
        knowledgeType: 'decision',
        isPinned: true,
        pinnedAt: '2026-09-01T10:00:00Z',
        tags: ['board'],
        attachments: [],
        links: { entityId: 'school-123' },
        createdBy: 'user-2',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ];

    const mockEntityNotes = [
      {
        id: 'en-1',
        workspaceId: 'ws-1',
        entityId: 'school-123',
        content: 'Call with bursar regarding late fees.',
        noteType: 'call',
        isPinned: false,
        createdAt: '2026-09-03T09:00:00Z',
      },
    ];

    const mockActivities = [
      {
        id: 'act-1',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        entityId: 'school-123',
        type: 'meeting',
        source: 'calendar',
        timestamp: '2026-09-04T08:00:00Z',
        description: 'Demonstrated CRM portal to administrators',
      },
    ];

    const timeline = buildTimelineStream({
      quickNotes: mockQuickNotes,
      entityNotes: mockEntityNotes,
      activities: mockActivities,
    });

    // Pinned items float to the top
    expect(timeline[0].id).toBe('quick_note:qn-2');
    expect(timeline[0].isPinned).toBe(true);

    // Remaining items sorted by newest timestamp first
    expect(timeline[1].id).toBe('activity:act-1');
    expect(timeline[2].id).toBe('entity_note:en-1');
    expect(timeline[3].id).toBe('quick_note:qn-1');
  });
});

describe('filterTimelineStream', () => {
  const sampleItems: CRMKnowledgeTimelineItem[] = [
    {
      id: 'quick_note:1',
      source: 'quick_note',
      sourceId: '1',
      workspaceId: 'ws-1',
      title: 'Pricing Objection',
      content: 'Customer mentioned competitors are 20% cheaper.',
      knowledgeType: 'feedback',
      timestamp: '2026-09-01T10:00:00Z',
      sentiment: 'negative',
      isPinned: false,
      links: { entityName: 'St. Mary' },
      tags: ['objection', 'pricing'],
      originHref: null,
      editable: true,
    },
    {
      id: 'quick_note:2',
      source: 'quick_note',
      sourceId: '2',
      workspaceId: 'ws-1',
      title: 'Payment Portal Idea',
      content: 'Allow parents to pay via Mobile Money.',
      knowledgeType: 'idea',
      timestamp: '2026-09-02T10:00:00Z',
      sentiment: 'positive',
      isPinned: true,
      links: { entityName: 'St. Mary' },
      tags: ['feature'],
      originHref: null,
      editable: true,
    },
  ];

  it('filters by semantic knowledge type', () => {
    const result = filterTimelineStream(sampleItems, {
      type: 'feedback',
      searchQuery: '',
    });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('quick_note:1');
  });

  it('filters by search query', () => {
    const result = filterTimelineStream(sampleItems, {
      type: 'all',
      searchQuery: 'Mobile Money',
    });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('quick_note:2');
  });

  it('filters by onlyPinned', () => {
    const result = filterTimelineStream(sampleItems, {
      type: 'all',
      searchQuery: '',
      onlyPinned: true,
    });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('quick_note:2');
  });
});

describe('groupTimelineByPeriod', () => {
  it('groups items into readable month and year categories', () => {
    const sampleItems: CRMKnowledgeTimelineItem[] = [
      {
        id: 'quick_note:1',
        source: 'quick_note',
        sourceId: '1',
        workspaceId: 'ws-1',
        title: 'Note 1',
        content: 'Content',
        knowledgeType: 'note',
        timestamp: '2026-09-01T10:00:00Z',
        isPinned: false,
        links: {},
        tags: [],
        originHref: null,
        editable: true,
      },
      {
        id: 'quick_note:2',
        source: 'quick_note',
        sourceId: '2',
        workspaceId: 'ws-1',
        title: 'Note 2',
        content: 'Content 2',
        knowledgeType: 'note',
        timestamp: '2026-08-15T10:00:00Z',
        isPinned: false,
        links: {},
        tags: [],
        originHref: null,
        editable: true,
      },
    ];

    const groups = groupTimelineByPeriod(sampleItems);
    expect(groups.length).toBe(2);
    expect(groups[0].period).toBe('September 2026');
    expect(groups[1].period).toBe('August 2026');
  });
});

describe('chunkNoteContent (Phase 4)', () => {
  it('splits long notes into semantic chunks bounded by maxChunkChars', () => {
    const longText = 'Paragraph one about admissions.\n\nParagraph two with detailed fee structures.\n\nParagraph three with bus schedules.';
    const note: UnifiedNote = {
      id: 'quick_note:1',
      sourceId: '1',
      source: 'quick_note',
      workspaceId: 'ws-1',
      title: 'School Guide',
      content: { type: 'doc' },
      plainText: longText,
      createdAt: '2026-09-01T10:00:00Z',
      isPinned: false,
      tags: ['admissions'],
      links: {},
      originHref: null,
      editable: true,
      knowledgeType: 'note',
      attachments: [],
    };

    const chunks = chunkNoteContent(note, 60);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].objectId).toBe('quick_note:1');
    expect(chunks[0].chunkId).toContain('chunk_');
  });

  it('returns empty array when plainText is empty', () => {
    const note: UnifiedNote = {
      id: 'quick_note:2',
      sourceId: '2',
      source: 'quick_note',
      workspaceId: 'ws-1',
      title: '',
      content: { type: 'doc' },
      plainText: '',
      createdAt: '2026-09-01T10:00:00Z',
      isPinned: false,
      tags: [],
      links: {},
      originHref: null,
      editable: true,
      attachments: [],
    };

    expect(chunkNoteContent(note)).toEqual([]);
  });
});

describe('calculateRecencyScore (Phase 4)', () => {
  it('returns close to 1.0 for timestamps from today', () => {
    const today = new Date().toISOString();
    const score = calculateRecencyScore(today);
    expect(score).toBeGreaterThan(0.95);
  });

  it('decays exponentially over time', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const score = calculateRecencyScore(thirtyDaysAgo, 30);
    expect(score).toBeCloseTo(0.5, 1);
  });
});

describe('calculateHybridScore (Phase 4)', () => {
  it('balances lexical and semantic scores according to alpha', () => {
    const { totalScore, breakdown } = calculateHybridScore(0.8, 0.4, 1.0, 0, 0.5);
    expect(totalScore).toBeGreaterThan(0);
    expect(breakdown.lexicalScore).toBe(0.8);
    expect(breakdown.semanticScore).toBe(0.4);
    expect(breakdown.recencyScore).toBe(1.0);
  });
});

describe('extractSearchHighlights (Phase 4)', () => {
  it('extracts relevant snippet around search terms without HTML leakage', () => {
    const text = 'The administrative staff met today to discuss tuition discount structures for K-12 students.';
    const highlights = extractSearchHighlights(text, 'tuition discount');
    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights[0]).toContain('tuition discount');
    expect(highlights[0]).not.toContain('<');
    expect(highlights[0]).not.toContain('>');
  });
});

describe('fuseSearchResults (Phase 4)', () => {
  it('merges, deduplicates, and ranks candidate rows by combined score', () => {
    const lexicalRows: NoteIndexRow[] = [
      {
        id: 'quick_note:1',
        sourceId: '1',
        source: 'quick_note',
        title: 'Tuition Policy',
        content: { type: 'doc' },
        plainText: 'Tuition and fees schedule',
        knowledgeType: 'note',
        createdAt: '2026-09-01T10:00:00Z',
        workspaceId: 'ws-1',
        isPinned: false,
        tags: ['tuition'],
        links: {},
        originHref: null,
        editable: true,
        attachmentCount: 0,
        indexedAt: '2026-09-01T10:00:00Z',
      },
    ];

    const vectorRows: NoteIndexRow[] = [
      {
        id: 'call_note:2',
        sourceId: '2',
        source: 'call_note',
        title: 'Call on Pricing',
        content: { type: 'doc' },
        plainText: 'Discussed discounts with parent',
        knowledgeType: 'feedback',
        createdAt: '2026-09-02T10:00:00Z',
        workspaceId: 'ws-1',
        isPinned: false,
        tags: ['pricing'],
        links: {},
        originHref: null,
        editable: true,
        attachmentCount: 0,
        indexedAt: '2026-09-02T10:00:00Z',
      },
    ];

    const results = fuseSearchResults(lexicalRows, vectorRows, 'tuition pricing');
    expect(results.length).toBe(2);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].scoreBreakdown).toBeDefined();
  });
});


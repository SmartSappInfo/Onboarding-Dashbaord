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
} from '../quick-notes-domain';
import type { QuickNoteAttachment } from '../quick-notes-types';
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
});

// @vitest-environment node
/**
 * @fileOverview Transcript storage v2 (Phase 11 M1 · T2.1, findings G7/B12).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import {
  chunkSegments,
  completeTranscript,
  createTranscriptHeader,
  findLatestTranscriptId,
  markTranscriptTerminal,
  readTranscriptPage,
  readTranscriptText,
  canTransition,
  MAX_CHUNK_BYTES,
  MAX_SEGMENT_TEXT,
  SEGMENTS_PER_CHUNK,
  TranscriptConflictError,
  TranscriptNotFoundError,
  type TranscriptSegmentV2,
} from '../transcript-store';

const NOW = '2026-10-05T10:00:00.000Z';
const provenance = { createdBy: 'user-1', principalKind: 'user' as const };

function makeSegments(n: number, textLen = 40): TranscriptSegmentV2[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`, speakerId: i % 2 ? 'sp2' : 'sp1', speakerName: i % 2 ? 'Kwame' : 'Ama',
    startMs: i * 2000, endMs: i * 2000 + 1900, text: `word `.repeat(Math.max(1, Math.floor(textLen / 5))).trim(),
  }));
}

let db: FakeFirestore;
beforeEach(() => {
  db = new FakeFirestore();
});

async function newHeader(status: 'pending' | 'processing' = 'processing') {
  return createTranscriptHeader(db.asFirestore(), {
    workspaceId: 'ws-a', organizationId: 'org-1', meetingId: 'm-1', source: 'upload', status, provenance, nowIso: NOW,
  });
}

describe('chunkSegments', () => {
  it('splits by count', () => {
    const chunks = chunkSegments(makeSegments(1201));
    expect(chunks.map((c) => c.length)).toEqual([SEGMENTS_PER_CHUNK, SEGMENTS_PER_CHUNK, 201]);
  });

  it('splits by serialized size before hitting the 1 MiB document limit', () => {
    const chunks = chunkSegments(makeSegments(400, MAX_SEGMENT_TEXT - 10));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(Buffer.byteLength(JSON.stringify(c))).toBeLessThanOrEqual(MAX_CHUNK_BYTES + 5_000);
  });
});

describe('transcript storage', () => {
  it('stores and pages a 4-hour transcript (~7,200 segments) across chunks', async () => {
    const id = await newHeader();
    const segments = makeSegments(7200);
    const header = await completeTranscript(db.asFirestore(), {
      transcriptId: id, segments, speakers: [{ id: 'sp1', name: 'Ama' }, { id: 'sp2', name: 'Kwame' }],
      contentHash: 'h', injection: { flagged: false, patterns: [] }, expectedVersion: 0, nowIso: NOW,
    });
    expect(header).toMatchObject({ status: 'completed', segmentCount: 7200, chunkCount: 15, version: 1, durationMs: 7199 * 2000 + 1900 });

    const last = await readTranscriptPage(db.asFirestore(), id, 'ws-a', 14);
    expect(last.segments).toHaveLength(200);
    expect(last.segments[199].id).toBe('s7199');

    const all = await readTranscriptText(db.asFirestore(), id, 'ws-a', 20);
    expect(all.segments).toHaveLength(7200);
    expect(all.truncated).toBe(false);
    const capped = await readTranscriptText(db.asFirestore(), id, 'ws-a', 3);
    expect(capped.segments).toHaveLength(1500);
    expect(capped.truncated).toBe(true);
  });

  it('never serves a transcript that is not completed (header-last)', async () => {
    const id = await newHeader();
    await expect(readTranscriptPage(db.asFirestore(), id, 'ws-a', 0)).rejects.toBeInstanceOf(TranscriptNotFoundError);
  });

  it('masks other workspaces as NOT_FOUND', async () => {
    const id = await newHeader();
    await completeTranscript(db.asFirestore(), {
      transcriptId: id, segments: makeSegments(3), speakers: [], contentHash: 'h',
      injection: { flagged: false, patterns: [] }, expectedVersion: 0, nowIso: NOW,
    });
    await expect(readTranscriptPage(db.asFirestore(), id, 'ws-b', 0)).rejects.toBeInstanceOf(TranscriptNotFoundError);
  });

  it('refuses a stale or cancelled completion and removes the chunks it wrote', async () => {
    const id = await newHeader();
    db.write(`meeting_transcripts/${id}`, { ...db.read(`meeting_transcripts/${id}`), cancelRequested: true });
    await expect(completeTranscript(db.asFirestore(), {
      transcriptId: id, segments: makeSegments(600), speakers: [], contentHash: 'h',
      injection: { flagged: false, patterns: [] }, expectedVersion: 0, nowIso: NOW,
    })).rejects.toBeInstanceOf(TranscriptConflictError);
    expect([...db.docs.keys()].filter((k) => k.includes('/segments/'))).toHaveLength(0);
  });

  it('terminal states remove chunks and respect the state machine', async () => {
    const id = await newHeader();
    await markTranscriptTerminal(db.asFirestore(), id, 'failed', { code: 'PROVIDER', message: 'x' }, NOW);
    expect(db.read(`meeting_transcripts/${id}`)).toMatchObject({ status: 'failed', version: 1, error: { code: 'PROVIDER' } });
    expect(canTransition('completed', 'processing')).toBe(false);
    expect(canTransition('failed', 'processing')).toBe(true);
    expect(canTransition('deleting', 'completed')).toBe(false);
  });

  it('reads legacy inline transcripts without migration, skipping malformed segments', async () => {
    db.write('meeting_transcripts/legacy', {
      workspaceId: 'ws-a', meetingId: 'm-1', language: 'en', status: 'completed', createdAt: NOW, updatedAt: NOW,
      segments: [...makeSegments(2), { id: 'bad', text: 42 }], speakers: [{ id: 'sp1', name: 'Ama' }],
    });
    const page = await readTranscriptPage(db.asFirestore(), 'legacy', 'ws-a', 0);
    expect(page.legacy).toBe(true);
    expect(page.segments).toHaveLength(2);
    expect(page.header.segmentCount).toBe(2);
  });

  it('finds the latest completed transcript for a meeting', async () => {
    const a = await newHeader();
    await completeTranscript(db.asFirestore(), { transcriptId: a, segments: makeSegments(1), speakers: [], contentHash: 'a', injection: { flagged: false, patterns: [] }, expectedVersion: 0, nowIso: NOW });
    const b = await createTranscriptHeader(db.asFirestore(), { workspaceId: 'ws-a', meetingId: 'm-1', source: 'paste', status: 'processing', provenance, nowIso: '2026-10-06T00:00:00.000Z' });
    await completeTranscript(db.asFirestore(), { transcriptId: b, segments: makeSegments(1), speakers: [], contentHash: 'b', injection: { flagged: false, patterns: [] }, expectedVersion: 0, nowIso: NOW });
    expect(await findLatestTranscriptId(db.asFirestore(), 'm-1', 'ws-a')).toBe(b);
    expect(await findLatestTranscriptId(db.asFirestore(), 'm-1', 'ws-b')).toBeNull();
  });
});

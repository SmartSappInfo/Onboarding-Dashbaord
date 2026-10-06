// @vitest-environment node
/**
 * @fileOverview v2 → v1 legacy adapter (Phase 11 M2 · T3.5): nothing invented, conversions shown.
 */
import { describe, it, expect } from 'vitest';
import type { MeetingItem } from '../intelligence/intelligence-schemas';
import { PIPELINE_ID, type IntelligenceHeaderV2 } from '../intelligence/intelligence-store';
import { toLegacyIntelligence } from '../intelligence/legacy-adapter';

const NOW = '2026-10-07T12:00:00.000Z';
const header: IntelligenceHeaderV2 = {
  schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
  promptVersion: 'v', promptHash: 'h', summary: { sentences: [{ text: 'Ama will send the quote.', itemHashes: ['it_c'] }, { text: 'Pilot in November.', itemHashes: ['it_d'] }], promptVersion: 's' },
  counts: { kept: 5, needsReview: 1, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
  coverage: 1, truncated: false, modelId: 'googleai/flash', version: 2, generatedAt: NOW, updatedAt: NOW,
};
const item = (hash: string, type: MeetingItem['type'], over: Partial<MeetingItem> = {}): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type, text: `${type} ${hash}`, confidence: 0.9,
  evidence: [{ segmentIds: ['s1'], quote: `quote for ${hash}` }], contradicts: [], needsReview: false, reviewReasons: [],
  status: 'valid', promptVersion: 'v', createdAt: NOW, ...over,
});

describe('toLegacyIntelligence', () => {
  it('maps every v2 type to its v1 slot without inventing anything', () => {
    const v1 = toLegacyIntelligence(header, [
      item('it_c', 'commitment', { owner: { name: 'Ama Mensah', userId: 'u-ama', matched: true }, dueIso: '2026-10-09' }),
      item('it_a', 'action_item', { needsReview: true, reviewReasons: ['low_confidence'] }),
      item('it_d', 'decision'), item('it_t', 'topic'), item('it_r', 'risk'),
      item('it_b', 'buying_signal', { confidence: 0.65 }), item('it_o', 'objection'), item('it_q', 'question'),
    ], new Map([['it_c', 'task-9']]));
    expect(v1.executiveSummary).toBe('Ama will send the quote. Pilot in November.');
    expect(v1.actionItems).toEqual([
      { id: 'it_c', text: 'commitment it_c', assigneeName: 'Ama Mensah', assigneeUserId: 'u-ama', dueDate: '2026-10-09', priority: 'medium', status: 'converted_to_crm_task', crmTaskId: 'task-9', needsReview: false, evidenceQuote: 'quote for it_c' },
      { id: 'it_a', text: 'action_item it_a', priority: 'medium', status: 'open', needsReview: true, evidenceQuote: 'quote for it_a' },
    ]);
    expect(v1.keyDecisions).toEqual(['decision it_d']);
    expect(v1.keyTopics).toEqual(['topic it_t']);
    expect(v1.dealRisks).toEqual(['risk it_r']);
    expect(v1.buyingSignals).toEqual([{ topic: 'buying_signal it_b', quote: 'quote for it_b', strength: 'moderate' }]);
    expect(v1.objections).toEqual([{ category: 'other', statement: 'objection it_o', severity: 'medium' }]);
    expect(v1.sentiment).toBeUndefined();
    expect(v1.recommendedFollowUp).toBe('');
    expect(v1).toMatchObject({ id: 'm-1', transcriptId: 't-1', status: 'completed', modelUsed: 'googleai/flash' });
  });

  it('no summary → empty summary text', () => {
    expect(toLegacyIntelligence({ ...header, summary: null }, [], new Map()).executiveSummary).toBe('');
  });
});

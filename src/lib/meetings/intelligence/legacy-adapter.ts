/**
 * @fileOverview v2 analysis → the v1 `MeetingIntelligence` shape the current UI renders
 * (Phase 11 M2 · T3.5; functionality preservation until the T6 UI).
 *
 * Mapping is lossless for what v1 can show and invents nothing:
 * - commitments + action items → `actionItems` (id = itemHash; owner, due date, review flag, quote,
 *   and "converted" when a task exists for the item);
 * - decisions → `keyDecisions`; topics → `keyTopics`; risks → `dealRisks`;
 * - buying signals keep their real quote; objections their statement;
 * - summary sentences → `executiveSummary`;
 * - sentiment is NOT produced by v2, so it is left out (never a guessed "neutral").
 *
 * Pure. Tests: src/lib/meetings/__tests__/intelligence-legacy-adapter.test.ts
 */

import type { BuyingSignal, CustomerObjection, MeetingActionItem, MeetingIntelligence } from '../types/intelligence';
import type { MeetingItem } from './intelligence-schemas';
import type { IntelligenceHeaderV2 } from './intelligence-store';

const strength = (confidence: number): BuyingSignal['strength'] => (confidence >= 0.8 ? 'strong' : confidence >= 0.6 ? 'moderate' : 'weak');

export function toLegacyIntelligence(
  header: IntelligenceHeaderV2,
  items: readonly MeetingItem[],
  convertedTasks: ReadonlyMap<string, string>
): MeetingIntelligence {
  const of = (type: MeetingItem['type']) => items.filter((i) => i.type === type);
  const actionItems: MeetingActionItem[] = items
    .filter((i) => i.type === 'commitment' || i.type === 'action_item')
    .map((i) => {
      const taskId = convertedTasks.get(i.itemHash);
      return {
        id: i.itemHash,
        text: i.text,
        ...(i.owner?.name ? { assigneeName: i.owner.name } : {}),
        ...(i.owner?.userId ? { assigneeUserId: i.owner.userId } : {}),
        ...(i.dueIso ? { dueDate: i.dueIso } : {}),
        priority: 'medium',
        status: taskId ? 'converted_to_crm_task' : 'open',
        ...(taskId ? { crmTaskId: taskId } : {}),
        needsReview: i.needsReview,
        ...(i.evidence[0] ? { evidenceQuote: i.evidence[0].quote } : {}),
      };
    });
  const buyingSignals: BuyingSignal[] = of('buying_signal').map((i) => ({ topic: i.text, quote: i.evidence[0]?.quote ?? '', strength: strength(i.confidence) }));
  const objections: CustomerObjection[] = of('objection').map((i) => ({ category: 'other', statement: i.text, severity: 'medium' }));

  return {
    id: header.meetingId,
    workspaceId: header.workspaceId,
    ...(header.organizationId ? { organizationId: header.organizationId } : {}),
    meetingId: header.meetingId,
    transcriptId: header.transcriptId,
    executiveSummary: header.summary?.sentences.map((s) => s.text).join(' ') ?? '',
    keyTopics: of('topic').map((i) => i.text),
    keyDecisions: of('decision').map((i) => i.text),
    actionItems,
    buyingSignals,
    objections,
    dealRisks: of('risk').map((i) => i.text),
    recommendedFollowUp: '',
    ...(header.modelId ? { modelUsed: header.modelId } : {}),
    status: 'completed',
    generatedAt: header.generatedAt,
    updatedAt: header.updatedAt,
  };
}

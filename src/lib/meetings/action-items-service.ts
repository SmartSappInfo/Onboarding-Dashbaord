/**
 * @fileoverview Pure AI Action Item, Buying Signal & Objection Extractor.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Extracts commitments, assignees, and CRM deal signals from meeting text.
 */

import type { AIActionItemDraft } from './types/ai-assistant';

/**
 * Extracts structured action items from transcript sentences containing commitment verbs.
 */
export function extractActionItemsFromTranscript(
  transcriptText: string,
  meetingId: string,
  workspaceId: string
): AIActionItemDraft[] {
  if (!transcriptText || !transcriptText.trim()) return [];

  const items: AIActionItemDraft[] = [];
  const lines = transcriptText.split('\n').map(l => l.trim()).filter(Boolean);
  const now = new Date().toISOString();

  let index = 1;
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Heuristics for action items, commitments, buying signals and objections
    if (
      lower.includes('will send') ||
      lower.includes('follow up') ||
      lower.includes('action item') ||
      lower.includes('let us schedule') ||
      lower.includes('we need to') ||
      lower.includes('concern') ||
      lower.includes('ready to buy')
    ) {
      let priority: AIActionItemDraft['priority'] = 'medium';
      if (lower.includes('urgent') || lower.includes('asap') || lower.includes('today')) {
        priority = 'high';
      }

      // Detect buying signal
      let buyingSignal: string | undefined;
      if (lower.includes('pricing') || lower.includes('budget') || lower.includes('ready to buy')) {
        buyingSignal = 'Budget/Purchasing intent expressed';
      }

      // Detect objection
      let objection: string | undefined;
      if (lower.includes('concern') || lower.includes('expensive') || lower.includes('competitor')) {
        objection = 'Cost or competitor hesitation flagged';
      }

      items.push({
        id: `ai_item_${meetingId}_${index++}`,
        meetingId,
        workspaceId,
        title: line.length > 80 ? `${line.slice(0, 77)}...` : line,
        description: line,
        priority,
        isApproved: false, // Requires human approval before CRM sync
        syncedToCRM: false,
        buyingSignalDetected: buyingSignal,
        objectionDetected: objection,
        createdAt: now,
      });
    }
  }

  return items;
}

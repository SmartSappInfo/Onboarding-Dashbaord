/**
 * @file src/lib/page-builder/attribution-engine.ts
 * @description Multi-Touch Attribution Engine for SmartSapp AI Experience Builder.
 * Links landing page visits, block clicks, traffic source UTM tags, and personalized experience rules
 * to CRM deal/opportunity conversion and monetary revenue using First-Touch, Last-Touch, and Linear models.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Idempotent attribution calculation keyed by `opportunityId`.
 * - Testable utility pure functions.
 */

import type { AttributionRecord, PageEvent } from '@/lib/types';

/**
 * Calculates multi-touch revenue attribution across a sequence of visitor interaction events.
 * Supports 'first_touch', 'last_touch', and 'linear' weighting models.
 * 
 * TESTABILITY POINTER:
 * Pass event arrays with varying touchpoints and verify that sum of `attributedRevenue` equals `opportunityValue`.
 */
export function calculateAttribution(
  events: PageEvent[],
  opportunityId: string,
  contactId: string,
  opportunityValue: number,
  model: 'first_touch' | 'last_touch' | 'linear' = 'last_touch',
): AttributionRecord {
  if (!events || events.length === 0 || opportunityValue <= 0) {
    return {
      id: `attr-${opportunityId}-${model}`,
      pageId: events[0]?.pageId || 'unknown',
      contactId,
      opportunityId,
      revenue: opportunityValue,
      model,
      touchpoints: [],
      createdAt: new Date().toISOString(),
    };
  }

  // Sort events chronologically ascending
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const touchpoints: Array<{
    eventId: string;
    weight: number;
    attributedRevenue: number;
  }> = [];

  const count = sortedEvents.length;

  switch (model) {
    case 'first_touch': {
      sortedEvents.forEach((evt, idx) => {
        const weight = idx === 0 ? 1.0 : 0.0;
        touchpoints.push({
          eventId: evt.id,
          weight,
          attributedRevenue: Math.round(opportunityValue * weight * 100) / 100,
        });
      });
      break;
    }

    case 'last_touch': {
      sortedEvents.forEach((evt, idx) => {
        const weight = idx === count - 1 ? 1.0 : 0.0;
        touchpoints.push({
          eventId: evt.id,
          weight,
          attributedRevenue: Math.round(opportunityValue * weight * 100) / 100,
        });
      });
      break;
    }

    case 'linear': {
      const equalWeight = 1.0 / count;
      let runningTotal = 0;
      sortedEvents.forEach((evt, idx) => {
        const isLast = idx === count - 1;
        const attrRev = isLast
          ? Math.round((opportunityValue - runningTotal) * 100) / 100
          : Math.round((opportunityValue / count) * 100) / 100;
        runningTotal += attrRev;

        touchpoints.push({
          eventId: evt.id,
          weight: Math.round(equalWeight * 10000) / 10000,
          attributedRevenue: attrRev,
        });
      });
      break;
    }
  }

  return {
    id: `attr-${opportunityId}-${model}`,
    pageId: sortedEvents[0].pageId,
    contactId,
    opportunityId,
    revenue: opportunityValue,
    model,
    touchpoints,
    createdAt: new Date().toISOString(),
  };
}

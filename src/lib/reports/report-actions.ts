'use server';

/**
 * @fileOverview Server-side aggregation for the Reports page (Phase 6.5).
 *
 * Replaces "stream every workspace_entity to the browser and reduce in JS"
 * (the old `useEntityCache` path) with a server action that reads a **field
 * projection** (via the dashboard repository) and returns only the small
 * aggregated arrays — onboarding velocity + per-zone counts/capacity.
 *
 * See docs/superpowers/specs/2026-06-16-entity-cache-scale-design.md §9 (6.5).
 */

import { startOfMonth, endOfMonth, subDays, isWithinInterval, format } from 'date-fns';
import { getEntityProjections } from '@/lib/dashboard/dashboard-repository';

export interface ReportAggregates {
  /** Onboarding velocity — entity creations bucketed by the last 6 months. */
  velocity: Array<{ name: string; count: number }>;
  /** Per-zone entity count + summed capacity (nominalRoll). */
  zoneHealth: Array<{ zoneId: string; count: number; capacity: number }>;
}

export async function getReportAggregates(workspaceId: string): Promise<ReportAggregates> {
  if (!workspaceId) return { velocity: [], zoneHealth: [] };

  const projections = await getEntityProjections(workspaceId);

  // Onboarding velocity — last 6 months (server's "now").
  const months = Array.from({ length: 6 })
    .map((_, i) => {
      const date = subDays(new Date(), i * 30);
      return { name: format(date, 'MMM'), start: startOfMonth(date), end: endOfMonth(date), count: 0 };
    })
    .reverse();

  for (const p of projections) {
    if (!p.addedAt) continue;
    const created = new Date(p.addedAt);
    for (const m of months) {
      if (isWithinInterval(created, { start: m.start, end: m.end })) m.count++;
    }
  }

  // Zone health — group by zone id.
  const byZone = new Map<string, { count: number; capacity: number }>();
  for (const p of projections) {
    const zoneId = p.zone?.id;
    if (!zoneId) continue;
    const cur = byZone.get(zoneId) || { count: 0, capacity: 0 };
    cur.count += 1;
    cur.capacity += p.nominalRoll || 0;
    byZone.set(zoneId, cur);
  }

  return {
    velocity: months.map((m) => ({ name: m.name, count: m.count })),
    zoneHealth: [...byZone.entries()].map(([zoneId, v]) => ({ zoneId, ...v })),
  };
}

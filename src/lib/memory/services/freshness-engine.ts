/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Freshness Engine & Staleness Governance
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deterministic, Stateless Temporal Decay:
 *    - Memory freshness is modeled mathematically as a decaying curve relative to its
 *      last human verification (`lastReviewedAt`) or initial persistence timestamp.
 * 2. Strict Zero-`any` Standard:
 *    - All inputs, return objects, and batch transforms are rigorously typed.
 * 3. Topic & Category Heuristics:
 *    - Dynamic pricing, promotions, and quick action items decay rapidly (60-90 days).
 *    - High-level architectural decisions and foundational corporate facts have extended TTLs (365 days).
 * 4. 1-Click Reconfirmation Invariant:
 *    - Stale memories are never automatically deleted or purged. Human review verifies or archives them,
 *      preserving non-destructive knowledge integrity.
 *
 * @testability Fully covered in `src/lib/memory/__tests__/freshness-engine.test.ts`.
 */

import type { MemoryObject, MemoryType, MemoryLifecycle } from '../types';
import type { MemoryFreshnessInfo } from '../orchestrator-types';

/**
 * Standard baseline TTLs by MemoryType in days.
 */
const BASELINE_TTL_DAYS_MAP: Record<MemoryType, number> = {
  action_item: 60,
  event: 60,
  conversation: 90,
  meeting: 90,
  note: 120,
  customer_feedback: 120,
  preference: 180,
  observation: 180,
  summary: 180,
  opportunity: 180,
  insight: 270,
  problem: 270,
  risk: 270,
  fact: 365,
  decision: 365,
  document: 365,
  instruction: 365,
};

/**
 * Keywords indicating fast-decaying commercial or ephemeral knowledge.
 */
const RAPID_DECAY_TOPIC_KEYWORDS: readonly string[] = [
  'pricing',
  'price',
  'quote',
  'discount',
  'rate',
  'fee',
  'deal terms',
  'quarterly target',
  'sprint',
  'deadline',
];

/**
 * Computes the effective TTL in days for a memory object or memory category.
 *
 * @param input MemoryObject instance or MemoryType string
 * @returns TTL in days
 */
export function getMemoryTtlDays(input: MemoryObject | MemoryType): number {
  if (typeof input === 'string') {
    return BASELINE_TTL_DAYS_MAP[input] ?? 180;
  }

  // Inspect topics and content for rapid-decay commercial or pricing signals
  const hasRapidDecayTopic = input.topics?.some((topic) =>
    RAPID_DECAY_TOPIC_KEYWORDS.some((kw) => topic.toLowerCase().includes(kw))
  );

  if (hasRapidDecayTopic) {
    return 90;
  }

  return BASELINE_TTL_DAYS_MAP[input.type] ?? 180;
}

/**
 * Calculates current freshness metrics and staleness indicator for a memory object.
 *
 * Decay Model:
 * - Age <= TTL: Decays linearly from 1.0 down to 0.50 at the TTL threshold.
 * - Age > TTL: Decays exponentially from 0.50 down toward a floor of 0.05.
 * - Stale flag triggers when age >= TTL or freshness score < 0.50.
 *
 * @param memory The target MemoryObject
 * @param now Optional reference date (defaults to new Date())
 * @returns Complete MemoryFreshnessInfo record
 */
export function calculateFreshnessScore(
  memory: MemoryObject,
  now: Date = new Date()
): MemoryFreshnessInfo {
  const ttlDays = getMemoryTtlDays(memory);

  // Reference timestamp: last human confirmation takes absolute precedence,
  // followed by the latest between updatedAt and createdAt.
  let lastConfirmedAt = memory.lifecycle?.lastReviewedAt;
  if (!lastConfirmedAt) {
    if (memory.updatedAt && memory.createdAt) {
      lastConfirmedAt =
        new Date(memory.updatedAt).getTime() >= new Date(memory.createdAt).getTime()
          ? memory.updatedAt
          : memory.createdAt;
    } else {
      lastConfirmedAt = memory.updatedAt || memory.createdAt;
    }
  }

  const confirmedDate = new Date(lastConfirmedAt);
  const nowMs = now.getTime();
  const confirmedMs = isNaN(confirmedDate.getTime()) ? nowMs : confirmedDate.getTime();

  // Age in days (fractional)
  const ageInDays = Math.max(0, (nowMs - confirmedMs) / (1000 * 60 * 60 * 24));

  const decayFloor = 0.05;
  let score: number;

  if (ageInDays <= 0) {
    score = 1.0;
  } else if (ageInDays <= ttlDays) {
    // Linear decay down to 0.5 at TTL
    score = 1.0 - 0.5 * (ageInDays / ttlDays);
  } else {
    // Exponential tail decay after TTL threshold
    const overdueDays = ageInDays - ttlDays;
    const halfLifeDays = Math.max(30, ttlDays * 0.5);
    const tailRate = 0.45 * Math.exp(-overdueDays / halfLifeDays);
    score = Math.max(decayFloor, decayFloor + tailRate);
  }

  // Quantize score to 2 decimal places
  const freshnessScore = Math.round(score * 100) / 100;
  const isStale = ageInDays >= ttlDays || freshnessScore < 0.5;
  const daysRemaining = isStale ? 0 : Math.max(0, Math.ceil(ttlDays - ageInDays));

  return {
    memoryId: memory.id,
    freshnessScore,
    isStale,
    ttlDays,
    daysRemaining,
    lastConfirmedAt,
    category: memory.type,
  };
}

/**
 * Produces a partial patch updating the memory lifecycle upon human truth reconfirmation.
 *
 * @param memory The existing MemoryObject
 * @param userId ID of the operator reconfirming validity
 * @param now Optional confirmation timestamp
 */
export function reconfirmFreshness(
  memory: MemoryObject,
  userId: string,
  now: Date = new Date()
): { lifecycle: MemoryLifecycle; updatedAt: string } {
  const nowIso = now.toISOString();

  return {
    lifecycle: {
      ...memory.lifecycle,
      status: 'active',
      lastReviewedAt: nowIso,
      reviewedBy: userId,
    },
    updatedAt: nowIso,
  };
}

/**
 * Evaluates freshness scores across a batch of memory objects.
 *
 * @param memories Array of MemoryObjects
 * @param now Optional reference date
 */
export function evaluateMemoriesFreshness(
  memories: MemoryObject[],
  now: Date = new Date()
): MemoryFreshnessInfo[] {
  return memories.map((mem) => calculateFreshnessScore(mem, now));
}

/**
 * Filters a collection of memories returning only those that are stale or below a given threshold.
 *
 * @param memories Array of candidate MemoryObjects
 * @param thresholdScore Minimum freshness score required to stay fresh (default: 0.50)
 * @param now Optional reference date
 */
export function filterStaleMemories(
  memories: MemoryObject[],
  thresholdScore: number = 0.5,
  now: Date = new Date()
): MemoryObject[] {
  return memories.filter((mem) => {
    const info = calculateFreshnessScore(mem, now);
    return info.isStale || info.freshnessScore < thresholdScore;
  });
}

/**
 * Aggregates high-level freshness health metrics for the memory console ribbon.
 *
 * @param memories Collection of memories
 * @param now Optional reference date
 */
export function getMemoryFreshnessHealthMetrics(
  memories: MemoryObject[],
  now: Date = new Date()
): {
  total: number;
  freshCount: number;
  staleCount: number;
  averageFreshness: number;
} {
  if (memories.length === 0) {
    return {
      total: 0,
      freshCount: 0,
      staleCount: 0,
      averageFreshness: 1.0,
    };
  }

  const freshnessList = evaluateMemoriesFreshness(memories, now);
  let staleCount = 0;
  let totalScore = 0;

  for (const item of freshnessList) {
    if (item.isStale) {
      staleCount += 1;
    }
    totalScore += item.freshnessScore;
  }

  const freshCount = memories.length - staleCount;
  const averageFreshness = Math.round((totalScore / memories.length) * 100) / 100;

  return {
    total: memories.length,
    freshCount,
    staleCount,
    averageFreshness,
  };
}

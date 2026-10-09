/**
 * @fileOverview Pure in-memory TTL cache for messaging dashboard summaries.
 * Isolated from 'use server' to comply with server action guard sweeps (Rule 8 & 9).
 */

import type { MessagingDashboardSummary } from '@/lib/types/messaging-dashboard';

export interface CacheEntry {
  data: MessagingDashboardSummary;
  expiresAt: number;
}

export const dashboardSummaryCache = new Map<string, CacheEntry>();
export const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
export const MAX_CACHE_ENTRIES = 500;

/**
 * Retrieves a cached summary if present and not expired.
 */
export function getCachedDashboardSummary(key: string, nowMs: number = Date.now()): MessagingDashboardSummary | null {
  const entry = dashboardSummaryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    dashboardSummaryCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Stores a summary in the in-memory cache with eviction guard to prevent unbounded growth.
 */
export function setCachedDashboardSummary(key: string, data: MessagingDashboardSummary, nowMs: number = Date.now()): void {
  // Purge expired entries if capacity exceeded
  if (dashboardSummaryCache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of dashboardSummaryCache.entries()) {
      if (v.expiresAt <= nowMs) {
        dashboardSummaryCache.delete(k);
      }
    }
    if (dashboardSummaryCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = dashboardSummaryCache.keys().next().value;
      if (oldestKey) dashboardSummaryCache.delete(oldestKey);
    }
  }

  dashboardSummaryCache.set(key, {
    data,
    expiresAt: nowMs + CACHE_TTL_MS,
  });
}

/** Test utility to clear memory cache between runs */
export function clearDashboardSummaryCacheForTests(): void {
  dashboardSummaryCache.clear();
}

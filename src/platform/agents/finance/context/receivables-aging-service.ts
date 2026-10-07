/**
 * @fileOverview Deterministic Receivables Aging & Debt Risk Analysis Service (Phase 12 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Multi-Tenant Scoping & Cache Isolation)
 * - Rule 11 (Deterministic TS Math Outside the Model)
 * - Rule 40 (Domain Event Publishing)
 * - Rule 50 (In-Memory Partitioned Cache with 3-Minute TTL and EventBus Invalidation)
 * - Rule 69 (Strangler Fig Invariant)
 */

import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  ReceivablesAging,
  ReceivablesAgingSchema,
  InvoiceSummary,
} from './finance-context-types';

interface CachedAgingEntry {
  aging: ReceivablesAging;
  cachedAt: number;
}

export class ReceivablesAgingService {
  private readonly cache = new Map<string, CachedAgingEntry>();
  private readonly ttlMs = 180_000; // 3-minute TTL (Rule 50)
  private readonly maxCacheEntries = 500;
  private listenerRegistered = false;

  constructor() {
    this.registerEventBusListeners();
  }

  /**
   * Constructs partitioned multi-tenant cache key (Rule 50)
   */
  public getCacheKey(
    organizationId: string,
    workspaceId: string,
    entityId: string
  ): string {
    return `${organizationId}:${workspaceId}:${entityId}`;
  }

  /**
   * Deterministically calculates 4-bucket receivables aging for an account.
   */
  public calculateAging(params: {
    organizationId: string;
    workspaceId: string;
    entityId: string;
    invoices: InvoiceSummary[];
    asOfDate?: string;
  }): ReceivablesAging {
    const asOfIso = params.asOfDate || new Date().toISOString();
    const asOfMs = new Date(asOfIso).getTime();

    let current0To30 = 0;
    let warning31To60 = 0;
    let critical61To90 = 0;
    let defaultOver90 = 0;
    let totalOverdue = 0;
    let totalOutstanding = 0;
    let oldestDueDate: string | null = null;
    let overdueCount = 0;

    // Filter relevant open invoices
    const openInvoices = params.invoices.filter((inv) =>
      ['issued', 'partially_paid', 'overdue'].includes(inv.status)
    );

    for (const inv of openInvoices) {
      const balance = Math.round(Math.max(0, inv.balanceDue) * 100) / 100;
      if (balance <= 0) continue;

      totalOutstanding += balance;
      const dueMs = new Date(inv.dueDate).getTime();
      const diffMs = asOfMs - dueMs;
      const daysPastDue = Math.max(0, Math.floor(diffMs / 86_400_000));

      if (daysPastDue > 0) {
        overdueCount++;
        totalOverdue += balance;
        if (!oldestDueDate || dueMs < new Date(oldestDueDate).getTime()) {
          oldestDueDate = inv.dueDate;
        }
      }

      if (daysPastDue <= 30) {
        current0To30 += balance;
      } else if (daysPastDue <= 60) {
        warning31To60 += balance;
      } else if (daysPastDue <= 90) {
        critical61To90 += balance;
      } else {
        defaultOver90 += balance;
      }
    }

    // Determine Debt Risk Band
    let debtRiskBand: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' = 'LOW';
    if (defaultOver90 > 0 || critical61To90 > 2500) {
      debtRiskBand = 'CRITICAL';
    } else if (critical61To90 > 0 || warning31To60 > 5000) {
      debtRiskBand = 'ELEVATED';
    } else if (warning31To60 > 0 || totalOverdue > 0) {
      debtRiskBand = 'MODERATE';
    }

    const agingData: ReceivablesAging = {
      entityId: params.entityId,
      workspaceId: params.workspaceId,
      organizationId: params.organizationId,
      asOfDate: asOfIso,
      current0To30: Math.round(current0To30 * 100) / 100,
      warning31To60: Math.round(warning31To60 * 100) / 100,
      critical61To90: Math.round(critical61To90 * 100) / 100,
      defaultOver90: Math.round(defaultOver90 * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      oldestInvoiceDueDate: oldestDueDate,
      debtRiskBand,
      invoiceCount: openInvoices.length,
      overdueInvoiceCount: overdueCount,
    };

    return ReceivablesAgingSchema.parse(agingData);
  }

  /**
   * Retrieves receivables aging with multi-tenant partitioned caching (Rule 50).
   */
  public async getAgingWithCache(params: {
    organizationId: string;
    workspaceId: string;
    entityId: string;
    invoices: InvoiceSummary[];
    asOfDate?: string;
  }): Promise<ReceivablesAging> {
    const key = this.getCacheKey(
      params.organizationId,
      params.workspaceId,
      params.entityId
    );
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && now - cached.cachedAt < this.ttlMs) {
      return cached.aging;
    }

    const calculated = this.calculateAging(params);

    // Prune cache if over ceiling
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { aging: calculated, cachedAt: now });

    // Emit domain event (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'finance.aging.computed',
          organizationId: params.organizationId,
          workspaceId: params.workspaceId,
          actor: { type: 'system', id: 'receivables-aging-service' },
          entity: { type: 'receivables_aging', id: params.entityId },
          correlationId: `aging_${params.entityId}_${Date.now()}`,
          source: 'receivables-aging-service',
          payload: {
            debtRiskBand: calculated.debtRiskBand,
            totalOverdue: calculated.totalOverdue,
            timestamp: new Date().toISOString(),
          },
        })
      );
    } catch {
      // Event publishing should not fail domain query
    }

    return calculated;
  }

  /**
   * Evicts cache entry for a specific entity
   */
  public invalidateCache(
    organizationId: string,
    workspaceId: string,
    entityId: string
  ): void {
    const key = this.getCacheKey(organizationId, workspaceId, entityId);
    this.cache.delete(key);
  }

  /**
   * Clears the entire cache (useful for testing)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Subscribes to domain mutation events to reactively invalidate stale cache entries (Rule 40 & 50)
   */
  private registerEventBusListeners(): void {
    if (this.listenerRegistered) return;
    this.listenerRegistered = true;

    try {
      defaultEventBus.subscribe('finance.invoice.*', async (event) => {
        const payload = event.payload as {
          organizationId?: string;
          workspaceId?: string;
          entityId?: string;
        };
        if (
          payload?.organizationId &&
          payload?.workspaceId &&
          payload?.entityId
        ) {
          this.invalidateCache(
            payload.organizationId,
            payload.workspaceId,
            payload.entityId
          );
        }
      });

      defaultEventBus.subscribe('finance.payment.*', async (event) => {
        const payload = event.payload as {
          organizationId?: string;
          workspaceId?: string;
          entityId?: string;
        };
        if (
          payload?.organizationId &&
          payload?.workspaceId &&
          payload?.entityId
        ) {
          this.invalidateCache(
            payload.organizationId,
            payload.workspaceId,
            payload.entityId
          );
        }
      });
    } catch {
      // Event bus might not be fully wired in test harness
    }
  }
}

// HMR-safe global singleton preservation
declare global {
  // eslint-disable-next-line no-var
  var __smartsappReceivablesAgingService: ReceivablesAgingService | undefined;
}

export function getReceivablesAgingService(): ReceivablesAgingService {
  if (!globalThis.__smartsappReceivablesAgingService) {
    globalThis.__smartsappReceivablesAgingService =
      new ReceivablesAgingService();
  }
  return globalThis.__smartsappReceivablesAgingService;
}

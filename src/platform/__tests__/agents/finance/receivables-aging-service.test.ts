/**
 * @fileOverview Unit Tests: Receivables Aging & Balance Analysis Service (Phase 12 Milestone 1)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReceivablesAgingService,
  getReceivablesAgingService,
} from '@/platform/agents/finance/context/receivables-aging-service';
import type { InvoiceSummary } from '@/platform/agents/finance/context/finance-context-types';

describe('ReceivablesAgingService (Phase 12 Milestone 1)', () => {
  let service: ReceivablesAgingService;
  const orgId = 'org_test_school';
  const workspaceId = 'ws_primary';
  const entityId = 'ent_ghana_sec';
  const referenceDate = '2026-10-07T00:00:00Z'; // anchor date

  beforeEach(() => {
    service = new ReceivablesAgingService();
    service.clearCache();
  });

  it('correctly categorizes invoices across all 4 aging buckets', () => {
    const invoices: InvoiceSummary[] = [
      // Current: Due in 10 days (2026-10-17) -> daysPastDue = 0
      {
        id: 'inv_current',
        invoiceNumber: 'INV-2026-001',
        entityId,
        entityName: 'Ghana Secondary',
        periodName: 'Term 1',
        currency: 'GHS',
        totalPayable: 1000,
        amountPaid: 0,
        balanceDue: 1000,
        status: 'issued',
        lifecycleStatus: 'issued',
        paymentStatus: 'unpaid',
        dueDate: '2026-10-17T00:00:00Z',
        issuedAt: '2026-09-01T00:00:00Z',
        paidAt: null,
        itemsCount: 1,
        agreementNumber: null,
      },
      // Current: 20 days past due (2026-09-17) -> Bucket 0-30
      {
        id: 'inv_0_30',
        invoiceNumber: 'INV-2026-002',
        entityId,
        entityName: 'Ghana Secondary',
        periodName: 'Term 1',
        currency: 'GHS',
        totalPayable: 1500,
        amountPaid: 0,
        balanceDue: 1500,
        status: 'overdue',
        lifecycleStatus: 'issued',
        paymentStatus: 'unpaid',
        dueDate: '2026-09-17T00:00:00Z',
        issuedAt: '2026-08-01T00:00:00Z',
        paidAt: null,
        itemsCount: 1,
        agreementNumber: null,
      },
      // Warning: 45 days past due (2026-08-23) -> Bucket 31-60
      {
        id: 'inv_31_60',
        invoiceNumber: 'INV-2026-003',
        entityId,
        entityName: 'Ghana Secondary',
        periodName: 'Term 1',
        currency: 'GHS',
        totalPayable: 2000,
        amountPaid: 500,
        balanceDue: 1500,
        status: 'partially_paid',
        lifecycleStatus: 'issued',
        paymentStatus: 'partially_paid',
        dueDate: '2026-08-23T00:00:00Z',
        issuedAt: '2026-07-01T00:00:00Z',
        paidAt: null,
        itemsCount: 1,
        agreementNumber: null,
      },
      // Critical: 75 days past due (2026-07-24) -> Bucket 61-90
      {
        id: 'inv_61_90',
        invoiceNumber: 'INV-2026-004',
        entityId,
        entityName: 'Ghana Secondary',
        periodName: 'Term 1',
        currency: 'GHS',
        totalPayable: 3000,
        amountPaid: 0,
        balanceDue: 3000,
        status: 'overdue',
        lifecycleStatus: 'issued',
        paymentStatus: 'unpaid',
        dueDate: '2026-07-24T00:00:00Z',
        issuedAt: '2026-06-01T00:00:00Z',
        paidAt: null,
        itemsCount: 1,
        agreementNumber: null,
      },
      // Default: 120 days past due (2026-06-09) -> Bucket >90
      {
        id: 'inv_90_plus',
        invoiceNumber: 'INV-2026-005',
        entityId,
        entityName: 'Ghana Secondary',
        periodName: 'Term 1',
        currency: 'GHS',
        totalPayable: 4000,
        amountPaid: 0,
        balanceDue: 4000,
        status: 'overdue',
        lifecycleStatus: 'issued',
        paymentStatus: 'unpaid',
        dueDate: '2026-06-09T00:00:00Z',
        issuedAt: '2026-05-01T00:00:00Z',
        paidAt: null,
        itemsCount: 1,
        agreementNumber: null,
      },
      // Fully paid invoice (should be excluded from aging balance)
      {
        id: 'inv_paid',
        invoiceNumber: 'INV-2026-006',
        entityId,
        entityName: 'Ghana Secondary',
        periodName: 'Term 1',
        currency: 'GHS',
        totalPayable: 5000,
        amountPaid: 5000,
        balanceDue: 0,
        status: 'paid',
        lifecycleStatus: 'issued',
        paymentStatus: 'paid',
        dueDate: '2026-05-01T00:00:00Z',
        issuedAt: '2026-04-01T00:00:00Z',
        paidAt: '2026-05-01T00:00:00Z',
        itemsCount: 1,
        agreementNumber: null,
      },
    ];

    const aging = service.calculateAging({
      organizationId: orgId,
      workspaceId,
      entityId,
      invoices,
      asOfDate: referenceDate,
    });

    expect(aging.current0To30).toBe(2500); // 1000 + 1500
    expect(aging.warning31To60).toBe(1500);
    expect(aging.critical61To90).toBe(3000);
    expect(aging.defaultOver90).toBe(4000);
    expect(aging.totalOutstanding).toBe(11000);
    expect(aging.totalOverdue).toBe(10000);
    expect(aging.debtRiskBand).toBe('CRITICAL'); // defaultOver90 > 0
    expect(aging.oldestInvoiceDueDate).toBe('2026-06-09T00:00:00Z');
  });

  it('assigns LOW risk band when all open invoices are current', () => {
    const invoices: InvoiceSummary[] = [
      {
        id: 'inv_current',
        invoiceNumber: 'INV-2026-001',
        entityId,
        entityName: 'Ghana Secondary',
        periodName: 'Term 1',
        currency: 'GHS',
        totalPayable: 2000,
        amountPaid: 0,
        balanceDue: 2000,
        status: 'issued',
        lifecycleStatus: 'issued',
        paymentStatus: 'unpaid',
        dueDate: '2026-10-25T00:00:00Z', // in the future
        issuedAt: '2026-09-01T00:00:00Z',
        paidAt: null,
        itemsCount: 1,
        agreementNumber: null,
      },
    ];

    const aging = service.calculateAging({
      organizationId: orgId,
      workspaceId,
      entityId,
      invoices,
      asOfDate: referenceDate,
    });

    expect(aging.debtRiskBand).toBe('LOW');
    expect(aging.totalOverdue).toBe(0);
    expect(aging.current0To30).toBe(2000);
  });

  it('caches aging report with partitioned key and handles invalidation (Rule 50)', async () => {
    const invoices: InvoiceSummary[] = [
      {
        id: 'inv_1',
        invoiceNumber: 'INV-2026-001',
        entityId,
        entityName: 'Ghana Secondary',
        periodName: 'Term 1',
        currency: 'GHS',
        totalPayable: 3000,
        amountPaid: 0,
        balanceDue: 3000,
        status: 'issued',
        lifecycleStatus: 'issued',
        paymentStatus: 'unpaid',
        dueDate: '2026-10-15T00:00:00Z',
        issuedAt: '2026-09-01T00:00:00Z',
        paidAt: null,
        itemsCount: 1,
        agreementNumber: null,
      },
    ];

    const aging1 = await service.getAgingWithCache({
      organizationId: orgId,
      workspaceId,
      entityId,
      invoices,
      asOfDate: referenceDate,
    });
    expect(aging1.totalOverdue).toBe(5000);

    // Mutate invoices list
    const invoicesModified: InvoiceSummary[] = [];

    // Second call without invalidation should return cached aging
    const aging2 = await service.getAgingWithCache({
      organizationId: orgId,
      workspaceId,
      entityId,
      invoices: invoicesModified,
      asOfDate: referenceDate,
    });
    expect(aging2.totalOutstanding).toBe(3000);

    // Invalidate cache
    service.invalidateCache(orgId, workspaceId, entityId);

    // Third call after invalidation reflects modified list
    const aging3 = await service.getAgingWithCache({
      organizationId: orgId,
      workspaceId,
      entityId,
      invoices: invoicesModified,
      asOfDate: referenceDate,
    });
    expect(aging3.totalOutstanding).toBe(0);
  });

  it('provides singleton instance via getReceivablesAgingService()', () => {
    const instance1 = getReceivablesAgingService();
    const instance2 = getReceivablesAgingService();
    expect(instance1).toBe(instance2);
  });
});

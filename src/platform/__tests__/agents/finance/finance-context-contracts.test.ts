/**
 * @fileOverview Unit & Contract Tests: Finance Context Types & Error Taxonomy (Phase 12 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  AccountFinanceSummarySchema,
  InvoiceSummarySchema,
  PaymentSummarySchema,
  ReceivablesAgingSchema,
  CollectionCaseSchema,
  FeeScheduleSchema,
  FINANCE_ERROR_CODES,
  FinanceError,
} from '@/platform/agents/finance/context/finance-context-types';

describe('Finance Context Contracts & Error Taxonomy (Phase 12 Milestone 1)', () => {
  it('validates a complete AccountFinanceSummarySchema payload', () => {
    const valid = {
      accountId: 'fa_acc_123',
      entityId: 'ent_gis_accra',
      workspaceId: 'ws_primary',
      organizationId: 'org_ghana_education',
      currency: 'GHS',
      totalInvoiced: 45000.5,
      totalPaid: 32000.0,
      totalOutstanding: 13000.5,
      availableCredit: 500.0,
      overdueAmount: 5000.0,
      unallocatedPayments: 0,
      paymentPlanActive: true,
      lastPaymentDate: '2026-09-15T10:00:00Z',
      lastInvoiceDate: '2026-09-01T08:00:00Z',
    };

    const parsed = AccountFinanceSummarySchema.parse(valid);
    expect(parsed.totalOutstanding).toBe(13000.5);
    expect(parsed.currency).toBe('GHS');
    expect(parsed.paymentPlanActive).toBe(true);
  });

  it('validates an InvoiceSummarySchema payload with enum status', () => {
    const valid = {
      id: 'inv_2026_001',
      invoiceNumber: 'INV-2026-000142',
      entityId: 'ent_gis_accra',
      entityName: 'Ghana International School',
      periodName: 'Term 1 2026/2027',
      currency: 'GHS',
      totalPayable: 25000.0,
      amountPaid: 10000.0,
      balanceDue: 15000.0,
      status: 'partially_paid',
      lifecycleStatus: 'issued',
      paymentStatus: 'partially_paid',
      dueDate: '2026-10-15T00:00:00Z',
      issuedAt: '2026-09-01T08:00:00Z',
      paidAt: null,
      itemsCount: 3,
      agreementNumber: 'AGR-2026-000012',
    };

    const parsed = InvoiceSummarySchema.parse(valid);
    expect(parsed.status).toBe('partially_paid');
    expect(parsed.balanceDue).toBe(15000.0);
  });

  it('validates PaymentSummarySchema with paymentMethod enum', () => {
    const valid = {
      id: 'pay_99812',
      entityId: 'ent_gis_accra',
      accountId: 'fa_acc_123',
      amount: 10000.0,
      currency: 'GHS',
      paymentMethod: 'mobile_money',
      status: 'settled',
      receivedAt: '2026-09-15T12:00:00Z',
      allocatedAmount: 10000.0,
      unallocatedAmount: 0,
      reference: 'MTN-MOMO-882711',
      notes: 'Term 1 initial installment',
    };

    const parsed = PaymentSummarySchema.parse(valid);
    expect(parsed.paymentMethod).toBe('mobile_money');
    expect(parsed.amount).toBe(10000.0);
  });

  it('validates ReceivablesAgingSchema and debt risk bands', () => {
    const valid = {
      entityId: 'ent_gis_accra',
      workspaceId: 'ws_primary',
      organizationId: 'org_ghana_education',
      asOfDate: '2026-10-07T00:00:00Z',
      current0To30: 5000,
      warning31To60: 3000,
      critical61To90: 2000,
      defaultOver90: 1000,
      totalOverdue: 6000,
      totalOutstanding: 11000,
      oldestInvoiceDueDate: '2026-07-01T00:00:00Z',
      debtRiskBand: 'CRITICAL',
      invoiceCount: 4,
      overdueInvoiceCount: 3,
    };

    const parsed = ReceivablesAgingSchema.parse(valid);
    expect(parsed.debtRiskBand).toBe('CRITICAL');
    expect(parsed.totalOverdue).toBe(6000);
  });

  it('validates CollectionCaseSchema with promise to pay', () => {
    const valid = {
      caseId: 'case_4412',
      entityId: 'ent_gis_accra',
      workspaceId: 'ws_primary',
      organizationId: 'org_ghana_education',
      totalOverdue: 6000,
      agingBucket: '61_90',
      dunningStage: 'FINAL_NOTICE',
      promiseToPay: {
        amount: 6000,
        promiseDate: '2026-10-20T00:00:00Z',
        status: 'pending',
        notes: 'Bursar agreed to settle by 20th',
      },
      assignedAgentPersona: 'collections_agent',
      lastContactedAt: '2026-10-05T14:30:00Z',
      reminderCount: 2,
      notes: 'Direct phone follow-up with finance director',
    };

    const parsed = CollectionCaseSchema.parse(valid);
    expect(parsed.dunningStage).toBe('FINAL_NOTICE');
    expect(parsed.promiseToPay?.status).toBe('pending');
  });

  it('validates FeeScheduleSchema for schools', () => {
    const valid = {
      scheduleId: 'sched_2026_t1',
      entityId: 'ent_gis_accra',
      workspaceId: 'ws_primary',
      periodName: 'First Term 2026',
      nominalRoll: 850,
      ratePerStudent: 120,
      currency: 'GHS',
      subtotal: 102000,
      discount: 2000,
      vatAmount: 0,
      totalPayable: 100000,
      items: [
        {
          id: 'item_1',
          name: 'Primary Tuition',
          nominalRoll: 500,
          ratePerStudent: 100,
          subtotal: 50000,
          discount: 0,
          taxAmount: 0,
          total: 50000,
        },
      ],
    };

    const parsed = FeeScheduleSchema.parse(valid);
    expect(parsed.nominalRoll).toBe(850);
    expect(parsed.totalPayable).toBe(100000);
  });

  it('instantiates and serializes FinanceError with status code and context', () => {
    const err = new FinanceError(
      FINANCE_ERROR_CODES.INVOICE_ALREADY_ISSUED,
      409,
      'Invoice INV-2026-000142 is already issued.',
      { invoiceId: 'inv_123' }
    );

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FinanceError);
    expect(err.code).toBe('INVOICE_ALREADY_ISSUED');
    expect(err.statusCode).toBe(409);
    expect(err.context?.invoiceId).toBe('inv_123');
  });
});

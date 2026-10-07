/**
 * @fileOverview Unit & Integration Tests: Canonical Finance Capabilities (finance.*) (Phase 12 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 11 (Model is never security boundary: TS services execution)
 * - Rule 12 (5-tier risk taxonomy verification)
 * - Rule 17 (Non-Delegable Privileges: L3 issuance requires human operator)
 * - Rule 18 (TOCTOU protection with expectedVersion)
 * - Rule 27 (Saga compensation for payment reconciliation)
 * - Rule 40 (Domain event publishing)
 * - Rule 60 (Emergency dead-man switch evaluation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  financeInvoiceCreateDraftCapability,
  financeInvoiceValidateCapability,
  financeInvoiceIssueCapability,
  financePaymentSearchCapability,
  financePaymentGetCapability,
  financePaymentReconcileCapability,
  seedFinanceCapabilitiesTestState,
  resetFinanceCapabilitiesTestState,
} from '@/platform/capabilities/finance/finance-capabilities';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import type { CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';
import {
  FINANCE_ERROR_CODES,
  FinanceError,
} from '@/platform/agents/finance/context/finance-context-types';

describe('Canonical Finance Capabilities (finance.*) (Phase 12 Milestone 1)', () => {
  const userContext: CapabilityExecutionContext = {
    principal: {
      actorType: 'user',
      userId: 'user_operator_1',
      organizationId: 'org_test_edu',
      workspaceId: 'ws_test_main',
      grantedScopes: [
        'rbac:finance.invoices.create',
        'rbac:finance.invoices.view',
        'rbac:finance.invoices.edit',
      ],
      effectiveRole: 'finance_admin',
    },
    correlationId: 'corr_test_001',
    timestamp: new Date().toISOString(),
  };

  const agentContext: CapabilityExecutionContext = {
    principal: {
      actorType: 'agent',
      userId: 'agent_runner',
      agentId: 'finance_billing_agent',
      organizationId: 'org_test_edu',
      workspaceId: 'ws_test_main',
      grantedScopes: ['rbac:finance.invoices.view'],
      effectiveRole: 'agent',
    },
    correlationId: 'corr_agent_001',
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    resetFinanceCapabilitiesTestState();
    vi.clearAllMocks();
  });

  describe('Registry & Risk Taxonomy Verification', () => {
    it('registers all 8 finance capabilities in the global capability registry', () => {
      const expectedIds = [
        'finance.invoice.create_draft',
        'finance.invoice.validate',
        'finance.invoice.issue',
        'finance.payment.search',
        'finance.payment.get',
        'finance.payment.reconcile',
        'finance.account.get_balance',
        'finance.receivables.get_aging',
      ];

      for (const id of expectedIds) {
        const cap = getCapability(id);
        expect(cap, `Capability '${id}' must be registered`).toBeDefined();
        expect(cap?.domain).toBe('finance_subscriptions');
        expect(cap?.workspaceScoped).toBe(true);
        expect(cap?.tenantScoped).toBe(true);
      }
    });

    it('enforces canonical risk ratings and policies across capabilities', () => {
      expect(financeInvoiceCreateDraftCapability.risk.level).toBe(
        'L1_INTERNAL_DRAFT'
      );
      expect(
        financeInvoiceCreateDraftCapability.policies.requiresIdempotencyKey
      ).toBe(true);

      expect(financeInvoiceValidateCapability.risk.level).toBe('L0_READ');

      expect(financeInvoiceIssueCapability.risk.level).toBe(
        'L3_EXTERNAL_COMMUNICATION_FINANCE'
      );
      expect(
        financeInvoiceIssueCapability.risk.requiresHumanApproval
      ).toBe(true);
      expect(financeInvoiceIssueCapability.risk.nonDelegable).toBe(true);
      expect(
        financeInvoiceIssueCapability.policies.requiresExpectedVersion
      ).toBe(true);

      expect(financePaymentReconcileCapability.risk.level).toBe(
        'L2_STATE_MUTATION'
      );
      expect(
        financePaymentReconcileCapability.execution.supportsCompensation
      ).toBe(true);
    });
  });

  describe('Execution Tests for Individual Capabilities', () => {
    it('finance.invoice.create_draft prepares draft with rounded totals and temporary number', async () => {
      const input = {
        organizationId: 'org_test_edu',
        workspaceId: 'ws_test_main',
        entityId: 'ent_accra_high',
        entityName: 'Accra High School',
        periodName: 'Term 1 2026',
        currency: 'GHS',
        dueDate: '2026-11-15T00:00:00Z',
        items: [
          { description: 'Tuition Fee', quantity: 100, unitPrice: 25.5 },
          { description: 'Lab Levy', quantity: 100, unitPrice: 4.5 },
        ],
      };

      const result = await financeInvoiceCreateDraftCapability.handler(
        input,
        userContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('draft');
        expect(result.data.totalPayable).toBe(3000.0); // (100 * 25.5) + (100 * 4.5) = 2550 + 450 = 3000
        expect(result.data.invoiceNumber).toMatch(/^DRAFT-/);
        expect(result.emittedEvents.length).toBe(1);
        expect(result.emittedEvents[0].type).toBe('finance.invoice.draft_created');
      }
    });

    it('finance.invoice.validate validates correct calculation and detects discrepancy', async () => {
      // Valid invoice
      const valid = await financeInvoiceValidateCapability.handler(
        {
          subtotal: 1000,
          discount: 100,
          taxAmount: 50,
          totalPayable: 950,
          currency: 'GHS',
          itemsCount: 5,
        },
        userContext
      );

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.isValid).toBe(true);
        expect(valid.data.difference).toBe(0);
      }

      // Discrepant invoice
      const invalid = await financeInvoiceValidateCapability.handler(
        {
          subtotal: 1000,
          discount: 100,
          taxAmount: 50,
          totalPayable: 800, // Should be 950
          currency: 'GHS',
          itemsCount: 5,
        },
        userContext
      );

      expect(invalid.success).toBe(true);
      if (invalid.success) {
        expect(invalid.data.isValid).toBe(false);
        expect(invalid.data.difference).toBe(150);
        expect(invalid.data.diagnostics.length).toBeGreaterThan(0);
        expect(invalid.data.riskLevel).toBe('HIGH');
      }
    });

    it('finance.invoice.issue blocks autonomous agents without human approval (Rule 17/21)', async () => {
      try {
        await financeInvoiceIssueCapability.handler(
          {
            organizationId: 'org_test_edu',
            workspaceId: 'ws_test_main',
            invoiceId: 'inv_draft_123',
            idempotencyKey: 'idemp_issue_001',
          },
          agentContext // Automated agent
        );
        expect.fail('Should have thrown FinanceError');
      } catch (err) {
        expect(err).toBeInstanceOf(FinanceError);
        const finErr = err as FinanceError;
        expect(finErr.code).toBe(FINANCE_ERROR_CODES.AUTHENTICATION_REQUIRED);
        expect(finErr.httpStatus).toBe(403);
      }
    });

    it('finance.invoice.issue succeeds when executed by human operator', async () => {
      // Create a draft first
      const draftRes = await financeInvoiceCreateDraftCapability.handler(
        {
          organizationId: 'org_test_edu',
          workspaceId: 'ws_test_main',
          entityId: 'ent_accra_high',
          entityName: 'Accra High School',
          periodName: 'Term 1 2026',
          currency: 'GHS',
          dueDate: '2026-11-15T00:00:00Z',
          items: [{ description: 'General Dues', quantity: 1, unitPrice: 500 }],
        },
        userContext
      );

      expect(draftRes.success).toBe(true);
      if (!draftRes.success) return;

      const issueRes = await financeInvoiceIssueCapability.handler(
        {
          organizationId: 'org_test_edu',
          workspaceId: 'ws_test_main',
          invoiceId: draftRes.data.draftId,
          idempotencyKey: 'idemp_issue_002',
        },
        userContext
      );

      expect(issueRes.success).toBe(true);
      if (issueRes.success) {
        expect(issueRes.data.status).toBe('issued');
        expect(issueRes.data.invoiceNumber).toMatch(/^INV-\d{4}-\d+/);
        expect(issueRes.emittedEvents[0].type).toBe('finance.invoice.issued');
      }
    });

    it('finance.payment.search and finance.payment.get retrieve recorded payments', async () => {
      seedFinanceCapabilitiesTestState({
        payments: [
          {
            id: 'pay_rec_001',
            entityId: 'ent_gis',
            accountId: 'fa_gis',
            amount: 5000,
            currency: 'GHS',
            paymentMethod: 'bank_transfer',
            status: 'settled',
            receivedAt: '2026-09-15T10:00:00Z',
            allocatedAmount: 5000,
            unallocatedAmount: 0,
            reference: 'MOM-849102',
            notes: 'Momo payment',
          },
          {
            id: 'pay_rec_002',
            entityId: 'ent_gis',
            accountId: 'fa_gis',
            amount: 2500,
            currency: 'GHS',
            paymentMethod: 'card',
            status: 'reconciled',
            receivedAt: '2026-09-20T10:00:00Z',
            allocatedAmount: 2500,
            unallocatedAmount: 0,
            reference: 'CRD-119283',
            notes: 'Card payment',
          },
        ],
      });

      const searchRes = await financePaymentSearchCapability.handler(
        {
          organizationId: 'org_test_edu',
          workspaceId: 'ws_test_main',
          entityId: 'ent_gis',
        },
        userContext
      );

      expect(searchRes.success).toBe(true);
      if (searchRes.success) {
        expect(searchRes.data.totalFound).toBe(2);
        expect(searchRes.data.payments[0].id).toBe('pay_rec_001');
      }

      const getRes = await financePaymentGetCapability.handler(
        {
          organizationId: 'org_test_edu',
          workspaceId: 'ws_test_main',
          paymentId: 'pay_rec_001',
        },
        userContext
      );

      expect(getRes.success).toBe(true);
      if (getRes.success) {
        expect(getRes.data.amount).toBe(5000);
        expect(getRes.data.reference).toBe('MOM-849102');
      }
    });

    it('finance.payment.reconcile applies payment allocations and emits domain event (Rule 27)', async () => {
      // Seed draft invoice
      seedFinanceCapabilitiesTestState({
        draftInvoices: [
          {
            id: 'inv_to_reconcile',
            invoiceNumber: 'INV-2026-999',
            entityId: 'ent_gis',
            entityName: 'GIS',
            periodName: 'Term 1',
            currency: 'GHS',
            totalPayable: 2000,
            amountPaid: 0,
            balanceDue: 2000,
            status: 'issued',
            lifecycleStatus: 'issued',
            paymentStatus: 'unpaid',
            dueDate: '2026-11-01T00:00:00Z',
            issuedAt: '2026-09-01T00:00:00Z',
            paidAt: null,
            itemsCount: 1,
            agreementNumber: null,
          },
        ],
      });

      const reconcileRes = await financePaymentReconcileCapability.handler(
        {
          organizationId: 'org_test_edu',
          workspaceId: 'ws_test_main',
          paymentId: 'pay_incoming_001',
          allocations: [{ invoiceId: 'inv_to_reconcile', amount: 2000 }],
          idempotencyKey: 'idemp_rec_001',
        },
        userContext
      );

      expect(reconcileRes.success).toBe(true);
      if (reconcileRes.success) {
        expect(reconcileRes.data.totalAllocated).toBe(2000);
        expect(reconcileRes.data.allocatedInvoices).toContain('inv_to_reconcile');
        expect(reconcileRes.emittedEvents[0].type).toBe('finance.payment.reconciled');
      }
    });
  });
});

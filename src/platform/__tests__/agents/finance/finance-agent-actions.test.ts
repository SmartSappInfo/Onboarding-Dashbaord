/**
 * @fileOverview Unit & Integration Tests: Finance Agent Server Actions (Phase 12 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 48 (Structured Errors & Sanitized Output)
 * - Rule 51 (Next.js 15 Server Actions Conventions)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAccountFinanceContextAction,
  getReceivablesAgingAction,
  createInvoiceDraftAction,
  validateInvoiceAction,
  searchPaymentsAction,
} from '@/app/actions/finance-agent-actions';
import { FINANCE_ERROR_CODES } from '@/platform/agents/finance/context/finance-context-types';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/policy/governance-dead-man')>();
  return {
    ...actual,
    checkGovernanceDeadManSwitch: vi.fn(),
  };
});

describe('Finance Agent Server Actions (Phase 12 Milestone 1)', () => {
  const defaultOrgId = 'org_finance_test';
  const defaultWsId = 'ws_finance_main';
  const defaultEntityId = 'ent_accra_academy';

  beforeEach(async () => {
    vi.clearAllMocks();

    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockImplementation(async () => ({
      uid: 'user_fin_admin_1',
      profile: {
        id: 'user_fin_admin_1',
        name: 'Finance Officer',
        email: 'finance@smartsapp.com',
        role: 'finance_admin',
        organizationId: defaultOrgId,
        lastActiveWorkspaceId: defaultWsId,
        workspaceIds: [defaultWsId],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isSystemAdmin: false,
    }));

    const { checkGovernanceDeadManSwitch, AgentGovernanceEmergencyPausedError } = await import(
      '@/platform/policy/governance-dead-man'
    );
    vi.mocked(checkGovernanceDeadManSwitch).mockImplementation(async (orgId?: string) => {
      if (orgId === 'org_paused') {
        throw new AgentGovernanceEmergencyPausedError('Emergency maintenance active: FINANCE_DEAD_MAN_PAUSED');
      }
    });
  });

  describe('getAccountFinanceContextAction', () => {
    it('successfully retrieves assembled 360° financial context with valid session', async () => {
      const result = await getAccountFinanceContextAction({
        organizationId: defaultOrgId,
        workspaceId: defaultWsId,
        entityId: defaultEntityId,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.metadata.organizationId).toBe(defaultOrgId);
      expect(result.data?.metadata.entityId).toBe(defaultEntityId);
      expect(result.data?.aging).toBeDefined();
    });

    it('rejects cross-tenant IDOR access when requested org does not match session (Rule 8/47)', async () => {
      const result = await getAccountFinanceContextAction({
        organizationId: 'org_malicious_attacker',
        workspaceId: defaultWsId,
        entityId: defaultEntityId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(FINANCE_ERROR_CODES.IDOR_VIOLATION);
      expect(result.error?.message).toContain('IDOR_VIOLATION');
    });

    it('fails closed when emergency dead-man switch is engaged (Rule 60)', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockImplementationOnce(async () => ({
        uid: 'user_paused_tenant',
        profile: {
          id: 'user_paused_tenant',
          name: 'Paused User',
          email: 'paused@smartsapp.com',
          role: 'admin',
          organizationId: 'org_paused',
          lastActiveWorkspaceId: defaultWsId,
          workspaceIds: [defaultWsId],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      }));

      const result = await getAccountFinanceContextAction({
        organizationId: 'org_paused',
        workspaceId: defaultWsId,
        entityId: defaultEntityId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(FINANCE_ERROR_CODES.FINANCE_DEAD_MAN_PAUSED);
    });
  });

  describe('getReceivablesAgingAction', () => {
    it('computes and returns receivables aging analysis', async () => {
      const result = await getReceivablesAgingAction({
        organizationId: defaultOrgId,
        workspaceId: defaultWsId,
        entityId: defaultEntityId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.entityId).toBe(defaultEntityId);
      expect(result.data?.debtRiskBand).toBeDefined();
    });
  });

  describe('createInvoiceDraftAction', () => {
    it('creates an unissued draft invoice with calculated line items', async () => {
      const result = await createInvoiceDraftAction({
        organizationId: defaultOrgId,
        workspaceId: defaultWsId,
        entityId: defaultEntityId,
        entityName: 'Accra Academy',
        periodName: 'Term 1 2026',
        currency: 'GHS',
        dueDate: '2026-11-01T00:00:00Z',
        items: [
          { description: 'Tuition Fee', quantity: 50, unitPrice: 20 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('draft');
      expect(result.data?.totalPayable).toBe(1000);
      expect(result.data?.invoiceNumber).toMatch(/^DRAFT-/);
    });
  });

  describe('validateInvoiceAction', () => {
    it('performs mathematical and fiscal validation', async () => {
      const result = await validateInvoiceAction({
        subtotal: 1000,
        discount: 50,
        taxAmount: 75,
        totalPayable: 1025,
        currency: 'GHS',
        itemsCount: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data?.isValid).toBe(true);
      expect(result.data?.calculatedTotal).toBe(1025);
    });
  });

  describe('searchPaymentsAction', () => {
    it('searches payments matching tenant criteria', async () => {
      const result = await searchPaymentsAction({
        organizationId: defaultOrgId,
        workspaceId: defaultWsId,
        entityId: defaultEntityId,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.payments)).toBe(true);
    });
  });
});

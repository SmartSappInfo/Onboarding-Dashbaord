/**
 * @fileOverview Unit tests for Finance Emergency Control Server Actions (Phase 12 Milestone 5)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 51 (Secure Next.js 15 Server Actions)
 * - Rule 60 (Emergency dead-man switch evaluation)
 * - Rule 61 (Mandatory audit justification >= 5 characters)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getFinanceEmergencyControlsAction,
  toggleFinanceEmergencySwitchAction,
} from '@/app/actions/finance-control-actions';
import * as authModule from '@/lib/auth/require-auth';
import { setFinanceEmergencyControlsForTests } from '@/platform/policy/finance-control-policy';

describe('Finance Emergency Control Server Actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setFinanceEmergencyControlsForTests(null);

    // Default authenticated admin session
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
      uid: 'user_admin_001',
      orgId: 'org_test_01',
      isSystemAdmin: true,
      profile: {
        id: 'user_admin_001',
        organizationId: 'org_test_01',
        lastActiveWorkspaceId: 'ws_test_01',
      } as unknown as authModule.AuthContext['profile'],
    } as authModule.AuthContext);
  });

  describe('Authentication & Auth Guards (Rule 51)', () => {
    it('returns error when requireAuth throws unauthorized', async () => {
      vi.spyOn(authModule, 'requireAuth').mockRejectedValue(
        new Error('Unauthorized request.')
      );

      const result = await getFinanceEmergencyControlsAction();

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unauthorized request.');
    });

    it('retrieves current control status for authenticated user', async () => {
      const result = await getFinanceEmergencyControlsAction();

      expect(result.success).toBe(true);
      expect(result.data?.switches.agent_finance_paused).toBe(false);
      expect(result.data?.switches.agent_collections_paused).toBe(false);
      expect(result.data?.switches.agent_school_ops_paused).toBe(false);
      expect(result.data?.switches.financial_mutation_halt).toBe(false);
    });
  });

  describe('Switch Toggle Validation & Audit (Rules 60 & 61)', () => {
    it('rejects toggle if reason is shorter than 5 characters', async () => {
      const result = await toggleFinanceEmergencySwitchAction({
        switchKey: 'agent_collections_paused',
        enabled: true,
        reason: 'stop', // 4 chars < 5
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Audit justification note must be at least 5 characters');
    });

    it('successfully toggles switch and returns updated state', async () => {
      const result = await toggleFinanceEmergencySwitchAction({
        switchKey: 'agent_collections_paused',
        enabled: true,
        reason: 'Investigating payment gateway duplicate callback incident.',
      });

      expect(result.success).toBe(true);
      expect(result.data?.switches.agent_collections_paused).toBe(true);
      expect(result.data?.updatedBy).toBe('user_admin_001');
      expect(result.data?.pauseReason).toBe('Investigating payment gateway duplicate callback incident.');
    });
  });
});

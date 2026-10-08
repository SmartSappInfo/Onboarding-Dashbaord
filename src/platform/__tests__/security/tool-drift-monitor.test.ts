/**
 * @fileOverview Unit & Integration Tests for Cryptographic Tool Definition Drift & Rug-Pull Monitor (Phase 15 Milestone 3)
 *
 * Implements Rules 1, 4, 8, 14, 16, 17, 19, 22, 40, 48, 60, 67, 68, 69, 1974.
 * Validates 8-dimension SHA-256 fingerprinting, automated execution locking on drift,
 * and strictly non-delegable human approval gating.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ToolDriftMonitor,
  getToolDriftMonitor,
} from '@/platform/security/drift/tool-drift-monitor';
import {
  SecurityDomainError,
} from '@/platform/security/contracts/security-types';
import { defaultEventBus } from '@/platform/events/event-bus';

describe('Phase 15 Milestone 3: ToolDriftMonitor (Rule 14 & 1974)', () => {
  let monitor: ToolDriftMonitor;

  beforeEach(() => {
    monitor = new ToolDriftMonitor();
  });

  const baseToolParams = {
    toolId: 'tool_send_invoice',
    serverId: 'mcp_finance_server',
    serverVersion: '1.2.0',
    toolVersion: '1.0.0',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['invoiceId', 'amount'],
    },
    description: 'Sends an approved invoice to a customer email address.',
    permissions: ['finance:invoice:send'],
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: false,
      idempotent: true,
      requiresHumanApproval: true,
      nonDelegable: false,
    },
  };

  it('should deterministically generate composite SHA-256 tool fingerprint', () => {
    const f1 = monitor.computeFingerprint(baseToolParams);
    const f2 = monitor.computeFingerprint(baseToolParams);

    expect(f1.compositeFingerprint).toHaveLength(64);
    expect(f1.compositeFingerprint).toBe(f2.compositeFingerprint);
    expect(f1.schemaHash).toHaveLength(64);
    expect(f1.descriptionHash).toHaveLength(64);
    expect(f1.permissionHash).toHaveLength(64);
    expect(f1.riskHash).toHaveLength(64);
  });

  it('should register approved baseline and verify that live matching definition is permitted', async () => {
    const baseline = monitor.registerApprovedBaseline({
      ...baseToolParams,
      approvedBy: 'user_admin_001',
      organizationId: 'org_test_sec',
      workspaceId: 'ws_test_sec',
    });

    expect(baseline.status).toBe('APPROVED');

    const verification = await monitor.verifyToolFingerprint(
      'tool_send_invoice',
      baseToolParams,
      { organizationId: 'org_test_sec', workspaceId: 'ws_test_sec' }
    );

    expect(verification.hasDrift).toBe(false);
    expect(verification.status).toBe('APPROVED');
    expect(verification.isExecutionPermitted).toBe(true);
  });

  it('should detect schema mutation (rug-pull), lock tool execution, and emit domain event (Rule 14 & 40)', async () => {
    const emitSpy = vi.spyOn(defaultEventBus, 'publish');

    monitor.registerApprovedBaseline({
      ...baseToolParams,
      approvedBy: 'user_admin_001',
      organizationId: 'org_test_sec',
    });

    // Mutate live definition (e.g. injected bankAccount field - rug-pull!)
    const tamperedParams = {
      ...baseToolParams,
      inputSchema: {
        ...baseToolParams.inputSchema,
        properties: {
          ...baseToolParams.inputSchema.properties,
          attackerRoutingNumber: { type: 'string' },
        },
      },
    };

    const verification = await monitor.verifyToolFingerprint(
      'tool_send_invoice',
      tamperedParams,
      { organizationId: 'org_test_sec' }
    );

    expect(verification.hasDrift).toBe(true);
    expect(verification.status).toBe('LOCKED');
    expect(verification.isExecutionPermitted).toBe(false);

    // Verify assertExecutionPermitted throws 409
    await expect(
      monitor.assertExecutionPermitted('tool_send_invoice', tamperedParams, {
        organizationId: 'org_test_sec',
      })
    ).rejects.toThrow(SecurityDomainError);

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'security.drift.detected',
      })
    );

    emitSpy.mockRestore();
  });

  it('should reject agent attempts to re-approve drifted baseline (Rule 17 Non-Delegable)', async () => {
    monitor.registerApprovedBaseline({
      ...baseToolParams,
      approvedBy: 'user_admin_001',
      organizationId: 'org_test_sec',
    });

    const tamperedParams = {
      ...baseToolParams,
      description: 'Tampered description with unauthorized instructions',
    };

    // Subagent or autonomous persona attempts to re-approve the drifted tool
    await expect(
      monitor.approveToolFingerprint({
        toolId: 'tool_send_invoice',
        definition: tamperedParams,
        actor: { type: 'agent', id: 'billing_analyst' },
        organizationId: 'org_test_sec',
      })
    ).rejects.toMatchObject({
      code: 'SECURITY_UNAUTHORIZED_APPROVAL',
      httpStatus: 403,
    });
  });

  it('should allow authenticated human administrator to re-approve baseline (Rule 17)', async () => {
    monitor.registerApprovedBaseline({
      ...baseToolParams,
      approvedBy: 'user_admin_001',
      organizationId: 'org_test_sec',
    });

    const upgradedParams = {
      ...baseToolParams,
      toolVersion: '1.1.0',
      description: 'Upgraded description approved by security officer.',
    };

    // Human administrator approves update
    const updatedRecord = await monitor.approveToolFingerprint({
      toolId: 'tool_send_invoice',
      definition: upgradedParams,
      actor: { type: 'user', id: 'user_admin_999' },
      organizationId: 'org_test_sec',
    });

    expect(updatedRecord.status).toBe('APPROVED');
    expect(updatedRecord.approvedBy).toBe('user_admin_999');

    // Live verification is now permitted
    const verification = await monitor.verifyToolFingerprint(
      'tool_send_invoice',
      upgradedParams,
      { organizationId: 'org_test_sec' }
    );

    expect(verification.hasDrift).toBe(false);
    expect(verification.status).toBe('APPROVED');
    expect(verification.isExecutionPermitted).toBe(true);
  });

  it('should support revoking tool fingerprint baseline (Rule 27 Rollback)', async () => {
    monitor.registerApprovedBaseline({
      ...baseToolParams,
      approvedBy: 'user_admin_001',
      organizationId: 'org_test_sec',
    });

    const revoked = await monitor.revokeToolFingerprint(
      'tool_send_invoice',
      { type: 'user', id: 'user_admin_001' },
      'org_test_sec'
    );

    expect(revoked.status).toBe('REVOKED');

    const verification = await monitor.verifyToolFingerprint(
      'tool_send_invoice',
      baseToolParams,
      { organizationId: 'org_test_sec' }
    );

    expect(verification.status).toBe('REVOKED');
    expect(verification.isExecutionPermitted).toBe(false);
  });

  it('should preserve singleton instance across calls', () => {
    const m1 = getToolDriftMonitor();
    const m2 = getToolDriftMonitor();
    expect(m1).toBe(m2);
  });
});

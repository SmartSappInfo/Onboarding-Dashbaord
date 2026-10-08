/**
 * @fileOverview Unit Tests for Backoffice Emergency Control Plane & Multi-Switch Dead-Man Controls.
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 11 (Deterministic state checks)
 * - Rule 60 (Emergency dead-man switch evaluation with 10s TTL cache)
 * - Rule 61 (Zero-redeploy operational kill-switches with mandatory audit reason >= 5 chars)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFinanceEmergencyControls,
  updateFinanceEmergencyControls,
  checkFinanceEmergencySwitch,
  setFinanceEmergencyControlsForTests,
  FinanceControlEmergencyPausedError,
} from '../../policy/finance-control-policy';

describe('Finance Emergency Control Policy & Multi-Switch Dead-Man Controls', () => {
  beforeEach(() => {
    setFinanceEmergencyControlsForTests(null);
  });

  it('defaults all 4 emergency kill switches to false (unpaused)', async () => {
    const controls = await getFinanceEmergencyControls();
    expect(controls.switches.agent_finance_paused).toBe(false);
    expect(controls.switches.agent_collections_paused).toBe(false);
    expect(controls.switches.agent_school_ops_paused).toBe(false);
    expect(controls.switches.financial_mutation_halt).toBe(false);
  });

  it('allows normal execution when switches are unpaused', async () => {
    await expect(checkFinanceEmergencySwitch('agent_finance_paused')).resolves.not.toThrow();
    await expect(checkFinanceEmergencySwitch('agent_collections_paused')).resolves.not.toThrow();
    await expect(checkFinanceEmergencySwitch('agent_school_ops_paused')).resolves.not.toThrow();
    await expect(checkFinanceEmergencySwitch('financial_mutation_halt')).resolves.not.toThrow();
  });

  it('fails closed when a specific emergency switch is engaged', async () => {
    setFinanceEmergencyControlsForTests({
      switches: {
        agent_finance_paused: false,
        agent_collections_paused: true,
        agent_school_ops_paused: false,
        financial_mutation_halt: false,
      },
    });

    // Unpaused switch passes
    await expect(checkFinanceEmergencySwitch('agent_finance_paused')).resolves.not.toThrow();

    // Paused switch throws FinanceControlEmergencyPausedError
    await expect(checkFinanceEmergencySwitch('agent_collections_paused')).rejects.toThrow(
      FinanceControlEmergencyPausedError
    );
  });

  it('fails closed on any mutation when financial_mutation_halt is engaged', async () => {
    setFinanceEmergencyControlsForTests({
      switches: {
        agent_finance_paused: false,
        agent_collections_paused: false,
        agent_school_ops_paused: false,
        financial_mutation_halt: true,
      },
    });

    await expect(checkFinanceEmergencySwitch('financial_mutation_halt')).rejects.toThrow(
      FinanceControlEmergencyPausedError
    );
  });

  it('rejects update when audit justification note is less than 5 characters', async () => {
    await expect(
      updateFinanceEmergencyControls({
        switchKey: 'agent_finance_paused',
        enabled: true,
        reason: 'bad', // < 5 chars
        adminUserId: 'admin_test',
      })
    ).rejects.toThrow(/Audit justification note must be at least 5 characters/);
  });

  it('updates emergency switch and invalidates in-memory cache upon valid toggle', async () => {
    const updated = await updateFinanceEmergencyControls({
      switchKey: 'agent_school_ops_paused',
      enabled: true,
      reason: 'Term break maintenance and student records re-indexing.',
      adminUserId: 'admin_007',
    });

    expect(updated.switches.agent_school_ops_paused).toBe(true);
    expect(updated.updatedBy).toBe('admin_007');
    expect(updated.pauseReason).toBe('Term break maintenance and student records re-indexing.');

    // Immediate check verifies switch is engaged
    await expect(checkFinanceEmergencySwitch('agent_school_ops_paused')).rejects.toThrow(
      FinanceControlEmergencyPausedError
    );
  });
});

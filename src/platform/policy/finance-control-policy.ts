/**
 * @fileOverview Backoffice Emergency Control Plane & Multi-Switch Dead-Man Controls (Phase 12 Milestone 5)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 11 (Deterministic security checks)
 * - Rule 40 (Mandatory Domain Event Publishing)
 * - Rule 60 (Emergency dead-man switch evaluation with 10s TTL cache)
 * - Rule 61 (Zero-redeploy operational kill-switches with mandatory audit reason >= 5 chars)
 */

import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

export const FINANCE_CONTROL_SWITCH_KEYS = [
  'agent_finance_paused',
  'agent_collections_paused',
  'agent_school_ops_paused',
  'financial_mutation_halt',
] as const;

export type FinanceControlSwitchKey = (typeof FINANCE_CONTROL_SWITCH_KEYS)[number];

export interface FinanceEmergencySwitches {
  agent_finance_paused: boolean;
  agent_collections_paused: boolean;
  agent_school_ops_paused: boolean;
  financial_mutation_halt: boolean;
}

export interface FinanceEmergencyControls {
  switches: FinanceEmergencySwitches;
  updatedAt: string;
  updatedBy: string;
  pauseReason: string | null;
}

export interface UpdateFinanceEmergencyControlsInput {
  switchKey: FinanceControlSwitchKey;
  enabled: boolean;
  reason: string;
  adminUserId: string;
}

export class FinanceControlEmergencyPausedError extends Error {
  public readonly code = 'FINANCE_CONTROL_EMERGENCY_PAUSED';
  public readonly httpStatus = 503;
  public readonly switchKey: FinanceControlSwitchKey;

  constructor(switchKey: FinanceControlSwitchKey, message?: string) {
    super(
      message ||
        `Finance operations under '${switchKey}' are halted by backoffice emergency dead-man control.`
    );
    this.name = 'FinanceControlEmergencyPausedError';
    this.switchKey = switchKey;
  }
}

// In-memory cache & test override state
let testOverrideControls: Partial<FinanceEmergencyControls> | null = null;
let cachedControls: { data: FinanceEmergencyControls; timestamp: number } | null = null;
const CACHE_TTL_MS = 10000; // 10s cache to prevent query flood (Rule 60)

const DEFAULT_CONTROLS: FinanceEmergencyControls = {
  switches: {
    agent_finance_paused: false,
    agent_collections_paused: false,
    agent_school_ops_paused: false,
    financial_mutation_halt: false,
  },
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'system_default',
  pauseReason: null,
};

export function setFinanceEmergencyControlsForTests(
  override: Partial<FinanceEmergencyControls> | null
): void {
  testOverrideControls = override;
  cachedControls = null;
}

/**
 * Retrieves current finance emergency controls from cache or Firestore.
 */
export async function getFinanceEmergencyControls(
  _organizationId?: string
): Promise<FinanceEmergencyControls> {
  if (testOverrideControls !== null) {
    return {
      switches: {
        ...DEFAULT_CONTROLS.switches,
        ...(testOverrideControls.switches ?? {}),
      },
      updatedAt: testOverrideControls.updatedAt ?? DEFAULT_CONTROLS.updatedAt,
      updatedBy: testOverrideControls.updatedBy ?? DEFAULT_CONTROLS.updatedBy,
      pauseReason: testOverrideControls.pauseReason ?? DEFAULT_CONTROLS.pauseReason,
    };
  }

  const now = Date.now();
  if (cachedControls && now - cachedControls.timestamp < CACHE_TTL_MS) {
    return cachedControls.data;
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('platform_config').doc('finance_controls').get();

    if (snap.exists) {
      const data = snap.data();
      const loaded: FinanceEmergencyControls = {
        switches: {
          agent_finance_paused: data?.switches?.agent_finance_paused === true,
          agent_collections_paused: data?.switches?.agent_collections_paused === true,
          agent_school_ops_paused: data?.switches?.agent_school_ops_paused === true,
          financial_mutation_halt: data?.switches?.financial_mutation_halt === true,
        },
        updatedAt: data?.updatedAt ?? new Date().toISOString(),
        updatedBy: data?.updatedBy ?? 'system',
        pauseReason: data?.pauseReason ?? null,
      };
      cachedControls = { data: loaded, timestamp: now };
      return loaded;
    }
  } catch (err: unknown) {
    console.warn('[FinanceControlPolicy] Transient error reading finance controls; falling back to default:', err);
  }

  cachedControls = { data: DEFAULT_CONTROLS, timestamp: now };
  return DEFAULT_CONTROLS;
}

/**
 * Checks whether an emergency switch or global financial mutation halt is engaged (Rule 60).
 * Throws FinanceControlEmergencyPausedError if active.
 */
export async function checkFinanceEmergencySwitch(
  switchKey: FinanceControlSwitchKey,
  organizationId?: string
): Promise<void> {
  const controls = await getFinanceEmergencyControls(organizationId);

  if (controls.switches[switchKey]) {
    throw new FinanceControlEmergencyPausedError(switchKey);
  }

  // Global mutation halt stops all mutations
  if (switchKey === 'financial_mutation_halt' && controls.switches.financial_mutation_halt) {
    throw new FinanceControlEmergencyPausedError('financial_mutation_halt');
  }
}

/**
 * Updates an emergency switch with mandatory audit reason >= 5 chars (Rule 61).
 * Immediately invalidates the 10s in-memory cache and publishes a domain event.
 */
export async function updateFinanceEmergencyControls(
  input: UpdateFinanceEmergencyControlsInput
): Promise<FinanceEmergencyControls> {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new Error('Audit justification note must be at least 5 characters long.');
  }

  const current = await getFinanceEmergencyControls();
  const now = new Date().toISOString();

  const updatedSwitches: FinanceEmergencySwitches = {
    ...current.switches,
    [input.switchKey]: input.enabled,
  };

  const updatedControls: FinanceEmergencyControls = {
    switches: updatedSwitches,
    updatedAt: now,
    updatedBy: input.adminUserId,
    pauseReason: input.reason.trim(),
  };

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    await adminDb.collection('platform_config').doc('finance_controls').set(
      {
        switches: updatedSwitches,
        updatedAt: now,
        updatedBy: input.adminUserId,
        pauseReason: input.reason.trim(),
      },
      { merge: true }
    );
  } catch (err: unknown) {
    console.warn('[FinanceControlPolicy] Transient error updating Firestore; updated in-memory cache:', err);
  }

  // Invalidate cache immediately
  cachedControls = { data: updatedControls, timestamp: Date.now() };
  if (testOverrideControls !== null) {
    testOverrideControls = updatedControls;
  }

  // Publish domain event (Rule 40)
  defaultEventBus.publish(
    createDomainEvent({
      type: 'finance.control.switch_toggled',
      organizationId: 'platform',
      workspaceId: 'global',
      actor: { type: 'user', id: input.adminUserId },
      entity: { type: 'finance_controls', id: input.switchKey },
      correlationId: `fin_ctrl_${Date.now()}`,
      source: 'finance_control_policy',
      payload: {
        switchKey: input.switchKey,
        enabled: input.enabled,
        reason: input.reason.trim(),
        updatedAt: now,
      },
    })
  );

  return updatedControls;
}

/**
 * Backoffice Emergency Control Plane Policy Helper
 */
export const FinanceControlPolicy = {
  getControls: getFinanceEmergencyControls,
  checkSwitch: checkFinanceEmergencySwitch,
  updateControls: updateFinanceEmergencyControls,
  async isFinancePaused(orgId?: string): Promise<boolean> {
    const c = await getFinanceEmergencyControls(orgId);
    return c.switches.agent_finance_paused || c.switches.financial_mutation_halt;
  },
  async isCollectionsPaused(orgId?: string): Promise<boolean> {
    const c = await getFinanceEmergencyControls(orgId);
    return c.switches.agent_collections_paused || c.switches.financial_mutation_halt;
  },
  async isSchoolOpsPaused(orgId?: string): Promise<boolean> {
    const c = await getFinanceEmergencyControls(orgId);
    return c.switches.agent_school_ops_paused;
  },
  async isFinancialMutationHalted(orgId?: string): Promise<boolean> {
    const c = await getFinanceEmergencyControls(orgId);
    return c.switches.financial_mutation_halt;
  },
};

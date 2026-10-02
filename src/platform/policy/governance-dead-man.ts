/**
 * @fileOverview Agent Governance Emergency Dead-Man Controls (Phase 3 Milestone 3 & 4)
 *
 * Implements Rule 60 (Emergency Dead-Man Controls) and Rule 61 (Backoffice Control Plane).
 *
 * Provides a zero-redeploy operational kill-switch stored in Firestore `system_settings/agent_governance`.
 * Allows backoffice administrators to immediately halt all background agent processing and approval
 * consumption across the platform during active incidents or downstream outages.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

export class AgentGovernanceEmergencyPausedError extends Error {
  public readonly code = 'AGENT_GOVERNANCE_EMERGENCY_PAUSED';

  constructor(message = 'Agent autonomous execution and approval processing is paused by emergency dead-man control.') {
    super(message);
    this.name = 'AgentGovernanceEmergencyPausedError';
  }
}

// In-memory state for testing / cache
let testOverrideState: boolean | null = null;
let cachedStatus: { paused: boolean; timestamp: number } | null = null;
const CACHE_TTL_MS = 10000; // 10s cache to prevent query flood

export function setGovernanceDeadManStateForTests(paused: boolean | null): void {
  testOverrideState = paused;
  cachedStatus = null;
}

/**
 * Checks whether the Agent Governance dead-man switch has been engaged.
 * Throws AgentGovernanceEmergencyPausedError if emergency halt is active.
 */
export async function checkGovernanceDeadManSwitch(_organizationId?: string): Promise<void> {
  if (testOverrideState !== null) {
    if (testOverrideState) {
      throw new AgentGovernanceEmergencyPausedError();
    }
    return;
  }

  const now = Date.now();
  if (cachedStatus && now - cachedStatus.timestamp < CACHE_TTL_MS) {
    if (cachedStatus.paused) {
      throw new AgentGovernanceEmergencyPausedError();
    }
    return;
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('system_settings').doc('agent_governance').get();

    const paused = snap.exists && snap.data()?.emergencyPause === true;
    cachedStatus = { paused, timestamp: now };

    if (paused) {
      throw new AgentGovernanceEmergencyPausedError();
    }
  } catch (err: unknown) {
    if (err instanceof AgentGovernanceEmergencyPausedError) {
      throw err;
    }
    // Fail-open for transient Firestore errors on settings, but log warning
    console.warn('[GovernanceDeadMan] Transient Firestore error checking dead-man switch; failing open:', err);
  }
}

/**
 * Updates the emergency pause status in Firestore and invalidates cache.
 */
export async function updateEmergencyPauseStatus(
  paused: boolean,
  reason?: string,
  adminUserId?: string
): Promise<void> {
  const { adminDb } = await import('@/lib/firebase-admin');
  const now = new Date().toISOString();

  await adminDb.collection('system_settings').doc('agent_governance').set(
    {
      emergencyPause: paused,
      updatedAt: now,
      updatedBy: adminUserId ?? 'system',
      pauseReason: reason ?? null,
    },
    { merge: true }
  );

  cachedStatus = { paused, timestamp: Date.now() };
  testOverrideState = null;
}

/**
 * @fileOverview Event Backbone Emergency Dead-Man Controls (Milestone 1)
 *
 * Implements Rule 60 (Agent Dead-Man Controls) and Rule 61 (Backoffice Control Plane).
 *
 * Provides a zero-redeploy operational kill-switch stored in Firestore `system_settings/event_backbone`.
 * Allows backoffice administrators to immediately halt all background event processing across
 * the platform during active incidents or downstream outages.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 *
 * @testability Covered in `src/platform/__tests__/events/circuit-breaker.test.ts`.
 */

export class EventBackboneEmergencyDisabledError extends Error {
  public readonly code = 'EVENT_BACKBONE_EMERGENCY_DISABLED';

  constructor() {
    super('Event backbone background processing is paused by emergency dead-man control.');
    this.name = 'EventBackboneEmergencyDisabledError';
  }
}

// In-memory state for testing / cache
let testOverrideState: boolean | null = null;
let cachedStatus: { disabled: boolean; timestamp: number } | null = null;
const CACHE_TTL_MS = 10000; // 10s cache to prevent query flood

export function setEventDeadManStateForTests(disabled: boolean | null): void {
  testOverrideState = disabled;
  cachedStatus = null;
}

/**
 * Checks whether the Event Backbone dead-man switch has been engaged.
 * Throws EventBackboneEmergencyDisabledError if emergency halt is active.
 */
export async function checkEventDeadManSwitch(): Promise<void> {
  if (testOverrideState !== null) {
    if (testOverrideState) {
      throw new EventBackboneEmergencyDisabledError();
    }
    return;
  }

  const now = Date.now();
  if (cachedStatus && now - cachedStatus.timestamp < CACHE_TTL_MS) {
    if (cachedStatus.disabled) {
      throw new EventBackboneEmergencyDisabledError();
    }
    return;
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('system_settings').doc('event_backbone').get();

    const disabled = snap.exists && snap.data()?.emergencyDisabled === true;
    cachedStatus = { disabled, timestamp: now };

    if (disabled) {
      throw new EventBackboneEmergencyDisabledError();
    }
  } catch (err) {
    if (err instanceof EventBackboneEmergencyDisabledError) {
      throw err;
    }
    // Fail open on database connection error during system_settings check
    cachedStatus = { disabled: false, timestamp: now };
  }
}

/**
 * Updates the emergency dead-man switch in Firestore.
 */
export async function setEmergencyDeadManSwitch(disabled: boolean): Promise<void> {
  const { adminDb } = await import('@/lib/firebase-admin');
  await adminDb.collection('system_settings').doc('event_backbone').set(
    {
      emergencyDisabled: disabled,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  cachedStatus = { disabled, timestamp: Date.now() };
}

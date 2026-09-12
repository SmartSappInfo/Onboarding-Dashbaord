'use server';

/**
 * @fileOverview Operator controls for deployment surfaces and outbound messaging.
 *
 * WHY THIS EXISTS
 * Pausing customer messaging during an incident used to require an env-var change and a
 * redeploy. This lets an operator do it from the backoffice, with an audit trail, without
 * touching code.
 *
 * CAUTION: pausing is the only direction this can move things. ALLOW_OUTBOUND_MESSAGING is
 * a hard floor enforced in outbound-guard.ts and cannot be lifted from here — otherwise a
 * console click could turn a staging environment into one that messages real customers.
 * If you add a control that writes that env floor, you have broken the isolation guarantee
 * the whole guard exists for.
 *
 * TESTABILITY: every branch is covered in __tests__/platform-controls-actions.test.ts by
 * mocking `adminDb` and `authorizeBackofficeSession`. Keep the Firestore access shaped as
 * `collection(...).doc(...)` so those mocks stay valid.
 */
import { adminDb } from '@/lib/firebase-admin';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { logBackofficeAction } from '@/lib/backoffice/audit-logger';
import { getAppSurface, type AppSurface } from '@/lib/platform/app-surface';
import { __resetOutboundCache } from '@/lib/platform/outbound-guard';
import { toClientErrorMessage } from '@/lib/errors/report-error';

/** Keeps the control document a control document, not a place to park text. */
const MAX_REASON_LENGTH = 200;

const CONTROLS_COLLECTION = 'platform_config';
const CONTROLS_DOC = 'messaging_controls';

/**
 * Everything the control page needs, already reduced to display-safe primitives.
 * Deliberately not the raw Firestore document: the page must never render arbitrary
 * stored fields.
 */
export interface PlatformControlsView {
  /** Which deployment answered this request — 'client' or 'backoffice'. */
  surface: AppSurface;
  /** The operator switch. True means sending is permitted by the switch. */
  outboundEnabled: boolean;
  /** The environment hard floor. False means no switch position can enable sending. */
  envFloorAllows: boolean;
  pausedReason: string;
  updatedByName: string;
  /** ISO 8601, or '' when never set. Formatted at the edge, not here. */
  updatedAt: string;
}

export async function getPlatformControlsAction(): Promise<PlatformControlsView> {
  await authorizeBackofficeSession('settings', 'view');

  const snap = await adminDb.collection(CONTROLS_COLLECTION).doc(CONTROLS_DOC).get();
  const data = snap.exists ? snap.data() : undefined;

  return {
    surface: getAppSurface(),
    // Mirrors outbound-guard.envFloorAllows() exactly. If that predicate changes, change
    // this with it, or the page will describe a state the guard is not in.
    envFloorAllows: process.env.ALLOW_OUTBOUND_MESSAGING !== 'false',
    // Absent or non-false means enabled — same rule the guard applies, so a partially
    // written document reads identically in both places.
    outboundEnabled: data?.outboundEnabled !== false,
    pausedReason: typeof data?.pausedReason === 'string' ? data.pausedReason : '',
    updatedByName: typeof data?.updatedByName === 'string' ? data.updatedByName : '',
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : '',
  };
}

/**
 * Pause or resume outbound messaging platform-wide.
 *
 * Authorization runs BEFORE the write and is deliberately not wrapped in the try/catch:
 * a denied caller must reject, not receive `{ success: false }` that a UI might render as
 * an ordinary retryable failure.
 *
 * @param paused true to stop sending, false to resume.
 * @param reason short operator note; stored and shown to whoever looks next.
 */
export async function setOutboundPausedAction(
  paused: boolean,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  // D-3: settings:edit is super_admin only. See ROLE_MATRIX in backoffice-rbac.ts.
  const actor = await authorizeBackofficeSession('settings', 'edit');

  // A resume must not leave the previous incident note behind — it would be read as the
  // current state by the next operator.
  const pausedReason = paused ? reason.trim().slice(0, MAX_REASON_LENGTH) : '';

  try {
    await adminDb.collection(CONTROLS_COLLECTION).doc(CONTROLS_DOC).set(
      {
        outboundEnabled: !paused,
        pausedReason,
        updatedBy: actor.userId,
        updatedByName: actor.name,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Makes the change visible immediately to THIS instance. Other instances pick it up
    // within the guard's 30s cache TTL — the page tells the operator that.
    __resetOutboundCache();

    await logBackofficeAction(
      actor,
      paused ? 'paused_outbound_messaging' : 'resumed_outbound_messaging',
      CONTROLS_COLLECTION,
      CONTROLS_DOC,
      {
        scope: 'platform',
        after: { outboundEnabled: !paused, pausedReason },
      },
    );

    return { success: true };
  } catch (error) {
    // One call, not reportError + toClientErrorMessage: each of those mints its own
    // correlation id, and the operator would quote a reference that is not the one in the
    // logs they are being pointed at.
    return {
      success: false,
      error: toClientErrorMessage('platform.controls', error, { paused }),
    };
  }
}

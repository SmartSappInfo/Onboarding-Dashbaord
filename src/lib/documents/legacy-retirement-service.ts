/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Dual-Write Sunsetting & Legacy Deprecation Layer (Phase 7):
 * 1. Purpose (DocSigning_roadmap.md §17.3 & §18):
 *    Provides safe, progressive deprecation and retirement of legacy document signing endpoints:
 *    - Soft-deprecation logging & telemetry tracking (FM-P7-09).
 *    - Hard cutover enforcement: Throws LegacyEndpointDeprecatedError when dual-write has sunset (100% GA).
 *    - Permanent URL rewrites: Seamlessly maps legacy public form links (`/forms/[pdfId]`)
 *      to modern signing sessions (`/sign/[token]`) preserving perpetual link validity.
 * 2. Multi-Tenant Scoping (Rule 5 & 8):
 *    Dual-write status and lookups are strictly partitioned by `workspaceId`.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { getWorkspaceRolloutCohort } from '@/lib/documents/rollout-switchboard-service';

/**
 * Custom error thrown when a deprecated legacy endpoint is invoked after hard cutover.
 */
export class LegacyEndpointDeprecatedError extends Error {
  public readonly code = 'LEGACY_ENDPOINT_DEPRECATED';
  public readonly httpStatus = 410; // 410 Gone

  constructor(endpointName: string, workspaceId: string) {
    super(
      `[CUTOVER SUNSET] The legacy endpoint '${endpointName}' has been permanently deprecated for workspace '${workspaceId}'. Please route all signing traffic through the modern SigningEnvelope and DocumentTemplate APIs.`
    );
    this.name = 'LegacyEndpointDeprecatedError';
  }
}

/**
 * Checks whether legacy dual-writes are still active for a given workspace.
 * If emergency rollback is active, legacy writes are always re-enabled as a safety backstop.
 */
export async function checkDualWriteStatus(workspaceId: string): Promise<boolean> {
  const config = await getWorkspaceRolloutCohort(workspaceId);
  if (config.isEmergencyRollbackActive) {
    return true; // Safety backstop: emergency rollback allows legacy write path
  }
  return config.legacyDualWriteEnabled;
}

/**
 * Asserts that a legacy write operation is allowed.
 * Throws LegacyEndpointDeprecatedError if dual-writes have been disabled.
 */
export async function assertLegacyWriteAllowed(
  workspaceId: string,
  endpointName: string
): Promise<void> {
  const allowed = await checkDualWriteStatus(workspaceId);
  if (!allowed) {
    throw new LegacyEndpointDeprecatedError(endpointName, workspaceId);
  }
}

export interface LegacyEndpointAccessLogParams {
  workspaceId: string;
  endpointName: string;
  callerUserId?: string;
  entityId?: string;
}

/**
 * Logs a soft-deprecation telemetry event when a legacy contract/PDF action is invoked.
 */
export function logLegacyEndpointAccess(params: LegacyEndpointAccessLogParams): void {
  const timestamp = new Date().toISOString();
  console.warn(
    `[DEPRECATION WARNING] Legacy endpoint called: ${params.endpointName} | Workspace: ${params.workspaceId} | Caller: ${params.callerUserId || 'anonymous'} | Entity: ${params.entityId || 'none'} | Time: ${timestamp}`
  );
}

export interface LegacyFormUrlTranslationResult {
  destinationUrl: string;
  isPermanentRedirect: boolean;
  envelopeId: string | null;
}

/**
 * Translates a legacy form URL parameter (`/forms/[pdfId]`) into its modern canonical route.
 * Looks up the migrated envelope or signing session in the workspace.
 */
export async function translateLegacyFormUrl(
  workspaceId: string,
  legacyPdfId: string
): Promise<LegacyFormUrlTranslationResult> {
  const cleanId = legacyPdfId.trim();
  if (!cleanId) {
    return {
      destinationUrl: '/sign',
      isPermanentRedirect: false,
      envelopeId: null,
    };
  }

  try {
    const envelopeRef = adminDb
      .collection(`workspaces/${workspaceId}/signing_envelopes`)
      .doc(cleanId);

    const docSnap = await envelopeRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const signingToken = typeof data?.signingToken === 'string' ? data.signingToken : null;
      if (signingToken) {
        return {
          destinationUrl: `/sign/${encodeURIComponent(signingToken)}`,
          isPermanentRedirect: true,
          envelopeId: docSnap.id || (typeof data?.id === 'string' ? data.id : cleanId),
        };
      }
    }

    // Fallback: If not yet migrated or not found, preserve the legacy path
    return {
      destinationUrl: `/forms/${encodeURIComponent(cleanId)}`,
      isPermanentRedirect: false,
      envelopeId: null,
    };
  } catch (error) {
    console.error(`[URL TRANSLATION ERROR] Failed to resolve legacy form ${cleanId}:`, error);
    return {
      destinationUrl: `/forms/${encodeURIComponent(cleanId)}`,
      isPermanentRedirect: false,
      envelopeId: null,
    };
  }
}

/**
 * @fileOverview MFA & WebAuthn Passkeys Policy Service (Phase 10)
 *
 * Enforces organization-wide and role-scoped multi-factor authentication policies,
 * passkey registration rules, and grace-period tracking.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `enterprise-identity-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { MfaPolicyConfig, MfaFactorType } from '@/lib/types';
import { SecurityAuditService } from '@/lib/services/governance/security-audit-service';

export class MfaPolicyService {
  private static collectionName = 'mfa_policy_configs';

  /**
   * Updates MFA and Passkey policy rules for an organization.
   */
  static async updateMfaPolicy(
    organizationId: string,
    payload: {
      enforceMfa: boolean;
      allowedFactors: MfaFactorType[];
      enforceForRoles: string[];
      gracePeriodDays: number;
      requirePasskeysForAdmin: boolean;
      updatedBy: string;
    }
  ): Promise<MfaPolicyConfig> {
    const docRef = adminDb.collection(this.collectionName).doc(organizationId);

    const config: MfaPolicyConfig = {
      organizationId,
      enforceMfa: payload.enforceMfa,
      allowedFactors: payload.allowedFactors,
      enforceForRoles: payload.enforceForRoles,
      gracePeriodDays: Math.max(0, payload.gracePeriodDays),
      requirePasskeysForAdmin: payload.requirePasskeysForAdmin,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(config, { merge: true });

    // Compliance Audit Log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: 'role_granted',
      actorId: payload.updatedBy,
      actorName: 'Security Admin',
      targetId: organizationId,
      targetName: 'MFA Policy',
      description: `Updated MFA policy (Enforced: ${payload.enforceMfa}, Factors: ${payload.allowedFactors.join(', ')}).`,
    });

    return config;
  }

  /**
   * Retrieves MFA policy for an organization.
   */
  static async getMfaPolicy(organizationId: string): Promise<MfaPolicyConfig> {
    const doc = await adminDb.collection(this.collectionName).doc(organizationId).get();
    if (doc.exists) {
      return doc.data() as MfaPolicyConfig;
    }

    // Default Permissive Policy
    return {
      organizationId,
      enforceMfa: false,
      allowedFactors: ['totp', 'passkey'],
      enforceForRoles: [],
      gracePeriodDays: 7,
      requirePasskeysForAdmin: false,
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * @fileOverview Enterprise Session Governance Service (Phase 10)
 *
 * Manages tenant-level session lifetimes, idle timeout policies,
 * concurrent login limits, and step-up authentication triggers.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `enterprise-identity-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { EnterpriseSessionConfig } from '@/lib/types';
import { SecurityAuditService } from '@/lib/services/governance/security-audit-service';

export class EnterpriseSessionService {
  private static collectionName = 'enterprise_session_configs';

  /**
   * Updates session lifetime and security policies for an organization.
   */
  static async updateSessionConfig(
    organizationId: string,
    payload: {
      idleTimeoutMinutes: number;
      maxSessionDurationHours: number;
      concurrentSessionLimit: number;
      forceReauthOnSensitiveActions: boolean;
      updatedBy: string;
    }
  ): Promise<EnterpriseSessionConfig> {
    const docRef = adminDb.collection(this.collectionName).doc(organizationId);

    const config: EnterpriseSessionConfig = {
      organizationId,
      idleTimeoutMinutes: Math.max(5, payload.idleTimeoutMinutes),
      maxSessionDurationHours: Math.max(1, payload.maxSessionDurationHours),
      concurrentSessionLimit: Math.max(1, payload.concurrentSessionLimit),
      forceReauthOnSensitiveActions: payload.forceReauthOnSensitiveActions,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(config, { merge: true });

    // Compliance Audit Log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: 'role_granted',
      actorId: payload.updatedBy,
      actorName: 'Security Admin',
      targetId: organizationId,
      targetName: 'Session Policy',
      description: `Updated Session Policy (Idle Timeout: ${config.idleTimeoutMinutes}m, Max Duration: ${config.maxSessionDurationHours}h).`,
    });

    return config;
  }

  /**
   * Retrieves session configuration for an organization.
   */
  static async getSessionConfig(organizationId: string): Promise<EnterpriseSessionConfig> {
    const doc = await adminDb.collection(this.collectionName).doc(organizationId).get();
    if (doc.exists) {
      return doc.data() as EnterpriseSessionConfig;
    }

    // Default Enterprise Policy
    return {
      organizationId,
      idleTimeoutMinutes: 30,
      maxSessionDurationHours: 12,
      concurrentSessionLimit: 3,
      forceReauthOnSensitiveActions: true,
      updatedAt: new Date().toISOString(),
    };
  }
}

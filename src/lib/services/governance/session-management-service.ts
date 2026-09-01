/**
 * @fileOverview Session Management & Security Policy Service (Governance 2.0)
 *
 * Manages active user sessions, remote session revocation via Firebase Admin SDK,
 * MFA enforcement policies, and session idle timeout settings.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Dual-layer revocation: Firebase Auth refresh token revocation + in-database revoked timestamp.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `governance-services.test.ts`.
 */

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import type { UserSession, SecurityPolicyConfig, MFAEnforcementLevel } from '@/lib/types';
import { SecurityAuditService } from './security-audit-service';

export class SessionManagementService {
  private static sessionsCollection = 'user_sessions';
  private static policiesCollection = 'security_policies';

  /**
   * Revokes a specific active user session.
   */
  static async revokeUserSession(
    organizationId: string,
    sessionId: string,
    revokedBy: string
  ): Promise<void> {
    const sessionRef = adminDb.collection(this.sessionsCollection).doc(sessionId);
    const snap = await sessionRef.get();

    if (!snap.exists) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = snap.data() as UserSession;
    if (session.organizationId !== organizationId) {
      throw new Error('Tenant boundary mismatch');
    }

    const now = new Date().toISOString();
    await sessionRef.update({
      status: 'revoked',
      lastActiveAt: now,
    });

    // Revoke Firebase Auth refresh tokens
    try {
      await adminAuth.revokeRefreshTokens(session.personId);
    } catch (err: unknown) {
      console.warn('[SessionManagementService] Firebase token revocation warning:', err);
    }

    // Audit log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: 'session_revoked',
      actorId: revokedBy,
      actorName: 'Security Admin',
      targetId: session.personId,
      targetName: session.personName,
      description: `Revoked session on device '${session.device} (${session.browser})' for ${session.personName}.`,
    });
  }

  /**
   * Revokes all active sessions for a user across all devices.
   */
  static async revokeAllUserSessions(
    organizationId: string,
    personId: string,
    revokedBy: string
  ): Promise<{ revokedCount: number }> {
    const snap = await adminDb
      .collection(this.sessionsCollection)
      .where('organizationId', '==', organizationId)
      .where('personId', '==', personId)
      .where('status', '==', 'active')
      .get();

    const batch = adminDb.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        status: 'revoked',
        lastActiveAt: new Date().toISOString(),
      });
    }
    await batch.commit();

    try {
      await adminAuth.revokeRefreshTokens(personId);
    } catch (err: unknown) {
      console.warn('[SessionManagementService] Firebase global token revocation warning:', err);
    }

    return { revokedCount: snap.docs.length };
  }

  /**
   * Lists active sessions for an organization or member.
   */
  static async listSessions(
    organizationId: string,
    personId?: string
  ): Promise<UserSession[]> {
    let q = adminDb.collection(this.sessionsCollection).where('organizationId', '==', organizationId);

    if (personId) {
      q = q.where('personId', '==', personId);
    }

    const snap = await q.limit(50).get();
    const sessions = snap.docs.map((d) => d.data() as UserSession);
    return sessions.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  /**
   * Gets or initializes the security policy configuration for an organization.
   */
  static async getSecurityPolicy(organizationId: string): Promise<SecurityPolicyConfig> {
    const docRef = adminDb.collection(this.policiesCollection).doc(organizationId);
    const snap = await docRef.get();

    if (snap.exists) {
      return snap.data() as SecurityPolicyConfig;
    }

    // Default policy configuration
    const defaultPolicy: SecurityPolicyConfig = {
      organizationId,
      mfaEnforcement: 'recommended',
      sessionIdleTimeoutMinutes: 60,
      maxConcurrentSessions: 5,
      passwordMaxAgeDays: 90,
      requireReAuthForCritical: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };

    await docRef.set(defaultPolicy);
    return defaultPolicy;
  }

  /**
   * Updates organization security policy configuration.
   */
  static async updateSecurityPolicy(
    organizationId: string,
    patch: Partial<Omit<SecurityPolicyConfig, 'organizationId'>>,
    updatedBy: string
  ): Promise<SecurityPolicyConfig> {
    const current = await this.getSecurityPolicy(organizationId);
    const now = new Date().toISOString();

    const updated: SecurityPolicyConfig = {
      ...current,
      ...patch,
      organizationId,
      updatedAt: now,
      updatedBy,
    };

    const docRef = adminDb.collection(this.policiesCollection).doc(organizationId);
    await docRef.set(updated, { merge: true });

    // Audit log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: patch.mfaEnforcement ? 'mfa_enforced' : 'policy_updated',
      actorId: updatedBy,
      actorName: 'Security Admin',
      description: `Updated organization security policy (MFA: ${updated.mfaEnforcement}, Timeout: ${updated.sessionIdleTimeoutMinutes}m).`,
    });

    return updated;
  }
}

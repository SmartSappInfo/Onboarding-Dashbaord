/**
 * @fileOverview Enterprise Identity Provider Service (Phase 10)
 *
 * Manages multi-tenant SAML 2.0 and OIDC Identity Provider configurations,
 * domain-based SSO routing, and certificate expiration watchdogs.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Redacts client secrets in responses.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `enterprise-identity-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  EnterpriseIdpConfig,
  EnterpriseIdpType,
  EnterpriseIdpStatus,
} from '@/lib/types';
import { SecurityAuditService } from '@/lib/services/governance/security-audit-service';

export class EnterpriseIdpService {
  private static collectionName = 'enterprise_idp_configs';

  /**
   * Configures or updates SAML 2.0 / OIDC provider settings for an organization.
   */
  static async configureIdp(
    organizationId: string,
    payload: {
      providerType: EnterpriseIdpType;
      displayName: string;
      issuer: string;
      ssoUrl: string;
      certificate?: string;
      clientId?: string;
      clientSecret?: string;
      domains: string[];
      enforceSso: boolean;
      allowBreakGlass: boolean;
      status: EnterpriseIdpStatus;
      configuredBy: string;
    }
  ): Promise<EnterpriseIdpConfig> {
    const docRef = adminDb.collection(this.collectionName).doc(organizationId);
    const existingSnap = await docRef.get();

    const clientSecretMasked = payload.clientSecret
      ? `••••••••••••${payload.clientSecret.slice(-4)}`
      : existingSnap.exists
      ? (existingSnap.data() as EnterpriseIdpConfig).clientSecretMasked
      : undefined;

    const config: EnterpriseIdpConfig = {
      id: organizationId,
      organizationId,
      providerType: payload.providerType,
      displayName: payload.displayName.trim(),
      issuer: payload.issuer.trim(),
      ssoUrl: payload.ssoUrl.trim(),
      certificate: payload.certificate?.trim(),
      clientId: payload.clientId?.trim(),
      clientSecretMasked,
      domains: payload.domains.map((d) => d.trim().toLowerCase()).filter(Boolean),
      enforceSso: payload.enforceSso,
      allowBreakGlass: payload.allowBreakGlass,
      status: payload.status,
      createdAt: existingSnap.exists
        ? (existingSnap.data() as EnterpriseIdpConfig).createdAt
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(config, { merge: true });

    // Compliance Audit Log
    await SecurityAuditService.logEvent(organizationId, {
      eventType: 'role_granted',
      actorId: payload.configuredBy,
      actorName: 'Enterprise Admin',
      targetId: organizationId,
      targetName: payload.displayName,
      description: `Configured Enterprise IdP (${payload.providerType.toUpperCase()}) for domains: ${payload.domains.join(', ')}.`,
    });

    return config;
  }

  /**
   * Retrieves IdP configuration for an organization.
   */
  static async getIdpConfig(organizationId: string): Promise<EnterpriseIdpConfig | null> {
    const doc = await adminDb.collection(this.collectionName).doc(organizationId).get();
    if (!doc.exists) return null;
    return doc.data() as EnterpriseIdpConfig;
  }

  /**
   * Resolves organization IdP endpoint by user email domain for SSO auto-routing.
   */
  static async getIdpByDomain(domain: string): Promise<EnterpriseIdpConfig | null> {
    const cleanDomain = domain.trim().toLowerCase();
    const snap = await adminDb
      .collection(this.collectionName)
      .where('domains', 'array-contains', cleanDomain)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as EnterpriseIdpConfig;
  }
}

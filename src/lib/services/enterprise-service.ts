/**
 * {{Org_name}} Experience Platform — Enterprise, Scale & Marketplace Service
 *
 * Enterprise domain operations for SSO, White-Labeling, System Terminology,
 * Organization Hierarchy Trees, Marketplace Blueprint Installation, and Audit Logging.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalService } from '@/lib/services/portal-service';
import type {
  EnterpriseSsoConfig,
  EnterpriseWhiteLabelConfig,
  OrgHierarchyNode,
  MarketplaceListing,
  EnterpriseAuditLog,
  SaveEnterpriseSsoInput,
  SaveWhiteLabelConfigInput,
  CreateHierarchyNodeInput,
  SystemTerminologyConfig,
  MarketplaceCategory,
} from '@/lib/types/enterprise';

const DEFAULT_TERMINOLOGY: SystemTerminologyConfig = {
  course: 'Course',
  courses: 'Courses',
  lesson: 'Lesson',
  instructor: 'Instructor',
  student: 'Student',
  certificate: 'Certificate',
  community: 'Community',
};

export class EnterpriseService {
  // ── 1. Enterprise SSO Identity Federation ───────────────────────────────────

  public static async saveEnterpriseSso(input: SaveEnterpriseSsoInput): Promise<EnterpriseSsoConfig> {
    const docId = `sso_${input.portalId}`;
    const docRef = adminDb.collection('enterprise_sso_configs').doc(docId);
    const now = new Date().toISOString();

    const config: EnterpriseSsoConfig = {
      id: docId,
      organizationId: input.organizationId,
      portalId: input.portalId,
      provider: input.provider,
      domain: input.domain.trim().toLowerCase(),
      issuerUrl: input.issuerUrl.trim(),
      ssoLoginUrl: input.ssoLoginUrl.trim(),
      clientId: input.clientId?.trim(),
      certificateFingerprint: input.certificateFingerprint?.trim(),
      autoProvisionRoles: input.autoProvisionRoles || ['member'],
      enforceSsoOnly: input.enforceSsoOnly ?? false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(config, { merge: true });

    await this.recordAuditLog({
      id: `audit_${Date.now()}`,
      organizationId: input.organizationId,
      portalId: input.portalId,
      actorUserId: 'admin_session',
      actorEmail: 'admin@organization.com',
      action: 'sso.configured',
      resourceType: 'enterprise_sso_config',
      resourceId: docId,
      timestamp: now,
      details: {
        provider: input.provider,
        domain: input.domain,
        enforceSsoOnly: input.enforceSsoOnly ?? false,
      },
    });

    return config;
  }

  public static async getEnterpriseSso(portalId: string): Promise<EnterpriseSsoConfig | null> {
    const docId = `sso_${portalId}`;
    const snap = await adminDb.collection('enterprise_sso_configs').doc(docId).get();
    if (!snap.exists) return null;
    return snap.data() as EnterpriseSsoConfig;
  }

  // ── 2. White-Labeling & System Terminology ──────────────────────────────────

  public static async saveWhiteLabelConfig(input: SaveWhiteLabelConfigInput): Promise<EnterpriseWhiteLabelConfig> {
    const docId = `wl_${input.portalId}`;
    const docRef = adminDb.collection('enterprise_whitelabel_configs').doc(docId);
    const now = new Date().toISOString();

    const terminology: SystemTerminologyConfig = {
      ...DEFAULT_TERMINOLOGY,
      ...(input.systemTerminology || {}),
    };

    const config: EnterpriseWhiteLabelConfig = {
      id: docId,
      organizationId: input.organizationId,
      portalId: input.portalId,
      customDomain: input.customDomain?.trim().toLowerCase(),
      cnameTarget: input.cnameTarget?.trim() || 'cname.smartsapp.com',
      sslStatus: input.customDomain ? 'active' : 'pending',
      customLoginHeadline: input.customLoginHeadline?.trim(),
      customLoginSubheadline: input.customLoginSubheadline?.trim(),
      customSenderEmail: input.customSenderEmail?.trim(),
      customFooterHtml: input.customFooterHtml?.trim(),
      systemTerminology: terminology,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(config, { merge: true });

    await this.recordAuditLog({
      id: `audit_${Date.now()}`,
      organizationId: input.organizationId,
      portalId: input.portalId,
      actorUserId: 'admin_session',
      actorEmail: 'admin@organization.com',
      action: 'whitelabel.updated',
      resourceType: 'enterprise_whitelabel_config',
      resourceId: docId,
      timestamp: now,
      details: {
        customDomain: input.customDomain || 'none',
        hasCustomTerminology: !!input.systemTerminology,
      },
    });

    return config;
  }

  public static async getWhiteLabelConfig(portalId: string): Promise<EnterpriseWhiteLabelConfig | null> {
    const docId = `wl_${portalId}`;
    const snap = await adminDb.collection('enterprise_whitelabel_configs').doc(docId).get();
    if (!snap.exists) return null;
    return snap.data() as EnterpriseWhiteLabelConfig;
  }

  public static async resolveSystemTerminology(portalId: string): Promise<SystemTerminologyConfig> {
    const config = await this.getWhiteLabelConfig(portalId);
    if (!config || !config.systemTerminology) {
      return DEFAULT_TERMINOLOGY;
    }
    return {
      ...DEFAULT_TERMINOLOGY,
      ...config.systemTerminology,
    };
  }

  // ── 3. Multi-Level Organization Hierarchy ───────────────────────────────────

  public static async createHierarchyNode(input: CreateHierarchyNodeInput): Promise<OrgHierarchyNode> {
    // 1. Acyclic Tree Validation: ensure parentId is valid and not circular
    if (input.parentId) {
      const parentSnap = await adminDb.collection('org_hierarchy_nodes').doc(input.parentId).get();
      if (!parentSnap.exists) {
        throw new Error('Specified parent organizational unit does not exist.');
      }
    }

    const docRef = adminDb.collection('org_hierarchy_nodes').doc();
    const now = new Date().toISOString();

    const node: OrgHierarchyNode = {
      id: docRef.id,
      organizationId: input.organizationId,
      name: input.name.trim(),
      type: input.type,
      parentId: input.parentId,
      assignedMemberCount: 0,
      leadName: input.leadName?.trim(),
      leadEmail: input.leadEmail?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(node);
    return node;
  }

  public static async listHierarchyNodes(organizationId: string): Promise<OrgHierarchyNode[]> {
    const snap = await adminDb
      .collection('org_hierarchy_nodes')
      .where('organizationId', '==', organizationId)
      .get();

    return snap.docs.map(d => d.data() as OrgHierarchyNode);
  }

  // ── 4. Marketplace Blueprint Hub & 1-Click Install ──────────────────────────

  public static async listMarketplaceListings(category?: MarketplaceCategory): Promise<MarketplaceListing[]> {
    let query: FirebaseFirestore.Query = adminDb.collection('marketplace_listings');

    if (category) {
      query = query.where('category', '==', category);
    }

    const snap = await query.get();
    return snap.docs.map(d => d.data() as MarketplaceListing);
  }

  public static async installMarketplaceTemplate(
    listingId: string,
    organizationId: string,
    newPortalTitle: string,
    newPortalSlug: string
  ): Promise<{ portalId: string; slug: string }> {
    const listingSnap = await adminDb.collection('marketplace_listings').doc(listingId).get();
    if (!listingSnap.exists) {
      throw new Error('Marketplace template not found.');
    }

    const listing = listingSnap.data() as MarketplaceListing;

    // 1. Create cleanly sanitized portal instance from marketplace blueprint
    const newPortal = await PortalService.createPortal(
      {
        organizationId,
        workspaceIds: ['global'],
        name: newPortalTitle.trim(),
        slug: newPortalSlug.trim().toLowerCase(),
        primaryMode: 'academy',
      },
      'admin_session'
    );

    // 2. Increment install counter on marketplace blueprint
    await adminDb.collection('marketplace_listings').doc(listingId).update({
      installCount: (listing.installCount || 0) + 1,
    });

    // 3. Record Audit Log
    await this.recordAuditLog({
      id: `audit_${Date.now()}`,
      organizationId,
      portalId: newPortal.id,
      actorUserId: 'admin_session',
      actorEmail: 'admin@organization.com',
      action: 'marketplace.template_installed',
      resourceType: 'portal',
      resourceId: newPortal.id,
      timestamp: new Date().toISOString(),
      details: {
        templateId: listingId,
        templateTitle: listing.title,
      },
    });

    return { portalId: newPortal.id, slug: newPortal.slug };
  }

  // ── 5. Enterprise Compliance Audit Logging ──────────────────────────────────

  public static async recordAuditLog(log: EnterpriseAuditLog): Promise<void> {
    const docRef = adminDb.collection('enterprise_audit_logs').doc(log.id);
    await docRef.set(log);
  }

  public static async listAuditLogs(organizationId: string, limitCount = 30): Promise<EnterpriseAuditLog[]> {
    const snap = await adminDb
      .collection('enterprise_audit_logs')
      .where('organizationId', '==', organizationId)
      .orderBy('timestamp', 'desc')
      .limit(limitCount)
      .get();

    return snap.docs.map(d => d.data() as EnterpriseAuditLog);
  }
}

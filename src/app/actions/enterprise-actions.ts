'use server';

/**
 * {{Org_name}} Experience Platform — Enterprise Server Actions
 *
 * Strongly typed Next.js Server Actions for Enterprise SSO, White-Labeling,
 * Organizational Hierarchy Trees, Marketplace Blueprint Installation, and Audit Logs.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2 + F9): public endpoints, all staff-only.
 * - Portal-scoped config (SSO, white-label): `requirePortalAdmin`; the organization is the portal's.
 * - Organization-scoped (hierarchy, marketplace install, audit logs): `requirePortalOrganizationAdmin`.
 * - The marketplace catalogue is readable by any signed-in staff user.
 * - Errors are reported server-side; clients get an opaque message (was raw `err.message`).
 */

import { revalidatePath } from 'next/cache';
import { EnterpriseService } from '@/lib/services/enterprise-service';
import { requireAuth } from '@/lib/auth/require-auth';
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  portalAuthErrorMessage,
  requirePortalAdmin,
  requirePortalOrganizationAdmin,
} from '@/lib/auth/require-portal-access';
import type {
  EnterpriseSsoConfig,
  EnterpriseWhiteLabelConfig,
  OrgHierarchyNode,
  MarketplaceListing,
  EnterpriseAuditLog,
  SaveEnterpriseSsoInput,
  SaveWhiteLabelConfigInput,
  CreateHierarchyNodeInput,
  MarketplaceCategory,
} from '@/lib/types/enterprise';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.enterprise-actions', err, undefined, fallback) };
}

// ── 1. Enterprise SSO Actions ───────────────────────────────────────────────

export async function saveEnterpriseSsoAction(
  input: SaveEnterpriseSsoInput,
  portalSlug?: string
): Promise<ActionResponse<EnterpriseSsoConfig>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const config = await EnterpriseService.saveEnterpriseSso({ ...input, organizationId: portal.organizationId });
    if (portalSlug) revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: config };
  } catch (err: unknown) {
    return failure(err, 'Failed to save SSO configuration.');
  }
}

export async function getEnterpriseSsoAction(
  portalId: string
): Promise<ActionResponse<EnterpriseSsoConfig | null>> {
  try {
    await requirePortalAdmin(portalId);
    const config = await EnterpriseService.getEnterpriseSso(portalId);
    return { success: true, data: config };
  } catch (err: unknown) {
    return failure(err, 'Failed to get SSO configuration.');
  }
}

// ── 2. White-Labeling Actions ───────────────────────────────────────────────

export async function saveWhiteLabelConfigAction(
  input: SaveWhiteLabelConfigInput,
  portalSlug?: string
): Promise<ActionResponse<EnterpriseWhiteLabelConfig>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const config = await EnterpriseService.saveWhiteLabelConfig({ ...input, organizationId: portal.organizationId });
    if (portalSlug) {
      revalidatePath(`/admin/portals/${input.portalId}`);
      revalidatePath(`/portal/${portalSlug}`);
    }
    return { success: true, data: config };
  } catch (err: unknown) {
    return failure(err, 'Failed to save white label configuration.');
  }
}

export async function getWhiteLabelConfigAction(
  portalId: string
): Promise<ActionResponse<EnterpriseWhiteLabelConfig | null>> {
  try {
    await requirePortalAdmin(portalId);
    const config = await EnterpriseService.getWhiteLabelConfig(portalId);
    return { success: true, data: config };
  } catch (err: unknown) {
    return failure(err, 'Failed to get white label configuration.');
  }
}

// ── 3. Organization Hierarchy Actions ───────────────────────────────────────

export async function createHierarchyNodeAction(
  input: CreateHierarchyNodeInput
): Promise<ActionResponse<OrgHierarchyNode>> {
  try {
    await requirePortalOrganizationAdmin(input.organizationId);
    const node = await EnterpriseService.createHierarchyNode(input);
    return { success: true, data: node };
  } catch (err: unknown) {
    return failure(err, 'Failed to create organizational unit.');
  }
}

export async function listHierarchyNodesAction(
  organizationId: string
): Promise<ActionResponse<OrgHierarchyNode[]>> {
  try {
    await requirePortalOrganizationAdmin(organizationId);
    const nodes = await EnterpriseService.listHierarchyNodes(organizationId);
    return { success: true, data: nodes };
  } catch (err: unknown) {
    return failure(err, 'Failed to list organizational units.');
  }
}

// ── 4. Marketplace Blueprint Hub Actions ────────────────────────────────────

export async function listMarketplaceListingsAction(
  category?: MarketplaceCategory
): Promise<ActionResponse<MarketplaceListing[]>> {
  try {
    await requireAuth();
    const listings = await EnterpriseService.listMarketplaceListings(category);
    return { success: true, data: listings };
  } catch (err: unknown) {
    return failure(err, 'Failed to list marketplace blueprints.');
  }
}

export async function installMarketplaceTemplateAction(
  listingId: string,
  organizationId: string,
  newPortalTitle: string,
  newPortalSlug: string
): Promise<ActionResponse<{ portalId: string; slug: string }>> {
  try {
    await requirePortalOrganizationAdmin(organizationId);
    const res = await EnterpriseService.installMarketplaceTemplate(
      listingId,
      organizationId,
      newPortalTitle,
      newPortalSlug
    );
    revalidatePath('/admin/portals');
    return { success: true, data: res };
  } catch (err: unknown) {
    return failure(err, 'Failed to install template blueprint.');
  }
}

// ── 5. Enterprise Audit Logs Actions ────────────────────────────────────────

export async function listEnterpriseAuditLogsAction(
  organizationId: string
): Promise<ActionResponse<EnterpriseAuditLog[]>> {
  try {
    await requirePortalOrganizationAdmin(organizationId);
    const logs = await EnterpriseService.listAuditLogs(organizationId, 30);
    return { success: true, data: logs };
  } catch (err: unknown) {
    return failure(err, 'Failed to list enterprise audit logs.');
  }
}

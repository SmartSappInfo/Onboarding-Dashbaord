'use server';

/**
 * {{Org_name}} Experience Platform — Enterprise Server Actions
 *
 * Strongly typed Next.js Server Actions for Enterprise SSO, White-Labeling,
 * Organizational Hierarchy Trees, Marketplace Blueprint Installation, and Audit Logs.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { EnterpriseService } from '@/lib/services/enterprise-service';
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

// ── 1. Enterprise SSO Actions ───────────────────────────────────────────────

export async function saveEnterpriseSsoAction(
  input: SaveEnterpriseSsoInput,
  portalSlug?: string
): Promise<ActionResponse<EnterpriseSsoConfig>> {
  try {
    const config = await EnterpriseService.saveEnterpriseSso(input);
    if (portalSlug) revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: config };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save SSO configuration.';
    return { success: false, error: message };
  }
}

export async function getEnterpriseSsoAction(
  portalId: string
): Promise<ActionResponse<EnterpriseSsoConfig | null>> {
  try {
    const config = await EnterpriseService.getEnterpriseSso(portalId);
    return { success: true, data: config };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get SSO configuration.';
    return { success: false, error: message };
  }
}

// ── 2. White-Labeling Actions ───────────────────────────────────────────────

export async function saveWhiteLabelConfigAction(
  input: SaveWhiteLabelConfigInput,
  portalSlug?: string
): Promise<ActionResponse<EnterpriseWhiteLabelConfig>> {
  try {
    const config = await EnterpriseService.saveWhiteLabelConfig(input);
    if (portalSlug) {
      revalidatePath(`/admin/portals/${input.portalId}`);
      revalidatePath(`/portal/${portalSlug}`);
    }
    return { success: true, data: config };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save white label configuration.';
    return { success: false, error: message };
  }
}

export async function getWhiteLabelConfigAction(
  portalId: string
): Promise<ActionResponse<EnterpriseWhiteLabelConfig | null>> {
  try {
    const config = await EnterpriseService.getWhiteLabelConfig(portalId);
    return { success: true, data: config };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get white label configuration.';
    return { success: false, error: message };
  }
}

// ── 3. Organization Hierarchy Actions ───────────────────────────────────────

export async function createHierarchyNodeAction(
  input: CreateHierarchyNodeInput
): Promise<ActionResponse<OrgHierarchyNode>> {
  try {
    const node = await EnterpriseService.createHierarchyNode(input);
    return { success: true, data: node };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create organizational unit.';
    return { success: false, error: message };
  }
}

export async function listHierarchyNodesAction(
  organizationId: string
): Promise<ActionResponse<OrgHierarchyNode[]>> {
  try {
    const nodes = await EnterpriseService.listHierarchyNodes(organizationId);
    return { success: true, data: nodes };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list organizational units.';
    return { success: false, error: message };
  }
}

// ── 4. Marketplace Blueprint Hub Actions ────────────────────────────────────

export async function listMarketplaceListingsAction(
  category?: MarketplaceCategory
): Promise<ActionResponse<MarketplaceListing[]>> {
  try {
    const listings = await EnterpriseService.listMarketplaceListings(category);
    return { success: true, data: listings };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list marketplace blueprints.';
    return { success: false, error: message };
  }
}

export async function installMarketplaceTemplateAction(
  listingId: string,
  organizationId: string,
  newPortalTitle: string,
  newPortalSlug: string
): Promise<ActionResponse<{ portalId: string; slug: string }>> {
  try {
    const res = await EnterpriseService.installMarketplaceTemplate(
      listingId,
      organizationId,
      newPortalTitle,
      newPortalSlug
    );
    revalidatePath('/admin/portals');
    return { success: true, data: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to install template blueprint.';
    return { success: false, error: message };
  }
}

// ── 5. Enterprise Audit Logs Actions ────────────────────────────────────────

export async function listEnterpriseAuditLogsAction(
  organizationId: string
): Promise<ActionResponse<EnterpriseAuditLog[]>> {
  try {
    const logs = await EnterpriseService.listAuditLogs(organizationId, 30);
    return { success: true, data: logs };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list enterprise audit logs.';
    return { success: false, error: message };
  }
}

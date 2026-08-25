'use server';

/**
 * {{Org_name}} Experience Platform — Server Actions
 *
 * Provides strongly-typed, secure server-side mutations and data retrieval
 * for Experience Portals with automatic path revalidation.
 *
 * Rules:
 * - Strictly typed (Zero any / any[]).
 * - Server-side only ('use server').
 * - Validates input and sanitizes errors.
 */

import { revalidatePath } from 'next/cache';
import { PortalService } from '@/lib/services/portal-service';
import { PortalAccessService } from '@/lib/services/portal-access-service';
import type {
  Portal,
  CreatePortalInput,
  UpdatePortalInput,
  PublicPortalProjection,
  PortalMode,
} from '@/lib/types/portal';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server action to create a new Experience Portal.
 */
export async function createPortalAction(
  input: CreatePortalInput,
  userId: string = 'system_admin'
): Promise<ActionResponse<Portal>> {
  try {
    if (!input.name || !input.name.trim()) {
      return { success: false, error: 'Portal name is required.' };
    }
    if (!input.organizationId) {
      return { success: false, error: 'Organization ID is required.' };
    }

    const portal = await PortalService.createPortal(input, userId);
    revalidatePath('/admin/portals');
    return { success: true, data: portal };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal.';
    console.error('[PORTAL_ACTION] createPortalAction failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Server action to update an existing Experience Portal.
 */
export async function updatePortalAction(
  portalId: string,
  updates: UpdatePortalInput,
  userId: string = 'system_admin'
): Promise<ActionResponse<Portal>> {
  try {
    if (!portalId) {
      return { success: false, error: 'Portal ID is required.' };
    }

    const portal = await PortalService.updatePortal(portalId, updates, userId);
    revalidatePath('/admin/portals');
    revalidatePath(`/admin/portals/${portalId}`);
    revalidatePath(`/portal/${portal.slug}`);
    revalidatePath(`/p/portal/${portal.slug}`);

    return { success: true, data: portal };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update portal.';
    console.error('[PORTAL_ACTION] updatePortalAction failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Server action to publish a portal.
 */
export async function publishPortalAction(
  portalId: string,
  userId: string = 'system_admin'
): Promise<ActionResponse<Portal>> {
  try {
    const portal = await PortalService.publishPortal(portalId, userId);
    revalidatePath('/admin/portals');
    revalidatePath(`/admin/portals/${portalId}`);
    revalidatePath(`/portal/${portal.slug}`);
    revalidatePath(`/p/portal/${portal.slug}`);

    return { success: true, data: portal };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to publish portal.';
    console.error('[PORTAL_ACTION] publishPortalAction failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Server action to suspend a portal.
 */
export async function suspendPortalAction(
  portalId: string,
  reason: string = 'Temporarily suspended by administrator',
  userId: string = 'system_admin'
): Promise<ActionResponse<Portal>> {
  try {
    const portal = await PortalService.suspendPortal(portalId, reason, userId);
    revalidatePath('/admin/portals');
    revalidatePath(`/admin/portals/${portalId}`);
    revalidatePath(`/portal/${portal.slug}`);
    revalidatePath(`/p/portal/${portal.slug}`);

    return { success: true, data: portal };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to suspend portal.';
    console.error('[PORTAL_ACTION] suspendPortalAction failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Server action to archive a portal.
 */
export async function archivePortalAction(
  portalId: string,
  userId: string = 'system_admin'
): Promise<ActionResponse<Portal>> {
  try {
    const portal = await PortalService.archivePortal(portalId, userId);
    revalidatePath('/admin/portals');
    revalidatePath(`/admin/portals/${portalId}`);

    return { success: true, data: portal };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to archive portal.';
    console.error('[PORTAL_ACTION] archivePortalAction failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Server action to duplicate a portal.
 */
export async function duplicatePortalAction(
  portalId: string,
  newName: string,
  newSlug?: string,
  userId: string = 'system_admin'
): Promise<ActionResponse<Portal>> {
  try {
    if (!newName || !newName.trim()) {
      return { success: false, error: 'New portal name is required.' };
    }

    const portal = await PortalService.duplicatePortal(portalId, newName, newSlug, userId);
    revalidatePath('/admin/portals');

    return { success: true, data: portal };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to duplicate portal.';
    console.error('[PORTAL_ACTION] duplicatePortalAction failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Server action to delete a portal.
 */
export async function deletePortalAction(
  portalId: string,
  userId: string = 'system_admin'
): Promise<ActionResponse<boolean>> {
  try {
    await PortalService.deletePortal(portalId, userId);
    revalidatePath('/admin/portals');
    return { success: true, data: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete portal.';
    console.error('[PORTAL_ACTION] deletePortalAction failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Server action to check slug availability and suggest unique variations.
 */
export async function verifyPortalSlugAvailabilityAction(
  slug: string,
  organizationId: string,
  currentPortalId?: string
): Promise<ActionResponse<{ isAvailable: boolean; suggestedSlug: string }>> {
  try {
    const sanitized = PortalService.sanitizeSlug(slug);
    const uniqueSlug = await PortalService.generateUniqueSlug(sanitized, organizationId, currentPortalId);
    const isAvailable = uniqueSlug === sanitized;

    return {
      success: true,
      data: {
        isAvailable,
        suggestedSlug: uniqueSlug,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to verify slug.';
    return { success: false, error: message };
  }
}

/**
 * Server action to validate password access for password-protected portals.
 */
export async function validatePortalPasswordAction(
  portalId: string,
  passwordAttempt: string
): Promise<ActionResponse<{ allowed: boolean; message?: string }>> {
  try {
    const portal = await PortalService.getPortalById(portalId);
    if (!portal) {
      return { success: false, error: 'Portal not found.' };
    }

    const decision = PortalAccessService.evaluateAccess(portal, {
      passwordAttempt,
    });

    return {
      success: true,
      data: {
        allowed: decision.allowed,
        message: decision.message,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to validate password.';
    return { success: false, error: message };
  }
}

/**
 * Server action to fetch a sanitized public projection of a portal by slug.
 */
export async function getPublicPortalBySlugAction(
  slug: string,
  organizationId?: string
): Promise<ActionResponse<PublicPortalProjection>> {
  try {
    const portal = await PortalService.getPortalBySlug(slug, organizationId);
    if (!portal) {
      return { success: false, error: 'Portal not found.' };
    }

    const publicProjection = PortalAccessService.serializePublicPortal(portal);
    return { success: true, data: publicProjection };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch public portal.';
    return { success: false, error: message };
  }
}

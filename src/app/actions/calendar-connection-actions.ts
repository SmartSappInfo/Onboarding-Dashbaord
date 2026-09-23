'use server';

/**
 * @fileoverview Server Actions for Calendar Connections & 2-Way Calendar Synchronization.
 * Supports Google Calendar and Microsoft Outlook / Office 365.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All token encryption happens prior to database persistence.
 * - External calendar calls are isolated and non-blocking for core database mutations.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { CalendarConnection, CalendarSyncResult } from '@/lib/meetings/types/calendar';
import type { Booking } from '@/lib/meetings/types';
import { syncBookingToExternalCalendar } from '@/lib/meetings/calendar-sync-service';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import { assertUserTenantPermission } from '@/lib/organization-utils';
import { encryptToken } from '@/lib/crypto';
import { getBaseUrl } from '@/lib/utils/url-helpers';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Retrieves all calendar connections for the active workspace and user.
 */
export async function getCalendarConnectionsAction(
  workspaceId: string,
  userId?: string
): Promise<{ success: boolean; connections?: CalendarConnection[]; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    let query = adminDb
      .collection('calendar_connections')
      .where('workspaceId', '==', workspaceId);

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snap = await query.get();
    const connections: CalendarConnection[] = snap.docs.map(doc => {
      const data = doc.data() as CalendarConnection;
      // Do not return raw tokens to client; mask for security
      return {
        ...data,
        id: doc.id,
        accessToken: '***',
        refreshToken: '***',
      };
    });

    return { success: true, connections };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Disconnects and deletes an external calendar connection.
 */
export async function disconnectCalendarConnectionAction(
  connectionId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const docRef = adminDb.collection('calendar_connections').doc(connectionId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error('Calendar connection not found.');
    }

    const data = snap.data() as CalendarConnection;
    if (data.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    await docRef.delete();
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Toggles whether this calendar connection is queried for Free/Busy conflicts.
 */
export async function toggleCalendarConflictCheckAction(
  connectionId: string,
  checkConflicts: boolean,
  workspaceId?: string
): Promise<{ success: boolean; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  const ctx = await requireAuth();

  try {
    const docRef = adminDb.collection('calendar_connections').doc(connectionId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error('Calendar connection not found.');
    }
    const data = snap.data();
    const targetWsId = workspaceId || (data?.workspaceId as string | undefined);
    if (targetWsId && !ctx.isSystemAdmin && !(ctx.profile?.workspaceIds ?? []).includes(targetWsId)) {
      throw new Error('Unauthorized: Access to this workspace calendar connection is denied.');
    }

    await docRef.update({
      checkConflicts,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Sets a specific calendar connection as the primary destination for pushing new bookings.
 */
export async function setPrimarySyncCalendarAction(
  connectionId: string,
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const batch = adminDb.batch();

    // Reset all user's calendars in workspace to isPrimaryDestination: false
    const existingSnap = await adminDb
      .collection('calendar_connections')
      .where('workspaceId', '==', workspaceId)
      .where('userId', '==', userId)
      .get();

    existingSnap.docs.forEach(doc => {
      batch.update(doc.ref, { isPrimaryDestination: false, updatedAt: new Date().toISOString() });
    });

    // Mark targeted connection as primary
    const targetRef = adminDb.collection('calendar_connections').doc(connectionId);
    batch.update(targetRef, { isPrimaryDestination: true, updatedAt: new Date().toISOString() });

    await batch.commit();
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Pushes a confirmed booking as an event to the host's primary connected calendar (Authenticated Server Action).
 * Verifies caller has valid workspace access before executing sync.
 */
export async function syncBookingToExternalCalendarAction(
  bookingId: string
): Promise<CalendarSyncResult> {
  // SECURITY: Require authentication and verify tenant workspace isolation
  await requireAuth();

  if (!bookingId || typeof bookingId !== 'string') {
    return { success: false, error: 'Invalid booking ID.' };
  }

  const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get();
  if (!bookingDoc.exists) {
    return { success: false, error: 'Booking not found.' };
  }

  const booking = bookingDoc.data() as Booking;
  if (!booking.workspaceId) {
    return { success: false, error: 'Booking is missing workspace information.' };
  }

  // Enforce caller belongs to the booking's workspace
  await requireWorkspace(booking.workspaceId);

  return syncBookingToExternalCalendar(bookingId);
}

/**
 * Generates Google Calendar OAuth authorization URL.
 */
export async function getGoogleAuthUrlAction(
  workspaceId: string,
  organizationId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const { getGoogleAuthUrl } = await import('@/lib/services/integrations/google-calendar');
    const url = await getGoogleAuthUrl(workspaceId, organizationId || '');
    return { success: true, url };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Generates Microsoft Calendar OAuth authorization URL.
 */
export async function getMicrosoftAuthUrlAction(
  workspaceId: string,
  organizationId?: string,
  userId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const { getMicrosoftAuthUrl } = await import('@/lib/services/integrations/microsoft-teams');
    const url = await getMicrosoftAuthUrl(workspaceId, organizationId);
    return { success: true, url };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Generates Zoom OAuth authorization URL.
 */
export async function getZoomAuthUrlAction(
  workspaceId: string,
  organizationId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await requireWorkspace(workspaceId);

  try {
    const { getZoomAuthUrl } = await import('@/lib/services/integrations/zoom-meeting');
    const url = await getZoomAuthUrl(workspaceId, organizationId || '');
    return { success: true, url };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export interface OAuthCredentialsInput {
  provider: 'google_calendar' | 'microsoft_teams' | 'zoom';
  clientId: string;
  clientSecret?: string;
  tenantId?: string;
}

export type OAuthCredentialSource = 'workspace' | 'organization' | 'env' | 'none';

export interface WorkspaceOAuthProviderStatus {
  configured: boolean;
  clientId?: string;
  hasSecret: boolean;
  tenantId?: string;
  source: OAuthCredentialSource;
}

export interface WorkspaceOAuthStatus {
  google: WorkspaceOAuthProviderStatus;
  microsoft: WorkspaceOAuthProviderStatus;
  zoom: WorkspaceOAuthProviderStatus;
  redirectUris: {
    google: string;
    microsoft: string;
    zoom: string;
  };
}

export interface OrganizationOAuthProviderStatus {
  configured: boolean;
  clientId?: string;
  hasSecret: boolean;
  tenantId?: string;
  source: 'organization' | 'env' | 'none';
}

export interface OrganizationOAuthStatus {
  google: OrganizationOAuthProviderStatus;
  microsoft: OrganizationOAuthProviderStatus;
  zoom: OrganizationOAuthProviderStatus;
  redirectUris: {
    google: string;
    microsoft: string;
    zoom: string;
  };
}

/**
 * Saves and encrypts OAuth Client ID and Secret for a given provider in the workspace.
 */
export async function saveWorkspaceOAuthCredentialsAction(
  workspaceId: string,
  input: OAuthCredentialsInput
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireWorkspace(workspaceId);
  if (!ctx.isSystemAdmin && ctx.profile?.role !== 'admin' && ctx.profile?.role !== 'manager') {
    return { success: false, error: 'Unauthorized: Workspace admin or manager permissions required to configure API credentials.' };
  }

  try {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.provider === 'google_calendar') {
      if (input.clientId !== undefined) {
        updateData.googleClientId = input.clientId.trim();
      }
      if (input.clientSecret && input.clientSecret.trim()) {
        updateData.googleClientSecret = encryptToken(input.clientSecret.trim());
      }
    } else if (input.provider === 'microsoft_teams') {
      if (input.clientId !== undefined) {
        updateData.microsoftClientId = input.clientId.trim();
      }
      if (input.clientSecret && input.clientSecret.trim()) {
        updateData.microsoftClientSecret = encryptToken(input.clientSecret.trim());
      }
      if (input.tenantId !== undefined) {
        updateData.microsoftTenantId = input.tenantId.trim() || null;
      }
    } else if (input.provider === 'zoom') {
      if (input.clientId !== undefined) {
        updateData.zoomClientId = input.clientId.trim();
      }
      if (input.clientSecret && input.clientSecret.trim()) {
        updateData.zoomClientSecret = encryptToken(input.clientSecret.trim());
      }
    }

    await adminDb.collection('workspaces').doc(workspaceId).set(updateData, { merge: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Clears custom OAuth credentials for a provider from a workspace, reverting to Organization Defaults.
 */
export async function clearWorkspaceOAuthCredentialsAction(
  workspaceId: string,
  provider: 'google_calendar' | 'microsoft_teams' | 'zoom'
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireWorkspace(workspaceId);
  if (!ctx.isSystemAdmin && ctx.profile?.role !== 'admin' && ctx.profile?.role !== 'manager') {
    return { success: false, error: 'Unauthorized: Workspace admin or manager permissions required to clear API credentials.' };
  }

  try {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (provider === 'google_calendar') {
      updateData.googleClientId = FieldValue.delete();
      updateData.googleClientSecret = FieldValue.delete();
    } else if (provider === 'microsoft_teams') {
      updateData.microsoftClientId = FieldValue.delete();
      updateData.microsoftClientSecret = FieldValue.delete();
      updateData.microsoftTenantId = FieldValue.delete();
    } else if (provider === 'zoom') {
      updateData.zoomClientId = FieldValue.delete();
      updateData.zoomClientSecret = FieldValue.delete();
    }

    await adminDb.collection('workspaces').doc(workspaceId).update(updateData);
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Saves and encrypts OAuth Client ID and Secret for a given provider at the organization level.
 */
export async function saveOrganizationOAuthCredentialsAction(
  organizationId: string,
  input: OAuthCredentialsInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { uid: userId } = await requireAuth();
    await assertUserTenantPermission(userId, organizationId, 'administrator');

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    if (input.provider === 'google_calendar') {
      if (input.clientId !== undefined) {
        updateData.googleClientId = input.clientId.trim();
      }
      if (input.clientSecret && input.clientSecret.trim()) {
        updateData.googleClientSecret = encryptToken(input.clientSecret.trim());
      }
    } else if (input.provider === 'microsoft_teams') {
      if (input.clientId !== undefined) {
        updateData.microsoftClientId = input.clientId.trim();
      }
      if (input.clientSecret && input.clientSecret.trim()) {
        updateData.microsoftClientSecret = encryptToken(input.clientSecret.trim());
      }
      if (input.tenantId !== undefined) {
        updateData.microsoftTenantId = input.tenantId.trim() || null;
      }
    } else if (input.provider === 'zoom') {
      if (input.clientId !== undefined) {
        updateData.zoomClientId = input.clientId.trim();
      }
      if (input.clientSecret && input.clientSecret.trim()) {
        updateData.zoomClientSecret = encryptToken(input.clientSecret.trim());
      }
    }

    await adminDb.collection('organizations').doc(organizationId).set(updateData, { merge: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Retrieves OAuth credentials configuration status (without leaking secrets) for a workspace,
 * seamlessly incorporating the 2-tier fallback hierarchy: Workspace Override -> Organization Default -> Environment.
 */
export async function getWorkspaceOAuthCredentialsStatusAction(
  workspaceId: string
): Promise<{ success: boolean; data?: WorkspaceOAuthStatus; error?: string }> {
  await requireWorkspace(workspaceId);

  try {
    const baseUrl = getBaseUrl();
    const redirectUris = {
      google: `${baseUrl}/api/integrations/google/callback`,
      microsoft: `${baseUrl}/api/integrations/microsoft/callback`,
      zoom: `${baseUrl}/api/integrations/zoom/callback`,
    };

    let wsGoogleClientId: string | undefined;
    let wsGoogleSecret = false;
    let wsMsClientId: string | undefined;
    let wsMsSecret = false;
    let wsMsTenantId: string | undefined;
    let wsZoomClientId: string | undefined;
    let wsZoomSecret = false;
    let organizationId: string | undefined;

    if (workspaceId) {
      const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
      if (wsDoc.exists) {
        const wsData = wsDoc.data();
        if (wsData?.googleClientId) wsGoogleClientId = (wsData.googleClientId as string).trim();
        if (wsData?.googleClientSecret) wsGoogleSecret = true;
        if (wsData?.microsoftClientId) wsMsClientId = (wsData.microsoftClientId as string).trim();
        if (wsData?.microsoftClientSecret) wsMsSecret = true;
        if (wsData?.microsoftTenantId) wsMsTenantId = (wsData.microsoftTenantId as string).trim();
        if (wsData?.zoomClientId) wsZoomClientId = (wsData.zoomClientId as string).trim();
        if (wsData?.zoomClientSecret) wsZoomSecret = true;
        if (wsData?.organizationId) organizationId = wsData.organizationId as string;
      }
    }

    // Check organization level if any provider not configured at workspace level
    let orgGoogleClientId: string | undefined;
    let orgGoogleSecret = false;
    let orgMsClientId: string | undefined;
    let orgMsSecret = false;
    let orgMsTenantId: string | undefined;
    let orgZoomClientId: string | undefined;
    let orgZoomSecret = false;

    if (organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const orgData = orgDoc.data();
        if (orgData?.googleClientId) orgGoogleClientId = (orgData.googleClientId as string).trim();
        if (orgData?.googleClientSecret) orgGoogleSecret = true;
        if (orgData?.microsoftClientId) orgMsClientId = (orgData.microsoftClientId as string).trim();
        if (orgData?.microsoftClientSecret) orgMsSecret = true;
        if (orgData?.microsoftTenantId) orgMsTenantId = (orgData.microsoftTenantId as string).trim();
        if (orgData?.zoomClientId) orgZoomClientId = (orgData.zoomClientId as string).trim();
        if (orgData?.zoomClientSecret) orgZoomSecret = true;
      }
    }

    // Check env fallbacks
    const envGoogleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const envMsConfigured = !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
    const envZoomConfigured = !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);

    // Google resolution
    let googleSource: OAuthCredentialSource = 'none';
    let googleConfigured = false;
    let googleClientIdDisplay: string | undefined;
    let googleHasSecret = false;

    if (wsGoogleClientId && wsGoogleSecret) {
      googleSource = 'workspace';
      googleConfigured = true;
      googleClientIdDisplay = wsGoogleClientId;
      googleHasSecret = true;
    } else if (orgGoogleClientId && orgGoogleSecret) {
      googleSource = 'organization';
      googleConfigured = true;
      googleClientIdDisplay = orgGoogleClientId;
      googleHasSecret = true;
    } else if (envGoogleConfigured) {
      googleSource = 'env';
      googleConfigured = true;
      googleClientIdDisplay = '*** (Environment Configured)';
      googleHasSecret = true;
    }

    // Microsoft resolution
    let msSource: OAuthCredentialSource = 'none';
    let msConfigured = false;
    let msClientIdDisplay: string | undefined;
    let msHasSecret = false;
    const msTenantIdDisplay = wsMsTenantId || orgMsTenantId || process.env.MICROSOFT_TENANT_ID || undefined;

    if (wsMsClientId && wsMsSecret) {
      msSource = 'workspace';
      msConfigured = true;
      msClientIdDisplay = wsMsClientId;
      msHasSecret = true;
    } else if (orgMsClientId && orgMsSecret) {
      msSource = 'organization';
      msConfigured = true;
      msClientIdDisplay = orgMsClientId;
      msHasSecret = true;
    } else if (envMsConfigured) {
      msSource = 'env';
      msConfigured = true;
      msClientIdDisplay = '*** (Environment Configured)';
      msHasSecret = true;
    }

    // Zoom resolution
    let zoomSource: OAuthCredentialSource = 'none';
    let zoomConfigured = false;
    let zoomClientIdDisplay: string | undefined;
    let zoomHasSecret = false;

    if (wsZoomClientId && wsZoomSecret) {
      zoomSource = 'workspace';
      zoomConfigured = true;
      zoomClientIdDisplay = wsZoomClientId;
      zoomHasSecret = true;
    } else if (orgZoomClientId && orgZoomSecret) {
      zoomSource = 'organization';
      zoomConfigured = true;
      zoomClientIdDisplay = orgZoomClientId;
      zoomHasSecret = true;
    } else if (envZoomConfigured) {
      zoomSource = 'env';
      zoomConfigured = true;
      zoomClientIdDisplay = '*** (Environment Configured)';
      zoomHasSecret = true;
    }

    return {
      success: true,
      data: {
        google: {
          configured: googleConfigured,
          clientId: googleClientIdDisplay,
          hasSecret: googleHasSecret,
          source: googleSource,
        },
        microsoft: {
          configured: msConfigured,
          clientId: msClientIdDisplay,
          hasSecret: msHasSecret,
          tenantId: msTenantIdDisplay,
          source: msSource,
        },
        zoom: {
          configured: zoomConfigured,
          clientId: zoomClientIdDisplay,
          hasSecret: zoomHasSecret,
          source: zoomSource,
        },
        redirectUris,
      },
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Retrieves OAuth credentials configuration status (without leaking secrets) for an organization.
 */
export async function getOrganizationOAuthCredentialsStatusAction(
  organizationId: string
): Promise<{ success: boolean; data?: OrganizationOAuthStatus; error?: string }> {
  try {
    const { uid: userId } = await requireAuth();
    await assertUserTenantPermission(userId, organizationId, 'administrator');

    const baseUrl = getBaseUrl();
    const redirectUris = {
      google: `${baseUrl}/api/integrations/google/callback`,
      microsoft: `${baseUrl}/api/integrations/microsoft/callback`,
      zoom: `${baseUrl}/api/integrations/zoom/callback`,
    };

    let orgGoogleClientId: string | undefined;
    let orgGoogleSecret = false;
    let orgMsClientId: string | undefined;
    let orgMsSecret = false;
    let orgMsTenantId: string | undefined;
    let orgZoomClientId: string | undefined;
    let orgZoomSecret = false;

    if (organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const orgData = orgDoc.data();
        if (orgData?.googleClientId) orgGoogleClientId = (orgData.googleClientId as string).trim();
        if (orgData?.googleClientSecret) orgGoogleSecret = true;
        if (orgData?.microsoftClientId) orgMsClientId = (orgData.microsoftClientId as string).trim();
        if (orgData?.microsoftClientSecret) orgMsSecret = true;
        if (orgData?.microsoftTenantId) orgMsTenantId = (orgData.microsoftTenantId as string).trim();
        if (orgData?.zoomClientId) orgZoomClientId = (orgData.zoomClientId as string).trim();
        if (orgData?.zoomClientSecret) orgZoomSecret = true;
      }
    }

    const envGoogleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const envMsConfigured = !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
    const envZoomConfigured = !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);

    const googleSource: 'organization' | 'env' | 'none' = (orgGoogleClientId && orgGoogleSecret)
      ? 'organization'
      : envGoogleConfigured ? 'env' : 'none';

    const msSource: 'organization' | 'env' | 'none' = (orgMsClientId && orgMsSecret)
      ? 'organization'
      : envMsConfigured ? 'env' : 'none';

    const zoomSource: 'organization' | 'env' | 'none' = (orgZoomClientId && orgZoomSecret)
      ? 'organization'
      : envZoomConfigured ? 'env' : 'none';

    return {
      success: true,
      data: {
        google: {
          configured: googleSource !== 'none',
          clientId: orgGoogleClientId || (envGoogleConfigured ? '*** (Environment Configured)' : undefined),
          hasSecret: orgGoogleSecret || !!process.env.GOOGLE_CLIENT_SECRET,
          source: googleSource,
        },
        microsoft: {
          configured: msSource !== 'none',
          clientId: orgMsClientId || (envMsConfigured ? '*** (Environment Configured)' : undefined),
          hasSecret: orgMsSecret || !!process.env.MICROSOFT_CLIENT_SECRET,
          tenantId: orgMsTenantId || process.env.MICROSOFT_TENANT_ID || undefined,
          source: msSource,
        },
        zoom: {
          configured: zoomSource !== 'none',
          clientId: orgZoomClientId || (envZoomConfigured ? '*** (Environment Configured)' : undefined),
          hasSecret: orgZoomSecret || !!process.env.ZOOM_CLIENT_SECRET,
          source: zoomSource,
        },
        redirectUris,
      },
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

'use server';

/**
 * @fileOverview Secure Server Actions for Activity & Event Analytics (Phase 6)
 *
 * Provides cryptographically verified server endpoints for telemetry ingestion,
 * DAU/MAU adoption calculations, team performance leaderboards, least-privilege heatmap,
 * and saved directory view management.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - All administrative actions perform `adminAuth.verifyIdToken()`.
 * - Multi-tenant scoping enforced on every query and mutation.
 * - Zero `any` or `any[]` typing.
 */

import { adminAuth } from '@/lib/firebase-admin';
import { PlatformEventService } from '@/lib/services/analytics/platform-event-service';
import { WorkforceMetricsService } from '@/lib/services/analytics/workforce-metrics-service';
import { PermissionUsageService } from '@/lib/services/analytics/permission-usage-service';
import { SavedDirectoryViewService } from '@/lib/services/analytics/saved-directory-view-service';
import type {
  PlatformEvent,
  PlatformEventCategory,
  PlatformEventType,
  OrganizationAdoptionSummary,
  MemberActivityMetric,
  SavedDirectoryView,
} from '@/lib/types';

// Helper to verify caller token
async function verifyCaller(idToken: string) {
  if (!idToken) throw new Error('Missing authentication token');
  return await adminAuth.verifyIdToken(idToken);
}

// ----------------------------------------------------
// 1. TELEMETRY ACTIONS
// ----------------------------------------------------

export async function ingestPlatformEventAction(params: {
  idToken: string;
  organizationId: string;
  data: {
    workspaceId?: string;
    eventType: PlatformEventType;
    category: PlatformEventCategory;
    targetEntity?: string;
    targetId?: string;
    metadata?: Record<string, string | number | boolean | string[]>;
  };
}): Promise<{ success: boolean; event?: PlatformEvent; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const event = await PlatformEventService.ingestEvent(params.organizationId, {
      ...params.data,
      personId: decoded.uid,
      personName: decoded.name || decoded.email || 'Member',
      personEmail: decoded.email || '',
    });
    return { success: true, event };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to ingest event';
    return { success: false, error: msg };
  }
}

export async function listPlatformEventsAction(params: {
  idToken: string;
  organizationId: string;
  category?: PlatformEventCategory;
  limitCount?: number;
}): Promise<{ success: boolean; events: PlatformEvent[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const events = await PlatformEventService.listRecentEvents(params.organizationId, {
      category: params.category,
      limitCount: params.limitCount || 50,
    });
    return { success: true, events };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list platform events';
    return { success: false, events: [], error: msg };
  }
}

// ----------------------------------------------------
// 2. ADOPTION & PERFORMANCE METRICS ACTIONS
// ----------------------------------------------------

export async function getWorkforceAdoptionMetricsAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{
  success: boolean;
  summary?: OrganizationAdoptionSummary;
  memberMetrics: MemberActivityMetric[];
  error?: string;
}> {
  try {
    await verifyCaller(params.idToken);
    const res = await WorkforceMetricsService.calculateAdoptionMetrics(params.organizationId);
    return { success: true, summary: res.summary, memberMetrics: res.memberMetrics };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate adoption metrics';
    return { success: false, memberMetrics: [], error: msg };
  }
}

export async function getTeamLeaderboardAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{
  success: boolean;
  leaderboard: Array<{
    teamId: string;
    teamName: string;
    memberCount: number;
    activeMemberCount: number;
    activePercent: number;
    weeklyEventVolume: number;
  }>;
  error?: string;
}> {
  try {
    await verifyCaller(params.idToken);
    const leaderboard = await WorkforceMetricsService.getTeamEngagementLeaderboard(params.organizationId);
    return { success: true, leaderboard };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get team leaderboard';
    return { success: false, leaderboard: [], error: msg };
  }
}

// ----------------------------------------------------
// 3. LEAST-PRIVILEGE PERMISSION USAGE ACTIONS
// ----------------------------------------------------

export async function getLeastPrivilegeReportAction(params: {
  idToken: string;
  organizationId: string;
  roleId?: string;
}): Promise<{
  success: boolean;
  roles: Array<{
    roleId: string;
    roleName: string;
    totalPermissions: number;
    usedPermissions: number;
    dormantPermissions: number;
    utilizationRate: number;
    records: Array<{
      id: string;
      organizationId: string;
      roleId: string;
      roleName: string;
      permissionId: string;
      actionCount90d: number;
      lastUsedAt?: string;
      isDormant: boolean;
    }>;
  }>;
  error?: string;
}> {
  try {
    await verifyCaller(params.idToken);
    const res = await PermissionUsageService.getLeastPrivilegeReport(
      params.organizationId,
      params.roleId
    );
    return { success: true, roles: res.roles };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate least-privilege report';
    return { success: false, roles: [], error: msg };
  }
}

// ----------------------------------------------------
// 4. SAVED DIRECTORY VIEWS ACTIONS
// ----------------------------------------------------

export async function listSavedDirectoryViewsAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; views: SavedDirectoryView[]; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const views = await SavedDirectoryViewService.listSavedViews(params.organizationId, decoded.uid);
    return { success: true, views };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list saved views';
    return { success: false, views: [], error: msg };
  }
}

export async function createOrUpdateSavedViewAction(params: {
  idToken: string;
  organizationId: string;
  viewId?: string;
  data: {
    name: string;
    icon?: string;
    filters: SavedDirectoryView['filters'];
  };
}): Promise<{ success: boolean; view?: SavedDirectoryView; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const view = await SavedDirectoryViewService.createOrUpdateSavedView(
      params.organizationId,
      decoded.uid,
      {
        viewId: params.viewId,
        name: params.data.name,
        icon: params.data.icon,
        filters: params.data.filters,
      }
    );
    return { success: true, view };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save directory view';
    return { success: false, error: msg };
  }
}

export async function deleteSavedViewAction(params: {
  idToken: string;
  organizationId: string;
  viewId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    await SavedDirectoryViewService.deleteSavedView(params.organizationId, params.viewId, decoded.uid);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete saved view';
    return { success: false, error: msg };
  }
}

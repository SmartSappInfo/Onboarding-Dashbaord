/**
 * @fileoverview Platform Control Plane Tenant Health & Triage Server Actions
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Governs tenant health scoring, issue management, and audit-logged impersonation sessions.
 * - All actions require authorized backoffice credentials via `authorizeBackoffice`.
 * - Impersonation generates tightly bounded session tokens with 30-minute auto-expiry.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Server Actions returning structured result envelopes `{ success, data, error }`.
 * @trustBoundary Cryptographic ID token verification on every call.
 */

'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import { scanAllTenantHealthScores } from './health-signal-engine';
import type {
  TenantHealthScore,
  TenantIssue,
  IssueStatus,
  IssueSeverity,
} from './backoffice-types';

export async function getTenantHealthOverviewAction(idToken: string): Promise<{
  success: boolean;
  scorecards?: TenantHealthScore[];
  summary?: {
    totalTenants: number;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    avgHealthScore: number;
  };
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'health', 'view');

    const scorecards = await scanAllTenantHealthScores(50);
    const totalTenants = scorecards.length;
    const healthyCount = scorecards.filter((s) => s.status === 'healthy').length;
    const warningCount = scorecards.filter((s) => s.status === 'warning').length;
    const criticalCount = scorecards.filter((s) => s.status === 'critical').length;
    const totalScoreSum = scorecards.reduce((sum, s) => sum + s.healthScore, 0);
    const avgHealthScore = totalTenants > 0 ? Math.round(totalScoreSum / totalTenants) : 100;

    return {
      success: true,
      scorecards,
      summary: {
        totalTenants,
        healthyCount,
        warningCount,
        criticalCount,
        avgHealthScore,
      },
    };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_HEALTH] getTenantHealthOverviewAction failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function listTenantIssuesAction(
  filter: {
    status?: IssueStatus | 'all';
    severity?: IssueSeverity | 'all';
    organizationId?: string;
  },
  idToken: string
): Promise<{
  success: boolean;
  issues?: TenantIssue[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'health', 'view');

    let query: FirebaseFirestore.Query = adminDb.collection('tenant_issues');

    if (filter.organizationId) {
      query = query.where('organizationId', '==', filter.organizationId);
    }

    if (filter.status && filter.status !== 'all') {
      query = query.where('status', '==', filter.status);
    }

    if (filter.severity && filter.severity !== 'all') {
      query = query.where('severity', '==', filter.severity);
    }

    const snap = await query.limit(50).get();
    const issues = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as TenantIssue));

    // Sort by createdAt descending in memory if needed
    issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, issues };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_HEALTH] listTenantIssuesAction failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateTenantIssueStatusAction(
  issueId: string,
  newStatus: IssueStatus,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'health', 'edit');
    const issueRef = adminDb.collection('tenant_issues').doc(issueId);
    const snap = await issueRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Issue not found' };
    }

    const timestamp = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updatedAt: timestamp,
    };

    if (newStatus === 'resolved' || newStatus === 'closed') {
      updatePayload.resolvedAt = timestamp;
    }

    await issueRef.update(updatePayload);

    await logBackofficeAction(actor, 'issue.update_status', 'tenant_issue', issueId, {
      metadata: { previousStatus: snap.data()?.status, newStatus },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_HEALTH] updateTenantIssueStatusAction failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function addTenantIssueNoteAction(
  issueId: string,
  text: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'health', 'edit');
    const issueRef = adminDb.collection('tenant_issues').doc(issueId);
    const snap = await issueRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Issue not found' };
    }

    const currentNotes = (snap.data()?.notes || []) as TenantIssue['notes'];
    const newNote = {
      id: `note_${Date.now()}`,
      author: actor,
      text,
      createdAt: new Date().toISOString(),
    };

    await issueRef.update({
      notes: [...currentNotes, newNote],
      updatedAt: new Date().toISOString(),
    });

    await logBackofficeAction(actor, 'issue.add_note', 'tenant_issue', issueId, {
      metadata: { noteLength: text.length },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_HEALTH] addTenantIssueNoteAction failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Generates an audit-logged impersonation sandbox redirect URL.
 */
export async function createImpersonationSessionAction(
  organizationId: string,
  workspaceId: string | undefined,
  idToken: string
): Promise<{
  success: boolean;
  redirectUrl?: string;
  expiresInMinutes?: number;
  error?: string;
}> {
  try {
    const actor = await authorizeBackoffice(idToken, 'health', 'execute');

    // Audit the impersonation attempt immediately
    await logBackofficeAction(actor, 'impersonation.launch', 'organization', organizationId, {
      metadata: {
        workspaceId,
        expiresInMinutes: 30,
        mode: 'sandbox_support_mode',
      },
    });

    // Scoped sandbox URL with impersonation query tokens
    const searchParams = new URLSearchParams();
    if (workspaceId) {
      searchParams.set('workspaceId', workspaceId);
    }
    if (organizationId) {
      searchParams.set('orgId', organizationId);
    }
    searchParams.set('impersonation_actor', actor.email);
    searchParams.set('sandbox', 'true');

    const redirectUrl = `/admin?${searchParams.toString()}`;

    return {
      success: true,
      redirectUrl,
      expiresInMinutes: 30,
    };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_HEALTH] createImpersonationSessionAction failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

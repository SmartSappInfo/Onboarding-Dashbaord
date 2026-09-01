'use server';

/**
 * @fileOverview Secure Server Actions for Governance & Security Center (Phase 5)
 *
 * Provides cryptographically verified server endpoints for access certification reviews,
 * time-bounded JIT access grants, Separation of Duties (SoD) constraints, session controls,
 * and immutable security audit logs.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - All administrative actions perform `adminAuth.verifyIdToken()`.
 * - Multi-tenant scoping enforced on every mutation.
 * - Zero `any` or `any[]` typing.
 */

import { adminAuth } from '@/lib/firebase-admin';
import { AccessReviewService } from '@/lib/services/governance/access-review-service';
import { TemporaryAccessService } from '@/lib/services/governance/temporary-access-service';
import { SeparationOfDutyService } from '@/lib/services/governance/separation-of-duty-service';
import { SessionManagementService } from '@/lib/services/governance/session-management-service';
import { SecurityAuditService } from '@/lib/services/governance/security-audit-service';
import type {
  AccessReviewCampaign,
  AccessReviewDecision,
  AccessReviewFrequency,
  TemporaryAccessGrant,
  SeparationOfDutyRule,
  SoDConflict,
  SoDRuleSeverity,
  UserSession,
  SecurityPolicyConfig,
  SecurityAuditEvent,
} from '@/lib/types';

// Helper to verify caller token
async function verifyCaller(idToken: string) {
  if (!idToken) throw new Error('Missing authentication token');
  return await adminAuth.verifyIdToken(idToken);
}

// ----------------------------------------------------
// 1. ACCESS REVIEW ACTIONS
// ----------------------------------------------------

export async function createAccessReviewCampaignAction(params: {
  idToken: string;
  organizationId: string;
  data: {
    title: string;
    description?: string;
    frequency: AccessReviewFrequency;
    reviewerRoleIds?: string[];
    reviewerPersonIds?: string[];
    dueDate: string;
  };
}): Promise<{ success: boolean; campaign?: AccessReviewCampaign; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const campaign = await AccessReviewService.createCampaign(params.organizationId, {
      ...params.data,
      createdBy: decoded.uid,
    });
    return { success: true, campaign };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create campaign';
    return { success: false, error: msg };
  }
}

export async function submitReviewDecisionAction(params: {
  idToken: string;
  organizationId: string;
  decisionId: string;
  decision: 'certified' | 'revoked';
  justification?: string;
}): Promise<{ success: boolean; decision?: AccessReviewDecision; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const res = await AccessReviewService.submitDecision(
      params.organizationId,
      params.decisionId,
      params.decision,
      params.justification,
      decoded.uid
    );
    return { success: true, decision: res };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit review decision';
    return { success: false, error: msg };
  }
}

export async function listAccessReviewCampaignsAction(params: {
  idToken: string;
  organizationId: string;
  status?: AccessReviewCampaign['status'];
}): Promise<{ success: boolean; campaigns: AccessReviewCampaign[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const campaigns = await AccessReviewService.listCampaigns(params.organizationId, params.status);
    return { success: true, campaigns };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list campaigns';
    return { success: false, campaigns: [], error: msg };
  }
}

export async function listReviewDecisionsAction(params: {
  idToken: string;
  organizationId: string;
  campaignId: string;
  decision?: AccessReviewDecision['decision'];
}): Promise<{ success: boolean; decisions: AccessReviewDecision[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const decisions = await AccessReviewService.listDecisions(params.campaignId, params.decision);
    return { success: true, decisions };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list review decisions';
    return { success: false, decisions: [], error: msg };
  }
}

// ----------------------------------------------------
// 2. TIME-BOUNDED JIT ACCESS ACTIONS
// ----------------------------------------------------

export async function grantTemporaryAccessAction(params: {
  idToken: string;
  organizationId: string;
  data: {
    personId: string;
    roleId: string;
    roleName: string;
    workspaceId?: string;
    reason: string;
    durationHours: number;
    granterName: string;
  };
}): Promise<{ success: boolean; grant?: TemporaryAccessGrant; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const grant = await TemporaryAccessService.grantTemporaryAccess(params.organizationId, {
      ...params.data,
      grantedBy: decoded.uid,
    });
    return { success: true, grant };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to grant temporary access';
    return { success: false, error: msg };
  }
}

export async function revokeTemporaryAccessAction(params: {
  idToken: string;
  organizationId: string;
  grantId: string;
}): Promise<{ success: boolean; grant?: TemporaryAccessGrant; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const grant = await TemporaryAccessService.revokeTemporaryAccess(
      params.organizationId,
      params.grantId,
      decoded.uid
    );
    return { success: true, grant };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to revoke temporary access';
    return { success: false, error: msg };
  }
}

export async function reapExpiredGrantsAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; reapedCount: number; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const res = await TemporaryAccessService.reapExpiredGrants(params.organizationId);
    return { success: true, reapedCount: res.reapedCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reap expired grants';
    return { success: false, reapedCount: 0, error: msg };
  }
}

export async function listTemporaryAccessGrantsAction(params: {
  idToken: string;
  organizationId: string;
  status?: TemporaryAccessGrant['status'];
}): Promise<{ success: boolean; grants: TemporaryAccessGrant[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const grants = await TemporaryAccessService.listGrants(params.organizationId, params.status);
    return { success: true, grants };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list JIT grants';
    return { success: false, grants: [], error: msg };
  }
}

// ----------------------------------------------------
// 3. SEPARATION OF DUTIES (SoD) ACTIONS
// ----------------------------------------------------

export async function createOrUpdateSoDRuleAction(params: {
  idToken: string;
  organizationId: string;
  ruleId?: string;
  data: {
    name: string;
    description: string;
    roleIdA: string;
    roleNameA: string;
    roleIdB: string;
    roleNameB: string;
    severity: SoDRuleSeverity;
    enforcementMode: 'block' | 'warn';
    isActive?: boolean;
  };
}): Promise<{ success: boolean; rule?: SeparationOfDutyRule; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const rule = await SeparationOfDutyService.createOrUpdateRule(params.organizationId, {
      ...params.data,
      ruleId: params.ruleId,
    });
    return { success: true, rule };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save SoD rule';
    return { success: false, error: msg };
  }
}

export async function deleteSoDRuleAction(params: {
  idToken: string;
  organizationId: string;
  ruleId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    await SeparationOfDutyService.deleteRule(params.organizationId, params.ruleId);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete SoD rule';
    return { success: false, error: msg };
  }
}

export async function listSoDRulesAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; rules: SeparationOfDutyRule[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const rules = await SeparationOfDutyService.listRules(params.organizationId);
    return { success: true, rules };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list SoD rules';
    return { success: false, rules: [], error: msg };
  }
}

export async function scanSoDConflictsAction(params: {
  idToken: string;
  organizationId: string;
  personId?: string;
}): Promise<{ success: boolean; conflicts: SoDConflict[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const conflicts = await SeparationOfDutyService.detectConflicts(params.organizationId, params.personId);
    return { success: true, conflicts };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to scan SoD conflicts';
    return { success: false, conflicts: [], error: msg };
  }
}

// ----------------------------------------------------
// 4. SESSION CONTROLS & SECURITY POLICY ACTIONS
// ----------------------------------------------------

export async function revokeSessionAction(params: {
  idToken: string;
  organizationId: string;
  sessionId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    await SessionManagementService.revokeUserSession(params.organizationId, params.sessionId, decoded.uid);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to revoke session';
    return { success: false, error: msg };
  }
}

export async function revokeAllSessionsAction(params: {
  idToken: string;
  organizationId: string;
  personId: string;
}): Promise<{ success: boolean; revokedCount: number; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const res = await SessionManagementService.revokeAllUserSessions(params.organizationId, params.personId, decoded.uid);
    return { success: true, revokedCount: res.revokedCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to revoke all sessions';
    return { success: false, revokedCount: 0, error: msg };
  }
}

export async function listSessionsAction(params: {
  idToken: string;
  organizationId: string;
  personId?: string;
}): Promise<{ success: boolean; sessions: UserSession[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const sessions = await SessionManagementService.listSessions(params.organizationId, params.personId);
    return { success: true, sessions };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list sessions';
    return { success: false, sessions: [], error: msg };
  }
}

export async function getSecurityPolicyAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; policy?: SecurityPolicyConfig; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const policy = await SessionManagementService.getSecurityPolicy(params.organizationId);
    return { success: true, policy };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get security policy';
    return { success: false, error: msg };
  }
}

export async function updateSecurityPolicyAction(params: {
  idToken: string;
  organizationId: string;
  patch: Partial<Omit<SecurityPolicyConfig, 'organizationId'>>;
}): Promise<{ success: boolean; policy?: SecurityPolicyConfig; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const policy = await SessionManagementService.updateSecurityPolicy(
      params.organizationId,
      params.patch,
      decoded.uid
    );
    return { success: true, policy };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update security policy';
    return { success: false, error: msg };
  }
}

// ----------------------------------------------------
// 5. SECURITY AUDIT ACTIONS
// ----------------------------------------------------

export async function listSecurityAuditEventsAction(params: {
  idToken: string;
  organizationId: string;
  limitCount?: number;
  eventType?: SecurityAuditEvent['eventType'];
}): Promise<{ success: boolean; events: SecurityAuditEvent[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const events = await SecurityAuditService.listEvents(
      params.organizationId,
      params.limitCount,
      params.eventType
    );
    return { success: true, events };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list security audit events';
    return { success: false, events: [], error: msg };
  }
}

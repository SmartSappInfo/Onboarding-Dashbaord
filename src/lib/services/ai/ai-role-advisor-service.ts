/**
 * @fileOverview AI Role & Access Advisor Service (Phase 8)
 *
 * Synthesizes identity, authorization telemetry, and risk factors to generate
 * actionable, explainable recommendations for least-privilege pruning, role right-sizing,
 * and SoD remediation.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - All applied recommendations route through deterministic services.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `ai-workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  AiWorkforceRecommendation,
  AiRecommendationType,
  AiRecommendationPriority,
  AiRecommendationStatus,
} from '@/lib/types';
import { AiIdentityContextResolver } from './ai-identity-context-resolver';
import { PersonService } from '@/lib/services/identity/person-service';
import { OrganizationMembershipService } from '@/lib/services/identity/organization-membership-service';
import { SecurityAuditService } from '@/lib/services/governance/security-audit-service';

export class AiRoleAdvisorService {
  private static collectionName = 'ai_workforce_recommendations';

  /**
   * Scans an organization and generates explainable AI workforce recommendations.
   */
  static async generateRecommendations(
    organizationId: string
  ): Promise<AiWorkforceRecommendation[]> {
    const people = await PersonService.getOrganizationPeopleDirectory(organizationId);
    const recommendations: AiWorkforceRecommendation[] = [];

    for (const p of people) {
      const personId = p.person.id;
      const personName = p.person.displayName || p.person.email || personId;
      const ctx = await AiIdentityContextResolver.resolvePersonContext(organizationId, personId);

      // 1. Check for Excessive Unused Permissions
      if (ctx.totalGrantedPermissions > 12 && ctx.leastPrivilegeUtilizationPercent < 25) {
        const recId = `rec_prune_${organizationId}_${personId}`;
        const rec: AiWorkforceRecommendation = {
          id: recId,
          organizationId,
          type: 'dormant_permission_prune',
          priority: 'high',
          title: `Prune ${ctx.unusedPermissionIds.length} Dormant Permissions for ${personName}`,
          explanation: `Member utilizes only ${ctx.leastPrivilegeUtilizationPercent}% of their assigned permissions over a 90-day observation period. Trimming unused entitlements enforces least-privilege compliance.`,
          evidence: [
            `Total Granted: ${ctx.totalGrantedPermissions} permissions`,
            `Zero-Usage Count: ${ctx.unusedPermissionIds.length} permissions in 90 days`,
            `Assigned Roles: ${ctx.roleIds.join(', ') || 'Custom Direct'}`,
          ],
          riskDelta: -25,
          targetPersonId: personId,
          targetPersonName: personName,
          proposedActionPayload: {
            action: 'trim_permissions',
            personId,
            unusedCount: ctx.unusedPermissionIds.length,
          },
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        recommendations.push(rec);
      }

      // 2. Check for Separation of Duties Conflict
      if (ctx.sodConflictCount > 0) {
        const recId = `rec_sod_${organizationId}_${personId}`;
        const rec: AiWorkforceRecommendation = {
          id: recId,
          organizationId,
          type: 'sod_conflict_remediate',
          priority: 'critical',
          title: `Remediate Toxic Role Combination for ${personName}`,
          explanation: `Member possesses conflicting roles that violate organizational Separation of Duties controls. Revoking the secondary role eliminates toxic self-approval pathways.`,
          evidence: [
            `Active SoD Violations: ${ctx.sodConflictCount} toxic pairings`,
            `Assigned Roles: ${ctx.roleIds.join(', ')}`,
          ],
          riskDelta: -30,
          targetPersonId: personId,
          targetPersonName: personName,
          proposedActionPayload: {
            action: 'revoke_conflicting_role',
            personId,
            roleToRemove: ctx.roleIds[1] || ctx.roleIds[0],
          },
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        recommendations.push(rec);
      }

      // 3. Check for Orphaned CRM Deals on Suspended/Dormant Account
      if (ctx.membershipStatus !== 'active' && ctx.hasActiveCrmDeals) {
        const recId = `rec_crm_${organizationId}_${personId}`;
        const rec: AiWorkforceRecommendation = {
          id: recId,
          organizationId,
          type: 'crm_portfolio_rebalance',
          priority: 'high',
          title: `Reassign $${ctx.totalPipelineValue.toLocaleString()} in Pipeline Deals from Inactive ${personName}`,
          explanation: `Member account is ${ctx.membershipStatus} but still assigned active pipeline deals and open tasks. Immediate reassignment protects sales continuity.`,
          evidence: [
            `Pipeline Value: $${ctx.totalPipelineValue.toLocaleString()}`,
            `Open Tasks: ${ctx.openTasksCount}`,
            `Account Status: ${ctx.membershipStatus}`,
          ],
          riskDelta: -20,
          targetPersonId: personId,
          targetPersonName: personName,
          proposedActionPayload: {
            action: 'reassign_portfolio',
            sourcePersonId: personId,
            pipelineValue: ctx.totalPipelineValue,
          },
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        recommendations.push(rec);
      }
    }

    // Persist recommendations
    const batch = adminDb.batch();
    for (const rec of recommendations) {
      const ref = adminDb.collection(this.collectionName).doc(rec.id);
      batch.set(ref, rec, { merge: true });
    }
    await batch.commit();

    return recommendations;
  }

  /**
   * Applies an AI recommendation deterministically.
   */
  static async applyRecommendation(
    organizationId: string,
    recommendationId: string,
    executedBy: string
  ): Promise<AiWorkforceRecommendation> {
    const docRef = adminDb.collection(this.collectionName).doc(recommendationId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error(`Recommendation ${recommendationId} not found.`);
    }

    const rec = snap.data() as AiWorkforceRecommendation;
    if (rec.status !== 'active') {
      throw new Error(`Recommendation is already ${rec.status}.`);
    }

    // Deterministic Execution Gate
    if (rec.type === 'sod_conflict_remediate') {
      const roleToRemove = rec.proposedActionPayload.roleToRemove as string;
      if (roleToRemove) {
        const membership = await OrganizationMembershipService.getMembership(
          organizationId,
          rec.targetPersonId
        );
        if (membership) {
          const remainingRoles = (membership.roles || []).filter((r) => r !== roleToRemove);
          await OrganizationMembershipService.updateMembershipRoles(
            organizationId,
            rec.targetPersonId,
            remainingRoles
          );
        }
      }
    }

    const updated: AiWorkforceRecommendation = {
      ...rec,
      status: 'applied',
      appliedAt: new Date().toISOString(),
      appliedBy: executedBy,
    };

    await docRef.set(updated, { merge: true });

    // Compliance Audit Receipt
    await SecurityAuditService.logEvent(organizationId, {
      eventType: 'role_revoked',
      actorId: executedBy,
      actorName: 'AI Security Advisor',
      targetId: rec.targetPersonId,
      targetName: rec.targetPersonName,
      description: `Applied AI recommendation: ${rec.title} (Risk Delta: ${rec.riskDelta}).`,
    });

    return updated;
  }

  /**
   * Dismisses an AI recommendation.
   */
  static async dismissRecommendation(
    organizationId: string,
    recommendationId: string
  ): Promise<void> {
    const docRef = adminDb.collection(this.collectionName).doc(recommendationId);
    await docRef.update({
      status: 'dismissed',
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Lists active or filtered recommendations for an organization.
   */
  static async listRecommendations(
    organizationId: string,
    status: AiRecommendationStatus = 'active'
  ): Promise<AiWorkforceRecommendation[]> {
    const snap = await adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId)
      .where('status', '==', status)
      .get();

    const recs = snap.docs.map((d) => d.data() as AiWorkforceRecommendation);
    return recs.sort((a, b) => {
      const prioOrder: Record<AiRecommendationPriority, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      return prioOrder[b.priority] - prioOrder[a.priority];
    });
  }
}

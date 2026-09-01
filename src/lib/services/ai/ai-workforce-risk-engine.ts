/**
 * @fileOverview Multi-Factor AI Workforce Risk Engine (Phase 8)
 *
 * Evaluates holistic risk scores (0-100) per workforce member based on
 * over-privilege rates, toxic SoD combinations, dormancy, and orphaned CRM assets.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Deterministic scoring baseline augmented with factor breakdowns.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `ai-workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MemberRiskScore,
  OrganizationRiskOverview,
  RiskFactorContribution,
  WorkforceRiskLevel,
} from '@/lib/types';
import { AiIdentityContextResolver } from './ai-identity-context-resolver';
import { PersonService } from '@/lib/services/identity/person-service';

export class AiWorkforceRiskEngine {
  private static collectionName = 'member_risk_scores';

  /**
   * Evaluates a member's composite workforce risk score (0-100).
   */
  static async evaluateMemberRiskScore(
    organizationId: string,
    personId: string
  ): Promise<MemberRiskScore> {
    const person = await PersonService.getPerson(personId);
    const personName = person?.displayName || person?.email || personId;
    const personEmail = person?.email || '';

    const ctx = await AiIdentityContextResolver.resolvePersonContext(organizationId, personId);
    const factors: RiskFactorContribution[] = [];
    let score = 0;

    // Factor 1: Over-Privilege Risk (0 - 35 pts)
    if (ctx.totalGrantedPermissions > 10 && ctx.leastPrivilegeUtilizationPercent < 25) {
      const overPrivScore = Math.min(
        35,
        Math.round((1 - ctx.leastPrivilegeUtilizationPercent / 100) * 35)
      );
      score += overPrivScore;
      factors.push({
        factor: 'Excessive Unused Permissions',
        scoreContribution: overPrivScore,
        detail: `${ctx.unusedPermissionIds.length} unused permissions across ${ctx.roleIds.length} roles (${ctx.leastPrivilegeUtilizationPercent}% 90d utilization).`,
      });
    }

    // Factor 2: Separation of Duty Conflicts (0 - 30 pts)
    if (ctx.sodConflictCount > 0) {
      const sodScore = Math.min(30, ctx.sodConflictCount * 15);
      score += sodScore;
      factors.push({
        factor: 'Toxic Separation of Duties Pairing',
        scoreContribution: sodScore,
        detail: `Holds ${ctx.sodConflictCount} incompatible role permission pairings violating internal controls.`,
      });
    }

    // Factor 3: Inactivity & Dormancy (0 - 20 pts)
    if (ctx.lastActiveDaysAgo > 60 && ctx.totalGrantedPermissions > 0) {
      const dormancyScore = Math.min(20, Math.floor((ctx.lastActiveDaysAgo - 60) / 10) * 5 + 5);
      score += dormancyScore;
      factors.push({
        factor: 'Dormant Account Exposure',
        scoreContribution: dormancyScore,
        detail: `No platform login or activity in ${ctx.lastActiveDaysAgo} days while retaining active permissions.`,
      });
    }

    // Factor 4: Orphaned CRM Assets Held (0 - 15 pts)
    if (ctx.membershipStatus !== 'active' && ctx.hasActiveCrmDeals) {
      score += 15;
      factors.push({
        factor: 'Orphaned Pipeline Exposure',
        scoreContribution: 15,
        detail: `Inactive or suspended member still assigned $${ctx.totalPipelineValue.toLocaleString()} in pipeline deals.`,
      });
    }

    // Determine Risk Level
    let level: WorkforceRiskLevel = 'low';
    if (score >= 76) level = 'critical';
    else if (score >= 51) level = 'high';
    else if (score >= 26) level = 'medium';

    const riskScore: MemberRiskScore = {
      personId,
      personName,
      personEmail,
      departmentName: person?.departmentId,
      teamName: person?.teamId,
      score,
      level,
      factors,
      lastEvaluatedAt: new Date().toISOString(),
    };

    // Cache evaluation in Firestore
    try {
      await adminDb
        .collection(this.collectionName)
        .doc(`${organizationId}_${personId}`)
        .set({ ...riskScore, organizationId }, { merge: true });
    } catch {
      // Fallback
    }

    return riskScore;
  }

  /**
   * Generates organization-wide risk overview and posture statistics.
   */
  static async getOrganizationRiskOverview(
    organizationId: string
  ): Promise<OrganizationRiskOverview> {
    const people = await PersonService.getOrganizationPeopleDirectory(organizationId);
    const scores: MemberRiskScore[] = [];

    for (const p of people) {
      const score = await this.evaluateMemberRiskScore(organizationId, p.person.id);
      scores.push(score);
    }

    const totalScore = scores.reduce((a, b) => a + b.score, 0);
    const averageScore = scores.length > 0 ? Math.round(totalScore / scores.length) : 0;

    const criticalRiskCount = scores.filter((s) => s.level === 'critical').length;
    const highRiskCount = scores.filter((s) => s.level === 'high').length;
    const mediumRiskCount = scores.filter((s) => s.level === 'medium').length;
    const lowRiskCount = scores.filter((s) => s.level === 'low').length;

    return {
      organizationId,
      averageScore,
      criticalRiskCount,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      topRiskFactors: [
        'Unused Administrative Permissions',
        'Separation of Duties Toxic Pairings',
        'Dormant High-Privilege Accounts',
        'Orphaned Sales Pipeline Portfolios',
      ],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

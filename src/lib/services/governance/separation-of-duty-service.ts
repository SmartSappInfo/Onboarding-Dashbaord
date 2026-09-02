/**
 * @fileOverview Separation of Duties (SoD) Conflict Engine (Governance 2.0)
 *
 * Enforces organizational guardrails against toxic role combinations
 * (e.g. Billing Officer + Payment Approver, Deal Owner + Contract Signer).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Runs pre-flight checks before role assignments and bulk workforce actions.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `governance-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { SeparationOfDutyRule, SoDConflict, SoDRuleSeverity } from '@/lib/types';
import { PersonService } from '@/lib/services/identity/person-service';

export class SeparationOfDutyService {
  private static collectionName = 'sod_rules';

  /**
   * Creates or updates a Separation of Duties constraint rule.
   */
  static async createOrUpdateRule(
    organizationId: string,
    payload: {
      ruleId?: string;
      name: string;
      description: string;
      roleIdA: string;
      roleNameA: string;
      roleIdB: string;
      roleNameB: string;
      severity: SoDRuleSeverity;
      enforcementMode: 'block' | 'warn';
      isActive?: boolean;
    }
  ): Promise<SeparationOfDutyRule> {
    if (payload.roleIdA === payload.roleIdB) {
      throw new Error('Separation of Duties rule must specify two distinct roles.');
    }

    const docRef = payload.ruleId
      ? adminDb.collection(this.collectionName).doc(payload.ruleId)
      : adminDb.collection(this.collectionName).doc();

    const now = new Date().toISOString();
    const rule: SeparationOfDutyRule = {
      id: docRef.id,
      organizationId,
      name: payload.name.trim(),
      description: payload.description.trim(),
      roleIdA: payload.roleIdA,
      roleNameA: payload.roleNameA,
      roleIdB: payload.roleIdB,
      roleNameB: payload.roleNameB,
      severity: payload.severity,
      enforcementMode: payload.enforcementMode,
      isActive: payload.isActive !== undefined ? payload.isActive : true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(rule, { merge: true });
    return rule;
  }

  /**
   * Deletes an SoD rule.
   */
  static async deleteRule(organizationId: string, ruleId: string): Promise<void> {
    const docRef = adminDb.collection(this.collectionName).doc(ruleId);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const data = snap.data() as SeparationOfDutyRule;
    if (data.organizationId !== organizationId) {
      throw new Error('Tenant boundary mismatch');
    }

    await docRef.delete();
  }

  /**
   * Lists all SoD rules for an organization.
   */
  static async listRules(organizationId: string): Promise<SeparationOfDutyRule[]> {
    const snap = await adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId)
      .get();

    const rules = snap.docs.map((d) => d.data() as SeparationOfDutyRule);
    return rules.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Scans a specific member or all organization members for SoD conflicts.
   */
  static async detectConflicts(
    organizationId: string,
    personId?: string
  ): Promise<SoDConflict[]> {
    const rules = (await this.listRules(organizationId)).filter((r) => r.isActive);
    if (rules.length === 0) return [];

    const people = personId
      ? [await PersonService.getPerson(personId)].filter(Boolean)
      : (await PersonService.getOrganizationPeopleDirectory(organizationId)).map((p) => p.person);

    const conflicts: SoDConflict[] = [];

    for (const person of people) {
      if (!person) continue;
      const memDoc = await adminDb
        .collection('users')
        .doc(person.id)
        .get();

      const userRoles: string[] = memDoc.exists ? memDoc.data()?.roles || [] : [];
      const userRoleNames: string[] = memDoc.exists ? memDoc.data()?.roleNames || [] : [];

      for (const rule of rules) {
        const hasA = userRoles.includes(rule.roleIdA);
        const hasB = userRoles.includes(rule.roleIdB);

        if (hasA && hasB) {
          conflicts.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            personId: person.id,
            personName: person.displayName || person.email,
            conflictingRoleIds: [rule.roleIdA, rule.roleIdB],
            conflictingRoleNames: [rule.roleNameA, rule.roleNameB],
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Pre-flight check before assigning a role to a person.
   */
  static async validateRoleAssignment(
    organizationId: string,
    personId: string,
    newRoleId: string
  ): Promise<{ isValid: boolean; conflict?: SoDConflict }> {
    const rules = (await this.listRules(organizationId)).filter((r) => r.isActive);
    if (rules.length === 0) return { isValid: true };

    const userDoc = await adminDb.collection('users').doc(personId).get();
    const existingRoles: string[] = userDoc.exists ? userDoc.data()?.roles || [] : [];
    const proposedRoles = Array.from(new Set([...existingRoles, newRoleId]));

    for (const rule of rules) {
      const hasA = proposedRoles.includes(rule.roleIdA);
      const hasB = proposedRoles.includes(rule.roleIdB);

      if (hasA && hasB) {
        const conflict: SoDConflict = {
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          personId,
          personName: userDoc.data()?.name || personId,
          conflictingRoleIds: [rule.roleIdA, rule.roleIdB],
          conflictingRoleNames: [rule.roleNameA, rule.roleNameB],
        };

        if (rule.enforcementMode === 'block') {
          return { isValid: false, conflict };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Alias for detecting SoD conflicts for a specific user.
   */
  static async detectToxicPairingsForUser(
    organizationId: string,
    personId: string
  ): Promise<SoDConflict[]> {
    return this.detectConflicts(organizationId, personId);
  }
}

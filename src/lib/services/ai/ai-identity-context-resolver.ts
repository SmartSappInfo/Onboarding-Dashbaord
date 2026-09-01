/**
 * @fileOverview AI Identity & Authorization Context Resolver (Phase 8)
 *
 * Assembles sanitized, multi-dimensional identity context vectors combining
 * canonical profile, role permissions, 90-day activity telemetry, CRM ownership,
 * and SoD conflict analysis.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Redacts all personal PII, auth tokens, and sensitive credentials.
 * - Strictly typed vector schema for AI inference.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `ai-workforce-services.test.ts`.
 */

import { PersonService } from '@/lib/services/identity/person-service';
import { PermissionUsageService } from '@/lib/services/analytics/permission-usage-service';
import { SeparationOfDutyService } from '@/lib/services/governance/separation-of-duty-service';
import { CrmWorkloadService } from '@/lib/services/workforce/crm-workload-service';
import { OrganizationMembershipService } from '@/lib/services/identity/organization-membership-service';

export interface SanitizedPersonAiContext {
  personId: string;
  departmentId?: string;
  teamId?: string;
  roleIds: string[];
  totalGrantedPermissions: number;
  leastPrivilegeUtilizationPercent: number;
  unusedPermissionIds: string[];
  sodConflictCount: number;
  hasActiveCrmDeals: boolean;
  totalPipelineValue: number;
  openTasksCount: number;
  membershipStatus: string;
  lastActiveDaysAgo: number;
  isMfaEnforced: boolean;
}

export class AiIdentityContextResolver {
  /**
   * Resolves a privacy-sanitized, authorization-aware context vector for AI reasoning.
   */
  static async resolvePersonContext(
    organizationId: string,
    personId: string
  ): Promise<SanitizedPersonAiContext> {
    const [person, membership, usageReport, conflicts, crmWorkload] = await Promise.all([
      PersonService.getPerson(personId),
      OrganizationMembershipService.getMembership(organizationId, personId),
      PermissionUsageService.getMemberLeastPrivilegeReport(organizationId, personId),
      SeparationOfDutyService.detectToxicPairingsForUser(organizationId, personId),
      CrmWorkloadService.getPersonCrmWorkload(organizationId, personId),
    ]);

    const roleIds = membership?.roles || [];
    const unusedPermissionIds = usageReport.unusedPermissions.map((p) => p.id);

    // Calculate days since last active
    let lastActiveDaysAgo = 999;
    if (person?.updatedAt) {
      const diffMs = Date.now() - new Date(person.updatedAt).getTime();
      lastActiveDaysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      personId,
      departmentId: person?.departmentId,
      teamId: person?.teamId,
      roleIds,
      totalGrantedPermissions: usageReport.totalGrantedPermissions,
      leastPrivilegeUtilizationPercent: usageReport.utilizationPercentage,
      unusedPermissionIds,
      sodConflictCount: conflicts.length,
      hasActiveCrmDeals: crmWorkload.dealCount > 0,
      totalPipelineValue: crmWorkload.totalPipelineValue,
      openTasksCount: crmWorkload.openTaskCount,
      membershipStatus: membership?.status || 'active',
      lastActiveDaysAgo,
      isMfaEnforced: false, // Default or tenant MFA policy
    };
  }
}

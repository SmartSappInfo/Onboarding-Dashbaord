/**
 * @fileOverview Offboarding & Deactivation Safety Gatekeeper (Phase 7)
 *
 * Pre-flight validation gate ensuring no workforce member can be deactivated or deleted
 * while holding active CRM assets or automation ownership.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Prevents orphaned customer accounts during workforce transitions.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `crm-workforce-services.test.ts`.
 */

import type { OffboardingReadinessCheck } from '@/lib/types';
import { CrmWorkloadService } from './crm-workload-service';

export class OffboardingGuardService {
  /**
   * Evaluates whether a member can be safely deactivated or removed.
   */
  static async validateOffboardingReadiness(
    organizationId: string,
    personId: string
  ): Promise<OffboardingReadinessCheck> {
    const workload = await CrmWorkloadService.getPersonCrmWorkload(organizationId, personId);
    const blockingReasons: string[] = [];

    if (workload.dealCount > 0) {
      blockingReasons.push(
        `Holds ${workload.dealCount} active pipeline deals ($${workload.totalPipelineValue.toLocaleString()})`
      );
    }
    if (workload.contactCount > 0) {
      blockingReasons.push(`Holds ${workload.contactCount} active contacts & leads`);
    }
    if (workload.openTaskCount > 0) {
      blockingReasons.push(`Has ${workload.openTaskCount} unresolved operational tasks`);
    }
    if (workload.automationCount > 0) {
      blockingReasons.push(`Owns ${workload.automationCount} active workflow automations`);
    }

    const canDeactivate = blockingReasons.length === 0;

    return {
      personId,
      canDeactivate,
      blockingReasons,
      workload,
    };
  }
}

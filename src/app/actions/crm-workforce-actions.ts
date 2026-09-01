'use server';

/**
 * @fileOverview Secure Server Actions for CRM-Aware Workforce & Ownership Transfers (Phase 7)
 *
 * Provides cryptographically verified server endpoints for calculating member CRM workloads,
 * multi-entity portfolio migrations, and offboarding safety gates.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - All administrative actions perform `adminAuth.verifyIdToken()`.
 * - Multi-tenant scoping enforced on every query and mutation.
 * - Zero `any` or `any[]` typing.
 */

import { adminAuth } from '@/lib/firebase-admin';
import { CrmWorkloadService } from '@/lib/services/workforce/crm-workload-service';
import { OwnershipTransferService } from '@/lib/services/workforce/ownership-transfer-service';
import { OffboardingGuardService } from '@/lib/services/workforce/offboarding-guard-service';
import type {
  CrmEntityType,
  CrmWorkloadSummary,
  CrmOwnershipTransferJob,
  OffboardingReadinessCheck,
} from '@/lib/types';

// Helper to verify caller token
async function verifyCaller(idToken: string) {
  if (!idToken) throw new Error('Missing authentication token');
  return await adminAuth.verifyIdToken(idToken);
}

// ----------------------------------------------------
// 1. WORKLOAD ACTIONS
// ----------------------------------------------------

export async function getPersonCrmWorkloadAction(params: {
  idToken: string;
  organizationId: string;
  personId: string;
}): Promise<{ success: boolean; workload?: CrmWorkloadSummary; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const workload = await CrmWorkloadService.getPersonCrmWorkload(
      params.organizationId,
      params.personId
    );
    return { success: true, workload };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get CRM workload';
    return { success: false, error: msg };
  }
}

export async function getOrganizationCrmWorkloadOverviewAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; workloads: CrmWorkloadSummary[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const workloads = await CrmWorkloadService.getOrganizationCrmWorkloadOverview(
      params.organizationId
    );
    return { success: true, workloads };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get CRM workload overview';
    return { success: false, workloads: [], error: msg };
  }
}

// ----------------------------------------------------
// 2. OWNERSHIP TRANSFER ACTIONS
// ----------------------------------------------------

export async function transferOwnershipAction(params: {
  idToken: string;
  organizationId: string;
  data: {
    sourcePersonId: string;
    targetPersonId: string;
    entityTypes: CrmEntityType[];
    reason?: string;
  };
}): Promise<{ success: boolean; job?: CrmOwnershipTransferJob; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const job = await OwnershipTransferService.transferOwnership(params.organizationId, {
      ...params.data,
      executedBy: decoded.uid,
    });
    return { success: true, job };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to transfer ownership';
    return { success: false, error: msg };
  }
}

export async function listOwnershipTransferJobsAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; jobs: CrmOwnershipTransferJob[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const jobs = await OwnershipTransferService.listTransferJobs(params.organizationId);
    return { success: true, jobs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list transfer jobs';
    return { success: false, jobs: [], error: msg };
  }
}

// ----------------------------------------------------
// 3. OFFBOARDING SAFETY ACTIONS
// ----------------------------------------------------

export async function checkOffboardingReadinessAction(params: {
  idToken: string;
  organizationId: string;
  personId: string;
}): Promise<{ success: boolean; readiness?: OffboardingReadinessCheck; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const readiness = await OffboardingGuardService.validateOffboardingReadiness(
      params.organizationId,
      params.personId
    );
    return { success: true, readiness };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to check offboarding readiness';
    return { success: false, error: msg };
  }
}

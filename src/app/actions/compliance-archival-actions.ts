'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Compliance, Legal Hold & e-Discovery Server Actions (Phase 9):
 * 1. Purpose & Scope:
 *    Provides server-side actions for litigation legal holds, statutory retention
 *    schedules, and cryptographic e-Discovery archival packages.
 * 2. Security & Tenant Isolation:
 *    Requires authenticated session context (`requireAuth()`) and workspace authorization
 *    (`requireWorkspace(workspaceId)`).
 * 3. Immutable Legal Hold Barrier (FM-P9-05):
 *    Placing a hold updates the authoritative root contract document and emits an
 *    audit record to `signing_evidence`.
 * 4. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import {
  placeContractLegalHold,
  releaseContractLegalHold,
  getContractLegalHoldStatus,
  calculateRetentionSchedule,
  RetentionScheduleResult,
} from '@/lib/documents/legal-hold-service';
import {
  assembleEDiscoveryZipBundle,
  EDiscoveryBundleResult,
} from '@/lib/documents/ediscovery-archival-service';
import {
  LegalHoldStatus,
  RetentionCategory,
  RetentionCategorySchema,
} from '@/lib/types/document-signing';

export interface ComplianceActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Places a contract on active legal hold, freezing it from deletion or purge (FM-P9-05).
 */
export async function placeContractLegalHoldAction(
  workspaceId: string,
  contractId: string,
  input: { matterId: string; reason: string }
): Promise<ComplianceActionResult<LegalHoldStatus>> {
  try {
    const session = await requireAuth();
    await requireWorkspace(workspaceId);

    if (!input.matterId?.trim() || !input.reason?.trim()) {
      return { success: false, error: 'Matter ID and reason are mandatory for legal hold.' };
    }

    const result = await placeContractLegalHold(workspaceId, contractId, input, session.uid);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to place legal hold';
    return { success: false, error: message };
  }
}

/**
 * Releases a contract from legal hold, returning it to standard lifecycle rules.
 */
export async function releaseContractLegalHoldAction(
  workspaceId: string,
  contractId: string,
  input: { reason?: string }
): Promise<ComplianceActionResult<LegalHoldStatus>> {
  try {
    const session = await requireAuth();
    await requireWorkspace(workspaceId);

    const result = await releaseContractLegalHold(workspaceId, contractId, input, session.uid);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to release legal hold';
    return { success: false, error: message };
  }
}

/**
 * Retrieves the current legal hold status for a contract.
 */
export async function getContractLegalHoldStatusAction(
  workspaceId: string,
  contractId: string
): Promise<ComplianceActionResult<LegalHoldStatus | null>> {
  try {
    await requireAuth();
    await requireWorkspace(workspaceId);

    const result = await getContractLegalHoldStatus(contractId);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch legal hold status';
    return { success: false, error: message };
  }
}

/**
 * Assembles and exports a court-admissible cryptographic e-Discovery ZIP package (FM-P9-06, FM-P9-09).
 */
export async function generateEDiscoveryPackageAction(
  workspaceId: string,
  contractId: string
): Promise<ComplianceActionResult<EDiscoveryBundleResult>> {
  try {
    const session = await requireAuth();
    await requireWorkspace(workspaceId);

    const result = await assembleEDiscoveryZipBundle(workspaceId, contractId, session.uid);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate e-Discovery package';
    return { success: false, error: message };
  }
}

/**
 * Computes statutory retention expiration for a given contract category.
 */
export async function getRetentionScheduleAction(
  workspaceId: string,
  category: RetentionCategory,
  executedAtIso: string
): Promise<ComplianceActionResult<RetentionScheduleResult>> {
  try {
    await requireAuth();
    await requireWorkspace(workspaceId);

    const validatedCategory = RetentionCategorySchema.parse(category);
    const result = calculateRetentionSchedule(validatedCategory, executedAtIso);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate retention schedule';
    return { success: false, error: message };
  }
}

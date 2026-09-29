'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Bulk Campaign Server Actions (Phase 9):
 * 1. Purpose & Standards:
 *    Provides server-side actions for orchestrating enterprise bulk document signing
 *    campaigns, CSV roster parsing, chunked slice dispatching, and failure retries.
 * 2. Security & Tenant Isolation:
 *    Every action enforces authenticated session context (`requireAuth()`) and
 *    workspace tenancy (`requireWorkspace(workspaceId)`).
 * 3. Rate-Limiting & Quota Defense (FM-P9-01, FM-P9-08):
 *    Dispatching is executed in bounded slices (default 25) to avoid serverless
 *    execution timeouts and mail/SMS gateway rate limits.
 * 4. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`. All inputs narrowed with Zod schemas.
 */

import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import { adminDb } from '@/lib/firebase-admin';
import {
  createBulkCampaign,
  dispatchCampaignBatchSlice,
  retryFailedCampaignRecipients,
  getCampaignProgress,
  DispatchSliceResult,
  RetryResult,
  BulkCampaignProgress,
} from '@/lib/documents/bulk-campaign-dispatcher-service';
import {
  parseBulkRecipientCsv,
  generateDryRunMergePreview,
} from '@/lib/documents/bulk-csv-merge-service';
import {
  BulkCampaign,
  BulkCampaignSchema,
  CreateBulkCampaignRequestSchema,
  BulkCsvMergePreviewResult,
} from '@/lib/types/document-signing';

export interface BulkCampaignActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Creates and stages a new bulk signing campaign with all recipient records.
 */
export async function createBulkCampaignAction(
  workspaceId: string,
  input: unknown
): Promise<BulkCampaignActionResult<BulkCampaign>> {
  try {
    const session = await requireAuth();
    await requireWorkspace(workspaceId);

    const parseResult = CreateBulkCampaignRequestSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Validation error: ${parseResult.error.errors.map((e) => e.message).join(', ')}`,
      };
    }

    const campaign = await createBulkCampaign(workspaceId, parseResult.data, session.uid);
    return { success: true, data: campaign };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create bulk campaign';
    return { success: false, error: message };
  }
}

/**
 * Parses uploaded CSV content and runs a pre-flight dry-run merge lint against template variables (FM-P9-04).
 */
export async function previewBulkCsvMergeAction(
  workspaceId: string,
  input: { csvContent: string; templateVariables: string[] }
): Promise<BulkCampaignActionResult<BulkCsvMergePreviewResult>> {
  try {
    await requireAuth();
    await requireWorkspace(workspaceId);

    if (!input.csvContent || typeof input.csvContent !== 'string') {
      return { success: false, error: 'CSV content must be provided as a non-empty string' };
    }

    const parsed = parseBulkRecipientCsv(input.csvContent);
    if (parsed.parseErrors.length > 0 && parsed.rows.length === 0) {
      return {
        success: false,
        error: `CSV Parsing failed: ${parsed.parseErrors.join('; ')}`,
      };
    }

    const preview = generateDryRunMergePreview(
      input.templateVariables || [],
      parsed.rows,
      5
    );

    return { success: true, data: preview };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate CSV merge preview';
    return { success: false, error: message };
  }
}

/**
 * Dispatches an asynchronous slice of queued recipients for a campaign (FM-P9-01).
 */
export async function dispatchBulkCampaignSliceAction(
  workspaceId: string,
  campaignId: string,
  batchSize = 25
): Promise<BulkCampaignActionResult<DispatchSliceResult>> {
  try {
    await requireAuth();
    await requireWorkspace(workspaceId);

    const result = await dispatchCampaignBatchSlice(campaignId, batchSize);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Slice dispatch failed';
    return { success: false, error: message };
  }
}

/**
 * Retries strictly failed recipients in a bulk campaign without resending to signed signers (FM-P9-03).
 */
export async function retryFailedCampaignRecipientsAction(
  workspaceId: string,
  campaignId: string
): Promise<BulkCampaignActionResult<RetryResult>> {
  try {
    await requireAuth();
    await requireWorkspace(workspaceId);

    const result = await retryFailedCampaignRecipients(campaignId);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retry failed recipients';
    return { success: false, error: message };
  }
}

/**
 * Retrieves live progress telemetry for a bulk campaign.
 */
export async function getBulkCampaignProgressAction(
  workspaceId: string,
  campaignId: string
): Promise<BulkCampaignActionResult<BulkCampaignProgress>> {
  try {
    await requireAuth();
    await requireWorkspace(workspaceId);

    const progress = await getCampaignProgress(campaignId);
    return { success: true, data: progress };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch campaign progress';
    return { success: false, error: message };
  }
}

/**
 * Lists all bulk campaigns belonging to the active workspace.
 */
export async function listWorkspaceBulkCampaignsAction(
  workspaceId: string
): Promise<BulkCampaignActionResult<BulkCampaign[]>> {
  try {
    await requireAuth();
    await requireWorkspace(workspaceId);

    const snap = await adminDb
      .collection('bulk_campaigns')
      .where('workspaceId', '==', workspaceId)
      .limit(100)
      .get();

    const campaigns: BulkCampaign[] = [];
    snap.docs.forEach((d) => {
      try {
        const parsed = BulkCampaignSchema.parse(d.data());
        campaigns.push(parsed);
      } catch (err) {
        console.warn(`[listWorkspaceBulkCampaignsAction] Skipping malformed campaign ${d.id}:`, err);
      }
    });

    // Sort by createdAt DESC in memory to avoid requiring complex composite index initially
    campaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, data: campaigns };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list bulk campaigns';
    return { success: false, error: message };
  }
}

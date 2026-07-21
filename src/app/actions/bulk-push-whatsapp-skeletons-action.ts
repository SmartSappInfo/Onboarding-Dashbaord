'use server';

import { requireOrgAdmin } from '@/lib/auth/require-org-admin';
import { adminDb } from '@/lib/firebase-admin';
import { WhatsAppCredentialRepository } from '@/lib/whatsapp/whatsapp-credential-repository';
import { MetaCloudApiClient } from '@/lib/whatsapp/meta-cloud-client';
import {
  buildCreateTemplatePayload,
  buildWhatsAppTemplateId,
  stripComponentExamples,
  toPositionalBody,
  validateCreateTemplateInput
} from '@/lib/whatsapp/whatsapp-domain';
import { WhatsAppTemplateRepository } from '@/lib/whatsapp/whatsapp-template-repository';
import { toWhatsAppTemplateName } from '@/app/admin/messaging/templates/lib/unified-template';
import type { WhatsAppTemplate, WhatsAppTemplateCategory } from '@/lib/whatsapp/whatsapp-types';

/** A skeleton that could not be pushed — surfaced per item so one bad template
 *  never hides the rest of the batch. */
export interface BulkPushFailure {
  id: string;
  name: string;
  error: string;
}

/** A skeleton that needed no action (already pushed, missing, or not a skeleton). */
export interface BulkPushSkip {
  id: string;
  name: string;
  reason: string;
}

export interface BulkPushResult {
  /** False only when the batch itself could not run (auth / credentials). */
  success: boolean;
  pushed: number;
  failed: BulkPushFailure[];
  skipped: BulkPushSkip[];
  /** Batch-level error, when `success` is false. */
  error?: string;
}

/** The subset of a `message_templates` skeleton this action reads. */
interface SkeletonDoc {
  name?: string;
  body?: string;
  channel?: string;
  whatsappTemplateName?: string;
  category?: string;
  templateType?: string;
  organizationId?: string;
  /** Authored sample values, one per variable in body order. */
  whatsappSamples?: string[];
  /** Authored Meta template category. */
  whatsappMetaCategory?: WhatsAppTemplateCategory;
  /** Authored Meta language code. */
  whatsappLanguage?: string;
}

const DEFAULT_TEMPLATE_LANGUAGE = 'en_US';

/**
 * Maximum templates pushed per invocation. Each push is a sequential Meta Graph
 * call plus Firestore writes, so an unbounded list would exhaust the request
 * budget and risk Meta rate limits. The remainder is reported and the caller
 * simply pushes again.
 */
const MAX_BULK_PUSH = 25;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'An unexpected error occurred.';
}

/**
 * Push offline-drafted WhatsApp "skeletons" (message_templates with no bound
 * Meta name) to Meta for approval.
 *
 * Resilient by design: each skeleton is pushed independently and a failure is
 * recorded against that item rather than aborting the batch, so a single invalid
 * template can no longer mask the outcome of every other one.
 */
export async function bulkPushWhatsAppSkeletonsAction(
  idToken: string,
  organizationId: string,
  skeletonIds: string[]
): Promise<BulkPushResult> {
  const failed: BulkPushFailure[] = [];
  const skipped: BulkPushSkip[] = [];
  let pushed = 0;

  try {
    await requireOrgAdmin(idToken, organizationId);

    const creds = await WhatsAppCredentialRepository.getCredentials(organizationId);
    if (!creds) {
      return { success: false, pushed: 0, failed, skipped, error: 'No WhatsApp connection configured.' };
    }

    const client = new MetaCloudApiClient(creds);

    // Normalise the client-supplied list: drop junk, de-duplicate, and bound the
    // work per invocation. The overflow is reported rather than silently dropped.
    const uniqueIds = Array.from(
      new Set(skeletonIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
    );
    const batch = uniqueIds.slice(0, MAX_BULK_PUSH);
    const remainder = uniqueIds.length - batch.length;
    if (remainder > 0) {
      skipped.push({
        id: '',
        name: `${remainder} template${remainder === 1 ? '' : 's'}`,
        reason: `Batch limit of ${MAX_BULK_PUSH} reached — ${remainder} remaining. Push again to continue.`,
      });
    }

    for (const skeletonId of batch) {
      let displayName = skeletonId;
      try {
        const snap = await adminDb.collection('message_templates').doc(skeletonId).get();
        if (!snap.exists) {
          skipped.push({ id: skeletonId, name: displayName, reason: 'Template no longer exists.' });
          continue;
        }
        const data = snap.data() as SkeletonDoc | undefined;
        if (!data) {
          skipped.push({ id: skeletonId, name: displayName, reason: 'Template has no data.' });
          continue;
        }

        // SECURITY (tenant isolation): the caller is authorised for `organizationId`
        // only. Document ids come from the client, so every document must be proven
        // to belong to that organization before it is read, mutated, or pushed to
        // this org's Meta account. The message deliberately does not disclose that
        // the document exists elsewhere, and we never echo its name.
        if (data.organizationId !== organizationId) {
          failed.push({
            id: skeletonId,
            name: skeletonId,
            error: 'Not found in this organization.',
          });
          continue;
        }

        displayName = data.name || skeletonId;

        if (data.channel !== 'whatsapp') {
          skipped.push({ id: skeletonId, name: displayName, reason: 'Not a WhatsApp template.' });
          continue;
        }
        if (data.whatsappTemplateName) {
          skipped.push({ id: skeletonId, name: displayName, reason: 'Already pushed to Meta.' });
          continue;
        }

        const { text: processedBody, paramMap } = toPositionalBody(data.body || '');

        const cleanName = toWhatsAppTemplateName(data.name || '');
        if (!cleanName) {
          failed.push({ id: skeletonId, name: displayName, error: 'Template name is empty or has no usable characters.' });
          continue;
        }

        // Use what the author captured; never invent sample values, because Meta
        // reviewers judge the template on them. Missing/short sample sets are
        // caught by the pre-flight below, which reports body problems first.
        const samples = (data.whatsappSamples ?? []).map((s) => (s ?? '').trim());

        const category: WhatsAppTemplateCategory = data.whatsappMetaCategory ?? 'UTILITY';
        const language = data.whatsappLanguage?.trim() || DEFAULT_TEMPLATE_LANGUAGE;
        const createInput = {
          name: cleanName,
          language,
          category,
          bodyText: processedBody,
          bodyExample: samples,
        };

        // Pre-flight against Meta's documented rules so an invalid template fails
        // here — with a specific, fixable reason — instead of coming back as an
        // opaque "Invalid parameter" from the Graph API.
        const check = validateCreateTemplateInput(createInput);
        if (!check.valid) {
          failed.push({
            id: skeletonId,
            name: displayName,
            error: check.error ?? 'Template does not meet WhatsApp requirements.',
          });
          continue;
        }

        const metaPayload = buildCreateTemplatePayload(createInput);
        const res = await client.createMessageTemplate(metaPayload);

        // Bind the skeleton to its newly-registered Meta template.
        await adminDb.collection('message_templates').doc(skeletonId).update({
          whatsappTemplateName: cleanName,
          whatsappLanguage: language,
          whatsappParamMap: paramMap,
          declaredVariables: paramMap,
          updatedAt: new Date().toISOString()
        });

        // Mirror locally as PENDING so the gallery reflects it before approval.
        const now = new Date().toISOString();
        const mirrorTemplate: WhatsAppTemplate = {
          id: buildWhatsAppTemplateId(organizationId, cleanName, language),
          organizationId,
          metaTemplateId: res.id,
          name: cleanName,
          language,
          category,
          status: 'PENDING',
          components: stripComponentExamples(metaPayload.components),
          paramCount: paramMap.length,
          ...(samples.length ? { exampleParams: samples } : {}),
          appCategory: (data.category as WhatsAppTemplate['appCategory']) || 'general',
          templateType: data.templateType || `custom_general_${Date.now()}`,
          paramMap,
          syncedAt: now,
        };

        await WhatsAppTemplateRepository.upsertMany([mirrorTemplate]);
        pushed++;
      } catch (itemError: unknown) {
        // Record and continue — never let one template abort the batch.
        console.error(`[bulkPushWhatsAppSkeletonsAction] "${displayName}" failed:`, itemError);
        failed.push({ id: skeletonId, name: displayName, error: errorMessage(itemError) });
      }
    }

    return { success: true, pushed, failed, skipped };
  } catch (e: unknown) {
    console.error('[bulkPushWhatsAppSkeletonsAction] Error:', e);
    return { success: false, pushed, failed, skipped, error: errorMessage(e) };
  }
}

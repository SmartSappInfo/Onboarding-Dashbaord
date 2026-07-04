// NOTE: intentionally NOT 'use server' — this is an internal job processor
// invoked only from an already-authorized entrypoint in backoffice-job-actions.

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logBackofficeAction } from './audit-logger';
import { getErrorMessage } from './backoffice-errors';
import { sealSecret, isEnvelope, isVaultConfigured } from './secret-vault';
import type { AuditActor, PlatformJob } from './backoffice-types';

const AI_KEY_FIELDS = ['geminiApiKey', 'claudeApiKey', 'openRouterApiKey'] as const;

/**
 * Migration: seals any legacy plaintext global AI keys in
 * `system_settings/ai_keys` into vault envelopes. Idempotent — values that
 * are already sealed (or empty) are skipped. Honors the job's dry-run flag.
 */
export async function processEncryptPlatformSecrets(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  const jobRef = adminDb.collection('platform_jobs').doc(jobId);

  try {
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) throw new Error('Job document missing.');
    const isDryRun = (jobSnap.data() as PlatformJob).isDryRun;

    if (!isVaultConfigured()) {
      throw new Error('Encryption vault is not configured; cannot seal secrets.');
    }

    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Started platform-secret encryption. Dry Run: ${isDryRun}. Initiated by ${actor.name}.`,
      }),
    });

    const docRef = adminDb.collection('system_settings').doc('ai_keys');
    const snap = await docRef.get();

    let sealed = 0;
    let skipped = 0;

    if (snap.exists) {
      const data = snap.data() ?? {};
      const updates: Record<string, unknown> = {};

      for (const field of AI_KEY_FIELDS) {
        const value = data[field];
        if (isEnvelope(value) || !value || typeof value !== 'string') {
          skipped += 1;
          continue;
        }
        // Legacy plaintext string → seal it.
        if (!isDryRun) updates[field] = sealSecret(value);
        sealed += 1;
      }

      if (!isDryRun && Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        updates.updatedBy = actor.userId;
        await docRef.set(updates, { merge: true });
      }
    }

    const summary = isDryRun
      ? `[DRY RUN] Would seal ${sealed} plaintext AI key(s); ${skipped} already sealed/empty. No writes performed.`
      : `Sealed ${sealed} plaintext AI key(s); ${skipped} already sealed/empty.`;

    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      'progress.total': sealed + skipped,
      'progress.processed': sealed,
      'progress.errors': 0,
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: summary,
      }),
    });

    if (!isDryRun) {
      await logBackofficeAction(actor, 'system_defaults.encrypt_secrets', 'system_settings', 'ai_keys', {
        metadata: { sealed, skipped },
      });
    }

    return { success: true };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[MIGRATION] processEncryptPlatformSecrets failed:', error);
    await jobRef.update({
      status: 'failed',
      completedAt: new Date().toISOString(),
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Encryption migration failed: ${message}`,
      }),
    });
    return { success: false, error: message };
  }
}

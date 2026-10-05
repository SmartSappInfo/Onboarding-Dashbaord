/**
 * @fileOverview Cloud Tasks worker: meeting recording transcription (Phase 11 M1 · T4).
 *
 * SECURITY (Rules 33, 51): Cloud Tasks HMAC handshake AND OIDC token, both fail-closed. The body is
 * `{ transcriptId }` only; everything else is reloaded server-side (never trust task state).
 * DEAD-MAN (Rule 60): the governance switch and `platform_config/meeting_controls.transcriptionPaused`
 * answer 503 so Cloud Tasks backs off and retries later.
 * RETRIES (Rule 25): a retryable outcome answers 503 (Cloud Tasks retries with backoff); the service
 * dead-letters after MAX_ATTEMPTS. Terminal outcomes answer 200 so the task is not retried.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { isAuthorizedCloudTaskRequest } from '@/lib/security/cloud-tasks-auth';
import { verifyCloudTasksOidcToken } from '@/lib/security/cloud-tasks-oidc';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { processTranscriptionTask } from '@/lib/meetings/transcription-service';
import { geminiTranscriptionProvider } from '@/lib/meetings/gemini-transcription-provider';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

const PayloadSchema = z.object({ transcriptId: z.string().regex(/^tr_[0-9a-f]{32}$/) });

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedCloudTaskRequest(request.headers))) {
    return NextResponse.json({ error: 'Unauthorized handshake signature' }, { status: 401 });
  }
  const oidc = await verifyCloudTasksOidcToken(request.headers);
  if (!oidc.authorized) {
    return NextResponse.json({ error: oidc.reason || 'Unauthorized OIDC token' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }
  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  try {
    await checkGovernanceDeadManSwitch();
  } catch {
    return NextResponse.json({ error: 'Paused by emergency switch', retryable: true }, { status: 503 });
  }

  try {
    const outcome = await processTranscriptionTask(adminDb, {
      provider: (id) => (id === 'googleai' ? geminiTranscriptionProvider : null),
      storage: {
        size: async (path) => {
          const [exists] = await adminStorage.file(path).exists();
          if (!exists) return null;
          const [meta] = await adminStorage.file(path).getMetadata();
          return Number(meta.size ?? 0);
        },
        download: async (path) => (await adminStorage.file(path).download())[0],
      },
      nowMs: () => Date.now(),
    }, parsed.data.transcriptId);

    if (outcome.status === 'retry') {
      return NextResponse.json({ status: 'retry', reason: outcome.reason, retryable: true }, { status: 503 });
    }
    return NextResponse.json(outcome, { status: 200 });
  } catch (err) {
    // Unexpected: let Cloud Tasks retry; the attempt counter bounds this.
    console.error('[MEETING-TRANSCRIPTION] unexpected error', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Transcription worker error', retryable: true }, { status: 500 });
  }
}

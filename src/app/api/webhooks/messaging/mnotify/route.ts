import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { incrementMessageNodeStat } from '@/lib/messaging/message-node-stats';
import type { MessageLog } from '@/lib/types';

const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';

function cleanPhoneSuffix(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.substring(digits.length - 9);
}

function normalizeMnotifyStatus(status: string): 'delivered' | 'bounced' | 'pending' {
  const s = status.toUpperCase().trim();
  if (s === 'DELIVRD' || s === 'DELIVERED' || s === 'SUCCESS') return 'delivered';
  if (s === 'EXPIRED' || s === 'UNDELIV' || s === 'FAILED' || s === 'BOUNCED') return 'bounced';
  return 'pending';
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

async function handleCallback(request: NextRequest) {
  try {
    // 1. Security Handshake Check
    const { searchParams } = new URL(request.url);
    const requestSecret = searchParams.get('secret') || request.headers.get('x-mnotify-secret');
    if (!requestSecret || requestSecret !== SECRET) {
      console.warn('[MNOTIFY-WEBHOOK] Unauthorized access attempt.');
      return NextResponse.json({ error: 'Unauthorized secret handshake' }, { status: 401 });
    }

    // 2. Parse callback parameters from body or query params
    let body: Record<string, unknown> = {};
    if (request.method === 'POST') {
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        // Fallback to URL search parameters if POST body is empty or not JSON
      }
    }

    const smsId = String(
      body.sms_id || body.id || searchParams.get('sms_id') || searchParams.get('id') || ''
    ).trim();
    const to = String(
      body.to || body.recipient || searchParams.get('to') || searchParams.get('recipient') || ''
    ).trim();
    const rawStatus = String(body.status || searchParams.get('status') || '').trim();

    if (!smsId || !to || !rawStatus) {
      console.warn('[MNOTIFY-WEBHOOK] Missing required parameters:', { smsId, to, rawStatus });
      return NextResponse.json({ error: 'Missing sms_id, to/recipient, or status' }, { status: 400 });
    }

    const targetStatus = normalizeMnotifyStatus(rawStatus);
    if (targetStatus === 'pending') {
      // Status is still pending, no updates needed yet
      return NextResponse.json({ success: true, message: 'Status pending. No action taken.' });
    }

    const cleanTo = cleanPhoneSuffix(to);
    console.info(
      `[MNOTIFY-WEBHOOK] Status update received for SMS ${smsId} to ...${cleanTo}: ${rawStatus} (${targetStatus})`
    );

    // 3. Query all logs with this providerId (batch or single send)
    const logsSnap = await adminDb
      .collection('message_logs')
      .where('providerId', '==', smsId)
      .get();

    if (logsSnap.empty) {
      console.warn(`[MNOTIFY-WEBHOOK] No message log found with providerId: ${smsId}`);
      return NextResponse.json({ message: 'No matching message log found' }, { status: 200 });
    }

    // Find the log matching our recipient's phone number suffix
    const matchedDoc = logsSnap.docs.find((doc) => {
      const data = doc.data() as MessageLog;
      return cleanPhoneSuffix(data.recipient) === cleanTo;
    });

    if (!matchedDoc) {
      console.warn(
        `[MNOTIFY-WEBHOOK] Found logs for providerId ${smsId} but none matched recipient suffix: ...${cleanTo}`
      );
      return NextResponse.json({ message: 'Recipient suffix mismatch' }, { status: 200 });
    }

    const logRef = matchedDoc.ref;
    const logData = matchedDoc.data() as MessageLog;

    // 4. Update the log status transactionally to prevent race conditions & double-counting
    const updated = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(logRef);
      if (!snap.exists) return false;

      const current = snap.data() as MessageLog;
      // Skip if the log is already marked as finalized (delivered or failed)
      if (current.providerStatus === 'delivered' || current.providerStatus === 'bounced') {
        return false;
      }

      const now = new Date().toISOString();
      tx.update(logRef, {
        providerStatus: targetStatus,
        status: targetStatus === 'delivered' ? 'delivered' : 'failed',
        updatedAt: now,
        ...(targetStatus === 'delivered' ? { deliveredAt: now } : { bouncedAt: now }),
      });

      return true;
    });

    // 5. Update the Message Node Stats if the log status was successfully updated
    if (updated) {
      const automationId = logData.automationId;
      const nodeId = logData.nodeId;
      if (automationId && nodeId) {
        try {
          await incrementMessageNodeStat({
            automationId,
            nodeId,
            workspaceId: logData.workspaceId || 'onboarding',
            organizationId: logData.organizationId,
            channel: 'sms',
            counter: targetStatus === 'delivered' ? 'delivered' : 'bounced',
          });
          console.info(`[MNOTIFY-WEBHOOK] Incremented stats for node ${nodeId} (${targetStatus})`);
        } catch (statErr: unknown) {
          const message = statErr instanceof Error ? statErr.message : String(statErr);
          console.warn('[MNOTIFY-WEBHOOK] Failed to increment node stat:', message);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[MNOTIFY-WEBHOOK] Critical error processing callback:', message);
    return NextResponse.json({ error: message || 'Webhook internal failure' }, { status: 500 });
  }
}

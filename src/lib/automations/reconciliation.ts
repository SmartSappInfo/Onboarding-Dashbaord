import { adminDb } from '../firebase-admin';
import { getSmsStatus } from '../mnotify-service';
import { incrementMessageNodeStat } from '../messaging/message-node-stats';
import { assertAutomationManagePermission } from '../automation-permissions';
import type { MessageLog } from '../types';

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

async function resolveMnotifyApiKey(organizationId?: string): Promise<string | undefined> {
  if (!organizationId) return undefined;
  try {
    const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
    if (orgSnap.exists) {
      const org = orgSnap.data();
      if (org?.smsKeyMode === 'custom' && org?.mnotifyApiKey) {
        return org.mnotifyApiKey as string;
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(">>> [RECONCILIATION] Failed to resolve custom API key:", message);
  }
  return undefined;
}

interface SmsReportItem {
  recipient?: string;
  to?: string;
  status?: string;
}

interface MnotifyStatusResponse {
  status?: string;
  report?: SmsReportItem[];
}

export async function reconcilePendingSmsLogs(
  automationId: string,
  nodeId: string,
  userId: string,
  workspaceId: string
): Promise<{ success: boolean; updatedCount: number }> {
  // 1. Assert permission
  await assertAutomationManagePermission(userId, [workspaceId], 'edit');

  // 2. Fetch pending logs
  const snap = await adminDb
    .collection('message_logs')
    .where('automationId', '==', automationId)
    .where('nodeId', '==', nodeId)
    .where('channel', '==', 'sms')
    .where('status', 'in', ['sent', 'pending'])
    .limit(100)
    .get();

  if (snap.empty) {
    return { success: true, updatedCount: 0 };
  }

  const logs = snap.docs.map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    ...(doc.data() as Omit<MessageLog, 'id'>),
  }));

  // Group logs by organizationId to resolve API keys
  const orgIds = Array.from(new Set(logs.map((l) => l.organizationId).filter(Boolean)));
  const keyMap: Record<string, string | undefined> = {};
  for (const orgId of orgIds) {
    if (orgId) {
      keyMap[orgId] = await resolveMnotifyApiKey(orgId);
    }
  }

  // Deduplicate calls by unique providerId
  const uniqueProviderIds = Array.from(new Set(logs.map((l) => l.providerId).filter(Boolean)));
  const statusMap: Record<string, MnotifyStatusResponse> = {};

  for (const providerId of uniqueProviderIds) {
    if (!providerId) continue;
    const firstLog = logs.find((l) => l.providerId === providerId);
    const apiKey = firstLog?.organizationId ? keyMap[firstLog.organizationId] : undefined;

    try {
      const data = await getSmsStatus(providerId, apiKey);
      statusMap[providerId] = data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[RECONCILIATION] Failed to get gateway status for providerId ${providerId}:`, message);
    }
  }

  let updatedCount = 0;

  // Process logs one-by-one inside separate transactional updates
  for (const log of logs) {
    if (!log.providerId) continue;
    const gatewayData = statusMap[log.providerId];
    if (!gatewayData) continue;

    let rawStatus = '';
    const cleanRecipient = cleanPhoneSuffix(log.recipient);

    if (gatewayData.report && Array.isArray(gatewayData.report)) {
      const reportList = gatewayData.report as SmsReportItem[];
      const matchedItem = reportList.find(
        (item) => cleanPhoneSuffix(item.recipient || item.to || '') === cleanRecipient
      );
      rawStatus = matchedItem?.status || gatewayData.status || '';
    } else {
      rawStatus = gatewayData.status || '';
    }

    const targetStatus = normalizeMnotifyStatus(rawStatus);
    if (targetStatus === 'pending') continue;

    // Transactionally update log status and stats
    const updated = await adminDb.runTransaction(async (tx) => {
      const docSnap = await tx.get(log.ref);
      if (!docSnap.exists) return false;

      const current = docSnap.data() as MessageLog;
      if (current.providerStatus === 'delivered' || current.providerStatus === 'bounced') {
        return false;
      }

      const now = new Date().toISOString();
      tx.update(log.ref, {
        providerStatus: targetStatus,
        status: targetStatus === 'delivered' ? 'delivered' : 'failed',
        updatedAt: now,
        ...(targetStatus === 'delivered' ? { deliveredAt: now } : { bouncedAt: now }),
      });

      return true;
    });

    if (updated) {
      updatedCount++;
      try {
        await incrementMessageNodeStat({
          automationId,
          nodeId,
          workspaceId: log.workspaceId || 'onboarding',
          organizationId: log.organizationId,
          channel: 'sms',
          counter: targetStatus === 'delivered' ? 'delivered' : 'bounced',
        });
      } catch (statErr: unknown) {
        const message = statErr instanceof Error ? statErr.message : String(statErr);
        console.warn('[RECONCILIATION] Failed to increment node stat:', message);
      }
    }
  }

  return { success: true, updatedCount };
}

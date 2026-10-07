/**
 * @fileOverview Helper: Record meeting agent security alerts (Rule 62).
 * Separated from Server Actions to satisfy export-sweep guard rules.
 */

import { randomUUID } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

/** Records a security event to the meeting agent security feed (Rule 62). */
export async function recordMeetingSecurityAlert(
  db: Firestore,
  alert: {
    type: 'injection_flagged' | 'fabrication_detected' | 'egress_blocked' | 'recipient_refused' | 'self_approval_blocked' | 'tampering_detected';
    workspaceId: string;
    meetingId: string;
    reason: string;
  }
): Promise<void> {
  try {
    const alertId = `sec_${randomUUID().replace(/-/g, '')}`;
    await db.collection('meeting_agent_security_feed').doc(alertId).set({
      alertId,
      ...alert,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[meeting-security] could not write security alert', err);
  }
}

'use server';

/**
 * @fileoverview Server Actions for CRM Integration, Deal Attribution & Lead Scoring.
 * Manages CRM context lookup, deal associations, and deterministic lead scoring.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Queries are scoped strictly to active workspaceId.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  CRMContactContext,
  MeetingDealAttribution,
  MeetingScoreEvent,
} from '@/lib/meetings/types/crm-attribution';
import {
  calculateLeadMeetingScore,
  DEFAULT_SCORE_WEIGHTS,
} from '@/lib/meetings/crm-attribution-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Retrieves CRM context for a contact associated with a meeting.
 */
export async function getMeetingCRMContextAction(
  workspaceId: string,
  contactEmail?: string,
  contactId?: string
): Promise<{ success: boolean; context?: CRMContactContext; error?: string }> {
  try {
    if (!contactEmail && !contactId) {
      throw new Error('Contact email or contact ID is required.');
    }

    let contactDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    if (contactId) {
      contactDoc = await adminDb.collection('contacts').doc(contactId).get();
    } else if (contactEmail) {
      const snap = await adminDb
        .collection('contacts')
        .where('workspaceId', '==', workspaceId)
        .where('email', '==', contactEmail.toLowerCase().trim())
        .limit(1)
        .get();

      if (!snap.empty) {
        contactDoc = snap.docs[0];
      }
    }

    const cData = contactDoc && contactDoc.exists ? contactDoc.data() : null;

    const actualContactId = contactDoc?.id || `anon_${Date.now()}`;
    const contactName = cData?.name || cData?.fullName || contactEmail?.split('@')[0] || 'Unknown Contact';
    const contactEmailResolved = cData?.email || contactEmail || '';
    const organizationName = cData?.organizationName || cData?.company || 'Direct Contact';
    const stageBadge = cData?.stage || cData?.status || 'Warm Lead';
    const tags = Array.isArray(cData?.tags) ? (cData.tags as string[]) : [];

    // Fetch associated deals
    const dealsSnap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', workspaceId)
      .where('contactId', '==', actualContactId)
      .limit(10)
      .get();

    const associatedDeals: MeetingDealAttribution[] = dealsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        dealId: doc.id,
        dealTitle: d.title || d.name || 'Untitled Deal',
        dealValue: Number(d.value) || 0,
        dealStage: d.stage || 'discovery',
        currency: d.currency || 'USD',
        associatedAt: d.createdAt || new Date().toISOString(),
        attributionModel: 'last_touch',
      };
    });

    // Fetch previous meeting activities
    const activitiesSnap = await adminDb
      .collection('meeting_activities')
      .where('workspaceId', '==', workspaceId)
      .where('actorEmail', '==', contactEmailResolved)
      .limit(10)
      .get();

    const previousInteractions = activitiesSnap.docs.map(doc => {
      const act = doc.data();
      return {
        type: 'meeting' as const,
        title: act.action || 'Meeting Activity',
        occurredAt: act.occurredAt || new Date().toISOString(),
        summary: act.details ? JSON.stringify(act.details) : undefined,
      };
    });

    // Calculate lead score
    const events: MeetingScoreEvent[] = activitiesSnap.docs.map(doc => {
      const act = doc.data();
      const eventType =
        act.action === 'participant_joined'
          ? 'meeting_attended'
          : act.action === 'booking_created'
          ? 'booking_created'
          : 'meeting_completed';

      return {
        eventType,
        occurredAt: act.occurredAt,
      };
    });

    const leadScore = calculateLeadMeetingScore(events);

    const context: CRMContactContext = {
      contactId: actualContactId,
      contactName,
      contactEmail: contactEmailResolved,
      organizationName,
      stageBadge,
      currentLeadScore: leadScore || (cData?.leadScore ? Number(cData.leadScore) : 45),
      tags,
      associatedDeals,
      previousInteractions,
    };

    return { success: true, context };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Associates a deal with a meeting touchpoint for pipeline attribution.
 */
export async function associateMeetingDealAction(payload: {
  meetingId: string;
  workspaceId: string;
  dealId: string;
  dealTitle: string;
  dealValue: number;
  dealStage: string;
  attributionModel?: 'first_touch' | 'last_touch' | 'linear';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      meetingId,
      workspaceId,
      dealId,
      dealTitle,
      dealValue,
      dealStage,
      attributionModel = 'last_touch',
    } = payload;

    const docRef = adminDb.collection('meeting_deal_attributions').doc(`${meetingId}_${dealId}`);
    const attributionData: MeetingDealAttribution & { meetingId: string; workspaceId: string } = {
      meetingId,
      workspaceId,
      dealId,
      dealTitle,
      dealValue,
      dealStage,
      associatedAt: new Date().toISOString(),
      attributionModel,
    };

    await docRef.set(attributionData);
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

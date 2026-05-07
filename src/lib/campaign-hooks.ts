'use client';

import * as React from 'react';
import { collection, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageCampaign, CampaignStatus } from '@/lib/types';

// ─── Real-time Hook ───────────────────────────────────────────────────────────

/**
 * Real-time Firestore subscription for campaigns scoped to a workspace.
 * Uses useCollection for automatic UI updates when campaign status changes server-side (R6 fix).
 */
export function useCampaigns(workspaceId: string | undefined) {
  const firestore = useFirestore();

  const campaignsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'message_campaigns'),
      where('workspaceId', '==', workspaceId),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, workspaceId]);

  const { data, isLoading, error } = useCollection<MessageCampaign>(campaignsQuery);

  return { campaigns: data || [], isLoading, error };
}

// ─── CRUD Actions ─────────────────────────────────────────────────────────────

const EMPTY_STATS = {
  totalTargeted: 0,
  totalSent: 0,
  totalFailed: 0,
  totalOpened: 0,
  totalClicked: 0,
};

/**
 * Creates a new campaign draft.
 * Returns the new campaign ID.
 */
export async function createCampaign(
  firestore: any,
  data: Omit<MessageCampaign, 'id' | 'stats' | 'createdAt' | 'updatedAt'> & { stats?: MessageCampaign['stats'] }
): Promise<string> {
  const now = new Date().toISOString();
  const campaignData = {
    ...data,
    stats: data.stats || EMPTY_STATS,
    status: data.status || 'draft',
    createdAt: now,
    updatedAt: now,
  };

  // Sanitize undefined values for Firestore
  const sanitized = JSON.parse(JSON.stringify(campaignData));
  const docRef = await addDoc(collection(firestore, 'message_campaigns'), sanitized);
  return docRef.id;
}

/**
 * Updates an existing campaign.
 * Only draft campaigns can be fully edited; sent/archived campaigns
 * only allow status changes.
 */
export async function updateCampaign(
  firestore: any,
  campaignId: string,
  data: Partial<MessageCampaign>
): Promise<void> {
  const sanitized = JSON.parse(JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString(),
  }));
  await updateDoc(doc(firestore, 'message_campaigns', campaignId), sanitized);
}

/**
 * Soft-deletes a campaign by setting status to 'archived'.
 * Industry standard: never hard-delete campaigns (audit trail).
 */
export async function archiveCampaign(
  firestore: any,
  campaignId: string
): Promise<void> {
  await updateDoc(doc(firestore, 'message_campaigns', campaignId), {
    status: 'archived' as CampaignStatus,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Hard deletes a campaign. Reserved for draft campaigns only.
 */
export async function deleteCampaign(
  firestore: any,
  campaignId: string
): Promise<void> {
  await deleteDoc(doc(firestore, 'message_campaigns', campaignId));
}

/**
 * Clones a campaign into a new draft (R5: content is already snapshotted).
 * Resets: status, stats, scheduledAt, sentAt, jobId.
 * Copies: channel, target, contentMode, content, audience, sender, style.
 */
export async function cloneCampaign(
  firestore: any,
  source: MessageCampaign,
  userId: string
): Promise<string> {
  const now = new Date().toISOString();
  const cloneData: any = {
    workspaceId: source.workspaceId,
    organizationId: source.organizationId,
    internalName: `Copy of ${source.internalName}`,
    channel: source.channel,
    target: source.target,
    templateId: source.templateId,
    templateName: source.templateName,
    contentMode: source.contentMode,
    customSubject: source.customSubject,
    customBody: source.customBody,
    customBlocks: source.customBlocks,
    styleId: source.styleId,
    audienceDefinition: source.audienceDefinition,
    estimatedRecipientCount: source.estimatedRecipientCount,
    senderProfileId: source.senderProfileId,
    postSendTagRules: source.postSendTagRules,
    automationHooks: source.automationHooks,
    // Reset lifecycle
    status: 'draft' as CampaignStatus,
    lastCompletedStep: source.lastCompletedStep,
    stats: EMPTY_STATS,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    // jobId, scheduledAt, sentAt intentionally omitted
  };

  const sanitized = JSON.parse(JSON.stringify(cloneData));
  const docRef = await addDoc(collection(firestore, 'message_campaigns'), sanitized);
  return docRef.id;
}

'use server';

import { requireOrgAdmin } from '@/lib/auth/require-org-admin';
import type { Channel } from '@/lib/messaging/sender-resolution';

export interface SetDefaultSenderInput {
  organizationId: string;
  channel: Channel;
  senderProfileId: string;
  /** Where to pin the default. Workspace overrides the org default. */
  scope: 'organization' | 'workspace';
  /** Required when scope === 'workspace'. */
  workspaceId?: string;
}

export interface SetDefaultSenderResult {
  success: boolean;
  error?: string;
}

/**
 * Pin the default sender profile for a channel at org or workspace level.
 *
 * Org/workspace docs are writable only by system admins per Firestore rules, so
 * this runs server-side after `requireOrgAdmin` and uses the admin SDK. It
 * validates that the chosen profile belongs to the org and matches the channel —
 * a default can never point at another tenant's sender.
 */
export async function setDefaultSenderProfileAction(
  idToken: string,
  input: SetDefaultSenderInput,
): Promise<SetDefaultSenderResult> {
  try {
    await requireOrgAdmin(idToken, input.organizationId);

    if (input.scope === 'workspace' && !input.workspaceId) {
      return { success: false, error: 'A workspace is required for a workspace-level default.' };
    }

    const { adminDb } = await import('@/lib/firebase-admin');

    const profileSnap = await adminDb.collection('sender_profiles').doc(input.senderProfileId).get();
    if (!profileSnap.exists) return { success: false, error: 'Sender profile not found.' };
    const profile = profileSnap.data();

    if (profile?.organizationId !== input.organizationId) {
      return { success: false, error: 'That sender belongs to a different organization.' };
    }
    if (profile?.channel !== input.channel) {
      return { success: false, error: `That sender is not a ${input.channel} sender.` };
    }
    if (profile?.isActive !== true) {
      return { success: false, error: 'That sender is inactive — activate it before making it the default.' };
    }

    const patch = { defaultSenderProfileIds: { [input.channel]: input.senderProfileId } };
    const now = new Date().toISOString();

    if (input.scope === 'workspace' && input.workspaceId) {
      await adminDb.collection('workspaces').doc(input.workspaceId).set({ ...patch, updatedAt: now }, { merge: true });
    } else {
      await adminDb.collection('organizations').doc(input.organizationId).set({ ...patch, updatedAt: now }, { merge: true });
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to set default sender.';
    console.error('[SET_DEFAULT_SENDER] failed:', message);
    return { success: false, error: message };
  }
}

/** Clear a workspace-level default so the channel falls back to the org default. */
export async function clearWorkspaceDefaultSenderAction(
  idToken: string,
  input: { organizationId: string; workspaceId: string; channel: Channel },
): Promise<SetDefaultSenderResult> {
  try {
    await requireOrgAdmin(idToken, input.organizationId);
    const { adminDb } = await import('@/lib/firebase-admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    await adminDb.collection('workspaces').doc(input.workspaceId).set(
      { defaultSenderProfileIds: { [input.channel]: FieldValue.delete() }, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear workspace default.';
    console.error('[CLEAR_WS_DEFAULT_SENDER] failed:', message);
    return { success: false, error: message };
  }
}

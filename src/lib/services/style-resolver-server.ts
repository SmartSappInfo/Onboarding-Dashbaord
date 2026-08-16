/**
 * @fileoverview Server-Side Message Style Auto-Provisioning & Admin Operations
 *
 * CAUTION: This file contains server-only Firebase Admin operations.
 * Do NOT import this file in Client Components ('use client').
 */

import { adminDb } from '../firebase-admin';
import type { MessageStyle, Organization } from '../types';
import { DEFAULT_ORG_STYLE_WRAPPER } from './style-resolver';

/**
 * Server-side Admin helper to idempotently provision a default organization style.
 * Uses deterministic document ID ('style_org_' + orgId + '_default') to avoid duplicates.
 *
 * @param orgId    Organization ID to provision style for.
 * @param orgData  Partial Organization metadata (name, logoUrl, brandPrimaryColor).
 * @returns        The existing or freshly created MessageStyle object.
 */
export async function ensureOrgDefaultStyleAdmin(
  orgId: string,
  orgData?: Partial<Organization>
): Promise<MessageStyle> {
  const styleDocId = `style_org_${orgId}_default`;
  const docRef = adminDb.collection('message_styles').doc(styleDocId);
  const snap = await docRef.get();

  const now = new Date().toISOString();
  const orgName = orgData?.name || 'Organization';

  if (snap.exists) {
    return { id: snap.id, ...snap.data() } as MessageStyle;
  }

  const newStyle: MessageStyle = {
    id: styleDocId,
    name: `${orgName} Default Style`,
    htmlWrapper: DEFAULT_ORG_STYLE_WRAPPER,
    htmlWrapperInternal: DEFAULT_ORG_STYLE_WRAPPER,
    htmlWrapperExternal: DEFAULT_ORG_STYLE_WRAPPER,
    workspaceIds: [],
    isDefault: true,
    scope: 'organization',
    organizationId: orgId,
    primaryColor: orgData?.primaryColor || '#3B5FFF',
    fontFamily: 'Figtree',
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(newStyle, { merge: true });
  return newStyle;
}

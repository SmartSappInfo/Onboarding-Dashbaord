'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Distribution Server Actions:
 *    Handles channel creation, signed HMAC token minting, QR code generation,
 *    and one-click link revocation (PRD Sections 20, 54–58 & 86).
 * 2. Multi-Tenant Authorization Invariant:
 *    All distribution queries and mutations strictly verify `workspaceId` tenant boundaries.
 * 3. High-Load Resilience:
 *    Uses indexed Firestore queries and atomic updates.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { DocumentDistribution, DistributionType } from '@/lib/types/document-types';
import { 
  createSignedDistributionToken, 
  verifySignedDistributionToken, 
  generateDistributionQRCode 
} from './distribution-service';

export interface CreateDistributionInput {
  workspaceId: string;
  documentId: string;
  versionId: string;
  type: DistributionType;
  slug: string;
  campaignId?: string;
  contactId?: string;
  trackingParameters?: Record<string, string>;
  expiresAt?: string; // ISO String
  baseUrl?: string;
}

export interface DistributionActionResult {
  success: boolean;
  distribution?: DocumentDistribution;
  distributionUrl?: string;
  token?: string;
  qrCodeDataUrl?: string;
  error?: string;
}

/**
 * Creates a new distribution channel link for a document.
 */
export async function createDocumentDistributionAction(
  input: CreateDistributionInput
): Promise<DistributionActionResult> {
  try {
    if (!input.workspaceId || !input.documentId || !input.type) {
      return { success: false, error: 'Workspace ID, Document ID, and Distribution Type are required.' };
    }

    const distributionId = adminDb.collection('document_distributions').doc().id;
    const now = new Date().toISOString();

    // 1. Mint HMAC Signed Distribution Token
    const token = createSignedDistributionToken({
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      versionId: input.versionId,
      distributionId,
      type: input.type,
      contactId: input.contactId,
      campaignId: input.campaignId,
      expiresAt: input.expiresAt,
    });

    const host = input.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://smartsapp.com';
    const distributionUrl = `${host}/d/${input.slug}?t=${token}`;

    // 2. Generate QR Code Data URL
    const qrCodeDataUrl = await generateDistributionQRCode(distributionUrl);

    // 3. Save Distribution Record in Firestore
    const distribution: DocumentDistribution = {
      id: distributionId,
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      versionId: input.versionId,
      type: input.type,
      campaignId: input.campaignId,
      contactId: input.contactId,
      token,
      trackingParameters: input.trackingParameters,
      expiresAt: input.expiresAt,
      status: 'active',
      createdAt: now,
    };

    await adminDb.collection('document_distributions').doc(distributionId).set(distribution);

    return {
      success: true,
      distribution,
      distributionUrl,
      token,
      qrCodeDataUrl,
    };
  } catch (err) {
    console.error('Error creating document distribution:', err);
    return { success: false, error: 'Failed to create distribution link.' };
  }
}

/**
 * Lists all active and historical distribution links for a document.
 */
export async function listDocumentDistributionsAction(
  workspaceId: string,
  documentId: string
): Promise<{ success: boolean; distributions?: DocumentDistribution[]; error?: string }> {
  try {
    if (!workspaceId || !documentId) {
      return { success: false, error: 'Workspace ID and Document ID are required.' };
    }

    const snap = await adminDb
      .collection('document_distributions')
      .where('workspaceId', '==', workspaceId)
      .where('documentId', '==', documentId)
      .get();

    const distributions = snap.docs.map((doc) => doc.data() as DocumentDistribution);

    // Sort descending by creation date
    distributions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, distributions };
  } catch (err) {
    console.error('Error listing distributions:', err);
    return { success: false, error: 'Failed to list distributions.' };
  }
}

/**
 * Revokes an active distribution link immediately.
 */
export async function revokeDocumentDistributionAction(
  workspaceId: string,
  distributionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!workspaceId || !distributionId) {
      return { success: false, error: 'Workspace ID and Distribution ID are required.' };
    }

    const distRef = adminDb.collection('document_distributions').doc(distributionId);
    const snap = await distRef.get();

    if (!snap.exists || snap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Distribution record not found or access denied.' };
    }

    await distRef.update({
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    console.error('Error revoking distribution:', err);
    return { success: false, error: 'Failed to revoke distribution.' };
  }
}

/**
 * Resolves and validates a distribution token from a public reader request.
 */
export async function resolveDistributionTokenAction(token: string): Promise<{
  valid: boolean;
  expired?: boolean;
  revoked?: boolean;
  distribution?: DocumentDistribution;
  error?: string;
}> {
  try {
    const verified = verifySignedDistributionToken(token);
    if (!verified.valid || !verified.payload) {
      return { valid: false, expired: verified.expired, error: verified.error };
    }

    const { distributionId } = verified.payload;
    const snap = await adminDb.collection('document_distributions').doc(distributionId).get();

    if (!snap.exists) {
      return { valid: false, error: 'Distribution record not found.' };
    }

    const distribution = snap.data() as DocumentDistribution;
    if (distribution.status === 'revoked') {
      return { valid: false, revoked: true, error: 'This distribution link has been revoked.' };
    }

    return { valid: true, distribution };
  } catch (err) {
    console.error('Error resolving distribution token:', err);
    return { valid: false, error: 'Failed to resolve token.' };
  }
}

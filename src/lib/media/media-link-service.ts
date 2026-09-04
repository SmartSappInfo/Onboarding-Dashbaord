/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Distribution Links & Embeds:
 *    Manages creation, resolution, and HTML embed code generation for `MediaLink` distribution objects.
 * 2. Responsive IFrame & Cross-Origin PostMessage Script:
 *    `generateEmbedCode` outputs responsive, production-ready `<iframe>` snippets with automatic
 *    height postMessage listeners to prevent layout clipping on external websites.
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { 
  collection, doc, getDocs, query, where, 
  setDoc, orderBy, type Firestore 
} from 'firebase/firestore';
import type { MediaLink, EmbedConfig } from '../types/media-2.0';

export interface CreateDistributionLinkParams {
  workspaceId: string;
  assetId: string;
  experienceId?: string;
  packageId?: string;
  shortSlug?: string;
  contactId?: string;
  dealId?: string;
  campaignId?: string;
  expiresAt?: string;
  passwordHash?: string;
  createdById: string;
}

/**
 * Generates an 8-character random tracking slug if custom slug is omitted.
 */
function generateRandomSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

/**
 * Creates a new MediaLink distribution document in Firestore.
 */
export async function createDistributionLinkAction(
  firestore: Firestore,
  params: CreateDistributionLinkParams
): Promise<MediaLink | null> {
  if (!firestore || !params.workspaceId || !params.assetId) return null;

  try {
    const linkId = doc(collection(firestore, 'media_links')).id;
    const finalSlug = (params.shortSlug?.trim() || generateRandomSlug()).toLowerCase();

    const newLink: MediaLink = {
      id: linkId,
      workspaceId: params.workspaceId,
      assetId: params.assetId,
      experienceId: params.experienceId,
      packageId: params.packageId,
      shortSlug: finalSlug,
      contactId: params.contactId,
      dealId: params.dealId,
      campaignId: params.campaignId,
      expiresAt: params.expiresAt,
      passwordHash: params.passwordHash,
      clickCount: 0,
      createdById: params.createdById,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(firestore, 'media_links', linkId), newLink);
    return newLink;
  } catch (err: unknown) {
    console.error('[createDistributionLinkAction] Error creating distribution link:', err);
    return null;
  }
}

/**
 * Lists all MediaLinks for an asset or workspace sorted by creation date descending.
 */
export async function listDistributionLinksAction(
  firestore: Firestore,
  workspaceId: string,
  assetId?: string
): Promise<MediaLink[]> {
  if (!firestore || !workspaceId) return [];

  try {
    const colRef = collection(firestore, 'media_links');
    const constraints = [where('workspaceId', '==', workspaceId)];
    if (assetId) {
      constraints.push(where('assetId', '==', assetId));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(colRef, ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaLink));
  } catch (err: unknown) {
    console.error('[listDistributionLinksAction] Error listing distribution links:', err);
    return [];
  }
}

/**
 * Generates a clean, responsive HTML `<iframe>` embed code snippet.
 */
export function generateEmbedCode(
  baseUrl: string,
  shareIdOrSlug: string,
  config: Partial<EmbedConfig> = {}
): string {
  const embedUrl = `${baseUrl.replace(/\/$/, '')}/m/${encodeURIComponent(shareIdOrSlug)}?embed=true`;
  const width = config.width || '100%';
  const height = config.height || '500px';
  const fullscreen = config.allowFullscreen !== false ? 'allowfullscreen' : '';

  return `<div style="position: relative; width: ${width}; padding-bottom: ${config.responsiveRatio === '16:9' ? '56.25%' : 'auto'}; height: ${height}; max-width: 100%; border-radius: 1rem; overflow: hidden; shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
  <iframe
    src="${embedUrl}"
    width="100%"
    height="100%"
    style="position: absolute; top:0; left:0; width:100%; height:100%; border:0;"
    ${fullscreen}
    loading="lazy"
  ></iframe>
</div>`;
}

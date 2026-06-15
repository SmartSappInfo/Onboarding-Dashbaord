'use server';

import { randomUUID } from 'crypto';
import { logActivity } from './activity-logger';
import { adminStorage } from './firebase-admin';
import { getLinkMetadata } from '@/ai/flows/get-link-metadata-flow';
import { isSafeHttpUrl, clampText } from './quick-notes-domain';
import type { QuickNote, QuickNoteAttachment, QuickNoteLinks } from './quick-notes-types';

/**
 * Quick Notes — server actions for cross-cutting concerns.
 *
 * CRUD itself is performed client-side against Firestore (secured by the
 * `quick_notes` security rules), mirroring the established EntityNotesTab
 * pattern for real-time updates. This module handles the things that must run
 * on the server: writing to the global Activity Feed (non-blocking via the
 * `after()` pattern inside `logActivity`). Phase 4/6/7 add index projection,
 * AI, and embeddings here.
 */

export interface QuickNoteActivityInput {
  noteId: string;
  title: string;
  workspaceId: string;
  organizationId: string;
  createdBy: string;
  createdByName?: string;
  contentPreview?: string;
  links?: QuickNoteLinks;
}

/**
 * Logs a Quick Note creation to the Activity Feed. Reuses the existing
 * `note_added` activity type (already mapped in activity-icons) and tags the
 * source so the feed can distinguish/filter Quick Notes (design spec R10/F4).
 */
export async function logQuickNoteActivity(input: QuickNoteActivityInput): Promise<void> {
  const { noteId, title, workspaceId, organizationId, createdBy, createdByName, contentPreview, links } = input;
  if (!workspaceId || !organizationId) return;

  await logActivity({
    type: 'note_added',
    description: `Quick note added: ${title}`,
    source: 'app',
    organizationId,
    workspaceId,
    // A quick note may be linked to an entity; surface it on the activity when so.
    entityId: links?.entityId ?? null,
    userId: createdBy,
    displayName: createdByName,
    metadata: {
      source: 'quick_note',
      noteId,
      title,
      contentPreview: contentPreview
        ? contentPreview.length > 120
          ? contentPreview.slice(0, 117) + '…'
          : contentPreview
        : undefined,
      linkedTaskId: links?.taskId,
      linkedEntityId: links?.entityId,
    },
  });

  // ── Automation hook point (F8) ───────────────────────────────────────────
  // A future "quick_note_added" automation trigger would dispatch here, e.g.:
  //   await triggerAutomationProtocols(buildAutomationPayload({ type: 'quick_note_added', ... }))
  // Left as a documented extension point for v1 — the activity above already
  // serves as the event record, so wiring a trigger is purely additive.
}

// ─────────────────────────────────────────────────────────────────────────────
// Link enrichment (Phase 3) — fetch OG metadata + re-host the thumbnail
// ─────────────────────────────────────────────────────────────────────────────

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REDIRECT_HOPS = 3;

/**
 * Fetches an image while re-validating every redirect hop against the SSRF
 * guard — a vetted public URL can otherwise 30x to a private/internal address.
 * Redirects are handled manually so each Location is checked before we follow.
 */
async function ssrfSafeImageFetch(startUrl: string): Promise<Response | null> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (!isSafeHttpUrl(url)) return null;
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      url = new URL(location, url).toString(); // resolve relative redirects
      continue;
    }
    return res;
  }
  return null; // too many redirects
}

/**
 * Downloads an external image and re-hosts it in Firebase Storage so it is
 * served same-origin (satisfies next/image's allowlist and avoids hotlink rot —
 * design spec R3). Returns null on any failure; enrichment degrades gracefully.
 */
async function rehostThumbnail(
  imageUrl: string,
  workspaceId: string
): Promise<{ url: string; storagePath: string } | null> {
  if (!isSafeHttpUrl(imageUrl)) return null;
  try {
    const res = await ssrfSafeImageFetch(imageUrl);
    if (!res || !res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_THUMBNAIL_BYTES) return null;

    const token = randomUUID();
    const ext = (contentType.split('/')[1] || 'jpg').split(';')[0].replace(/[^a-z0-9]/gi, '') || 'jpg';
    const storagePath = `quick-notes/${workspaceId}/link-thumbs/${token}.${ext}`;

    const file = adminStorage.file(storagePath);
    await file.save(buffer, {
      contentType,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${adminStorage.name}/o/${encodeURIComponent(
      storagePath
    )}?alt=media&token=${token}`;
    return { url, storagePath };
  } catch {
    return null;
  }
}

export interface EnrichNoteLinkParams {
  url: string;
  workspaceId: string;
}

/**
 * Builds a `link` attachment from a URL: fetches OG title/description and
 * re-hosts the OG image. Always returns a usable attachment even if metadata
 * lookup fails, so the user still gets a saved link.
 */
export async function enrichNoteLink(params: EnrichNoteLinkParams): Promise<QuickNoteAttachment> {
  const { url, workspaceId } = params;
  const base: QuickNoteAttachment = { id: randomUUID(), type: 'link', url };

  if (!isSafeHttpUrl(url) || !workspaceId) {
    return base;
  }

  let meta: { title?: string; description?: string; imageUrl?: string } = {};
  try {
    meta = await getLinkMetadata({ url });
  } catch {
    return base;
  }

  let thumbnailUrl: string | undefined;
  let storagePath: string | undefined;
  if (meta.imageUrl) {
    const rehosted = await rehostThumbnail(meta.imageUrl, workspaceId);
    if (rehosted) {
      thumbnailUrl = rehosted.url;
      storagePath = rehosted.storagePath;
    }
  }

  return {
    ...base,
    title: clampText(meta.title, 300),
    description: clampText(meta.description, 600),
    thumbnailUrl,
    storagePath,
  };
}

/** Convenience overload used by the client write helper after a successful create. */
export async function logQuickNoteCreated(note: QuickNote): Promise<void> {
  await logQuickNoteActivity({
    noteId: note.id,
    title: note.title,
    workspaceId: note.workspaceId,
    organizationId: note.organizationId,
    createdBy: note.createdBy,
    createdByName: note.createdByName,
    contentPreview: note.plainText,
    links: note.links,
  });
}

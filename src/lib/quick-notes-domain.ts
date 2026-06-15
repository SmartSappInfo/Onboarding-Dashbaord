import type {
  NoteDocument,
  QuickNote,
  QuickNoteAttachment,
  QuickNoteAttachmentType,
  UnifiedNote,
} from './quick-notes-types';

/**
 * Quick Notes — pure domain logic.
 *
 * No I/O, no Firebase, no React. Everything here is a deterministic function of
 * its inputs so it can be unit-tested without the emulator. I/O lives in the
 * repository/adapter layer; orchestration lives in server actions.
 */

/**
 * Leaf block-level TipTap node types that introduce a line break in plain text.
 * Container blocks (listItem, blockquote, tableRow, taskItem) are intentionally
 * excluded — they inherit their break from the leaf block (usually a paragraph)
 * nested inside them, so listing both would double the newlines.
 */
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'codeBlock', 'horizontalRule']);

const MAX_TAG_LENGTH = 50;
const MAX_TAGS = 30;

/**
 * Flattens a TipTap document into plain text for search / AI / embeddings.
 * Text nodes contribute their text; block-level nodes append a newline after
 * their content. Runs of blank lines are collapsed and the result is trimmed.
 */
/** Defensive cap on document nesting depth (guards against adversarial input). */
const MAX_NODE_DEPTH = 100;

export function extractPlainText(doc?: NoteDocument | null): string {
  if (!doc || typeof doc !== 'object') return '';

  const render = (node: NoteDocument, depth: number): string => {
    if (depth > MAX_NODE_DEPTH) return '';
    let out = typeof node.text === 'string' ? node.text : '';
    if (Array.isArray(node.content)) {
      out += node.content.map((child) => render(child, depth + 1)).join('');
    }
    if (node.type === 'hardBreak') out += '\n';
    if (node.type && BLOCK_TYPES.has(node.type)) out += '\n';
    return out;
  };

  return render(doc, 0).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Normalises free-form tags (design decision D1):
 * trims, drops empties, caps length, de-duplicates case-insensitively while
 * preserving the first occurrence's original casing, and caps the count.
 */
export function dedupeTags(tags: readonly string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

/** Strips `undefined` values so Firestore writes never carry them. */
export function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

/** Builds the stable, globally-unique board id for a unified note. */
export function unifiedNoteId(source: UnifiedNote['source'], sourceId: string): string {
  return `${source}:${sourceId}`;
}

/** Maps a stored native QuickNote into the board's UnifiedNote view-model. */
export function quickNoteToUnified(note: QuickNote): UnifiedNote {
  return {
    id: unifiedNoteId('quick_note', note.id),
    source: 'quick_note',
    sourceId: note.id,
    workspaceId: note.workspaceId,
    title: note.title,
    plainText: note.plainText,
    tags: note.tags ?? [],
    attachments: note.attachments ?? [],
    links: note.links ?? {},
    isPinned: !!note.isPinned,
    createdByName: note.createdByName,
    createdAt: note.createdAt,
    originHref: null,
    editable: true,
  };
}

/** Sorts unified notes pinned-first, then newest-first by createdAt. */
export function sortUnifiedNotes(notes: readonly UnifiedNote[]): UnifiedNote[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachments (pure helpers — Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

/** Classifies an attachment by its MIME type. */
export function attachmentTypeFromMime(mime: string | undefined): QuickNoteAttachmentType {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

/** Document MIME types permitted as Quick Notes attachments. */
const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
]);

/** Allow images, videos, and a known set of document types; reject the rest. */
export function isAllowedAttachmentMime(mime: string | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith('image/') || mime.startsWith('video/') || ALLOWED_DOCUMENT_MIMES.has(mime);
}

/** Replaces unsafe filename characters so Storage paths stay clean and predictable. */
export function sanitizeFileName(name: string): string {
  const trimmed = (name || 'file').trim().slice(-120);
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

/** Builds the deterministic Storage path for a Quick Notes attachment. */
export function buildAttachmentStoragePath(workspaceId: string, id: string, fileName: string): string {
  return `quick-notes/${workspaceId}/${id}-${sanitizeFileName(fileName)}`;
}

/** Returns every Storage path the note owns (uploads + re-hosted thumbnails). */
export function collectOwnedStoragePaths(note: Pick<QuickNote, 'attachments'>): string[] {
  const paths: string[] = [];
  for (const att of note.attachments ?? []) {
    if (att.storagePath) paths.push(att.storagePath);
  }
  return paths;
}

/**
 * SSRF guard for server-side URL fetches (link enrichment). Allows only http(s)
 * to a public host — rejects other schemes, localhost, and obvious private /
 * link-local ranges. Defence-in-depth; not a substitute for network egress
 * controls.
 */
export function isSafeHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local')) {
    return false;
  }
  // IPv4 private / loopback / link-local ranges.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
}

/** Caps a string for safe storage/display. */
export function clampText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/** A renderable image-ish thumbnail (links/images that resolved a thumbnail URL). */
export function hasRenderableThumbnail(att: QuickNoteAttachment): boolean {
  return !!att.thumbnailUrl && (att.type === 'image' || att.type === 'link');
}

/** Default character budget sent to the model for a single note. */
export const AI_INPUT_CHAR_BUDGET = 8000;

/**
 * Prepares note text for an AI call: trims and hard-caps the length so a very
 * long note can't blow the token budget or cost (design spec R8).
 */
export function buildAiInput(plainText: string | undefined, maxChars: number = AI_INPUT_CHAR_BUDGET): string {
  const text = (plainText ?? '').trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

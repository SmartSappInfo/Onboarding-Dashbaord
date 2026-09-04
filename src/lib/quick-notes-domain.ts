import type {
  NoteDocument,
  QuickNote,
  QuickNoteAttachment,
  QuickNoteAttachmentType,
  UnifiedNote,
  KnowledgeType,
  CRMKnowledgeTimelineItem,
  TimelineFilterState,
  TimelineItemSource,
  KnowledgeChunk,
  HybridSearchResult,
  SearchScoreBreakdown,
  NoteIndexRow,
  KnowledgeRelation,
  KnowledgeRelationType,
  GraphNode,
  GraphEdge,
  GraphNodeType,
  KnowledgeGraphData,
  GraphMetrics,
  PathFindingResult,
  BacklinkItem,
  KnowledgeGraphFilterOptions,
  KnowledgeInboxItem,
  KnowledgeInboxType,
  KnowledgeInsight,
  KnowledgeInsightType,
  KnowledgeInsightSeverity,
  InboxFilterOptions,
  InsightFilterOptions,
  MergeStrategy,
  CampaignChannel,
  CampaignConceptStatus,
  ObjectionCategory,
  CampaignConcept,
  ObjectionBattlecard,
  ObjectionCluster,
  CampaignConceptFilterOptions,
  Idea,
  IdeaCanvasNode,
  IdeaCanvasEdge,
  IdeaCanvasLayout,
  IdeaFilterOptions,
  IdeaValidationSummary,
  IceQuadrantType,
  IdeaLifecycleStage,
  IdeaValidationStatus,
  IdeaAssumptionRiskLevel,
  PrioritizationFormula,
  KnowledgeFederationPolicy,
  KnowledgeSpaceAccessLevel,
  FederatedKnowledgeSpace,
  KnowledgeIngestionSource,
  KnowledgeIngestionPayload,
  FederationConflictResolution,
  FederatedKnowledgeItem,
  FederationFilterOptions,
  OfflineMutationType,
  OfflineMutationJob,
  OfflineMutationStatus,
  OfflineSyncStatus,
  OfflineConflictDetails,
  OfflineConflictResolutionAction,
} from './quick-notes-types';
import { KNOWLEDGE_TYPES } from './quick-notes-types';

/**
 * Quick Notes / Company Brain — pure domain logic.
 *
 * No I/O, no Firebase, no React. Everything here is a deterministic function of
 * its inputs so it can be unit-tested without the emulator. I/O lives in the
 * repository/adapter layer; orchestration lives in server actions.
 */

export interface KnowledgeTypeMeta {
  id: KnowledgeType;
  label: string;
  description: string;
  icon: string;
  badgeColor: string;
  dotColor: string;
  borderColor: string;
  bgSoft: string;
}

export const KNOWLEDGE_TYPE_META: Record<KnowledgeType, KnowledgeTypeMeta> = {
  note: {
    id: 'note',
    label: 'Note',
    description: 'General reference, meeting observation or scratchpad thought',
    icon: 'Notebook',
    badgeColor: 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-500',
    borderColor: 'border-l-slate-400',
    bgSoft: 'bg-slate-500/5',
  },
  idea: {
    id: 'idea',
    label: 'Idea',
    description: 'Creative concept, innovation spark or strategic proposal',
    icon: 'Lightbulb',
    badgeColor: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700',
    dotColor: 'bg-amber-500',
    borderColor: 'border-l-amber-500',
    bgSoft: 'bg-amber-500/5',
  },
  insight: {
    id: 'insight',
    label: 'Insight',
    description: 'Derived takeaway, analytical finding or customer pattern',
    icon: 'Sparkles',
    badgeColor: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/60 border-violet-300 dark:border-violet-700',
    dotColor: 'bg-violet-500',
    borderColor: 'border-l-violet-500',
    bgSoft: 'bg-violet-500/5',
  },
  decision: {
    id: 'decision',
    label: 'Decision',
    description: 'Key resolution, architectural choice or policy decision',
    icon: 'CheckCircle2',
    badgeColor: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-l-emerald-500',
    bgSoft: 'bg-emerald-500/5',
  },
  feedback: {
    id: 'feedback',
    label: 'Feedback',
    description: 'Direct customer quote, client objection or review comment',
    icon: 'MessageSquareQuote',
    badgeColor: 'text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700',
    dotColor: 'bg-sky-500',
    borderColor: 'border-l-sky-500',
    bgSoft: 'bg-sky-500/5',
  },
  observation: {
    id: 'observation',
    label: 'Observation',
    description: 'Field note, call takeaway or behavioral observation',
    icon: 'Eye',
    badgeColor: 'text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700',
    dotColor: 'bg-indigo-500',
    borderColor: 'border-l-indigo-500',
    bgSoft: 'bg-indigo-500/5',
  },
  action: {
    id: 'action',
    label: 'Action',
    description: 'Operational commitment, next step or follow-up item',
    icon: 'CheckSquare',
    badgeColor: 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700',
    dotColor: 'bg-rose-500',
    borderColor: 'border-l-rose-500',
    bgSoft: 'bg-rose-500/5',
  },
  research: {
    id: 'research',
    label: 'Research',
    description: 'Market research, benchmark study or competitive data',
    icon: 'BookOpen',
    badgeColor: 'text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700',
    dotColor: 'bg-teal-500',
    borderColor: 'border-l-teal-500',
    bgSoft: 'bg-teal-500/5',
  },
  strategy: {
    id: 'strategy',
    label: 'Strategy',
    description: 'High-level roadmap, business hypothesis or goal',
    icon: 'Compass',
    badgeColor: 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700',
    dotColor: 'bg-purple-500',
    borderColor: 'border-l-purple-500',
    bgSoft: 'bg-purple-500/5',
  },
};

/**
 * Normalises legacy noteType strings or raw input to a valid KnowledgeType.
 * Fallback is 'note'.
 */
export function normalizeKnowledgeType(rawType?: string): KnowledgeType {
  if (!rawType) return 'note';
  const lower = rawType.toLowerCase();
  if (lower in KNOWLEDGE_TYPE_META) return lower as KnowledgeType;
  // Legacy mapping
  if (lower === 'call' || lower === 'meeting') return 'observation';
  if (lower === 'followup') return 'action';
  if (lower === 'escalation') return 'feedback';
  return 'note';
}


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

/** Alias for extractPlainText targeting TipTap JSON nodes. */
export const extractPlainTextFromTipTap = extractPlainText;

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
    knowledgeType: normalizeKnowledgeType(note.knowledgeType),
    sentiment: note.ai?.sentiment,
    visibility: note.visibility,
    spaceId: note.spaceId,
    collectionId: note.collectionId,
    status: note.status ?? 'active',
    tags: note.tags ?? [],
    attachments: note.attachments ?? [],
    links: note.links ?? {},
    isPinned: !!note.isPinned,
    createdBy: note.createdBy,
    createdByName: note.createdByName,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
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
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.compute.internal') ||
    host === 'metadata.google.internal'
  ) {
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

// ─────────────────────────────────────────────────────────────────────────────
// FloatingNotesHUD helpers — plain-text ↔ TipTap bridge
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum characters allowed for an auto-derived note title. */
const MAX_HUD_TITLE_CHARS = 80;

/**
 * Converts a plain-text string into a minimal TipTap-compatible NoteDocument.
 *
 * Each line of the source text becomes a `paragraph` node. Empty lines produce
 * an empty paragraph, preserving intentional vertical whitespace. This produces
 * a *lossy but valid* document — rich formatting is not preserved. The function
 * is intentionally used only by the lightweight FloatingNotesHUD; the full
 * NoteBlockEditor writes its own TipTap JSON natively.
 *
 * CAUTION: Do not use this for notes that already have TipTap content — it will
 * strip all marks and block-level structure.
 *
 * TESTABILITY: Pure function — no I/O, no React. Test with multiline strings,
 * empty strings, strings containing only whitespace.
 */
export function plainTextToTipTap(text: string): NoteDocument {
  const lines = text.split('\n');
  return {
    type: 'doc',
    content: lines.map((line) => {
      const trimmed = line.trimEnd(); // preserve leading indent, strip trailing
      if (!trimmed) {
        // Empty paragraph — explicit empty content array (TipTap convention)
        return { type: 'paragraph', content: [] };
      }
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: trimmed }],
      };
    }),
  };
}

/**
 * Derives a human-readable note title from a plain-text draft string.
 *
 * Algorithm:
 *  1. Take the first non-empty, non-whitespace line.
 *  2. Trim it and cap it at MAX_HUD_TITLE_CHARS characters.
 *  3. Fall back to the provided `fallback` string when the draft is empty.
 *
 * CAUTION: This is intentionally simple. Do not add I/O or async logic here.
 *
 * TESTABILITY: Pure function. Test with: empty string, whitespace-only, single
 * line, multiline with blank first line, line longer than MAX_HUD_TITLE_CHARS.
 */
export function deriveTitleFromText(text: string, fallback = 'Quick Note'): string {
  const firstLine = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return fallback;
  return firstLine.length > MAX_HUD_TITLE_CHARS
    ? firstLine.slice(0, MAX_HUD_TITLE_CHARS)
    : firstLine;
}

/**
 * Builds a scoped local storage draft key per workspace and optional CRM record.
 */
export function resolveDraftStorageKey(workspaceId: string, entityId?: string | null): string {
  const cleanWs = (workspaceId || 'default').trim();
  const cleanEntity = (entityId || 'global').trim();
  return `smartsapp_draft_${cleanWs}_${cleanEntity}`;
}

export interface ReadingStats {
  words: number;
  characters: number;
  readingTimeMinutes: number;
}

/**
 * Computes word count, character count, and estimated reading time.
 */
export function calculateReadingStats(plainText?: string | null): ReadingStats {
  if (!plainText) {
    return { words: 0, characters: 0, readingTimeMinutes: 1 };
  }
  const text = plainText.trim();
  const characters = text.length;
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
  return { words, characters, readingTimeMinutes };
}

/**
 * Parses action items/checkboxes/TODOs from plain text.
 */
export function extractActionItemsFromText(text?: string | null): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  const actionItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match Markdown task list (- [ ] or - [x]), TODO:, Action:, Next Step:
    const todoMatch = trimmed.match(/^(?:[-*]\s*\[[\sxX]\]|\b(?:TODO|Action|Next step|Follow-up):\s*)(.+)$/i);
    if (todoMatch && todoMatch[1]) {
      const cleanItem = todoMatch[1].trim();
      if (cleanItem.length > 2 && !actionItems.includes(cleanItem)) {
        actionItems.push(cleanItem);
      }
    }
  }
  return actionItems;
}

export interface RawTimelineEntityNote {
  id: string;
  entityId?: string;
  entityName?: string;
  workspaceId: string;
  content?: string;
  noteType?: string;
  isPinned?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  dealId?: string;
  dealName?: string;
  replyCount?: number;
}

export interface RawTimelineActivity {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId?: string | null;
  dealId?: string | null;
  displayName?: string;
  userId?: string | null;
  type: string;
  source: string;
  timestamp: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface RawTimelineTask {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedToName?: string;
  dueDate?: string;
  createdAt?: string;
}

export interface BuildTimelineStreamParams {
  quickNotes?: QuickNote[];
  entityNotes?: RawTimelineEntityNote[];
  activities?: RawTimelineActivity[];
  tasks?: RawTimelineTask[];
}

/**
 * Builds a unified, chronological timeline stream across disparate CRM sources.
 * Pure function — deterministic and fully unit-testable.
 */
export function buildTimelineStream(params: BuildTimelineStreamParams): CRMKnowledgeTimelineItem[] {
  const items: CRMKnowledgeTimelineItem[] = [];

  // 1. Process Native Quick Notes / Company Brain Objects
  if (params.quickNotes) {
    for (const note of params.quickNotes) {
      const kType = normalizeKnowledgeType(note.knowledgeType);
      const plain = note.plainText || extractPlainText(note.content);
      const actions = note.ai?.actionItems?.length
        ? note.ai.actionItems
        : extractActionItemsFromText(plain);

      items.push({
        id: `quick_note:${note.id}`,
        source: 'quick_note',
        sourceId: note.id,
        workspaceId: note.workspaceId,
        title: note.title || deriveTitleFromText(plain, 'Quick Note'),
        content: plain,
        knowledgeType: kType,
        timestamp: note.createdAt,
        authorId: note.createdBy,
        authorName: note.createdByName || 'Team Member',
        sentiment: note.ai?.sentiment,
        isPinned: !!note.isPinned,
        links: note.links || {},
        tags: note.tags || [],
        actionItems: actions,
        originHref: `/admin/quick-notes?id=${encodeURIComponent(note.id)}`,
        editable: true,
      });
    }
  }

  // 2. Process Legacy Entity Notes
  if (params.entityNotes) {
    for (const note of params.entityNotes) {
      const plain = (note.content || '').trim();
      const kType = normalizeKnowledgeType(note.noteType);
      const actions = extractActionItemsFromText(plain);

      items.push({
        id: `entity_note:${note.id}`,
        source: 'entity_note',
        sourceId: note.id,
        workspaceId: note.workspaceId,
        title: deriveTitleFromText(plain, note.noteType ? `${note.noteType.toUpperCase()} Note` : 'Note'),
        content: plain,
        knowledgeType: kType,
        timestamp: note.createdAt || new Date().toISOString(),
        authorId: note.createdBy,
        authorName: note.createdByName || 'Team Member',
        isPinned: !!note.isPinned,
        links: {
          entityId: note.entityId,
          entityName: note.entityName,
          dealId: note.dealId,
          dealName: note.dealName,
        },
        tags: [],
        actionItems: actions,
        replyCount: note.replyCount || 0,
        originHref: note.entityId ? `/admin/entities/${note.entityId}` : null,
        editable: true,
      });
    }
  }

  // 3. Process Activities (Calls, Meetings, Stage changes)
  if (params.activities) {
    for (const act of params.activities) {
      const lowerType = act.type?.toLowerCase() || '';
      let source: TimelineItemSource = 'activity';
      let kType: KnowledgeType = 'observation';

      if (lowerType === 'call' || lowerType.includes('call')) {
        source = 'call';
        kType = 'observation';
      } else if (lowerType === 'meeting' || lowerType.includes('meeting')) {
        source = 'meeting';
        kType = 'observation';
      } else if (lowerType === 'note') {
        source = 'entity_note';
        kType = 'note';
      }

      const content = (act.metadata?.content as string) || act.description || '';
      const actions = extractActionItemsFromText(content);

      items.push({
        id: `activity:${act.id}`,
        source,
        sourceId: act.id,
        workspaceId: act.workspaceId,
        title: act.description || 'Interaction Log',
        content,
        knowledgeType: kType,
        timestamp: act.timestamp || new Date().toISOString(),
        authorId: act.userId || undefined,
        authorName: act.displayName || 'System',
        isPinned: false,
        links: {
          entityId: act.entityId || undefined,
          dealId: act.dealId || undefined,
        },
        tags: [],
        actionItems: actions,
        originHref: act.entityId ? `/admin/entities/${act.entityId}` : null,
        editable: false,
        metadata: act.metadata,
      });
    }
  }

  // 4. Process Tasks
  if (params.tasks) {
    for (const task of params.tasks) {
      items.push({
        id: `task:${task.id}`,
        source: 'task',
        sourceId: task.id,
        workspaceId: task.workspaceId,
        title: task.title || 'Task',
        content: task.description || '',
        knowledgeType: 'action',
        timestamp: task.createdAt || new Date().toISOString(),
        authorName: task.assignedToName || 'Unassigned',
        isPinned: false,
        links: {},
        tags: [task.priority, task.status].filter(Boolean),
        actionItems: [task.title],
        originHref: `/admin/tasks?id=${encodeURIComponent(task.id)}`,
        editable: false,
      });
    }
  }

  // Deduplicate items that have identical sourceId
  const seenIds = new Set<string>();
  const deduplicated: CRMKnowledgeTimelineItem[] = [];

  for (const item of items) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      deduplicated.push(item);
    }
  }

  // Sort: pinned first, then newest first
  return deduplicated.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

/**
 * Pure filter function for the timeline view model.
 */
export function filterTimelineStream(
  items: CRMKnowledgeTimelineItem[],
  filter: TimelineFilterState
): CRMKnowledgeTimelineItem[] {
  let result = items;

  if (filter.onlyPinned) {
    result = result.filter((i) => i.isPinned);
  }

  if (filter.type !== 'all') {
    // Check if filtering by knowledge type or source
    result = result.filter(
      (i) => i.knowledgeType === filter.type || i.source === filter.type
    );
  }

  if (filter.sentiment && filter.sentiment !== 'all') {
    result = result.filter((i) => i.sentiment === filter.sentiment);
  }

  if (filter.searchQuery && filter.searchQuery.trim()) {
    const q = filter.searchQuery.toLowerCase().trim();
    result = result.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q) ||
        (i.authorName && i.authorName.toLowerCase().includes(q)) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        (i.links.entityName && i.links.entityName.toLowerCase().includes(q)) ||
        (i.links.dealName && i.links.dealName.toLowerCase().includes(q)) ||
        (i.links.contactName && i.links.contactName.toLowerCase().includes(q))
    );
  }

  return result;
}

export interface TimelinePeriodGroup {
  period: string;
  items: CRMKnowledgeTimelineItem[];
}

/**
 * Groups timeline items by readable calendar period (e.g., "September 2026", "August 2026").
 */
export function groupTimelineByPeriod(
  items: CRMKnowledgeTimelineItem[]
): TimelinePeriodGroup[] {
  const groups = new Map<string, CRMKnowledgeTimelineItem[]>();

  for (const item of items) {
    const date = new Date(item.timestamp);
    const period = isNaN(date.getTime())
      ? 'Recent'
      : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const existing = groups.get(period) || [];
    existing.push(item);
    groups.set(period, existing);
  }

  return Array.from(groups.entries()).map(([period, groupItems]) => ({
    period,
    items: groupItems,
  }));
}

/**
 * Splits a UnifiedNote into semantic KnowledgeChunks bounded by character count (Phase 4).
 * Prefers paragraph or heading boundaries over arbitrary character slicing.
 */
export function chunkNoteContent(
  note: UnifiedNote,
  maxChunkChars = 800
): KnowledgeChunk[] {
  const plainText = note.plainText || '';
  if (!plainText.trim()) return [];

  // Split by paragraphs (double newlines) or single newlines
  const rawParagraphs = plainText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: KnowledgeChunk[] = [];
  let currentBuffer = '';
  let chunkIndex = 0;

  for (const para of rawParagraphs) {
    if (currentBuffer && (currentBuffer.length + para.length + 2) > maxChunkChars) {
      chunks.push({
        chunkId: `${note.id}:chunk_${chunkIndex++}`,
        objectId: note.id,
        objectType: note.knowledgeType || 'note',
        title: note.title,
        text: currentBuffer.trim(),
        authorName: note.createdByName,
        workspaceId: note.workspaceId,
        links: note.links,
        tags: note.tags,
        source: note.source,
        createdAt: note.createdAt,
        updatedAt: note.createdAt,
        visibility: 'workspace',
      });
      currentBuffer = para;
    } else {
      currentBuffer = currentBuffer ? `${currentBuffer}\n\n${para}` : para;
    }
  }

  if (currentBuffer.trim()) {
    chunks.push({
      chunkId: `${note.id}:chunk_${chunkIndex}`,
      objectId: note.id,
      objectType: note.knowledgeType || 'note',
      title: note.title,
      text: currentBuffer.trim(),
      authorName: note.createdByName,
      workspaceId: note.workspaceId,
      links: note.links,
      tags: note.tags,
      source: note.source,
      createdAt: note.createdAt,
      updatedAt: note.createdAt,
      visibility: 'workspace',
    });
  }

  return chunks;
}

/**
 * Calculates exponential recency decay score between 0.0 and 1.0.
 * Half-life defaults to 30 days.
 */
export function calculateRecencyScore(timestamp: string, halfLifeDays = 30): number {
  const noteTime = new Date(timestamp).getTime();
  if (isNaN(noteTime)) return 0.5;
  const now = Date.now();
  const diffDays = Math.max(0, (now - noteTime) / (1000 * 60 * 60 * 24));
  return Math.exp((-Math.LN2 * diffDays) / halfLifeDays);
}

/**
 * Calculates a unified hybrid search score blending lexical rank, vector cosine similarity,
 * recency decay, and entity relevance bonus.
 */
export function calculateHybridScore(
  lexicalScore: number,
  semanticScore: number,
  recencyScore: number,
  entityBonus = 0,
  alpha = 0.65
): { totalScore: number; breakdown: SearchScoreBreakdown } {
  // Alpha balances semantic (1.0) vs lexical (0.0)
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const baseScore = clampedAlpha * semanticScore + (1 - clampedAlpha) * lexicalScore;
  const totalScore = Math.min(1.0, baseScore * 0.85 + recencyScore * 0.10 + entityBonus * 0.05);

  return {
    totalScore: Math.round(totalScore * 1000) / 1000,
    breakdown: {
      lexicalScore: Math.round(lexicalScore * 1000) / 1000,
      semanticScore: Math.round(semanticScore * 1000) / 1000,
      recencyScore: Math.round(recencyScore * 1000) / 1000,
      entityBonus: Math.round(entityBonus * 1000) / 1000,
    },
  };
}

/**
 * Extracts matching text snippets around query terms without raw HTML tag leakage.
 */
export function extractSearchHighlights(
  text: string,
  query: string,
  maxSnippets = 2,
  snippetWindowChars = 120
): string[] {
  if (!text || !query.trim()) return [];
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) {
    return [text.slice(0, snippetWindowChars) + (text.length > snippetWindowChars ? '...' : '')];
  }

  const lowerText = text.toLowerCase();
  const snippets: string[] = [];

  for (const term of terms) {
    if (snippets.length >= maxSnippets) break;
    const index = lowerText.indexOf(term);
    if (index !== -1) {
      const start = Math.max(0, index - Math.floor(snippetWindowChars / 2));
      const end = Math.min(text.length, index + term.length + Math.floor(snippetWindowChars / 2));
      let snippet = text.slice(start, end).trim();
      if (start > 0) snippet = `...${snippet}`;
      if (end < text.length) snippet = `${snippet}...`;
      if (!snippets.includes(snippet)) {
        snippets.push(snippet);
      }
    }
  }

  return snippets.length > 0
    ? snippets
    : [text.slice(0, snippetWindowChars) + (text.length > snippetWindowChars ? '...' : '')];
}

/**
 * Fuses lexical and vector candidate rows using Reciprocal Rank Fusion (RRF)
 * and entity matching into scored, deduplicated HybridSearchResults.
 */
export function fuseSearchResults(
  lexicalRows: NoteIndexRow[],
  vectorRows: NoteIndexRow[],
  query: string,
  alpha = 0.65
): HybridSearchResult[] {
  const mergedMap = new Map<
    string,
    {
      row: NoteIndexRow;
      lexicalRank: number;
      vectorRank: number;
      semanticSimilarity: number;
    }
  >();

  // Map lexical rankings (1-indexed rank)
  lexicalRows.forEach((row, idx) => {
    mergedMap.set(row.id, {
      row,
      lexicalRank: idx + 1,
      vectorRank: 0,
      semanticSimilarity: 0,
    });
  });

  // Map vector rankings
  vectorRows.forEach((row, idx) => {
    const existing = mergedMap.get(row.id);
    if (existing) {
      existing.vectorRank = idx + 1;
      // High rank in top results yields high similarity estimate
      existing.semanticSimilarity = Math.max(0.2, 1 - idx * 0.08);
    } else {
      mergedMap.set(row.id, {
        row,
        lexicalRank: 0,
        vectorRank: idx + 1,
        semanticSimilarity: Math.max(0.2, 1 - idx * 0.08),
      });
    }
  });

  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);

  const results: HybridSearchResult[] = [];

  for (const { row, lexicalRank, vectorRank, semanticSimilarity } of mergedMap.values()) {
    // Reciprocal Rank Fusion scoring: 1 / (60 + rank)
    const lexicalScore = lexicalRank > 0 ? 60 / (60 + lexicalRank) : 0;
    const semanticScore = vectorRank > 0 ? (semanticSimilarity || 60 / (60 + vectorRank)) : 0;
    const recencyScore = calculateRecencyScore(row.createdAt);

    // Entity bonus if query mentions entity name or note has matching links
    let entityBonus = 0;
    const matchedEntities: string[] = [];
    if (row.links) {
      if (row.links.entityName && terms.some((t) => row.links.entityName?.toLowerCase().includes(t))) {
        entityBonus += 0.5;
        matchedEntities.push(row.links.entityName);
      }
      if (row.links.contactName && terms.some((t) => row.links.contactName?.toLowerCase().includes(t))) {
        entityBonus += 0.5;
        matchedEntities.push(row.links.contactName);
      }
      if (row.links.dealName && terms.some((t) => row.links.dealName?.toLowerCase().includes(t))) {
        entityBonus += 0.5;
        matchedEntities.push(row.links.dealName);
      }
    }

    const { totalScore, breakdown } = calculateHybridScore(
      lexicalScore,
      semanticScore,
      recencyScore,
      entityBonus,
      alpha
    );

    const snippets = extractSearchHighlights(row.plainText || '', query);

    results.push({
      id: row.id,
      source: row.source,
      title: row.title || 'Untitled Note',
      plainText: row.plainText || '',
      knowledgeType: row.knowledgeType || 'note',
      score: totalScore,
      scoreBreakdown: breakdown,
      matchedSnippets: snippets,
      matchedEntities,
      originHref: row.originHref || null,
      createdAt: row.createdAt,
      authorName: row.createdByName,
      tags: row.tags || [],
      links: row.links || {},
    });
  }

  // Sort descending by combined totalScore
  return results.sort((a, b) => b.score - a.score);
}

// ============================================================================
// Phase 5: Knowledge Graph Pure Domain Algorithms
// ============================================================================

/**
 * Maps a typed relation token into human-readable plain UI English.
 */
export function getRelationDisplayLabel(relationType: KnowledgeRelationType): string {
  const map: Record<KnowledgeRelationType, string> = {
    related_to: 'Related To',
    supports: 'Supports',
    contradicts: 'Contradicts',
    depends_on: 'Depends On',
    derived_from: 'Derived From',
    inspired_by: 'Inspired By',
    duplicates: 'Duplicates',
    supersedes: 'Supersedes',
    blocks: 'Blocks',
    solves: 'Solves',
    causes: 'Causes',
    affects: 'Affects',
    requires: 'Requires',
    implements: 'Implements',
    validates: 'Validates',
    invalidates: 'Invalidates',
    expands: 'Expands',
    summarizes: 'Summarizes',
    responds_to: 'Responds To',
    references: 'References',
    evidences: 'Evidences',
    belongs_to: 'Belongs To',
    mentioned_by_contact: 'Mentioned By',
    about_contact: 'About Contact',
    about_school: 'About School',
    about_deal: 'About Deal',
    about_campaign: 'About Campaign',
    about_product: 'About Product',
    about_segment: 'About Segment',
    targets: 'Targets',
    addresses: 'Addresses',
  };
  return map[relationType] || relationType.replace(/_/g, ' ');
}

/**
 * Visual color palette tokens for graph node types.
 */
export function getNodeTypeColor(type: GraphNodeType): {
  fill: string;
  border: string;
  text: string;
  badge: string;
  hex: string;
} {
  switch (type) {
    case 'idea':
      return {
        fill: 'bg-amber-500/15 dark:bg-amber-500/20',
        border: 'border-amber-500/40',
        text: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300',
        hex: '#F59E0B',
      };
    case 'insight':
      return {
        fill: 'bg-violet-500/15 dark:bg-violet-500/20',
        border: 'border-violet-500/40',
        text: 'text-violet-700 dark:text-violet-300',
        badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-300',
        hex: '#8B5CF6',
      };
    case 'decision':
      return {
        fill: 'bg-emerald-500/15 dark:bg-emerald-500/20',
        border: 'border-emerald-500/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300',
        hex: '#10B981',
      };
    case 'contact':
    case 'school':
    case 'lead':
      return {
        fill: 'bg-cyan-500/15 dark:bg-cyan-500/20',
        border: 'border-cyan-500/40',
        text: 'text-cyan-700 dark:text-cyan-300',
        badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300',
        hex: '#06B6D4',
      };
    case 'deal':
      return {
        fill: 'bg-orange-500/15 dark:bg-orange-500/20',
        border: 'border-orange-500/40',
        text: 'text-orange-700 dark:text-orange-300',
        badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300',
        hex: '#EA580C',
      };
    case 'campaign':
      return {
        fill: 'bg-rose-500/15 dark:bg-rose-500/20',
        border: 'border-rose-500/40',
        text: 'text-rose-700 dark:text-rose-300',
        badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300',
        hex: '#F43F5E',
      };
    case 'task':
      return {
        fill: 'bg-indigo-500/15 dark:bg-indigo-500/20',
        border: 'border-indigo-500/40',
        text: 'text-indigo-700 dark:text-indigo-300',
        badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300',
        hex: '#6366F1',
      };
    case 'call':
    case 'meeting':
      return {
        fill: 'bg-teal-500/15 dark:bg-teal-500/20',
        border: 'border-teal-500/40',
        text: 'text-teal-700 dark:text-teal-300',
        badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300',
        hex: '#14B8A6',
      };
    case 'note':
    default:
      return {
        fill: 'bg-blue-500/15 dark:bg-blue-500/20',
        border: 'border-blue-500/40',
        text: 'text-blue-700 dark:text-blue-300',
        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300',
        hex: '#3B82F6',
      };
  }
}

/**
 * Color tokens for typed relationship edges.
 */
export function getRelationEdgeColor(relationType: KnowledgeRelationType): string {
  switch (relationType) {
    case 'supports':
    case 'validates':
    case 'evidences':
      return '#10B981'; // Emerald
    case 'contradicts':
    case 'blocks':
    case 'invalidates':
      return '#EF4444'; // Red
    case 'depends_on':
    case 'requires':
      return '#F59E0B'; // Amber
    case 'derived_from':
    case 'inspired_by':
    case 'expands':
      return '#8B5CF6'; // Violet
    case 'about_contact':
    case 'about_school':
    case 'about_deal':
    case 'about_campaign':
    case 'mentioned_by_contact':
      return '#06B6D4'; // Cyan
    case 'solves':
    case 'implements':
      return '#3B82F6'; // Blue
    default:
      return '#94A3B8'; // Slate
  }
}

/**
 * Pure projection building the full Adjacency Graph from notes, relations, and CRM entities.
 */
export function buildAdjacencyGraph(
  relations: KnowledgeRelation[],
  notes: UnifiedNote[],
  crmEntities: Array<{
    id: string;
    label: string;
    type: GraphNodeType;
    originHref?: string | null;
  }> = []
): KnowledgeGraphData {
  const nodeMap = new Map<string, GraphNode>();
  const connectionCounts = new Map<string, number>();

  // 1. Add Note Nodes
  for (const note of notes) {
    nodeMap.set(note.id, {
      id: note.id,
      label: note.title || 'Untitled Note',
      type: (note.knowledgeType as GraphNodeType) || 'note',
      sentiment: note.sentiment,
      authorName: note.createdByName || undefined,
      createdAt: note.createdAt,
      originHref: note.originHref || `/admin/quick-notes?id=${encodeURIComponent(note.id)}`,
      connectionsCount: 0,
      isHub: false,
      clusterId: 'cluster-default',
    });
  }

  // 2. Add Explicit CRM Entity Nodes
  for (const entity of crmEntities) {
    if (!nodeMap.has(entity.id)) {
      nodeMap.set(entity.id, {
        id: entity.id,
        label: entity.label,
        type: entity.type,
        createdAt: new Date().toISOString(),
        originHref: entity.originHref || null,
        connectionsCount: 0,
        isHub: false,
        clusterId: 'cluster-crm',
      });
    }
  }

  // 3. Synthesize Implicit Nodes from Note Links if not already in nodeMap
  for (const note of notes) {
    if (note.links) {
      if (note.links.entityId && !nodeMap.has(note.links.entityId)) {
        nodeMap.set(note.links.entityId, {
          id: note.links.entityId,
          label: note.links.entityName || 'CRM Entity',
          type: 'school',
          createdAt: note.createdAt,
          originHref: `/admin/entities/${encodeURIComponent(note.links.entityId)}`,
          connectionsCount: 0,
          isHub: false,
          clusterId: 'cluster-crm',
        });
      }
      if (note.links.contactId && !nodeMap.has(note.links.contactId)) {
        nodeMap.set(note.links.contactId, {
          id: note.links.contactId,
          label: note.links.contactName || 'Contact',
          type: 'contact',
          createdAt: note.createdAt,
          originHref: `/admin/contacts?id=${encodeURIComponent(note.links.contactId)}`,
          connectionsCount: 0,
          isHub: false,
          clusterId: 'cluster-crm',
        });
      }
      if (note.links.dealId && !nodeMap.has(note.links.dealId)) {
        nodeMap.set(note.links.dealId, {
          id: note.links.dealId,
          label: note.links.dealName || 'Deal',
          type: 'deal',
          createdAt: note.createdAt,
          originHref: `/admin/deals?id=${encodeURIComponent(note.links.dealId)}`,
          connectionsCount: 0,
          isHub: false,
          clusterId: 'cluster-crm',
        });
      }
      if (note.links.taskId && !nodeMap.has(note.links.taskId)) {
        nodeMap.set(note.links.taskId, {
          id: note.links.taskId,
          label: note.links.taskName || 'Task',
          type: 'task',
          createdAt: note.createdAt,
          originHref: `/admin/tasks?id=${encodeURIComponent(note.links.taskId)}`,
          connectionsCount: 0,
          isHub: false,
          clusterId: 'cluster-crm',
        });
      }
    }
  }

  const edges: GraphEdge[] = [];
  const edgeKeySet = new Set<string>();

  // 4. Ingest Explicit Knowledge Relations
  for (const rel of relations) {
    if (nodeMap.has(rel.fromObjectId) && nodeMap.has(rel.toObjectId)) {
      const edgeKey = `${rel.fromObjectId}->${rel.toObjectId}:${rel.relationType}`;
      if (!edgeKeySet.has(edgeKey)) {
        edgeKeySet.add(edgeKey);
        edges.push({
          id: rel.id,
          source: rel.fromObjectId,
          target: rel.toObjectId,
          relationType: rel.relationType,
          label: getRelationDisplayLabel(rel.relationType),
          confidence: rel.confidence ?? 1.0,
          sourceKind: rel.source,
          bidirectional: rel.relationType === 'related_to' || rel.relationType === 'duplicates',
        });

        connectionCounts.set(rel.fromObjectId, (connectionCounts.get(rel.fromObjectId) || 0) + 1);
        connectionCounts.set(rel.toObjectId, (connectionCounts.get(rel.toObjectId) || 0) + 1);
      }
    }
  }

  // 5. Ingest Implicit Note Links as Edges
  for (const note of notes) {
    if (note.links) {
      const linkMappings: Array<{ targetId?: string; relType: KnowledgeRelationType }> = [
        { targetId: note.links.entityId, relType: 'about_school' },
        { targetId: note.links.contactId, relType: 'about_contact' },
        { targetId: note.links.dealId, relType: 'about_deal' },
        { targetId: note.links.taskId, relType: 'depends_on' },
        { targetId: note.links.campaignId, relType: 'about_campaign' },
      ];

      for (const { targetId, relType } of linkMappings) {
        if (targetId && nodeMap.has(targetId)) {
          const edgeKey = `${note.id}->${targetId}:${relType}`;
          if (!edgeKeySet.has(edgeKey)) {
            edgeKeySet.add(edgeKey);
            edges.push({
              id: `edge_implicit_${note.id}_${targetId}`,
              source: note.id,
              target: targetId,
              relationType: relType,
              label: getRelationDisplayLabel(relType),
              confidence: 0.95,
              sourceKind: 'system',
              bidirectional: false,
            });

            connectionCounts.set(note.id, (connectionCounts.get(note.id) || 0) + 1);
            connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1);
          }
        }
      }
    }
  }

  // 6. Detect Hub Nodes (degree in top 10% or >= 5 connections)
  const nodes = Array.from(nodeMap.values());
  for (const node of nodes) {
    const count = connectionCounts.get(node.id) || 0;
    node.connectionsCount = count;
    node.isHub = count >= 5;
  }

  // 7. Cluster Partitioning via Connected Components
  const clusters = detectGraphClusters(nodes, edges);
  for (const [clusterId, nodeIds] of clusters.entries()) {
    for (const nodeId of nodeIds) {
      const node = nodeMap.get(nodeId);
      if (node) {
        node.clusterId = clusterId;
      }
    }
  }

  const metrics = computeGraphMetrics(nodes, edges);

  return {
    nodes,
    edges,
    metrics,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Detects connected components / community clusters in the graph.
 */
export function detectGraphClusters(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, string[]> {
  const adj = new Map<string, Set<string>>();
  for (const node of nodes) {
    adj.set(node.id, new Set());
  }
  for (const edge of edges) {
    adj.get(edge.source)?.add(edge.target);
    adj.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const clusters = new Map<string, string[]>();
  let clusterIndex = 1;

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const clusterId = `cluster-${clusterIndex++}`;
      const group: string[] = [];
      const queue: string[] = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        group.push(curr);

        const neighbors = adj.get(curr);
        if (neighbors) {
          for (const n of neighbors) {
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          }
        }
      }

      clusters.set(clusterId, group);
    }
  }

  return clusters;
}

/**
 * Computes network metrics: density, hubs, isolation count.
 */
export function computeGraphMetrics(nodes: GraphNode[], edges: GraphEdge[]): GraphMetrics {
  const n = nodes.length;
  const e = edges.length;
  // Maximum possible edges in directed graph: n * (n - 1)
  const maxEdges = n > 1 ? n * (n - 1) : 1;
  const density = n > 1 ? Number((e / maxEdges).toFixed(4)) : 0;

  let isolatedCount = 0;
  let hubNodeId: string | undefined;
  let hubNodeLabel: string | undefined;
  let maxDegree = -1;

  for (const node of nodes) {
    if (node.connectionsCount === 0) {
      isolatedCount++;
    }
    if (node.connectionsCount > maxDegree) {
      maxDegree = node.connectionsCount;
      if (maxDegree > 0) {
        hubNodeId = node.id;
        hubNodeLabel = node.label;
      }
    }
  }

  const clusters = detectGraphClusters(nodes, edges);

  return {
    totalNodes: n,
    totalEdges: e,
    density,
    clustersCount: clusters.size,
    isolatedCount,
    hubNodeId,
    hubNodeLabel,
  };
}

/**
 * Cycle-safe BFS pathfinding algorithm connecting any two objects.
 * Prevents infinite loops via a visited set and a max-hop limit of 10.
 */
export function findShortestGraphPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string,
  endId: string
): PathFindingResult {
  if (startId === endId) {
    return {
      found: true,
      path: [startId],
      edges: [],
      distance: 0,
      explanation: 'Start and target are the same knowledge object.',
    };
  }

  const adj = new Map<string, Array<{ target: string; edge: GraphEdge }>>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    adj.get(edge.source)?.push({ target: edge.target, edge });
    // In knowledge graph semantic traversal, allow bidirectional exploration
    // so users querying connections discover how two concepts relate regardless of selection order
    adj.get(edge.target)?.push({ target: edge.source, edge });
  }

  const queue: Array<{ id: string; path: string[]; edges: GraphEdge[] }> = [
    { id: startId, path: [startId], edges: [] },
  ];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.path.length > 10) {
      break; // Max traversal depth reached
    }

    const neighbors = adj.get(current.id) || [];
    for (const { target, edge } of neighbors) {
      if (target === endId) {
        const fullPath = [...current.path, target];
        const fullEdges = [...current.edges, edge];
        return {
          found: true,
          path: fullPath,
          edges: fullEdges,
          distance: fullEdges.length,
          explanation: `Connected in ${fullEdges.length} step${fullEdges.length === 1 ? '' : 's'} via: ${fullEdges
            .map((e) => e.label)
            .join(' → ')}`,
        };
      }

      if (!visited.has(target)) {
        visited.add(target);
        queue.push({
          id: target,
          path: [...current.path, target],
          edges: [...current.edges, edge],
        });
      }
    }
  }

  return {
    found: false,
    path: [],
    edges: [],
    distance: Infinity,
    explanation: 'No connecting relationship found within 10 hops.',
  };
}

/**
 * Extracts a k-hop sub-graph neighborhood around a focused node for Focus Mode.
 */
export function extractSubGraph(
  graphData: KnowledgeGraphData,
  focusNodeId: string,
  depth = 1
): KnowledgeGraphData {
  const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
  if (!nodeMap.has(focusNodeId)) {
    return graphData;
  }

  const subNodeIds = new Set<string>([focusNodeId]);
  let frontier = new Set<string>([focusNodeId]);

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>();
    for (const edge of graphData.edges) {
      if (frontier.has(edge.source) && !subNodeIds.has(edge.target)) {
        subNodeIds.add(edge.target);
        nextFrontier.add(edge.target);
      }
      if (frontier.has(edge.target) && !subNodeIds.has(edge.source)) {
        subNodeIds.add(edge.source);
        nextFrontier.add(edge.source);
      }
    }
    frontier = nextFrontier;
  }

  const filteredNodes = graphData.nodes.filter((n) => subNodeIds.has(n.id));
  const filteredEdges = graphData.edges.filter(
    (e) => subNodeIds.has(e.source) && subNodeIds.has(e.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    metrics: computeGraphMetrics(filteredNodes, filteredEdges),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Pure filter function for the Knowledge Graph.
 */
export function filterKnowledgeGraph(
  graphData: KnowledgeGraphData,
  options: KnowledgeGraphFilterOptions
): KnowledgeGraphData {
  let filteredNodes = graphData.nodes;
  let filteredEdges = graphData.edges;

  // 1. Filter by Node Types
  if (options.nodeTypes && options.nodeTypes.length > 0) {
    const allowed = new Set(options.nodeTypes);
    filteredNodes = filteredNodes.filter((n) => allowed.has(n.type));
  }

  // 2. Filter by Search Query
  if (options.searchQuery && options.searchQuery.trim().length > 0) {
    const q = options.searchQuery.toLowerCase().trim();
    filteredNodes = filteredNodes.filter(
      (n) => n.label.toLowerCase().includes(q) || (n.authorName && n.authorName.toLowerCase().includes(q))
    );
  }

  // 3. Filter by Cluster
  if (options.clusterId) {
    filteredNodes = filteredNodes.filter((n) => n.clusterId === options.clusterId);
  }

  // 4. Filter Isolated nodes if requested
  if (options.showIsolated === false) {
    filteredNodes = filteredNodes.filter((n) => n.connectionsCount > 0);
  }

  // 5. Cap node limit if requested
  if (options.limit && options.limit > 0 && filteredNodes.length > options.limit) {
    filteredNodes = filteredNodes.slice(0, options.limit);
  }

  const remainingNodeIds = new Set(filteredNodes.map((n) => n.id));

  // 6. Filter Edges (must connect remaining nodes)
  filteredEdges = filteredEdges.filter(
    (e) => remainingNodeIds.has(e.source) && remainingNodeIds.has(e.target)
  );

  // 7. Filter by Relation Types
  if (options.relationTypes && options.relationTypes.length > 0) {
    const allowedRel = new Set(options.relationTypes);
    filteredEdges = filteredEdges.filter((e) => allowedRel.has(e.relationType));
  }

  // 8. Filter by Minimum Confidence
  if (options.minConfidence !== undefined && options.minConfidence > 0) {
    filteredEdges = filteredEdges.filter((e) => e.confidence >= (options.minConfidence || 0));
  }

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    metrics: computeGraphMetrics(filteredNodes, filteredEdges),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Extracts incoming backlinks and reverse citations for any knowledge object or CRM entity.
 */
export function extractBacklinks(
  objectId: string,
  relations: KnowledgeRelation[],
  notesMap: Map<string, UnifiedNote>
): BacklinkItem[] {
  const backlinks: BacklinkItem[] = [];

  for (const rel of relations) {
    if (rel.toObjectId === objectId) {
      const sourceNote = notesMap.get(rel.fromObjectId);
      backlinks.push({
        relationId: rel.id,
        sourceNodeId: rel.fromObjectId,
        sourceNodeType: rel.fromObjectType,
        sourceTitle: sourceNote?.title || 'Referencing Object',
        relationType: rel.relationType,
        confidence: rel.confidence,
        originHref: sourceNote?.originHref || `/admin/quick-notes?id=${encodeURIComponent(rel.fromObjectId)}`,
        createdAt: rel.createdAt,
        authorName: rel.createdByName || sourceNote?.createdByName,
      });
    }
  }

  return backlinks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/* ==========================================================================
 * PHASE 6: IDEA INTELLIGENCE STUDIO & VISUAL IDEA MAPPING PURE FUNCTIONS
 * ========================================================================== */

/**
 * Calculates normalized prioritization score (ICE / RICE / Value:Effort).
 *
 * Formulas:
 * - standard_ice: (Impact * Confidence) / Effort (normalized to 0.1 - 100.0)
 * - weighted_ice: (0.4 * Impact + 0.4 * Confidence - 0.2 * Effort) * 10
 * - value_effort: (Impact / Effort) * 10
 */
export function calculateIceScore(
  impact: number,
  effort: number,
  confidence: number,
  formula: PrioritizationFormula = 'standard_ice'
): number {
  const safeI = Math.min(10, Math.max(1, impact || 5));
  const safeE = Math.min(10, Math.max(1, effort || 5));
  const safeC = Math.min(10, Math.max(1, confidence || 5));

  let score = 0;
  if (formula === 'weighted_ice') {
    score = (0.4 * safeI + 0.4 * safeC - 0.2 * safeE) * 10;
  } else if (formula === 'value_effort') {
    score = (safeI / safeE) * 10;
  } else {
    // standard_ice: (I * C) / E -> Max 100 (10*10/1), Min 0.1 (1*1/10)
    score = (safeI * safeC) / safeE;
  }

  return Math.round(score * 10) / 10;
}

/**
 * Categorizes an Idea into 1 of 4 quadrants based on Impact and Effort.
 */
export function getIceQuadrant(impact: number, effort: number): IceQuadrantType {
  const isHighImpact = (impact || 5) >= 6;
  const isLowEffort = (effort || 5) <= 5;

  if (isHighImpact && isLowEffort) return 'quick_wins';
  if (isHighImpact && !isLowEffort) return 'strategic_bets';
  if (!isHighImpact && isLowEffort) return 'fill_ins';
  return 'hard_slogs';
}

/**
 * Validates a lifecycle transition against the Idea State Machine and Backoffice governance gates.
 */
export function validateLifecycleTransition(
  currentStage: IdeaLifecycleStage,
  targetStage: IdeaLifecycleStage,
  idea: Idea,
  strictValidationGate = false,
  minEvidenceForApproval = 2
): { allowed: boolean; reason?: string } {
  if (currentStage === targetStage) {
    return { allowed: true };
  }

  // Always allow moving to archived, rejected, or superseded from any stage
  if (['archived', 'rejected', 'superseded'].includes(targetStage)) {
    return { allowed: true };
  }

  // Strict Validation Gate checks
  if (strictValidationGate) {
    // To move to 'validating', must have at least 1 hypothesis defined
    if (targetStage === 'validating') {
      if (!idea.hypotheses || idea.hypotheses.length === 0) {
        return {
          allowed: false,
          reason: 'Cannot start validating without at least 1 testable hypothesis defined.',
        };
      }
    }

    // To move to 'validated', must have at least 1 proven hypothesis or supported assumption
    if (targetStage === 'validated') {
      const hasProven = idea.hypotheses?.some((h) => h.status === 'proven');
      const hasSupported = idea.assumptions?.some((a) => a.status === 'supported');
      if (!hasProven && !hasSupported) {
        return {
          allowed: false,
          reason: 'Cannot mark as validated without at least 1 proven hypothesis or supported assumption.',
        };
      }
    }

    // To move to 'approved' or 'implemented', must have reached validation and met minimum evidence count
    if (['approved', 'implemented'].includes(targetStage)) {
      if (idea.validationStatus !== 'validated' && idea.lifecycleStage !== 'validated') {
        return {
          allowed: false,
          reason: 'Idea must be validated before formal approval or implementation.',
        };
      }

      const totalEvidence = (idea.evidenceIds?.length || 0) +
        (idea.assumptions?.reduce((acc, a) => acc + (a.evidenceIds?.length || 0), 0) || 0) +
        (idea.hypotheses?.reduce((acc, h) => acc + (h.evidenceIds?.length || 0), 0) || 0);

      if (totalEvidence < minEvidenceForApproval) {
        return {
          allowed: false,
          reason: `Approval requires at least ${minEvidenceForApproval} attached empirical evidence items (currently: ${totalEvidence}).`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Computes an empirical validation summary across an Idea's assumptions, hypotheses, and evidence.
 */
export function calculateIdeaValidationSummary(idea: Idea): IdeaValidationSummary {
  const totalAssumptions = idea.assumptions?.length || 0;
  const supportedAssumptions = idea.assumptions?.filter((a) => a.status === 'supported').length || 0;
  const invalidatedAssumptions = idea.assumptions?.filter((a) => a.status === 'invalidated').length || 0;

  const totalHypotheses = idea.hypotheses?.length || 0;
  const provenHypotheses = idea.hypotheses?.filter((h) => h.status === 'proven').length || 0;

  const directEvidence = idea.evidenceIds?.length || 0;
  const assumptionEvidence = idea.assumptions?.reduce((acc, a) => acc + (a.evidenceIds?.length || 0), 0) || 0;
  const hypothesisEvidence = idea.hypotheses?.reduce((acc, h) => acc + (h.evidenceIds?.length || 0), 0) || 0;
  const totalEvidenceCount = directEvidence + assumptionEvidence + hypothesisEvidence;

  let validationPercentage = 0;
  const totalCheckable = totalAssumptions + totalHypotheses;
  if (totalCheckable > 0) {
    const verified = supportedAssumptions + provenHypotheses;
    validationPercentage = Math.round((verified / totalCheckable) * 100);
  }

  return {
    totalAssumptions,
    supportedAssumptions,
    invalidatedAssumptions,
    totalHypotheses,
    provenHypotheses,
    totalEvidenceCount,
    validationPercentage,
  };
}

/**
 * Pure projection converting an Idea and its related knowledge into an initial hierarchical Visual Canvas.
 */
export function projectIdeaToCanvas(
  idea: Idea,
  relatedNotes: UnifiedNote[] = [],
  crmEntities: Array<{ id: string; name: string; type: string }> = []
): IdeaCanvasLayout {
  const nodes: IdeaCanvasNode[] = [];
  const edges: IdeaCanvasEdge[] = [];

  const centerX = 500;
  const centerY = 350;

  // 1. Core Idea Node
  const coreNodeId = `node-core-${idea.id}`;
  nodes.push({
    id: coreNodeId,
    type: 'core_idea',
    title: idea.title,
    description: idea.summary || idea.problem?.slice(0, 100),
    x: centerX,
    y: centerY,
    width: 220,
    height: 90,
    status: idea.lifecycleStage,
    confidence: idea.confidence,
    color: '#3b82f6',
  });

  // 2. Problem Node (Left Top)
  if (idea.problem) {
    const probNodeId = `node-prob-${idea.id}`;
    nodes.push({
      id: probNodeId,
      type: 'problem',
      title: 'Problem Statement',
      description: idea.problem,
      x: centerX - 320,
      y: centerY - 140,
      width: 200,
      height: 80,
      color: '#ef4444',
    });
    edges.push({
      id: `edge-${coreNodeId}-${probNodeId}`,
      fromNodeId: coreNodeId,
      toNodeId: probNodeId,
      label: 'solves',
      type: 'strong',
      color: '#ef4444',
    });
  }

  // 3. Solution Node (Right Top)
  if (idea.proposedSolution) {
    const solNodeId = `node-sol-${idea.id}`;
    nodes.push({
      id: solNodeId,
      type: 'solution',
      title: 'Proposed Solution',
      description: idea.proposedSolution,
      x: centerX + 320,
      y: centerY - 140,
      width: 200,
      height: 80,
      color: '#10b981',
    });
    edges.push({
      id: `edge-${coreNodeId}-${solNodeId}`,
      fromNodeId: coreNodeId,
      toNodeId: solNodeId,
      label: 'proposes',
      type: 'strong',
      color: '#10b981',
    });
  }

  // 4. Assumptions Nodes (Bottom Left Fan)
  idea.assumptions?.forEach((assump, index) => {
    const assumpNodeId = `node-assump-${assump.id || index}`;
    const xOffset = centerX - 260 + index * 60;
    const yOffset = centerY + 180 + (index % 2) * 60;

    nodes.push({
      id: assumpNodeId,
      type: 'assumption',
      title: `Assumption: ${assump.statement.slice(0, 45)}`,
      description: assump.statement,
      x: xOffset,
      y: yOffset,
      width: 180,
      height: 70,
      status: assump.status,
      riskLevel: assump.riskLevel,
      referenceId: assump.id,
      color: '#f59e0b',
    });

    edges.push({
      id: `edge-${coreNodeId}-${assumpNodeId}`,
      fromNodeId: coreNodeId,
      toNodeId: assumpNodeId,
      label: 'assumes',
      type: 'dashed',
      color: '#f59e0b',
    });
  });

  // 5. Hypotheses Nodes (Bottom Right Fan)
  idea.hypotheses?.forEach((hypo, index) => {
    const hypoNodeId = `node-hypo-${hypo.id || index}`;
    const xOffset = centerX + 180 + index * 80;
    const yOffset = centerY + 180 + (index % 2) * 60;

    nodes.push({
      id: hypoNodeId,
      type: 'hypothesis',
      title: `Hypothesis: ${hypo.statement.slice(0, 45)}`,
      description: hypo.expectedOutcome || hypo.statement,
      x: xOffset,
      y: yOffset,
      width: 180,
      height: 70,
      status: hypo.status,
      referenceId: hypo.id,
      color: '#8b5cf6',
    });

    edges.push({
      id: `edge-${coreNodeId}-${hypoNodeId}`,
      fromNodeId: coreNodeId,
      toNodeId: hypoNodeId,
      label: 'tests',
      type: 'default',
      color: '#8b5cf6',
    });
  });

  // 6. CRM Entity Nodes (Top Center)
  crmEntities.slice(0, 3).forEach((entity, index) => {
    const entityNodeId = `node-crm-${entity.id}`;
    nodes.push({
      id: entityNodeId,
      type: 'crm_entity',
      title: entity.name,
      description: `Target ${entity.type}`,
      x: centerX - 120 + index * 120,
      y: centerY - 250,
      width: 150,
      height: 60,
      color: '#06b6d4',
    });

    edges.push({
      id: `edge-${coreNodeId}-${entityNodeId}`,
      fromNodeId: coreNodeId,
      toNodeId: entityNodeId,
      label: 'targets',
      type: 'default',
      color: '#06b6d4',
    });
  });

  // 7. Related Knowledge Note Nodes (Far Right Fan)
  relatedNotes.slice(0, 3).forEach((note, index) => {
    const noteNodeId = `node-note-${note.id}`;
    nodes.push({
      id: noteNodeId,
      type: 'solution',
      title: note.title || 'Related Note',
      description: note.plainText?.slice(0, 50) || 'Knowledge reference',
      x: centerX + 340 + index * 40,
      y: centerY + 60 + index * 60,
      width: 160,
      height: 60,
      color: '#0ea5e9',
    });

    edges.push({
      id: `edge-${coreNodeId}-${noteNodeId}`,
      fromNodeId: coreNodeId,
      toNodeId: noteNodeId,
      label: 'references',
      type: 'dashed',
      color: '#0ea5e9',
    });
  });

  return {
    nodes,
    edges,
    zoomLevel: 1.0,
    panOffset: { x: 0, y: 0 },
    lastSavedAt: new Date().toISOString(),
  };
}

/**
 * Pure filter function for workspace ideas.
 */
export function filterIdeas(ideas: Idea[], options: IdeaFilterOptions): Idea[] {
  let result = [...ideas];

  // 1. Lifecycle stage
  if (options.lifecycleStage && options.lifecycleStage !== 'all') {
    result = result.filter((i) => i.lifecycleStage === options.lifecycleStage);
  }

  // 2. Validation status
  if (options.validationStatus && options.validationStatus !== 'all') {
    result = result.filter((i) => i.validationStatus === options.validationStatus);
  }

  // 3. Priority
  if (options.priority && options.priority !== 'all') {
    result = result.filter((i) => i.priority === options.priority);
  }

  // 4. Quadrant
  if (options.quadrant && options.quadrant !== 'all') {
    result = result.filter((i) => getIceQuadrant(i.impact, i.effort) === options.quadrant);
  }

  // 5. Min ICE score
  if (options.minIceScore !== undefined && options.minIceScore > 0) {
    result = result.filter((i) => i.iceScore >= options.minIceScore!);
  }

  // 6. Search query
  if (options.searchQuery && options.searchQuery.trim().length > 0) {
    const q = options.searchQuery.toLowerCase().trim();
    result = result.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.summary && i.summary.toLowerCase().includes(q)) ||
        (i.problem && i.problem.toLowerCase().includes(q)) ||
        (i.proposedSolution && i.proposedSolution.toLowerCase().includes(q)) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        (i.createdByName && i.createdByName.toLowerCase().includes(q))
    );
  }

  // 7. Tags
  if (options.tags && options.tags.length > 0) {
    const filterTags = new Set(options.tags.map((t) => t.toLowerCase()));
    result = result.filter((i) => i.tags.some((t) => filterTags.has(t.toLowerCase())));
  }

  // 8. Entity Link
  if (options.entityId) {
    result = result.filter(
      (i) =>
        i.targetAudience?.entityId === options.entityId ||
        i.targetAudience?.contactId === options.entityId ||
        i.targetAudience?.dealId === options.entityId
    );
  }

  return result;
}

/**
 * Display label & color mapping for Idea Lifecycle Stages.
 */
export function getLifecycleStageDisplayLabel(stage: IdeaLifecycleStage): {
  label: string;
  colorClass: string;
  badgeBg: string;
} {
  switch (stage) {
    case 'captured':
      return { label: 'Captured', colorClass: 'text-slate-500', badgeBg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' };
    case 'exploring':
      return { label: 'Exploring', colorClass: 'text-indigo-500', badgeBg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' };
    case 'structured':
      return { label: 'Structured', colorClass: 'text-blue-500', badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' };
    case 'gathering_evidence':
      return { label: 'Gathering Evidence', colorClass: 'text-cyan-500', badgeBg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' };
    case 'validating':
      return { label: 'Validating', colorClass: 'text-amber-500', badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' };
    case 'validated':
      return { label: 'Validated', colorClass: 'text-emerald-500', badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' };
    case 'approved':
      return { label: 'Approved', colorClass: 'text-teal-600', badgeBg: 'bg-teal-500/10 text-teal-700 dark:text-teal-300' };
    case 'implemented':
      return { label: 'Implemented', colorClass: 'text-purple-600', badgeBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' };
    case 'measured':
      return { label: 'Measured', colorClass: 'text-sky-600', badgeBg: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' };
    case 'archived':
      return { label: 'Archived', colorClass: 'text-muted-foreground', badgeBg: 'bg-muted text-muted-foreground' };
    case 'rejected':
      return { label: 'Rejected', colorClass: 'text-destructive', badgeBg: 'bg-destructive/10 text-destructive' };
    case 'superseded':
      return { label: 'Superseded', colorClass: 'text-muted-foreground', badgeBg: 'bg-muted text-muted-foreground' };
    default:
      return { label: stage, colorClass: 'text-muted-foreground', badgeBg: 'bg-muted text-muted-foreground' };
  }
}

/**
 * Display label & styling for Validation Status.
 */
export function getValidationStatusDisplayLabel(status: IdeaValidationStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'unvalidated':
      return { label: 'Unvalidated', badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300/40' };
    case 'testing':
      return { label: 'Testing', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    case 'supported':
      return { label: 'Supported', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    case 'validated':
      return { label: 'Validated', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    case 'invalidated':
      return { label: 'Invalidated', badgeClass: 'bg-destructive/10 text-destructive border-destructive/30' };
    default:
      return { label: status, badgeClass: 'bg-muted text-muted-foreground border-border' };
  }
}

/**
 * Display label & styling for Assumption Risk Levels.
 */
export function getAssumptionRiskDisplay(risk: IdeaAssumptionRiskLevel): {
  label: string;
  badgeClass: string;
} {
  switch (risk) {
    case 'critical':
      return { label: 'Critical Risk', badgeClass: 'bg-destructive/15 text-destructive font-bold' };
    case 'high':
      return { label: 'High Risk', badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' };
    case 'medium':
      return { label: 'Medium Risk', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' };
    case 'low':
      return { label: 'Low Risk', badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' };
    default:
      return { label: risk, badgeClass: 'bg-muted text-muted-foreground' };
  }
}

/* ==========================================================================
 * PHASE 7: KNOWLEDGE INBOX, INSIGHTS & GOVERNANCE PURE DOMAIN LOGIC
 * ========================================================================== */

/**
 * Pure lexical tokenization into lowercase alpha words.
 */
function tokenizeText(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Generates character 3-grams for substring similarity matching.
 */
function generateTrigrams(text: string): Set<string> {
  const normalized = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const trigrams = new Set<string>();
  if (normalized.length < 3) {
    if (normalized.length > 0) trigrams.add(normalized);
    return trigrams;
  }
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.substring(i, i + 3));
  }
  return trigrams;
}

/**
 * Fast pure lexical similarity and duplicate detection between two text strings.
 * Combines Jaccard Word Overlap (60%) and Character Trigram Overlap (40%).
 *
 * @param textA Source text
 * @param textB Candidate text
 * @param threshold Minimum similarity score to be marked as duplicate (default 0.80)
 */
export function detectLexicalDuplicates(
  textA: string,
  textB: string,
  threshold = 0.8
): {
  isDuplicate: boolean;
  similarityScore: number;
  overlappingTerms: string[];
} {
  const wordsA = new Set(tokenizeText(textA));
  const wordsB = new Set(tokenizeText(textB));

  if (wordsA.size === 0 || wordsB.size === 0) {
    return { isDuplicate: false, similarityScore: 0, overlappingTerms: [] };
  }

  // Jaccard word overlap
  const intersectionWords = [...wordsA].filter((w) => wordsB.has(w));
  const unionWordsSize = new Set([...wordsA, ...wordsB]).size;
  const wordJaccard = unionWordsSize > 0 ? intersectionWords.length / unionWordsSize : 0;

  // Trigram character overlap
  const triA = generateTrigrams(textA);
  const triB = generateTrigrams(textB);
  let triIntersection = 0;
  triA.forEach((t) => {
    if (triB.has(t)) triIntersection++;
  });
  const triUnion = new Set([...triA, ...triB]).size;
  const triScore = triUnion > 0 ? triIntersection / triUnion : 0;

  // Weighted composite score (0.0 to 1.0)
  const compositeScore = Number((0.6 * wordJaccard + 0.4 * triScore).toFixed(3));

  // Find top significant overlapping terms (exclude short generic stop words)
  const stopWords = new Set(['the', 'and', 'with', 'for', 'that', 'this', 'have', 'from', 'they', 'will']);
  const keyOverlappingTerms = intersectionWords
    .filter((w) => !stopWords.has(w) && w.length > 3)
    .slice(0, 8);

  return {
    isDuplicate: compositeScore >= threshold,
    similarityScore: compositeScore,
    overlappingTerms: keyOverlappingTerms,
  };
}

/**
 * Pure confidence evaluation for detected contradictions between two claims.
 * Higher evidence count and distinct assertions elevate certainty.
 */
export function evaluateContradictionConfidence(
  thesis: string,
  antithesis: string,
  evidenceCount: number
): number {
  if (!thesis || !antithesis) return 0;

  const tLength = thesis.trim().length;
  const aLength = antithesis.trim().length;
  if (tLength < 10 || aLength < 10) return 0.4;

  // Base score
  let score = 0.70;

  // Evidence backing bonus
  if (evidenceCount >= 5) score += 0.20;
  else if (evidenceCount >= 2) score += 0.12;
  else if (evidenceCount === 1) score += 0.05;

  return Math.min(Number(score.toFixed(2)), 0.98);
}

/**
 * Computes an executive importance score for an organizational insight.
 * Combines severity weight with empirical evidence depth.
 */
export function calculateInsightScore(insight: KnowledgeInsight): number {
  let baseScore = 30;
  switch (insight.severity) {
    case 'critical':
      baseScore = 100;
      break;
    case 'high':
      baseScore = 75;
      break;
    case 'medium':
      baseScore = 50;
      break;
    case 'low':
      baseScore = 25;
      break;
  }

  const evidenceBonus = Math.min((insight.evidenceCount || 0) * 4, 30);
  return baseScore + evidenceBonus;
}

/**
 * Multi-criteria pure filter for Knowledge Inbox items.
 */
export function filterInboxItems(
  items: KnowledgeInboxItem[],
  options: InboxFilterOptions
): KnowledgeInboxItem[] {
  const { type, status, searchQuery, minConfidence, sourceKnowledgeId, limit } = options;

  let filtered = items.filter((item) => {
    if (type && type !== 'all' && item.type !== type) return false;
    if (status && status !== 'all' && item.status !== status) return false;
    if (minConfidence !== undefined && item.confidence < minConfidence) return false;
    if (sourceKnowledgeId && item.sourceKnowledgeId !== sourceKnowledgeId && item.targetKnowledgeId !== sourceKnowledgeId) return false;

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchSource = item.sourceKnowledgeTitle?.toLowerCase().includes(q);
      const matchTarget = item.targetKnowledgeTitle?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchSource && !matchTarget) return false;
    }

    return true;
  });

  // Sort: Pending items first, then higher confidence, then newest
  filtered.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

/**
 * Multi-criteria pure filter for Insight Center knowledge insights.
 */
export function filterInsights(
  insights: KnowledgeInsight[],
  options: InsightFilterOptions
): KnowledgeInsight[] {
  const { type, severity, status, searchQuery, minEvidenceCount, limit } = options;

  let filtered = insights.filter((ins) => {
    if (type && type !== 'all' && ins.type !== type) return false;
    if (severity && severity !== 'all' && ins.severity !== severity) return false;
    if (status && status !== 'all' && ins.status !== status) return false;
    if (minEvidenceCount !== undefined && (ins.evidenceCount || 0) < minEvidenceCount) return false;

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = ins.title?.toLowerCase().includes(q);
      const matchSummary = ins.summary?.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary) return false;
    }

    return true;
  });

  // Sort by highest insight score (severity + evidence count), then newest
  filtered.sort((a, b) => {
    const scoreA = calculateInsightScore(a);
    const scoreB = calculateInsightScore(b);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

/**
 * Pure TipTap document merger combining source content into target document.
 */
export function mergeKnowledgeObjects(
  sourceDoc: NoteDocument | undefined,
  targetDoc: NoteDocument | undefined,
  strategy: MergeStrategy = 'concatenate'
): NoteDocument {
  const baseTarget: NoteDocument = targetDoc || { type: 'doc', content: [] };
  const baseSource: NoteDocument = sourceDoc || { type: 'doc', content: [] };

  const targetContent = Array.isArray(baseTarget.content) ? [...baseTarget.content] : [];
  const sourceContent = Array.isArray(baseSource.content) ? [...baseSource.content] : [];

  if (strategy === 'keep_target_enrich_metadata') {
    return { type: 'doc', content: targetContent };
  }

  if (strategy === 'append_summary') {
    const dividerNode = { type: 'horizontalRule' };
    const headingNode = {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Merged Findings' }],
    };
    return {
      type: 'doc',
      content: [...targetContent, dividerNode, headingNode, ...sourceContent],
    };
  }

  // Default: Concatenate with a separator
  const dividerNode = { type: 'horizontalRule' };
  return {
    type: 'doc',
    content: [...targetContent, dividerNode, ...sourceContent],
  };
}

/**
 * Display label & icon styling for Knowledge Inbox Types.
 */
export function getInboxTypeDisplayLabel(type: KnowledgeInboxType): {
  label: string;
  badgeClass: string;
} {
  switch (type) {
    case 'classification':
      return { label: 'Classification', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    case 'link_suggestion':
      return { label: 'Link Suggestion', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    case 'duplicate_detection':
      return { label: 'Potential Duplicate', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    case 'contradiction_detection':
      return { label: 'Contradiction Alert', badgeClass: 'bg-destructive/10 text-destructive border-destructive/30' };
    case 'ai_insight':
      return { label: 'AI Insight', badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
    case 'action_suggestion':
      return { label: 'Suggested Action', badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' };
    case 'idea_suggestion':
      return { label: 'Idea Suggestion', badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' };
    default:
      return { label: type, badgeClass: 'bg-muted text-muted-foreground border-border' };
  }
}

/**
 * Display label & badge styling for Insight Severity.
 */
export function getInsightSeverityDisplayLabel(severity: KnowledgeInsightSeverity): {
  label: string;
  badgeClass: string;
  dotColor: string;
} {
  switch (severity) {
    case 'critical':
      return { label: 'Critical Severity', badgeClass: 'bg-destructive/15 text-destructive font-bold border-destructive/40', dotColor: 'bg-destructive' };
    case 'high':
      return { label: 'High Priority', badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40', dotColor: 'bg-orange-500' };
    case 'medium':
      return { label: 'Medium Priority', badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40', dotColor: 'bg-blue-500' };
    case 'low':
      return { label: 'Low / Informational', badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300/40', dotColor: 'bg-slate-400' };
    default:
      return { label: severity, badgeClass: 'bg-muted text-muted-foreground border-border', dotColor: 'bg-muted-foreground' };
  }
}

/**
 * Display label & styling for Insight Type.
 */
export function getInsightTypeDisplayLabel(type: KnowledgeInsightType): {
  label: string;
  badgeClass: string;
} {
  switch (type) {
    case 'trend':
      return { label: 'Emerging Trend', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' };
    case 'recurring_problem':
      return { label: 'Recurring Objection', badgeClass: 'bg-destructive/10 text-destructive' };
    case 'risk':
      return { label: 'Operational Risk', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' };
    case 'opportunity':
      return { label: 'Growth Opportunity', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' };
    case 'emerging_theme':
      return { label: 'Emerging Theme', badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' };
    case 'pattern':
      return { label: 'Behavioral Pattern', badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' };
    default:
      return { label: type, badgeClass: 'bg-muted text-muted-foreground' };
  }
}

// ============================================================================
// Phase 8: Campaign & Deal Intelligence Domain Logic
// ============================================================================

/**
 * Pure keyword patterns mapped to objection categories.
 */
const OBJECTION_KEYWORD_PATTERNS: Record<ObjectionCategory, string[]> = {
  pricing: ['too expensive', 'cost', 'price', 'pricing', 'budget', 'discount', 'payment', 'fee', 'rates', 'cheap'],
  competitor: ['competitor', 'using another', 'alternative', 'vendor', 'already have', 'switched from', 'vs'],
  trust: ['security', 'compliance', 'data privacy', 'guarantee', 'reliability', 'sla', 'uptime', 'reputation', 'safe'],
  feature: ['missing', 'need feature', 'support for', 'does not have', 'cannot do', 'integration with', 'api', 'customization'],
  timing: ['not ready', 'next quarter', 'next year', 'too busy', 'implementing later', 'call back in', 'renewing'],
  general: ['not interested', 'no need', 'pass', 'happy with current', 'unclear'],
};

/**
 * Pure domain function to cluster recurring customer objections from note excerpts.
 * Uses N-gram tokenization and rule-based categorization with zero I/O.
 */
export function extractObjectionClusters(
  notes: Array<{ id: string; content: string; title: string }>
): ObjectionCluster[] {
  const categoryMap = new Map<ObjectionCategory, { quotes: string[]; sourceNoteIds: Set<string> }>();

  for (const cat of Object.keys(OBJECTION_KEYWORD_PATTERNS) as ObjectionCategory[]) {
    categoryMap.set(cat, { quotes: [], sourceNoteIds: new Set<string>() });
  }

  for (const note of notes) {
    const textLower = note.content.toLowerCase();
    const sentences = note.content.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 15);

    for (const [category, keywords] of Object.entries(OBJECTION_KEYWORD_PATTERNS) as Array<[ObjectionCategory, string[]]>) {
      for (const kw of keywords) {
        if (textLower.includes(kw)) {
          const matchSentence = sentences.find((s) => s.toLowerCase().includes(kw)) || note.title;
          const entry = categoryMap.get(category);
          if (entry) {
            entry.sourceNoteIds.add(note.id);
            if (entry.quotes.length < 5 && !entry.quotes.includes(matchSentence)) {
              entry.quotes.push(matchSentence);
            }
          }
          break;
        }
      }
    }
  }

  const clusters: ObjectionCluster[] = [];
  for (const [category, data] of categoryMap.entries()) {
    if (data.sourceNoteIds.size > 0) {
      const topicLabels: Record<ObjectionCategory, string> = {
        pricing: 'Budget & Pricing Friction',
        competitor: 'Incumbent & Alternative Solutions',
        trust: 'Security & Reliability Assurance',
        feature: 'Capability & Integration Gaps',
        timing: 'Procurement & Implementation Delays',
        general: 'General Reluctance & Need Clarity',
      };

      clusters.push({
        topic: topicLabels[category],
        category,
        quotes: data.quotes,
        sourceNoteIds: Array.from(data.sourceNoteIds),
        count: data.sourceNoteIds.size,
      });
    }
  }

  return clusters.sort((a, b) => b.count - a.count);
}

/**
 * Calculates relevance score (0-100) of a campaign concept against targeted audience keywords.
 */
export function calculateCampaignRelevanceScore(
  concept: CampaignConcept,
  targetAudienceKeywords: string[]
): number {
  if (targetAudienceKeywords.length === 0) return 75; // Baseline neutral score

  const corpus = `${concept.title} ${concept.targetAudience} ${concept.targetPersonaSummary} ${concept.valueProposition} ${concept.valuePillars.join(' ')} ${concept.coreMessageHook}`.toLowerCase();

  let matches = 0;
  for (const kw of targetAudienceKeywords) {
    if (corpus.includes(kw.toLowerCase().trim())) {
      matches += 1;
    }
  }

  const matchRatio = matches / targetAudienceKeywords.length;
  const rawScore = 50 + matchRatio * 45 + (concept.objectionRebuttals.length > 0 ? 5 : 0);
  return Math.min(100, Math.round(rawScore));
}

/**
 * Pure domain filter and sorter for Campaign Concepts.
 */
export function filterCampaignConcepts(
  concepts: CampaignConcept[],
  options: CampaignConceptFilterOptions = {}
): CampaignConcept[] {
  const {
    status = 'all',
    channel = 'all',
    searchQuery = '',
    sourceIdeaId,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const queryClean = searchQuery.toLowerCase().trim();

  const filtered = concepts.filter((c) => {
    if (status !== 'all' && c.status !== status) return false;
    if (channel !== 'all' && !c.recommendedChannels.includes(channel)) return false;
    if (sourceIdeaId && c.sourceIdeaId !== sourceIdeaId) return false;

    if (queryClean.length > 0) {
      const corpus = `${c.title} ${c.targetAudience} ${c.valueProposition} ${c.coreMessageHook}`.toLowerCase();
      if (!corpus.includes(queryClean)) return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'relevanceScore') {
      cmp = (a.relevanceScore ?? 0) - (b.relevanceScore ?? 0);
    } else if (sortBy === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });
}

/**
 * Formats an Objection Battlecard as a shareable sales / marketing snippet.
 */
export function formatBattlecardSnippet(battlecard: ObjectionBattlecard): string {
  return `### 🛡️ Battlecard: ${battlecard.topic}
**Objection:** "${battlecard.objection}"

**Tactical Rebuttal:**
${battlecard.rebuttalScript}

**Killer Question:**
👉 *"${battlecard.killerQuestion}"*

**Supporting Proof Points:**
${battlecard.proofPoints.map((p) => `• ${p}`).join('\n')}
`;
}

/**
 * Display metadata for Campaign Delivery Channels.
 */
export function getCampaignChannelMeta(channel: CampaignChannel): {
  label: string;
  iconName: string;
  badgeClass: string;
} {
  switch (channel) {
    case 'whatsapp':
      return { label: 'WhatsApp', iconName: 'MessageSquare', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    case 'sms':
      return { label: 'SMS Blast', iconName: 'Smartphone', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    case 'email':
      return { label: 'Email Outreach', iconName: 'Mail', badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
    case 'call_center':
      return { label: 'Call Center Script', iconName: 'PhoneCall', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    default:
      return { label: channel, iconName: 'Send', badgeClass: 'bg-muted text-muted-foreground border-border' };
  }
}

/**
 * Display metadata for Campaign Concept Status.
 */
export function getCampaignConceptStatusMeta(status: CampaignConceptStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'draft':
      return { label: 'Draft Concept', badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/40' };
    case 'approved':
      return { label: 'Approved Strategy', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    case 'deployed_to_campaign':
      return { label: 'Deployed to Studio', badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' };
    case 'archived':
      return { label: 'Archived', badgeClass: 'bg-muted text-muted-foreground border-border' };
    default:
      return { label: status, badgeClass: 'bg-muted text-muted-foreground border-border' };
  }
}

/**
 * Display metadata for Objection Categories.
 */
export function getObjectionCategoryMeta(category: ObjectionCategory): {
  label: string;
  badgeClass: string;
} {
  switch (category) {
    case 'pricing':
      return { label: 'Pricing & Budget', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    case 'competitor':
      return { label: 'Competitor / Alt', badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
    case 'trust':
      return { label: 'Trust & Security', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    case 'feature':
      return { label: 'Feature Gap', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    case 'timing':
      return { label: 'Timing & Delay', badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30' };
    case 'general':
    default:
      return { label: 'General Hesitation', badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/40' };
  }
}

// ---------------------------------------------------------------------------
// Phase 9: Multi-Workspace Knowledge Federation & Cross-Platform Ingestion
// ---------------------------------------------------------------------------

/**
 * Validates and sanitizes an inbound webhook ingestion payload.
 * Converts raw markdown or plain text into a sanitized TipTap NoteDocument AST.
 * Enforces SSRF URL validation and bounds maximum string sizes.
 */
export function validateIngestionPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  sanitizedPayload?: KnowledgeIngestionPayload;
  document?: NoteDocument;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Ingestion payload must be a non-null JSON object.' };
  }

  const p = payload as Record<string, unknown>;

  // Title validation
  const rawTitle = typeof p.title === 'string' ? p.title.trim() : '';
  if (!rawTitle) {
    return { valid: false, error: 'Title is required for incoming knowledge ingestion.' };
  }
  const sanitizedTitle = rawTitle.slice(0, 250);

  // Content validation
  const rawContent = typeof p.content === 'string' ? p.content.trim() : '';
  if (!rawContent) {
    return { valid: false, error: 'Content is required for incoming knowledge ingestion.' };
  }
  if (rawContent.length > 25000) {
    return { valid: false, error: 'Content exceeds maximum allowable size of 25,000 characters.' };
  }

  // Source validation
  const validSources: KnowledgeIngestionSource[] = [
    'slack',
    'discord',
    'email_forwarder',
    'whatsapp_bot',
    'chrome_extension',
    'webhook_rest',
    'csv_import',
    'json_import',
    'markdown_archive',
  ];
  const source = typeof p.source === 'string' && validSources.includes(p.source as KnowledgeIngestionSource)
    ? (p.source as KnowledgeIngestionSource)
    : 'webhook_rest';

  // SSRF URL Validation
  let sourceUrl: string | undefined;
  if (typeof p.sourceUrl === 'string' && p.sourceUrl.trim()) {
    const trimmedUrl = p.sourceUrl.trim();
    if (!isSafeHttpUrl(trimmedUrl)) {
      return { valid: false, error: 'sourceUrl failed security verification (disallowed protocol or private network address).' };
    }
    sourceUrl = trimmedUrl;
  }

  // Sanitize tags
  const tags: string[] = [];
  if (Array.isArray(p.tags)) {
    for (const tag of p.tags) {
      if (typeof tag === 'string' && tag.trim()) {
        const clean = tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 50);
        if (clean && !tags.includes(clean)) {
          tags.push(clean);
        }
      }
    }
  }

  // Strip dangerous HTML tags from content text
  const cleanContentText = rawContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '');

  // Convert content to TipTap NoteDocument AST
  const paragraphs = cleanContentText.split(/\n\n+/).filter(Boolean);
  const docContent = paragraphs.map((para) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: para.trim() }],
  }));

  const document: NoteDocument = {
    type: 'doc',
    content: docContent.length > 0 ? docContent : [{ type: 'paragraph', content: [{ type: 'text', text: cleanContentText }] }],
  };

  const sanitizedPayload: KnowledgeIngestionPayload = {
    title: sanitizedTitle,
    content: cleanContentText,
    source,
    sourceUrl,
    sourceAuthor: typeof p.sourceAuthor === 'string' ? p.sourceAuthor.slice(0, 100) : undefined,
    sourceChannel: typeof p.sourceChannel === 'string' ? p.sourceChannel.slice(0, 100) : undefined,
    tags,
    categoryName: typeof p.categoryName === 'string' ? p.categoryName.slice(0, 100) : undefined,
    targetSpaceId: typeof p.targetSpaceId === 'string' ? p.targetSpaceId : undefined,
    entityId: typeof p.entityId === 'string' ? p.entityId : undefined,
    contactId: typeof p.contactId === 'string' ? p.contactId : undefined,
    dealId: typeof p.dealId === 'string' ? p.dealId : undefined,
    priority: (['low', 'medium', 'high', 'urgent'].includes(p.priority as string) ? p.priority : 'medium') as 'low' | 'medium' | 'high' | 'urgent',
    metadata: typeof p.metadata === 'object' && p.metadata !== null ? (p.metadata as Record<string, unknown>) : undefined,
  };

  return { valid: true, sanitizedPayload, document };
}

/**
 * Serializes workspace knowledge objects (notes, ideas, battlecards, insights) into standardized Markdown archives with YAML frontmatter.
 */
export function serializeKnowledgeToMarkdownArchive(params: {
  notes: QuickNote[];
  ideas?: Idea[];
  battlecards?: ObjectionBattlecard[];
  insights?: KnowledgeInsight[];
  spaces?: FederatedKnowledgeSpace[];
}): {
  files: Array<{ filename: string; content: string; type: string }>;
  compiledBundle: string;
} {
  const files: Array<{ filename: string; content: string; type: string }> = [];

  // 1. Serialize Notes
  for (const note of params.notes) {
    const plainContent = extractPlainTextFromTipTap(note.document);
    const frontmatter = [
      '---',
      `id: "${note.id}"`,
      `title: "${note.title.replace(/"/g, '\\"')}"`,
      `type: "${note.knowledgeType || 'note'}"`,
      `category: "${note.categoryName || 'General'}"`,
      `tags: [${(note.tags || []).map((t) => `"${t}"`).join(', ')}]`,
      `sentiment: "${note.sentiment || 'neutral'}"`,
      `author: "${note.authorName || 'User'}"`,
      `createdAt: "${note.createdAt}"`,
      `updatedAt: "${note.updatedAt}"`,
      ...(note.links?.entityId ? [`entityId: "${note.links.entityId}"`] : []),
      ...(note.links?.contactId ? [`contactId: "${note.links.contactId}"`] : []),
      '---',
    ].join('\n');

    const markdownBody = `${frontmatter}\n\n# ${note.title}\n\n${plainContent}\n`;
    const safeSlug = note.title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 50) || note.id;
    files.push({
      filename: `notes/${safeSlug}.md`,
      content: markdownBody,
      type: 'note',
    });
  }

  // 2. Serialize Ideas
  if (params.ideas) {
    for (const idea of params.ideas) {
      const frontmatter = [
        '---',
        `id: "${idea.id}"`,
        `title: "${idea.title.replace(/"/g, '\\"')}"`,
        `type: "idea"`,
        `stage: "${idea.stage}"`,
        `iceScore: ${idea.iceScore}`,
        `impact: ${idea.impact}`,
        `confidence: ${idea.confidence}`,
        `ease: ${idea.ease}`,
        `tags: [${(idea.tags || []).map((t) => `"${t}"`).join(', ')}]`,
        `createdAt: "${idea.createdAt}"`,
        '---',
      ].join('\n');

      const markdownBody = `${frontmatter}\n\n# ${idea.title}\n\n## Description\n${idea.description}\n\n## Problem Statement\n${idea.problemStatement || 'N/A'}\n\n## Target Audience\n${idea.targetAudience || 'N/A'}\n`;
      const safeSlug = idea.title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 50) || idea.id;
      files.push({
        filename: `ideas/${safeSlug}.md`,
        content: markdownBody,
        type: 'idea',
      });
    }
  }

  // 3. Serialize Battlecards
  if (params.battlecards) {
    for (const card of params.battlecards) {
      const frontmatter = [
        '---',
        `id: "${card.id}"`,
        `topic: "${card.topic.replace(/"/g, '\\"')}"`,
        `type: "battlecard"`,
        `category: "${card.category}"`,
        `frequencyScore: ${card.frequencyScore}`,
        `createdAt: "${card.createdAt}"`,
        '---',
      ].join('\n');

      const markdownBody = `${frontmatter}\n\n# Objection: ${card.topic}\n\n## Customer Hesitation\n> "${card.objection}"\n\n## Tactical Rebuttal Script\n${card.rebuttalScript}\n\n## Killer Discovery Question\n${card.killerQuestion}\n\n## Proof Points\n${(card.proofPoints || []).map((p) => `- ${p}`).join('\n')}\n`;
      const safeSlug = card.topic.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 50) || card.id;
      files.push({
        filename: `battlecards/${safeSlug}.md`,
        content: markdownBody,
        type: 'battlecard',
      });
    }
  }

  // 4. Serialize Insights
  if (params.insights) {
    for (const insight of params.insights) {
      const frontmatter = [
        '---',
        `id: "${insight.id}"`,
        `title: "${insight.title.replace(/"/g, '\\"')}"`,
        `type: "insight"`,
        `insightType: "${insight.insightType}"`,
        `severity: "${insight.severity}"`,
        `status: "${insight.status}"`,
        `createdAt: "${insight.createdAt}"`,
        '---',
      ].join('\n');

      const markdownBody = `${frontmatter}\n\n# Strategic Insight: ${insight.title}\n\n## Executive Summary\n${insight.summary}\n\n## Core Findings\n${(insight.findings || []).map((f) => `- ${f}`).join('\n')}\n`;
      const safeSlug = insight.title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 50) || insight.id;
      files.push({
        filename: `insights/${safeSlug}.md`,
        content: markdownBody,
        type: 'insight',
      });
    }
  }

  const compiledBundle = files.map((f) => `<!-- FILE: ${f.filename} -->\n${f.content}`).join('\n\n---\n\n');

  return { files, compiledBundle };
}

/**
 * Deserializes raw Markdown files with YAML frontmatter into structured note creation inputs.
 */
export function deserializeMarkdownArchive(markdownContent: string): Array<{
  title: string;
  document: NoteDocument;
  tags: string[];
  categoryName: string;
  knowledgeType: KnowledgeType;
  metadata: Record<string, string>;
}> {
  const items: Array<{
    title: string;
    document: NoteDocument;
    tags: string[];
    categoryName: string;
    knowledgeType: KnowledgeType;
    metadata: Record<string, string>;
  }> = [];

  // Split multi-file archives if delimited by FILE comments or process single markdown document
  const rawSections = markdownContent.split(/<!-- FILE: .*? -->\n/).filter(Boolean);

  for (const section of rawSections) {
    const text = section.trim();
    if (!text) continue;

    let frontmatterRaw = '';
    let bodyRaw = text;

    // Parse YAML frontmatter --- ... ---
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      frontmatterRaw = match[1];
      bodyRaw = match[2];
    }

    const metadata: Record<string, string> = {};
    const tags: string[] = [];

    if (frontmatterRaw) {
      const lines = frontmatterRaw.split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (key === 'tags' && val.startsWith('[') && val.endsWith(']')) {
            const rawTags = val.slice(1, -1).split(',');
            for (const t of rawTags) {
              const clean = t.trim().replace(/^["']|["']$/g, '');
              if (clean && !tags.includes(clean)) tags.push(clean);
            }
          } else {
            metadata[key] = val;
          }
        }
      }
    }

    // Extract title from metadata or first # Heading or first line
    let title = metadata.title || '';
    if (!title) {
      const headingMatch = bodyRaw.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        title = headingMatch[1].trim();
      } else {
        const firstLine = bodyRaw.split('\n')[0]?.trim();
        title = firstLine ? firstLine.slice(0, 80) : 'Imported Document';
      }
    }

    const categoryName = metadata.category || 'Imported';
    const rawType = metadata.type as KnowledgeType;
    const knowledgeType: KnowledgeType = (
      (KNOWLEDGE_TYPES as readonly string[]).includes(rawType)
        ? rawType
        : 'note'
    );

    // Convert body text to TipTap NoteDocument AST
    const cleanBody = bodyRaw.replace(/^#\s+.+$/m, '').trim();
    const paragraphs = cleanBody.split(/\n\n+/).filter(Boolean);
    const docContent = paragraphs.map((para) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para.trim() }],
    }));

    const document: NoteDocument = {
      type: 'doc',
      content: docContent.length > 0 ? docContent : [{ type: 'paragraph', content: [{ type: 'text', text: cleanBody || title }] }],
    };

    items.push({
      title,
      document,
      tags,
      categoryName,
      knowledgeType,
      metadata,
    });
  }

  return items;
}

/**
 * Pure authorization resolver determining if a user/workspace can access a federated knowledge space.
 */
export function resolveFederatedVisibility(params: {
  space: FederatedKnowledgeSpace;
  requestingWorkspaceId: string;
  userOrgId: string;
  isOrgAdmin?: boolean;
}): {
  allowed: boolean;
  effectiveAccessLevel: KnowledgeSpaceAccessLevel | null;
  reason: string;
} {
  const { space, requestingWorkspaceId, userOrgId, isOrgAdmin } = params;

  // 1. Organization boundary guard
  if (space.organizationId !== userOrgId && !isOrgAdmin) {
    return {
      allowed: false,
      effectiveAccessLevel: null,
      reason: 'Cross-organization access denied: Target knowledge space belongs to another organization.',
    };
  }

  // 2. Owner Workspace has full administrative access
  if (space.ownerWorkspaceId === requestingWorkspaceId || isOrgAdmin) {
    return {
      allowed: true,
      effectiveAccessLevel: 'admin',
      reason: 'User belongs to owner workspace or possesses organization administrative privileges.',
    };
  }

  // 3. Evaluate Federation Policy
  switch (space.federationPolicy) {
    case 'isolated':
      return {
        allowed: false,
        effectiveAccessLevel: null,
        reason: 'This knowledge space is set to isolated mode and cannot be shared across workspaces.',
      };

    case 'organization_shared':
      return {
        allowed: true,
        effectiveAccessLevel: space.accessLevel,
        reason: 'This knowledge space is published to all sibling workspaces in the organization.',
      };

    case 'selective_peers':
      if (space.subscriberWorkspaceIds.includes(requestingWorkspaceId)) {
        return {
          allowed: true,
          effectiveAccessLevel: space.accessLevel,
          reason: 'This workspace is explicitly authorized as a subscribed peer.',
        };
      }
      return {
        allowed: false,
        effectiveAccessLevel: null,
        reason: 'This workspace is not in the authorized subscriber list for this peer-shared space.',
      };

    default:
      return {
        allowed: false,
        effectiveAccessLevel: null,
        reason: 'Unknown federation policy.',
      };
  }
}

/**
 * Pure conflict resolution algorithm for concurrent updates to federated notes.
 */
export function resolveFederationConflict(params: {
  localNote: QuickNote;
  remoteNote: QuickNote;
  strategy: FederationConflictResolution;
}): {
  action: 'overwrite' | 'create_variant' | 'flag_for_inbox';
  resolvedNote?: QuickNote;
  inboxPayload?: Partial<KnowledgeInboxItem>;
} {
  const { localNote, remoteNote, strategy } = params;

  switch (strategy) {
    case 'last_write_wins': {
      const localTime = new Date(localNote.updatedAt || localNote.createdAt).getTime();
      const remoteTime = new Date(remoteNote.updatedAt || remoteNote.createdAt).getTime();
      return {
        action: 'overwrite',
        resolvedNote: remoteTime >= localTime ? remoteNote : localNote,
      };
    }

    case 'fork_as_variant': {
      const variantNote: QuickNote = {
        ...remoteNote,
        id: `note_variant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `${remoteNote.title} [Federated Variant]`,
        workspaceId: localNote.workspaceId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        action: 'create_variant',
        resolvedNote: variantNote,
      };
    }

    case 'manual_inbox_review':
    default: {
      const localText = extractPlainTextFromTipTap(localNote.document);
      const remoteText = extractPlainTextFromTipTap(remoteNote.document);
      const inboxPayload: Partial<KnowledgeInboxItem> = {
        workspaceId: localNote.workspaceId,
        type: 'contradiction',
        status: 'pending',
        title: `Federation Conflict: "${localNote.title}"`,
        summary: `Conflicting updates detected between local workspace copy and upstream federated space.`,
        sourceNoteIds: [localNote.id, remoteNote.id],
        contradictionDetails: {
          thesisNoteId: localNote.id,
          thesisQuote: localText.slice(0, 300),
          antithesisNoteId: remoteNote.id,
          antithesisQuote: remoteText.slice(0, 300),
          conflictTopic: localNote.title,
          suggestedResolution: 'Review local and upstream edits, then accept the upstream update or retain local branch.',
        },
        confidence: 0.95,
      };
      return {
        action: 'flag_for_inbox',
        inboxPayload,
      };
    }
  }
}

/**
 * Multi-criteria filter and sort for federated knowledge items.
 */
export function filterFederatedKnowledge(
  items: FederatedKnowledgeItem[],
  options: FederationFilterOptions
): FederatedKnowledgeItem[] {
  return items.filter((item) => {
    if (options.searchQuery) {
      const q = options.searchQuery.toLowerCase().trim();
      const matches =
        item.title.toLowerCase().includes(q) ||
        item.snippet.toLowerCase().includes(q) ||
        item.sourceSpaceName.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q));
      if (!matches) return false;
    }

    if (options.sourceWorkspaceId && options.sourceWorkspaceId !== 'all') {
      if (item.sourceWorkspaceId !== options.sourceWorkspaceId) return false;
    }

    if (options.spaceId && options.spaceId !== 'all') {
      if (item.sourceSpaceId !== options.spaceId) return false;
    }

    if (options.accessLevel && options.accessLevel !== 'all') {
      if (item.accessLevel !== options.accessLevel) return false;
    }

    if (options.tags && options.tags.length > 0) {
      const hasTag = options.tags.some((t) => item.tags.includes(t));
      if (!hasTag) return false;
    }

    return true;
  }).sort((a, b) => {
    const order = options.sortOrder === 'asc' ? 1 : -1;
    if (options.sortBy === 'title') {
      return a.title.localeCompare(b.title) * order;
    }
    // Default to updatedAt desc
    return (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) * order;
  });
}

/**
 * Display metadata for Inbound Ingestion Sources.
 */
export function getKnowledgeIngestionSourceMeta(source: KnowledgeIngestionSource): {
  label: string;
  iconName: string;
  badgeClass: string;
} {
  switch (source) {
    case 'slack':
      return { label: 'Slack Webhook', iconName: 'Hash', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
    case 'discord':
      return { label: 'Discord Bot', iconName: 'MessageSquare', badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' };
    case 'email_forwarder':
      return { label: 'Email Forwarder', iconName: 'Mail', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    case 'whatsapp_bot':
      return { label: 'WhatsApp Capture', iconName: 'Phone', badgeClass: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30' };
    case 'chrome_extension':
      return { label: 'Chrome Extension', iconName: 'Globe', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    case 'webhook_rest':
      return { label: 'Custom REST API', iconName: 'Webhook', badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
    case 'markdown_archive':
      return { label: 'Markdown Archive', iconName: 'FileText', badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/40' };
    case 'json_import':
      return { label: 'JSON Backup', iconName: 'Code', badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' };
    case 'csv_import':
    default:
      return { label: 'CSV Import', iconName: 'Table', badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30' };
  }
}

/**
 * Display metadata for Space Access Levels.
 */
export function getKnowledgeSpaceAccessLevelMeta(level: KnowledgeSpaceAccessLevel): {
  label: string;
  badgeClass: string;
} {
  switch (level) {
    case 'admin':
      return { label: 'Full Admin', badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' };
    case 'contributor':
      return { label: 'Read & Write', badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' };
    case 'viewer':
    default:
      return { label: 'Read Only', badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/40' };
  }
}

/**
 * Display metadata for Federation Policies.
 */
export function getFederationPolicyMeta(policy: KnowledgeFederationPolicy): {
  label: string;
  description: string;
  badgeClass: string;
} {
  switch (policy) {
    case 'organization_shared':
      return {
        label: 'Organization-Wide',
        description: 'Published to all sibling campus workspaces in the organization.',
        badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
      };
    case 'selective_peers':
      return {
        label: 'Selective Peers',
        description: 'Shared explicitly with designated subscriber workspaces.',
        badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
      };
    case 'isolated':
    default:
      return {
        label: 'Isolated',
        description: 'Restricted strictly to the owning workspace.',
        badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/40',
      };
  }
}

// ============================================================================
// Phase 10: Enterprise Offline Sync & Zero-Data-Loss PWA Domain Logic
// ============================================================================

/**
 * Pure factory creating a validated OfflineMutationJob.
 * Automatically injects monotonic client timestamps and defaults.
 */
export function createOfflineMutationJob(params: {
  id?: string;
  workspaceId: string;
  entityId: string;
  type: OfflineMutationType;
  payload: Record<string, unknown>;
  baseServerUpdatedAt?: string;
  clientTimestamp?: string;
}): OfflineMutationJob {
  return {
    id: params.id || `mut_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    workspaceId: params.workspaceId,
    entityId: params.entityId,
    type: params.type,
    payload: params.payload || {},
    baseServerUpdatedAt: params.baseServerUpdatedAt,
    clientTimestamp: params.clientTimestamp || new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };
}

/**
 * Computes deterministic exponential backoff delay with jitter.
 * Formula: min(maxDelayMs, baseDelayMs * (1.5 ^ retryCount))
 */
export function computeOfflineBackoffDelay(
  retryCount: number,
  baseDelayMs = 1000,
  maxDelayMs = 30000
): number {
  if (retryCount <= 0) return 0;
  const backoff = baseDelayMs * Math.pow(1.5, Math.min(retryCount, 10));
  // Add deterministic pseudo-jitter based on retry count
  const jitter = (retryCount % 3) * 100;
  return Math.min(Math.round(backoff + jitter), maxDelayMs);
}

/**
 * Extracts line-by-line differences between local and server TipTap documents.
 * Produces structured human-readable change summaries.
 */
export function generateDocumentDiffSummary(
  localDoc?: NoteDocument | null,
  serverDoc?: NoteDocument | null
): {
  localChanges: string[];
  serverChanges: string[];
} {
  const localText = extractPlainText(localDoc);
  const serverText = extractPlainText(serverDoc);

  const localLines = localText.split('\n').map((l) => l.trim()).filter(Boolean);
  const serverLines = serverText.split('\n').map((l) => l.trim()).filter(Boolean);

  const localSet = new Set(localLines);
  const serverSet = new Set(serverLines);

  const localAdditions = localLines.filter((l) => !serverSet.has(l));
  const serverAdditions = serverLines.filter((l) => !localSet.has(l));

  return {
    localChanges: localAdditions.slice(0, 10),
    serverChanges: serverAdditions.slice(0, 10),
  };
}

/**
 * Pure deterministic offline conflict detector and resolver.
 *
 * Compares client base snapshot timestamp against real-time server timestamp.
 * If server was modified after client opened document, flags a conflict.
 */
export function resolveOfflineConflict(params: {
  localJob: OfflineMutationJob;
  serverSnapshot: QuickNote | null;
  action?: OfflineConflictResolutionAction;
}): {
  isConflict: boolean;
  resolvedPayload?: Record<string, unknown>;
  conflictDetails?: OfflineConflictDetails;
  inboxContradictionPayload?: Partial<KnowledgeInboxItem>;
} {
  const { localJob, serverSnapshot, action = 'keep_local' } = params;

  if (!serverSnapshot) {
    // Entity doesn't exist on server -> safe to create/update
    return {
      isConflict: false,
      resolvedPayload: localJob.payload,
    };
  }

  const serverMs = new Date(serverSnapshot.updatedAt || serverSnapshot.createdAt).getTime();
  const baseMs = localJob.baseServerUpdatedAt
    ? new Date(localJob.baseServerUpdatedAt).getTime()
    : 0;

  // Conflict if server was updated strictly after the base snapshot client had
  const isServerNewer = baseMs > 0 && serverMs > baseMs;

  if (!isServerNewer) {
    return {
      isConflict: false,
      resolvedPayload: localJob.payload,
    };
  }

  // Conflict detected
  const localDoc = (localJob.payload.document as NoteDocument | undefined) || undefined;
  const diffSummary = generateDocumentDiffSummary(localDoc, serverSnapshot.document);

  const conflictDetails: OfflineConflictDetails = {
    jobId: localJob.id,
    entityId: localJob.entityId,
    entityTitle: (localJob.payload.title as string) || serverSnapshot.title,
    localJob,
    serverSnapshot,
    clientTimestamp: localJob.clientTimestamp,
    serverUpdatedAt: serverSnapshot.updatedAt,
    diffSummary,
  };

  switch (action) {
    case 'keep_server': {
      // Accept server state, discard local changes
      return {
        isConflict: true,
        conflictDetails,
        resolvedPayload: {
          title: serverSnapshot.title,
          document: serverSnapshot.document,
          tags: serverSnapshot.tags,
          categoryId: serverSnapshot.categoryId,
        },
      };
    }

    case 'smart_merge': {
      // Non-destructive 3-way merge: combine documents with a horizontal separator
      const mergedDoc = mergeKnowledgeObjects(
        localDoc,
        serverSnapshot.document,
        'concatenate'
      );
      const mergedTags = dedupeTags([
        ...(serverSnapshot.tags || []),
        ...((localJob.payload.tags as string[]) || []),
      ]);
      return {
        isConflict: true,
        conflictDetails,
        resolvedPayload: {
          ...localJob.payload,
          document: mergedDoc,
          tags: mergedTags,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case 'send_to_inbox': {
      // Escalate to Phase 7 Knowledge Inbox
      const localText = extractPlainText(localDoc);
      const serverText = extractPlainText(serverSnapshot.document);
      const inboxPayload: Partial<KnowledgeInboxItem> = {
        workspaceId: localJob.workspaceId,
        type: 'contradiction',
        status: 'pending',
        title: `Offline Sync Conflict: ${serverSnapshot.title}`,
        summary: `Concurrent offline modifications detected on note "${serverSnapshot.title}".`,
        sourceKnowledgeId: serverSnapshot.id,
        confidence: 0.95,
        contradictionDetails: {
          thesisClaim: `Local Client Edits: ${localText.slice(0, 200)}`,
          antithesisClaim: `Server Cloud Version (by ${serverSnapshot.authorName}): ${serverText.slice(0, 200)}`,
          conflictingField: 'document',
          sourceQuotes: [localText.slice(0, 150), serverText.slice(0, 150)],
        },
        suggestedPatches: [
          {
            field: 'document',
            currentValue: serverText.slice(0, 100),
            suggestedValue: localText.slice(0, 100),
            rationale: 'Review offline edits against cloud updates.',
          },
        ],
      };
      return {
        isConflict: true,
        conflictDetails,
        inboxContradictionPayload: inboxPayload,
      };
    }

    case 'keep_local':
    default: {
      return {
        isConflict: true,
        conflictDetails,
        resolvedPayload: {
          ...localJob.payload,
          updatedAt: new Date().toISOString(),
        },
      };
    }
  }
}

/**
 * Pure byte estimation helper for client-side offline storage.
 * Averages: ~4KB per cached note, ~1KB per mutation, ~2KB per draft.
 */
export function calculateCacheStorageEstimate(
  notesCount: number,
  draftsCount = 0,
  queueCount = 0
): number {
  const noteBytes = Math.max(0, notesCount) * 4096;
  const draftBytes = Math.max(0, draftsCount) * 2048;
  const queueBytes = Math.max(0, queueCount) * 1024;
  return noteBytes + draftBytes + queueBytes;
}

/**
 * Pure filtering for offline mutation queues.
 */
export function filterOfflineMutations(
  jobs: OfflineMutationJob[],
  options: {
    status?: OfflineMutationStatus | 'all';
    type?: OfflineMutationType | 'all';
    searchQuery?: string;
  }
): OfflineMutationJob[] {
  const { status, type, searchQuery } = options;
  return jobs.filter((job) => {
    if (status && status !== 'all' && job.status !== status) return false;
    if (type && type !== 'all' && job.type !== type) return false;
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = job.id.toLowerCase().includes(q);
      const matchEntity = job.entityId.toLowerCase().includes(q);
      const matchType = job.type.toLowerCase().includes(q);
      if (!matchId && !matchEntity && !matchType) return false;
    }
    return true;
  });
}

/**
 * Display metadata and styling for Offline Sync Status.
 */
export function getOfflineSyncStatusMeta(status: OfflineSyncStatus): {
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case 'online_synced':
      return {
        label: 'Online & Synced',
        description: 'All local changes are synced to Cloud Firestore.',
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        dotClass: 'bg-emerald-500',
      };
    case 'syncing':
      return {
        label: 'Syncing Changes...',
        description: 'Draining offline queue to server.',
        badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
        dotClass: 'bg-blue-500 animate-pulse',
      };
    case 'offline':
      return {
        label: 'Working Offline',
        description: 'Changes are saved securely in browser IndexedDB.',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
        dotClass: 'bg-amber-500',
      };
    case 'conflict_detected':
      return {
        label: 'Conflict Detected',
        description: 'Concurrent cloud update clashed with offline edit.',
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
        dotClass: 'bg-rose-500 animate-ping',
      };
    case 'error':
    default:
      return {
        label: 'Sync Error',
        description: 'Failed to synchronize with server.',
        badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
        dotClass: 'bg-red-500',
      };
  }
}







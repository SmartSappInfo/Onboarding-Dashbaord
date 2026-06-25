import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '../collection-constants';
import type {
  MessageNodeStats,
  MessageNodeStatCounter,
  TrackedMessageChannel,
} from '../types';

/**
 * @fileOverview Denormalized per-node delivery counters for automation message
 * steps. One document per node, keyed by `${automationId}__${nodeId}`, written
 * with `FieldValue.increment` so concurrent webhook events stay atomic.
 *
 * Reads default any absent counter to 0 (see {@link readMessageNodeStats}); the
 * document is intentionally sparse until events arrive.
 */

/** Composite document id for a message-step node's stats. */
export function messageNodeStatsId(automationId: string, nodeId: string): string {
  return `${automationId}__${nodeId}`;
}

interface IncrementMessageNodeStatInput {
  automationId: string;
  nodeId: string;
  workspaceId: string;
  organizationId?: string;
  channel: TrackedMessageChannel;
  counter: MessageNodeStatCounter;
  /** Amount to add (defaults to 1). */
  count?: number;
  /** When true, also stamps `lastMessageAt` with the current time. */
  touchLastMessageAt?: boolean;
}

/**
 * Atomically increments one counter on a node's stats document, creating it on
 * first write. Identity fields are merged so the document is self-describing.
 *
 * Callers should treat this as best-effort — failures must never block a send or
 * a webhook acknowledgement.
 */
export async function incrementMessageNodeStat(
  input: IncrementMessageNodeStatInput
): Promise<void> {
  const {
    automationId,
    nodeId,
    workspaceId,
    organizationId,
    channel,
    counter,
    count = 1,
    touchLastMessageAt = false,
  } = input;

  const now = new Date().toISOString();
  const ref = adminDb
    .collection(COLLECTIONS.MESSAGE_NODE_STATS)
    .doc(messageNodeStatsId(automationId, nodeId));

  const update: Record<string, unknown> = {
    id: messageNodeStatsId(automationId, nodeId),
    automationId,
    nodeId,
    workspaceId,
    channel,
    [counter]: FieldValue.increment(count),
    updatedAt: now,
  };
  if (organizationId) update.organizationId = organizationId;
  if (touchLastMessageAt) update.lastMessageAt = now;

  await ref.set(update, { merge: true });
}

/** Counter fields, used to normalize absent values to 0 on read. */
const COUNTER_FIELDS: readonly MessageNodeStatCounter[] = [
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'failed',
  'unsubscribed',
  'replied',
  'resent',
];

/**
 * Reads a node's stats, returning a fully-populated object with every counter
 * defaulted to 0, or `null` when no document exists yet.
 */
export async function readMessageNodeStats(
  automationId: string,
  nodeId: string
): Promise<MessageNodeStats | null> {
  const snap = await adminDb
    .collection(COLLECTIONS.MESSAGE_NODE_STATS)
    .doc(messageNodeStatsId(automationId, nodeId))
    .get();

  if (!snap.exists) return null;

  const raw = snap.data() as Partial<MessageNodeStats>;
  const counters = Object.fromEntries(
    COUNTER_FIELDS.map((field) => [field, raw[field] ?? 0])
  ) as Record<MessageNodeStatCounter, number>;

  return {
    id: messageNodeStatsId(automationId, nodeId),
    automationId,
    nodeId,
    workspaceId: raw.workspaceId ?? '',
    organizationId: raw.organizationId,
    channel: raw.channel ?? 'email',
    ...counters,
    lastMessageAt: raw.lastMessageAt,
    updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
  };
}

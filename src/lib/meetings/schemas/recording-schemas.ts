/**
 * @fileOverview Boundary schemas for meeting recordings (Phase 11 M1 · T0, findings G1/G8; Rule 4).
 *
 * Recording documents and attach payloads cross trust boundaries (Firestore reads, Server Action
 * arguments), so they are parsed here before reaching domain code. No casts.
 *
 * LINK POLICY (Rules 8, 34):
 * - A new external recording link must be `https:`, at most 2,048 characters and carry no
 *   credentials. This blocks `javascript:`/`data:` links that the meeting page would render as a
 *   clickable media source (stored XSS). Existing documents are never rewritten; they are read as-is.
 * - SmartSapp never fetches external links (no SSRF surface). Only files under the workspace's own
 *   Storage prefix are treated as "uploaded" and can be signed or transcribed.
 *
 * Tests: src/lib/__tests__/meetings/meeting-actions-security.test.ts
 */

import { z } from 'zod';
import type { MeetingRecording } from '../types/intelligence';

export const ConferenceProviderSchema = z.enum([
  'google_meet', 'zoom', 'microsoft_teams', 'daily', 'smart_sapp', 'physical', 'custom',
]);

export const RecordingStatusSchema = z.enum(['pending', 'processing', 'available', 'failed', 'deleted']);

export const MAX_EXTERNAL_URL_LENGTH = 2048;

/** True for a link we are willing to store as a new external recording. */
export function isSafeExternalMediaUrl(raw: string): boolean {
  if (raw.length === 0 || raw.length > MAX_EXTERNAL_URL_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hostname.length > 0;
}

/** Storage prefix that holds a meeting's uploaded recordings. */
export function recordingStoragePrefix(workspaceId: string, meetingId: string): string {
  return `workspaces/${workspaceId}/meetings/${meetingId}/recordings/`;
}

/**
 * True when `storagePath` is a single object directly or deeply under the meeting's recording
 * prefix, with no traversal or empty segments.
 */
export function isRecordingPathForMeeting(storagePath: string, workspaceId: string, meetingId: string): boolean {
  const prefix = recordingStoragePrefix(workspaceId, meetingId);
  if (!storagePath.startsWith(prefix) || storagePath.length === prefix.length) return false;
  const rest = storagePath.slice(prefix.length);
  return rest.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..') && !rest.includes('\\');
}

const ID = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');

export const AttachRecordingInputSchema = z.object({
  workspaceId: ID,
  /** Ignored for authorization; the organization comes from the verified session. */
  organizationId: z.string().optional(),
  meetingId: ID,
  provider: ConferenceProviderSchema,
  externalRecordingId: z.string().max(500).optional(),
  mediaUrl: z.string().trim().max(MAX_EXTERNAL_URL_LENGTH),
  storagePath: z.string().trim().max(1024).optional(),
  durationSeconds: z.number().finite().min(0).max(24 * 60 * 60),
  fileSizeBytes: z.number().finite().min(0).optional(),
  format: z.string().trim().max(10).optional(),
});
export type AttachRecordingInput = z.infer<typeof AttachRecordingInputSchema>;

/** Firestore read model. Tolerant of legacy documents; anything unparseable is skipped by callers. */
export const MeetingRecordingRecordSchema = z.object({
  id: z.string().optional(),
  workspaceId: z.string(),
  organizationId: z.string().optional(),
  meetingId: z.string(),
  provider: ConferenceProviderSchema.catch('custom'),
  externalRecordingId: z.string().optional(),
  mediaUrl: z.string().default(''),
  storagePath: z.string().optional(),
  durationSeconds: z.number().catch(0),
  fileSizeBytes: z.number().optional(),
  format: z.string().optional(),
  status: RecordingStatusSchema.catch('available'),
  retentionUntil: z.string().optional(),
  createdAt: z.string().catch(''),
  updatedAt: z.string().catch(''),
});

/**
 * Parses a stored recording into the client-safe shape. The legacy `shareToken` and any stored
 * `playbackUrl` are dropped: neither has a consumer (verified 2026-10-05) and returning them only
 * widens what leaks if a response is logged or cached.
 */
export function toClientRecording(id: string, raw: unknown): MeetingRecording | null {
  const parsed = MeetingRecordingRecordSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, id };
}

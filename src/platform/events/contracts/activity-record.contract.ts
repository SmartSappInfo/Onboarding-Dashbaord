/**
 * @fileOverview Canonical Activity Record & Actor Contract (Phase 2 Milestone 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 11 (State Immutability), Rule 16 (Natural Language Feedback),
 * and Rule 40 (Append-Only Audit).
 *
 * ActivityRecordV2 is the materialized denormalized timeline document stored in:
 * - workspaces/{workspaceId}/activities/{organizationId}_{eventId}
 * - organizations/{organizationId}/activities/{organizationId}_{eventId}
 */

import { z } from 'zod';

export const NormalizedActorSchema = z.object({
  type: z.enum(['user', 'agent', 'automation', 'system']),
  id: z.string().min(1, 'Actor id must be non-empty'),
  displayName: z.string().min(1, 'Actor displayName must be non-empty'),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  agentRole: z.string().optional(),
  model: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type NormalizedActor = z.infer<typeof NormalizedActorSchema>;

export const ActivityEntityRefSchema = z.object({
  type: z.string().min(1, 'Entity type must be non-empty'),
  id: z.string().min(1, 'Entity id must be non-empty'),
  name: z.string().optional(),
  version: z.string().optional(),
});

export type ActivityEntityRef = z.infer<typeof ActivityEntityRefSchema>;

export const ActivityRecordV2Schema = z.object({
  id: z.string().min(1, 'Record id must be non-empty'),
  eventId: z.string().uuid('eventId must be a valid UUID'),
  organizationId: z.string().min(1, 'organizationId must be non-empty'),
  workspaceId: z.string().min(1).optional().nullable(),
  timestamp: z.string().datetime('timestamp must be an ISO 8601 UTC string'),
  eventType: z.string().min(1, 'eventType must be non-empty'),
  actor: NormalizedActorSchema,
  entity: ActivityEntityRefSchema,
  summary: z.string().min(1, 'summary must be non-empty'),
  details: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  correlationId: z.string().min(1, 'correlationId must be non-empty'),
  causationId: z.string().optional(),
});

export type ActivityRecordV2 = z.infer<typeof ActivityRecordV2Schema>;

/**
 * Query filters for reading the activity feed.
 */
export const ActivityFeedQuerySchema = z.object({
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  actorType: z.enum(['user', 'agent', 'automation', 'system']).optional(),
  entityId: z.string().optional(),
  limit: z
    .number()
    .int()
    .optional()
    .transform((val) => (val !== undefined ? Math.min(Math.max(val, 1), 100) : 50)),
  afterTimestamp: z.string().optional(),
});

export type ActivityFeedQuery = z.infer<typeof ActivityFeedQuerySchema>;

/**
 * Builds a deterministic document ID for ActivityRecordV2 to ensure idempotent writes (Rule 20).
 */
export function buildActivityDocumentId(organizationId: string, eventId: string): string {
  const sanitizedOrg = organizationId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedEvent = eventId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitizedOrg}_${sanitizedEvent}`;
}


/**
 * @fileOverview Event Dispatcher Contracts (Phase 2 / Milestone 1)
 *
 * Implements Rule 4 (Strict Typing), Rule 9 (High Load & Bounded Queues),
 * Rule 19 (Idempotency), and Rule 39 (OpenTelemetry Tracing).
 *
 * Defines Zod schemas and TypeScript types for asynchronous Cloud Tasks
 * event dispatch options and execution results.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod';

export const EventDispatchOptionsSchema = z.object({
  batchSize: z.number().int().min(1).max(100).default(50).describe('Maximum outbox records to process in a single batch.'),
  leaseDurationMs: z.number().int().min(5000).max(300000).default(60000).describe('Lease lock duration in milliseconds (default 60s).'),
  organizationId: z.string().optional().describe('Optional tenant organization ID filter.'),
  workspaceId: z.string().optional().describe('Optional workspace ID filter.'),
});

export type EventDispatchOptions = z.infer<typeof EventDispatchOptionsSchema>;

export const EventDispatchResultSchema = z.object({
  success: z.boolean().describe('True if all batch records processed without worker fatal error.'),
  processedCount: z.number().int().min(0).describe('Total records leased from outbox.'),
  dispatchedCount: z.number().int().min(0).describe('Records successfully delivered to subscribers.'),
  deadLetterCount: z.number().int().min(0).describe('Records quarantined into Dead-Letter Queue.'),
  skippedCount: z.number().int().min(0).describe('Records skipped due to active duplicate or dead-man pause.'),
  durationMs: z.number().min(0).describe('Total execution time of the dispatch cycle.'),
  errors: z.array(
    z.object({
      eventId: z.string(),
      error: z.string(),
    })
  ).default([]).describe('Individual event errors encountered during dispatch.'),
});

export type EventDispatchResult = z.infer<typeof EventDispatchResultSchema>;

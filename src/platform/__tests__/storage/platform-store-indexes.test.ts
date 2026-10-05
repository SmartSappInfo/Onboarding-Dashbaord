/**
 * @fileOverview Composite index coverage for platform store queries (Phase 11 M0 · T0.6).
 *
 * Production stores were in RAM (F1), so missing composite indexes never surfaced. With Firestore
 * persistence, a missing index makes these queries fail (several stores then return an empty list),
 * so every multi-field store query must have a declared index. If you add a store query with an
 * equality + orderBy or several filters, add its index here and in firestore.indexes.json.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

interface IndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
}
interface IndexDef {
  collectionGroup: string;
  fields: IndexField[];
}

const indexes = (
  JSON.parse(readFileSync(join(process.cwd(), 'firestore.indexes.json'), 'utf8')) as { indexes: IndexDef[] }
).indexes;

const required: Array<{ query: string; collectionGroup: string; fields: IndexField[] }> = [
  // Phase 11 M1 · T9: Backoffice transcription queue + usage.
  {
    query: 'backoffice meeting ops: transcription queue',
    collectionGroup: 'meeting_transcripts',
    fields: [{ fieldPath: 'status', order: 'ASCENDING' }, { fieldPath: 'updatedAt', order: 'DESCENDING' }],
  },
  {
    query: 'backoffice meeting ops: usage today',
    collectionGroup: 'meeting_transcription_usage',
    fields: [{ fieldPath: 'day', order: 'ASCENDING' }, { fieldPath: 'minutes', order: 'DESCENDING' }],
  },
  // Phase 11 M1 · T6: retention sweep picks the least recently processed opted-in workspaces.
  {
    query: 'retention-service runRetentionSweep',
    collectionGroup: 'meeting_compliance_policies',
    fields: [{ fieldPath: 'retentionEnabled', order: 'ASCENDING' }, { fieldPath: 'retentionLastRunAt', order: 'ASCENDING' }],
  },
  // Phase 11 M1 · T2: meeting transcript store queries.
  {
    query: 'transcript-store findLatestTranscriptId',
    collectionGroup: 'meeting_transcripts',
    fields: [
      { fieldPath: 'workspaceId', order: 'ASCENDING' },
      { fieldPath: 'meetingId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    query: 'transcription backlog / stale processing sweep (Backoffice, T9)',
    collectionGroup: 'meeting_transcripts',
    fields: [
      { fieldPath: 'workspaceId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'ASCENDING' },
    ],
  },
  {
    query: 'audit-store listByWorkspace',
    collectionGroup: 'capability_audit',
    fields: [{ fieldPath: 'workspaceId', order: 'ASCENDING' }, { fieldPath: 'timestamp', order: 'DESCENDING' }],
  },
  {
    query: 'audit-store verifyWorkspaceChain (per shard)',
    collectionGroup: 'capability_audit',
    fields: [
      { fieldPath: 'workspaceId', order: 'ASCENDING' },
      { fieldPath: 'shard', order: 'ASCENDING' },
      { fieldPath: 'sequenceNumber', order: 'ASCENDING' },
    ],
  },
  {
    query: 'outbox-reader leasePending (global)',
    collectionGroup: 'domain_events',
    fields: [{ fieldPath: 'status', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'ASCENDING' }],
  },
  {
    query: 'outbox-reader leasePending (org)',
    collectionGroup: 'domain_events',
    fields: [
      { fieldPath: 'event.organizationId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
    ],
  },
  {
    query: 'outbox-reader leasePending (workspace)',
    collectionGroup: 'domain_events',
    fields: [
      { fieldPath: 'event.workspaceId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
    ],
  },
  {
    query: 'dead-letter list (org + workspace)',
    collectionGroup: 'dead_letter_events',
    fields: [
      { fieldPath: 'organizationId', order: 'ASCENDING' },
      { fieldPath: 'workspaceId', order: 'ASCENDING' },
      { fieldPath: 'quarantinedAt', order: 'DESCENDING' },
    ],
  },
];

const sameFields = (a: IndexField[], b: IndexField[]) =>
  a.length === b.length && a.every((f, i) => f.fieldPath === b[i].fieldPath && f.order === b[i].order);

describe('platform store queries have declared composite indexes', () => {
  it.each(required)('$query', ({ collectionGroup, fields }) => {
    const found = indexes.some((idx) => idx.collectionGroup === collectionGroup && sameFields(idx.fields, fields));
    expect(found).toBe(true);
  });
});

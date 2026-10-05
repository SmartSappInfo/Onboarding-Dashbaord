// @vitest-environment node
/**
 * @fileOverview meeting.record_consent through the gateway (Phase 11 M1 · T5).
 * Non-delegable: agents are refused before the handler runs. Stale versions are refused.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));

import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import { meetingRecordConsentCapability } from '../../domains/meetings_conversations';

let db: FakeFirestore;
const cap = meetingRecordConsentCapability as AnyCapabilityDefinition;
const human: AgentPrincipal = {
  actorType: 'user', userId: 'u-1', organizationId: 'org-1', workspaceId: 'ws-a',
  grantedScopes: ['rbac:operations.meetings.edit'], effectiveRole: 'admin',
};
const agent: AgentPrincipal = { ...human, actorType: 'agent', agentId: 'meeting_assistant' };

const record = (input: Record<string, unknown>, principal: AgentPrincipal = human) =>
  executeCapability(
    { capabilityId: cap.id, surface: principal.actorType === 'agent' ? 'agent' : 'ui', correlationId: 'c', principal,
      input: { workspaceId: 'ws-a', meetingId: 'm-1', type: 'transcription', granted: true, method: 'verbal', expectedVersion: 0, ...input } },
    { registryLookup: (id) => (id === cap.id ? cap : undefined), auditSink: () => undefined, outboxSink: () => undefined }
  );

beforeEach(() => {
  db = new FakeFirestore();
  h.db = db;
  db.write('meetings/m-1', { workspaceIds: ['ws-a'] });
});

describe('meeting.record_consent', () => {
  it('lets a person record consent and bumps the version', async () => {
    const res = await record({});
    expect(res.success && res.data).toEqual({ version: 1, restrictedTranscripts: 0 });
  });

  it('refuses agents even with the right scope (non-delegable)', async () => {
    const res = await record({}, agent);
    expect(res.success).toBe(false);
    expect(db.read('meeting_consents/m-1')).toBeUndefined();
  });

  it('refuses a stale version and foreign meetings', async () => {
    await record({});
    const stale = await record({ type: 'aiProcessing', expectedVersion: 0 });
    expect(!stale.success && stale.error.code).toBe('VERSION_CONFLICT');
    db.write('meetings/m-b', { workspaceIds: ['ws-b'] });
    const foreign = await record({ meetingId: 'm-b' });
    expect(!foreign.success && foreign.error.code).toBe('NOT_FOUND');
  });
});

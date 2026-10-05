// @vitest-environment node
/**
 * @fileOverview meeting.generate_prep_brief through the gateway (Phase 11 M2 · T2.3).
 * Contract suite, people get a brief, foreign meetings are NOT_FOUND, agents need an explicit flag,
 * and the tool sits in the Meeting Agent matrix.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/lib/meetings/prep-brief-model', () => ({ createPrepBriefModel: () => null }));

import { defineContractSuite } from '../contract/define-contract-suite';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  MEETINGS_CONVERSATIONS_CAPABILITIES,
  meetingGeneratePrepBriefCapability,
  setPrepBriefDepsForTests,
  type MeetingGeneratePrepBriefOutput,
} from '../../domains/meetings_conversations';
import { MEETING_TOOL_MATRIX } from '../../agents/meetings/personas/meeting-agent-matrix';

const db = new FakeFirestore();
h.db = db;
const NOW = Date.parse('2026-10-05T09:00:00.000Z');

function seed(): void {
  db.docs.clear();
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Renewal review', meetingTime: '2026-10-06T10:00:00.000Z', updatedAt: 'v1' });
  db.write('participants/p-1', { meetingId: 'm-1', name: 'Ama', email: 'ama@acme.edu', role: 'host' });
  db.write('meetings/m-b', { workspaceIds: ['ws-b'], title: 'Other tenant', meetingTime: '2026-10-06T10:00:00.000Z' });
}
seed();
setPrepBriefDepsForTests(() => ({ model: null, nowMs: () => NOW }));
afterAll(() => setPrepBriefDepsForTests(null));

const user: AgentPrincipal = {
  actorType: 'user', userId: 'u-1', organizationId: 'org-1', workspaceId: 'ws-a',
  grantedScopes: ['rbac:operations.meetings.view'], effectiveRole: 'member',
};
const noScope: AgentPrincipal = { ...user, grantedScopes: ['rbac:operations.tasks.view'] };
const foreign: AgentPrincipal = { ...user, workspaceId: 'ws-b', organizationId: 'org-2' };
const agent: AgentPrincipal = { ...user, actorType: 'agent', agentId: 'meeting_prep' };
const cap = meetingGeneratePrepBriefCapability as AnyCapabilityDefinition;

const run = (input: unknown, principal: AgentPrincipal = user) =>
  executeCapability<MeetingGeneratePrepBriefOutput>(
    { capabilityId: cap.id, surface: principal.actorType === 'agent' ? 'agent' : 'ui', input, correlationId: 'c-1', principal },
    { registryLookup: (id) => (id === cap.id ? cap : undefined), auditSink: () => undefined, outboxSink: () => undefined }
  );

defineContractSuite({
  capability: meetingGeneratePrepBriefCapability,
  validInput: { workspaceId: 'ws-a', meetingId: 'm-1' },
  invalidInput: { workspaceId: 'ws-a', meetingId: 'a/b' },
  authorizedPrincipal: user,
  unauthorizedPrincipal: noScope,
  foreignWorkspacePrincipal: foreign,
});

describe('meeting.generate_prep_brief', () => {
  beforeEach(seed);

  it('is registered in the domain and in the Meeting Agent tool matrix', () => {
    expect(MEETINGS_CONVERSATIONS_CAPABILITIES.map((c) => c.id)).toContain('meeting.generate_prep_brief');
    for (const persona of ['meeting_prep', 'meeting_analyst'] as const) {
      expect(MEETING_TOOL_MATRIX[persona].map((e) => e.capabilityId)).toContain('meeting.generate_prep_brief');
    }
    expect(cap.risk.level).toBe('L0_READ');
    expect(cap.policies?.automatedRequiresExplicitFlag).toBe(true);
  });

  it('gives a person a labelled facts-only brief citing the meeting', async () => {
    const res = await run({ workspaceId: 'ws-a', meetingId: 'm-1' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.mode).toBe('facts_only');
    expect(res.data.factsOnlyReason).toBe('model_unavailable');
    expect(res.data.objective?.sourceIds).toEqual(['meeting:m-1']);
    expect(res.data.linkedEntity).toBe(false);
  });

  it("answers NOT_FOUND for another workspace's meeting", async () => {
    const res = await run({ workspaceId: 'ws-a', meetingId: 'm-b' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.code).toBe('NOT_FOUND');
  });

  it('refuses agents until the capability is explicitly enabled for them', async () => {
    const res = await run({ workspaceId: 'ws-a', meetingId: 'm-1' }, agent);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.message).toMatch(/agents and MCP need explicit enablement/);
  });
});

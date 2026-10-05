// @vitest-environment node
/**
 * @fileOverview Meeting personas and matrices (Phase 11 M2 · T1; Rules 16, 17, 59, 66).
 * Authority is proven through the real gateway, not by reading the matrix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '../../helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));

import { executeCapability } from '../../../capabilities/execution/execute-capability';
import { getCapability } from '../../../capabilities/registry/capability-registry';
import { ensureCapabilitiesRegistered } from '../../../capabilities/registry/register-capabilities';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../../capabilities/contracts/capability-definition';
import { parsePermissionRef } from '../../../capabilities/contracts/permission-refs';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';
import {
  MEETING_FAILURE_MATRIX,
  MEETING_PERSONA_IDS,
  MEETING_TOOL_MATRIX,
  MeetingFailureMatrixEntrySchema,
  MeetingToolMatrixEntrySchema,
  meetingPersonaPermissions,
} from '../../../agents/meetings/personas/meeting-agent-matrix';

ensureCapabilitiesRegistered();
let db: FakeFirestore;
beforeEach(() => {
  db = new FakeFirestore();
  h.db = db;
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Demo', meetingTime: '2026-10-01T10:00:00.000Z' });
});

const asPersona = (persona: string): AgentPrincipal => ({
  actorType: 'agent', agentId: persona, userId: 'u-1', organizationId: 'org-1', workspaceId: 'ws-a',
  grantedScopes: [...(globalAgentPersonaRegistry.getPersona(persona)?.allowedPermissions ?? [])], effectiveRole: 'member',
});
const call = (persona: string, capabilityId: string, input: Record<string, unknown>) =>
  executeCapability({ capabilityId, surface: 'agent', input: { workspaceId: 'ws-a', ...input }, correlationId: 'c', principal: asPersona(persona) },
    { auditSink: () => undefined, outboxSink: () => undefined, flagChecker: { checkFlag: async () => ({ enabled: true }) } });

describe('meeting personas', () => {
  it('both personas exist with resolvable permissions; analyst ceiling is L1, prep is L0', () => {
    for (const id of MEETING_PERSONA_IDS) {
      const p = globalAgentPersonaRegistry.getPersona(id);
      expect(p, id).not.toBeNull();
      for (const ref of meetingPersonaPermissions(id)) {
        if (ref !== 'workspace:read') expect(parsePermissionRef(ref), ref).not.toBeNull();
      }
    }
    expect(globalAgentPersonaRegistry.getPersona('meeting_prep')?.maxAutonomousRiskLevel).toBe('L0_READ');
    expect(globalAgentPersonaRegistry.getPersona('meeting_analyst')?.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(globalAgentPersonaRegistry.getPersona('meeting_analyst')?.budgets.maxOutboundMessages).toBe(0);
  });

  it('meeting_prep can read meetings through the gateway but cannot write', async () => {
    expect((await call('meeting_prep', 'meeting.get', { meetingId: 'm-1' })).success).toBe(true);
    const write = await call('meeting_prep', 'meeting.ingest_transcript', { meetingId: 'm-1', source: 'paste', text: 'Ama: hi' });
    expect(write.success).toBe(false);
  });

  it('meeting_analyst can ingest but can never record consent (non-delegable)', async () => {
    expect((await call('meeting_analyst', 'meeting.ingest_transcript', { meetingId: 'm-1', source: 'paste', text: 'Ama: hi' })).success).toBe(true);
    const consent = await call('meeting_analyst', 'meeting.record_consent', { meetingId: 'm-1', type: 'transcription', granted: true, method: 'policy', expectedVersion: 0 });
    expect(consent.success).toBe(false);
  });

  it('meeting_analyst cannot change CRM records autonomously (L2 above its ceiling)', async () => {
    const res = await call('meeting_analyst', 'deal.update', { dealId: 'd-1', patch: { stage: 'won' } });
    expect(res.success).toBe(false);
  });
});

describe('meeting matrices', () => {
  it('every tool in the matrix is registered with the declared risk (Rule 59 guard)', () => {
    for (const [persona, entries] of Object.entries(MEETING_TOOL_MATRIX)) {
      for (const entry of entries) {
        MeetingToolMatrixEntrySchema.parse(entry);
        const cap = getCapability(entry.capabilityId) as AnyCapabilityDefinition | undefined;
        expect(cap, `${persona}: ${entry.capabilityId}`).toBeDefined();
        expect(cap?.risk.level, entry.capabilityId).toBe(entry.riskLevel);
      }
    }
  });

  it('failure matrix entries are well-formed and cover the plan cases', () => {
    for (const e of MEETING_FAILURE_MATRIX) MeetingFailureMatrixEntrySchema.parse(e);
    expect(MEETING_FAILURE_MATRIX.map((e) => e.behaviour)).toEqual(expect.arrayContaining(['RETRY_THEN_DLQ', 'DEGRADE_TO_FACTS', 'STOP_BEFORE_STORE', 'REPROPOSE']));
  });
});

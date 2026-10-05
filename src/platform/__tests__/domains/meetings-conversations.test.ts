// @vitest-environment node
/**
 * @fileOverview Contract + behaviour tests for domain: meetings_conversations (Phase 11 M1 · T1).
 *
 * Covers the shared contract suite (valid / invalid / unauthorized / foreign workspace) plus the
 * meeting-specific guarantees: foreign meetings are NOT_FOUND, recordings never expose URLs,
 * annotations are not the boundary, reads are bounded, and agents get the same scoping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));

import { defineContractSuite } from '../contract/define-contract-suite';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  MEETINGS_CONVERSATIONS_CAPABILITIES,
  meetingGetCapability,
  meetingListRecordingsCapability,
  meetingSearchCapability,
} from '../../domains/meetings_conversations';
import { parsePermissionRef } from '../../capabilities/contracts/permission-refs';
import { toMcpToolSchema } from '../../mcp/to-mcp-tool-schema';
import { computeToolFingerprint } from '../../mcp/security/tool-fingerprint-types';
import { isCapabilityInMcpDomain } from '../../mcp/servers/domain-server-types';

const db = new FakeFirestore();
h.db = db;

function seed(): void {
  db.docs.clear();
  for (let i = 0; i < 60; i += 1) {
    const day = String(1 + (i % 28)).padStart(2, '0');
    db.write(`meetings/m-${i}`, {
      workspaceIds: ['ws-a'], title: i === 7 ? 'Pricing demo with Acme' : `Meeting ${i}`,
      meetingTime: `2026-09-${day}T10:${String(i).padStart(2, '0')}:00.000Z`, entityId: i % 2 ? 'school-1' : 'school-2',
      updatedAt: 'v1', bannerEmbedCode: '<script>x</script>',
    });
  }
  db.write('meetings/m-b', { workspaceIds: ['ws-b'], title: 'Other tenant', meetingTime: '2026-09-01T00:00:00.000Z' });
  db.write('participants/p-1', { meetingId: 'm-7', name: 'Ama', email: 'ama@acme.edu', role: 'attendee', rsvpStatus: 'accepted', attendanceStatus: 'joined', tokenHash: 'secret-hash', phone: '+233' });
  db.write('meeting_recordings/r-up', {
    workspaceId: 'ws-a', meetingId: 'm-7', provider: 'smart_sapp', mediaUrl: 'https://storage.example/x',
    storagePath: 'workspaces/ws-a/meetings/m-7/recordings/a.mp4', durationSeconds: 1200, status: 'available', shareToken: 's', createdAt: 't', updatedAt: 't',
  });
  db.write('meeting_recordings/r-ext', {
    workspaceId: 'ws-a', meetingId: 'm-7', provider: 'google_meet', mediaUrl: 'https://youtube.com/watch?v=1',
    durationSeconds: 600, status: 'available', createdAt: 't', updatedAt: 't',
  });
}
seed();

const user: AgentPrincipal = {
  actorType: 'user', userId: 'u-1', organizationId: 'org-1', workspaceId: 'ws-a',
  grantedScopes: ['rbac:operations.meetings.view'], effectiveRole: 'member',
};
const noScope: AgentPrincipal = { ...user, grantedScopes: ['rbac:operations.tasks.view'] };
const foreign: AgentPrincipal = { ...user, workspaceId: 'ws-b', organizationId: 'org-2' };
const agent: AgentPrincipal = { ...user, actorType: 'agent', agentId: 'meeting_researcher' };

const run = (capability: AnyCapabilityDefinition, input: unknown, principal: AgentPrincipal = user) =>
  executeCapability(
    { capabilityId: capability.id, surface: principal.actorType === 'agent' ? 'agent' : 'ui', input, correlationId: 'c-1', principal },
    { registryLookup: (id) => (id === capability.id ? capability : undefined), auditSink: () => undefined, outboxSink: () => undefined }
  );

defineContractSuite({
  capability: meetingSearchCapability,
  validInput: { workspaceId: 'ws-a', limit: 5 },
  invalidInput: { workspaceId: 'ws-a', limit: 500 },
  authorizedPrincipal: user,
  unauthorizedPrincipal: noScope,
  foreignWorkspacePrincipal: foreign,
});
defineContractSuite({
  capability: meetingGetCapability,
  validInput: { workspaceId: 'ws-a', meetingId: 'm-7' },
  invalidInput: { workspaceId: 'ws-a', meetingId: 'a/b' },
  authorizedPrincipal: user,
  unauthorizedPrincipal: noScope,
  foreignWorkspacePrincipal: foreign,
});
defineContractSuite({
  capability: meetingListRecordingsCapability,
  validInput: { workspaceId: 'ws-a', meetingId: 'm-7' },
  invalidInput: { workspaceId: 'ws-a' },
  authorizedPrincipal: user,
  unauthorizedPrincipal: noScope,
  foreignWorkspacePrincipal: foreign,
});

describe('meetings_conversations behaviour', () => {
  beforeEach(seed);

  it('declares only resolvable permission references and read-only risk', () => {
    for (const cap of MEETINGS_CONVERSATIONS_CAPABILITIES) {
      expect(cap.permissions.length).toBe(1);
      for (const ref of cap.permissions) expect(parsePermissionRef(ref), ref).not.toBeNull();
      expect(cap.risk.level).toBe('L0_READ');
    }
  });

  it('search is bounded, newest first, and filters by text and record', async () => {
    const all = await run(meetingSearchCapability as AnyCapabilityDefinition, { workspaceId: 'ws-a', limit: 50 });
    expect(all.success).toBe(true);
    if (!all.success) return;
    const { meetings, truncated } = all.data as { meetings: Array<{ meetingTime: string; title: string }>; truncated: boolean };
    expect(meetings).toHaveLength(50);
    expect(truncated).toBe(true);
    expect([...meetings].sort((a, b) => b.meetingTime.localeCompare(a.meetingTime))).toEqual(meetings);
    expect(meetings.some((m) => m.title === 'Other tenant')).toBe(false);

    const byText = await run(meetingSearchCapability as AnyCapabilityDefinition, { workspaceId: 'ws-a', query: 'pricing' });
    expect(byText.success && (byText.data as { meetings: unknown[] }).meetings).toHaveLength(1);
  });

  it('a foreign meeting id is NOT_FOUND (never reveals existence)', async () => {
    const res = await run(meetingGetCapability as AnyCapabilityDefinition, { workspaceId: 'ws-a', meetingId: 'm-b' });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('NOT_FOUND');
  });

  it('get returns a minimal projection without secrets or page config', async () => {
    const res = await run(meetingGetCapability as AnyCapabilityDefinition, { workspaceId: 'ws-a', meetingId: 'm-7' });
    expect(res.success).toBe(true);
    const text = JSON.stringify(res.success ? res.data : null);
    expect(text).toContain('ama@acme.edu');
    for (const secret of ['secret-hash', '+233', '<script>', 'tokenHash', 'bannerEmbedCode']) expect(text).not.toContain(secret);
  });

  it('recordings never expose media links or share tokens, and classify kind', async () => {
    const res = await run(meetingListRecordingsCapability as AnyCapabilityDefinition, { workspaceId: 'ws-a', meetingId: 'm-7' }, agent);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const text = JSON.stringify(res.data);
    for (const leak of ['https://', 'storage.example', 'youtube', 'shareToken', 'storagePath']) expect(text).not.toContain(leak);
    const kinds = (res.data as { recordings: Array<{ recordingId: string; kind: string }> }).recordings
      .map((r) => `${r.recordingId}:${r.kind}`).sort();
    expect(kinds).toEqual(['r-ext:external_link', 'r-up:uploaded']);
  });

  it('produces real JSON Schemas for MCP discovery (zod/v4, not the legacy fallback)', () => {
    for (const cap of MEETINGS_CONVERSATIONS_CAPABILITIES) {
      const input = toMcpToolSchema(cap.inputSchema)['~standard'];
      expect(input.vendor).toBe('zod');
      const json = input.jsonSchema.input({ target: 'draft-2020-12' }) as { properties?: Record<string, unknown> };
      expect(Object.keys(json.properties ?? {})).toContain('workspaceId');
      expect(isCapabilityInMcpDomain(cap, 'knowledge')).toBe(true);
    }
  });

  it('tool definitions match the reviewed fingerprint baseline (Rule 14: changes need review)', () => {
    const fingerprints = Object.fromEntries(
      MEETINGS_CONVERSATIONS_CAPABILITIES.map((cap) => [
        `${cap.id}@${cap.version}`,
        computeToolFingerprint(cap, { organizationId: 'baseline', workspaceId: 'baseline' }, 'baseline', '2026-10-05T00:00:00.000Z').compositeHash,
      ])
    );
    // CAUTION: update this snapshot only after reviewing the description/schema/permission/risk change.
    expect(fingerprints).toMatchSnapshot();
  });

  it('a lying annotation does not bypass scope (risk is enforced server-side, Rule 12)', async () => {
    const lying = { ...meetingGetCapability, risk: { ...meetingGetCapability.risk, idempotent: true, destructive: false } } as AnyCapabilityDefinition;
    const res = await run(lying, { workspaceId: 'ws-a', meetingId: 'm-7' }, noScope);
    expect(res.success).toBe(false);
  });
});

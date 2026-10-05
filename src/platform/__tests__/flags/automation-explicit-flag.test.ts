/**
 * @fileOverview Explicit-automation flag gate (Phase 11 M2 · T0, M1 review R6).
 * Enabling a capability for a workspace must not silently enable agents/MCP when the capability
 * declares `automatedRequiresExplicitFlag`.
 */
import { describe, it, expect } from 'vitest';
import { evaluateCapabilityFlag } from '../../capabilities/flags/evaluate-capability-flag';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import { meetingTranscribeRecordingCapability, meetingSearchCapability } from '../../domains/meetings_conversations';

const user: AgentPrincipal = { actorType: 'user', userId: 'u', organizationId: 'org-1', workspaceId: 'ws-a', grantedScopes: [], effectiveRole: 'admin' };
const agent: AgentPrincipal = { ...user, actorType: 'agent', agentId: 'meeting_analyst' };
const cap = meetingTranscribeRecordingCapability as AnyCapabilityDefinition;
const on = { capabilityId: cap.id, workspaceOverrides: { 'ws-a': { enabled: true } } };

describe('automatedRequiresExplicitFlag', () => {
  it('workspace enablement turns the capability on for people only', () => {
    expect(evaluateCapabilityFlag({ flagRecord: on, principal: user, capability: cap, surface: 'ui' }).enabled).toBe(true);
    expect(evaluateCapabilityFlag({ flagRecord: on, principal: agent, capability: cap, surface: 'agent' }).enabled).toBe(false);
    expect(evaluateCapabilityFlag({ flagRecord: on, principal: agent, capability: cap, surface: 'mcp' }).enabled).toBe(false);
  });

  it('explicit agent / MCP enablement opens each surface separately', () => {
    const agents = { ...on, workspaceOverrides: { 'ws-a': { enabled: true, agentEnabled: true } } };
    expect(evaluateCapabilityFlag({ flagRecord: agents, principal: agent, capability: cap, surface: 'agent' }).enabled).toBe(true);
    expect(evaluateCapabilityFlag({ flagRecord: agents, principal: agent, capability: cap, surface: 'mcp' }).enabled).toBe(false);
    const mcp = { ...on, mcpEnabled: true };
    expect(evaluateCapabilityFlag({ flagRecord: mcp, principal: agent, capability: cap, surface: 'mcp' }).enabled).toBe(true);
  });

  it('stays off with no flag record, honours an explicit global agent switch, and leaves other capabilities alone', () => {
    expect(evaluateCapabilityFlag({ flagRecord: null, principal: agent, capability: cap, surface: 'agent' }).enabled).toBe(false);
    expect(evaluateCapabilityFlag({ flagRecord: null, principal: user, capability: cap, surface: 'ui' }).enabled).toBe(false);
    // An operator explicitly enabling agents globally is an explicit choice.
    expect(evaluateCapabilityFlag({ flagRecord: { capabilityId: cap.id, agentEnabled: true }, principal: agent, capability: cap, surface: 'agent' }).enabled).toBe(true);
    const search = meetingSearchCapability as AnyCapabilityDefinition;
    expect(evaluateCapabilityFlag({ flagRecord: null, principal: agent, capability: search, surface: 'agent' }).enabled).toBe(true);
  });
});

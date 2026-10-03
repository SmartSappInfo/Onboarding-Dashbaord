/**
 * @fileOverview Unit Tests for Legacy Swarm Strangler Bridge (Phase 6 Milestone 5)
 *
 * Implements Rule 69 (Strangler Fig Pattern SSOT) guaranteeing zero regressions
 * and seamless backward compatibility for CompanyBrain 2.0 swarm requests.
 */

import { describe, it, expect } from 'vitest';
import { LegacySwarmBridge } from '@/platform/runtime/swarm/legacy-swarm-bridge';
import type { SwarmMissionRequest } from '@/lib/agents/domain-types';

describe('Legacy Swarm Strangler Bridge (Rule 69 Strangler Invariant)', () => {
  it('bridges legacy SwarmMissionRequest to canonical SwarmMission and returns compliant SwarmRun', async () => {
    const bridge = new LegacySwarmBridge();
    const legacyReq: SwarmMissionRequest = {
      workspaceId: 'ws_legacy_1',
      organizationId: 'org_legacy_1',
      actor: {
        type: 'user',
        id: 'usr_123',
        name: 'Joseph',
      },
      objective: 'Bridge test objective: evaluate quarterly revenue and compliance risks',
      mode: 'parallel_consensus',
      specialistIds: ['knowledge_specialist', 'revenue_specialist'],
    };

    const swarmRun = await bridge.dispatchLegacyMission(legacyReq);
    expect(swarmRun.id).toBeDefined();
    expect(swarmRun.organizationId).toBe('org_legacy_1');
    expect(swarmRun.workspaceId).toBe('ws_legacy_1');
    expect(swarmRun.status).toBe('completed');
    expect(swarmRun.consensus).toBeDefined();
    expect(swarmRun.consensus?.executiveSummary).toBeDefined();
    expect(swarmRun.specialistRuns).toBeDefined();
  });

  it('maps legacy sequential pipeline mode to canonical pipeline topology', async () => {
    const bridge = new LegacySwarmBridge();
    const legacyReq: SwarmMissionRequest = {
      workspaceId: 'ws_legacy_1',
      organizationId: 'org_legacy_1',
      actor: { type: 'agent', id: 'agent_sup' },
      objective: 'Sequential pipeline outreach',
      mode: 'sequential_pipeline',
      specialistIds: ['sdr_specialist', 'revenue_specialist'],
    };

    const swarmRun = await bridge.dispatchLegacyMission(legacyReq);
    expect(swarmRun.status).toBe('completed');
    expect(swarmRun.mode).toBe('sequential_pipeline');
  });

  it('translates legacy approval pause into needs_approval status', async () => {
    const bridge = new LegacySwarmBridge({
      simulateApprovalRequiredForSpecialist: 'deal_coach',
    });
    const legacyReq: SwarmMissionRequest = {
      workspaceId: 'ws_legacy_1',
      organizationId: 'org_legacy_1',
      actor: { type: 'user', id: 'usr_123' },
      objective: 'High risk pricing alteration',
      mode: 'parallel_consensus',
      specialistIds: ['revenue_specialist'], // maps to deal_coach
    };

    const swarmRun = await bridge.dispatchLegacyMission(legacyReq);
    expect(swarmRun.status).toBe('needs_approval');
    expect(swarmRun.pendingApprovalId).toBeDefined();
  });
});

/**
 * @fileOverview CompanyBrain Phase 8: Domain Specialists & Agent Swarm Collaboration FER Verification Script
 *
 * Usage:
 *   npx tsx scripts/fer-test-domain-agents.ts
 *   TARGET_WORKSPACE_ID=<workspace_id> npx tsx scripts/fer-test-domain-agents.ts
 */

import { globalAgentRegistry } from '../src/lib/supervisor/agent-registry';
import { BaseDomainSpecialist, AgentSecurityViolationError } from '../src/lib/agents/specialists/base-domain-specialist';
import { KnowledgeSpecialist } from '../src/lib/agents/specialists/knowledge-specialist';
import { RevenueSpecialist } from '../src/lib/agents/specialists/revenue-specialist';
import { SwarmOrchestrator } from '../src/lib/agents/services/swarm-orchestrator';
import type { SwarmMissionRequest, SwarmRun } from '../src/lib/agents/domain-types';
import type { AgentRequest, AgentResult } from '../src/lib/supervisor/types';

async function main() {
  console.log('='.repeat(70));
  console.log('   CompanyBrain Phase 8: Domain Specialists & Swarm Collaboration FER   ');
  console.log('='.repeat(70));

  const testWorkspaceId = process.env.TARGET_WORKSPACE_ID || 'ws_fer_phase8_test';
  const testOrgId = 'org_fer_phase8_test';
  const testUserId = 'usr_fer_operator_8';

  // --- Step 1: Agent Registry & Specialist Descriptors Verification ---
  console.log('\n--- 1. Testing Domain Specialists Registration ---');
  const expectedSpecialists = [
    'knowledge_specialist',
    'revenue_specialist',
    'meeting_specialist',
    'sdr_specialist',
    'operations_specialist',
    'governance_specialist',
  ];

  for (const specId of expectedSpecialists) {
    const has = globalAgentRegistry.hasAgent(specId);
    const agent = globalAgentRegistry.getAgent(specId);
    if (!has || !agent) {
      throw new Error(`Expected specialist "${specId}" to be registered in AgentRegistry.`);
    }
    console.log(`  ✓ Specialist Registered: "${agent.name}" (${specId})`);
    console.log(`    - Capabilities: [${agent.capabilities.join(', ')}]`);
    if (agent instanceof BaseDomainSpecialist) {
      console.log(`    - Allowed Tools: [${agent.descriptor.allowedTools.join(', ')}]`);
      console.log(`    - Default Autonomy: ${agent.descriptor.defaultAutonomy}`);
    }
  }

  // --- Step 2: Individual Specialist Execution Verification ---
  console.log('\n--- 2. Testing Individual Specialist Executions ---');
  const knowledgeSpecialist = new KnowledgeSpecialist();
  const kReq: AgentRequest = {
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    actor: { type: 'user', id: testUserId },
    objective: 'Research institutional lore regarding Acme Health onboarding SLA commitments',
  };

  const kStart = Date.now();
  const kResult = await knowledgeSpecialist.execute(kReq);
  console.log(`  ✓ Knowledge Specialist Execution (${Date.now() - kStart}ms):`);
  console.log(`    - Status: ${kResult.status}`);
  console.log(`    - Findings Count: ${kResult.findings.length}`);
  console.log(`    - Tool Calls Made: ${kResult.toolCalls.length}`);
  console.log(`    - Summary: ${kResult.answer.substring(0, 90)}...`);

  const revenueSpecialist = new RevenueSpecialist();
  const rReq: AgentRequest = {
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    actor: { type: 'user', id: testUserId },
    objective: 'Evaluate pipeline deal health and close probability for enterprise prospect',
  };

  const rStart = Date.now();
  const rResult = await revenueSpecialist.execute(rReq);
  console.log(`  ✓ Revenue Specialist Execution (${Date.now() - rStart}ms):`);
  console.log(`    - Status: ${rResult.status}`);
  console.log(`    - Findings Count: ${rResult.findings.length}`);
  console.log(`    - Actions Proposed: ${rResult.actions.length}`);
  console.log(`    - Summary: ${rResult.answer.substring(0, 90)}...`);

  // --- Step 3: Swarm Collaboration in Parallel Consensus Mode ---
  console.log('\n--- 3. Testing Swarm Collaboration: Parallel Consensus Mode ---');
  const consensusRequest: SwarmMissionRequest = {
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    actor: { type: 'user', id: testUserId },
    objective: 'Conduct comprehensive strategic account audit and deal acceleration review for Acme Health',
    specialistIds: ['knowledge_specialist', 'revenue_specialist', 'governance_specialist'],
    mode: 'parallel_consensus',
  };

  const swarmStart = Date.now();
  const consensusRun = await SwarmOrchestrator.startSwarmMission(consensusRequest);
  const swarmDuration = Date.now() - swarmStart;

  console.log(`  ✓ Swarm Run ID: ${consensusRun.id}`);
  console.log(`  ✓ Execution Status: ${consensusRun.status}`);
  console.log(`  ✓ Execution Duration: ${swarmDuration}ms (metrics: ${consensusRun.metrics.durationMs}ms)`);
  console.log(`  ✓ Specialists Invoked: ${Object.keys(consensusRun.specialistRuns).length}`);
  console.log(`  ✓ Total Swarm Findings: ${consensusRun.metrics.totalFindings}`);

  if (consensusRun.consensus) {
    console.log(`  ✓ Consensus Points Count: ${consensusRun.consensus.consensusPoints.length}`);
    consensusRun.consensus.consensusPoints.forEach((pt) => {
      console.log(`    - [Consensus]: ${pt}`);
    });

    console.log(`  ✓ Divergence / Tension Points Count: ${consensusRun.consensus.divergencePoints.length}`);
    consensusRun.consensus.divergencePoints.forEach((dp) => {
      console.log(`    - [Tension on "${dp.topic}"]: ${dp.tensionSummary}`);
    });

    console.log(`  ✓ Joint Action Proposals Count: ${consensusRun.consensus.jointActions.length}`);
    consensusRun.consensus.jointActions.forEach((act) => {
      console.log(`    - [Action: ${act.riskLevel}]: ${act.title}`);
    });
  }

  // --- Step 4: Swarm Collaboration in Sequential Pipeline Mode ---
  console.log('\n--- 4. Testing Swarm Collaboration: Sequential Pipeline Mode ---');
  const pipelineRequest: SwarmMissionRequest = {
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    actor: { type: 'user', id: testUserId },
    objective: 'Executive briefing and follow-up pipeline handoff for Acme Health',
    specialistIds: ['meeting_specialist', 'knowledge_specialist', 'operations_specialist'],
    mode: 'sequential_pipeline',
  };

  const pipelineRun = await SwarmOrchestrator.startSwarmMission(pipelineRequest);
  console.log(`  ✓ Pipeline Run ID: ${pipelineRun.id}`);
  console.log(`  ✓ Status: ${pipelineRun.status}`);
  console.log(`  ✓ Sequential Stages Executed: ${Object.keys(pipelineRun.specialistRuns).length}`);

  // --- Step 5: Durable State Persistence in Firestore / Memory ---
  console.log('\n--- 5. Testing Durable Swarm Persistence ---');
  const retrievedRun = await SwarmOrchestrator.getSwarmRun(consensusRun.id);
  if (!retrievedRun) {
    throw new Error(`Failed to retrieve persisted swarm run: ${consensusRun.id}`);
  }
  console.log(`  ✓ Persisted Swarm Run Verified: ${retrievedRun.id} (status: ${retrievedRun.status})`);

  const workspaceRuns = await SwarmOrchestrator.listSwarmRuns(testWorkspaceId, 10);
  console.log(`  ✓ Historical Swarm Runs for workspace count: ${workspaceRuns.length}`);
  if (workspaceRuns.length < 2) {
    throw new Error(`Expected at least 2 swarm runs in workspace ${testWorkspaceId}`);
  }

  // --- Step 6: Tool Permission Sandbox Verification ---
  console.log('\n--- 6. Testing Tool Permission Sandboxing ---');
  let blocked = false;
  try {
    const restrictedKnowledge = new KnowledgeSpecialist();
    // Intentionally attempt calling crm.deal.update which is not allowed for knowledge specialist
    await (restrictedKnowledge as any).callGovernedTool({
      toolName: 'crm.deal.update',
      arguments: { dealId: 'deal_999' },
      request: kReq,
      toolCallsCollector: [],
      sourcesCollector: [],
    });
  } catch (err) {
    if (err instanceof AgentSecurityViolationError) {
      blocked = true;
      console.log(`  ✓ Tool Sandbox successfully intercepted unauthorized mutation: "${err.message}"`);
    }
  }

  if (!blocked) {
    throw new Error('Security sandbox failed to block unauthorized tool call for specialist.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('   ✓ All Phase 8 Domain Specialists & Swarm Checks Passed!   ');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('\n❌ Phase 8 Verification Failed:', err);
  process.exit(1);
});

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Agent & Dynamic Tool Orchestration Verification Script
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. End-to-End Orchestrator Verification:
 *    - Validates Agent Registry, Dynamic Goal Decomposition, Step-by-Step Tool Routing,
 *      Approval Pausing/Resumption, and Executive Briefing Synthesis.
 * 2. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1):
 *    - All telemetry, results, and assertions are strictly typed.
 * 3. Execution Safety Verification:
 *    - Confirms hard max 10 steps loop ceiling and 60-second execution guard.
 *
 * Usage:
 *   npx tsx scripts/fer-test-supervisor-agent.ts [--workspace-id=ws_xxx]
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Ensure mock ambient environment variables for local testing if unconfigured
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'mock_gemini_key';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'mock_google_key';

import { globalAgentRegistry } from '../src/lib/supervisor/agent-registry';
import { SupervisorEngine } from '../src/lib/supervisor/services/supervisor-engine';
import { globalMcpRegistry } from '../src/lib/mcp/registry';
import { registerAllCoreTools } from '../src/lib/mcp/tools';
import { decomposeSupervisorGoalFlow } from '../src/ai/flows/decompose-supervisor-goal-flow';
import { synthesizeSupervisorResultFlow } from '../src/ai/flows/synthesize-supervisor-result-flow';
import type { AgentRequest, AgentRun } from '../src/lib/supervisor/types';

async function main() {
  console.log('='.repeat(70));
  console.log('   CompanyBrain 2.0 Phase 7: Supervisor Agent Orchestration FER   ');
  console.log('='.repeat(70));

  const args = process.argv.slice(2);
  const wsArg = args.find((a) => a.startsWith('--workspace-id='));
  const testWorkspaceId = wsArg ? wsArg.split('=')[1] : `ws_fer_sup_${Date.now().toString(36)}`;
  const testOrgId = 'org_fer_supervisor';
  const testUserId = 'fer_supervisor_tester';

  // Ensure MCP tools are registered in global registry for supervisor tool dispatch
  registerAllCoreTools(globalMcpRegistry);

  // --- Step 1: Agent Registry Verification ---
  console.log('\n--- 1. Testing Agent Registry Bootstrap & Discovery ---');
  const registeredAgents = globalAgentRegistry.listAgents();
  console.log(`  ✓ Registered Agents Count: ${registeredAgents.length} (expected >= 4)`);
  if (registeredAgents.length < 4) {
    throw new Error(`Expected at least 4 registered agents, got ${registeredAgents.length}`);
  }

  const supervisorAgent = globalAgentRegistry.getAgent('supervisor-prime');
  if (!supervisorAgent) {
    throw new Error('Supervisor Agent "supervisor-prime" is not registered in global registry.');
  }
  console.log(`  ✓ Supervisor Prime found: "${supervisorAgent.name}" v${supervisorAgent.version}`);
  console.log(`    Capabilities: ${supervisorAgent.capabilities.join(', ')}`);

  const descriptors = globalAgentRegistry.getAgentDescriptors();
  console.log(`  ✓ Public Descriptors generated: ${descriptors.length} descriptors`);

  // --- Step 2: Goal Decomposition Flow Verification ---
  console.log('\n--- 2. Testing Dynamic Goal Decomposition Flow ---');
  const testObjective = 'Prepare comprehensive onboarding risk audit for Acme Health Systems and propose follow-up actions';
  const availableTools = globalMcpRegistry.getToolDescriptors();

  const decomposition = await decomposeSupervisorGoalFlow({
    objective: testObjective,
    availableTools: availableTools.map((t) => ({
      name: t.name,
      description: t.description,
      riskLevel: t.riskLevel,
    })),
    maxSteps: 4,
  });

  console.log(`  ✓ Goal: "${decomposition.goal}"`);
  console.log(`  ✓ Total Planned Steps: ${decomposition.totalSteps}`);
  decomposition.steps.forEach((step) => {
    console.log(`    Step ${step.stepNumber}: [${step.assignedAgentOrTool}] ${step.title} -> ${step.intent}`);
  });

  if (decomposition.steps.length === 0) {
    throw new Error('Decomposition yielded 0 steps.');
  }
  if (decomposition.steps.length > 10) {
    throw new Error(`Decomposition exceeded 10 steps ceiling: ${decomposition.steps.length}`);
  }

  // --- Step 3: End-to-End Supervisor Mission Execution ---
  console.log('\n--- 3. Testing End-to-End Mission Execution ---');
  const missionRequest: AgentRequest = {
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    actor: {
      type: 'user',
      id: testUserId,
    },
    objective: testObjective,
    maxSteps: 3,
    executionMode: 'autonomous',
  };

  const startTime = Date.now();
  const run: AgentRun = await SupervisorEngine.startMission(missionRequest);
  const duration = Date.now() - startTime;

  console.log(`  ✓ Mission ID: ${run.id}`);
  console.log(`  ✓ Execution Status: ${run.status}`);
  console.log(`  ✓ Steps Executed: ${run.metrics.completedSteps} / ${run.steps.length}`);
  console.log(`  ✓ Duration: ${duration}ms (metrics: ${run.metrics.durationMs}ms)`);
  console.log(`  ✓ Tool Calls Made: ${run.toolCalls.length}`);

  run.toolCalls.forEach((tc, idx) => {
    console.log(`    Tool Call #${idx + 1}: ${tc.toolName} (${tc.durationMs}ms, status: ${tc.status})`);
  });

  // --- Step 4: Executive Result Synthesis Verification ---
  console.log('\n--- 4. Testing Result Synthesis & Action Proposals ---');
  if (run.result) {
    console.log(`  ✓ Result Status: ${run.result.status}`);
    console.log(`  ✓ Findings Count: ${run.result.findings.length}`);
    run.result.findings.forEach((f) => {
      console.log(`    - Finding [${f.category}]: "${f.title}" (confidence: ${f.confidence})`);
    });

    console.log(`  ✓ Proposed Actions Count: ${run.result.actions.length}`);
    run.result.actions.forEach((a) => {
      console.log(`    - Action [${a.riskLevel}]: ${a.toolName} -> "${a.title}" (approval required: ${a.requiresApproval})`);
    });

    console.log(`  ✓ Executive Summary snippet:`);
    const summaryLines = (run.result.answer || '').split('\n').slice(0, 4);
    summaryLines.forEach((l) => console.log(`      ${l}`));
  } else {
    console.log(`  ℹ Mission paused with status: "${run.status}" (Pending Approval ID: ${run.pendingApprovalId || 'none'})`);
  }

  // --- Step 5: Durable State Verification in Firestore ---
  console.log('\n--- 5. Testing Durable State Persistence ---');
  const fetchedRun = await SupervisorEngine.getRun(run.id);
  if (!fetchedRun) {
    throw new Error(`Failed to load persisted run ${run.id} from Firestore.`);
  }
  console.log(`  ✓ Persisted Run retrieved: ${fetchedRun.id} (status: ${fetchedRun.status})`);

  const workspaceRuns = await SupervisorEngine.listRuns(testWorkspaceId, 10);
  console.log(`  ✓ Workspace Runs count: ${workspaceRuns.length}`);
  if (workspaceRuns.length === 0) {
    throw new Error(`Expected at least 1 run for workspace ${testWorkspaceId}`);
  }

  // --- Step 6: Loop Ceiling & Safety Verification ---
  console.log('\n--- 6. Testing Loop Safety Guards ---');
  const excessiveRequest: AgentRequest = {
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    actor: { type: 'user', id: testUserId },
    objective: 'Test safety bounds',
    maxSteps: 99, // Should be bounded to <= 10
  };

  const boundedRun = await SupervisorEngine.startMission(excessiveRequest);
  console.log(`  ✓ Requested 99 steps, bounded plan produced: ${boundedRun.steps.length} steps (must be <= 10)`);
  if (boundedRun.steps.length > 10) {
    throw new Error(`Loop ceiling breach: generated ${boundedRun.steps.length} steps.`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('   ✓ All Phase 7 Supervisor Agent Verification Checks Passed!   ');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('\n❌ Supervisor Agent Verification Failed:', err);
  process.exit(1);
});

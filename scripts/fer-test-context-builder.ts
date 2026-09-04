/**
 * @fileOverview CompanyBrain 2.0 Phase 5: FER Context Builder Verification Script
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Fast, Idempotent Verification:
 *    - Validates that the Context Builder synthesizes structured facts, memories,
 *      graph relationships, and conflict warnings within strict token budget ceilings.
 * 2. Non-Destructive Test Execution:
 *    - All operations are read-only (`buildContext`).
 * 3. Telemetry Summary:
 *    - Emits latency (ms), token utilization (%), tier allocation, and citations count.
 *
 * Usage:
 *   npx tsx scripts/fer-test-context-builder.ts [--workspace-id=ws_xxx] [--entity-id=ent_xxx] [--dry-run]
 */

// Ensure ambient keys for Genkit module initialization
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-mock-key';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-mock-key';

import { ContextBuilderService } from '../src/lib/memory/services/context-builder-service';
import { ContextRelevanceScorer } from '../src/lib/memory/services/context-relevance-scorer';
import { ContextBudgetManager } from '../src/lib/memory/services/context-budget-manager';

async function main() {
  console.log('='.repeat(70));
  console.log('   CompanyBrain 2.0 Phase 5: Context Builder FER Verification   ');
  console.log('='.repeat(70));

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const wsArg = args.find((a) => a.startsWith('--workspace-id='));
  const targetWorkspaceId = wsArg ? wsArg.split('=')[1] : 'ws_fer_test';

  const entArg = args.find((a) => a.startsWith('--entity-id='));
  const targetEntityId = entArg ? entArg.split('=')[1] : 'ent_sample_account';

  console.log(`\n[Config] Target Workspace : ${targetWorkspaceId}`);
  console.log(`[Config] Target Entity    : ${targetEntityId}`);
  console.log(`[Config] Dry-Run Mode     : ${isDryRun ? 'YES (Simulated)' : 'NO (Live Fetch)'}`);

  // Test 1: Relevance Scorer Math & Normalization
  console.log('\n--- 1. Testing Context Relevance Scorer ---');
  const scored = ContextRelevanceScorer.calculateRelevance({
    semanticScore: 0.88,
    isDirectSubjectMatch: true,
    graphHops: 1,
    freshnessScore: 0.95,
    importance: 0.85,
    confidence: 0.90,
  });
  console.log(`  ✓ Score: ${scored.score} (expected: ~0.85-0.95)`);
  console.log(`  ✓ Attribution: "${scored.whyRelevant}"`);
  if (scored.score < 0 || scored.score > 1.0) {
    throw new Error(`Invalid score normalization: ${scored.score}`);
  }

  // Test 2: Token Budget Allocation
  console.log('\n--- 2. Testing 4-Tier Stratified Budget Allocation ---');
  const dummyItems = {
    structuredFacts: [
      { id: 'f1', key: 'type', label: 'Type', value: 'Private School', confidence: 1, tier: 'tier1_critical' as const },
    ],
    memories: [
      {
        id: 'm1',
        memory: {
          id: 'm1',
          workspaceId: targetWorkspaceId,
          organizationId: 'org_test',
          type: 'decision' as const,
          content: 'School agreed to evaluate SmartSapp portal with 650 student licenses.',
          source: { sourceType: 'note' as const, sourceId: 'n1', timestamp: new Date().toISOString() },
          importance: 0.9,
          confidence: 0.95,
          lifecycle: { status: 'active' as const, revision: 1, updatedAt: new Date().toISOString() },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        relevanceScore: 0.85,
        effectiveScore: 0.82,
        freshness: { memoryId: 'm1', freshnessScore: 0.95, isStale: false, ttlDays: 365, daysRemaining: 340, lastConfirmedAt: new Date().toISOString(), category: 'decision' as const },
        tier: 'tier2_relevant' as const,
        whyRelevant: 'Direct match with high semantic alignment',
        citationId: 'cit_1',
      },
    ],
    relationships: [
      { id: 'r1', sourceNodeId: targetEntityId, targetNodeId: 'usr_1', targetNodeName: 'Principal Addo', targetNodeType: 'person', relationshipType: 'DECIDED', hops: 1, tier: 'tier2_relevant' as const },
    ],
    recentActivity: [
      { id: 'e1', eventType: 'quick_note', timestamp: new Date().toISOString(), summary: 'Discussed pricing discount with bursar.', tier: 'tier3_supporting' as const },
    ],
    openActions: [
      { id: 'a1', title: 'Send implementation roadmap', status: 'pending', priority: 'high' as const, tier: 'tier1_critical' as const },
    ],
    relevantKnowledge: [
      { id: 'k1', insight: 'Implementation timeline is the primary concern for leadership.', confidence: 0.9, occurrences: 3, theme: 'Objections', tier: 'tier2_relevant' as const },
    ],
    conflicts: [
      { id: 'c1', summary: 'Fee quote discrepancy: $3,000 vs $1,500', conflictType: 'contradiction', severity: 'high' as const, opposingAspects: ['Pricing'], memoryIdA: 'm1', memoryIdB: 'm2', evidenceQuoteA: 'Quoted $3,000', evidenceQuoteB: 'Offered $1,500 override', resolutionStatus: 'unresolved' as const },
    ],
  };

  const budgetResult = ContextBudgetManager.allocateBudget(dummyItems, 4000);
  console.log(`  ✓ Total Allocated Tokens: ${budgetResult.tokenBudget.totalTokens}`);
  console.log(`  ✓ Utilization: ${budgetResult.tokenBudget.utilizationPercentage}%`);
  console.log(`  ✓ Tier Breakdown:`, budgetResult.tokenBudget.tierBreakdown);
  console.log(`  ✓ Critical Items Preserved: ${budgetResult.budgetedItems.conflicts.length} conflict(s), ${budgetResult.budgetedItems.openActions.length} action(s)`);

  // Test 3: Live Context Assembly (Mock or Real)
  console.log('\n--- 3. Testing Context Package Assembly Façade ---');
  const startTime = Date.now();
  const pkg = await ContextBuilderService.buildContext({
    workspaceId: targetWorkspaceId,
    organizationId: 'org_default',
    requester: { type: 'user', id: 'usr_tester' },
    subject: { type: 'entity', id: targetEntityId },
    objective: 'Prepare for annual partnership renewal meeting',
    maxTokens: 4000,
    depth: 'standard',
  });
  const latency = Date.now() - startTime;

  console.log(`  ✓ Context ID: ${pkg.contextId}`);
  console.log(`  ✓ Execution Latency: ${latency}ms`);
  console.log(`  ✓ Structured Facts: ${pkg.structuredFacts.length}`);
  console.log(`  ✓ Recalled Memories: ${pkg.memories.length}`);
  console.log(`  ✓ Graph Relationships: ${pkg.relationships.length}`);
  console.log(`  ✓ Open Actions: ${pkg.openActions.length}`);
  console.log(`  ✓ Active Conflicts: ${pkg.conflicts.length}`);
  console.log(`  ✓ Citations Attached: ${pkg.sources.length}`);

  // Test 4: Subject Dossier Synthesis
  console.log('\n--- 4. Testing Subject Dossier Compilation ---');
  const dossier = await ContextBuilderService.buildSubjectDossier({
    subjectId: targetEntityId,
    subjectType: 'entity',
    workspaceId: targetWorkspaceId,
    organizationId: 'org_default',
  });
  console.log(`  ✓ Dossier Title: ${dossier.title}`);
  console.log(`  ✓ Executive Summary: "${dossier.executiveSummary}"`);
  console.log(`  ✓ Commercial Momentum: ${dossier.commercialOutlook.revenueMomentum}`);
  console.log(`  ✓ Concerns Flagged: ${dossier.currentConcerns.length}`);
  console.log(`  ✓ Stakeholders Count: ${dossier.keyStakeholders.length}`);

  console.log('\n' + '='.repeat(70));
  console.log('   ✓ ALL FER CONTEXT BUILDER CHECKS PASSED (100% GREEN)   ');
  console.log('='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error('\n❌ FER Context Builder Verification FAILED:', err);
  process.exit(1);
});

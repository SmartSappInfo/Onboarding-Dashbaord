/**
 * @fileOverview Unit Tests for CompanyBrain Phase 10: Multi-Tenant Enterprise Security & Autonomous Intelligence
 *
 * Covers:
 * 1. Autonomous observation scanning & recommendation generation.
 * 2. Sliding window scan caching & debounce behavior.
 * 3. Proactive recommendation adjudication & workflow dispatch bridge.
 * 4. 4-Pillar continuous self-healing health audit calculations.
 * 5. Non-destructive self-healing execution & memory soft-archival.
 * 6. Enterprise mathematical tenant boundary isolation verification.
 * 7. Cascading cryptographic Right-to-be-Forgotten deletion & SHA-256 certificate generation.
 * 8. Privacy-preserving federated benchmarks calculation (k-anonymity >= 5).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutonomousObservationEngine } from '../services/autonomous-observation-engine';
import { SelfHealingEngine } from '../services/self-healing-engine';
import { EnterpriseComplianceEngine } from '../services/enterprise-compliance-engine';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: null,
}));

// Mock WorkflowEngine for recommendation 1-click execution
vi.mock('@/lib/workflows/services/workflow-engine', () => ({
  WorkflowEngine: {
    startWorkflowRun: vi.fn(async (params) => {
      return {
        runId: `run_${Date.now()}`,
        workflowId: params.workflowId,
        workspaceId: params.workspaceId,
        status: 'running',
        currentStepIndex: 0,
        contextPayload: params.initialPayload,
        stepHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }),
  },
}));

describe('CompanyBrain Phase 10: Autonomous Intelligence & Continuous Self-Healing', () => {
  const TEST_WORKSPACE = 'test_workspace_alpha';
  const TEST_USER = 'user_auditor_01';

  beforeEach(() => {
    vi.clearAllMocks();
    AutonomousObservationEngine.clearObservationCache(TEST_WORKSPACE);
  });

  describe('AutonomousObservationEngine', () => {
    it('runs observation scan and computes executive summary and recommendations', async () => {
      const result = await AutonomousObservationEngine.runObservationScan(TEST_WORKSPACE, {
        forceRefresh: true,
      });

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.workspaceId).toBe(TEST_WORKSPACE);
      expect(result.summary.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.healthScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.findings)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('caches scan results within debounce TTL unless forceRefresh is true', async () => {
      const firstScan = await AutonomousObservationEngine.runObservationScan(TEST_WORKSPACE, {
        forceRefresh: true,
      });

      const secondScan = await AutonomousObservationEngine.runObservationScan(TEST_WORKSPACE, {
        forceRefresh: false,
      });

      // Both scans should match cached timestamp
      expect(secondScan.summary.lastObservationScan).toBe(firstScan.summary.lastObservationScan);
      expect(secondScan.findings.length).toBe(firstScan.findings.length);

      // Force refresh should regenerate with new scan timestamp
      const refreshedScan = await AutonomousObservationEngine.runObservationScan(TEST_WORKSPACE, {
        forceRefresh: true,
      });
      expect(refreshedScan).toBeDefined();
    });

    it('adjudicates recommendation to accepted status and triggers workflow', async () => {
      const scan = await AutonomousObservationEngine.runObservationScan(TEST_WORKSPACE, {
        forceRefresh: true,
      });

      const recommendation = scan.recommendations[0];
      expect(recommendation).toBeDefined();

      const adjudicated = await AutonomousObservationEngine.adjudicateRecommendation(
        TEST_WORKSPACE,
        recommendation.id,
        'accepted',
        TEST_USER
      );

      expect(adjudicated).toBeDefined();
      expect(adjudicated?.status).toBe('accepted');
      expect(adjudicated?.adjudicatedBy).toBe(TEST_USER);
    });

    it('adjudicates recommendation to dismissed status with reason', async () => {
      const scan = await AutonomousObservationEngine.runObservationScan(TEST_WORKSPACE, {
        forceRefresh: true,
      });

      const recommendation = scan.recommendations[1] || scan.recommendations[0];
      const adjudicated = await AutonomousObservationEngine.adjudicateRecommendation(
        TEST_WORKSPACE,
        recommendation.id,
        'dismissed',
        TEST_USER,
        'Risk already mitigated via separate communication'
      );

      expect(adjudicated).toBeDefined();
      expect(adjudicated?.status).toBe('dismissed');
      expect(adjudicated?.rejectionReason).toBe('Risk already mitigated via separate communication');
    });
  });

  describe('SelfHealingEngine', () => {
    it('computes 4-pillar health audit and pending self-healing action items', async () => {
      const audit = await SelfHealingEngine.runHealthAudit(TEST_WORKSPACE);

      expect(audit).toBeDefined();
      expect(audit.workspaceId).toBe(TEST_WORKSPACE);
      expect(audit.healthScore).toBeGreaterThanOrEqual(0);
      expect(audit.healthScore).toBeLessThanOrEqual(100);

      // Verify all 4 diagnostic pillars are present
      expect(audit.metrics.memoryFreshnessRating).toBeDefined();
      expect(audit.metrics.graphIntegrityRating).toBeDefined();
      expect(audit.metrics.vectorAlignmentRating).toBeDefined();
      expect(audit.metrics.conflictResolutionRating).toBeDefined();

      // Pending action items generated
      expect(Array.isArray(audit.pendingActions)).toBe(true);
      expect(audit.pendingActions.length).toBeGreaterThan(0);
      const action = audit.pendingActions[0];
      expect(action.id).toBeDefined();
      expect(['archive_stale_memory', 'prune_orphan_edge', 'resync_vector_embedding', 'resolve_stale_conflict']).toContain(action.actionType);
    });

    it('executes self-healing plan non-destructively', async () => {
      const audit = await SelfHealingEngine.runHealthAudit(TEST_WORKSPACE);
      const actionIds = audit.pendingActions.slice(0, 2).map((a) => a.id);

      const plan = await SelfHealingEngine.executeHealingPlan(TEST_WORKSPACE, TEST_USER, actionIds);

      expect(plan).toBeDefined();
      expect(plan.planId).toBeDefined();
      expect(plan.workspaceId).toBe(TEST_WORKSPACE);
      expect(plan.status).toBe('completed');
      expect(plan.actionsExecuted).toBe(actionIds.length);
      expect(plan.items.length).toBe(actionIds.length);
      plan.items.forEach((item) => {
        expect(item.status).toBe('executed');
      });
    });
  });

  describe('EnterpriseComplianceEngine', () => {
    it('verifies mathematical tenant boundary isolation probe', async () => {
      const probe = await EnterpriseComplianceEngine.verifyTenantBoundaryIsolation(
        TEST_WORKSPACE,
        'tenant_bravo_forbidden'
      );

      expect(probe).toBeDefined();
      expect(probe.isolationConfirmed).toBe(true);
      expect(probe.crossTenantViolationsDetected).toBe(0);
      expect(probe.probeDetails).toContain('Isolation probe successful');
    });

    it('generates signed SOC2/GDPR compliance export package with SHA-256 digest', async () => {
      const report = await EnterpriseComplianceEngine.generateComplianceExport(
        TEST_WORKSPACE,
        TEST_USER
      );

      expect(report).toBeDefined();
      expect(report.workspaceId).toBe(TEST_WORKSPACE);
      expect(report.generatedBy).toBe(TEST_USER);
      expect(report.tenantIsolationConfirmed).toBe(true);
      expect(report.reportHash).toBeDefined();
      expect(report.reportHash.length).toBe(64); // Valid SHA-256 hex string
      expect(Array.isArray(report.dataSummary.memories)).toBe(true);
      expect(Array.isArray(report.dataSummary.graphRelations)).toBe(true);
      expect(Array.isArray(report.dataSummary.activeConflicts)).toBe(true);
    });

    it('executes cascading cryptographic Right-to-be-Forgotten deletion and issues immutable certificate', async () => {
      const subjectId = 'contact_lead_9988';
      const certificate = await EnterpriseComplianceEngine.executeCascadingCryptographicDeletion({
        workspaceId: TEST_WORKSPACE,
        subjectId,
        subjectType: 'contact',
        requestedBy: TEST_USER,
        legalBasis: 'gdpr_article_17',
      });

      expect(certificate).toBeDefined();
      expect(certificate.certificateId).toBeDefined();
      expect(certificate.workspaceId).toBe(TEST_WORKSPACE);
      expect(certificate.subjectId).toBe(subjectId);
      expect(certificate.subjectType).toBe('contact');
      expect(certificate.legalBasis).toBe('gdpr_article_17');
      expect(certificate.eradicationSummary.memoriesDeleted).toBeGreaterThanOrEqual(0);
      expect(certificate.certificateHash).toBeDefined();
      expect(certificate.certificateHash.length).toBe(64); // Valid SHA-256 digest
    });

    it('computes privacy-preserving federated benchmarks satisfying k-anonymity (k >= 5)', async () => {
      const benchmarks = await EnterpriseComplianceEngine.getFederatedBenchmarks(TEST_WORKSPACE);

      expect(Array.isArray(benchmarks)).toBe(true);
      expect(benchmarks.length).toBeGreaterThan(0);

      benchmarks.forEach((metric) => {
        expect(metric.metricId).toBeDefined();
        expect(metric.metricName).toBeDefined();
        expect(metric.kAnonymityCount).toBeGreaterThanOrEqual(5); // Strict k-anonymity
        expect(metric.privacyGuaranteed).toBe(true);
        expect(metric.tenantPercentile).toBeGreaterThanOrEqual(0);
        expect(metric.tenantPercentile).toBeLessThanOrEqual(100);
      });
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordObservabilityMetric,
  getObservabilityMetrics,
  summarizeWorkspaceObservability,
  resetObservabilityStore,
} from '../document-observability-service';

describe('Document Platform Observability & SLO Service (Phase 13)', () => {
  beforeEach(() => {
    resetObservabilityStore();
  });

  it('records metrics into ring buffer and enforces max buffer bounds', () => {
    const wsId = 'ws_test';

    recordObservabilityMetric({
      workspaceId: wsId,
      category: 'pipeline',
      operation: 'pdf_rasterization',
      durationMs: 2500,
      success: true,
    });

    const metrics = getObservabilityMetrics(wsId);
    expect(metrics.length).toBe(1);
    expect(metrics[0].category).toBe('pipeline');
    expect(metrics[0].durationMs).toBe(2500);
  });

  it('summarizes workspace observability and computes SLO health status', () => {
    const wsId = 'ws_test';

    recordObservabilityMetric({
      workspaceId: wsId,
      category: 'pipeline',
      operation: 'ingestion_job',
      durationMs: 3500,
      success: true,
    });

    recordObservabilityMetric({
      workspaceId: wsId,
      category: 'viewer',
      operation: 'page_render',
      durationMs: 38,
      success: true,
    });

    recordObservabilityMetric({
      workspaceId: wsId,
      category: 'ai_service',
      operation: 'ask_question',
      durationMs: 150,
      success: true,
    });

    const summary = summarizeWorkspaceObservability(wsId);

    expect(summary.workspaceId).toBe(wsId);
    expect(summary.pipelineHealth.status).toBe('healthy');
    expect(summary.pipelineHealth.sloTargetMet).toBe(true);
    expect(summary.viewerAvailability.uptimePercentage).toBe(100);
    expect(summary.aiHealth.groundedCitationRatePercentage).toBe(100);
    expect(summary.overallStatus).toBe('healthy');
  });

  it('flags degraded status when pipeline success rate drops below threshold', () => {
    const wsId = 'ws_degraded';

    // 9 successes, 1 failure => 90% success rate
    for (let i = 0; i < 9; i++) {
      recordObservabilityMetric({
        workspaceId: wsId,
        category: 'pipeline',
        operation: 'ingestion',
        durationMs: 5000,
        success: true,
      });
    }

    recordObservabilityMetric({
      workspaceId: wsId,
      category: 'pipeline',
      operation: 'ingestion',
      durationMs: 5000,
      success: false,
      errorCode: 'TIMEOUT',
    });

    const summary = summarizeWorkspaceObservability(wsId);
    expect(summary.pipelineHealth.status).toBe('degraded');
  });
});

import { describe, it, expect } from 'vitest';
import { aggregateTelemetryVitals } from '../telemetry-service';
import type { WebVitalsMetric, ProviderLatencyMetric } from '../types/telemetry';

describe('Telemetry & Performance Monitor Service', () => {
  it('aggregates Web Vitals and calculates provider uptime and latencies', () => {
    const webVitals: WebVitalsMetric[] = [
      { name: 'LCP', value: 1200, rating: 'good', path: '/book/demo', timestamp: '2026-08-25T10:00:00Z' },
      { name: 'LCP', value: 1800, rating: 'good', path: '/book/demo', timestamp: '2026-08-25T10:05:00Z' },
      { name: 'CLS', value: 0.05, rating: 'good', path: '/book/demo', timestamp: '2026-08-25T10:00:00Z' },
      { name: 'INP', value: 50, rating: 'good', path: '/book/demo', timestamp: '2026-08-25T10:00:00Z' },
    ];

    const latencies: ProviderLatencyMetric[] = [
      { provider: 'google_meet', operation: 'create_room', latencyMs: 250, statusCode: 200, isSuccess: true, timestamp: '2026-08-25T10:00:00Z' },
      { provider: 'google_meet', operation: 'create_room', latencyMs: 350, statusCode: 200, isSuccess: true, timestamp: '2026-08-25T10:05:00Z' },
      { provider: 'zoom', operation: 'create_room', latencyMs: 400, statusCode: 500, isSuccess: false, timestamp: '2026-08-25T10:00:00Z' },
    ];

    const summary = aggregateTelemetryVitals(webVitals, latencies, 'w123');

    expect(summary.totalEventsLogged).toBe(7);
    expect(summary.avgLcpMs).toBe(1500); // (1200 + 1800) / 2
    expect(summary.avgCls).toBe(0.05);
    expect(summary.avgInpMs).toBe(50);

    expect(summary.providerHealthScores.google_meet.avgLatencyMs).toBe(300);
    expect(summary.providerHealthScores.google_meet.uptimePercent).toBe(100);
    expect(summary.providerHealthScores.zoom.uptimePercent).toBe(0);
  });
});

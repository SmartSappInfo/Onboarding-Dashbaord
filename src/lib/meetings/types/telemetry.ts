/**
 * @fileoverview Domain Types for Core Web Vitals, Performance Telemetry & Video Latency.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure schemas.
 * - Zero 'any' policy strictly enforced.
 */

export interface WebVitalsMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
  path: string;
  timestamp: string;
}

export interface ProviderLatencyMetric {
  provider: 'google_meet' | 'zoom' | 'teams' | 'daily' | 'in_person';
  operation: 'create_room' | 'end_session' | 'webhook_delivery';
  latencyMs: number;
  statusCode: number;
  isSuccess: boolean;
  timestamp: string;
}

export interface TelemetrySummary {
  workspaceId: string;
  totalEventsLogged: number;
  avgLcpMs: number;
  avgCls: number;
  avgInpMs: number;
  providerHealthScores: Record<string, { avgLatencyMs: number; uptimePercent: number }>;
}

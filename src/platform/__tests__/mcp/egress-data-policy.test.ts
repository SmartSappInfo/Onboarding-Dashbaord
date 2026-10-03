/**
 * @fileOverview Unit & Integration Tests for EgressDataPolicyEngine (Phase 5 Milestone 3 Task 5)
 *
 * Validates Rule 4 (Zero any/any[]), Rule 9 (Payload size limit), Rule 13 (Never Trust Model),
 * Rule 23 (Bounded Depth), Rule 32 & 33 (Exfiltration Detection & Egress Control),
 * Rule 40 (EventBus Audit Logging), and Rule 48 (Sanitized Error Messages).
 */

import { describe, it, expect } from 'vitest';
import { createEgressDataPolicyEngine } from '../../mcp/security/egress-data-policy';
import {
  EGRESS_ERROR_CODES,
  getDefaultChannelCeiling,
  isSensitivityAboveCeiling,
  SENSITIVITY_LEVELS,
} from '../../mcp/security/egress-data-policy-types';
import type { TenantContext } from '../../mcp/security/tool-fingerprint-types';
import { createEventBus } from '../../events/event-bus';
import type { DomainEvent } from '../../capabilities/events/domain-event';

describe('Data Egress Policy Engine & Exfiltration Detection (Task 5)', () => {
  const tenant: TenantContext = {
    organizationId: 'org_enterprise_sec',
    workspaceId: 'ws_prod_defense',
  };

  it('validates 7-tier sensitivity hierarchy and channel ceilings (Rule 32 & 33)', () => {
    expect(SENSITIVITY_LEVELS).toHaveLength(7);
    expect(isSensitivityAboveCeiling('credential', 'internal')).toBe(true);
    expect(isSensitivityAboveCeiling('financial', 'internal')).toBe(true);
    expect(isSensitivityAboveCeiling('internal', 'public')).toBe(true);
    expect(isSensitivityAboveCeiling('public', 'public')).toBe(false);
    expect(isSensitivityAboveCeiling('internal', 'internal')).toBe(false);

    expect(getDefaultChannelCeiling('public_portal')).toBe('public');
    expect(getDefaultChannelCeiling('external_email')).toBe('internal');
    expect(getDefaultChannelCeiling('external_webhook')).toBe('internal');
    expect(getDefaultChannelCeiling('external_mcp_tool')).toBe('internal');
    expect(getDefaultChannelCeiling('internal_memory')).toBe('credential');
    expect(getDefaultChannelCeiling('internal_database')).toBe('credential');
  });

  it('detects credentials including API keys, JWTs, and private keys', () => {
    const engine = createEgressDataPolicyEngine();

    const payload = {
      user: 'alice',
      credentials: {
        openaiKey: 'sk-proj-1234567890abcdef1234567890abcdef',
        googleKey: 'AIzaSyD1234567890abcdef1234567890abcdef',
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        rsaKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
      },
    };

    const detections = engine.scanPayload(payload);
    expect(detections.length).toBeGreaterThanOrEqual(4);
    expect(detections.some((d) => d.category === 'credential' && d.patternName === 'api_key_known_provider')).toBe(true);
    expect(detections.some((d) => d.category === 'credential' && d.patternName === 'jwt_token')).toBe(true);
    expect(detections.some((d) => d.category === 'credential' && d.patternName === 'private_key')).toBe(true);
  });

  it('detects financial records and personal PII', () => {
    const engine = createEgressDataPolicyEngine();

    const payload = {
      customer: {
        name: 'Bob Smith',
        ssn: '123-45-6789',
        card: '4111111111111111', // Visa test card
      },
    };

    const detections = engine.scanPayload(payload);
    expect(detections.some((d) => d.category === 'personal' && d.patternName === 'us_ssn')).toBe(true);
    expect(detections.some((d) => d.category === 'financial' && d.patternName === 'credit_card_number')).toBe(true);
  });

  it('enforces bounded traversal depth preventing stack overflow or ReDoS (Rule 23)', () => {
    const engine = createEgressDataPolicyEngine();

    // Create deeply nested object beyond depth 10
    let deeplyNested: Record<string, unknown> = { leaf: 'normal' };
    for (let i = 0; i < 15; i++) {
      deeplyNested = { next: deeplyNested };
    }

    const detections = engine.scanPayload(deeplyNested, { maxDepth: 10 });
    expect(detections.some((d) => d.patternName === 'max_depth_exceeded')).toBe(true);
  });

  it('flags oversized payload size exceeding byte ceiling (Rule 9)', () => {
    const engine = createEgressDataPolicyEngine();
    const largeString = 'a'.repeat(2000);
    const detections = engine.scanPayload({ data: largeString }, { maxPayloadSizeBytes: 1000 });
    expect(detections.some((d) => d.patternName === 'payload_size_ceiling_exceeded')).toBe(true);
  });

  it('permits internal egress while blocking external exfiltration (Rule 32 & 33)', async () => {
    const engine = createEgressDataPolicyEngine();

    const sensitiveData = {
      accountNumber: 'GB82WEST12345698765432',
      notes: 'Customer confidential discussion',
      apiKey: 'sk-proj-abcdef1234567890abcdef1234567890',
    };

    // 1. Internal memory is allowed
    const internalResult = await engine.evaluateEgress(
      sensitiveData,
      'internal_memory',
      tenant
    );
    expect(internalResult.allowed).toBe(true);
    expect(internalResult.violations).toHaveLength(0);

    // 2. External webhook is blocked
    const externalWebhookResult = await engine.evaluateEgress(
      sensitiveData,
      'external_webhook',
      tenant
    );
    expect(externalWebhookResult.allowed).toBe(false);
    expect(externalWebhookResult.violations.length).toBeGreaterThan(0);
    expect(externalWebhookResult.reason).toContain(EGRESS_ERROR_CODES.DATA_EXFILTRATION_DETECTED);

    // 3. External MCP tool is blocked
    const externalMcpResult = await engine.evaluateEgress(
      sensitiveData,
      'external_mcp_tool',
      tenant
    );
    expect(externalMcpResult.allowed).toBe(false);

    const publicResult = await engine.evaluateEgress(
      { notes: 'internal meeting notes', apiKey: 'admin_key_12345' },
      'public_portal',
      tenant,
      { allowedSensitivityCeiling: 'public' }
    );
    expect(publicResult.allowed).toBe(false);
    // When clean public data is sent to public portal
    const cleanPublicResult = await engine.evaluateEgress(
      { title: 'Welcome to SmartSapp', version: '2.0.0' },
      'public_portal',
      tenant
    );
    expect(cleanPublicResult.allowed).toBe(true);
  });

  it('redacts sensitive content in redaction mode', async () => {
    const engine = createEgressDataPolicyEngine();

    const data = {
      user: 'charlie',
      secret: 'sk-proj-1234567890abcdef1234567890abcdef',
      ssn: '123-45-6789',
      message: 'My card is 4111111111111111 please bill it',
    };

    const result = await engine.evaluateEgress(data, 'external_email', tenant, {
      redactionMode: true,
    });

    const sanitized = result.sanitizedPayload as typeof data;
    expect(sanitized).toBeDefined();
    expect(sanitized.secret).toBe('[REDACTED_SECRET]');
    expect(sanitized.ssn).toBe('[REDACTED_PII]');
    expect(sanitized.message).toContain('[REDACTED_FINANCIAL]');
    expect(sanitized.user).toBe('charlie');
  });

  it('publishes audit domain event to EventBus on blocked egress (Rule 40)', async () => {
    const publishedEvents: DomainEvent[] = [];
    const bus = createEventBus();
    bus.subscribe('mcp.security.exfiltration_blocked', (event: DomainEvent) => {
      publishedEvents.push(event);
    });

    const engine = createEgressDataPolicyEngine({ eventBus: bus });
    const payload = { token: 'sk-ant-1234567890abcdef1234567890abcdef' };

    const result = await engine.evaluateEgress(payload, 'external_webhook', tenant);
    expect(result.allowed).toBe(false);
    expect(publishedEvents).toHaveLength(1);

    const event = publishedEvents[0];
    expect(event.type).toBe('mcp.security.exfiltration_blocked');
    expect(event.organizationId).toBe(tenant.organizationId);
    expect(event.workspaceId).toBe(tenant.workspaceId);
    expect(event.payload.destination).toBe('external_webhook');
    expect(event.payload.highestSensitivity).toBe('credential');
  });
});

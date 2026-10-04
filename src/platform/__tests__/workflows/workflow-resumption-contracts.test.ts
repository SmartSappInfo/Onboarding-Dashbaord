/**
 * @fileOverview Unit Tests for Workflow Resumption Contracts, HMAC Tokens & Schemas (Phase 7 Milestone 3)
 *
 * Enforces Rule 4 (Zero any/any[]), Rule 8 & 47 (Multi-tenant Anti-IDOR),
 * Rule 22 (Cryptographic Token Integrity), and Rule 46 (Adversarial Security).
 */

import { describe, it, expect } from 'vitest';
import {
  ResumptionTokenPayloadSchema,
  ResumptionSignalSchema,
  WaitConditionEvaluationResultSchema,
  StepResumptionResultSchema,
  generateResumptionToken,
  verifyResumptionToken,
  RESUMPTION_ERROR_CODES,
  WorkflowResumptionError,
  mapResumptionErrorToHttpStatus,
} from '../../workflows/resumption/workflow-resumption-types';

describe('Workflow Resumption Contracts & Cryptographic HMAC Engine', () => {
  const mockTenant = {
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_456',
  };

  const samplePayload = {
    workflowId: 'wf_test_001',
    stepId: 'step_wait_approval',
    organizationId: mockTenant.organizationId,
    workspaceId: mockTenant.workspaceId,
    conditionType: 'approval' as const,
    nonce: 'nonce_abc123',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    metadata: { reason: 'high_risk_deal' },
  };

  describe('1. Schema Validation (Rule 4 & Rule 6)', () => {
    it('validates a valid ResumptionTokenPayload', () => {
      const parsed = ResumptionTokenPayloadSchema.parse(samplePayload);
      expect(parsed.workflowId).toBe('wf_test_001');
      expect(parsed.conditionType).toBe('approval');
    });

    it('rejects invalid condition types', () => {
      const invalid = {
        ...samplePayload,
        conditionType: 'unknown_type',
      };
      expect(() => ResumptionTokenPayloadSchema.parse(invalid)).toThrow();
    });

    it('validates a valid ResumptionSignal', () => {
      const signal = {
        workflowId: 'wf_test_001',
        stepId: 'step_wait_approval',
        token: 'token_mock_123',
        tenant: mockTenant,
        signalData: { approved: true, note: 'Reviewed by VP' },
        verifiedBy: 'user_vp_99',
      };
      const parsed = ResumptionSignalSchema.parse(signal);
      expect(parsed.tenant.organizationId).toBe(mockTenant.organizationId);
      expect(parsed.source).toBe('external_signal');
    });

    it('validates WaitConditionEvaluationResult and StepResumptionResult', () => {
      const evalResult = WaitConditionEvaluationResultSchema.parse({
        shouldSuspend: true,
        conditionType: 'webhook',
        token: 'tok_xyz',
        callbackUrl: '/api/tasks/workflows/webhooks/tok_xyz',
      });
      expect(evalResult.shouldSuspend).toBe(true);

      const resumeResult = StepResumptionResultSchema.parse({
        workflowId: 'wf_test_001',
        stepId: 'step_01',
        status: 'RESUMED',
        durationMs: 42,
        taskKey: 'task_001',
      });
      expect(resumeResult.status).toBe('RESUMED');
    });
  });

  describe('2. Cryptographic HMAC Token Generation & Verification (Rule 22 & Rule 46)', () => {
    const secret = 'super-secret-test-key-32-chars-long!';

    it('generates and verifies a valid cryptographic token', () => {
      const token = generateResumptionToken(samplePayload, secret);
      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const result = verifyResumptionToken(token, secret);
      expect(result.valid).toBe(true);
      expect(result.payload?.workflowId).toBe(samplePayload.workflowId);
      expect(result.payload?.stepId).toBe(samplePayload.stepId);
      expect(result.payload?.organizationId).toBe(samplePayload.organizationId);
    });

    it('rejects a token verified with a wrong secret', () => {
      const token = generateResumptionToken(samplePayload, secret);
      const result = verifyResumptionToken(token, 'wrong-secret-key-1234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RESUMPTION_TOKEN_INVALID');
      expect(result.payload).toBeUndefined();
    });

    it('rejects tampered token payload (Rule 22 anti-tampering)', () => {
      const token = generateResumptionToken(samplePayload, secret);
      const [payloadB64, signature] = token.split('.');

      // Decode payload, modify workflowId, re-encode
      const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      decoded.workflowId = 'wf_tampered_malicious';
      const tamperedB64 = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');

      const tamperedToken = `${tamperedB64}.${signature}`;
      const result = verifyResumptionToken(tamperedToken, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RESUMPTION_TOKEN_INVALID');
    });

    it('rejects expired tokens (Rule 23 timeouts)', () => {
      const expiredPayload = {
        ...samplePayload,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1s ago
      };
      const token = generateResumptionToken(expiredPayload, secret);
      const result = verifyResumptionToken(token, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RESUMPTION_TOKEN_EXPIRED');
    });

    it('rejects malformed token strings without dot separator', () => {
      const result = verifyResumptionToken('malformed_token_without_dot', secret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RESUMPTION_TOKEN_INVALID');
    });

    it('rejects non-hex or mismatched length signature', () => {
      const token = generateResumptionToken(samplePayload, secret);
      const [payloadB64] = token.split('.');
      const result = verifyResumptionToken(`${payloadB64}.shortsig`, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RESUMPTION_TOKEN_INVALID');
    });
  });

  describe('3. Error Taxonomy & HTTP Status Mapping (Rule 48)', () => {
    it('contains all canonical resumption error codes', () => {
      expect(RESUMPTION_ERROR_CODES).toContain('RESUMPTION_TOKEN_INVALID');
      expect(RESUMPTION_ERROR_CODES).toContain('RESUMPTION_TOKEN_EXPIRED');
      expect(RESUMPTION_ERROR_CODES).toContain('RESUMPTION_TOKEN_ALREADY_CONSUMED');
      expect(RESUMPTION_ERROR_CODES).toContain('TENANT_MISMATCH');
      expect(RESUMPTION_ERROR_CODES).toContain('DEAD_MAN_PAUSED');
      expect(RESUMPTION_ERROR_CODES).toContain('PAYLOAD_TAMPERED');
      expect(RESUMPTION_ERROR_CODES).toContain('PROMPT_INJECTION_DETECTED');
    });

    it('instantiates WorkflowResumptionError correctly', () => {
      const err = new WorkflowResumptionError('DEAD_MAN_PAUSED', 'System paused', { orgId: 'org_1' });
      expect(err.name).toBe('WorkflowResumptionError');
      expect(err.code).toBe('DEAD_MAN_PAUSED');
      expect(err.message).toBe('System paused');
    });

    it('maps error codes to appropriate HTTP status codes', () => {
      expect(mapResumptionErrorToHttpStatus('RESUMPTION_TOKEN_INVALID')).toBe(401);
      expect(mapResumptionErrorToHttpStatus('UNAUTHORIZED_CALLER')).toBe(401);
      expect(mapResumptionErrorToHttpStatus('TENANT_MISMATCH')).toBe(403);
      expect(mapResumptionErrorToHttpStatus('WORKFLOW_NOT_WAITING')).toBe(400);
      expect(mapResumptionErrorToHttpStatus('STEP_NOT_WAITING')).toBe(400);
      expect(mapResumptionErrorToHttpStatus('WAIT_CONDITION_MISMATCH')).toBe(400);
      expect(mapResumptionErrorToHttpStatus('PROMPT_INJECTION_DETECTED')).toBe(400);
      expect(mapResumptionErrorToHttpStatus('PAYLOAD_TAMPERED')).toBe(400);
      expect(mapResumptionErrorToHttpStatus('RESUMPTION_TOKEN_ALREADY_CONSUMED')).toBe(409);
      expect(mapResumptionErrorToHttpStatus('RESUMPTION_TOKEN_EXPIRED')).toBe(410);
      expect(mapResumptionErrorToHttpStatus('TIMEOUT_EXPIRED')).toBe(410);
      expect(mapResumptionErrorToHttpStatus('DEAD_MAN_PAUSED')).toBe(503);
    });
  });
});

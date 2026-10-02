// @vitest-environment node
/**
 * @fileOverview Error Mappers & StateChanged Integrity Unit Tests (Phase 1 / PR-4)
 *
 * Implements Rule 7 (Plain UI English), Rule 23 (stateChanged Invariant), Rule 52 (Information Disclosure).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import {
  CapabilityError,
  isCapabilityError,
} from '../capabilities/errors/capability-error';
import {
  sanitizeErrorMessage,
  toCapabilityError,
  toHttpError,
  toMcpToolError,
  toServerActionResult,
  toUserFacingMessage,
} from '../capabilities/errors/error-mappers';

describe('CapabilityError & Error Mappers', () => {
  it('instantiates CapabilityError with explicit stateChanged invariant', () => {
    const error = new CapabilityError({
      code: 'FORBIDDEN',
      message: 'Access denied: missing permission.',
      stateChanged: 'no',
      httpStatus: 403,
    });

    expect(isCapabilityError(error)).toBe(true);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.stateChanged).toBe('no');
    expect(error.httpStatus).toBe(403);
    expect(error.retryable).toBe(false);
  });

  it('enforces stateChanged = "unknown" for timeout errors', () => {
    const timeoutErr = CapabilityError.timeout(5000);
    expect(timeoutErr.code).toBe('TIMEOUT');
    expect(timeoutErr.stateChanged).toBe('unknown');
    expect(timeoutErr.httpStatus).toBe(503);
    expect(timeoutErr.retryable).toBe(true);
  });

  it('converts ZodError to VALIDATION error with stateChanged = "no"', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const parsed = schema.safeParse({ name: 123 });
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const capError = toCapabilityError(parsed.error);
      expect(capError.code).toBe('VALIDATION');
      expect(capError.stateChanged).toBe('no');
      expect(capError.httpStatus).toBe(400);
      expect(capError.message).toContain('Invalid data:');
    }
  });

  describe('sanitizeErrorMessage (Rule 52)', () => {
    it('strips absolute filesystem paths from error messages', () => {
      const raw = 'Failed at /Users/developer/Codes/Onboarding-Dashboard/src/db.ts:42';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('/Users/developer');
      expect(sanitized).toContain('[internal path]');
    });

    it('redacts Bearer tokens and passwords', () => {
      const raw = 'Auth error with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and password=secret123';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('Bearer [REDACTED]');
      expect(sanitized).toContain('password=[REDACTED]');
    });

    it('transforms internal technical codes into friendly user messages', () => {
      const err = CapabilityError.forbidden('Missing permission');
      const userMessage = toUserFacingMessage(err);
      expect(userMessage).toBe('You do not have permission to perform this action.');
    });
  });

  describe('toServerActionResult (Rule 7, Rule 52, UI §53)', () => {
    it('returns user-safe plain English message and preserves stateChanged', () => {
      const internalErr = CapabilityError.forbidden('User lacks rbac:operations.pipeline.create');
      const actionResult = toServerActionResult(internalErr);

      expect(actionResult.success).toBe(false);
      expect(actionResult.code).toBe('FORBIDDEN');
      expect(actionResult.stateChanged).toBe('no');
      expect(actionResult.error).toBe('You do not have permission to perform this action.');
      expect(actionResult.error).not.toContain('rbac:operations');
    });

    it('reflects stateChanged = "unknown" for timeout during action', () => {
      const timeoutErr = CapabilityError.timeout(2000);
      const actionResult = toServerActionResult(timeoutErr);

      expect(actionResult.success).toBe(false);
      expect(actionResult.code).toBe('TIMEOUT');
      expect(actionResult.stateChanged).toBe('unknown');
      expect(actionResult.retryable).toBe(true);
      expect(actionResult.error).toContain('timed out');
    });
  });

  describe('toMcpToolError (Rule 11)', () => {
    it('formats error for MCP SDK v2 text result with isError: true', () => {
      const capError = CapabilityError.unauthenticated('Token expired');
      const mcpResult = toMcpToolError(capError);

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content[0].type).toBe('text');
      expect(mcpResult.content[0].text).toContain('Access denied: Token expired');
    });

    it('prefixes error code for domain errors', () => {
      const capError = new CapabilityError({
        code: 'VERSION_CONFLICT',
        message: 'Conflict on deal version 3',
        stateChanged: 'no',
      });
      const mcpResult = toMcpToolError(capError);

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content[0].text).toBe('Error [VERSION_CONFLICT]: Conflict on deal version 3');
    });
  });

  describe('toHttpError (Rule 51, Rule 69)', () => {
    it('maps CapabilityError to standard HTTP envelope', () => {
      const capError = CapabilityError.tenantScope('Foreign workspace');
      const httpResult = toHttpError(capError);

      expect(httpResult.status).toBe(400);
      expect(httpResult.body.code).toBe('TENANT_SCOPE');
      expect(httpResult.body.stateChanged).toBe('no');
      expect(httpResult.body.success).toBe(false);
    });

    it('maps unexpected exception to 500 with stateChanged = "unknown"', () => {
      const genericError = new Error('Unexpected crash');
      const httpResult = toHttpError(genericError, 'unknown');

      expect(httpResult.status).toBe(500);
      expect(httpResult.body.code).toBe('HANDLER_EXCEPTION');
      expect(httpResult.body.stateChanged).toBe('unknown');
    });
  });
});

/**
 * @fileOverview Unit Tests for Enterprise Identity & Federation Services
 */

import { describe, it, expect } from 'vitest';
import { MfaPolicyService } from '../mfa-policy-service';
import { EnterpriseSessionService } from '../enterprise-session-service';

describe('MfaPolicyService Defaults', () => {
  it('returns default permissive policy when not yet configured', async () => {
    const policy = await MfaPolicyService.getMfaPolicy('org-unconfigured');
    expect(policy.enforceMfa).toBe(false);
    expect(policy.gracePeriodDays).toBe(7);
    expect(policy.allowedFactors).toContain('passkey');
  });
});

describe('EnterpriseSessionService Defaults', () => {
  it('returns valid default session lifetime configuration', async () => {
    const session = await EnterpriseSessionService.getSessionConfig('org-unconfigured');
    expect(session.idleTimeoutMinutes).toBe(30);
    expect(session.maxSessionDurationHours).toBe(12);
    expect(session.forceReauthOnSensitiveActions).toBe(true);
  });
});

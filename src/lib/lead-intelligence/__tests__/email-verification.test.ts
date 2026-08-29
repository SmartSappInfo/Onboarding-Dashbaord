import { describe, it, expect } from 'vitest';
import { EmailSyntaxSanitizer } from '../verification/EmailSyntaxSanitizer';
import { DisposableEmailDetector } from '../verification/DisposableEmailDetector';
import { DNSMXResolverService } from '../verification/DNSMXResolverService';
import { DeliverabilityScoreEngine } from '../verification/DeliverabilityScoreEngine';

describe('EmailSyntaxSanitizer', () => {
  it('validates standard email addresses according to RFC-5322', () => {
    const res = EmailSyntaxSanitizer.sanitize('  Kwame.Mensah@Ridge.Edu.GH  ');
    expect(res.isValid).toBe(true);
    expect(res.cleanEmail).toBe('kwame.mensah@ridge.edu.gh');
    expect(res.domain).toBe('ridge.edu.gh');
    expect(res.localPart).toBe('kwame.mensah');
    expect(res.isRoleBased).toBe(false);
  });

  it('identifies role-based institutional mailboxes', () => {
    const roles = ['principal@school.edu.gh', 'bursar@school.edu.gh', 'info@school.edu.gh', 'admissions@school.edu.gh'];
    for (const email of roles) {
      const res = EmailSyntaxSanitizer.sanitize(email);
      expect(res.isValid).toBe(true);
      expect(res.isRoleBased).toBe(true);
    }
  });

  it('rejects malformed email strings', () => {
    expect(EmailSyntaxSanitizer.sanitize('').isValid).toBe(false);
    expect(EmailSyntaxSanitizer.sanitize('invalid-email').isValid).toBe(false);
    expect(EmailSyntaxSanitizer.sanitize('user@domain@another.com').isValid).toBe(false);
    expect(EmailSyntaxSanitizer.sanitize('user@nodot').isValid).toBe(false);
  });
});

describe('DisposableEmailDetector', () => {
  it('detects known disposable and temporary email domains', () => {
    expect(DisposableEmailDetector.isDisposable('mailinator.com')).toBe(true);
    expect(DisposableEmailDetector.isDisposable('tempmail.com')).toBe(true);
    expect(DisposableEmailDetector.isDisposable('10minutemail.com')).toBe(true);
    expect(DisposableEmailDetector.isDisposable('yopmail.com')).toBe(true);
  });

  it('passes genuine corporate and institutional domains', () => {
    expect(DisposableEmailDetector.isDisposable('smartsapp.com')).toBe(false);
    expect(DisposableEmailDetector.isDisposable('ridgeinternationalschool.edu.gh')).toBe(false);
    expect(DisposableEmailDetector.isDisposable('gmail.com')).toBe(false);
  });
});

describe('DeliverabilityScoreEngine', () => {
  it('returns invalid status for malformed email syntax', async () => {
    const res = await DeliverabilityScoreEngine.verifyEmail('not-an-email');
    expect(res.status).toBe('invalid');
    expect(res.deliverabilityScore).toBe(0);
    expect(res.stages.find(s => s.stage === 'syntax')?.passed).toBe(false);
  });

  it('returns invalid status and low score for disposable domains', async () => {
    const res = await DeliverabilityScoreEngine.verifyEmail('throwaway123@mailinator.com');
    expect(res.status).toBe('invalid');
    expect(res.isDisposable).toBe(true);
    expect(res.deliverabilityScore).toBeLessThanOrEqual(20);
    expect(res.stages.find(s => s.stage === 'disposable')?.passed).toBe(false);
  });
});

describe('DNSMXResolverService', () => {
  it('handles empty domains safely', async () => {
    const res = await DNSMXResolverService.resolveMX('');
    expect(res.hasMx).toBe(false);
    expect(res.provider).toBe('unknown');
  });

  it('handles non-existent domains gracefully without throwing', async () => {
    const res = await DNSMXResolverService.resolveMX('non-existent-domain-12345-xyz.org');
    expect(res.hasMx).toBe(false);
    expect(res.provider).toBe('unknown');
  });
});

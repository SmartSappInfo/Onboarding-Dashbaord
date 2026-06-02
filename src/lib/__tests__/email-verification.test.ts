import { describe, it, expect, vi } from 'vitest';
import { 
  EmailVerificationEngine, 
  SyntaxValidator, 
  BurnerValidator,
  DnsValidator,
  SmtpValidator
} from '../email-verifier';

describe('EmailVerificationEngine', () => {
  describe('Syntax Validation', () => {
    it('rejects invalid email formats immediately', async () => {
      const engine = new EmailVerificationEngine([new SyntaxValidator()]);
      const result = await engine.verify('invalid-email@@domain');
      
      expect(result.valid).toBe(false);
      expect(result.checks.syntax).toBe(false);
      expect(result.score).toBeLessThan(20);
    });

    it('passes valid email formats', async () => {
      const engine = new EmailVerificationEngine([new SyntaxValidator()]);
      const result = await engine.verify('john.doe@gmail.com');
      
      expect(result.checks.syntax).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('rejects placeholder/dummy usernames', async () => {
      const engine = new EmailVerificationEngine([new SyntaxValidator()]);
      
      const resNone = await engine.verify('none@gmail.com');
      expect(resNone.valid).toBe(false);
      expect(resNone.checks.syntax).toBe(false);

      const resTest = await engine.verify('test@outlook.com');
      expect(resTest.valid).toBe(false);
      expect(resTest.checks.syntax).toBe(false);
    });

    it('rejects placeholder/dummy domains', async () => {
      const engine = new EmailVerificationEngine([new SyntaxValidator()]);
      
      const resExample = await engine.verify('user@example.com');
      expect(resExample.valid).toBe(false);
      expect(resExample.checks.syntax).toBe(false);

      const resTestDom = await engine.verify('user@test.com');
      expect(resTestDom.valid).toBe(false);
      expect(resTestDom.checks.syntax).toBe(false);
    });
  });

  describe('Burner Domain Filter', () => {
    it('flags known disposable domains and decreases score', async () => {
      const MockDns = { name: 'DNS', execute: async () => ({ passed: true, scoreWeight: 25 }) };
      const MockSmtp = { name: 'SMTP', execute: async () => ({ passed: true, scoreWeight: 40 }) };

      const engine = new EmailVerificationEngine([
        new SyntaxValidator(),
        new BurnerValidator(),
        MockDns as any,
        MockSmtp as any
      ]);
      const result = await engine.verify('testuser@mailinator.com');
      
      expect(result.checks.disposable).toBe(true);
      // Disposable should penalize the score significantly
      expect(result.score).toBeLessThan(70);
      expect(result.status).toBe('risky');
    });

    it('passes standard corporate domains', async () => {
      const engine = new EmailVerificationEngine([
        new SyntaxValidator(),
        new BurnerValidator()
      ]);
      const result = await engine.verify('ceo@smartsapp.com');
      
      expect(result.checks.disposable).toBe(false);
    });
  });

  describe('Network Mock Validations (DNS & SMTP)', () => {
    it('yields high score and verified status when DNS and SMTP pass', async () => {
      // Create mock strategies that perfectly simulate successful network calls
      const MockDns = {
        name: 'DNS',
        execute: async () => ({ passed: true, scoreWeight: 25 })
      };
      const MockSmtp = {
        name: 'SMTP',
        execute: async () => ({ passed: true, scoreWeight: 40 })
      };
      
      const engine = new EmailVerificationEngine([
        new SyntaxValidator(),
        new BurnerValidator(),
        MockDns as any,
        MockSmtp as any
      ]);
      
      const result = await engine.verify('valid@gmail.com');
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.status).toBe('verified');
      expect(result.checks.dns).toBe(true);
      expect(result.checks.smtp).toBe(true);
    });

    it('detects catch-all configurations and downgrades the SMTP weight', async () => {
      // Mock SMTP strategy simulating a catch-all server
      const CatchAllSmtp = {
        name: 'SMTP',
        execute: async () => ({ 
          passed: true, 
          scoreWeight: 15, // Degraded weight
          details: { catchAll: true } 
        })
      };
      
      const engine = new EmailVerificationEngine([
        new SyntaxValidator(),
        new BurnerValidator(),
        CatchAllSmtp as any
      ]);
      
      const result = await engine.verify('anything@catchalldomain.com');
      
      // Should not be 'verified' because of catch-all risk
      expect(result.status).not.toBe('verified');
      expect(result.checks.catchAll).toBe(true);
    });
  });
});

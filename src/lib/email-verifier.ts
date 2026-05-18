import * as z from 'zod';

export interface VerificationContext {
  email: string;
  domain: string;
  username: string;
}

export interface CheckResult {
  passed: boolean;
  scoreWeight: number;
  details?: Record<string, any>;
  error?: string;
}

export interface IVerificationStrategy {
  name: string;
  execute(context: VerificationContext, state: Record<string, any>): Promise<CheckResult>;
}

// Global set of common burner domains for O(1) lookup
const BURNER_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'yopmail.com',
  'throwawaymail.com',
]);

export class SyntaxValidator implements IVerificationStrategy {
  name = 'Syntax';

  async execute(context: VerificationContext): Promise<CheckResult> {
    const emailSchema = z.string().email();
    const result = emailSchema.safeParse(context.email);

    if (result.success) {
      return { passed: true, scoreWeight: 15 };
    }
    return { passed: false, scoreWeight: 0, error: 'Invalid RFC syntax' };
  }
}

export class BurnerValidator implements IVerificationStrategy {
  name = 'Disposable';

  async execute(context: VerificationContext): Promise<CheckResult> {
    const isBurner = BURNER_DOMAINS.has(context.domain.toLowerCase());

    if (isBurner) {
      // Disposable significantly hurts trust
      return { passed: false, scoreWeight: -35, details: { isDisposable: true } };
    }
    // Not a disposable yields a slight trust boost
    return { passed: true, scoreWeight: 20, details: { isDisposable: false } };
  }
}

export class DnsValidator implements IVerificationStrategy {
  name = 'DNS';
  
  async execute(context: VerificationContext): Promise<CheckResult> {
    // We will implement DNS lookup logic using 'dns.promises'
    // Currently acting as placeholder for future network tests
    return { passed: true, scoreWeight: 25 };
  }
}

export class SmtpValidator implements IVerificationStrategy {
  name = 'SMTP';

  async execute(context: VerificationContext): Promise<CheckResult> {
    // Placeholder for SMTP Socket Handshake
    return { passed: true, scoreWeight: 40 };
  }
}

export interface VerifyEmailResult {
  valid: boolean;
  score: number;
  status: 'verified' | 'likely_valid' | 'risky' | 'invalid';
  checks: {
    syntax: boolean;
    dns: boolean;
    smtp: boolean;
    disposable: boolean;
    roleAccount: boolean;
    catchAll: boolean;
  };
  details: Record<string, any>;
}

export class EmailVerificationEngine {
  constructor(private strategies: IVerificationStrategy[] = []) {}

  async verify(email: string): Promise<VerifyEmailResult> {
    const parts = email.split('@');
    const username = parts[0] || '';
    const domain = parts[1] || '';

    const context: VerificationContext = { email, domain, username };
    const state: Record<string, any> = {};

    let totalScore = 0;
    const checks = {
      syntax: false,
      dns: false,
      smtp: false,
      disposable: false,
      roleAccount: false,
      catchAll: false,
    };
    const details: Record<string, any> = {};

    for (const strategy of this.strategies) {
      try {
        const result = await strategy.execute(context, state);
        totalScore += result.scoreWeight;

        if (strategy.name === 'Syntax') {
          checks.syntax = result.passed;
          if (!result.passed) {
            // Short-circuit on terrible syntax
            break;
          }
        }
        
        if (strategy.name === 'Disposable') {
          // If the test FAILS (meaning it IS a burner), checks.disposable is true
          checks.disposable = !result.passed;
        }

        if (strategy.name === 'DNS') {
          checks.dns = result.passed;
        }

        if (strategy.name === 'SMTP') {
          checks.smtp = result.passed;
          if (result.details?.catchAll) {
            checks.catchAll = true;
          }
        }

        if (result.details) {
          Object.assign(details, { [strategy.name.toLowerCase()]: result.details });
        }

      } catch (err) {
        console.error(`Verification strategy ${strategy.name} failed`, err);
      }
    }

    // Determine status tier
    let status: VerifyEmailResult['status'] = 'invalid';
    
    // Safety check: if Syntax fails, it's always invalid regardless of totalScore
    if (!checks.syntax) {
      totalScore = Math.min(totalScore, 10);
      status = 'invalid';
    } else if (totalScore >= 90 && !checks.catchAll && !checks.disposable) {
      status = 'verified';
    } else if (totalScore >= 70) {
      status = 'likely_valid';
    } else if (totalScore >= 40) {
      status = 'risky';
    } else {
      status = 'invalid';
    }

    return {
      valid: status === 'verified' || status === 'likely_valid',
      score: totalScore,
      status,
      checks,
      details,
    };
  }
}

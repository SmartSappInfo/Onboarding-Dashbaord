import * as z from 'zod';
import * as dns from 'dns';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

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

// ---------------------------------------------------------------------------
// Disposable domain blocklist — loaded once at module initialisation
// Source: rules/disposable_email_blocklist.conf  (5 000+ entries, one per line)
// Falls back to a small hardcoded set when the file is unavailable (e.g. tests)
// ---------------------------------------------------------------------------
function loadBurnerDomains(): Set<string> {
  const FALLBACK = new Set([
    'mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com',
    'yopmail.com', 'throwawaymail.com', 'trashmail.com', 'maildrop.cc',
    'discard.email', 'temp-mail.org', 'getnada.com', 'spam4.me',
  ]);

  try {
    // Works from both Next.js API routes (server) and direct Node execution.
    // __dirname resolves to .next/server/... at runtime, so we anchor from cwd.
    const candidates = [
      path.resolve(process.cwd(), 'disposable_email_blocklist.conf'),
      path.resolve(__dirname, '../../../../disposable_email_blocklist.conf'),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const lines = fs.readFileSync(filePath, 'utf-8')
          .split('\n')
          .map(l => l.trim().toLowerCase())
          .filter(l => l.length > 0 && !l.startsWith('#'));
        console.log(`[EmailVerifier] Loaded ${lines.length} burner domains from ${filePath}`);
        return new Set(lines);
      }
    }

    console.warn('[EmailVerifier] disposable_email_blocklist.conf not found — using fallback list.');
    return FALLBACK;
  } catch (err) {
    console.warn('[EmailVerifier] Failed to load blocklist, using fallback:', err);
    return FALLBACK;
  }
}

const BURNER_DOMAINS = loadBurnerDomains();


// --- Strategy 1: Syntax ---
export class SyntaxValidator implements IVerificationStrategy {
  name = 'Syntax';

  async execute(context: VerificationContext): Promise<CheckResult> {
    const result = z.string().email().safeParse(context.email);
    if (result.success) {
      return { passed: true, scoreWeight: 15 };
    }
    return { passed: false, scoreWeight: 0, error: 'Invalid RFC syntax' };
  }
}

// --- Strategy 2: Disposable Domain Filter ---
export class BurnerValidator implements IVerificationStrategy {
  name = 'Disposable';

  async execute(context: VerificationContext): Promise<CheckResult> {
    const isBurner = BURNER_DOMAINS.has(context.domain.toLowerCase());
    if (isBurner) {
      return { passed: false, scoreWeight: -35, details: { isDisposable: true } };
    }
    return { passed: true, scoreWeight: 20, details: { isDisposable: false } };
  }
}

// --- Strategy 3: Real DNS MX Lookup ---
export class DnsValidator implements IVerificationStrategy {
  name = 'DNS';

  async execute(context: VerificationContext, state: Record<string, any>): Promise<CheckResult> {
    try {
      const mxRecords = await dns.promises.resolveMx(context.domain);
      if (mxRecords && mxRecords.length > 0) {
        const sorted = [...mxRecords].sort((a, b) => a.priority - b.priority);
        // Pass the primary MX host to the SMTP strategy via shared state
        state.primaryMx = sorted[0].exchange;
        return {
          passed: true,
          scoreWeight: 25,
          details: {
            mxHosts: sorted.map(r => `${r.exchange} (priority ${r.priority})`),
            primaryMx: sorted[0].exchange,
          },
        };
      }
      return { passed: false, scoreWeight: 0, error: 'No MX records found for domain' };
    } catch (e: any) {
      const reason =
        e.code === 'ENOTFOUND' ? 'Domain does not exist' :
        e.code === 'ENODATA' || e.code === 'ESERVFAIL' ? 'No MX records configured' :
        `DNS lookup failed: ${e.message}`;
      return { passed: false, scoreWeight: 0, error: reason };
    }
  }
}

// --- Strategy 4: Real SMTP Ping / Catch-all Probe ---
export class SmtpValidator implements IVerificationStrategy {
  name = 'SMTP';

  private pingSmtp(
    mxHost: string,
    targetEmail: string,
    domain: string,
  ): Promise<{
    delivered: boolean;
    catchAll: boolean;
    logs: string[];
    timedOut?: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const logs: string[] = [];
      const socket = new net.Socket();
      // 0=init, 1=banner, 2=ehlo, 3=mail-from, 4=rcpt-target, 5=rcpt-probe, 99=done
      let step = 0;
      let buffer = '';
      let delivered = false;
      let catchAll = false;

      // Probe address: random mailbox on same domain to detect catch-all
      const probeUser = `nv_${Math.random().toString(36).slice(2, 10)}`;
      const probeEmail = `${probeUser}@${domain}`;

      let settled = false;
      const finish = (result: { delivered: boolean; catchAll: boolean; logs: string[]; timedOut?: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!socket.destroyed) socket.destroy();
        resolve(result);
      };

      const timer = setTimeout(() => {
        logs.push('[SMTP] Timed out after 10s');
        finish({ delivered: false, catchAll: false, logs, timedOut: true });
      }, 10000);

      const send = (raw: string, display?: string) => {
        logs.push(`[SMTP] -> ${(display ?? raw).trim()}`);
        if (!socket.destroyed) socket.write(raw);
      };

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const code = parseInt(line.slice(0, 3), 10);
        const isMulti = line[3] === '-'; // multi-line continuation
        logs.push(`[SMTP] <- ${line}`);

        if (isNaN(code) || isMulti) return; // skip continuations for FSM

        switch (step) {
          case 1: // waiting for 220 banner
            if (code === 220) {
              step = 2;
              send('EHLO verify.smartsapp.com\r\n', 'EHLO verify.smartsapp.com');
            } else {
              finish({ delivered: false, catchAll: false, logs, error: `Bad banner: ${code}` });
            }
            break;

          case 2: // EHLO response
            if (code === 250) {
              step = 3;
              send('MAIL FROM:<noreply@smartsapp.com>\r\n', 'MAIL FROM:<noreply@smartsapp.com>');
            } else {
              finish({ delivered: false, catchAll: false, logs, error: `EHLO rejected: ${code}` });
            }
            break;

          case 3: // MAIL FROM response
            if (code === 250) {
              step = 4;
              send(`RCPT TO:<${targetEmail}>\r\n`, `RCPT TO:<${targetEmail}>`);
            } else {
              finish({ delivered: false, catchAll: false, logs, error: `MAIL FROM rejected: ${code}` });
            }
            break;

          case 4: // RCPT TO (target mailbox) response
            if (code === 250) {
              // Accepted — now probe catch-all
              step = 5;
              send(`RCPT TO:<${probeEmail}>\r\n`, `RCPT TO:<${probeEmail}> (catch-all probe)`);
            } else {
              // 5xx = mailbox doesn't exist → INVALID
              step = 99;
              send('QUIT\r\n', 'QUIT');
              finish({ delivered: false, catchAll: false, logs });
            }
            break;

          case 5: // catch-all probe response
            if (code === 250) {
              catchAll = true;   // accepts anything → RISKY
              delivered = false;
            } else {
              delivered = true;  // rejects fake address → confirmed mailbox → VALID
              catchAll = false;
            }
            step = 99;
            send('QUIT\r\n', 'QUIT');
            break;

          case 99: // QUIT ack
            finish({ delivered, catchAll, logs });
            break;
        }
      };

      socket.connect(25, mxHost, () => {
        logs.push(`[SMTP] TCP connected to ${mxHost}:25`);
        step = 1; // ready for banner
      });

      socket.on('data', (data) => {
        buffer += data.toString();
        let idx: number;
        while ((idx = buffer.indexOf('\r\n')) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          handleLine(line);
        }
      });

      socket.on('timeout', () => {
        logs.push('[SMTP] Socket timeout');
        finish({ delivered: false, catchAll: false, logs, timedOut: true });
      });

      socket.on('error', (err) => {
        logs.push(`[SMTP] Error: ${err.message}`);
        finish({ delivered: false, catchAll: false, logs, error: err.message });
      });

      socket.setTimeout(10000);
    });
  }

  async execute(context: VerificationContext, state: Record<string, any>): Promise<CheckResult> {
    const mxHost = state.primaryMx as string | undefined;
    if (!mxHost) {
      return { passed: false, scoreWeight: 0, error: 'No MX host — DNS must pass first' };
    }

    // In production serverless environments (like Cloud Run or Vercel), outbound port 25 is blocked by default.
    // To prevent API timeouts and extremely slow response times, skip SMTP ping and return inconclusive/uncertain.
    const isProductionServerless = 
      process.env.NODE_ENV === 'production' || 
      process.env.K_SERVICE !== undefined || // Cloud Run (used by Firebase App Hosting under the hood)
      process.env.FIREBASE_CONFIG !== undefined || 
      process.env.VERCEL !== undefined;

    if (isProductionServerless) {
      return {
        passed: true,
        scoreWeight: 15,
        details: { 
          error: 'SMTP verification bypassed due to outbound port 25 block in serverless environment.', 
          uncertain: true 
        },
      };
    }

    const result = await this.pingSmtp(mxHost, context.email, context.domain);

    if (result.timedOut || result.error) {
      // Inconclusive — partial credit, surface uncertainty
      return {
        passed: true,
        scoreWeight: 15,
        details: { ...result, uncertain: true },
      };
    }

    if (result.delivered) {
      // Confirmed specific mailbox → VALID
      return { passed: true, scoreWeight: 40, details: result };
    }

    if (result.catchAll) {
      // Domain accepts everything → RISKY  (+5 keeps total at ~65 = risky tier)
      return { passed: true, scoreWeight: 5, details: { ...result, catchAll: true } };
    }

    // Explicitly rejected by server → INVALID  (-50 pushes total below 40)
    return { passed: false, scoreWeight: -50, details: result };
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
          if (!result.passed) break; // Short-circuit on bad syntax
        }
        if (strategy.name === 'Disposable') {
          checks.disposable = !result.passed; // true = IS disposable
        }
        if (strategy.name === 'DNS') {
          checks.dns = result.passed;
          if (!result.passed) break; // No MX = skip SMTP
        }
        if (strategy.name === 'SMTP') {
          checks.smtp = result.passed;
          if (result.details?.catchAll) checks.catchAll = true;
        }

        if (result.details) {
          details[strategy.name.toLowerCase()] = result.details;
        }
      } catch (err) {
        console.error(`[EmailVerifier] Strategy "${strategy.name}" threw:`, err);
      }
    }

    // Clamp score to [0, 100]
    totalScore = Math.max(0, Math.min(100, totalScore));

    // Status tier
    let status: VerifyEmailResult['status'];
    if (!checks.syntax) {
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

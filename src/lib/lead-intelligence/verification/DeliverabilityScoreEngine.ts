/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 5):
 * 
 * DeliverabilityScoreEngine orchestrates the 5-stage email verification pipeline:
 * 1. Syntax Validation & Role-Based Detection (EmailSyntaxSanitizer)
 * 2. Disposable Domain Filter (DisposableEmailDetector)
 * 3. DNS MX Record Resolution & Mail Host Fingerprinting (DNSMXResolverService)
 * 4. Zero-Body SMTP Socket Handshake (SMTPHandshakeProberService)
 * 5. Deterministic Score Calculation & Status Mapping
 * 
 * Invariants & Safeguards:
 * 1. Deterministic Math: Scores are bounded [0, 100] and rounded to whole numbers.
 * 2. Catch-All Penalty: Limits catch-all domains to 'risky' with a 65% ceiling.
 * 3. Strict Zero-`any` typing.
 */

import { EmailSyntaxSanitizer } from './EmailSyntaxSanitizer';
import { DisposableEmailDetector } from './DisposableEmailDetector';
import { DNSMXResolverService } from './DNSMXResolverService';
import { SMTPHandshakeProberService } from './SMTPHandshakeProberService';
import type { 
  EmailDeliverabilityResult, 
  EmailVerificationStatus, 
  VerificationStageResult 
} from '../types';

export class DeliverabilityScoreEngine {
  /**
   * Runs the complete 5-stage verification pipeline on an email address.
   */
  public static async verifyEmail(rawEmail: string): Promise<EmailDeliverabilityResult> {
    const verifiedAt = new Date().toISOString();
    const stages: VerificationStageResult[] = [];

    // Stage 1: Syntax Sanitization
    const syntax = EmailSyntaxSanitizer.sanitize(rawEmail);
    stages.push({
      stage: 'syntax',
      passed: syntax.isValid,
      details: syntax.isValid 
        ? (syntax.isRoleBased ? `Valid RFC-5322 syntax (Role-based: ${syntax.roleType})` : 'Valid RFC-5322 syntax')
        : (syntax.error || 'Syntax invalid')
    });

    if (!syntax.isValid) {
      return {
        email: rawEmail,
        status: 'invalid',
        deliverabilityScore: 0,
        isRoleBased: false,
        isDisposable: false,
        hasMxRecord: false,
        mxProvider: 'unknown',
        isCatchAll: false,
        stages,
        verifiedAt,
        recommendation: 'Do not send. Address syntax is invalid.'
      };
    }

    const cleanEmail = syntax.cleanEmail;
    const domain = syntax.domain;

    // Stage 2: Disposable Check
    const isDisposable = DisposableEmailDetector.isDisposable(domain);
    stages.push({
      stage: 'disposable',
      passed: !isDisposable,
      details: isDisposable ? 'Disposable temporary domain detected' : 'Clean corporate/institutional domain'
    });

    if (isDisposable) {
      return {
        email: cleanEmail,
        status: 'invalid',
        deliverabilityScore: 10,
        isRoleBased: syntax.isRoleBased,
        isDisposable: true,
        hasMxRecord: false,
        mxProvider: 'unknown',
        isCatchAll: false,
        stages,
        verifiedAt,
        recommendation: 'Do not send. Disposable throwaway domain.'
      };
    }

    // Stage 3: DNS MX Record Resolution
    const mxResult = await DNSMXResolverService.resolveMX(domain);
    stages.push({
      stage: 'dns_mx',
      passed: mxResult.hasMx,
      details: mxResult.hasMx 
        ? `MX resolved to ${mxResult.primaryHost} (${mxResult.provider})` 
        : (mxResult.error || 'No active mail exchangers found'),
      latencyMs: mxResult.latencyMs
    });

    if (!mxResult.hasMx || !mxResult.primaryHost) {
      return {
        email: cleanEmail,
        status: 'invalid',
        deliverabilityScore: 20,
        isRoleBased: syntax.isRoleBased,
        isDisposable: false,
        hasMxRecord: false,
        mxProvider: 'unknown',
        isCatchAll: false,
        stages,
        verifiedAt,
        recommendation: 'Do not send. Domain has no mail server configured.'
      };
    }

    // Stage 4: SMTP Handshake Probe
    const smtpResult = await SMTPHandshakeProberService.probeMailbox(
      cleanEmail,
      mxResult.primaryHost,
      domain
    );

    stages.push({
      stage: 'smtp_handshake',
      passed: smtpResult.handshakePassed,
      details: smtpResult.handshakePassed 
        ? `Server returned 250 OK (${smtpResult.statusCode || 250})`
        : (smtpResult.error || `SMTP rejected with code ${smtpResult.statusCode || 550}`),
      latencyMs: smtpResult.latencyMs
    });

    stages.push({
      stage: 'catch_all',
      passed: !smtpResult.isCatchAll,
      details: smtpResult.isCatchAll 
        ? 'Mail server is configured as Catch-All (accepts any mailbox name)' 
        : 'Specific mailbox verified'
    });

    // Stage 5: Score Calculation
    let score = 0;
    if (syntax.isValid) score += 25;
    if (!isDisposable) score += 20;
    if (mxResult.hasMx) score += 25;
    if (smtpResult.handshakePassed) score += 30;
    if (syntax.isRoleBased) score -= 10;

    let status: EmailVerificationStatus = 'verified';
    let recommendation = 'Safe to send. Mailbox exists and accepts incoming messages.';

    if (smtpResult.isCatchAll) {
      score = Math.min(65, score);
      status = 'risky';
      recommendation = 'Catch-all domain. Mail server accepts all emails; delivery cannot be guaranteed 100%.';
    } else if (!smtpResult.handshakePassed) {
      // If socket failed due to port 25 block/timeout, don't mark as hard invalid if MX is corporate
      if (smtpResult.error?.includes('timed out') || smtpResult.error?.includes('Socket error')) {
        score = 60;
        status = 'risky';
        recommendation = 'Mail server connection was restricted (port 25 protected). MX records are valid.';
      } else {
        score = Math.min(30, score);
        status = 'invalid';
        recommendation = 'Mailbox does not exist on this server (bounced). Do not send.';
      }
    } else if (score < 80) {
      status = 'risky';
      recommendation = 'Risky deliverability. Send with caution.';
    }

    return {
      email: cleanEmail,
      status,
      deliverabilityScore: Math.max(0, Math.min(100, Math.round(score))),
      isRoleBased: syntax.isRoleBased,
      isDisposable: false,
      hasMxRecord: true,
      primaryMxHost: mxResult.primaryHost,
      mxProvider: mxResult.provider,
      smtpHandshakeCode: smtpResult.statusCode,
      isCatchAll: smtpResult.isCatchAll,
      stages,
      verifiedAt,
      recommendation
    };
  }
}

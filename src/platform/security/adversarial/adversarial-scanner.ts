/**
 * @fileOverview Unified 10-Vector Adversarial Scanner (Phase 15 Milestone 3)
 *
 * Implements Rules 1, 4, 13, 30, 32, 33, 46, 67, 68, 69.
 * Evaluates untrusted text across all 10 ingress vectors using linear non-backtracking
 * regex patterns, isolates malicious text in `<untrusted_reference_data>` XML containers,
 * and masks credentials in flight.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  AdversarialIngressVector,
  AdversarialScanResult,
  NeutralizationStrategy,
} from '@/platform/security/contracts/security-types';

/**
 * Linear non-backtracking regex patterns for detecting adversarial directives (Rule 30).
 * Prevents ReDoS while catching prompt injection, jailbreaks, and privilege escalation.
 */
export const ADVERSARIAL_DIRECTIVE_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'ignore_instructions', pattern: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i },
  { name: 'system_override', pattern: /system\s+override/i },
  { name: 'unrestricted_persona', pattern: /you\s+are\s+now\s+an?\s+unrestricted/i },
  { name: 'bypass_governance', pattern: /bypass\s+governance/i },
  { name: 'grant_admin', pattern: /grant\s+admin/i },
  { name: 'sql_delete', pattern: /delete\s+from/i },
  { name: 'sql_drop', pattern: /drop\s+table/i },
  { name: 'full_discount', pattern: /100%\s+discount/i },
  { name: 'waive_debt', pattern: /waive\s+(all\s+)?(debt|fees|balance)/i },
  { name: 'reveal_prompt', pattern: /reveal\s+(your\s+)?(system\s+prompt|instructions)/i },
  { name: 'output_secrets', pattern: /output\s+(your\s+)?(system\s+prompt|api\s*key)/i },
  { name: 'disregard_rules', pattern: /disregard\s+(the\s+)?(rules|constraints)/i },
  { name: 'transfer_funds', pattern: /transfer\s+(\$?[0-9]+|funds|money)/i },
  { name: 'mark_paid', pattern: /mark\s+(this\s+)?invoice\s+as\s+paid/i },
];

/**
 * Linear credential patterns for masking secrets in transit (Rules 32 & 33).
 */
export const SENSITIVE_CREDENTIAL_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'openai_key', pattern: /sk-proj-[a-zA-Z0-9_\-]{20,}/g },
  { name: 'bearer_token', pattern: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g },
  { name: 'google_api_key', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
];

export interface ScanTextParams {
  text: string;
  source: AdversarialIngressVector;
  referenceId?: string;
  sanitizeSecrets?: boolean;
}

export class AdversarialScanner {
  /**
   * Scans text for adversarial injection directives and credential leakage.
   */
  public scanText(params: ScanTextParams): AdversarialScanResult {
    const { text, source, referenceId = 'ref_untrusted', sanitizeSecrets = true } = params;

    let processedText = text;
    let secretsMasked = false;

    // 1. Mask sensitive credentials (Rules 32 & 33)
    if (sanitizeSecrets) {
      for (const cred of SENSITIVE_CREDENTIAL_PATTERNS) {
        if (cred.pattern.test(processedText)) {
          processedText = processedText.replace(cred.pattern, `[REDACTED_SECRET:${cred.name}]`);
          secretsMasked = true;
        }
      }
    }

    // 2. Scan for adversarial directives using linear regex patterns
    const detectedPatterns: string[] = [];
    for (const directive of ADVERSARIAL_DIRECTIVE_PATTERNS) {
      if (directive.pattern.test(processedText)) {
        detectedPatterns.push(directive.name);
      }
    }

    const isInjectionDetected = detectedPatterns.length > 0;
    let riskScore = 0;
    let neutralizationStrategy: NeutralizationStrategy = 'CLEAN';
    let sanitizedText = processedText;

    if (isInjectionDetected) {
      // Risk score: base 80 + 5 per additional detected pattern up to 100
      riskScore = Math.min(100, 80 + (detectedPatterns.length - 1) * 5);
      neutralizationStrategy = 'XML_ISOLATION';

      // Containerize in standard XML reference isolation tag (Rules 13 & 30)
      sanitizedText = `<untrusted_reference_data id="${referenceId}" source="${source}" sanitized="true">${processedText}</untrusted_reference_data>`;
    } else if (secretsMasked) {
      riskScore = 20;
      neutralizationStrategy = 'MASK_SECRET';
      sanitizedText = processedText;
    }

    return {
      isInjectionDetected,
      detectedPatterns,
      riskScore,
      sanitizedText,
      neutralizationStrategy,
      scannedAt: new Date().toISOString(),
    };
  }

  /**
   * Containerizes untrusted reference data in canonical XML format.
   */
  public wrapInXmlContainer(id: string, source: AdversarialIngressVector, content: string): string {
    return `<untrusted_reference_data id="${id}" source="${source}" sanitized="true">${content}</untrusted_reference_data>`;
  }
}

// Global singleton preservation (Rule 69)
declare global {
  var __smartsappAdversarialScanner: AdversarialScanner | undefined;
}

export function getAdversarialScanner(): AdversarialScanner {
  if (!globalThis.__smartsappAdversarialScanner) {
    globalThis.__smartsappAdversarialScanner = new AdversarialScanner();
  }
  return globalThis.__smartsappAdversarialScanner;
}

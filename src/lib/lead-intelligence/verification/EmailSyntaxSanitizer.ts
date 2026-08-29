/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 5):
 * 
 * EmailSyntaxSanitizer validates email string structure according to RFC-5322,
 * identifies generic role-based mailboxes, and normalizes address tokens.
 * 
 * Invariants & Safeguards:
 * 1. Hoisted RegExp: Avoids re-compilation in tight bulk enrichment loops.
 * 2. Role-Based Mailbox Flagging: Identifies shared inboxes (e.g. info@, admissions@) to adjust deliverability weight.
 * 3. Strict Typing: Zero `any` or `any[]`.
 */

export interface SyntaxSanitizationResult {
  isValid: boolean;
  cleanEmail: string;
  domain: string;
  localPart: string;
  isRoleBased: boolean;
  roleType?: string;
  error?: string;
}

const RFC_5322_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const ROLE_BASED_PREFIXES = new Set([
  'info',
  'admin',
  'administrator',
  'support',
  'principal',
  'headmaster',
  'headmistress',
  'headteacher',
  'bursar',
  'finance',
  'accounts',
  'billing',
  'registrar',
  'admissions',
  'admission',
  'sales',
  'marketing',
  'contact',
  'help',
  'office',
  'hr',
  'jobs',
  'careers',
  'general',
  'enquiries',
  'inquiries'
]);

export class EmailSyntaxSanitizer {
  /**
   * Sanitizes and validates an email string.
   */
  public static sanitize(rawEmail: string): SyntaxSanitizationResult {
    if (!rawEmail || typeof rawEmail !== 'string') {
      return {
        isValid: false,
        cleanEmail: '',
        domain: '',
        localPart: '',
        isRoleBased: false,
        error: 'Email address cannot be empty'
      };
    }

    const cleanEmail = rawEmail.trim().toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]/g, '');

    if (!cleanEmail.includes('@')) {
      return {
        isValid: false,
        cleanEmail,
        domain: '',
        localPart: cleanEmail,
        isRoleBased: false,
        error: 'Missing @ delimiter'
      };
    }

    const parts = cleanEmail.split('@');
    if (parts.length !== 2) {
      return {
        isValid: false,
        cleanEmail,
        domain: '',
        localPart: '',
        isRoleBased: false,
        error: 'Multiple @ characters detected'
      };
    }

    const [localPart, domain] = parts;

    if (!localPart || !domain || domain.indexOf('.') === -1) {
      return {
        isValid: false,
        cleanEmail,
        domain: domain || '',
        localPart: localPart || '',
        isRoleBased: false,
        error: 'Invalid local or domain segment'
      };
    }

    const isValid = RFC_5322_EMAIL_REGEX.test(cleanEmail);
    const isRoleBased = ROLE_BASED_PREFIXES.has(localPart);

    return {
      isValid,
      cleanEmail,
      domain,
      localPart,
      isRoleBased,
      roleType: isRoleBased ? localPart : undefined,
      error: isValid ? undefined : 'Email syntax violates RFC-5322 standards'
    };
  }
}

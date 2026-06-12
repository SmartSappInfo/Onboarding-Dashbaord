import type { EntityContact, EmailVerificationRule } from './types';

/**
 * Pure business logic engine for calculating Lead Scoring updates.
 * Designed to be clean, testable, and isolated.
 */

/**
 * Calculates new contact and entity scores based on email verification results.
 * Handles delta scoring to prevent double-counting.
 */
export function calculateNewVerifyScores(
  entityContacts: EntityContact[],
  email: string,
  verificationScore: number,
  rules: EmailVerificationRule[]
): { entityContacts: EntityContact[]; leadScore: number } {
  const updatedContacts = entityContacts.map((c) => ({ ...c }));
  const lowerEmail = email.toLowerCase().trim();

  // Find the matched rule by checking thresholds in descending order
  const sortedRules = [...rules].sort((a, b) => b.minScore - a.minScore);
  const matchedRule = sortedRules.find((r) => verificationScore >= r.minScore);
  const newVerifyScore = matchedRule ? matchedRule.scoreValue : 0;

  // Find target contact in array by email matching
  const contactIndex = updatedContacts.findIndex(
    (c) => c.email?.toLowerCase().trim() === lowerEmail
  );

  if (contactIndex !== -1) {
    const contact = updatedContacts[contactIndex];
    const oldVerifyScore = contact.emailVerificationScore || 0;

    // Apply delta adjustment to contact score
    contact.emailVerificationScore = newVerifyScore;
    contact.score = Math.max(
      0,
      (contact.score || 0) - oldVerifyScore + newVerifyScore
    );
  }

  // Calculate overall entity lead score as sum of contact scores
  const leadScore = updatedContacts.reduce((sum, c) => sum + (c.score || 0), 0);

  return { entityContacts: updatedContacts, leadScore };
}

/**
 * Adjusts scores based on dynamic values or mapped engagement rules.
 * Automatically resolves target contact by email/ID, falling back to primary or first contact.
 */
export function calculateEngagementAdjustment(
  entityContacts: EntityContact[],
  emailOrId: string | undefined,
  increment: number,
  operation: 'add' | 'subtract' | 'set' = 'add'
): { entityContacts: EntityContact[]; leadScore: number } {
  const updatedContacts = entityContacts.map((c) => ({ ...c }));
  if (updatedContacts.length === 0) {
    return { entityContacts: updatedContacts, leadScore: 0 };
  }

  const cleanTarget = emailOrId?.toLowerCase().trim();
  let contactIndex = -1;

  // 1. Try matching by contact ID or email
  if (cleanTarget) {
    contactIndex = updatedContacts.findIndex(
      (c) => c.id === emailOrId || c.email?.toLowerCase().trim() === cleanTarget
    );
  }

  // 2. Fallback to primary contact
  if (contactIndex === -1) {
    contactIndex = updatedContacts.findIndex((c) => c.isPrimary);
  }

  // 3. Fallback to first contact in array
  if (contactIndex === -1) {
    contactIndex = 0;
  }

  if (contactIndex !== -1) {
    const contact = updatedContacts[contactIndex];
    const currentScore = contact.score || 0;

    if (operation === 'add') {
      contact.score = Math.max(0, currentScore + increment);
    } else if (operation === 'subtract') {
      contact.score = Math.max(0, currentScore - increment);
    } else if (operation === 'set') {
      contact.score = Math.max(0, increment);
    }
  }

  const leadScore = updatedContacts.reduce((sum, c) => sum + (c.score || 0), 0);

  return { entityContacts: updatedContacts, leadScore };
}

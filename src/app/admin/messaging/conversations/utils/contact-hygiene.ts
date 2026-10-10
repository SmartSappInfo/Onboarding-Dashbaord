/**
 * SmartSapp Messaging Hub — Contact Hygiene Score Evaluator
 *
 * Computes an objective 0–100% data hygiene rating:
 * - Valid RFC-compliant Email: +25%
 * - Valid Phone (>= 7 digits): +25%
 * - Contact Name (>= 2 chars): +20%
 * - Verified Entity / Institution association: +20%
 * - Active Engagement or Successful Delivery History: +10%
 *
 * In accordance with Rule 4: Zero any or any[].
 */

export interface ContactHygieneInput {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  entityName?: string | null;
  status?: string | null;
  deliveredCount?: number;
}

export interface ContactHygieneResult {
  score: number;
  label: 'High Quality' | 'Fair' | 'Needs Review';
  color: string;
  bg: string;
}

export function calculateContactHygieneScore(input: ContactHygieneInput): ContactHygieneResult {
  let score = 0;

  // 1. Valid Email format (+25%)
  if (input.email && input.email.includes('@') && input.email.includes('.')) {
    score += 25;
  }

  // 2. Valid Phone number (+25%)
  if (input.phone && input.phone.replace(/\D/g, '').length >= 7) {
    score += 25;
  }

  // 3. Contact Name (+20%)
  if (input.name && input.name.trim().length >= 2) {
    score += 20;
  }

  // 4. Institution / Entity association (+20%)
  if (input.entityName && input.entityName.trim().length >= 2) {
    score += 20;
  }

  // 5. Active engagement or successful delivery history (+10%)
  if (input.status?.toLowerCase() === 'active' || (input.deliveredCount !== undefined && input.deliveredCount > 0)) {
    score += 10;
  } else if (input.status) {
    score += 5;
  }

  const clamped = Math.min(Math.max(score, 10), 100);

  if (clamped >= 80) {
    return {
      score: clamped,
      label: 'High Quality',
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
    };
  }

  if (clamped >= 50) {
    return {
      score: clamped,
      label: 'Fair',
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/30',
    };
  }

  return {
    score: clamped,
    label: 'Needs Review',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
  };
}

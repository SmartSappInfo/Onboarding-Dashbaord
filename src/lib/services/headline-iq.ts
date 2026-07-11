/**
 * @fileOverview HeadlineIQ static scoring and copy analysis utility.
 * Runs 100% on the client side with zero dependencies for instant, latency-free feedback.
 */

import type { HeadlineIQAnalysis } from '../types';

const POWER_WORDS = [
  'proven', 'secret', 'magic', 'easy', 'stop', 'why', 'how', 'win', 'discover', 'unlock',
  'new', 'free', 'save', 'best', 'instant', 'simple', 'fast', 'now', 'today', 'amazing',
  'essential', 'critical', 'exclusive', 'join', 'limited', 'quick'
];

const URGENCY_WORDS = [
  'now', 'today', 'alert', 'ends', 'urgent', 'quick', 'expires', 'last chance', 'hurry',
  'limited', 'final', 'instantly', 'action', 'running out', 'immediate', 'deadline'
];

const SPAM_WORDS = [
  '100% free', 'guaranteed', 'make money', 'click here', 'cash', 'earn money', 'risk free',
  'no catch', 'double your', 'investment', 'unlimited free', 'free gift', 'act now'
];

/**
 * Static scoring and analysis engine for email subject lines and message headlines.
 * Scores the string out of 100 based on length, personalization, power words, and warnings.
 */
export function analyzeHeadline(text: string): HeadlineIQAnalysis {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      score: 0,
      urgencyMeter: 10,
      curiosityMeter: 10,
      clarityMeter: 10,
      checklist: [{ type: 'warning', message: 'Type a headline or subject line to begin analysis.' }]
    };
  }

  let score = 50;
  const checklist: { type: 'success' | 'warning' | 'error'; message: string }[] = [];
  const lower = trimmed.toLowerCase();

  // 1. Length analysis (optimal: 30 to 60 characters)
  const len = trimmed.length;
  if (len >= 30 && len <= 60) {
    score += 30;
    checklist.push({ type: 'success', message: 'Subject line is an optimal length for desktop and mobile (30-60 chars).' });
  } else if (len < 30) {
    if (len < 10) {
      score -= 20;
      checklist.push({ type: 'error', message: 'Critically short headline. Add more context to hook the reader.' });
    } else {
      score -= 10;
      checklist.push({ type: 'warning', message: 'A bit short. Consider adding more descriptive details.' });
    }
  } else {
    // len > 60
    if (len > 80) {
      score -= 25;
      checklist.push({ type: 'error', message: 'Too long (over 80 chars). It will be heavily truncated in inbox lists.' });
    } else {
      score -= 10;
      checklist.push({ type: 'warning', message: 'Slightly long (over 60 chars). Check if key details are visible on mobile.' });
    }
  }

  // 2. Personalization variables verification
  const hasPersonalization = /\{\{.*?\}\}/.test(trimmed);
  if (hasPersonalization) {
    score += 15;
    checklist.push({ type: 'success', message: 'Personalization is active. Merge variables increase open rates by 26%.' });
  } else {
    checklist.push({ type: 'warning', message: 'No personalization variables detected. Add a merge tag like {{contact_name}}.' });
  }

  // 3. Power words match
  let powerMatchCount = 0;
  for (const word of POWER_WORDS) {
    if (lower.includes(word)) {
      powerMatchCount++;
    }
  }
  const powerScore = Math.min(20, powerMatchCount * 5);
  score += powerScore;
  if (powerMatchCount > 0) {
    checklist.push({ type: 'success', message: 'Contains high-converting power/emotional copy words.' });
  }

  // 4. Urgency words match
  let urgencyMatchCount = 0;
  for (const word of URGENCY_WORDS) {
    if (lower.includes(word)) {
      urgencyMatchCount++;
    }
  }
  const urgencyScore = Math.min(15, urgencyMatchCount * 5);
  score += urgencyScore;

  // 5. Spam words penalty
  let spamMatchCount = 0;
  for (const word of SPAM_WORDS) {
    if (lower.includes(word)) {
      spamMatchCount++;
    }
  }
  if (spamMatchCount > 0) {
    const penalty = Math.min(30, spamMatchCount * 15);
    score -= penalty;
    checklist.push({ type: 'error', message: 'Avoid spam trigger phrases (e.g. guaranteed, free cash) to pass filters.' });
  }

  // 6. Formatting penalties (ALL-CAPS and punctuation)
  const isAllCaps = len > 5 && trimmed === trimmed.toUpperCase();
  if (isAllCaps) {
    score -= 20;
    checklist.push({ type: 'error', message: 'All caps triggers spam filters and looks like shouting. Use title case.' });
  }

  const exclamationCount = (trimmed.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    score -= 10;
    checklist.push({ type: 'warning', message: 'Excessive exclamation marks (!!!) seem unprofessional and spammy.' });
  }

  // Clamp overall score
  score = Math.max(0, Math.min(100, score));

  // Compute meters
  // Urgency Meter
  let urgencyMeter = 10;
  if (urgencyMatchCount > 0) {
    urgencyMeter += Math.min(90, 40 + urgencyMatchCount * 25);
  } else {
    // fallback context checks
    if (lower.includes('soon') || lower.includes('remind') || lower.includes('due') || lower.includes('late')) {
      urgencyMeter += 30;
    }
  }
  urgencyMeter = Math.max(10, Math.min(100, urgencyMeter));

  // Curiosity/Hook Meter
  let curiosityMeter = 10;
  if (lower.includes('?')) {
    curiosityMeter += 40;
  }
  curiosityMeter += Math.min(50, powerMatchCount * 15);
  if (lower.includes('secret') || lower.includes('unlock') || lower.includes('how to')) {
    curiosityMeter += 20;
  }
  curiosityMeter = Math.max(10, Math.min(100, curiosityMeter));

  // Clarity / Personalization Meter
  let clarityMeter = 60;
  if (hasPersonalization) {
    clarityMeter += 30;
  }
  if (len >= 30 && len <= 60) {
    clarityMeter += 10;
  } else if (len > 80) {
    clarityMeter -= 30;
  }
  clarityMeter = Math.max(10, Math.min(100, clarityMeter));

  return {
    score,
    urgencyMeter,
    curiosityMeter,
    clarityMeter,
    checklist
  };
}

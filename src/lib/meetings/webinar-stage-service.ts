/**
 * @fileoverview Pure Live Webinar Stage & Moderation Service.
 * Manages FIFO waitlist capacity auto-promotions and audience Q&A ranking algorithms.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 */

import type { WebinarQuestion } from './types/webinar-stage';

export interface WaitlistCandidate {
  id: string;
  registeredAt: string;
}

/**
 * Evaluates available seats and promotes waitlisted registrants in FIFO order.
 */
export function promoteWaitlistRegistrants(
  capacityLimit: number,
  confirmedCount: number,
  waitlist: WaitlistCandidate[]
): Array<{ id: string; status: 'confirmed' }> {
  if (capacityLimit <= 0) return [];
  const openSeats = Math.max(0, capacityLimit - confirmedCount);
  if (openSeats === 0 || waitlist.length === 0) return [];

  // Sort FIFO by registration time
  const sorted = [...waitlist].sort(
    (a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()
  );

  const eligible = sorted.slice(0, openSeats);
  return eligible.map(candidate => ({
    id: candidate.id,
    status: 'confirmed' as const,
  }));
}

/**
 * Ranks audience Q&A questions:
 * 1. Unanswered questions come first
 * 2. Higher upvotes first
 * 3. Earliest posted first as tiebreaker
 */
export function rankWebinarQuestions(questions: WebinarQuestion[]): WebinarQuestion[] {
  return [...questions].sort((a, b) => {
    // Unanswered first
    if (!a.isAnswered && b.isAnswered) return -1;
    if (a.isAnswered && !b.isAnswered) return 1;

    // Upvote count desc
    if (b.upvotesCount !== a.upvotesCount) {
      return b.upvotesCount - a.upvotesCount;
    }

    // Earliest posted first
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

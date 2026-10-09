/**
 * @fileOverview SmartSapp Messaging Dashboard — Hero Greeting Utilities
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Pure, deterministic helper functions for time-of-day greetings and user identity extraction.
 * - Adheres strictly to Rule 4 (Zero any/any[]).
 * - Safe against SSR hydration mismatches by isolating Date logic.
 */

/**
 * Classifies a timestamp into a time-of-day greeting.
 * - 05:00 - 11:59: "Good morning"
 * - 12:00 - 16:59: "Good afternoon"
 * - 17:00 - 04:59: "Good evening"
 * 
 * @param date - Optional Date instance; defaults to new Date().
 * @returns Time-of-day greeting string.
 */
export function getTimeOfDayGreeting(date: Date = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) {
    return 'Good morning';
  }
  if (hours >= 12 && hours < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

/**
 * Safely extracts the first name from a user's display name or email prefix.
 * 
 * @param displayName - Raw display name from user profile or auth context.
 * @param fallback - Fallback term if name is absent (defaults to "Team Member").
 * @returns Clean, trimmed first name or fallback.
 */
export function extractFirstName(
  displayName?: string | null,
  fallback: string = 'Team Member'
): string {
  if (!displayName || !displayName.trim()) {
    return fallback;
  }
  const trimmed = displayName.trim();
  const firstPart = trimmed.split(/\s+/)[0];
  return firstPart || fallback;
}

/**
 * Formats the full hero headline incorporating greeting, user first name, and wave emoji.
 * 
 * @param displayName - User's display name.
 * @param date - Optional Date instance.
 * @returns e.g. "Good morning, Sarah 👋"
 */
export function formatGreetingHeadline(
  displayName?: string | null,
  date: Date = new Date()
): string {
  const greeting = getTimeOfDayGreeting(date);
  const firstName = extractFirstName(displayName);
  return `${greeting}, ${firstName} 👋`;
}

/**
 * Generates the standardized hero subtitle tailored to active workspace terminology.
 * 
 * @param entityTermSingular - Singular entity label (e.g. "School", "Campus", "Client").
 * @returns e.g. "Your AI-powered messaging hub for stronger school communities and better engagement."
 */
export function buildHeroSubtitle(entityTermSingular?: string): string {
  const normalizedTerm = entityTermSingular?.trim()
    ? entityTermSingular.trim().toLowerCase()
    : 'school';
  return `Your AI-powered messaging hub for stronger ${normalizedTerm} communities and better engagement.`;
}

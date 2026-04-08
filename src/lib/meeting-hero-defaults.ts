/**
 * Default hero text per meeting type.
 * Used when a meeting does not have heroTitle / heroDescription overrides.
 *
 * The school name is interpolated at render-time via the {{school}} token
 * so that callers can replace it with the actual school name.
 */

export interface MeetingHeroDefaults {
  title: string;
  description: string;
  tagline?: string;
  ctaLabel?: string;
}

const DEFAULTS: Record<string, MeetingHeroDefaults> = {
  parent: {
    title: '{{school}} is digitalizing to serve you better',
    description:
      "Join us for a short onboarding session where we'll show you how SmartSapp improves communication, payments, and school engagement for parents.",
  },
  kickoff: {
    title: 'Institutional Kickoff Meeting',
    description:
      "Welcome to the kickoff meeting for {{school}}. We'll discuss the onboarding process, set timelines, and answer your initial questions to ensure a smooth start.",
  },
  training: {
    title: 'Staff Training Session',
    description:
      'This session is designed to get your staff comfortable with the SmartSapp platform. We will cover key features for student management, parent communication, and daily operations.',
  },
  webinar: {
    title: 'Live Webinar — {{school}}',
    description:
      'Register for this exclusive live session to learn about digital transformation in education. Seats are limited — secure your spot today.',
    ctaLabel: 'Register Now',
  },
};

/**
 * Returns the resolved hero title for a meeting.
 * Priority: meeting override → type default → generic fallback.
 */
export function getHeroTitle(
  meetingTypeId: string,
  schoolName: string,
  override?: string,
): string {
  if (override) return override;
  const d = DEFAULTS[meetingTypeId];
  const raw = d?.title ?? 'Upcoming Session';
  return raw.replace(/\{\{school\}\}/g, schoolName);
}

/**
 * Returns the resolved hero description for a meeting.
 */
export function getHeroDescription(
  meetingTypeId: string,
  schoolName: string,
  override?: string,
): string {
  if (override) return override;
  const d = DEFAULTS[meetingTypeId];
  const raw = d?.description ?? '';
  return raw.replace(/\{\{school\}\}/g, schoolName);
}

/**
 * Returns the resolved CTA label, if any.
 */
export function getHeroCtaLabel(
  meetingTypeId: string,
  override?: string,
): string | undefined {
  if (override) return override;
  return DEFAULTS[meetingTypeId]?.ctaLabel;
}

/**
 * Returns the full set of defaults for a meeting type (used in admin wizard
 * to pre-fill the hero content fields).
 */
export function getMeetingHeroDefaults(meetingTypeId: string): MeetingHeroDefaults {
  return DEFAULTS[meetingTypeId] ?? DEFAULTS.parent;
}

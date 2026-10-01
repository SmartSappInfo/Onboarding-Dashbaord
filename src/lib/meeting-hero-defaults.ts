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
    title: "We're Digitalizing {{entity_name}} to Serve You Better",
    description:
      "Join us for an essential orientation session to learn how we've improved security and safety of your child, made it easy for parents to be involved in their children's school life, and how we support your child's growth.",
  },
  kickoff: {
    title: 'Institutional Kickoff Meeting',
    description:
      "Welcome to the kickoff meeting for {{entity_name}}. We'll discuss the onboarding process, set timelines, and answer your initial questions to ensure a smooth start.",
  },
  training: {
    title: 'Staff Training Session',
    description:
      'This session is designed to get your staff comfortable with the SmartSapp platform. We will cover key features for student management, parent communication, and daily operations.',
  },
  webinar: {
    title: 'Live Webinar — {{entity_name}}',
    description:
      'Register for this exclusive live session to learn about digital transformation in education. Seats are limited — secure your spot today.',
    ctaLabel: 'Register Now',
  },
};

/**
 * Returns the resolved hero title for a meeting.
 * Priority: meeting override → type default → generic fallback.
 * Automatically resolves {{entity_name}} or {{school}} tokens.
 */
export function getHeroTitle(
  meetingTypeId: string,
  entityName: string,
  override?: string,
): string {
  const d = DEFAULTS[meetingTypeId];
  const raw = override || d?.title || 'Upcoming Session';
  if (!entityName) return raw;
  return raw.replace(/\{\{(school|entity_name)\}\}/g, entityName);
}

/**
 * Returns the resolved hero description for a meeting.
 * Automatically resolves {{entity_name}} or {{school}} tokens.
 */
export function getHeroDescription(
  meetingTypeId: string,
  entityName: string,
  override?: string,
): string {
  const d = DEFAULTS[meetingTypeId];
  const raw = override || d?.description || '';
  if (!entityName) return raw;
  return raw.replace(/\{\{(school|entity_name)\}\}/g, entityName);
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

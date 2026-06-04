import { nanoid } from 'nanoid';

/**
 * Generates a URL-safe unique token for a meeting registrant.
 * Uses nanoid(16) for a good balance of uniqueness and URL-friendliness.
 */
export function generateRegistrantToken(): string {
  return nanoid(16);
}

/**
 * Builds the personalized meeting URL for a registrant.
 * This URL is used in invite emails and stored on the registrant doc.
 */
export function buildPersonalizedMeetingUrl(
  origin: string,
  meetingTypeSlug: string,
  entitySlug: string,
  token: string,
): string {
  return `${origin}/meetings/${meetingTypeSlug}/${entitySlug}?token=${token}`;
}

/**
 * Extracts the registrant token from URL search params.
 * Returns null if no token is present.
 */
export function extractTokenFromSearchParams(searchParams: URLSearchParams): string | null {
  return searchParams.get('token') || null;
}

/**
 * Default registration fields for a new meeting with registration enabled.
 * These are pre-populated in the field builder.
 */
export function getDefaultRegistrationFields() {
  return [
    {
      id: nanoid(8),
      key: 'name',
      label: 'Full Name',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g. Ama Serwaa',
      order: 0,
    },
    {
      id: nanoid(8),
      key: 'email',
      label: 'Email Address',
      type: 'email' as const,
      required: true,
      placeholder: 'e.g. ama@example.com',
      order: 1,
    },
    {
      id: nanoid(8),
      key: 'phone',
      label: 'Phone Number',
      type: 'phone' as const,
      required: false,
      placeholder: 'e.g. +233 XX XXX XXXX',
      order: 2,
    },
  ];
}

/**
 * Builds the personalized meeting join URL for a registrant.
 * Resolves the meeting type slug safely, handling nested types and legacy overrides.
 */
export function getPersonalizedMeetingUrl(
  origin: string,
  meeting: { type?: { slug?: string; id?: string } | string; meetingSlug?: string; entitySlug?: string; id: string },
  token: string,
): string {
  let typeSlug = 'parent-engagement';
  if (meeting.type) {
    if (typeof meeting.type === 'string') {
      typeSlug = meeting.type === 'parent' ? 'parent-engagement' : meeting.type;
    } else if (meeting.type.slug) {
      typeSlug = meeting.type.slug;
    } else if (meeting.type.id) {
      typeSlug = meeting.type.id === 'parent' ? 'parent-engagement' : meeting.type.id;
    }
  }
  const meetingSlug = meeting.meetingSlug || meeting.entitySlug || meeting.id;
  return `${origin}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;
}


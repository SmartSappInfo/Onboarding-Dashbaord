import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import type { Meeting, MeetingFacilitator } from './types';

/**
 * Generates a random or UUID string for facilitator join links.
 */
function generateToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Transforms the original meeting object into a clone-ready payload.
 * Strips out identifiers, sets publish status to draft, and regenerates facilitator join links.
 */
export function cloneMeetingData(originalMeeting: Meeting): Omit<Meeting, 'id'> {
  const {
    id,
    publishStatus,
    status,
    endedAt,
    meetingSlug,
    title,
    facilitators,
    ...rest
  } = originalMeeting;

  // Generate new title
  const newTitle = title 
    ? (title.startsWith("Copy of ") ? title : `Copy of ${title}`)
    : "Copy Meeting";

  // Regenerate facilitator join links to guarantee isolation
  const clonedFacilitators = facilitators?.map((fac: MeetingFacilitator) => ({
    ...fac,
    joinLink: generateToken()
  })) || [];

  return {
    ...rest,
    title: newTitle,
    meetingSlug: "", // Will be set by unique slug solver
    publishStatus: "draft",
    facilitators: clonedFacilitators,
  };
}

/**
 * Generates a unique meeting slug by checking Firestore.
 * Appends '-copy' or incrementing counter if duplicate.
 */
export async function getUniqueSlugForType(
  firestore: Firestore,
  baseSlug: string,
  meetingTypeSlug: string
): Promise<string> {
  // Normalize base slug
  let normalizedSlug = baseSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalizedSlug) {
    normalizedSlug = "meeting-copy";
  }

  // Ensure it has copy suffix if not already
  if (!normalizedSlug.includes('-copy')) {
    normalizedSlug = `${normalizedSlug}-copy`;
  }

  const meetingsRef = collection(firestore, 'meetings');
  let uniqueSlug = normalizedSlug;
  let isUnique = false;
  let suffix = 1;
  const maxAttempts = 15;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      uniqueSlug = `${normalizedSlug}-${suffix}`;
    }

    const q = query(
      meetingsRef,
      where('type.slug', '==', meetingTypeSlug),
      where('meetingSlug', '==', uniqueSlug)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      isUnique = true;
      break;
    }

    suffix++;
  }

  if (!isUnique) {
    const randomStr = Math.random().toString(36).substring(2, 6);
    uniqueSlug = `${normalizedSlug}-${randomStr}`;
  }

  return uniqueSlug;
}

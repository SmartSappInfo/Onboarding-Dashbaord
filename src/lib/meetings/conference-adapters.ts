/**
 * @fileoverview Pure adapter service for Conference Sessions in SmartSapp Meetings 2.0.
 * Normalizes video providers (Google Meet, Zoom, MS Teams, Daily, SmartSapp),
 * physical addresses, and custom links into unified ConferenceSession records.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Sensitive host passwords or tokens must be referenced via secure secret keys.
 * - Always provide fallback display details when provider APIs are temporarily unreachable.
 */

import type { ConferenceProvider, ConferenceSession, ConferenceSessionStatus } from './types';

export interface GenerateConferenceSessionInput {
  meetingId: string;
  workspaceId: string;
  organizationId?: string;
  provider: ConferenceProvider;
  title: string;
  physicalAddress?: string;
  customLink?: string;
  externalMeetingId?: string;
  hostUrl?: string;
  dialIn?: { phone: string; pin?: string };
  providerMetadata?: Record<string, string | number | boolean | null>;
}

/**
 * Creates a normalized ConferenceSession domain object.
 */
export function generateConferenceSession(
  input: GenerateConferenceSessionInput
): ConferenceSession {
  const now = new Date().toISOString();
  const id = `conf_${input.meetingId}_${Date.now().toString(36)}`;

  let joinUrl: string | undefined;
  let status: ConferenceSessionStatus = 'active';

  switch (input.provider) {
    case 'google_meet':
      joinUrl = input.customLink || `https://meet.google.com/${input.externalMeetingId || 'lookup'}`;
      break;
    case 'zoom':
      joinUrl = input.customLink || (input.externalMeetingId ? `https://zoom.us/j/${input.externalMeetingId}` : undefined);
      break;
    case 'microsoft_teams':
      joinUrl = input.customLink || undefined;
      break;
    case 'physical':
      joinUrl = undefined;
      break;
    case 'custom':
    case 'daily':
    case 'smart_sapp':
    default:
      joinUrl = input.customLink || undefined;
      break;
  }

  return {
    id,
    meetingId: input.meetingId,
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    provider: input.provider,
    externalMeetingId: input.externalMeetingId,
    joinUrl,
    hostUrl: input.hostUrl,
    dialIn: input.dialIn,
    physicalAddress: input.physicalAddress,
    providerMetadata: input.providerMetadata || {},
    status,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Returns formatted display metadata and iconography for a given conference session.
 */
export function formatConferenceDetails(session: ConferenceSession): {
  displayTitle: string;
  joinUrl?: string;
  hostUrl?: string;
  dialInText?: string;
  iconName: 'video' | 'map-pin' | 'phone' | 'globe';
  isPhysical: boolean;
  providerLabel: string;
} {
  const isPhysical = session.provider === 'physical';

  let providerLabel = 'Online Meeting';
  let iconName: 'video' | 'map-pin' | 'phone' | 'globe' = 'video';

  switch (session.provider) {
    case 'google_meet':
      providerLabel = 'Google Meet';
      iconName = 'video';
      break;
    case 'zoom':
      providerLabel = 'Zoom Meeting';
      iconName = 'video';
      break;
    case 'microsoft_teams':
      providerLabel = 'Microsoft Teams';
      iconName = 'video';
      break;
    case 'physical':
      providerLabel = 'In-Person / Physical Location';
      iconName = 'map-pin';
      break;
    case 'daily':
      providerLabel = 'SmartSapp Video (Daily)';
      iconName = 'video';
      break;
    case 'smart_sapp':
      providerLabel = 'SmartSapp Direct Room';
      iconName = 'video';
      break;
    case 'custom':
    default:
      providerLabel = 'Custom Video / Web Link';
      iconName = 'globe';
      break;
  }

  const dialInText = session.dialIn
    ? `Dial: ${session.dialIn.phone}${session.dialIn.pin ? ` (PIN: ${session.dialIn.pin})` : ''}`
    : undefined;

  return {
    displayTitle: isPhysical ? session.physicalAddress || 'Physical Venue' : providerLabel,
    joinUrl: session.joinUrl,
    hostUrl: session.hostUrl,
    dialInText,
    iconName,
    isPhysical,
    providerLabel,
  };
}

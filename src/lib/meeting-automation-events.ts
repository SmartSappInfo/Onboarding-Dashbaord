'use server';

import { logActivity } from './activity-logger';

export async function emitMeetingRegistrantActivity(params: {
  type: 'meeting_registrant_added' | 'meeting_registrant_attended' | 'meeting_registrant_no_show';
  organizationId: string;
  workspaceId: string;
  meetingId: string;
  registrantId: string;
  entityId?: string | null;
  registrantName?: string;
  registrantEmail?: string;
  meetingTypeId?: string;
}) {
  const {
    type,
    organizationId,
    workspaceId,
    meetingId,
    registrantId,
    entityId,
    registrantName,
    registrantEmail,
    meetingTypeId,
  } = params;

  await logActivity({
    organizationId,
    workspaceId,
    entityId: entityId || null,
    userId: null,
    type: type as any,
    source: 'meetings',
    description: `Meeting registrant event: ${type}`,
    metadata: {
      meetingId,
      registrantId,
      registrantName,
      registrantEmail,
      meetingTypeId,
    },
  });
}

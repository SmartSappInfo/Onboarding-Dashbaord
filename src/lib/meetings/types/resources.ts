/**
 * @fileoverview Domain Types for Physical Rooms & Equipment Resources.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Resource booking collisions must be evaluated strictly across ISO interval bounds.
 * - Zero 'any' policy strictly enforced.
 */

export type MeetingResourceType = 'room' | 'boardroom' | 'studio' | 'equipment' | 'vehicle';

export interface MeetingRoomResource {
  id: string;
  workspaceId: string;
  name: string;
  type: MeetingResourceType;
  capacity?: number;
  locationAddress?: string;
  floorBuilding?: string;
  amenities?: string[]; // e.g. ["4K Projector", "Whiteboard", "Zoom Room System"]
  isActive: boolean;
  requiresHostApproval?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceReservation {
  id: string;
  resourceId: string;
  meetingId: string;
  workspaceId: string;
  startAt: string; // ISO 8601 UTC
  endAt: string;   // ISO 8601 UTC
  status: 'confirmed' | 'cancelled';
  reservedByUserId: string;
  reservedByName?: string;
}

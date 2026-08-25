/**
 * @fileoverview Domain types for Calendar Integrations and Multi-Calendar Conflict Synchronization.
 * Supports Google Calendar, Microsoft Outlook / Office 365, and iCal.
 */

export type CalendarConnectionProvider = 'google_calendar' | 'microsoft_outlook' | 'apple_ical';

export type CalendarConnectionStatus = 'connected' | 'reauth_required' | 'revoked' | 'syncing';

export type CalendarSyncDirection = 'one_way_to_calendar' | 'one_way_from_calendar' | 'two_way';

export interface ExternalBusyInterval {
  start: string; // ISO 8601 UTC
  end: string;   // ISO 8601 UTC
  source?: 'google' | 'microsoft' | 'internal';
  title?: string; // Masked e.g. "Busy" for privacy
}

export interface CalendarConnection {
  id: string;
  organizationId?: string;
  workspaceId: string;
  userId: string;
  provider: CalendarConnectionProvider;
  email: string;
  calendarId: string; // e.g. "primary" or calendar GUID
  calendarName?: string;
  status: CalendarConnectionStatus;
  syncDirection: CalendarSyncDirection;
  checkConflicts: boolean;
  isPrimaryDestination: boolean;
  accessToken: string; // Encrypted with AES-256-GCM
  refreshToken: string; // Encrypted with AES-256-GCM
  expiresAt: string; // ISO 8601
  lastSyncAt?: string; // ISO 8601
  createdAt: string;
  updatedAt: string;
}

export interface CalendarSyncResult {
  success: boolean;
  externalEventId?: string;
  externalEventUrl?: string;
  meetLink?: string;
  error?: string;
}

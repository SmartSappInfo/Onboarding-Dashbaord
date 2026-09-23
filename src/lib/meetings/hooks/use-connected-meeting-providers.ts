/**
 * @fileoverview Hook for Detecting Connected Conferencing & Calendar Integrations.
 * 
 * Provides real-time reactive detection of connected workspace calendar/video providers
 * (Google Meet via Google Calendar, Zoom Video, Microsoft Teams).
 * Dynamically resolves location options for Event Type editors, Quick Schedule, and Session Wizards.
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Minimum 44px touch targets on UI selects consuming these options.
 * - Zero `any` or `any[]` typing.
 * - Always preserves the current value if previously configured, even if currently disconnected.
 */

'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { CalendarConnection } from '@/lib/types';
import type { MeetingLocationType } from '@/lib/meetings/types';

export interface LocationProviderOption {
  value: MeetingLocationType;
  label: string;
  isConnected: boolean;
  category: 'video' | 'offline';
  badge?: string;
}

export interface ConnectedMeetingProvidersState {
  hasGoogle: boolean;
  hasZoom: boolean;
  hasTeams: boolean;
  googleConnection: CalendarConnection | null;
  zoomConnection: CalendarConnection | null;
  teamsConnection: CalendarConnection | null;
  connectedCount: number;
  isLoading: boolean;
  getLocationOptions: (currentValue?: MeetingLocationType) => LocationProviderOption[];
  isLocationTypeConnected: (locType: MeetingLocationType) => boolean;
  getFirstAvailableVideoProvider: () => MeetingLocationType;
}

export function useConnectedMeetingProviders(
  workspaceId?: string
): ConnectedMeetingProvidersState {
  const firestore = useFirestore();

  // Real-time Firestore subscription to workspace connections
  const connectionsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'calendar_connections'),
      where('workspaceId', '==', workspaceId)
    );
  }, [firestore, workspaceId]);

  const { data: connections, isLoading } = useCollection<CalendarConnection>(connectionsQuery);

  const googleConnection = React.useMemo(() => {
    return connections?.find(c => c.provider === 'google_calendar') || null;
  }, [connections]);

  const zoomConnection = React.useMemo(() => {
    return connections?.find(c => c.provider === 'zoom') || null;
  }, [connections]);

  const teamsConnection = React.useMemo(() => {
    return (
      connections?.find(
        c => c.provider === 'microsoft_teams' || c.provider === 'microsoft_outlook'
      ) || null
    );
  }, [connections]);

  const hasGoogle = !!googleConnection;
  const hasZoom = !!zoomConnection;
  const hasTeams = !!teamsConnection;

  const connectedCount = React.useMemo(() => {
    return (hasGoogle ? 1 : 0) + (hasZoom ? 1 : 0) + (hasTeams ? 1 : 0);
  }, [hasGoogle, hasZoom, hasTeams]);

  const isLocationTypeConnected = React.useCallback(
    (locType: MeetingLocationType): boolean => {
      if (locType === 'google_meet') return hasGoogle;
      if (locType === 'zoom') return hasZoom;
      if (locType === 'teams') return hasTeams;
      return true; // Phone, in_person, and custom are always available
    },
    [hasGoogle, hasZoom, hasTeams]
  );

  const getFirstAvailableVideoProvider = React.useCallback((): MeetingLocationType => {
    if (hasGoogle) return 'google_meet';
    if (hasZoom) return 'zoom';
    if (hasTeams) return 'teams';
    return 'custom';
  }, [hasGoogle, hasZoom, hasTeams]);

  /**
   * Generates dynamic options for <Select> components.
   * If a currently active option is disconnected, retains it with an indicator so the UI does not break.
   */
  const getLocationOptions = React.useCallback(
    (currentValue?: MeetingLocationType): LocationProviderOption[] => {
      const options: LocationProviderOption[] = [];

      // 1. Google Meet
      if (hasGoogle) {
        options.push({
          value: 'google_meet',
          label: 'Google Meet',
          isConnected: true,
          category: 'video',
          badge: 'Connected',
        });
      } else if (currentValue === 'google_meet') {
        options.push({
          value: 'google_meet',
          label: 'Google Meet (Disconnected)',
          isConnected: false,
          category: 'video',
          badge: 'Setup Required',
        });
      }

      // 2. Zoom Video
      if (hasZoom) {
        options.push({
          value: 'zoom',
          label: 'Zoom Video',
          isConnected: true,
          category: 'video',
          badge: 'Connected',
        });
      } else if (currentValue === 'zoom') {
        options.push({
          value: 'zoom',
          label: 'Zoom Video (Disconnected)',
          isConnected: false,
          category: 'video',
          badge: 'Setup Required',
        });
      }

      // 3. Microsoft Teams
      if (hasTeams) {
        options.push({
          value: 'teams',
          label: 'Microsoft Teams',
          isConnected: true,
          category: 'video',
          badge: 'Connected',
        });
      } else if (currentValue === 'teams') {
        options.push({
          value: 'teams',
          label: 'Microsoft Teams (Disconnected)',
          isConnected: false,
          category: 'video',
          badge: 'Setup Required',
        });
      }

      // 4. Standard Offline / In-Person Options (Always Available)
      options.push(
        {
          value: 'phone',
          label: 'Phone Call',
          isConnected: true,
          category: 'offline',
        },
        {
          value: 'in_person',
          label: 'In-Person Address',
          isConnected: true,
          category: 'offline',
        },
        {
          value: 'custom',
          label: 'Custom Online Link',
          isConnected: true,
          category: 'offline',
        }
      );

      return options;
    },
    [hasGoogle, hasZoom, hasTeams]
  );

  return {
    hasGoogle,
    hasZoom,
    hasTeams,
    googleConnection,
    zoomConnection,
    teamsConnection,
    connectedCount,
    isLoading,
    getLocationOptions,
    isLocationTypeConnected,
    getFirstAvailableVideoProvider,
  };
}

'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Activity, UserProfile, WorkspaceEntity } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isSameDay } from 'date-fns';
import ActivityItem from './ActivityItem';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';

interface ActivityTimelineProps {
  entityId?: string | null; // Support filtering by entityId (Requirement 4.3)
  userId?: string | null;
  type?: string | null;
  zoneId?: string | null;
  limit?: number;
}

const DateSeparator = ({ date }: { date: string }) => {
    return (
 <div className="flex items-center pl-10 my-4 text-left">
 <div className="text-xs font-semibold text-muted-foreground tracking-wider">{date}</div>
 <div className="flex-grow border-t ml-4"></div>
        </div>
    );
};

export default function ActivityTimeline({ entityId, userId, type, zoneId, limit: dataLimit = 50 }: ActivityTimelineProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();

  // HIGH PERFORMANCE: Fetch pool of workspace-specific activities (Requirement 12).
  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    
    // SERVER-SIDE OPTIMIZATION: If filtering by entityId, request a scoped stream (Requirement 4.3).
    if (entityId && entityId !== 'all') {
        return query(
            collection(firestore, 'activities'),
            where('workspaceId', '==', activeWorkspaceId),
            where('entityId', '==', entityId),
            orderBy('timestamp', 'desc'),
            limit(dataLimit)
        );
    }

    return query(
        collection(firestore, 'activities'), 
        where('workspaceId', '==', activeWorkspaceId),
        orderBy('timestamp', 'desc'), 
        limit(200)
    );
  }, [firestore, activeWorkspaceId, entityId, dataLimit]);

  const { data: allActivities, isLoading: isLoadingActivities } = useCollection<Activity>(activitiesQuery);
  
  // ORG-AWARE USER LOOKUP
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
        collection(firestore, 'users'), 
        where('organizationId', '==', activeOrganizationId)
    );
  }, [firestore, activeOrganizationId]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  
  const { data: entities, isLoading: isLoadingEntities } = useCollection<WorkspaceEntity>(useMemoFirebase(() => firestore ? query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId)) : null, [firestore, activeWorkspaceId]));

  const isLoading = isLoadingActivities || isLoadingUsers || isLoadingEntities;

  const usersMap = React.useMemo(() => {
    if (!users) return new Map<string, UserProfile>();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);

  const entitiesInZone = React.useMemo(() => {
    // Note: Zone filtering might need identity join if zones move to global Entity InstitutionalData
    // For now, we look for entities that might have zone context or we filter by entityId list
    if (!entities || !zoneId || zoneId === 'all') return null;
    return new Set(entities.map(s => s.id)); // Placeholder until zone mapping is finalized in WE
  }, [entities, zoneId]);

  // CLIENT-SIDE FILTERING: Refine the workspace-specific pool by sub-filters.
  // Updated to support entityId filtering with entityId fallback (Requirement 4.3, 4.5)
  const filteredActivities = React.useMemo(() => {
    if (!allActivities) return [];

    let filtered = allActivities;

    if (zoneId && zoneId !== 'all' && entitiesInZone) {
        filtered = filtered.filter(a => a.entityId && entitiesInZone.has(a.entityId));
    }
    // Filter by entityId (Requirement 4.3, 4.5)
    if (entityId && entityId !== 'all') {
        filtered = filtered.filter(a => a.entityId === entityId);
    }
    if (userId && userId !== 'all') {
        filtered = filtered.filter(a => a.userId === userId);
    }
    if (type && type !== 'all') {
        filtered = filtered.filter(a => a.type === type);
    }

    return filtered.slice(0, dataLimit);
  }, [allActivities, entityId, userId, type, zoneId, entitiesInZone, dataLimit]);

  const groupedActivities = React.useMemo(() => {
    const grouped = filteredActivities.reduce((acc, activity) => {
        const activityDate = new Date(activity.timestamp);
        let dateLabel: string;
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
    
        if (isSameDay(activityDate, today)) {
          dateLabel = 'Today';
        } else if (isSameDay(activityDate, yesterday)) {
          dateLabel = 'Yesterday';
        } else {
          dateLabel = format(activityDate, 'PPP');
        }
    
        if (!acc[dateLabel]) {
          acc[dateLabel] = [];
        }
        acc[dateLabel].push(activity);
        return acc;
      }, {} as Record<string, Activity[]>);
    
      return Object.entries(grouped).map(([date, activities]) => ({ date, activities }));

  }, [filteredActivities]);

  if (isLoading) {
    return (
 <div className="space-y-8">
 <Skeleton className="h-4 w-24 ml-10 my-4" />
 <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="flex gap-4 pl-4">
 <Skeleton className="h-8 w-8 rounded-full" />
 <div className="flex-1 space-y-2">
 <Skeleton className="h-4 w-3/4" />
 <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            ))}
        </div>
      </div>
    );
  }
  
  if (filteredActivities.length === 0) {
      return (
 <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-muted/20">
 <p className="text-muted-foreground font-medium italic">No activity matching your criteria in this workspace.</p>
          </div>
      );
  }

  return (
 <div className="relative">
 <div className="absolute left-4 top-0 h-full w-0.5 bg-border -translate-x-1/2" />
 <div className="space-y-6">
            {groupedActivities.map((group) => (
                <div key={group.date}>
                    <DateSeparator date={group.date} />
 <div className="space-y-8">
                      {group.activities.map(activity => (
                           <ActivityItem
                              key={activity.id}
                              activity={activity}
                              user={activity.userId ? usersMap.get(activity.userId) : undefined}
                              showSchoolName={!entityId || entityId === 'all'}
                           />
                      ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
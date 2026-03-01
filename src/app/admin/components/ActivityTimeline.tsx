'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, type Query } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Activity, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isSameDay } from 'date-fns';
import ActivityItem from './ActivityItem';

interface ActivityTimelineProps {
  schoolId?: string | null;
  userId?: string | null;
  type?: string | null;
  limit?: number;
}

const DateSeparator = ({ date }: { date: string }) => {
    return (
        <div className="flex items-center pl-10 my-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{date}</div>
            <div className="flex-grow border-t ml-4"></div>
        </div>
    );
};

export default function ActivityTimeline({ schoolId, userId, type, limit: dataLimit = 50 }: ActivityTimelineProps) {
  const firestore = useFirestore();

  // HIGH PERFORMANCE: Fetch a pool of latest activities once.
  // This avoids complex composite index requirements for every filter combination.
  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    
    // We fetch a larger pool (up to 200) to ensure we have enough data for local filtering
    // while maintaining a simple, indexed query.
    return query(
        collection(firestore, 'activities'), 
        orderBy('timestamp', 'desc'), 
        limit(200)
    );
  }, [firestore]);

  const { data: allActivities, isLoading: isLoadingActivities } = useCollection<Activity>(activitiesQuery);
  
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));

  const isLoading = isLoadingActivities || isLoadingUsers;

  const usersMap = React.useMemo(() => {
    if (!users) return new Map<string, UserProfile>();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);

  // CLIENT-SIDE FILTERING: Apply filters in memory for instant UX and index-free reliability.
  const filteredActivities = React.useMemo(() => {
    if (!allActivities) return [];

    let filtered = allActivities;

    if (schoolId && schoolId !== 'all') {
        filtered = filtered.filter(a => a.schoolId === schoolId);
    }
    if (userId && userId !== 'all') {
        filtered = filtered.filter(a => a.userId === userId);
    }
    if (type && type !== 'all') {
        filtered = filtered.filter(a => a.type === type);
    }

    // Apply the requested UI limit after filtering
    return filtered.slice(0, dataLimit);
  }, [allActivities, schoolId, userId, type, dataLimit]);

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
              <p className="text-muted-foreground font-medium">No activities found matching your criteria.</p>
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
                              showSchoolName={!schoolId || schoolId === 'all'}
                           />
                      ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}

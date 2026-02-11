'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Activity, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { format, isSameDay } from 'date-fns';
import ActivityItem from './ActivityItem';

interface ActivityTimelineProps {
  schoolId: string;
}

const DateSeparator = ({ date }: { date: string }) => {
    return (
        <div className="flex items-center my-4">
            <div className="flex-grow border-t"></div>
            <span className="flex-shrink mx-4 text-xs font-medium text-muted-foreground">
                {date}
            </span>
            <div className="flex-grow border-t"></div>
        </div>
    );
};

export default function ActivityTimeline({ schoolId }: ActivityTimelineProps) {
  const firestore = useFirestore();

  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'activities'),
      where('schoolId', '==', schoolId),
      orderBy('timestamp', 'desc')
    );
  }, [firestore, schoolId]);

  const usersQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'users');
  }, [firestore]);

  const { data: activities, isLoading: isLoadingActivities } = useCollection<Activity>(activitiesQuery);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  
  const isLoading = isLoadingActivities || isLoadingUsers;

  const usersMap = React.useMemo(() => {
    if (!users) return new Map<string, UserProfile>();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);
  
  const groupedActivities = React.useMemo(() => {
    if (!activities) return [];

    const groups: { date: string; activities: Activity[] }[] = [];
    if (activities.length === 0) return groups;

    let currentDate = format(new Date(activities[0].timestamp), 'PPP');
    let currentGroup: Activity[] = [];

    activities.forEach(activity => {
        const activityDateStr = format(new Date(activity.timestamp), 'PPP');
        if (isSameDay(new Date(activity.timestamp), new Date())) {
            currentDate = 'Today';
        }

        if (activityDateStr === format(new Date(currentDate), 'PPP') || (currentDate === 'Today' && isSameDay(new Date(activity.timestamp), new Date()))) {
            currentGroup.push(activity);
        } else {
            groups.push({ date: currentDate, activities: currentGroup });
            currentDate = activityDateStr;
            currentGroup = [activity];
        }
    });

    if (currentGroup.length > 0) {
        groups.push({ date: currentDate, activities: currentGroup });
    }
    
    return groups;

  }, [activities]);


  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (!activities || activities.length === 0) {
      return (
          <div className="text-center py-12">
              <p className="text-muted-foreground">No activities recorded for this school yet.</p>
          </div>
      );
  }

  return (
    <div className="space-y-4">
        {groupedActivities.map((group, index) => (
            <React.Fragment key={group.date}>
                <DateSeparator date={group.date} />
                <div className="space-y-6">
                    {group.activities.map(activity => (
                         <ActivityItem
                            key={activity.id}
                            activity={activity}
                            user={activity.userId ? usersMap.get(activity.userId) : undefined}
                         />
                    ))}
                </div>
            </React.Fragment>
        ))}
    </div>
  );
}

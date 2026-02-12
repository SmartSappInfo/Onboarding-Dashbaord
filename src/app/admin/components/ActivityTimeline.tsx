'use client';

import * as React from 'react';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Activity, UserProfile, School } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isSameDay } from 'date-fns';
import ActivityItem from './ActivityItem';

interface ActivityTimelineProps {
  schoolId?: string;
  userId?: string;
}

const DateSeparator = ({ date }: { date: string }) => {
    return (
        <div className="flex items-center my-4">
            <div className="flex-grow border-t"></div>
            <span className="flex-shrink mx-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {date}
            </span>
            <div className="flex-grow border-t"></div>
        </div>
    );
};

export default function ActivityTimeline({ schoolId, userId }: ActivityTimelineProps) {
  const firestore = useFirestore();

  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    
    let q = query(collection(firestore, 'activities'), orderBy('timestamp', 'desc'), limit(50));
    
    if (schoolId) {
      q = query(q, where('schoolId', '==', schoolId));
    }
    if (userId) {
      q = query(q, where('userId', '==', userId));
    }

    return q;
  }, [firestore, schoolId, userId]);

  const { data: activities, isLoading: isLoadingActivities } = useCollection<Activity>(activitiesQuery);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(useMemoFirebase(() => firestore ? collection(firestore, 'schools') : null, [firestore]));

  const isLoading = isLoadingActivities || isLoadingUsers || isLoadingSchools;

  const usersMap = React.useMemo(() => {
    if (!users) return new Map<string, UserProfile>();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);
  
  const schoolsMap = React.useMemo(() => {
    if (!schools) return new Map<string, School>();
    return new Map(schools.map(school => [school.id, school]));
  }, [schools]);

  const groupedActivities = React.useMemo(() => {
    if (!activities) return [];

    const grouped = activities.reduce((acc, activity) => {
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
          dateLabel = format(activityDate, 'PPP'); // e.g., Jun 12, 2024
        }
    
        if (!acc[dateLabel]) {
          acc[dateLabel] = [];
        }
        acc[dateLabel].push(activity);
        return acc;
      }, {} as Record<string, Activity[]>);
    
      return Object.entries(grouped).map(([date, activities]) => ({ date, activities }));

  }, [activities]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-4 w-24 mx-auto my-4" />
        <div className="space-y-6">
            <div className="flex gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                </div>
            </div>
            <div className="flex gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
            </div>
             <div className="flex gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
        </div>
      </div>
    );
  }
  
  if (!activities || activities.length === 0) {
      return (
          <div className="text-center py-16">
              <p className="text-muted-foreground">No activities recorded yet.</p>
          </div>
      );
  }

  return (
    <div className="space-y-4">
        {groupedActivities.map((group) => (
            <div key={group.date}>
                <DateSeparator date={group.date} />
                <div className="relative">
                    <div className="absolute left-[18px] top-3 bottom-3 w-0.5 bg-border -translate-x-1/2" />
                    <div className="space-y-2">
                      {group.activities.map(activity => (
                           <ActivityItem
                              key={activity.id}
                              activity={activity}
                              user={activity.userId ? usersMap.get(activity.userId) : undefined}
                              school={schoolsMap.get(activity.schoolId)}
                              showSchoolName={!schoolId}
                           />
                      ))}
                    </div>
                </div>
            </div>
        ))}
    </div>
  );
}

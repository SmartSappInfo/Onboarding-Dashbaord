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
            <span className="flex-shrink mx-4 text-xs font-medium text-muted-foreground">
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

    const groups: { date: string; activities: Activity[] }[] = [];
    if (activities.length === 0) return groups;

    let currentDateStr = format(new Date(activities[0].timestamp), 'PPP');
    let currentGroup: Activity[] = [];

    activities.forEach(activity => {
        const activityDate = new Date(activity.timestamp);
        const activityDateStr = isSameDay(activityDate, new Date()) ? 'Today' : format(activityDate, 'PPP');

        if (activityDateStr === currentDateStr) {
            currentGroup.push(activity);
        } else {
            if (currentGroup.length > 0) {
                groups.push({ date: currentDateStr, activities: currentGroup });
            }
            currentDateStr = activityDateStr;
            currentGroup = [activity];
        }
    });

    if (currentGroup.length > 0) {
        groups.push({ date: currentDateStr, activities: currentGroup });
    }
    
    return groups;

  }, [activities]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <React.Fragment key={i}>
            {i === 0 && <Skeleton className="h-4 w-24 mx-auto my-4" />}
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  }
  
  if (!activities || activities.length === 0) {
      return (
          <div className="text-center py-12">
              <p className="text-muted-foreground">No activities recorded yet.</p>
          </div>
      );
  }

  return (
    <div className="space-y-4">
        {groupedActivities.map((group) => (
            <React.Fragment key={group.date}>
                <DateSeparator date={group.date} />
                <div className="space-y-6">
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
            </React.Fragment>
        ))}
    </div>
  );
}

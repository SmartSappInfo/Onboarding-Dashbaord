
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Activity, School } from '@/lib/types';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import ActivityCard from './components/ActivityCard';
import { Skeleton } from '@/components/ui/skeleton';
import { PartyPopper } from 'lucide-react';
import LogActivityForm from './components/LogActivityForm';

function ActivitySkeleton() {
    return (
        <div className="relative flex items-start">
             <span className="absolute left-6 top-6 -bottom-6 w-0.5 bg-border" />
             <div className="relative z-10">
                <Skeleton className="h-12 w-12 rounded-full" />
             </div>
             <div className="ml-6 flex-1 space-y-2">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-80" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </div>
             </div>
        </div>
    )
}

export default function ActivitiesPage() {
    const firestore = useFirestore();
    const { assignedUserId, isLoading: isFilterLoading } = useGlobalFilter();

    const activitiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'activities'), orderBy('timestamp', 'desc')) : null, [firestore]);
    const { data: activities, isLoading: areActivitiesLoading } = useCollection<Activity>(activitiesQuery);

    const schoolsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'schools') : null, [firestore]);
    const { data: schools, isLoading: areSchoolsLoading } = useCollection<School>(schoolsQuery);

    const isLoading = isFilterLoading || areActivitiesLoading || areSchoolsLoading;

    const schoolAssignmentMap = React.useMemo(() => {
        if (!schools) return new Map<string, string | null>();
        return new Map(schools.map(s => [s.id, s.assignedTo?.userId || null]));
    }, [schools]);

    const filteredActivities = React.useMemo(() => {
        if (!activities) return [];
        if (assignedUserId === null) return activities; // 'all' is selected

        return activities.filter(activity => {
            const schoolAssignedTo = schoolAssignmentMap.get(activity.schoolId);
            if (assignedUserId === 'unassigned') {
                return schoolAssignedTo === null;
            }
            return schoolAssignedTo === assignedUserId;
        });

    }, [activities, assignedUserId, schoolAssignmentMap]);
    
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
            <LogActivityForm />
            {isLoading ? (
                <>
                  <ActivitySkeleton />
                  <ActivitySkeleton />
                  <ActivitySkeleton />
                </>
            ) : filteredActivities && filteredActivities.length > 0 ? (
                filteredActivities.map((activity, index) => (
                    <ActivityCard 
                        key={activity.id} 
                        activity={activity}
                        isLast={index === filteredActivities.length - 1}
                    />
                ))
            ) : (
                <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/50 mb-4">
                        <PartyPopper className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-semibold">All Caught Up!</h3>
                    <p className="text-muted-foreground mt-2">There are no activities to show for this selection.</p>
                </div>
            )}
        </div>
    </div>
  );
}

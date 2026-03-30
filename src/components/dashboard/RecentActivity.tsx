
'use client';
import DashboardCard from "./DashboardCard";
import type { Activity, UserProfile, School } from '@/lib/types';
import ActivityItem from '@/app/admin/components/ActivityItem';
import { Button } from "../ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import * as React from 'react';

// This component now receives all necessary data as props
// Updated to support both entityId (migrated) and schoolId (legacy) references
// Requirements: 6.2, 6.4
export function RecentActivity({ 
  activities, 
  users, 
  schools, 
  entities 
}: { 
  activities: Activity[], 
  users: UserProfile[], 
  schools: School[],
  entities?: any[] // workspace_entities for migrated contacts
}) {
  
  const usersMap = React.useMemo(() => {
    if (!users) return new Map<string, UserProfile>();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);
  
  const schoolsMap = React.useMemo(() => {
    if (!schools) return new Map<string, School>();
    return new Map(schools.map(school => [school.id, school]));
  }, [schools]);
  
  // Map workspace_entities by entityId for quick lookup
  const entitiesMap = React.useMemo(() => {
    if (!entities) return new Map<string, any>();
    return new Map(entities.map(entity => [entity.entityId, entity]));
  }, [entities]);
  
  // Helper to resolve contact for an activity (supports both entityId and schoolId)
  const resolveContact = React.useCallback((activity: Activity) => {
    // Prefer entityId if available (migrated contacts)
    if (activity.entityId && entitiesMap.has(activity.entityId)) {
      return entitiesMap.get(activity.entityId);
    }
    // Fallback to schoolId (legacy contacts)
    if (activity.schoolId && schoolsMap.has(activity.schoolId)) {
      return schoolsMap.get(activity.schoolId);
    }
    return undefined;
  }, [entitiesMap, schoolsMap]);

  return (
    <DashboardCard title="Recent Activity">
      <div className="relative h-96">
        <div className="absolute inset-0 overflow-y-auto pr-4">
            <div className="relative space-y-6">
                <div className="absolute left-4 top-0 h-full w-0.5 bg-border -translate-x-1/2" />
                {activities.length > 0 ? (
                    activities.map(activity => {
                        const contact = resolveContact(activity);
                        return (
                            <ActivityItem
                                key={activity.id}
                                activity={activity}
                                user={activity.userId ? usersMap.get(activity.userId) : undefined}
                                school={contact}
                                showSchoolName={true}
                            />
                        );
                    })
                ) : (
                    <p className="text-muted-foreground text-sm text-center pt-10">No recent activity.</p>
                )}
            </div>
        </div>
      </div>
      <div className="flex justify-end pt-4 -mb-4">
        <Button variant="link" asChild>
          <Link href="/admin/activities">
            View all activity <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </DashboardCard>
  )
}

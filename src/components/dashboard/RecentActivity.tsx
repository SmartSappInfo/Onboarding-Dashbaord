
'use client';
import DashboardCard from "./DashboardCard";
import type { Activity, UserProfile, School } from '@/lib/types';
import ActivityItem from '@/app/admin/components/ActivityItem';
import { Button } from "../ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import * as React from 'react';

// This component now receives all necessary data as props
export function RecentActivity({ activities, users, schools }: { activities: Activity[], users: UserProfile[], schools: School[] }) {
  
  const usersMap = React.useMemo(() => {
    if (!users) return new Map<string, UserProfile>();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);
  
  const schoolsMap = React.useMemo(() => {
    if (!schools) return new Map<string, School>();
    return new Map(schools.map(school => [school.id, school]));
  }, [schools]);

  return (
    <DashboardCard title="Recent Activity">
      <div className="relative h-96">
        <div className="absolute inset-0 overflow-y-auto pr-4">
            <div className="relative space-y-6">
                <div className="absolute left-4 top-0 h-full w-0.5 bg-border -translate-x-1/2" />
                {activities.length > 0 ? (
                    activities.map(activity => (
                        <ActivityItem
                            key={activity.id}
                            activity={activity}
                            user={activity.userId ? usersMap.get(activity.userId) : undefined}
                            school={activity.schoolId ? schoolsMap.get(activity.schoolId) : undefined}
                            showSchoolName={true}
                        />
                    ))
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


'use client';
import DashboardCard from "./DashboardCard";
import type { Activity, UserProfile, School } from '@/lib/types';
import ActivityItem from '@/app/admin/components/ActivityItem';
import { Button } from "../ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import * as React from 'react';

// This component now receives all necessary data as props
// Updated to support both entityId (migrated) and entityId (legacy) references
// Requirements: 6.2, 6.4
import { ScrollArea } from "@/components/ui/scroll-area";

export function RecentActivity({ 
  activities, 
  users, 
  schools, 
  entities,
  terminology = { singular: 'Entity', plural: 'Entities' }
}: { 
  activities: Activity[], 
  users: UserProfile[], 
  schools: School[],
  entities?: any[], // workspace_entities for migrated contacts
  terminology?: { singular: string, plural: string }
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
  
  // Helper to resolve contact for an activity (supports both entityId and entityId)
  const resolveContact = React.useCallback((activity: Activity) => {
    // Prefer entityId if available (migrated contacts)
    if (activity.entityId && entitiesMap.has(activity.entityId)) {
      return entitiesMap.get(activity.entityId);
    }
    // Fallback to entityId (legacy contacts)
    if (activity.entityId && schoolsMap.has(activity.entityId)) {
      return schoolsMap.get(activity.entityId);
    }
    return undefined;
  }, [entitiesMap, schoolsMap]);

  return (
    <DashboardCard title="Recent Activity" terminology={terminology} className="flex flex-col">
      <ScrollArea className="flex-1 -mx-2 px-2 h-[450px]">
        <div className="relative space-y-7 pb-4">
            <div className="absolute left-4 top-0 h-full w-[1px] bg-border/40 -translate-x-1/2" />
            {activities.length > 0 ? (
                activities.map(activity => {
                    const contact = resolveContact(activity);
                    return (
                            <ActivityItem
                                key={activity.id}
                                activity={activity}
                                user={activity.userId ? usersMap.get(activity.userId) : undefined}
                                entity={contact}
                                showEntityName={true}
                            />
                    );
                })
            ) : (
                <p className="text-muted-foreground text-[10px] font-bold uppercase text-center pt-20 tracking-widest opacity-30">
                  No recent movements detected
                </p>
            )}
        </div>
      </ScrollArea>
      <div className="flex justify-start pt-6">
        <Button variant="outline" asChild className="rounded-xl font-bold h-10 border-primary/10 hover:bg-primary/5 hover:text-primary transition-all group">
          <Link href="/admin/activities" className="flex items-center">
            Operational History <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </div>
    </DashboardCard>
  )
}

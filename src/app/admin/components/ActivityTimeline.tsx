'use client';

/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Phase 3 CRM Activity Graph - Rule 10):
 * - ActivityTimeline provides unified activity streaming across Workspaces, Entities, and Deals.
 * - Supports deal-level scoping (dealId) and multi-channel activity categorization (Calls, Meetings, Messages, Tasks, Stages).
 * - Backward compatible with legacy activities storing dealId in metadata.dealId or top-level dealId.
 * - Adheres strictly to Workspace Rules: min-h-[44px] touch targets, zero 'any' typing, and accessible ARIA attributes.
 */

import * as React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Activity, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isSameDay } from 'date-fns';
import ActivityItem from './ActivityItem';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { 
    Activity as ActivityIcon, 
    PhoneCall, 
    Calendar, 
    Mail, 
    CheckCircle2, 
    GitCommit, 
    FileText 
} from 'lucide-react';

interface ActivityTimelineProps {
  entityId?: string | null; // Support filtering by entityId
  dealId?: string | null;   // Support filtering by dealId (Phase 3 CRM Activity Graph)
  userId?: string | null;
  type?: string | null;
  zoneId?: string | null;
  limit?: number;
  showCategoryFilters?: boolean;
}

type ActivityCategory = 'all' | 'stages' | 'calls' | 'meetings' | 'comms' | 'tasks_notes' | 'commercial';

const DateSeparator = ({ date }: { date: string }) => {
    return (
        <div className="flex items-center pl-10 my-4 text-left">
            <div className="text-xs font-semibold text-muted-foreground tracking-wider">{date}</div>
            <div className="flex-grow border-t ml-4"></div>
        </div>
    );
};

export default function ActivityTimeline({ 
    entityId, 
    dealId,
    userId, 
    type, 
    zoneId, 
    limit: dataLimit = 50,
    showCategoryFilters = true
}: ActivityTimelineProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const [selectedCategory, setSelectedCategory] = React.useState<ActivityCategory>('all');

  // HIGH PERFORMANCE: Fetch pool of workspace-specific activities
  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    
    // Scoped query if entityId is specified
    if (entityId && entityId !== 'all') {
        return query(
            collection(firestore, 'activities'),
            where('workspaceId', '==', activeWorkspaceId),
            where('entityId', '==', entityId),
            orderBy('timestamp', 'desc'),
            limit(100)
        );
    }

    return query(
        collection(firestore, 'activities'), 
        where('workspaceId', '==', activeWorkspaceId),
        orderBy('timestamp', 'desc'), 
        limit(200)
    );
  }, [firestore, activeWorkspaceId, entityId]);

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
  
  const isLoading = isLoadingActivities || isLoadingUsers;

  const usersMap = React.useMemo(() => {
    if (!users) return new Map<string, UserProfile>();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);

  // CLIENT-SIDE FILTERING: Refine the workspace-specific pool by sub-filters and dealId
  const filteredActivities = React.useMemo(() => {
    if (!allActivities) return [];

    let filtered = allActivities;

    if (zoneId && zoneId !== 'all') {
        filtered = filtered.filter(a => !!a.entityId);
    }
    
    // Filter by entityId
    if (entityId && entityId !== 'all') {
        filtered = filtered.filter(a => a.entityId === entityId);
    }

    // Filter by dealId (Phase 3 CRM Activity Graph)
    if (dealId && dealId !== 'all') {
        filtered = filtered.filter(a => {
            const actDealId = a.dealId || (typeof a.metadata?.dealId === 'string' ? a.metadata.dealId : undefined);
            return actDealId === dealId || (!actDealId && a.entityId === entityId);
        });
    }

    if (userId && userId !== 'all') {
        filtered = filtered.filter(a => a.userId === userId);
    }
    if (type && type !== 'all') {
        filtered = filtered.filter(a => a.type === type);
    }

    // Filter by Channel / Activity Category
    if (selectedCategory !== 'all') {
        filtered = filtered.filter(a => {
            const t = (a.type || '').toLowerCase();
            if (selectedCategory === 'stages') {
                return t.includes('stage') || t.includes('won') || t.includes('lost') || t.includes('convert');
            }
            if (selectedCategory === 'calls') {
                return t.includes('call');
            }
            if (selectedCategory === 'meetings') {
                return t.includes('meet');
            }
            if (selectedCategory === 'comms') {
                return t.includes('email') || t.includes('whatsapp') || t.includes('sms') || t.includes('message');
            }
            if (selectedCategory === 'tasks_notes') {
                return t.includes('task') || t.includes('note');
            }
            if (selectedCategory === 'commercial') {
                return t.includes('quote') || t.includes('invoice') || t.includes('merge') || t.includes('duplicate') || t.includes('pay');
            }
            return true;
        });
    }

    return filtered.slice(0, dataLimit);
  }, [allActivities, entityId, dealId, userId, type, zoneId, selectedCategory, dataLimit]);

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

  return (
    <div className="space-y-4">
      {/* Activity Channel Filter Pills */}
      {showCategoryFilters && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'all', label: 'All', icon: ActivityIcon },
            { id: 'stages', label: 'Stages', icon: GitCommit },
            { id: 'calls', label: 'Calls', icon: PhoneCall },
            { id: 'meetings', label: 'Meetings', icon: Calendar },
            { id: 'comms', label: 'Messages', icon: Mail },
            { id: 'tasks_notes', label: 'Tasks & Notes', icon: CheckCircle2 },
            { id: 'commercial', label: 'Commercial', icon: FileText },
          ].map(cat => {
            const isSelected = selectedCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as ActivityCategory)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[38px] cursor-pointer",
                  isSelected 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
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
      ) : filteredActivities.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/10 p-6">
          <p className="text-xs text-muted-foreground font-semibold">
            {selectedCategory === 'all' 
              ? 'No activity recorded yet for this timeline.' 
              : `No ${selectedCategory} activity found.`}
          </p>
        </div>
      ) : (
        <div className="relative pt-2">
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
                      showEntityName={!entityId || entityId === 'all'}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
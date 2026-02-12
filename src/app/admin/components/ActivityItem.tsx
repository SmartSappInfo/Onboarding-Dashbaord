'use client';

import type { Activity, UserProfile, School } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User as UserIcon } from 'lucide-react';
import { getActivityIcon } from '@/lib/activity-icons';
import { cn } from '@/lib/utils';

interface ActivityItemProps {
  activity: Activity;
  user?: UserProfile;
  school?: School;
  showSchoolName?: boolean;
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

export default function ActivityItem({ activity, user, school, showSchoolName = false }: ActivityItemProps) {
  const Icon = getActivityIcon(activity.type);
  const isSystemEvent = !activity.userId || activity.source === 'system';
  
  const iconBgColor = activity.source === 'manual' 
    ? 'bg-primary/10 text-primary' 
    : 'bg-muted text-muted-foreground';

  return (
    <div className="relative pl-12 py-2">
      {/* Icon and Timeline Dot */}
      <div className="absolute left-[18px] top-3 transform -translate-x-1/2">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-full ring-8 ring-background", iconBgColor)}>
          {isSystemEvent ? (
            <Bot className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="space-y-1">
        <p className="text-sm text-foreground">
            {activity.description}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isSystemEvent ? (
            <span>System</span>
          ) : user ? (
            <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={user.photoURL} alt={user.name} />
                  <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <span>{user.name}</span>
            </div>
          ) : (
             <div className="flex items-center gap-1.5">
                <UserIcon className="h-4 w-4" />
                <span>Unknown User</span>
             </div>
          )}

          {showSchoolName && school && (
             <>
                <span>&middot;</span>
                <span className="font-semibold text-foreground">{school.name}</span>
             </>
          )}

          <span>&middot;</span>
          <time
            dateTime={activity.timestamp}
            title={format(new Date(activity.timestamp), "PPP p")}
          >
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
          </time>
        </div>
      </div>
    </div>
  );
}

'use client';

import type { Activity, UserProfile, School } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User as UserIcon } from 'lucide-react';
import { getActivityIcon } from '@/lib/activity-icons';
import Link from 'next/link';

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

  return (
    <div className="flex items-start gap-4">
      <div className="relative flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          {isSystemEvent ? (
            <Bot className="h-5 w-5 text-muted-foreground" />
          ) : user ? (
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.photoURL} alt={user.name} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          ) : (
             <Avatar className="h-9 w-9">
                <AvatarFallback><UserIcon className="h-5 w-5" /></AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-1 pt-1">
        <p className="text-sm text-foreground">
            {activity.description}
            {showSchoolName && school && (
                <span className="text-muted-foreground"> at <span className="font-semibold text-foreground">{school.name}</span></span>
            )}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{isSystemEvent ? 'System' : user?.name || 'Unknown User'}</span>
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

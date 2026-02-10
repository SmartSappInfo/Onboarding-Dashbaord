
'use client';

import type { Activity } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  School,
  Pencil,
  Workflow,
  UserCheck,
  CalendarPlus,
  CalendarClock,
  MessageSquare,
  User as UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';


const getIcon = (type: Activity['type']) => {
  const iconMap: Record<Activity['type'], React.ElementType> = {
    'school_created': School,
    'school_updated': Pencil,
    'stage_changed': Workflow,
    'user_assigned': UserCheck,
    'meeting_created': CalendarPlus,
    'meeting_updated': CalendarClock,
    'manual_log': MessageSquare,
  };
  return iconMap[type] || MessageSquare;
}

const renderDescription = (activity: Activity) => {
    const schoolLink = <Link href={`/admin/schools/${activity.schoolId}/edit`} className="font-semibold hover:underline">{activity.schoolName}</Link>;
    const user = <span className="font-semibold">{activity.userName || 'System'}</span>;

    switch (activity.type) {
        case 'school_created':
            return <>{user} created a new school: {schoolLink}.</>;
        case 'school_updated':
            return <>{user} updated details for {schoolLink}.</>;
        case 'stage_changed':
            const from = activity.details?.from ? `from "${activity.details.from}"` : '';
            const to = activity.details?.to ? `to "${activity.details.to}"` : '';
            return <>{user} moved {schoolLink} {from} {to}.</>;
        case 'user_assigned':
            const assignedTo = activity.details?.to || 'Unassigned';
            return <>{user} assigned {schoolLink} to {assignedTo}.</>;
        case 'meeting_created':
            return <>{user} scheduled a new meeting for {schoolLink}.</>;
        case 'meeting_updated':
            return <>{user} updated a meeting for {schoolLink}.</>;
        case 'manual_log': // Fallback for manual logs and other types
        default:
            // This allows simple string descriptions to still render correctly.
            // It replaces the school name with a link for consistency.
            if (activity.description.includes(activity.schoolName)) {
                const parts = activity.description.split(activity.schoolName);
                return (
                    <>
                        {parts[0]}
                        {schoolLink}
                        {parts[1]}
                    </>
                );
            }
            return <>{activity.description}</>;
    }
};

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={12} />;


export default function ActivityCard({ activity, isLast }: { activity: Activity, isLast?: boolean }) {
  const Icon = getIcon(activity.type);
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });

  return (
    <div className="relative flex items-start gap-6">
      {/* Timeline Connector */}
      {!isLast && <div className="absolute left-6 top-6 -bottom-6 w-0.5 bg-border" />}
      
      {/* Icon */}
      <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon className="h-6 w-6" />
      </div>

      {/* Content */}
      <div className="flex-1 pt-2.5">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={activity.userAvatarUrl || undefined} alt={activity.userName || 'User'} />
            <AvatarFallback>{getInitials(activity.userName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm text-foreground">
              {renderDescription(activity)}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

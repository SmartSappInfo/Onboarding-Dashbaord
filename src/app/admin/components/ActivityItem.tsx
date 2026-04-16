'use client';

import type { Activity, UserProfile, School } from '@/lib/types';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Building, Users, User } from 'lucide-react';
import { getActivityIcon } from '@/lib/activity-icons';

interface ActivityItemProps {
  activity: Activity;
  user?: UserProfile;
  showEntityName?: boolean;
  entity?: any;
}

// Entity type icons for visual distinction
const ENTITY_TYPE_ICONS = {
  institution: Building,
  family: Users,
  person: User,
};

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

/**
 * ActivityItem Component
 * 
 * Displays activity information with entity support.
 * Uses denormalized entity fields (displayName, entitySlug, entityType) for performance.
 * Falls back to legacy school fields for backward compatibility.
 * 
 * Requirements: 4.3, 4.5, 23.1, 23.3, 23.5 (Task 35.2)
 */
export default function ActivityItem({ activity, user, showEntityName = false }: ActivityItemProps) {
  const Icon = getActivityIcon(activity.type);
  const isSystemEvent = !activity.userId || activity.source === 'system';
  
  const hasContent = (activity.type === 'note' || activity.type === 'call' || activity.type === 'visit' || activity.type === 'email') && activity.metadata?.content;

  // Use denormalized entity information if available, fallback to legacy fields (Requirement 4.3, 23.5)
  const contactName = activity.displayName || activity.entityName || (activity as any).schoolName;
  const contactId = activity.entityId || (activity as any).schoolId;
  const contactSlug = activity.entitySlug || (activity as any).schoolSlug;
  const entityType = activity.entityType;
  const isLegacy = !activity.entityId && !!(activity as any).schoolId;
  
  const EntityIcon = entityType ? ENTITY_TYPE_ICONS[entityType] : Building;

  return (
    <div className="relative pl-10 group/item">
      {/* Icon on the timeline */}
      <div className="absolute -left-[18px] top-0 transform z-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-4 ring-background transition-all group-hover/item:scale-110 group-hover/item:bg-primary group-hover/item:text-white">
          {isSystemEvent ? (
            <Bot className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="ml-6 flex flex-col gap-1.5">
        {/* Header Line */}
        <div className="flex items-center flex-wrap gap-x-2 text-[11px] font-bold uppercase tracking-tight">
            {!isSystemEvent && user ? (
                <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 rounded-lg ring-2 ring-primary/5">
                        <AvatarImage src={user.photoURL} alt={user.name} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-black text-foreground">{user.name}</span>
                </div>
            ) : (
                <span className="font-black flex items-center gap-2 text-primary opacity-60">
                  <Bot className="h-3.5 w-3.5" /> 
                  System Core
                </span>
            )}
            
            <span className="text-muted-foreground/80 font-medium normal-case tracking-normal">
                {activity.description}
                {showEntityName && contactName && contactId && (
                    <> in <Link href={`/admin/entities/${contactId}`} className="font-black text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 group/link">
                        <div className="p-1 rounded-md bg-muted/30 group-hover/link:bg-primary/10 transition-colors">
                          <EntityIcon className="h-3 w-3" />
                        </div>
                        {contactName}
                        {entityType && (
                            <Badge className="bg-primary/10 text-primary border-none text-[8px] h-4 px-1.5 font-bold ml-1">
                                {entityType}
                            </Badge>
                        )}
                        {isLegacy && (
                            <Badge variant="outline" className="text-[8px] h-4 px-1.5 opacity-20 ml-1">
                                legacy
                            </Badge>
                        )}
                    </Link></>
                )}
            </span>
            
            <span className="text-muted-foreground/30">&middot;</span>
            
            <time
                dateTime={activity.timestamp}
                title={format(new Date(activity.timestamp), "PPP p")}
                className="text-muted-foreground/50 tabular-nums font-bold"
            >
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </time>
        </div>

        {/* Content Card for Notes/Calls etc. */}
        {hasContent && (
          <div className="mt-1">
            <Card className="bg-muted/10 border-none rounded-2xl shadow-inner">
                <CardContent className="p-4 text-xs font-medium leading-relaxed italic text-muted-foreground/80">
                    <p className="before:content-['“'] after:content-['”']">{activity.metadata.content}</p>
                </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

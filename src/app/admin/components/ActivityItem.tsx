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
 <div className="relative pl-10">
      {/* Icon on the timeline */}
 <div className="absolute -left-1 top-0.5 transform">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted ring-4 ring-background">
          {isSystemEvent ? (
 <Bot className="h-4 w-4" />
          ) : (
 <Icon className="h-4 w-4" />
          )}
        </div>
      </div>
      
      {/* Main Content */}
 <div className="ml-4">
        {/* Header Line */}
 <div className="flex items-center flex-wrap gap-x-2 text-sm">
            {!isSystemEvent && user ? (
 <div className="flex items-center gap-2">
 <Avatar className="h-6 w-6">
                        <AvatarImage src={user.photoURL} alt={user.name} />
 <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
 <span className="font-semibold">{user.name}</span>
                </div>
            ) : (
 <span className="font-semibold flex items-center gap-2"><Bot className="h-4 w-4" /> System</span>
            )}
            
 <span className="text-muted-foreground">
                {activity.description}
                {showEntityName && contactName && contactId && (
 <> in <Link href={`/admin/entities/${contactId}`} className="font-semibold text-foreground hover:underline inline-flex items-center gap-1">
 <EntityIcon className="h-3 w-3" />
                        {contactName}
                        {entityType && (
                            <Badge variant="outline" className="text-[8px] h-4 px-1 ml-1">
                                {entityType}
                            </Badge>
                        )}
                        {isLegacy && (
                            <Badge variant="secondary" className="text-[8px] h-4 px-1 ml-1">
                                legacy
                            </Badge>
                        )}
                    </Link></>
                )}
            </span>
            
 <span className="text-muted-foreground/80">&middot;</span>
            
            <time
                dateTime={activity.timestamp}
                title={format(new Date(activity.timestamp), "PPP p")}
 className="text-muted-foreground/80 whitespace-nowrap"
            >
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </time>
        </div>

        {/* Content Card for Notes/Calls etc. */}
        {hasContent && (
 <div className="mt-2">
 <Card className="bg-background shadow-none border">
 <CardContent className="p-4 text-sm">
 <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p>{activity.metadata.content}</p>
                    </div>
                </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

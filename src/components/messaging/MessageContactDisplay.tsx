'use client';

import * as React from 'react';
import { Building, Users, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { MessageLog } from '@/lib/types';

interface MessageContactDisplayProps {
  log: MessageLog;
  workspaceId: string;
}

// Entity type icons for visual distinction
const ENTITY_TYPE_ICONS = {
  institution: Building,
  family: Users,
  person: User,
};

/**
 * Displays contact information for a message log using the Contact Adapter pattern
 * Resolves entity information from either entityId or schoolId (fallback)
 * Handles both migrated and legacy contacts gracefully
 * 
 * Requirements: 15.4, 23.1, 23.3, 23.5 (Task 35.2)
 */
export function MessageContactDisplay({ log, workspaceId }: MessageContactDisplayProps) {
  const [contactName, setContactName] = React.useState<string | null>(null);
  const [entityType, setEntityType] = React.useState<'institution' | 'family' | 'person' | null>(null);
  const [isLegacy, setIsLegacy] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function resolveContact() {
      try {
        // Prefer entityId, fallback to schoolId (Requirement 23.1, 23.5)
        const identifier = log.entityId || log.schoolId;
        
        if (!identifier) {
          setContactName(null);
          setEntityType(null);
          setIsLegacy(false);
          setIsLoading(false);
          return;
        }

        // Use the contact adapter to resolve contact information (Requirement 23.3)
        const { resolveContact: resolveContactServer } = await import('@/lib/contact-adapter');
        const contact = await resolveContactServer(identifier, workspaceId);
        
        if (contact) {
          setContactName(contact.name);
          setEntityType(contact.entityType || 'institution');
          setIsLegacy(contact.migrationStatus === 'legacy');
        } else {
          // Fallback to denormalized fields if contact not found
          setContactName(log.displayName || log.schoolName || null);
          setEntityType(log.entityType || 'institution');
          setIsLegacy(!log.entityId);
        }
      } catch (error) {
        console.error('Error resolving contact for message:', error);
        // Fallback to denormalized fields on error
        setContactName(log.displayName || log.schoolName || null);
        setEntityType(log.entityType || 'institution');
        setIsLegacy(!log.entityId);
      } finally {
        setIsLoading(false);
      }
    }

    resolveContact();
  }, [log.entityId, log.schoolId, log.displayName, log.schoolName, log.entityType, workspaceId]);

  if (isLoading) {
    return <Skeleton className="h-4 w-32" />;
  }

  if (!contactName) {
    return <span className="text-xs text-muted-foreground italic">No contact</span>;
  }

  const EntityIcon = entityType ? ENTITY_TYPE_ICONS[entityType] : Building;

  return (
    <div className="flex items-center gap-2">
      <EntityIcon className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-bold truncate max-w-[150px]">{contactName}</span>
      {entityType && (
        <Badge variant="outline" className="text-[8px] h-4 px-1">
          {entityType}
        </Badge>
      )}
      {isLegacy && (
        <Badge variant="secondary" className="text-[8px] h-4 px-1">
          legacy
        </Badge>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { Building, Users, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ContactDisplayProps {
  entityId?: string | null;
  entityId?: string | null;
  displayName?: string | null;
  entityName?: string | null;
  entityType?: 'institution' | 'family' | 'person' | null;
  workspaceId: string;
  showType?: boolean;
  showLegacyBadge?: boolean;
  className?: string;
  iconClassName?: string;
  nameClassName?: string;
}

// Entity type icons for visual distinction
const ENTITY_TYPE_ICONS = {
  institution: Building,
  family: Users,
  person: User,
};

/**
 * ContactDisplay Component
 * 
 * A reusable component for displaying contact information across the application.
 * Uses the Contact Adapter to resolve entity information from either entityId or entityId.
 * Handles both migrated and legacy contacts gracefully with fallback to denormalized fields.
 * 
 * Requirements: 23.1, 23.3, 23.5 (Task 35.2)
 * 
 * @example
 * // With entityId (migrated contact)
 * <ContactDisplay 
 *   entityId="entity_123" 
 *   workspaceId="workspace_456"
 *   showType
 *   showLegacyBadge
 * />
 * 
 * @example
 * // With entityId (legacy contact)
 * <ContactDisplay 
 *   entityId="school_789" 
 *   entityName="Test School"
 *   workspaceId="workspace_456"
 * />
 * 
 * @example
 * // With denormalized fields (no adapter lookup)
 * <ContactDisplay 
 *   displayName="Test Contact"
 *   entityType="institution"
 *   workspaceId="workspace_456"
 *   showType
 * />
 */
export function ContactDisplay({
  entityId,
  displayName,
  entityName,
  entityType: providedEntityType,
  workspaceId,
  showType = false,
  showLegacyBadge = false,
  className,
  iconClassName,
  nameClassName,
}: ContactDisplayProps) {
  const [contactName, setContactName] = React.useState<string | null>(displayName || entityName || null);
  const [entityType, setEntityType] = React.useState<'institution' | 'family' | 'person' | null>(providedEntityType || null);
  const [isLegacy, setIsLegacy] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [shouldResolve, setShouldResolve] = React.useState(false);

  // Determine if we need to resolve via Contact Adapter
  React.useEffect(() => {
    // If we have denormalized fields, use them directly (no adapter lookup needed)
    if (displayName || entityName) {
      setContactName(displayName ?? entityName ?? null);
      setEntityType(providedEntityType ?? null);
      setIsLegacy(!entityId && !!entityId);
      setShouldResolve(false);
      return;
    }

    // If we only have IDs, we need to resolve via adapter
    if (entityId || entityId) {
      setShouldResolve(true);
    }
  }, [entityId, displayName, entityName, providedEntityType]);

  // Resolve contact via Contact Adapter if needed
  React.useEffect(() => {
    if (!shouldResolve) return;

    async function resolveContact() {
      setIsLoading(true);
      try {
        const identifier = entityId || entityId;
        
        if (!identifier) {
          setContactName(null);
          setEntityType(null);
          setIsLegacy(false);
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
          // Fallback to null if contact not found
          setContactName(null);
          setEntityType(null);
          setIsLegacy(!entityId);
        }
      } catch (error) {
        console.error('Error resolving contact:', error);
        // Fallback to null on error
        setContactName(null);
        setEntityType(null);
        setIsLegacy(!entityId);
      } finally {
        setIsLoading(false);
      }
    }

    resolveContact();
  }, [shouldResolve, entityId, workspaceId]);

  if (isLoading) {
    return <Skeleton className={cn("h-4 w-32", className)} />;
  }

  if (!contactName) {
    return <span className={cn("text-xs text-muted-foreground italic", className)}>No contact</span>;
  }

  const EntityIcon = entityType ? ENTITY_TYPE_ICONS[entityType] : Building;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <EntityIcon className={cn("h-4 w-4 text-muted-foreground flex-shrink-0", iconClassName)} />
      <span className={cn("text-sm font-medium truncate", nameClassName)}>{contactName}</span>
      {showType && entityType && (
        <Badge variant="outline" className="text-xs">
          {entityType}
        </Badge>
      )}
      {showLegacyBadge && isLegacy && (
        <Badge variant="secondary" className="text-xs">
          legacy
        </Badge>
      )}
    </div>
  );
}

/**
 * ContactDisplayInline Component
 * 
 * A compact inline variant for displaying contact names in text flows.
 * 
 * Requirements: 23.1, 23.3, 23.5 (Task 35.2)
 */
export function ContactDisplayInline({
  entityId,
  displayName,
  entityName,
  entityType: providedEntityType,
  workspaceId,
  showType = false,
  showLegacyBadge = false,
  className,
}: ContactDisplayProps) {
  return (
    <ContactDisplay
      entityId={entityId}
      entityId={entityId}
      displayName={displayName}
      entityName={entityName}
      entityType={providedEntityType}
      workspaceId={workspaceId}
      showType={showType}
      showLegacyBadge={showLegacyBadge}
      className={cn("inline-flex", className)}
      iconClassName="h-3 w-3"
      nameClassName="text-xs"
    />
  );
}

import * as React from 'react';
import { useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { adminDb } from '@/lib/firebase-admin'; // Only available on server, use useDoc for client
import type { WorkspaceEntity } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { Mail, Phone, ExternalLink, Activity, Users, MapPin, Tag } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { getEntityEmail, getEntityPhone, getContactPerson } from '@/lib/entity-helpers';

interface EntityContextPanelProps {
  entityId: string;
}

export default function EntityContextPanel({ entityId }: EntityContextPanelProps) {
  const firestore = useFirestore();
  
  // Actually, we should fetch from entities or workspace_entities depending on architecture.
  // Since we migrated, we can query `entities`
  const { data: entity, isLoading } = useDoc<WorkspaceEntity>(
    firestore && entityId ? doc(firestore, 'entities', entityId) : null
  );

  if (isLoading) {
    return (
      <div className="w-72 shrink-0 border-l border-border bg-background p-6 space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2 flex flex-col items-center">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="space-y-4 pt-6 border-t border-border/50">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="w-72 shrink-0 border-l border-border bg-background p-6 flex flex-col items-center justify-center text-center">
        <Users className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-semibold text-muted-foreground">Entity context unavailable</p>
      </div>
    );
  }

  const email = getEntityEmail(entity) || entity.primaryEmail;
  const phone = getEntityPhone(entity) || entity.primaryPhone;
  const contactPerson = getContactPerson(entity) || entity.primaryContactName;
  const initials = entity.displayName?.substring(0, 2).toUpperCase() || 'EN';

  return (
    <div className="w-72 shrink-0 border-l border-border bg-background flex flex-col h-full overflow-y-auto hidden lg:flex shadow-[-2px_0_10px_rgba(0,0,0,0.02)] z-10">
      {/* Profile Header */}
      <div className="p-6 flex flex-col items-center text-center relative border-b border-border/50 bg-muted/5">
        <Avatar className="h-24 w-24 border-4 border-background shadow-xl mb-4 relative z-10 bg-primary/5 text-primary">
          <AvatarFallback className="text-2xl font-bold">{initials}</AvatarFallback>
        </Avatar>
        
        <h3 className="text-lg font-bold tracking-tight text-foreground">{entity.displayName}</h3>
        {contactPerson && (
          <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {contactPerson}
          </p>
        )}
        
        {entity.lifecycleStatus && (
          <Badge variant="outline" className="mt-3 text-[10px] uppercase font-bold px-2 py-0.5 bg-primary/5 text-primary border-primary/20">
            {entity.lifecycleStatus}
          </Badge>
        )}
      </div>

      {/* Contact Info */}
      <div className="p-6 space-y-5 flex-1">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Contact Details</h4>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground">Email</p>
              {email ? (
                <a href={`mailto:${email}`} className="text-sm font-bold text-foreground hover:text-primary hover:underline truncate block">
                  {email}
                </a>
              ) : <p className="text-sm font-medium text-muted-foreground">Unknown</p>}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 shrink-0">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground">Phone</p>
              {phone ? (
                <a href={`tel:${phone.replace(/[\s-()]/g, '')}`} className="text-sm font-bold text-foreground hover:text-primary hover:underline truncate block">
                  {phone}
                </a>
              ) : <p className="text-sm font-medium text-muted-foreground">Unknown</p>}
            </div>
          </div>

          {(entity.locationString || entity.location?.locationString) && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground">Location</p>
                <p className="text-sm font-medium text-foreground leading-tight">
                  {entity.locationString || entity.location?.locationString}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div className="p-6 bg-muted/10 border-t border-border/50 shrink-0">
        <Button variant="outline" asChild className="w-full h-11 rounded-xl font-bold bg-background shadow-sm hover:bg-muted/50 transition-all gap-2">
          <Link href={`/admin/entities?id=${entity.entityId || entity.id}`}>
            View Full Profile <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

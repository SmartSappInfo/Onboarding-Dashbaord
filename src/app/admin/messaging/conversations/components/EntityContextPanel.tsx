import * as React from 'react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { WorkspaceEntity } from '@/lib/types';
import {
  Mail,
  Phone,
  ExternalLink,
  Users,
  MapPin,
  Building2,
  CheckCircle2,
  XCircle,
  Smartphone,
  Copy,
  Check,
  PanelRightClose,
  MessageSquare,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { getEntityEmail, getEntityPhone, getContactPerson } from '@/lib/entity-helpers';
import type { ThreadGroup } from '../ConversationsClient';
import { cn } from '@/lib/utils';

export interface EntityContextPanelProps {
  entityId?: string | null;
  thread: ThreadGroup;
  onClose?: () => void;
  className?: string;
}

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default function EntityContextPanel({
  entityId: propEntityId,
  thread,
  onClose,
  className,
}: EntityContextPanelProps) {
  const firestore = useFirestore();
  const [copied, setCopied] = React.useState(false);

  // Extract verified entity document ID (ignoring raw phone/email recipient strings)
  const resolvedEntityId =
    thread.realEntityId ||
    propEntityId ||
    thread.messages.find((m) => Boolean(m.entityId))?.entityId ||
    (thread.entityId && !thread.entityId.includes('@') && !thread.entityId.startsWith('+')
      ? thread.entityId
      : null);

  // Memoize DocumentReference with useMemoFirebase to eliminate infinite loading skeleton loop
  const docRef = useMemoFirebase(() => {
    if (!firestore || !resolvedEntityId) return null;
    return doc(firestore, 'entities', resolvedEntityId);
  }, [firestore, resolvedEntityId]);

  const { data: entity, isLoading } = useDoc<WorkspaceEntity>(docRef);

  const handleCopyContactInfo = React.useCallback(() => {
    const details = [
      thread.contactName,
      thread.institutionName ? `Institution: ${thread.institutionName}` : '',
      thread.email ? `Email: ${thread.email}` : '',
      thread.phone ? `Phone: ${thread.phone}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(details).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [thread]);

  if (isLoading) {
    return (
      <div
        data-testid="entity-context-skeleton"
        className={cn(
          'w-72 shrink-0 border-l border-border bg-background p-6 space-y-6 flex flex-col h-full z-10',
          className
        )}
      >
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <Skeleton className="h-4 w-28" />
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close details panel"
              className="h-8 w-8 rounded-lg active:scale-[0.97]"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          )}
        </div>
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

  // If CRM WorkspaceEntity record exists in Firestore, render full entity view
  if (entity) {
    const email = getEntityEmail(entity) || entity.primaryEmail;
    const phone = getEntityPhone(entity) || entity.primaryPhone;
    const contactPerson = getContactPerson(entity) || entity.primaryContactName;
    const initials = entity.displayName?.substring(0, 2).toUpperCase() || 'EN';

    return (
      <div
        className={cn(
          'w-72 shrink-0 border-l border-border bg-background flex flex-col h-full overflow-y-auto hidden lg:flex shadow-[-2px_0_10px_rgba(0,0,0,0.02)] z-10',
          className
        )}
      >
        {/* Panel Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-muted/10">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Entity Details
          </span>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close details panel"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Profile Card Header */}
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

          {entity.status && (
            <Badge
              variant="outline"
              className="mt-3 text-[10px] uppercase font-bold px-2 py-0.5 bg-primary/5 text-primary border-primary/20"
            >
              {entity.status}
            </Badge>
          )}
        </div>

        {/* Contact Info */}
        <div className="p-6 space-y-5 flex-1">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Contact Details
          </h4>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground">Email</p>
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="text-sm font-bold text-foreground hover:text-primary hover:underline truncate block"
                  >
                    {email}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">Unknown</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground">Phone</p>
                {phone ? (
                  <a
                    href={`tel:${phone.replace(/[\s-()]/g, '')}`}
                    className="text-sm font-bold text-foreground hover:text-primary hover:underline truncate block"
                  >
                    {phone}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">Unknown</p>
                )}
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
          <Button
            variant="outline"
            asChild
            className="w-full h-11 rounded-xl font-bold bg-background shadow-sm hover:bg-muted/50 transition-all gap-2 min-h-[44px] active:scale-[0.97]"
          >
            <Link href={`/admin/entities?id=${entity.entityId || entity.id}`}>
              View Full Profile <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Universal Fallback View for Ad-Hoc / Direct Broadcast Recipients
  const displayName = thread.contactName || thread.entityName || 'Direct Contact';
  const initials = displayName.substring(0, 2).toUpperCase();
  const channelsUsed = Array.from(new Set(thread.messages.map((m) => m.channel)));
  const deliveredCount = thread.messages.filter((m) => m.status === 'sent').length;
  const failedCount = thread.messages.filter((m) => m.status === 'failed').length;

  return (
    <div
      className={cn(
        'w-72 shrink-0 border-l border-border bg-background flex flex-col h-full overflow-y-auto hidden lg:flex shadow-[-2px_0_10px_rgba(0,0,0,0.02)] z-10',
        className
      )}
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-muted/10">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Contact Details
        </span>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close details panel"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97]"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Profile Card Header */}
      <div className="p-6 flex flex-col items-center text-center relative border-b border-border/50 bg-muted/5">
        <Avatar className="h-20 w-20 border-4 border-background shadow-md mb-3 relative z-10 bg-primary/10 text-primary">
          <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
        </Avatar>

        <h3 className="text-base font-bold tracking-tight text-foreground truncate max-w-full">
          {displayName}
        </h3>

        {thread.institutionName && (
          <p className="text-xs font-medium text-muted-foreground mt-1 flex items-center justify-center gap-1.5 truncate max-w-full">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{thread.institutionName}</span>
          </p>
        )}

        <Badge
          variant="outline"
          className="mt-3 text-[10px] uppercase font-bold px-2 py-0.5 bg-primary/5 text-primary border-primary/20"
        >
          Direct Contact
        </Badge>
      </div>

      {/* Contact Details Body */}
      <div className="p-6 space-y-5 flex-1">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Communication Channels
        </h4>

        <div className="space-y-4">
          {thread.email && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Email</p>
                <a
                  href={`mailto:${thread.email}`}
                  className="text-xs font-bold text-foreground hover:text-primary hover:underline truncate block"
                >
                  {thread.email}
                </a>
              </div>
            </div>
          )}

          {thread.phone && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Phone</p>
                <a
                  href={`tel:${thread.phone.replace(/[\s-()]/g, '')}`}
                  className="text-xs font-bold text-foreground hover:text-primary hover:underline truncate block"
                >
                  {thread.phone}
                </a>
              </div>
            </div>
          )}

          {/* Delivery Telemetry */}
          <div className="pt-4 border-t border-border/50 space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Delivery Telemetry
            </p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Delivered
                </span>
                <span className="text-sm font-bold text-emerald-600 tabular-nums flex items-center justify-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {deliveredCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Failed
                </span>
                <span className="text-sm font-bold text-rose-600 tabular-nums flex items-center justify-center gap-1 mt-0.5">
                  <XCircle className="h-3.5 w-3.5" />
                  {failedCount}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Channels:</span>
              <div className="flex items-center gap-1">
                {channelsUsed.includes('email') && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 gap-1 font-semibold"
                  >
                    <Mail className="h-2.5 w-2.5" /> Email
                  </Badge>
                )}
                {channelsUsed.includes('sms') && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0.5 bg-orange-500/10 text-orange-700 dark:text-orange-400 gap-1 font-semibold"
                  >
                    <Smartphone className="h-2.5 w-2.5" /> SMS
                  </Badge>
                )}
                {channelsUsed.includes('whatsapp') && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 font-semibold"
                  >
                    <MessageSquare className="h-2.5 w-2.5" /> WhatsApp
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground pt-1">
              Last active {fullDateFormatter.format(new Date(thread.lastMessageTimestamp))}
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-muted/10 border-t border-border/50 shrink-0 space-y-2">
        <Button
          variant="outline"
          onClick={handleCopyContactInfo}
          className="w-full h-10 rounded-xl font-bold bg-background shadow-xs hover:bg-muted/50 transition-all gap-2 text-xs min-h-[44px] active:scale-[0.97]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied to Clipboard
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Copy Contact Details
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

import * as React from 'react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { WorkspaceEntity } from '@/lib/types';
import {
  Mail,
  Phone,
  ExternalLink,
  MapPin,
  Building2,
  CheckCircle2,
  XCircle,
  Smartphone,
  Copy,
  Check,
  PanelRightClose,
  MessageSquare,
  Trash2,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { getEntityEmail, getEntityPhone, getContactPerson } from '@/lib/entity-helpers';
import type { ThreadGroup } from '../ConversationsClient';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/use-terminology';
import { useToast } from '@/hooks/use-toast';
import { archiveEntityAction } from '@/lib/workspace-entity-actions';
import { calculateContactHygieneScore } from '../utils/contact-hygiene';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

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
  const { toast } = useToast();
  const { singular } = useTerminology();
  const [copied, setCopied] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

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

  // Unified resolution of Contact Name and Entity / Institution Name
  const entityName =
    entity?.displayName ||
    (entity as unknown as { entityName?: string })?.entityName ||
    thread.institutionName ||
    thread.entityName;

  const contactName =
    (entity && (getContactPerson(entity) || entity.primaryContactName)) ||
    thread.contactName ||
    (!entityName ? 'Direct Contact' : '');

  const email = (entity && (getEntityEmail(entity) || entity.primaryEmail)) || thread.email || '';
  const phone = (entity && (getEntityPhone(entity) || entity.primaryPhone)) || thread.phone || '';
  const locationString = entity?.locationString || entity?.location?.locationString;

  // Resolve dynamic avatar initials derived from contact or entity name (never hardcoded 'EN')
  const initialsSource = contactName || entityName || 'CO';
  const initials = initialsSource
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const deliveredCount = thread.messages.filter((m) => m.status === 'sent').length;
  const failedCount = thread.messages.filter((m) => m.status === 'failed').length;
  const channelsUsed = Array.from(new Set(thread.messages.map((m) => m.channel)));

  // Compute Contact Hygiene Score
  const hygiene = React.useMemo(() => {
    return calculateContactHygieneScore({
      email,
      phone,
      name: contactName,
      entityName,
      status: entity?.status || (thread.messages.length > 0 ? 'active' : undefined),
      deliveredCount,
    });
  }, [email, phone, contactName, entityName, entity?.status, deliveredCount, thread.messages.length]);

  const handleCopyContactInfo = React.useCallback(() => {
    const details = [
      contactName ? `Name: ${contactName}` : '',
      entityName ? `${singular || 'Institution'}: ${entityName}` : '',
      email ? `Email: ${email}` : '',
      phone ? `Phone: ${phone}` : '',
      `Hygiene Score: ${hygiene.score}% (${hygiene.label})`,
    ]
      .filter(Boolean)
      .join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(details).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [contactName, entityName, singular, email, phone, hygiene]);

  const handleDeleteContact = React.useCallback(async () => {
    setIsDeleting(true);
    try {
      if (resolvedEntityId) {
        const res = await archiveEntityAction({
          workspaceEntityId: resolvedEntityId,
          entityId: entity?.entityId || resolvedEntityId,
        });
        if (res && !res.success) {
          toast({
            title: `Failed to delete ${singular?.toLowerCase() || 'contact'}`,
            description: res.error || 'An unexpected error occurred.',
            variant: 'destructive',
          });
          return;
        }
      }
      toast({
        title: `${singular || 'Contact'} Archived`,
        description: 'The contact record has been removed from active conversations.',
      });
      setShowDeleteDialog(false);
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive contact';
      toast({
        title: 'Action Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [resolvedEntityId, entity?.entityId, singular, toast, onClose]);

  if (isLoading) {
    return (
      <div
        data-testid="entity-context-skeleton"
        className={cn(
          'w-full lg:w-72 shrink-0 border-l border-border bg-background p-6 space-y-6 flex flex-col h-full z-10',
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

  const messageTarget = email || phone || thread.lastMessage?.recipient || '';
  const telHref = phone ? `tel:${phone.replace(/[\s-()]/g, '')}` : undefined;

  return (
    <div
      className={cn(
        'w-full lg:w-72 shrink-0 border-l border-border bg-background flex flex-col h-full overflow-y-auto shadow-[-2px_0_10px_rgba(0,0,0,0.02)] z-10',
        className
      )}
    >
      {/* Dynamic Terminology Panel Header */}
      <div className="p-4 border-b border-border/80 flex items-center justify-between shrink-0 bg-card/95 dark:bg-card shadow-xs backdrop-blur-md">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {singular ? `${singular} Details` : 'Contact Details'}
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

        {/* Contact Name & Prominent Entity Name */}
        <h3 className="text-base font-bold tracking-tight text-foreground truncate max-w-full">
          {contactName || entityName || 'Direct Contact'}
        </h3>

        {entityName && contactName && (
          <p className="text-xs font-semibold text-muted-foreground mt-1 flex items-center justify-center gap-1.5 truncate max-w-full">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{entityName}</span>
          </p>
        )}

        {/* Contact Hygiene Score Widget */}
        <div
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs',
            hygiene.bg,
            hygiene.color
          )}
          title="Contact data hygiene score"
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums">Hygiene {hygiene.score}%</span>
          <span className="opacity-40">•</span>
          <span>{hygiene.label}</span>
        </div>

        <Badge
          variant="outline"
          className="mt-2 text-[10px] uppercase font-bold px-2 py-0.5 bg-primary/5 text-primary border-primary/20"
        >
          {entity?.status || 'Direct Contact'}
        </Badge>
      </div>

      {/* Minimalist 4-Action Quick Bar */}
      <div className="px-4 py-3 border-b border-border/50 bg-muted/10 grid grid-cols-4 gap-1.5 shrink-0">
        {/* 1. Call Action */}
        {telHref ? (
          <a
            href={telHref}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all border border-transparent hover:border-border/50 active:scale-[0.97]"
            title="Call phone"
          >
            <Phone className="h-4 w-4 mb-1 text-orange-500" />
            <span className="text-[10px] font-semibold">Call</span>
          </a>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-muted-foreground/40 cursor-not-allowed"
            title="No phone number available"
          >
            <Phone className="h-4 w-4 mb-1" />
            <span className="text-[10px] font-semibold">Call</span>
          </div>
        )}

        {/* 2. Message Action */}
        <Link
          href={`/admin/messaging/composer?recipient=${encodeURIComponent(messageTarget)}`}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all border border-transparent hover:border-border/50 active:scale-[0.97]"
          title="Compose message"
        >
          <MessageSquare className="h-4 w-4 mb-1 text-blue-500" />
          <span className="text-[10px] font-semibold">Message</span>
        </Link>

        {/* 3. Entity Operations Action */}
        {resolvedEntityId ? (
          <Link
            href={`/admin/entities?id=${resolvedEntityId}`}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all border border-transparent hover:border-border/50 active:scale-[0.97]"
            title={`View ${singular || 'Entity'} profile`}
          >
            <ExternalLink className="h-4 w-4 mb-1 text-emerald-500" />
            <span className="text-[10px] font-semibold truncate max-w-full">
              {singular || 'Profile'}
            </span>
          </Link>
        ) : (
          <Link
            href={`/admin/entities/new?name=${encodeURIComponent(contactName)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all border border-transparent hover:border-border/50 active:scale-[0.97]"
            title={`Create ${singular || 'Entity'} record`}
          >
            <Building2 className="h-4 w-4 mb-1 text-primary" />
            <span className="text-[10px] font-semibold truncate max-w-full">Create</span>
          </Link>
        )}

        {/* 4. Delete Action */}
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20 active:scale-[0.97]"
          title="Delete or archive contact"
        >
          <Trash2 className="h-4 w-4 mb-1 text-rose-500" />
          <span className="text-[10px] font-semibold">Delete</span>
        </button>
      </div>

      {/* Contact Details Body */}
      <div className="p-6 space-y-5 flex-1">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Contact Details
        </h4>

        <div className="space-y-4">
          {/* Email Row */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-muted-foreground">Email</p>
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="text-xs font-bold text-foreground hover:text-primary hover:underline truncate block"
                >
                  {email}
                </a>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">Not provided</p>
              )}
            </div>
          </div>

          {/* Phone Row */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 shrink-0">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-muted-foreground">Phone</p>
              {phone ? (
                <a
                  href={telHref}
                  className="text-xs font-bold text-foreground hover:text-primary hover:underline truncate block"
                >
                  {phone}
                </a>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">Not provided</p>
              )}
            </div>
          </div>

          {/* Institution / Entity Name Row */}
          {entityName && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {singular || 'Institution'}
                </p>
                <p className="text-xs font-bold text-foreground truncate">{entityName}</p>
              </div>
            </div>
          )}

          {/* Location Row */}
          {locationString && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Location</p>
                <p className="text-xs font-medium text-foreground leading-tight">{locationString}</p>
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

      {/* Delete / Archive Confirmation Dialog (Standardized Modal Architecture - theme.md §8) */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
          <AlertDialogHeader className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Delete {singular || 'Contact'}
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Confirmation to delete or archive this contact from active conversations.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{contactName || entityName || 'this contact'}</strong>?
              This will archive the record and remove it from active conversation listings.
            </p>
          </div>

          <AlertDialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
            <AlertDialogCancel
              disabled={isDeleting}
              className="rounded-xl min-h-[44px] px-4 font-semibold active:scale-[0.97]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDeleteContact}
              className="rounded-xl min-h-[44px] px-4 font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.97]"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Archiving...
                </>
              ) : (
                'Delete Contact'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

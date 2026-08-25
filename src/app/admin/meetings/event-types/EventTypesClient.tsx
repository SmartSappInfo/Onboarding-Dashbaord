'use client';

/**
 * @fileoverview Event Types Library Client (Meetings 2.0).
 * Displays a responsive grid of reusable meeting types with quick link copying,
 * preview, status toggling, duplication, and editing.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { PageContainerFluid } from '@/components/ui/page-container';
import { MeetingsNavigation } from '../components/MeetingsNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Copy,
  CopyCheck,
  ExternalLink,
  Edit,
  Trash2,
  Layers,
  Clock,
  Video,
  MoreVertical,
  Calendar,
  Sparkles,
  Phone,
  MapPin,
  Globe,
  Loader2,
  Share2,
} from 'lucide-react';
import type { EventType } from '@/lib/meetings/types';
import { ShareEventTypeModal } from '../components/ShareEventTypeModal';
import {
  deleteEventTypeAction,
  duplicateEventTypeAction,
  toggleEventTypeStatusAction,
} from '@/app/actions/event-type-actions';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function EventTypesClient() {
  const router = useRouter();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);
  const [sharingEventType, setSharingEventType] = React.useState<EventType | null>(null);

  // Load Event Types for the active workspace
  const eventTypesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'event_types'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: eventTypes, isLoading } = useCollection<EventType>(eventTypesQuery);

  // Filtered event types by search query
  const filteredEventTypes = React.useMemo(() => {
    if (!eventTypes) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return eventTypes;
    return eventTypes.filter(
      et =>
        et.name.toLowerCase().includes(q) ||
        (et.description && et.description.toLowerCase().includes(q)) ||
        et.slug.toLowerCase().includes(q)
    );
  }, [eventTypes, searchQuery]);

  // Copy public booking link
  const handleCopyLink = (slug: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: 'Link Copied!', description: 'Public booking URL saved to clipboard.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Duplicate Event Type
  const handleDuplicate = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await duplicateEventTypeAction(id);
      if (res.success && res.newId) {
        toast({ title: 'Event Type Duplicated', description: 'Draft copy created successfully.' });
        router.push(`/admin/meetings/event-types/${res.newId}/edit`);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to duplicate.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (et: EventType) => {
    const nextStatus = et.status === 'active' ? 'draft' : 'active';
    setActionLoadingId(et.id);
    try {
      const res = await toggleEventTypeStatusAction(et.id, nextStatus);
      if (res.success) {
        toast({ title: `Status Changed to ${nextStatus.toUpperCase()}` });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Event Type
  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete Event Type?',
      description: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'destructive',
    });

    if (!ok) return;

    setActionLoadingId(id);
    try {
      const res = await deleteEventTypeAction(id);
      if (res.success) {
        toast({ title: 'Event Type Deleted' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper to render location icon
  const renderLocationIcon = (loc: string) => {
    switch (loc) {
      case 'google_meet':
      case 'zoom':
      case 'teams':
        return <Video className="w-3.5 h-3.5" />;
      case 'phone':
        return <Phone className="w-3.5 h-3.5" />;
      case 'in_person':
        return <MapPin className="w-3.5 h-3.5" />;
      default:
        return <Globe className="w-3.5 h-3.5" />;
    }
  };

  return (
    <PageContainerFluid>
      {/* Shared Navigation Tab Bar */}
      <MeetingsNavigation
        actions={
          <Link href="/admin/meetings/event-types/new">
            <Button className="rounded-xl min-h-[44px] px-5 font-semibold gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              New Event Type
            </Button>
          </Link>
        }
      />

      <div className="space-y-6 max-w-6xl">
        {/* Header & Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Event Types</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create reusable 1:1, group, or consultation session formats with custom booking rules.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search event types..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl min-h-[44px]"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-56 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredEventTypes.length === 0 ? (
          /* Empty State */
          <Card className="rounded-2xl border-dashed border-2 text-center p-12 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">No Event Types Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                {searchQuery
                  ? 'No event types match your search criteria.'
                  : 'Get started by creating your first event type to accept customer bookings.'}
              </p>
            </div>
            <Link href="/admin/meetings/event-types/new">
              <Button className="rounded-xl min-h-[44px] gap-2 mt-2">
                <Plus className="w-4 h-4" />
                Create Event Type
              </Button>
            </Link>
          </Card>
        ) : (
          /* Event Types Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEventTypes.map(et => {
              const isCopied = copiedId === et.id;
              const isBusy = actionLoadingId === et.id;

              return (
                <Card
                  key={et.id}
                  className="rounded-2xl border-border shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top Color Accent Line */}
                  <div
                    className="h-2 w-full"
                    style={{ backgroundColor: et.color || '#3b82f6' }}
                  />

                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-bold line-clamp-1 group-hover:text-primary transition-colors">
                          {et.name}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground font-mono">/book/{et.slug}</span>
                      </div>

                      <Badge
                        variant={et.status === 'active' ? 'default' : 'secondary'}
                        className="rounded-lg text-xs capitalize shrink-0 cursor-pointer"
                        onClick={() => handleToggleStatus(et)}
                      >
                        {et.status}
                      </Badge>
                    </div>

                    {et.description && (
                      <CardDescription className="text-xs line-clamp-2">
                        {et.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    {/* Metadata Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="rounded-lg text-xs gap-1.5 py-1 px-2.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        {et.durationMinutes} mins
                      </Badge>

                      <Badge variant="outline" className="rounded-lg text-xs gap-1.5 py-1 px-2.5 capitalize">
                        {renderLocationIcon(et.locationType)}
                        {et.locationType.replace('_', ' ')}
                      </Badge>

                      <Badge variant="outline" className="rounded-lg text-xs gap-1.5 py-1 px-2.5 capitalize">
                        {et.format.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="border-t border-border pt-4 flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(et.slug, et.id)}
                        className="rounded-xl text-xs gap-1.5 flex-1 min-h-[38px]"
                      >
                        {isCopied ? (
                          <>
                            <CopyCheck className="w-3.5 h-3.5 text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Link
                          </>
                        )}
                      </Button>

                      <Link href={`/book/${et.slug}`} target="_blank">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Preview Public Booking Page"
                          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>

                      <Link href={`/admin/meetings/event-types/${et.id}/edit`}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Edit Event Type"
                          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isBusy}
                            className="rounded-xl h-9 w-9"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MoreVertical className="w-4 h-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => setSharingEventType(et)} className="gap-2">
                            <Share2 className="w-4 h-4 text-primary" /> Share & QR Code
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(et.id)} className="gap-2">
                            <Sparkles className="w-4 h-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(et)} className="gap-2">
                            <Layers className="w-4 h-4" />
                            {et.status === 'active' ? 'Set as Draft' : 'Set as Active'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(et.id, et.name)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Share Event Type Modal */}
      <ShareEventTypeModal
        eventType={sharingEventType}
        open={!!sharingEventType}
        onOpenChange={open => !open && setSharingEventType(null)}
      />
    </PageContainerFluid>
  );
}

'use client';

import * as React from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { doc, collection, query, updateDoc } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import type { Meeting, MeetingRegistrant, Attendee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Edit3,
  Check,
  X,
  Loader2,
  ExternalLink,
  Edit,
  Building,
  Mail,
  Users,
  ShieldCheck,
  BarChart3
} from 'lucide-react';

// Create shared MeetingContext
export const MeetingContext = React.createContext<{
  meeting: Meeting;
  registrants: MeetingRegistrant[];
  attendees: Attendee[];
  isLoading: boolean;
  meetingDocRef: any;
} | null>(null);

export function useMeetingContext() {
  const context = React.useContext(MeetingContext);
  if (!context) {
    throw new Error('useMeetingContext must be used within a MeetingProvider');
  }
  return context;
}

export default function MeetingDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const meetingId = params.id as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editingName, setEditingName] = React.useState('');
  const [isSavingName, setIsSavingName] = React.useState(false);

  // Pathname guard: bypass details layout when accessing editing view
  const isEditPage = pathname.endsWith('/edit');

  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);

  const { data: meeting, isLoading: isLoadingMeeting, error: meetingError } = useDoc<Meeting>(meetingDocRef);

  // Fetch registrants for shared use
  const registrantsColRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return collection(firestore, `meetings/${meetingId}/registrants`);
  }, [firestore, meetingId]);

  const { data: registrants, isLoading: isLoadingRegistrants } = useCollection<MeetingRegistrant>(registrantsColRef);

  // Fetch attendees for shared use
  const attendeesQuery = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return query(collection(firestore, `meetings/${meetingId}/attendees`));
  }, [firestore, meetingId]);

  const { data: attendees, isLoading: isLoadingAttendees } = useCollection<Attendee>(attendeesQuery);

  const handleSaveName = async () => {
    if (!firestore || !meetingDocRef || !editingName.trim()) return;
    setIsSavingName(true);
    try {
      await updateDoc(meetingDocRef, { entityName: editingName.trim() });
      toast({
        title: 'Meeting updated',
        description: 'Meeting name has been successfully updated.',
      });
      setIsEditingName(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err.message || 'An error occurred.',
      });
    } finally {
      setIsSavingName(false);
    }
  };

  // Skip layout shell on /edit route
  if (isEditPage) {
    return <>{children}</>;
  }

  if (isLoadingMeeting) {
    return (
      <div className="h-full overflow-y-auto p-0 bg-background">
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse text-left p-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 rounded-lg" />
              <Skeleton className="h-4 w-48 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
            <div className="md:col-span-9">
              <Skeleton className="h-[500px] w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (meetingError || !meeting) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">Meeting not found</h2>
          <p className="text-sm text-muted-foreground">The meeting might have been deleted or the link is invalid.</p>
          <Button onClick={() => router.push('/admin/meetings')}>Back to Meetings</Button>
        </div>
      </div>
    );
  }

  const publicTypeSlug = (meeting.type?.slug as string) === 'parent' ? 'parent-engagement' : (meeting.type?.slug || 'meeting');
  const publicUrl = `/meetings/${publicTypeSlug}/${meeting.meetingSlug || meeting.entitySlug}`;

  // Tab definitions
  const tabs = [
    { label: 'Meeting Details', path: `/admin/meetings/${meetingId}`, icon: Building },
    { label: 'Invited Guests', path: `/admin/meetings/${meetingId}/invitations`, icon: Mail },
    { label: 'Registrants & Attendance', path: `/admin/meetings/${meetingId}/registrants`, icon: Users },
    { label: 'Facilitators', path: `/admin/meetings/${meetingId}/facilitators`, icon: ShieldCheck },
    { label: 'Intelligence', path: `/admin/meetings/${meetingId}/results`, icon: BarChart3 },
  ];

  return (
    <MeetingContext.Provider
      value={{
        meeting,
        registrants: registrants || [],
        attendees: attendees || [],
        isLoading: isLoadingMeeting || isLoadingRegistrants || isLoadingAttendees,
        meetingDocRef,
      }}
    >
      <div className="h-full w-full overflow-y-auto bg-background p-0">
        <div className="max-w-7xl mx-auto space-y-8 text-left p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b">
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0">
                <Link href="/admin/meetings">
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-10 px-3 border rounded-xl text-lg font-semibold w-72 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-foreground"
                      disabled={isSavingName}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl shrink-0"
                      onClick={handleSaveName}
                      disabled={isSavingName}
                    >
                      {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl shrink-0"
                      onClick={() => setIsEditingName(false)}
                      disabled={isSavingName}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1 group/title">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white leading-none">
                      {meeting.entityName}
                    </h1>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover/title:opacity-100 transition-opacity rounded-xl hover:bg-muted"
                      onClick={() => {
                        setIsEditingName(true);
                        setEditingName(meeting.entityName || '');
                      }}
                    >
                      <Edit3 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {meeting.type?.name} • {meeting.meetingTime ? format(new Date(meeting.meetingTime), 'PPP p') : 'TBD'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm" className="rounded-xl gap-2 h-10 border-slate-200 hover:bg-slate-50">
                <Link href={publicUrl} target="_blank">
                  <ExternalLink className="h-4 w-4 text-slate-600" />
                  <span className="text-slate-700 font-semibold text-xs">View Public Page</span>
                </Link>
              </Button>
              <Button asChild size="sm" className="rounded-xl gap-2 h-10 px-4">
                <Link href={`/admin/meetings/${meetingId}/edit`}>
                  <Edit className="h-4 w-4" />
                  <span className="text-xs font-bold">Edit Architecture</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Tab Sidebar Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Sidebar Column */}
            <div className="md:col-span-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 border-b md:border-b-0 md:pr-4 md:border-r border-slate-200 dark:border-white/10 shrink-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname === tab.path;
                return (
                  <Link
                    key={tab.path}
                    href={tab.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition-all duration-200 whitespace-nowrap",
                      isActive
                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Active Content Pane */}
            <div className="md:col-span-9 w-full min-w-0">
              {children}
            </div>
          </div>
        </div>
      </div>
    </MeetingContext.Provider>
  );
}

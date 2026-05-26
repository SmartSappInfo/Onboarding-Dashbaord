'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAudiences } from '@/lib/audience-hooks';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Send, 
  Mail, 
  Smartphone, 
  Calendar, 
  ChevronLeft, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  PlusCircle, 
  Eye,
  Info,
  ShieldCheck,
  Filter,
  Check,
  Settings2,
  Target,
  User,
  BookmarkCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagAudienceSelector, type TagSegment } from '@/app/admin/messaging/composer/components/TagAudienceSelector';
import { MessagingTemplateSelector } from '@/app/admin/components/MessagingTemplateSelector';
import { sendMeetingInvitationsAction } from '@/app/actions/meeting-registrants-actions';
import type { Meeting } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function MeetingInvitationsPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [selectedChannels, setSelectedChannels] = React.useState<('email' | 'sms')[]>(['email']);
  const [contactScope, setContactScope] = React.useState<'primary' | 'signatories' | 'roles' | 'all'>('primary');
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
  const [tagSegment, setTagSegment] = React.useState<TagSegment>({
    includeTagIds: [],
    excludeTagIds: [],
    includeLogic: 'OR',
  });

  // Audience mode: 'manual' = custom filters, 'saved' = pick a saved audience
  const [audienceMode, setAudienceMode] = React.useState<'manual' | 'saved'>('manual');
  const [savedAudienceId, setSavedAudienceId] = React.useState('');

  // Assignee filter: 'all' = show all entities, 'mine' = show only my assigned entities
  const [assigneeFilter, setAssigneeFilter] = React.useState<'all' | 'mine'>('all');

  const [emailTemplateId, setEmailTemplateId] = React.useState('');
  const [smsTemplateId, setSmsTemplateId] = React.useState('');
  const [isScheduled, setIsScheduled] = React.useState(false);
  const [scheduleDateTime, setScheduleDateTime] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);

  // Fetch meeting details
  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);

  const { data: meeting, isLoading: isLoadingMeeting } = useDoc<Meeting>(meetingDocRef);

  // Fetch all current registrants/invites
  const registrantsColRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return collection(firestore, `meetings/${meetingId}/registrants`);
  }, [firestore, meetingId]);

  const { data: registrants, isLoading: isLoadingRegistrants } = useCollection<any>(registrantsColRef);

  // Fetch all workspace entities for live client-side filtering
  const entitiesColRef = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);

  const { data: workspaceEntities, isLoading: isLoadingEntities } = useCollection<any>(entitiesColRef);

  // Fetch saved audiences for the audience selector
  const { audiences: savedAudiences } = useAudiences(activeWorkspaceId);

  // Fetch workspace users for the assignee filter
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'workspace_users'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: workspaceUsers } = useCollection<any>(usersQuery);

  const userOptions = React.useMemo(() => {
    const sorted = [...(workspaceUsers || [])].sort((a: any, b: any) =>
      (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')
    );
    return sorted.map((u: any) => ({
      label: u.displayName || u.email || 'Unknown',
      value: u.userId || u.id,
    }));
  }, [workspaceUsers]);

  // Derive stats
  const stats = React.useMemo(() => {
    if (!registrants) return { invited: 0, going: 0, not_going: 0, later: 0, pending: 0 };
    let invited = 0;
    let going = 0;
    let not_going = 0;
    let later = 0;
    let pending = 0;

    registrants.forEach((reg: any) => {
      invited++;
      const status = reg.rsvpStatus || reg.status;
      if (status === 'going' || status === 'approved') going++;
      else if (status === 'not_going' || status === 'cancelled') not_going++;
      else if (status === 'later') later++;
      else pending++;
    });

    return { invited, going, not_going, later, pending };
  }, [registrants]);

  // Derive all unique contact roles from workspace entities
  const availableRoles = React.useMemo(() => {
    if (!workspaceEntities) return [];
    const seen = new Map<string, string>();
    workspaceEntities.forEach((e: any) => {
      const contacts = e.entityContacts || e.contacts || [];
      contacts.forEach((c: any) => {
        if (c.typeKey && !seen.has(c.typeKey)) {
          seen.set(c.typeKey, c.typeLabel || c.typeKey);
        }
      });
    });
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [workspaceEntities]);

  // When a saved audience is selected, apply its tag-based filters
  const handleSavedAudienceChange = React.useCallback((audienceId: string) => {
    setSavedAudienceId(audienceId);
    const aud = savedAudiences.find((a: any) => a.id === audienceId);
    if (aud && aud.filters) {
      // Extract tag-based filters from the saved audience and apply them
      const includeTagFilter = aud.filters.find((f: any) => f.field === 'tags' && (f.operator === 'any_of' || f.operator === 'all_of'));
      const excludeTagFilter = aud.filters.find((f: any) => f.field === 'tags' && f.operator === 'is_not');
      setTagSegment({
        includeTagIds: includeTagFilter?.value || [],
        excludeTagIds: excludeTagFilter?.value || [],
        includeLogic: includeTagFilter?.operator === 'all_of' ? 'AND' : 'OR',
      });
    }
  }, [savedAudiences]);

  // Process live client-side filtering of contacts
  const filteredRecipients = React.useMemo(() => {
    if (!workspaceEntities) return [];

    let pool = workspaceEntities;

    // 0. Assignee filtering
    if (assigneeFilter === 'mine' && currentUser?.uid) {
      pool = pool.filter((e: any) => {
        const assignedUserId = e.assignedTo?.userId || e.assignedTo;
        return assignedUserId === currentUser.uid;
      });
    }

    // 1. Tag filtering
    if (tagSegment.includeTagIds.length > 0) {
      pool = pool.filter((e: any) => {
        const tags = e.workspaceTags || e.tags || [];
        if (tagSegment.includeLogic === 'AND') {
          return tagSegment.includeTagIds.every(id => tags.includes(id));
        } else {
          return tagSegment.includeTagIds.some(id => tags.includes(id));
        }
      });
    }

    if (tagSegment.excludeTagIds.length > 0) {
      pool = pool.filter((e: any) => {
        const tags = e.workspaceTags || e.tags || [];
        return !tagSegment.excludeTagIds.some(id => tags.includes(id));
      });
    }

    // 2. Resolve matching contacts based on selected channels and contact scope / roles
    const recipients: any[] = [];
    pool.forEach((e: any) => {
      const contacts = e.entityContacts || e.contacts || [];
      let matchedContacts: any[] = [];

      if (contactScope === 'primary') {
        const primary = contacts.find((c: any) => c.isPrimary) || contacts[0];
        if (primary) matchedContacts = [primary];
      } else if (contactScope === 'signatories') {
        matchedContacts = contacts.filter((c: any) => c.isSignatory);
      } else if (contactScope === 'roles') {
        matchedContacts = contacts.filter((c: any) => selectedRoles.includes(c.typeKey || ''));
      } else {
        matchedContacts = contacts;
      }

      // Filter matched contacts to verify they have necessary contact info for the selected channels
      matchedContacts.forEach((c: any) => {
        const hasEmail = !!c.email;
        const hasPhone = !!c.phone;

        const isEmailSelected = selectedChannels.includes('email');
        const isSmsSelected = selectedChannels.includes('sms');

        if ((isEmailSelected && hasEmail) || (isSmsSelected && hasPhone)) {
          recipients.push({
            entityId: e.entityId || e.id,
            name: c.name || e.displayName || e.name,
            email: c.email || '',
            phone: c.phone || '',
          });
        }
      });
    });

    return recipients;
  }, [workspaceEntities, tagSegment, contactScope, selectedRoles, selectedChannels, assigneeFilter, currentUser?.uid]);

  const toggleChannel = (ch: 'email' | 'sms') => {
    setSelectedChannels(prev => 
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const toggleRole = (roleKey: string) => {
    setSelectedRoles(prev => 
      prev.includes(roleKey) ? prev.filter(r => r !== roleKey) : [...prev, roleKey]
    );
  };

  const handleSendInvitations = async () => {
    if (filteredRecipients.length === 0) {
      toast({ variant: 'destructive', title: 'Empty Audience', description: 'No recipients match the selected criteria.' });
      return;
    }
    if (selectedChannels.includes('email') && !emailTemplateId) {
      toast({ variant: 'destructive', title: 'Template Required', description: 'Please select an Email template.' });
      return;
    }
    if (selectedChannels.includes('sms') && !smsTemplateId) {
      toast({ variant: 'destructive', title: 'Template Required', description: 'Please select an SMS template.' });
      return;
    }

    setIsSending(true);
    try {
      const res = await sendMeetingInvitationsAction(
        meetingId,
        activeWorkspaceId || 'onboarding',
        filteredRecipients,
        selectedChannels,
        emailTemplateId || undefined,
        smsTemplateId || undefined,
        isScheduled ? scheduleDateTime : undefined
      );

      if (res.success) {
        toast({ title: 'Success', description: res.message });
      } else {
        toast({ variant: 'destructive', title: 'Dispatch failed', description: res.message });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoadingMeeting || isLoadingRegistrants || isLoadingEntities) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Meeting not found</h2>
          <Button onClick={() => router.push('/admin/meetings')}>Back to Meetings</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0">
              <Link href={`/admin/meetings/${meetingId}`}>
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Meeting Invitations
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                {meeting.entityName} • {meeting.type.name}
              </p>
            </div>
          </div>
        </div>

        {/* Real-time RSVP Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Invited', count: stats.invited, icon: <Send className="h-4 w-4 text-primary" />, bg: 'bg-primary/5 border-primary/20' },
            { label: 'Going', count: stats.going, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, bg: 'bg-emerald-500/5 border-emerald-500/20' },
            { label: 'Declined', count: stats.not_going, icon: <XCircle className="h-4 w-4 text-rose-500" />, bg: 'bg-rose-500/5 border-rose-500/20' },
            { label: 'Decide Later', count: stats.later, icon: <Clock className="h-4 w-4 text-amber-500" />, bg: 'bg-amber-500/5 border-amber-500/20' },
            { label: 'Pending Response', count: stats.pending, icon: <Info className="h-4 w-4 text-slate-500" />, bg: 'bg-slate-500/5 border-slate-500/20' },
          ].map((item) => (
            <Card key={item.label} className={`border ${item.bg} rounded-2xl shadow-sm overflow-hidden`}>
              <CardContent className="p-5 flex flex-col items-start space-y-2">
                <div className="p-1.5 rounded-lg bg-background border">{item.icon}</div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{item.label}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums">{item.count}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Invitation Panel & Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left panel: Filter and target audience */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Target Audience Criteria
                </CardTitle>
                <CardDescription className="text-xs">
                  Filter workspace contacts using saved audiences, tags, assignees, contact roles, and channel options.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                {/* Audience Mode Selector */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audience Source</span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'manual' as const, icon: <Filter className="h-4 w-4" />, label: 'Custom Filters', desc: 'Build filters manually' },
                      { value: 'saved' as const, icon: <BookmarkCheck className="h-4 w-4" />, label: 'Saved Audience', desc: 'Reuse a segment' },
                    ].map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setAudienceMode(m.value)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                          audienceMode === m.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50 hover:border-primary/20'
                        )}
                      >
                        <div className={cn(audienceMode === m.value ? 'text-primary' : 'text-muted-foreground')}>{m.icon}</div>
                        <p className="text-[10px] font-bold">{m.label}</p>
                        <p className="text-[8px] font-semibold text-muted-foreground">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saved Audience Picker */}
                {audienceMode === 'saved' && (
                  <div className="space-y-3 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200/50 dark:border-indigo-800/30 animate-in fade-in duration-300">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" /> Select Saved Audience
                    </span>
                    <Select value={savedAudienceId} onValueChange={handleSavedAudienceChange}>
                      <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-card border-border/50">
                        <SelectValue placeholder="Choose an audience..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {savedAudiences.map((a: any) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs font-semibold">
                            {a.name} ({a.filters?.length || 0} filters)
                          </SelectItem>
                        ))}
                        {savedAudiences.length === 0 && (
                          <SelectItem value="_none" disabled className="text-xs text-muted-foreground italic">
                            No saved audiences — create one in Messaging → Audiences
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {savedAudienceId && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-100/50 dark:bg-indigo-900/20">
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <p className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                          Audience filters applied. You can still refine with tags below.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Assignee Filter */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Filter by Assignee
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'all', label: 'All Users', desc: 'Show all workspace entities' },
                      { id: 'mine', label: 'My Assignees', desc: `Only entities assigned to ${currentUser?.displayName || 'me'}` },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAssigneeFilter(opt.id as 'all' | 'mine')}
                        className={cn(
                          'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                          assigneeFilter === opt.id
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border/50 hover:border-primary/20 text-muted-foreground'
                        )}
                      >
                        <p className="text-[11px] font-bold">{opt.label}</p>
                        <p className="text-[8px] font-semibold text-muted-foreground truncate max-w-full">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Channel choice */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Channels</span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'email', label: 'Email channel', icon: <Mail className="h-4 w-4" /> },
                      { id: 'sms', label: 'SMS channel', icon: <Smartphone className="h-4 w-4" /> },
                    ].map((opt) => {
                      const isSelected = selectedChannels.includes(opt.id as any);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleChannel(opt.id as any)}
                          className={cn('flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-semibold text-xs',
                            isSelected
                              ? 'border-primary bg-primary/5 text-primary shadow-sm'
                              : 'border-border hover:border-primary/20 text-muted-foreground'
                          )}
                        >
                          {opt.icon}
                          {opt.label}
                          {isSelected && <Check className="h-3 w-3 ml-auto text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Templates Selector */}
                <div className="space-y-4">
                  {selectedChannels.includes('email') && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email Template Choice</span>
                      <MessagingTemplateSelector
                        category="meetings"
                        recipientType="external_alert"
                        channel="email"
                        templateTypePrefix="meeting_invitation"
                        value={emailTemplateId}
                        onValueChange={setEmailTemplateId}
                        placeholder="Choose or create email template..."
                        className="h-10 rounded-xl bg-muted/20 border-border/50 text-xs font-semibold"
                      />
                    </div>
                  )}

                  {selectedChannels.includes('sms') && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> SMS Template Choice</span>
                      <MessagingTemplateSelector
                        category="meetings"
                        recipientType="external_alert"
                        channel="sms"
                        templateTypePrefix="meeting_invitation"
                        value={smsTemplateId}
                        onValueChange={setSmsTemplateId}
                        placeholder="Choose or create SMS template..."
                        className="h-10 rounded-xl bg-muted/20 border-border/50 text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>

                {/* Contact Scope */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact Target Scope</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'primary', label: 'Primary Contact' },
                      { id: 'signatories', label: 'Signatories' },
                      { id: 'roles', label: 'Specific Roles' },
                      { id: 'all', label: 'All Contacts' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setContactScope(opt.id as any)}
                        className={cn('flex items-center justify-center p-3 rounded-xl border transition-all text-[11px] font-bold',
                          contactScope === opt.id
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-background hover:bg-muted/30 text-muted-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Role selection chips */}
                {contactScope === 'roles' && (
                  <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-dashed animate-in fade-in duration-300">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" /> Select Roles</span>
                    <div className="flex flex-wrap gap-2">
                      {availableRoles.map((role) => {
                        const isSelected = selectedRoles.includes(role.key);
                        return (
                          <button
                            key={role.key}
                            type="button"
                            onClick={() => toggleRole(role.key)}
                            className={cn('px-3 py-1 rounded-full text-[10px] font-bold border transition-all capitalize',
                              isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground'
                            )}
                          >
                            {role.label}
                          </button>
                        );
                      })}
                      {availableRoles.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No contact roles found in workspace.</p>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Tag filtering component */}
                <TagAudienceSelector
                  onChange={(seg) => setTagSegment(seg)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right panel: dispatch action & audience preview */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Invitation Summary & Scheduling
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                    <span>Matched Recipients:</span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {filteredRecipients.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                    <span>Channels selected:</span>
                    <Badge variant="outline" className="capitalize text-[10px] font-bold">
                      {selectedChannels.join(' & ') || 'None'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Scheduling controls */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1"><Clock className="h-4 w-4 text-primary" /> Schedule Invitation</span>
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                    />
                  </div>

                  {isScheduled && (
                    <div className="space-y-2 animate-in fade-in duration-300">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Date & Time</span>
                      <input
                        type="datetime-local"
                        value={scheduleDateTime}
                        onChange={(e) => setScheduleDateTime(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border bg-background text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSendInvitations}
                  disabled={isSending || filteredRecipients.length === 0 || selectedChannels.length === 0}
                  className="w-full h-12 rounded-xl font-bold gap-2 text-sm shadow-md"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isScheduled ? 'Schedule Invitation Blast' : 'Send Invitations Immediately'}
                </Button>
              </CardContent>
            </Card>

            {/* Recipient sample list */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" />
                  Live Preview Sample ({filteredRecipients.slice(0, 15).length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-60 overflow-y-auto divide-y divide-border/50">
                {filteredRecipients.length > 0 ? (
                  filteredRecipients.slice(0, 15).map((contact, i) => (
                    <div key={i} className="p-3.5 flex items-center gap-3 text-xs">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                        {contact.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground truncate">{contact.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {contact.email ? `${contact.email}` : ''} {contact.phone ? ` · ${contact.phone}` : ''}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-muted-foreground/60 text-xs italic">
                    No matching recipients found.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Current invites list table */}
        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b py-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              RSVP Tracker Registry
            </CardTitle>
            <CardDescription className="text-xs">
              List of all sent invitations and their live RSVP statuses.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10">
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 pl-6">Invitee Name</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">Contact Info</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">RSVP Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">Last Sent</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 pr-6 text-right">Unique Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrants && registrants.length > 0 ? (
                  registrants.map((reg: any) => {
                    const status = reg.rsvpStatus || reg.status;
                    return (
                      <TableRow key={reg.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-bold text-xs py-4 pl-6">{reg.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-4">{reg.email || reg.phone || '-'}</TableCell>
                        <TableCell className="py-4">
                          {(status === 'going' || status === 'approved') && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold uppercase rounded-lg">
                              Going
                            </Badge>
                          )}
                          {(status === 'not_going' || status === 'cancelled') && (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[10px] font-bold uppercase rounded-lg">
                              Declined
                            </Badge>
                          )}
                          {status === 'later' && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-bold uppercase rounded-lg">
                              Decide Later
                            </Badge>
                          )}
                          {status !== 'going' && status !== 'approved' && status !== 'not_going' && status !== 'cancelled' && status !== 'later' && (
                            <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/30 text-[10px] font-bold uppercase rounded-lg">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-4">
                          {reg.lastInviteSentAt ? format(new Date(reg.lastInviteSentAt), 'MMM d, p') : 'Never'}
                        </TableCell>
                        <TableCell className="py-4 pr-6 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[10px] font-bold text-primary gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(reg.personalizedMeetingUrl || '');
                              toast({ title: 'Link Copied', description: 'Unique RSVP url copied to clipboard.' });
                            }}
                          >
                            Copy Link
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground/60 text-xs italic">
                      No invitations dispatched yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

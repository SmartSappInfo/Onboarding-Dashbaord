'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
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
  BookmarkCheck,
  Download,
  Search,
  UserCheck,
  ClipboardCheck,
  SlidersHorizontal,
  MoreHorizontal,
  X,
  Trash2,
  Plus,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagAudienceSelector, type TagSegment } from '@/app/admin/messaging/composer/components/TagAudienceSelector';
import { MessagingTemplateSelector } from '@/app/admin/components/MessagingTemplateSelector';
import { 
  sendMeetingInvitationsAction,
  deleteRegistrantAction, 
  updateRegistrantStatusAction, 
  sendRegistrantJoinLinkAction,
  adminRegisterParticipantAction
} from '@/app/actions/meeting-registrants-actions';
import { toggleRegistrantAttendance } from '@/app/actions/meeting-attendance-actions';
import type { Meeting, MeetingRegistrant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function UnifiedInvitationsAndRegistrantsPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();
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

  // Template Preview Modal states
  const [previewTemplateOpen, setPreviewTemplateOpen] = React.useState(false);
  const [previewChannel, setPreviewChannel] = React.useState<'email' | 'sms'>('email');

  // Registrants Ledger specific states
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchQueryInvites, setSearchQueryInvites] = React.useState('');
  const [isToggling, setIsToggling] = React.useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = React.useState(false);
  const [registrantToDelete, setRegistrantToDelete] = React.useState<MeetingRegistrant | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = React.useState(false);
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [regForm, setRegForm] = React.useState({ name: '', email: '', phone: '' });

  // Dynamic columns configuration
  const [visibleColumnKeys, setVisibleColumnKeys] = React.useState<string[]>([]);
  const [hasCustomizedColumns, setHasCustomizedColumns] = React.useState(false);

  // Fetch meeting details
  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);

  const { data: meeting, isLoading: isLoadingMeeting, error: meetingError } = useDoc<Meeting>(meetingDocRef);

  // Fetch all current registrants/invites
  const registrantsColRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return query(collection(firestore, `meetings/${meetingId}/registrants`), orderBy('registeredAt', 'desc'));
  }, [firestore, meetingId]);

  const { data: registrants, isLoading: isLoadingRegistrants, error: registrantsError } = useCollection<any>(registrantsColRef);

  // Fetch all workspace entities for live client-side filtering
  const entitiesColRef = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);

  const { data: workspaceEntities, isLoading: isLoadingEntities } = useCollection<any>(entitiesColRef);

  // Fetch all base entities for canonical contacts
  const baseEntitiesColRef = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(collection(firestore, 'entities'), where('organizationId', '==', activeOrganizationId));
  }, [firestore, activeOrganizationId]);

  const { data: baseEntities } = useCollection<any>(baseEntitiesColRef);

  // Fetch saved audiences for the audience selector
  const { audiences: savedAudiences } = useAudiences(activeWorkspaceId);

  // Fetch selected Email template content dynamically
  const emailTemplateDocRef = useMemoFirebase(() => {
    if (!firestore || !emailTemplateId) return null;
    return doc(firestore, 'message_templates', emailTemplateId);
  }, [firestore, emailTemplateId]);
  const { data: emailTemplate } = useDoc<any>(emailTemplateDocRef);

  // Fetch selected SMS template content dynamically
  const smsTemplateDocRef = useMemoFirebase(() => {
    if (!firestore || !smsTemplateId) return null;
    return doc(firestore, 'message_templates', smsTemplateId);
  }, [firestore, smsTemplateId]);
  const { data: smsTemplate } = useDoc<any>(smsTemplateDocRef);

  // Filter invited guests vs actual registered attendees
  const invitedGuests = React.useMemo(() => {
    if (!registrants) return [];
    return registrants.filter((r: any) => r.source === 'invite' || r.source === 'one-click');
  }, [registrants]);

  const registeredAttendees = React.useMemo(() => {
    if (!registrants) return [];
    return registrants.filter((r: any) => r.status === 'approved' || r.status === 'attended' || r.status === 'registered');
  }, [registrants]);

  // Derive stats for invitations and registrants separately
  const stats = React.useMemo(() => {
    // Default stats values
    const defaults = { 
      invited: 0, 
      going: 0, 
      not_going: 0, 
      later: 0, 
      pending: 0, 
      total: 0, 
      attended: 0, 
      pendingRegistrants: 0, 
      attendanceRate: 0 
    };
    if (!registrants) return defaults;

    // Invited stats
    let invited = 0;
    let going = 0;
    let not_going = 0;
    let later = 0;
    let pending = 0;

    invitedGuests.forEach((reg: any) => {
      invited++;
      const rsvp = reg.rsvpStatus;
      if (rsvp === 'going') going++;
      else if (rsvp === 'not_going') not_going++;
      else if (rsvp === 'later') later++;
      else pending++;
    });

    // Registrant stats
    let total = 0;
    let attended = 0;

    registeredAttendees.forEach((reg: any) => {
      total++;
      if (reg.status === 'attended') {
        attended++;
      }
    });

    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { 
      invited, 
      going, 
      not_going, 
      later, 
      pending, 
      total, 
      attended, 
      pendingRegistrants: total - attended, 
      attendanceRate 
    };
  }, [registrants, invitedGuests, registeredAttendees]);

  // Derive all unique contact roles from canonical base entities
  const availableRoles = React.useMemo(() => {
    if (!workspaceEntities) return [];
    const seen = new Map<string, string>();
    workspaceEntities.forEach((e: any) => {
      const baseEntity = baseEntities?.find((be: any) => be.id === e.entityId);
      const contacts = baseEntity?.entityContacts || baseEntity?.contacts || e.entityContacts || e.contacts || [];
      contacts.forEach((c: any) => {
        if (c.typeKey && !seen.has(c.typeKey)) {
          seen.set(c.typeKey, c.typeLabel || c.typeKey);
        }
      });
    });
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [workspaceEntities, baseEntities]);

  // Compute all available custom registration fields safely and efficiently
  const allAvailableFields = React.useMemo(() => {
    const fieldsMap = new Map<string, { key: string; label: string }>();

    if (meeting?.registrationFields) {
      meeting.registrationFields.forEach(f => {
        if (f.key !== 'name' && f.key !== 'email') {
          fieldsMap.set(f.key, { key: f.key, label: f.label });
        }
      });
    }

    if (registrants) {
      registrants.forEach((r: any) => {
        if (r.registrationData) {
          Object.keys(r.registrationData).forEach(key => {
            if (key !== 'name' && key !== 'email' && !fieldsMap.has(key)) {
              const label = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/[_-]/g, ' ')
                .replace(/^\w/, c => c.toUpperCase());
              fieldsMap.set(key, { key, label });
            }
          });
        }
      });
    }

    return Array.from(fieldsMap.values());
  }, [meeting?.registrationFields, registrants]);

  // Derive active visible columns
  const activeColumns = React.useMemo(() => {
    if (hasCustomizedColumns) {
      return visibleColumnKeys;
    }
    return allAvailableFields.map(f => f.key);
  }, [allAvailableFields, visibleColumnKeys, hasCustomizedColumns]);

  // Format custom registration field values
  const getFormattedFieldValue = (registrant: any, key: string) => {
    const rawVal = key === 'phone' ? registrant.phone : registrant.registrationData?.[key];
    
    if (rawVal === undefined || rawVal === null) return '';
    
    if (Array.isArray(rawVal)) {
      return rawVal.join(', ');
    }
    
    if (typeof rawVal === 'boolean') {
      return rawVal ? 'Yes' : 'No';
    }
    
    return String(rawVal);
  };

  // When a saved audience is selected, apply its tag-based filters
  const handleSavedAudienceChange = React.useCallback((audienceId: string) => {
    setSavedAudienceId(audienceId);
    const aud = savedAudiences.find((a: any) => a.id === audienceId);
    if (aud && aud.filters) {
      const includeTagFilter = aud.filters.find((f: any) => f.field === 'tags' && (f.operator === 'any_of' || f.operator === 'all_of'));
      const excludeTagFilter = aud.filters.find((f: any) => f.field === 'tags' && f.operator === 'is_not');
      setTagSegment({
        includeTagIds: includeTagFilter?.value || [],
        excludeTagIds: excludeTagFilter?.value || [],
        includeLogic: includeTagFilter?.operator === 'all_of' ? 'AND' : 'OR',
      });
    }
  }, [savedAudiences]);

  // Filter contacts client-side for Bulk Invitations
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
      const baseEntity = baseEntities?.find((be: any) => be.id === e.entityId);
      const contacts = baseEntity?.entityContacts || baseEntity?.contacts || e.entityContacts || e.contacts || [];
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

      matchedContacts.forEach((c: any) => {
        const hasEmail = !!c.email;
        const hasPhone = !!c.phone;

        const isEmailSelected = selectedChannels.includes('email');
        const isSmsSelected = selectedChannels.includes('sms');

        if ((isEmailSelected && hasEmail) || (isSmsSelected && hasPhone)) {
          const entityName = baseEntity?.displayName || baseEntity?.name || e.displayName || e.name || '';
          recipients.push({
            entityId: e.entityId || e.id,
            entityName,
            name: c.name || entityName,
            email: c.email || '',
            phone: c.phone || '',
          });
        }
      });
    });

    return recipients;
  }, [workspaceEntities, baseEntities, tagSegment, contactScope, selectedRoles, selectedChannels, assigneeFilter, currentUser?.uid]);

  // Filtered List for Invited Guests table search
  const filteredInvites = React.useMemo(() => {
    if (!invitedGuests) return [];
    if (!searchQueryInvites.trim()) return invitedGuests;
    const lowerQuery = searchQueryInvites.toLowerCase();
    return invitedGuests.filter((r: any) => {
      const nameMatch = r.name?.toLowerCase().includes(lowerQuery) || false;
      const emailMatch = r.email?.toLowerCase().includes(lowerQuery) || false;
      const entityMatch = r.entityName?.toLowerCase().includes(lowerQuery) || false;
      return nameMatch || emailMatch || entityMatch;
    });
  }, [invitedGuests, searchQueryInvites]);

  // Filtered List for Registrants table search
  const filteredRegistrants = React.useMemo(() => {
    if (!registeredAttendees) return [];
    if (!searchQuery.trim()) return registeredAttendees;
    const lowerQuery = searchQuery.toLowerCase();
    return registeredAttendees.filter((r: any) => {
      const nameMatch = r.name?.toLowerCase().includes(lowerQuery) || false;
      const emailMatch = r.email?.toLowerCase().includes(lowerQuery) || false;
      const entityMatch = r.entityName?.toLowerCase().includes(lowerQuery) || false;
      return nameMatch || emailMatch || entityMatch;
    });
  }, [registeredAttendees, searchQuery]);

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

  // Dispatch Invitation Blast
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

  // Individual toggle attendance status
  const handleToggleAttendance = async (registrant: any) => {
    const newStatus = registrant.status === 'attended' ? 'registered' : 'attended';
    setIsToggling(prev => ({ ...prev, [registrant.id]: true }));
    try {
      const result = await toggleRegistrantAttendance(meetingId, registrant.id, newStatus === 'attended');
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Attendance Updated', description: `${registrant.name}'s attendance updated.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: e.message });
    } finally {
      setIsToggling(prev => ({ ...prev, [registrant.id]: false }));
    }
  };

  // Individual approval/cancellation
  const handleUpdateStatus = async (registrant: any, status: 'approved' | 'cancelled') => {
    try {
      const result = await updateRegistrantStatusAction(meetingId, registrant.id, status);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Status Updated', description: `Registrant has been ${status}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Individual delete
  const handleDeleteRegistrant = async () => {
    if (!registrantToDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteRegistrantAction(meetingId, registrantToDelete.id);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Registrant Deleted', description: 'The registration was permanently removed.' });
      setSelectedIds(prev => { const n = new Set(prev); n.delete(registrantToDelete.id); return n; });
      setRegistrantToDelete(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  // Resend personalized join links
  const handleSendLink = async (registrant: any) => {
    if (!meeting) return;
    try {
      const result = await sendRegistrantJoinLinkAction(
        meetingId, 
        meeting.entityName || meeting.heroTitle || 'Meeting',
        [registrant],
        meeting.workspaceIds?.[0] || 'onboarding'
      );
      if (!result.success) throw new Error(result.message);
      toast({ title: 'Link Sent', description: `Join link emailed to ${registrant.name}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Bulk Actions
  const handleBulkAction = async (actionType: 'approve' | 'cancel' | 'delete' | 'sendLinks') => {
    if (selectedIds.size === 0 || !meeting) return;
    setIsProcessingBulk(true);
    
    const selectedRegistrants = registrants!.filter((r: any) => selectedIds.has(r.id));
    
    try {
      if (actionType === 'delete') {
        const promises = Array.from(selectedIds).map(id => deleteRegistrantAction(meetingId, id));
        await Promise.all(promises);
        toast({ title: 'Bulk Delete', description: `Deleted ${selectedIds.size} registrants.` });
        setSelectedIds(new Set());
      } else if (actionType === 'approve' || actionType === 'cancel') {
        const status = actionType === 'approve' ? 'approved' : 'cancelled';
        const promises = Array.from(selectedIds).map(id => updateRegistrantStatusAction(meetingId, id, status));
        await Promise.all(promises);
        toast({ title: 'Bulk Update', description: `Marked ${selectedIds.size} registrants as ${status}.` });
        setSelectedIds(new Set());
      } else if (actionType === 'sendLinks') {
        const result = await sendRegistrantJoinLinkAction(
          meetingId,
          meeting.entityName || meeting.heroTitle || 'Meeting',
          selectedRegistrants,
          meeting.workspaceIds?.[0] || 'onboarding'
        );
        if (!result.success) throw new Error(result.message);
        toast({ title: 'Links Sent', description: result.message });
        setSelectedIds(new Set());
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Bulk Action Failed', description: error.message });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Manual Register
  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name and email are required.' });
      return;
    }
    setIsRegistering(true);
    try {
      const result = await adminRegisterParticipantAction(meetingId, regForm);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Success', description: 'Registrant manually added.' });
      setIsRegisterOpen(false);
      setRegForm({ name: '', email: '', phone: '' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Registration Failed', description: error.message });
    } finally {
      setIsRegistering(false);
    }
  };

  // Ledger Select toggles
  const toggleAll = () => {
    if (selectedIds.size === filteredRegistrants.length && filteredRegistrants.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRegistrants.map((r: any) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredRegistrants?.length) return;
    const dynamicHeaders = new Set<string>();
    filteredRegistrants.forEach((r: any) => Object.keys(r.registrationData || {}).forEach(k => dynamicHeaders.add(k)));
    const dynamicHeadersArray = Array.from(dynamicHeaders);

    const headers = ['Name', 'Email', 'Phone', 'Entity Associated', 'Status', 'Registered At', 'Attended At', 'Personalized URL', ...dynamicHeadersArray];

    const csvContent = [
      headers.join(','),
      ...filteredRegistrants.map((r: any) => {
        const row = [
          `"${r.name}"`,
          `"${r.email || ''}"`,
          `"${r.phone || ''}"`,
          `"${r.entityName || ''}"`,
          r.status,
          r.registeredAt ? `"${format(new Date(r.registeredAt), 'yyyy-MM-dd HH:mm:ss')}"` : '""',
          r.status === 'attended' && r.attendedAt ? `"${format(new Date(r.attendedAt), 'yyyy-MM-dd HH:mm:ss')}"` : '""',
          `"${r.personalizedMeetingUrl || ''}"`,
          ...dynamicHeadersArray.map(h => `"${r.registrationData?.[h] || ''}"`)
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `registrants-${meeting?.entitySlug || 'meeting'}-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  if (isLoadingMeeting || isLoadingRegistrants || isLoadingEntities) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Loading unified portal...</p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Meeting not found</h2>
          <Button onClick={() => router.push('/admin/meetings')}>Back to Meetings</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-8 space-y-8 overflow-y-auto bg-background">
      <Tabs defaultValue="invitations" className="w-full space-y-8">
      
      {/* Executive Combined Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0">
            <Link href={`/admin/meetings/${meetingId}`}>
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex flex-col justify-center">
            <h1 className="text-2xl font-black tracking-tight text-foreground leading-none flex items-center gap-2">
              Session Management Hub
            </h1>
            <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-1.5 flex items-center gap-2">
              <Badge variant="secondary" className="px-2 py-0 h-5 font-bold">{meeting.type.name}</Badge>
              <span>{meeting.entityName}</span>
            </div>
          </div>
        </div>
        <TabsList className="grid w-full sm:w-[420px] grid-cols-2 bg-muted/50 p-1.5 h-11 rounded-2xl">
          <TabsTrigger value="invitations" className="rounded-xl font-bold text-xs gap-2">
            <Send className="h-4 w-4" /> Bulk Invites & Filters
          </TabsTrigger>
          <TabsTrigger value="registrants" className="rounded-xl font-bold text-xs gap-2">
            <Users className="h-4 w-4" /> Registrants & Attendance ({stats.total})
          </TabsTrigger>
        </TabsList>
      </div>

        {/* ========================================================================= */}
        {/* TABS CONTENT: INVITATION WORKSPACE */}
        {/* ========================================================================= */}
        <TabsContent value="invitations" className="space-y-8 animate-in fade-in duration-300">
          
          {/* RSVP Real-time Tracker Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Invited', count: stats.invited, icon: <Send className="h-4 w-4 text-primary" />, bg: 'bg-primary/5 border-primary/20' },
              { label: 'Going', count: stats.going, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, bg: 'bg-emerald-500/5 border-emerald-500/20' },
              { label: 'Declined', count: stats.not_going, icon: <XCircle className="h-4 w-4 text-rose-500" />, bg: 'bg-rose-500/5 border-rose-500/20' },
              { label: 'Later', count: stats.later, icon: <Clock className="h-4 w-4 text-amber-500" />, bg: 'bg-amber-500/5 border-amber-500/20' },
              { label: 'Pending', count: stats.pending, icon: <Info className="h-4 w-4 text-slate-500" />, bg: 'bg-slate-500/5 border-slate-500/20' },
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Filter tools */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl">
                <CardHeader className="bg-muted/30 border-b py-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Target Audience Criteria
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">

                  {/* Audience Mode Selector */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audience Source</span>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'manual' as const, icon: <Filter className="h-4 w-4" />, label: 'Custom Filters' },
                        { value: 'saved' as const, icon: <BookmarkCheck className="h-4 w-4" />, label: 'Saved Audience' },
                      ].map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setAudienceMode(m.value)}
                          className={cn(
                            'flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 transition-all font-semibold text-xs',
                            audienceMode === m.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border/50 hover:border-primary/20 text-muted-foreground'
                          )}
                        >
                          {m.icon}
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Saved Audience Select */}
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
                              No saved audiences found
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Assignee Filter */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Filter by Assignee
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'all', label: 'All Users' },
                        { id: 'mine', label: `My Assignees (${currentUser?.displayName || 'Mine'})` },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAssigneeFilter(opt.id as 'all' | 'mine')}
                          className={cn(
                            'flex items-center justify-center p-3.5 rounded-xl border-2 transition-all font-semibold text-xs',
                            assigneeFilter === opt.id
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border/50 hover:border-primary/20 text-muted-foreground'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Select Channels */}
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
                            className={cn('flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 transition-all font-semibold text-xs',
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

                  {/* Templates Choices */}
                  {(selectedChannels.includes('email') || selectedChannels.includes('sms')) && (
                    <div className="py-4 space-y-5">
                      {/* Section label */}
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 shrink-0">Template Selection</span>
                        <div className="h-px flex-1 bg-border/40" />
                      </div>

                      {/* Template columns — side by side columns */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {selectedChannels.includes('email') && (
                          <div className="space-y-3 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email Template</span>
                              {emailTemplateId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] font-bold text-primary gap-1"
                                  onClick={() => { setPreviewChannel('email'); setPreviewTemplateOpen(true); }}
                                >
                                  <Eye className="h-3 w-3" /> Preview
                                </Button>
                              )}
                            </span>
                            <MessagingTemplateSelector
                              category="meetings"
                              recipientType="external_alert"
                              channel="email"
                              templateTypePrefix="meeting_invitation"
                              value={emailTemplateId}
                              onValueChange={setEmailTemplateId}
                              placeholder="Choose or create email template..."
                            />
                          </div>
                        )}

                        {selectedChannels.includes('sms') && (
                          <div className="space-y-3 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                              <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> SMS Template</span>
                              {smsTemplateId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] font-bold text-primary gap-1"
                                  onClick={() => { setPreviewChannel('sms'); setPreviewTemplateOpen(true); }}
                                >
                                  <Eye className="h-3 w-3" /> Preview
                                </Button>
                              )}
                            </span>
                            <MessagingTemplateSelector
                              category="meetings"
                              recipientType="external_alert"
                              channel="sms"
                              templateTypePrefix="meeting_invitation"
                              value={smsTemplateId}
                              onValueChange={setSmsTemplateId}
                              placeholder="Choose or create SMS template..."
                            />
                          </div>
                        )}
                      </div>

                      {/* Separator below template section */}
                      <div className="h-px bg-border/40" />
                    </div>
                  )}

                  {/* Contact Target Scope */}
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

                  {/* Roles list */}
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

                  {/* Tag Filters */}
                  <TagAudienceSelector
                    onChange={(seg) => setTagSegment(seg)}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Summary column */}
            <div className="space-y-6">
              
              {/* Summary and actions */}
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

                  {/* Scheduling options */}
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

              {/* Sample list */}
              <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-primary" />
                    Audience Sample ({filteredRecipients.slice(0, 15).length})
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
                          <p className="font-bold text-foreground truncate flex items-center gap-1">
                            {contact.name}
                            <span className="text-[10px] text-muted-foreground font-normal">({contact.entityName})</span>
                          </p>
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

          {/* Invited Guests Ledger Card */}
          <Card className="rounded-2xl border-none overflow-hidden ring-1 ring-border shadow-sm bg-card mt-8">
            <CardHeader className="bg-muted/30 border-b py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    Invited Guests Roster
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-sans">
                    All contacts who have been sent one-click invitations for this session.
                  </p>
                </div>
                
                {/* Search Invited Guests */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="search" 
                    placeholder="Search invited guests..." 
                    value={searchQueryInvites}
                    onChange={(e) => setSearchQueryInvites(e.target.value)}
                    className="pl-9 h-10 rounded-xl bg-card border-border/50 text-xs font-semibold font-sans"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 border-b border-border/40">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 pl-6 font-sans">Invitee Details</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 font-sans">Associated Entity</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 font-sans">First Invited</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 font-sans">Last Sent</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 w-32 font-sans">RSVP Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 w-12 text-right pr-6 font-sans"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvites.map((invitee: any) => (
                    <TableRow key={invitee.id} className="group border-b border-border/40 hover:bg-muted/30 transition-colors duration-150">
                      <TableCell className="pl-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground font-sans">{invitee.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-sans">
                            <Mail className="h-3 w-3" /> {invitee.email || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground font-sans">
                        {invitee.entityName || invitee.entityId || <span className="text-muted-foreground/30 font-normal">—</span>}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground font-sans">
                        {invitee.registeredAt ? format(new Date(invitee.registeredAt), 'MMM d, yyyy') : 'Unknown'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground font-sans">
                        {invitee.lastInviteSentAt ? format(new Date(invitee.lastInviteSentAt), 'MMM d, h:mm a') : 'Not sent'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          'text-[9px] font-bold uppercase rounded-lg px-2 h-5 border-none shadow-sm transition-all font-sans',
                          invitee.rsvpStatus === 'going' && 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/20',
                          invitee.rsvpStatus === 'not_going' && 'bg-rose-500/10 text-rose-600 dark:bg-rose-950/20',
                          invitee.rsvpStatus === 'later' && 'bg-amber-500/10 text-amber-600 dark:bg-amber-950/20',
                          (!invitee.rsvpStatus || invitee.rsvpStatus === 'pending') && 'bg-slate-500/10 text-slate-600 dark:bg-slate-950/20'
                        )}>
                          {invitee.rsvpStatus === 'going' ? 'Going' : invitee.rsvpStatus === 'not_going' ? 'Declined' : invitee.rsvpStatus === 'later' ? 'Later' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0 hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                            <p className="text-[10px] font-bold text-muted-foreground px-2 py-1.5 uppercase tracking-wider font-sans">Quick Actions</p>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              disabled={invitee.rsvpStatus === 'going' || invitee.status === 'approved' || invitee.status === 'attended'}
                              onClick={async () => {
                                setIsSending(true);
                                try {
                                  await sendMeetingInvitationsAction(
                                    meetingId,
                                    activeWorkspaceId || '',
                                    [{
                                      entityId: invitee.entityId || '',
                                      name: invitee.name,
                                      email: invitee.email,
                                      phone: invitee.phone,
                                      entityName: invitee.entityName
                                    }],
                                    selectedChannels,
                                    emailTemplateId,
                                    smsTemplateId
                                  );
                                  toast({ title: 'Success', description: 'Invitation resent successfully.' });
                                } catch (e: any) {
                                  toast({ variant: 'destructive', title: 'Error', description: e.message });
                                } finally {
                                  setIsSending(false);
                                }
                              }}
                              className="rounded-lg text-xs font-semibold font-sans"
                            >
                              <Send className="h-4 w-4 mr-2" /> Resend Invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setRegistrantToDelete(invitee)} className="rounded-lg text-xs font-bold text-destructive focus:bg-destructive/5 font-sans">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete Guest Invite
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredInvites.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground/60 text-xs italic font-sans">
                        No invited guests matches your filter/search criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TABS CONTENT: REGISTRANTS LEDGER */}
        {/* ========================================================================= */}
        <TabsContent value="registrants" className="space-y-8 animate-in fade-in duration-300">
          
          {/* Registrants KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Registrants</p>
                    <p className="text-3xl font-semibold">{stats.total}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-xl"><Users className="h-5 w-5 text-primary" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Attended</p>
                    <p className="text-3xl font-semibold text-emerald-600 dark:text-emerald-500">{stats.attended}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl"><UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-500" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Pending/No Show</p>
                    <p className="text-3xl font-semibold text-amber-600 dark:text-amber-500">{stats.pendingRegistrants}</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-xl"><Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Attendance Rate</p>
                    <p className="text-3xl font-semibold">{stats.attendanceRate}%</p>
                  </div>
                  <div className="p-3 bg-violet-500/10 rounded-xl"><ClipboardCheck className="h-5 w-5 text-violet-600 dark:text-violet-500" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Roster & Table Card */}
          <Card className="rounded-2xl border-none overflow-hidden ring-1 ring-border shadow-sm relative bg-card">
            {/* Bulk Toolbar overlay */}
            {selectedIds.size > 0 && (
              <div className="absolute top-0 left-0 right-0 z-20 bg-primary/5 border-b border-primary/20 p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-primary text-primary-foreground border-none font-bold">
                    {selectedIds.size} Selected
                  </Badge>
                  <span className="text-xs font-semibold text-primary/80">Apply bulk action:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => handleBulkAction('approve')} disabled={isProcessingBulk}>
                    <Check className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => handleBulkAction('cancel')} disabled={isProcessingBulk}>
                    <X className="h-3 w-3 mr-1" /> Disapprove
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => handleBulkAction('sendLinks')} disabled={isProcessingBulk}>
                    <Send className="h-3 w-3 mr-1" /> Send Links
                  </Button>
                  <Button variant="destructive" size="sm" className="h-8 text-xs font-bold" onClick={() => handleBulkAction('delete')} disabled={isProcessingBulk}>
                    {isProcessingBulk ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                    Delete
                  </Button>
                  <div className="w-px h-6 bg-primary/20 mx-1"></div>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
                </div>
              </div>
            )}

            <CardHeader className="bg-muted/30 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6">
              <div>
                <CardTitle className="text-lg font-bold">Registration Roster</CardTitle>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name, email, or school..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl bg-background border-none ring-1 ring-border shadow-sm focus-visible:ring-primary w-full text-xs font-semibold"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Columns Customizer */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-none ring-1 ring-border shadow-sm shrink-0">
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                      <p className="text-[10px] font-bold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">Customize Columns</p>
                      <DropdownMenuSeparator />
                      {allAvailableFields.map((field) => {
                        const isChecked = activeColumns.includes(field.key);
                        return (
                          <DropdownMenuCheckboxItem
                            key={field.key}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setHasCustomizedColumns(true);
                              setVisibleColumnKeys(prev => {
                                if (checked) return [...prev, field.key];
                                return prev.filter(k => k !== field.key);
                              });
                            }}
                            className="rounded-lg text-xs font-semibold"
                          >
                            {field.label}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="outline" className="font-bold gap-2 rounded-xl h-10 border-none ring-1 ring-border shadow-sm text-xs" onClick={handleExportCSV} disabled={!filteredRegistrants.length}>
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                  <Button className="font-bold gap-2 rounded-xl h-10 text-xs" onClick={() => setIsRegisterOpen(true)}>
                    <Plus className="h-4 w-4" /> Add Registrant
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 border-b border-border/40">
                    <TableHead className="w-12 pl-4">
                      <Checkbox 
                        checked={filteredRegistrants.length > 0 && selectedIds.size === filteredRegistrants.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">Registrant Details</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">Associated Entity</TableHead>
                    {allAvailableFields.map((field) => {
                      const isVisible = activeColumns.includes(field.key);
                      if (!isVisible) return null;
                      return (
                        <TableHead key={field.key} className="text-[10px] font-bold uppercase tracking-wider py-4">{field.label}</TableHead>
                      );
                    })}
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4">Signup Date</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 w-32">Attendance</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider py-4 w-12 text-right pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrants.map((registrant: any) => (
                    <TableRow key={registrant.id} className="group border-b border-border/40 hover:bg-muted/30 transition-colors duration-150" data-state={selectedIds.has(registrant.id) ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <Checkbox 
                          checked={selectedIds.has(registrant.id)}
                          onCheckedChange={() => toggleOne(registrant.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{registrant.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> {registrant.email || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground">
                        {registrant.entityName || registrant.entityId || <span className="text-muted-foreground/30 font-normal">—</span>}
                      </TableCell>
                      {allAvailableFields.map((field) => {
                        const isVisible = activeColumns.includes(field.key);
                        if (!isVisible) return null;
                        const val = getFormattedFieldValue(registrant, field.key);
                        return (
                          <TableCell key={field.key} className="text-xs font-semibold text-foreground/90 max-w-[200px] truncate">
                            {val ? val : <span className="text-muted-foreground/30 font-normal">—</span>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {registrant.registeredAt ? format(new Date(registrant.registeredAt), 'MMM d, h:mm a') : 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={registrant.status === 'attended'}
                            onCheckedChange={() => handleToggleAttendance(registrant)}
                            disabled={isToggling[registrant.id]}
                          />
                          <Badge variant="outline" className={cn(
                            'text-[9px] font-bold uppercase rounded-lg px-2 h-5 border-none shadow-sm transition-all',
                            registrant.status === 'attended' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/20' 
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {isToggling[registrant.id] ? 'Updating...' : registrant.status === 'attended' ? 'Attended' : 'No Show'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0 hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                            <p className="text-[10px] font-bold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">Quick Actions</p>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleSendLink(registrant)} className="rounded-lg text-xs font-semibold">
                              <Send className="h-4 w-4 mr-2" /> Send Join Link
                            </DropdownMenuItem>
                            {registrant.status === 'cancelled' ? (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(registrant, 'approved')} className="rounded-lg text-xs font-semibold">
                                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" /> Approve Signup
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(registrant, 'cancelled')} className="rounded-lg text-xs font-semibold">
                                <XCircle className="h-4 w-4 mr-2 text-rose-500" /> Cancel Signup
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setRegistrantToDelete(registrant)} className="rounded-lg text-xs font-bold text-destructive focus:bg-destructive/5">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete Roster Entry
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRegistrants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={activeColumns.length + 6} className="h-32 text-center text-muted-foreground/60 text-xs italic">
                        No registrants matches your filter/search criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>


      {/* ========================================================================= */}
      {/* MODAL: PREMIUM MINIMAL TEMPLATE PREVIEW */}
      {/* ========================================================================= */}
      <Dialog open={previewTemplateOpen} onOpenChange={setPreviewTemplateOpen}>
        <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden bg-background border rounded-3xl shadow-2xl">
          <div className="p-6 border-b flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                {previewChannel === 'email' ? <Mail className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="text-sm font-black leading-none text-foreground">
                  {previewChannel === 'email' ? 'Email Template Preview' : 'SMS Template Preview'}
                </h3>
              </div>
            </div>
          </div>

          <div className="p-6 bg-muted/10 overflow-y-auto max-h-[70vh]">
            {previewChannel === 'email' ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 p-4 rounded-2xl border bg-card shadow-sm">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Subject Line</span>
                  <p className="text-xs font-bold text-foreground">
                    {emailTemplate?.subject ? emailTemplate.subject.replace('{{meeting_title}}', meeting.heroTitle || meeting.entityName || 'Session') : 'You\'re Invited to the Session'}
                  </p>
                </div>
                
                <div className="border rounded-2xl overflow-hidden bg-white shadow-sm p-6 min-h-[300px] text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                  {emailTemplate?.body ? (
                    emailTemplate.body
                      .replace('{{contact_name}}', 'Dear Parent')
                      .replace('{{meeting_title}}', meeting.heroTitle || meeting.entityName || 'Session')
                      .replace('{{meeting_date}}', meeting.meetingTime ? format(new Date(meeting.meetingTime), 'PPPP') : 'Date TBD')
                      .replace('{{meeting_time}}', meeting.meetingTime ? format(new Date(meeting.meetingTime), 'p') : 'Time TBD')
                      .replace('{{meeting_timezone}}', 'EST')
                      .replace('{{meeting_type}}', meeting.type?.name || 'Interactive')
                      .replace('{{meeting_link}}', 'https://smartsapp.com/rsvp')
                      .replace('{{meeting_registrant_one_click_link}}', 'https://smartsapp.com/rsvp')
                      .replace('{{calendar_link}}', 'https://smartsapp.com/calendar')
                      .replace('{{organization_name}}', 'SmartSapp Academy')
                  ) : (
                    'No email template body.'
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-6">
                <div className="max-w-[320px] w-full border-[5px] border-slate-800 rounded-[28px] overflow-hidden shadow-xl bg-slate-50 relative">
                  <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-lg mx-auto w-[100px] z-10" />
                  <div className="bg-white p-3 border-b flex items-center justify-center pt-6">
                    <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      Interactive SMS Simulation
                    </p>
                  </div>
                  <div className="p-4 bg-slate-100 min-h-[220px] flex flex-col justify-end">
                    <div className="bg-[#007AFF] text-white p-3 rounded-2xl rounded-br-sm text-[12px] leading-snug shadow-sm whitespace-pre-wrap">
                      {smsTemplate?.body ? (
                        smsTemplate.body
                          .replace('{{contact_name}}', 'Parent')
                          .replace('{{meeting_title}}', meeting.heroTitle || meeting.entityName || 'Session')
                          .replace('{{meeting_date}}', meeting.meetingTime ? format(new Date(meeting.meetingTime), 'PPPP') : 'Date TBD')
                          .replace('{{meeting_time}}', meeting.meetingTime ? format(new Date(meeting.meetingTime), 'p') : 'Time TBD')
                          .replace('{{meeting_timezone}}', 'EST')
                          .replace('{{meeting_link}}', 'https://smartsapp.com/rsvp')
                          .replace('{{meeting_registrant_one_click_link}}', 'https://smartsapp.com/rsvp')
                          .replace('{{organization_name}}', 'SmartSapp')
                      ) : (
                        'No SMS body.'
                      )}
                    </div>
                    <p className="text-[8px] text-slate-400 text-right mt-1.5 mr-1">Delivered via SmartSapp</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: MANUAL REGISTRATION FORM */}
      {/* ========================================================================= */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-3xl border shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" /> Add Roster Registrant
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualRegister} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="reg-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
              <Input 
                id="reg-name"
                placeholder="Parent/Guardian Name" 
                value={regForm.name} 
                onChange={e => setRegForm(prev => ({ ...prev, name: e.target.value }))}
                className="h-10 rounded-xl bg-muted/20 border-none ring-1 ring-border text-xs font-semibold"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reg-email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
              <Input 
                id="reg-email"
                type="email"
                placeholder="parent@example.com" 
                value={regForm.email} 
                onChange={e => setRegForm(prev => ({ ...prev, email: e.target.value }))}
                className="h-10 rounded-xl bg-muted/20 border-none ring-1 ring-border text-xs font-semibold"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reg-phone" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone Number (Optional)</Label>
              <Input 
                id="reg-phone"
                placeholder="+1234567890" 
                value={regForm.phone} 
                onChange={e => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                className="h-10 rounded-xl bg-muted/20 border-none ring-1 ring-border text-xs font-semibold"
              />
            </div>
            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" className="rounded-xl font-bold text-xs" onClick={() => setIsRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isRegistering} className="rounded-xl font-bold text-xs">
                {isRegistering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add to Roster
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: CONFIRM DELETE ROSTER ENTRY */}
      {/* ========================================================================= */}
      <AlertDialog open={!!registrantToDelete} onOpenChange={(open) => !open && setRegistrantToDelete(null)}>
        <AlertDialogContent className="rounded-3xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" /> Permanently Delete Roster Entry?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-semibold text-muted-foreground mt-2">
              This will permanently delete {registrantToDelete?.name} from this session's database roster, cancelling their invitation link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl text-xs font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRegistrant} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-bold">
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </Tabs>
    </div>
  );
}
